/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boardKey, firstCompletionKey } from '../progression/identity'
import { emptyProgressFacts, earnedPostcards } from '../progression/facts'
import { targetUnion } from '../progression/rules'
import { applyEvent, wheelMissedSegments } from '../engine/game'
import { danish } from '../lang/da'
import type { GameState } from '../engine/types'
import type { TranslationResponse } from '../ai/schemas'
import type { CourseSessions } from '../progression/types'

const values = new Map<string, string>()
const activeCourse = vi.hoisted(() => ({ code: 'da' as 'da' | 'de' }))
vi.mock('../lang/active', async (original) => {
  const actual = await original<typeof import('../lang/active')>()
  return { ...actual, ACTIVE: { ...actual.ACTIVE, get code() { return activeCourse.code } } }
})
let failKey: string | null = null
let failAfter = false
let failReadAfterWrite = false
let failedReadKey: string | null = null
const storage = {
  getItem: (key: string) => {
    if (failedReadKey === key) throw new Error('session read unavailable')
    return values.get(key) ?? null
  },
  setItem: (key: string, value: string) => {
    if (failKey === key && !failAfter) throw new Error('before write')
    values.set(key, value)
    if (failKey === key && failReadAfterWrite) failedReadKey = key
    if (failKey === key && failAfter) throw new Error('after write')
  },
  removeItem: (key: string) => { values.delete(key) },
}
vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', { localStorage: storage })
const { useGame, configureRuntimeLessons, retainedResultReceipt } = await import('./gameStore')
const { useSrs } = await import('./srsStore')
const { useCurriculum } = await import('./curriculumStore')
const { useSurvival } = await import('./survivalStore')
const { useStreak } = await import('../streak/streak')
const { useSettings } = await import('./settingsStore')
const { useUi } = await import('./uiStore')
const { useStatsPorts } = await import('../analytics/stats')
const { createSettlementStore } = await import('./settlementStore')
const { SESSION_KEY, SETTLEMENT_KEY } = await import('./settlementStorage')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { OllamaCompanion } = await import('../ai/companion')
// Required boards are cafés a walk must find first (CW-04); this runtime is about the board game.
const { findEveryCafe } = await import('../journey/cafeTestSupport')
const adapter = () => createSettlementStore({ storage })
const sessions = () => adapter().readSessions().byCourse.da

beforeEach(async () => {
  activeCourse.code = 'da'
  failedReadKey = null
  failReadAfterWrite = false
  failKey = null
  await useGame.getState().finishRound()
  values.clear()
  useGame.setState(useGame.getInitialState())
  useSrs.setState(useSrs.getInitialState())
  useStreak.setState(useStreak.getInitialState())
  useUi.setState({ pendingFirstGiver: 'ai', screen: 'home', onboarding: null })
  useSettings.setState({ ...useSettings.getInitialState(), useMock: true })
  configureRuntimeLessons(undefined)
  useStatsPorts(null)
  findEveryCafe()
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') }))
})
afterEach(async () => {
  failKey = null; failedReadKey = null; failReadAfterWrite = false
  await useGame.getState().finishRound()
  activeCourse.code = 'da'
  vi.restoreAllMocks(); vi.useRealTimers()
})

async function bronze() {
  const game = useGame.getState().game!
  useGame.setState({ game: { ...game, phase: 'suddenDeath', turnsLeft: 0 } })
  useGame.getState().playerStop()
  await useGame.getState().finishRound()
  expect(useGame.getState().error, useGame.getState().settlementFailure ?? undefined).toBeNull()
  expect(useGame.getState().completionReceipt?.attemptTier).toBe('bronze')
}

function solvedChallenge() {
  const game = useGame.getState().game!
  const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
  const last = targets.at(-1)!
  const before: GameState = { ...game, phase: 'suddenDeath', turnsLeft: 0,
    reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, -1).map((id) => [id, { kind: 'green' }])) } }
  useGame.setState({ game: before })
  useGame.getState().playerGuess(last)
  expect(useGame.getState().game?.phase).toBe('translateChallenge')
}

/** The clues ran out with only the first `found` key words found. */
function partialChallenge(found = 3) {
  const game = useGame.getState().game!
  const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
  const opened = applyEvent({ ...game, phase: 'translateChallenge', turnsLeft: 0, wheel: undefined,
    reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, found).map((id) => [id, { kind: 'green' }])) } },
  { type: 'START_TRANSLATE_CHALLENGE' }, danish)
  useGame.setState({ game: opened })
  return { found: targets.slice(0, found), missed: targets.slice(found) }
}

async function completeWin() {
  solvedChallenge()
  for (const id of useGame.getState().game!.wheel!.segments) {
    const word = useGame.getState().game!.words.find((entry) => entry.wordId === id)!
    expect(useGame.getState().submitWheelTranslation(word.da)).toBe(true)
  }
  useGame.getState().spinWheel()
  await useGame.getState().finishRound()
  expect(useGame.getState().completionReceipt?.completedLoss).toBe(false)
}

function startNonSlot(origin: 'daily' | 'developer' | 'tutorial') {
  if (origin === 'tutorial') {
    useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
    useGame.getState().newTutorialGame()
  } else useGame.getState().newGame({ seed: 99, ...(origin === 'daily' ? { dailyKey: '2026-09-19' } : {}) })
}

async function writeBrowserFixture(name: string, snapshot = Object.fromEntries(values)) {
  if (process.env.C1_RUNTIME_FIXTURES !== '1') return
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync('tmp/c1-08', { recursive: true })
  writeFileSync(`tmp/c1-08/${name}.json`, JSON.stringify(snapshot, null, 2))
}

async function reloadFixture(origin: 'daily' | 'developer' | 'tutorial', terminal: boolean) {
  const snapshot = Object.fromEntries(values)
  if (origin === 'tutorial') snapshot['cluecab-onboard-v5'] = 'tutorial'
  await writeBrowserFixture(`reload-${origin}-${terminal ? 'terminal' : 'unfinished'}`, snapshot)
}

