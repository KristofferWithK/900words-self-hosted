/// <reference types="node" />
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Settings' "Replay the intro" after a completed first session (owner,
 * 2026-10-04: "When someone replays the intro they replay the whole intro ...
 * Phase two of the intro should also be reset as if someone plays it for the
 * first time", and "phase 2 of the intro is a full game where at the end the
 * stamp system gets explained. It's part of the intro"). Driven through the
 * same store calls and helpers the acts make (OnboardingScreen.tsx), with a
 * real primary round of the player's own paused underneath:
 *
 *  1. the replay starts at step 1, the ticket, and the done marker stays;
 *  2. its practice is FRESH, never the one an earlier replay left on the
 *     table, and the walk and the practice record nothing;
 *  3. after the practice it plays the full game: the city's first café,
 *     dealt fresh (never the paused round), which records like any café
 *     puzzle and whose finish screen teaches the stamp;
 *  4. the player's paused round is identical after the replay, and is the
 *     round Home continues.
 */
const { capacitor } = vi.hoisted(() => ({
  capacitor: { isNativePlatform: vi.fn(() => true), getPlatform: vi.fn(() => 'ios') },
}))
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
  removeItem: (key: string) => void values.delete(key),
}
vi.stubGlobal('localStorage', storage)
vi.stubGlobal('window', { localStorage: storage })

const { useGame } = await import('../stores/gameStore')
const { useUi } = await import('../stores/uiStore')
const { useSrs } = await import('../stores/srsStore')
const { useStatsPorts } = await import('../analytics/stats')
const { createSettlementStore } = await import('../stores/settlementStore')
const { findEveryCafe } = await import('../journey/cafeTestSupport')
const { runResultsSink } = await import('../run/results')
const { RUNS_KEY } = await import('../purchase/dailyGames')
const { ONBOARD_KEY, ONBOARD_LESSONS_KEY, decideOnboarding } = await import('./flow')
const { installReplayWalkSink, replayWalkFoundCafe, startReplayWalk } = await import('./replayWalk')
const { dealReplayPractice, leavePractice, openIntroRound } = await import('../ui/introRound')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { actionableCourseSlot } = await import('../ui/screens/HomeScreen')
const { OnboardingScreen } = await import('../ui/screens/OnboardingScreen')

const sessions = () => createSettlementStore({ storage }).readSessions().byCourse.da
const snapshot = () => Object.fromEntries(values)

/** The acts' own path through a replay, up to the practice table. */
function replayToPractice() {
  useUi.getState().startOnboarding()
  useUi.getState().advanceOnboarding('intro')
  useUi.getState().advanceOnboarding('walk')
  // WalkAct: the demo sink goes in as the act draws; the walk takes six photos.
  startReplayWalk()
  const uninstall = installReplayWalkSink()
  const sink = runResultsSink()
  const at = Date.now()
  for (let i = 0; i < 6; i++) sink.photo({ walk: 'words', kind: 'meaning', wordId: 'da:hus', at: at + i } as never)
  sink.miss({ walk: 'words', kind: 'meaning', wordId: 'da:by', at: at + 7 } as never)
  sink.end({ walk: 'words', end: 'second-wrong', answered: 7, photos: 6, startedAt: at } as never)
  expect(replayWalkFoundCafe()).toBe(true)
  uninstall()
  useUi.getState().advanceOnboarding('home-cafe')
  useUi.getState().advanceOnboarding('tutorial')
  // TutorialAct: a fresh practice, once, on entry.
  dealReplayPractice()
}

/** Play the round on the table to its end (the clues run out). */
async function finishRound() {
  const game = useGame.getState().game!
  useGame.setState({ game: { ...game, phase: 'suddenDeath', turnsLeft: 0 } })
  useGame.getState().playerStop()
  await useGame.getState().finishRound()
}
const finishPractice = finishRound

/** What the app keeps of the player's progress, the game display cache and the course sessions (checked slot by slot) aside. */
const progress = () => Object.fromEntries([...values].filter(([key]) => key !== 'cluecab-game-v1' && key !== 'cluecab-progression-sessions-v1'))

beforeEach(async () => {
  await useGame.getState().finishRound()
  values.clear()
  useGame.setState(useGame.getInitialState())
  useSrs.setState(useSrs.getInitialState())
  useUi.setState({ pendingFirstGiver: 'ai', screen: 'home', onboarding: null, dailyLimitOpen: false, dailyLimitRetry: null })
  useStatsPorts(null)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') }))
  // A completed first session, in English, whose walk found the first café.
  values.set(ONBOARD_KEY, 'done')
  values.set('cluecab-ui-language', 'en')
  findEveryCafe()
  // The first session's café puzzle, played; then the player's own next
  // round, under way and paused.
  expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
  await finishRound()
  expect(useGame.getState().completionReceipt).not.toBeNull()
  useGame.getState().dismissResult()
  expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
  expect(useGame.getState().authoredBoardId).not.toBe(CITY1_REQUIRED_SET.boards[0]!.authoredBoardId)
  useGame.getState().recordLookup(useGame.getState().game!.words[0]!.wordId)
})

