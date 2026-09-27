import { z } from 'zod'
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

/** Archival data only: deliberately looser than a playable game, since old
 * terminal formats cannot prove which non-atomic effects reached storage. All
 * fields are enumerated; credentials, URLs and pending requests are stripped. */
const game = z.object({
  phase: z.string(), seed: z.number(), turnsLeft: z.number(),
  config: z.object({ rows: z.number(), cols: z.number(), totalWords: z.number(), greensPerSide: z.number(),
    greenOverlap: z.number(), turnTokens: z.number(), maxNewWordsPerBoard: z.number() }).partial(),
  words: z.array(z.object({ wordId: z.string(), da: z.string().optional(), en: z.array(z.string()).optional(), pos: z.string().optional() })),
  playerKey: z.record(z.string(), z.string()), aiKey: z.record(z.string(), z.string()),
  reveals: z.record(z.string(), z.object({ kind: z.string(), against: z.array(z.string()).optional() })),
  clueHistory: z.array(z.object({ by: z.string(), text: z.string(), number: z.number(),
    guesses: z.array(z.object({ wordId: z.string(), result: z.string() })) })),
  outcome: z.object({ result: z.string(), reason: z.string() }),
  wheel: z.object({ segments: z.array(z.string()), translated: z.array(z.string()), filled: z.array(z.number()).optional(),
    attempts: z.number(), landed: z.number().nullable(), result: z.string().nullable(), spent: z.string().nullable() }),
}).partial()
const round = z.object({
  game: game.nullable().optional(), lookedUp: z.array(z.string()).optional(), roundRecorded: z.boolean().optional(),
  mode: z.string().optional(), gameLanguage: z.string().optional(), gameUiLanguage: z.string().optional(),
  authoredBoardId: z.string().nullable().optional(), boardCityIndex: z.number().optional(), city1BoardCursor: z.number().optional(),
  reviewRoundId: z.string().nullable().optional(), dailyKey: z.string().nullable().optional(),
})
export const LegacyEvidenceSchema = round.extend({ parked: round.optional() })
export const RecoveryArchiveSchema = z.array(z.object({
  id: z.string().min(1), at: count, evidence: LegacyEvidenceSchema,
}))
export type RecoveryArchive = z.infer<typeof RecoveryArchiveSchema>
export const mergeRecovery = (a: RecoveryArchive, b: RecoveryArchive): RecoveryArchive =>
  [...new Map([...a, ...b].map((entry) => [JSON.stringify(entry), entry])).entries()]
    .sort(([a], [b]) => a.localeCompare(b)).map(([, entry]) => entry)
