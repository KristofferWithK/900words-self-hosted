import { chromium } from 'playwright'
import { createServer } from 'vite'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4299)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const source = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let dailyLedger
try {
  const load = (id) => source.ssrLoadModule(id)
  const [{ attemptFixture, MATRIX_FIXTURES, settlementFixture }, { acknowledgeEffect, emptySettlementLedger, prepareSettlement }, { prepareLearning }] = await Promise.all([
    load('/src/progression/fixtures.ts'),
    load('/src/progression/settlement.ts'),
    load('/src/srs/settlement.ts'),
  ])
  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const game = MATRIX_FIXTURES[5].game
  let ledger = emptySettlementLedger()
  for (const attemptId of ['daily-limit-first', 'daily-limit-second']) {
    const acceptedAt = Date.now()
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId, origin: 'daily' }),
      acceptedAt,
      localDate,
      dailyKey: attemptId,
      continuation: null,
    })
    const prepared = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (prepared.status === 'blocked') throw new Error(`Could not prepare daily-limit drive receipt: ${prepared.reason}`)
    ledger = prepared.ledger
    for (const effect of prepared.receipt.effects) ledger = acknowledgeEffect(ledger, prepared.receipt.receiptId, effect)
  }
  dailyLedger = JSON.stringify(ledger)
} finally {
  await source.close()
}
const newPage = async (emptyOffers = false, native = true) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  await page.addInitScript(({ serializedLedger, emptyOffers }) => {
    localStorage.setItem('cluecab-settlement-v1', serializedLedger)
    window.__paid = false
    window.Capacitor = {
      PluginHeaders: [
        { name: 'Pass', methods: ['status', 'offers', 'purchase', 'restore', 'redeemCode'].map((name) => ({ name, rtype: 'promise' })) },
        { name: 'Keyboard', methods: [{ name: 'addListener', rtype: 'promise' }] },
      ],
      nativePromise(plugin, method) {
        if (plugin === 'Keyboard') return Promise.resolve({ remove: async () => {} })
        if (method === 'status' || method === 'restore') return Promise.resolve({ entitled: window.__paid })
        if (method === 'offers') return Promise.resolve({ offers: emptyOffers ? [] : [
          { id: 'com.kristofferwithk.cluecabulary.pass.monthly', displayPrice: '$0.99' },
          { id: 'com.kristofferwithk.cluecabulary.pass.lifetime', displayPrice: '$10.99' },
        ] })
        if (method === 'redeemCode') { window.__redeemAsked = true; return Promise.resolve({ entitled: false, awaited: true }) }
        if (method === 'purchase') { window.__paid = true; return Promise.resolve({ entitled: true, productId: 'com.kristofferwithk.cluecabulary.pass.lifetime' }) }
        return Promise.reject(new Error(`Unexpected ${plugin}.${method}`))
      },
    }
  }, { serializedLedger: dailyLedger, emptyOffers })
  await page.goto(`${preview.base}?howto=0&seed=1701`)
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  if (native) {
    // Keep the test switches active long enough to seed pendingSeed, then make
    // this page native before the daily gate or StoreKit methods are called.
    await page.evaluate(() => {
      window.webkit = { messageHandlers: { bridge: { postMessage() {} } } }
    })
  }
  return page
}
try {
  if (process.env.OPEN_SOURCE_TEST === '1') {
    const page = await newPage()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.locator('.game-screen').waitFor()
    if (await page.getByRole('dialog').count()) throw new Error('Self-hosted build showed the App Store popup')
    console.log('SELF-HOSTED DRIVE OK: saved limit does not gate independent build')
  } else {
    // The developer-access button is retired (owner, 2026-09-26): even a
    // store with no offers shows only purchase, restore, code and dismissal.
    const emptyStorePage = await newPage(true)
    await emptyStorePage.getByRole('button', { name: 'Play', exact: true }).click()
    await emptyStorePage.getByRole('dialog', { name: 'Keep playing with Casey' }).waitFor()
    if (await emptyStorePage.getByRole('dialog').getByRole('button', { name: /developer access/i }).count()) throw new Error('The retired developer action is still offered')
    await emptyStorePage.getByRole('dialog').getByRole('button', { name: 'Redeem an App Store code' }).waitFor()
    await emptyStorePage.close()

    const page = await newPage()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('dialog', { name: 'Keep playing with Casey' }).waitFor()
    const dialog = page.getByRole('dialog')
    if (!(await dialog.textContent()).includes('$0.99') || !(await dialog.textContent()).includes('$10.99')) throw new Error('Localized StoreKit offers not shown')
    if (await page.locator('.game-screen').count()) throw new Error('Third game was dealt')
    const fits = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollHeight <= element.clientHeight
    })
    if (!fits) throw new Error('Popup clips or internally scrolls at 360x640')
    if (process.env.DAILY_LIMIT_SCREENSHOT) await page.screenshot({ path: process.env.DAILY_LIMIT_SCREENSHOT, type: 'jpeg', quality: 60 })
    await dialog.getByRole('button', { name: 'Redeem an App Store code' }).click()
    await page.waitForFunction(() => window.__redeemAsked === true)
    if (await page.locator('.pass-thanks-dialog').count()) throw new Error('A code sheet closed without a ticket still thanked the player')
    await dialog.getByRole('button', { name: 'Restore purchases' }).click()
    await dialog.getByText('No travel pass was found for this Apple Account.').waitFor()
    await dialog.getByRole('button', { name: 'Maybe tomorrow' }).click()
    if (await page.getByRole('dialog').count()) throw new Error('Popup did not dismiss')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await dialog.waitFor()
    await dialog.getByRole('button', { name: /One-time/ }).click()
    const thanks = page.getByRole('dialog', { name: 'Thank you for supporting the 900words development' })
    await thanks.waitFor()
    if (!(await thanks.locator('.cluey-svg.mood-happy').count())) throw new Error('The thank-you has no happy Casey')
    const thanksFits = await thanks.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollHeight <= element.clientHeight
    })
    if (!thanksFits) throw new Error('Thank-you clips or internally scrolls at 360x640')
    if (process.env.PASS_THANKS_SCREENSHOT) await page.screenshot({ path: process.env.PASS_THANKS_SCREENSHOT, type: 'jpeg', quality: 60 })
    if (await page.getByRole('dialog', { name: 'Keep playing with Casey' }).count()) throw new Error('The purchase dialog came back after a verified purchase')
    await thanks.getByRole('button', { name: 'Keep playing' }).click()
    await page.locator('.game-screen').waitFor()
    if (await page.getByRole('dialog').count()) throw new Error('A dialog stayed open over the game after the thank-you')
    console.log('DAILY LIMIT DRIVE OK: no developer action; normal block, dismissal, restore and code sheet intact; a verified purchase thanks the player with a happy Casey and starts the blocked game')
  }
} finally {
  await browser.close()
  preview.stop()
}
