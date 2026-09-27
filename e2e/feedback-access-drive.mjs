// F1's feedback bundle lets an invited tester earn each next city; it does
// not manufacture a StoreKit pass or expose Kristoffer's city-jump control.
// Run it as `BUILD_AUDIENCE=feedback npm run drives feedback-access`.
//
// Since 2026-09-05 the travel pass is off for launch in EVERY build
// (PASS_GATE_ENABLED, src/purchase/pass.ts), so the "no gate" half of this
// drive is true of the normal bundle too; what it still proves on its own is
// the developer-control half, and that a feedback bundle is not broken.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { tapStop } from './map-stops.mjs'

const preview = await startPreview(4272)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failed = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}

try {
  for (let city = 1; city < 8; city += 1) {
    await page.goto(`${preview.base}?mock=1&howto=0&city=${city}&wrapped=100`)
    await page.waitForSelector('.home-screen')
    check(`packed city ${city + 1} has no ticket gate`, await page.locator('.home-pass-button').count() === 0)
    check(`packed city ${city + 1} can board normally`, await page.locator('.train-board').count() === 1)
  }

  await page.goto(`${preview.base}?mock=1&howto=0&city=1&wrapped=100`)
  await page.waitForSelector('.home-screen')
  await page.locator('.train-board').click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}').state?.cityIndex === 2)
  check('boarding preserves sequential travel from Ribe to city three', true)

  // Boarding opens the ride, which deliberately has no app chrome. Reopen
  // Home before inspecting the developer controls in Settings and on the map.
  // The city jump is the playtest switch (Settings, and the map's own
  // "Enable Travel ahead"); a feedback bundle compiles both to nothing.
  await page.goto(`${preview.base}?mock=1&howto=0&city=1&wrapped=100`)
  await page.waitForSelector('.home-screen')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForSelector('.settings-screen')
  check('feedback build cannot reveal Kristoffer’s developer city jump', await page.getByTestId('playtest-travel-settings').count() === 0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForSelector('.home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')
  // The stop a developer build would offer the switch on: the last one ahead.
  await tapStop(page, { matching: '.map-city-ahead', pick: 'last' })
  check('nor the switch for it on the map', await page.locator('.map-playtest').count() === 0)

  // The preceding positive case genuinely packed Ribe, so use a clean profile
  // for the negative case rather than mistaking its real saved suitcase for a
  // feedback bypass.
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${preview.base}?mock=1&howto=0&city=1`)
  await page.waitForSelector('.home-screen')
  check('an unpacked city cannot board in the feedback build', await page.locator('.train-board').count() === 0)
  check('feedback build shows no ticket action for an unpacked city', await page.locator('.home-pass-button').count() === 0)
} catch (error) {
  console.log('FEEDBACK ACCESS DRIVE FAILED:', error.message)
  failed.push('feedback access drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nFEEDBACK ACCESS DRIVE OK')
if (failed.length) process.exitCode = 1
