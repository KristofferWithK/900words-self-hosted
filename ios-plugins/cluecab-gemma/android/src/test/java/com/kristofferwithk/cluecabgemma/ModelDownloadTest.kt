package com.kristofferwithk.cluecabgemma

import java.io.File
import java.io.IOException
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.file.Files
import java.security.MessageDigest
import kotlin.concurrent.thread
import kotlin.random.Random
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * The model download against a local server that behaves like Hugging Face: the model URL
 * redirects to a CDN address, which honours Range requests.
 */
class ModelDownloadTest {
    private val body = Random(7).nextBytes(3 * 1024 * 1024 + 123)
    private lateinit var server: ServerSocket
    private lateinit var dir: File
    private val ranges = mutableListOf<String?>()
    private var ignoreRange = false
    private var dropAfter: Int? = null

    @Before
    fun start() {
        dir = Files.createTempDirectory("gemma-download").toFile()
        server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: IOException) { break }
                thread(isDaemon = true) { socket.use { answer(it) } }
            }
        }
    }

    @After
    fun stop() {
        server.close()
        dir.deleteRecursively()
    }

    /** One HTTP/1.1 exchange, closed after the answer (no keep-alive). */
    private fun answer(socket: Socket) {
        val reader = socket.getInputStream().bufferedReader(Charsets.ISO_8859_1)
        val path = reader.readLine()?.split(" ")?.getOrNull(1) ?: return
        var range: String? = null
        while (true) {
            val line = reader.readLine() ?: return
            if (line.isEmpty()) break
            if (line.startsWith("Range:", ignoreCase = true)) range = line.substringAfter(":").trim()
        }
        val out = socket.getOutputStream()
        if (path.startsWith("/resolve/model")) {
            head(out, "302 Found", "Location: /cdn/model?signed=1", "Content-Length: 0")
            return
        }
        synchronized(ranges) { ranges.add(range) }
        val start = if (range != null && !ignoreRange) Regex("""bytes=(\d+)-""").find(range)!!.groupValues[1].toInt() else 0
        if (start > 0) {
            head(out, "206 Partial Content", "Content-Range: bytes $start-${body.size - 1}/${body.size}", "Content-Length: ${body.size - start}")
        } else {
            head(out, "200 OK", "Content-Length: ${body.size}")
        }
        val end = dropAfter?.let { minOf(body.size, start + it) } ?: body.size
        out.write(body, start, end - start)
        out.flush()
    }

    private fun head(out: OutputStream, status: String, vararg headers: String) {
        val text = (listOf("HTTP/1.1 $status", "Connection: close") + headers).joinToString("\r\n") + "\r\n\r\n"
        out.write(text.toByteArray(Charsets.ISO_8859_1))
    }

    private val url get() = "http://127.0.0.1:${server.localPort}/resolve/model"
    private val partial get() = File(dir, "model.partial")

    private fun download(cancelled: () -> Boolean = { false }, onBytes: (Long) -> Unit = {}) =
        ModelDownload(
            url = url,
            expectedBytes = body.size.toLong(),
            partial = partial,
            open = { it.openConnection() as HttpURLConnection },
            cancelled = cancelled,
            onBytes = onBytes,
        ).run()

    @Test
    fun followsTheRedirectAndFetchesTheWholeFile() {
        var lastReported = 0L
        download(onBytes = { lastReported = it })
        assertArrayEquals(body, partial.readBytes())
        assertEquals(body.size.toLong(), lastReported)
        assertEquals(listOf<String?>(null), ranges)
    }

    @Test
    fun continuesFromWhereTheFileEnds() {
        partial.writeBytes(body.copyOfRange(0, 1_000_000))
        download()
        assertArrayEquals(body, partial.readBytes())
        assertEquals(listOf<String?>("bytes=1000000-"), ranges)
    }

    @Test
    fun aDroppedConnectionKeepsWhatArrivedForTheNextAttempt() {
        dropAfter = 1024 * 1024
        try {
            download()
            fail("the dropped connection should fail this attempt")
        } catch (expected: IOException) {
            // The plugin retries on Wi-Fi.
        }
        val kept = partial.length()
        assertTrue("kept $kept bytes", kept in 1..body.size - 1)
        dropAfter = null
        download()
        assertArrayEquals(body, partial.readBytes())
        assertEquals("bytes=$kept-", ranges.last())
    }

    @Test
    fun startsOverWhenTheServerIgnoresTheRange() {
        ignoreRange = true
        partial.writeBytes(ByteArray(500_000) { 1 })
        download()
        assertArrayEquals(body, partial.readBytes())
    }

    @Test
    fun aFileLongerThanTheModelIsThrownAway() {
        partial.writeBytes(ByteArray(body.size + 10))
        download()
        assertArrayEquals(body, partial.readBytes())
        assertEquals(listOf<String?>(null), ranges)
    }

    @Test
    fun aCancelStopsTheDownload() {
        var calls = 0
        try {
            download(cancelled = { ++calls > 2 })
            fail("a cancelled download must not finish")
        } catch (expected: DownloadCancelled) {
            // The plugin deletes the partial file then.
        }
        assertFalse(partial.length() == body.size.toLong())
    }

    @Test
    fun readsTheStartOfAContentRange() {
        assertEquals(100L, ModelDownload.rangeStart("bytes 100-199/2969059328"))
        assertEquals(0L, ModelDownload.rangeStart("bytes 0-1/*"))
        assertNull(ModelDownload.rangeStart("items 100-199/200"))
        assertNull(ModelDownload.rangeStart(null))
    }

    @Test
    fun aPartialAnswerMustStartWhereTheFileEnds() {
        assertEquals(ModelDownload.Plan.Write(append = true), ModelDownload.plan(206, 100, "bytes 100-199/200"))
        assertEquals(ModelDownload.Plan.Restart, ModelDownload.plan(206, 100, "bytes 50-199/200"))
        assertEquals(ModelDownload.Plan.Write(append = false), ModelDownload.plan(200, 100, null))
        assertEquals(ModelDownload.Plan.Restart, ModelDownload.plan(416, 100, null))
        assertEquals(ModelDownload.Plan.Redirect, ModelDownload.plan(302, 0, null))
        assertEquals(ModelDownload.Plan.Fail, ModelDownload.plan(503, 0, null))
    }

    @Test
    fun hashesTheFileAsSha256() {
        partial.writeBytes(body)
        val expected = MessageDigest.getInstance("SHA-256").digest(body).joinToString("") { "%02x".format(it) }
        assertEquals(expected, ModelDownload.sha256(partial))
    }
}
