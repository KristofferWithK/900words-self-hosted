import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrimaryContinuation, earnedPostcards, emptyProgressFacts } from '../progression/facts'
import { FIXTURE_BOARD, FIXTURE_SET, MATRIX_FIXTURES, settlementFixture } from '../progression/fixtures'
import { boardKey, firstCompletionKey, receiptKey } from '../progression/identity'
import { pendingSettlement } from '../progression/settlement'
import type { CourseSessions, RequiredBoardSet } from '../progression/types'
import { initialCurriculumProgress, offerAfterWrap } from '../journey/curriculumScheduler'
import { initialSurvivalProgress, unlockSurvivalAfterWrap } from '../journey/survival'
import { danishCurriculum } from '../lang/da/curriculum'
import { activeSurvivalGuide } from '../lang/bookshelf'
import { newStats } from '../srs/scheduler'
import { isCollected } from '../journey/progress'
import type { FinishInput, LessonPlanningInput } from './settlementStore'

class AtomicDisk {
  data = new Map<string, string>()
  writes: string[] = []
  reads: string[] = []
  fault: { at: number; after: boolean } | null = null
  getItem(key: string) { this.reads.push(key); return this.data.get(key) ?? null }
  setItem(key: string, value: string) {
    this.writes.push(key)
    const fail = this.fault?.at === this.writes.length
    if (fail && !this.fault!.after) throw new Error('before write')
    this.data.set(key, value)
    if (fail) throw new Error('after write')
  }
  removeItem(key: string) { this.data.delete(key) }
}

// Install before importing Zustand stores so tests exercise real middleware,
// durable rehydration and published state as well as serialized JSON.
const disk = new AtomicDisk()
vi.stubGlobal('localStorage', disk)
vi.stubGlobal('window', { localStorage: disk })
const { createSettlementStore, readDailyOutcome } = await import('./settlementStore')
const { SETTLEMENT_KEY, SESSION_KEY, assertSettlementIdle } = await import('./settlementStorage')
const { useSrs } = await import('./srsStore')
const { useStreak } = await import('../streak/streak')
const { useAssociations } = await import('./associationStore')
const { useCurriculum } = await import('./curriculumStore')
const { useSurvival } = await import('./survivalStore')
const { useJourney } = await import('./journeyStore')
const oldSrs = { stats: { a: { ...newStats(100), greenByGuess: 1 } }, games: { played: 7, won: 4, lost: 2, redeemed: 1 }, translationPostcards: 12 }
const oldJourney = { wrapped: { n: 50 }, cityIndex: 0, arrivedAt: { 0: 20 }, routeLanguage: 'da', parked: {}, furthest: 0 }

function lessonPlan({ receipt, curriculum, survival }: LessonPlanningInput) {
  return { courseId: 'da' as const,
    curriculum: { before: curriculum, after: offerAfterWrap(danishCurriculum, curriculum ?? initialCurriculumProgress('da'), 0, receipt.acceptedAt) },
    survival: { before: survival, after: unlockSurvivalAfterWrap(activeSurvivalGuide, survival ?? initialSurvivalProgress('da'), 0, receipt.acceptedAt) },
  }
}

function inputFor(origin: 'primary' | 'daily' | 'replay' | 'tutorial' | 'optional' | 'developer' = 'primary', row = 5, attemptId = 'attempt-1'): FinishInput {
  const input = settlementFixture(MATRIX_FIXTURES[row].game)
  input.attempt.game.clueHistory = [{ by: 'player', text: 'example', number: 2,
    guesses: [{ wordId: 'a', result: 'green' }, { wordId: 'b', result: 'green' }] }]
  return { ...input, attempt: { ...input.attempt, attemptId, origin }, lookedUp: [], dailyKey: '2026-09-19' }
}

function sessionsFor(input: FinishInput, required = input.required!): CourseSessions {
  const slot = { attemptId: input.attempt.attemptId, board: input.attempt.board!, origin: input.attempt.origin as 'primary' | 'replay',
    promptLanguage: 'en' as const, game: input.attempt.game, lookedUp: input.lookedUp, reviewRoundId: 'review-one', randomnessPolicy: 'engine-wheel-v1' as const }
  return { continuation: createPrimaryContinuation(required, emptyProgressFacts()), primary: slot.origin === 'primary' ? slot : null,
    replay: slot.origin === 'replay' ? slot : null, activeSlot: slot.origin }
}

