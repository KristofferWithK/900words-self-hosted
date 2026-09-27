import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  status: vi.fn(),
  purchase: vi.fn(),
  redeem: vi.fn(),
  listener: null as null | ((change: { status: string; productId?: string }) => void),
}))

vi.mock('./pass', () => ({
  readPassStatus: native.status,
  listPassOffers: async () => [],
  buyPass: native.purchase,
  restorePass: async () => ({ status: 'not-entitled' }),
  redeemPassCode: native.redeem,
  onPassChanged: async (listener: typeof native.listener) => {
    native.listener = listener
    return () => { native.listener = null }
  },
}))

const { listenForPassChanges, usePass } = await import('./passStore')

const LIFETIME = 'com.kristofferwithk.cluecabulary.pass.lifetime'

beforeEach(() => {
  vi.clearAllMocks()
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
