import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { CardRole, GameState } from '../engine/types'
import { useSettings } from '../stores/settingsStore'
import { playSfx, playSfxTrack, primeSfx, readySfxTrack, silenceSfx, type SfxTrack } from './sfx'
import { clackSample, loadClackSample, renderClackTrack, wavDataUrl } from './spinTrack'
import { diagHaptic } from './diagnostics/recorder'
import { diagSwitch } from './diagnostics/switches'

/**
 * Small physical responses, with the native bridge where a packaged phone has
 * one and the browser vibration API as the PWA fallback. iOS Safari does not
 * implement navigator.vibrate, which is why the native path is not optional.
 */
const webVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    // Feedback can never be allowed to interrupt the game action it follows.
  }
}

const nativeHaptic = (run: () => Promise<void>, fallback: number | number[]) => {
  if (diagHaptic()) return // performance log: timed, and skipped by its "No haptics" switch
  if (!Capacitor.isNativePlatform()) {
    webVibrate(fallback)
    return
  }
  try {
    void run().catch(() => webVibrate(fallback))
  } catch {
    webVibrate(fallback)
  }
}

/**
 * Wake the Taptic Engine as a finger lands, so the tick that follows on
 * release is not a cold start.
 *
 * @capacitor/haptics builds a new UIImpactFeedbackGenerator for every impact
 * and never calls prepare() on it (Haptics.swift). An engine that has idled
 * for a few seconds, like the one on a board the player has been reading, then
 * starts cold on the tap that needs it. selectionStart() is the plugin's one
 * call that prepares: it makes a selection generator and calls prepare(),
 * which puts the engine itself in its ready state for a few seconds, whichever
 * generator fires next. Called from pointer-down (useTapHaptics), about
 * 80-150ms before the click it is for. At most once a second: the ready state
 * outlasts that, and a flurry of touches should not be a flurry of bridge calls.
 */
let preparedAt = -Infinity
export function prepareHaptics(): void {
  if (!Capacitor.isNativePlatform()) return
  if (diagSwitch('haptics')) return // performance log switch
  const now = performance.now()
  if (now - preparedAt < 1000) return
  preparedAt = now
  try {
    void Haptics.selectionStart().catch(() => undefined)
  } catch {
    // Warming is an enhancement; the tap it precedes must go on regardless.
  }
}

/** A quiet tick for an ordinary enabled tap target. */
export function tapHaptic(): void {
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 10)
}

/**
 * The tap target that already ticked as the finger landed, so the click
 * that follows it does not tick a second time (useTapHaptics).
 */
let pressed: { target: Element; at: number } | null = null

/**
 * The same tick, given the moment a finger LANDS on a target rather than
 * when it lifts (owner, build 122: "a delay between me touching the card and
 * feeling the vibration"). A word card says its word on pointer-down, and its
 * tick now comes with it, first, before the word and before anything the tap
 * changes on screen. The click that follows on the same target is quiet.
 */
export function pressHaptic(target: Element): void {
  pressed = { target, at: performance.now() }
  tapHaptic()
}

/**
 * Whether `target` already ticked at pointer-down for the click now arriving
 * (and so must not tick again). Answers once: the next click ticks as usual.
 */
export function consumePressHaptic(target: Element): boolean {
  const press = pressed
  pressed = null
  return !!press && press.target === target && performance.now() - press.at < 2000
}

/** The existing result buzz, upgraded to real native haptics. */
export function guessResultHaptic(result: CardRole): void {
  nativeHaptic(
    () =>
      result === 'green'
        ? Haptics.impact({ style: ImpactStyle.Light })
        : Haptics.impact({ style: ImpactStyle.Heavy }),
    result === 'green' ? 15 : 40,
  )
}

/** A clue is complete only when every word promised by its number was green. */
export function completedClue(game: GameState): boolean {
  const clue = game.clueHistory.at(-1)
  return Boolean(
    clue &&
      clue.guesses.length === clue.number &&
      clue.guesses.every((guess) => guess.result === 'green'),
  )
}

