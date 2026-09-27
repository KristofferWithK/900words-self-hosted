import {
  chapterAudioUrl,
  clipStartAt,
  exampleAudioUrl,
  loadBakedClip,
  playWord,
  preloadWordAudio,
  survivalAudioUrl,
  taskAudioUrl,
  wordAudioUrl,
} from '../ui/speak'
import { getAudioContext } from '../ui/audioContext'
import { sfxUrl } from '../ui/sfx'

/**
 * The audio self-test: does this build, on this device, get its own bake?
 *
 * Every web drive fetches clips through `vite preview`, which answers with a
 * real HTTP status and a real content-type. The phone does not: Capacitor's
 * iOS scheme handler answers a media extension with a plain URLResponse —
 * no headers, status 0 — and the loader in speak.ts has been wrong about that
 * twice, each time sending every clip to a fallback voice while every drive
 * stayed green. The only place that path can be exercised is a WKWebView, so
 * the ios-sim workflow seeds `cluecab-audio-selftest` and reads one line back
 * out of the app's console: the same loader the taps use, asked for one clip
 * of every baked kind.
 *
 * It also reports the RAW outcome of every way the app could ask for a clip
 * — a plain fetch, a fetch with a Range header (which takes the handler's
 * HTTP branch), and an audio element given the url directly — because the
 * third time round, guessing at what the shell answers is what has to stop.
 * Each probe prints one `AUDIO-SELFTEST-DETAIL {json}` line before the
 * summary.
 *
 * Never runs for a player: the key is written only by the workflow's seeding
 * step, into the simulator's copy of the app.
 */
export const AUDIO_SELFTEST_KEY = 'cluecab-audio-selftest'

/** What one probe of every baked kind came back as. */
export type AudioSelfTestResult = { readonly line: string; readonly ok: boolean }

export function audioSelfTestRequested(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(AUDIO_SELFTEST_KEY) === '1'
  } catch {
    return false
  }
}

/** One clip of each kind, all from the first city, all in the committed bake. */
function probes(): ReadonlyArray<readonly [string, string | undefined]> {
  return [
    ['word', wordAudioUrl('da:hus')],
    ['slow', wordAudioUrl('da:hus', 'slow')],
    ['example', exampleAudioUrl('da:hus')],
    ['chapter', chapterAudioUrl(0)],
    ['survival', survivalAudioUrl('sonderborg-situation-1-line-1')],
    ['task', taskAudioUrl('sonderborg-situation-1-audio-1')],
    // The UI sound effects: frozen WAVs on their own elements (sfx.ts), and
    // the one file type here the word bake never exercised through the
    // shell's scheme handler.
    ['sfx-tick', sfxUrl('tick')],
    ['sfx-blip', sfxUrl('blip')],
    ['sfx-fanfare', sfxUrl('fanfare')],
  ]
}

