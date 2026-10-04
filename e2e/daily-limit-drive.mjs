import { chromium } from 'playwright'
import { createServer } from 'vite'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const preview = await startPreview(4299)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const source = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let dailyLedger
const now = new Date()
const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
try {
  const load = (id) => source.ssrLoadModule(id)
  const [{ attemptFixture, MATRIX_FIXTURES, settlementFixture }, { acknowledgeEffect, emptySettlementLedger, prepareSettlement }, { prepareLearning }] = await Promise.all([
    load('/src/progression/fixtures.ts'),
    load('/src/progression/settlement.ts'),
    load('/src/srs/settlement.ts'),
  ])
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
// Today's two free runs, as the results sink counts them (CW-04; CW-15 gates them).
const runsLedger = JSON.stringify({ days: { [localDate]: 2 } })
const newPage = async (emptyOffers = false, native = true, { puzzles = true, runs = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
  // The café gate is on (CW-13): this drive's board needs its first café found.
  await page.addInitScript(mergeFirstCafe, seedArgs('da'))
  await page.addInitScript(({ serializedLedger, emptyOffers, runsLedger }) => {
    if (serializedLedger) localStorage.setItem('cluecab-settlement-v1', serializedLedger)
    if (runsLedger) localStorage.setItem('cluecab-daily-runs-v1', runsLedger)
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
  }, { serializedLedger: puzzles ? dailyLedger : null, emptyOffers, runsLedger: runs ? runsLedger : null })
  await page.goto(`${preview.base}?howto=0&seed=1701`)
  // Play is the Café puzzle tag since CW-10; `next` is the state Play stood for.
  await page.locator('.home-play[data-cafe-action="next"]').waitFor()
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
    await page.locator('.home-play[data-cafe-action="next"]').click()
    await page.locator('.game-screen').waitFor()
    if (await page.getByRole('dialog').count()) throw new Error('Self-hosted build showed the App Store popup')
    console.log('SELF-HOSTED DRIVE OK: saved limit does not gate independent build')
  } else {
    // The developer-access button is retired (owner, 2026-09-26): even a
    // store with no offers shows only purchase, restore, code and dismissal.
    const emptyStorePage = await newPage(true)
    await emptyStorePage.locator('.home-play[data-cafe-action="next"]').click()
    await emptyStorePage.getByRole('dialog', { name: 'Keep playing with Casey' }).waitFor()
    if (await emptyStorePage.getByRole('dialog').getByRole('button', { name: /developer access/i }).count()) throw new Error('The retired developer action is still offered')
    await emptyStorePage.getByRole('dialog').getByRole('button', { name: 'Redeem an App Store code' }).waitFor()
    await emptyStorePage.close()

    const page = await newPage()
    await page.locator('.home-play[data-cafe-action="next"]').click()
    await page.getByRole('dialog', { name: 'Keep playing with Casey' }).waitFor()
    const dialog = page.getByRole('dialog')
    if (!(await dialog.textContent()).includes('$0.99') || !(await dialog.textContent()).includes('$10.99')) throw new Error('Localized StoreKit offers not shown')
    if (await page.locator('.game-screen').count()) throw new Error('Third game was dealt')
    // CW-15: the dialog says which limit was reached, and that the walks are still free.
    if (!(await dialog.textContent()).includes('You’ve played two café puzzles today.')) throw new Error('The puzzle limit was not named')
    if (!(await dialog.textContent()).includes('You can still take 2 walks today.')) throw new Error('The walks still free today were not offered')
    const fits = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollHeight <= element.clientHeight
    })
    if (!fits) throw new Error('Popup clips or internally scrolls at 360x640')
    // App Review guideline 3.1.2: the offer links the Terms of Use (EULA) and
    // the privacy policy, and both leave the app rather than replace it.
    for (const [name, href] of [
      ['Terms of Use', 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'],
      ['Privacy Policy', 'https://900words.app/app-privacy/'],
    ]) {
      const link = dialog.getByRole('link', { name, exact: true })
      if (await link.getAttribute('href') !== href) throw new Error(`${name} does not link ${href}`)
      if (await link.getAttribute('target') !== '_blank') throw new Error(`${name} would navigate the app away`)
    }
    if (process.env.DAILY_LIMIT_SCREENSHOT) await page.screenshot({ path: process.env.DAILY_LIMIT_SCREENSHOT, type: 'jpeg', quality: 60 })
    await dialog.getByRole('button', { name: 'Redeem an App Store code' }).click()
    await page.waitForFunction(() => window.__redeemAsked === true)
    if (await page.locator('.pass-thanks-dialog').count()) throw new Error('A code sheet closed without a ticket still thanked the player')
    await dialog.getByRole('button', { name: 'Restore purchases' }).click()
    await dialog.getByText('No travel pass was found for this Apple Account.').waitFor()
    await dialog.getByRole('button', { name: 'Maybe tomorrow' }).click()
    if (await page.getByRole('dialog').count()) throw new Error('Popup did not dismiss')
    await page.locator('.home-play[data-cafe-action="next"]').click()
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
    await page.close()

    // CW-15: the run limit. Two walks used today and no café puzzle: the
    // Sightseeing tag and the train sheet's Catch the train open the dialog
    // (the run limit named, both café puzzles still free) instead of a run.
    const runsPage = await newPage(false, true, { puzzles: false, runs: true })
    const runsDialog = runsPage.getByRole('dialog', { name: 'Keep playing with Casey' })
    await runsPage.locator('.home-tag-sightseeing').click()
    await runsDialog.waitFor()
    if (await runsPage.locator('.run-stage, .home-sheet-sightseeing, .sightseeing-chooser').count()) throw new Error('A run or the walk chooser opened past the run limit')
    const runsText = await runsDialog.textContent()
    if (!runsText.includes('You’ve walked twice today.')) throw new Error('The run limit was not named')
    if (!runsText.includes('You can still play 2 café puzzles today.')) throw new Error('The café puzzles still free today were not offered')
    if (!runsText.includes('$0.99') || !runsText.includes('$10.99')) throw new Error('The run limit dialog lost the store prices')
    for (const name of ['Terms of Use', 'Privacy Policy']) await runsDialog.getByRole('link', { name, exact: true }).waitFor()
    await runsDialog.getByRole('button', { name: 'Restore purchases' }).waitFor()
    const runsFits = await runsDialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollHeight <= element.clientHeight
    })
    if (!runsFits) throw new Error('The run-limit dialog clips or internally scrolls at 360x640')
    await runsDialog.getByRole('button', { name: 'Maybe tomorrow' }).click()
    await runsPage.locator('.home-ticket').click()
    await runsPage.locator('.train-run-catch').click()
    await runsDialog.waitFor()
    if (await runsPage.locator('.run-stage').count()) throw new Error('The train run started past the run limit')
    await runsDialog.getByRole('button', { name: 'Maybe tomorrow' }).click()
    // The café puzzle is still free: the board is dealt.
    await runsPage.locator('.home-play[data-cafe-action="next"]').click()
    await runsPage.locator('.game-screen').waitFor()
    if (await runsPage.getByRole('dialog', { name: 'Keep playing with Casey' }).count()) throw new Error('The run limit blocked a café puzzle')
    await runsPage.close()

    // Both limits: the dialog names both and offers nothing more for today.
    const bothPage = await newPage(false, true, { puzzles: true, runs: true })
    await bothPage.locator('.home-tag-sightseeing').click()
    const bothDialog = bothPage.getByRole('dialog', { name: 'Keep playing with Casey' })
    await bothDialog.waitFor()
    const bothText = await bothDialog.textContent()
    if (!bothText.includes('You’ve walked twice and played two café puzzles today.')) throw new Error('Both limits were not named')
    if (/You can still/.test(bothText)) throw new Error('A spent limit was offered as still free')
    await bothPage.close()
    console.log('DAILY LIMIT DRIVE OK: run limit (Sightseeing, Catch the train) and puzzle limit each named, the other kind offered, both named together;')
    console.log('DAILY LIMIT DRIVE OK: no developer action; Terms of Use and Privacy Policy linked; normal block, dismissal, restore and code sheet intact; a verified purchase thanks the player with a happy Casey and starts the blocked game')
  }
} finally {
  await browser.close()
  preview.stop()
}
