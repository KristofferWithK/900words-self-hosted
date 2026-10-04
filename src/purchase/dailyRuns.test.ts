import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Two runs and two puzzles a local day, counted apart (café world §8, CW-04).
 * Runs are counted at their first answer (O6) on the local day of that answer;
 * puzzles keep the board game's receipt count exactly as it was.
 */
const { capacitor, build } = vi.hoisted(() => ({
  capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
  build: { audience: 'normal' as string },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

vi.mock('../build/audience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../build/audience')>()
  return { ...actual, get buildAudience() { return build.audience } }
})

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
  removeItem: (key: string) => void values.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { attemptFixture, MATRIX_FIXTURES, settlementFixture } = await import('../progression/fixtures')
const { acknowledgeEffect, emptySettlementLedger, prepareSettlement } = await import('../progression/settlement')
const { SETTLEMENT_KEY } = await import('../stores/settlementStorage')
const { prepareLearning } = await import('../srs/settlement')
const {
  canStartDailyGame, canStartPuzzle, canStartRun, countRun, dailyAllowance, dailyLimitReached, FREE_GAMES_PER_DAY,
  FREE_PUZZLES_PER_DAY, FREE_RUNS_PER_DAY, KEPT_RUN_DAYS, localDay, puzzleLimitReached, runLimitReached, RUNS_KEY, runsToday,
} = await import('./dailyGames')
const { usePass } = await import('./passStore')

function on(platform: 'ios' | 'android' | 'web', audience = 'normal') {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
  build.audience = audience
}

/** Board games completed today, as durable receipts. */
function puzzlesToday(count: number) {
  let ledger = emptySettlementLedger()
  const game = MATRIX_FIXTURES[5].game
  for (let index = 0; index < count; index++) {
    const acceptedAt = Date.now()
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId: `daily-${index}`, origin: 'daily' }),
      acceptedAt,
      localDate: localDay(),
      continuation: null,
      dailyKey: `daily-${index}`,
    })
    const result = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (result.status === 'blocked') throw new Error(`Invalid receipt fixture: ${result.reason}`)
    ledger = result.ledger
    for (const effect of result.receipt.effects) ledger = acknowledgeEffect(ledger, result.receipt.receiptId, effect)
  }
  values.set(SETTLEMENT_KEY, JSON.stringify(ledger))
}

/** Local wall-clock time, as the device keeps it. */
const local = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).getTime()

beforeEach(() => {
  values.clear()
  usePass.setState({ status: 'not-entitled', offers: [], productId: undefined })
  on('ios')
})
afterEach(() => { build.audience = 'normal' })

describe('counting runs', () => {
  it('two free runs and two free puzzles, the puzzles the same two as before', () => {
    expect(FREE_RUNS_PER_DAY).toBe(2)
    expect(FREE_PUZZLES_PER_DAY).toBe(2)
    expect(FREE_PUZZLES_PER_DAY).toBe(FREE_GAMES_PER_DAY)
  })

  it('counts each run on the local day of its first answer, with the app\'s own day key (localDay)', () => {
    const late = local(2026, 10, 4, 23, 59)
    const early = local(2026, 10, 5, 0, 2)
    countRun(late, storage)
    countRun(early, storage)
    countRun(early + 60_000, storage)
    expect(runsToday(storage, '2026-10-04')).toBe(1)
    expect(runsToday(storage, '2026-10-05')).toBe(2)
    expect(runsToday(storage, '2026-10-06')).toBe(0)
    expect(localDay(new Date(late))).toBe('2026-10-04')
    expect(JSON.parse(values.get(RUNS_KEY)!)).toEqual({ days: { '2026-10-04': 1, '2026-10-05': 2 } })
  })

  it('keeps only the latest days', () => {
    for (let d = 1; d <= 10; d++) countRun(local(2026, 10, d, 12, 0), storage)
    const days = Object.keys(JSON.parse(values.get(RUNS_KEY)!).days)
    expect(days).toHaveLength(KEPT_RUN_DAYS)
    expect(days[0]).toBe('2026-10-04')
    expect(runsToday(storage, '2026-10-10')).toBe(1)
  })

  it('a value that is not ours never unlocks a free run, and is replaced by the next count', () => {
    for (const bad of ['{broken', '[]', '{"days":[]}', '{"days":{"2026-10-04":-1}}', '{"days":{"today":1}}', '{"days":{"2026-10-04":1.5}}']) {
      values.set(RUNS_KEY, bad)
      expect(runsToday(storage, '2026-10-04'), bad).toBe(FREE_RUNS_PER_DAY)
    }
    expect(runsToday({ getItem: () => { throw new Error('blocked') } })).toBe(FREE_RUNS_PER_DAY)
    values.set(RUNS_KEY, '{broken')
    countRun(local(2026, 10, 4, 9, 0), storage)
    expect(runsToday(storage, '2026-10-04')).toBe(1)
  })

  it('never throws when storage refuses the write', () => {
    expect(() => countRun(Date.now(), { getItem: () => null, setItem: () => { throw new Error('full') } })).not.toThrow()
  })
})

