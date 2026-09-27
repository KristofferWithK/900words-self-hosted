// P4: the finished-round transcript is a real bottom sheet, and its flags
// still travel into Casey's next prompt. This is deliberately separate from
// the broad smoke drive so a missing log or a fake empty sheet cannot hide in
// unrelated round coverage.
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startFakeOllama, clueReply, guessReply } from './fake-ollama.mjs'
import { startWorker } from './worker-runtime.mjs'

const PORT = 4201
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const FAKE_PORT = 4202
const WORKER_PORT = 4203
const preview = await startPreview(PORT)
const fake = await startFakeOllama(FAKE_PORT + OFFSET)
const casey = await startWorker(WORKER_PORT + OFFSET, {
  upstream: fake.baseUrl,
  apiKey: 'p4-worker-key',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'p4-drive-model' } }) },
})
if (!casey) throw new Error('Miniflare is required for p4-drive')
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
await installRoundGuidanceHandler(page)
const BASE = preview.base
const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

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
  { baseUrl: `${casey.base}/v1` },
)

const gameState = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game)

async function startRound(seed = 41) {
  await page.goto(`${BASE}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-feedback-v1')
  })
  await page.goto(`${BASE}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const game = await gameState()
  return {
    ids: game.words.map((w) => w.wordId),
    aiGreens: Object.entries(game.aiKey)
      .filter(([, role]) => role === 'green')
      .map(([id]) => id),
    playerGreens: Object.entries(game.playerKey)
      .filter(([, role]) => role === 'green')
      .map(([id]) => id),
  }
}

try {
  const round = await startRound()

  // Give the finished round one real clue and one real Casey guess. Then use
  // the existing last-chance route to end it without spending another model
  // request, leaving a non-empty transcript to review.
  // Two player-key greens keep Casey in aiGuessing after the first reveal.
  // That gives the drive a stable instant to persist sudden death before her
  // next automatic clue can start and overwrite the directly edited store.
  fake.queue(guessReply(round.playerGreens.slice(0, 2)))
  await page.fill('.clue-input input', 'huskeliste')
  await page.locator('.clue-input .btn-primary').click()
  await page.waitForFunction(
    () => {
      const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
      return game?.clueHistory?.[0]?.guesses?.length === 1 && game.phase === 'aiGuessing'
    },
    null,
    { timeout: 15000 },
  )
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    raw.state.game.phase = 'suddenDeath'
    raw.state.game.turnsLeft = 0
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    // Reload in the same browser task so an already-started Casey clue cannot
    // persist its old phase over this deterministic fixture in the gap.
    location.reload()
  })
  await page.waitForSelector('.city-card')
  const forced = await gameState()
  check('the transcript fixture reloads in last chance', forced?.phase === 'suddenDeath', forced?.phase)
  await page.getByRole('button', { name: 'Continue game' }).click()
  await page.waitForSelector('.sudden-death-bar')
  const afterGuess = await gameState()
  const dud = afterGuess.words.find(
    (w) =>
      afterGuess.reveals[w.wordId].kind === 'hidden' &&
      afterGuess.playerKey[w.wordId] !== 'green' &&
      afterGuess.aiKey[w.wordId] !== 'green',
  )
  if (!dud) throw new Error('no neutral card remained to create the finished review')
  await page.locator(`.word-card:has(.card-word:text-is("${dud.da}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.round-summary')
  // This round is City 1 and its one player clue found greens, so it finishes
  // into the finish screen — the reader of the owner's approved design of
  // 2026-09-11, and since the owner's follow-up of the same evening the ONE
  // finish surface — with a sentence in it. The transcript link closes that
  // surface's reader; there is no finish state underneath and nothing to
  // skip to (before that follow-up `.log-toggle` was absent until Skip review;
  // before the skip existed this drive stalled thirty seconds waiting for it).
  const finish = page.locator('.city1-review-dialog[open]')
  await finish.waitFor()
  check('the City 1 round finishes into the finish screen, with a sentence to review',
    (await finish.locator('.city1-review-sentence').count()) === 1 && (await page.locator('.round-summary').count()) === 1)

  check('the finished round has a real turn to review', (await finish.locator('.log-toggle').textContent()).includes('1'))
  check('the transcript is not rendered in the finish screen before opening', (await page.locator('.turn-log').count()) === 0)
  check('the old in-summary log body is gone', (await page.locator('.log-body').count()) === 0)

  const before = await page.evaluate(() => {
    const s = document.querySelector('.city1-review-dialog').getBoundingClientRect()
    return {
      height: s.height,
      bottom: s.bottom,
      scrollHeight: document.scrollingElement.scrollHeight,
      innerHeight: window.innerHeight,
    }
  })
  await finish.locator('.log-toggle').click()
  await page.waitForSelector('.turn-log-sheet')
  const after = await page.evaluate(() => {
    const s = document.querySelector('.city1-review-dialog').getBoundingClientRect()
    return {
      height: s.height,
      bottom: s.bottom,
      scrollHeight: document.scrollingElement.scrollHeight,
      innerHeight: window.innerHeight,
      turns: document.querySelectorAll('.turn-log-sheet .turn-log > li').length,
      flags: document.querySelectorAll('.turn-log-sheet .flag-btn').length,
      sheetLog: document.querySelectorAll('.turn-log-sheet .turn-log').length,
    }
  })
  check('the link opens the real bottom sheet', after.sheetLog === 1)
  check('the sheet contains the real turn', after.turns > 0, `${after.turns} turns`)
  check('the sheet contains a flag control for the real call', after.flags > 0, `${after.flags} flags`)
  check('opening it does not change the finish screen', Math.abs(after.height - before.height) <= 1)
  check(
    'opening it does not create document scroll',
    after.scrollHeight <= after.innerHeight + 1,
    `${after.scrollHeight}px of ${after.innerHeight}px`,
  )

  const flag = page.locator('.turn-log-sheet .flag-btn').first()
  await flag.click()
  await sleep(100)
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-feedback-v1') ?? '{}').state?.flags ?? [],
  )
  check('the sheet flag persists the real call', stored.length === 1 && !!stored[0].what)
  check('the flag reports its pressed state', (await flag.getAttribute('aria-pressed')) === 'true')
  await page.locator('.log-close').click()
  await page.waitForSelector('.turn-log-sheet', { state: 'detached' })
  // Leave the round the way a player does. Home dismisses the review, so the
  // fresh Home below offers Play rather than Continue review — a finished
  // round with its review still pending is what Home resumes, by design.
  await finish.getByRole('button', { name: 'Home', exact: true }).click()
  await page.waitForSelector('.city-card')

  // A fresh round starts with Casey's clue. The fake server sees the actual
  // request body, proving the flag survived the sheet and crossed the prompt
  // projection boundary rather than merely changing a local glyph.
  await page.goto(`${BASE}?howto=0&first=ai&seed=42`)
  await page.waitForSelector('.city-card')
  fake.reset()
  fake.queue(clueReply(round.aiGreens.slice(0, 2)))
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await sleep(700)
  const prompt = fake.received.map((r) => r.raw).join('\n')
  check('the next clue request reaches the fake model', fake.received.length > 0)
  check(
    'the next clue request carries the flagged call',
    /CALLS YOUR PARTNER MARKED AS BAD/i.test(prompt) && prompt.includes(stored[0].what),
    stored[0]?.what ?? 'no stored call',
  )

  console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nP4 DRIVE OK')
  if (fail.length) process.exitCode = 1
} catch (e) {
  console.log('P4 DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  await casey.stop()
  await fake.stop()
  preview.stop()
}
