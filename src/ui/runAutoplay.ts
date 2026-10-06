import type { RunEndReason, RunWalk } from '../run/results'

/**
 * THE NEXT WALK STARTS BY ITSELF (owner, after build 123: "When you lose the
 * game and are on that screen, there should be a timer of maybe 4 seconds,
 * which then auto plays the next round.").
 *
 * After a walk is lost (one wrong word more than it forgives), its run-end
 * panel counts down on its "More sightseeing" tag (it fills, no number) and then starts the next run of
 * the same walk. Any tap on the panel, leaving it, leaving the screen or
 * hiding the app stops the count (SightseeingScreen.tsx). It only counts when
 * another walk may start now: with today's free walks used, the tag leads to
 * the daily limit as before and nothing counts. The train run and the first
 * session's walk never start by themselves.
 */

/** Seconds the run-end panel counts down before the next walk starts. */
export const AUTOPLAY_SECONDS = 4

export interface AutoplayFacts {
  readonly walk: RunWalk
  /** The first session's walk (onboarding). */
  readonly firstWalk: boolean
  /** How the run ended. */
  readonly end: RunEndReason
  /** Whether another walk may start now (purchase/dailyGames.ts `canStartRun`). */
  readonly canStart: boolean
}

/** Whether the run-end panel counts down to the next walk. */
export function autoplaysNext({ walk, firstWalk, end, canStart }: AutoplayFacts): boolean {
  return walk === 'words' && !firstWalk && end === 'second-wrong' && canStart
}

export interface CountdownTimers {
  readonly setTimeout: (run: () => void, ms: number) => unknown
  readonly clearTimeout: (id: unknown) => void
}

const windowTimers: CountdownTimers = {
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
}

/**
 * Count down from `seconds`: `onTick(seconds)` at once, then each second the
 * seconds left (down to 1), and `onDone` when the last second is over.
 * `cancel` stops it for good; after `onDone` or `cancel` nothing more is heard.
 */
export function startCountdown(
  seconds: number,
  onTick: (left: number) => void,
  onDone: () => void,
  timers: CountdownTimers = windowTimers,
): { cancel: () => void } {
  let left = seconds
  let id: unknown = null
  let over = false
  const next = () => {
    id = timers.setTimeout(() => {
      if (over) return
      left--
      if (left > 0) {
        onTick(left)
        next()
      } else {
        over = true
        onDone()
      }
    }, 1000)
  }
  onTick(left)
  next()
  return {
    cancel: () => {
      if (over) return
      over = true
      timers.clearTimeout(id)
    },
  }
}

/** What ends a countdown besides a tap: the app hidden or the page going away. */
export interface CountdownStops {
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
  readonly window: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

/**
 * Stop `cancel`'s countdown when the app is hidden (backgrounded, the phone
 * locked) or the page goes away. Returns the function that stops listening.
 */
export function cancelOnHide(cancel: () => void, on: CountdownStops = { document, window }): () => void {
  const hide = () => {
    if (on.document.visibilityState === 'hidden') cancel()
  }
  on.document.addEventListener('visibilitychange', hide)
  on.window.addEventListener('pagehide', cancel)
  return () => {
    on.document.removeEventListener('visibilitychange', hide)
    on.window.removeEventListener('pagehide', cancel)
  }
}
