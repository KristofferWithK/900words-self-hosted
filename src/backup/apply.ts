import { ACTIVE } from '../lang/active'
import { useJourney } from '../stores/journeyStore'
import { useSrs } from '../stores/srsStore'
import { useGame } from '../stores/gameStore'
import { useCurriculum } from '../stores/curriculumStore'
import { useSurvival } from '../stores/survivalStore'
import { useAssociations } from '../stores/associationStore'
import { useStreak } from '../streak/streak'
import { createSettlementStore } from '../stores/settlementStore'
import { assertSettlementIdle, SESSION_KEY, SETTLEMENT_KEY, withSettlementWriter } from '../stores/settlementStorage'
import { commitSaveTransfer, recoverSaveTransfer, readSaveMigration, isDailySaveKey, SAVE_MIGRATION_KEY, type SaveKey } from '../stores/saveTransfer'
import { provenLegacyEligibility } from '../stores/saveMigration'
import { earnedPostcards, LEGACY_CITY } from '../progression/facts'
import { emptySettlementLedger } from '../progression/settlement'
import { initialCourseSessions, CITY1_REQUIRED_SET } from '../session/courseRuntime'
import { reconcileLessonMilestones } from '../journey/lessonMilestones'
import { requiredSetKey } from '../progression/identity'
import { emptyLearning, legacyProgress, mergeLearning } from './progress'
import { DEVELOPED_CITY_COUNT } from '../journey/cities'
import { mergeRecovery, RecoveryArchiveSchema } from './recovery'
import {
  BACKUP_FILENAME,
  buildBackup,
  mergeSnapshot,
  replaceSnapshot,
  parseBackup,
  mergeRouteHistory,
  type Backup,
  type Snapshot,
} from './backup'

/** The live stores, flattened into the shape the pure module works on. */
export function readSnapshot(): Snapshot {
  assertSettlementIdle()
  const srs = useSrs.getState()
  const j = useJourney.getState()
  const progress = typeof localStorage === 'undefined' ? legacyProgress(srs.translationPostcards)
    : createSettlementStore({ storage: localStorage }).readLedger().facts
  const migration = typeof localStorage === 'undefined' ? {} : readSaveMigration(localStorage)
  const archive = migration.evidence?.game || migration.evidence?.parked
    ? [{ id: `legacy-${migration.migratedAt}`, at: migration.migratedAt, evidence: migration.evidence }] : []
  return {
    stats: srs.stats,
    games: srs.games,
    translationPostcards: earnedPostcards(progress, LEGACY_CITY),
    progress,
    recovery: mergeRecovery(RecoveryArchiveSchema.parse(migration.archives ?? []), RecoveryArchiveSchema.parse(archive)),
    learning: { curriculum: useCurriculum.getState().byLanguage,
      survival: Object.fromEntries(Object.entries(useSurvival.getState().byLanguage).filter((entry) => entry[1] !== undefined)) as NonNullable<Snapshot['learning']>['survival'] },
    journey: {
      cityIndex: j.cityIndex,
      wrapped: j.wrapped,
      arrivedAt: j.arrivedAt,
      furthest: j.furthest,
      historicalTravelEligibility: { ...j.historicalTravelEligibility },
      parked: j.parked,
      historicalRoutes: j.historicalRoutes,
    },
    prefs: {},
    language: ACTIVE.code,
  }
}

async function publishStores(): Promise<void> {
  for (const store of [useSrs, useJourney, useCurriculum, useSurvival, useAssociations, useStreak]) await store.persist.rehydrate()
  useGame.setState({ completionReceipt: null, sessions: null, settlementBusy: false, settlementFailure: null,
    error: null, aiBusy: false, aiGuessQueue: [], aiGuessRequestId: null, aiClueRequestId: null, wheelSpinHold: false })
  await useGame.persist.rehydrate()
  await useGame.getState().recoverSession()
}

