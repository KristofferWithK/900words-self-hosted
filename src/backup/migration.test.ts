/// <reference types="node" />
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { newStats } from '../srs/scheduler'
import { applyEvent } from '../engine/game'
import type { GameState } from '../engine/types'
import { emptyProgressFacts, earnedPostcards } from '../progression/facts'
import { boardKey, cityKey, firstCompletionKey, milestoneKey, requiredSetKey } from '../progression/identity'
import { cityMedal } from '../journey/progress'
import { initialCurriculumProgress } from '../journey/curriculumScheduler'
import { initialSurvivalProgress } from '../journey/survival'
import { CITY1_REQUIRED_SET, knownRequiredSetsForCourse, requiredSetForCourse } from '../session/courseRuntime'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import { packFor } from '../lang'
import { SAVE_MIGRATION_KEY, SAVE_TRANSFER_KEY, commitSaveTransfer, recoverSaveTransfer, readSaveMigration, hasSaveTransfer } from '../stores/saveTransfer'
import { buildBackup, mergeSnapshot, parseBackup, type Snapshot } from './backup'
import { validateProgressFacts } from './progress'

const values = new Map<string, string>()
let failKey: string | null = null
let afterWrite = false
let faultOnlyDuringTransfer = false
const storage = { get length() { return values.size }, key: (index: number) => [...values.keys()][index] ?? null,
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {
  const fail = key === failKey && (!faultOnlyDuringTransfer || hasSaveTransfer(storage))
  if (fail && !afterWrite) throw new Error('before write')
  values.set(key, value)
  if (fail && afterWrite) throw new Error('after write')
}, removeItem: (key: string) => { values.delete(key) } }
vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', { localStorage: storage })
const { useGame, dealCity1AuthoredBoard, migrateGame } = await import('../stores/gameStore')
const { useSrs, migrateSrs } = await import('../stores/srsStore')
const { useJourney, migrateJourney } = await import('../stores/journeyStore')
const { useCurriculum } = await import('../stores/curriculumStore')
const { useSurvival } = await import('../stores/survivalStore')
const { useStreak } = await import('../streak/streak')
const { useAssociations } = await import('../stores/associationStore')
const { useSettings } = await import('../stores/settingsStore')
const { useUi } = await import('../stores/uiStore')
const { createSettlementStore } = await import('../stores/settlementStore')
const { SESSION_KEY, assertSettlementIdle } = await import('../stores/settlementStorage')
const { planLegacySessions, migrateLegacyProfile, provenLegacyEligibility } = await import('../stores/saveMigration')
const { restore, resetCollection, backupText, prepareBackupText, readSnapshot } = await import('./apply')
// Required boards are cafés a walk must find first (CW-04); these checks are about migration and restore.
const { everyCafeFound } = await import('../journey/cafeTestSupport')

const NOW = 1_790_000_000_000
const seed = (key: string, version: number, state: unknown) => values.set(key, JSON.stringify({ version, state }))
const read = (key: string) => JSON.parse(values.get(key)!)
const adapter = () => createSettlementStore({ storage })
const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({ stats: {}, games: { played: 0, won: 0, lost: 0, redeemed: 0 },
  translationPostcards: 0, journey: { cityIndex: 0, wrapped: {}, arrivedAt: {} }, prefs: {}, language: 'da', ...patch })
const parsed = (value: unknown) => { const result = parseBackup(JSON.stringify(value)); if (!result.ok) throw new Error(result.error); return result.backup }
const oldFile = (amount: number, language: 'da' | 'de' = 'da') => parsed({ ...buildBackup(snapshot({ translationPostcards: amount, language }), NOW), format: 2 })

function factsWith(n: number, claims: ('spinWin' | 'solved' | 'solvedAndTranslated')[] = []) {
  const boards = CITY1_REQUIRED_SET.boards.slice(0, n)
  return validateProgressFacts({ ...emptyProgressFacts(),
    boards: Object.fromEntries(boards.map((board) => [boardKey(board), { board,
      best: claims.includes('solvedAndTranslated') ? 'platinum' : claims.includes('solved') ? 'gold' : claims.includes('spinWin') ? 'silver' : 'bronze', claims }])),
    firstPrimaryCompletions: Object.fromEntries(boards.map((board) => [firstCompletionKey(board), { board, requiredSet: CITY1_REQUIRED_SET }])) })
}

function legacyRound(index = 4) {
  const board = CITY1_REQUIRED_SET.boards[index]!
  const cursor = CITY1_BOARD_CYCLE.findIndex((item) => item.id === board.authoredBoardId)
  const { game } = dealCity1AuthoredBoard(cursor)
  return { game, authoredBoardId: board.authoredBoardId, gameLanguage: 'da', gameUiLanguage: 'de', mode: 'normal',
    lookedUp: [game.words[0].wordId], city1BoardCursor: 149, roundRecorded: false, boardCityIndex: 0, reviewRoundId: 'old-review' }
}

beforeEach(async () => {
  failKey = null; afterWrite = false; faultOnlyDuringTransfer = false
  await useGame.getState().recoverSession().catch(() => undefined)
  values.clear()
  useSrs.setState(useSrs.getInitialState()); useJourney.setState({ ...useJourney.getInitialState(), cafes: everyCafeFound() })
  useCurriculum.setState(useCurriculum.getInitialState()); useSurvival.setState(useSurvival.getInitialState())
  useStreak.setState(useStreak.getInitialState()); useAssociations.setState(useAssociations.getInitialState())
  useGame.setState(useGame.getInitialState())
  useSettings.setState({ ...useSettings.getInitialState(), useMock: true })
  useUi.setState({ pendingFirstGiver: 'player', screen: 'home', onboarding: null })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external requests in migration checks') }))
})

