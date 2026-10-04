import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { capacitor, nativePass, build } = vi.hoisted(() => ({
  capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
  nativePass: {
    status: vi.fn(),
    offers: vi.fn(),
    purchase: vi.fn(),
    restore: vi.fn(),
    redeemCode: vi.fn(),
    addListener: vi.fn(),
  },
  build: { audience: 'normal' as string },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => nativePass),
}))

vi.mock('../build/audience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../build/audience')>()
  return { ...actual, get buildAudience() { return build.audience } }
})

import { FREE_CITIES, PASS_GATE_ENABLED, PASS_PRODUCTS, PLAY_PASS_PRODUCTS, canBoardWithPass, listPassOffers, needsPassForDeparture, storeDisplayPrice } from './pass'

beforeEach(() => {
  vi.clearAllMocks()
  capacitor.isNativePlatform.mockReturnValue(true)
  capacitor.getPlatform.mockReturnValue('ios')
  build.audience = 'normal'
  vi.spyOn(console, 'debug').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('travel pass access', () => {
  it('is off for launch: no train on the route asks for a pass', () => {
    expect(PASS_GATE_ENABLED).toBe(false)
    for (let cityIndex = 0; cityIndex < 9; cityIndex += 1) {
      expect(needsPassForDeparture(cityIndex)).toBe(false)
      expect(canBoardWithPass(cityIndex, 'unavailable')).toBe(true)
    }
  })

  // The dormant model, pinned so that flipping the switch back brings back
  // exactly the gate that was designed, not whatever the code has drifted to.
  describe('the dormant two-city gate, when switched on', () => {
    it('keeps exactly the first two cities free and stops the train after Ribe', () => {
      expect(FREE_CITIES).toBe(2)
      expect(needsPassForDeparture(0, FREE_CITIES, true)).toBe(false)
      expect(needsPassForDeparture(1, FREE_CITIES, true)).toBe(true)
      expect(needsPassForDeparture(8, FREE_CITIES, true)).toBe(true)
    })

    it('does not turn an unavailable web or checking StoreKit state into access', () => {
      for (const status of ['checking', 'not-entitled', 'unavailable', 'error'] as const) {
        expect(canBoardWithPass(1, status, true)).toBe(false)
      }
      expect(canBoardWithPass(1, 'entitled', true)).toBe(true)
    })

    it('does not charge the first train even while StoreKit is unavailable', () => {
      expect(canBoardWithPass(0, 'unavailable', true)).toBe(true)
    })
  })
})

describe('StoreKit pass offer diagnostics', () => {
  it('identifies an unimplemented native plugin without logging the raw error', async () => {
    nativePass.offers.mockRejectedValue(Object.assign(new Error('receipt=secret-value'), { code: 'UNIMPLEMENTED' }))

    expect(await listPassOffers()).toEqual([])
    expect(console.warn).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'native-plugin-missing',
      errorCode: 'UNIMPLEMENTED',
      requestedProductIds: Object.values(PASS_PRODUCTS),
      returnedProducts: [],
    }))
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('secret-value')
  })

  it('preserves the StoreKit error code but omits the native error message', async () => {
    nativePass.offers.mockRejectedValue(Object.assign(new Error('account=private-value'), { code: 'SKErrorDomain:5' }))

    expect(await listPassOffers()).toEqual([])
    expect(console.warn).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'store-request-failed',
      errorCode: 'SKErrorDomain:5',
      returnedProducts: [],
    }))
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private-value')
  })

  it('reports a successful empty StoreKit response separately from entitlement status', async () => {
    nativePass.offers.mockResolvedValue({ offers: [] })

    expect(await listPassOffers()).toEqual([])
    expect(console.info).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'store-empty',
      requestedProductIds: Object.values(PASS_PRODUCTS),
      returnedProducts: [],
    }))
    expect(nativePass.status).not.toHaveBeenCalled()
  })

  it('reports returned products with their localized prices', async () => {
    const offers = [
      { id: PASS_PRODUCTS.monthly, displayPrice: '$0.99' },
      { id: PASS_PRODUCTS.lifetime, displayPrice: '£10.99' },
    ]
    nativePass.offers.mockResolvedValue({ offers })

    expect(await listPassOffers()).toEqual(offers)
    expect(console.info).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'store-products',
      returnedProducts: offers,
    }))
  })

  it('reports a browser without attempting the native plugin', async () => {
    capacitor.isNativePlatform.mockReturnValue(false)
    capacitor.getPlatform.mockReturnValue('web')

    expect(await listPassOffers()).toEqual([])
    expect(console.debug).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'no-store',
      platform: 'web',
      returnedProducts: [],
    }))
    expect(nativePass.offers).not.toHaveBeenCalled()
  })
})