describe('C1-08 receipt-driven primary/replay runtime', () => {
  it('local browser fixtures carry real receipt and session authority, with a suspended primary and replay', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame()
    useGame.getState().recordLookup(useGame.getState().game!.words[0].wordId)
    useGame.getState().announceRoundGuidance()
    useGame.getState().dismissRoundGuidance()
    const primary = Object.fromEntries(values)
    const before = sessions().primary
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    await useGame.getState().runAiClue()
    const target = useGame.getState().game!.words.find((word) => useGame.getState().game!.aiKey[word.wordId] === 'green')!
    useGame.getState().playerGuess(target.wordId)
    useGame.setState({ activeRoundGuidance: 'player' })
    solvedChallenge()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(sessions().primary).toEqual(before)
    const replay = Object.fromEntries(values)
    if (process.env.C1_RUNTIME_FIXTURES === '1') {
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync('tmp/c1-08', { recursive: true })
      writeFileSync('tmp/c1-08/fixtures.json', JSON.stringify({ primary, replay }, null, 2))
    }
  })

  it.each(['primary', 'replay'] as const)(
    'a transient intro restores the exact paused %s slot without re-awarding it',
    async (slotName) => {
      // Establish real durable board/tier facts first, then put an unfinished
      // primary (or a replay beside it) down as Settings' intro replay does.
      useGame.getState().newGame({ cityIndex: 0 })
      await bronze()
      const completed = CITY1_REQUIRED_SET.boards[0]
      useGame.getState().newGame({ cityIndex: 0 })
      if (slotName === 'replay') expect(useGame.getState().startReplay(completed.authoredBoardId)).toBe(true)

      const before = Object.fromEntries(values)
      const beforeSessions = sessions()
      const beforeFacts = adapter().readLedger().facts
      const beforeGame = JSON.parse(before['cluecab-game-v1']!).state.game
      const beforeSrs = JSON.parse(before['cluecab-srs-v1']!).state

      useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
      useGame.getState().newTutorialGame()
      expect(useGame.getState()).toMatchObject({ mode: 'tutorial', tutorialResumeSlot: slotName })
      expect(sessions()).toMatchObject({
        primary: beforeSessions.primary,
        replay: beforeSessions.replay,
        continuation: beforeSessions.continuation,
        activeSlot: null,
      })

      expect(useGame.getState().restoreTutorialSuspension()).toBe(true)
      expect(useGame.getState()).toMatchObject({ mode: 'normal', activeSlot: slotName, tutorialResumeSlot: null })
      // The tutorial cache was the only temporary projection. The durable
      // course queue, receipt/fact ledger, postcard/tier facts, SRS evidence
      // and exact paused board cache are the same bytes they were before.
      expect(Object.fromEntries(values)).toEqual(before)
      expect(sessions()).toEqual(beforeSessions)
      expect(adapter().readLedger().facts).toEqual(beforeFacts)
      expect(JSON.parse(values.get('cluecab-game-v1')!).state.game).toEqual(beforeGame)
      expect(JSON.parse(values.get('cluecab-srs-v1')!).state).toEqual(beforeSrs)
    },
  )

  it('rehydrates a transient replay intro to its exact parked replay when both course slots exist', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    const completed = CITY1_REQUIRED_SET.boards[0]
    useGame.getState().newGame({ cityIndex: 0 })
    expect(useGame.getState().startReplay(completed.authoredBoardId)).toBe(true)

    const before = Object.fromEntries(values)
    const beforeSessions = sessions()
    const beforeFacts = adapter().readLedger().facts
    const beforeSrs = JSON.parse(before['cluecab-srs-v1']!).state

    useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
    useGame.getState().newTutorialGame()
    const tutorialCache = Object.fromEntries(values)
    expect(JSON.parse(tutorialCache['cluecab-game-v1']!).state.tutorialResumeSlot).toBe('replay')

    // A real reload loses all in-memory state, then hydrates only the bytes
    // written by the tutorial hand-off. Restore those bytes after resetting
    // this test store so the assertion cannot accidentally use its old value.
    useGame.setState(useGame.getInitialState())
    values.clear()
    for (const [key, value] of Object.entries(tutorialCache)) values.set(key, value)
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()

    expect(useGame.getState()).toMatchObject({ mode: 'tutorial', tutorialResumeSlot: 'replay' })
    expect(useGame.getState().restoreTutorialSuspension()).toBe(true)
    expect(useGame.getState()).toMatchObject({ mode: 'normal', activeSlot: 'replay', tutorialResumeSlot: null })
    expect(Object.fromEntries(values)).toEqual(before)
    expect(sessions()).toEqual(beforeSessions)
    expect(adapter().readLedger().facts).toEqual(beforeFacts)
    expect(JSON.parse(values.get('cluecab-srs-v1')!).state).toEqual(beforeSrs)
  })

  it('fails closed after reload with two parked slots and no valid tutorial pointer', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    useGame.getState().newGame({ cityIndex: 0 })
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    const facts = adapter().readLedger().facts

    useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
    useGame.getState().newTutorialGame()
    const cache = JSON.parse(values.get('cluecab-game-v1')!)
    cache.state.tutorialResumeSlot = 'not-a-slot'
    const tutorialCache = { ...Object.fromEntries(values), 'cluecab-game-v1': JSON.stringify(cache) }
    useGame.setState(useGame.getInitialState())
    values.clear()
    for (const [key, value] of Object.entries(tutorialCache)) values.set(key, value)
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()

    expect(useGame.getState()).toMatchObject({ mode: 'tutorial', tutorialResumeSlot: null })
    expect(useGame.getState().restoreTutorialSuspension()).toBe(false)
    expect(sessions()).toMatchObject({ activeSlot: null })
    expect(adapter().readLedger().facts).toEqual(facts)
  })

  it('falls back to the one parked primary after reload when an old cache has no tutorial pointer', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const before = Object.fromEntries(values)
    expect(sessions().primary).not.toBeNull()
    useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
    useGame.getState().newTutorialGame()
    expect(sessions()).toMatchObject({ primary: expect.any(Object), replay: null, activeSlot: null })
    const cache = JSON.parse(values.get('cluecab-game-v1')!)
    delete cache.state.tutorialResumeSlot
    const tutorialCache = { ...Object.fromEntries(values), 'cluecab-game-v1': JSON.stringify(cache) }
    useGame.setState(useGame.getInitialState())
    values.clear()
    for (const [key, value] of Object.entries(tutorialCache)) values.set(key, value)
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()

    expect(useGame.getState()).toMatchObject({ mode: 'tutorial', tutorialResumeSlot: null })
    expect(sessions()).toMatchObject({ primary: expect.any(Object), replay: null, activeSlot: null })
    expect(useGame.getState().restoreTutorialSuspension()).toBe(true)
    expect(useGame.getState()).toMatchObject({ activeSlot: 'primary', tutorialResumeSlot: null })
    expect(Object.fromEntries(values)).toEqual(before)
  })

  it('AC09/14/16 opening, duplicate Play, reroll, pause and cancel never consume a required board', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const first = sessions().primary!
    const queue = sessions().continuation
    expect(first.board).toEqual(CITY1_REQUIRED_SET.boards[0])
    useGame.getState().newGame()
    expect(sessions().primary).toEqual(first)
    useGame.getState().rerollBoard()
    useGame.getState().pauseGame()
    await useGame.getState().recoverSession()
    expect(sessions().primary).toEqual(first)
    expect(sessions().continuation).toEqual(queue)
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[1].authoredBoardId)).toBe(false)
    useGame.getState().abandonGame()
    expect(sessions().primary).toBeNull()
    expect(adapter().readLedger().facts.boards).toEqual({})
    useGame.getState().newGame()
    expect(sessions().primary!.board).toEqual(first.board)
    expect(sessions().primary!.attemptId).not.toBe(first.attemptId)
    expect(sessions().continuation).toEqual(queue)
  })

  it('AC09 Bronze settles once and advances only the terminal primary', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const first = sessions().primary!
    await bronze()
    const receipt = useGame.getState().completionReceipt!
    expect(receipt.primary?.nextBoardKey).toBe(boardKey(CITY1_REQUIRED_SET.boards[1]))
    await Promise.all([useGame.getState().finishRound(), useGame.getState().finishRound()])
    await useGame.getState().recoverSession()
    expect(useGame.getState().completionReceipt).toEqual(receipt)
    expect(useSrs.getState().games).toMatchObject({ played: 1, lost: 1 })
    expect(Object.values(useStreak.getState().completedDays)).toEqual([1])
    expect(Object.keys(adapter().readLedger().facts.firstPrimaryCompletions)).toEqual([])
    expect(Object.keys(adapter().readLedger().facts.completedLosses)).toEqual([boardKey(first.board)])
    expect(earnedPostcards(adapter().readLedger().facts, first.board)).toBe(0)
    useGame.getState().newGame()
    expect(sessions().primary!.board).toEqual(CITY1_REQUIRED_SET.boards[1])
  })

  it('C1-13 reopens only a retained primary receipt without a sentence queue or any durable write', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    const receipt = useGame.getState().completionReceipt!
    const rawSessions = JSON.parse(values.get(SESSION_KEY)!)
    const primary = rawSessions.state.byCourse.da.primary
    primary.reviewRoundId = null
    primary.round.reviewRoundId = null
    primary.round.sentenceReview = null
    rawSessions.state.results[receipt.attemptId].reviewRoundId = null
    values.set(SESSION_KEY, JSON.stringify(rawSessions))
    const ledgerBefore = values.get(SETTLEMENT_KEY)!
    const sessionsBefore = values.get(SESSION_KEY)!

    useGame.setState(useGame.getInitialState())
    const gameBefore = values.get('cluecab-game-v1')!
    expect(useGame.getState().resumeResult('replay')).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(useGame.getState().resumeResult('primary')).toBe(true)
    expect(useGame.getState().completionReceipt).toEqual(receipt)
    expect(useGame.getState().game?.phase).toBe('finished')
    expect(useGame.getState().activeSlot).toBe('primary')
    expect(useGame.getState().sentenceReview).toBeNull()
    expect(values.get(SETTLEMENT_KEY)).toBe(ledgerBefore)
    expect(values.get(SESSION_KEY)).toBe(sessionsBefore)
    expect(values.get('cluecab-game-v1')).toBe(gameBefore)

    const stale = JSON.parse(sessionsBefore)
    stale.state.results[receipt.attemptId].receiptId = 'stale-receipt'
    values.set(SESSION_KEY, JSON.stringify(stale))
    useGame.setState(useGame.getInitialState())
    const staleGameBefore = values.get('cluecab-game-v1')!
    expect(useGame.getState().resumeResult('primary')).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(values.get(SETTLEMENT_KEY)).toBe(ledgerBefore)
    expect(values.get(SESSION_KEY)).toBe(JSON.stringify(stale))
    expect(values.get('cluecab-game-v1')).toBe(staleGameBefore)
  })

  it('C1-13 skips a stale primary pointer and selects the matching retained replay receipt', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    const primaryReceipt = useGame.getState().completionReceipt!
    const primarySlot = sessions().primary!
    useGame.getState().newGame()
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    const replaySlot = sessions().replay!
    await bronze()
    const replayReceipt = useGame.getState().completionReceipt!
    const durable = adapter().readSessions()
    const replayResult = durable.results[replayReceipt.attemptId]!
    const retainedReplay = { ...replaySlot, game: replayReceipt.evidence.game, reviewRoundId: replayResult.reviewRoundId }
    const stalePrimary = { ...primarySlot, game: primaryReceipt.evidence.game }
    const resultPointers = {
      ...durable.results,
      [primaryReceipt.attemptId]: { receiptId: 'stale-primary-pointer', reviewRoundId: stalePrimary.reviewRoundId },
    }
    const candidates = { ...sessions()!, primary: stalePrimary, replay: retainedReplay, activeSlot: null } as CourseSessions
    const ledger = adapter().readLedger().settlements
    expect(retainedResultReceipt('primary', candidates, resultPointers, ledger)).toBeNull()
    expect(retainedResultReceipt('replay', candidates, resultPointers, ledger)).toEqual(replayReceipt)
  })

  // This scenario performs ten full durable primary rounds plus a replay;
  // under the full Vitest worker pool its storage fault-injection path can
  // exceed the default five-second per-test budget without being stuck.
  it('AC28 counts 9→10→10 replay→11 through the real runtime and captures the tenth lesson patches once', async () => {
    for (let completed = 0; completed < 9; completed++) {
      useGame.getState().newGame({ cityIndex: 0 })
      await completeWin()
    }
    expect(Object.keys(adapter().readLedger().facts.firstPrimaryCompletions)).toHaveLength(9)
    expect(adapter().readLedger().facts.milestones).toEqual({})

    useGame.getState().newGame({ cityIndex: 0 })
    await completeWin()
    const tenth = useGame.getState().completionReceipt!
    expect(tenth.newMilestoneIds).toHaveLength(1)
    expect(tenth.lessons?.curriculum.after.itemStates['sonderborg-notice']).toBe('offered')
    expect(tenth.lessons?.survival.after.exchanges['sonderborg-situation-1']).toMatchObject({ unlockedAt: tenth.acceptedAt })
    expect(useCurriculum.getState().byLanguage.da?.itemStates['sonderborg-notice']).toBe('offered')
    expect(useSurvival.getState().byLanguage.da?.exchanges['sonderborg-situation-1']).toBeDefined()

    const lessonBytes = [values.get('cluecab-curriculum-v1'), values.get('cluecab-survival-v1')]
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    await completeWin()
    expect(Object.keys(adapter().readLedger().facts.firstPrimaryCompletions)).toHaveLength(10)
    expect(Object.keys(adapter().readLedger().facts.milestones)).toHaveLength(1)
    expect([values.get('cluecab-curriculum-v1'), values.get('cluecab-survival-v1')]).toEqual(lessonBytes)

    useGame.getState().newGame({ cityIndex: 0 })
    await completeWin()
    expect(Object.keys(adapter().readLedger().facts.firstPrimaryCompletions)).toHaveLength(11)
    expect(Object.keys(adapter().readLedger().facts.milestones)).toHaveLength(1)
  }, 15000)

  it('AC28/30 recovers a failed tenth lesson write from its captured receipt without rerunning the milestone', async () => {
    for (let completed = 0; completed < 9; completed++) {
      useGame.getState().newGame({ cityIndex: 0 })
      await completeWin()
    }
    useGame.getState().newGame({ cityIndex: 0 })
    failKey = 'cluecab-curriculum-v1'
    solvedChallenge()
    for (const id of useGame.getState().game!.wheel!.segments) {
      const word = useGame.getState().game!.words.find((entry) => entry.wordId === id)!
      expect(useGame.getState().submitWheelTranslation(word.da)).toBe(true)
    }
    useGame.getState().spinWheel()
    await useGame.getState().finishRound()
    const pending = adapter().readLedger()
    const saved = Object.values(pending.settlements).map((entry) => entry.receipt).find((receipt) => receipt.newMilestoneIds.length > 0)!
    expect(saved.newMilestoneIds).toHaveLength(1)
    expect(saved.lessons).toBeDefined()
    expect(useGame.getState().roundRecorded).toBe(false)
    expect(useGame.getState().settlementFailure).toMatch(/before write/)

    failKey = null
    await useGame.getState().recoverSession()
    const recovered = adapter().readLedger()
    expect(recovered.settlements[saved.receiptId]!.receipt).toEqual(saved)
    expect(Object.keys(recovered.facts.firstPrimaryCompletions)).toHaveLength(10)
    expect(Object.keys(recovered.facts.milestones)).toHaveLength(1)
    expect(useCurriculum.getState().byLanguage.da?.itemStates['sonderborg-notice']).toBe('offered')
    expect(useSurvival.getState().byLanguage.da?.exchanges['sonderborg-situation-1']).toBeDefined()
  }, 15000)

  it('AC12/13/15 replay survives restart, can be parked, and returns to the exact primary', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    const completed = CITY1_REQUIRED_SET.boards[0]
    useGame.getState().newGame()
    await useGame.getState().runAiClue()
    useGame.getState().recordLookup(useGame.getState().game!.words[0].wordId)
    useGame.getState().announceRoundGuidance()
    useGame.getState().dismissRoundGuidance()
    const primary = sessions().primary!
    const continuation = sessions().continuation
    expect(useGame.getState().startReplay(completed.authoredBoardId)).toBe(true)
    const replay = sessions().replay!
    useGame.getState().resumePrimary()
    expect(sessions().primary).toEqual(primary)
    expect(sessions().replay).toEqual(replay)
    useGame.getState().resumeReplay()
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().attemptId).toBe(replay.attemptId)
    expect(sessions().primary).toEqual(primary)
    expect(sessions().continuation).toEqual(continuation)
    await bronze()
    expect(useGame.getState().dismissResult()).toBe(true)
    expect(sessions().replay).toBeNull()
    useGame.getState().newGame()
    expect(useGame.getState().game).toEqual(primary.game)
    expect(useGame.getState().lookedUp).toEqual(primary.lookedUp)
    expect(sessions().primary).toEqual(primary)
    expect(sessions().continuation).toEqual(continuation)
    expect(useGame.getState().startReplay(completed.authoredBoardId)).toBe(true)
    useGame.getState().abandonGame()
    expect(sessions().primary).toEqual(primary)
    expect(sessions().replay).toBeNull()
    expect(adapter().readLedger().facts.boards[boardKey(completed)]).toBeUndefined()
    expect(adapter().readLedger().facts.completedLosses[boardKey(completed)]).toBeDefined()
    expect(useSrs.getState().games.played).toBe(2)
  })

  it.each([false, true])('AC10 a receipt write failure (after=%s) retains terminal state and recovers exactly once', async (after) => {
    useGame.getState().newGame({ cityIndex: 0 })
    const game = useGame.getState().game!
    useGame.setState({ game: { ...game, phase: 'suddenDeath', turnsLeft: 0 } })
    failKey = SETTLEMENT_KEY; failAfter = after
    useGame.getState().playerStop()
    await useGame.getState().finishRound()
    expect(useGame.getState().roundRecorded).toBe(false)
    expect(useGame.getState().error).toBe('Your result could not be saved yet. Keep this round and try again.')
    expect(useGame.getState().settlementFailure).toMatch(/before write|after write/)
    expect(useGame.getState().settlementBusy).toBe(false)
    expect(useGame.getState().game!.phase).toBe('finished')
    const acceptedAttempt = useGame.getState().attemptId
    useGame.getState().newTutorialGame()
    await useGame.getState().finishRound()
    expect(useGame.getState().attemptId).toBe(acceptedAttempt)
    failKey = null
    await useGame.getState().recoverSession()
    expect(useGame.getState().roundRecorded).toBe(true)
    expect(useSrs.getState().games.played).toBe(1)
    expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(1)
    expect(sessions().continuation.remainingBoardKeys).toHaveLength(99)
  })

  it('AC10 a failed slot save does not publish or lose its primary', () => {
    failKey = SESSION_KEY; failAfter = false
    expect(() => useGame.getState().newGame({ cityIndex: 0 })).toThrow('before write')
    expect(useGame.getState().game).toBeNull()
    failKey = null
    useGame.getState().newGame({ cityIndex: 0 })
    expect(sessions().primary!.board).toEqual(CITY1_REQUIRED_SET.boards[0])
    expect(sessions().continuation.remainingBoardKeys).toHaveLength(100)
  })

  it.each(['primary', 'replay'] as const)('AC10 %s terminal session write-then-throw cannot be overwritten by translation or cancel', async (slot) => {
    useGame.getState().newGame({ cityIndex: 0 })
    if (slot === 'replay') {
      await bronze()
      useGame.getState().newGame()
      expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    }
    const primary = sessions().primary
    const continuation = sessions().continuation
    solvedChallenge()
    const attemptId = useGame.getState().attemptId!
    if (slot === 'primary') await writeBrowserFixture('primary-wheel')
    failKey = SESSION_KEY; failAfter = true
    // A storage implementation may commit the accepted verdict then throw.
    // That committed value, not the stale pre-spin cache, owns subsequent actions.
    expect(() => useGame.getState().spinWheel()).not.toThrow()
    const accepted = sessions()[slot]!.game
    expect(accepted.phase).toBe('finished')
    expect(useGame.getState().game).toEqual(accepted)
    await useGame.getState().finishRound()
    expect(useGame.getState().roundRecorded).toBe(false)
    expect(useGame.getState().settlementFailure).toContain('after write')
    failKey = null
    expect(useGame.getState().submitWheelTranslation(accepted.words[0].da)).toBe(false)
    useGame.getState().abandonGame()
    await useGame.getState().finishRound()
    expect(useGame.getState().attemptId).toBe(attemptId)
    expect(useGame.getState().game).toEqual(accepted)
    expect(useGame.getState().roundRecorded).toBe(true)
    expect(useGame.getState().completionReceipt!.evidence.game).toEqual(accepted)
    expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(slot === 'primary' ? 1 : 2)
    expect(useSrs.getState().games.played).toBe(slot === 'primary' ? 1 : 2)
    if (slot === 'replay') {
      expect(sessions().primary).toEqual(primary)
      expect(sessions().continuation).toEqual(continuation)
      expect(useGame.getState().dismissResult()).toBe(true)
      expect(sessions().replay).toBeNull()
    } else expect(sessions().continuation.remainingBoardKeys).toEqual(continuation.remainingBoardKeys.slice(1))
  })

  it.each((['primary', 'replay'] as const).flatMap(slot => (['pause', 'cancel', 'translate'] as const).map(action => ({ slot, action }))))('AC10 unreadable committed $slot terminal blocks $action until durable recovery and explicit Next', async ({ slot, action }) => {
    useGame.getState().newGame({ cityIndex: 0 })
    if (slot === 'replay') {
      await bronze()
      useGame.getState().newGame()
      useGame.getState().recordLookup(useGame.getState().game!.words[0].wordId)
      expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    }
    const primary = sessions().primary!
    solvedChallenge()
    const attemptId = useGame.getState().attemptId!
    const continuation = sessions().continuation
    failKey = SESSION_KEY; failAfter = true; failReadAfterWrite = true
    expect(() => useGame.getState().spinWheel()).not.toThrow()
    await useGame.getState().finishRound()
    const durable = JSON.parse(values.get(SESSION_KEY)!).state.byCourse.da[slot].game
    expect(durable.phase).toBe('finished')
    expect(useGame.getState().roundRecorded).toBe(false)
    expect(useGame.getState().settlementFailure).toContain('session read unavailable')
    failKey = null; failedReadKey = null; failReadAfterWrite = false
    if (action === 'pause') useGame.getState().pauseGame()
    if (action === 'cancel') useGame.getState().abandonGame()
    if (action === 'translate') expect(useGame.getState().submitWheelTranslation(durable.words[0].da)).toBe(false)
    await useGame.getState().recoverSession()
    expect(useGame.getState().game).toStrictEqual(durable)
    expect(useGame.getState()).toMatchObject({ attemptId, roundRecorded: true, settlementBusy: false })
    expect(useGame.getState().completionReceipt!.evidence.game).toStrictEqual(durable)
    expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(slot === 'primary' ? 1 : 2)
    expect(useSrs.getState().games.played).toBe(slot === 'primary' ? 1 : 2)
    if (slot === 'primary') expect(sessions().continuation.remainingBoardKeys).toEqual(continuation.remainingBoardKeys.slice(1))
    else {
      expect(useGame.getState().dismissResult()).toBe(true)
      expect(sessions()).toMatchObject({ primary, continuation, replay: null })
      expect(useGame.getState().activeSlot).toBeNull() // Explicit Next dismissed the replay reader.
      useGame.getState().resumePrimary()
      expect(useGame.getState().game).toEqual(primary.game)
      expect(useGame.getState().lookedUp).toEqual(primary.lookedUp)
      expect(sessions().primary).toEqual(primary)
    }
  })

  it('AC15 accepted wheel verdict survives cancellation during animation and cannot spin twice', async () => {
    vi.useFakeTimers()
    useGame.getState().newGame({ cityIndex: 0 })
    solvedChallenge()
    for (const id of useGame.getState().game!.wheel!.segments) {
      expect(useGame.getState().submitWheelTranslation(useGame.getState().game!.words.find((word) => word.wordId === id)!.da)).toBe(true)
    }
    useGame.getState().spinWheel()
    const terminal = useGame.getState().game
    expect(useGame.getState().wheelSpinHold).toBe(true)
    const owner = useGame.getState().eventOwner()
    useGame.getState().abandonGame()
    useGame.getState().spinWheel()
    await useGame.getState().finishRound()
    expect(useGame.getState().game).toBe(terminal)
    expect(useGame.getState().completionReceipt).toMatchObject({ attemptTier: 'platinum', rewards: { postcards: 4 } })
    expect(useSrs.getState().translationPostcards).toBe(0)
    expect(useSrs.getState().games.played).toBe(1)
    expect(useGame.getState().wheelSpinHold).toBe(true)
    useGame.getState().clearWheelSpinHold({ ...owner, attemptId: 'cancelled-old-attempt' })
    expect(useGame.getState().wheelSpinHold).toBe(true)
    await vi.advanceTimersByTimeAsync(3999)
    expect(useGame.getState().wheelSpinHold).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(useGame.getState().wheelSpinHold).toBe(false)
  })

  it('the full-board wheel: a missed key word cannot be typed, and its slice never fills', () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const { found, missed } = partialChallenge(3)
    const word = (id: string) => useGame.getState().game!.words.find((entry) => entry.wordId === id)!
    // Its Danish is on the board, but it was never put into a suitcase.
    expect(useGame.getState().submitWheelTranslation(word(missed[0]!).da)).toBe(false)
    expect(useGame.getState().game!.wheel!.translated).toEqual([])
    for (const id of found) expect(useGame.getState().submitWheelTranslation(word(id).da)).toBe(true)
    const game = useGame.getState().game!
    expect(game.phase).toBe('translateWheel')
    expect(game.wheel!.segments).toHaveLength(found.length + missed.length)
    expect(game.wheel!.filled.some((i) => wheelMissedSegments(game).includes(i))).toBe(false)
  })

  it('after the spin the board stays until See results, which never cuts the spin short', async () => {
    vi.useFakeTimers()
    useGame.getState().newGame({ cityIndex: 0 })
    solvedChallenge()
    for (const id of useGame.getState().game!.wheel!.segments) {
      expect(useGame.getState().submitWheelTranslation(useGame.getState().game!.words.find((word) => word.wordId === id)!.da)).toBe(true)
    }
    expect(useGame.getState().wheelReview).toBe(false)
    useGame.getState().spinWheel()
    expect(useGame.getState().wheelSpinHold).toBe(true)
    expect(useGame.getState().wheelReview).toBe(true)
    useGame.getState().closeWheelReview()
    expect(useGame.getState().wheelReview).toBe(true)
    await vi.advanceTimersByTimeAsync(4000)
    expect(useGame.getState().wheelSpinHold).toBe(false)
    expect(useGame.getState().wheelReview).toBe(true)
    useGame.getState().closeWheelReview()
    expect(useGame.getState().wheelReview).toBe(false)
  })

  it('AC11 cancelled same-layout attempt ignores old Casey and UI timer ownership', async () => {
    useSettings.setState({ useMock: false })
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0 })
    useGame.getState().submitPlayerClue('fælles', 2)
    const owner = useGame.getState().eventOwner()
    const game = useGame.getState().game!
    let respond!: (value: { guesses: { wordId: string; confidence: number; reasoning: string }[] }) => void
    vi.spyOn(OllamaCompanion.prototype, 'getGuesses').mockImplementation(() => new Promise((resolve) => { respond = resolve }))
    const request = useGame.getState().runAiGuesses()
    useGame.getState().abandonGame()
    useGame.getState().newGame()
    const current = useGame.getState().game
    respond({ guesses: [{ wordId: game.words[0].wordId, confidence: 1, reasoning: 'old' }] })
    await request
    useGame.getState().stepAiGuess(owner)
    expect(useGame.getState().game).toBe(current)
    expect(useGame.getState().aiGuessQueue).toEqual([])
    expect(useGame.getState().ownsEvent(owner)).toBe(false)
  })

  it.each(['success', 'rejection'] as const)('AC11 stale clue-language %s cannot submit through the old ClueInput callback after attempt or slot changes', async (outcome) => {
    useSettings.setState({ useMock: false })
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0 })
    let resolve!: (value: TranslationResponse) => void
    let reject!: (error: Error) => void
    vi.spyOn(OllamaCompanion.prototype, 'translate').mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no }))
    // Match ClueInput's real success/offline-fallback branches: both submit
    // against the current store unless the attempt-owned judgment absorbs staleness.
    const ask = () => useGame.getState().judgeTargetWord('fælles').then((allowed) => {
      if (allowed) useGame.getState().submitPlayerClue('fælles', 2)
    }).catch(() => { useGame.getState().submitPlayerClue('fælles', 2) })
    const complete = () => outcome === 'success' ? resolve({ da: 'fælles', en: 'shared' }) : reject(new Error('offline'))
    const changedAttempt = ask()
    useGame.getState().abandonGame()
    useGame.getState().newGame()
    const replacement = useGame.getState().game
    expect(replacement!.phase).toBe('playerClueInput')
    complete(); await changedAttempt
    expect(useGame.getState().game).toBe(replacement)
    await bronze()
    useGame.getState().newGame()
    const primary = sessions().primary
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[0].authoredBoardId)).toBe(true)
    const changedSlot = ask()
    useGame.getState().resumePrimary()
    const resumed = useGame.getState().game
    expect(resumed!.phase).toBe('playerClueInput')
    complete(); await changedSlot
    expect(useGame.getState().game).toBe(resumed)
    expect(sessions().primary).toEqual(primary)
  })

  it('AC11 a current clue-language failure still rejects for ClueInput offline fallback', async () => {
    useSettings.setState({ useMock: false })
    useGame.getState().newGame({ cityIndex: 0 })
    vi.spyOn(OllamaCompanion.prototype, 'translate').mockRejectedValue(new Error('current offline'))
    await expect(useGame.getState().judgeTargetWord('fælles')).rejects.toThrow('current offline')
  })

  it('AC16 finite exhaustion offers replay and never wraps modulo the manifest', () => {
    const facts = { ...emptyProgressFacts(), boards: Object.fromEntries(CITY1_REQUIRED_SET.boards.map((board) => [boardKey(board), { board, best: 'bronze', claims: [] }])),
      firstPrimaryCompletions: Object.fromEntries(CITY1_REQUIRED_SET.boards.map((board) => [firstCompletionKey(board), { board, requiredSet: CITY1_REQUIRED_SET }])) }
    values.set(SETTLEMENT_KEY, JSON.stringify({ schemaVersion: 1, facts, settlements: {} }))
    useGame.getState().newGame({ cityIndex: 0 })
    expect(useGame.getState().courseExhausted).toBe(true)
    expect(useGame.getState().game).toBeNull()
    expect(sessions().continuation.remainingBoardKeys).toEqual([])
    expect(useGame.getState().startReplay(CITY1_REQUIRED_SET.boards[99].authoredBoardId)).toBe(true)
  })

  it('AC12 replay improves Bronze → Silver → Platinum with only missing receipt claims and no primary advance', async () => {
    vi.useFakeTimers()
    useGame.getState().newGame({ cityIndex: 0 })
    await bronze()
    useGame.getState().newGame()
    const primary = sessions().primary
    const continuation = sessions().continuation
    const board = CITY1_REQUIRED_SET.boards[0]
    for (const expected of [1, 0]) {
      expect(useGame.getState().startReplay(board.authoredBoardId)).toBe(true)
      const game = useGame.getState().game!
      const id = targetUnion(game.words.map(word => word.wordId), game.playerKey, game.aiKey)![0]
      useGame.setState({ game: { ...game, phase: 'translateChallenge', reveals: { ...game.reveals, [id]: { kind: 'green' } },
        wheel: { segments: [id], translated: [], filled: [], attempts: 0, landed: null, result: null, spent: null } } })
      expect(useGame.getState().submitWheelTranslation(game.words.find(word => word.wordId === id)!.da)).toBe(true)
      useGame.getState().spinWheel()
      await useGame.getState().finishRound()
      expect(useGame.getState().completionReceipt).toMatchObject({ attemptTier: 'silver', rewards: { postcards: expected } })
      expect(useGame.getState().dismissResult()).toBe(true)
      useGame.getState().newGame()
    }
    expect(useGame.getState().startReplay(board.authoredBoardId)).toBe(true)
    solvedChallenge()
    for (const id of useGame.getState().game!.wheel!.segments) {
      expect(useGame.getState().submitWheelTranslation(useGame.getState().game!.words.find(word => word.wordId === id)!.da)).toBe(true)
    }
    useGame.getState().spinWheel()
    await useGame.getState().finishRound()
    expect(useGame.getState().completionReceipt).toMatchObject({ previousBest: 'silver', newBest: 'platinum', rewards: { postcards: 3 } })
    expect(earnedPostcards(adapter().readLedger().facts, board)).toBe(4)
    expect(sessions().primary).toEqual(primary)
    expect(sessions().continuation).toEqual(continuation)
    expect(useSrs.getState().translationPostcards).toBe(0)
  })

  it('AC11 restored prompt language belongs to its slot; reload invalidates old events and future attempts use current UI', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const owner = useGame.getState().eventOwner()
    const original = sessions()
    adapter().saveSessions('da', { ...original, primary: { ...original.primary!, promptLanguage: 'de' } })
    await useGame.getState().recoverSession()
    expect(useGame.getState().gameUiLanguage).toBe('de')
    expect(useGame.getState().ownsEvent(owner)).toBe(false)
    expect(useGame.getState().game).toEqual(original.primary!.game)
    await bronze()
    useGame.getState().newGame()
    expect(useGame.getState().gameUiLanguage).toBe('en')
    expect(sessions().primary!.promptLanguage).toBe('en')
  })

  it('AC11 learner-course recovery retires foreign slots but never changes their continuation', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const original = sessions()
    const foreign = { ...original,
      continuation: { ...original.continuation, requiredSet: { ...original.continuation.requiredSet, courseId: 'de' as const } },
      primary: { ...original.primary!, board: { ...original.primary!.board, courseId: 'de' as const } } }
    adapter().saveSessions('de', foreign)
    await useGame.getState().recoverSession()
    expect(adapter().readSessions().byCourse.de).toEqual({ ...foreign, primary: null, replay: null, activeSlot: null })
    expect(sessions().primary).toEqual(original.primary)
    const envelope = JSON.parse(values.get(SESSION_KEY)!)
    delete envelope.state.byCourse.da
    values.set(SESSION_KEY, JSON.stringify(envelope))
    useGame.setState({ gameLanguage: 'de' })
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().game).toBeNull()
    expect(useGame.getState().gameLanguage).toBe('da')
    expect(adapter().readSessions().byCourse.de.continuation).toEqual(foreign.continuation)
  })

  it('AC16 corrupted continuation cannot lose a required board', () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const envelope = JSON.parse(values.get(SESSION_KEY)!)
    envelope.state.byCourse.da.continuation.remainingBoardKeys.splice(2, 1)
    values.set(SESSION_KEY, JSON.stringify(envelope))
    expect(() => useGame.getState().newGame()).toThrow('Invalid primary continuation')
  })

  it.each(['daily', 'developer', 'tutorial'] as const)('AC16 %s settles real learning without city claims or primary movement', async (origin) => {
    useGame.getState().newGame({ cityIndex: 0 })
    const primary = sessions().primary
    if (origin === 'tutorial') useGame.getState().newTutorialGame()
    else useGame.getState().newGame({ seed: 99, ...(origin === 'daily' ? { dailyKey: '2026-09-19' } : {}) })
    await bronze()
    expect(useGame.getState().completionReceipt!.cityEligible).toBe(false)
    expect(adapter().readLedger().facts.boards).toEqual({})
    expect(sessions().primary).toEqual(primary)
    expect(useSrs.getState().games.played).toBe(origin === 'tutorial' ? 0 : 1)
    expect(Object.keys(useSrs.getState().stats)).toHaveLength(useGame.getState().game!.words.length)
    if (origin === 'daily') expect(useGame.getState().dailyOutcome('2026-09-19')).toBe('lost')
  })

  describe.each(['daily', 'developer', 'tutorial'] as const)('AC10/16 suspended primary with %s cache', (origin) => {
    it('reload preserves the exact unfinished non-slot attempt without consuming its suspended primary', async () => {
      useGame.getState().newGame({ cityIndex: 0 })
      const primary = sessions().primary
      const continuation = sessions().continuation
      startNonSlot(origin)
      // Stay on a player-owned phase so the browser fixture does not schedule
      // an unrelated AI clue between its first paint and reload assertion.
      useGame.setState({ game: { ...useGame.getState().game!, phase: 'playerClueInput' } })
      useGame.getState().recordLookup(useGame.getState().game!.words[0].wordId)
      const before = useGame.getState()
      const owner = before.eventOwner()
      expect(sessions().activeSlot).toBeNull()
      await reloadFixture(origin, false)
      await useGame.persist.rehydrate()
      await useGame.getState().recoverSession()
      // JSON storage omits undefined optional word metadata; compare every
      // persisted game field exactly, not a partial object with undefined keys.
      expect(useGame.getState().game).toStrictEqual(JSON.parse(JSON.stringify(before.game)))
      expect(useGame.getState()).toMatchObject({ attemptId: before.attemptId,
        attemptOrigin: origin, activeSlot: null, lookedUp: before.lookedUp, dailyKey: before.dailyKey, roundRecorded: false })
      expect(useGame.getState().ownsEvent(owner)).toBe(false)
      expect(sessions()).toMatchObject({ primary, continuation, activeSlot: null })
      expect(adapter().readLedger().settlements).toEqual({})
      expect(useSrs.getState().games.played).toBe(0)
    })

    it('reload settles accepted terminal non-slot evidence once before restoring or retiring its cache', async () => {
      useGame.getState().newGame({ cityIndex: 0 })
      const primary = sessions().primary
      const continuation = sessions().continuation
      startNonSlot(origin)
      const game = useGame.getState().game!
      useGame.setState({ game: { ...game, phase: 'suddenDeath', turnsLeft: 0 } })
      failKey = SETTLEMENT_KEY; failAfter = false
      useGame.getState().playerStop()
      await useGame.getState().finishRound()
      const terminal = useGame.getState().game!
      const attemptId = useGame.getState().attemptId
      expect(terminal.phase).toBe('finished')
      expect(useGame.getState().roundRecorded).toBe(false)
      expect(adapter().readLedger().settlements).toEqual({})
      await reloadFixture(origin, true)
      failKey = null
      await useGame.persist.rehydrate()
      await useGame.getState().recoverSession()
      expect(useGame.getState().game).toStrictEqual(JSON.parse(JSON.stringify(terminal)))
      expect(useGame.getState()).toMatchObject({ attemptId, roundRecorded: true })
      expect(useGame.getState().completionReceipt).toMatchObject({ attemptId, cityEligible: false })
      expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(1)
      expect(sessions()).toMatchObject({ primary, continuation, activeSlot: null })
      expect(adapter().readLedger().facts.boards).toEqual({})
      expect(useSrs.getState().games.played).toBe(origin === 'tutorial' ? 0 : 1)
      expect(Object.keys(useSrs.getState().stats)).toHaveLength(terminal.words.length)
      if (origin === 'daily') expect(useGame.getState().dailyOutcome('2026-09-19')).toBe('lost')
      // Leaving onboarding may discard only the presentation, never its receipt.
      useUi.setState({ onboarding: null })
      await useGame.persist.rehydrate()
      await useGame.getState().recoverSession()
      expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(1)
      if (origin === 'tutorial') expect(useGame.getState().game).toBeNull()
      else expect(useGame.getState().game).toEqual(terminal)
      expect(sessions()).toMatchObject({ primary, continuation, activeSlot: null })
    })

    it('a repeated recovery failure keeps accepted evidence even after onboarding exits', async () => {
      useGame.getState().newGame({ cityIndex: 0 })
      const primary = sessions().primary
      startNonSlot(origin)
      useGame.setState({ game: { ...useGame.getState().game!, phase: 'suddenDeath', turnsLeft: 0 } })
      failKey = SETTLEMENT_KEY; failAfter = false
      useGame.getState().playerStop()
      await useGame.getState().finishRound()
      const terminal = JSON.parse(JSON.stringify(useGame.getState().game))
      const attemptId = useGame.getState().attemptId!
      useUi.setState({ onboarding: null })
      await useGame.persist.rehydrate()
      await useGame.getState().recoverSession()
      expect(useGame.getState().game).toStrictEqual(terminal)
      expect(useGame.getState()).toMatchObject({ attemptId, roundRecorded: false, settlementBusy: false })
      expect(useGame.getState().settlementFailure).toContain('before write')
      expect(adapter().readLedger().settlements).toEqual({})
      expect(sessions().primary).toEqual(primary)
      failKey = null
      await useGame.getState().recoverSession()
      const receipts = Object.values(adapter().readLedger().settlements)
      expect(receipts).toHaveLength(1)
      expect(receipts[0].receipt).toMatchObject({ attemptId, cityEligible: false, evidence: { game: terminal } })
      expect(sessions().primary).toEqual(primary)
      if (origin === 'tutorial') expect(useGame.getState().game).toBeNull()
      else expect(useGame.getState().roundRecorded).toBe(true)
    })

    it('a learner-course switch settles accepted non-slot evidence before retiring the foreign cache', async () => {
      useGame.getState().newGame({ cityIndex: 0 })
      const continuation = sessions().continuation
      startNonSlot(origin)
      useGame.setState({ game: { ...useGame.getState().game!, phase: 'suddenDeath', turnsLeft: 0 } })
      failKey = SETTLEMENT_KEY; failAfter = false
      useGame.getState().playerStop()
      await useGame.getState().finishRound()
      const terminal = JSON.parse(JSON.stringify(useGame.getState().game))
      const attemptId = useGame.getState().attemptId!
      activeCourse.code = 'de'
      useUi.setState({ onboarding: null })
      // Even a failed first recovery under the new course keeps the Danish
      // accepted evidence intact. A second recovery may then retire the cache.
      await useGame.persist.rehydrate()
      await useGame.getState().recoverSession().catch(() => undefined)
      expect(useGame.getState().game).toStrictEqual(terminal)
      expect(useGame.getState().attemptId).toBe(attemptId)
      expect(useGame.getState().settlementFailure).toContain('before write')
      failKey = null
      await useGame.getState().recoverSession()
      expect(useGame.getState().game).toBeNull()
      expect(useGame.getState().gameLanguage).toBe('de')
      const receipts = Object.values(adapter().readLedger().settlements)
      expect(receipts).toHaveLength(1)
      expect(receipts[0].receipt).toMatchObject({ attemptId, cityEligible: false, evidence: { game: terminal } })
      expect(sessions()).toMatchObject({ primary: null, replay: null, activeSlot: null, continuation })
      expect(adapter().readLedger().facts.boards).toEqual({})
      expect(useSrs.getState().games.played).toBe(origin === 'tutorial' ? 0 : 1)
      expect(Object.keys(useSrs.getState().stats)).toHaveLength(terminal.words.length)
      if (origin === 'daily') expect(useGame.getState().dailyOutcome('2026-09-19')).toBe('lost')
      await useGame.getState().recoverSession()
      expect(Object.keys(adapter().readLedger().settlements)).toHaveLength(1)
    })
  })

  it('tutorial translates and spins through the real wheel with practice learning only', async () => {
    useGame.getState().newTutorialGame()
    solvedChallenge()
    const word = useGame.getState().game!.words.find((item) => item.wordId === useGame.getState().game!.wheel!.segments[0])!
    expect(useGame.getState().submitWheelTranslation(word.da)).toBe(true)
    useGame.getState().spinWheel()
    await useGame.getState().finishRound()
    expect(useGame.getState().roundRecorded).toBe(true)
    expect(useGame.getState().completionReceipt!.cityEligible).toBe(false)
    expect(useSrs.getState().games.played).toBe(0)
    expect(useStreak.getState().completedDays).toEqual({})
  })

  it('a stale tutorial cache cannot reopen outside onboarding or invent completion learning', async () => {
    useGame.getState().newTutorialGame()
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().game).toBeNull()
    expect(useSrs.getState().stats).toEqual({})
    expect(useSrs.getState().games.played).toBe(0)
    expect(adapter().readLedger().facts.boards).toEqual({})
  })
})
