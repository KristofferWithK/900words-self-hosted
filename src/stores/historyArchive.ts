import type { LocalSettlement } from '../progression/types'

/**
 * Every settled round in full, kept for research.
 *
 * The settlement ledger is rewritten whole on every settle and lives in
 * localStorage (about 5 MB in the iOS web view), so it keeps only recent rounds
 * in full and shortens older ones to a summary (`archived`). Before a round is
 * shortened, its full receipt is written here, in IndexedDB: not rewritten on
 * every settle, and not bound by the localStorage quota. Backups carry this
 * history, so a player's rounds survive a phone change.
 *
 * Nothing in play reads it. A missing or failing archive only means the ledger
 * keeps its rounds in full, as it did before this existed.
 */
export interface HistoryArchive {
  /** Resolves only once every entry is durably stored (keyed by receipt id). */
  put(entries: readonly LocalSettlement[]): Promise<void>
  all(): Promise<LocalSettlement[]>
}

const DB_NAME = 'cluecab-history-v1'
const STORE = 'receipts'

let shared: HistoryArchive | null | undefined

/** The device's archive, or null where IndexedDB does not exist (tests, SSR). */
export function historyArchive(): HistoryArchive | null {
  if (shared === undefined) shared = typeof indexedDB === 'undefined' ? null : indexedDbHistoryArchive(indexedDB)
  return shared
}

export function indexedDbHistoryArchive(factory: IDBFactory): HistoryArchive {
  let opening: Promise<IDBDatabase> | null = null
  const open = () => opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DB_NAME, 1)
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { opening = null; reject(request.error ?? new Error('History archive did not open')) }
  })
  const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('History archive transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('History archive transaction aborted'))
  })
  return {
    async put(entries) {
      if (!entries.length) return
      const db = await open()
      const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' })
      const store = tx.objectStore(STORE)
      for (const entry of entries) store.put(entry, entry.receipt.receiptId)
      await finished(tx)
    },
    async all() {
      const db = await open()
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).getAll() as IDBRequest<LocalSettlement[]>
      await finished(tx)
      return request.result
    },
  }
}

/** An in-memory archive, for tests and for tools that build saves outside a browser. */
export function memoryHistoryArchive(): HistoryArchive & { readonly entries: Map<string, LocalSettlement> } {
  const entries = new Map<string, LocalSettlement>()
  return {
    entries,
    async put(list) { for (const entry of list) entries.set(entry.receipt.receiptId, structuredClone(entry)) },
    async all() { return [...entries.values()].map((entry) => structuredClone(entry)) },
  }
}
