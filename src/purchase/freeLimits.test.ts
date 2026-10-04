import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-15: the free limits across a day boundary for each plan, Google Play
 * review access, and the first session's walk, which is never refused and
 * counts like any other (onboarding day one). The clock is injected with fake timers: the
 * gate reads the device's local day, as a player's phone does.
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
  admitFirstWalk, canStartPuzzle, canStartRun, countRun, dailyAllowance, dailyLimitKind, endFirstWalkAdmission,
  localDay, puzzleLimitReached, RUNS_KEY, runLimitReached, runsToday,
} = await import('./dailyGames')
const { usePass } = await import('./passStore')
const { PASS_PRODUCTS, PLAY_PASS_PRODUCTS } = await import('./pass')
const { REVIEW_ACCESS_KEY, REVIEW_GRANT_MS } = await import('./reviewAccess')

function on(platform: 'ios' | 'android' | 'web', audience = 'normal') {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
  build.audience = audience
}

/** Café puzzles completed now (the fake clock's now), as durable receipts on its local day. */
function puzzlesNow(ids: readonly string[]) {
  const raw = values.get(SETTLEMENT_KEY)
  let ledger = raw ? JSON.parse(raw) : emptySettlementLedger()
  const game = MATRIX_FIXTURES[5].game
  for (const attemptId of ids) {
    const acceptedAt = Date.now()
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId, origin: 'daily' }),
      acceptedAt,
      localDate: localDay(),
      continuation: null,
      dailyKey: attemptId,
    })
    const result = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (result.status === 'blocked') throw new Error(`Invalid receipt fixture: ${result.reason}`)
    ledger = result.ledger
    for (const effect of result.receipt.effects) ledger = acknowledgeEffect(ledger, result.receipt.receiptId, effect)
  }
  values.set(SETTLEMENT_KEY, JSON.stringify(ledger))
}

/** Two walks and two café puzzles, all at the fake clock's now. */
function useUpToday(tag: string) {
  countRun(Date.now())
  countRun(Date.now())
  puzzlesNow([`${tag}-1`, `${tag}-2`])
}

const at = (d: number, h: number, min: number) => vi.setSystemTime(new Date(2026, 9, d, h, min))

beforeEach(() => {
  values.clear()
  endFirstWalkAdmission()
  usePass.setState({ status: 'not-entitled', offers: [], productId: undefined })
  on('ios')
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  endFirstWalkAdmission()
  build.audience = 'normal'
})

describe.each(['ios', 'android'] as const)('a day boundary on %s', (platform) => {
  beforeEach(() => on(platform))

  it('free: two walks and two café puzzles used at 23:59 refuse both; at 00:01 both are back', () => {
    at(4, 23, 58)
    useUpToday('late')
    at(4, 23, 59)
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
    expect(runLimitReached()).toBe(true)
    expect(puzzleLimitReached()).toBe(true)
    expect(dailyAllowance()).toEqual({ unlimited: false, runs: { used: 2, limit: 2 }, puzzles: { used: 2, limit: 2 } })
    at(5, 0, 1)
    expect(canStartRun()).toBe(true)
    expect(canStartPuzzle()).toBe(true)
    expect(runLimitReached()).toBe(false)
    expect(puzzleLimitReached()).toBe(false)
    expect(dailyAllowance()).toEqual({ unlimited: false, runs: { used: 0, limit: 2 }, puzzles: { used: 0, limit: 2 } })
    // The new day counts from nothing: two more of each, then refused again.
    useUpToday('early')
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
  })

  const products = platform === 'android' ? PLAY_PASS_PRODUCTS : PASS_PRODUCTS
  it.each(['monthly', 'lifetime'] as const)('%s: Unlimited never blocks, either side of midnight', (kind) => {
    usePass.setState({ status: 'entitled', productId: products[kind] })
    at(4, 23, 58)
    useUpToday('late')
    countRun(Date.now())
    puzzlesNow(['late-3'])
    at(4, 23, 59)
    expect([canStartRun(), canStartPuzzle(), runLimitReached(), puzzleLimitReached()]).toEqual([true, true, false, false])
    expect(dailyAllowance().unlimited).toBe(true)
    // Unlimited runs are still counted, so the count is true if the pass lapses.
    expect(runsToday(storage)).toBe(3)
    at(5, 0, 1)
    expect([canStartRun(), canStartPuzzle(), runLimitReached(), puzzleLimitReached()]).toEqual([true, true, false, false])
    // A lapsed pass falls back to today's free count, not yesterday's.
    usePass.setState({ status: 'not-entitled', productId: undefined })
    expect(canStartRun()).toBe(true)
    expect(canStartPuzzle()).toBe(true)
  })
})

