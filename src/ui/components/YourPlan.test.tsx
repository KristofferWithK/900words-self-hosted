import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { capacitor, build } = vi.hoisted(() => ({
  capacitor: {
    platform: 'ios' as 'ios' | 'android' | 'web',
    isNativePlatform: () => capacitor.platform !== 'web',
    getPlatform: () => capacitor.platform,
  },
  build: { audience: 'normal' as string },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

vi.mock('../../build/audience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../build/audience')>()
  return { ...actual, get buildAudience() { return build.audience } }
})

// Server rendering reads zustand's server snapshot, which is always the
// store's INITIAL state ('checking'). These renders read a plain state object
// through the same hook shape instead; selectPlan and the rest are the real ones.
const fake = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('../../purchase/passStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../purchase/passStore')>()
  const usePass = (selector?: (state: unknown) => unknown) => (selector ? selector(fake.state) : fake.state)
  usePass.setState = (patch: Record<string, unknown>) => { fake.state = { ...fake.state, ...patch } }
  usePass.getState = () => fake.state
  return { ...actual, usePass }
})

const { usePass } = await import('../../purchase/passStore')
const { PASS_PRODUCTS, PLAY_PASS_PRODUCTS, PLAY_SUBSCRIPTION_URL } = await import('../../purchase/pass')
const { YourPlanChip, YourPlanSection, yourPlanApplies } = await import('./YourPlan')
const { UI } = await import('../../i18n')

type Plan = 'free' | 'monthly' | 'lifetime' | 'both' | 'error' | 'checking'

