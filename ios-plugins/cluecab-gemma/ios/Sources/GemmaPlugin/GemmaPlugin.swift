import Capacitor
import CryptoKit
import Foundation
import LiteRTLM

private let modelName = "gemma-4-E4B-it-gpu.litertlm"
private let modelBytes: Int64 = 2_969_059_328
private let modelSHA256 = "4912bb5a9c30993c51a7711f763212077458529312175df0573a78323a2bb7ff"
private let modelURL = URL(
    string: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/2eee7ac325f20eb8c9ac1d0e972f7c84663062da/gemma-4-E4B-it-gpu.litertlm?download=true"
)!

private actor GemmaRuntime {
    private var engine: Engine?
    /// The conversation generating right now, so a caller that has given up
    /// on it can stop it. The actor runs one generation at a time: without a
    /// cancel, one that never finishes blocks every Casey turn after it.
    private var current: Conversation?

    func unload() {
        engine = nil
    }

    func cancel() {
        try? current?.cancel()
    }

    func generate(
        modelPath: String,
        cachePath: String,
        system: String,
        prompt: String,
        temperature: Float,
        maxOutputTokens: Int
    ) async throws -> [String: Any] {
        let started = Date()
        var loadMs = 0

        if engine == nil {
            let loadStarted = Date()
            let config = try EngineConfig(
                modelPath: modelPath,
                backend: .gpu,
                // Prompt AND reply. Casey's clue prompt alone measured about
                // 4,400 tokens (13,199 characters, 2026-09-27), so 4,096 could
                // not hold it. Mirrored as CONTEXT_TOKENS in src/ai/gemma/decision.ts.
                maxNumTokens: 8192,
                cacheDir: cachePath
            )
            let made = Engine(engineConfig: config)
            try await made.initialize()
            engine = made
            loadMs = milliseconds(from: loadStarted)
        }

        guard let engine else { throw NSError(domain: "Gemma", code: 1) }
        let sampler = try SamplerConfig(
            topK: 40,
            topP: 0.95,
            temperature: temperature,
            seed: 0
        )
        let conversationConfig = ConversationConfig(
            systemMessage: Message(system, role: .system),
            samplerConfig: sampler,
            thinkingConfig: ThinkingConfig(enableThinking: false)
        )
        let conversation = try await engine.createConversation(with: conversationConfig)
        current = conversation
        defer { current = nil }
        let generationStarted = Date()
        var firstTokenMs = 0
        var text = ""
        for try await chunk in conversation.sendMessageStream(
            Message(prompt),
            maxOutputTokens: maxOutputTokens,
            thinkingConfig: ThinkingConfig(enableThinking: false)
        ) {
            if firstTokenMs == 0 { firstTokenMs = milliseconds(from: generationStarted) }
            text += chunk.toString
        }

        return [
            "text": text,
            "loadMs": loadMs,
            "firstTokenMs": firstTokenMs,
            "generationMs": milliseconds(from: generationStarted),
            "totalMs": milliseconds(from: started),
        ]
    }

    private func milliseconds(from instant: Date) -> Int {
        Int(Date().timeIntervalSince(instant) * 1_000)
    }
}