function snapshotWrites(next: Snapshot, mode: RestoreMode, now: number): { key: SaveKey; value: string }[] {
  const adapter = createSettlementStore({ storage: localStorage })
  const facts = next.progress!
  const existing = adapter.readLedger()
  const grammar = useCurriculum.getState(), survival = useSurvival.getState()
  let learning = mergeLearning(emptyLearning(), next.learning ?? emptyLearning())
  const milestones = Object.entries(facts.milestones).filter(([, fact]) => requiredSetKey(fact.requiredSet) === requiredSetKey(CITY1_REQUIRED_SET)).map(([id]) => id)
  const course = ACTIVE.code
  // Both destinations must have consumed it. One successful old write must
  // never suppress reconciliation of the other store after an interruption.
  const consumed = mode === 'merge' ? Object.fromEntries(Object.entries(grammar.settlementMilestones)
    .filter(([id]) => survival.settlementMilestones[id] !== undefined)) : {}
  const plan = reconcileLessonMilestones({ requiredSet: CITY1_REQUIRED_SET, completedMilestoneIds: milestones,
    consumedMilestoneIds: consumed, curriculum: learning.curriculum[course] ?? null, survival: learning.survival[course] ?? null, acceptedAt: now })
  learning = { curriculum: { ...learning.curriculum, [course]: plan.curriculum.after }, survival: { ...learning.survival, [course]: plan.survival.after } }
  const markers = Object.fromEntries(milestones.map((id) => [id, consumed[id] ?? now]))
  const currentJourney = useJourney.getState()
  const priorMigration = mode === 'merge' ? readSaveMigration(localStorage) : {}
  const sameLanguage = next.language === ACTIVE.code
  const position = sameLanguage ? next.journey : currentJourney
  const limit = DEVELOPED_CITY_COUNT - 1
  const journey = { cityIndex: Math.min(position.cityIndex, limit), furthest: Math.min(position.furthest ?? 0, limit),
    arrivedAt: Object.fromEntries(Object.entries(position.arrivedAt).filter(([key]) => Number(key) <= limit)),
    wrapped: next.journey.wrapped, routeLanguage: ACTIVE.code, waitingForTrain: false,
    historicalTravelEligibility: { ...next.journey.historicalTravelEligibility },
    parked: { ...next.journey.parked, ...(!sameLanguage ? { [next.language]: next.journey } : {}) },
    historicalRoutes: mergeRouteHistory(next.journey.historicalRoutes ?? {}, { [next.language]: next.journey }),
  }
  const sessions = mode === 'merge' ? adapter.readSessions() : { byCourse: {}, results: {}, settlementEffects: {} }
  const byCourse = { ...sessions.byCourse }
  if (!byCourse[ACTIVE.code]) byCourse[ACTIVE.code] = initialCourseSessions(facts)
  const encoded = (key: SaveKey, version: number, state: unknown) => ({ key, value: JSON.stringify({ version, state }) })
  const writes: { key: SaveKey; value: string }[] = [
    encoded('cluecab-srs-v1', 7, { stats: next.stats, games: next.games,
      translationPostcards: facts.legacyCredit.amount, settlementEffects: mode === 'merge' ? useSrs.getState().settlementEffects : {} }),
    encoded('cluecab-journey-v2', 7, journey),
    encoded('cluecab-curriculum-v1', 3, { byLanguage: learning.curriculum, settlementEffects: mode === 'merge' ? grammar.settlementEffects : {},
      settlementMilestones: { ...(mode === 'merge' ? grammar.settlementMilestones : {}), ...markers } }),
    encoded('cluecab-survival-v1', 2, { byLanguage: learning.survival, settlementEffects: mode === 'merge' ? survival.settlementEffects : {},
      settlementMilestones: { ...(mode === 'merge' ? survival.settlementMilestones : {}), ...markers } }),
    { key: SETTLEMENT_KEY, value: JSON.stringify({ schemaVersion: 1, facts, settlements: mode === 'merge' ? existing.settlements : {} }) },
    encoded(SESSION_KEY, 1, { ...sessions, byCourse }),
    { key: SAVE_MIGRATION_KEY, value: JSON.stringify({ ...priorMigration,
      version: 1, migratedAt: priorMigration.migratedAt ?? now, legacyCreditSource: facts.legacyCredit.amount,
      archives: next.recovery ?? [], ...(!localStorage.getItem(SAVE_MIGRATION_KEY) || mode === 'replace' ? { noticeDismissed: true, retired: false, evidence: {} } : {}) }) },
  ]
  if (mode === 'replace') writes.push(encoded('cluecab-game-v1', 17, { game: null, parked: null, legacySave: null,
    attemptId: null, attemptOrigin: null, activeSlot: null, roundRecorded: false, reviewRoundId: null, sentenceReview: null }))
  if (mode === 'replace') {
    writes.push(encoded('cluecab-streak-v1', 2, { completedDays: {}, settlementEffects: {} }),
      encoded('cluecab-associations-v1', 2, { groups: {}, traps: {}, settlementEffects: {} }))
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && isDailySaveKey(key)) writes.push(encoded(key, 1, { outcome: null, settlementEffects: {} }))
    }
  }
  return writes
}

