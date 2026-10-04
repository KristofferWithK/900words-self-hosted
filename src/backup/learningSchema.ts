import { z } from 'zod'
import { cityKey } from '../progression/identity'

// Pure schemas shared by portable files and synchronous pre-hydration recovery.
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const id = z.string().min(1)
const record = <T extends z.ZodType>(schema: T) => z.record(id, schema)
const course = z.enum(['da', 'de'])
const evidence = z.object({
  taskId: id, variantId: id,
  mode: z.enum(['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use']),
  attemptedAt: count, attemptKind: z.enum(['first', 'practice-replay']),
  support: z.object({ english: z.enum(['none', 'visible', 'on-request']), audioReplays: z.union([z.literal(0), z.literal(1), z.literal(2)]), hintUsed: z.boolean() }).strict(),
  comprehension: z.enum(['met', 'not-met', 'not-applicable']), communicativeGoal: z.enum(['met', 'not-met', 'not-applicable']),
  targetSuccess: z.enum(['met', 'not-met']), repair: z.enum(['used', 'missed', 'not-needed']), outcome: z.enum(['complete', 'retry']),
}).strict()
export const CurriculumProgressSchema = z.object({
  routeLanguage: course,
  itemStates: record(z.enum(['locked', 'offered', 'available', 'deferred', 'skipped', 'completed'])),
  evidence: record(z.array(evidence)), dueAt: record(count), activeItemId: id.nullable(),
  sentenceReviewEvidence: record(z.array(z.object({ wordId: id, focusId: id, attemptedAt: count,
    correct: z.boolean(), exposure: z.literal(true), retrieval: z.literal(true) }).strict())),
}).strict()
export const SurvivalProgressSchema = z.object({ routeLanguage: course, exchanges: record(z.object({ unlockedAt: count,
  firstCompletedAt: count.optional(), replayedAt: z.array(count) }).strict()) }).strict()
export const LearningSchema = z.object({ curriculum: record(CurriculumProgressSchema), survival: record(SurvivalProgressSchema) }).strict()
  .refine((value) => [value.curriculum, value.survival].every((entries) => Object.entries(entries).every(([key, p]) => key === p.routeLanguage)))
/**
 * The photo ledger (journey/wordMarks.ts): word id -> local calendar day
 * (`YYYY-MM-DD` in the player's own time zone, owner O5 of 2026-10-04) -> the
 * epoch ms of the first photo of that word on that day. Add-only; writers keep
 * the earliest three days per word. The schema does not enforce that bound
 * (a longer row is harmless and the next merge trims it), only that every
 * day is a real calendar date (`z.iso.date()`, as the streak store uses, so
 * `2026-02-31` is refused) and every time a whole non-negative millisecond.
 * Shared by the portable file and the synchronous save-transfer validator,
 * so one definition says what a stored photo fact is.
 */
export const PhotoLedgerSchema = record(z.record(z.iso.date(), count))
export const HistoricalEligibilitySchema = record(z.literal(true)).refine((value) => Object.keys(value).every((key) => {
  try { const parsed = JSON.parse(key); return Array.isArray(parsed) && parsed.length === 2 && ['da', 'de'].includes(parsed[0]) && cityKey({ courseId: parsed[0], cityId: parsed[1] }) === key } catch { return false }
}))
/** A key that is exactly `cityKey({ courseId, cityId })` for a course this app has. */
const isCityKey = (key: string): boolean => {
  try { const parsed = JSON.parse(key); return Array.isArray(parsed) && parsed.length === 2 && ['da', 'de'].includes(parsed[0]) && cityKey({ courseId: parsed[0], cityId: parsed[1] }) === key } catch { return false }
}
/**
 * Café finds (journey/cafes.ts): city key -> the cafés a walk found (authored
 * board id -> epoch ms of the find) and the photos counted toward the next.
 * Played boards are not here: they are read from the progress facts. One
 * shape, two strictnesses: the synchronous save-transfer validator refuses a
 * key it does not know (`CafeFindsSchema`, the live store's state must never
 * carry one), while the portable file strips it (`CafeFindsFileSchema`), so
 * a file written by a newer build with more in each record still imports.
 */
const cafeFinds = { found: record(count), toward: count }
export const CafeFindsSchema = record(z.object(cafeFinds).strict())
  .refine((value) => Object.keys(value).every(isCityKey))
export const CafeFindsFileSchema = record(z.object(cafeFinds).strip())
  .refine((value) => Object.keys(value).every(isCityKey))
/**
 * Train tickets (journey/progress.ts `TrainRunFact`, card CW-07): city key ->
 * that city's caught train run, naming the same city it is filed under. The
 * same two strictnesses as the café finds: the save-transfer validator
 * refuses a key it does not know (`TrainRunsSchema`), the portable file
 * strips it (`TrainRunsFileSchema`), so a file from a newer build still imports.
 */
const trainRunNumbers = { passed: z.boolean(), at: count, words: count, photos: count, slips: count, allowed: count }
const filedUnderItsCity = (value: Record<string, { city: { courseId: 'da' | 'de'; cityId: string } }>) =>
  Object.entries(value).every(([key, run]) => isCityKey(key) && cityKey(run.city) === key)
export const TrainRunsSchema = record(z.object({ city: z.object({ courseId: course, cityId: id }).strict(), ...trainRunNumbers }).strict())
  .refine(filedUnderItsCity)
export const TrainRunsFileSchema = record(z.object({ city: z.object({ courseId: course, cityId: id }).strip(), ...trainRunNumbers }).strip())
  .refine(filedUnderItsCity)
