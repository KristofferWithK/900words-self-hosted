import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { capacitor, nativePass } = vi.hoisted(() => ({
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
  },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => nativePass),
}))

import { FREE_CITIES, PASS_GATE_ENABLED, PASS_PRODUCTS, canBoardWithPass, listPassOffers, needsPassForDeparture } from './pass'

beforeEach(() => {
  vi.clearAllMocks()
  capacitor.isNativePlatform.mockReturnValue(true)
  capacitor.getPlatform.mockReturnValue('ios')
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
      outcome: 'storekit-request-failed',
      errorCode: 'SKErrorDomain:5',
      returnedProducts: [],
    }))
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private-value')
  })

  it('reports a successful empty StoreKit response separately from entitlement status', async () => {
    nativePass.offers.mockResolvedValue({ offers: [] })

    expect(await listPassOffers()).toEqual([])
    expect(console.info).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'storekit-empty',
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
      outcome: 'storekit-products',
      returnedProducts: offers,
    }))
  })

  it('reports non-iOS without attempting the native plugin', async () => {
    capacitor.isNativePlatform.mockReturnValue(false)
    capacitor.getPlatform.mockReturnValue('web')

    expect(await listPassOffers()).toEqual([])
    expect(console.debug).toHaveBeenCalledWith('900words.pass-offers', expect.objectContaining({
      outcome: 'not-ios',
      platform: 'web',
      returnedProducts: [],
    }))
    expect(nativePass.offers).not.toHaveBeenCalled()
  })
})