/** What one `fetch` of a clip came back with, or how it failed. */
async function rawFetch(url: string, init?: RequestInit): Promise<{ report: Record<string, unknown>; blob?: Blob }> {
  try {
    const res = await fetch(url, init)
    const headers: Record<string, string> = {}
    res.headers.forEach((value, name) => {
      headers[name] = value
    })
    let head = ''
    let size = -1
    let blob: Blob | undefined
    try {
      blob = await res.blob()
      size = blob.size
      head = [...new Uint8Array(await blob.slice(0, 4).arrayBuffer())].map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {
      head = `body-error:${String(e)}`
    }
    return { report: { status: res.status, ok: res.ok, type: res.type, headers, size, head }, blob }
  } catch (e) {
    return { report: { error: String(e) } }
  }
}

/**
 * Actually PLAY a source, the way a tap does — and say what happened. The
 * shell allows playback without a gesture (Capacitor sets
 * mediaTypesRequiringUserActionForPlayback to none), so a refusal here is
 * the source's, not the policy's. Two sources are tried for each clip: a
 * blob URL of the fetched bytes, which is what the web player uses, and the
 * file's own URL, which is what the native shell now uses.
 */
async function playProbe(src: string): Promise<Record<string, unknown>> {
  if (typeof Audio === 'undefined') return { error: 'no Audio' }
  const el = new Audio()
  el.src = src
  try {
    await el.play()
    await new Promise((r) => setTimeout(r, 300))
    const result = { played: true, duration: el.duration, currentTime: el.currentTime, readyState: el.readyState }
    el.pause()
    el.src = ''
    return result
  } catch (e) {
    const error = e as { name?: string; message?: string }
    return {
      error: `${error?.name ?? 'Error'}: ${error?.message ?? String(e)}`,
      mediaError: el.error ? `code ${el.error.code}: ${el.error.message}` : null,
      networkState: el.networkState,
    }
  }
}

/**
 * How long a tap would wait: from `play()` to the element's `playing` event,
 * cold (a fresh element that has to load the file first) and then warm (the
 * same element, already loaded, started again — which is what the pool of
 * ready elements makes a tap into). Milliseconds, or an error.
 */
async function latencyProbe(url: string): Promise<Record<string, unknown>> {
  if (typeof Audio === 'undefined') return { error: 'no Audio' }
  const el = new Audio()
  el.preload = 'auto'
  const once = () => new Promise<number>((resolve, reject) => {
    const t0 = performance.now()
    const done = () => { cleanup(); resolve(Math.round(performance.now() - t0)) }
    const failed = () => { cleanup(); reject(new Error(el.error ? `code ${el.error.code}` : 'error')) }
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, 5000)
    const cleanup = () => { clearTimeout(timer); el.removeEventListener('playing', done); el.removeEventListener('error', failed) }
    el.addEventListener('playing', done, { once: true })
    el.addEventListener('error', failed, { once: true })
    el.play().catch(failed)
  })
  try {
    el.src = url
    const coldMs = await once()
    el.pause()
    el.currentTime = 0
    const warmMs = await once()
    el.pause()
    el.src = ''
    return { coldMs, warmMs }
  } catch (e) {
    return { error: String(e) }
  }
}

/**
 * The buffer path: decode the fetched bytes on the app's AudioContext and
 * start them. What is reported is the decode time (paid when a clip is
 * readied, not on the tap) and the context's own latency figures — the
 * time from `start()` to the speaker is `baseLatency + outputLatency`, and
 * there is nothing else between a tap and a decoded buffer.
 */
async function bufferProbe(clip: Blob | undefined): Promise<Record<string, unknown>> {
  const ctx = getAudioContext()
  if (!ctx) return { error: 'no AudioContext' }
  if (!clip) return { error: 'no bytes', state: ctx.state }
  try {
    if (ctx.state !== 'running') await ctx.resume()
    const t0 = performance.now()
    const buffer = await ctx.decodeAudioData(await clip.arrayBuffer())
    const decodeMs = Math.round(performance.now() - t0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
    await new Promise((r) => setTimeout(r, 200))
    source.stop()
    const latency = ctx as AudioContext & { outputLatency?: number }
    return {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatencyMs: Math.round(ctx.baseLatency * 1000),
      outputLatencyMs: latency.outputLatency === undefined ? null : Math.round(latency.outputLatency * 1000),
      duration: buffer.duration,
      decodeMs,
    }
  } catch (e) {
    return { error: String(e), state: ctx.state }
  }
}

/**
 * The real tap, end to end: ready «hus» the way a deal does, then ask for it
 * the way a card does, and time the player's own "started" event. Says
 * which way it went — `buffer` is the path a readied word takes, `element`
 * the fallback — and how many milliseconds of JavaScript sat between the
 * call and the start.
 */
async function tapProbe(): Promise<Record<string, unknown>> {
  if (typeof window === 'undefined') return { error: 'no window' }
  await preloadWordAudio(['da:hus'])
  // Decoding is asynchronous after the load; give it a beat, as a deal has.
  await new Promise((r) => setTimeout(r, 300))
  const t0 = performance.now()
  const started = new Promise<Record<string, unknown>>((resolve) => {
    const timer = setTimeout(() => resolve({ via: 'none', ms: null }), 3000)
    window.addEventListener(
      'cluecab-audio',
      (e) => {
        clearTimeout(timer)
        const detail = (e as CustomEvent<{ url: string; via: string }>).detail
        resolve({ via: detail.via, ms: Math.round(performance.now() - t0) })
      },
      { once: true },
    )
  })
  const source = await playWord('da:hus')
  return { source, ...(await started) }
}

/**
 * The parked start: seek a loaded element to where the voice starts (see
 * `clipStartAt`) BEFORE `play()`, the way the pool does, and report where
 * playback actually began and how long the start took. WebKit ignores a
 * seek made before metadata; this is the check that the one made after it
 * is honoured in the shell.
 */
async function seekProbe(url: string): Promise<Record<string, unknown>> {
  if (typeof Audio === 'undefined') return { error: 'no Audio' }
  const startAt = clipStartAt(url)
  const el = new Audio()
  el.preload = 'auto'
  el.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('metadata timeout')), 4000)
      el.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve() }, { once: true })
      el.addEventListener('error', () => { clearTimeout(timer); reject(new Error('element error')) }, { once: true })
    })
    el.currentTime = startAt
    const t0 = performance.now()
    const playingAt = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('playing timeout')), 5000)
      el.addEventListener('playing', () => { clearTimeout(timer); resolve(el.currentTime) }, { once: true })
      el.play().catch(reject)
    })
    const ms = Math.round(performance.now() - t0)
    el.pause()
    el.src = ''
    return { startAt, playingAt: Number(playingAt.toFixed(3)), honoured: playingAt >= startAt - 0.05, ms }
  } catch (e) {
    return { error: String(e), startAt }
  }
}

