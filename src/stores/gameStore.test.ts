import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const soundMocks = vi.hoisted(() => ({
  wheelWinFanfare: vi.fn(),
  rewardHaptic: vi.fn(),
  guessResultHaptic: vi.fn(),
  guessErrorBlip: vi.fn(),
  playWord: vi.fn(async () => 'baked' as const),
}))

vi.mock('../ui/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/feedback')>()
  return {
    ...actual,
    wheelWinFanfare: soundMocks.wheelWinFanfare,
    rewardHaptic: soundMocks.rewardHaptic,
    guessResultHaptic: soundMocks.guessResultHaptic,
    guessErrorBlip: soundMocks.guessErrorBlip,
  }
})

vi.mock('../ui/speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/speak')>()
  return { ...actual, playWord: soundMocks.playWord }
})

/** zustand resolves storage when the module is imported, so install the node
 * stand-in first. */
const written = new Map<string, string>()
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  // zustand reaches for window.localStorage specifically, so a bare
  // globalThis.localStorage is not enough.
  value: { localStorage: storage },
})
// And the bare global, because finishRound writes the daily challenge's result
// straight to `localStorage` — so without this the whole daily path throws in
// here rather than being testable, which is how it went untested.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { shippedBoardConfig } = await import('../engine/config')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { SESSION_KEY, SETTLEMENT_KEY } = await import('./settlementStorage')
const { bakedOpeningFor, migrateGame, onPracticeCompanion, rerollOpen, roundOf, roundPlaysOffline, useGame, wrappableIds } = await import('./gameStore')
const { useUi } = await import('./uiStore')
const { applyEvent } = await import('../engine/game')
const { danish } = await import('../lang/da')
const { buildAiClueView } = await import('../ai/projections')
const { useJourney } = await import('./journeyStore')
// Required boards are cafés a walk must find first (CW-04); these tests are about the board game.
const { everyCafeFound } = await import('../journey/cafeTestSupport')
const { useSettings } = await import('./settingsStore')
const { useCurriculum } = await import('./curriculumStore')
const { useSurvival } = await import('./survivalStore')
const { useSrs } = await import('./srsStore')
const { useStatsPorts } = await import('../analytics/stats')
const { useStreak } = await import('../streak/streak')
const { WORDS } = await import('../data/words')
const { CITY1_BOARD_CYCLE } = await import('../data/city1BoardCycle')
const { newStats } = await import('../srs/scheduler')
const { wordsForCity } = await import('../journey/progress')
const { targetUnion } = await import('../progression/rules')
const {
  TUTORIAL_SEED,
  TUTORIAL_WORD_IDS,
} = await import('../onboarding/tutorial')

// Every case owns its receipt/session values; async durable effects must finish
// before a subsequent test resets their destinations.
beforeEach(async () => {
  vi.clearAllMocks()
  soundMocks.playWord.mockResolvedValue('baked')
  await useGame.getState().finishRound()
  written.clear()
  useGame.setState(useGame.getInitialState())
  useSrs.setState(useSrs.getInitialState())
  useStreak.setState(useStreak.getInitialState())
  useJourney.setState({ ...useJourney.getInitialState(), cafes: everyCafeFound() })
  useCurriculum.setState(useCurriculum.getInitialState())
  useSurvival.setState(useSurvival.getInitialState())
  useUi.setState({ pendingFirstGiver: null, screen: 'home', onboarding: null })
  useStatsPorts(null)
})
afterEach(async () => { await useGame.getState().finishRound() })

describe('gameStore: normal rounds keep model-backed Casey', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    useSettings.setState({ useMock: false })
    useGame.getState().abandonGame({ parked: true })
  })

  it('exposes no player-facing route to an agentless companion', async () => {
    const state = useGame.getState() as unknown as Record<string, unknown>
    expect(state).not.toHaveProperty('practiceFallback')
    expect(state).not.toHaveProperty('fallBackToPractice')
  })

  it('ignores a stale mock flag in an installed native app', async () => {
    const native = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    try {
      useSettings.setState({ useMock: true })
      expect(onPracticeCompanion()).toBe(false)
    } finally {
      native.mockRestore()
    }
  })

  it('retry clears the error without changing the companion setting', async () => {
    useGame.setState({ error: 'Casey could not answer.' })
    useGame.getState().clearError()
    expect(useGame.getState().error).toBeNull()
    expect(useSettings.getState().useMock).toBe(false)
    expect(useSettings.getState().useMock).toBe(false)
  })
})

describe('gameStore: revisited-city board context', () => {
  beforeEach(() => {
    useGame.getState().abandonGame({ parked: true })
    useGame.setState({ recentBoards: [], boardCityIndex: 4 })
    useJourney.setState({ cityIndex: 4 })
    useSrs.getState().reset()
    useSettings.setState({ useMock: false })
  })

  it('deals a selected past-city pool without moving the route, and Play again keeps it', async () => {
    const pastCity = 1
    const expected = new Set(wordsForCity(WORDS, pastCity).map((word) => word.id))
    useGame.getState().newGame({ seed: 610, cityIndex: pastCity })

    expect(useGame.getState().boardCityIndex).toBe(pastCity)
    expect(useJourney.getState().cityIndex).toBe(4)
    expect(useGame.getState().game!.words.every((word) => expected.has(word.wordId))).toBe(true)
    // Summary's CTA calls newGame() without an option. It must not silently
    // jump back to the current route city after the player chose a revisit.
    useGame.getState().newGame({ seed: 611 })
    expect(useGame.getState().boardCityIndex).toBe(pastCity)
    expect(useGame.getState().game!.words.every((word) => expected.has(word.wordId))).toBe(true)
    expect(useJourney.getState().cityIndex).toBe(4)
  })

  it('keeps ordinary revisit rounds on the normal Casey path', async () => {
    useGame.getState().newGame({ seed: 612, cityIndex: 2 })
    expect(useGame.getState().mode).toBe('normal')
    expect(onPracticeCompanion()).toBe(false)
  })

  it('records replay results against the selected city’s language-qualified word ids', async () => {
    useGame.getState().newGame({ seed: 613, cityIndex: 1 })
    const game = useGame.getState().game!
    useGame.setState({
      game: {
        ...game,
        phase: 'finished',
        reveals: Object.fromEntries(game.words.map((word) => [word.wordId, { kind: 'hidden' }])),
        outcome: { result: 'lost', reason: 'timeout' },
      } as never,
      roundRecorded: false,
    })
    await useGame.getState().finishRound()
    const ids = game.words.map((word) => word.wordId)
    expect(ids.every((id) => id.startsWith('da:'))).toBe(true)
    expect(ids.every((id) => useSrs.getState().stats[id]?.seen === 1)).toBe(true)
  })
})

describe('gameStore: finite required City 1 queue (successor to the modulo authored cycle)', () => {
  it('retains every archive layout, both keys, overlap and Casey-first engine deal without modulo progression', async () => {
    const { dealCity1AuthoredBoard } = await import('./gameStore')
    for (const [index, expected] of CITY1_BOARD_CYCLE.entries()) {
      const { game } = dealCity1AuthoredBoard(index)
      expect(game.words.map((word) => word.wordId)).toEqual(expected.wordIds)
      expect(game.words.filter(word => game.playerKey[word.wordId] === 'green').map(word => word.wordId).sort()).toEqual([...expected.playerGreenIds].sort())
      expect(game.words.filter(word => game.aiKey[word.wordId] === 'green').map(word => word.wordId).sort()).toEqual([...expected.aiGreenIds].sort())
      expect(game.config.greenOverlap).toBe(expected.greenOverlap)
      expect(['player', 'ai']).toContain(expected.firstGiver)
      expect(game.phase).toBe('aiClueInput')
    }
  })

  it('required receipt queue takes precedence over a real stale prefetched certification candidate', async () => {
    const { clearCertificationPrefetch, prepareCertificationBatch, prefetchCertification } = await import('../boardCertification')
    clearCertificationPrefetch()
    const batch = prepareCertificationBatch({ cityIndex: 0, pool: wordsForCity(WORDS, 0), stats: {}, wrapped: new Set(), recentBoards: [], now: 1_800_000_000_000, seed: 0xb01 })!
    await prefetchCertification(batch, (async () => new Response(JSON.stringify({ protocol: 1, certifiedCandidateIndices: [4] }), { status: 200 })) as typeof fetch)
    useGame.getState().newGame({ cityIndex: 0 })
    expect(useGame.getState().boardCertification).toBe('authored-cycle')
    expect(useGame.getState().authoredBoardId).toBe(CITY1_REQUIRED_SET.boards[0].authoredBoardId)
    clearCertificationPrefetch()
  })

  it('opens the first frozen member without consuming it, ahead of old certification', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const state = useGame.getState()
    expect(state.boardCertification).toBe('authored-cycle')
    expect(state.authoredBoardId).toBe(CITY1_REQUIRED_SET.boards[0].authoredBoardId)
    const authored = CITY1_BOARD_CYCLE.find((board) => board.id === state.authoredBoardId)!
    expect(state.game!.words.map((word) => word.wordId)).toEqual(authored.wordIds)
    for (const word of state.game!.words) {
      expect(state.game!.playerKey[word.wordId]).toBe(authored.playerGreenIds.includes(word.wordId) ? 'green' : 'bystander')
      expect(state.game!.aiKey[word.wordId]).toBe(authored.aiGreenIds.includes(word.wordId) ? 'green' : 'bystander')
    }
    expect(state.city1BoardCursor).toBe(0)
    expect(state.sessions!.continuation.remainingBoardKeys).toHaveLength(100)
  })

  it('repeated Play and reroll preserve the attempt and both authored keys', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const before = useGame.getState()
    useGame.getState().newGame({ cityIndex: 0 })
    useGame.getState().rerollBoard()
    expect(useGame.getState().attemptId).toBe(before.attemptId)
    expect(useGame.getState().game).toEqual(before.game)
    expect(useGame.getState().sessions).toEqual(before.sessions)
  })

  it('persists board/attempt identity and sends only the authored board ID to Casey', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const state = useGame.getState()
    const saved = JSON.parse(written.get(SESSION_KEY)!).state.byCourse.da.primary
    expect(saved.attemptId).toBe(state.attemptId)
    expect(saved.board.authoredBoardId).toBe(state.authoredBoardId)
    const view = buildAiClueView(state.game!, [], { boardId: state.authoredBoardId })
    expect(view.boardId).toBe(state.authoredBoardId)
    expect(view).not.toHaveProperty('attemptId')
  })

  it('other cities and explicit/daily fixtures never acquire required eligibility', async () => {
    for (const opts of [{ cityIndex: 2, seed: 10 }, { cityIndex: 0, seed: 123 }, { cityIndex: 0, seed: 123, dailyKey: '2026-09-19' }]) {
      useGame.getState().newGame(opts)
      expect(useGame.getState().authoredBoardId).toBeNull()
      expect(useGame.getState().activeSlot).toBeNull()
      expect(['developer', 'daily', 'optional']).toContain(useGame.getState().attemptOrigin)
    }
  })
})

