package com.kristofferwithk.cluecabgemma

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.StatFs
import android.os.SystemClock
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Offline Casey on Android: the same "Gemma" plugin, with the same methods, event and
 * PUT_AWAY code, as the iPhone's ios/Sources/GemmaPlugin/GemmaPlugin.swift, so
 * src/ai/gemma/ runs unchanged on both.
 *
 * The model lives in the app's no-backup folder, which Android's Auto Backup and
 * device-to-device transfer both leave out: 3 GB that can be downloaded again does not belong
 * in a player's Google Drive backup.
 */
@CapacitorPlugin(name = "Gemma")
class GemmaPlugin : Plugin() {
    private lateinit var runtime: GemmaRuntime

    private val lock = Any()
    @Volatile private var downloadThread: Thread? = null
    @Volatile private var downloadCancelled = false
    @Volatile private var finishingDownload = false
    @Volatile private var downloadedBytes = 0L
    @Volatile private var lastError: String? = null
    private var lastNotified = 0L

    override fun load() {
        val preferences = context.getSharedPreferences("cluecab-gemma", Context.MODE_PRIVATE)
        // Per model and per Android build: an OS update may bring the GPU driver it lacked.
        val gpuKey = "gpu-refused:${GemmaModel.SHA256}:${Build.FINGERPRINT}"
        runtime = GemmaRuntime(
            cacheDirectory.path,
            object : GemmaRuntime.GpuMemory {
                override fun refused() = preferences.getBoolean(gpuKey, false)
                override fun refuse() = preferences.edit().putBoolean(gpuKey, true).apply()
            },
        )
    }

    /**
     * Leaving the app (another app, the Home screen, a locked phone) puts offline Casey away:
     * she holds gigabytes of memory, which is what Android kills a background app for first.
     * A turn she was thinking about is asked again when the player comes back. Only the
     * activity leaving the screen counts: a dialog or a notification shade over it does not
     * reach onStop, so it costs no reload.
     */
    override fun handleOnStop() {
        super.handleOnStop()
        runtime.inBackground = true
        runtime.unload()
    }

