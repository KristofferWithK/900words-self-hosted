package com.kristofferwithk.cluecabgemma

import android.os.SystemClock
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import java.io.File
import java.util.concurrent.CancellationException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * A generation needed the model after it was put away: the app left the screen, or the app
 * said Casey no longer needs her. The JavaScript side asks again once the player is back
 * (src/ai/gemma/decision.ts).
 */
internal class GemmaPutAway : Exception("put away")

internal class GemmaGeneration(
    val text: String,
    val loadMs: Long,
    val firstTokenMs: Long,
    val generationMs: Long,
    val totalMs: Long,
    val backend: String,
)

/**
 * The model and the one generation running on it. Everything that touches the engine runs on
 * one thread, in order, as the iPhone's actor does: one generation at a time, and the engine
 * is closed only between generations, never under one. Without a cancel, a generation that
 * never finishes would block every Casey turn after it.
 */
internal class GemmaRuntime(
    private val cacheDir: String,
    /**
     * Remembers, across launches, that this phone's GPU refused the model, so a later launch
     * does not spend minutes (and 2.2 GB of cache) finding out again.
     */
    private val gpuMemory: GpuMemory,
) {
    interface GpuMemory {
        fun refused(): Boolean
        fun refuse()
    }

    private val engineThread = Executors.newSingleThreadExecutor { Thread(it, "cluecab-gemma") }

    /** Engine-thread only. */
    private var engine: Engine? = null

    /** The conversation generating right now, so a caller that gave up on it can stop it. */
    @Volatile private var current: Conversation? = null

    /**
     * Counts every put-away. A generation asked for before one has lost its engine and must
     * not hand back the half reply a cancelled generation ends with.
     */
    private val putAways = AtomicInteger()

    /** Set by the plugin's lifecycle hooks, read from the engine thread. */
    @Volatile var inBackground = false

    /** Whether the GPU refused the model in this process; then the CPU plays. */
    @Volatile private var gpuRefused = gpuMemory.refused()

    /** Whether the GPU has answered at least once in this process. */
    @Volatile private var gpuAnswered = false

    /** The backend the loaded (or last loaded) engine runs on: "gpu" or "cpu". */
    @Volatile var backend: String? = null
        private set

    /**
     * Frees the model: gigabytes of memory while it is loaded. A generation in flight is
     * stopped first; the engine is closed once it has unwound. The next generation loads it
     * again.
     */
    fun unload(then: (() -> Unit)? = null) {
        putAways.incrementAndGet()
        stopCurrent()
        engineThread.execute {
            closeEngine()
            then?.invoke()
        }
    }

    fun cancel() = stopCurrent()

    fun generate(
        modelPath: String,
        system: String,
        prompt: String,
        temperature: Double,
        maxOutputTokens: Int,
        done: (Result<GemmaGeneration>) -> Unit,
    ) {
        // Taken when JavaScript asks, not when the thread gets to it: a put-away between the
        // two must still reach this generation.
        val generation = putAways.get()
        engineThread.execute {
            done(
                try {
                    Result.success(run(generation, modelPath, system, prompt, temperature, maxOutputTokens))
                } catch (error: Throwable) {
                    Result.failure(error)
                }
            )
        }
    }

    /**
     * One generation, and once more on the CPU when the GPU took the model but has never
     * answered: some phones (and the emulator) load it onto the GPU and then fail the first
     * generation, for instance without an OpenCL driver ("Can not find OpenCL library on this
     * device", measured on the emulator, 2026-10-04). A GPU that has answered before is not
     * second-guessed: its next failure is the turn's own.
     */
    private fun run(
        generation: Int,
        modelPath: String,
        system: String,
        prompt: String,
        temperature: Double,
        maxOutputTokens: Int,
    ): GemmaGeneration {
        try {
            return attempt(generation, modelPath, system, prompt, temperature, maxOutputTokens)
        } catch (error: Exception) {
            if (error is GemmaPutAway || error is CancellationException || backend != "gpu" || gpuAnswered) throw error
            refuseGpu()
            closeEngine()
            return attempt(generation, modelPath, system, prompt, temperature, maxOutputTokens)
        }
    }

    private fun attempt(
        generation: Int,
        modelPath: String,
        system: String,
        prompt: String,
        temperature: Double,
        maxOutputTokens: Int,
    ): GemmaGeneration {
        // Nothing loads or generates while the app is off screen: a phone kills a background
        // app holding gigabytes first.
        if (!stillWanted(generation)) throw GemmaPutAway()
        val started = SystemClock.elapsedRealtime()
        var loadMs = 0L

        val loaded = engine ?: run {
            val loadStarted = SystemClock.elapsedRealtime()
            val made = load(modelPath)
            // Put away while it loaded: the new engine goes instead of staying in memory.
            if (!stillWanted(generation)) {
                made.close()
                throw GemmaPutAway()
            }
            engine = made
            loadMs = SystemClock.elapsedRealtime() - loadStarted
            made
        }

        val conversation = loaded.createConversation(
            ConversationConfig(
                systemInstruction = Contents.of(system),
                samplerConfig = SamplerConfig(topK = 40, topP = 0.95, temperature = temperature, seed = 0),
            )
        )
        try {
            current = conversation
            // A put-away that came between the check above and `current` being set could not
            // stop this conversation, so look again now that it can.
            if (!stillWanted(generation)) throw GemmaPutAway()

            val generationStarted = SystemClock.elapsedRealtime()
            val finished = CountDownLatch(1)
            val text = StringBuilder()
            var firstTokenMs = 0L
            var failure: Throwable? = null
            conversation.sendMessageAsync(
                Message.user(prompt),
                object : MessageCallback {
                    override fun onMessage(message: Message) {
                        if (firstTokenMs == 0L) firstTokenMs = SystemClock.elapsedRealtime() - generationStarted
                        text.append(message.toString())
                    }

                    override fun onDone() = finished.countDown()

                    override fun onError(throwable: Throwable) {
                        failure = throwable
                        finished.countDown()
                    }
                },
                maxOutputToken = maxOutputTokens,
                thinkingConfig = ThinkingConfig(enableThinking = false),
            )
            finished.await()
            failure?.let { if (!stillWanted(generation)) throw GemmaPutAway() else throw it }
            // A put-away cancel may end the generation quietly, with half a reply.
            if (!stillWanted(generation)) throw GemmaPutAway()
            if (backend == "gpu") gpuAnswered = true

            return GemmaGeneration(
                text = text.toString(),
                loadMs = loadMs,
                firstTokenMs = firstTokenMs,
                generationMs = SystemClock.elapsedRealtime() - generationStarted,
                totalMs = SystemClock.elapsedRealtime() - started,
                backend = backend ?: "unknown",
            )
        } finally {
            current = null
            runCatching { conversation.close() }
        }
    }

    /**
     * The GPU first: on the phones Google measured it is about seven times faster at reading
     * Casey's long prompt and holds far less of the phone's own memory. A phone whose GPU
     * cannot take the model (no OpenCL driver, or too little memory for it) gets the CPU,
     * which is slower but still plays; the device-gate log records which one answered.
     */
    private fun load(modelPath: String): Engine {
        if (!gpuRefused) {
            try {
                return initialized(modelPath, Backend.GPU()).also { backend = "gpu" }
            } catch (error: Exception) {
                refuseGpu()
            }
        }
        return initialized(modelPath, Backend.CPU()).also { backend = "cpu" }
    }

    private fun initialized(modelPath: String, chosen: Backend): Engine {
        val made = Engine(
            EngineConfig(
                modelPath = modelPath,
                backend = chosen,
                maxNumTokens = GemmaModel.CONTEXT_TOKENS,
                cacheDir = cacheDir,
            )
        )
        made.initialize()
        return made
    }

    /**
     * The GPU's converted weights (about 2.2 GB for this model, beside the 3.7 GB file), of no
     * use once the CPU plays.
     */
    private fun refuseGpu() {
        gpuRefused = true
        runCatching { gpuMemory.refuse() }
        clearGpuCache()
    }

    private fun clearGpuCache() {
        File(cacheDir).listFiles { file -> file.name.contains("mldrift") }?.forEach { it.delete() }
    }

    private fun closeEngine() {
        val loaded = engine ?: return
        engine = null
        runCatching { loaded.close() }
    }

    private fun stopCurrent() {
        runCatching { current?.cancelProcess() }
    }

    /**
     * Whether the generation asked for at put-away count `generation` may still use the
     * model: nothing put it away since, and the app is on screen.
     */
    private fun stillWanted(generation: Int): Boolean = putAways.get() == generation && !inBackground
}