/**
 * "I want a reroll button at the beginning to reroll the board if I have no
 * idea on how to connect the words."
 *
 * The interesting part is not dealing a second board — newGame already does
 * that — it is what the reroll tells the NEXT deal. Exactly three words of the
 * last board come back on every board, and the store remembers two boards deep
 * so a carried word has to sit one out before it can carry again. A board dealt
 * and rejected in ten seconds is not a board the player played, so it must
 * REPLACE the head of that window rather than push onto it. Pushing costs
 * twice: the genuinely-previous board falls out of the two-deep window, and the
 * reroll comes back holding three words of the board just rejected.
 */
describe('gameStore: rerolling the board before the first clue', () => {
  const ids = () => useGame.getState().game!.words.map((w) => w.wordId)

  beforeEach(() => {
    useSettings.setState({ useMock: true })
    useGame.getState().abandonGame({ parked: true })
    useGame.setState({ recentBoards: [] })
  })

  it('deals a different board with the overlap resolved from its new seed', async () => {
    useGame.getState().newGame({ seed: 11 })
    const before = ids()
    const { seed: seedBefore } = useGame.getState().game!
    useGame.getState().rerollBoard()
    const after = ids()
    expect(after).not.toEqual(before)
    expect(seedBefore).not.toBe(useGame.getState().game!.seed)
    const rerolled = useGame.getState().game!
    expect(rerolled.config).toEqual(shippedBoardConfig(rerolled.seed))
    expect(after).toHaveLength(before.length)
  })

  it('and the round it deals is untouched — no clue, nothing spent', async () => {
    useGame.getState().newGame({ seed: 11 })
    useGame.setState({ lookedUp: ['x'], error: 'boom' })
    useGame.getState().rerollBoard()
    const s = useGame.getState()
    expect(s.game!.clueHistory).toEqual([])
    expect(s.lookedUp).toEqual([])
    expect(s.error).toBeNull()
  })

  it('replaces the board it threw away rather than remembering it', async () => {
    useGame.getState().newGame({ seed: 1 })
    const first = ids()
    useGame.getState().newGame({ seed: 2 })
    const second = ids()
    expect(useGame.getState().recentBoards).toEqual([second, first])

    useGame.getState().rerollBoard()
    const rerolled = ids()
    // The rejected board is gone; the one actually played is still there, so
    // the "may not carry over twice running" rule still has something to read.
    expect(useGame.getState().recentBoards).toEqual([rerolled, first])
  })

  /**
   * The consequence of the line above, stated as a behaviour rather than as a
   * data structure: the reroll carries words back from the last board the
   * player PLAYED, not from the one they just said they could not read.
   */
  it('so the new board carries its three words from the last board played', async () => {
    useGame.getState().newGame({ seed: 1 })
    const played = ids()
    useGame.getState().newGame({ seed: 2 })
    useGame.getState().rerollBoard()
    const rerolled = ids()
    expect(rerolled.filter((id) => played.includes(id))).toHaveLength(3)
  })

  /**
   * Casey opens, so his clue is on the table within seconds of the deal — and
   * the reroll was asked for precisely for the player who has read the board
   * and cannot connect it. His opening clue has spent nothing a re-deal would
   * undo, so it does not close the window; the player's first move does.
   * Mutation-checked: `clueHistory.length > 0` in rerollOpen fails the first
   * of these, and dropping the guesses check fails the second.
   */
  it('stays open while Casey’s opening clue is the only thing on the table', async () => {
    useGame.getState().newGame({ seed: 11 })
    const dealt = ids()
    expect(useGame.getState().game!.phase).toBe('aiClueInput')
    useGame.setState({
      game: applyEvent(
        useGame.getState().game!,
        { type: 'SUBMIT_CLUE', by: 'ai', text: 'huskeliste', number: 2 },
        danish,
      ),
    })
    expect(rerollOpen(useGame.getState().game, { dailyKey: null, mode: 'normal' })).toBe(true)
    useGame.getState().rerollBoard()
    expect(ids()).not.toEqual(dealt)
    expect(useGame.getState().game!.clueHistory).toEqual([])
    expect(useGame.getState().game!.phase).toBe('aiClueInput')
  })

  it('refuses once the player has guessed under it', async () => {
    useGame.getState().newGame({ seed: 11 })
    const game = applyEvent(
      useGame.getState().game!,
      { type: 'SUBMIT_CLUE', by: 'ai', text: 'huskeliste', number: 2 },
      danish,
    )
    useGame.setState({ game })
    useGame.getState().playerGuess(game.words[0]!.wordId)
    const dealt = ids()
    expect(useGame.getState().game!.clueHistory[0]!.guesses).toHaveLength(1)
    useGame.getState().rerollBoard()
    expect(ids()).toEqual(dealt)
  })

  it('and once the player has clued, when they were dealt in first', async () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    try {
      useGame.getState().newGame({ seed: 11 })
      expect(useGame.getState().game!.phase).toBe('playerClueInput')
      useGame.getState().submitPlayerClue('klods', 2)
      expect(useGame.getState().game!.clueHistory).toHaveLength(1)
      const dealt = ids()
      useGame.getState().rerollBoard()
      expect(ids()).toEqual(dealt)
    } finally {
      useUi.setState({ pendingFirstGiver: null })
    }
  })

  it('and never in the scripted practice round', async () => {
    useGame.getState().newTutorialGame()
    const dealt = ids()
    useGame.getState().rerollBoard()
    expect(ids()).toEqual(dealt)
    expect(useGame.getState().mode).toBe('tutorial')
  })

  /** One shared board per date. A rerolled daily is nobody's board. */
  it('refuses on the daily challenge', async () => {
    useGame.getState().newGame({ seed: 20260814, dailyKey: '2026-08-14' })
    const dealt = ids()
    useGame.getState().rerollBoard()
    expect(ids()).toEqual(dealt)
    expect(useGame.getState().dailyKey).toBe('2026-08-14')
  })

  it('and does nothing at all with no game', async () => {
    useGame.getState().abandonGame({ parked: true })
    expect(() => useGame.getState().rerollBoard()).not.toThrow()
    expect(useGame.getState().game).toBeNull()
  })
})

/**
 * Collection depends on knowing whose work earned each green, and finishRound
 * is the only place that can still tell: a guess is judged against the
 * clue-giver's key, so a green under a clue `by: 'player'` is Casey finding
 * the player's word (clue credit), a green under `by: 'ai'` is the player's
 * own tap (guess credit), and a green reveal that appears in NO clue's guess
 * list was named in sudden death — the reducer writes that reveal without a
 * guess record — which is the player naming it with no clue-giver at all.
 *
 * Mutation-checked: swapping the two `by` comparisons fails the first two
 * tests; dropping the sudden-death fallback fails the third.
 */
describe('gameStore: which side earned each green', () => {
  const word = (id: string) => ({ wordId: id, da: id, en: [id], pos: 'noun' })

  const finishedGame = () =>
    ({
      config: { rows: 2, cols: 2, totalWords: 4, greensPerSide: 2, greenOverlap: 1, turnTokens: 3, maxNewWordsPerBoard: 4 },
      seed: 1,
      words: ['a', 'b', 'c', 'd'].map(word),
      reveals: {
        a: { kind: 'green' },
        b: { kind: 'green' },
        c: { kind: 'green' },
        d: { kind: 'hidden' },
      },
      playerKey: { a: 'green', b: 'bystander', c: 'green', d: 'bystander' },
      aiKey: { a: 'bystander', b: 'green', c: 'green', d: 'green' },
      phase: 'finished',
      turnsLeft: 0,
      clueHistory: [
        { by: 'player', text: 'x', number: 1, guesses: [{ wordId: 'a', result: 'green' }] },
        { by: 'ai', text: 'y', number: 2, guesses: [{ wordId: 'b', result: 'green' }] },
        // 'c' is revealed green but appears in no guess list: sudden death.
      ],
      outcome: { result: 'lost', reason: 'sudden-death' },
    }) as never

  beforeEach(() => {
    useSettings.setState({ useMock: true })
    useSrs.getState().reset()
    useGame.getState().abandonGame({ parked: true })
    // Receipt authority requires an explicit new attempt even for direction fixtures.
    useGame.getState().newGame({ seed: 17 })
  })

  it("credits the player's clue when Casey finds the word", async () => {
    useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
    await useGame.getState().finishRound()
    expect(useSrs.getState().stats.a).toMatchObject({ greenByClue: 1, greenByGuess: 0 })
  })

  it("credits the player's guess when they find Casey's word", async () => {
    useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
    await useGame.getState().finishRound()
    expect(useSrs.getState().stats.b).toMatchObject({ greenByClue: 0, greenByGuess: 1 })
  })

  it('a sudden-death green is the player naming it: guess credit', async () => {
    useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
    await useGame.getState().finishRound()
    expect(useSrs.getState().stats.c).toMatchObject({ greenByClue: 0, greenByGuess: 1 })
  })

  it('an unrevealed word earns neither', async () => {
    useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
    await useGame.getState().finishRound()
    expect(useSrs.getState().stats.d).toMatchObject({ greenByClue: 0, greenByGuess: 0 })
  })

  /**
   * This block used to end with "a redemption answer never advances the
   * collection" — translating a word back in the last chance credited
   * redemptionRight, never greenByClue or greenByGuess, so a word could not be
   * collected by typing it. The last chance is retired and the counters are
   * frozen; the rule it protected is the one above it, that only a green earned
   * each way collects a word, and that is still pinned four ways.
   */

  /**
   * The round summary's other counter. It has to be read BEFORE recordRound,
   * because recordRound gives every word on the board an SRS record — after it
   * runs, a word met for the first time today is indistinguishable from one met
   * a year ago and the diff is uniformly empty.
   *
   * Mutation-checked: moving the `newlyDiscovered` line below the
   * `recordRound` call makes every test here read `[]` and all three fail.
   */
  describe('and which words it was the first sight of', () => {
    it('a board of words never seen before is all new', async () => {
      useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
      await useGame.getState().finishRound()
      expect(useGame.getState().newlyDiscovered.sort()).toEqual(['a', 'b', 'c', 'd'])
    })

    it('a word with an SRS record from an earlier round is not new', async () => {
      useSrs.setState({ stats: { a: newStats(1_700_000_000_000) } })
      useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
      await useGame.getState().finishRound()
      expect(useGame.getState().newlyDiscovered).not.toContain('a')
      expect(useGame.getState().newlyDiscovered.sort()).toEqual(['b', 'c', 'd'])
    })

    /**
     * Discovered is about meeting a word, not about doing well with it — 'd'
     * ends this round unrevealed and still counts, which is exactly what
     * `wordState` means by `discovered`.
     */
    it('counts a word that was never even revealed', async () => {
      useGame.setState({ game: finishedGame(), roundRecorded: false, lookedUp: [] })
      await useGame.getState().finishRound()
      expect(useGame.getState().newlyDiscovered).toContain('d')
    })
  })
})

