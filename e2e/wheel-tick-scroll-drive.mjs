// Translation time keeps the board where the player scrolled it. With the
// keyboard up the board becomes its own scrollport, and a player translating
// the bottom row scrolls down to read those lids. Tapping the confirm tick
// used to take focus from the field: nativeKeyboard's focusout read that as
// the keyboard going away, put the page away (kb-up off) and the kb-up
// observer reset the board to the top, so every tick threw the player back
// up (first Android closed-test build, fixed in #343 by cancelling the tick's
// mousedown). This boots the simulated keyboard (cluecab-kbsim, which installs
// the same focusout path the native shell does) straight into a seeded wheel
// and taps the tick for real, the way a thumb does. The last check blurs the
// field on purpose, to prove the reset this guards against is live in the
// build, so a pass above it is not a pass by absence.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = Number(process.env.DRIVE_PORT ?? 4306)
const KEYBOARD_PX = 300
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e-shots'
const SIM_FLAG = 'wheel-tick-scroll-kbsim'
const SEED_KEY = 'wheel-tick-scroll-seed'
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
})
const page = await context.newPage()
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
const failures = []
const errors = []
const check = (label, pass, detail = '') => {
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures.push(label)
}
page.on('pageerror', (error) => errors.push(String(error)))

// The simulated keyboard arms once, at app mount, and waits for a board and a
// dock. It must not be on while the round is being dealt from Home, so it is
// gated on a per-tab flag the drive raises only once the wheel is seeded.
// kbstill stands the finished keyboard state up without the ride transform.
//
// The seeded game rides in the same per-tab storage and is written here,
// before the app boots, on every armed load. Written from the round page
// instead, the round's own pending saves (mock Casey's turn, pagehide) could
// land after it and the reload would come back to an ordinary guessing turn.
await page.addInitScript(({ flag, px, seedKey }) => {
  try {
    if (sessionStorage.getItem(flag) === '1') {
      const seeded = sessionStorage.getItem(seedKey)
      if (seeded) localStorage.setItem('cluecab-game-v1', seeded)
      localStorage.setItem('cluecab-kbsim', String(px))
      localStorage.setItem('cluecab-kbstill', '1')
    } else {
      localStorage.removeItem('cluecab-kbsim')
      localStorage.removeItem('cluecab-kbstill')
    }
  } catch { /* storage blocked: the drive's own checks will say so */ }
}, { flag: SIM_FLAG, px: KEYBOARD_PX, seedKey: SEED_KEY })

let SEEDED = ''
const ROUND_URL = `${preview.base}?mock=1&howto=0&seed=5`

/** A real round, every open green found, then the wheel seeded with nothing
 *  translated yet (wheel-evidence-drive's seeding, translated = []). */
