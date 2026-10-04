import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The café gate at the board game's launch point (café world §5, CW-04): a
 * required board is a café, and its puzzle cannot be dealt before a walk has
 * found it. Played boards are found, and so is the head of a queue anchored
 * out of order. A player with nothing at all can still make progress: walk,
 * find the first café at the fifth photo, play it.
 *
 * The gate ships switched on since CW-13 (CAFE_GATE_ENABLED); these tests
 * run it on explicitly, and one proves the default.
 */
const daily = vi.hoisted(() => ({ open: true, developer: false }))

vi.mock('../purchase/dailyGames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../purchase/dailyGames')>()
  return { ...actual, canStartDailyGame: () => daily.open, canDeveloperContinue: () => daily.developer }
})

vi.mock('../ui/speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/speak')>()
  return { ...actual, playWord: vi.fn(async () => 'baked' as const) }
})

const written = new Map<string, string>()
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { useGame } = await import('./gameStore')
const { useUi } = await import('./uiStore')
const { useJourney } = await import('./journeyStore')
const { useSettings } = await import('./settingsStore')
const { SETTLEMENT_KEY } = await import('./settlementStorage')
const { createSettlementStore } = await import('./settlementStore')
const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
const { createPrimaryContinuation, emptyProgressFacts } = await import('../progression/facts')
const { boardKey, firstCompletionKey } = await import('../progression/identity')
const { CAFE_GATE_ENABLED, cafeGateEnabled, cafesForCity, mayLaunchCafe, overrideCafeGateForTests } = await import('../journey/cafeAccess')
const { createRunEngine } = await import('../run/engine')
const { runResultsSink } = await import('../run/results')
const { installRunResultsSink, onCafeFound } = await import('../run/sinkSetup')
const { runWordsForCity } = await import('../run/sources')
const { canStartRun, runsToday } = await import('../purchase/dailyGames')

const boards = CITY1_REQUIRED_SET.boards
const DA = JSON.stringify(['da', 'sonderborg'])

/** A settled ledger in which the first `n` required boards were played (no receipts: an imported save). */
function playedBefore(n: number) {
  const list = boards.slice(0, n)
  const facts = { ...emptyProgressFacts(),
    boards: Object.fromEntries(list.map((board) => [boardKey(board), { board, best: 'gold', claims: ['spinWin', 'solved'] }])),
    firstPrimaryCompletions: Object.fromEntries(list.map((board) => [firstCompletionKey(board), { board, requiredSet: CITY1_REQUIRED_SET }])) }
  written.set(SETTLEMENT_KEY, JSON.stringify({ schemaVersion: 1, facts, settlements: {} }))
}

/** A saved Danish queue anchored at `board` (a legacy round, or a rebase), with no round on the table. */
function anchoredQueue(index: number, rebased: boolean) {
  const continuation = createPrimaryContinuation(CITY1_REQUIRED_SET, emptyProgressFacts(), boards[index], rebased)
  createSettlementStore({ storage }).saveSessions('da', { continuation, primary: null, replay: null, activeSlot: null })
  return continuation
}

const photographed = new Set<string>()
/** One Words walk through the real engine and the installed sink: `right` right answers, then two wrong. */
function walk(right: number, clock: { t: number }) {
  const engine = createRunEngine({ cityIndex: 0, pool: runWordsForCity(0), sink: runResultsSink(), rng: () => 0.37, now: () => clock.t,
    events: { photo: (word) => void photographed.add(word.id) } })
  engine.start()
  let answered = 0
  const decided = new Map<number, number>()
  for (let i = 0; i < 600 * 30 && engine.state.phase === 'play'; i++) {
    const g = engine.activeGate()
    if (g && g.z < 0.2) {
      if (!decided.has(g.id)) {
        decided.set(g.id, answered < right ? g.correct : (g.correct + 1) % engine.state.lanes)
        answered++
      }
      engine.state.lane = decided.get(g.id)!
    }
    clock.t += 1000 / 30
    engine.step(1 / 30)
  }
  return engine
}

installRunResultsSink()

beforeEach(async () => {
  overrideCafeGateForTests(true)
  daily.open = true
  daily.developer = false
  await useGame.getState().finishRound()
  written.clear()
  useGame.setState(useGame.getInitialState())
  useJourney.setState(useJourney.getInitialState())
  photographed.clear()
  useSettings.setState({ ...useSettings.getInitialState(), useMock: true })
  useUi.setState({ pendingFirstGiver: 'ai', screen: 'home', onboarding: null, dailyLimitOpen: false, dailyLimitRetry: null })
})
afterAll(() => overrideCafeGateForTests(null))

describe('the switch', () => {
  it('ships on since CW-13: a fresh profile waits for its first café, and walks count', () => {
    overrideCafeGateForTests(null)
    expect(CAFE_GATE_ENABLED).toBe(true)
    expect(cafeGateEnabled()).toBe(true)
    expect(mayLaunchCafe(boards[0]!)).toBe(false)
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
    // The first walk's fifth photo finds it, and the board deals.
    walk(5, { t: new Date(2026, 9, 4, 12, 0).getTime() })
    expect(cafesForCity(0)!.summary.found).toBeGreaterThanOrEqual(1)
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(boards[0]!.authoredBoardId)
  })
})

