// Word audio after the release replacements of 2026-09-26, heard the way the
// app starts it. Two halves:
//
// SOURCE (a Vite dev server over e2e/word-audio-fixture.ts): the app's real
// speak.ts player on its media elements (the performance log's "Old
// word-players" switch, `elementWords`, seeded: the way back), in Chromium, asked for every replaced variant at the speed
// it was replaced in, for «tvivl» at both speeds (an uncountable noun: the
// word alone, no article, and no assumption that its clip is at fault), and
// for an ordinary noun (article, then word). Each start is read off the
// player's own `cluecab-audio` event and the media element it pressed play
// on: which file, where in it (the onset seek), whether it ran to its end.
// Then ownership: an idle request scope — what a component's cleanup calls —
// must not stop a word someone else started, while a scope that owns its
// request does stop it; sound off starts nothing; and thirty plays in a row
// still all play.
//
// BUILT (dist through `vite preview`, with the real service worker): a phone
// that cached the OLD bytes under the same filename keeps them in
// `word-audio-v5`, and one that cached the once-silent «Tak.» Survival line
// keeps it in `word-audio-v6`. The worker's route reads `word-audio-v7`, so
// the current recording must be what a fetch returns, and it must land in v7.
//
// WEB AUDIO (the default for words since TestFlight 126; seeded with the
// retired opt-in `webAudioWords`, which must be ignored): the same source
// player with every word decoded into a buffer and started on the app's
// AudioContext. Each start must be a buffer source (`via: 'buffer'`) at the
// clip's voice onset, and no media element may be made or played for a word.
// Then the built app: a café board's card taps, heard through Web Audio with
// no word element anywhere. Then the ENTRY PATHS, in a Chromium with its
// autoplay policy left on, so a context runs only if it was made or resumed
// inside a real gesture: the first onboarding tap, Home's Café puzzle and
// Home's Sightseeing each leave the context running, and the café's first
// card tap is heard.
//
// This is browser scheduling and decoding evidence. It says nothing about
// what an iPhone speaker produces; that stays a device check.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const receipt = JSON.parse(readFileSync(resolve(ROOT, 'scripts/data/word-audio-replacements.da.json'), 'utf8'))
const phrases = JSON.parse(readFileSync(resolve(ROOT, 'src/data/article-phrases.da.json'), 'utf8')).words
const phraseIds = new Set(phrases.map((row) => row.id))
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`)
}

const INSTRUMENT = () => {
  try {
    localStorage.setItem('cluecab-diag-switches', JSON.stringify({ elementWords: true }))
  } catch {
    return
  }
  window.__starts = []
  window.__media = []
  window.addEventListener('cluecab-audio', (event) => window.__starts.push(String(event.detail?.url ?? '')))
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    const el = this
    // Where the voice is started from is read when the element actually
    // starts: a cold pooled element is parked at its onset on
    // loadedmetadata, which can arrive after play() was called.
    const rec = { url: window.__starts.at(-1) ?? '', startAt: null, askedAt: performance.now(), playingAt: null, endedAt: null, pausedAt: null, maxTime: el.currentTime }
    window.__media.push(rec)
    el.addEventListener('playing', () => { rec.playingAt ??= performance.now(); rec.startAt ??= el.currentTime }, { once: true })
    el.addEventListener('timeupdate', () => { rec.maxTime = Math.max(rec.maxTime, el.currentTime) })
    el.addEventListener('ended', () => { rec.endedAt ??= performance.now() }, { once: true })
    // Chromium fires 'pause' just before 'ended' at a natural end, so a stop
    // is a pause with no 'ended' after it — judged by the reader, not here.
    el.addEventListener('pause', () => { rec.pausedAt ??= performance.now() }, { once: true })
    return play.apply(this, args)
  }
}

/** The Web Audio half: the switch on, and every buffer start and media element seen. */
const INSTRUMENT_WEB = () => {
  try {
    // The retired opt-in of #408: a device that stored it simply gets the default.
    localStorage.setItem('cluecab-diag-switches', JSON.stringify({ webAudioWords: true }))
  } catch {
    return
  }
  window.__web = { events: [], sources: [], elements: [], plays: [] }
  window.addEventListener('cluecab-audio', (event) => window.__web.events.push({ url: String(event.detail?.url ?? ''), via: event.detail?.via, at: performance.now() }))
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    window.__web.sources.push({ offset: offset ?? 0, duration: this.buffer?.duration ?? null, state: this.context.state, at: performance.now() })
    return start.call(this, when, offset, duration)
  }
  const NativeAudio = window.Audio
  window.Audio = function (...args) {
    const el = new NativeAudio(...args)
    window.__web.elements.push(el)
    return el
  }
  window.Audio.prototype = NativeAudio.prototype
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__web.plays.push({ src: this.currentSrc || this.src, clip: this.dataset?.clip ?? null })
    return play.apply(this, args)
  }
}

/** A media element play that was a word (not the 20 ms unlock clip, not a UI effect). */
const isWordPlay = (p) => !p.src.startsWith('data:') && !p.src.includes('/audio/ui/')

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
})
let vite
let preview
let strict
try {
  // ---------------------------------------------------------------- source
  vite = await createServer({
    root: ROOT,
    configFile: resolve(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 5311 + OFFSET, strictPort: true },
  })
  await vite.listen()
  const base = `http://127.0.0.1:${5311 + OFFSET}/ClueCabulary/`
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(INSTRUMENT)
  // A cold Vite transform of speak.ts's graph takes a while on a laptop.
  await page.goto(`${base}e2e/word-audio-fixture.html`, { timeout: 120_000 })
  await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready', undefined, { timeout: 120_000 })

  /** Ask the real player for one word and follow it to its end. */
  const say = (id, slow = false, article = true) => page.evaluate(async ({ id, slow, article }) => {
    const P = window.__player
    const s0 = window.__starts.length
    const m0 = window.__media.length
    const calledAt = performance.now()
    const result = await P.playWord(id, { slow, article })
    const deadline = performance.now() + 5000
    while (performance.now() < deadline) {
      const last = window.__media.at(-1)
      if (window.__media.length > m0 && (last.endedAt || last.pausedAt)) break
      await new Promise((r) => setTimeout(r, 20))
    }
    // The seek belongs to the clip the tap actually asks for: the phrase when
    // the noun has one, otherwise the word.
    const phraseUrl = article ? P.articlePhraseAudioUrl(id, slow ? 'slow' : 'normal') : undefined
    const url = phraseUrl ?? P.wordAudioUrl(id, slow ? 'slow' : 'normal')
    return {
      result,
      starts: window.__starts.slice(s0).map((u) => new URL(u, location.href).pathname),
      media: window.__media.slice(m0).map((m) => ({ ...m, latencyMs: m.playingAt === null ? null : Math.round(m.playingAt - calledAt) })),
      expectedStartAt: P.clipStartAt(url),
      phrase: article ? P.articlePhraseAudioUrl(id, slow ? 'slow' : 'normal') ?? null : null,
      article: article ? P.spokenArticleOf(id) ?? null : null,
    }
  }, { id, slow, article })

  const latencies = []
  for (const variant of receipt.variants) {
    const slow = variant.speed === 'slow'
    // A City 1 noun's tap plays its one-performance phrase (checked below);
    // the replaced word clip itself is what article:false asks for.
    const heard = await say(variant.id, slow, !phraseIds.has(variant.id))
    const word = heard.media.at(-1)
    const wordPath = `/ClueCabulary/audio/da/${variant.path}`
    const ok =
      heard.result === 'baked' &&
      heard.starts.at(-1) === wordPath &&
      word && word.startAt !== null && Math.abs(word.startAt - heard.expectedStartAt) < 0.03 &&
      word.endedAt !== null && word.maxTime > heard.expectedStartAt + 0.1
    // A noun says its article first; the rest are the word alone.
    const articleOk = heard.article
      ? heard.starts.length === 2 && heard.starts[0].includes('/audio/da/article/')
      : heard.starts.length === 1
    // Latency from the call to the voice's element playing; an article's own
    // clip plays first by design, so only article-free words are timed.
    if (!heard.article) latencies.push(word?.latencyMs ?? null)
    check(`${variant.id} (${variant.speed}) plays ${variant.path} from ${Math.round(heard.expectedStartAt * 1000)} ms to its end${heard.article ? ` after «${heard.article}»` : ''}`,
      ok && articleOk, JSON.stringify(heard))
  }

  // «tvivl»: exercised at both speeds as an ordinary word, not presumed broken.
  for (const slow of [false, true]) {
    const heard = await say('da:tvivl', slow)
    const word = heard.media.at(-1)
    check(`da:tvivl (${slow ? 'slow' : 'normal'}) plays alone, no article, from its onset to its end (started in ${word?.latencyMs} ms)`,
      heard.result === 'baked' && heard.article === null && heard.starts.length === 1 &&
        heard.starts[0] === `/ClueCabulary/audio/da/${slow ? 'slow/' : ''}tvivl.mp3` &&
        word?.endedAt !== null && word.startAt !== null && Math.abs(word.startAt - heard.expectedStartAt) < 0.03,
      JSON.stringify(heard))
  }

  // Every City 1 noun, at both speeds: ONE performance with its article
  // («Et hus»), no article clip, from its onset seek to its end.
  const phraseStarts = []
  for (const row of phrases) {
    for (const slow of [false, true]) {
      const heard = await say(row.id, slow)
      const clip = heard.media.at(-1)
      const ok = heard.result === 'baked' && heard.phrase !== null && heard.starts.length === 1 &&
        heard.starts[0] === new URL(heard.phrase, base).pathname && !heard.starts[0].includes('/article/') &&
        clip && clip.startAt !== null && Math.abs(clip.startAt - heard.expectedStartAt) < 0.03 && clip.endedAt !== null
      if (!ok) check(`${row.article} ${row.da} (${slow ? 'slow' : 'normal'}) plays its one phrase clip`, false, JSON.stringify(heard))
      else if (clip.latencyMs !== null) phraseStarts.push(clip.latencyMs)
    }
  }
  check(`all ${phrases.length} City 1 nouns play one «en/et + word» performance at both speeds, from the onset to the end`,
    phraseStarts.length === phrases.length * 2, `${phraseStarts.length}/${phrases.length * 2}`)
  phraseStarts.sort((a, b) => a - b)
  console.log(`phrase taps, call to 'playing': median ${phraseStarts[phraseStarts.length >> 1]} ms, max ${phraseStarts.at(-1)} ms`)

  // A noun outside City 1 still chains: «bog», article clip then word.
  const bog = await say('da:bog')
  check(`da:bog (no phrase) says «${bog.article}» and then the word, both to their ends`,
    bog.result === 'baked' && bog.phrase === null && bog.article !== null && bog.starts.length === 2 &&
      bog.starts[0].endsWith(`/audio/da/article/${bog.article}.mp3`) && bog.starts[1].endsWith('/audio/da/bog.mp3') &&
      bog.media.every((m) => m.endedAt !== null),
    JSON.stringify(bog))

  // Ownership. An idle scope's cleanup (a component unmounting while the
  // translation challenge says its word) must not stop that word.
  const ownership = await page.evaluate(async () => {
    const P = window.__player
    const m0 = window.__media.length
    const external = P.playWord('da:tvivl')
    const idle = P.createWordAudioScope()
    idle.cancel()
    await external
    const deadline = performance.now() + 4000
    while (performance.now() < deadline && !(window.__media[m0]?.endedAt || window.__media[m0]?.pausedAt)) await new Promise((r) => setTimeout(r, 20))
    const kept = window.__media[m0]
    // A scope that owns its request does stop it.
    const owned = P.createWordAudioScope()
    const m1 = window.__media.length
    let feedback = null
    owned.run(() => P.playWord('da:pude'), (result) => { feedback = result })
    const started = performance.now() + 2000
    while (performance.now() < started && window.__media.length === m1) await new Promise((r) => setTimeout(r, 5))
    owned.cancel()
    await new Promise((r) => setTimeout(r, 900))
    return { kept, stopped: window.__media[m1] ?? null, feedback }
  })
  check('an idle scope cleanup does not cancel someone else\'s word', Boolean(ownership.kept?.endedAt), JSON.stringify(ownership.kept))
  check('a scope that owns its word stops it, and reports nothing for it',
    ownership.stopped !== null && ownership.stopped.endedAt === null && ownership.stopped.pausedAt !== null && ownership.feedback === null,
    JSON.stringify(ownership))

  // Sound off starts nothing; switching back on plays again.
  const soundOff = await page.evaluate(async () => {
    const P = window.__player
    const m0 = window.__media.length
    P.setSound(false)
    const off = await P.playWord('da:bo')
    P.setSound(true)
    const on = await P.playWord('da:bo')
    return { off, on, started: window.__media.length - m0 }
  })
  check('sound off starts no clip, and sound on plays again', soundOff.off === 'silent' && soundOff.on === 'baked' && soundOff.started === 1, JSON.stringify(soundOff))

  // Thirty taps later the player still plays every one.
  const repeated = await page.evaluate(async () => {
    const P = window.__player
    const ids = ['da:bo', 'da:tvivl', 'da:ord', 'da:hus', 'da:ske']
    const results = []
    for (let i = 0; i < 30; i++) results.push(await P.playWord(ids[i % ids.length], { slow: i % 2 === 1 }))
    P.stopWordAudio()
    return results
  })
  check('thirty consecutive plays all start (no progressive loss)', repeated.every((r) => r === 'baked'), JSON.stringify(repeated))
  check('the harness raised no page errors', errors.length === 0, errors.join('; '))
  const measured = latencies.filter((l) => l !== null).sort((a, b) => a - b)
  console.log(`cold start, call to 'playing', article-free replacements: median ${measured[measured.length >> 1]} ms, max ${measured.at(-1)} ms (Chromium on this machine; not a phone measurement)`)
  await context.close()

  // ------------------------------------------------------ web audio, source
  const webContext = await browser.newContext({ serviceWorkers: 'block' })
  const webPage = await webContext.newPage()
  const webErrors = []
  webPage.on('pageerror', (e) => webErrors.push(e.message))
  await webPage.addInitScript(INSTRUMENT_WEB)
  await webPage.goto(`${base}e2e/word-audio-fixture.html`, { timeout: 120_000 })
  await webPage.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready', undefined, { timeout: 120_000 })
  const sayWeb = (id, slow = false, article = true) => webPage.evaluate(async ({ id, slow, article }) => {
    const P = window.__player
    const e0 = window.__web.events.length
    const s0 = window.__web.sources.length
    const result = await P.playWord(id, { slow, article })
    const phrase = article ? P.articlePhraseAudioUrl(id, slow ? 'slow' : 'normal') : undefined
    const url = phrase ?? P.wordAudioUrl(id, slow ? 'slow' : 'normal')
    return {
      result,
      events: window.__web.events.slice(e0).map((e) => ({ ...e, url: new URL(e.url, location.href).pathname })),
      sources: window.__web.sources.slice(s0),
      expectedStartAt: P.clipStartAt(url),
      expected: new URL(url, location.href).pathname,
    }
  }, { id, slow, article })
  const webCases = [['da:tvivl', false], ['da:tvivl', true], [phrases[0].id, false], [phrases[0].id, true], ['da:hus', false]]
  for (const [id, slow] of webCases) {
    const heard = await sayWeb(id, slow)
    const last = heard.sources.at(-1)
    check(`Web Audio: ${id} (${slow ? 'slow' : 'normal'}) starts a decoded buffer at its voice onset (${Math.round(heard.expectedStartAt * 1000)} ms)`,
      heard.result === 'baked' && heard.events.length >= 1 && heard.events.every((e) => e.via === 'buffer') &&
        heard.events.at(-1).url === heard.expected && last && last.state === 'running' &&
        Math.abs(last.offset - heard.expectedStartAt) < 0.001,
      JSON.stringify(heard))
  }
  const bogWeb = await sayWeb('da:bog')
  check('Web Audio: da:bog says its article and then the word, both as buffers',
    bogWeb.result === 'baked' && bogWeb.events.length === 2 && bogWeb.events.every((e) => e.via === 'buffer') &&
      bogWeb.events[0].url.includes('/audio/da/article/') && bogWeb.events[1].url.endsWith('/audio/da/bog.mp3'),
    JSON.stringify(bogWeb))
  const webRepeat = await webPage.evaluate(async () => {
    const P = window.__player
    await P.preloadWordAudio(['da:bo', 'da:ord', 'da:ske'])
    const results = []
    const ids = ['da:bo', 'da:tvivl', 'da:ord', 'da:hus', 'da:ske']
    for (let i = 0; i < 30; i++) results.push(await P.playWord(ids[i % ids.length], { slow: i % 2 === 1 }))
    P.stopWordAudio()
    return results
  })
  check('Web Audio: thirty consecutive plays all start', webRepeat.every((r) => r === 'baked'), JSON.stringify(webRepeat))
  const webSoundOff = await webPage.evaluate(async () => {
    const P = window.__player
    const s0 = window.__web.sources.length
    P.setSound(false)
    const off = await P.playWord('da:bo')
    P.setSound(true)
    const on = await P.playWord('da:bo')
    return { off, on, started: window.__web.sources.length - s0 }
  })
  check('Web Audio: sound off starts no buffer, and sound on plays again',
    webSoundOff.off === 'silent' && webSoundOff.on === 'baked' && webSoundOff.started === 1, JSON.stringify(webSoundOff))
  const webMedia = await webPage.evaluate(() => ({
    made: window.__web.elements.length,
    plays: window.__web.plays,
    pooled: document.querySelectorAll('audio[data-clip]').length,
  }))
  check('Web Audio: no media element was made or played for a word',
    webMedia.made === 0 && webMedia.plays.filter(isWordPlay).length === 0, JSON.stringify(webMedia))
  check('Web Audio: the harness raised no page errors', webErrors.length === 0, webErrors.join('; '))
  await webContext.close()

  // ----------------------------------------------------------------- built
  preview = await startPreview(4311)
  const built = await browser.newContext()
  const app = await built.newPage()
  await app.goto(`${preview.base}?howto=0`)
  await app.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', undefined, { timeout: 30_000 })
  await app.reload()
  await app.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 15_000 })
  const fixture = (name) => readFileSync(resolve(ROOT, 'scripts/fixtures/audio-acoustics', name)).toString('base64')
  const sha = (path) => createHash('sha256').update(readFileSync(resolve(ROOT, 'public/audio/da', path))).digest('hex')
  const staleServe = (path, staleCache, oldBytes) => app.evaluate(async ({ path, staleCache, oldBytes }) => {
    const url = new URL(`audio/da/${path}`, location.href).href
    const stale = await caches.open(staleCache)
    await stale.put(url, new Response(Uint8Array.from(atob(oldBytes), (c) => c.charCodeAt(0)), { headers: { 'content-type': 'audio/mpeg' } }))
    const res = await fetch(url)
    const digest = await crypto.subtle.digest('SHA-256', await res.arrayBuffer())
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    // Workbox writes the runtime cache after it has answered; wait for the
    // observable state rather than racing that write (offline-drive does too).
    const current = await caches.open('word-audio-v7')
    let cached = false
    for (let i = 0; i < 100 && !cached; i++) {
      cached = Boolean(await current.match(url))
      if (!cached) await new Promise((r) => setTimeout(r, 50))
    }
    return { hex, cached, names: await caches.keys() }
  }, { path, staleCache, oldBytes })
  const bo = await staleServe('bo.mp3', 'word-audio-v5', fixture('original-near-silent-bo.mp3'))
  check('a device still holding the old «bo» in word-audio-v5 is served the approved bytes', bo.hex === sha('bo.mp3'), JSON.stringify(bo))
  check('and the approved bytes are what word-audio-v7 now caches', bo.cached, JSON.stringify(bo.names))
  const tak = await staleServe('survival/sonderborg-situation-3-line-4.mp3', 'word-audio-v6', fixture('original-silent-tak.mp3'))
  check('a device holding the silent City 1 «Tak.» in word-audio-v6 is served the audible recording', tak.hex === sha('survival/sonderborg-situation-3-line-4.mp3'), JSON.stringify(tak))
  check('and word-audio-v7 caches it', tak.cached, JSON.stringify(tak.names))
  const sw = readFileSync(resolve(ROOT, 'dist/sw.js'), 'utf8')
  check('the built worker routes /audio/ through word-audio-v7 only', sw.includes('word-audio-v7') && !/word-audio-v[1-6]/.test(sw))
  await built.close()

  // ------------------------------------------------------- web audio, built
  // A café board, by default: its card taps are buffer starts, and no word
  // element is made or played anywhere on the way.
  const cafe = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const board = await cafe.newPage()
  const boardErrors = []
  board.on('pageerror', (e) => boardErrors.push(e.message))
  await board.addInitScript(mergeFirstCafe, seedArgs('da'))
  await board.addInitScript(INSTRUMENT_WEB)
  await installRoundGuidanceHandler(board)
  await board.goto(`${preview.base}?howto=0&seed=1701&mock=1`)
  await board.locator('.home-play[data-cafe-action="next"]').click()
  await board.locator('.game-screen').waitFor()
  await dismissRoundGuidance(board)
  await board.locator('.word-card:not([disabled])').first().waitFor()
  // The deal decodes the board's words; give it the moment a player would.
  await board.waitForTimeout(1500)
  const taps = []
  for (const nth of [0, 1, 2]) {
    const before = await board.evaluate(() => window.__web.events.length)
    await board.locator('.word-card:not([disabled])').nth(nth).dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' })
    await board.waitForFunction((n) => window.__web.events.length > n, before, { timeout: 5000 }).catch(() => {})
    await board.waitForTimeout(900)
    taps.push(await board.evaluate((n) => window.__web.events.slice(n), before))
  }
  const cafeMedia = await board.evaluate(() => ({
    plays: window.__web.plays,
    pooledMade: window.__web.elements.filter((el) => el.dataset.clip).length,
    state: window.__web.sources.at(-1)?.state ?? null,
  }))
  check('Web Audio (built): three café card taps each start a word buffer',
    taps.every((t) => t.length >= 1 && t.every((e) => e.via === 'buffer' && e.url.includes('/audio/da/'))) && cafeMedia.state === 'running',
    JSON.stringify({ taps, state: cafeMedia.state }))
  check('Web Audio (built): no word element made or played on the café board',
    cafeMedia.pooledMade === 0 && cafeMedia.plays.filter(isWordPlay).length === 0, JSON.stringify(cafeMedia))
  check('Web Audio (built): no page errors', boardErrors.length === 0, boardErrors.join('; '))
  await cafe.close()

  // ------------------------------------------------- web audio, entry paths
  // No autoplay flag here: Chromium starts a context only from a gesture, so
  // a running context proves the first tap of the path made or resumed it.
  strict = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
  const CONTEXTS = () => {
    window.__contexts = []
    const Native = window.AudioContext
    window.AudioContext = function (...args) {
      const made = new Native(...args)
      window.__contexts.push(made)
      return made
    }
    window.AudioContext.prototype = Native.prototype
  }
  const states = (page) => page.evaluate(() => window.__contexts.map((c) => c.state))
  const entry = async (name, seeded, enter) => {
    const ctx = await strict.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (seeded) await page.addInitScript(mergeFirstCafe, seedArgs('da'))
    await page.addInitScript(INSTRUMENT_WEB)
    await page.addInitScript(CONTEXTS)
    await installRoundGuidanceHandler(page)
    const result = await enter(page)
    // A context made inside the tap takes a moment to start its hardware.
    await page.waitForFunction(() => window.__contexts.some((c) => c.state === 'running'), undefined, { timeout: 4000 }).catch(() => {})
    const after = await states(page)
    check(`Web Audio (entry): ${name} leaves the context running`, after.length === 1 && after[0] === 'running' && errors.length === 0,
      JSON.stringify({ ...result, after, errors }))
    return { page, ctx }
  }

  // The first launch: a fresh profile's onboarding, its very first tap.
  const first = await entry('the first onboarding tap', false, async (page) => {
    await page.goto(`${preview.base}?seed=1701&mock=1`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const before = await states(page)
    await page.mouse.click(195, 420)
    return { before }
  })
  await first.ctx.close()

  // Home → Sightseeing.
  const walk = await entry('Home → Sightseeing', true, async (page) => {
    await page.goto(`${preview.base}?howto=0&seed=1701&mock=1`)
    await page.locator('.home-tag-sightseeing').waitFor()
    const before = await states(page)
    await page.locator('.home-tag-sightseeing').click()
    return { before }
  })
  await walk.ctx.close()

  // Home → Café puzzle, and its first card tap (a real one) is heard.
  const puzzle = await entry('Home → Café puzzle', true, async (page) => {
    await page.goto(`${preview.base}?howto=0&seed=1701&mock=1`)
    await page.locator('.home-play[data-cafe-action="next"]').waitFor()
    const before = await states(page)
    await page.locator('.home-play[data-cafe-action="next"]').click()
    await page.locator('.game-screen').waitFor()
    return { before }
  })
  await dismissRoundGuidance(puzzle.page)
  const firstCard = puzzle.page.locator('.word-card:not([disabled])').first()
  await firstCard.waitFor()
  const mark = await puzzle.page.evaluate(() => window.__web.events.length)
  const box = await firstCard.boundingBox()
  await puzzle.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await puzzle.page.mouse.down()
  await puzzle.page.waitForFunction((n) => window.__web.events.length > n, mark, { timeout: 5000 }).catch(() => {})
  await puzzle.page.mouse.up()
  await puzzle.page.waitForTimeout(600)
  const heard = await puzzle.page.evaluate((n) => ({
    events: window.__web.events.slice(n),
    notice: document.querySelectorAll('.audio-notice').length,
    pooled: window.__web.elements.filter((el) => el.dataset.clip).length,
  }), mark)
  check('Web Audio (entry): the café\'s first card tap is a word buffer, with no failure notice and no word element',
    heard.events.length >= 1 && heard.events.every((e) => e.via === 'buffer') && heard.notice === 0 && heard.pooled === 0,
    JSON.stringify(heard))
  await puzzle.ctx.close()
} finally {
  await strict?.close()
  await browser.close()
  await vite?.close()
  preview?.stop()
}

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} word-audio checks passed`)
if (failed.length) process.exit(1)
