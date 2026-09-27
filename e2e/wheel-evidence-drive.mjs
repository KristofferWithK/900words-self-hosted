// Evidence capture for the Translation Wheel (owner, 2026-09-16; refreshed
// for the build-88 last-chance polish).
//
// The evidence set has to show the player's actual surfaces, not a fixture:
// the challenge dock while it asks, the wheel mid-spin (the ~3s CSS ease-out
// window after a tap), and the result — the chooser on a win.
// Each surface is captured at both phone sizes the no-scroll gates use,
// 360x640 and 390x844. The seeding is the drive's own forceWheel: the board
// is written straight into the persisted game, every segment pre-translated,
// so the wheel stands ready with no recall luck involved.
//
// The last-chance arrival pop-up (build 88) opens with the challenge; the
// round-guidance handler takes its action wherever it would otherwise
// intercept a tap.
//
// Mid-spin: the store applies SPIN_WHEEL synchronously and WheelSpinner then
// animates toward the landing for 3000ms (.wheel-spinning on the svg), so a
// shot taken inside that window is genuinely mid-flight. The challenge dock
// and the miss path are captured the honest way: one segment left untyped,
// typed and submitted for real.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = 4230
const OUT = process.env.SHOT_DIR ?? 'evidence'
const preview = await startPreview(PORT)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage()
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))
await installRoundGuidanceHandler(page)

async function seedWheel(keepOneUntranslated) {
  await page.evaluate((keepOne) => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    if (solved.length === 0) throw new Error('seeding needs at least one solved green')
    g.turnsLeft = 0
    g.phase = 'translateChallenge'
    const translated = keepOne ? solved.slice(0, -1).map((w) => w.wordId) : solved.map((w) => w.wordId)
    g.wheel = {
      segments: solved.map((w) => w.wordId),
      translated,
      filled: translated.map((_, i) => i),
      attempts: 0,
      landed: null,
      result: null,
      spent: null,
    }
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
  }, keepOneUntranslated)
  await page.reload()
  await page.getByRole('button', { name: 'Continue game' }).click()
}

async function startRound(seed = 5) {
  const url = `${preview.base}?mock=1&howto=0&seed=${seed}`
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  // Every open green solved, exactly as a round that reached the challenge
  // would carry: the wheel then holds several segments, not the one-segment
  // degenerate disc the first capture seeded (which rendered as an empty ring).
  const ok = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const open = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden')
    const greens = open.filter(
      (w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green',
    )
    if (greens.length === 0) return false
    for (const green of greens) g.reveals[green.wordId] = { kind: 'green' }
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    return greens.length
  })
  if (!ok) throw new Error('seed 5 dealt no open green')
}

const viewports = [
  { tag: '360', width: 360, height: 640 },
  { tag: '390', width: 390, height: 844 },
]

const done = []
try {
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(200)

    // The challenge dock: one suitcase left, the prompt live on screen.
    await startRound()
    await seedWheel(true)
    // The arrival pop-up (build 88) stands over the board until its action is
    // taken; the tap-flow below needs the board clear.
    await dismissRoundGuidance(page)
    await page.waitForSelector('.translate-challenge-bar', { timeout: 15_000 })
    await page.waitForSelector('.wheel-input', { timeout: 15_000 })
    await page.screenshot({
      path: `${OUT}/translate-wheel-challenge-dock-${vp.tag}.png`,
    })

    // Finish the challenge for real — type the last suitcase and submit — so
    // the wheel appears the way the player's own typing brings it.
    // Free-type grading (owner, 2026-09-17): no tap first — the field grades
    // against every untranslated wheel word on submit. Type and submit; the
    // confirm tick arms on a non-empty field alone.
    const answer = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const g = raw.state.game
      const targetId = g.wheel.segments.find((id) => !g.wheel.translated.includes(id))
      const w = g.words.find((x) => x.wordId === targetId)
      return { da: w.da }
    })
    await page.locator('.wheel-input').fill(answer.da)
    await page.locator('.translate-challenge-bar .wheel-confirm').click()
    await page.waitForSelector('.wheel-disc', { timeout: 15_000 })
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/translate-wheel-filled-${vp.tag}.png` })

    // Mid-spin: tap, then shoot inside the 2.4s CSS window.
    await page.locator('.wheel-disc').click()
    await page
      .waitForSelector('.wheel-svg.wheel-spinning, .wheel-chooser, .city1-review-dialog[open]', {
        timeout: 15_000,
      })
      .then(async (el) => {
        const cls = await el.evaluate((node) => node.className)
        if (String(cls).includes('wheel-spinning')) {
          // Genuinely spinning: shoot now, then wait for the landing.
          await page.screenshot({ path: `${OUT}/translate-wheel-mid-spin-${vp.tag}.png` })
        }
        await page.waitForSelector('.wheel-chooser, .city1-review-dialog[open]', { timeout: 15_000 })
      })
    const after = await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      return { result: g.wheel?.result ?? null, phase: g.phase }
    })
    if (after.result === 'win') {
      await page.screenshot({ path: `${OUT}/translate-wheel-chooser-${vp.tag}.png` })
    } else {
      await page.screenshot({ path: `${OUT}/translate-wheel-miss-${vp.tag}.png` })
    }
    done.push(`${vp.tag}: challenge dock, filled wheel, spin, result (${after.result})`)
  }

  if (crashes.length > 0) throw new Error(`page errors: ${crashes.join('; ')}`)
  console.log(`WHEEL EVIDENCE OK — ${done.join(' | ')}`)
} finally {
  await browser.close()
  preview.stop()
  process.exit(process.exitCode ?? 0)
}