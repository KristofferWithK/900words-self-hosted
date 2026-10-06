import { Capacitor } from '@capacitor/core'
import { useSettings } from '../stores/settingsStore'
import type { SfxKind } from './sfxSynthesis'
import { diagSwitch } from './diagnostics/switches'
import { watchMedia } from './mediaQuiet'

/**
 * The UI sound effects — wheel tick, error blip, wheel-win fanfare — played
 * as frozen files through their own media elements. (There was a fourth, the
 * suitcase clack on a newly green card; the owner retired it on 2026-09-26 —
 * the green haptic is that moment's whole response now.)
 *
 * They used to be synthesized live on the app's shared AudioContext, and on
 * the owner's iPhone they went silent partway through a session, all of them
 * at once, while the game carried on. That is the failure build 61 found for
 * words ("it plays when I launch the app but then it stops"; `WEB_AUDIO` in
 * speak.ts): WebKit's iOS audio session drops Web Audio when a media element
 * ends or the phone is locked, and a context that is not `running` produced
 * nothing — each effect checked `state !== 'running'` and returned. Words
 * moved to media elements then; the effects move now. The graphs they were
 * synthesized with are kept as their specification in `sfxSynthesis.ts`, and
 * `scripts/render-ui-sfx.mjs` freezes them into `public/audio/ui/`.
 *
 * Nothing here touches the word player. The effects own their elements, so a
 * blip can land on top of a word being spoken without pausing it or taking
 * its element.
 *
 * Unlocking. The native shell needs none — Capacitor sets
 * `mediaTypesRequiringUserActionForPlayback` to none (see selftest.ts) — but
 * a browser grants playback per element, from a gesture. So every element is
 * started-and-stopped, muted, inside a real tap (`primeSfx`): the Give-clue
 * tap ahead of Casey's timer-driven guesses, the wheel tap ahead of its rAF
 * ticks, and — through the one document listener `installSfxUnlock` adds —
 * the first tap after anything that may have revoked it: a launch, a return
 * from the background, or a play the browser refused. Priming is never a
 * one-time flag: it can be spent again for as long as the app runs.
 */

/** Published path of each effect under the app's base, as the render script writes them. */
export const SFX_FILES: Record<SfxKind, string> = {
  tick: 'audio/ui/wheel-tick.wav',
  blip: 'audio/ui/error-blip.wav',
  fanfare: 'audio/ui/wheel-win.wav',
  // Casey walks through a café found on the road. The owner picked -b (stamp
  // "ka-ching", 2026-10-05) over -a (door bell) and -c (cup and chord); all
  // three are rendered (sfxSynthesis.ts CAFE_COLLECT_CANDIDATES), so swapping
  // is this line alone.
  cafe: 'audio/ui/cafe-collect-b.wav',
}

/**
 * Elements per effect. A media element restarted while it is still sounding
 * cuts its own tail off (or, on some WebKits, ignores the restart), so the
 * tick — 50 ms long, fired as often as every ~60 ms at the top of a spin —
 * rotates through four. The others cannot meaningfully overlap themselves;
 * two blips cover a second miss landing inside the first.
 */
const POOL_SIZE: Record<SfxKind, number> = { tick: 4, blip: 2, fanfare: 1, cafe: 1 }

type Pool = { readonly els: HTMLAudioElement[]; next: number }
const pools = new Map<SfxKind, Pool>()
/** True until a gesture has primed the elements, and again after anything that may have revoked that. */
let needsPrime = true
let installed = false

const soundOn = () => useSettings.getState().sound

/**
 * The shell plays without a gesture (see "Unlocking" above), so on a phone
 * there is nothing to prime. Priming there was pure cost, and it landed on
 * the worst possible tap: the first one after a launch or a return from the
 * background. That tap built seven media players and started and stopped each
 * one before its own click, and so before its haptic, could run (owner,
 * 2026-09-30: "the first tap on a board is always slow to react with the
 * vibration and the sound").
 */
const nativeShell = () => Capacitor.isNativePlatform()

/** Where an effect's file is served from — the app's base, then SFX_FILES. */
export function sfxUrl(kind: SfxKind): string {
  return `${import.meta.env.BASE_URL}${SFX_FILES[kind]}`
}

function pool(kind: SfxKind): Pool | undefined {
  const have = pools.get(kind)
  if (have) return have
  if (typeof Audio === 'undefined') return undefined
  const els: HTMLAudioElement[] = []
  try {
    for (let i = 0; i < POOL_SIZE[kind]; i++) {
      const el = new Audio(sfxUrl(kind))
      el.preload = 'auto'
      el.dataset.sfx = kind
      // The fanfare is long enough for Now Playing: when it stops, every
      // resting element is muted (mediaQuiet.ts). Each play unmutes its own.
      watchMedia(el)
      els.push(el)
    }
  } catch {
    // No media here at all. An effect is decoration on a game action that
    // has already happened; it must never be the thing that throws.
    return undefined
  }
  const made = { els, next: 0 }
  pools.set(kind, made)
  return made
}

