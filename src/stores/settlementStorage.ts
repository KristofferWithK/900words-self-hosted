import { createJSONStorage, persist as zustandPersist, type StateStorage } from 'zustand/middleware'
import { parseLedger } from '../progression/storageSchema'
import { pendingSettlement } from '../progression/settlement'
import { hasSaveTransfer, readSaveMigration } from './saveTransfer'

export const SETTLEMENT_KEY = 'cluecab-settlement-v1'
export const SESSION_KEY = 'cluecab-progression-sessions-v1'
export type AtomicStorage = Pick<Storage, 'getItem' | 'setItem'>
export type EffectMarkers = Record<string, string>

// One local writer, including two adapters over the same storage object. No
// promise of cross-tab exclusion: this app must have one active writer.
const writers = new WeakSet<AtomicStorage>()

export function withSettlementWriter<T>(storage: AtomicStorage, action: () => Promise<T>): Promise<T> {
  if (writers.has(storage)) return Promise.reject(new Error('Settlement writer is busy'))
  writers.add(storage)
  return action().finally(() => writers.delete(storage))
}

/** Fail closed on malformed/unavailable storage, before Zustand publishes. */
export function assertSettlementIdle(storage?: AtomicStorage): void {
  const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  if (!target) return // Non-persistent unit tests / SSR retain the legacy API.
  if (hasSaveTransfer(target)) throw new Error('Recover pending save transfer before changing player state')
  readSaveMigration(target)
  if (writers.has(target)) throw new Error('Settlement writer is busy')
  const raw = target.getItem(SETTLEMENT_KEY)
  if (raw === null) return
  const ledger = parseLedger(JSON.parse(raw))
  if (pendingSettlement(ledger)) throw new Error('Recover pending settlement before changing player state')
}

/** Zustand's automatic version migration bypasses the guarded setters. While
 * a save transfer/metadata error is unresolved, permit in-memory projections
 * (including the recovery error UI), but never rewrite their durable originals.
 * The transaction itself writes directly, and a successful retry rehydrates.
 */
export function transferAwareStorage(storage: StateStorage & AtomicStorage): StateStorage {
  const canPersist = () => {
    try { if (hasSaveTransfer(storage)) return false; readSaveMigration(storage); return true }
    catch { return false }
  }
  return {
    getItem: key => storage.getItem(key),
    setItem: (key, value) => { if (canPersist()) return storage.setItem(key, value) },
    removeItem: key => { if (canPersist()) return storage.removeItem(key) },
  }
}

/** Protect legacy actions AND external setState (backup/reset) during recovery.
 * Rehydration itself uses the middleware's original setter; its automatic
 * migration writes are held by transferAwareStorage during save recovery.
 */
export const guardedPersist: typeof zustandPersist = (initializer, options) => zustandPersist((set, get, api) => {
  const externalSet = api.setState
  api.setState = ((...args: unknown[]) => {
    assertSettlementIdle()
    return Reflect.apply(externalSet, undefined, args)
  }) as typeof externalSet
  const guardedSet = ((...args: unknown[]) => {
    assertSettlementIdle()
    return Reflect.apply(set, undefined, args)
  }) as typeof set
  return initializer(guardedSet, get, api)
}, { ...options, storage: options.storage ?? createJSONStorage(() => transferAwareStorage(localStorage)) })

/** New marker default; preserve every existing persisted field. */
export function withEffectMarkers(persisted: unknown): unknown {
  const state = (persisted ?? {}) as Record<string, unknown>
  return { ...state, settlementEffects: state.settlementEffects ?? {} }
}
