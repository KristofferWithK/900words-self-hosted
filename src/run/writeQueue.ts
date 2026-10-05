/**
 * THE RUN'S DEFERRED WRITES.
 *
 * A right answer used to store its progress inside the animation frame that
 * registered it: the photo mark and the café count in one journey write
 * (zustand persist: the whole `cluecab-journey-v2` stringified and written to
 * localStorage), the daily run count, the device's time zone read afresh
 * (`Intl.DateTimeFormat()`, 78 ms the first time at a 4x CPU throttle). On a
 * phone that was the stutter on every answer (owner, build 122).
 *
 * So the run's results sink (sinkSetup.ts) only queues what an answer means,
 * each entry with its own answer time, and the queue applies the entries a
 * little later, off the frame, in the order they came: several answers in
 * one batch, written once. It is flushed at once, never later, when the run
 * pauses, ends or is left, and when the page is hidden or goes away
 * (`flushWhenHidden`), so nothing is lost when the app is closed or sent to
 * the background mid-run. Each entry is applied exactly once: it leaves the
 * queue before it is applied, and a batch that throws is not retried.
 */

/** Runs `run` later; returns the function that cancels it. */
export type Schedule = (run: () => void) => () => void

/**
 * How long after an answer its progress is written: clear of the frames
 * around the answer (the owner's ±200 ms), and well before the next gate,
 * which is at least 1.75 s away at the run's top speed.
 */
export const WRITE_AFTER_MS = 260

/** The schedule the app uses: a plain timer, `ms` after the first entry of a batch. */
export function after(ms: number): Schedule {
  return (run) => {
    const id = setTimeout(run, ms)
    return () => clearTimeout(id)
  }
}

export interface WriteQueue<T> {
  /** Queue an entry; the batch is applied when the schedule runs, or at the next `flush`. */
  push(entry: T): void
  /** Apply everything queued now, in order. Does nothing when the queue is empty. */
  flush(): void
  /** Entries waiting. */
  readonly size: number
}

/**
 * A queue whose entries are applied in batches by `apply`. One schedule per
 * batch: the first entry starts it, later entries ride along. `apply` may
 * queue more entries; they make the next batch.
 */
export function createWriteQueue<T>(apply: (batch: readonly T[]) => void, schedule: Schedule = after(WRITE_AFTER_MS)): WriteQueue<T> {
  let items: T[] = []
  let cancel: (() => void) | null = null
  function flush(): void {
    if (cancel) {
      cancel()
      cancel = null
    }
    if (!items.length) return
    const batch = items
    items = []
    apply(batch)
  }
  return {
    push(entry) {
      items.push(entry)
      if (cancel) return
      let ran = false
      const stop = schedule(() => {
        ran = true
        cancel = null
        flush()
      })
      // A schedule that ran at once leaves nothing to cancel.
      if (!ran) cancel = stop
    },
    flush,
    get size() {
      return items.length
    },
  }
}

/**
 * Flush when the page is hidden (the app sent to the background, the phone
 * locked) or is going away (`pagehide`, `freeze`): a closed app keeps every
 * answer it registered. Returns the function that stops listening.
 */
export function flushWhenHidden(flush: () => void, target: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined = typeof window === 'undefined' ? undefined : window, doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | undefined = typeof document === 'undefined' ? undefined : document): () => void {
  // A test's stand-in window may have no events at all.
  if (typeof target?.addEventListener !== 'function') return () => {}
  if (typeof doc?.addEventListener !== 'function') doc = undefined
  const onHide = () => flush()
  const onVisibility = () => {
    if (doc?.visibilityState === 'hidden') flush()
  }
  target.addEventListener('pagehide', onHide)
  doc?.addEventListener('freeze', onHide)
  doc?.addEventListener('visibilitychange', onVisibility)
  return () => {
    target.removeEventListener('pagehide', onHide)
    doc?.removeEventListener('freeze', onHide)
    doc?.removeEventListener('visibilitychange', onVisibility)
  }
}