describe('one entitlement API for both stores', () => {
  it('sells the App Store pair on iOS and the short Google Play pair on Android', async () => {
    const { PLAY_PASS_PRODUCTS, billingPlatform, buyPass, passProducts, storeBillingAvailable, storeKitAvailable } = await import('./pass')
    expect(billingPlatform()).toBe('ios')
    expect(passProducts()).toEqual(PASS_PRODUCTS)
    capacitor.getPlatform.mockReturnValue('android')
    expect(billingPlatform()).toBe('android')
    expect(storeBillingAvailable()).toBe(true)
    expect(storeKitAvailable()).toBe(false)
    expect(passProducts()).toEqual(PLAY_PASS_PRODUCTS)
    // Play caps a product ID at 40 characters.
    for (const id of Object.values(PLAY_PASS_PRODUCTS)) expect(id.length).toBeLessThanOrEqual(40)
    nativePass.purchase.mockResolvedValue({ entitled: true, productId: PLAY_PASS_PRODUCTS.monthly })
    expect(await buyPass('monthly')).toEqual({ status: 'entitled', productId: PLAY_PASS_PRODUCTS.monthly })
    expect(nativePass.purchase).toHaveBeenCalledWith({ productId: 'pass.monthly' })
  })

  it('grants Unlimited for either qualifying product on either store', async () => {
    const { PLAY_PASS_PRODUCTS, readPassStatus, restorePass } = await import('./pass')
    for (const [platform, products] of [['ios', PASS_PRODUCTS], ['android', PLAY_PASS_PRODUCTS]] as const) {
      capacitor.getPlatform.mockReturnValue(platform)
      for (const productId of Object.values(products)) {
        nativePass.status.mockResolvedValue({ entitled: true, productId })
        nativePass.restore.mockResolvedValue({ entitled: true, productId })
        expect(await readPassStatus()).toEqual({ status: 'entitled', productId })
        expect(await restorePass()).toEqual({ status: 'entitled', productId })
      }
    }
  })

  it('does not grant Unlimited for an unrelated product, or for the other store\'s IDs', async () => {
    const { PLAY_PASS_PRODUCTS, buyPass, readPassStatus, restorePass } = await import('./pass')
    const cases = [
      ['ios', ['coins.100', PLAY_PASS_PRODUCTS.lifetime, undefined]],
      ['android', ['coins.100', PASS_PRODUCTS.lifetime, undefined]],
    ] as const
    for (const [platform, ids] of cases) {
      capacitor.getPlatform.mockReturnValue(platform)
      for (const productId of ids) {
        nativePass.status.mockResolvedValue({ entitled: true, productId })
        nativePass.restore.mockResolvedValue({ entitled: true, productId })
        nativePass.purchase.mockResolvedValue({ entitled: true, productId })
        expect((await readPassStatus()).status).toBe('not-entitled')
        expect((await restorePass()).status).toBe('not-entitled')
        expect((await buyPass('lifetime')).status).toBe('not-entitled')
      }
    }
  })

  it('never turns an Android unavailable, error, pending or cancelled answer into Unlimited', async () => {
    const { buyPass, readPassStatus, restorePass } = await import('./pass')
    capacitor.getPlatform.mockReturnValue('android')
    nativePass.status.mockRejectedValue(Object.assign(new Error('Google Play billing is not available.'), { code: 'PlayBilling:3' }))
    nativePass.restore.mockRejectedValue(new Error('no connection'))
    expect(await readPassStatus()).toEqual({ status: 'error' })
    expect(await restorePass()).toEqual({ status: 'error' })
    nativePass.purchase.mockResolvedValue({ entitled: false, pending: true })
    expect(await buyPass('lifetime')).toEqual({ status: 'not-entitled', pending: true, cancelled: undefined })
    nativePass.purchase.mockResolvedValue({ entitled: false, cancelled: true })
    expect(await buyPass('monthly')).toEqual({ status: 'not-entitled', cancelled: true, pending: undefined })
    nativePass.purchase.mockRejectedValue(new Error('unverified'))
    expect(await buyPass('monthly')).toEqual({ status: 'error' })
  })

  it('keeps a browser out of every store call', async () => {
    const { buyPass, readPassStatus, restorePass, billingPlatform } = await import('./pass')
    capacitor.isNativePlatform.mockReturnValue(false)
    capacitor.getPlatform.mockReturnValue('web')
    expect(billingPlatform()).toBeNull()
    expect(await readPassStatus()).toEqual({ status: 'unavailable' })
    expect(await restorePass()).toEqual({ status: 'unavailable' })
    expect(await buyPass('lifetime')).toEqual({ status: 'unavailable' })
    expect(nativePass.status).not.toHaveBeenCalled()
    expect(nativePass.purchase).not.toHaveBeenCalled()
  })

  it('keeps native non-store audiences out of every billing plugin call', async () => {
    const { billingPlatform, storeBillingAvailable, readPassStatus, buyPass, restorePass, redeemPassCode, onPassChanged } = await import('./pass')
    capacitor.isNativePlatform.mockReturnValue(true)
    capacitor.getPlatform.mockReturnValue('android')

    for (const audience of ['open-source', 'web-demo', 'feedback', 'developer']) {
      build.audience = audience
      expect(billingPlatform()).toBeNull()
      expect(storeBillingAvailable()).toBe(false)
      expect(await readPassStatus()).toEqual({ status: 'unavailable' })
      expect(await listPassOffers()).toEqual([])
      expect(await buyPass('monthly')).toEqual({ status: 'unavailable' })
      expect(await restorePass()).toEqual({ status: 'unavailable' })
      expect(await redeemPassCode()).toEqual({ opened: false })
      await onPassChanged(vi.fn())
    }

    expect(nativePass.status).not.toHaveBeenCalled()
    expect(nativePass.offers).not.toHaveBeenCalled()
    expect(nativePass.purchase).not.toHaveBeenCalled()
    expect(nativePass.restore).not.toHaveBeenCalled()
    expect(nativePass.redeemCode).not.toHaveBeenCalled()
    expect(nativePass.addListener).not.toHaveBeenCalled()
  })

  it('keeps Apple\'s offer-code sheet on iOS only', async () => {
    const { redeemPassCode } = await import('./pass')
    capacitor.getPlatform.mockReturnValue('android')
    expect(await redeemPassCode()).toEqual({ opened: false })
    expect(nativePass.redeemCode).not.toHaveBeenCalled()
  })

  it('logs Google Play offers under the Play IDs', async () => {
    const { PLAY_PASS_PRODUCTS } = await import('./pass')
    capacitor.getPlatform.mockReturnValue('android')
    const offers = [{ id: PLAY_PASS_PRODUCTS.monthly, displayPrice: '7,00 kr.' }]
    nativePass.offers.mockResolvedValue({ offers })
    expect(await listPassOffers()).toEqual(offers)
    expect(console.info).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'store-products',
      platform: 'android',
      requestedProductIds: Object.values(PLAY_PASS_PRODUCTS),
      returnedProducts: offers,
    }))
  })
})

