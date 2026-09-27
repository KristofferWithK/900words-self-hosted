// The developer bundle is the only production flavor that exposes Kristoffer's
// labelled city-jump control. It is deliberately distinct from feedback.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { tapStop } from './map-stops.mjs'

const preview = await startPreview(4273)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failed = []
const check = (name, ok) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`)
  if (!ok) failed.push(name)
}
const stored = (key) => page.evaluate((name) => JSON.parse(localStorage.getItem(name) ?? '{}').state, key)

try {
  await page.goto(`${preview.base}?mock=1&howto=0`)
  await page.waitForSelector('.home-screen')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.waitForSelector('.settings-screen')
  const control = page.getByTestId('playtest-travel-settings')
  check('developer build exposes the labelled TestFlight playtest control', await control.count() === 1)
  check('developer control remains an explicit opt-in', await control.getByRole('checkbox').isChecked() === false)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForSelector('.home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')
  // A tap on the map, at the last stop's dot — the gesture the player makes.
  await tapStop(page, { matching: '.map-city-ahead', pick: 'last' })

  // ---- the switch is where the button it reveals will be -----------------
  //
  // Opting in still lives in Settings, and Settings is three screens from the
  // stop being looked at: a developer build that had never been opted into
  // showed one button here and no hint that a second existed, which read as
  // Travel ahead being broken rather than switched off. So the stop offers the
  // switch, and pressing it puts Travel ahead in its place — same row, same
  // width, nothing else moves.
  check('a developer who has not opted in is offered the switch, not a dead end',
    (await page.getByRole('button', { name: 'Enable Travel ahead' }).count()) === 1 &&
    (await page.getByRole('button', { name: 'Travel ahead', exact: true }).count()) === 0)
  await page.getByRole('button', { name: 'Enable Travel ahead' }).click()
  await page.waitForTimeout(150)
  check('pressing it puts Travel ahead in its place and takes itself away',
    (await page.getByRole('button', { name: 'Travel ahead', exact: true }).count()) === 1 &&
    (await page.getByRole('button', { name: 'Enable Travel ahead' }).count()) === 0)
  check('and the switch it threw is the Settings one, so it survives a relaunch',
    (await stored('cluecab-settings-v1')).playtestTravel === true)

  check('an opted-in developer gets Look ahead and Travel ahead side by side',
    await page.locator('.map-city-actions').filter({ has: page.getByRole('button', { name: 'Look ahead' }) }).getByRole('button').count() === 2)
  const actionLayout = await page.locator('.map-city-actions').filter({ has: page.getByRole('button', { name: 'Look ahead' }) }).evaluate((row) => {
    const bounds = row.getBoundingClientRect()
    const buttons = [...row.querySelectorAll('button')].map((button) => button.getBoundingClientRect())
    return {
      sameRow: buttons.length === 2 && Math.abs(buttons[0].top - buttons[1].top) < 1,
      contained: buttons.every((button) => button.left >= bounds.left - 1 && button.right <= bounds.right + 1),
      documentFits: document.scrollingElement.scrollHeight <= innerHeight + 1,
    }
  })
  check('the two map actions share one contained row at 360×640',
    actionLayout.sameRow && actionLayout.contained && actionLayout.documentFits)
  await page.getByRole('button', { name: 'Travel ahead' }).click()
  await page.waitForSelector('.game-screen')
  const journey = await stored('cluecab-journey-v2')
  const game = await stored('cluecab-game-v1')
  check('Travel ahead moves the journey to the selected city', journey.cityIndex === 8)
  check('Travel ahead immediately deals that city’s board', game.boardCityIndex === 8)
} catch (error) {
  console.log('DEVELOPER ACCESS DRIVE FAILED:', error.message)
  failed.push('developer access drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nDEVELOPER ACCESS DRIVE OK')
if (failed.length) process.exitCode = 1
