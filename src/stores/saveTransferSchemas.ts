import { z } from 'zod'
import { CafeFindsSchema, CurriculumProgressSchema, HistoricalEligibilitySchema, PhotoLedgerSchema, SurvivalProgressSchema, TrainRunsSchema } from '../backup/learningSchema'
import { LegacyEvidenceSchema, RecoveryArchiveSchema } from '../backup/recovery'
import { receiptKey, requiredSetKey } from '../progression/identity'
import { markersSchema, parseLedger, parseSessions, tallySchema, wordStatsSchema } from '../progression/storageSchema'
import type { SaveKey } from './saveTransfer'

// No hydrated stores, ACTIVE, content packs or async imports here. Recovery is
// synchronous and precedes all Zustand hydration. A fingerprint authenticates
// nothing: every destination is checked again even with an internally consistent
// journal. Only versions actually emitted by our transaction planners are valid.
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const id = z.string().min(1)
const record = <T extends z.ZodType>(schema: T) => z.record(id, schema)
const course = z.enum(['da', 'de'])
/**
 * These values are written verbatim by recovery, then Zustand's default merge
 * spreads persisted state over the live store.  Keep this boundary strict: a
 * valid-looking extra `reset`/`recordRound`/etc. must not replace an action on
 * the next hydration.  Nested schemas may deliberately be passthrough where a
 * documented historic data record needs it, but the live store envelope and
 * its state shape never may be.
 */
const envelope = <T extends z.ZodType>(version: number, state: T) => z.object({ version: z.literal(version), state }).strict()
export const migrationSchema = z.object({
  version: z.literal(1), migratedAt: count, legacyCreditSource: count.optional(),
  retired: z.boolean().optional(), noticeDismissed: z.boolean().optional(),
  evidence: LegacyEvidenceSchema.optional(), archives: RecoveryArchiveSchema.optional(),
}).strict()
const srs = envelope(7, z.object({ stats: record(wordStatsSchema), games: tallySchema,
  translationPostcards: count, settlementEffects: markersSchema }).strict())
const learningStore = <T extends z.ZodType<{ routeLanguage: string }>>(version: number, progress: T) => envelope(version,
  z.object({ byLanguage: record(progress).refine(entries => Object.entries(entries).every(([key, p]) => key === p.routeLanguage)),
    settlementEffects: markersSchema, settlementMilestones: record(count) }).strict())
const curriculum = learningStore(3, CurriculumProgressSchema)
const survival = learningStore(2, SurvivalProgressSchema)
const streak = envelope(2, z.object({ completedDays: z.record(z.iso.date(), count), settlementEffects: markersSchema }).strict())
const uniqueIds = z.array(id).refine(ids => new Set(ids).size === ids.length)
const associations = envelope(2, z.object({ groups: record(z.object({ ids: uniqueIds,
  by: z.enum(['player', 'ai']), count, lastAt: count })).refine(groups => Object.entries(groups).every(([key, group]) =>
    group.ids.length >= 2 && group.ids.length <= 4 && key === [...group.ids].sort().join('|'))),
  traps: record(uniqueIds), settlementEffects: markersSchema }).strict())
// This journal never writes a live game cache: replace/reset invalidates it and
// the separately validated durable sessions are authoritative. Do not admit
// arbitrary historical game envelopes merely because Zustand once used them.
const gameReset = envelope(17, z.object({ game: z.null(), parked: z.null(), legacySave: z.null(),
  attemptId: z.null(), attemptOrigin: z.null(), activeSlot: z.null(), roundRecorded: z.literal(false),
  reviewRoundId: z.null(), sentenceReview: z.null() }).strict())
const daily = envelope(1, z.object({ outcome: z.enum(['won', 'lost', 'redeemed']).nullable(), settlementEffects: markersSchema }).strict())
const guidanceBeat = z.enum(['pending', 'announced', 'dismissed'])
const reviewQueue = z.object({ version: z.literal(1), roundId: id, queue: z.array(z.object({ wordId: id, targetId: id,
  sentenceId: id, audioId: id, version: count, clueHistoryIndex: count, clueText: z.string(), clueNumber: count })),
  cursor: count, dismissed: z.boolean() }).refine(review => review.cursor <= review.queue.length)
// Runtime projects these fields into the game store. Unlike inert archives,
// unknown properties must not be spread into live state or replace an action.
const sessionRound = z.object({
  reviewRoundId: id.nullable(), sentenceReview: reviewQueue.nullable(),
  roundGuidance: z.object({ opening: guidanceBeat, playerClueTurn: count.nullable(), lastChance: guidanceBeat.optional(),
    translation: guidanceBeat.optional(), packing: guidanceBeat.optional() }).nullable(),
  gameLanguage: course, gameUiLanguage: z.enum(['en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl']),
  boardCityIndex: count, authoredBoardId: id.nullable(), boardCertification: z.enum(['authored-cycle', 'hard-certified', 'local-fallback', 'not-applicable']),
  roundRecorded: z.boolean(), dailyKey: z.string().nullable(), mode: z.enum(['normal', 'wrapup', 'tutorial']),
  packed: uniqueIds, packingTranslated: uniqueIds, packingMissed: uniqueIds, packingDone: z.boolean(), wrappable: uniqueIds,
  newlyLearned: uniqueIds, newlyDiscovered: uniqueIds, earnedPostcard: z.boolean(), earnedPerfectRound: z.boolean(),
}).partial().strict()

