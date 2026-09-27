/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { webDemoAssets } from './scripts/web-demo-assets.mjs'

// Public GitHub Pages delivery is retired. The web build retains this legacy
// project path for local preview compatibility; it is not a public app URL.
// Stamped into the bundle so a screenshot of Settings says which build it is.
// Without it, "have you got the update?" is unanswerable, and an installed PWA
// can sit on a version for days.
const BUILD_STAMP =
  process.env.GITHUB_SHA?.slice(0, 7) ?? new Date().toISOString().slice(0, 16).replace('T', ' ')

// Legacy project path retained for preview/build compatibility after D3 renamed
// the private repository and SEC2 retired Pages. It appears in `base`,
// `start_url`, `scope` and `navigateFallback`; keep it as one constant and do
// not change it incidentally with a user-facing rename.
const PAGES_BASE_PATH = '/'

// CAP_BUILD=1 builds for the native shell instead of the legacy web preview:
// assets are served from the app bundle, so the base is relative rather than the
// project path, and the service worker stays out — updates ride TestFlight
// builds there, and a worker inside a WKWebView is a second update mechanism
// fighting the first.
const CAP = process.env.CAP_BUILD === '1'

// The TestFlight build number, stamped in by the workflow. Empty for the web,
// where the git sha above is the identity that matters — but on a phone the
// number TestFlight shows is the only one a player can compare against.
const TF_BUILD = process.env.TF_BUILD ?? ''

// One explicit audience prevents a TestFlight feedback build accidentally
// carrying Kristoffer's developer city-jump control. These are build-time
// policies, never a player setting, URL parameter, or fake entitlement.
const audience = process.env.BUILD_AUDIENCE ?? (process.env.VITEST ? 'normal' : 'open-source')
if (audience !== 'normal' && audience !== 'feedback' && audience !== 'developer' && audience !== 'open-source' && audience !== 'web-demo') {
  throw new Error(`BUILD_AUDIENCE must be normal, feedback, developer, open-source, or web-demo; received ${JSON.stringify(audience)}`)
}
// The website's playable intro (900words.app/play/). It talks only to the
// website's own Casey, never the app's, and carries a public Turnstile key.
// No service worker, no source maps, and only the audio its two boards use.
const WEB_DEMO = audience === 'web-demo'
const webCaseyUrl = process.env.WEB_CASEY_URL ?? ''
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY ?? ''
const appStoreUrl = process.env.APP_STORE_URL ?? ''
if (WEB_DEMO) {
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1\/?$/.test(webCaseyUrl)
  if ((!/^https:\/\/[^/]+\/v1\/?$/.test(webCaseyUrl) && !local) || webCaseyUrl.includes('cluecabulary-proxy')) {
    throw new Error('A web-demo build requires WEB_CASEY_URL=https://casey.900words.app/v1 (or a local http://127.0.0.1:<port>/v1 for the drive), never the app Worker')
  }
  if (!/^[0-9A-Za-z_-]{10,64}$/.test(turnstileSiteKey)) {
    throw new Error('A web-demo build requires TURNSTILE_SITE_KEY (the public Turnstile site key)')
  }
  if (appStoreUrl && !appStoreUrl.startsWith('https://apps.apple.com/')) {
    throw new Error('APP_STORE_URL must be an https://apps.apple.com/ link (or unset until the listing exists)')
  }
}
// On-device Casey (src/ai/gemma/) exists in the developer, normal and
// open-source native builds (owner, 2026-09-27: Gemma on the 1.0 line too, and
// for self-builders). Feedback and web bundles fold it away with its chunk.
const OPEN_SOURCE = audience === 'open-source'
const ON_DEVICE_CASEY = CAP && (audience === 'developer' || audience === 'normal' || OPEN_SOURCE)
// Casey's own logic in the app (proxy/casey/orchestrator.js with City 1's
// shards): wherever on-device Casey is, and in every open-source build, where
// a player's own AI key is played through it with no Worker at all.
const IN_APP_CASEY = ON_DEVICE_CASEY || OPEN_SOURCE
// Optional for the open-source build: a self-hoster's own Casey Worker. Without
// one, the player brings an AI key or uses Gemma on the iPhone (Settings).
const selfHostedCaseyUrl = process.env.SELF_HOSTED_CASEY_URL ?? ''
const ownWorker =
  /^https:\/\/[^/]+\/v1\/?$/.test(selfHostedCaseyUrl) ||
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1\/?$/.test(selfHostedCaseyUrl)
if (
  OPEN_SOURCE &&
  selfHostedCaseyUrl &&
  (!ownWorker || selfHostedCaseyUrl.includes('cluecabulary-proxy.kristoffer-kai.workers.dev'))
) {
  throw new Error("SELF_HOSTED_CASEY_URL must be your own Casey Worker, https://…/v1 (or http://localhost:<port>/v1), never the app's")
}