describe('C1-06 AC21 legacy version and overlapping-export matrix', () => {
  it.each([
    [0, { games: { won: 9 } }, 9], [1, { games: { won: 7 } }, 7], [2, { games: { won: 8 } }, 8],
    [3, { games: { won: 99 }, wrapUpsBanked: 2 }, 2], [4, { wrapUpsBanked: 2, winsTowardWrapUp: 1 }, 7],
    [5, { translationJokers: 12 }, 12], [6, { translationPostcards: 13 }, 13], [7, { translationPostcards: 14 }, 14],
  ])('migrates SRS v%s once to the single Danish credit identity', (version, source, expected) => {
    seed('cluecab-srs-v1', version as number, source)
    migrateLegacyProfile(storage, {}, 'de', NOW)
    migrateLegacyProfile(storage, {}, 'de', NOW + 1)
    const facts = adapter().readLedger().facts
    expect(facts.legacyCredit.amount).toBe(expected)
    expect(earnedPostcards(facts, { courseId: 'de', cityId: 'berlin' })).toBe(0)
    expect(facts.boards).toEqual({})
  })

  it('rejects malformed credit before any migration write', () => {
    for (const amount of [-1, 1.5, '4', null, Number.MAX_SAFE_INTEGER + 1]) {
      values.clear(); seed('cluecab-srs-v1', 6, { translationPostcards: amount })
      const before = [...values]
      expect(() => migrateLegacyProfile(storage, {}, 'da', NOW)).toThrow()
      expect([...values]).toEqual(before)
    }
  })

  it('takes the max of different lineage-less exports in either order and never remints new-format totals', async () => {
    for (const order of [[7, 12, 7], [12, 7, 12]]) {
      await resetCollection()
      for (const amount of order) await restore(oldFile(amount, 'de'), 'merge')
      expect(adapter().readLedger().facts.legacyCredit.amount).toBe(12)
      const facts = { ...factsWith(1, ['spinWin']), legacyCredit: { identity: 'danish-city1-legacy-v1' as const, amount: 12 } }
      const newer = buildBackup(snapshot({ progress: facts }), NOW)
      newer.srs.translationPostcards = 999
      await restore(newer, 'merge'); await restore(newer, 'merge')
      expect(adapter().readLedger().facts.legacyCredit.amount).toBe(12)
      expect(earnedPostcards(adapter().readLedger().facts, { courseId: 'da', cityId: 'sonderborg' })).toBe(13)
    }
  })
})

