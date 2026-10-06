/**
 * Words through Web Audio: no media element per word at all.
 *
 * The default for words since TestFlight 126: `playWord`, `preloadWordAudio`,
 * `playClipAudio` and `preloadClipAudio` (speak.ts) come here, and the media
 * element pool is not used for them at all. The hidden performance log's "Old
 * word-players" switch (`elementWords`) sends them back to the element pool;
 * so does a page with no Web Audio. Sound effects, example sentences,
 * chapters and Survival lines stay on their elements.
 *
 * The owner's call after the iPhone-simulator soak A/B (soak 4 against soak
 * 3, same commit, 30 minutes each): handler per hit median 1-2 ms against
 * 8-11, play start 0-1 ms against 3-9, p90 hit cost 22-36 against 38-52, and
 * flat over the half hour.
 *
 * Why: on the owner's iPhone every word hit hitches, worse the longer a
 * session runs, and a restart resets it. Each HTMLAudioElement is a real
 * media player in WebKit, and the cost of play/pause grows with the elements
 * made and not yet collected (#405, the pool's note in speak.ts). Here each
 * clip is decoded ONCE into an AudioBuffer and played through the app's one
 * AudioContext (audioContext.ts): a buffer source is a few bytes of graph,
 * not a media player, so there is nothing to pile up.
 *
 * The decisions — what to fetch, the article chain, rapid taps, sound off,
 * failures — are the word player's own (`createWordPlayer` in speak.ts), run
 * over a second set of ports. Only the ports differ:
 *
 * - `warm` decodes exactly where speak.ts would ready an element: into the
 *   word pool of the screen that asked (`claimWordPool`: the café board 20,
 *   a walk's current and next two gates 8, a dictionary sheet 6, ...), only
 *   as many of one request's clips as that pool holds, and nothing for a
 *   screen that has gone. A tap then starts a decoded buffer and nothing else.
 * - `play` starts a buffer source → one gain node → the destination, at the
 *   clip's voice onset (`clipStartAt`, the same offsets the elements seek
 *   to). A clip not decoded yet is decoded from the fetched bytes first.
 * - `prime` creates/resumes the context inside the tap (pointerdown). The
 *   first gesture ANYWHERE does too (`installResumeTriggers`, at load): the
 *   onboarding's first tap, Home's Café puzzle or Sightseeing, a dictionary
 *   sheet, the suitcase, whichever comes first. A word asked for before the
 *   context runs waits for it (`RESUME_WAIT_MS`) and, failing that, is
 *   reported like any recording that did not play: never silently dropped.
 *
 * The decoded buffers follow the element pool's scoping: each screen's pool
 * holds at most its limit of buffers (oldest out first), a screen's buffers
 * are dropped when it unmounts (speak.ts tells `poolsChanged`), and a clip
 * played with no pool claimed is dropped the moment any screen comes or
 * goes. Over all of them, a cap in BYTES (`MAX_BUFFER_BYTES`) as a backstop.
 * The fetched bytes stay in the word player's small memo, so a word heard
 * again is decoded again without a second fetch.
 *
 * iOS. Web Audio under WebKit's default ('auto') session is ambient: the
 * ring/silent switch mutes it, and build 61 lost every word after the first
 * (DECISIONS.md 2026-09-06). A category set by the app (AppDelegate) does not
 * reach WKWebView, whose audio runs in another process and is categorised by
 * WebKit itself (build 61 set .playback there and nothing changed). What
 * WebKit does honour is the page's Audio Session API (iOS 16.4+):
 * `navigator.audioSession.type = 'playback'`, the category a media element
 * already gets, set when this player is first used. A context that is
 * suspended or 'interrupted' (a call, the lock screen, another app's audio)
 * is resumed on the next gesture anywhere, and when the app comes back to
 * the foreground.
 */
import { getAudioContext } from './audioContext'
import { diagNotePlay, setDiagWebAudioProbe } from './diagnostics/recorder'
import {
  clipStartAt,
  createWordPlayer,
  currentWordPool,
  loadBakedClip,
  reportAudioFailure,
  spokenArticleOf,
  type AudioFailure,
  type ClipLoad,
  type PlaybackSource,
  type WordAudioPorts,
} from './speak'
import { useSettings } from '../stores/settingsStore'
import { diagSwitch } from './diagnostics/switches'

