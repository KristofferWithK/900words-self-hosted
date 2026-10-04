import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android' | null,
  audience: 'normal' as string,
  status: vi.fn(),
  offers: vi.fn(),
  purchase: vi.fn(),
  redeem: vi.fn(),
  manage: vi.fn(),
  listener: null as null | ((change: { status: string; productId?: string }) => void),
}))

vi.mock('./pass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pass')>()
  return {
  billingPlatform: () => native.audience === 'normal' ? native.platform : null,
  // The pure halves are the real ones; the platform is always passed in or Apple's.
  passProducts: actual.passProducts,
  planOf: actual.planOf,
  openManageSubscriptions: native.manage,
  readPassStatus: native.status,
  listPassOffers: native.offers,
  buyPass: native.purchase,
  restorePass: async () => ({ status: 'not-entitled' }),
  redeemPassCode: native.redeem,
  onPassChanged: async (listener: typeof native.listener) => {
    native.listener = listener
    return () => { native.listener = null }
  },
  }
})

vi.mock('../build/audience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../build/audience')>()
  return { ...actual, get buildAudience() { return native.audience } }
})

const { listenForPassChanges, purchaseMessages, usePass } = await import('./passStore')

const LIFETIME = 'com.kristofferwithk.cluecabulary.pass.lifetime'
const MONTHLY = 'com.kristofferwithk.cluecabulary.pass.monthly'

beforeEach(() => {
  vi.clearAllMocks()
  native.platform = 'ios'
  native.audience = 'normal'
  native.offers.mockResolvedValue([])
  usePass.setState({ status: 'not-entitled', thanked: false, message: null, offers: [] })
})

describe('the pass store after a payment', () => {
  it('thanks the player once a purchase is verified', async () => {
    native.purchase.mockResolvedValue({ status: 'entitled', productId: LIFETIME })
    await usePass.getState().purchase('lifetime')
    expect(usePass.getState()).toMatchObject({ status: 'entitled', thanked: true, message: null })
    usePass.getState().dismissThanks()
    expect(usePass.getState().thanked).toBe(false)
  })

  it('does not let the foreground refresh after Apple\'s sheet overwrite the purchase', async () => {
    let finishPurchase!: (value: unknown) => void
    native.purchase.mockReturnValue(new Promise((resolve) => { finishPurchase = resolve }))
    // The stream has not caught up with the purchase yet.
    native.status.mockResolvedValue({ status: 'not-entitled' })
    const buying = usePass.getState().purchase('lifetime')
    await usePass.getState().refresh()
    finishPurchase({ status: 'entitled', productId: LIFETIME })
    await buying
    expect(native.status).not.toHaveBeenCalled()
    expect(usePass.getState()).toMatchObject({ status: 'entitled', thanked: true })
  })

  it('does not thank a cancelled purchase or a code sheet closed without a ticket', async () => {
    native.purchase.mockResolvedValue({ status: 'not-entitled', cancelled: true })
    await usePass.getState().purchase('monthly')
    native.redeem.mockResolvedValue({ opened: true, awaited: true })
    await usePass.getState().redeemCode()
    expect(usePass.getState()).toMatchObject({ status: 'not-entitled', thanked: false, message: null })
  })

  it('thanks a redeemed code', async () => {
    native.redeem.mockResolvedValue({ opened: true, status: 'entitled', productId: LIFETIME, awaited: true })
    await usePass.getState().redeemCode()
    expect(usePass.getState()).toMatchObject({ status: 'entitled', thanked: true })
  })

  it('thanks a ticket from the transaction stream only when the player was known not to have one', async () => {
    const stop = listenForPassChanges()
    await Promise.resolve()
    usePass.setState({ status: 'checking' })
    native.listener!({ status: 'entitled', productId: LIFETIME })
    expect(usePass.getState()).toMatchObject({ status: 'entitled', thanked: false })

    usePass.setState({ status: 'not-entitled' })
    native.listener!({ status: 'entitled', productId: LIFETIME })
    expect(usePass.getState()).toMatchObject({ status: 'entitled', thanked: true })
    stop()
  })
})

