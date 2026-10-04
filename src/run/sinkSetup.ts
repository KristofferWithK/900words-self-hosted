import { recordRunPhotoNow } from '../journey/cafeAccess'
import type { Cafe } from '../journey/cafes'
import { recordCaughtTrainNow } from '../journey/trainTicket'
import { countRun } from '../purchase/dailyGames'
import { setRunResultsSink, type RunPhoto, type RunResult, type RunResultsSink, type RunWalk } from './results'

/**
 * THE REAL RUN RESULTS SINK (card CW-04): where a run's results become the
 * player's progress. Installed once at app start (`installRunResultsSink`,
 * called from src/main.tsx); the run engine and the screen still write to
 * nothing themselves (src/run/results.ts).
 *
 * Per answer, with that answer's own time (never the run's end, so a 23:59
 * answer in a run that ends at 00:02 belongs to the earlier day):
 *
 *  - The run's first answer, right or wrong, counts the run against the daily
 *    two (owner O6, purchase/dailyGames.ts `countRun`). A run left before its
 *    first answer costs nothing. Once per run: the count re-arms at `end`.
 *  - A right answer of the Words walk is a photo of the word
 *    (`useJourney.recordPhotos`, journey/wordMarks.ts): a mark toward
 *    collecting it. A right ARTICLE (the Articles walk) is not a photo of the
 *    word's meaning, the same line results.ts draws for misses, so it marks
 *    nothing: no learning evidence is made up from it.
 *  - A right answer of either walk counts toward the next café
 *    (journey/cafes.ts, both walks find cafés), in the same single journey
 *    write as the photo mark (one save per answer). When one is found,
 *    `onCafeFound` listeners hear it: the screen puts the café on the road
 *    (and, on the first session's walk only, holds the run with "You found a
 *    café"; that UI belongs to the screen cards, not here). The train
 *    run finds no café (`walkFindsCafes`), but its right answers are photos of
 *    the words' meanings like the Words walk's.
 *  - A train run that ends `caught` stores the ticket (card CW-07,
 *    journey/trainTicket.ts): the city's train-run fact, the only way onto
 *    the train. A run that ends any other way stores nothing.
 *
 * Nothing here may throw into the run: a failure to store one fact is caught
 * so the run, and every other fact, carries on.
 */

/** The walks of Sightseeing find cafés (contract §5). Any other run (the train) does not. */
export function walkFindsCafes(walk: RunWalk | string): boolean {
  return walk === 'words' || walk === 'articles'
}

/** A photo that is evidence of knowing a word's meaning: a mark toward collecting it. */
export function photoMarksWord(photo: Pick<RunPhoto, 'kind'>): boolean {
  return photo.kind === 'meaning'
}

/** Heard when a walk photo finds a café. */
export type CafeFoundListener = (cafe: Cafe, photo: RunPhoto) => void

const listeners = new Set<CafeFoundListener>()

/** Listen for cafés found on a walk; returns the function that stops listening. */
export function onCafeFound(listener: CafeFoundListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function quietly(what: string, run: () => void): void {
  try {
    run()
  } catch (error) {
    console.warn(`[run results] ${what} was not stored`, error)
  }
}

export interface ProgressSinkDeps {
  readonly countRun: (at: number) => void
  /**
   * One right answer, in one journey write: `wordId` is the photo mark to
   * record (null for none), `findsCafes` whether it counts toward a café.
   * Returns the café it found, or null.
   */
  readonly recordPhoto: (photo: { readonly wordId: string | null; readonly at: number; readonly findsCafes: boolean }) => Cafe | null
  /** A train run caught its train: store the ticket. Optional so a test may leave it out. */
  readonly catchTrain?: (result: RunResult) => void
}

const appDeps: ProgressSinkDeps = {
  countRun: (at) => countRun(at),
  recordPhoto: (photo) => recordRunPhotoNow(photo),
  catchTrain: (result) => recordCaughtTrainNow(result),
}

/** The sink, with its writers injectable for tests. */
export function createProgressRunResultsSink(deps: ProgressSinkDeps = appDeps): RunResultsSink {
  let counted = false
  const answered = (at: number) => {
    if (counted) return
    counted = true
    quietly('the daily run count', () => deps.countRun(at))
  }
  return {
    photo(photo) {
      answered(photo.at)
      const wordId = photoMarksWord(photo) ? photo.wordId : null
      const findsCafes = walkFindsCafes(photo.walk)
      if (wordId === null && !findsCafes) return
      let cafe: Cafe | null = null
      quietly('a photo', () => {
        cafe = deps.recordPhoto({ wordId, at: photo.at, findsCafes })
      })
      const found = cafe as Cafe | null
      if (found) for (const listener of [...listeners]) quietly('a café-found listener', () => listener(found, photo))
    },
    miss(miss) {
      answered(miss.at)
    },
    end(result) {
      // A run whose answers never reached the sink still counts once (O6).
      if (!counted && result.answered > 0) answered(result.startedAt)
      counted = false
      const catchTrain = deps.catchTrain
      if (result.walk === 'train' && result.end === 'caught' && catchTrain) {
        quietly('the train ticket', () => catchTrain(result))
      }
    },
  }
}

let installed: (() => void) | null = null

/** Plug the progress sink into every run from now on. Idempotent. */
export function installRunResultsSink(): void {
  if (installed) return
  installed = setRunResultsSink(createProgressRunResultsSink())
}
