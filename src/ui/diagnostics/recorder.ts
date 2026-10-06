import { diagSwitch, diagSwitchesOn } from './switches'

/**
 * THE PERFORMANCE LOG (developer-only; Settings, seven taps on the build stamp).
 *
 * Why it exists: on the owner's iPhone every word hit hitches, the hitch grows
 * the longer the app runs, and a cold restart resets it. Desktop Chromium
 * measures nothing growing, and there is no Mac for Safari's inspector. So the
 * phone measures itself: turn this on, play, and send the log back through the
 * share sheet.
 *
 * OFF it costs nothing: no listener, observer, timer or wrapper is installed,
 * and the one-line hooks in the app (`diagHit`, `diagHaptic`) return at once
 * on a module boolean. ON it records:
 *
 *  - every HIT (a Sightseeing answer, a word card pressed or chosen, a wheel
 *    spin; Sightseeing steering separately as `steer`): input delay, handler
 *    time, the first frame after it, the worst frame gap in the 500 ms after
 *    it, and when the haptic was asked for and the audio's play() resolved;
 *  - every 30 s, on every Home visit and at export, a SNAPSHOT of what can
 *    pile up in a long session: media elements and canvases (made, still
 *    alive, canvas pixels), object URLs, localStorage size and setItem cost,
 *    window/document listeners, live timers, animation-frame requests, React
 *    commits, DOM size and (where the browser has it, not WebKit) JS heap.
 *
 * The log is a ring: the last 5,000 events or about 1 MB, whichever is less.
 * Nothing is sent anywhere; the export goes to the owner's own share sheet.
 */

export const REC_KEY = 'cluecab-diag-rec'

const MAX_EVENTS = 5000
const MAX_CHARS = 1_000_000
const SNAP_EVERY_MS = 30_000
const GAP_WINDOW_MS = 500
/** A hit is written once its audio has had time to start. */
const HIT_SETTLE_MS = 1500

export type HitKind = 'answer-right' | 'answer-wrong' | 'article-right' | 'article-wrong' | 'steer' | 'card' | 'card-select' | 'wheel'
/** The hits the summary line counts: the word hits. Steering is logged but not summarised. */
export const WORD_HITS: readonly HitKind[] = ['answer-right', 'answer-wrong', 'article-right', 'article-wrong', 'card', 'card-select', 'wheel']

export interface HitEvent {
  type: 'hit'
  kind: HitKind
  /** Wall clock, ms since 1970. */
  t: number
  /** ms since the app started (performance.now()). */
  up: number
  /** Input event (or, for an answer, the animation frame) to the start of the handler. */
  inputDelay: number | null
  /** Handler start to the end of its synchronous work (and React's render queued by it). */
  handler: number | null
  /** Handler start to the next animation frame. */
  firstFrame: number | null
  /** The longest gap between frames within 500 ms of the hit. */
  worstGap: number | null
  frames: number
  /** Handler start to the haptic being asked for (null: none). */
  haptic: number | null
  /** Handler start to the first media play() call (null: none). */
  playCall: number | null
  /** Handler start to that play() promise resolving. */
  playResolved: number | null
  playFailed?: true
  /** max(worstGap, inputDelay + handler): the one number the summary compares. */
  cost: number
}