describe('what the store says, in the store\'s own name', () => {
  it('keeps Apple\'s exact wording on iOS', async () => {
    const { UI } = await import('../i18n')
    expect(purchaseMessages('ios')).toEqual({
      pending: UI.system.passPending,
      error: UI.system.passError,
      notEntitled: UI.system.passNotEntitled,
      restoreError: UI.system.passRestoreError,
    })
  })

  it('names Google Play and never Apple on Android', () => {
    for (const message of Object.values(purchaseMessages('android'))) {
      expect(message).toContain('Google')
      expect(message).not.toMatch(/Apple|App Store|iOS/)
    }
  })

  it('shows the Google Play message after a pending or failed Android purchase', async () => {
    native.platform = 'android'
    native.purchase.mockResolvedValue({ status: 'not-entitled', pending: true })
    await usePass.getState().purchase('monthly')
    expect(usePass.getState()).toMatchObject({ status: 'not-entitled', thanked: false })
    expect(usePass.getState().message).toBe(purchaseMessages('android').pending)
    native.purchase.mockResolvedValue({ status: 'error' })
    await usePass.getState().purchase('lifetime')
    expect(usePass.getState().message).toBe(purchaseMessages('android').error)
  })
})

describe('Your plan in the store', () => {
  it('does not refresh billing from a native open-source build', async () => {
    native.platform = 'android'
    native.audience = 'open-source'
    native.status.mockResolvedValue({ status: 'not-entitled' })

    await usePass.getState().refresh()

    expect(native.status).not.toHaveBeenCalled()
    expect(native.offers).not.toHaveBeenCalled()
    expect(usePass.getState()).toMatchObject({ status: 'not-entitled' })
  })

  it('reads monthly, lifetime and both from what the store owns', async () => {
    const { selectPlan } = await import('./passStore')
    native.status.mockResolvedValue({ status: 'entitled', productId: MONTHLY, ownedProductIds: [MONTHLY] })
    await usePass.getState().refresh()
    expect(selectPlan(usePass.getState(), 'ios')).toBe('monthly')
    native.status.mockResolvedValue({ status: 'entitled', productId: LIFETIME, ownedProductIds: [MONTHLY, LIFETIME] })
    await usePass.getState().refresh()
    expect(selectPlan(usePass.getState(), 'ios')).toBe('both')
    native.status.mockResolvedValue({ status: 'not-entitled' })
    await usePass.getState().refresh()
    expect(selectPlan(usePass.getState(), 'ios')).toBe('free')
    expect(usePass.getState().ownedProductIds).toBeUndefined()
  })

  it('after a switch, still knows the monthly plan runs on when an older native build does not say', async () => {
    const { selectPlan } = await import('./passStore')
    usePass.setState({ status: 'entitled', productId: MONTHLY, ownedProductIds: undefined })
    native.purchase.mockResolvedValue({ status: 'entitled', productId: LIFETIME })
    await usePass.getState().purchase('lifetime')
    expect(usePass.getState()).toMatchObject({ status: 'entitled', productId: LIFETIME, ownedProductIds: [MONTHLY, LIFETIME], thanked: true })
    expect(selectPlan(usePass.getState(), 'ios')).toBe('both')
  })

  it('believes the native list over the guess', async () => {
    usePass.setState({ status: 'entitled', productId: MONTHLY })
    native.purchase.mockResolvedValue({ status: 'entitled', productId: LIFETIME, ownedProductIds: [LIFETIME] })
    await usePass.getState().purchase('lifetime')
    expect(usePass.getState().ownedProductIds).toEqual([LIFETIME])
  })

  it("reads the plan again after Apple's sheet closes, and not after a page opens", async () => {
    native.status.mockResolvedValue({ status: 'not-entitled' })
    native.manage.mockResolvedValue({ opened: true, sheet: true })
    await usePass.getState().manageSubscription()
    expect(native.status).toHaveBeenCalledTimes(1)
    native.manage.mockResolvedValue({ opened: true, sheet: false })
    await usePass.getState().manageSubscription()
    expect(native.status).toHaveBeenCalledTimes(1)
  })
})