/**
 * v4 -> v5 drops the debrief.
 *
 * This store HAS a partialize, which writes the saved blob back key for key —
 * so a `debrief` object stored once by an older build would ride along in every
 * save that device ever wrote again, long after nothing could read it. Unlike
 * v3 -> v4 this migration costs the player nothing: no persisted shape changed,
 * so a round in flight resumes as itself.
 *
 * Exported and tested directly for the reason migrateSrs is: under vitest there
 * is no localStorage, persist quietly becomes a passthrough, and a test reaching
 * through the middleware would be testing nothing.
 */
describe('gameStore: the v4 -> v5 migration', () => {
  const v4 = () => ({
    recentBoards: [['w1']],
    game: { phase: 'playerGuessing' },
    lookedUp: ['w1'],
    roundRecorded: false,
    dailyKey: null,
    mode: 'normal',
    packed: [],
    packingMissed: [],
    packingDone: true,
    debrief: { summary: 'Casey said something.', takeaways: ['one thing'] },
    debriefFailed: false,
    newlyLearned: ['w1'],
  })

  it('drops both dead keys rather than leaving them to rot in the blob', async () => {
    const out = migrateGame(v4(), 4) as Record<string, unknown>
    expect(out).not.toHaveProperty('debrief')
    expect(out).not.toHaveProperty('debriefFailed')
  })

  it('gives the summary its new counter', async () => {
    expect((migrateGame(v4(), 4) as { newlyDiscovered: string[] }).newlyDiscovered).toEqual([])
  })

  it('and keeps the round in flight — nothing in it changed shape', async () => {
    const out = migrateGame(v4(), 4) as Record<string, unknown>
    expect(out.game).toEqual({ phase: 'playerGuessing' })
    expect(out.lookedUp).toEqual(['w1'])
    expect(out.newlyLearned).toEqual(['w1'])
    expect(out.recentBoards).toEqual([['w1']])
  })

  it('recovers a v6 round city from its saved city-only board', async () => {
    const city = 6
    const wordId = wordsForCity(WORDS, city)[0]!.id
    const inFlight = { game: { words: [{ wordId }] }, newlyDiscovered: ['w9'], gameLanguage: 'da' }
    expect((migrateGame(inFlight, 6) as { boardCityIndex: number }).boardCityIndex).toBe(city)
  })

  describe('v13 -> v14: the wheel fills a random segment', () => {
    /** A v13 save mid-challenge: three segments, two answered, no `filled`. */
    const v13 = () => {
      const segments = ['w0', 'w1', 'w2']
      return {
        game: {
          phase: 'translateChallenge',
          wheel: {
            segments,
            translated: ['w2', 'w0'],
            attempts: 1,
            landed: null,
            result: null,
            spent: null,
          },
        },
        parked: null,
      }
    }

    it('rebuilds the wheel\u2019s filled list from translated\u2019s board order', async () => {
      const out = migrateGame(v13(), 13) as { game: { wheel: { filled: number[] } } }
      // `translated` was the sequential rule's fill order, so the rebuilt
      // list is those words' positions in `segments`: w2 -> 2, w0 -> 0.
      expect(out.game.wheel.filled).toEqual([2, 0])
    })

    it('leaves a wheel that already carries filled untouched (and a save without a wheel)', async () => {
      const withFilled = v13()
      ;(withFilled.game.wheel as { filled?: number[] }).filled = [1]
      const same = migrateGame(withFilled, 14) as {
        game: { wheel: { filled?: number[] } }
      }
      expect(same.game.wheel.filled).toEqual([1])
      const noWheel = { game: { phase: 'playerGuessing' }, parked: null }
      expect((migrateGame(noWheel, 13) as { game: { wheel?: null } }).game.wheel).toBeUndefined()
    })

    it('migrates a parked round\u2019s wheel too', async () => {
      // ParkedRound holds the round's fields at the top, not under `game`.
      const parked = {
        ...v13(),
        game: { phase: 'playerGuessing' },
        parked: { game: v13().game, gameLanguage: 'da', gameUiLanguage: 'en', boardCityIndex: 0, lookedUp: [], authoredBoardId: null },
      }
      const out = migrateGame(parked, 13) as {
        game: { wheel?: { filled?: number[] } }
        parked: { game: { wheel: { filled: number[] } } }
      }
      expect(out.game.wheel).toBeUndefined()
      expect(out.parked.game.wheel.filled).toEqual([2, 0])
    })
  })

  describe('v14 -> v15: the spin decides the round', () => {
    /** A v14 save sitting on the old chooser: a won, UNSPENT spin. */
    const v14Won = () => ({
      game: {
        phase: 'translateWheel',
        wheel: {
          segments: ['w0', 'w1'],
          translated: ['w0'],
          filled: [0],
          attempts: 0,
          landed: 0,
          result: 'win',
          spent: null,
        },
      },
      parked: null,
    })

    it('rewinds a won unspent spin so the ending re-resolves it', async () => {
      // The old chooser would have granted +1 token. Under the new rules the
      // spin IS the round's end — so the save goes back to the wheel, verdict
      // cleared, and the player spins again for the round itself (owner,
      // 2026-09-18). The fills are kept: nothing the player earned is lost.
      const out = migrateGame(v14Won(), 14) as {
        game: { phase: string; wheel: { landed: number | null; result: string | null; spent: string | null; filled: number[] } }
      }
      expect(out.game.phase).toBe('translateWheel')
      expect(out.game.wheel.landed).toBeNull()
      expect(out.game.wheel.result).toBeNull()
      expect(out.game.wheel.filled).toEqual([0])
    })

    it('clears a spent wheel\u2019s flag (live and parked rounds)', async () => {
      const spent = v14Won()
      ;(spent.game.wheel as { spent: string | null }).spent = 'ai'
      ;(spent.game as { phase: string }).phase = 'playerGuessing'
      const parked = {
        ...spent,
        parked: { game: spent.game, gameLanguage: 'da', gameUiLanguage: 'en', boardCityIndex: 0, lookedUp: [], authoredBoardId: null },
      }
      const out = migrateGame(parked, 14) as {
        game: { wheel?: { spent: string | null } }
        parked: { game: { wheel: { spent: string | null } } }
      }
      expect(out.game.wheel?.spent).toBeNull()
      expect(out.parked.game.wheel.spent).toBeNull()
    })

    it('v17 compatibility successor: leaves v14 wheel evidence untouched and archives v15 input', async () => {
      const miss = v14Won()
      ;(miss.game.wheel as { result: string | null }).result = 'miss'
      const out = migrateGame(miss, 14) as { game: { wheel: { result: string | null; landed: number | null } } }
      expect(out.game.wheel.result).toBe('miss')
      expect(out.game.wheel.landed).toBe(0)
      const at = migrateGame(v14Won(), 15)
      expect(at).toStrictEqual({ ...v14Won(), attemptId: null, attemptOrigin: null, activeSlot: null, completionReceipt: null, legacySave: { game: v14Won().game } })
    })
  })

  it('does not invent a route city from a globally selected v6 daily board', async () => {
    const citySevenWord = wordsForCity(WORDS, 6)[0]!.id
    const daily = { dailyKey: '2026-08-23', game: { words: [{ wordId: citySevenWord }] } }
    const migrated = migrateGame(daily, 6) as Record<string, unknown>
    // Keep the daily and its unknown route context through the bank rewind
    // and the new quiet-resume guidance migration.
    expect(migrated).toEqual({
      ...daily, legacySave: daily, city1BoardCursor: 0, parked: null,
      attemptId: null, attemptOrigin: null, activeSlot: null, completionReceipt: null,
      reviewRoundId: expect.any(String), sentenceReview: null,
      roundGuidance: { opening: 'dismissed', playerClueTurn: null },
      packingTranslated: [], earnedPostcard: false, earnedPerfectRound: false,
    })
    expect(migrated).not.toHaveProperty('boardCityIndex')
  })

  /**
   * v7 -> v8 and v8 -> v9: the City 1 bank was regenerated, twice, and each
   * time it came back a different length — 18 authored boards, then the first
   * generated bank, then a longer bank deliberately ORDERED easy-first.
   *
   * `city1BoardCursor` is an index into it, so the stored number names a
   * different board than it did when it was written. This is CLAUDE.md's
   * persisted-store rule in its literal form: the meaning of a field every
   * existing save carries changed, so the version bump and the migrate step
   * ship together. Cursor 17 was the wrap point of the old 18-board bank.
   *
   * Both versions are pinned because the rewind has to survive the next bank
   * too: a save written on v8 has walked into the middle of a bank whose order
   * no longer exists, exactly like the v7 save below it.
   */
  it('rewinds a v7 City 1 cursor to the start of the regenerated bank', async () => {
    const paused = {
      city1BoardCursor: 17,
      boardCertification: 'authored-cycle',
      gameLanguage: 'da',
      boardCityIndex: 0,
      game: { words: [{ wordId: 'da:mor' }] },
      recentBoards: [['da:mor']],
    }
    const out = migrateGame(paused, 7) as Record<string, unknown>
    expect(out.city1BoardCursor).toBe(0)
    // Everything else about the paused round survives: the board in flight
    // carries its own words and does not come from the cursor.
    expect(out.game).toBe(paused.game)
    expect(out.boardCertification).toBe('authored-cycle')
    expect(out.recentBoards).toEqual([['da:mor']])
  })

  it('rewinds a v8 cursor to the start of the reordered bank', async () => {
    const paused = {
      city1BoardCursor: 73,
      boardCertification: 'authored-cycle',
      gameLanguage: 'da',
      boardCityIndex: 0,
      game: { words: [{ wordId: 'da:mor' }] },
      recentBoards: [['da:mor']],
    }
    const out = migrateGame(paused, 8) as Record<string, unknown>
    expect(out.city1BoardCursor).toBe(0)
    // Same as the v7 case: only the cursor is rewritten. 73 was a legal cursor
    // in the 100-board bank and is a different board in the ordered one.
    expect(out.game).toBe(paused.game)
    expect(out.boardCertification).toBe('authored-cycle')
    expect(out.recentBoards).toEqual([['da:mor']])
  })

  it('rewinds an older save’s cursor too, since migrate does not chain', async () => {
    const v6 = { city1BoardCursor: 9, game: null, newlyDiscovered: [], gameLanguage: 'da' }
    expect((migrateGame(v6, 6) as { city1BoardCursor: number }).city1BoardCursor).toBe(0)
  })

  it('drops the retired study flag from a v11 save', async () => {
    const current = { city1BoardCursor: 42, studying: true }
    const out = migrateGame(current, 11) as Record<string, unknown>
    expect(out.city1BoardCursor).toBe(42)
    expect(out).not.toHaveProperty('studying')
  })

  it('upgrades both round slots from v12 without claiming an old postcard reward', async () => {
    const saved = { game: null, parked: { game: null, packed: ['da:hus'] } }
    const out = migrateGame(saved, 12) as Record<string, unknown>
    expect(out).toMatchObject({
      packingTranslated: [], earnedPostcard: false,
      parked: { packed: ['da:hus'], packingTranslated: [], earnedPostcard: false },
    })
  })

  /**
   * v15 renames the earned-reward marker. A save written on v14 carries
   * `earnedTranslationJoker`; the migration re-keys it 1:1 on BOTH round
   * slots — a round finished on the old build keeps the summary line its
   * win earned, and a round still open reads false exactly as before.
   */
  it('renames the earned marker to the postcard on both round slots (v15)', async () => {
    const saved = {
      earnedTranslationJoker: true,
      game: null,
      parked: { game: null, packed: ['da:hus'], earnedTranslationJoker: false },
    }
    const out = migrateGame(saved, 14) as Record<string, unknown>
    expect(out.earnedPostcard).toBe(true)
    expect(out).not.toHaveProperty('earnedTranslationJoker')
    expect((out.parked as Record<string, unknown>).earnedPostcard).toBe(false)
    expect(out.parked).not.toHaveProperty('earnedTranslationJoker')
  })

  it('v14 saves without the marker read as unearned, not claimed', async () => {
    const out = migrateGame({ game: null, parked: null }, 14) as Record<string, unknown>
    expect(out.earnedPostcard).toBe(false)
  })

  it('v17 compatibility successor: preserves v15 evidence without receipt authority and passes v17 through', async () => {
    const blob = { earnedPostcard: true, game: null, parked: null }
    expect(migrateGame(blob, 15)).toEqual({ ...blob, attemptId: null, attemptOrigin: null, activeSlot: null, completionReceipt: null, legacySave: { game: null } })
    expect(migrateGame(blob, 16)).toEqual({ ...blob, legacySave: null })
    expect(migrateGame(blob, 17)).toBe(blob)
  })

  it('gives a v6 save without a board a harmless first-city context', async () => {
    const already = { game: null, newlyDiscovered: ['w9'], gameLanguage: 'da' }
    expect(migrateGame(already, 6)).toMatchObject({ ...already, boardCityIndex: 0 })
  })

  /**
   * v5 -> v6: the round learns its language.
   *
   * Every save written before the seam is Danish, so it is stamped as Danish
   * and KEPT. Dropping the board would have been the lazy reading and would
   * have cost every existing player the round they were in the middle of, for
   * a language change that has not happened.
   */
  it('stamps a v5 round as Danish and keeps it', async () => {
    const mid = { game: { words: [{ wordId: 'w1' }] }, newlyDiscovered: [], lookedUp: ['w1'] }
    const out = migrateGame(mid, 5) as Record<string, unknown>
    expect(out.gameLanguage).toBe('da')
    expect(out.game).toBe(mid.game)
    expect(out.lookedUp).toEqual(['w1'])
  })

  /**
   * An older save still takes the v3 -> v4 road — the round is thrown away
   * because it may hold roles that no longer exist — and must not arrive
   * carrying the dead keys either.
   */
  it('an older save arrives with no game, no debrief keys, and its boards', async () => {
    const out = migrateGame(
      { recentBoards: [['w1']], debrief: { summary: 's', takeaways: ['t'] } },
      3,
    ) as Record<string, unknown>
    expect(out.game).toBeNull()
    expect(out).not.toHaveProperty('debrief')
    expect(out).not.toHaveProperty('debriefFailed')
    expect(out.newlyDiscovered).toEqual([])
    expect(out.recentBoards).toEqual([['w1']])
  })

  it('and a v1 save still finds its one remembered board', async () => {
    const out = migrateGame({ lastBoard: ['w1', 'w2'] }, 1) as Record<string, unknown>
    expect(out.recentBoards).toEqual([['w1', 'w2']])
    expect(out.newlyDiscovered).toEqual([])
  })
})