const idle = (el: HTMLAudioElement) => el.paused || el.ended

/**
 * Inside a real user gesture: let every effect's elements play later without
 * one. Each idle element is started muted and stopped again at once — the
 * start is what the browser records as gesture-made, the stop keeps it
 * silent, and both happen before the gesture ends. An element that is
 * sounding right now is left alone: it is already allowed, and restarting it
 * would cut a tick or a fanfare short. Never throws; safe to call on every tap.
 */
export function primeSfx(): void {
  if (nativeShell()) return
  if (!soundOn()) return
  if (typeof Audio === 'undefined') return
  needsPrime = false
  for (const kind of Object.keys(SFX_FILES) as SfxKind[]) {
    const p = pool(kind)
    if (!p) continue
    // The wheel's clack track rides with the tick: its element is unlocked
    // by the same spin tap that its track will play after.
    const extra = kind === 'tick' ? trackElement() : undefined
    for (const el of extra ? [...p.els, extra] : p.els) {
      if (!idle(el)) continue
      try {
        el.muted = true
        const started = el.play()
        el.pause()
        el.currentTime = 0
        el.muted = false
        // The pause aborts the start; that rejection is the expected outcome.
        void started?.catch(() => undefined)
      } catch {
        el.muted = false
        needsPrime = true
      }
    }
  }
}

/**
 * Listen once, at app start, for the moments priming is needed again: the
 * next real gesture after a launch, after the app returns from the background
 * (a lock screen or a call is where iOS takes audio away), and after a play
 * the browser refused. Capture phase, so a tap is seen even when the control
 * it hit stops propagation.
 */
export function installSfxUnlock(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  if (nativeShell()) {
    // No unlock to wait for. Build the players once the launch has settled,
    // so the first effect only has to start one. Loading does not start the
    // audio session, so music from another app keeps playing until a sound
    // actually plays, as before.
    needsPrime = false
    setTimeout(() => {
      if (!soundOn()) return
      for (const kind of Object.keys(SFX_FILES) as SfxKind[]) pool(kind)
    }, 1500)
    return
  }
  const onGesture = (event: Event) => {
    // A script-dispatched event carries no user activation, so it cannot
    // unlock anything; priming on it would only spend the flag.
    if (needsPrime && event.isTrusted) primeSfx()
  }
  for (const type of ['touchend', 'click', 'keydown'] as const) {
    document.addEventListener(type, onGesture, { capture: true, passive: true })
  }
  const revoke = () => {
    if (document.visibilityState === 'visible') needsPrime = true
  }
  document.addEventListener('visibilitychange', revoke)
  window.addEventListener('pageshow', () => {
    needsPrime = true
  })
}

/**
 * Start one effect now. Takes the next element in the effect's pool, rewinds
 * it and plays it; never waits, never throws, and never touches the word
 * player. A refused start (the browser wants a gesture again) marks the pool
 * for priming on the next tap rather than retrying from here.
 */
export function playSfx(kind: SfxKind): void {
  if (diagSwitch('sfx')) return // performance log switch
  if (!soundOn()) return
  const p = pool(kind)
  if (!p) return
  // Prefer an element that is not sounding; if all are (a fast run of ticks),
  // take the one whose turn it is — the oldest start.
  let pick = p.els.findIndex((el, i) => idle(el) && i >= p.next)
  if (pick < 0) pick = p.els.findIndex(idle)
  if (pick < 0) pick = p.next
  p.next = (pick + 1) % p.els.length
  const el = p.els[pick]!
  try {
    el.muted = false
    el.currentTime = 0
    const started = el.play()
    void started?.catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') needsPrime = true
    })
  } catch {
    needsPrime = true
    return
  }
  if (typeof window !== 'undefined') {
    // The observable a drive listens for, like the word player's `cluecab-audio`.
    window.dispatchEvent(new CustomEvent('cluecab-sfx', { detail: { kind, url: sfxUrl(kind) } }))
  }
}

/**
 * Stop every element of one effect at once. The wheel's per-clack fallback
 * calls it when the disc comes to rest, so a clack that was asked for in time
 * but started late cannot sound after the disc has stopped.
 */
export function silenceSfx(kind: SfxKind): void {
  for (const el of pools.get(kind)?.els ?? []) {
    try {
      if (!el.paused) el.pause()
    } catch {
      // Nothing to silence.
    }
  }
}

/* ------------------------------------------------------------------ *
 * The wheel's clack track (spinTrack.ts)
 * ------------------------------------------------------------------ */

/**
 * One element for the per-spin clack track. It starts life on the tick file,
 * so it can be primed like any other effect element, and is handed each
 * spin's track as a `data:` URL.
 */
let track: HTMLAudioElement | undefined
/** Set once a track failed to load or start in time here: later spins go straight to the fallback. */
let trackBroken = false