describe('Google Play review access (PLAY_REVIEW_ACCESS_CODE, 30 days on the device)', () => {
  it('lifts both limits on Android while the grant runs, and only there', () => {
    on('android')
    at(4, 12, 0)
    useUpToday('review')
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: Date.now() + REVIEW_GRANT_MS }))
    expect([canStartRun(), canStartPuzzle(), runLimitReached(), puzzleLimitReached()]).toEqual([true, true, false, false])
    expect(dailyAllowance().unlimited).toBe(true)
    // iOS has no review code: a grant on the device changes nothing there.
    on('ios')
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
    // After 30 days the grant has run out and the free limits are back.
    on('android')
    vi.setSystemTime(Date.now() + REVIEW_GRANT_MS + 60_000)
    countRun(Date.now()); countRun(Date.now())
    puzzlesNow(['after-1', 'after-2'])
    expect(canStartRun()).toBe(false)
    expect(canStartPuzzle()).toBe(false)
  })
})

describe('which limit the paywall speaks of', () => {
  const allowance = (runs: number, puzzles: number) => ({ unlimited: false, runs: { used: runs, limit: 2 }, puzzles: { used: puzzles, limit: 2 } })
  it('names the one reached, or both', () => {
    expect(dailyLimitKind(allowance(2, 0))).toBe('runs')
    expect(dailyLimitKind(allowance(2, 1))).toBe('runs')
    expect(dailyLimitKind(allowance(0, 2))).toBe('puzzles')
    expect(dailyLimitKind(allowance(1, 2))).toBe('puzzles')
    expect(dailyLimitKind(allowance(2, 2))).toBe('both')
  })

  it('claims nothing when neither is reached (a new day under the open dialog) or a count cannot be read', () => {
    expect(dailyLimitKind(allowance(0, 0))).toBe('unknown')
    expect(dailyLimitKind({ ...allowance(2, 2), unreadable: true })).toBe('unknown')
  })

  it("reads today's counts without writing, and flags a count it cannot read", () => {
    at(4, 10, 0)
    values.set(RUNS_KEY, '{broken')
    const read = dailyAllowance()
    expect(read.unreadable).toBe(true)
    expect(read.runs.used).toBe(2)
    expect(dailyLimitKind(read)).toBe('unknown')
    // Nothing healed by the read; the gate at the tap heals it.
    expect(values.get(RUNS_KEY)).toBe('{broken')
    expect(canStartRun()).toBe(false)
    expect(values.get(RUNS_KEY)).not.toBe('{broken')
    expect(dailyAllowance().unreadable).toBeUndefined()
  })
})

describe("onboarding day one: the first session's walk is never refused, and it counts", () => {
  it('is admitted whatever the count says, and its first answer counts it and uses the admission up', () => {
    at(4, 10, 0)
    countRun(Date.now()); countRun(Date.now())
    expect(canStartRun()).toBe(false)
    expect(admitFirstWalk(true)).toBe(true)
    expect(canStartRun()).toBe(true)
    expect(runLimitReached()).toBe(false)
    // The walk's first answer (the results sink's countRun): counted.
    countRun(Date.now())
    expect(runsToday(storage)).toBe(3)
    // A "Walk again" asks the count as usual.
    expect(canStartRun()).toBe(false)
  })

  it("on a fresh device the intro's walk is one of today's two", () => {
    at(4, 10, 0)
    admitFirstWalk(true)
    countRun(Date.now())
    endFirstWalkAdmission()
    expect(dailyAllowance().runs).toEqual({ used: 1, limit: 2 })
    expect(canStartRun()).toBe(true)
    countRun(Date.now())
    expect(canStartRun()).toBe(false)
  })

  it('is only for a real first session, and a walk left before its first answer leaves nothing admitted', () => {
    at(4, 10, 0)
    countRun(Date.now()); countRun(Date.now())
    // A replayed intro (persist false) is not a first session.
    expect(admitFirstWalk(false)).toBe(false)
    expect(canStartRun()).toBe(false)
    expect(admitFirstWalk(true)).toBe(true)
    endFirstWalkAdmission()
    expect(canStartRun()).toBe(false)
  })

  it("café puzzles count from the first one: the intro's puzzle is one of today's two", () => {
    at(4, 10, 0)
    puzzlesNow(['first-cafe'])
    expect(canStartPuzzle()).toBe(true)
    puzzlesNow(['second'])
    expect(canStartPuzzle()).toBe(false)
  })
})
