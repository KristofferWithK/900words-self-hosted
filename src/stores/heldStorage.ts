import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * A persist storage whose writes can be HELD for a batch of updates and then
 * written once: the last state, stringified and stored a single time, instead
 * of once per update. Outside a hold it writes straight through, exactly as
 * the storage it wraps.
 *
 * The run's results sink holds the journey store's writes while it applies a
 * batch of answers (src/run/sinkSetup.ts), so several photos and café counts
 * are one `cluecab-journey-v2` write (owner, build 122: the stutter on every
 * answer). A read during a hold sees the held state, so nothing reads storage
 * behind what was set.
 */
export interface HoldableStorage<S> {
  /** The storage to hand to `persist`; undefined when there is none (persist then passes through). */
  readonly storage: PersistStorage<S> | undefined
  /** Run `fn` with writes held; the last held write is stored when the outermost hold ends, even if `fn` throws. */
  hold<T>(fn: () => T): T
  /** Writes stored since this storage was made: for tests. */
  readonly writes: number
}

export function holdableStorage<S>(inner: PersistStorage<S> | undefined): HoldableStorage<S> {
  let depth = 0
  let pending: { name: string; value: StorageValue<S> } | null = null
  let writes = 0
  const write = (name: string, value: StorageValue<S>) => {
    writes++
    return inner!.setItem(name, value)
  }
  const storage: PersistStorage<S> | undefined = inner && {
    getItem: (name) => (pending && pending.name === name ? pending.value : inner.getItem(name)),
    setItem: (name, value) => {
      if (depth > 0) {
        pending = { name, value }
        return
      }
      return write(name, value)
    },
    removeItem: (name) => {
      if (pending?.name === name) pending = null
      return inner.removeItem(name)
    },
  }
  return {
    storage,
    hold<T>(fn: () => T): T {
      depth++
      try {
        return fn()
      } finally {
        depth--
        if (depth === 0 && pending) {
          const { name, value } = pending
          pending = null
          void write(name, value)
        }
      }
    },
    get writes() {
      return writes
    },
  }
}
