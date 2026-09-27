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
export const HistoricalEligibilitySchema = record(z.literal(true)).refine((value) => Object.keys(value).every((key) => {
  try { const parsed = JSON.parse(key); return Array.isArray(parsed) && parsed.length === 2 && ['da', 'de'].includes(parsed[0]) && cityKey({ courseId: parsed[0], cityId: parsed[1] }) === key } catch { return false }
}))
