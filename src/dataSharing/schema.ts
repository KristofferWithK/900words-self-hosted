import { z } from 'zod'

export const DATA_SHARING_PROTOCOL = 1 as const

const Count = z.number().int().min(0).max(10_000)
const BaseRoundEvent = z.object({
  protocol: z.literal(DATA_SHARING_PROTOCOL),
  eventId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  kind: z.literal('round'),
  at: z.number().int().positive(),
  language: z.enum(['da', 'de']),
  cityIndex: z.number().int().min(0).max(99),
  mode: z.enum(['normal', 'wrapup']),
  result: z.enum(['won', 'lost']),
  reason: z.string().min(1).max(64),
  boardSize: Count,
  turns: Count,
  lookedUpCount: Count,
  packedCount: Count,
  wrappedCount: Count,
  newlyLearnedCount: Count,
  newlyDiscoveredCount: Count,
})

export const DiagnosticRoundEventSchema = BaseRoundEvent.extend({
  sharing: z.literal('diagnostics'),
}).strict()

const LearningExampleSchema = z.object({
  by: z.enum(['player', 'ai']),
  clue: z.string().min(1).max(160),
  number: z.number().int().min(1).max(18),
  guesses: z.array(
    z.object({
      wordId: z.string().min(3).max(80),
      result: z.enum(['green', 'bystander']),
    }).strict(),
  ).max(18),
}).strict()

export const LearningRoundEventSchema = BaseRoundEvent.extend({
  sharing: z.literal('learning'),
  examples: z.array(LearningExampleSchema).max(16),
}).strict()

export const RoundDataEventSchema = z.discriminatedUnion('sharing', [
  DiagnosticRoundEventSchema,
  LearningRoundEventSchema,
])

export type DiagnosticRoundEvent = z.infer<typeof DiagnosticRoundEventSchema>
export type LearningRoundEvent = z.infer<typeof LearningRoundEventSchema>
export type RoundDataEvent = z.infer<typeof RoundDataEventSchema>

export interface RoundDataSource {
  eventId: string
  at: number
  language: 'da' | 'de'
  cityIndex: number
  mode: 'normal' | 'wrapup'
  result: 'won' | 'lost'
  reason: string
  boardSize: number
  lookedUpCount: number
  packedCount: number
  wrappedCount: number
  newlyLearnedCount: number
  newlyDiscoveredCount: number
  clues: Array<{
    by: 'player' | 'ai'
    text: string
    number: number
    guesses: Array<{ wordId: string; result: 'green' | 'bystander' }>
  }>
}

/**
 * Field-level firewall: the diagnostics object is complete before the branch
 * that is allowed to copy player/Casey language is entered.
 */
export function buildRoundDataEvent(
  sharing: 'diagnostics' | 'learning',
  source: RoundDataSource,
): RoundDataEvent {
  const diagnostic: DiagnosticRoundEvent = {
    protocol: DATA_SHARING_PROTOCOL,
    eventId: source.eventId,
    kind: 'round',
    sharing: 'diagnostics',
    at: source.at,
    language: source.language,
    cityIndex: source.cityIndex,
    mode: source.mode,
    result: source.result,
    reason: source.reason,
    boardSize: source.boardSize,
    turns: source.clues.length,
    lookedUpCount: source.lookedUpCount,
    packedCount: source.packedCount,
    wrappedCount: source.wrappedCount,
    newlyLearnedCount: source.newlyLearnedCount,
    newlyDiscoveredCount: source.newlyDiscoveredCount,
  }
  if (sharing === 'diagnostics') return DiagnosticRoundEventSchema.parse(diagnostic)
  return LearningRoundEventSchema.parse({
    ...diagnostic,
    sharing: 'learning',
    examples: source.clues.map((clue) => ({
      by: clue.by,
      clue: clue.text,
      number: clue.number,
      guesses: clue.guesses,
    })),
  })
}
