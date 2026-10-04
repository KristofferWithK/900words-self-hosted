// Verifies the installed-PWA promise: after one online visit, the app must
// load with the network gone (service worker serves the precached shell,
// including the course dictionary and L1's lazy clue lexicon — only true AI
// misses need connectivity).
//
// Since F1 it also covers the baked word audio, which is the one asset class
// deliberately NOT precached: 900 clips at ~9MB would make the install
// download the whole dictionary's audio before the app would open offline. It
// is runtime-cached instead, and "runtime-cached" is a claim about a workbox
// config that nothing else in the repo would notice going wrong — a clip
// that fails only shows a short "did not load" note, so a broken cache and a
// working one sound identical from the outside.
//
// The clips this drive uses are hand-built silent MP3s written into dist/, and
// they stay that way now that the real ones are committed: what is under test
// is the fetch, the cache and the failure note, not the voice, and a fixed 300-byte
// file keeps the assertions about cached bytes independent of whatever
// `make-audio.mjs` last baked. (The note that used to stand here said
// public/audio/ was gitignored and unbakeable without a key. Both stopped being
// true when the clips were committed and the TTS key became an Actions secret.)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { audioSlug } from '../scripts/audio-slug.mjs'
import { silentMp3 } from '../scripts/silent-mp3.mjs'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_ROOT = resolve(ROOT, 'dist', 'audio')
const AUDIO_DIR = resolve(AUDIO_ROOT, 'da')
const TASK_AUDIO_DIR = resolve(AUDIO_DIR, 'task')
const EXAMPLE_AUDIO_DIR = resolve(AUDIO_DIR, 'example')
const taskSource = JSON.parse(readFileSync(resolve(ROOT, 'src/data/curriculum-audio.da.json'), 'utf8'))
const exampleSource = JSON.parse(readFileSync(resolve(ROOT, 'src/data/example-audio.da.json'), 'utf8'))

/**
 * Start from no audio at all, whatever the machine happens to have.
 *
 * `vite build` copies public/ into dist/, so a developer who has run
 * `make-audio.mjs` arrives here with all 900 clips already in place and the
 * "no baked file" half of this drive silently tests nothing — it looked like a
 * caching bug for three runs before it turned out to be exactly that. dist/ is
 * a build artefact and `npm run drives` rebuilds before every run, so clearing
 * it costs a developer nothing but determinism gained.
 */
rmSync(AUDIO_ROOT, { recursive: true, force: true })

/** Put one clip where the built app will look for it. */
function bake(danish) {
  mkdirSync(AUDIO_DIR, { recursive: true })
  writeFileSync(resolve(AUDIO_DIR, `${audioSlug(danish)}.mp3`), silentMp3(300))
  return `audio/da/${audioSlug(danish)}.mp3`
}

/** One silent fixture per frozen utterance: the cache route, not a real voice, is under test. */
function bakeTask({ id, sourceHash }) {
  mkdirSync(TASK_AUDIO_DIR, { recursive: true })
  writeFileSync(resolve(TASK_AUDIO_DIR, `${id}.mp3`), silentMp3(300))
  return `audio/da/task/${id}.mp3?v=${sourceHash.slice(0, 16)}`
}

/** A single source-hashed S2 fixture, played through the real sheet button. */
function bakeExample({ id, sourceHash }) {
  const slug = audioSlug(id.replace(/^da:/, ''))
  mkdirSync(EXAMPLE_AUDIO_DIR, { recursive: true })
  writeFileSync(resolve(EXAMPLE_AUDIO_DIR, `${slug}.mp3`), silentMp3(300))
  return `audio/da/example/${slug}.mp3?v=${sourceHash.slice(0, 16)}`
}

// Sample every authored activity class, all five capsule phases and both
// checkpoints. These are silent byte fixtures: they prove the cache route,
// never a Danish performance or listening judgement.
const taskFixtures = [
  ...['notice', 'discriminate', 'manipulate', 'listen', 'transfer'].map((phase) =>
    taskSource.entries.find((line) => line.kind === 'capsule' && line.phase === phase)),
  taskSource.entries.find((line) => line.kind === 'exchange'),
  taskSource.entries.find((line) => line.kind === 'due-review'),
  taskSource.entries.find((line) => line.kind === 'exit-step'),
  taskSource.entries.find((line) => line.checkpointId === 'skagen-a1-readiness'),
  taskSource.entries.find((line) => line.checkpointId === 'kobenhavn-a2-readiness'),
]
if (taskFixtures.some((line) => !line) || taskFixtures.length !== 10) {
  throw new Error(`task fixture source is incomplete: expected every class/phase plus two checkpoints, got ${taskFixtures.length}`)
}

