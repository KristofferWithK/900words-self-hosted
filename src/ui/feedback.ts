import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { CardRole, GameState } from '../engine/types'
import { playSfx, primeSfx } from './sfx'

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

/** A quiet tick for an ordinary enabled tap target. */
export function tapHaptic(): void {
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 10)
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
