// One real round against a real model, and a look at what Casey actually says.
//
//   CASEY_BASE_URL=https://your-worker.workers.dev/v1 node e2e/live-drive.mjs
//
// The Worker must already hold its provider credential and model configuration.
//
// This exists because the prompts in src/ai/prompts.ts were written and tuned
// without anyone ever reading a single response. ai-drive.mjs proves the client
// handles whatever a model returns; only this can say whether the clues are any
// good, or whether ollama.com talks to a browser at all.
//
// No credential or model id enters the browser. The output is safe to paste.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE_URL = process.env.CASEY_BASE_URL
if (!BASE_URL) {
  console.log('LIVE DRIVE SKIPPED (no CASEY_BASE_URL)')
  process.exit(0)
}

const PORT = 4188
const preview = await startPreview(PORT)
const BASE = preview.base

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

await page.addInitScript(
  ({ baseUrl }) => {
    localStorage.setItem(
      'cluecab-settings-v1',
      JSON.stringify({
        state: {
          baseUrl,
          clueLanguage: 'en',
          studyPhase: 'never',
          useMock: false,
        },
        version: 11,
      }),
    )
  },
  { baseUrl: BASE_URL },
)

/** Whatever the app is showing as an error, if anything. */
const currentError = async () =>
  (await page.locator('.error-banner').count())
    ? (await page.locator('.error-banner p').textContent()).trim()
    : null

try {
  console.log(`base URL: ${BASE_URL}`)
  console.log('model and key: server-owned\n')

  // first=player: Casey opens by default (2026-09-06); this drive wants the
  // player's clue first so Casey has to guess before he has to invent.
  await page.goto(`${BASE}?howto=0&first=player`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()

  const board = await page.locator('.word-card .card-word').allTextContents()
  console.log(`board: ${board.join(', ')}\n`)

  // Your clue first, so Casey has to guess before he has to invent.
  const clue = process.env.LIVE_CLUE ?? 'hverdag'
  console.log(`you clue: «${clue}» (2)`)
  await page.fill('.clue-input input', clue)
  await page.locator('.clue-input .stepper button').last().click()
  await page.click('.clue-input .btn-primary')

  // Casey guessing, then Casey clueing. A real model is slow; be patient.
  const deadline = Date.now() + 120_000
  let sawGuess = false
  let clueyClue = null
  while (Date.now() < deadline) {
    const err = await currentError()
    if (err) {
      console.log(`\nCLUEY FAILED: ${err}`)
      if (/CORS/i.test(err)) console.log('\nCheck CASEY_BASE_URL and the Worker ALLOWED_ORIGIN setting.')
      process.exitCode = 1
      break
    }
    if (!sawGuess && (await page.locator('.ai-guess-line').count())) {
      const line = (await page.locator('.ai-guess-line').textContent()).replace(/\s+/g, ' ').trim()
      if (line && !/choosing/i.test(line)) {
        console.log(`cluey guesses: ${line}`)
        sawGuess = true
      }
    }
    if (await page.locator('.guess-bar .dock-title').count()) {
      clueyClue = (await page.locator('.guess-bar .dock-title').textContent())
        .replace(/\s+/g, ' ')
        .trim()
      break
    }
    await sleep(1000)
  }

  if (clueyClue) {
    console.log(`\ncluey clues: ${clueyClue}`)
    console.log('\nLIVE DRIVE OK — Casey answered, and the round advanced.')
  } else if (process.exitCode !== 1) {
    console.log('\nLIVE DRIVE TIMED OUT — no answer inside two minutes and no error shown.')
    process.exitCode = 1
  }
} catch (e) {
  console.log('LIVE DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}
