import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The daily-limit dialog on each store: Play's prices and wording on Android
 * with nothing of Apple's in it, and the iOS dialog exactly as it was.
 */
const { capacitor } = vi.hoisted(() => ({
  capacitor: { isNativePlatform: vi.fn(() => true), getPlatform: vi.fn(() => 'ios') },
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

const { PassScreen } = await import('./PassScreen')
const { usePass } = await import('../../purchase/passStore')
const { useUi } = await import('../../stores/uiStore')
const { PASS_PRODUCTS, PLAY_PASS_PRODUCTS } = await import('../../purchase/pass')
const { UI } = await import('../../i18n')

/**
 * Server rendering reads a zustand store's INITIAL state (useSyncExternalStore's
 * server snapshot), so the test writes there and puts it back afterwards.
 */
const passInitial = usePass.getInitialState()
const uiInitial = useUi.getInitialState()
const savedPass = { ...passInitial }
const savedUi = { ...uiInitial }

function dialogOn(platform: 'ios' | 'android', offers: { id: string; displayPrice: string }[]) {
  capacitor.getPlatform.mockReturnValue(platform)
  Object.assign(passInitial, { status: 'not-entitled', offers, message: null, thanked: false })
  Object.assign(uiInitial, { dailyLimitOpen: true })
  return renderToStaticMarkup(<PassScreen />)
}

function routeScreenOn(platform: 'ios' | 'android', offers: { id: string; displayPrice: string }[]) {
  capacitor.getPlatform.mockReturnValue(platform)
  Object.assign(passInitial, { status: 'not-entitled', offers, message: null, thanked: false })
  Object.assign(uiInitial, { dailyLimitOpen: false, screen: 'pass' })
  return renderToStaticMarkup(<PassScreen />)
}

/** Whatever sits in the price slots, in order. */
const priceSlots = (html: string) => [...html.matchAll(/<b>([^<]*)<\/b>/g)].map((match) => match[1])

afterEach(() => {
  Object.assign(passInitial, savedPass)
  Object.assign(uiInitial, savedUi)
})

describe('the daily-limit dialog', () => {
  it('on Android offers both Play products at Play\'s prices, with nothing of Apple\'s', () => {
    const html = dialogOn('android', [
      { id: PLAY_PASS_PRODUCTS.monthly, displayPrice: '7,00 kr.' },
      { id: PLAY_PASS_PRODUCTS.lifetime, displayPrice: '79,00 kr.' },
    ])
    expect(html).toContain('7,00 kr.')
    expect(html).toContain('79,00 kr.')
    expect(html).toContain(UI.home.dailyLimitRestore)
    expect(html).toContain(UI.home.dailyLimitDisclosurePlay)
    expect(html).not.toContain(UI.home.passRedeem)
    expect(html).not.toContain('apple.com')
    expect(html).not.toMatch(/Apple|App Store/)
    expect(html).toContain('900words.app/app-privacy/')
  })

  it('on Android does not price an App Store product', () => {
    const html = dialogOn('android', [{ id: PASS_PRODUCTS.monthly, displayPrice: '$0.99' }])
    expect(html).not.toContain('$0.99')
    expect(html).toContain(UI.home.dailyLimitUnavailable)
  })

  it('on iOS is unchanged: StoreKit prices, Apple wording, the code sheet and Apple\'s EULA', () => {
    const html = dialogOn('ios', [
      { id: PASS_PRODUCTS.monthly, displayPrice: '$0.99' },
      { id: PASS_PRODUCTS.lifetime, displayPrice: '$10.99' },
    ])
    expect(html).toContain('$0.99')
    expect(html).toContain('$10.99')
    expect(html).toContain(UI.home.dailyLimitDisclosure)
    expect(html).toContain(UI.home.passRedeem)
    expect(html).toContain('apple.com/legal/internet-services/itunes/dev/stdeula/')
    expect(html).not.toContain('Google')
  })
})

describe("the Unlimited price in the player's currency", () => {
  const storefronts = [
    { name: 'Danish', monthly: '7,00 kr.', lifetime: '79,00 kr.' },
    { name: 'German', monthly: '0,99 €', lifetime: '10,99 €' },
    { name: 'US', monthly: '$0.99', lifetime: '$10.99' },
  ]

  it.each(storefronts)("shows the $name storefront's own prices on both surfaces", ({ monthly, lifetime }) => {
    for (const html of [
      dialogOn('ios', [{ id: PASS_PRODUCTS.monthly, displayPrice: monthly }, { id: PASS_PRODUCTS.lifetime, displayPrice: lifetime }]),
      routeScreenOn('ios', [{ id: PASS_PRODUCTS.monthly, displayPrice: monthly }, { id: PASS_PRODUCTS.lifetime, displayPrice: lifetime }]),
      dialogOn('android', [{ id: PLAY_PASS_PRODUCTS.monthly, displayPrice: monthly }, { id: PLAY_PASS_PRODUCTS.lifetime, displayPrice: lifetime }]),
      routeScreenOn('android', [{ id: PLAY_PASS_PRODUCTS.monthly, displayPrice: monthly }, { id: PLAY_PASS_PRODUCTS.lifetime, displayPrice: lifetime }]),
    ]) {
      expect(priceSlots(html)).toEqual([monthly, lifetime])
      // No dollar sign unless the store itself priced in dollars.
      expect(html.includes('$')).toBe(monthly.includes('$'))
    }
  })

  it.each(['ios', 'android'] as const)('on %s shows no price and no currency before the store has answered', (platform) => {
    for (const html of [dialogOn(platform, []), routeScreenOn(platform, [])]) {
      expect(priceSlots(html)).toEqual([UI.home.dailyLimitUnavailable, UI.home.dailyLimitUnavailable])
      expect(priceSlots(html).join(' ')).not.toMatch(/[0-9$€£¥]|kr|USD|EUR|DKK/)
    }
  })
})

const PassScreenModule = await import('./PassScreen')
const { dailyLimitWords } = PassScreenModule
const { RUNS_KEY, localDay } = await import('../../purchase/dailyGames')

describe('which free limit the dialog speaks of (CW-15)', () => {
  const today = (runs: number, puzzles: number) => ({ unlimited: false, runs: { used: runs, limit: 2 }, puzzles: { used: puzzles, limit: 2 } })

  it('says the walks are used and how many café puzzles are left', () => {
    expect(dailyLimitWords(today(2, 0))).toEqual({ kind: 'runs', kicker: UI.home.dailyLimitRunsKicker, stillOpen: UI.home.dailyLimitPuzzlesLeft(2) })
    expect(dailyLimitWords(today(2, 1)).stillOpen).toBe(UI.home.dailyLimitPuzzlesLeft(1))
  })

  it('says the café puzzles are used and how many walks are left', () => {
    expect(dailyLimitWords(today(0, 2))).toEqual({ kind: 'puzzles', kicker: UI.home.dailyLimitPuzzlesKicker, stillOpen: UI.home.dailyLimitRunsLeft(2) })
    expect(dailyLimitWords(today(1, 2)).stillOpen).toBe(UI.home.dailyLimitRunsLeft(1))
  })

  it('with both used, says so and offers nothing more for today', () => {
    expect(dailyLimitWords(today(2, 2))).toEqual({ kind: 'both', kicker: UI.home.dailyLimitBothKicker, stillOpen: null })
  })

  it('claims nothing about today when the counts cannot be read, or neither limit is reached', () => {
    const neutral = { kind: 'unknown', kicker: UI.home.dailyLimitKicker, stillOpen: null }
    expect(dailyLimitWords({ ...today(2, 2), unreadable: true })).toEqual(neutral)
    expect(dailyLimitWords(today(0, 0))).toEqual(neutral)
    expect(UI.home.dailyLimitKicker).not.toBe(UI.home.dailyLimitBothKicker)
  })

  it('English counts its leftovers in the singular and the plural', () => {
    expect(UI.home.dailyLimitPuzzlesLeft(1)).toBe('You can still play 1 café puzzle today.')
    expect(UI.home.dailyLimitRunsLeft(2)).toBe('You can still take 2 walks today.')
  })

  it.each(['ios', 'android'] as const)('on %s reads today\'s counts and keeps the offers, the disclosure, Restore and the legal links', (platform) => {
    const values = new Map<string, string>([[RUNS_KEY, JSON.stringify({ days: { [localDay()]: 2 } })]])
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) },
    })
    try {
      const products = platform === 'android' ? PLAY_PASS_PRODUCTS : PASS_PRODUCTS
      const html = dialogOn(platform, [{ id: products.monthly, displayPrice: '$0.99' }, { id: products.lifetime, displayPrice: '$10.99' }])
      expect(html).toContain('data-limit="runs"')
      expect(html).toContain(UI.home.dailyLimitRunsKicker)
      expect(html).toContain(UI.home.dailyLimitPuzzlesLeft(2))
      expect(html).toContain(UI.home.dailyLimitBody)
      expect(html).toContain(UI.home.dailyLimitHeading)
      expect(priceSlots(html)).toEqual(['$0.99', '$10.99'])
      expect(html).toContain(UI.home.dailyLimitRestore)
      expect(html).toContain(platform === 'android' ? UI.home.dailyLimitDisclosurePlay : UI.home.dailyLimitDisclosure)
      expect(html).toContain('900words.app/app-privacy/')
      expect(html.includes('apple.com/legal/internet-services/itunes/dev/stdeula/')).toBe(platform === 'ios')
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
})

describe('where App draws the daily-limit dialog (CW-15)', () => {
  const { dailyLimitDialogShown } = PassScreenModule

  it('over a replayed intro, whose walk and board may be refused', () => {
    expect(dailyLimitDialogShown({ persist: false }, true, 'home')).toBe(true)
  })

  it('never over a first session', () => {
    expect(dailyLimitDialogShown({ persist: true }, true, 'home')).toBe(false)
    expect(dailyLimitDialogShown({ persist: true }, true, 'sightseeing')).toBe(false)
  })

  it('over the ordinary screens, never over the pass route, and only while open', () => {
    expect(dailyLimitDialogShown(null, true, 'sightseeing')).toBe(true)
    expect(dailyLimitDialogShown(null, true, 'pass')).toBe(false)
    expect(dailyLimitDialogShown(null, false, 'home')).toBe(false)
    expect(dailyLimitDialogShown({ persist: false }, false, 'home')).toBe(false)
  })
})