describe('replaying the intro after a completed first session', () => {
  it('starts at step 1, the ticket, and leaves the done marker as it was', () => {
    useUi.getState().startOnboarding()
    expect(useUi.getState().onboarding).toEqual({ step: 'ticket', persist: false })
    expect(decideOnboarding(storage)).toEqual({ kind: 'done' })
    // What the screen draws for it: the ticket act (a server render reads the
    // store's initial state, so the run is written there for the render).
    const initial = useUi.getInitialState()
    const saved = initial.onboarding
    Object.assign(initial, { onboarding: useUi.getState().onboarding })
    try {
      const html = renderToStaticMarkup(<OnboardingScreen />)
      expect(html).toContain('data-act="ticket"')
      expect(html).toContain('onboard-ticket')
    } finally {
      Object.assign(initial, { onboarding: saved })
    }
  })

  it('sits down at a fresh practice, never the one an earlier replay left half-played', async () => {
    const primary = useGame.getState().attemptId
    // An earlier replay, closed in the middle of its practice.
    useUi.setState({ onboarding: { step: 'tutorial', persist: false } })
    dealReplayPractice()
    const stale = useGame.getState()
    useGame.setState({ game: { ...stale.game!, turnsLeft: 2, reveals: { [stale.game!.words[0]!.wordId]: { kind: 'green' } } } })
    useUi.setState({ onboarding: null })

    replayToPractice()
    const fresh = useGame.getState()
    expect(fresh.mode).toBe('tutorial')
    expect(fresh.tutorialDemo).toBe(true)
    expect(fresh.attemptId).not.toBe(stale.attemptId)
    expect(Object.values(fresh.game!.reveals).every((reveal) => reveal.kind === 'hidden')).toBe(true)
    expect(fresh.game!.turnsLeft).not.toBe(2)
    expect(fresh.game!.clueHistory).toEqual([])
    expect(fresh.game!.words).toHaveLength(9)
    // The player's own round is paused under it, not continued.
    expect(fresh.tutorialResumeSlot).toBe('primary')
    expect(sessions()).toMatchObject({ activeSlot: null, primary: { attemptId: primary } })
  })

  it('plays the full game after the practice: the first café, fresh, recorded, with the stamp lesson; the paused round identical after', async () => {
    const primary = useGame.getState().attemptId
    const primarySlot = sessions().primary
    const ledgerBefore = createSettlementStore({ storage }).readLedger()
    const before = progress()

    replayToPractice()
    await finishPractice()
    // The walk and the practice are demos: not one byte of progress written.
    expect(useGame.getState()).toMatchObject({ mode: 'tutorial', roundRecorded: true, completionReceipt: null })
    expect(progress()).toEqual(before)
    expect(sessions().primary).toEqual(primarySlot)
    expect(values.has(RUNS_KEY)).toBe(false)

    // The practice's finish: on to the café puzzle, as on the first time.
    leavePractice(false)
    expect(useUi.getState().onboarding?.step).toBe('real-round')
    openIntroRound(false)
    const board = useGame.getState()
    // Fresh, the city's first café, Casey's clue first; never the paused round.
    expect(board).toMatchObject({ mode: 'normal', activeSlot: 'replay', authoredBoardId: CITY1_REQUIRED_SET.boards[0]!.authoredBoardId })
    expect(board.attemptId).not.toBe(primary)
    expect(board.game!.phase).toBe('aiClueInput')
    expect(board.game!.clueHistory).toEqual([])
    expect(Object.values(board.game!.reveals).every((reveal) => reveal.kind === 'hidden')).toBe(true)
    expect(sessions().primary).toEqual(primarySlot)

    // Real play: it records like any café puzzle, and its finish screen owes
    // the result lesson that teaches the stamp (RoundSummary opens it over
    // the saved receipt while the lesson is owed).
    await finishRound()
    const receipt = useGame.getState().completionReceipt
    expect(receipt).toMatchObject({ cityEligible: true, evidence: { origin: 'replay' } })
    expect(Object.keys(createSettlementStore({ storage }).readLedger().settlements).length)
      .toBe(Object.keys(ledgerBefore.settlements).length + 1)
    expect(useUi.getState().onboarding?.lessons?.result).toBeUndefined()

    // Its finish screen's Home, the stamp lesson on Home, the suitcase, done.
    useUi.getState().advanceOnboarding('home-return')
    useUi.getState().advanceOnboarding('suitcase')
    useUi.getState().advanceOnboarding('suitcase-ready')
    useUi.getState().finishOnboarding()

    // The paused round is identical, and it is the round Home continues.
    expect(sessions().primary).toEqual(primarySlot)
    expect(actionableCourseSlot(useGame.getState().activeSlot, sessions())).toBe('primary')
    useGame.getState().resumePrimary()
    expect(useGame.getState()).toMatchObject({ mode: 'normal', activeSlot: 'primary', attemptId: primary })
    expect(values.get(ONBOARD_KEY)).toBe('done')
    expect(values.has(ONBOARD_LESSONS_KEY)).toBe(false)
  })

  it('a replay skipped at its practice gives the real round back intact too', () => {
    const primary = useGame.getState().attemptId
    const before = snapshot()
    replayToPractice()
    // GameScreen's Skip in the practice: the paused slot back, the intro over.
    expect(useGame.getState().restoreTutorialSuspension()).toBe(true)
    useUi.getState().finishOnboarding()
    expect(useGame.getState()).toMatchObject({ mode: 'normal', activeSlot: 'primary', attemptId: primary })
    expect(snapshot()).toEqual(before)
  })
})