export interface SnapEvent {
  type: 'snap'
  reason: 'start' | 'interval' | 'home' | 'export'
  t: number
  up: number
  /** `reloaded`: a new src given to a media element that already had one (an element reused, not made). */
  /** `pool`: the word player's elements loaded now, the emptied ones kept for reuse, and the pool of the screen on top (speak.ts `claimWordPool`). */
  /** `audible`: live elements with a source and not muted, the ones WebKit can offer to Now Playing (src/ui/mediaQuiet.ts); null without WeakRef. */
  audio: { inDocument: number; created: number; alive: number | null; audible: number | null; plays: number; srcSets: number; reloaded: number; pool?: WordPoolSnap }
  /** The Web Audio word player (src/ui/wordAudioWeb.ts, the default for words), once it has been used. */
  webAudio?: WebAudioProbe
  canvas: { created: number; alive: number | null; alivePixels: number | null; toDataURL: number }
  urls: { created: number; revoked: number }
  storage: {
    chars: number
    bytesUtf16: number
    keys: number
    largest: { key: string; chars: number }[]
    setItems: number
    setItemMs: number
    worstSetItem: { key: string; ms: number; chars: number; up: number } | null
    lastSetItems: { key: string; ms: number; chars: number }[]
  }
  listeners: { window: number; document: number; byType: Record<string, number> }
  timers: { timeouts: number; intervals: number; timeoutsMade: number; intervalsMade: number }
  /** requestAnimationFrame calls per second since the previous snapshot. */
  rafPerSecond: number
  /** React commits since launch; null when recording was not on at launch. */
  reactCommits: number | null
  domNodes: number
  memory: { usedJSHeapSize: number; totalJSHeapSize: number } | null
}

export interface MarkEvent {
  type: 'mark'
  t: number
  up: number
  what: string
}

export type DiagEvent = HitEvent | SnapEvent | MarkEvent

// ── state ──────────────────────────────────────────────────────────────────

/** What the word player's element pool holds (speak.ts `wordPoolStats`). */
export interface WordPoolSnap {
  loaded: number
  spare: number
  limit: number
  scope: string
}
let wordPoolProbe: (() => WordPoolSnap) | null = null
/** The word player hands over how to read its pool, so this file need not import it. */
export function setWordPoolProbe(probe: () => WordPoolSnap): void {
  wordPoolProbe = probe
}

let recording = false
let events: DiagEvent[] = []
let sizes: number[] = []
let chars = 0
let startedAt: number | null = null
let startedUp: number | null = null
const listeners = new Set<() => void>()
const eventListeners = new Set<(ev: DiagEvent) => void>()

/** Whether the recorder is installed. The app's hooks read this first. */
export function diagRecording(): boolean {
  return recording
}

const round = (n: number) => Math.round(n * 10) / 10
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function push(ev: DiagEvent): void {
  let size = 200
  try {
    size = JSON.stringify(ev).length + 1
  } catch {
    /* an event is plain data; keep the estimate */
  }
  events.push(ev)
  sizes.push(size)
  chars += size
  while (events.length > MAX_EVENTS || (chars > MAX_CHARS && events.length > 1)) {
    events.shift()
    chars -= sizes.shift() ?? 0
  }
  for (const l of [...eventListeners]) l(ev)
  for (const l of [...listeners]) l()
}

/** Called with every event as it is written (the soak's console stream). */
export function onDiagEvent(listener: (ev: DiagEvent) => void): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function diagEvents(): readonly DiagEvent[] {
  return events
}

export function clearDiagLog(): void {
  events = []
  sizes = []
  chars = 0
  for (const l of [...listeners]) l()
}

/** Called when the log changes (a hit or a snapshot written, cleared). */
export function onDiagLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function diagMark(what: string): void {
  if (!recording) return
  push({ type: 'mark', t: Date.now(), up: round(now()), what })
}

// ── counters, filled by the wrappers below while recording ─────────────────

interface Counters {
  audioCreated: number
  srcSets: number
  reloaded: number
  hadSrc: WeakSet<HTMLMediaElement>
  audioRefs: WeakRef<HTMLElement>[] | null
  canvasCreated: number
  canvasRefs: WeakRef<HTMLCanvasElement>[] | null
  plays: number
  toDataURL: number
  urlsCreated: number
  urlsRevoked: number
  setItems: number
  setItemMs: number
  worstSetItem: { key: string; ms: number; chars: number; up: number } | null
  lastSetItems: { key: string; ms: number; chars: number }[]
  listenerNet: { window: number; document: number }
  byType: Map<string, number>
  timeouts: Set<number>
  intervals: Set<number>
  timeoutsMade: number
  intervalsMade: number
  rafCalls: number
  rafSince: number
}