/** Decoded word audio held at once, in bytes of PCM (a one-second mono word at 48 kHz is ~190 KB). */
export const MAX_BUFFER_BYTES = 24 * 1024 * 1024
/**
 * The longest a tap waits for a context that is not running before it gives
 * up and reports. It waits only as long as the resume takes; the cap is for
 * the first word of a launch, when the context was made in that very tap and
 * the audio hardware is still starting (1-2 s in headless Chromium on
 * Windows; a running context is a state check).
 */
export const RESUME_WAIT_MS = 2000

/** A screen's word pool as speak.ts keeps it (`claimWordPool`): read, never changed, here. */
export interface WordPoolScope {
  readonly name: string
  readonly limit: number
  readonly released: boolean
}

/** Everything the Web Audio word player touches that is not its own. */
export interface WebWordEnv {
  /** The screen's word pool readying now (speak.ts `currentWordPool`); none: one unbounded pool. */
  owner?(): WordPoolScope | undefined
  /** The app's one AudioContext, created on first ask. */
  context(): AudioContext | undefined
  load(url: string): Promise<ClipLoad>
  /** The sound setting. */
  wanted(): boolean
  report(failure: AudioFailure): void
  article?(wordId: string): string | undefined
  /** Where the voice starts in a clip, in seconds (speak.ts `clipStartAt`). */
  startAt(url: string): number
  /** A buffer source just started: the drives' event and the performance log. */
  started?(url: string): void
  maxBytes?: number
  resumeWaitMs?: number
}

const bytesOf = (b: AudioBuffer) => b.length * b.numberOfChannels * 4

function abortError(): Error {
  return Object.assign(new Error('superseded by a newer tap'), { name: 'AbortError' })
}

