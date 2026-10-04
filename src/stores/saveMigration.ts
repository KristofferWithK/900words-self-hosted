import { z } from 'zod'
import { packFor } from '../lang'
import type { LanguageCode } from '../lang/types'
import { createPrimaryContinuation, withLegacyCredit } from '../progression/facts'
import { cityKey } from '../progression/identity'
import { gameSchema, parseLedger, parseSessions } from '../progression/storageSchema'
import { matchesAuthoredContent } from '../progression/rules'
import type { AttemptSlot, CourseSessions, ProgressFacts } from '../progression/types'
import { initialCourseSessions, isSupersededQueue, rebaseCourseSessions, requiredContent, requiredSetForCourse, validateCourseSessions } from '../session/courseRuntime'
import { migrateSrs } from './srsStore'
import { commitSaveTransfer, readSaveMigration, SAVE_MIGRATION_KEY, type SaveStorage } from './saveTransfer'
import { SESSION_KEY, SETTLEMENT_KEY } from './settlementStorage'
import { emptySettlementLedger, pendingSettlement } from '../progression/settlement'

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const stamp = z.enum(['en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl'])
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const readEnvelope = (storage: SaveStorage, key: string): { version: number; state: Record<string, unknown> } | null => {
  const raw = storage.getItem(key)
  return raw === null ? null : z.object({ version: amount, state: z.record(z.string(), z.unknown()) }).parse(JSON.parse(raw))
}

/** Complete membership is evidence of the old normal wrapping gate. A count,
 * arrival, developer jump or postcard balance is never evidence. */
export function provenLegacyEligibility(wrapped: Readonly<Record<string, number>>): Record<string, true> {
  const pack = packFor('da')
  const roster = pack.rosters[0] ?? []
  return roster.length === 100 && new Set(roster).size === 100 && roster.every((id) => Number.isSafeInteger(wrapped[id]) && wrapped[id]! >= 0)
    ? { [cityKey({ courseId: 'da', cityId: 'sonderborg' })]: true } : {}
}

export interface LegacySessionPlan { sessions: CourseSessions; retired: boolean; evidence: Record<string, unknown> }

/** Copy only recovery evidence. Old credentials, URLs and request plans do
 * not become operations, and no archived snapshot can call finishRound. */
export function legacyRoundEvidence(value: unknown): Record<string, unknown> {
  const state = object(value)
  const keys = ['game', 'lookedUp', 'roundRecorded', 'mode', 'gameLanguage', 'gameUiLanguage',
    'authoredBoardId', 'boardCityIndex', 'city1BoardCursor', 'reviewRoundId', 'dailyKey']
  return Object.fromEntries([...keys.filter((key) => state[key] !== undefined).map((key) => [key, state[key]]),
    ...(state.parked ? [['parked', legacyRoundEvidence(state.parked)]] : [])])
}

export function planLegacySessions(raw: unknown, facts: ProgressFacts, activeCourse: LanguageCode, attemptId: string): LegacySessionPlan {
  const state = object(raw)
  const evidence = legacyRoundEvidence(state)
  // Legacy sessions predate per-course identities and are always Danish.
  // Keep migration attached to that frozen set even when booting German.
  const required = requiredSetForCourse('da')
  const candidates = [state, object(state.parked)]
  const compatible = (candidate: Record<string, unknown>): AttemptSlot | null => {
    if (activeCourse !== 'da' || candidate.mode !== 'normal' || candidate.dailyKey || candidate.gameLanguage !== 'da' ||
      candidate.roundRecorded === true || !stamp.safeParse(candidate.gameUiLanguage).success) return null
     const board = required.boards.find((board) => board.authoredBoardId === candidate.authoredBoardId)
    const parsed = gameSchema.safeParse(candidate.game)
    if (!board || !parsed.success || parsed.data.phase === 'finished' || parsed.data.outcome) return null
    const game = parsed.data as unknown as AttemptSlot['game']
     if (!matchesAuthoredContent(game, requiredContent(board))) return null
    const ids = game.words.map((word) => word.wordId)
    if (Object.keys(game.reveals).length !== ids.length || ids.some((id) => !game.reveals[id])) return null
    if (game.wheel) {
      const w = game.wheel
      const targets = ids.filter((id) => game.reveals[id]?.kind === 'green' && (game.playerKey[id] === 'green' || game.aiKey[id] === 'green'))
      if (!['translateChallenge', 'translateWheel'].includes(game.phase) || !targets.length ||
        w.result !== null || w.landed !== null || w.spent !== null || new Set(w.filled).size !== w.filled.length ||
        w.segments.length !== targets.length || w.segments.some((id, index) => id !== targets[index]) ||
        w.translated.some((id) => !w.segments.includes(id)) || w.filled.some((n) => n >= w.segments.length) ||
        // Correct answers fill RANDOM empty segments; word index is not fill index.
        w.filled.length !== w.translated.length) return null
    } else if (game.phase === 'translateChallenge' || game.phase === 'translateWheel') return null
    const lookedUp = Array.isArray(candidate.lookedUp) ? candidate.lookedUp.filter((id): id is string => typeof id === 'string' && ids.includes(id)) : []
    const slot = { attemptId, board, origin: 'primary' as const, promptLanguage: stamp.parse(candidate.gameUiLanguage), game,
      lookedUp: [...new Set(lookedUp)], reviewRoundId: typeof candidate.reviewRoundId === 'string' ? candidate.reviewRoundId : null,
      randomnessPolicy: 'engine-wheel-v1' as const,
      // A resumed old round must not replay first-run instructions. This is
      // presentation only; words, clues, wheel and prompt stamp stay exact.
      round: { roundGuidance: { opening: 'dismissed', playerClueTurn: null,
        lastChance: 'dismissed', translation: 'dismissed', packing: 'dismissed' } },
    }
    return slot
  }
  const primary = candidates.map(compatible).find((slot) => slot !== null) ?? null
  const occupied = candidates.filter((candidate) => candidate.game).length
  const sessions: CourseSessions = primary ? {
    continuation: createPrimaryContinuation(required, facts, primary.board), primary, replay: null, activeSlot: 'primary',
  } : initialCourseSessions(facts, 'da')
  return { sessions: validateCourseSessions(sessions, facts, required), retired: occupied > (primary ? 1 : 0), evidence }
}

