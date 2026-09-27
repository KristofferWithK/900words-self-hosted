import { earliestByKey, furthestOf, numKeyed, mergeJourney, mergeRouteHistory, type JourneyBackup } from './journey'
export { mergeJourney, mergeRouteHistory, type JourneyBackup } from './journey'
import { UI } from '../i18n'
import { z } from 'zod'
import { CITIES } from '../journey/cities'
import type { LanguageCode } from '../lang/types'
import { LEARN_REPS } from '../journey/progress'
import type { GamesTally } from '../stores/srsStore'
import type { SrsMap, WordStats } from '../srs/types'
import type { ProgressFacts } from '../progression/types'
import { earnedPostcards, LEGACY_CITY } from '../progression/facts'
import { count, emptyLearning, HistoricalEligibilitySchema, LearningSchema, legacyProgress, mergeImportedProgress, mergeLearning, ProgressSchema, type PortableLearning } from './progress'
import { mergeRecovery, RecoveryArchiveSchema, type RecoveryArchive } from './recovery'

/**
 * The collection lives in one phone's localStorage and nowhere else. Clearing
 * site data, reinstalling, or changing phone loses months of work with no
 * warning and no way back — the one irreversible failure in the app. This
 * module is the way out: a single JSON file, and a merge that cannot lose
 * ground.
 *
 * Deliberately NOT exported: the Ollama API key. A backup file gets mailed to
 * yourself and synced to three clouds; a secret must not ride along.
 */
export const BACKUP_FORMAT = 3
// Named for the old title on purpose, like the `app: 'cluecabulary'` literal
// inside the file: a player's existing export is already called this, and a
// file named 900words whose contents say cluecabulary is the confusing pair.
// The import matches on the literal, never on the filename.
export const BACKUP_FILENAME = 'cluecabulary-collection.json'

const WordStatsSchema = z
  .object({
    box: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    lastSeenAt: count,
    seen: count,
    correctGuesses: count,
    misses: count,
    lookups: count,
    redemptionRight: count,
    redemptionWrong: count,
    // Absent from files written before the directional counters existed.
    greenByClue: count.optional(),
    greenByGuess: count.optional(),
  })
  // Same seeding rule as migrateSrs (srsStore.ts): a record the old model
  // called learned restores as collected; anything short arrives with zeroes.
  .transform((s) => ({
    ...s,
    greenByClue: s.greenByClue ?? (s.correctGuesses >= LEARN_REPS ? 1 : 0),
    greenByGuess: s.greenByGuess ?? (s.correctGuesses >= LEARN_REPS ? 1 : 0),
  }))

const TallySchema = z.object({
  played: count,
  won: count,
  redeemed: count,
  lost: count,
})

// Bounded, not just numeric: cityAt throws outside the route, and a restore
// writes this straight into the store, so an out-of-range value would blank
// the app on every load with no way back in.
//
// The bound is the LONGEST route a file could have been written on, not the
// current one, and an index past the current end is clamped to it rather
// than refused. The route had ten stops until Viborg left it (journey store
// v4), and a file exported on that route by someone standing in København
// carries `cityIndex: 9` — a real file, months of progress, which a bound of
// `CITIES.length - 1` answered with "That file is not a 900words backup".
// Clamping is what `journey/rescue.ts` already does for the same data: the
// index is only ever a floor (mergeJourney takes the further of the two), so
// the safe reading of a stop past the end is the end. Junk — a negative, a
// fraction, 99 — is still refused.
const LONGEST_ROUTE = Math.max(CITIES.length, 10)
const CityIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(LONGEST_ROUTE - 1)
  .transform((i) => Math.min(i, CITIES.length - 1))

const JourneySchema = z.object({
  cityIndex: CityIndexSchema,
  wrapped: z.record(z.string(), count),
  arrivedAt: z.record(z.string(), count),
  // The furthest stop reached, which since Travel back can be past
  // `cityIndex`. Optional and not a format bump for the same reason as
  // `language`: every file written before it has none, and an older build
  // reading a newer file drops the key and restores what it always did.
  furthest: CityIndexSchema.optional(),
  historicalTravelEligibility: HistoricalEligibilitySchema.optional(),
  parked: z.partialRecord(z.enum(['da', 'de']), z.object({ cityIndex: CityIndexSchema,
    arrivedAt: z.record(z.string(), count), furthest: CityIndexSchema.optional() })).optional(),
  historicalRoutes: z.partialRecord(z.enum(['da', 'de']), z.object({ cityIndex: CityIndexSchema,
    arrivedAt: z.record(z.string(), count), furthest: CityIndexSchema.optional() })).optional(),
})

