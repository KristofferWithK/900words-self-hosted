// "Your plan" in Settings (store builds only): the Free / Unlimited chip beside
// the title, and the section lower down with Restore, Manage or cancel and
// Switch to one-time purchase.
//
// It fakes a store build in the page the way daily-limit-drive does: a
// Capacitor bridge stub answers the Pass plugin, and the page is made native
// after load. No store is called and nothing is bought; `purchase` is the stub.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const APPLE = { monthly: 'com.kristofferwithk.cluecabulary.pass.monthly', lifetime: 'com.kristofferwithk.cluecabulary.pass.lifetime' }
const PLAY = { monthly: 'pass.monthly', lifetime: 'pass.lifetime' }
const PLAY_SUBSCRIPTION_URL = 'https://play.google.com/store/account/subscriptions?sku=pass.monthly&package=com.kristofferwithk.cluecabulary'

const owned = (ids, plan) => {
  if (plan === 'free') return { entitled: false }
  if (plan === 'lifetime') return { entitled: true, productId: ids.lifetime, ownedProductIds: [ids.lifetime] }
  if (plan === 'both') return { entitled: true, productId: ids.lifetime, ownedProductIds: [ids.monthly, ids.lifetime] }
  return { entitled: true, productId: ids.monthly, ownedProductIds: [ids.monthly] }
}

const preview = await startPreview(4356)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })

/** Settings in a store build on `platform` ('ios' | 'android' | 'web'), with the store holding `plan`. */
async function settings(platform, plan, viewport = { width: 390, height: 844 }, lang = 'en') {
  const ids = platform === 'android' ? PLAY : APPLE
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.addInitScript(({ ids, entitlement, bought, lang }) => {
    localStorage.setItem('cluecab-ui-language', lang)
    window.__calls = []
    window.__owned = entitlement
    window.Capacitor = {
      PluginHeaders: [
        { name: 'Pass', methods: ['status', 'offers', 'purchase', 'restore', 'redeemCode', 'manageSubscriptions'].map((name) => ({ name, rtype: 'promise' })) },
        { name: 'Keyboard', methods: [{ name: 'addListener', rtype: 'promise' }] },
      ],
      nativePromise(plugin, method, options) {
        window.__calls.push(method)
        if (plugin === 'Keyboard') return Promise.resolve({ remove: async () => {} })
        if (method === 'status' || method === 'restore') return Promise.resolve(window.__owned)
        if (method === 'offers') return Promise.resolve({ offers: [
          { id: ids.monthly, displayPrice: '$0.99' },
          { id: ids.lifetime, displayPrice: '$10.99' },
        ] })
        if (method === 'manageSubscriptions') return Promise.resolve({ opened: true, sheet: true })
        if (method === 'purchase' && options?.productId === ids.lifetime) {
          // The stub's answer to the switch: lifetime bought, monthly still renewing.
          window.__owned = bought
          return Promise.resolve(bought)
        }
        return Promise.reject(new Error(`Unexpected ${plugin}.${method}`))
      },
    }
  }, {
    ids,
    entitlement: owned(ids, plan),
    bought: { entitled: true, productId: ids.lifetime, ownedProductIds: [ids.monthly, ids.lifetime] },
    lang,
  })
  await page.goto(`${preview.base}?howto=0`)
  const gear = page.locator('.home-top .icon-btn').first()
  await gear.waitFor()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  // The URL switches have been read; from here this page is a store build.
  await page.evaluate((platform) => {
    if (platform === 'android') window.androidBridge = { postMessage() {} }
    if (platform === 'ios') window.webkit = { messageHandlers: { bridge: { postMessage() {} } } }
  }, platform)
  await gear.click()
  await page.locator('.settings-screen').waitFor()
  const section = page.locator('[data-testid="your-plan-settings"]')
  if (platform !== 'web') {
    await page.waitForFunction(() => !['checking', 'unavailable'].includes(
      document.querySelector('[data-testid="your-plan-settings"]')?.getAttribute('data-plan') ?? 'checking'))
  }
  return { page, section, errors }
}