function freshCounters(): Counters {
  const weak = typeof WeakRef === 'function'
  return {
    audioCreated: 0,
    srcSets: 0,
    reloaded: 0,
    hadSrc: new WeakSet(),
    audioRefs: weak ? [] : null,
    canvasCreated: 0,
    canvasRefs: weak ? [] : null,
    plays: 0,
    toDataURL: 0,
    urlsCreated: 0,
    urlsRevoked: 0,
    setItems: 0,
    setItemMs: 0,
    worstSetItem: null,
    lastSetItems: [],
    listenerNet: { window: 0, document: 0 },
    byType: new Map(),
    timeouts: new Set(),
    intervals: new Set(),
    timeoutsMade: 0,
    intervalsMade: 0,
    rafCalls: 0,
    rafSince: now(),
  }
}

let c: Counters = freshCounters()

// ── React commits: counted through the devtools hook, only if installed
// before React loaded (boot.ts, when recording was on at launch) ──────────

let reactCommits: number | null = null

/**
 * Stand in for React's devtools hook so every commit is counted. Must run
 * before react-dom is evaluated (boot.ts is imported ahead of it in main.tsx).
 * Does nothing if a real devtools hook is there.
 */
export function installReactCommitCounter(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  if (target.__REACT_DEVTOOLS_GLOBAL_HOOK__) return
  reactCommits = 0
  target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberRoot: () => {
      if (reactCommits !== null) reactCommits++
    },
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
  }
}

// ── the wrappers ───────────────────────────────────────────────────────────

interface Patch {
  obj: object
  key: string
  had: boolean
  value: unknown
}
let patches: Patch[] = []

function patch(obj: object, key: string, value: unknown): void {
  const rec = obj as Record<string, unknown>
  patches.push({ obj, key, had: Object.prototype.hasOwnProperty.call(obj, key), value: rec[key] })
  rec[key] = value
}

/** Wrap an accessor property (defineProperty), put back by `unpatchAll`. */
function patchProperty(obj: object, key: string, desc: PropertyDescriptor): void {
  const before = Object.getOwnPropertyDescriptor(obj, key)
  Object.defineProperty(obj, key, desc)
  propertyPatches.push(() => {
    if (before) Object.defineProperty(obj, key, before)
    else delete (obj as Record<string, unknown>)[key]
  })
}
let propertyPatches: (() => void)[] = []

function unpatchAll(): void {
  for (const p of patches.reverse()) {
    const rec = p.obj as Record<string, unknown>
    if (p.had) rec[p.key] = p.value
    else delete rec[p.key]
  }
  patches = []
  for (const undo of propertyPatches.reverse()) undo()
  propertyPatches = []
}

/** The originals, captured at install, for the recorder's own timers and frames. */
let raw: {
  setTimeout: typeof setTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  raf: typeof requestAnimationFrame
} | null = null

function trackMedia(el: HTMLElement): void {
  c.audioCreated++
  c.audioRefs?.push(new WeakRef(el))
}

function trackCanvas(el: HTMLCanvasElement): void {
  c.canvasCreated++
  c.canvasRefs?.push(new WeakRef(el))
}