/** The player itself, over an injected environment (the tests hand it a fake context). */
export function createWebWordAudio(env: WebWordEnv) {
  const maxBytes = env.maxBytes ?? MAX_BUFFER_BYTES
  const resumeWaitMs = env.resumeWaitMs ?? RESUME_WAIT_MS
  /** Decoded buffers by the word player's key, oldest first, each with the pool it was readied for. */
  const buffers = new Map<string, { buffer: AudioBuffer; scope: WordPoolScope | undefined }>()
  let bytes = 0
  /** Decodes in flight, so a warm and a tap never decode the same clip twice. */
  const decoding = new Map<string, Promise<AudioBuffer>>()
  /** Bumped by every stop: a play waiting on a decode or a resume gives up. */
  let generation = 0
  let gain: GainNode | undefined
  let gainOf: AudioContext | undefined
  let active: { source: AudioBufferSourceNode; done: () => void } | undefined
  const counts = { decodes: 0, plays: 0, resumes: 0 }

  function drop(key: string): void {
    const had = buffers.get(key)
    if (!had) return
    buffers.delete(key)
    bytes -= bytesOf(had.buffer)
  }

  function keep(key: string, buffer: AudioBuffer, scope: WordPoolScope | undefined): void {
    // A screen that left while its clip was decoding keeps nothing.
    if (scope?.released) return
    drop(key)
    buffers.set(key, { buffer, scope })
    bytes += bytesOf(buffer)
    // The screen's pool holds its limit, oldest out first (the newest stays).
    if (scope) {
      const mine = [...buffers].filter(([, b]) => b.scope === scope).map(([k]) => k)
      for (let i = 0; mine.length - i > Math.max(1, scope.limit); i++) drop(mine[i]!)
    }
    // And all of them their bytes; the newest stays even if it alone is over.
    while (bytes > maxBytes && buffers.size > 1) drop(buffers.keys().next().value as string)
  }

  function bufferFor(key: string, clip: Blob, scope: WordPoolScope | undefined): Promise<AudioBuffer> {
    const have = buffers.get(key)
    if (have) {
      // Most recently heard goes to the back of the line.
      buffers.delete(key)
      buffers.set(key, have)
      return Promise.resolve(have.buffer)
    }
    const pending = decoding.get(key)
    if (pending) return pending
    const ctx = env.context()
    if (!ctx) return Promise.reject(new Error('no AudioContext'))
    counts.decodes++
    const job: Promise<AudioBuffer> = clip
      .arrayBuffer()
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        keep(key, buffer, scope)
        return buffer
      })
      .finally(() => {
        if (decoding.get(key) === job) decoding.delete(key)
      })
    decoding.set(key, job)
    return job
  }

  /** Ask a context that is not running to run. Never rejects. */
  function resume(ctx: AudioContext): Promise<void> {
    if (ctx.state === 'running' || ctx.state === 'closed') return Promise.resolve()
    counts.resumes++
    try {
      return ctx.resume().catch(() => undefined)
    } catch {
      return Promise.resolve()
    }
  }

  function output(ctx: AudioContext): GainNode {
    if (!gain || gainOf !== ctx) {
      gain = ctx.createGain()
      gain.connect(ctx.destination)
      gainOf = ctx
    }
    return gain
  }

  function silence(): void {
    generation++
    const was = active
    active = undefined
    if (!was) return
    try {
      was.source.stop()
    } catch {
      // Already ended, or never started.
    }
    // The element path tells `onEnded` on pause; a stopped source's own
    // 'ended' arrives later (or, on some engines, not at all).
    was.done()
  }

  const ports: WordAudioPorts = {
    load: (url) => env.load(url),
    async play(clip, options) {
      const mine = generation
      // A tapped clip not readied yet is kept in the pool of the screen tapped on.
      const buffer = await bufferFor(options.key, clip, env.owner?.())
      if (mine !== generation) throw abortError()
      const ctx = env.context()
      if (!ctx) throw new Error('no AudioContext')
      if (ctx.state !== 'running') {
        await Promise.race([resume(ctx), new Promise<void>((r) => setTimeout(r, resumeWaitMs))])
        if (mine !== generation) throw abortError()
        if ((ctx.state as string) !== 'running') throw new Error(`AudioContext ${ctx.state}`)
      }
      const out = output(ctx)
      out.gain.value = env.wanted() ? 1 : 0
      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (options.playbackRate) source.playbackRate.value = options.playbackRate
      source.connect(out)
      let told = false
      const done = () => {
        if (told) return
        told = true
        if (active?.source === source) active = undefined
        try {
          source.disconnect()
        } catch {
          // Already disconnected.
        }
        options.onEnded?.()
      }
      source.onended = done
      active = { source, done }
      const at = Math.min(env.startAt(options.url), Math.max(0, buffer.duration - 0.01))
      source.start(0, at)
      counts.plays++
      env.started?.(options.url)
    },
    article: env.article ? (id) => env.article?.(id) : undefined,
    owner: env.owner ? () => env.owner?.() : undefined,
    warm(key, _url, clip, ready) {
      // As speak.ts readies an element (`warmElement`): into the pool of the
      // screen that asked, not for one that has gone, and not past what that
      // pool holds in the request that readied it.
      const scope = (ready?.owner as WordPoolScope | undefined) ?? env.owner?.()
      if (scope?.released) return
      if (scope && ready && ready.rank >= scope.limit && !buffers.has(key)) return
      void bufferFor(key, clip, scope).catch(() => undefined)
    },
    stop: silence,
    prime() {
      const ctx = env.context()
      if (ctx) void resume(ctx)
    },
    wanted: () => env.wanted(),
    report: (failure) => env.report(failure),
  }

  const player = createWordPlayer(ports)

  return {
    player,
    /** Inside a gesture: create the context if needed and let it run. */
    prime: () => ports.prime(),
    /** Resume a context that is not running (a gesture, or the app back in front). */
    resumeIfNeeded(): void {
      const ctx = env.context()
      if (ctx && ctx.state !== 'running') void resume(ctx)
    },
    /** Invalidate pending requests and silence what is playing. */
    stop: () => player.stop(),
    /**
     * A screen claimed or gave back its word pool (speak.ts `claimWordPool`):
     * drop the buffers of every pool that is gone, and those played with no
     * pool claimed. The fetched bytes stay.
     */
    poolsChanged(): void {
      for (const [key, { scope }] of [...buffers]) if (!scope || scope.released || scope.name === 'loose') drop(key)
    },
    stats() {
      return { buffers: buffers.size, bytes, ...counts }
    },
  }
}

export type WebWordAudio = ReturnType<typeof createWebWordAudio>

/* ------------------------------------------------------------------ *
 * The browser wiring
 * ------------------------------------------------------------------ */

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

/**
 * Put the page's audio session in the playback category, the one WebKit gives
 * a media element: not muted by the ring/silent switch, and not switched to
 * ambient (and back) as elements start and end. A no-op where the Audio
 * Session API does not exist (Chromium, Android's WebView, iOS before 16.4).
 * Answers whether it was set.
 */