const expectPlan = async (section, plan) => {
  const shown = await section.getAttribute('data-plan')
  if (shown !== plan) throw new Error(`Your plan shows ${shown}, expected ${plan}`)
}
const expectChip = async (page, label) => {
  const chip = page.locator('.screen-header [data-testid="your-plan-chip"]')
  const text = (await chip.textContent())?.trim()
  if (text !== label) throw new Error(`The chip says ${text}, expected ${label}`)
}
const count = (locator) => locator.count()
const sectionOrder = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.screen-scroll > section')].map((s) => s.getAttribute('data-testid') ?? s.querySelector('h3')?.textContent ?? ''))
const fitsWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

try {
  // A browser build sells nothing: no chip, no section.
  {
    const { page } = await settings('web', 'free')
    if (await count(page.locator('[data-testid="your-plan-settings"], [data-testid="your-plan-chip"]'))) throw new Error('A web build shows Your plan')
    await page.close()
  }

  // iOS, free: the chip, the sentence, the offers at the store's prices with
  // Terms and Privacy, Restore and Apple's code sheet.
  {
    const { page, section, errors } = await settings('ios', 'free', { width: 360, height: 640 })
    await expectPlan(section, 'free')
    await expectChip(page, 'Free')
    await section.getByText('Free plan. Two walks and two café puzzles a day.').waitFor()
    await section.getByRole('button', { name: 'Restore purchases' }).waitFor()
    await section.getByRole('button', { name: 'Redeem an App Store code' }).waitFor()
    if (await count(section.getByText('Manage or cancel subscription'))) throw new Error('A free player is offered Manage')
    await section.getByRole('button', { name: 'Get unlimited play' }).click()
    const offers = await section.textContent()
    if (!offers.includes('$0.99') || !offers.includes('$10.99')) throw new Error('The store\'s prices are not shown')
    for (const name of ['Terms of Use', 'Privacy Policy']) {
      if (await section.getByRole('link', { name, exact: true }).getAttribute('target') !== '_blank') throw new Error(`${name} missing or would navigate the app away`)
    }
    await section.getByRole('button', { name: 'Not now' }).click()
    await section.getByRole('button', { name: 'Get unlimited play' }).waitFor()
    if (!(await fitsWidth(page))) throw new Error('Settings scrolls sideways at 360x640')
    if (errors.length) throw new Error(errors.join('\n'))
    await page.close()
  }

  // iOS, monthly: how it renews, Apple's manage sheet (and a fresh read after
  // it closes), and the switch note before anything is sold.
  {
    const { page, section, errors } = await settings('ios', 'monthly')
    await expectPlan(section, 'monthly')
    await expectChip(page, 'Unlimited')
    await section.getByText('It renews each month until you cancel it.', { exact: false }).waitFor()
    const before = await page.evaluate(() => window.__calls.filter((call) => call === 'status').length)
    await section.getByRole('button', { name: 'Manage or cancel subscription' }).click()
    await page.waitForFunction((n) => window.__calls.includes('manageSubscriptions') && window.__calls.filter((call) => call === 'status').length > n, before)
    await section.getByRole('button', { name: 'Switch to one-time purchase' }).click()
    const note = section.getByRole('group', { name: 'Switch to one-time purchase' })
    await note.getByText('It does not end your monthly subscription.', { exact: false }).waitFor()
    await note.getByText('cancel the monthly subscription in your Apple Account', { exact: false }).waitFor()
    if (await page.evaluate(() => window.__calls.includes('purchase'))) throw new Error('The switch sold something before the note')
    await note.getByRole('button', { name: 'Not now' }).click()
    if (await count(note)) throw new Error('Not now did not close the switch note')
    await section.getByRole('button', { name: 'Switch to one-time purchase' }).click()
    await note.getByRole('button', { name: 'Buy for $10.99' }).click()
    // The stub reports both: the section now asks the player to cancel monthly.
    await page.getByRole('dialog', { name: 'Thank you for supporting the 900words development' }).getByRole('button', { name: 'Keep playing' }).click()
    await page.waitForFunction(() => document.querySelector('[data-testid="your-plan-settings"]')?.getAttribute('data-plan') === 'both')
    await section.getByText('Cancel it so you are not charged again.', { exact: false }).waitFor()
    await section.getByRole('button', { name: 'Manage or cancel subscription' }).waitFor()
    if (await count(section.getByRole('button', { name: 'Switch to one-time purchase' }))) throw new Error('Switch is still offered after the switch')
    if (errors.length) throw new Error(errors.join('\n'))
    await page.close()
  }

  // iOS, lifetime: nothing renews, nothing to manage or switch.
  {
    const { page, section } = await settings('ios', 'lifetime')
    await expectPlan(section, 'lifetime')
    await expectChip(page, 'Unlimited')
    await section.getByText('Unlimited play. One-time purchase. Nothing renews.').waitFor()
    if (await count(section.getByText('Manage or cancel subscription'))) throw new Error('A lifetime owner is offered Manage')
    if (await count(section.getByText('Switch to one-time purchase'))) throw new Error('A lifetime owner is offered Switch')
    await section.getByRole('button', { name: 'Restore purchases' }).waitFor()
    await page.close()
  }

  // iOS, both: the monthly plan is still charging; the way to cancel it is there.
  {
    const { page, section } = await settings('ios', 'both')
    await expectPlan(section, 'both')
    await section.getByText('Your monthly subscription is still active', { exact: false }).waitFor()
    await section.getByRole('button', { name: 'Manage or cancel subscription' }).waitFor()
    await page.close()
  }

  // Android, monthly: Google Play by name, the subscription page as a real
  // link, and Google Play review access still the last thing in Settings.
  {
    const { page, section, errors } = await settings('android', 'monthly', { width: 360, height: 640 })
    await expectPlan(section, 'monthly')
    const manage = section.getByRole('link', { name: 'Manage or cancel subscription' })
    if (await manage.getAttribute('href') !== PLAY_SUBSCRIPTION_URL) throw new Error('Manage does not link Google Play\'s subscription page')
    if (await manage.getAttribute('target') !== '_blank') throw new Error('Manage would navigate the app away')
    await section.getByRole('button', { name: 'Switch to one-time purchase' }).click()
    await section.getByText('cancel the monthly subscription in Google Play', { exact: false }).waitFor()
    if (/Apple|App Store/.test(await section.textContent())) throw new Error('Android names Apple')
    const order = await sectionOrder(page)
    if (order.at(-1) !== 'review-access-settings') throw new Error(`Review access is not last in Settings: ${order.join(' | ')}`)
    if (order.indexOf('your-plan-settings') < 0) throw new Error('No Your plan section')
    if (await page.evaluate(() => window.__calls.includes('manageSubscriptions'))) throw new Error('Android asked the native side to manage')
    if (!(await fitsWidth(page))) throw new Error('Settings scrolls sideways at 360x640')
    if (errors.length) throw new Error(errors.join('\n'))
    await page.close()
  }

  // Android, free and both: no Apple code sheet; the cancel link stays for both.
  {
    const free = await settings('android', 'free')
    await expectChip(free.page, 'Free')
    if (await count(free.section.getByText('Redeem an App Store code'))) throw new Error('Android offers Apple\'s code sheet')
    await free.page.close()
    const both = await settings('android', 'both')
    await expectPlan(both.section, 'both')
    if (await both.section.getByRole('link', { name: 'Manage or cancel subscription' }).getAttribute('href') !== PLAY_SUBSCRIPTION_URL) throw new Error('Both: no Google Play link')
    await both.page.close()
  }

  // The chip shares the header with the title: German has the longest pair
  // ("Einstellungen", "UNBEGRENZT"). Nothing may push the page sideways.
  for (const width of [360, 320]) {
    const { page } = await settings('android', 'monthly', { width, height: 640 }, 'de')
    await page.locator('[data-testid="your-plan-chip"]').waitFor()
    if (!(await fitsWidth(page))) throw new Error(`The German Settings header scrolls sideways at ${width}px`)
    const chip = await page.locator('[data-testid="your-plan-chip"]').boundingBox()
    if (!chip || chip.x + chip.width > width) throw new Error(`The chip runs past the screen edge at ${width}px`)
    await page.close()
  }

  console.log('YOUR PLAN DRIVE OK: chip and section only in store builds; free, monthly, lifetime and both; Apple\'s sheet on iOS and Google Play\'s subscription link on Android; the switch note comes before any purchase and leads to the cancel link; review access stays last')
} finally {
  await browser.close()
  preview.stop()
}