/** Runs after the old per-store shape readers and before any new gameplay.
 * Its journal contains the final values, so every retry uses the same ID and
 * evidence even when a write committed and then reported an error. */
export function migrateLegacyProfile(storage: SaveStorage, gameCache: Record<string, unknown>, activeCourse: LanguageCode, now: number,
  decorateSlot: (slot: AttemptSlot) => AttemptSlot = (slot) => slot): void {
  const existingMigration = readSaveMigration(storage)
  if (existingMigration.legacyCreditSource !== undefined) return
  const savedSrs = readEnvelope(storage, 'cluecab-srs-v1')
  if (savedSrs) {
    const source = savedSrs.state
    const fields = savedSrs.version >= 6 ? ['translationPostcards'] : savedSrs.version === 5 ? ['translationJokers']
      : savedSrs.version === 4 ? ['wrapUpsBanked', 'winsTowardWrapUp'] : savedSrs.version === 3 ? ['wrapUpsBanked'] : []
    for (const field of fields) if (source[field] !== undefined) amount.parse(source[field])
    if (savedSrs.version < 3 && object(source.games).won !== undefined) amount.parse(object(source.games).won)
  }
  const srs = savedSrs ? object(migrateSrs(savedSrs.state, savedSrs.version)) : {}
  const credit = amount.parse(srs.translationPostcards === undefined ? 0 : srs.translationPostcards)
  const rawLedger = storage.getItem(SETTLEMENT_KEY)
  const ledger = rawLedger ? parseLedger(JSON.parse(rawLedger)) : emptySettlementLedger()
  const facts = withLegacyCredit(ledger.facts, credit)
  const savedGame = readEnvelope(storage, 'cluecab-game-v1')
  const legacy = gameCache.legacySave ?? (savedGame && savedGame.version < 16 ? savedGame.state : null)
  const sessionRaw = readEnvelope(storage, SESSION_KEY)
  const sessionState = sessionRaw?.state ?? { byCourse: {}, results: {}, settlementEffects: {} }
  const byCourse = object(sessionState.byCourse)
  const planned = legacy ? planLegacySessions(legacy, facts, activeCourse, `legacy-${crypto.randomUUID()}`) : null
  if (planned?.sessions.primary) planned.sessions = { ...planned.sessions, primary: decorateSlot(planned.sessions.primary) }
  // Existing Danish C1 slots win: importing/migrating old metadata cannot create a third.
  if (!byCourse.da && planned) byCourse.da = planned.sessions
  // A queue on a superseded set is valid against that set; `rebaseSavedQueues`
  // moves it (after recovery, if a settlement was pending) rather than this.
  if (byCourse.da && !isSupersededQueue(parseSessions(byCourse.da), 'da')) {
    validateCourseSessions(parseSessions(byCourse.da), facts, requiredSetForCourse('da'))
  }
  const journey = readEnvelope(storage, 'cluecab-journey-v2')
  const wrapped = object(journey?.state.wrapped) as Record<string, number>
  const historical = { ...object(journey?.state.historicalTravelEligibility), ...provenLegacyEligibility(wrapped) }
  // A fresh post-redesign profile has no legacy fact to migrate. In particular,
  // do not interpose a metadata transaction while recovering its real receipt.
  if (!legacy && credit === 0 && Object.keys(historical).length === 0) return
  const migration = { ...existingMigration, version: 1, migratedAt: existingMigration.migratedAt ?? now, legacyCreditSource: credit,
    retired: planned?.retired === true || existingMigration.retired === true,
    noticeDismissed: planned?.retired ? false : existingMigration.noticeDismissed ?? true, evidence: planned?.evidence ?? existingMigration.evidence ?? {} }
  commitSaveTransfer(storage, [
    { key: SETTLEMENT_KEY, value: JSON.stringify({ ...ledger, facts }) },
    { key: SESSION_KEY, value: JSON.stringify({ version: 1, state: { ...sessionState, byCourse } }) },
    ...(journey ? [{ key: 'cluecab-journey-v2' as const, value: JSON.stringify({ version: journey.version, state: { ...journey.state, historicalTravelEligibility: historical } }) }] : []),
    { key: SAVE_MIGRATION_KEY, value: JSON.stringify(migration) },
  ])
}

