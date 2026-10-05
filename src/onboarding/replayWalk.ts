import { cafeNameForBoard } from '../cafe/cafeName'
import { cafeSetFor } from '../journey/cafeAccess'
import { FIRST_CAFE_PHOTOS, type Cafe } from '../journey/cafes'
import type { LanguageCode } from '../lang/types'
import { ACTIVE } from '../lang/active'
import { setRunResultsSink } from '../run/results'
import { createProgressRunResultsSink } from '../run/sinkSetup'

/**
 * A REPLAYED INTRO (owner, 2026-10-04: "When someone replays the intro they
 * replay the whole intro ... as if someone plays it for the first time").
 * Settings' "Replay the intro" shows every act a first session shows:
 *
 *  - its walk is a demo: it stores no photo, finds no café and is not counted
 *    against the day's two walks (and is never refused for them); a best
 *    score it sets on screen is put back when the walk act goes;
 *  - its café is the city's first café, found on the walk's fifth photo
 *    exactly as a first session finds it, but only for the replay's own
 *    screens: nothing is written;
 *  - its practice is a demo too: dealt fresh, it settles nothing (gameStore
 *    `tutorialDemo`);
 *  - its café puzzle is real play ("phase 2 of the intro is a full game where
 *    at the end the stamp system gets explained"): dealt fresh as the first
 *    café (src/ui/introRound.ts `dealReplayBoard`), it records like any café
 *    puzzle, and its finish screen teaches the stamp.
 *
 * A round the player had paused is never offered during the replay, and is
 * there, the same round, when it ends.
 *
 * This module is the walk's half. While a replayed intro's walk act is on
 * screen, the run reports to a sink built from the real one
 * (`createProgressRunResultsSink`, so the "You found a café" hold works the
 * same) whose writers write nothing: no run count, no photo, no café find.
 */

/** Whether this replayed walk has "found" its café. Module state: never stored. */
let found = false
let restore: (() => void) | null = null

/**
 * The walk screen keeps each walk's best photo count under this key
 * (SightseeingScreen.tsx `BEST_KEY`, not exported). A demo walk may beat it
 * on screen; the stored best is put back as it was when the walk act goes.
 */
const WALK_BEST_KEY = 'cluecab-sightseeing-best'
let bestBefore: string | null | undefined

function readBest(): string | null | undefined {
  try {
    return localStorage.getItem(WALK_BEST_KEY)
  } catch {
    return undefined
  }
}

function putBestBack(value: string | null | undefined): void {
  if (value === undefined) return
  try {
    if (value === null) localStorage.removeItem(WALK_BEST_KEY)
    else localStorage.setItem(WALK_BEST_KEY, value)
  } catch {
    // Storage unavailable: then nothing was written either.
  }
}

/** The city's first café, as a first session finds it: the head of the required set. */
export function replayCafe(course: LanguageCode = ACTIVE.code, at: number = Date.now()): Cafe | null {
  const board = cafeSetFor(0, course)?.boards[0]
  return board ? { board, index: 0, state: 'found', foundAt: at } : null
}

/** Its name for Casey's lines and the Café puzzle tag: the Danish proper name, or null. */
export function replayCafeName(course: LanguageCode = ACTIVE.code): string | null {
  return cafeNameForBoard(cafeSetFor(0, course)?.boards[0])
}

/** Whether the replayed walk now on screen found its café. */
export function replayWalkFoundCafe(): boolean {
  return found
}

/** A new replayed walk act: nothing found yet. */
export function startReplayWalk(): void {
  found = false
}

/**
 * Put the demo sink in place for every run from now until the returned
 * function runs. Idempotent: a second call while one is installed changes
 * nothing, so the act may call it while it draws (before the walk screen
 * makes its engine) and again from its effect.
 */
export function installReplayWalkSink(): () => void {
  if (!restore) {
    let toward = 0
    const sink = createProgressRunResultsSink({
      countRun: () => undefined,
      recordPhoto: ({ findsCafes, at }) => {
        if (!findsCafes || found) return null
        toward += 1
        if (toward < FIRST_CAFE_PHOTOS) return null
        const cafe = replayCafe(ACTIVE.code, at)
        found = cafe !== null
        return cafe
      },
    })
    bestBefore = readBest()
    restore = setRunResultsSink(sink)
  }
  return uninstallReplayWalkSink
}

/** Put the real sink back. Safe to call when none is installed. */
export function uninstallReplayWalkSink(): void {
  const back = restore
  restore = null
  if (!back) return
  back()
  putBestBack(bestBefore)
  bestBefore = undefined
}
