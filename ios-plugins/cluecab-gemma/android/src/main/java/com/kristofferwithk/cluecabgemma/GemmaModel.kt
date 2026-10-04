package com.kristofferwithk.cluecabgemma

/**
 * The one model file offline Casey downloads on Android: Gemma 4 E4B from the same pinned
 * Hugging Face revision as the iPhone (ios/Sources/GemmaPlugin/GemmaPlugin.swift), but not the
 * same file. The iPhone's `gemma-4-E4B-it-gpu.litertlm` holds only GPU ("artisan") weights:
 * on Android its CPU fallback has nothing to load (measured on the emulator, 2026-10-04:
 * "TF_LITE_PREFILL_DECODE not found"), so a phone whose GPU refuses it could not play at all.
 * This is the file Google's own Gallery app downloads on Android, with both CPU and GPU
 * sections (and vision and audio, which stay on disk unused).
 */
internal object GemmaModel {
    const val NAME = "gemma-4-E4B-it.litertlm"
    const val BYTES = 3_659_530_240L
    const val SHA256 = "0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0"
    const val URL =
        "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/" +
            "2eee7ac325f20eb8c9ac1d0e972f7c84663062da/gemma-4-E4B-it.litertlm?download=true"

    /**
     * Prompt AND reply. Casey's clue prompt alone measured about 4,400 tokens (13,199
     * characters, 2026-09-27). Mirrored as CONTEXT_TOKENS in src/ai/gemma/decision.ts.
     */
    const val CONTEXT_TOKENS = 8192

    /**
     * What the first load writes into the cache beside the file: the GPU's converted weights
     * measured 2,200,860,864 bytes on the emulator (2026-10-04). Rounded up.
     */
    const val ENGINE_CACHE_BYTES = 2_400_000_000L

    /** Room the phone keeps beyond the file and its cache, as on the iPhone. */
    const val FREE_SPACE_MARGIN_BYTES = 768L * 1024 * 1024
}