describe('C1-06 AC22/23 legacy evidence and finite continuation', () => {
  it('round-trips progress from the Danish and German City 1 manifests side by side', () => {
    const germanSet = requiredSetForCourse('de')
    const boardRows = [
      ...CITY1_REQUIRED_SET.boards.slice(0, 10),
      ...germanSet.boards.slice(0, 10),
    ]
    const completions = boardRows.map((board) => ({ board, requiredSet: board.courseId === 'de' ? germanSet : CITY1_REQUIRED_SET }))
    const mixed = validateProgressFacts({ ...emptyProgressFacts(),
      boards: Object.fromEntries(boardRows.map((board) => [boardKey(board), { board, best: 'bronze', claims: [] }])),
      firstPrimaryCompletions: Object.fromEntries(completions.map(({ board, requiredSet }) => [firstCompletionKey(board), { board, requiredSet }])) })

    expect(Object.keys(mixed.boards)).toHaveLength(20)
    expect(Object.keys(mixed.firstPrimaryCompletions)).toHaveLength(20)
    expect(mixed.milestones[milestoneKey(CITY1_REQUIRED_SET, 10)]?.completedCount).toBe(10)
    expect(mixed.milestones[milestoneKey(germanSet, 10)]?.completedCount).toBe(10)
  })

  it('keeps progress earned under the superseded Danish set importable, dropped boards included', () => {
    const v1 = knownRequiredSetsForCourse('da')[0]!
    const v1Set = { courseId: v1.courseId, cityId: v1.cityId, setVersion: v1.setVersion }
    const played = v1.boards.slice(0, 28)
    const inV2 = new Set(CITY1_REQUIRED_SET.boards.map(boardKey))
    expect(played.some((board) => !inV2.has(boardKey(board)))).toBe(true)
    const facts = validateProgressFacts({ ...emptyProgressFacts(),
      boards: Object.fromEntries(played.map((board) => [boardKey(board), { board, best: 'bronze', claims: [] }])),
      firstPrimaryCompletions: Object.fromEntries(played.map((board) => [firstCompletionKey(board), { board, requiredSet: v1Set }])),
      milestones: Object.fromEntries([10, 20].map((n) => [milestoneKey(v1, n), { requiredSet: v1Set, completedCount: n, notificationHandled: true }])) })
    expect(Object.keys(facts.boards)).toHaveLength(28)
    expect(facts.milestones[milestoneKey(v1, 20)]?.completedCount).toBe(20)
    // The current set counts only the overlap, and backfills its own count.
    const overlap = played.filter((board) => inV2.has(boardKey(board))).length
    expect(facts.milestones[milestoneKey(CITY1_REQUIRED_SET, 10)] !== undefined).toBe(overlap >= 10)
    // A completion claiming a set its board was never in is still refused.
    const outsider = played.find((board) => !inV2.has(boardKey(board)))!
    expect(() => validateProgressFacts({ ...emptyProgressFacts(),
      boards: { [boardKey(outsider)]: { board: outsider, best: 'bronze', claims: [] } },
      firstPrimaryCompletions: { [firstCompletionKey(outsider)]: { board: outsider, requiredSet: CITY1_REQUIRED_SET } } })).toThrow('Unproven primary completion')
  })

  it('CW-03b a save with completed losses still proves its stored city achievement, and its losses show Bronze', () => {
    const required = CITY1_REQUIRED_SET
    const set = { courseId: required.courseId, cityId: required.cityId, setVersion: required.setVersion }
    const won = (boards: typeof required.boards) => ({
      boards: Object.fromEntries(boards.map((board) => [boardKey(board), { board, best: 'silver', claims: ['spinWin'] }])),
      firstPrimaryCompletions: Object.fromEntries(boards.map((board) => [firstCompletionKey(board), { board, requiredSet: set }])),
    })
    const lost = (boards: typeof required.boards, firstPrimary: boolean) =>
      Object.fromEntries(boards.map((board) => [boardKey(board), { board, firstPrimary }]))
    // Every café won at Silver (the stored Silver achievement), three of them also lost on a replay.
    const everyCafe = validateProgressFacts({ ...emptyProgressFacts(), ...won(required.boards),
      completedLosses: lost(required.boards.slice(0, 3), false),
      cityAchievements: { [requiredSetKey(set)]: { requiredSet: set, tier: 'silver' } } })
    expect(Object.values(everyCafe.cityAchievements).map((fact) => fact.tier)).toEqual(['silver'])
    // A loss never lowers a better stamp: 100 Silver stamps, 50%.
    expect(cityMedal(everyCafe, required)).toMatchObject({ tier: 'silver', stamped: 100, points: 200, percent: 50 })

    // 97 won, 3 only ever lost (the owner's kind of save): no stored achievement is claimed,
    // and the losses are Bronze on the card: 97 x 2 + 3 = 197 of 400.
    const someLost = validateProgressFacts({ ...emptyProgressFacts(), ...won(required.boards.slice(3)),
      completedLosses: lost(required.boards.slice(0, 3), true) })
    expect(someLost.boards[boardKey(required.boards[0]!)]).toBeUndefined()
    expect(cityMedal(someLost, required)).toMatchObject({ tier: 'bronze', stamped: 100, points: 197 })
    // The read-time Bronze is not a stored best, so it cannot prove a stored city achievement
    // (settlement never writes one there either): the backup proof is unchanged.
    expect(() => validateProgressFacts({ ...someLost, cityAchievements: { [requiredSetKey(set)]: { requiredSet: set, tier: 'bronze' } } }))
      .toThrow('Unproven city achievement')
  })

  it('keeps legacy sessions bound to Danish while the active learner course is German', () => {
    const planned = planLegacySessions(legacyRound(), emptyProgressFacts(), 'de', 'fixed-german-boot-id')
    expect(planned.sessions.continuation.requiredSet).toMatchObject({ courseId: 'da', cityId: 'sonderborg' })
    expect(planned.sessions.primary).toBeNull()
  })

  it('anchors a compatible active board, preserves exact state and includes all earlier unproven boards', () => {
    const old = legacyRound()
    const planned = planLegacySessions(old, emptyProgressFacts(), 'da', 'fixed-id')
    expect(planned.sessions.primary).toMatchObject({ attemptId: 'fixed-id', game: old.game, promptLanguage: 'de', lookedUp: old.lookedUp })
    expect(planned.sessions.continuation.remainingBoardKeys).toHaveLength(100)
    expect(planned.sessions.continuation.remainingBoardKeys[0]).toBe(boardKey(CITY1_REQUIRED_SET.boards[4]))
    expect(planned.sessions.continuation.remainingBoardKeys[1]).toBe(boardKey(CITY1_REQUIRED_SET.boards[0]))
    expect(planned.retired).toBe(false)
  })

  it('recovers one parked normal board behind a retired packing round, with no extra slot', () => {
    const parked = legacyRound()
    const old = { ...legacyRound(1), mode: 'wrapup', packingDone: false, parked }
    const planned = planLegacySessions(old, emptyProgressFacts(), 'da', 'fixed-id')
    expect(planned.sessions.primary?.game).toEqual(parked.game)
    expect(planned.sessions.replay).toBeNull()
    expect(planned.retired).toBe(true)
    expect(planned.evidence.parked).toMatchObject({ game: parked.game })
  })

  it('preserves a real-engine partial translation wheel with random fills unrelated to word indices', () => {
    const old = legacyRound()
    const game: GameState = { ...old.game, phase: 'translateChallenge', reveals: Object.fromEntries(old.game.words.map(({ wordId }) =>
      [wordId, { kind: old.game.playerKey[wordId] === 'green' || old.game.aiKey[wordId] === 'green' ? 'green' : 'hidden' }])) }
    const opened = applyEvent(game, { type: 'START_TRANSLATE_CHALLENGE' }, packFor('da'))
    const translate = (index: number) => {
      const word = opened.words.find(word => word.wordId === opened.wheel!.segments[index])!
      return applyEvent(opened, { type: 'SUBMIT_TRANSLATION', wordId: word.wordId, answer: word.da }, packFor('da'))
    }
    const first = translate(0)
    const partial = first.wheel!.filled[0] === 0 ? translate(1) : first
    expect(partial.wheel!.filled[0]).not.toBe(partial.wheel!.segments.indexOf(partial.wheel!.translated[0]))
    const plan = planLegacySessions({ ...old, game: partial }, emptyProgressFacts(), 'da', 'partial-wheel')
    expect(plan.retired).toBe(false)
    expect(plan.sessions.primary!.game).toEqual(partial)
    const invalid = { ...partial, wheel: { ...partial.wheel!, filled: [] } }
    expect(planLegacySessions({ ...old, game: invalid }, emptyProgressFacts(), 'da', 'bad-fill').retired).toBe(true)
  })

  it('keeps the active compatible ordinary candidate when two are present', () => {
    const old = { ...legacyRound(), parked: legacyRound(5) }
    const plan = planLegacySessions(old, emptyProgressFacts(), 'da', 'fixed-id')
    expect(plan.sessions.primary?.board.authoredBoardId).toBe(old.authoredBoardId)
    expect(plan.retired).toBe(true)
  })

  it.each(['removed', 'unknown', 'content', 'stamp', 'daily', 'foreign', 'wrapup', 'tutorial', 'finished-recorded', 'finished-unrecorded'])('retires %s once without fabricating history or skipping a board', (kind) => {
    const old: Record<string, unknown> = legacyRound()
    if (kind === 'removed') {
      const index = CITY1_BOARD_CYCLE.findIndex((item) => !CITY1_REQUIRED_SET.boards.some((board) => board.authoredBoardId === item.id))
      old.game = dealCity1AuthoredBoard(index).game; old.authoredBoardId = CITY1_BOARD_CYCLE[index].id
    }
    if (kind === 'unknown') old.authoredBoardId = 'missing'
    if (kind === 'content') old.game = { ...legacyRound().game, playerKey: {} }
    if (kind === 'stamp') delete old.gameUiLanguage
    if (kind === 'daily') old.dailyKey = '2026-09-20'
    if (kind === 'foreign') old.gameLanguage = 'de'
    if (kind === 'wrapup' || kind === 'tutorial') old.mode = kind
    if (kind.startsWith('finished')) { old.game = { ...legacyRound().game, phase: 'finished', outcome: { result: 'won', reason: 'all-greens' } }; old.roundRecorded = kind === 'finished-recorded' }
    const planned = planLegacySessions(old, emptyProgressFacts(), 'da', 'fixed-id')
    expect(planned.retired).toBe(true)
    expect(planned.sessions.primary).toBeNull()
    expect(planned.sessions.continuation.remainingBoardKeys).toEqual(CITY1_REQUIRED_SET.boards.map(boardKey))
    expect(planned.evidence.game).toEqual(old.game)
    const migrated = migrateGame(old, 15) as Record<string, unknown>
    migrateLegacyProfile(storage, migrated, 'da', NOW)
    const bytes = values.get(SAVE_MIGRATION_KEY)
    migrateLegacyProfile(storage, migrated, 'da', NOW + 1)
    expect(values.get(SAVE_MIGRATION_KEY)).toBe(bytes)
    expect(adapter().readLedger().facts.boards).toEqual({})
  })

  it('retains old wrapped/banked provenance without adding directional evidence or medals', () => {
    const word = newStats(NOW)
    const srs = migrateSrs({ stats: { 'da:hus': word }, games: { won: 90 }, translationPostcards: 4 }, 6) as { stats: Record<string, typeof word> }
    const journey = migrateJourney({ banked: { 'da:hus': 123 }, cityIndex: 5, arrivedAt: {} }, 2) as { wrapped: Record<string, number> }
    expect(journey.wrapped).toEqual({ 'da:hus': 123 })
    expect(srs.stats['da:hus'].greenByClue).toBe(0)
    expect(srs.stats['da:hus'].greenByGuess).toBe(0)
    expect(provenLegacyEligibility(journey.wrapped)).toEqual({})
    const full = Object.fromEntries(packFor('da').rosters[0].map((id) => [id, NOW]))
    expect(provenLegacyEligibility(full)).toEqual({ [cityKey({ courseId: 'da', cityId: 'sonderborg' })]: true })
    delete full[packFor('da').rosters[0][0]]
    expect(provenLegacyEligibility(full)).toEqual({})
  })

  it('archives an unfinished current slot missing its prompt stamp without moving the queue', async () => {
    useGame.getState().newGame()
    const sessions = adapter().readSessions().byCourse.da
    const raw = read(SESSION_KEY)
    delete raw.state.byCourse.da.primary.promptLanguage
    values.set(SESSION_KEY, JSON.stringify(raw))
    await useGame.getState().recoverSession()
    const after = adapter().readSessions().byCourse.da
    expect(after.primary).toBeNull()
    expect(after.continuation).toEqual(sessions.continuation)
    expect(useGame.getState().migrationNotice).toBe(true)
    expect(adapter().readLedger().facts.boards).toEqual({})
    useGame.getState().dismissMigrationNotice()
    await useGame.getState().recoverSession()
    expect(useGame.getState().migrationNotice).toBe(false)
  })

  it('exports legacy terminal recovery evidence as inert whitelisted data and preserves it across merge/reset/reimport', async () => {
    const old = { ...legacyRound(), game: { ...legacyRound().game, phase: 'finished', outcome: { result: 'won', reason: 'all-greens' }, apiKey: 'secret' }, roundRecorded: false }
    useGame.setState(migrateGame(old, 15) as Parameters<typeof useGame.setState>[0])
    await useGame.getState().recoverSession()
    const file = parsed(JSON.parse(backupText(NOW)))
    expect(file.recovery).toHaveLength(1)
    expect(file.recovery[0].evidence.game?.phase).toBe('finished')
    expect(JSON.stringify(file)).not.toContain('secret')
    expect(JSON.stringify(file)).not.toContain('apiKey')
    await restore(file, 'merge'); await restore(file, 'merge')
    expect(parsed(JSON.parse(backupText(NOW))).recovery).toEqual(file.recovery)
    await resetCollection(); await restore(file, 'replace')
    expect(parsed(JSON.parse(backupText(NOW))).recovery).toEqual(file.recovery)
    expect(adapter().readLedger().settlements).toEqual({})
    expect(useSrs.getState().games.played).toBe(0)
  })
})

