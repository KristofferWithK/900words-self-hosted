import { useSettings } from '../stores/settingsStore'
import type { SfxKind } from './sfxSynthesis'

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
}

/**
 * Elements per effect. A media element restarted while it is still sounding
 * cuts its own tail off (or, on some WebKits, ignores the restart), so the
 * tick — 50 ms long, fired as often as every ~60 ms at the top of a spin —
 * rotates through four. The others cannot meaningfully overlap themselves;
 * two blips cover a second miss landing inside the first.
 */
const POOL_SIZE: Record<SfxKind, number> = { tick: 4, blip: 2, fanfare: 1 }

type Pool = { readonly els: HTMLAudioElement[]; next: number }
const pools = new Map<SfxKind, Pool>()
/** True until a gesture has primed the elements, and again after anything that may have revoked that. */
let needsPrime = true
let installed = false

const soundOn = () => useSettings.getState().sound

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
  if (!soundOn()) return
  if (typeof Audio === 'undefined') return
  needsPrime = false
  for (const kind of Object.keys(SFX_FILES) as SfxKind[]) {
    const p = pool(kind)
    if (!p) continue
    for (const el of p.els) {
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

/** Whether a gesture is owed before the effects can be trusted to play. For tests and the self-test. */
export function sfxNeedsPrime(): boolean {
  return needsPrime
}

/** Forget every element and listener flag — tests only. */
export function resetSfxForTests(): void {
  pools.clear()
  needsPrime = true
  installed = false
}

