package com.kristofferwithk.cluecabgemma

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GemmaCapabilityTest {
    private val arm = listOf("arm64-v8a", "armeabi-v7a", "armeabi")
    private val twelveGb = 11_400_000_000L

    @Test
    fun aRecentHighEndPhoneCanTry() {
        assertNull(GemmaCapability.refusal(36, arm, twelveGb))
    }

    @Test
    fun anEightGbClassPhoneCanTryToo() {
        // An "8 GB" phone reports about 7.5 GB; the app warns there, it does not refuse.
        assertNull(GemmaCapability.refusal(34, arm, 7_500_000_000L))
    }

    @Test
    fun theEmulatorCanTry() {
        assertNull(GemmaCapability.refusal(36, listOf("x86_64", "arm64-v8a"), 8_300_000_000L))
    }

    @Test
    fun beforeAndroid12TheGpuDriverCannotBeOpened() {
        assertEquals(GemmaCapability.Refusal.ANDROID_VERSION, GemmaCapability.refusal(30, arm, twelveGb))
    }

    @Test
    fun aThirtyTwoBitPhoneHasNoRuntime() {
        assertEquals(
            GemmaCapability.Refusal.ABI,
            GemmaCapability.refusal(33, listOf("armeabi-v7a", "armeabi"), twelveGb),
        )
    }

    @Test
    fun aSixGbPhoneIsRefusedBeforeTheDownload() {
        assertEquals(GemmaCapability.Refusal.MEMORY, GemmaCapability.refusal(35, arm, 5_700_000_000L))
    }
}