/**
 * The journey as format-1 files carry it. Read so an old file still restores
 * in full: banked words become wrapped by the same rule the store migration
 * uses, and the exam economy (stamps, attempts) has nothing to become.
 */
const JourneyV1Schema = z.object({
  cityIndex: CityIndexSchema,
  stamps: z.record(z.string(), z.number()),
  banked: z.record(z.string(), z.number()),
  trialsSpent: z.record(z.string(), z.number()),
  arrivedAt: z.record(z.string(), z.number()),
})

/**
 * Legacy preference compatibility. Backups no longer restore preferences, but
 * older files with a study phase must still restore their progress safely.
 */
const PrefsSchema = z
  .object({
    // Legacy backups may carry the retired study-phase preference. Read and
    // discard it so a restore cannot bring the feature back.
    studyPhase: z.enum(['auto', 'always', 'never']).optional(),
  })
  .transform(() => ({}))

/**
 * The balance under both names. The postcard rename (owner, 2026-09-18) moved
 * the field, but export files already in the wild carry `translationJokers`,
 * and "a newer build refuses your backup" is the one message this panel must
 * never say for a file it can read. So the schema reads either name: the new
 * one wins when both are present (a hand-edited file gets no blending), and a
 * file carrying only the old name — or neither — restores a balance of zero
 * rather than a refusal. The old name is dropped after the read so a parsed
 * file cannot hand the retired word back into the app.
 */
const SrsSchema = z
  .object({
    stats: z.record(z.string(), WordStatsSchema),
    games: TallySchema,
    translationPostcards: count.optional(),
    translationJokers: count.optional(),
  })
  .transform(({ translationJokers, ...srs }) => ({
    ...srs,
    translationPostcards: srs.translationPostcards ?? translationJokers ?? 0,
  }))

/**
 * Which language the journey position in this file is a position ON.
 *
 * Absent from every file written before the seam, and those are all Danish, so
 * it defaults rather than failing. Deliberately NOT a format bump: an older
 * build reading a newer file ignores the extra key and restores exactly what it
 * would have restored anyway, and a format bump would make it refuse the file
 * instead. The field only ever makes a restore MORE careful.
 */
const LanguageSchema = z.enum(['da', 'de']).default('da')

const LegacyBackupSchema = z.object({
  app: z.literal('cluecabulary'),
  format: count,
  exportedAt: count,
  language: LanguageSchema,
  srs: SrsSchema,
  journey: JourneySchema,
  prefs: PrefsSchema,
})
export const BackupSchema = LegacyBackupSchema.extend({
  format: z.literal(3), progress: ProgressSchema, learning: LearningSchema,
  recovery: RecoveryArchiveSchema.default([]),
})

const BackupV1Schema = z.object({
  app: z.literal('cluecabulary'),
  format: z.number(),
  exportedAt: z.number(),
  language: LanguageSchema,
  srs: SrsSchema,
  journey: JourneyV1Schema,
  prefs: PrefsSchema,
})

export type Backup = Omit<z.infer<typeof BackupSchema>, 'format' | 'learning'> & { format: number; learning: PortableLearning }
export type BackupPrefs = z.infer<typeof PrefsSchema>

export interface Snapshot {
  stats: SrsMap
  games: GamesTally
  translationPostcards: number
  journey: JourneyBackup
  prefs: BackupPrefs
  /** The language this device is playing — see `LanguageSchema`. */
  language: LanguageCode
  progress?: ProgressFacts
  learning?: PortableLearning
  recovery?: RecoveryArchive
}