function installWrappers(): void {
  const w = window as unknown as Record<string, unknown> & Window
  const ST = window.setTimeout.bind(window)
  const SI = window.setInterval.bind(window)
  const CT = window.clearTimeout.bind(window)
  const CI = window.clearInterval.bind(window)
  const RAF = window.requestAnimationFrame.bind(window)
  raw = { setTimeout: ST as typeof setTimeout, setInterval: SI as typeof setInterval, clearInterval: CI as typeof clearInterval, raf: RAF }

  // Media elements and canvases: made, and still alive (weakly held).
  const OrigAudio = window.Audio
  if (typeof OrigAudio === 'function') {
    const Wrapped = function (this: unknown, ...args: [string?]) {
      const el = args.length ? new OrigAudio(args[0]) : new OrigAudio()
      trackMedia(el)
      return el
    } as unknown as typeof Audio
    Wrapped.prototype = OrigAudio.prototype
    patch(w, 'Audio', Wrapped)
  }
  const origCreate = document.createElement
  patch(document, 'createElement', function (this: Document, tag: string, options?: ElementCreationOptions) {
    const el = origCreate.call(this, tag, options)
    const name = typeof tag === 'string' ? tag.toLowerCase() : ''
    if (name === 'audio' || name === 'video') trackMedia(el)
    else if (name === 'canvas') trackCanvas(el as HTMLCanvasElement)
    return el
  })
  if (typeof HTMLCanvasElement !== 'undefined') {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL
    patch(HTMLCanvasElement.prototype, 'toDataURL', function (this: HTMLCanvasElement, ...args: unknown[]) {
      c.toDataURL++
      return (origToDataURL as (...a: unknown[]) => string).apply(this, args)
    })
  }
  if (typeof HTMLMediaElement !== 'undefined') {
    const origPlay = HTMLMediaElement.prototype.play
    patch(HTMLMediaElement.prototype, 'play', function (this: HTMLMediaElement) {
      c.plays++
      const result = origPlay.call(this)
      notePlay(result)
      return result
    })
    // Every new src: on an element that had one before, that element was
    // reused (the word pool since #405) rather than a new one made.
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    if (srcDesc?.set && srcDesc.get) {
      const set = srcDesc.set
      patchProperty(HTMLMediaElement.prototype, 'src', {
        ...srcDesc,
        set(this: HTMLMediaElement, value: string) {
          c.srcSets++
          if (c.hadSrc.has(this)) c.reloaded++
          else c.hadSrc.add(this)
          set.call(this, value)
        },
      })
    }
  }

  // Object URLs.
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const origCreateUrl = URL.createObjectURL
    const origRevokeUrl = URL.revokeObjectURL
    patch(URL, 'createObjectURL', function (obj: Blob | MediaSource) {
      c.urlsCreated++
      return origCreateUrl.call(URL, obj)
    })
    patch(URL, 'revokeObjectURL', function (url: string) {
      c.urlsRevoked++
      return origRevokeUrl.call(URL, url)
    })
  }

  // localStorage writes and what they cost.
  if (typeof Storage !== 'undefined') {
    const origSet = Storage.prototype.setItem
    patch(Storage.prototype, 'setItem', function (this: Storage, key: string, value: string) {
      const s = now()
      try {
        return origSet.call(this, key, value)
      } finally {
        const ms = round(now() - s)
        const len = String(value).length
        c.setItems++
        c.setItemMs = round(c.setItemMs + ms)
        const name = this === window.sessionStorage ? `session:${key}` : key
        c.lastSetItems.push({ key: name, ms, chars: len })
        if (c.lastSetItems.length > 10) c.lastSetItems.shift()
        if (!c.worstSetItem || ms > c.worstSetItem.ms) c.worstSetItem = { key: name, ms, chars: len, up: round(s) }
      }
    })
  }

  // window and document listeners: added minus removed, by type.
  for (const [target, slot] of [[window, 'window'], [document, 'document']] as const) {
    const add = target.addEventListener
    const remove = target.removeEventListener
    patch(target, 'addEventListener', function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
      c.listenerNet[slot]++
      c.byType.set(`${slot}:${type}`, (c.byType.get(`${slot}:${type}`) ?? 0) + 1)
      return add.call(this, type, fn as EventListenerOrEventListenerObject, opts)
    })
    patch(target, 'removeEventListener', function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | EventListenerOptions) {
      c.listenerNet[slot]--
      c.byType.set(`${slot}:${type}`, (c.byType.get(`${slot}:${type}`) ?? 0) - 1)
      return remove.call(this, type, fn as EventListenerOrEventListenerObject, opts)
    })
  }

  // Timers still pending, and how many were made.
  patch(w, 'setTimeout', function (handler: TimerHandler, ms?: number, ...args: unknown[]) {
    if (typeof handler !== 'function') return ST(handler, ms, ...args)
    c.timeoutsMade++
    const id: number = ST(() => {
      c.timeouts.delete(id)
      ;(handler as (...a: unknown[]) => void)(...args)
    }, ms) as unknown as number
    c.timeouts.add(id)
    return id
  })
  patch(w, 'setInterval', function (handler: TimerHandler, ms?: number, ...args: unknown[]) {
    c.intervalsMade++
    const id = SI(handler, ms, ...args) as unknown as number
    c.intervals.add(id)
    return id
  })
  patch(w, 'clearTimeout', function (id?: number) {
    if (id !== undefined) {
      c.timeouts.delete(id)
      c.intervals.delete(id)
    }
    return CT(id)
  })
  patch(w, 'clearInterval', function (id?: number) {
    if (id !== undefined) {
      c.intervals.delete(id)
      c.timeouts.delete(id)
    }
    return CI(id)
  })
  patch(w, 'requestAnimationFrame', function (cb: FrameRequestCallback) {
    c.rafCalls++
    return RAF(cb)
  })
}

