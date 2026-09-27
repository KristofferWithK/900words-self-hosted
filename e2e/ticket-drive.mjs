// The travel pass is OFF for launch (owner, 2026-09-05; PASS_GATE_ENABLED in
// src/purchase/pass.ts). This drive pins what a player sees while it is: every
// packed city boards its train on the web, no pass action anywhere, and Home
// stays one screen tall with the train as a button at every stop.
//
// The paywall's own contract — the approved transport copy, the two price
// shapes, a web price tap granting nothing — is unreachable from the app while
// the switch is off, so it is not asserted here. The version of this file
// before 2026-09-05 (git log -- e2e/ticket-drive.mjs) holds those checks and
// is the drive to restore, updated for the "travel pass" copy, when the
// switch is flipped back.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4271)
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
    await page.waitForSelector('.train-board')
    check(`packed city ${city + 1} boards on the web with no travel pass`,
      (await page.locator('.home-pass-button').count()) === 0 &&
      (await page.locator('.train-board').count()) === 1)
    const layout = await page.evaluate(() => ({ document: document.documentElement.scrollHeight, viewport: innerHeight }))
    check(`and Home stays fixed at 360×640 at city ${city + 1}`, layout.document <= layout.viewport + 1, `${layout.document}/${layout.viewport}`)
  }

  await page.goto(`${preview.base}?mock=1&howto=0&city=1&wrapped=100`)
  await page.waitForSelector('.map-screen, .home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')
  check('the map offers the train on, not a travel pass',
    (await page.getByRole('button', { name: /^Travel on → / }).count()) === 1 &&
    (await page.getByRole('button', { name: /travel pass/i }).count()) === 0)
  check('no copy on Home or the map says "ticket"',
    !/\bticket\b/i.test(await page.evaluate(() => document.body.innerText)))
} catch (error) {
  console.log('TICKET DRIVE FAILED:', error.message)
  failed.push('ticket drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nTICKET DRIVE OK')
if (failed.length) process.exitCode = 1