/**
 * The wrap-up round: dealt from collected words, opened by a packing phase,
 * and the reason the mode exists — packed words found green go into the
 * suitcase for good.
 *
 * Mutation-checked: dropping the `packed.includes` conjunct in finishRound's
 * wrap step fails "a skipped card ... does NOT wrap"; dropping the
 * `packable.includes` guard from submitPacking fails "a top-up card cannot be
 * packed"; letting the deal write recentBoards fails its test; loosening the
 * reroll guard fails that one.
 */
describe('gameStore: retired wrap-up and receipt rewards (C1-PC-1 successors)', () => {
  it('old wrap-up entry cannot overwrite the primary or create a third slot', async () => {
    useGame.getState().newGame({ cityIndex: 0 })
    const before = useGame.getState()
    useGame.getState().newWrapUpGame({ seed: 5 })
    expect(useGame.getState()).toBe(before)
    expect(useGame.getState().mode).toBe('normal')
    expect(useGame.getState().sessions!.replay).toBeNull()
  })

  it('retired packing/spending entry points cannot consume credit or change saved learning', async () => {
    useSrs.setState({ translationPostcards: 17 })
    useGame.getState().newGame({ seed: 5 })
    const word = useGame.getState().game!.words[0]!
    const before = JSON.stringify(useGame.getState().game)
    expect(useGame.getState().submitPacking(word.wordId, word.da)).toBe(false)
    expect(useGame.getState().usePostcard(word.wordId)).toBe(false)
    useGame.getState().startRoundEarly()
    expect(useSrs.getState().translationPostcards).toBe(17)
    expect(useSrs.getState().stats).toEqual({})
    expect(JSON.stringify(useGame.getState().game)).toBe(before)
  })

  it('legacy wrapped history and wrappable reader remain available to migration', async () => {
    useGame.getState().newGame({ seed: 5 })
    const game = useGame.getState().game!
    useJourney.setState({ wrapped: { [game.words[0]!.wordId]: 123 } })
    expect(wrappableIds(game, undefined)).toEqual(game.words.map((word) => word.wordId))
    expect(wrappableIds(game, [game.words[0]!.wordId])).toEqual([game.words[0]!.wordId])
    useGame.getState().abandonGame()
    expect(useJourney.getState().wrapped).toEqual({ [game.words[0]!.wordId]: 123 })
  })

  it('legacy finished/unrecorded evidence cannot re-run old reward or lesson writers', async () => {
    useGame.getState().newGame({ seed: 5 })
    const game = useGame.getState().game!
    useGame.setState({ attemptId: null, attemptOrigin: null, mode: 'wrapup',
      game: { ...game, phase: 'finished', outcome: { result: 'lost', reason: 'timeout' } } })
    await useGame.getState().finishRound()
    expect(useSrs.getState().games.played).toBe(0)
    expect(useCurriculum.getState().byLanguage.da).toBeUndefined()
    expect(useSurvival.getState().byLanguage.da).toBeUndefined()
    expect(written.has(SETTLEMENT_KEY)).toBe(false)
    expect(useGame.getState().game!.phase).toBe('finished')
  })

  // Direct old win/+perfect/spend assertions are replaced by real reducer-to-
  // receipt cases in gameStore.runtime.test.ts: Platinum +4, old balance
  // unchanged, duplicate finish, daily/tutorial exclusions, replay deltas.
})

/**
 * The compact practice round credits the words it teaches, while the normal
 * 3×6 round that follows owns the game tally, streak and win economy.
 */