describe('C1-06 AC24/25/26 actual restore and reset', () => {
  it.each([1, 2, 3])('recovers every validated destination of a format-%s restore after interruption', async format => {
    const file = parsed({ ...buildBackup(snapshot({ translationPostcards: 7 }), NOW), format })
    failKey = 'cluecab-curriculum-v1'; faultOnlyDuringTransfer = true
    await expect(restore(file, 'replace')).rejects.toThrow()
    const writes = read(SAVE_TRANSFER_KEY).writes as { key: string; value: string }[]
    failKey = null; recoverSaveTransfer(storage)
    for (const write of writes) expect(values.get(write.key)).toBe(write.value)
    const durable = [...values]
    recoverSaveTransfer(storage)
    expect([...values]).toEqual(durable)
    await useGame.getState().recoverSession()
    expect(adapter().readLedger().facts.legacyCredit.amount).toBe(7)
  })

  it('preserves a real completed receipt and result through interrupted merge without replay', async () => {
    useGame.getState().newGame()
    useGame.setState({ game: { ...useGame.getState().game!, phase: 'suddenDeath', turnsLeft: 0 } })
    useGame.getState().playerStop()
    await useGame.getState().finishRound()
    expect(useGame.getState().settlementFailure).toBeNull()
    const receipts = adapter().readLedger().settlements
    const results = adapter().readSessions().results
    expect(Object.keys(receipts)).toHaveLength(1)
    const file = parsed(JSON.parse(backupText(NOW)))
    failKey = 'cluecab-curriculum-v1'; faultOnlyDuringTransfer = true
    await expect(restore(file, 'merge')).rejects.toThrow()
    failKey = null; recoverSaveTransfer(storage)
    await restore(file, 'merge')
    expect(adapter().readLedger().settlements).toEqual(receipts)
    expect(adapter().readSessions().results).toEqual(results)
    expect(useSrs.getState().games.played).toBe(1)
  })

  it('keeps exact primary/replay slots when imported facts already complete the primary', async () => {
    await restore(buildBackup(snapshot({ progress: factsWith(1) }), NOW), 'replace')
    // The file found no cafés; the next board must be found to be dealt (CW-04).
    useJourney.setState({ cafes: everyCafeFound() })
    expect(useGame.getState().newGame()).toBe(true)
    const before = adapter().readSessions().byCourse.da
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    const both = adapter().readSessions().byCourse.da
    await restore(buildBackup(snapshot({ progress: factsWith(10) }), NOW), 'merge')
    const after = adapter().readSessions().byCourse.da
    expect(after.primary).toEqual(before.primary)
    expect(after.replay).toEqual(both.replay)
    expect(after.continuation).toEqual(before.continuation)
    expect(Object.keys(adapter().readLedger().facts.firstPrimaryCompletions)).toHaveLength(10)
  })

  it('reconciles lesson availability using exact milestones and both-store consumption', async () => {
    const facts = factsWith(10)
    const milestone = milestoneKey(CITY1_REQUIRED_SET, 10)
    useCurriculum.setState({ byLanguage: { da: { ...initialCurriculumProgress('da'), itemStates: { 'sonderborg-notice': 'completed' } } }, settlementMilestones: { [milestone]: 1 } })
    useSurvival.setState({ byLanguage: { da: initialSurvivalProgress('da') }, settlementMilestones: {} })
    const file = buildBackup(snapshot({ progress: facts }), NOW)
    await restore(file, 'merge'); await restore(file, 'merge')
    expect(useCurriculum.getState().byLanguage.da.itemStates['sonderborg-notice']).toBe('completed')
    expect(useSurvival.getState().byLanguage.da?.exchanges['sonderborg-situation-1']).toEqual({ unlockedAt: NOW, replayedAt: [] })
    expect(useSurvival.getState().settlementMilestones[milestone]).toBe(NOW)
    expect(adapter().readLedger().facts.milestones[milestone].notificationHandled).toBe(true)
    expect(useGame.getState().completionReceipt).toBeNull()
  })

  it('repairs the opposite partial lesson destination without changing Survival completion or unlocking slot two', async () => {
    const milestone = milestoneKey(CITY1_REQUIRED_SET, 10)
    const completed = { unlockedAt: 3, firstCompletedAt: 7, replayedAt: [9] }
    useCurriculum.setState({ byLanguage: { da: initialCurriculumProgress('da') }, settlementMilestones: {} })
    useSurvival.setState({ byLanguage: { da: { ...initialSurvivalProgress('da'), exchanges: { 'sonderborg-situation-1': completed } } }, settlementMilestones: { [milestone]: 3 } })
    await restore(buildBackup(snapshot({ progress: factsWith(10) }), NOW), 'merge')
    await restore(oldFile(2), 'merge')
    expect(useSurvival.getState().byLanguage.da!.exchanges).toEqual({ 'sonderborg-situation-1': completed })
    expect(useCurriculum.getState().byLanguage.da.itemStates).toMatchObject({ 'sonderborg-notice': 'available' })
    expect(Object.values(useCurriculum.getState().byLanguage.da.itemStates).filter(s => s === 'available')).toHaveLength(1)
    expect(useCurriculum.getState().settlementMilestones[milestone]).toBe(NOW)
    expect(useGame.getState().completionReceipt).toBeNull()
  })

  it('round-trips new claims and completed/deferred lessons through reset without effect replay', async () => {
    await restore(buildBackup(snapshot({ progress: factsWith(10, ['spinWin']), translationPostcards: 999,
      learning: { curriculum: { da: { ...initialCurriculumProgress('da'), itemStates: { 'sonderborg-notice': 'completed', 'sonderborg-discriminate': 'deferred' } } }, survival: {} } }), NOW), 'replace')
    const file = parsed(JSON.parse(backupText(NOW)))
    expect(file.progress.legacyCredit.amount).toBe(0)
    useSrs.setState({ settlementEffects: { old: 'old' } }); useAssociations.setState({ settlementEffects: { old: 'old' } }); useStreak.setState({ settlementEffects: { old: 'old' } })
    await resetCollection()
    expect(adapter().readLedger().facts).toEqual(emptyProgressFacts())
    expect(adapter().readLedger().settlements).toEqual({})
    expect(useSrs.getState().settlementEffects).toEqual({})
    expect(useStreak.getState().settlementEffects).toEqual({})
    expect(useAssociations.getState().settlementEffects).toEqual({})
    expect(useCurriculum.getState().settlementMilestones).toEqual({})
    await restore(file, 'merge'); await restore(file, 'merge')
    expect(readSnapshot().progress).toEqual(file.progress)
    expect(useCurriculum.getState().byLanguage.da.itemStates).toMatchObject({ 'sonderborg-notice': 'completed', 'sonderborg-discriminate': 'deferred' })
    expect(adapter().readLedger().settlements).toEqual({})
    expect(useSrs.getState().games.played).toBe(0)
  })

  it('rejects an invalid import at the boundary without changing even one stored byte', async () => {
    const file = buildBackup(snapshot(), NOW)
    file.progress = { ...factsWith(1), boards: { malicious: { board: CITY1_REQUIRED_SET.boards[0], best: 'platinum', claims: [] } } }
    const before = [...values]
    await expect(restore(file, 'merge')).rejects.toThrow()
    expect([...values]).toEqual(before)
  })

  it.each([false, true])('journal survives a partial destination write (committed=%s), blocks play and recovers identical facts', async (committed) => {
    afterWrite = committed; failKey = 'cluecab-curriculum-v1'
    await expect(restore(buildBackup(snapshot({ progress: factsWith(10) }), NOW), 'replace')).rejects.toThrow()
    expect(values.get(SAVE_TRANSFER_KEY)).not.toBe('null')
    expect(() => assertSettlementIdle(storage)).toThrow('save transfer')
    failKey = null; recoverSaveTransfer(storage)
    await useGame.getState().recoverSession()
    expect(adapter().readLedger().facts).toEqual(factsWith(10))
    expect(read('cluecab-survival-v1').state.byLanguage.da.exchanges['sonderborg-situation-1']).toBeDefined()
  })

  it.each(['cluecab-srs-v1', 'cluecab-journey-v2', 'cluecab-curriculum-v1', 'cluecab-survival-v1',
    'cluecab-settlement-v1', 'cluecab-progression-sessions-v1', SAVE_MIGRATION_KEY, 'cluecab-game-v1', SAVE_TRANSFER_KEY])(
    'faults before and after the import write to %s recover the same complete snapshot', async (key) => {
      for (const committed of [false, true]) {
        failKey = null; faultOnlyDuringTransfer = false
        await resetCollection()
        const file = buildBackup(snapshot({ progress: factsWith(10, ['spinWin']) }), NOW)
        failKey = key; afterWrite = committed; faultOnlyDuringTransfer = true
        await expect(restore(file, 'replace')).rejects.toThrow()
        failKey = null; recoverSaveTransfer(storage)
        await restore(file, 'merge')
        expect(adapter().readLedger().facts).toEqual(file.progress)
        expect(useCurriculum.getState().byLanguage.da.itemStates['sonderborg-notice']).toBe('available')
        expect(Object.keys(useSurvival.getState().byLanguage.da!.exchanges)).toEqual(['sonderborg-situation-1'])
        expect(adapter().readSessions().byCourse.da.continuation.remainingBoardKeys).toHaveLength(90)
      }
    })

  it('restores old developer position only as history and cannot enter an unavailable destination', async () => {
    const file = oldFile(100, 'de')
    file.journey.cityIndex = 8; file.journey.furthest = 8
    await restore(file, 'replace')
    expect(useJourney.getState().cityIndex).toBe(0)
    expect(useJourney.getState().historicalTravelEligibility).toEqual({})
    expect(useJourney.getState().parked.de?.cityIndex).toBe(8)
    expect(earnedPostcards(adapter().readLedger().facts, { courseId: 'de', cityId: 'berlin' })).toBe(0)
    expect(useSettings.getState().playtestTravel).not.toBe(true)
  })

  it('export waits for same-page legacy credit recovery and preserves pre-clamp route history', async () => {
    useSrs.setState({ translationPostcards: 3 })
    useJourney.setState({ cityIndex: 2, furthest: 2, arrivedAt: { 2: NOW } })
    const exported = parsed(JSON.parse(await prepareBackupText(NOW)))
    expect(exported.srs.translationPostcards).toBe(3)
    expect(exported.journey.cityIndex).toBe(0)
    expect(exported.journey.historicalRoutes?.da?.cityIndex).toBe(2)
    expect(exported.journey.historicalTravelEligibility).toEqual({})
  })

  it.each([false, true])('same-page retry preserves repaired SRS/lessons even when completion wrote then threw (%s)', async (committed) => {
    const file = buildBackup(snapshot({ stats: { 'da:hus': { ...newStats(NOW), greenByClue: 1, greenByGuess: 1 } }, progress: factsWith(10) }), NOW)
    failKey = committed ? SAVE_TRANSFER_KEY : 'cluecab-journey-v2'; afterWrite = committed; faultOnlyDuringTransfer = true
    await expect(restore(file, 'replace')).rejects.toThrow()
    failKey = null
    // Do not manually hydrate and do not import the source again: this is the
    // player's next unrelated merge against the recovered on-disk collection.
    await restore(oldFile(4), 'merge')
    expect(useSrs.getState().stats['da:hus']).toEqual(file.srs.stats['da:hus'])
    expect(Object.keys(adapter().readLedger().facts.boards)).toHaveLength(10)
    expect(useCurriculum.getState().byLanguage.da.itemStates['sonderborg-notice']).toBe('available')
    expect(Object.keys(useSurvival.getState().byLanguage.da!.exchanges)).toEqual(['sonderborg-situation-1'])
  })

  it('reset/replace clear only exact local daily keys, merge preserves them, and interrupted clears retry', async () => {
    const { readDailyOutcome } = await import('../stores/settlementStore')
    const valid = ['cluecab-daily:2026-09-19', 'cluecab-daily:2026-09-20']
    const neighbors = ['cluecab-daily:2026-09-20-extra', 'cluecab-daily:2026-02-30', 'cluecab-daily:credentials', 'cluecab-daily:2026-9-20']
    const seedDaily = () => { values.set(valid[0], 'won'); seed(valid[1], 1, { outcome: 'lost', settlementEffects: { old: 'old' } }); neighbors.forEach((key) => values.set(key, 'retain')) }
    seedDaily()
    await restore(oldFile(3), 'merge')
    expect(readDailyOutcome(storage, '2026-09-19')).toBe('won')
    expect(read(valid[1]).state.settlementEffects).toEqual({ old: 'old' })
    expect(backupText(NOW)).not.toContain('cluecab-daily')
    await restore(oldFile(3), 'replace')
    for (const key of valid) expect(read(key).state).toEqual({ outcome: null, settlementEffects: {} })
    seedDaily(); failKey = valid[1]; afterWrite = true; faultOnlyDuringTransfer = true
    await expect(resetCollection()).rejects.toThrow()
    failKey = null; await resetCollection(); await resetCollection()
    expect(readDailyOutcome(storage, '2026-09-19')).toBeNull()
    for (const key of valid) expect(read(key).state).toEqual({ outcome: null, settlementEffects: {} })
    for (const key of neighbors) expect(values.get(key)).toBe('retain')
  })

  it('merge preserves nonportable streak/association histories and markers; replace and reset clear both', async () => {
    const seedHistory = () => {
      useStreak.setState({ completedDays: { '2026-09-19': 3 }, settlementEffects: { streak: 'old' } })
      useAssociations.setState({ groups: { test: { ids: ['da:hus', 'da:bil'], by: 'player', count: 2, lastAt: NOW } }, traps: { test: ['da:bil'] }, settlementEffects: { association: 'old' } })
    }
    seedHistory()
    const before = { streak: values.get('cluecab-streak-v1'), associations: values.get('cluecab-associations-v1') }
    await restore(oldFile(4), 'merge')
    expect(values.get('cluecab-streak-v1')).toBe(before.streak)
    expect(values.get('cluecab-associations-v1')).toBe(before.associations)
    await restore(oldFile(4), 'replace')
    expect(useStreak.getState().completedDays).toEqual({})
    expect(useStreak.getState().settlementEffects).toEqual({})
    expect(useAssociations.getState().groups).toEqual({})
    expect(useAssociations.getState().traps).toEqual({})
    expect(useAssociations.getState().settlementEffects).toEqual({})
    seedHistory(); await resetCollection()
    expect(useStreak.getState().completedDays).toEqual({})
    expect(useAssociations.getState().settlementEffects).toEqual({})
  })

  it.each(['{broken', 'null', '[]', '{"version":2,"migratedAt":1}', '{"version":1,"migratedAt":1,"legacyCreditSource":-1}'])(
    'malformed migration metadata stays intact and exports fail closed: %s', async raw => {
      values.set(SAVE_MIGRATION_KEY, raw)
      expect(() => readSaveMigration(storage)).toThrow()
      const original = values.get(SAVE_MIGRATION_KEY)
      await expect(prepareBackupText(NOW)).rejects.toThrow()
      expect(values.get(SAVE_MIGRATION_KEY)).toBe(original)
      expect(() => assertSettlementIdle(storage)).toThrow()
      values.delete(SAVE_MIGRATION_KEY)
      await expect(prepareBackupText(NOW)).resolves.toContain('cluecabulary')
    })

  it.each(['{broken', 'null-no', '{}', '{"version":1,"writes":[{"key":"cluecab-settings-v1","value":"bad"}],"fingerprint":"00000000"}',
    '{"version":1,"writes":[{"key":"cluecab-daily:2026-09-20-extra","value":"bad"}],"fingerprint":"00000000"}',
    '{"version":1,"writes":[{"key":"cluecab-srs-v1","value":"bad"},{"key":"cluecab-srs-v1","value":"worse"}],"fingerprint":"00000000"}'])(
    'malformed journal is rejected before any destination write: %s', raw => {
      values.set(SAVE_TRANSFER_KEY, raw)
      const before = [...values]
      expect(() => recoverSaveTransfer(storage)).toThrow()
      expect([...values]).toEqual(before)
      values.delete(SAVE_TRANSFER_KEY)
    })

  it('rejects malformed planned values and later journal corruption before any destination write', async () => {
    const original = [...values]
    expect(() => commitSaveTransfer(storage, [{ key: 'cluecab-srs-v1', value: 'broken-json' }])).toThrow()
    expect([...values]).toEqual(original)
    failKey = 'cluecab-curriculum-v1'; faultOnlyDuringTransfer = true
    await expect(restore(oldFile(3), 'replace')).rejects.toThrow()
    failKey = null
    const journal = read(SAVE_TRANSFER_KEY)
    journal.writes[0].value = JSON.stringify({ version: 7, state: { stats: {} } })
    values.set(SAVE_TRANSFER_KEY, JSON.stringify(journal))
    const before = [...values]
    expect(() => recoverSaveTransfer(storage)).toThrow('integrity')
    expect([...values]).toEqual(before)
    values.delete(SAVE_TRANSFER_KEY)
  })

  it('achievement/claim merge is associative, commutative and idempotent', () => {
    const a = snapshot({ progress: factsWith(1, ['spinWin']) })
    const b = buildBackup(snapshot({ progress: factsWith(2, ['solved']) }), NOW)
    const c = buildBackup(snapshot({ progress: factsWith(3, ['spinWin', 'solved', 'solvedAndTranslated']) }), NOW)
    const ab = mergeSnapshot(a, b)
    expect(ab.progress).toEqual(mergeSnapshot(snapshot({ progress: b.progress }), buildBackup(a, NOW)).progress)
    expect(mergeSnapshot(ab, b).progress).toEqual(ab.progress)
    expect(mergeSnapshot(ab, c).progress).toEqual(mergeSnapshot(a, buildBackup(mergeSnapshot(snapshot({ progress: b.progress }), c), NOW)).progress)
  })
})