// ── hits ───────────────────────────────────────────────────────────────────

interface OpenHit {
  ev: HitEvent
  start: number
}
/** The latest hit, while its haptic and audio can still be attributed to it. */
let open: OpenHit | null = null

/** A timestamp from an input event, on performance.now()'s clock, or null if it is not one. */
function eventTime(ts: number | null | undefined, start: number): number | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null
  // Very old engines stamp events with the wall clock.
  const t = ts > 1e12 && typeof performance !== 'undefined' ? ts - performance.timeOrigin : ts
  if (t > start + 1 || t < start - 10_000) return null
  return t
}

function frameTime(): number | null {
  const tl = typeof document !== 'undefined' ? (document.timeline as { currentTime?: unknown } | undefined) : undefined
  const t = tl?.currentTime
  return typeof t === 'number' ? t : null
}

/**
 * Open a hit. `inputTs` is the input event's timeStamp; omitted, the current
 * animation frame's time is used (a Sightseeing answer happens inside the
 * frame loop). `endsAtDispatch`: the caller measures the handler's end itself
 * (`endHitDispatch`), as the capture/bubble listener pair below does.
 */
export function beginHit(kind: HitKind, inputTs?: number | null, endsAtDispatch = false): OpenHit | null {
  if (!recording || !raw) return null
  const start = now()
  const input = eventTime(inputTs === undefined ? frameTime() : inputTs, start)
  const ev: HitEvent = {
    type: 'hit',
    kind,
    t: Date.now(),
    up: round(start),
    inputDelay: input === null ? null : round(start - input),
    handler: null,
    firstFrame: null,
    worstGap: null,
    frames: 0,
    haptic: null,
    playCall: null,
    playResolved: null,
    cost: 0,
  }
  const hit: OpenHit = { ev, start }
  open = hit
  if (!endsAtDispatch) queueMicrotask(() => endHandler(hit))
  // A dispatch that never reaches the bubble listener (stopPropagation) still ends.
  raw.setTimeout(() => endHandler(hit), 0)

  // Frame gaps for the next 500 ms, on the recorder's own (unwrapped) frames.
  let last = input ?? start
  const RAF = raw.raf
  const tick = (t: number) => {
    if (ev.firstFrame === null) ev.firstFrame = round(t - start)
    ev.worstGap = round(Math.max(ev.worstGap ?? 0, t - last))
    ev.frames++
    last = t
    if (t - start < GAP_WINDOW_MS && recording) RAF(tick)
  }
  RAF(tick)

  raw.setTimeout(() => {
    if (open === hit) open = null
    ev.cost = round(Math.max(ev.worstGap ?? 0, (ev.inputDelay ?? 0) + (ev.handler ?? 0)))
    if (recording) push(ev)
  }, HIT_SETTLE_MS)
  return hit
}

function endHandler(hit: OpenHit): void {
  if (hit.ev.handler === null) hit.ev.handler = round(now() - hit.start)
}