describe('gameStore: the tutorial round (O2)', () => {
  const finishTutorialWon = async () => {
    const game = useGame.getState().game!
    const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
    const before = { ...game, phase: 'suddenDeath' as const, turnsLeft: 0,
      reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, -1).map((id) => [id, { kind: 'green' as const }])) } }
    useGame.setState({ game: applyEvent(before, { type: 'GUESS', wordId: targets.at(-1)! }, danish) })
    for (const id of useGame.getState().game!.wheel!.segments) {
      expect(useGame.getState().submitWheelTranslation(game.words.find((word) => word.wordId === id)!.da)).toBe(true)
    }
    useGame.getState().spinWheel()
    await useGame.getState().finishRound()
  }

  beforeEach(() => {
    vi.unstubAllEnvs()
    useSettings.setState({
      useMock: true,
      baseUrl: 'https://casey.test/v1',
    })
    useSrs.getState().reset()
    useGame.getState().abandonGame({ parked: true })
    useGame.setState({ recentBoards: [] })
    // The analytics queue is module-global and outlives a test: without this
    // drain, the STATS_BATCH (20 events) flush lands wherever the count
    // happens to cross — inside whichever later test is mocking fetch and
    // counting calls, including this file's tutorial tests. Every test here
    // starts from an empty queue, so a flush can only ever be caused by the
    // events the test itself chose to track.
    useStatsPorts(null)
  })

  it('deals the fixed board, in tutorial mode, with Casey cluing first', async () => {
    useGame.getState().newTutorialGame()
    const s = useGame.getState()
    expect(s.mode).toBe('tutorial')
    expect(s.game!.seed).toBe(TUTORIAL_SEED)
    expect(s.game!.words.map((w) => w.wordId)).toEqual(TUTORIAL_WORD_IDS)
    // Guessing is the low-friction act, so the player learns it first.
    expect(s.game!.phase).toBe('aiClueInput')
    expect(s.dailyKey).toBeNull()
  })

  it('enters the carry-over window like any round — unlike a wrap-up', async () => {
    useGame.getState().newTutorialGame()
    expect(useGame.getState().recentBoards[0]).toEqual(TUTORIAL_WORD_IDS)
  })

  const reachPlayerClue = async () => {
    useGame.getState().newTutorialGame()
    await useGame.getState().runAiClue()
    useGame.getState().playerGuess('da:bord')
    expect(useGame.getState().game!.phase).toBe('playerClueInput')
  }

  const guessEnvelope = (
    guesses: { wordId: string; confidence: number; reasoning: string }[],
    arm = 'cluey',
  ) => new Response(
    JSON.stringify({ protocol: 1, decision: { guesses }, report: { arm, refused: false } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

  /**
   * Offline mode (owner, 2026-09-27): when Casey cannot be reached because the
   * internet is gone, the banner asks whether to play the round offline, and
   * the choice lasts for that round only. What decides WHICH Casey plays is
   * compile-time (no on-device Casey under vitest), so these pin the state the
   * banner and the companion read.
   */
  describe('offline mode', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('marks a no-internet failure, and "Play offline" gives the rest of the round to offline Casey', async () => {
      const previousFetch = globalThis.fetch
      await reachPlayerClue()
      globalThis.fetch = async () => {
        throw new TypeError('Load failed')
      }
      vi.stubGlobal('navigator', { onLine: false })
      try {
        useGame.getState().submitPlayerClue('pause', 2)
        await useGame.getState().runAiGuesses()
        const failed = useGame.getState()
        expect(failed.error).not.toBeNull()
        expect(failed.errorNoInternet).toBe(true)
        expect(roundPlaysOffline()).toBe(false)

        failed.playRoundOffline()
        const chosen = useGame.getState()
        expect(chosen.error).toBeNull()
        expect(chosen.errorNoInternet).toBe(false)
        expect(chosen.offlineRoundFor).toBe(chosen.attemptId)
        expect(roundPlaysOffline()).toBe(true)

        // The choice belongs to that round: the next one asks again.
        useGame.getState().newGame({ seed: 612 })
        expect(roundPlaysOffline()).toBe(false)
      } finally {
        globalThis.fetch = previousFetch
      }
    })

    it('"Play online" hands the round back to normal Casey; "Stay offline" is remembered for that round only', async () => {
      await reachPlayerClue()
      useGame.getState().playRoundOffline()
      expect(roundPlaysOffline()).toBe(true)

      useGame.getState().keepRoundOffline()
      expect(roundPlaysOffline()).toBe(true)
      expect(useGame.getState().stayOfflineFor).toBe(useGame.getState().attemptId)

      useGame.getState().playRoundOnline()
      expect(roundPlaysOffline()).toBe(false)
      expect(useGame.getState().offlineRoundFor).toBeNull()
      expect(useGame.getState().stayOfflineFor).toBeNull()

      // A later drop can still go offline again, and a new round starts clean.
      useGame.getState().playRoundOffline()
      useGame.getState().keepRoundOffline()
      useGame.getState().newGame({ seed: 613 })
      expect(roundPlaysOffline()).toBe(false)
      expect(useGame.getState().stayOfflineFor).toBeNull()
    })

    it('does not offer offline Casey for an error that is not a lost connection', async () => {
      const previousFetch = globalThis.fetch
      await reachPlayerClue()
      globalThis.fetch = async () => new Response('boom', { status: 500 })
      try {
        useGame.getState().submitPlayerClue('pause', 2)
        await useGame.getState().runAiGuesses()
        expect(useGame.getState().error).not.toBeNull()
        expect(useGame.getState().errorNoInternet).toBe(false)
      } finally {
        globalThis.fetch = previousFetch
      }
    })

    it('forgets the no-internet flag with the error it belonged to', async () => {
      useGame.setState({ error: 'x', errorNoInternet: true })
      useGame.getState().clearError()
      expect(useGame.getState().errorNoInternet).toBe(false)
    })
  })

  // The green response (owner, 2026-09-26): the suitcase clack is gone and the
  // green haptic is the whole answer to a committed green. These pin that it
  // fires once per committed green and never for a stale, failed or repeated one.
  const greenBuzzes = () => soundMocks.guessResultHaptic.mock.calls.filter(([result]) => result === 'green').length

  describe('green-transition feedback', () => {
    it('buzzes green once on a newly green player clue-completion, with its reward haptic', async () => {
      useGame.getState().newTutorialGame()
      await useGame.getState().runAiClue()
      expect(useGame.getState().game!.phase).toBe('playerGuessing')
      const game = useGame.getState().game!
      const current = game.clueHistory.length - 1
      const target = game.clueHistory[current]!.targets![0]!
      useGame.setState({
        game: { ...game, clueHistory: game.clueHistory.map((clue, index) => index === current ? { ...clue, number: 1 } : clue) },
      })
      useGame.getState().playerGuess(target)

      expect(greenBuzzes()).toBe(1)
      expect(soundMocks.rewardHaptic).toHaveBeenCalledTimes(1)
      expect(soundMocks.guessResultHaptic).toHaveBeenCalledWith('green')
      // The event is no longer accepted after completion, so it cannot replay.
      useGame.getState().playerGuess('da:bord')
      expect(greenBuzzes()).toBe(1)
    })

    it('buzzes green on a partial player green without the clue-completion haptic', async () => {
      useGame.getState().newTutorialGame()
      await useGame.getState().runAiClue()
      const game = useGame.getState().game!
      const current = game.clueHistory.length - 1
      const target = game.clueHistory[current]!.targets![0]!
      useGame.setState({
        game: { ...game, clueHistory: game.clueHistory.map((clue, index) => index === current ? { ...clue, number: 2 } : clue) },
      })

      useGame.getState().playerGuess(target)

      expect(greenBuzzes()).toBe(1)
      expect(soundMocks.rewardHaptic).not.toHaveBeenCalled()
      expect(useGame.getState().game!.phase).toBe('playerGuessing')
    })

    it('buzzes green for a newly green sudden-death reveal', () => {
      useGame.getState().newTutorialGame()
      const game = useGame.getState().game!
      const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
      const last = targets.at(-1)!
      useGame.setState({
        game: {
          ...game,
          phase: 'suddenDeath',
          turnsLeft: 0,
          reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, -1).map((id) => [id, { kind: 'green' as const }])) },
        },
      })

      useGame.getState().playerGuess(last)

      expect(greenBuzzes()).toBe(1)
      expect(useGame.getState().game!.reveals[last]).toEqual({ kind: 'green' })
    })

    it('buzzes green once for Casey\'s committed green guess, not stale or failed guesses', async () => {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('pause', 2)
      soundMocks.rewardHaptic.mockClear()
      soundMocks.guessResultHaptic.mockClear()
      const game = useGame.getState().game!
      expect(game.phase).toBe('aiGuessing')
      const greenId = game.words.find((word) => game.playerKey[word.wordId] === 'green' && game.reveals[word.wordId]?.kind !== 'green')!.wordId
      useGame.setState({
        aiGuessQueue: [{ wordId: greenId, confidence: 1, reasoning: 'test green' }],
        planForClueIndex: game.clueHistory.length,
        aiGuessPlanMode: 'legacy',
      })

      useGame.getState().stepAiGuess()

      expect(greenBuzzes()).toBe(1)
      expect(useGame.getState().game!.reveals[greenId]).toEqual({ kind: 'green' })
      expect(soundMocks.rewardHaptic).not.toHaveBeenCalled()

      soundMocks.guessResultHaptic.mockClear()
      const failedGame = useGame.getState().game!
      useGame.setState({
        aiGuessQueue: [{ wordId: 'not-on-board', confidence: 1, reasoning: 'invalid' }],
        planForClueIndex: failedGame.clueHistory.length,
        aiGuessPlanMode: 'legacy',
      })
      useGame.getState().stepAiGuess()
      expect(greenBuzzes()).toBe(0)

      const staleOwner = useGame.getState().eventOwner()
      useGame.getState().abandonGame()
      useGame.getState().newTutorialGame()
      useGame.getState().stepAiGuess(staleOwner)
      expect(greenBuzzes()).toBe(0)
    })

    it('keeps Casey clue-completion haptics on the committed green', async () => {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('pause', 2)
      soundMocks.rewardHaptic.mockClear()
      soundMocks.guessResultHaptic.mockClear()
      const game = useGame.getState().game!
      expect(game.phase).toBe('aiGuessing')
      const greenId = game.words.find((word) => game.playerKey[word.wordId] === 'green' && game.reveals[word.wordId]?.kind !== 'green')!.wordId
      useGame.setState({
        game: { ...game, clueHistory: game.clueHistory.map((clue, index) => index === game.clueHistory.length - 1 ? { ...clue, number: 1 } : clue) },
        aiGuessQueue: [{ wordId: greenId, confidence: 1, reasoning: 'test green' }],
        planForClueIndex: game.clueHistory.length,
        aiGuessPlanMode: 'legacy',
      })

      useGame.getState().stepAiGuess()

      expect(greenBuzzes()).toBe(1)
      expect(soundMocks.rewardHaptic).toHaveBeenCalledTimes(1)
      expect(soundMocks.guessResultHaptic).toHaveBeenCalledWith('green')
    })

    it('buzzes green once on a committed wheel hit independently of word loading, never on a miss or repeat', () => {
      useGame.getState().newTutorialGame()
      const game = useGame.getState().game!
      const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
      const last = targets.at(-1)!
      const afterSuddenDeath = applyEvent({
        ...game,
        phase: 'suddenDeath',
        turnsLeft: 0,
        reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, -1).map((id) => [id, { kind: 'green' as const }])) },
      }, { type: 'GUESS', wordId: last }, danish)
      useGame.setState({ game: afterSuddenDeath })
      const wheelWord = afterSuddenDeath.words.find((word) => word.wordId === afterSuddenDeath.wheel!.segments[0])!

      soundMocks.playWord.mockImplementation(() => new Promise(() => {}))
      expect(useGame.getState().submitWheelTranslation('not a Danish answer')).toBe(false)
      expect(greenBuzzes()).toBe(0)
      expect(useGame.getState().submitWheelTranslation(wheelWord.da)).toBe(true)
      expect(soundMocks.playWord).toHaveBeenCalledWith(wheelWord.wordId)
      expect(greenBuzzes()).toBe(1)
      expect(useGame.getState().submitWheelTranslation(wheelWord.da)).toBe(false)
      expect(greenBuzzes()).toBe(1)
    })

    it('sounds a decided wheel win only when its presentation hold ends, once', () => {
      useGame.getState().newTutorialGame()
      const game = useGame.getState().game!
      const won = { ...game, phase: 'finished' as const, wheel: { ...game.wheel!, result: 'win' as const } }
      useGame.setState({ game: won, wheelSpinHold: true })
      const owner = useGame.getState().eventOwner()
      soundMocks.wheelWinFanfare.mockImplementationOnce(() => {
        expect(useGame.getState().wheelSpinHold).toBe(true)
      })
      useGame.getState().clearWheelSpinHold({ ...owner, attemptId: 'stale' })
      expect(soundMocks.wheelWinFanfare).not.toHaveBeenCalled()
      useGame.getState().clearWheelSpinHold(owner)
      useGame.getState().clearWheelSpinHold(owner)
      expect(soundMocks.wheelWinFanfare).toHaveBeenCalledTimes(1)
      expect(useGame.getState().wheelSpinHold).toBe(false)
      useGame.setState({ game: { ...won, wheel: { ...won.wheel!, result: 'miss' } }, wheelSpinHold: true })
      useGame.getState().clearWheelSpinHold(owner)
      expect(soundMocks.wheelWinFanfare).toHaveBeenCalledTimes(1)
    })

    it('waits for a real winning spin to finish before sounding the fanfare', async () => {
      vi.useFakeTimers()
      try {
        useGame.getState().newTutorialGame()
        const game = useGame.getState().game!
        const targets = targetUnion(game.words.map((word) => word.wordId), game.playerKey, game.aiKey)!
        const afterSuddenDeath = applyEvent({
          ...game,
          phase: 'suddenDeath',
          turnsLeft: 0,
          reveals: { ...game.reveals, ...Object.fromEntries(targets.slice(0, -1).map((id) => [id, { kind: 'green' as const }])) },
        }, { type: 'GUESS', wordId: targets.at(-1)! }, danish)
        useGame.setState({ game: afterSuddenDeath })
        for (const id of afterSuddenDeath.wheel!.segments) {
          const word = afterSuddenDeath.words.find((entry) => entry.wordId === id)!
          expect(useGame.getState().submitWheelTranslation(word.da)).toBe(true)
        }
        useGame.getState().spinWheel()
        expect(useGame.getState().game!.wheel!.result).toBe('win')
        expect(soundMocks.wheelWinFanfare).not.toHaveBeenCalled()
        // With no renderer mounted, the store's bounded fallback still has to
        // leave the full 3s visual interval plus its 1s startup/paint margin.
        await vi.advanceTimersByTimeAsync(3999)
        expect(soundMocks.wheelWinFanfare).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)
        expect(soundMocks.wheelWinFanfare).toHaveBeenCalledTimes(1)
        expect(useGame.getState().wheelSpinHold).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('resolves the second-green rescue before THINK and records only that exact row', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => guessEnvelope([
      { wordId: 'da:kaffe', confidence: 0.95, reasoning: 'first reasoning' },
      { wordId: 'da:mad', confidence: 0.4, reasoning: 'second reasoning' },
    ])
    try {
      await reachPlayerClue()
      const ready = useGame.getState().game!
      useGame.setState({
        game: {
          ...ready,
          reveals: {
            ...ready.reveals,
            'da:hus': { kind: 'green' },
            'da:æble': { kind: 'green' },
            'da:ost': { kind: 'green' },
          },
        },
      })
      useGame.getState().submitPlayerClue('spise', 1)
      const before = useGame.getState().game!
      await useGame.getState().runAiGuesses()
      const planned = useGame.getState()
      expect(planned.aiGuessQueue).toEqual([
        { wordId: 'da:mad', confidence: 0.4, reasoning: 'second reasoning', secondChoiceWordId: 'da:kaffe' },
      ])
      expect(planned.game).toBe(before)
      expect(planned.game!.clueHistory.at(-1)?.guesses).toEqual([])
      expect(planned.game!.reveals['da:kaffe']).toEqual({ kind: 'hidden' })

      planned.stepAiGuess()
      const landed = useGame.getState()
      expect(landed.lastAiGuess).toEqual({
        wordId: 'da:mad', confidence: 0.4, reasoning: 'second reasoning', secondChoiceWordId: 'da:kaffe',
      })
      expect(landed.game!.clueHistory.at(-1)?.guesses).toEqual([
        { wordId: 'da:mad', result: 'green', confidence: 0.4, reasoning: 'second reasoning' },
      ])
      expect(landed.game!.reveals['da:kaffe']).toEqual({ kind: 'hidden' })
      expect(landed.game!.phase).toBe('aiClueInput')
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('keeps a genuine missed-guess alternative with its row after the queue empties', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => guessEnvelope([
      { wordId: 'unknown', confidence: 1, reasoning: 'invalid' },
      { wordId: 'da:kaffe', confidence: 0.1, reasoning: 'Coffee fits a break.' },
      { wordId: 'da:kaffe', confidence: 1, reasoning: 'duplicate' },
      { wordId: 'da:hund', confidence: 0.99, reasoning: 'A walk fits a break.' },
    ])
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('pause', 2)
      await useGame.getState().runAiGuesses()
      const selected = useGame.getState().aiGuessQueue[0]!
      expect(selected).toEqual({ wordId: 'da:kaffe', confidence: 0.1, reasoning: 'Coffee fits a break.', secondChoiceWordId: 'da:hund' })
      useGame.getState().stepAiGuess()
      expect(useGame.getState().aiGuessQueue).toEqual([])
      expect(useGame.getState().lastAiGuess).toBe(selected)
      expect(useGame.getState().game!.clueHistory.at(-1)!.guesses.at(-1)!.result).toBe('bystander')
      expect(JSON.stringify(localStorage.getItem('cluecab-game-v1'))).not.toContain('secondChoiceWordId')
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('requests fresh top-two alternatives after each green through a clue above two', async () => {
    const previousFetch = globalThis.fetch
    const replies = [
      [
        { wordId: 'da:kaffe', confidence: 0.9, reasoning: 'miss one' },
        { wordId: 'da:mad', confidence: 0.5, reasoning: 'hit one' },
      ],
      [
        { wordId: 'da:æble', confidence: 0.2, reasoning: 'hit two first despite confidence' },
        { wordId: 'da:hund', confidence: 0.99, reasoning: 'alternative two' },
      ],
      [
        { wordId: 'da:ost', confidence: 0.8, reasoning: 'hit three' },
        { wordId: 'da:hund', confidence: 0.7, reasoning: 'alternative three' },
      ],
    ]
    let calls = 0
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body.candidateMode).toBe('top-two')
      return guessEnvelope(replies[calls++]!)
    }
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('spise', 3)
      for (const expected of ['da:mad', 'da:æble', 'da:ost']) {
        await useGame.getState().runAiGuesses()
        expect(useGame.getState().aiGuessQueue.map((guess) => guess.wordId)).toEqual([expected])
        useGame.getState().stepAiGuess()
      }
      expect(calls).toBe(3)
      expect(useGame.getState().game!.clueHistory.at(-1)?.guesses.map((guess) => guess.wordId))
        .toEqual(['da:mad', 'da:æble', 'da:ost'])
      expect(useGame.getState().game!.phase).toBe('aiClueInput')
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('restores the legacy one-response turn plan when assistance is off', async () => {
    vi.stubEnv('VITE_CASEY_TOP_TWO_ASSIST', '0')
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body))
      expect(body).not.toHaveProperty('candidateMode')
      return guessEnvelope([
        { wordId: 'da:mad', confidence: 0.2, reasoning: 'model rank first' },
        { wordId: 'da:æble', confidence: 0.9, reasoning: 'confidence first' },
      ])
    }
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('spise', 3)
      await useGame.getState().runAiGuesses()
      expect(useGame.getState().aiGuessQueue.every((row) => row.secondChoiceWordId === undefined)).toBe(true)
      expect(useGame.getState().aiGuessPlanMode).toBe('legacy')
      expect(useGame.getState().aiGuessQueue.map((guess) => guess.wordId)).toEqual(['da:æble'])
      useGame.getState().stepAiGuess()
      expect(useGame.getState().planForClueIndex).not.toBeNull()
    } finally {
      globalThis.fetch = previousFetch
      vi.unstubAllEnvs()
    }
  })

  it('routes every tutorial player clue to Casey proper, even while the mock setting is on', async () => {
    const previousFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async (input) => {
      if (String(input).includes('/casey/decision')) calls += 1
      throw new TypeError('offline')
    }
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('morgen', 3)
      await useGame.getState().runAiGuesses()
      const state = useGame.getState()
      // The real transport was asked — once, plus its one silent retry of a
      // dropped connection (client.ts) — rather than the tutorial's script.
      expect(calls).toBe(2)
      expect(state.game!.phase).toBe('aiGuessing')
      expect(state.game!.clueHistory.at(-1)?.text).toBe('morgen')
      expect(state.error).not.toBeNull()
      expect(state.aiGuessQueue).toEqual([])
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('keeps the practice clue focused on connecting two or three greens', async () => {
    await reachPlayerClue()
    const before = useGame.getState().game!
    useGame.getState().submitPlayerClue('spise', 1)
    expect(useGame.getState().game).toBe(before)
    expect(useGame.getState().error).toBe('For this practice clue, connect 2 or 3 green words.')
    useGame.getState().submitPlayerClue('spise', 2)
    expect(useGame.getState().game!.phase).toBe('aiGuessing')
  })

  it('allows a one-word practice clue when only the final player green remains', async () => {
    await reachPlayerClue()
    const game = useGame.getState().game!
    useGame.setState({
      game: {
        ...game,
        reveals: {
          ...game.reveals,
          'da:mad': { kind: 'green' },
          'da:æble': { kind: 'green' },
          'da:ost': { kind: 'green' },
        },
      },
    })
    useGame.getState().submitPlayerClue('spise', 1)
    expect(useGame.getState().error).toBeNull()
    expect(useGame.getState().game!.phase).toBe('aiGuessing')
  })

  it('routes free text to the live companion rather than the mock setting', async () => {
    const previousFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return new Response(
        JSON.stringify({
          protocol: 1,
          decision: {
            guesses: [
              { wordId: 'da:kaffe', confidence: 0.9, reasoning: 'A morning can start with coffee.' },
            ],
          },
          report: { arm: 'test', refused: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('hjem', 2)
      await useGame.getState().runAiGuesses()
      const state = useGame.getState()
      expect({
        calls,
        error: state.error,
        phase: state.game!.phase,
        clue: state.game!.clueHistory.at(-1)?.text,
        queue: state.aiGuessQueue.map((guess) => guess.wordId),
      }).toEqual({
        calls: 1,
        error: null,
        phase: 'aiGuessing',
        clue: 'hjem',
        queue: ['da:kaffe'],
      })
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  /**
   * Authored answers are complete finite plans. They publish as soon as their
   * real Worker response arrives; per-guess presentation beats remain in the
   * visible turn panel.
   */
  const envelope = (arm: string) =>
    new Response(
      JSON.stringify({
        protocol: 1,
        decision: {
          guesses: [{ wordId: 'da:kaffe', confidence: 1, reasoning: '«hjem» points me straight at kaffe.' }],
        },
        report: { arm, refused: false },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  it('publishes an authored answer as soon as its network response arrives', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => envelope('authored')
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('hjem', 2)
      vi.useFakeTimers()
      try {
        const run = useGame.getState().runAiGuesses()
        await vi.advanceTimersByTimeAsync(0)
        const stateAtReply = useGame.getState()
        const timersAtReply = vi.getTimerCount()
        await vi.advanceTimersByTimeAsync(5_000)
        await run
        expect({
          busy: stateAtReply.aiBusy,
          queue: stateAtReply.aiGuessQueue.map((guess) => guess.wordId),
          timers: timersAtReply,
        }).toEqual({ busy: false, queue: ['da:kaffe'], timers: 0 })
        expect(useGame.getState().aiBusy).toBe(false)
        expect(useGame.getState().aiGuessQueue.map((g) => g.wordId)).toEqual(['da:kaffe'])
        expect(useGame.getState().aiGuessPlanMode).toBe('legacy')
      } finally {
        vi.useRealTimers()
      }
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  const consumesFiniteAuthoredPlan = async (number: number) => {
    const previousFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return new Response(JSON.stringify({
        protocol: 1,
        decision: { guesses: [
          { wordId: 'da:mad', confidence: 1, reasoning: 'authored first' },
          { wordId: 'da:æble', confidence: 1, reasoning: 'authored second' },
        ] },
        report: { arm: 'authored', refused: false },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    try {
      await reachPlayerClue()
      useGame.setState({ mode: 'normal' })
      useSettings.setState({ useMock: false })
      useGame.getState().submitPlayerClue('spise', number)
      await useGame.getState().runAiGuesses()
      expect(useGame.getState().aiGuessQueue.every((row) => row.secondChoiceWordId === undefined)).toBe(true)
      expect(useGame.getState().aiGuessPlanMode).toBe('legacy')
      expect(useGame.getState().aiGuessQueue.map((guess) => guess.wordId)).toEqual(['da:mad', 'da:æble'])
      useGame.getState().stepAiGuess()
      useGame.getState().stepAiGuess()
      expect(useGame.getState().game!.phase).toBe('aiGuessing')
      expect(useGame.getState().game!.reveals['da:ost']).toEqual({ kind: 'hidden' })
      useGame.getState().stepAiGuess()
      expect(useGame.getState().game!.phase).toBe('aiClueInput')
      expect(calls).toBe(1)
    } finally {
      globalThis.fetch = previousFetch
    }
  }

  it('consumes a finite authored clue-3 plan and stops without a provider continuation', () => consumesFiniteAuthoredPlan(3))

  it('consumes a finite authored clue-4 plan and stops without a provider continuation', () => consumesFiniteAuthoredPlan(4))

  it('keeps an authored clue-one answer to its original guaranteed first green', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      protocol: 1,
      decision: { guesses: [
        { wordId: 'da:mad', confidence: 1, reasoning: 'authored first' },
        { wordId: 'da:æble', confidence: 1, reasoning: 'authored second' },
      ] },
      report: { arm: 'authored', refused: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    try {
      await reachPlayerClue()
      useGame.setState({ mode: 'normal' })
      useSettings.setState({ useMock: false })
      useGame.getState().submitPlayerClue('spise', 1)
      await useGame.getState().runAiGuesses()
      expect(useGame.getState().aiGuessQueue.map((guess) => guess.wordId)).toEqual(['da:mad'])
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('lands a model’s answer the moment it arrives', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => envelope('cluey')
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('hjem', 2)
      vi.useFakeTimers()
      try {
        const run = useGame.getState().runAiGuesses()
        await vi.advanceTimersByTimeAsync(0)
        await run
        expect(useGame.getState().aiGuessQueue.map((g) => g.wordId)).toEqual(['da:kaffe'])
      } finally {
        vi.useRealTimers()
      }
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('drops a pending assisted model response after the round changes phase', async () => {
    const previousFetch = globalThis.fetch
    let release!: (response: Response) => void
    globalThis.fetch = async () => new Promise<Response>((resolve) => { release = resolve })
    try {
      await reachPlayerClue()
      useGame.getState().submitPlayerClue('hjem', 2)
      const run = useGame.getState().runAiGuesses()
      await Promise.resolve()
      useGame.getState().abandonGame({ parked: true })
      release(guessEnvelope([
        { wordId: 'da:kaffe', confidence: 0.9, reasoning: 'stale first' },
        { wordId: 'da:mad', confidence: 0.8, reasoning: 'stale second' },
      ]))
      await run
      expect(useGame.getState().game).toBeNull()
      expect(useGame.getState().aiBusy).toBe(false)
      expect(useGame.getState().aiGuessQueue).toEqual([])
      expect(useGame.getState().planForClueIndex).toBeNull()
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  const deferredResponse = () => {
    let resolve!: (response: Response) => void
    const promise = new Promise<Response>((done) => { resolve = done })
    return { promise, resolve }
  }

  const parkAndRestoreSameRound = () => {
    const parked = roundOf(useGame.getState())
    expect(parked).not.toBeNull()
    useGame.setState({ game: null, parked })
    useGame.getState().resumeParked()
    expect(useGame.getState().game).toBe(parked!.game)
  }

  it.each(['newest-first', 'oldest-first'] as const)(
    'lets only request B publish after parking restores request A\'s game (%s)',
    async (completionOrder) => {
      const previousFetch = globalThis.fetch
      const a = deferredResponse()
      const b = deferredResponse()
      let calls = 0
      globalThis.fetch = async () => [a.promise, b.promise][calls++]!
      try {
        await reachPlayerClue()
        useSettings.setState({ useMock: false })
        useGame.setState({ mode: 'normal' })
        useGame.getState().submitPlayerClue('spise', 2)
        const oldGame = useGame.getState().game!
        const runA = useGame.getState().runAiGuesses()
        await Promise.resolve()

        parkAndRestoreSameRound()
        const runB = useGame.getState().runAiGuesses()
        const duplicateB = useGame.getState().runAiGuesses()
        await Promise.resolve()
        expect(calls).toBe(2)

        const oldReply = guessEnvelope([
          { wordId: 'da:\u00e6ble', confidence: 0.9, reasoning: 'old A reasoning' },
          { wordId: 'da:kaffe', confidence: 0.8, reasoning: 'old A alternative' },
        ])
        const newReply = guessEnvelope([
          { wordId: 'da:mad', confidence: 0.9, reasoning: 'new B reasoning' },
          { wordId: 'da:kaffe', confidence: 0.8, reasoning: 'new B alternative' },
        ])
        if (completionOrder === 'newest-first') {
          b.resolve(newReply)
          await runB
          a.resolve(oldReply)
        } else {
          a.resolve(oldReply)
          await runA
          b.resolve(newReply)
        }
        await Promise.all([runA, runB, duplicateB])

        expect(useGame.getState().game).toBe(oldGame)
        expect(useGame.getState().aiGuessQueue).toEqual([
          { wordId: 'da:mad', confidence: 0.9, reasoning: 'new B reasoning', secondChoiceWordId: 'da:kaffe' },
        ])
        expect(useGame.getState().error).toBeNull()
      } finally {
        globalThis.fetch = previousFetch
      }
    },
  )

  it.each(['newest-first', 'oldest-first'] as const)(
  'does not let request A publish an old error around request B after resume (%s)',
  async (completionOrder) => {
    const previousFetch = globalThis.fetch
    const a = deferredResponse()
    const b = deferredResponse()
    let calls = 0
    globalThis.fetch = async () => [a.promise, b.promise][calls++]!
    try {
      await reachPlayerClue()
      useSettings.setState({ useMock: false })
      useGame.setState({ mode: 'normal' })
      useGame.getState().submitPlayerClue('spise', 2)
      const runA = useGame.getState().runAiGuesses()
      await Promise.resolve()
      parkAndRestoreSameRound()
      const runB = useGame.getState().runAiGuesses()
      await Promise.resolve()

      const newReply = guessEnvelope([
        { wordId: 'da:mad', confidence: 0.9, reasoning: 'new B reasoning' },
        { wordId: 'da:kaffe', confidence: 0.8, reasoning: 'new B alternative' },
      ])
      const oldError = new Response('{"error":"old failure"}', { status: 503 })
      if (completionOrder === 'newest-first') {
        b.resolve(newReply)
        await runB
        a.resolve(oldError)
        await runA
      } else {
        a.resolve(oldError)
        await runA
        expect(useGame.getState().error).toBeNull()
        expect(useGame.getState().aiBusy).toBe(true)
        b.resolve(newReply)
        await runB
      }

      expect(useGame.getState().error).toBeNull()
      expect(useGame.getState().aiGuessQueue[0]?.reasoning).toBe('new B reasoning')
    } finally {
      globalThis.fetch = previousFetch
    }
  },
  )

  it('drops a stale authored reply received after park and resume while its request is pending', async () => {
    const previousFetch = globalThis.fetch
    const oldRequest = deferredResponse()
    const resumedRequest = deferredResponse()
    let calls = 0
    globalThis.fetch = async () => [oldRequest.promise, resumedRequest.promise][calls++]!
    try {
      await reachPlayerClue()
      useSettings.setState({ useMock: false })
      useGame.setState({ mode: 'normal' })
      useGame.getState().submitPlayerClue('spise', 2)
      const runA = useGame.getState().runAiGuesses()
      await Promise.resolve()
      parkAndRestoreSameRound()
      const runB = useGame.getState().runAiGuesses()
      await Promise.resolve()
      expect(calls).toBe(2)

      oldRequest.resolve(envelope('authored'))
      await runA
      expect(useGame.getState().aiBusy).toBe(true)
      expect(useGame.getState().aiGuessQueue).toEqual([])
      expect(useGame.getState().aiGuessRequestId).not.toBeNull()

      resumedRequest.resolve(guessEnvelope([
        { wordId: 'da:mad', confidence: 0.9, reasoning: 'new after resume' },
        { wordId: 'da:kaffe', confidence: 0.8, reasoning: 'new alternative' },
      ]))
      await runB
      expect(useGame.getState().aiGuessQueue[0]?.reasoning).toBe('new after resume')
      expect(useGame.getState().aiBusy).toBe(false)
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('keeps transient assistance ownership out of saved state and the outbound public request', async () => {
    const previousFetch = globalThis.fetch
    const pending = deferredResponse()
    let outbound = ''
    globalThis.fetch = async (_input, init) => {
      outbound = String(init?.body ?? '')
      return pending.promise
    }
    try {
      await reachPlayerClue()
      useSettings.setState({ useMock: false })
      useGame.setState({ mode: 'normal' })
      useGame.getState().submitPlayerClue('spise', 2)
      const run = useGame.getState().runAiGuesses()
      await Promise.resolve()
      await Promise.resolve()

      const saved = written.get('cluecab-game-v1') ?? ''
      for (const privateField of [
        'aiGuessRequestId', 'aiGuessPlanMode', 'rescued', 'unassistedWordId', 'secondChoiceWordId',
        'playerKey', 'aiKey',
      ]) {
        expect(outbound).not.toContain(privateField)
      }
      for (const transientField of ['aiGuessRequestId', 'aiGuessPlanMode', 'rescued', 'unassistedWordId', 'secondChoiceWordId']) {
        expect(saved).not.toContain(transientField)
      }
      expect(JSON.parse(outbound).candidateMode).toBe('top-two')
      expect(useGame.getState().aiGuessRequestId).not.toBeNull()

      useGame.getState().abandonGame({ parked: true })
      expect(useGame.getState().aiGuessRequestId).toBeNull()
      pending.resolve(guessEnvelope([
        { wordId: 'da:mad', confidence: 0.9, reasoning: 'too late' },
        { wordId: 'da:kaffe', confidence: 0.8, reasoning: 'too late too' },
      ]))
      await run
      expect(useGame.getState().game).toBeNull()
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('keeps request identity and assistance metadata out of persistence and outbound JSON', async () => {
    const previousFetch = globalThis.fetch
    const pending = deferredResponse()
    let outbound = ''
    globalThis.fetch = async (_input, init) => {
      outbound = String(init?.body ?? '')
      return pending.promise
    }
    try {
      await reachPlayerClue()
      useSettings.setState({ useMock: false })
      useGame.setState({ mode: 'normal' })
      useGame.getState().submitPlayerClue('spise', 2)
      const run = useGame.getState().runAiGuesses()
      await Promise.resolve()
      const persisted = written.get('cluecab-game-v1') ?? ''
      for (const privateName of ['aiGuessRequestId', 'aiGuessPlanMode', 'rescued', 'unassistedWordId', 'secondChoiceWordId']) {
        expect(persisted).not.toContain(privateName)
        expect(outbound).not.toContain(privateName)
      }
      expect(outbound).not.toContain('playerKey')
      expect(outbound).not.toContain('aiKey')
      useGame.getState().abandonGame({ parked: true })
      expect(useGame.getState().aiGuessRequestId).toBeNull()
      pending.resolve(guessEnvelope([
        { wordId: 'da:mad', confidence: 0.9, reasoning: 'late' },
      ]))
      await run
      useGame.getState().newTutorialGame()
      expect(useGame.getState().aiGuessRequestId).toBeNull()
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('keeps a failed tutorial clue visible instead of reopening it behind a fallback', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new TypeError('offline')
    }
    try {
      await reachPlayerClue()
      const historyBefore = useGame.getState().game!.clueHistory
      useGame.getState().submitPlayerClue('hjem', 2)
      await useGame.getState().runAiGuesses()
      const state = useGame.getState()
      expect(state.game!.phase).toBe('aiGuessing')
      expect(state.game!.clueHistory).not.toEqual(historyBefore)
      expect(state.game!.clueHistory.at(-1)?.text).toBe('hjem')
      expect(state.error).not.toBeNull()
      expect(state as unknown as Record<string, unknown>).not.toHaveProperty('practiceFallback')
      expect(state.aiGuessQueue).toEqual([])
      expect(useSettings.getState().useMock).toBe(true)
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  it('records the words without spending the first real game’s economy', async () => {
    useGame.getState().newTutorialGame()
    const before = useSrs.getState().games.played
    await finishTutorialWon()
    // The words are real: every board word now has an SRS record.
    for (const id of TUTORIAL_WORD_IDS) expect(useSrs.getState().stats[id], id).toBeDefined()
    expect(useGame.getState().newlyDiscovered).toEqual(TUTORIAL_WORD_IDS)
    expect(useSrs.getState().games.played).toBe(before)
    expect(useSrs.getState().games.won).toBe(0)
    expect(useSrs.getState().translationPostcards).toBe(0)
    expect(useGame.getState().earnedPostcard).toBe(false)
  })
})

describe('gameStore: Casey streak ledger', () => {
  const finish = async () => {
    const game = useGame.getState().game!
    useGame.setState({
      game: {
        ...game,
        phase: 'finished',
        reveals: Object.fromEntries(game.words.map((word) => [word.wordId, { kind: 'hidden' }])),
        outcome: { result: 'lost', reason: 'timeout' },
      } as never,
      roundRecorded: false,
    })
    await useGame.getState().finishRound()
  }

  beforeEach(() => {
    useSrs.getState().reset()
    useStreak.getState().reset()
    useGame.getState().abandonGame({ parked: true })
  })

  it('keeps practice out of Casey’s completed-day ledger', async () => {
    useGame.getState().newGame({ seed: 23 })
    await finish()
    expect(Object.values(useStreak.getState().completedDays)).toEqual([1])

    useGame.getState().newTutorialGame()
    await finish()
    expect(Object.values(useStreak.getState().completedDays)).toEqual([1])
  })
})

describe('gameStore: the authored OPENING clue', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    useSettings.setState({ useMock: false })
    useGame.getState().abandonGame({ parked: true })
  })

  /**
   * The round's OPENING clue is IN THE APP (owner decision 2026-09-18,
   * after the 2026-09-17 server-side version still showed a wait): on an
   * authored board the store applies the baked table's first step the moment
   * runAiClue is called — synchronously, in the same tick, with NO fetch at
   * all. The ledger still credits `authored`, and the rationale comes from
   * the same per-language template the Worker uses (firstClueRationale).
   */
  it('applies the baked OPENING clue synchronously on an authored board, with no fetch at all', async () => {
    const fetchCalls: unknown[][] = []
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (...args: unknown[]) => {
      fetchCalls.push(args)
      throw new Error('the baked opening must not touch the network')
    }
    try {
      useGame.getState().newGame({ cityIndex: 0 })
      expect(useGame.getState().authoredBoardId).toBe(CITY1_BOARD_CYCLE[0]!.id)
      expect(useGame.getState().game!.phase).toBe('aiClueInput')
      expect(useGame.getState().game!.clueHistory).toEqual([])
      // No fake timers, no await of a transport: the apply is synchronous in
      // the same tick. A timer advance or a fetch await here would mean the
      // round trip came back — the thing this decision removed.
      useGame.getState().runAiClue()
      const state = useGame.getState()
      expect(state.game!.clueHistory).toHaveLength(1)
      expect(state.game!.clueHistory[0]).toMatchObject({
        by: 'ai',
        text: 'forrige',
        number: 3,
        targets: ['da:uge', 'da:sidste', 'da:måned'],
      })
      // The rationale is the player-language template's own sentence for this
      // clue and its targets — the same one the Worker composes server-side.
      expect(state.game!.clueHistory[0]!.rationale).toBe(
        '«forrige»: «uge», «sidste» and «måned» all fit together under that one word.',
      )
      expect(state.game!.phase).toBe('playerGuessing')
      expect(state.aiBusy).toBe(false)
      expect(state.aiClueRequestId).toBeNull()
      expect(state.error).toBeNull()
      expect(state.pendingClueArm).toEqual({ arm: 'authored', refused: false })
      // No DECISION fetch: the analytics beacon (/v1/stats) is a different
      // call and fires on its own schedule — the assertion is that no
      // Casey/decision request was made for the opening.
      expect(fetchCalls.filter(([url]) => String(url).includes('/decision'))).toEqual([])
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  /**
   * The baked opening is not proof of anything: no markClueyVerified call, so
   * Home keeps asking until a REAL network call (a later clue or a guess)
   * proves the credentials.
   */
  it('does not count the baked opening as credential verification', async () => {
    const verified: number[] = []
    const { useSettings: settings } = await import('./settingsStore')
    const original = settings.getState().markClueyVerified
    settings.setState({ markClueyVerified: (at: number) => { verified.push(at) } })
    try {
      useGame.getState().newGame({ cityIndex: 0 })
      useGame.getState().runAiClue()
      expect(useGame.getState().game!.clueHistory).toHaveLength(1)
      expect(verified).toEqual([])
    } finally {
      settings.setState({ markClueyVerified: original })
    }
  })

  /**
   * The fallback stays intact: with the baked entry for this board missing,
   * the opening goes over the network exactly as it did before the bake —
   * the Worker serves the same first path step, only slower.
   */
  it('falls back to the network opening when the baked table has no entry for the board', async () => {
    const previousFetch = globalThis.fetch
    // Whatever board the cycle cursor deals HERE, the stub serves THAT board's
    // baked opening — the fallback is about the DELIVERY route (no baked
    // entry for the id the view carries), not about which clue is served.
    let served: { clue: string; number: number; targetWordIds: string[]; rationale: string }
    let dealtOpening: { clue: string; targetWordIds: readonly string[] } | null = null
    globalThis.fetch = async () => {
      const real = dealtOpening ?? bakedOpeningFor(CITY1_BOARD_CYCLE[0]!.id)
      expect(real).not.toBeNull()
      served = {
        clue: real!.clue,
        number: real!.targetWordIds.length,
        targetWordIds: [...real!.targetWordIds],
        rationale: "«fallback» serves the dealt board's own opening.",
      }
      return new Response(
        JSON.stringify({ protocol: 1, decision: served, report: { arm: 'authored', refused: false } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    try {
      useSettings.setState({ useMock: false })
      useGame.getState().newGame({ cityIndex: 0 })
      const dealtBoard = useGame.getState().authoredBoardId!
      expect(dealtBoard).not.toBeNull()
      // The cycle cursor has advanced through the earlier tests, so the dealt
      // board may be any of the 150; the stub serves ITS baked opening.
      dealtOpening = bakedOpeningFor(dealtBoard)
      expect(dealtOpening).not.toBeNull()
      // Simulate a board the bake does not cover: name a board id the table
      // has never carried. `bakedOpeningFor` is the store's own lookup.
      expect(bakedOpeningFor('bank_missing')).toBeNull()
      useGame.setState({ authoredBoardId: 'bank_missing' })
      vi.useFakeTimers()
      try {
        const run = useGame.getState().runAiClue()
        await vi.advanceTimersByTimeAsync(0)
        await run
        const state = useGame.getState()
        expect(state.game!.phase).toBe('playerGuessing')
        expect(state.aiBusy).toBe(false)
        expect(state.error).toBeNull()
        expect(state.pendingClueArm).toEqual({ arm: 'authored', refused: false })
        expect(state.aiClueRequestId).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    } finally {
      globalThis.fetch = previousFetch
    }
  })

})