function seed(key: string, version: number, state: unknown) { disk.data.set(key, JSON.stringify({ version, state })) }
function stored(key: string) { return JSON.parse(disk.data.get(key)!).state }

async function setup(kind: 'primary' | 'daily' | 'milestone' = 'primary') {
  disk.data.clear(); disk.writes = []; disk.reads = []; disk.fault = null
  seed('cluecab-srs-v1', 6, oldSrs)
  seed('cluecab-journey-v2', 5, oldJourney)
  seed('cluecab-streak-v1', 1, { completedDays: { '2026-09-18': 2 } })
  seed('cluecab-associations-v1', 1, { groups: { 'a|b': { ids: ['a', 'b'], by: 'player', count: 2, lastAt: 100 } }, traps: {} })
  seed('cluecab-curriculum-v1', 2, { byLanguage: { da: initialCurriculumProgress('da'), de: initialCurriculumProgress('de') } })
  seed('cluecab-survival-v1', 1, { byLanguage: { da: initialSurvivalProgress('da'), de: initialSurvivalProgress('de') } })
  let input = inputFor(kind === 'daily' ? 'daily' : 'primary')
  const publications: string[] = []
  const options = { storage: disk, planLessons: lessonPlan, published: (key: string) => { publications.push(key) } }
  const store = createSettlementStore(options)
  if (kind === 'milestone') {
    const boards = [...Array.from({ length: 9 }, (_, i) => ({ ...FIXTURE_BOARD, authoredBoardId: `prior-${i}` })), FIXTURE_BOARD]
    const required: RequiredBoardSet = { ...FIXTURE_SET, boards }
    const facts = { ...emptyProgressFacts(), firstPrimaryCompletions: Object.fromEntries(boards.slice(0, 9).map((board) => [firstCompletionKey(board), { board, requiredSet: required }])) }
    disk.data.set(SETTLEMENT_KEY, JSON.stringify({ schemaVersion: 1, facts, settlements: {} }))
    input = { ...input, required }
    store.saveSessions('da', { ...sessionsFor(input), continuation: createPrimaryContinuation(required, facts) })
  } else if (kind === 'primary') store.saveSessions('da', sessionsFor(input))
  for (const store of [useSrs, useStreak, useAssociations, useCurriculum, useSurvival]) await store.persist.rehydrate()
  disk.writes = []; disk.reads = []; publications.length = 0
  return { store, options, input, publications }
}

afterEach(() => { disk.fault = null; disk.data.clear() })

