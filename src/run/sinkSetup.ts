import { recordRunPhotoNow } from '../journey/cafeAccess'
import type { Cafe } from '../journey/cafes'
import { recordCaughtTrainNow } from '../journey/trainTicket'
import { deviceTimeZone, localDayKey, type DayZone } from '../journey/wordMarks'
import { countRun } from '../purchase/dailyGames'
import { holdJourneyWrites } from '../stores/journeyStore'
import { setRunResultsSink, type RunPhoto, type RunResult, type RunResultsSink, type RunWalk } from './results'
import { after, createWriteQueue, flushWhenHidden, WRITE_AFTER_MS, type Schedule } from './writeQueue'

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
 *  - A right meaning on the walk is a photo of the word
 *    (`useJourney.recordPhotos`, journey/wordMarks.ts): a mark toward
 *    collecting it. A right ARTICLE (an article gate) is not a photo of the
 *    word's meaning, the same line results.ts draws for misses, so it marks
 *    nothing: no learning evidence is made up from it.
 *  - Any right answer of the walk, meaning or article, counts toward the next
 *    café (journey/cafes.ts), in the same single journey
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
 *
 * DEFERRED (the app's sink, `installRunResultsSink`; owner, build 122: "there's
 * always a stutter and a freeze when you hit a word"): an answer only queues
 * its facts, each with its own time, and they are written a moment later, off
 * the animation frame, a batch at a time in one journey write
 * (src/run/writeQueue.ts). The queue is flushed at once when the run ends or
 * is left (`end`), when it pauses (`flushRunProgress`) and when the page is
 * hidden or goes away. So a café is found, and its listeners hear it, when the
 * batch is written: a moment after the photo that found it, never inside the
 * frame of the answer.
 */

/** The Sightseeing walk finds cafés (contract §5). Any other run (the train) does not. */
export function walkFindsCafes(walk: RunWalk | string): boolean {
  return walk === 'words'
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
   * record (null for none), `findsCafes` whether it counts toward a café,
   * `zone` the device's time zone when the sink read it for the batch.
   * Returns the café it found, or null.
   */
  readonly recordPhoto: (photo: { readonly wordId: string | null; readonly at: number; readonly findsCafes: boolean; readonly zone?: DayZone }) => Cafe | null
  /** A train run caught its train: store the ticket. Optional so a test may leave it out. */
  readonly catchTrain?: (result: RunResult) => void
  /**
   * Run a batch of writes as one: the app holds the journey's persistence so
   * a batch reaches storage in one write (journeyStore `holdJourneyWrites`).
   */
  readonly batch?: (writes: () => void) => void
  /** The device's time zone, read once per batch. Left out, each write reads it itself. */
  readonly zone?: () => DayZone
}

const appDeps: ProgressSinkDeps = {
  countRun: (at) => countRun(at),
  recordPhoto: (photo) => recordRunPhotoNow(photo),
  catchTrain: (result) => recordCaughtTrainNow(result),
  batch: (writes) => holdJourneyWrites(writes),
  zone: deviceTimeZone,
}

/** What an answer leaves to be written. */
type Pending =
  | { readonly kind: 'count'; readonly at: number }
  | { readonly kind: 'photo'; readonly photo: RunPhoto; readonly wordId: string | null; readonly findsCafes: boolean }

export interface ProgressSinkOptions {
  /**
   * Write later, off the frame of the answer: when this schedule runs, or at
   * the next flush. Left out, every fact is written at once.
   */
  readonly defer?: Schedule
}

/** The progress sink, with the flush that writes whatever its answers left queued. */
export type ProgressRunResultsSink = RunResultsSink & {
  flush(): void
  /** Facts queued and not yet written. */
  readonly pending: number
}

const atOnce: Schedule = (run) => {
  run()
  return () => {}
}

/** The sink, with its writers injectable for tests. */
export function createProgressRunResultsSink(deps: ProgressSinkDeps = appDeps, options: ProgressSinkOptions = {}): ProgressRunResultsSink {
  let counted = false

  function write(batch: readonly Pending[]): void {
    let zone: DayZone
    let zoneRead = false
    const zoneNow = (): DayZone => {
      if (!zoneRead) {
        zoneRead = true
        try {
          zone = deps.zone?.()
        } catch {
          zone = undefined
        }
      }
      return zone
    }
    const found: [Cafe, RunPhoto][] = []
    const all = () => {
      for (const p of batch) {
        if (p.kind === 'count') {
          quietly('the daily run count', () => deps.countRun(p.at))
          continue
        }
        let cafe: Cafe | null = null
        quietly('a photo', () => {
          cafe = deps.recordPhoto({
            wordId: p.wordId,
            at: p.photo.at,
            findsCafes: p.findsCafes,
            ...(deps.zone ? { zone: zoneNow() } : {}),
          })
        })
        const got = cafe as Cafe | null
        if (got) found.push([got, p.photo])
      }
    }
    const batchOf = deps.batch
    if (batchOf) quietly('a batch of run progress', () => batchOf(all))
    else all()
    // Told once the batch is stored, in the order the photos were taken.
    for (const [cafe, photo] of found) for (const listener of [...listeners]) quietly('a café-found listener', () => listener(cafe, photo))
  }

  const queue = createWriteQueue<Pending>(write, options.defer ?? atOnce)

  const answered = (at: number) => {
    if (counted) return
    counted = true
    queue.push({ kind: 'count', at })
  }
  return {
    photo(photo) {
      answered(photo.at)
      const wordId = photoMarksWord(photo) ? photo.wordId : null
      const findsCafes = walkFindsCafes(photo.walk)
      if (wordId === null && !findsCafes) return
      queue.push({ kind: 'photo', photo, wordId, findsCafes })
    },
    miss(miss) {
      answered(miss.at)
    },
    end(result) {
      // A run whose answers never reached the sink still counts once (O6).
      if (!counted && result.answered > 0) answered(result.startedAt)
      counted = false
      // Everything the run's answers left queued is written before its end.
      queue.flush()
      const catchTrain = deps.catchTrain
      if (result.walk === 'train' && result.end === 'caught' && catchTrain) {
        quietly('the train ticket', () => catchTrain(result))
      }
    },
    flush: () => queue.flush(),
    get pending() {
      return queue.size
    },
  }
}

let installed: (() => void) | null = null
let appSink: ProgressRunResultsSink | null = null

/**
 * Plug the progress sink into every run from now on: its writes deferred off
 * the frame (`WRITE_AFTER_MS`), and flushed whenever the page is hidden or
 * goes away. Idempotent.
 */
export function installRunResultsSink(): void {
  if (installed) return
  const sink = createProgressRunResultsSink(appDeps, { defer: after(WRITE_AFTER_MS) })
  appSink = sink
  const unplug = setRunResultsSink(sink)
  const unlisten = flushWhenHidden(() => sink.flush())
  installed = () => {
    unlisten()
    unplug()
  }
}

/** Write whatever the run's answers left queued, now: the run pauses or the screen goes. */
export function flushRunProgress(): void {
  appSink?.flush()
}

/**
 * Do the slow first-time work of a write before the run needs it: the first
 * time zone read builds the device's date formatter (78 ms at a 4x CPU
 * throttle in Chromium, in the frame of the first answer before the writes
 * were deferred). Called when the Sightseeing screen opens, outside any frame
 * of the run.
 */
export function warmRunProgress(): void {
  try {
    localDayKey(Date.now(), deviceTimeZone())
  } catch {
    // Nothing to warm: the write finds out for itself.
  }
}