const PORT = 4175
const preview = await startPreview(PORT)
import { setTimeout as sleep } from 'node:timers/promises'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

// playWord is called from onClick handlers that cannot await it, so a rejection
// would surface as an unhandled promise and nowhere else. Recording them is how
// "resolves without throwing" gets asserted — audible sound cannot be.
await page.addInitScript(() => {
  window.__rejections = []
  window.addEventListener('unhandledrejection', (e) => {
    window.__rejections.push(String(e.reason))
  })
})

const audioRequests = []
page.on('response', (r) => {
  if (r.url().includes('/audio/')) audioRequests.push({ url: r.url(), status: r.status() })
})

/** What the browser has actually stored under /audio/, cache by cache. */
const cachedAudio = () =>
  page.evaluate(async () => {
    const out = {}
    for (const name of await caches.keys()) {
      const c = await caches.open(name)
      out[name] = []
      for (const req of await c.keys()) {
        if (!req.url.includes('/audio/')) continue
        const res = await c.match(req)
        out[name].push(`${req.url.split('/audio/')[1]} ${res?.status} ${res?.headers.get('content-type')}`)
      }
    }
    return out
  })
const countAudio = (dump) => Object.values(dump).reduce((n, list) => n + list.length, 0)

const openSuitcase = async () => {
  await page.click('.cluey-button')
  await page.waitForSelector('.suitcase-screen')
}
const tapTile = async (nth) => {
  await page.locator('.case-tile.case-collected').nth(nth).click()
  await page.waitForSelector('.sheet')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sheet', { state: 'detached' })
}

const fail = (msg) => {
  throw new Error(msg)
}