export function buildBackup(s: Snapshot, now: number): Backup {
  const progress = s.progress ?? legacyProgress(s.translationPostcards)
  return BackupSchema.parse({
    app: 'cluecabulary',
    format: BACKUP_FORMAT,
    exportedAt: now,
    language: s.language,
    srs: { stats: s.stats, games: s.games, translationPostcards: earnedPostcards(progress, LEGACY_CITY) },
    progress,
    learning: mergeLearning(emptyLearning(), s.learning ?? emptyLearning()),
    recovery: RecoveryArchiveSchema.parse(s.recovery ?? []),
    journey: {
      cityIndex: s.journey.cityIndex,
      wrapped: { ...s.journey.wrapped },
      arrivedAt: numKeyed(s.journey.arrivedAt),
      ...furthestOf(s.journey),
      historicalTravelEligibility: { ...s.journey.historicalTravelEligibility },
      parked: s.journey.parked ?? {},
      historicalRoutes: s.journey.historicalRoutes ?? {},
    },
    prefs: s.prefs,
  })
}

/**
 * The key only when there is something to say: a position that has never
 * travelled back carries no `furthest`, so a file written from it is
 * byte-identical to one written before the field existed.
 */
export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: string }

/**
 * Parse a file the user chose. Everything here is attacker-adjacent only in the
 * sense that it is unvalidated input from a text file, but a malformed restore
 * would corrupt the collection silently, which is the thing to avoid.
 */
export function parseBackup(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: UI.system.backupNotJson }
  }
  const format = json && typeof json === 'object' && 'format' in json ? json.format : undefined
  if (typeof format === 'number' && format > BACKUP_FORMAT) {
      return {
        ok: false,
        error: UI.system.backupTooNew,
      }
  }
  const parsed = format === BACKUP_FORMAT ? BackupSchema.safeParse(json) : LegacyBackupSchema.safeParse(json)
  if (parsed.success && (format === 1 || format === 2 || format === 3)) {
    const data = parsed.data
    const progress = 'progress' in data ? data.progress as ProgressFacts : legacyProgress(data.srs.translationPostcards)
    const learning = 'learning' in data ? data.learning as PortableLearning : emptyLearning()
    const recovery = 'recovery' in data ? data.recovery as RecoveryArchive : []
    return { ok: true, backup: { ...data, progress, learning, recovery } }
  }
  // Not the current shape — a format-1 file restores upgraded in memory.
  const v1 = BackupV1Schema.safeParse(json)
  if (v1.success && v1.data.format === 1) {
    const { stamps, trialsSpent, banked, ...journey } = v1.data.journey
    void stamps, trialsSpent
    return { ok: true, backup: { ...v1.data, journey: { ...journey, wrapped: banked },
      progress: legacyProgress(v1.data.srs.translationPostcards), learning: emptyLearning(), recovery: [] } }
  }
  const shape =
    json && typeof json === 'object' && 'app' in json ? '' : UI.system.backupMaybeOtherApp
  return { ok: false, error: `${UI.system.backupNotOurs}${shape}` }
}

/**
 * Which of two records for the same word to keep. Whole records, never a
 * field-by-field blend: the fields are internally consistent and mixing them
 * would invent a history that never happened.
 *
 * Collectedness leads the tie-break, because it is now what the collection
 * runs on. Ordered by correctGuesses alone — the old rule — a record with
 * three greens all earned one way could replace one with a green each way,
 * and the merge would quietly un-collect the word.
 */
export function betterRecord(a: WordStats, b: WordStats): WordStats {
  const collected = (s: WordStats) => (s.greenByClue > 0 ? 1 : 0) + (s.greenByGuess > 0 ? 1 : 0)
  if (collected(a) !== collected(b)) return collected(a) > collected(b) ? a : b
  if (a.correctGuesses !== b.correctGuesses) return a.correctGuesses > b.correctGuesses ? a : b
  if (a.seen !== b.seen) return a.seen > b.seen ? a : b
  return a.lastSeenAt >= b.lastSeenAt ? a : b
}

/**
 * Fold a backup into what is already on this device without losing either.
 * Every rule here is chosen so that restoring cannot cost the player anything
 * they had a moment ago:
 *
 * - words keep whichever record knows them better
 * - wrapped words union, keeping the first time each was packed
 * - the furthest city wins
 * - the games tally takes the maximum, so restoring your own file twice does
 *   not double your record
 *
 * Preferences are not merged; a merge is about progress, and the device you are
 * holding should keep its own settings.
 *
 * ── ACROSS LANGUAGES ───────────────────────────────────────────────────────
 *
 * Word records and wrapped words merge whatever language the file came from:
 * they are keyed by word id, every id carries its language, so a Danish file
 * folded into a German device adds the Danish half of the collection and
 * touches nothing German. That is worth having — it is how one backup carries
 * everything a player has ever learned.
 *
 * The city index does NOT merge across languages. It is an index into a route,
 * and "the furthest city wins" compares two numbers that count different
 * cities; a Danish stop 7 restored onto a German journey would teleport the
 * player to Frankfurt with none of its words behind them. So a file from
 * another language keeps its words and leaves the position alone.
 */
