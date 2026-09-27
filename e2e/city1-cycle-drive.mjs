// City 1's exact required-board identity, verified through the real
// Home -> primary -> pause/resume path. The old cursor cycle and reroll
// deliberately disappeared with the finite primary queue.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = 4215
const preview = await startPreview(PORT)
const boards = JSON.parse(
  readFileSync(resolve('src/data/city1-board-cycle.da.json'), 'utf8'),
).boards

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await installRoundGuidanceHandler(page)
const crashes = []
page.on('pageerror', (error) => crashes.push(String(error)))

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const saved = () => page.evaluate(() => ({
  game: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state,
  sessions: JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da,
}))

async function startPrimary() {
  await page.goto(`${preview.base}?mock=1&howto=0&city=0`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await page.reload()
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  return saved()
}

const greens = (game, key) =>
  game.words
    .filter((word) => game[key][word.wordId] === 'green')
    .map((word) => word.wordId)
    .sort()

try {
  const initial = await startPrimary()
  const primary = initial.sessions?.primary
  const expected = boards.find((board) => board.id === primary?.board?.authoredBoardId)
  check('Home starts one durable primary from the required City 1 set',
    initial.sessions?.activeSlot === 'primary' && !!primary && !!expected,
    JSON.stringify({ active: initial.sessions?.activeSlot, board: primary?.board }),
  )
  check(
    `${expected?.id ?? 'required board'} keeps its exact authored words and both keys`,
    !!expected &&
      JSON.stringify(initial.game.game.words.map((word) => word.wordId)) === JSON.stringify(expected.wordIds) &&
      JSON.stringify(greens(initial.game.game, 'playerKey')) === JSON.stringify([...expected.playerGreenIds].sort()) &&
      JSON.stringify(greens(initial.game.game, 'aiKey')) === JSON.stringify([...expected.aiGreenIds].sort()),
  )
  check('the primary has no reroll control that can skip the required queue',
    await page.locator('.icon-btn[aria-label="Deal new words"]').count() === 0,
  )
  const beforePause = JSON.stringify(primary)
  await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
  await page.getByRole('button', { name: 'Pause game', exact: true }).click()
  await page.waitForSelector('.home-screen')
  check('Home labels the paused slot Continue board',
    await page.locator('.home-play').innerText() === 'Continue board',
  )
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const resumed = await saved()
  check('Continue board resumes the exact durable primary instead of dealing another board',
    JSON.stringify(resumed.sessions?.primary) === beforePause &&
      resumed.sessions?.activeSlot === 'primary' &&
      resumed.game?.attemptId === primary?.attemptId,
  )
  await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
  await page.getByRole('button', { name: 'Cancel round', exact: true }).click()
  await page.waitForSelector('.home-screen')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const restarted = await saved()
  check('cancelling an unplayed primary leaves the same required board next',
    restarted.sessions?.primary?.board?.authoredBoardId === primary?.board?.authoredBoardId,
    JSON.stringify({ before: primary?.board?.authoredBoardId, after: restarted.sessions?.primary?.board?.authoredBoardId }),
  )
  check('no page errors', crashes.length === 0, crashes.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nCITY 1 CYCLE DRIVE OK')