try {
  // The generated worker itself, before a browser is involved. The runtime
  // route is what everything below depends on, and reading it here says
  // "misconfigured" rather than "nothing got cached, cause unknown".
  //
  // The precache half of this can only bite on a machine that has actually run
  // the bake: with no clips in public/ there are no .mp3 files in dist/ for the
  // precache manifest to have picked up, so it is a guard for later rather than
  // a measurement now. Say so rather than let it read as proof.
  const sw = readFileSync(resolve(ROOT, 'dist', 'sw.js'), 'utf8')
  const at = sw.indexOf('word-audio-v7')
  if (at < 0) fail('the worker has no runtime cache for /audio/')
  // The route must refuse a response that is not audio. Asserted on the route's
  // own text because the browser cannot show it: speak.ts ALSO deletes a
  // mis-cached entry, and that clean-up hides a missing guard here from every
  // black-box check — it was written because the guard lost this exact race
  // once, so "the cache came out clean" is not evidence the guard exists.
  // Looked for in the route's own options rather than the whole file: the
  // route's URL pattern mentions /audio/ too, and it sits BEFORE the cache name
  // in the generated source, so slicing forward from the name skips it and the
  // only `audio/` left to find is the type the guard insists on. A minifier
  // rewrites names, not string literals.
  if (!sw.slice(at, at + 600).includes('audio/')) {
    fail('the /audio/ route caches whatever it is given, without checking the type')
  }
  const precacheManifest = sw.slice(0, sw.indexOf('cleanupOutdatedCaches'))
  if (precacheManifest.includes('.mp3')) fail('an mp3 reached the precache manifest')
  console.log('worker: /audio/ runtime-cached, type-checked, absent from the precache manifest')

  // First visit online: let the service worker install and precache.
  await page.goto(preview.base + '?mock=1&howto=0&collected=5')
  await page.waitForSelector('h1:has-text("900words")')
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return reg?.active?.state === 'activated'
    },
    undefined,
    { timeout: 20000 },
  )
  // Give workbox a beat to finish precaching after activation.
  await sleep(1500)
  // S3's timing map is tiny enough to travel with the shell, unlike a chapter
  // recording. A cached performance therefore keeps its seek/highlight map on
  // an offline revisit; a first offline listener still falls back safely.
  const chapterTimingPrecaches = await page.evaluate(async () => {
    const found = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        if (request.url.includes('/chapter-timings.da.json')) found.push({ name, url: request.url })
      }
    }
    return found
  })
  if (!chapterTimingPrecaches.length) {
    fail(`S3 chapter timing map was not precached with the offline shell: ${JSON.stringify(chapterTimingPrecaches)}`)
  }
  console.log(`chapter timing map precached with the shell (${chapterTimingPrecaches[0].name})`)
  console.log('service worker activated; going offline')

  /* ---------------- the audio, still online ---------------- */

  await openSuitcase()
  const tiles = await page.locator('.case-tile.case-collected').allTextContents()
  if (tiles.length < 2) fail(`need two collected words to test with, saw ${tiles.length}`)
  const [noClip, withClip] = tiles.map((t) => t.trim())
  const exampleFixture = exampleSource.entries.find((row) => row.id === `da:${withClip}`)
  if (!exampleFixture) fail(`no frozen example source for collected word ${withClip}`)

  // 1. A word with no baked file. Tapping it must say so (the audio notice)
  //    and must not throw — there is no fallback voice any more.
  //    Note the response is a 200, not a 404: this host answers an unknown path
  //    with index.html, which is why speak.ts checks the content type rather
  //    than the status. Getting that wrong files HTML under the clip's URL and
  //    CacheFirst keeps it for a year — this assertion is that check.
  await tapTile(0)
  await sleep(600)
  const missSeen = audioRequests.map((r) => `${r.status}`).join(',')
  console.log(`no baked clip for «${noClip}» — the host answered: ${missSeen || 'nothing'}`)
  let rejections = await page.evaluate(() => window.__rejections)
  if (rejections.length) fail(`tapping a word with no clip rejected: ${rejections.join('; ')}`)
  const afterMiss = await cachedAudio()
  if (countAudio(afterMiss)) fail(`a missing clip was left in a cache: ${JSON.stringify(afterMiss)}`)

  // 2. Now give one word a clip — and its sentence the source-hashed example
  //    fixture — and tap it. Both have to be fetched and stored: the sheet
  //    readies its word, its slow clip and its example as it opens, so one
  //    open is the request for all three, and the example fixture must be on
  //    disk BEFORE that open or the loader remembers the miss (a missing file
  //    is remembered on purpose; a tap does not re-ask for it). The slow clip
  //    has no fixture and answers index.html, which the type guard keeps out
  //    of the cache — so two entries, not three.
  //    The example fixture is deliberately silent; the assertion is playback
  //    wiring and CacheFirst storage, independent of a provider's MP3 bytes.
  const relative = bake(withClip)
  const examplePath = bakeExample(exampleFixture)
  audioRequests.length = 0
  await tapTile(1)
  await sleep(600)
  if (!audioRequests.some((r) => r.url.includes(relative.split('?')[0]) && r.status === 200)) {
    fail(`tapping «${withClip}» never fetched ${relative} (saw ${JSON.stringify(audioRequests)})`)
  }
  if (!audioRequests.some((r) => r.url.includes(examplePath) && r.status === 200)) {
    fail(`opening «${withClip}» never readied its example ${examplePath}: ${JSON.stringify(audioRequests)}`)
  }
  await page.waitForFunction(async (expected) => {
    const cache = await caches.open('word-audio-v7')
    return (await cache.keys()).filter((request) => request.url.includes('/audio/')).length === expected
  }, 2)
  const afterHit = await cachedAudio()
  if ((afterHit['word-audio-v7'] ?? []).length !== 2) {
    fail(`expected the word and its example in word-audio-v7, got ${JSON.stringify(afterHit)}`)
  }
  const precached = Object.entries(afterHit)
    .filter(([name]) => name.includes('precache'))
    .reduce((n, [, list]) => n + list.length, 0)
  if (precached > 0) fail(`audio was precached after all: ${JSON.stringify(afterHit)}`)
  console.log(`«${withClip}» and its example fetched and runtime-cached; ${precached} audio files precached`)

  // The sheet's own example button plays the readied clip: no rejection, no
  // "did not load", and no second fetch of a clip the player already holds.
  audioRequests.length = 0
  await page.evaluate(() => (window.__rejections = []))
  await page.locator('.case-tile.case-collected').nth(1).click()
  await page.waitForSelector('.sheet')
  await page.locator('.sheet-example .speak-btn').first().click()
  await sleep(600)
  // Kind-specific: the notice for «mor»'s missing WORD clip, from step 1, is
  // still up and is right to be.
  if (await page.locator('.audio-notice[data-audio-failure="example"]').count()) {
    fail(`the dictionary example reported a failure: ${await page.locator('.audio-notice').textContent()}`)
  }
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sheet', { state: 'detached' })
  rejections = await page.evaluate(() => window.__rejections)
  if (rejections.length) fail(`playing the dictionary example rejected: ${rejections.join('; ')}`)
  console.log(`dictionary example plays from the readied clip: ${examplePath}`)

  // S4 task clips use the same on-demand route, but a separate directory and
  // manifest. Every activity class and capsule phase, plus both checkpoints,
  // must work rather than only ordinary word audio.
  const taskPaths = taskFixtures.map(bakeTask)
  const taskResponses = await page.evaluate(async (paths) =>
    Promise.all(paths.map(async (path) => {
      const response = await fetch(path)
      return { path, status: response.status, type: response.headers.get('content-type') ?? '' }
    })), taskPaths)
  const invalidTaskResponse = taskResponses.find((response) => response.status !== 200 || !response.type.startsWith('audio/'))
  if (invalidTaskResponse) fail(`task audio did not resolve as audio: ${JSON.stringify(invalidTaskResponse)}`)
  // Workbox keeps the response fast and writes its cache work through the
  // fetch event lifetime. Await the observable cache state rather than racing
  // those writes — 38 simultaneous task fixtures are enough to expose it.
  await page.waitForFunction(async (expected) => {
    const cache = await caches.open('word-audio-v7')
    const keys = await cache.keys()
    return keys.filter((request) => request.url.includes('/audio/')).length === expected
  }, taskPaths.length + 2)
  const afterTasks = await cachedAudio()
  if ((afterTasks['word-audio-v7'] ?? []).length !== taskPaths.length + 2) {
    fail(`expected word + example + ${taskPaths.length} task clips cached on demand, got ${JSON.stringify(afterTasks)}`)
  }
  console.log(`${taskPaths.length} activity-class/phase checkpoint clips fetched and runtime-cached on demand`)

  /* ---------------- and now with the network gone ---------------- */

  await context.setOffline(true)
  await page.reload()
  await page.waitForSelector('h1:has-text("900words")', { timeout: 15000 })

  // The dictionary must work offline too (bundled data).
  await openSuitcase()
  await page.locator('.case-tile.case-collected').first().click()
  await page.waitForSelector('.sheet')
  const word = await page.locator('.sheet h2').textContent()
  console.log('offline dictionary lookup:', word?.trim())
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sheet', { state: 'detached' })

  // 3. The cached word plays with no network at all. Nothing here can hear it,
  //    so what is asserted is that the tap resolves, the bytes are still in the
  //    cache, and the app got them without asking the network.
  audioRequests.length = 0
  await page.evaluate(() => (window.__rejections = []))
  await tapTile(1)
  await sleep(600)
  rejections = await page.evaluate(() => window.__rejections)
  if (rejections.length) fail(`playing a cached word offline rejected: ${rejections.join('; ')}`)
  const offlineCache = await cachedAudio()
  if ((offlineCache['word-audio-v7'] ?? []).length !== taskPaths.length + 2) {
    fail(`the word/example/task clips did not survive going offline: ${JSON.stringify(offlineCache)}`)
  }
  const reachedNetwork = audioRequests.filter((r) => r.status === 0 || r.status >= 400)
  console.log(
    `offline replay of «${withClip}»: no rejection, still cached, ` +
      `${reachedNetwork.length} failed network attempts`,
  )

  const offlineExample = await page.evaluate(async (path) => {
    const response = await fetch(path)
    return { status: response.status, type: response.headers.get('content-type') ?? '' }
  }, examplePath)
  if (offlineExample.status !== 200 || !offlineExample.type.startsWith('audio/')) {
    fail(`cached example clip failed offline: ${JSON.stringify(offlineExample)}`)
  }
  console.log('dictionary example replayable offline from the runtime cache')

  const offlineTasks = await page.evaluate(async (paths) =>
    Promise.all(paths.map(async (path) => {
      const response = await fetch(path)
      return { path, status: response.status, type: response.headers.get('content-type') ?? '' }
    })), taskPaths)
  const missedOfflineTask = offlineTasks.find((response) => response.status !== 200 || !response.type.startsWith('audio/'))
  if (missedOfflineTask) fail(`cached task clip failed offline: ${JSON.stringify(missedOfflineTask)}`)
  console.log(`${taskPaths.length} activity-class/phase checkpoint clips replayable offline from the runtime cache`)

  // L1 adds a second offline layer, but it must stay a lazy chunk: this test
  // has not typed one of its terms until the network is already gone. Start a
  // player-first round with the production companion selected. No model call is
  // needed to deal the local board; a true miss below must visibly fail offline
  // instead of being answered by the test-only mock.
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}')
    settings.state = { ...(settings.state ?? {}), useMock: false }
    localStorage.setItem('cluecab-settings-v1', JSON.stringify(settings))
    localStorage.removeItem('cluecab-game-v1')
  })
  await page.goto(`${preview.base}?howto=0&first=player&seed=5`)
  await page.waitForSelector('.city-card', { timeout: 15000 })
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const startRound = page.locator('.study-dock .btn-primary')
  if (await startRound.isVisible().catch(() => false)) await startRound.click()
  const dictionary = page.locator('.clue-input')
  const field = dictionary.locator('.translate-input')
  const line = dictionary.locator('.composer-line')
  await field.fill('dog')
  await page.waitForFunction(() => document.querySelector('.clue-input .composer-line')?.textContent?.includes('hund'))
  console.log('offline taught lookup: dog → hund')

  await field.fill('pram')
  await page.waitForFunction(() => document.querySelector('.clue-input .composer-line')?.textContent?.includes('barnevogn'))
  const authoredLine = await line.innerText()
  if (!authoredLine.includes('barnevogn') || /Asking Casey/.test(authoredLine)) {
    fail(`offline derived clue lookup did not stay local: ${JSON.stringify(authoredLine)}`)
  }
  console.log('offline lazy clue lexicon: pram → barnevogn')

  // Waited for rather than slept on: a dropped request is retried once, 1.5s
  // later (#203), so the failure lands about 2.4s after the fill, past the
  // 1.8s this used to sleep. The line prints the short failure and keeps the
  // reason in its title and accessible name (#298), so the reason is read
  // there.
  await field.fill('helicopter')
  const failure = dictionary.locator('.composer-line .test-fail')
  await failure.waitFor({ timeout: 8000 }).catch(() => {})
  const missLine = await line.innerText()
  const missReason = (await failure.getAttribute('title').catch(() => null)) ?? ''
  if (!/(?:You appear to be offline\.|Could not reach Casey)/.test(missReason) || missLine.includes('helikopter')) {
    fail(`offline true miss did not return an existing connection error: ${JSON.stringify({ line: missLine, reason: missReason })}`)
  }
  console.log('offline true miss: helicopter → existing connection error (no fabricated answer)')

  console.log('OFFLINE DRIVE OK')
} catch (e) {
  console.log('OFFLINE DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
  // Put dist/audio back the way `vite build` left it.
  //
  // This used to just delete it, on the reasoning that a stray silent test
  // clip is a difference between drives nobody asked for. That was right when
  // public/audio was gitignored and there were no real clips to lose. There
  // are 931 now, the drives share one build, and this runs ninth of sixteen —
  // so deleting left every later drive asking for clips that were not there
  // and getting `vite preview`'s index.html back with a 200. smoke-drive's
  // tap-says-the-word check ran in exactly that hole.
  //
  // Restoring from public/ rather than rebuilding: it is the same copy vite
  // makes, and it costs a directory copy instead of a minute.
  rmSync(AUDIO_ROOT, { recursive: true, force: true })
  cpSync(resolve(ROOT, 'public', 'audio'), AUDIO_ROOT, { recursive: true })
}