describe('C1-05 durable settlement across actual destination values', () => {
  it('AC09 persists receipt+facts first and publishes actual stores only after their atomic write', async () => {
    const { store, input } = await setup()
    const receipt = await store.finish(input)
    expect(disk.writes[0]).toBe(SETTLEMENT_KEY)
    expect(receipt).toMatchObject({ attemptTier: 'platinum', rewards: { postcards: 4 }, learning: { newlyCollected: ['a'] } })
    expect(useSrs.getState().stats.a).toMatchObject({ seen: 1, greenByClue: 1, greenByGuess: 1, lastSeenAt: input.acceptedAt })
    expect(useSrs.getState().games).toEqual({ played: 8, won: 5, lost: 2, redeemed: 1 })
    expect(useSrs.getState().translationPostcards).toBe(12) // no competing old reward path
    expect(useStreak.getState().completedDays).toEqual({ '2026-09-18': 2, '2026-09-19': 1 })
    expect(useAssociations.getState().groups['a|b'].count).toBe(3)
    expect(store.readSessions().byCourse.da.continuation.remainingBoardKeys).toEqual([])
    expect(store.readSessions().results[input.attempt.attemptId].receiptId).toBe(receipt.receiptId)
    expect(store.isFullyRecorded()).toBe(true)
    const writes = disk.writes.length
    const reloaded = createSettlementStore({ storage: disk })
    expect(await reloaded.finish({ ...input, acceptedAt: input.acceptedAt + 999 })).toEqual(receipt)
    await reloaded.recover()
    expect(disk.writes).toHaveLength(writes)
  })

  // 5 regular sinks: 11 writes. Daily adds sink+ack: 13. Milestone adds
  // grammar+survival+aggregate ack: 14. Every boundary fails both ways.
  for (const [kind, boundaries] of [['primary', 11], ['daily', 13], ['milestone', 14]] as const) {
    it.each(Array.from({ length: boundaries * 2 }, (_, n) => ({ at: Math.floor(n / 2) + 1, after: n % 2 === 1 })))
    (`AC10 ${kind}: failure at write $at, saved=$after, reload and retry exactly once`, async ({ at, after }) => {
      const { store, input, options, publications } = await setup(kind)
      disk.fault = { at, after }
      await expect(store.finish(input)).rejects.toThrow(after ? 'after write' : 'before write')
      expect(disk.writes).toHaveLength(at)
      expect(disk.reads.at(-1)).toBe(SETTLEMENT_KEY) // uncertain writes reread authority before returning
      expect(publications).toHaveLength(at - 1) // no publication from failed persistence
      const acceptedBeforeRetry = store.readLedger().settlements[receiptKey(input.attempt.attemptId)]?.receipt
      const rawLedger = disk.data.get(SETTLEMENT_KEY)
      if (at === 1 && !after) {
        expect(useSrs.getState().stats).toEqual(oldSrs.stats)
        expect(useSrs.getState().games).toEqual(oldSrs.games)
      } else if (!store.isFullyRecorded()) {
        expect(() => assertSettlementIdle(disk)).toThrow('Recover pending')
        const published = useSrs.getState().stats
        expect(() => useSrs.getState().recordRound([], 0)).toThrow('Recover pending')
        expect(() => useSrs.setState({ stats: {} })).toThrow('Recover pending')
        expect(useSrs.getState().stats).toBe(published)
      }
      expect(disk.data.get(SETTLEMENT_KEY)).toBe(rawLedger)
      disk.fault = null
      const reloaded = createSettlementStore(options)
      const receipt = await reloaded.finish({ ...input, acceptedAt: input.acceptedAt + (acceptedBeforeRetry ? 1234 : 0) })
      if (acceptedBeforeRetry) expect(receipt).toEqual(acceptedBeforeRetry)
      const snapshot = new Map(disk.data)
      await reloaded.finish(input)
      await reloaded.recover()
      expect(disk.data).toEqual(snapshot)
      expect(pendingSettlement(reloaded.readLedger())).toBeNull()
      expect(useSrs.getState().stats.a.seen).toBe(1)
      expect(useSrs.getState().stats.a.lastSeenAt).toBe(input.acceptedAt)
      expect(useSrs.getState().games).toEqual({ played: 8, won: 5, lost: 2, redeemed: 1 })
      expect(useSrs.getState().translationPostcards).toBe(12)
      expect(useStreak.getState().completedDays['2026-09-19']).toBe(1)
      expect(useAssociations.getState().groups['a|b'].count).toBe(3)
      expect(earnedPostcards(reloaded.readLedger().facts, FIXTURE_BOARD)).toBe(kind === 'daily' ? 0 : 4)
      if (kind === 'daily') expect(readDailyOutcome(disk, input.dailyKey!)).toBe('won')
      else expect(reloaded.readSessions().byCourse.da.continuation.remainingBoardKeys).toEqual([])
      if (kind === 'milestone') {
        expect(receipt.newMilestoneIds).toHaveLength(1)
        expect(Object.keys(useCurriculum.getState().settlementMilestones)).toHaveLength(1)
        expect(Object.keys(useSurvival.getState().settlementMilestones)).toHaveLength(1)
        expect(useCurriculum.getState().byLanguage.da!.itemStates).toEqual(receipt.lessons!.curriculum.after.itemStates)
        expect(useSurvival.getState().byLanguage.da!.exchanges).toEqual(receipt.lessons!.survival.after.exchanges)
      }
    })
  }

  it.each([[1, 3], [4, 2], [5, 0], [3, 4]])('AC07 row %i upgraded to Platinum awards %i missing claims', async (row, delta) => {
    const { store } = await setup()
    const first = inputFor('primary', row)
    store.saveSessions('da', sessionsFor(first))
    await store.finish(first)
    const replay = inputFor('replay', 5, 'replay')
    store.saveSessions('da', { ...store.readSessions().byCourse.da, replay: sessionsFor(replay).replay, activeSlot: 'replay' })
    const receipt = await store.finish(replay)
    expect(receipt.rewards.postcards).toBe(delta)
    expect(receipt.newBest).toBe('platinum')
    expect(earnedPostcards(store.readLedger().facts, FIXTURE_BOARD)).toBe(4)
  })

  it.each([[5, 0, 'platinum', 0], [3, 2, 'silver', 1]] as const)('AC08 best from row %i survives row %i without cross-attempt Platinum', async (firstRow, replayRow, best, delta) => {
    const { store } = await setup()
    const first = inputFor('primary', firstRow)
    store.saveSessions('da', sessionsFor(first)); await store.finish(first)
    const replay = inputFor('replay', replayRow, 'replay')
    store.saveSessions('da', { ...store.readSessions().byCourse.da, replay: sessionsFor(replay).replay, activeSlot: 'replay' })
    expect(await store.finish(replay)).toMatchObject({ newBest: best, rewards: { postcards: delta } })
    expect(Object.keys(store.readLedger().facts.firstPrimaryCompletions)).toHaveLength(firstRow === 3 ? 0 : 1)
  })

  it('AC11/AC12 stale finish cannot settle another slot; replay preserves exact primary, queue and extra metadata', async () => {
    const { store, input } = await setup()
    await store.finish(input)
    const replay = inputFor('replay', 0, 'replay')
    const nextBoard = { ...FIXTURE_BOARD, authoredBoardId: 'next' }
    const next = { ...sessionsFor(input).primary!, attemptId: 'next-attempt', board: nextBoard,
      game: { ...input.attempt.game, phase: 'playerGuessing' as const }, roundGuidance: { opening: 'dismissed' } }
    const paused = { ...sessionsFor(input), primary: next, continuation: { ...sessionsFor(input).continuation, remainingBoardKeys: [boardKey(nextBoard)] },
      replay: sessionsFor(replay).replay, activeSlot: 'replay' as const }
    store.saveSessions('da', paused)
    const reloaded = createSettlementStore({ storage: disk })
    await expect(reloaded.finish({ ...replay, attempt: { ...replay.attempt, attemptId: 'stale' } })).rejects.toThrow('persisted terminal slot')
    await reloaded.finish(replay)
    expect(reloaded.readSessions().byCourse.da.primary).toEqual(next)
    expect(reloaded.readSessions().byCourse.da.continuation).toEqual(paused.continuation)
    expect(reloaded.readSessions().byCourse.da.replay).toEqual(sessionsFor(replay).replay)
    expect(reloaded.readSessions().byCourse.da.activeSlot).toBeNull()
  })

  it('dismisses only a settled terminal pointer and keeps receipt, claims, and learning', async () => {
    const { store, input } = await setup()
    const receipt = await store.finish(input)
    const beforeLedger = structuredClone(store.readLedger())
    const beforeDismissSessions = structuredClone(store.readSessions())
    expect(store.dismissResult('da', 'primary', input.attempt.attemptId)).toBe(true)
    const after = store.readSessions()
    expect(after.byCourse.da.primary).toBeNull()
    expect(after.byCourse.da.continuation).toEqual(beforeDismissSessions.byCourse.da.continuation)
    expect(after.results[input.attempt.attemptId]).toBeUndefined()
    expect(store.readLedger()).toEqual(beforeLedger)
    expect(store.dismissResult('da', 'primary', input.attempt.attemptId)).toBe(false)
    expect(receipt.receiptId).toBeDefined()
  })

  it('does not dismiss a terminal slot while its settlement receipt is pending', async () => {
    const { store, input } = await setup()
    expect(store.dismissResult('da', 'primary', input.attempt.attemptId)).toBe(false)
    expect(store.readSessions().byCourse.da.primary).not.toBeNull()
  })

  it('dismisses a replay result while retaining the unfinished primary suspension', async () => {
    const { store, input } = await setup()
    await store.finish(input)
    const primary = { ...sessionsFor(input).primary!, attemptId: 'unfinished-primary',
      game: { ...input.attempt.game, phase: 'playerGuessing' as const } }
    const replay = inputFor('replay', 3, 'replay-dismiss')
    store.saveSessions('da', { ...store.readSessions().byCourse.da, primary, replay: sessionsFor(replay).replay, activeSlot: 'replay' })
    const replayReceipt = await store.finish(replay)
    const beforePrimary = store.readSessions().byCourse.da.primary
    expect(store.dismissResult('da', 'replay', replay.attempt.attemptId)).toBe(true)
    expect(store.readSessions().byCourse.da.primary).toEqual(beforePrimary)
    expect(store.readSessions().byCourse.da.replay).toBeNull()
    expect(store.readSessions().byCourse.da.activeSlot).toBe('primary')
    expect(store.readLedger().settlements[receiptKey(replay.attempt.attemptId)]?.receipt).toEqual(replayReceipt)
  })

  it('conflicting attempt IDs cannot change accepted board or origin; changed terminal view returns original', async () => {
    const { store, input } = await setup()
    const receipt = await store.finish(input)
    await expect(store.finish({ ...input, attempt: { ...input.attempt, origin: 'daily' } })).rejects.toThrow('attempt-identity-conflict')
    await expect(store.finish({ ...input, attempt: { ...input.attempt, board: { ...FIXTURE_BOARD, authoredBoardId: 'other' } } })).rejects.toThrow('attempt-identity-conflict')
    expect(await store.finish({ ...input, attempt: { ...input.attempt, game: MATRIX_FIXTURES[0].game } })).toEqual(receipt)
  })

  it('serializes independent adapters and rejects legacy/external writes while a writer is active', async () => {
    const { store, input } = await setup()
    const finish = store.finish(input)
    await expect(createSettlementStore({ storage: disk }).finish(input)).rejects.toThrow('writer is busy')
    expect(() => useSrs.getState().reset()).toThrow('writer is busy')
    expect(() => useJourney.setState({ wrapped: {} })).toThrow('writer is busy')
    expect(() => store.saveSessions('da', sessionsFor(input))).toThrow('writer is busy')
    await finish
  })

  it.each(['{broken', JSON.stringify({ schemaVersion: 99 }), JSON.stringify({ schemaVersion: 1, facts: emptyProgressFacts(), settlements: { bad: {} } })])('malformed authority is preserved without writes (%s)', async (raw) => {
    const { store, input } = await setup()
    disk.data.set(SETTLEMENT_KEY, raw)
    await expect(store.finish(input)).rejects.toThrow()
    expect(disk.data.get(SETTLEMENT_KEY)).toBe(raw)
    expect(disk.writes).toEqual([])
  })

  it('corrupt learning destination remains pending and becomes recoverable when the original value is restored', async () => {
    const { store, input } = await setup()
    disk.fault = { at: 2, after: false }
    await expect(store.finish(input)).rejects.toThrow()
    disk.fault = null
    const original = disk.data.get('cluecab-srs-v1')!
    const corrupt = { ...stored('cluecab-srs-v1'), stats: { a: { ...oldSrs.stats.a, seen: 7 } } }
    seed('cluecab-srs-v1', 7, corrupt)
    const before = disk.writes.length
    await expect(store.recover()).rejects.toThrow('before-state conflict')
    expect(disk.writes).toHaveLength(before)
    expect(store.isFullyRecorded()).toBe(false)
    disk.data.set('cluecab-srs-v1', original)
    await store.recover()
    expect(useSrs.getState().stats.a.seen).toBe(1)
  })

  it('milestone settlement requires a captured valid plan before the authoritative write', async () => {
    const { input } = await setup('milestone')
    await expect(createSettlementStore({ storage: disk }).finish(input)).rejects.toThrow('lesson planner')
    expect(disk.writes).toEqual([])
    const invalid = createSettlementStore({ storage: disk, planLessons: (args) => ({ ...lessonPlan(args), courseId: 'de' }) })
    await expect(invalid.finish(input)).rejects.toThrow('before-state conflict')
    expect(disk.writes).toEqual([])
  })

  it('AC21 legacy high-water persists once, survives failure/reload, and never reinterprets derived totals', async () => {
    const { store, input } = await setup()
    for (const amount of [12, 12, 7, 15]) await store.preserveLegacyCredit(amount)
    expect(earnedPostcards(store.readLedger().facts, FIXTURE_BOARD)).toBe(15)
    await store.finish(input)
    expect(earnedPostcards(store.readLedger().facts, FIXTURE_BOARD)).toBe(19)
    const reloaded = createSettlementStore({ storage: disk })
    await reloaded.mergeFacts(store.readLedger().facts)
    await reloaded.mergeFacts(store.readLedger().facts)
    expect(earnedPostcards(reloaded.readLedger().facts, FIXTURE_BOARD)).toBe(19)
    expect(useSrs.getState().games.played).toBe(8)
    await expect(reloaded.preserveLegacyCredit(-1)).rejects.toThrow()
  })

  it('AC20/AC22/AC23 preserves legacy route/word/lesson and active/parked bytes without inferring medals or replaying old finishes', async () => {
    const { store } = await setup()
    const oldGame = { game: MATRIX_FIXTURES[5].game, roundRecorded: false, city1BoardCursor: 90,
      parked: { game: MATRIX_FIXTURES[1].game, mode: 'normal' }, mode: 'wrapup' }
    seed('cluecab-game-v1', 15, oldGame)
    seed('cluecab-journey-v2', 5, { ...oldJourney, cityIndex: 7, furthest: 8 })
    const oldBytes = disk.data.get('cluecab-game-v1')
    const journeyBytes = disk.data.get('cluecab-journey-v2')
    await store.preserveLegacyCredit(12)
    await store.recover()
    expect(store.readLedger().facts.boards).toEqual({})
    expect(store.readLedger().facts.firstPrimaryCompletions).toEqual({})
    expect(disk.data.get('cluecab-game-v1')).toBe(oldBytes)
    expect(disk.data.get('cluecab-journey-v2')).toBe(journeyBytes)
    expect(isCollected(undefined, 'n' in oldJourney.wrapped)).toBe(true)
    expect(stored('cluecab-srs-v1').stats).toEqual(oldSrs.stats)
    expect(useCurriculum.getState().byLanguage.de).toEqual(initialCurriculumProgress('de'))
    // Migration/route enforcement belongs to C1-06/10, not this adapter.
  })

  it.each(['tutorial', 'daily', 'optional', 'developer'] as const)('%s never receives city facts or milestone; tutorial keeps only practice learning', async (origin) => {
    const { store } = await setup()
    const input = inputFor(origin)
    const r = await store.finish(input)
    expect(r.rewards.postcards).toBe(0)
    expect(store.readLedger().facts).toEqual(emptyProgressFacts())
    expect(useSrs.getState().stats.a.seen).toBe(1)
    expect(useSrs.getState().games.played).toBe(origin === 'tutorial' ? 7 : 8)
  })

  it('daily reader preserves bare historic outcomes and reads the versioned atomic outcome', async () => {
    const { store, input } = await setup('daily')
    disk.data.set('cluecab-daily:old', 'redeemed')
    expect(readDailyOutcome(disk, 'old')).toBe('redeemed')
    await store.finish(input)
    expect(readDailyOutcome(disk, input.dailyKey!)).toBe('won')
  })

  it('rejects corrupt captured lesson payload on reload and preserves the raw receipt', async () => {
    const { store, input } = await setup('milestone')
    await store.finish(input)
    const ledger = store.readLedger()
    const r = ledger.settlements[receiptKey(input.attempt.attemptId)].receipt
    const corrupt = { ...ledger, settlements: { [r.receiptId]: { receipt: { ...r, lessons: undefined }, acknowledgedEffects: [] } } }
    const raw = JSON.stringify(corrupt)
    disk.data.set(SETTLEMENT_KEY, raw)
    await expect(store.recover()).rejects.toThrow('captured lesson')
    expect(disk.data.get(SETTLEMENT_KEY)).toBe(raw)
  })

  it('deterministic repeats serialize identically and use no scheduler time during recovery', async () => {
    const outputs: string[] = []
    for (let n = 0; n < 3; n++) {
      const { store, input } = await setup('milestone')
      await store.finish(input)
      outputs.push(JSON.stringify([...disk.data.entries()]))
    }
    expect(new Set(outputs).size).toBe(1)
  })

  it.each([false, true])('session save failure saved=%s never publishes unpersisted slots and can be reread', async (after) => {
    const { store, input, publications } = await setup()
    const next = { ...sessionsFor(input), primary: { ...sessionsFor(input).primary!, attemptId: 'next' } }
    disk.fault = { at: 1, after }
    expect(() => store.saveSessions('da', next)).toThrow()
    expect(publications).toEqual([])
    expect(store.readSessions().byCourse.da.primary!.attemptId).toBe(after ? 'next' : input.attempt.attemptId)
    expect(disk.writes).toEqual([SESSION_KEY])
    disk.fault = null
    store.saveSessions('da', next)
    expect(store.readSessions().byCourse.da).toEqual(next)
  })

  it.each([false, true])('legacy/facts authoritative write failure saved=%s rereads and safely repeats', async (after) => {
    const { store } = await setup()
    disk.fault = { at: 1, after }
    await expect(store.preserveLegacyCredit(15)).rejects.toThrow()
    expect(disk.reads.at(-1)).toBe(SETTLEMENT_KEY)
    disk.fault = null
    await store.preserveLegacyCredit(15)
    const facts = store.readLedger().facts
    disk.fault = { at: disk.writes.length + 1, after }
    await expect(store.mergeFacts(facts)).rejects.toThrow()
    expect(disk.reads.at(-1)).toBe(SETTLEMENT_KEY)
    disk.fault = null
    await store.mergeFacts(facts)
    expect(earnedPostcards(store.readLedger().facts, FIXTURE_BOARD)).toBe(15)
  })

  it('missing markers in a current-version destination cannot silently duplicate a game delta', async () => {
    const { store, input } = await setup()
    disk.fault = { at: 4, after: true } // games saved, before acknowledgement
    await expect(store.finish(input)).rejects.toThrow()
    disk.fault = null
    const original = disk.data.get('cluecab-srs-v1')!
    const { settlementEffects: _markers, ...corrupt } = stored('cluecab-srs-v1')
    seed('cluecab-srs-v1', 7, corrupt)
    await expect(store.recover()).rejects.toThrow()
    expect(stored('cluecab-srs-v1').games.played).toBe(8)
    disk.data.set('cluecab-srs-v1', original)
    await store.recover()
    expect(useSrs.getState().games.played).toBe(8)
  })

  it('recovery never recomputes the captured scheduler or lesson planner', async () => {
    const { input, options } = await setup('milestone')
    const scheduler = await import('../srs/scheduler')
    const scheduled = vi.spyOn(scheduler, 'applyRoundResults')
    const planned = vi.fn(lessonPlan)
    const store = createSettlementStore({ ...options, planLessons: planned })
    try {
      disk.fault = { at: 2, after: false }
      await expect(store.finish(input)).rejects.toThrow()
      expect(scheduled).toHaveBeenCalledTimes(1)
      expect(planned).toHaveBeenCalledTimes(1)
      disk.fault = null
      const reloaded = createSettlementStore({ storage: disk }) // no planner needed after receipt
      await reloaded.recover()
      await reloaded.finish(input)
      expect(scheduled).toHaveBeenCalledTimes(1)
      expect(planned).toHaveBeenCalledTimes(1)
    } finally {
      scheduled.mockRestore()
    }
  })
})
