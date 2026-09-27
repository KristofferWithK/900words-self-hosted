// Lane F free-type probe (owner, 2026-09-17). Serves the FRESH dist/ and
// proves with real interaction + getComputedStyle:
//   1. typing a correct Danish word with NO prior tap packs the suitcase —
//      the click sound plays (HTMLMediaElement.play spied), the wheel gains
//      a segment fill, the field is cleared, and the packed card shows the
//      green drawing + check;
//   2. the packed suitcase shows NO outer box: the card's computed border is
//      transparent, its outline style none, no transform (no scale-up), and
//      no selection class exists anywhere on the board;
//   3. a wrong answer is a miss: the error blip fires (play count of the
//      miss path is not asserted here — the shake class + kept text are),
//      the retry line shows, and the typed text STAYS so it is correctable;
//   4. the confirm tick arms on a non-empty field alone — no tap needed.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const PORT = 4245 + OFFSET
const preview = await startPreview(PORT)
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({ executablePath: EXE })
const page = await (await browser.newContext({ reducedMotion: 'no-preference' })).newPage()
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))
// Spy on every media play BEFORE the app boots: the suitcase click sound
// (playWord) and the error blip both ride HTMLMediaElement.
await page.addInitScript(() => {
  window.__plays = []
  const orig = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__plays.push(this.src ?? String(this.currentSrc ?? ''))
    return orig.apply(this, args)
  }
})

let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail++
}

async function seedWheelChallenge({ keepOneUntranslated = true, seed = 5 } = {}) {
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
  await page.evaluate((keepOne) => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const open = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden')
    const greens = open.filter(
      (w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green',
    )
    for (const green of greens) g.reveals[green.wordId] = { kind: 'green' }
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
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
  await page.waitForSelector('.translate-challenge-bar', { timeout: 15_000 })
  // The arrival pop-up stands over the board until its action is taken.
  await page.waitForSelector('dialog.round-guidance-dialog[open]', { timeout: 10_000 })
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
  })
  await page.waitForFunction(
    () => !document.querySelector('dialog.round-guidance-dialog[open]') && !!document.querySelector('.wheel-input'),
  )
}