/** Whether an audio element, handed the url itself, can read the clip. */
function elementProbe(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') return resolve({ error: 'no Audio' })
    const el = new Audio()
    const done = (result: Record<string, unknown>) => {
      clearTimeout(timer)
      el.onloadedmetadata = null
      el.onerror = null
      el.src = ''
      resolve(result)
    }
    const timer = setTimeout(() => done({ error: 'timeout', readyState: el.readyState, networkState: el.networkState }), 4000)
    el.onloadedmetadata = () => done({ duration: el.duration, readyState: el.readyState })
    el.onerror = () => done({ error: el.error ? `code ${el.error.code}: ${el.error.message}` : 'error' })
    el.preload = 'metadata'
    el.src = url
    el.load()
  })
}

/**
 * Fetch every probe through the real loader and say what came back, on the
 * console (for the workflow) and on the page (for the screenshot). The line
 * is grep-able on purpose: `AUDIO-SELFTEST ok …` or `AUDIO-SELFTEST FAIL …`,
 * followed by `kind=clip|absent|unreachable|no-play|no-url` for each probe.
 */
export async function runAudioSelfTest(): Promise<AudioSelfTestResult> {
  const results: Array<readonly [string, string]> = []
  for (const [kind, url] of probes()) {
    if (!url) {
      results.push([kind, 'no-url'])
      continue
    }
    const loader = await loadBakedClip(url).catch((e) => ({ kind: 'unreachable' as const, error: String(e) }))
    const plain = await rawFetch(url)
    const range = await rawFetch(url, { headers: { Range: 'bytes=0-' } })
    const blobUrl = plain.blob ? URL.createObjectURL(plain.blob) : undefined
    const detail = {
      kind,
      url,
      loader: loader.kind,
      plain: plain.report,
      range: range.report,
      element: await elementProbe(url),
      playBlob: blobUrl ? await playProbe(blobUrl) : { error: 'no bytes' },
      playUrl: await playProbe(url),
      latency: await latencyProbe(url),
      buffer: await bufferProbe(plain.blob),
      seek: await seekProbe(url),
    }
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    console.log(`AUDIO-SELFTEST-DETAIL ${JSON.stringify(detail)}`)
    // The verdict is playability, not merely bytes: run 18 had every loader
    // answer 'clip' while the phone said "did not load", because the bytes
    // were never the problem — playing them was.
    const played = (detail.playUrl as { played?: boolean }).played === true
    results.push([kind, loader.kind !== 'clip' ? loader.kind : played ? 'clip' : 'no-play'])
  }
  // The tap itself, through the real player, after the kinds: one line the
  // workflow prints beside the others, with `via` saying which path it took.
  console.log(`AUDIO-SELFTEST-DETAIL ${JSON.stringify({ kind: 'tap', ...(await tapProbe().catch((e) => ({ error: String(e) }))) })}`)
  const ok = results.every(([, got]) => got === 'clip')
  const line = `AUDIO-SELFTEST ${ok ? 'ok' : 'FAIL'} ${results.map(([kind, got]) => `${kind}=${got}`).join(' ')}`
  console.log(line)
  if (typeof document !== 'undefined') {
    const note = document.createElement('p')
    note.id = 'audio-selftest'
    note.setAttribute('role', 'status')
    note.textContent = line
    note.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;margin:0;padding:4px 8px;font:12px monospace;' +
      `background:${ok ? '#dfe' : '#fdd'};color:#111;white-space:pre-wrap`
    document.body.append(note)
  }
  return { line, ok }
}