/** The bubble half of a pointer hit: its handler ends after React's queued render. */
function endHitDispatch(hit: OpenHit | null): void {
  if (hit) queueMicrotask(() => endHandler(hit))
}

/**
 * The Web Audio word player's start, timed like an element's play(): it has
 * no media element for the patch above to see. `result` resolves when the
 * buffer source has been started.
 */
export function diagNotePlay(result: Promise<void>): void {
  notePlay(result)
}

/** What a snapshot reads off the Web Audio word player. */
export interface WebAudioProbe {
  /** The AudioContext's state: 'running', 'suspended', 'interrupted' (iOS) or 'closed'. */
  state: string
  /** `navigator.audioSession.type` (WebKit's Audio Session API), or null where the page has none. */
  session: string | null
  buffers: number
  bytes: number
  decodes: number
  plays: number
  /** Times the player found the context not running and asked it to resume. */
  resumes: number
}

let webAudioProbe: (() => WebAudioProbe) | null = null

/** Set by the Web Audio word player when it starts, so snapshots carry its state. */
export function setDiagWebAudioProbe(probe: (() => WebAudioProbe) | null): void {
  webAudioProbe = probe
}

function notePlay(result: Promise<void> | undefined): void {
  const hit = open
  if (!hit || hit.ev.playCall !== null) return
  if (now() - hit.start > HIT_SETTLE_MS) return
  hit.ev.playCall = round(now() - hit.start)
  void result?.then(
    () => {
      hit.ev.playResolved = round(now() - hit.start)
    },
    () => {
      hit.ev.playFailed = true
    },
  )
}

/**
 * THE HOOK for the haptics: called where every haptic is asked for
 * (feedback.ts). Notes the time on the open hit, and answers whether the
 * "No haptics" switch is on (the caller then skips the haptic).
 */
export function diagHaptic(): boolean {
  const hit = open
  if (recording && hit && hit.ev.haptic === null && now() - hit.start < HIT_SETTLE_MS) {
    hit.ev.haptic = round(now() - hit.start)
  }
  return diagSwitch('haptics')
}

/**
 * THE HOOK for a right Sightseeing answer: an article gate or a meaning gate,
 * read from the gate the run just resolved (the last resolved one on the road).
 */
export function diagAnswer(right: boolean, run: { readonly state: { readonly gates: readonly { readonly resolved: boolean; readonly kind: string }[] } } | null): void {
  if (!recording) return
  const gates = run?.state.gates ?? []
  let kind = ''
  for (let i = gates.length - 1; i >= 0; i--) {
    if (gates[i]!.resolved) {
      kind = gates[i]!.kind
      break
    }
  }
  const article = kind === 'article'
  beginHit(right ? (article ? 'article-right' : 'answer-right') : article ? 'article-wrong' : 'answer-wrong')
}

/** THE HOOK for a Sightseeing answer: called from the run's photo and miss events. */
export function diagHit(kind: HitKind): void {
  if (!recording) return
  beginHit(kind)
}

// The pointer hits are seen by two window listeners (capture opens, bubble
// ends), so no component has to know about the recorder.
let pending: OpenHit | null = null

function classify(e: Event): HitKind | null {
  const target = e.target as Element | null
  if (!target || typeof target.closest !== 'function') return null
  if (e.type === 'pointerdown') return target.closest('.word-card') ? 'card' : null
  if (e.type === 'click') {
    if (target.closest('.wheel-disc')) return 'wheel'
    if (target.closest('.word-card.card-guessable')) return 'card-select'
    return null
  }
  if (e.type === 'pointerup') {
    return target.closest('.run-stage') && !target.closest('.run-scrim, .run-pause') ? 'steer' : null
  }
  return null
}

const onCapture = (e: Event) => {
  const kind = classify(e)
  pending = kind ? beginHit(kind, e.timeStamp, true) : null
}
const onBubble = () => {
  endHitDispatch(pending)
  pending = null
}
const HIT_EVENTS = ['pointerdown', 'pointerup', 'click'] as const

// ── snapshots ──────────────────────────────────────────────────────────────

