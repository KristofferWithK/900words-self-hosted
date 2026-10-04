# Third-party notices

900words is built on other people's work. This file lists what is in this
repository, or goes into a build of it, that 900words did not write. Each
item keeps its own licence.

## In the repository

**LiteRT-LM Swift wrapper** (Google), `ios-plugins/cluecab-gemma/vendor/LiteRTLM/`.
Apache License 2.0; the licence is in that folder, and `SOURCE.md` names the
exact upstream release. It runs Gemma on the iPhone.

**LiteRT-LM Android plugin** (Google), `ios-plugins/cluecab-gemma/android/`,
using `com.google.ai.edge.litertlm:litertlm-android` 0.16.0 from Google Maven.
Apache License 2.0. It runs Gemma on Android phones.

**@capacitor/keyboard 8.0.5** (Ionic), forked as `ios-plugins/cluecab-keyboard/`.
MIT License; the licence is in that folder. The fork adds the keyboard
animation's timing to one event.

**Map of Denmark** (`src/lang/da/map.ts`). Contains data from Geodatastyrelsen
and Danske Kommuner: DAGI (Danmarks Administrative Geografiske Inddeling),
FOT, 1:500 000, via [Neogeografen/dagi](https://github.com/Neogeografen/dagi).
Reprojected and simplified by `scripts/make-map.mjs`.

**Map of Germany** (`src/lang/de/map.ts`). © GeoBasis-DE / BKG, VG2500, under
the Datenlizenz Deutschland Namensnennung 2.0
([dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0)), via
[isellsoap/deutschlandGeoJSON](https://github.com/isellsoap/deutschlandGeoJSON).
Reprojected and simplified by `scripts/make-map.mjs`.

**Recordings** (`public/audio/`). Synthesised with Google Cloud Text-to-Speech
(Chirp 3 HD voices) by `scripts/make-audio.mjs`. They are part of the
curriculum; see [CURRICULUM-LICENSE.md](CURRICULUM-LICENSE.md).

## Fetched when you build or play

**Capacitor** (Ionic): `@capacitor/core`, `@capacitor/ios`, `@capacitor/haptics`
and the Swift package `capacitor-swift-pm`. MIT License.

**LiteRT-LM binary** (Google): `CLiteRTLM.xcframework` v0.16.0, downloaded by
Xcode from Google's GitHub release, pinned by checksum in
`ios-plugins/cluecab-gemma/Package.swift`. Apache License 2.0.

**LiteRT-LM for the web** (Google): `@litert-lm/core` and its WebAssembly,
which a desktop self-build serves itself to run Gemma in the browser.
Apache License 2.0.

**Gemma 4 E4B** (Google), as `gemma-4-E4B-it-gpu.litertlm` (iPhone),
`gemma-4-E4B-it.litertlm` (Android) and `gemma-4-E4B-it-web.litertlm`
(browser) from
[litert-community on Hugging Face](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm).
Apache License 2.0. Not in this repository: the app downloads it only when
you ask for it.

**npm packages bundled into the app**, all MIT unless noted: React, React DOM
and scheduler; Zod; Zustand; tslib (0BSD); Workbox, in the service worker.
`npm ci` installs them with their licences under `node_modules/`, along with
the build tools, which are not part of the app.

## AI services

When you choose your own AI key, the app sends Casey's requests to the
service you set, under that service's terms. 900words has no agreement
with it on your behalf.
