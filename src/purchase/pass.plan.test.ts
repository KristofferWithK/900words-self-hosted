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
    manageSubscriptions: vi.fn(),
  },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => nativePass),
}))

import {
  APPLE_SUBSCRIPTIONS_URL,
  PASS_PRODUCTS,
  PLAY_PACKAGE,
  PLAY_PASS_PRODUCTS,
  PLAY_SUBSCRIPTION_URL,
  buyPass,
  manageSubscriptionUrl,
  openManageSubscriptions,
  passKind,
  planOf,
  readPassStatus,
  restorePass,
  storeDisplayPrice,
} from './pass'

const native = (platform: 'ios' | 'android' | 'web') => {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
}

beforeEach(() => {
  vi.clearAllMocks()
  native('ios')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Your plan: what the player has', () => {
  it('tells checking, free, monthly, lifetime, both and error apart on both stores', () => {
    for (const [platform, products] of [['ios', PASS_PRODUCTS], ['android', PLAY_PASS_PRODUCTS]] as const) {
      expect(planOf({ status: 'checking' }, platform)).toBe('checking')
      expect(planOf({ status: 'error' }, platform)).toBe('error')
      expect(planOf({ status: 'not-entitled' }, platform)).toBe('free')
      expect(planOf({ status: 'unavailable' }, null)).toBe('unavailable')
      expect(planOf({ status: 'entitled', productId: products.monthly }, platform)).toBe('monthly')
      expect(planOf({ status: 'entitled', productId: products.lifetime }, platform)).toBe('lifetime')
      expect(planOf({
        status: 'entitled',
        productId: products.lifetime,
        ownedProductIds: [products.monthly, products.lifetime],
      }, platform)).toBe('both')
      // Lifetime wins even if a native side ever named monthly as the product.
      expect(planOf({
        status: 'entitled',
        productId: products.monthly,
        ownedProductIds: [products.monthly, products.lifetime],
      }, platform)).toBe('both')
    }
  })

  it('never reads another store\'s product as this store\'s plan', () => {
    expect(planOf({ status: 'entitled', productId: PASS_PRODUCTS.lifetime }, 'android')).toBe('free')
    expect(passKind(PLAY_PASS_PRODUCTS.monthly, 'ios')).toBeNull()
    expect(passKind(PLAY_PASS_PRODUCTS.monthly, 'android')).toBe('monthly')
    expect(passKind(PASS_PRODUCTS.lifetime, 'ios')).toBe('lifetime')
  })

  it('keeps what the store owns from the native answer, minus anything that is not a pass', async () => {
    nativePass.status.mockResolvedValue({
      entitled: true,
      productId: PASS_PRODUCTS.lifetime,
      ownedProductIds: [PASS_PRODUCTS.monthly, PASS_PRODUCTS.lifetime, 'coins.100'],
    })
    expect(await readPassStatus()).toEqual({
      status: 'entitled',
      productId: PASS_PRODUCTS.lifetime,
      ownedProductIds: [PASS_PRODUCTS.monthly, PASS_PRODUCTS.lifetime],
    })
    // A native build from before "Your plan" says nothing about the rest.
    nativePass.restore.mockResolvedValue({ entitled: true, productId: PASS_PRODUCTS.monthly })
    expect(await restorePass()).toEqual({ status: 'entitled', productId: PASS_PRODUCTS.monthly })
    nativePass.purchase.mockResolvedValue({ entitled: true, productId: PASS_PRODUCTS.lifetime, ownedProductIds: [PASS_PRODUCTS.lifetime] })
    expect(await buyPass('lifetime')).toEqual({ status: 'entitled', productId: PASS_PRODUCTS.lifetime, ownedProductIds: [PASS_PRODUCTS.lifetime] })
  })
})

describe('prices are only ever the store\'s own string', () => {
  it('returns the storefront\'s string untouched, and null when the store has not answered', () => {
    const offers = [
      { id: PASS_PRODUCTS.monthly, displayPrice: '0,99 €' },
      { id: PASS_PRODUCTS.lifetime, displayPrice: ' $10.99 ' },
    ]
    expect(storeDisplayPrice(offers, PASS_PRODUCTS.monthly)).toBe('0,99 €')
    expect(storeDisplayPrice(offers, PASS_PRODUCTS.lifetime)).toBe('$10.99')
    expect(storeDisplayPrice([], PASS_PRODUCTS.lifetime)).toBeNull()
    expect(storeDisplayPrice([{ id: PASS_PRODUCTS.lifetime, displayPrice: '  ' }], PASS_PRODUCTS.lifetime)).toBeNull()
  })
})

describe('Manage or cancel subscription', () => {
  it('links Google Play\'s page for this one subscription in this app', () => {
    expect(PLAY_PACKAGE).toBe('com.kristofferwithk.cluecabulary')
    expect(PLAY_SUBSCRIPTION_URL).toBe(
      'https://play.google.com/store/account/subscriptions?sku=pass.monthly&package=com.kristofferwithk.cluecabulary',
    )
    expect(manageSubscriptionUrl('android')).toBe(PLAY_SUBSCRIPTION_URL)
    expect(manageSubscriptionUrl('ios')).toBe(APPLE_SUBSCRIPTIONS_URL)
    expect(manageSubscriptionUrl(null)).toBeNull()
  })

  it('opens Apple\'s own sheet on iOS and nothing else', async () => {
    nativePass.manageSubscriptions.mockResolvedValue({ opened: true, sheet: true })
    const open = vi.fn()
    expect(await openManageSubscriptions(open)).toEqual({ opened: true, sheet: true })
    expect(open).not.toHaveBeenCalled()
  })

  it('falls back to Apple\'s subscriptions page when the native build has no sheet', async () => {
    nativePass.manageSubscriptions.mockRejectedValue(Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' }))
    const open = vi.fn()
    expect(await openManageSubscriptions(open)).toEqual({ opened: true, sheet: false })
    expect(open).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions')
  })

  it('opens Google Play\'s page on Android without asking the native side', async () => {
    native('android')
    const open = vi.fn()
    expect(await openManageSubscriptions(open)).toEqual({ opened: true, sheet: false })
    expect(open).toHaveBeenCalledWith(PLAY_SUBSCRIPTION_URL)
    expect(nativePass.manageSubscriptions).not.toHaveBeenCalled()
  })

  it('does nothing in a browser, where nothing is sold', async () => {
    native('web')
    const open = vi.fn()
    expect(await openManageSubscriptions(open)).toEqual({ opened: false, sheet: false })
    expect(open).not.toHaveBeenCalled()
  })
})