function setPlan(plan: Plan, platform: 'ios' | 'android' = 'ios') {
  capacitor.platform = platform
  const products = platform === 'android' ? PLAY_PASS_PRODUCTS : PASS_PRODUCTS
  const offers = [
    { id: products.monthly, displayPrice: '0,99 €' },
    { id: products.lifetime, displayPrice: '10,99 €' },
  ]
  const state = {
    free: { status: 'not-entitled' as const, productId: undefined, ownedProductIds: undefined },
    monthly: { status: 'entitled' as const, productId: products.monthly, ownedProductIds: [products.monthly] },
    lifetime: { status: 'entitled' as const, productId: products.lifetime, ownedProductIds: [products.lifetime] },
    both: { status: 'entitled' as const, productId: products.lifetime, ownedProductIds: [products.monthly, products.lifetime] },
    error: { status: 'error' as const, productId: undefined, ownedProductIds: undefined },
    checking: { status: 'checking' as const, productId: undefined, ownedProductIds: undefined },
  }[plan]
  usePass.setState({ ...state, offers, message: null, thanked: false, refresh: async () => {}, purchase: async () => {}, restore: async () => {}, redeemCode: async () => {}, manageSubscription: async () => {} })
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')

beforeEach(() => {
  build.audience = 'normal'
  setPlan('free')
})

describe('Your plan section in Settings', () => {
  it('free: the plan, the way to unlimited play, Restore and Apple\'s code sheet', () => {
    const html = renderToStaticMarkup(<YourPlanSection />)
    expect(html).toContain('data-plan="free"')
    expect(text(html)).toContain(UI.settings.planFree)
    expect(html).toContain(`>${UI.settings.planGetUnlimited}</span>`)
    expect(html).toContain(`>${UI.home.dailyLimitRestore}</span>`)
    expect(html).toContain(`>${UI.home.passRedeem}</span>`)
    expect(html).not.toContain(UI.settings.planManage)
  })

  it('monthly: how it renews, Manage or cancel, Switch, Restore', () => {
    setPlan('monthly')
    const html = renderToStaticMarkup(<YourPlanSection />)
    expect(text(html)).toContain(UI.settings.planMonthly)
    expect(html).toContain(`>${UI.settings.planManage}</span>`)
    expect(html).toContain(`>${UI.settings.planSwitch}</span>`)
    expect(html).toContain(`>${UI.home.dailyLimitRestore}</span>`)
    expect(html).not.toContain(UI.settings.planGetUnlimited)
  })

  it('lifetime: nothing renews, only Restore', () => {
    setPlan('lifetime')
    const html = renderToStaticMarkup(<YourPlanSection />)
    expect(text(html)).toContain(UI.settings.planLifetime)
    expect(html).not.toContain(UI.settings.planManage)
    expect(html).not.toContain(UI.settings.planSwitch)
    expect(html).toContain(`>${UI.home.dailyLimitRestore}</span>`)
  })

  it('both: says the monthly plan still charges, and offers the way to cancel it', () => {
    setPlan('both')
    const html = renderToStaticMarkup(<YourPlanSection />)
    expect(text(html)).toContain(UI.settings.planBoth)
    expect(html).toContain(UI.settings.planManage)
    expect(html).not.toContain(UI.settings.planSwitch)
  })

  it('error and checking name the store and sell nothing', () => {
    setPlan('error')
    let html = renderToStaticMarkup(<YourPlanSection />)
    expect(text(html)).toContain(UI.settings.planError)
    expect(html).toContain(UI.home.dailyLimitRestore)
    expect(html).not.toContain(UI.settings.planGetUnlimited)
    setPlan('checking')
    html = renderToStaticMarkup(<YourPlanSection />)
    expect(text(html)).toContain(UI.settings.planChecking)
    expect(html).not.toContain('<button')
  })

  it('on Android: Google Play by name, a real link to its subscription page, no Apple code sheet', () => {
    setPlan('monthly', 'android')
    const html = renderToStaticMarkup(<YourPlanSection />)
    expect(html).toContain(`href="${PLAY_SUBSCRIPTION_URL.replace(/&/g, '&amp;')}"`)
    expect(html).toContain('target="_blank"')
    expect(html).not.toMatch(/Apple|App Store/)
    setPlan('free', 'android')
    expect(renderToStaticMarkup(<YourPlanSection />)).not.toContain(UI.home.passRedeem)
    setPlan('error', 'android')
    expect(text(renderToStaticMarkup(<YourPlanSection />))).toContain(UI.settings.planErrorPlay)
  })

  it('is not there at all in a browser build', () => {
    capacitor.platform = 'web'
    expect(renderToStaticMarkup(<YourPlanSection />)).toBe('')
    expect(renderToStaticMarkup(<YourPlanChip />)).toBe('')
  })

  it.each(['ios', 'android'] as const)('is not there in a native open-source %s build', (platform) => {
    build.audience = 'open-source'
    setPlan('free', platform)
    expect(yourPlanApplies()).toBe(false)
    expect(renderToStaticMarkup(<YourPlanSection />)).toBe('')
    expect(renderToStaticMarkup(<YourPlanChip />)).toBe('')
  })
})

describe('the chip beside the Settings title', () => {
  it('says Free or Unlimited, and nothing while the store has not answered', () => {
    const html = renderToStaticMarkup(<YourPlanChip />)
    expect(text(html)).toContain(UI.settings.planFreeShort)
    expect(html).toContain(`aria-label="${UI.settings.planChipAria(UI.settings.planFreeShort)}"`)
    for (const plan of ['monthly', 'lifetime', 'both'] as const) {
      setPlan(plan)
      expect(text(renderToStaticMarkup(<YourPlanChip />))).toContain(UI.settings.planUnlimitedShort)
    }
    setPlan('checking')
    expect(renderToStaticMarkup(<YourPlanChip />)).toBe('')
    setPlan('error')
    expect(renderToStaticMarkup(<YourPlanChip />)).toBe('')
  })
})

describe('the copy', () => {
  it('has no em-dashes and names each store in its own messages, in every catalogue', async () => {
    const { CATALOGUES } = await import('../../i18n')
    for (const [code, catalogue] of Object.entries(CATALOGUES)) {
      const plan = Object.entries(catalogue.settings).filter(([key]) => key.startsWith('plan'))
      expect(plan.length, code).toBe(19)
      for (const [key, value] of plan) {
        const sample = typeof value === 'function' ? (value as (arg: string) => string)('X') : value
        expect(sample, `${code}.${key}`).not.toMatch(/[—–]/)
      }
      for (const key of ['planChecking', 'planError', 'planSwitchNote'] as const) {
        expect(catalogue.settings[key], `${code}.${key}`).toContain('Apple')
        expect(catalogue.settings[`${key}Play`], `${code}.${key}Play`).toContain('Google Play')
        expect(catalogue.settings[`${key}Play`], `${code}.${key}Play`).not.toContain('Apple')
      }
    }
  })
})