function trackElement(): HTMLAudioElement | undefined {
  if (track) return track
  if (typeof Audio === 'undefined') return undefined
  try {
    track = new Audio(sfxUrl('tick'))
    track.preload = 'auto'
    track.dataset.sfx = 'spin'
    // A spin's clack track runs for seconds: when it stops, every resting
    // element is muted (mediaQuiet.ts), so the app leaves Now Playing again.
    watchMedia(track)
  } catch {
    return undefined
  }
  return track
}

/** A clack track that has been asked to start. */
export interface SfxTrack {
  /**
   * True once the track is audibly under way (`playing`, and its clock
   * moving); false if
   * it errored, was refused, or did not get going within the wait, in which
   * case it has already been stopped and the caller falls back.
   */
  readonly started: Promise<boolean>
  /** How far into the track playback is, in ms: what the disc's start lines up with. */
  position(): number
  /** Let the track run out by itself, but cut it after `ms` whatever happens. */
  finish(ms: number): void
  /** Stop it now. */
  stop(): void
}

/**
 * Load a clack track onto the track element ahead of its spin, so the spin's
 * `playSfxTrack` with the same src only has to press play. Loading a 3 s
 * data: WAV took ~280 ms from play() to sound in Chromium; a loaded one
 * starts within a millisecond. Not while the element is sounding.
 */
export function readySfxTrack(src: string): void {
  if (!soundOn() || trackBroken) return
  const el = trackElement()
  if (!el || el.src === src || !idle(el)) return
  try {
    el.src = src
    el.load()
  } catch {
    // The spin will load it itself.
  }
}

/**
 * Start a clack track (a `data:` WAV, see spinTrack.ts) on the track element.
 * `undefined` when there is nothing to start: sound off, no media, or a
 * device where a track already failed to start in time this session.
 */
export function playSfxTrack(src: string, maxWaitMs: number): SfxTrack | undefined {
  if (diagSwitch('sfx')) return undefined // performance log switch
  if (!soundOn() || trackBroken) return undefined
  const el = trackElement()
  if (!el) return undefined
  let settled = false
  let resolveStarted: (ok: boolean) => void = () => {}
  const started = new Promise<boolean>((resolve) => {
    resolveStarted = resolve
  })
  let wait: ReturnType<typeof setTimeout> | undefined
  let cut: ReturnType<typeof setTimeout> | undefined
  const silence = () => {
    try {
      el.pause()
    } catch {
      // Already silent.
    }
  }
  const settle = (ok: boolean) => {
    if (settled) return
    settled = true
    clearTimeout(wait)
    el.removeEventListener('playing', onPlaying)
    el.removeEventListener('error', onError)
    if (!ok) silence()
    resolveStarted(ok)
  }
  // `playing` is the element's word that it has started; the media clock
  // (currentTime) is when the sound actually is under way, and in Chromium it
  // stood at 0 for ~150 ms after `playing`. The disc is started on the clock,
  // so the wait goes on until it moves.
  const onPlaying = () => {
    const moved = () => {
      if (settled) return
      if (el.currentTime > 0) settle(true)
      else setTimeout(moved, 4)
    }
    moved()
  }
  const onError = () => {
    // A data: URL this media stack will not load fails the same way every
    // time; later spins go straight to the fallback.
    trackBroken = true
    settle(false)
  }
  wait = setTimeout(() => {
    // Too slow to be in time with a disc that is waiting for it. Once is
    // enough to know: later spins skip straight to the fallback rather than
    // making the disc wait again.
    trackBroken = true
    settle(false)
  }, maxWaitMs)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('error', onError)
  try {
    el.muted = false
    // A track readied ahead (`readySfxTrack`) is already this src: setting it
    // again would load it again.
    if (el.src !== src) el.src = src
    else if (el.currentTime !== 0) el.currentTime = 0
    const playing = el.play()
    void playing?.catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') needsPrime = true
      settle(false)
    })
  } catch {
    settle(false)
  }
  if (typeof window !== 'undefined') {
    // The observable a drive listens for: one track per spin, not one event per clack.
    window.dispatchEvent(new CustomEvent('cluecab-sfx', { detail: { kind: 'spin', url: 'clack-track' } }))
  }
  return {
    started,
    position: () => (Number.isFinite(el.currentTime) ? el.currentTime * 1000 : 0),
    finish(ms) {
      clearTimeout(cut)
      cut = setTimeout(silence, ms)
    },
    stop() {
      clearTimeout(cut)
      settle(false)
      silence()
    },
  }
}

/** Whether a gesture is owed before the effects can be trusted to play. For tests and the self-test. */
export function sfxNeedsPrime(): boolean {
  return needsPrime
}

/** Forget every element and listener flag — tests only. */
export function resetSfxForTests(): void {
  pools.clear()
  track = undefined
  trackBroken = false
  needsPrime = true
  installed = false
}