// The three sound effects below play as frozen files on their own media
// elements (sfx.ts); the Web Audio graphs they were synthesized with are
// their specification in sfxSynthesis.ts. They no longer need the shared
// AudioContext, so a context iOS has suspended cannot silence them.

/**
 * Unlock the effects on the Give clue gesture. Casey's guesses — and the
 * blip a wrong one brings — land from a timer later, when no gesture is
 * behind them.
 */
export function primeRewardDing(): void {
  // Priming is an enhancement; the Give clue action must always continue.
  primeSfx()
}

/** The same unlock, ahead of delayed Casey/card feedback. */
export function primeTurnClick(): void {
  primeRewardDing()
}

/** Preserve the light physical response when the turn changes hands. */
export function turnHaptic(): void {
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 12)
}

/** Keep the success haptic for the final correct guess in a clue. */
export function rewardHaptic(): void {
  nativeHaptic(
    () => Haptics.notification({ type: NotificationType.Success }),
    [25, 45, 20],
  )
}

/**
 * The quiet descending blip on a wrong guess — the player's own bystander,
 * Casey's, and a wrong wheel translation (owner, build 87: the miss's voice
 * since the ✕ mark left the cards).
 */
export function guessErrorBlip(): void {
  playSfx('blip')
}

/**
 * One click-clack tick of the spinning wheel. Fired BY the spinner's rAF
 * loop each time a segment boundary crosses the pointer, so the ticks follow
 * the spin's deceleration (owner, 2026-09-18) — not a metronome.
 */
export function wheelSpinTick(): void {
  playSfx('tick')
}

/** A small brass-like ta-ta-daa for a green wheel landing, after the ticks stop. */
export function wheelWinFanfare(): void {
  playSfx('fanfare')
}

/**
 * Casey walks through a café found on the road and collects it (owner,
 * 2026-10-05: "a satisfying sound when someone collects the cafés"). The
 * Sightseeing screen plays it from the run's `cafeReached` event, never from
 * the per-frame drawing; which sound it is, is sfx.ts SFX_FILES `cafe`.
 */
export function cafeCollectSound(): void {
  playSfx('cafe')
}

/**
 * The wheel's clacks for one whole spin, as one track (spinTrack.ts): a clack
 * at each of `timesMs` after `leadMs` of silence. The spinner starts the disc
 * on the track once it is `playing`, so every clack lands on its boundary;
 * `undefined` (sound off, the tick not decoded yet, no media, a device where
 * a track would not start in time) leaves it on the per-clack fallback,
 * `wheelSpinTick`.
 */
export function startWheelClacks(timesMs: readonly number[], leadMs: number, maxWaitMs: number): SfxTrack | undefined {
  const src = clackTrackSrc(timesMs, leadMs)
  return src ? playSfxTrack(src, maxWaitMs) : undefined
}

/**
 * Ready the track of the spin about to happen (the engine's next landing is
 * known before the tap: `nextWheelLanding`), so the tap only presses play.
 * Loads the tick first if it has not been. Quiet; never throws.
 */
export function readyWheelClacks(timesMs: readonly number[], leadMs: number): void {
  if (!useSettings.getState().sound || timesMs.length === 0) return
  void loadClackSample().then(() => {
    const src = clackTrackSrc(timesMs, leadMs)
    if (src) readySfxTrack(src)
  })
}

/** Ready the clack track's tick ahead of the first spin. Quiet; never throws. */
export function prepareWheelClacks(): void {
  void loadClackSample()
}

/** The last track made, by its clack times: the ready and the tap ask for the same one. */
let lastTrack: { key: string; src: string } | undefined

function clackTrackSrc(timesMs: readonly number[], leadMs: number): string | undefined {
  if (!useSettings.getState().sound || timesMs.length === 0) return undefined
  const sample = clackSample()
  if (!sample) return undefined
  const key = `${leadMs}|${timesMs.map((t) => t.toFixed(2)).join(',')}`
  if (lastTrack?.key !== key) lastTrack = { key, src: wavDataUrl(renderClackTrack(sample, timesMs, leadMs)) }
  return lastTrack.src
}

/** The disc is at rest: no fallback clack that started late may sound after it. */
export function silenceWheelTicks(): void {
  silenceSfx('tick')
}