@objc(GemmaPlugin)
public final class GemmaPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDownloadDelegate {
    public let identifier = "GemmaPlugin"
    public let jsName = "Gemma"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelDownload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelGeneration", returnType: CAPPluginReturnPromise),
    ]

    private let runtime = GemmaRuntime()
    private var downloadTask: URLSessionDownloadTask?
    private var finishingDownload = false
    private var lastError: String?
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.allowsCellularAccess = false
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 24 * 60 * 60
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(statusPayload())
    }

    @objc func download(_ call: CAPPluginCall) {
        if isInstalled() {
            call.resolve(["started": false])
            return
        }
        if downloadTask != nil || finishingDownload {
            call.resolve(["started": false])
            return
        }
        guard freeBytes() > modelBytes + 768 * 1024 * 1024 else {
            call.reject("This iPhone needs at least 3.7 GB free before downloading Gemma.")
            return
        }
        do {
            try FileManager.default.createDirectory(
                at: modelDirectory,
                withIntermediateDirectories: true
            )
        } catch {
            call.reject("900words could not prepare storage for Gemma.", nil, error)
            return
        }
        lastError = nil
        let task = session.downloadTask(with: modelURL)
        downloadTask = task
        task.resume()
        notifyStatus()
        call.resolve(["started": true])
    }

    @objc func cancelDownload(_ call: CAPPluginCall) {
        downloadTask?.cancel()
        downloadTask = nil
        finishingDownload = false
        notifyStatus()
        call.resolve()
    }

    @objc func remove(_ call: CAPPluginCall) {
        downloadTask?.cancel()
        downloadTask = nil
        finishingDownload = false
        Task { await runtime.unload() }
        do {
            try? FileManager.default.removeItem(at: modelPath)
            try? FileManager.default.removeItem(at: markerPath)
            try? FileManager.default.removeItem(at: partialPath)
            notifyStatus()
            call.resolve()
        }
    }

    /// Stops the generation in progress, if any; its own call then rejects.
    @objc func cancelGeneration(_ call: CAPPluginCall) {
        Task {
            await runtime.cancel()
            call.resolve()
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard isInstalled() else {
            call.reject("Gemma is not downloaded on this iPhone yet.")
            return
        }
        guard
            let system = call.getString("system"),
            let prompt = call.getString("prompt"),
            let temperature = call.getFloat("temperature"),
            let maxOutputTokens = call.getInt("maxOutputTokens")
        else {
            call.reject("Gemma received an incomplete generation request.")
            return
        }
        Task {
            do {
                try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
                let result = try await runtime.generate(
                    modelPath: modelPath.path,
                    cachePath: cacheDirectory.path,
                    system: system,
                    prompt: prompt,
                    temperature: temperature,
                    maxOutputTokens: maxOutputTokens
                )
                call.resolve(result)
            } catch {
                call.reject("Gemma could not finish this Casey turn.", nil, error)
            }
        }
    }

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        notifyStatus(progress: Double(totalBytesWritten) / Double(max(1, totalBytesExpectedToWrite)))
    }

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        finishingDownload = true
        self.downloadTask = nil
        do {
            try? FileManager.default.removeItem(at: partialPath)
            try FileManager.default.moveItem(at: location, to: partialPath)
        } catch {
            finishDownload(error: "The Gemma download could not be saved.")
            return
        }

        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self else { return }
            do {
                let attributes = try FileManager.default.attributesOfItem(atPath: self.partialPath.path)
                let size = (attributes[.size] as? NSNumber)?.int64Value ?? 0
                guard size == modelBytes else { throw NSError(domain: "Gemma", code: 2) }
                guard try self.sha256(of: self.partialPath) == modelSHA256 else {
                    throw NSError(domain: "Gemma", code: 3)
                }
                try? FileManager.default.removeItem(at: self.modelPath)
                try FileManager.default.moveItem(at: self.partialPath, to: self.modelPath)
                try modelSHA256.write(to: self.markerPath, atomically: true, encoding: .utf8)
                var values = URLResourceValues()
                values.isExcludedFromBackup = true
                var model = self.modelPath
                try? model.setResourceValues(values)
                self.finishDownload(error: nil)
            } catch {
                try? FileManager.default.removeItem(at: self.partialPath)
                self.finishDownload(error: "The downloaded Gemma file did not pass its integrity check.")
            }
        }
    }

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        guard let error else { return }
        downloadTask = nil
        finishingDownload = false
        lastError = (error as NSError).code == NSURLErrorCancelled
            ? nil
            : "The Gemma download stopped. Keep 900words open on Wi-Fi and try again."
        notifyStatus()
    }

    private var modelDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CaseyModels", isDirectory: true)
    }

    private var cacheDirectory: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Gemma4E4B", isDirectory: true)
    }

    private var modelPath: URL { modelDirectory.appendingPathComponent(modelName) }
    private var partialPath: URL { modelDirectory.appendingPathComponent("\(modelName).partial") }
    private var markerPath: URL { modelDirectory.appendingPathComponent("\(modelName).sha256") }

    private func isInstalled() -> Bool {
        guard
            FileManager.default.fileExists(atPath: modelPath.path),
            let marker = try? String(contentsOf: markerPath, encoding: .utf8),
            marker == modelSHA256,
            let attributes = try? FileManager.default.attributesOfItem(atPath: modelPath.path),
            (attributes[.size] as? NSNumber)?.int64Value == modelBytes
        else { return false }
        return true
    }

    private func freeBytes() -> Int64 {
        let attributes = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())
        return (attributes?[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
    }

    private func statusPayload(progress: Double? = nil) -> [String: Any] {
        var payload: [String: Any] = [
            "supported": true,
            "installed": isInstalled(),
            "downloading": downloadTask != nil || finishingDownload,
            "progress": progress ?? downloadTask?.progress.fractionCompleted ?? (finishingDownload ? 1 : 0),
            "expectedBytes": modelBytes,
            "freeBytes": freeBytes(),
            // The app warns below 8 GB (the iPhones listed in Settings); the
            // number itself goes into the device-gate log.
            "physicalMemory": Double(ProcessInfo.processInfo.physicalMemory),
        ]
        if let lastError { payload["error"] = lastError }
        return payload
    }

    private func notifyStatus(progress: Double? = nil) {
        notifyListeners("downloadProgress", data: statusPayload(progress: progress))
    }

    private func finishDownload(error: String?) {
        DispatchQueue.main.async {
            self.finishingDownload = false
            self.lastError = error
            self.notifyStatus()
        }
    }

    private func sha256(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while let data = try handle.read(upToCount: 4 * 1024 * 1024), !data.isEmpty {
            hasher.update(data: data)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