function alive<T extends object>(refs: WeakRef<T>[] | null): T[] | null {
  if (!refs) return null
  const out: T[] = []
  let w = 0
  for (const r of refs) {
    const el = r.deref()
    if (el) {
      out.push(el)
      refs[w++] = r
    }
  }
  refs.length = w
  return out
}

function storageNow(): Pick<SnapEvent['storage'], 'chars' | 'bytesUtf16' | 'keys' | 'largest'> {
  let total = 0
  const all: { key: string; chars: number }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null) continue
      const n = key.length + (localStorage.getItem(key)?.length ?? 0)
      total += n
      all.push({ key, chars: n })
    }
  } catch {
    /* no storage */
  }
  all.sort((a, b) => b.chars - a.chars)
  return { chars: total, bytesUtf16: total * 2, keys: all.length, largest: all.slice(0, 8) }
}

export function snapshot(reason: SnapEvent['reason']): SnapEvent | null {
  if (!recording) return null
  const t = now()
  const media = alive(c.audioRefs)
  const canvases = alive(c.canvasRefs)
  const seconds = Math.max(0.001, (t - c.rafSince) / 1000)
  const rafPerSecond = round(c.rafCalls / seconds)
  c.rafCalls = 0
  c.rafSince = t
  const byType: Record<string, number> = {}
  for (const [k, v] of [...c.byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) if (v !== 0) byType[k] = v
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
  const snap: SnapEvent = {
    type: 'snap',
    reason,
    t: Date.now(),
    up: round(t),
    audio: {
      inDocument: document.getElementsByTagName('audio').length,
      created: c.audioCreated,
      alive: media ? media.length : null,
      audible: media ? media.filter((el) => (el as HTMLMediaElement).muted === false && !!(el.getAttribute('src') || (el as HTMLMediaElement).currentSrc)).length : null,
      plays: c.plays,
      srcSets: c.srcSets,
      reloaded: c.reloaded,
      ...(wordPoolProbe ? { pool: wordPoolProbe() } : {}),
    },
    ...(webAudioProbe ? { webAudio: webAudioProbe() } : {}),
    canvas: {
      created: c.canvasCreated,
      alive: canvases ? canvases.length : null,
      alivePixels: canvases ? canvases.reduce((n, cv) => n + cv.width * cv.height, 0) : null,
      toDataURL: c.toDataURL,
    },
    urls: { created: c.urlsCreated, revoked: c.urlsRevoked },
    storage: {
      ...storageNow(),
      setItems: c.setItems,
      setItemMs: c.setItemMs,
      worstSetItem: c.worstSetItem,
      lastSetItems: [...c.lastSetItems],
    },
    listeners: { window: c.listenerNet.window, document: c.listenerNet.document, byType },
    timers: { timeouts: c.timeouts.size, intervals: c.intervals.size, timeoutsMade: c.timeoutsMade, intervalsMade: c.intervalsMade },
    rafPerSecond,
    reactCommits,
    domNodes: document.getElementsByTagName('*').length,
    memory: mem ? { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize } : null,
  }
  push(snap)
  return snap
}

// ── on and off ─────────────────────────────────────────────────────────────

let teardown: (() => void)[] = []

/** Extra work to run while recording (the screen watcher, the console stream). */
const extras = new Set<() => (() => void) | void>()
export function whileRecording(start: () => (() => void) | void): void {
  extras.add(start)
  if (recording) {
    const stop = start()
    if (stop) teardown.push(stop)
  }
}

export function startRecording(): void {
  if (recording || typeof window === 'undefined') return
  c = freshCounters()
  // Our own listeners first, on the originals, so they are not counted.
  for (const type of HIT_EVENTS) {
    window.addEventListener(type, onCapture, true)
    window.addEventListener(type, onBubble, false)
  }
  installWrappers()
  recording = true
  startedAt = Date.now()
  startedUp = now()
  diagMark('recording on')
  snapshot('start')
  const id = raw!.setInterval(() => snapshot('interval'), SNAP_EVERY_MS)
  teardown.push(() => raw?.clearInterval(id))
  for (const start of extras) {
    const stop = start()
    if (stop) teardown.push(stop)
  }
}

export function stopRecording(): void {
  if (!recording) return
  diagMark('recording off')
  for (const stop of teardown.reverse()) stop()
  teardown = []
  recording = false
  open = null
  pending = null
  unpatchAll()
  for (const type of HIT_EVENTS) {
    window.removeEventListener(type, onCapture, true)
    window.removeEventListener(type, onBubble, false)
  }
  raw = null
}

/** Turn recording on or off, and remember it for the next launch. */
export function setRecording(on: boolean): void {
  try {
    if (on) localStorage.setItem(REC_KEY, '1')
    else localStorage.removeItem(REC_KEY)
  } catch {
    /* private mode: this launch only */
  }
  if (on) startRecording()
  else stopRecording()
}

export function recordingWanted(): boolean {
  try {
    return localStorage.getItem(REC_KEY) === '1'
  } catch {
    return false
  }
}

// ── the summary line and the export ────────────────────────────────────────

export interface CostStats {
  n: number
  median: number | null
  worst: number | null
}

function stats(costs: number[]): CostStats {
  if (!costs.length) return { n: 0, median: null, worst: null }
  const sorted = [...costs].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  return { n: sorted.length, median: round(median), worst: round(sorted[sorted.length - 1]!) }
}

export interface DiagSummary {
  hits: number
  steers: number
  first50: CostStats
  last50: CostStats
}

export function summarize(list: readonly DiagEvent[] = events): DiagSummary {
  const hits = list.filter((e): e is HitEvent => e.type === 'hit' && WORD_HITS.includes(e.kind))
  const steers = list.filter((e) => e.type === 'hit' && e.kind === 'steer').length
  return {
    hits: hits.length,
    steers,
    first50: stats(hits.slice(0, 50).map((h) => h.cost)),
    last50: stats(hits.slice(-50).map((h) => h.cost)),
  }
}

export interface DeviceInfo {
  build: string
  testFlight: string
  userAgent: string
  ios: string | null
  screen: { width: number; height: number }
  viewport: { width: number; height: number }
  dpr: number
  upMs: number
}

export function iosVersion(ua: string): string | null {
  const m = /(?:iPhone|iPad|iPod)[^)]*? OS (\d+(?:_\d+)*)/.exec(ua) ?? /CPU OS (\d+(?:_\d+)*)/.exec(ua)
  return m ? m[1]!.replace(/_/g, '.') : null
}

