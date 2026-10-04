import { z } from 'zod'
import { migrationSchema, validateSaveDestination } from './saveTransferSchemas'

/** A fixed local write-ahead journal, never part of an exported backup. */
export const SAVE_TRANSFER_KEY = 'cluecab-save-transfer-v1'
export const SAVE_MIGRATION_KEY = 'cluecab-save-migration-v1'
export const SAVE_KEYS = [
  'cluecab-srs-v1', 'cluecab-journey-v2', 'cluecab-curriculum-v1',
  'cluecab-survival-v1', 'cluecab-streak-v1', 'cluecab-associations-v1',
  'cluecab-game-v1', 'cluecab-settlement-v1', 'cluecab-progression-sessions-v1', SAVE_MIGRATION_KEY,
] as const
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>
// Validated once per stored string, like the settlement ledger (see
// validatedLedger in settlementStorage.ts); each caller gets its own copy.
let validMigration: { readonly raw: string; readonly value: Partial<z.infer<typeof migrationSchema>> } | null = null
/** Corrupt local metadata is evidence to retain, not permission to guess a
 * new migration or balance. Callers surface the ordinary retryable save error. */
export function readSaveMigration(storage: SaveStorage): Partial<z.infer<typeof migrationSchema>> {
  const raw = storage.getItem(SAVE_MIGRATION_KEY)
  if (raw === null) return {}
  if (validMigration?.raw !== raw) validMigration = { raw, value: migrationSchema.parse(JSON.parse(raw)) }
  return structuredClone(validMigration.value)
}
export type SaveKey = typeof SAVE_KEYS[number] | `cluecab-daily:${string}`
const dailyKeySchema = z.string().regex(/^cluecab-daily:\d{4}-\d{2}-\d{2}$/)
  .refine((key) => z.iso.date().safeParse(key.slice('cluecab-daily:'.length)).success)
  .transform((key) => key as `cluecab-daily:${string}`)
export const isDailySaveKey = (key: string): key is `cluecab-daily:${string}` => dailyKeySchema.safeParse(key).success
// Also records an ambiguous same-page completion (storage can write, then throw).
// Consumers refresh their projections after any attempted destination write.
export let saveTransferRevision = 0
const writesSchema = z.array(z.object({ key: z.union([z.enum(SAVE_KEYS), dailyKeySchema]), value: z.string() }))
  .refine((writes) => new Set(writes.map((write) => write.key)).size === writes.length)
const journalSchema = z.object({ version: z.literal(1), writes: writesSchema, fingerprint: z.string().regex(/^[0-9a-f]{8}$/) })
// Accidental-corruption detection, not authentication. Imported files never
// supply a journal; validated local planners construct every destination value.
function fingerprint(writes: readonly { key: SaveKey; value: string }[]): string {
  const encoded = JSON.stringify(writes)
  let hash = 0x811c9dc5
  for (let index = 0; index < encoded.length; index += 1) hash = Math.imul(hash ^ encoded.charCodeAt(index), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function validateValues(writes: readonly { key: SaveKey; value: string }[]): void {
  for (const { key, value } of writes) validateSaveDestination(key, JSON.parse(value))
}

export function hasSaveTransfer(storage: SaveStorage): boolean {
  const raw = storage.getItem(SAVE_TRANSFER_KEY)
  return raw !== null && raw !== 'null'
}

/** Startup completes this before store hydration. Failure leaves the journal
 * intact and all guarded mutations refused until the same recovery succeeds. */
export function recoverSaveTransfer(storage: SaveStorage): void {
  const raw = storage.getItem(SAVE_TRANSFER_KEY)
  if (raw === null || raw === 'null') return
  const { writes, fingerprint: savedFingerprint } = journalSchema.parse(JSON.parse(raw))
  if (savedFingerprint !== fingerprint(writes)) throw new Error('Save transfer integrity check failed')
  validateValues(writes) // Validate every row before the first destination write.
  saveTransferRevision += 1
  for (const { key, value } of writes) {
    storage.setItem(key, value)
    if (storage.getItem(key) !== value) throw new Error('Save transfer was not durable')
  }
  storage.setItem(SAVE_TRANSFER_KEY, 'null')
  if (hasSaveTransfer(storage)) throw new Error('Save transfer completion was not durable')
}

export function commitSaveTransfer(storage: SaveStorage, writes: { key: SaveKey; value: string }[]): void {
  if (hasSaveTransfer(storage)) throw new Error('Recover the previous save transfer first')
  const checked = writesSchema.parse(writes)
  validateValues(checked)
  const value = JSON.stringify({ version: 1, writes: checked, fingerprint: fingerprint(checked) })
  storage.setItem(SAVE_TRANSFER_KEY, value)
  if (storage.getItem(SAVE_TRANSFER_KEY) !== value) throw new Error('Save transfer intent was not durable')
  recoverSaveTransfer(storage)
}
