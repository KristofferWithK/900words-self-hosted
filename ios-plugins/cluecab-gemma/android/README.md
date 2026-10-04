# Offline Casey on Android

The Android half of the `Gemma` Capacitor plugin. It keeps the iPhone's contract
exactly (`dist/index.d.ts`: `status`, `download`, `cancelDownload`, `remove`,
`generate`, `cancelGeneration`, `unloadModel`, the `downloadProgress` event and
the `PUT_AWAY` rejection code), so `src/ai/gemma/` runs unchanged on both
phones. Owner decision 2026-10-04: a native plugin on Google's LiteRT-LM, not
WebGPU in the WebView.

## The runtime

- `com.google.ai.edge.litertlm:litertlm-android:0.16.0` from Google Maven
  (Apache-2.0, google-ai-edge/LiteRT-LM). That is the same v0.16.0 release the
  iPhone half vendors (`../vendor/LiteRTLM/SOURCE.md`), so both phones run the
  same engine. 0.17.1 (2026-09-16) is the newest; it adds Apple Metal
  residency, Gemma 4 12B and a tool-call fix, none of which offline Casey uses.
- The AAR ships `liblitertlm_jni.so` for `arm64-v8a` and `x86_64` only, with
  16 KB-aligned segments (Play's page-size rule). It adds about 21 MB to an
  arm64 install.
- Backends: GPU (OpenCL, through the manifest's `uses-native-library`), CPU
  (XNNPack) and NPU (vendor libraries, not used). The plugin loads the GPU
  first. It falls back to the CPU when the GPU refuses the model at load, or
  takes it and then fails its first generation (the emulator does both: no
  OpenCL), retrying that turn on the CPU and deleting the GPU's cache. The
  refusal is remembered per model and per Android build, so the next launch
  goes straight to the CPU. `status()` and every `generate()` report which one
  answered, and the app writes it into the device-gate log
  (`cluecab-gemma-device-gate-v1`).
- A cancel (`cancelGeneration`, or leaving the app) is honoured only once the
  engine has finished reading the prompt: 52 s for Casey's long prompt on the
  emulator's CPU, about 3 s on a phone GPU by Google's figures. Same engine on
  the iPhone.
- Kotlin 2.2.21, the version LiteRT-LM 0.16.0 is built with.

## The model

Not the iPhone's file. Both phones download Gemma 4 E4B from
`litert-community/gemma-4-E4B-it-litert-lm` at the same pinned revision
`2eee7ac3…`, but the iPhone's `gemma-4-E4B-it-gpu.litertlm` (2.97 GB) holds
GPU ("artisan") weights only. On the emulator (2026-10-04) its GPU executor
gave up without OpenCL, and the CPU fallback found nothing to load
(`TF_LITE_PREFILL_DECODE not found`). So a phone whose GPU refuses it could
not play at all. Android pins `gemma-4-E4B-it.litertlm` instead:
3,659,530,240 bytes, SHA-256 `0b2a8980…` (`GemmaModel.kt`, checked against
the Swift source's revision by `src/ai/gemma/native.test.ts`). It is the file
Google's own Gallery app downloads on Android, and it has CPU and GPU sections
(its vision and audio parts stay on disk unused).

The first load writes converted weights into the cache folder: 2.2 GB for the
CPU (`*.xnnpack_cache`) or the GPU (`*_mldrift_weight_cache.bin`), measured on
the emulator. The download therefore asks for the file, 2.4 GB of cache and
768 MB more to be free. Later loads read the cache (1.3 s on the emulator's
CPU).

It downloads into `noBackupFilesDir/CaseyModels`, which Auto Backup and
device-to-device transfer both leave out. The download:

- is bound to a Wi-Fi or Ethernet network, so a dropped Wi-Fi fails it rather
  than moving it onto mobile data, and waits for Wi-Fi if there is none yet;
- resumes with an HTTP Range from whatever is already on disk, after a dropped
  connection (retried five times, 2 s to 60 s apart) or a killed app (the next
  `download()` continues);
- is checked for its exact size and SHA-256 before it is moved into place;
- needs the rest of the file plus 768 MB free.

## Which phones

`GemmaCapability.kt` refuses, before the download, a phone below Android 12
(the GPU driver can be opened only from 12), one without a 64-bit ABI
LiteRT-LM ships, or one under the 8 GB memory class. The app warns below the
12 GB class (`belowOfflineCaseyMemory` in `src/ai/gemma/native.ts`) and names
example phones (`OFFLINE_CASEY_ANDROID_EXAMPLES`). Both bars are estimates
until the device gate runs on real phones.

## Memory and leaving the app

The engine is loaded on the first generation and closed when the app calls
`unloadModel()` (her round ended, the player went back to normal Casey) or
when the activity stops (another app, the Home screen, a locked phone).
A generation in flight is cancelled first and its call rejects with
`PUT_AWAY`, which `src/ai/gemma/decision.ts` asks again once the player is
back. A dialog or the notification shade does not stop the activity, so it
costs no reload.

## Tests

```
cd android
./gradlew :cluecab-gemma:testDebugUnitTest
```

`GemmaCapabilityTest` pins the refusal rules; `ModelDownloadTest` runs the
downloader against a local server that redirects like Hugging Face and
honours Range requests (resume, a dropped connection, a server that ignores
the Range, cancel, SHA-256).
