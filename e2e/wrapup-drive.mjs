// Historical wrapped ledger data must no longer create a wrap-up. This is the
// successor to the retired packing drive: it starts with the old query fixture
// and proves that Home and Casey's collection expose only ordinary play.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4200)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failures = []
const external = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith(preview.base) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))

try {
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&collected=40&wrapped=20`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.home-screen')
  check('old wrapped fixture creates no packing dock on Home', await page.locator('.packing-dock').count() === 0)
  check('Home offers no wrap-up action', await page.getByRole('button', { name: /wrap-up/i }).count() === 0)

  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  const collection = page.locator('.casey-board-collection')
  await collection.waitFor()
  await page.waitForSelector('.collection-board-slot')
  const body = await page.locator('.suitcase-screen').innerText()
  check('Casey collection replaces the wrapped compartment', await collection.count() === 1)
  check('collection shows a finite ordinary board page', await page.locator('.collection-board-slot').count() === 10)
  check('collection and word reader contain no retired packing action', !/pack the board|continue wrap-up|wrap-up/i.test(body), body.replace(/\s+/g, ' ').slice(0, 200))
  check('collection has no packing dock', await page.locator('.packing-dock').count() === 0)
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? '.'}/c1-15-retired-wrapup-360.png` })
  check('zero external requests', external.length === 0, external.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nRETIRED WRAP-UP DRIVE OK')
if (failures.length) process.exitCode = 1