export function deviceInfo(build = '', testFlight = ''): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return {
    build,
    testFlight,
    userAgent: ua,
    ios: iosVersion(ua),
    screen: { width: window.screen?.width ?? 0, height: window.screen?.height ?? 0 },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio ?? 1,
    upMs: Math.round(now()),
  }
}

export const LOG_FORMAT = '900words-perf-log'

export interface DiagLog {
  format: typeof LOG_FORMAT
  version: 1
  exportedAt: string
  device: DeviceInfo
  switches: string[]
  recording: { on: boolean; since: string | null; sinceUpMs: number | null; reactCommitsCounted: boolean }
  summary: DiagSummary
  events: readonly DiagEvent[]
}

/** The whole log as one JSON document (takes an export snapshot first, if recording). */
export function buildDiagLog(build = '', testFlight = ''): DiagLog {
  snapshot('export')
  return {
    format: LOG_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    device: deviceInfo(build, testFlight),
    switches: diagSwitchesOn(),
    recording: {
      on: recording,
      since: startedAt === null ? null : new Date(startedAt).toISOString(),
      sinceUpMs: startedUp === null ? null : Math.round(startedUp),
      reactCommitsCounted: reactCommits !== null,
    },
    summary: summarize(),
    events,
  }
}

/** Tests only. */
export function resetDiagForTests(): void {
  stopRecording()
  clearDiagLog()
  extras.clear()
  reactCommits = null
  startedAt = null
  startedUp = null
}