function validateJourney(value: unknown): void {
  // Legacy migration preserves the source envelope version and historical route
  // facts; old banked/ten-stop formats are still valid, but v7 cannot be {}.
  // Enumerate the retired v1/v2 fields rather than accepting arbitrary state:
  // recovery writes this exact value before the store migration can remove them.
  const outer = z.object({ version: count.max(7), state: z.unknown() }).strict().parse(value)
  const stop = count.max(outer.version < 4 ? 9 : 8)
  const arrivals = z.record(z.string().regex(/^(0|[1-9]\d*)$/).refine(key => Number(key) <= (outer.version < 4 ? 9 : 8)), count)
  // Historical routes can retain a whole old route snapshot (not only a
  // RoutePosition). It is inert data, so accept its documented extras here;
  // the live top-level state below remains strict against action replacement.
  const route = z.object({ cityIndex: stop, arrivedAt: arrivals, furthest: stop.optional() })
  const routes = record(route).refine(entries => Object.keys(entries).every(key => course.safeParse(key).success))
  const state = route.extend({
    banked: record(count).optional(), wrapped: record(count).optional(),
    // Photo marks (journey/wordMarks.ts): optional, a save written before the
    // café world has none. Checked against the same schema the backup file uses.
    photos: PhotoLedgerSchema.optional(),
    // Café finds (journey/cafes.ts): optional in the same way, same schema as the file.
    cafes: CafeFindsSchema.optional(),
    // Train tickets (journey/progress.ts TrainRunFact, CW-07): optional in the same way, same schema family as the file.
    trainRuns: TrainRunsSchema.optional(),
    // v1/v2 values are inert and removed by journey's own migration. They are
    // nevertheless named here so old recovery journals remain supported.
    stamps: z.record(z.string(), count).optional(), trialsSpent: z.record(z.string(), count).optional(),
    activeExam: z.object({ cityIndex: count, wordIds: z.array(id), answers: record(z.string()) }).passthrough().optional(),
    lastPaper: z.array(id).optional(),
    waitingForTrain: z.boolean().optional(), historicalTravelEligibility: HistoricalEligibilitySchema.optional(),
    routeLanguage: course.optional(), parked: routes.optional(), historicalRoutes: routes.optional(),
  }).strict()
  const saved = { ...outer, state: state.parse(outer.state) }
  if (saved.version < 3 && !saved.state.banked) throw new Error('Legacy journey is missing banked words')
  if (saved.version >= 3 && !saved.state.wrapped) throw new Error('Journey is missing wrapped words')
  if (saved.version >= 5 && (!saved.state.routeLanguage || !saved.state.parked)) throw new Error('Journey is missing route state')
  if (saved.version >= 6 && !saved.state.historicalTravelEligibility) throw new Error('Journey is missing historical eligibility')
  if (saved.version >= 7 && !saved.state.historicalRoutes) throw new Error('Journey is missing historical routes')
}

function validateSessions(value: unknown): void {
  const { state } = envelope(1, z.object({ byCourse: record(z.unknown()),
    results: record(z.object({ receiptId: id, reviewRoundId: id.nullable() }).strict()), settlementEffects: markersSchema }).strict()).parse(value)
  for (const [language, value] of Object.entries(state.byCourse)) {
    course.parse(language)
    const sessions = parseSessions(value)
    if (sessions.continuation.requiredSet.courseId !== language) throw new Error('Invalid continuation course')
    for (const slot of [sessions.primary, sessions.replay]) {
      if (!slot) continue
      const round = (slot as typeof slot & { round?: unknown }).round
      if (round !== undefined) {
        const parsedRound = sessionRound.parse(round)
        if (parsedRound.sentenceReview && parsedRound.sentenceReview.roundId !== slot.reviewRoundId) throw new Error('Invalid session review owner')
      }
      if (slot.board.courseId !== language || slot.board.cityId !== sessions.continuation.requiredSet.cityId ||
        slot.lookedUp.some(id => !slot.game.words.some(word => word.wordId === id))) throw new Error('Invalid session course or lookup')
    }
    // Identity encoder also rejects empty/whitespace-only identity components.
    requiredSetKey(sessions.continuation.requiredSet)
  }
  for (const [attempt, result] of Object.entries(state.results)) {
    if (result.receiptId !== receiptKey(attempt)) throw new Error('Invalid session result receipt')
  }
}

export function validateSaveDestination(key: SaveKey, value: unknown): void {
  switch (key) {
    case 'cluecab-srs-v1': srs.parse(value); return
    case 'cluecab-journey-v2': validateJourney(value); return
    case 'cluecab-curriculum-v1': curriculum.parse(value); return
    case 'cluecab-survival-v1': survival.parse(value); return
    case 'cluecab-streak-v1': streak.parse(value); return
    case 'cluecab-associations-v1': associations.parse(value); return
    case 'cluecab-game-v1': gameReset.parse(value); return
    case 'cluecab-progression-sessions-v1': validateSessions(value); return
    case 'cluecab-save-migration-v1': migrationSchema.parse(value); return
    case 'cluecab-settlement-v1': {
      // This store is read through a parser rather than Zustand, but it is
      // still a journal destination. Do not let a parser-stripped top-level
      // property become durable corruption.
      z.object({ schemaVersion: z.literal(1), facts: z.unknown(), settlements: z.unknown(), archived: z.unknown().optional() }).strict().parse(value)
      const ledger = parseLedger(value)
      // The receipt parser validates captured effects/identity/reward consistency;
      // portable lesson schemas additionally validate each evidence record.
      for (const { receipt } of Object.values(ledger.settlements)) if (receipt.lessons) {
        for (const p of [receipt.lessons.curriculum.before, receipt.lessons.curriculum.after]) if (p) CurriculumProgressSchema.parse(p)
        for (const p of [receipt.lessons.survival.before, receipt.lessons.survival.after]) if (p) SurvivalProgressSchema.parse(p)
      }
      return
    }
    default: daily.parse(value) // Key membership/date was checked by writesSchema.
  }
}
