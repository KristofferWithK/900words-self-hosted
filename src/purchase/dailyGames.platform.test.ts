import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The daily limit on each platform and audience, against a real receipt
 * ledger: the App Store and Google Play builds share one gate, and nothing
 * else (the web, the feedback, developer and open-source builds) inherits it.
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
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  },
})

const { attemptFixture, MATRIX_FIXTURES, settlementFixture } = await import('../progression/fixtures')
const { acknowledgeEffect, emptySettlementLedger, prepareSettlement } = await import('../progression/settlement')
const { SETTLEMENT_KEY } = await import('../stores/settlementStorage')
const { prepareLearning } = await import('../srs/settlement')
const { canDeveloperContinue, canStartDailyGame, dailyGateApplies, dailyLimitReached, localDay } = await import('./dailyGames')
const { usePass } = await import('./passStore')
const { PLAY_PASS_PRODUCTS } = await import('./pass')
const { REVIEW_ACCESS_KEY, REVIEW_GRANT_MS } = await import('./reviewAccess')

type Origin = 'primary' | 'replay' | 'daily' | 'tutorial'

/** A ledger holding these completed attempts, all accepted today. */
function playedToday(origins: Origin[]) {
  let ledger = emptySettlementLedger()
  const game = MATRIX_FIXTURES[5].game
  origins.forEach((origin, index) => {
    const acceptedAt = Date.now()
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId: `${origin}-${index}`, origin }),
      acceptedAt,
      localDate: localDay(),
      ...(origin !== 'primary' ? { continuation: null } : {}),
      ...(origin === 'daily' ? { dailyKey: `daily-${index}` } : {}),
    })
    const result = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (result.status === 'blocked') throw new Error(`Invalid receipt fixture: ${result.reason}`)
    ledger = result.ledger
    for (const effect of result.receipt.effects) ledger = acknowledgeEffect(ledger, result.receipt.receiptId, effect)
  })
  values.set(SETTLEMENT_KEY, JSON.stringify(ledger))
}

function on(platform: 'ios' | 'android' | 'web', audience = 'normal') {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
  build.audience = audience
}

beforeEach(() => {
  values.clear()
  usePass.setState({ status: 'not-entitled', offers: [], productId: undefined })
})
afterEach(() => { build.audience = 'normal' })

describe('which builds have the daily limit', () => {
  it('is the App Store and the Google Play store build, and only those', () => {
    on('ios'); expect(dailyGateApplies()).toBe(true)
    on('android'); expect(dailyGateApplies()).toBe(true)
    on('web'); expect(dailyGateApplies()).toBe(false)
    for (const audience of ['developer', 'feedback', 'open-source', 'web-demo']) {
      on('android', audience); expect(dailyGateApplies()).toBe(false)
      on('ios', audience); expect(dailyGateApplies()).toBe(false)
    }
  })

  it('never paywalls the web, however much was played', () => {
    on('web')
    playedToday(['primary', 'replay', 'daily'])
    expect(canStartDailyGame()).toBe(true)
    expect(dailyLimitReached()).toBe(false)
  })
})

describe.each(['ios', 'android'] as const)('the limit on %s', (platform) => {
  beforeEach(() => on(platform))

  it('allows a second game and stops the third', () => {
    playedToday(['primary'])
    expect(canStartDailyGame()).toBe(true)
    playedToday(['primary', 'replay'])
    expect(canStartDailyGame()).toBe(false)
    expect(dailyLimitReached()).toBe(true)
  })

  it('does not count the tutorial', () => {
    playedToday(['primary', 'tutorial'])
    expect(canStartDailyGame()).toBe(true)
  })

  it('lets paid Unlimited start any number of games', () => {
    playedToday(['primary', 'replay', 'daily'])
    usePass.setState({ status: 'entitled' })
    expect(canStartDailyGame()).toBe(true)
    expect(dailyLimitReached()).toBe(false)
  })

  it('stays closed while the store is unavailable, erroring or still checking', () => {
    playedToday(['primary', 'replay'])
    for (const status of ['unavailable', 'error', 'checking', 'not-entitled'] as const) {
      usePass.setState({ status, offers: [] })
      expect(canStartDailyGame()).toBe(false)
    }
  })
})

describe('Google Play specifics', () => {
  it('lets a review-access grant past the limit on Android, and nowhere else', () => {
    playedToday(['primary', 'replay'])
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: Date.now() + REVIEW_GRANT_MS / 2 }))
    on('android')
    expect(canStartDailyGame()).toBe(true)
    expect(dailyLimitReached()).toBe(false)
    expect(usePass.getState().status).toBe('not-entitled')
    on('ios')
    expect(canStartDailyGame()).toBe(false)
  })

  it('ignores an expired or hand-made review grant', () => {
    playedToday(['primary', 'replay'])
    on('android')
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: Date.now() - 1 }))
    expect(canStartDailyGame()).toBe(false)
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: Date.now() + 10 * REVIEW_GRANT_MS }))
    expect(canStartDailyGame()).toBe(false)
    values.set(REVIEW_ACCESS_KEY, 'true')
    expect(canStartDailyGame()).toBe(false)
  })

  it('reads a purchasable Play offer as purchasable, so no developer retry is offered', () => {
    on('android')
    const offer = { id: PLAY_PASS_PRODUCTS.monthly, displayPrice: '7,00 kr.' }
    expect(canDeveloperContinue('not-entitled', [offer])).toBe(false)
    // The App Store ID is not a Play offer.
    expect(canDeveloperContinue('not-entitled', [{ ...offer, id: 'com.kristofferwithk.cluecabulary.pass.monthly' }])).toBe(true)
  })
})