export function mergeSnapshot(current: Snapshot, incoming: Backup): Snapshot {
  const progress = mergeImportedProgress(current.progress ?? legacyProgress(current.translationPostcards), incoming.progress)
  const stats: SrsMap = { ...current.stats }
  for (const [id, record] of Object.entries(incoming.srs.stats)) {
    const mine = stats[id]
    stats[id] = mine ? betterRecord(mine, record) : record
  }
  const sameLanguage = incoming.language === current.language
  return {
    stats,
    translationPostcards: earnedPostcards(progress, LEGACY_CITY),
    progress,
    learning: mergeLearning(current.learning ?? emptyLearning(), incoming.learning),
    recovery: mergeRecovery(current.recovery ?? [], incoming.recovery),
    games: {
      played: Math.max(current.games.played, incoming.srs.games.played),
      won: Math.max(current.games.won, incoming.srs.games.won),
      redeemed: Math.max(current.games.redeemed, incoming.srs.games.redeemed),
      lost: Math.max(current.games.lost, incoming.srs.games.lost),
    },
    journey: sameLanguage
      ? mergeJourney(current.journey, incoming.journey)
      : // Words still merge — they are the part that is language-safe.
        { ...current.journey, wrapped: earliestByKey(current.journey.wrapped, incoming.journey.wrapped),
          historicalTravelEligibility: { ...current.journey.historicalTravelEligibility, ...incoming.journey.historicalTravelEligibility },
          parked: mergeRouteHistory(current.journey.parked ?? {}, { ...incoming.journey.parked, [incoming.language]: incoming.journey }),
          historicalRoutes: mergeRouteHistory(current.journey.historicalRoutes ?? {}, incoming.journey.historicalRoutes ?? {}) },
    prefs: current.prefs,
    language: current.language,
  }
}


/**
 * Wholesale restore: the file becomes the device's progress.
 *
 * The language comes with it, and `applyBackup` does not switch to it: a
 * replace from another language's file writes that file's position, so the
 * caller is told which language the restored journey belongs to and can say so.
 * See `restore` in apply.ts.
 */
export function replaceSnapshot(incoming: Backup): Snapshot {
  return {
    stats: incoming.srs.stats,
    games: incoming.srs.games,
    translationPostcards: earnedPostcards(incoming.progress, LEGACY_CITY),
    progress: incoming.progress,
    learning: mergeLearning(emptyLearning(), incoming.learning),
    recovery: incoming.recovery,
    journey: {
      cityIndex: incoming.journey.cityIndex,
      wrapped: incoming.journey.wrapped,
      arrivedAt: incoming.journey.arrivedAt as unknown as Record<number, number>,
      ...furthestOf(incoming.journey),
      historicalTravelEligibility: incoming.journey.historicalTravelEligibility,
      parked: incoming.journey.parked,
      historicalRoutes: incoming.journey.historicalRoutes,
    },
    prefs: incoming.prefs,
    language: incoming.language,
  }
}

export interface BackupSummary {
  words: number
  collected: number
  wrapped: number
  translationPostcards: number
  cityIndex: number
  exportedAt: number
  games: number
}

/** What the file holds, shown before anything is written. */
export function summarize(b: Backup): BackupSummary {
  const wrapped = new Set(Object.keys(b.journey.wrapped))
  let collected = 0
  for (const [id, s] of Object.entries(b.srs.stats)) {
    if (!wrapped.has(id) && s.greenByClue > 0 && s.greenByGuess > 0) collected++
  }
  return {
    words: Object.keys(b.srs.stats).length,
    collected,
    wrapped: wrapped.size,
    translationPostcards: earnedPostcards(b.progress, LEGACY_CITY),
    cityIndex: b.journey.cityIndex,
    exportedAt: b.exportedAt,
    games: b.srs.games.played,
  }
}