/** A damaged unfinished prompt stamp cannot safely resume model dialogue.
 * Retire just that slot, leaving its exact continuation and all settled facts.
 * Terminal slots are never discarded here: accepted evidence must recover. */
export function retireUnstampedSessions(storage: SaveStorage, now: number): void {
  const saved = readEnvelope(storage, SESSION_KEY)
  if (!saved) return
  const byCourse = { ...object(saved.state.byCourse) }
  const retired: { id: string; at: number; evidence: Record<string, unknown> }[] = []
  for (const [course, value] of Object.entries(byCourse)) {
    const sessions = { ...object(value) }
    for (const key of ['primary', 'replay'] as const) {
      const slot = object(sessions[key])
      if (!slot.game || object(slot.game).phase === 'finished' || stamp.safeParse(slot.promptLanguage).success) continue
      retired.push({ id: `unstamped-${slot.attemptId}`, at: now, evidence: legacyRoundEvidence({ ...slot,
        gameLanguage: object(slot.board).courseId, authoredBoardId: object(slot.board).authoredBoardId, mode: 'normal' }) })
      sessions[key] = null
      if (sessions.activeSlot === key) sessions.activeSlot = null
    }
    byCourse[course] = sessions
  }
  if (!retired.length) return
  const migration = readSaveMigration(storage)
  commitSaveTransfer(storage, [
    { key: SESSION_KEY, value: JSON.stringify({ ...saved, state: { ...saved.state, byCourse } }) },
    { key: SAVE_MIGRATION_KEY, value: JSON.stringify({ ...migration, version: 1, migratedAt: migration.migratedAt ?? now,
      retired: true, noticeDismissed: false, archives: [...(migration.archives ?? []), ...retired] }) },
  ])
}

/**
 * Move every saved queue that still names a superseded frozen set of its city
 * onto the current set (`rebaseCourseSessions`), once, in one journaled write.
 * A round the rebase could not carry — unfinished, or finished but unsettled,
 * on a board the new set dropped — is archived with the same evidence and
 * notice as any other retired round.
 *
 * Returns false, writing nothing, while a settlement is pending: that receipt's
 * queue effect was prepared against the old queue and must be applied to it
 * first. The caller runs this again once recovery has applied it.
 */
export function rebaseSavedQueues(storage: SaveStorage, now: number): boolean {
  const saved = readEnvelope(storage, SESSION_KEY)
  if (!saved) return true
  const rawLedger = storage.getItem(SETTLEMENT_KEY)
  const ledger = rawLedger ? parseLedger(JSON.parse(rawLedger)) : emptySettlementLedger()
  const byCourse = { ...object(saved.state.byCourse) }
  const stale = Object.entries(byCourse).filter(([course, value]) =>
    (course === 'da' || course === 'de') && isSupersededQueue(parseSessions(value), course))
  if (!stale.length) return true
  if (pendingSettlement(ledger)) return false
  const retired: { id: string; at: number; evidence: Record<string, unknown> }[] = []
  for (const [course, value] of stale) {
    const plan = rebaseCourseSessions(parseSessions(value), ledger.facts, requiredSetForCourse(course as LanguageCode))
    byCourse[course] = plan.sessions
    for (const slot of plan.retired) retired.push({ id: `rebased-${slot.attemptId}`, at: now, evidence: legacyRoundEvidence({ ...slot,
      gameLanguage: slot.board.courseId, authoredBoardId: slot.board.authoredBoardId, mode: 'normal' }) })
  }
  const migration = readSaveMigration(storage)
  commitSaveTransfer(storage, [
    { key: SESSION_KEY, value: JSON.stringify({ ...saved, state: { ...saved.state, byCourse } }) },
    ...(retired.length ? [{ key: SAVE_MIGRATION_KEY as typeof SAVE_MIGRATION_KEY, value: JSON.stringify({ ...migration, version: 1, migratedAt: migration.migratedAt ?? now,
      retired: true, noticeDismissed: false, archives: [...(migration.archives ?? []), ...retired] }) }] : []),
  ])
  return true
}
