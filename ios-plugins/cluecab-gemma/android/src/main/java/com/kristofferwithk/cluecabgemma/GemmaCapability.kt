package com.kristofferwithk.cluecabgemma

/**
 * Whether this Android phone can run offline Casey at all. Unlike the iPhone, where every
 * phone that runs 900words gets the switch and those under 8 GB get a warning, Android spans
 * phones that cannot load the model in any way, so those are refused before a 3 GB download.
 *
 * The bar is deliberately the floor, not the recommendation: an estimate until the device
 * gate measures real phones. Google's own Gallery app lists 12 GB for Gemma 4 E4B, so the
 * app warns below that (src/ai/gemma/native.ts) rather than refusing.
 */
internal object GemmaCapability {
    /**
     * Android 12. LiteRT-LM's GPU backend loads the phone's OpenCL driver, which an app may
     * open only through the manifest's uses-native-library, honoured from Android 12.
     */
    const val MIN_SDK = 31

    /** The two ABIs LiteRT-LM ships its JNI library for. */
    val ABIS = setOf("arm64-v8a", "x86_64")

    /**
     * An "8 GB" phone reports about 7.3 to 7.7 GB to apps (the rest is reserved by the
     * system), the same class the iPhone warns below (EIGHT_GB_CLASS_BYTES in native.ts).
     */
    const val EIGHT_GB_CLASS_BYTES = 7_000_000_000L

    enum class Refusal(val code: String) {
        ANDROID_VERSION("android-version"),
        ABI("abi"),
        MEMORY("memory"),
    }

    /** Null when the phone can try, otherwise the first reason it cannot. */
    fun refusal(sdkInt: Int, supportedAbis: List<String>, totalMemoryBytes: Long): Refusal? = when {
        sdkInt < MIN_SDK -> Refusal.ANDROID_VERSION
        supportedAbis.none { it in ABIS } -> Refusal.ABI
        totalMemoryBytes < EIGHT_GB_CLASS_BYTES -> Refusal.MEMORY
        else -> null
    }
}