// Ollama Cloud, the App Store's model service, refuses a browser's
// cross-origin preflight (405, measured 2026-09-27), so a self-build playing
// in a browser with an Ollama key cannot reach it directly; the iPhone app is
// unaffected (native HTTP). The open-source build's own dev and preview
// servers pass /ollama-cloud/* to https://ollama.com and nowhere else, without
// the page's Origin or Referer, and src/ai/ownKey/store.ts sends ollama.com
// requests there when the page is on this machine.
const ollamaCloudPassThrough = {
  '/ollama-cloud': {
    target: 'https://ollama.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ollama-cloud/, ''),
    configure: (proxy: { on: (event: 'proxyReq', listener: (request: { removeHeader: (name: string) => void }) => void) => void }) => {
      proxy.on('proxyReq', (request) => {
        request.removeHeader('origin')
        request.removeHeader('referer')
      })
    },
  },
}

export default defineConfig({
  base: CAP ? './' : WEB_DEMO ? '/play/' : PAGES_BASE_PATH,
  // On-device Casey (src/ai/gemma/decision.ts) runs the Worker's own
  // orchestrator in the native app, with City 1's shards only: the one city a
  // player can reach, and the only corpus scripts/validate-client-boundary.mjs
  // lets those native builds carry. Every other build folds that chunk away.
  ...(IN_APP_CASEY
    ? {
        resolve: {
          alias: [
            {
              find: /^\.\/evaluator-shards\.js$/,
              replacement: fileURLToPath(new URL('./proxy/casey/evaluator-shards.city1.js', import.meta.url)),
            },
          ],
        },
      }
    : {}),
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
    __TF_BUILD__: JSON.stringify(TF_BUILD),
    __BUILD_AUDIENCE__: JSON.stringify(audience),
    __SELF_HOSTED_CASEY_URL__: JSON.stringify(audience === 'open-source' ? selfHostedCaseyUrl.replace(/\/+$/, '') : ''),
    __CAP_BUILD__: JSON.stringify(CAP),
    __ON_DEVICE_CASEY__: JSON.stringify(ON_DEVICE_CASEY),
    __IN_APP_CASEY__: JSON.stringify(IN_APP_CASEY),
    __WEB_CASEY_URL__: JSON.stringify(WEB_DEMO ? webCaseyUrl.replace(/\/+$/, '') : ''),
    __TURNSTILE_SITE_KEY__: JSON.stringify(WEB_DEMO ? turnstileSiteKey : ''),
    __APP_STORE_URL__: JSON.stringify(WEB_DEMO ? appStoreUrl : ''),
  },
  // The web demo is published beside the marketing pages, so it gets its own
  // output folder (the drives keep serving dist/), no source maps, and only an
  // allowlisted slice of public/: see scripts/web-demo-assets.mjs.
  ...(WEB_DEMO ? { build: { outDir: 'dist-web-demo', sourcemap: false, copyPublicDir: false } } : {}),
  plugins: [
    react(),
    ...(WEB_DEMO ? [webDemoAssets()] : []),
    VitePWA({
      disable: CAP || WEB_DEMO,
      // 'prompt', not 'autoUpdate': autoUpdate can swap the app out from under
      // a round in progress, and it gave the player no way to know a new
      // version existed. UpdateBanner asks instead.
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'],
      manifest: {
        // Display name only. `start_url`/`scope` below stay on
        // PAGES_BASE_PATH, defined above — moving one without the other
        // breaks the deploy.
        name: '900words',
        short_name: '900words',
        description:
          'Learn Danish vocabulary through a cooperative word-association game with an AI companion.',
        start_url: PAGES_BASE_PATH,
        scope: PAGES_BASE_PATH,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            // Its own artwork: a maskable icon may be cropped to a circle, and
            // the plain one's grid runs too close to the edge to survive it.
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell and word data are precached; AI calls are network-only.
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
        // Workbox refuses a precache entry over 2 MiB by default, and
        // vite-plugin-pwa turns that refusal into a build ERROR rather than a
        // warning. The main bundle crossed it on 2026-09-11 at 2.22 MB, when
        // the City 1 sentence manifest filled in: 704 recordings, 520 KB
        // minified, of which the runtime reads about 164 KB (identity, url,
        // variant, rate) and the rest is provenance the importer and
        // validate:audio need — voice, encoding, four hashes, duration, lead
        // and tail per row. Refusing to precache the shell is not an option:
        // it is what makes the installed app work offline at all. 3 MiB
        // restores the build with headroom and keeps the pressure on. If this
        // is reached again, the fix is to split the provenance out of the
        // file the app imports, not to raise this further.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Baked word, ride and task clips must NOT be precached. A player may
        // only hear a few, so installation must not download every dictionary,
        // story, exchange and readiness-checkpoint performance. They are
        // runtime-cached on their first requested playback instead, below.
        // Only manifest.json would be caught by the patterns above (mp3 is not
        // in them), but the ignore is stated so that adding mp3 to the list
        // later cannot quietly undo the decision.
        globIgnores: ['**/audio/**'],
        runtimeCaching: [
          {
            // CacheFirst, not StaleWhileRevalidate: a frozen utterance is the
            // same bytes for ever, so a background revalidation would be a
            // request per clip per session buying nothing. A re-bake with a
            // different voice keeps the same filenames, so it needs the
            // cacheName below bumped to v2 in the same commit — that is the
            // only way an already-installed phone hears the new voice before
            // the year is out.
            // Task clips add `?v=<source hash>` so a newly baked frozen line
            // cannot resolve to an installed device's older cache entry.
            urlPattern: /\/audio\/.*\.mp3(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              // v2: the word clips were re-baked at 1.0 when the 0.6 set moved
              // to audio/<lang>/slow, and the new ordinary clips have the same
              // filenames as the slow ones they replaced. Without the bump an
              // installed phone would keep the old slow audio for the year.
              // v3: S2 refreshed the already-baked Danish clips while adding
              // the example-sentence family. Existing filenames therefore
              // need a new cache name or installed phones keep v2 for a year.
              // v4: 2026-09-06, the silence was cut off every clip in place
              // (scripts/trim-audio-silence.mjs) — same filenames, new bytes.
              // v5: 2026-09-24, thirteen scoped non-City-1 clips were trimmed
              // with verified whole-frame cuts; same filenames, new bytes.
              // v6: 2026-09-26, sixteen scoped Danish clips were replaced;
              // installed devices need a fresh cache for the same paths.
              // v7: 2026-09-26, four silent «Tak.» Survival lines (one in
              // City 1) now carry the audible stamp-identical recording; same
              // filenames, new bytes, and a v6 device may hold the silence.
              cacheName: 'word-audio-v7',
              expiration: {
                // 1,893 word/story clips + S4's 142 accepted activity lines +
                // nine chapter performances + S2's 900 Danish examples + 144
                // Survival dialogue turns = 3,088 known requests, plus the
                // City 1 sentence bake's 704 (352 identities, normal and
                // slow) = 3,792.
                // 4,200 means the new source does not immediately evict an
                // earlier clip. New filenames need no
                // cache-name bump; replacing a baked file still does.
                maxEntries: 4200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                // Audio is the most disposable thing the app stores: losing it
                // costs the device voice, losing the shell costs the app. If
                // the browser runs the origin out of quota, this goes first.
                purgeOnQuotaError: true,
              },
              // 200 only. A 206 Partial Content cannot be put in the Cache API
              // at all, which is why speak.ts fetches the bytes itself and
              // hands them to the audio element as a blob rather than letting
              // the element request byte ranges of its own.
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  /**
                   * A 200 is not enough: a single-page host answers an unknown
                   * path with index.html rather than a 404, so a word with no
                   * baked clip comes back 200 text/html — which is the state
                   * every word in this repo is in until the bake is run. Without
                   * this, CacheFirst files the app's own HTML under the clip's
                   * URL and keeps it there for a year.
                   *
                   * offline-drive measured exactly that and failed on it twice:
                   * once before the client-side check existed, and again after,
                   * because the client's clean-up raced workbox's write and lost.
                   * Refusing the write is the half that actually holds.
                   *
                   * The function is stringified into the generated worker, so it
                   * may not close over anything in this file.
                   */
                  cacheWillUpdate: async ({ response }: { response: Response }) => {
                    const type = response.headers.get('content-type') ?? ''
                    return type.toLowerCase().startsWith('audio/') ? response : null
                  },
                },
              ],
            },
          },
        ],
        navigateFallback: `${PAGES_BASE_PATH}index.html`,
        // Prompt mode turns both of these off. skipWaiting must stay off — that
        // is what lets the player choose the moment. clientsClaim has to come
        // back on: without it the very first visit is uncontrolled, so a player
        // who installs the app and goes offline has nothing cached yet. It only
        // affects a worker that is already activating, so it cannot jump the
        // queue past the prompt.
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  ...(OPEN_SOURCE ? { server: { proxy: ollamaCloudPassThrough } } : {}),
  preview: {
    ...(OPEN_SOURCE ? { proxy: ollamaCloudPassThrough } : {}),
    // e2e/story-drive.mjs maps this name to the local server so one context can
    // load the app as a non-local origin, where devSwitchesAllowed() is false.
    // Without it the first-run intro's dependence on that guard was invisible:
    // every drive ran on 127.0.0.1, which the app treats as local. `preview` is
    // a dev-server option and no part of the built output.
    allowedHosts: ['deployed.test'],
  },
  test: {
    environment: 'node',
    // proxy/ is plain JS, outside the app's tsconfig on purpose: it is pasted
    // into a Cloudflare dashboard, not bundled.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs', 'proxy/**/*.test.mjs'],
    // Agents' throwaway probes live here and are gitignored; they must not
    // join the suite that gates a commit.
    // The three City 1 Aoede audition suites (#223) are node:test files, run by
    // `node --test` in .github/workflows/city1-aoede-audition.yml; vitest
    // collects them by the include above and reports "No test suite found",
    // which turned `npm test` red on main on 2026-09-11. Keep them out here.
    exclude: ['**/__probe__/**', '**/__fuzz__/**', '**/__scratch__/**', '**/probe_tmp/**', '**/node_modules/**', 'scripts/city1-aoede-*.test.mjs'],
  },
})