describe.each(['ios', 'android'] as const)('the run limit on %s', (platform) => {
  beforeEach(() => on(platform))

  it('a fresh day allows a run; the second is allowed, the third is not', () => {
    expect(canStartRun()).toBe(true)
    countRun(Date.now())
    expect(canStartRun()).toBe(true)
    countRun(Date.now())
    expect(canStartRun()).toBe(false)
    expect(runLimitReached()).toBe(true)
  })

  it('the next local day starts again from two', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(23, 59, 0, 0)
    countRun(yesterday.getTime())
    countRun(yesterday.getTime())
    expect(runsToday(storage, localDay(yesterday))).toBe(2)
    expect(canStartRun()).toBe(true)
  })

  it('an unreadable counter fails closed today and heals by itself tomorrow, through canStartRun alone', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 4, 10, 0))
      values.set(RUNS_KEY, '{broken')
      expect(canStartRun()).toBe(false)
      expect(JSON.parse(values.get(RUNS_KEY)!)).toEqual({ days: { '2026-10-04': FREE_RUNS_PER_DAY } })
      vi.setSystemTime(new Date(2026, 9, 5, 0, 1))
      expect(canStartRun()).toBe(true)
      // runLimitReached heals the same way.
      values.set(RUNS_KEY, '[]')
      expect(runLimitReached()).toBe(true)
      vi.setSystemTime(new Date(2026, 9, 6, 9, 0))
      expect(runLimitReached()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('the full version runs and solves without limit', () => {
    countRun(Date.now()); countRun(Date.now()); countRun(Date.now())
    puzzlesToday(3)
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
    usePass.setState({ status: 'entitled' })
    expect(canStartRun()).toBe(true)
    expect(runLimitReached()).toBe(false)
    expect(canStartPuzzle()).toBe(true)
    expect(puzzleLimitReached()).toBe(false)
    expect(dailyAllowance().unlimited).toBe(true)
  })

  it('runs and puzzles are counted apart: two runs leave both puzzles, two puzzles leave both runs', () => {
    countRun(Date.now()); countRun(Date.now())
    expect(canStartRun()).toBe(false)
    expect(canStartDailyGame()).toBe(true)
    values.delete(RUNS_KEY)
    puzzlesToday(2)
    expect(canStartDailyGame()).toBe(false)
    expect(dailyLimitReached()).toBe(true)
    expect(canStartRun()).toBe(true)
    countRun(Date.now())
    expect(dailyAllowance()).toEqual({ unlimited: false, runs: { used: 1, limit: 2 }, puzzles: { used: 2, limit: 2 } })
  })
})

describe('builds without the limit', () => {
  it('the web and every non-store audience never stop a run', () => {
    countRun(Date.now()); countRun(Date.now()); countRun(Date.now())
    on('web')
    expect(canStartRun()).toBe(true)
    expect(runLimitReached()).toBe(false)
    for (const audience of ['developer', 'feedback', 'open-source', 'web-demo']) {
      on('ios', audience)
      expect(canStartRun()).toBe(true)
    }
  })
})
