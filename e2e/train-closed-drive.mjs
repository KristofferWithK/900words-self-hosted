// The public City 1 route is closed at launch. A ready player (since CW-07:
// one who caught the train) receives a named release-status message, not a
// disabled or unusable train control.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4325)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const crashes = []
page.on('pageerror', (e) => crashes.push(e.message))
let ok = true
const check = (name, pass, detail = '') => {
  ok &&= pass
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}
try {
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&train=closed`)
  await page.waitForSelector('.home-screen')
  await page.evaluate(() => {
    localStorage.setItem('cluecab-settlement-v1', JSON.stringify({
      schemaVersion: 1,
      facts: {
        boards: {}, firstPrimaryCompletions: {}, milestones: {}, cityAchievements: {},
        legacyCredit: { identity: 'danish-city1-legacy-v1', amount: 100 },
      },
      settlements: {},
    }))
  })
  await page.reload()
  await page.waitForSelector('.home-screen')
  // CW-07: postcards do not travel. A hundred of them and no caught train is
  // not ready: the train run is the only way onto the train.
  check('postcards alone do not make a City 1 player ready to travel',
    await page.locator('.home-progress-status').count() === 0)
  // A caught train (the ticket, seeded by the local ?ticket=1 fixture) is.
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&train=closed&ticket=1`)
  await page.waitForSelector('.home-progress-status')
  const status = await page.locator('.home-progress-status').innerText()
  check('a City 1 player who caught the train is told the next stop is not released',
    /ready to travel.*Ribe.*not released/i.test(status), status)
  check('the closed public route renders progress as a readout, never a train button',
    await page.locator('.train-progress').count() === 1 &&
      await page.locator('.train-board, .ride-screen, .train-notice').count() === 0,
  )
  check('no public boarding action is exposed for the unreleased stop',
    await page.getByRole('button', { name: /board the train|travel on|line closed/i }).count() === 0,
  )
  const layout = await page.evaluate(() => ({ document: document.documentElement.scrollHeight, viewport: innerHeight }))
  check('the closed-route status keeps Home within the phone viewport',
    layout.document <= layout.viewport + 1, `${layout.document}/${layout.viewport}`)

  check('no page errors', crashes.length === 0, crashes.join(' | '))
} catch (e) {
  ok = false
  console.log('FAIL', e.message)
} finally {
  await browser.close()
  preview.stop()
}
console.log(ok ? '\nPASSED' : '\nFAILED')
process.exit(ok ? 0 : 1)
