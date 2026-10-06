// Lane G probe: the bystander strike-through, the won-spin board, and the
// spent-wheel exhaustion — the three endgame changes verified standalone, so
// endgame-drive keeps its proven flow untouched.
//
// 1. STRIKE: seed a bystander against Casey mid-turn, reload, and read the
//    painted card — line-through on the Danish, no beige gradient, no
//    per-side kind class. Verified against BOTH the guessing turn and the
//    clue turn (revert-to-normal).
// 2. WON-SPIN BOARD: seed a won wheel in translateWheel and assert empty
//    suitcases (no lid words), no dimming, a visible key, and the compact
//    chooser dock.
// 3. SPENT WHEEL: seed wheel.spent='ai' and exhaust the round — the finish
//    appears with reason wheel-spent-exhausted, no sudden-death bar.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const PORT = 4200 // startPreview adds DRIVE_PORT_OFFSET itself
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/data/toolchain/playwright-browsers/chromium-1234/chrome-linux64/chrome',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}
const BASE = preview.base

async function startRound(seed = 9) {
  const url = `${BASE}?mock=1&howto=0&seed=${seed}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.city-card')
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid', { timeout: 20_000 })
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.waitForTimeout(400)
}

async function game() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game)
}

async function continueGame() {
  await page.reload()
  await page.getByRole('button', { name: 'Continue game' }).click()
}

try {
  // ---- 1. the strike-through, on the guessing turn and the clue turn --------
  await startRound()
  // Wait for Casey's opening clue (mock answers in a round trip) so the round
  // is in playerGuessing.
  await page.waitForSelector('.guess-bar', { timeout: 15_000 })
  const seeded = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const hidden = g.words.find((w) => g.reveals[w.wordId].kind === 'hidden')
    if (!hidden) return null
    g.reveals[hidden.wordId] = { kind: 'bystander', against: ['ai'] }
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    return hidden.da
  })
  if (!seeded) throw new Error('no hidden word to seed the bystander on')
  await continueGame()
  const { dismissRoundGuidance } = await import('./round-guidance.mjs')
  await dismissRoundGuidance(page)
  await page.waitForSelector('.guess-bar', { timeout: 15_000 })
  const strike = await page.evaluate(() => {
    const hit = [...document.querySelectorAll('.board-grid .word-card')].find((c) =>
      c.classList.contains('card-bystander-struck'),
    )
    if (!hit) return null
    const st = getComputedStyle(hit.querySelector('.card-da'))
    return {
      lineThrough: st.textDecorationLine.includes('line-through'),
      bgImage: getComputedStyle(hit).backgroundImage,
      cls: hit.className,
    }
  })
  check(
    'guessing turn: the burned neutral is struck through',
    strike !== null && strike.lineThrough,
    JSON.stringify(strike),
  )
  check(
    'guessing turn: no beige gradient — a plain white card',
    strike !== null && (!strike.bgImage || strike.bgImage === 'none') &&
      !strike.cls.includes('card-bystander-player') &&
      !strike.cls.includes('card-bystander-ai') &&
      !strike.cls.includes('card-bystander-both'),
    JSON.stringify(strike),
  )
  await page.screenshot({ path: 'evidence/lane-g/strike-guessing-390.png' })

  // The clue turn: the same round continues — the player stops guessing, gives
  // the next clue, and the struck card reverts to a plain revealed card.
  // The Stop button only exists once a guess has been made (made > 0), so make
  // one green guess first; the turn stays alive and the ghost appears.
  const green = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    return g.words.find(
      (w) =>
        g.reveals[w.wordId].kind === 'hidden' &&
        (g.aiKey[w.wordId] === 'green' || g.playerKey[w.wordId] === 'green'),
    )?.da
  })
  await page.locator(`.word-card:has(.card-word:text-is("${green}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForTimeout(400)
  await page.locator('.guess-bar .btn-ghost').first().click()
  await page.waitForSelector('.clue-input', { timeout: 15_000 })
  const reverted = await page.evaluate(() => {
    const hit = [...document.querySelectorAll('.board-grid .word-card')].find((c) =>
      c.classList.contains('card-bystander-struck'),
    )
    const card = [...document.querySelectorAll('.board-grid .word-card')].find((c) =>
      c.querySelector('.card-word')?.textContent === (window.__struckDa ?? ''),
    )
    const target = hit ?? card
    if (!target) return { struckClassGone: true, strike: null, cls: 'none' }
    const st = getComputedStyle(target.querySelector('.card-da'))
    return {
      struckClassGone: !target.classList.contains('card-bystander-struck'),
      strike: st.textDecorationLine.includes('line-through'),
      cls: target.className,
    }
  })
  check(
    'clue turn: the bystander reverts to a plain card — no strike class, no line-through',
    reverted.struckClassGone && !reverted.strike,
    JSON.stringify(reverted),
  )
  await page.screenshot({ path: 'evidence/lane-g/reverted-clue-turn-390.png' })

  // ---- 2. the won-spin board: empty suitcases, key visible, compact chooser -
  await startRound(5)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden')
    const greens = solved.filter(
      (w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green',
    )
    for (const green of greens) g.reveals[green.wordId] = { kind: 'green' }
    const solvedAll = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    g.turnsLeft = 0
    // The state a WON spin leaves: translateWheel with result 'win'. Seeded
    // directly — the engine only moves phase on the events, not on a rehydrate.
    g.phase = 'translateWheel'
    g.wheel = {
      segments: solvedAll.map((w) => w.wordId),
      translated: solvedAll.map((w) => w.wordId),
      filled: solvedAll.map((_, i) => i),
      attempts: 0,
      landed: null,
      result: 'win',
      spent: null,
    }
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
  })
  await continueGame()
  // The translateChallenge entry announces the last chance — dismiss it; the
  // chooser stands behind it.
  await page.waitForSelector('.translate-challenge-bar', { timeout: 15_000 })
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
  })
  await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'), { timeout: 5_000 }).catch(() => {})
  await page.waitForSelector('.wheel-chooser', { timeout: 15_000 })
  const board = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.board-grid .word-card')]
    return {
      lidWords: document.querySelectorAll('.card-lid-word').length,
      dimmed: cards.filter((c) => c.classList.contains('card-dimmed')).length,
      keyFrames: document.querySelectorAll('[class*="mykey-"]').length,
      chooser: !!document.querySelector('.wheel-chooser'),
      chooserButtons: document.querySelectorAll('.wheel-chooser .dock-actions > .btn').length,
    }
  })
  check(
    'won-spin board: empty suitcases, no dim, key visible',
    board.lidWords === 0 && board.dimmed === 0 && board.keyFrames > 0,
    JSON.stringify(board),
  )
  check(
    'won-spin board: the compact chooser dock stands',
    board.chooser && board.chooserButtons === 2,
    JSON.stringify(board),
  )
  await page.screenshot({ path: 'evidence/lane-g/won-spin-board-chooser-390.png' })

  // ---- 3. the spent wheel's next exhaustion ends the round ------------------
  await startRound()
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    g.wheel = {
      segments: solved.map((w) => w.wordId),
      translated: solved.map((w) => w.wordId),
      filled: solved.map((_, i) => i),
      attempts: 0,
      landed: 0,
      result: 'win',
      spent: 'ai',
    }
    g.phase = 'aiClueInput'
    g.turnsLeft = 1
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
  })
  await continueGame()
  await page.waitForSelector('.guess-bar', { timeout: 15_000 })
  const dud = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    return g.words.find(
      (w) =>
        g.reveals[w.wordId].kind === 'hidden' &&
        g.playerKey[w.wordId] !== 'green' &&
        g.aiKey[w.wordId] !== 'green',
    )?.da
  })
  await page.locator(`.word-card:has(.card-word:text-is("${dud}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.city1-review-dialog[open]', { timeout: 15_000 })
  const exhausted = await game()
  check(
    'the spent wheel\'s next exhaustion ends the round — no sudden death',
    exhausted.phase === 'finished' &&
      exhausted.outcome?.result === 'lost' &&
      exhausted.outcome?.reason === 'wheel-spent-exhausted',
    JSON.stringify(exhausted.outcome),
  )
  check(
    'and no sudden-death bar ever showed',
    (await page.locator('.sudden-death-bar').count()) === 0,
  )
  await page.screenshot({ path: 'evidence/lane-g/wheel-spent-exhausted-390.png' })

  if (crashes.length) check('no page errors', false, crashes.join(' | ').slice(0, 200))
  console.log(fail ? `\nFAILED: ${fail.length} check(s)` : '\nLANE G PROBE OK')
  if (fail) process.exitCode = 1
} catch (e) {
  console.log('PROBE FAILED:', e.stack?.split('\n').slice(0, 3).join(' | '))
  await page.screenshot({ path: 'evidence/lane-g/probe-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}