export type RestoreMode = 'merge' | 'replace'

/**
 * Returns whether the file was from the language being played. False means the
 * words were restored and the journey position was not — see `snapshotWrites`.
 */
export async function restore(backup: Backup, mode: RestoreMode): Promise<{ sameLanguage: boolean }> {
  // Revalidate at the mutation boundary as well as the file picker. Invalid
  // callers cannot alter state by skipping the UI parser.
  const parsed = parseBackup(JSON.stringify(backup))
  if (!parsed.ok) throw new Error(parsed.error)
  backup = parsed.backup
  if (backup.format < 3) backup = { ...backup, journey: { ...backup.journey,
    historicalTravelEligibility: provenLegacyEligibility(backup.journey.wrapped) } }
  recoverSaveTransfer(localStorage)
  await useGame.getState().recoverSession()
  assertSettlementIdle()
  const current = readSnapshot()
  const next = mode === 'replace' ? replaceSnapshot(backup) : mergeSnapshot(current, backup)
  const writes = snapshotWrites(next, mode, backup.exportedAt)
  useGame.getState().pauseGame()
  await withSettlementWriter(localStorage, async () => commitSaveTransfer(localStorage, writes))
  await publishStores()
  return { sameLanguage: backup.language === ACTIVE.code }
}

/** One transaction clears all authorities and destination markers together.
 * Settings/onboarding preferences are deliberately outside collection reset. */
export async function resetCollection(): Promise<void> {
  recoverSaveTransfer(localStorage)
  await useGame.getState().recoverSession()
  assertSettlementIdle()
  const next: Snapshot = { stats: {}, games: { played: 0, won: 0, lost: 0, redeemed: 0 }, translationPostcards: 0,
    progress: emptySettlementLedger().facts, learning: emptyLearning(), journey: { cityIndex: 0, wrapped: {}, arrivedAt: {} }, prefs: {}, language: ACTIVE.code }
  const writes = snapshotWrites(next, 'replace', Date.now())
  useGame.getState().pauseGame()
  await withSettlementWriter(localStorage, async () => commitSaveTransfer(localStorage, writes))
  await publishStores()
}

export function backupText(now: number): string {
  return JSON.stringify(buildBackup(readSnapshot(), now), null, 2)
}

/** UI exports wait for startup/local migration and any accepted receipt. */
export async function prepareBackupText(now: number): Promise<string> {
  await useGame.getState().recoverSession()
  return backupText(now)
}

/**
 * Hand the file to the phone. The share sheet is the only route that reliably
 * reaches Files or a mail app from an installed iOS PWA, so try it first and
 * keep the anchor download as the desktop and Android path.
 */
export async function downloadBackup(now: number): Promise<'shared' | 'downloaded'> {
  const text = await prepareBackupText(now)
  const file = new File([text], BACKUP_FILENAME, { type: 'application/json' })

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { files?: File[]; title?: string }) => Promise<void>
  }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: '900words collection' })
      return 'shared'
    } catch (e) {
      // A cancelled share is not a failure worth reporting; fall through to
      // the download so the button always does something.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = BACKUP_FILENAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