describe('the café gate at the launch point', () => {
  it('a fresh player cannot be dealt an unfound café; the refusal says why, and nothing is consumed', () => {
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
    expect(useUi.getState().dailyLimitOpen).toBe(false)
    expect(cafesForCity(0)!.summary).toMatchObject({ found: 0, waiting: 0, needed: 5, toward: 0 })
  })

  it('a fresh player can walk, finds the first café at the fifth photo, and can then play it', () => {
    const heard: number[] = []
    const stop = onCafeFound((cafe) => heard.push(cafe.index))
    try {
      expect(canStartRun()).toBe(true)
      const clock = { t: new Date(2026, 9, 4, 12, 0).getTime() }
      walk(4, clock)
      expect(cafesForCity(0)!.summary).toMatchObject({ found: 0, toward: 4, needed: 5 })
      expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
      walk(1, clock)
      expect(heard).toEqual([0])
      expect(cafesForCity(0)!.cafes[0]).toMatchObject({ state: 'found', board: boards[0] })
      expect(cafesForCity(0)!.summary).toMatchObject({ found: 1, waiting: 1, toward: 0, needed: 20 })
      expect(mayLaunchCafe(boards[0]!)).toBe(true)
      expect(mayLaunchCafe(boards[1]!)).toBe(false)
      // Two runs, each counted once at its first answer.
      expect(runsToday(storage, '2026-10-04')).toBe(2)
      // The photos are word marks: every word photographed, and nothing else.
      expect(new Set(Object.keys(useJourney.getState().photos))).toEqual(photographed)

      expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
      expect(useGame.getState().authoredBoardId).toBe(boards[0]!.authoredBoardId)
      expect(useGame.getState().lastDealRefusal).toBeNull()
    } finally {
      stop()
    }
  })

  it("a save from before the café world: played boards are found and played, the next is not dealt until a walk finds it", () => {
    playedBefore(3)
    const city = cafesForCity(0)!
    expect(city.cafes.slice(0, 4).map((c) => c.state)).toEqual(['played', 'played', 'played', 'unfound'])
    // Nothing waiting, three found: the next find needs 10 photos.
    expect(city.summary).toMatchObject({ found: 3, waiting: 0, played: 3, needed: 10 })
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)

    const clock = { t: new Date(2026, 9, 4, 12, 0).getTime() }
    walk(10, clock)
    expect(cafesForCity(0)!.cafes[3]!.state).toBe('found')
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(boards[3]!.authoredBoardId)
  })

  it('unreadable settled facts: no café is counted (nor anything else: the journey fails closed), and the run carries on', () => {
    written.set(SETTLEMENT_KEY, '{broken')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const engine = walk(6, { t: new Date(2026, 9, 4, 12, 0).getTime() })
      expect(engine.state.photos).toBe(6)
    } finally {
      warn.mockRestore()
    }
    expect(useJourney.getState().cafes).toEqual({})
    expect(useJourney.getState().photos).toEqual({})
  })

  it('a played board can be replayed with no finds at all', () => {
    playedBefore(2)
    expect(useJourney.getState().cafes).toEqual({})
    expect(useGame.getState().startReplay(boards[1]!.authoredBoardId)).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(boards[1]!.authoredBoardId)
    expect(useGame.getState().lastDealRefusal).toBeNull()
  })

  it('a round already on the table resumes, found or not', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [boards[0]!.authoredBoardId]: 1 }, toward: 0 } } })
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    const started = useGame.getState().attemptId
    useJourney.setState({ cafes: {} })
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().attemptId).toBe(started)
  })

  it('the daily-limit dialog\'s retry is still gated by the café', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [boards[0]!.authoredBoardId]: 1 }, toward: 0 } } })
    daily.open = false
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('dailyLimit')
    expect(useUi.getState().dailyLimitOpen).toBe(true)
    const retry = useUi.getState().dailyLimitRetry!
    // The retry passes the daily limit (developer continuation), never the café.
    daily.developer = true
    useJourney.setState({ cafes: {} })
    expect(retry()).toBe(false)
    expect(useGame.getState().game).toBeNull()
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
    useJourney.setState({ cafes: { [DA]: { found: { [boards[0]!.authoredBoardId]: 1 }, toward: 0 } } })
    expect(retry()).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(boards[0]!.authoredBoardId)
  })
})

describe('a queue anchored out of the set order (legacy round, rebase)', () => {
  it.each([[false, 'legacy-anchor'], [true, 'rebased']] as const)('deals its anchored head unchanged, and shows it found (rebased: %s)', (rebased, source) => {
    const continuation = anchoredQueue(6, rebased)
    expect(continuation.source).toBe(source)
    expect(continuation.remainingBoardKeys[0]).toBe(boardKey(boards[6]!))
    expect(useJourney.getState().cafes).toEqual({})
    const city = cafesForCity(0)!
    expect(city.cafes[6]!.state).toBe('found')
    expect(city.cafes[0]!.state).toBe('unfound')
    // The anchored head is a café waiting to be played, so the next find
    // (board 0, the set's order) takes 20 photos.
    expect(city.summary).toMatchObject({ found: 1, waiting: 1, needed: 20 })
    expect(city.summary.next?.index).toBe(0)
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(boards[6]!.authoredBoardId)
  })

  it('a canonical queue anchors nothing', () => {
    createSettlementStore({ storage }).saveSessions('da', {
      continuation: createPrimaryContinuation(CITY1_REQUIRED_SET, emptyProgressFacts()), primary: null, replay: null, activeSlot: null })
    expect(cafesForCity(0)!.cafes.every((c) => c.state === 'unfound')).toBe(true)
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
  })
})