describe('CW-04 café finds through an actual export, reset and restore', () => {
  it('replace brings the finds back into the whole rewritten journey key; an old file merged in keeps them', async () => {
    const cafes = { [JSON.stringify(['da', 'sonderborg'])]: { found: { [CITY1_REQUIRED_SET.boards[0]!.authoredBoardId]: NOW }, toward: 3 } }
    useJourney.setState({ cafes })
    const file = parsed(JSON.parse(backupText(NOW)))
    expect(file.journey.cafes).toEqual(cafes)
    await resetCollection()
    expect(useJourney.getState().cafes).toEqual({})
    await restore(file, 'replace')
    expect(useJourney.getState().cafes).toEqual(cafes)
    const stored = read('cluecab-journey-v2').state
    expect(stored.cafes).toEqual(cafes)
    for (const route of [...Object.values(stored.parked), ...Object.values(stored.historicalRoutes)]) expect(route).not.toHaveProperty('cafes')
    await restore(oldFile(0), 'merge')
    expect(useJourney.getState().cafes).toEqual(cafes)
  })

  it('CW-07 the train ticket survives export, reset and replace, stays out of route history, and an old file merged in keeps it', async () => {
    const city = { courseId: 'da' as const, cityId: 'sonderborg' }
    const trainRuns = { [cityKey(city)]: { city, passed: true, at: NOW, words: 147, photos: 140, slips: 7, allowed: 8 } }
    useJourney.setState({ trainRuns })
    const file = parsed(JSON.parse(backupText(NOW)))
    expect(file.journey.trainRuns).toEqual(trainRuns)
    await resetCollection()
    expect(useJourney.getState().trainRuns).toEqual({})
    await restore(file, 'replace')
    expect(useJourney.getState().trainRuns).toEqual(trainRuns)
    const stored = read('cluecab-journey-v2').state
    expect(stored.trainRuns).toEqual(trainRuns)
    for (const route of [...Object.values(stored.parked), ...Object.values(stored.historicalRoutes)]) expect(route).not.toHaveProperty('trainRuns')
    await restore(oldFile(0), 'merge')
    expect(useJourney.getState().trainRuns).toEqual(trainRuns)
  })
})