async function seedWheel() {
  await page.goto(ROUND_URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.city-card', { timeout: 20_000 })
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(ROUND_URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.city-card', { timeout: 20_000 })
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid', { timeout: 20_000 })
  // No guidance action here: taking it can start Casey's turn, whose save
  // could land after the seed below and overwrite it before the reload.
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const open = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden')
    const greens = open.filter(
      (w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green',
    )
    for (const green of greens) g.reveals[green.wordId] = { kind: 'green' }
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    if (solved.length === 0) throw new Error('seed 5 dealt no green to put on the wheel')
    g.turnsLeft = 0
    g.phase = 'translateChallenge'
    g.wheel = {
      segments: solved.map((w) => w.wordId),
      translated: [],
      filled: [],
      attempts: 0,
      landed: null,
      result: null,
      spent: null,
    }
    return { seeded: JSON.stringify(raw), count: solved.length }
  })
}

/** Reload with the simulated keyboard on, land in Translation time, focus the
 *  field with a touch tap and scroll the board to its bottom. */
async function armWheel(tag) {
  await page.evaluate(({ flag, seedKey, seeded }) => {
    sessionStorage.setItem(seedKey, seeded)
    sessionStorage.setItem(flag, '1')
  }, { flag: SIM_FLAG, seedKey: SEED_KEY, seeded: SEEDED })
  await page.reload({ waitUntil: 'networkidle' })
  // kbsim opens the game screen itself; a build that does not still offers
  // Continue game on Home.
  await page.waitForSelector('.translate-challenge-bar, .home-play, button:has-text("Continue game")', { timeout: 20_000 })
  if (!(await page.locator('.translate-challenge-bar').isVisible().catch(() => false))) {
    const resume = page.getByRole('button', { name: 'Continue game' })
    if (await resume.isVisible().catch(() => false)) await resume.click()
  }
  await page.waitForSelector('.translate-challenge-bar', { timeout: 15_000 })
  // The Translation time arrival panel: take its action before anything is
  // focused, since its showModal would take focus from the field.
  await page.waitForTimeout(400)
  await dismissRoundGuidance(page)
  await page.waitForSelector('.wheel-input', { state: 'visible', timeout: 15_000 })
  const armed = await page
    .waitForFunction(() => document.documentElement.classList.contains('kb-up'), null, { timeout: 15_000 })
    .then(() => true, () => false)
  check(`[${tag}] simulated keyboard stands up (kb-up on <html>)`, armed)
  await dismissRoundGuidance(page)

  await page.locator('.wheel-input').tap()
  await page.waitForTimeout(150)
  const focused = await page.evaluate(() => ({
    field: document.activeElement?.classList.contains('wheel-input') ?? false,
    active: document.activeElement?.className?.toString() ?? null,
    kbUp: document.documentElement.classList.contains('kb-up'),
  }))
  check(
    `[${tag}] tapping the field focuses it with the keyboard up`,
    focused.field && focused.kbUp,
    JSON.stringify(focused),
  )

  const scroll = await page.evaluate(() => {
    const area = document.querySelector('.game-screen .board-area')
    if (!area) return null
    area.scrollTop = area.scrollHeight
    return { scrollHeight: area.scrollHeight, clientHeight: area.clientHeight }
  })
  await page.waitForTimeout(100)
  const scrollTop = await page.evaluate(() => document.querySelector('.game-screen .board-area')?.scrollTop ?? -1)
  check(
    `[${tag}] keyboard-time board is scrollable and scrolled down`,
    scroll !== null && scroll.scrollHeight > scroll.clientHeight && scrollTop > 0,
    `${JSON.stringify(scroll)}; scrollTop ${scrollTop}`,
  )
  return scrollTop
}

/** A correct answer for the first untranslated found word, while at least
 *  `keep` would remain untranslated after it (so the field stays standing);
 *  otherwise a deliberate miss, which still exercises the submit. */
const answerFor = (keep) => page.evaluate((minLeft) => {
  const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
  const open = g.wheel.segments.filter(
    (id) => g.reveals[id]?.kind === 'green' && !g.wheel.translated.includes(id),
  )
  if (open.length - 1 < minLeft) return { text: 'zzqx', hit: false, open: open.length }
  const word = g.words.find((w) => w.wordId === open[0])
  return { text: word.da, hit: true, open: open.length }
}, keep)

const afterState = () => page.evaluate(() => ({
  scrollTop: document.querySelector('.game-screen .board-area')?.scrollTop ?? -1,
  field: document.activeElement?.classList.contains('wheel-input') ?? false,
  active: document.activeElement?.tagName ?? null,
  kbUp: document.documentElement.classList.contains('kb-up'),
  value: document.querySelector('.wheel-input')?.value ?? null,
  translated: JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game.wheel?.translated.length ?? -1,
}))

try {
  const seed = await seedWheel()
  SEEDED = seed.seeded
  console.log(`seeded wheel: ${seed.count} found word(s), none translated`)

  // ---- 1. the tick ---------------------------------------------------------
  const tickTop = await armWheel('tick')
  const tickAnswer = await answerFor(1)
  await page.keyboard.type(tickAnswer.text)
  const confirm = page.locator('.translate-challenge-bar .wheel-confirm')
  await confirm.waitFor({ state: 'visible', timeout: 5_000 })
  const enabled = await confirm.isEnabled()
  check('[tick] the tick arms on a non-empty field', enabled)
  await confirm.tap()
  await page.waitForTimeout(300)
  const tick = await afterState()
  check(
    '[tick] board keeps its scroll position after the tick',
    tickTop > 0 && Math.abs(tick.scrollTop - tickTop) <= 2,
    `before ${tickTop}, after ${tick.scrollTop}`,
  )
  check('[tick] the field keeps focus after the tick', tick.field, `activeElement ${tick.active}`)
  check('[tick] kb-up stays on <html> after the tick', tick.kbUp)
  check(
    `[tick] the tap still submits (${tickAnswer.hit ? 'hit packs and clears the field' : 'miss keeps the text'})`,
    tickAnswer.hit ? tick.value === '' && tick.translated === 1 : tick.value === tickAnswer.text,
    JSON.stringify({ value: tick.value, translated: tick.translated, open: tickAnswer.open }),
  )

  // ---- 2. Enter, the sanity twin -------------------------------------------
  const enterTop = await armWheel('enter')
  const enterAnswer = await answerFor(1)
  const translatedBefore = (await afterState()).translated
  await page.keyboard.type(enterAnswer.text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const enter = await afterState()
  check(
    '[enter] board keeps its scroll position after Enter',
    enterTop > 0 && Math.abs(enter.scrollTop - enterTop) <= 2,
    `before ${enterTop}, after ${enter.scrollTop}`,
  )
  check('[enter] the field keeps focus after Enter', enter.field, `activeElement ${enter.active}`)
  check('[enter] kb-up stays on <html> after Enter', enter.kbUp)
  check(
    `[enter] Enter submits (${enterAnswer.hit ? 'hit' : 'miss'})`,
    enterAnswer.hit
      ? enter.value === '' && enter.translated === translatedBefore + 1
      : enter.value === enterAnswer.text,
    JSON.stringify({ value: enter.value, translated: enter.translated, before: translatedBefore }),
  )

  // ---- 3. control: losing focus really does reset ---------------------------
  // Without this, a build where the simulated focusout path had gone away
  // would pass both checks above for the wrong reason.
  await page.evaluate(() => {
    const area = document.querySelector('.game-screen .board-area')
    if (area) area.scrollTop = area.scrollHeight
  })
  await page.waitForTimeout(100)
  const controlTop = await page.evaluate(() => document.querySelector('.game-screen .board-area')?.scrollTop ?? -1)
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await page.waitForTimeout(300)
  const control = await afterState()
  check(
    '[control] blurring the field puts the keyboard away and resets the board',
    controlTop > 0 && !control.kbUp && control.scrollTop === 0,
    `scrolled ${controlTop}; after blur ${JSON.stringify({ kbUp: control.kbUp, scrollTop: control.scrollTop })}`,
  )

  check('no app runtime errors during wheel tick scroll drive', errors.length === 0, errors.join(' | '))
  if (failures.length) {
    mkdirSync(SHOT_DIR, { recursive: true })
    await page.screenshot({ path: `${SHOT_DIR}/wheel-tick-scroll-fail.png` }).catch(() => {})
  }
} catch (error) {
  check('drive ran to the end', false, String(error?.stack ?? error))
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: `${SHOT_DIR}/wheel-tick-scroll-crash.png` }).catch(() => {})
} finally {
  await browser.close()
  preview.stop()
}

if (failures.length) {
  console.error(`\n${failures.length} wheel tick scroll regression(s) failed.`)
  process.exitCode = 1
} else {
  console.log('\nAll wheel tick scroll regressions passed.')
}