try {
  await page.setViewportSize({ width: 360, height: 640 })
  await seedWheelChallenge({ keepOneUntranslated: true })

  // ---- 4. the tick arms on a non-empty field alone --------------------------
  const armed = await page.evaluate(() => {
    const confirm = document.querySelector('.wheel-confirm')
    return { disabled: confirm?.disabled ?? null }
  })
  check('the confirm tick is disabled on an empty field', armed.disabled === true)
  // React 19 tracks the value through its own synthetic event system: setting
  // .value directly is ignored by the controlled input unless the native
  // setter is invoked, so drive it the way a real keystroke does.
  const afterType = await page.evaluate(() => {
    const input = document.querySelector('.wheel-input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'x')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return document.querySelector('.wheel-confirm')?.disabled ?? null
  })
  check('the confirm tick arms on ANY non-empty text — no tap needed', afterType === false)
  await page.evaluate(() => {
    const input = document.querySelector('.wheel-input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // ---- 1. free-type hit: type the Danish, no tap, submit --------------------
  const before = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    return {
      translated: g.wheel.translated.length,
      filled: g.wheel.filled.length,
      plays: window.__plays.length,
    }
  })
  const target = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    const id = g.wheel.segments.find((x) => !g.wheel.translated.includes(x))
    return g.words.find((w) => w.wordId === id).da
  })
  await page.locator('.wheel-input').fill(target)
  await page.locator('.translate-challenge-bar .wheel-confirm').click()
  await page.waitForTimeout(400)
  const hit = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    const input = document.querySelector('.wheel-input')
    return {
      translated: g.wheel.translated.length,
      filled: g.wheel.filled.length,
      plays: window.__plays.length,
      fieldValue: input.value,
      shake: input.classList.contains('wheel-miss-shake'),
      note: document.querySelector('.wheel-answer-row .packing-note')?.textContent ?? '',
    }
  })
  check(
    `typing "${target}" with NO prior tap packs the suitcase`,
    hit.translated === before.translated + 1,
    `translated ${before.translated} -> ${hit.translated}`,
  )
  check('a wheel segment fills on the hit', hit.filled === before.filled + 1)
  check('the suitcase click sound plays on the hit', hit.plays > before.plays, `${hit.plays - before.plays} play(s)`)
  check('the field clears on the hit', hit.fieldValue === '', `"${hit.fieldValue}"`)
  check('no miss shake on the hit', !hit.shake)
  check('no retry line on the hit', !hit.note.trim(), hit.note)

  // ---- 2. the packed suitcase wears no outer box ----------------------------
  const packed = await page.evaluate(() => {
    const card = document.querySelector('.word-card.card-wheel-packed')
    if (!card) return null
    const cs = getComputedStyle(card)
    return {
      classes: card.className,
      borderStyle: cs.borderStyle,
      borderColor: cs.borderColor,
      outlineStyle: cs.outlineStyle,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      bodyStroke: getComputedStyle(card.querySelector('.card-suitcase-body')).stroke,
      check: Boolean(card.querySelector('.card-packed-check')),
    }
  })
  check('the packed suitcase card exists', Boolean(packed))
  check(
    'packed card: green drawing kept (deep-green body stroke)',
    packed?.bodyStroke === 'rgb(58, 122, 52)',
    packed?.bodyStroke ?? '',
  )
  check('packed card: the check shows', packed?.check === true)
  check(
    'packed card: NO outer box — card border transparent, outline none, no shadow',
    packed?.borderColor === 'rgba(0, 0, 0, 0)' &&
      packed?.outlineStyle === 'none' &&
      (packed?.boxShadow === 'none' || packed?.boxShadow === ''),
    `border=${packed?.borderColor} outline=${packed?.outlineStyle} shadow=${packed?.boxShadow}`,
  )
  check(
    'packed card: no scale-up transform',
    packed?.transform === 'none' || packed?.transform === 'matrix(1, 0, 0, 1, 0, 0)',
    packed?.transform ?? '',
  )
  const noSelectionAnywhere = await page.evaluate(
    () =>
      !document.querySelector('.card-suitcase-selected') &&
      !document.querySelector('.card-selected') &&
      !document.querySelector('.card-wheel-selectable'),
  )
  check('no selection machinery on the board at all', noSelectionAnywhere)

  // ---- 3. a miss keeps the text and shows the retry line --------------------
  await page.locator('.wheel-input').fill('zzzzq')
  await page.locator('.translate-challenge-bar .wheel-confirm').click()
  await page.waitForTimeout(400)
  const miss = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    const input = document.querySelector('.wheel-input')
    return {
      translated: g.wheel.translated.length,
      fieldValue: input.value,
      shake: input.classList.contains('wheel-miss-shake'),
      note: document.querySelector('.wheel-answer-row .packing-note')?.textContent ?? '',
    }
  })
  check('the miss packs nothing', miss.translated === hit.translated)
  check('the miss KEEPS the typed text (correctable)', miss.fieldValue === 'zzzzq', `"${miss.fieldValue}"`)
  check('the miss shakes the field', miss.shake)
  check('the miss shows the retry line', miss.note.trim().length > 0, miss.note.trim())
  await page.screenshot({ path: 'evidence/lane-f/free-type-miss-360.png' })

  // Evidence shot of the packed, box-free board after the real free-type hit.
  await page.screenshot({ path: 'evidence/lane-f/free-type-packed-360.png' })

  if (crashes.length) check('no page errors', false, crashes.join(' | ').slice(0, 200))
  console.log(fail ? `\nFAILED: ${fail} check(s)` : '\nLANE F FREE-TYPE PROBE OK')
  if (fail) process.exitCode = 1
} catch (e) {
  console.log('PROBE FAILED:', e.stack?.split('\n').slice(0, 3).join(' | '))
  await page.screenshot({ path: 'evidence/lane-f/free-type-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}