// Reproducible, synthetic fixtures for the fresh-built local browser drive.
// File output is an opt-in test artifact, never a source or user-save rewrite.
afterAll(async () => {
  if (process.env.C1_MIGRATION_FIXTURES !== '1') return
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const round = legacyRound()
  const fixtures: Record<string, Record<string, string>> = Object.fromEntries(Object.entries({
    active: round,
    parked: { ...round, mode: 'wrapup', parked: round },
    removed: { ...round, authoredBoardId: 'removed-old-board' },
    'finished-not-recorded': { ...round, game: { ...round.game, phase: 'finished', outcome: { result: 'lost', reason: 'timeout' } } },
  }).map(([name, state]) => [name, {
    'cluecab-game-v1': JSON.stringify({ version: 15, state }),
    'cluecab-srs-v1': JSON.stringify({ version: 5, state: { stats: { 'da:hus': { ...newStats(NOW), greenByClue: 1, greenByGuess: 1 } }, games: { played: 11, won: 3, redeemed: 0, lost: 8 }, translationJokers: 7 } }),
    'cluecab-journey-v2': JSON.stringify({ version: 6, state: { cityIndex: 2, furthest: 2, wrapped: { 'da:hus': NOW }, arrivedAt: { 2: NOW }, routeLanguage: 'da', parked: {} } }),
    'cluecab-settings-v1': JSON.stringify({ version: 18, state: { useMock: true, dataSharing: 'private' } }),
  }]))
  failKey = null; faultOnlyDuringTransfer = false
  await resetCollection()
  failKey = 'cluecab-curriculum-v1'; faultOnlyDuringTransfer = true
  await expect(restore(buildBackup(snapshot({ progress: factsWith(10, ['spinWin']) }), NOW), 'replace')).rejects.toThrow()
  fixtures['valid-transfer'] = Object.fromEntries(values)
  failKey = null; faultOnlyDuringTransfer = false
  recoverSaveTransfer(storage)
  mkdirSync('tmp/c1-06', { recursive: true })
  writeFileSync('tmp/c1-06/fixtures.json', JSON.stringify({ fixtures, board: CITY1_REQUIRED_SET.boards[4], remaining: CITY1_REQUIRED_SET.boards.map(boardKey), game: round.game,
    milestoneFile: buildBackup(snapshot({ progress: factsWith(10, ['spinWin']), stats: { 'da:hus': { ...newStats(NOW), greenByClue: 1, greenByGuess: 1 } } }), NOW) }, null, 2))
})
