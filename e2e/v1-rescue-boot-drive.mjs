/**
 * The TestFlight 82/83 white screen, as a regression probe.
 *
 * A device that still carried the old `cluecab-journey-v1` key rehydrated a
 * v2 save clamped to the developed stops — and then App's rescue effect merged
 * the v1 save's FULL-ROUTE cityIndex back in after the clamp, past it. The
 * map drew one stop, the player stood at stop 3, and `points[cityIndex]` was
 * undefined: `here.x` threw on first paint and the app went white.
 *
 * This probe seeds exactly that localStorage (cityIndex 3, banked words, an
 * arrivedAt log 0..3, no rescue marker), boots the BUILT app, and asserts the
 * boot is healthy: no page error, a filled root, the rescue banner present,
 * the map standing at Sønderborg, and the wrapped words recovered.
 */
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4185)
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
  // Seed BEFORE the app runs: addInitScript writes into the (still empty)
  // origin's localStorage ahead of every page script, then loads the app
  // clean — the phone-with-an-old-key scenario, not a page that was already
  // up when the seed landed.
  // Seeded via the CONTEXT's addInitScript, which runs before any page script
  // on every load — including the reload below. (A page-level addInitScript
  // looks equivalent, but a headless-shell Chromium runs those after the
  // page's own scripts, which silently voids the precondition; the context
  // form is the one that reproduces the phone on every browser this repo
  // drives.)
  await page.context().addInitScript(() => {
    localStorage.setItem('cluecab-ui-language', 'en')
    localStorage.setItem('cluecab-journey-v1',
      JSON.stringify({
        state: {
          cityIndex: 3,
          banked: { hus: 1, kat: 2 },
          stamps: {},
          trialsSpent: {},
          arrivedAt: { 0: 100, 1: 200, 2: 300, 3: 400 },
        },
      }))
    // The device has seen the rules, so the boot lands on Home, not the
    // first-run ticket: the screen that went white.
    localStorage.setItem('cluecab-howto-v4', 'seen')
  })
  await page.goto(preview.base)
  await page.waitForSelector('.home-screen', { timeout: 10_000 })

  check('no page errors on boot', crashes.length === 0, crashes.join(' | '))
  check(
    'the root is filled',
    await page.evaluate(() => document.getElementById('root').childElementCount > 0),
  )
  const journey = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}').state,
  )
  // The City-1 clamp is absolute: the rescue merged the words and left the
  // position at Sønderborg, its travel log pruned to the developed stops.
  check('the rescued position stands at Sønderborg', journey?.cityIndex === 0, JSON.stringify(journey?.cityIndex))
  check('the travel log is pruned to the developed stops', JSON.stringify(journey?.arrivedAt) === '{"0":100}', JSON.stringify(journey?.arrivedAt))
  check('the wrapped words were recovered', JSON.stringify(journey?.wrapped) === '{"hus":1,"kat":2}', JSON.stringify(journey?.wrapped))
  check('the device is marked rescued', await page.evaluate(() => localStorage.getItem('cluecab-journey-rescued-v1') !== null))

  // The player-visible surfaces: the rescue banner, and the map.
  check('the rescue banner tells the player', (await page.locator('.update-banner').count()) === 1)
  await page.locator('.map-button').click()
  await page.waitForSelector('.denmark-map', { timeout: 5000 })
  // MapScreen labels every drawn stop; the current one carries .map-city-current.
  check('the map opens standing at Sønderborg', await page.evaluate(() => {
    const here = document.querySelector('.map-city-current .map-label')
    return here?.textContent === 'Sønderborg'
  }))

  // A second load: the rescue is once-per-device, and a healthy boot stays
  // healthy without it.
  await page.goto(preview.base)
  await page.waitForSelector('.home-screen', { timeout: 10_000 })
  check('no page errors after a reload with the marker set', crashes.length === 0, crashes.join(' | '))
} catch (e) {
  ok = false
  console.log('FAIL', e.message)
} finally {
  await browser.close()
  preview.stop()
}
console.log(ok ? '\nPASSED' : '\nFAILED')
process.exit(ok ? 0 : 1)