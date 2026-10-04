import { createJSONStorage, persist as zustandPersist, type StateStorage } from 'zustand/middleware'
import { parseLedger } from '../progression/storageSchema'
import { pendingSettlement } from '../progression/settlement'
import type { SettlementLedger } from '../progression/types'
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

/**
 * The last stored ledger string that passed `parseLedger`, and what it proved.
 *
 * Every game-changing update asks `assertSettlementIdle`, and the ledger keeps
 * every round ever played, so validating it afresh each time made taps slower
 * the longer someone played. Validation is a pure function of the stored
 * string: the identical string gets the identical answer, and any other string
 * is validated in full as before. The key is the string itself, not a write
 * counter, because backup restore, save transfer and other tabs write storage
 * directly. A string that fails is never kept, so it throws the same error
 * every time it is read.
 *
 * The ledger is frozen because it is shared: the settlement adapter reads it
 * in place, and hands everyone else a copy (`readLedger`).
 */
let validLedger: { readonly raw: string; readonly ledger: SettlementLedger; readonly pending: boolean } | null = null

export function validatedLedger(raw: string): { readonly ledger: SettlementLedger; readonly pending: boolean } {
  if (validLedger?.raw !== raw) {
    const ledger = deepFreeze(parseLedger(JSON.parse(raw)))
    validLedger = { raw, ledger, pending: pendingSettlement(ledger) !== null }
  }
  return validLedger
}

/**
 * Validate a ledger about to be stored, cache it under the exact string that
 * will be stored, and return that string. The durability read-back then finds
 * it already validated.
 *
 * Receipts `next` shares with the cached ledger, as the very same frozen
 * objects, were validated when they entered it and are not checked again
 * (`parseLedger`'s `known`). Everything else is validated from its JSON form,
 * so the cached value is exactly what `validatedLedger` would make of the
 * stored string.
 */
export function validatedLedgerJson(next: SettlementLedger): string {
  const raw = JSON.stringify(next)
  const known = validLedger?.ledger
  const settlements = Object.fromEntries(Object.entries(next.settlements).map(([key, entry]) =>
    [key, known?.settlements[key] === entry ? entry : JSON.parse(JSON.stringify(entry)) as unknown]))
  const { settlements: _shared, ...rest } = next
  const ledger = deepFreeze(parseLedger({ ...JSON.parse(JSON.stringify(rest)) as object, settlements }, known))
  validLedger = { raw, ledger, pending: pendingSettlement(ledger) !== null }
  return raw
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
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
  if (validatedLedger(raw).pending) throw new Error('Recover pending settlement before changing player state')
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