export function setPlaybackSession(nav: AudioSessionNavigator | undefined = typeof navigator === 'undefined' ? undefined : (navigator as AudioSessionNavigator)): boolean {
  const session = nav?.audioSession
  if (!session) return false
  try {
    if (session.type !== 'playback') session.type = 'playback'
    return true
  } catch {
    return false
  }
}

/**
 * The gestures a browser lets a context start in. pointerdown first (capture,
 * so it runs before the tap's own handler starts a word); touchend and click
 * for a WebKit that counts only the end of a touch; keydown for a keyboard.
 */
export const GESTURE_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'] as const

/**
 * Create and resume the context on the next gesture anywhere, and resume it
 * when the page is shown again. iOS suspends a context ('interrupted') for a
 * call, the lock screen or another app's audio, and a gesture is the one
 * place it can always be resumed. Each call is a state check once the
 * context runs. Answers the uninstaller.
 */
export function installResumeTriggers(
  resumeIfNeeded: () => void,
  win: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> = document,
): () => void {
  const onGesture = () => resumeIfNeeded()
  const onVisible = () => {
    if (doc.visibilityState === 'visible') resumeIfNeeded()
  }
  for (const type of GESTURE_EVENTS) win.addEventListener(type, onGesture, { capture: true, passive: true })
  win.addEventListener('pageshow', onVisible)
  doc.addEventListener('visibilitychange', onVisible)
  return () => {
    for (const type of GESTURE_EVENTS) win.removeEventListener(type, onGesture, { capture: true })
    win.removeEventListener('pageshow', onVisible)
    doc.removeEventListener('visibilitychange', onVisible)
  }
}

/** Say on the window that a clip just started, as speak.ts's player does (`via: 'buffer'`). */
function announce(url: string): void {
  diagNotePlay(Promise.resolve())
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  window.dispatchEvent(new CustomEvent('cluecab-audio', { detail: { url, via: 'buffer' } }))
}

let instance: WebWordAudio | undefined

/** The app's Web Audio word player, made (and wired to the page) on first use. */
function web(): WebWordAudio {
  if (instance) return instance
  const made = createWebWordAudio({
    context: getAudioContext,
    load: loadBakedClip,
    wanted: () => useSettings.getState().sound,
    report: reportAudioFailure,
    article: spokenArticleOf,
    startAt: clipStartAt,
    started: announce,
    owner: currentWordPool,
  })
  instance = made
  setPlaybackSession()
  setDiagWebAudioProbe(() => ({
    state: getAudioContext()?.state ?? 'none',
    session: typeof navigator === 'undefined' ? null : ((navigator as AudioSessionNavigator).audioSession?.type ?? null),
    ...made.stats(),
  }))
  return made
}

/** Whether this page can play words through Web Audio at all. */
function available(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined'
}

/** speak.ts routes the words here unless "Old word-players" is on (`elementWords`). Each never rejects, as there. */
export const webWords = {
  available,
  playWord: (wordId: string, opts?: { slow?: boolean; article?: boolean }): Promise<PlaybackSource> => web().player.playWord(wordId, opts),
  preloadWords: (wordIds: readonly string[], opts?: { slow?: boolean }): Promise<void> => web().player.preloadWords(wordIds, opts).catch(() => {}),
  playClip: (url: string): Promise<PlaybackSource> => web().player.playClip(url),
  preloadClips: (urls: readonly string[]): Promise<void> => web().player.preloadClips(urls).catch(() => {}),
  prime: (): void => {
    setPlaybackSession()
    web().prime()
  },
  /** Silence and invalidate the Web Audio words, if they were ever used. Creates nothing. */
  stop: (): void => instance?.stop(),
  /** A screen claimed or released its word pool (speak.ts `claimWordPool`). Creates nothing. */
  poolsChanged: (): void => instance?.poolsChanged(),
  /** What it holds (tests, drives); undefined until first used. */
  stats: () => instance?.stats(),
}

// The first gesture anywhere makes and resumes the context, whichever screen
// it lands on, so the first word is never the one that has to wait for it.
// Nothing at all while the words are on the old element players.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installResumeTriggers(() => {
    if (!diagSwitch('elementWords') && available()) web().resumeIfNeeded()
  })
}
