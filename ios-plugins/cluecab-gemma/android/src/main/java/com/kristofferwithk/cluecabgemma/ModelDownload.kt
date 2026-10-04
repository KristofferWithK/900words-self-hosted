package com.kristofferwithk.cluecabgemma

import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** The download was cancelled by the player (or by remove()); the partial file is gone. */
internal class DownloadCancelled : IOException("cancelled")

/**
 * One resumable fetch of the model into `partial`. Whatever is already in `partial` is kept
 * and the rest asked for with an HTTP Range, so a dropped connection or a killed app costs
 * only the bytes after it. Redirects are followed by hand: Hugging Face answers with a signed
 * CDN address, and the Range must travel to it.
 *
 * `open` makes the connection, which is how the plugin binds it to the Wi-Fi network.
 */
internal class ModelDownload(
    private val url: String,
    private val expectedBytes: Long,
    private val partial: File,
    private val open: (URL) -> HttpURLConnection,
    private val cancelled: () -> Boolean,
    private val onBytes: (Long) -> Unit,
) {
    fun run() {
        var target = URL(url)
        var redirects = 0
        var restarts = 0
        while (true) {
            if (cancelled()) throw DownloadCancelled()
            var have = if (partial.exists()) partial.length() else 0L
            if (have > expectedBytes) {
                partial.delete()
                have = 0L
            }
            if (have == expectedBytes) return

            val connection = open(target)
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 30_000
                connection.readTimeout = 60_000
                connection.setRequestProperty("Accept-Encoding", "identity")
                if (have > 0) connection.setRequestProperty("Range", "bytes=$have-")
                val code = connection.responseCode
                when (val plan = plan(code, have, connection.getHeaderField("Content-Range"))) {
                    is Plan.Redirect -> {
                        val location = connection.getHeaderField("Location")
                            ?: throw IOException("redirect without a Location")
                        if (++redirects > MAX_REDIRECTS) throw IOException("too many redirects")
                        target = URL(target, location)
                        continue
                    }
                    is Plan.Restart -> {
                        // The partial file no longer matches what the server has: start over.
                        if (++restarts > MAX_RESTARTS) throw IOException("the server would not resume")
                        partial.delete()
                        continue
                    }
                    is Plan.Write -> {
                        copy(connection, append = plan.append, from = if (plan.append) have else 0L)
                        return
                    }
                    is Plan.Fail -> throw IOException("HTTP $code")
                }
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun copy(connection: HttpURLConnection, append: Boolean, from: Long) {
        var written = from
        connection.inputStream.use { input ->
            FileOutputStream(partial, append).use { output ->
                val buffer = ByteArray(BUFFER_BYTES)
                while (true) {
                    if (cancelled()) throw DownloadCancelled()
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (written + read > expectedBytes) throw IOException("the server sent more than the model")
                    output.write(buffer, 0, read)
                    written += read
                    onBytes(written)
                }
                output.fd.sync()
            }
        }
        if (written != expectedBytes) throw IOException("the download ended early at $written bytes")
    }

    sealed class Plan {
        object Redirect : Plan()
        object Restart : Plan()
        object Fail : Plan()
        data class Write(val append: Boolean) : Plan()
    }

    companion object {
        private const val MAX_REDIRECTS = 5
        private const val MAX_RESTARTS = 2
        private const val BUFFER_BYTES = 1024 * 1024

        /**
         * What to do with a response to a request for everything after the first `have` bytes.
         * A 206 must start exactly where the file ends; a 200 is the whole file again (the
         * server ignored the Range); a 416 means the file is no longer one we can continue.
         */
        fun plan(code: Int, have: Long, contentRange: String?): Plan = when {
            code in 300..399 -> Plan.Redirect
            code == HttpURLConnection.HTTP_PARTIAL ->
                if (have > 0 && rangeStart(contentRange) == have) Plan.Write(append = true) else Plan.Restart
            code == HttpURLConnection.HTTP_OK -> Plan.Write(append = false)
            code == 416 -> Plan.Restart
            else -> Plan.Fail
        }

        /** The first byte of a `Content-Range: bytes 100-199/2969059328` header. */
        fun rangeStart(contentRange: String?): Long? =
            contentRange?.let { Regex("""^\s*bytes\s+(\d+)-\d+/(\d+|\*)\s*$""").find(it) }
                ?.groupValues?.get(1)?.toLongOrNull()

        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buffer = ByteArray(4 * 1024 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}
