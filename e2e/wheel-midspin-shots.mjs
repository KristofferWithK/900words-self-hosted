// Mid-spin evidence for the Translation Wheel: the ~3s CSS spin window,
// captured at both phone sizes.
//
// Why seeding rather than a live tap: the engine writes `landed` and swaps
// the dock in the same commit — on a win the chooser used to replace the disc
// within one frame (verified by rAF frame sampling), so the spinner's
// .wheel-spinning class never committed after a real click. Build 88 holds
// the chooser back in the store (wheelSpinHold), but seeding remains the
// deterministic way to mount the spinner with the landing already written;
// its effect then runs the real 3s ease-out, which is the window this
// captures.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = 4236
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ reducedMotion: 'no-preference' })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))
const OUT = process.env.SHOT_DIR ?? 'evidence'

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
  // Every open green solved, as a round that reached the challenge carries, so
  // the wheel holds several segments — the one-green seed rendered a disc so
  // degenerate it photographed as an empty ring.
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
  if (!ok) throw new Error('no open green on the deal')
}

async function seedWheel() {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    if (!solved.length) throw new Error('no solved green')
    g.turnsLeft = 0
    g.phase = 'translateChallenge'
    // The landing pre-written: the spinner mounts with the draw already made,
    // so its effect runs the 2.4s ease-out and the shot lands mid-flight.
    g.wheel = {
      segments: solved.map((w) => w.wordId),
      translated: solved.map((w) => w.wordId),
      filled: solved.map((_, i) => i),
      attempts: 0,
      landed: 0,
      result: null,
      spent: null,
    }
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue game' }).click()
  await page.waitForSelector('.wheel-disc', { timeout: 15_000 })
}

try {
  for (const vp of [
    { tag: '360', width: 360, height: 640 },
    { tag: '390', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(200)
    await startRound()
    await seedWheel()
    // No tap: the landing is pre-seeded and the spinner's effect has already
    // started the ease-out by the time .wheel-disc is on screen.
    await page.waitForSelector('.wheel-svg.wheel-spinning', { timeout: 5_000 })
    await page.screenshot({ path: `${OUT}/translate-wheel-mid-spin-${vp.tag}.png` })
    // The seeded landing never wrote a result (the engine writes both together
    // on a real spin), so the disc is still armed: the tap lets the engine
    // commit the draw and the chooser takes over.
    await page.locator('.wheel-disc').click()
    await page.waitForSelector('.wheel-chooser, .city1-review-dialog[open]', { timeout: 15_000 })
    const after = await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      return { result: g.wheel?.result ?? null, phase: g.phase }
    })
    console.log(`${vp.tag}: mid-spin captured, landed result=${after.result} phase=${after.phase}`)
    await page.goto('about:blank')
  }
  if (crashes.length) throw new Error(crashes.join('; '))
  console.log('MID-SPIN SHOTS OK')
} finally {
  await browser.close()
  preview.stop()
}
// Let node flush and exit naturally so every console line lands.