describe('the price shown for Unlimited', () => {
  // What the stores hand back for a player in each storefront: StoreKit's
  // Product.displayPrice and Play's getFormattedPrice() are already formatted
  // for the storefront, so the test builds them the same way.
  const storePrice = (locale: string, currency: string, amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)

  it.each([
    ['da-DK', 'DKK', 7],
    ['de-DE', 'EUR', 0.99],
    ['en-US', 'USD', 0.99],
  ])("shows the store's own string for a %s storefront (%s), unchanged", (locale, currency, amount) => {
    const price = storePrice(locale, currency, amount)
    const offers = [{ id: PASS_PRODUCTS.monthly, displayPrice: price }]
    expect(storeDisplayPrice(offers, PASS_PRODUCTS.monthly)).toBe(price)
    // Only a US storefront ever puts a dollar sign in front of the player.
    expect(storeDisplayPrice(offers, PASS_PRODUCTS.monthly)!.includes('$')).toBe(currency === 'USD')
  })

  it('prices each product from its own offer, Play IDs included', () => {
    const offers = [
      { id: PLAY_PASS_PRODUCTS.monthly, displayPrice: '7,00 kr.' },
      { id: PLAY_PASS_PRODUCTS.lifetime, displayPrice: '79,00 kr.' },
    ]
    expect(storeDisplayPrice(offers, PLAY_PASS_PRODUCTS.monthly)).toBe('7,00 kr.')
    expect(storeDisplayPrice(offers, PLAY_PASS_PRODUCTS.lifetime)).toBe('79,00 kr.')
    // An App Store product is never priced from a Play offer, or the reverse.
    expect(storeDisplayPrice(offers, PASS_PRODUCTS.monthly)).toBeNull()
  })

  it('has no price at all until the store returns the product', () => {
    expect(storeDisplayPrice([], PASS_PRODUCTS.monthly)).toBeNull()
    expect(storeDisplayPrice([{ id: PASS_PRODUCTS.monthly, displayPrice: '  ' }], PASS_PRODUCTS.monthly)).toBeNull()
    expect(storeDisplayPrice([{ id: PASS_PRODUCTS.lifetime, displayPrice: '$10.99' }], PASS_PRODUCTS.monthly)).toBeNull()
  })
})