    override fun handleOnStart() {
        super.handleOnStart()
        runtime.inBackground = false
    }

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(statusPayload())
    }

    /**
     * The app no longer needs offline Casey (her round ended, or the player went back to
     * normal Casey): free her memory now.
     */
    @PluginMethod
    fun unloadModel(call: PluginCall) {
        runtime.unload { call.resolve() }
    }

    @PluginMethod
    fun download(call: PluginCall) {
        refusal()?.let {
            call.reject(refusalMessage(it), it.code)
            return
        }
        synchronized(lock) {
            if (isInstalled() || downloadThread != null || finishingDownload) {
                call.resolve(JSObject().put("started", false))
                return
            }
            val directory = modelDirectory
            if (!directory.isDirectory && !directory.mkdirs()) {
                call.reject("900words could not prepare storage for Gemma.")
                return
            }
            val have = if (partialFile.exists()) partialFile.length() else 0L
            val needed = GemmaModel.BYTES - have + GemmaModel.ENGINE_CACHE_BYTES + GemmaModel.FREE_SPACE_MARGIN_BYTES
            if (freeBytes() < needed) {
                call.reject("This phone needs at least ${String.format(Locale.ROOT, "%.1f", needed / 1e9)} GB free before downloading Gemma.")
                return
            }
            lastError = null
            downloadCancelled = false
            downloadedBytes = have
            val thread = Thread({ runDownload() }, "cluecab-gemma-download")
            downloadThread = thread
            thread.start()
        }
        notifyStatus(force = true)
        call.resolve(JSObject().put("started", true))
    }

    @PluginMethod
    fun cancelDownload(call: PluginCall) {
        stopDownload()
        notifyStatus(force = true)
        call.resolve()
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        stopDownload()
        // After the engine is closed: it holds the file open.
        runtime.unload {
            modelFile.delete()
            markerFile.delete()
            partialFile.delete()
            cacheDirectory.deleteRecursively()
            notifyStatus(force = true)
            call.resolve()
        }
    }

    /** Stops the generation in progress, if any; its own call then rejects. */
    @PluginMethod
    fun cancelGeneration(call: PluginCall) {
        runtime.cancel()
        call.resolve()
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        if (!isInstalled()) {
            call.reject("Gemma is not downloaded on this phone yet.")
            return
        }
        val system = call.getString("system")
        val prompt = call.getString("prompt")
        val temperature = call.getDouble("temperature")
        val maxOutputTokens = call.getInt("maxOutputTokens")
        if (system == null || prompt == null || temperature == null || maxOutputTokens == null) {
            call.reject("Gemma received an incomplete generation request.")
            return
        }
        cacheDirectory.mkdirs()
        runtime.generate(modelFile.path, system, prompt, temperature, maxOutputTokens) { result ->
            result.fold(
                onSuccess = {
                    call.resolve(
                        JSObject()
                            .put("text", it.text)
                            .put("loadMs", it.loadMs)
                            .put("firstTokenMs", it.firstTokenMs)
                            .put("generationMs", it.generationMs)
                            .put("totalMs", it.totalMs)
                            .put("backend", it.backend)
                    )
                },
                onFailure = { error ->
                    when (error) {
                        // The code is what src/ai/gemma/decision.ts waits on.
                        is GemmaPutAway -> call.reject("Offline Casey was put away before she answered.", "PUT_AWAY")
                        is Exception -> call.reject("Gemma could not finish this Casey turn.", null, error)
                        // UnsatisfiedLinkError, OutOfMemoryError: reported, never thrown at the bridge.
                        else -> call.reject("Gemma could not finish this Casey turn: ${error.javaClass.simpleName}.")
                    }
                },
            )
        }
    }

    // ── the download ──────────────────────────────────────────────────────────────────────

    private fun runDownload() {
        var failures = 0
        try {
            while (true) {
                val network = awaitWifi() ?: throw DownloadCancelled()
                try {
                    ModelDownload(
                        url = GemmaModel.URL,
                        expectedBytes = GemmaModel.BYTES,
                        partial = partialFile,
                        open = { network.openConnection(it) as HttpURLConnection },
                        cancelled = { downloadCancelled },
                        onBytes = { bytes ->
                            downloadedBytes = bytes
                            notifyStatus()
                        },
                    ).run()
                    break
                } catch (error: DownloadCancelled) {
                    throw error
                } catch (error: IOException) {
                    // Wi-Fi dropped or the server hiccupped: the partial file stays, and the
                    // next attempt continues from where this one stopped.
                    if (++failures > RETRY_WAITS_MS.size) throw error
                    if (!sleepUnlessCancelled(RETRY_WAITS_MS[failures - 1])) throw DownloadCancelled()
                }
            }
            finishingDownload = true
            downloadThread = null
            notifyStatus(force = true)
            verifyAndInstall()
        } catch (error: DownloadCancelled) {
            partialFile.delete()
            lastError = null
        } catch (error: Exception) {
            lastError = "The Gemma download stopped. Keep 900words open on Wi-Fi and try again."
        } finally {
            synchronized(lock) {
                if (downloadThread === Thread.currentThread()) downloadThread = null
                finishingDownload = false
            }
            notifyStatus(force = true)
        }
    }

    private fun verifyAndInstall() {
        if (partialFile.length() != GemmaModel.BYTES || ModelDownload.sha256(partialFile) != GemmaModel.SHA256) {
            partialFile.delete()
            lastError = "The downloaded Gemma file did not pass its integrity check."
            return
        }
        modelFile.delete()
        if (!partialFile.renameTo(modelFile)) throw IOException("could not move the model into place")
        markerFile.writeText(GemmaModel.SHA256)
        lastError = null
    }

    /** The download thread sees the flag within a second, or within one buffer read. */
    private fun stopDownload() {
        downloadCancelled = true
    }

    /**
     * A Wi-Fi (or Ethernet) network to download on, waiting for one if the phone has none
     * yet, as the iPhone's session waits for connectivity. Connections are opened on that
     * network itself, so a dropped Wi-Fi fails the download rather than moving it onto mobile
     * data. Null when the download was cancelled while waiting.
     */
    private fun awaitWifi(): Network? {
        val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        connectivity.activeNetwork?.let { if (isWifi(connectivity.getNetworkCapabilities(it))) return it }
        var found: Network? = null
        val ready = CountDownLatch(1)
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                if (isWifi(capabilities) && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
                    found = network
                    ready.countDown()
                }
            }
        }
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            .build()
        connectivity.registerNetworkCallback(request, callback)
        try {
            while (!downloadCancelled) {
                try {
                    if (ready.await(1, TimeUnit.SECONDS)) return found
                } catch (_: InterruptedException) {
                    // remove() or cancelDownload(): the flag says which way out.
                }
            }
            return null
        } finally {
            connectivity.unregisterNetworkCallback(callback)
        }
    }

    private fun isWifi(capabilities: NetworkCapabilities?): Boolean =
        capabilities != null &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) &&
            (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))

    private fun sleepUnlessCancelled(ms: Long): Boolean {
        val until = SystemClock.elapsedRealtime() + ms
        while (!downloadCancelled && SystemClock.elapsedRealtime() < until) {
            try {
                Thread.sleep(250)
            } catch (_: InterruptedException) {
                // The flag decides.
            }
        }
        return !downloadCancelled
    }

    // ── files and the phone ───────────────────────────────────────────────────────────────

    private val modelDirectory: File get() = File(context.noBackupFilesDir, "CaseyModels")
    private val cacheDirectory: File get() = File(context.cacheDir, "Gemma4E4B")
    private val modelFile: File get() = File(modelDirectory, GemmaModel.NAME)
    private val partialFile: File get() = File(modelDirectory, "${GemmaModel.NAME}.partial")
    private val markerFile: File get() = File(modelDirectory, "${GemmaModel.NAME}.sha256")

    private fun isInstalled(): Boolean =
        modelFile.isFile &&
            modelFile.length() == GemmaModel.BYTES &&
            runCatching { markerFile.readText() }.getOrNull() == GemmaModel.SHA256

    private fun freeBytes(): Long =
        runCatching { StatFs(context.noBackupFilesDir.path).availableBytes }.getOrDefault(0L)

    private fun totalMemoryBytes(): Long {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return ActivityManager.MemoryInfo().also { manager.getMemoryInfo(it) }.totalMem
    }

    private fun refusal(): GemmaCapability.Refusal? =
        GemmaCapability.refusal(Build.VERSION.SDK_INT, Build.SUPPORTED_ABIS.toList(), totalMemoryBytes())

    private fun refusalMessage(refusal: GemmaCapability.Refusal): String = when (refusal) {
        GemmaCapability.Refusal.ANDROID_VERSION -> "Offline Casey needs Android 12 or newer."
        GemmaCapability.Refusal.ABI -> "Offline Casey needs a 64-bit phone."
        GemmaCapability.Refusal.MEMORY -> "Offline Casey needs a phone with at least 8 GB of memory."
    }

    private fun statusPayload(): JSObject {
        val downloading = downloadThread != null || finishingDownload
        val progress = when {
            finishingDownload -> 1.0
            downloadThread != null -> downloadedBytes.toDouble() / GemmaModel.BYTES
            else -> 0.0
        }
        val refusal = refusal()
        val payload = JSObject()
            .put("supported", refusal == null)
            .put("installed", isInstalled())
            .put("downloading", downloading)
            .put("progress", progress)
            .put("expectedBytes", GemmaModel.BYTES)
            .put("freeBytes", freeBytes())
            // The app warns below 12 GB (src/ai/gemma/native.ts); the number itself goes
            // into the device-gate log.
            .put("physicalMemory", totalMemoryBytes().toDouble())
        refusal?.let { payload.put("unsupportedReason", it.code) }
        runtime.backend?.let { payload.put("backend", it) }
        lastError?.let { payload.put("error", it) }
        return payload
    }

    /** Progress at most every quarter second; a state change always. */
    private fun notifyStatus(force: Boolean = false) {
        val now = SystemClock.elapsedRealtime()
        if (!force && now - lastNotified < 250) return
        lastNotified = now
        notifyListeners("downloadProgress", statusPayload())
    }

    private companion object {
        /** How long to wait before continuing a download that stopped. */
        val RETRY_WAITS_MS = longArrayOf(2_000, 5_000, 15_000, 30_000, 60_000)
    }
}
