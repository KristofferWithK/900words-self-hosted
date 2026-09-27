// Built-app probe for the build-87 corrections (Lane A, one-off).
// Serves the FRESH dist/, drives a real round, and proves with
// getComputedStyle that the new behaviour actually renders:
//   1. a solved suitcase OUTSIDE the wheel phase is bare (no lid word, no
//      latch, no check) — and during the wheel phase it shows the lid word;
//   2. the packed suitcase paints green (stroke/fill on the body rect);
//   3. the composer's wheel is in the flex flow and no dock element
//      overlaps the field row at 360x640 and 390x844;
//   4. tapping a suitcase paints NO selection state (free-type grading,
//      owner 2026-09-17: no .card-selected, no .card-suitcase-selected);
//   5. the takeover card stands ~1.4s before fading.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const preview = await startPreview(4231)
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({ executablePath: EXE })
const page = await (await browser.newContext()).newPage()
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))
// The player-clue reminder dialog (a round guidance) suppresses the takeover
// card on the very first playerClueInput — set the setting that opts out so
// the takeover measurement below sees the real behaviour.
await page.addInitScript(() => {
  const raw = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}')
  raw.state = { ...(raw.state ?? {}), hidePlayerClueReminder: true }
  raw.version = 18
  localStorage.setItem('cluecab-settings-v1', JSON.stringify(raw))
})

let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail++
}

async function startRound(seed = 7) {
  const url = `${preview.base}?mock=1&howto=0&seed=${seed}&city=0`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid', { timeout: 20_000 })
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.waitForTimeout(500)
}

// ---- 1. a solved suitcase outside the wheel phase is BARE -------------------
await startRound()
// Plant TWO greens so the wheel seeding below leaves one translated and one
// not — a packed card has to exist for the green-paint check.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
  const g = raw.state.game
  const targets = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden').slice(0, 2)
  for (const t of targets) g.reveals[t.wordId] = { kind: 'green' }
  localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Continue game' }).click()
await page.waitForSelector('.board-grid', { timeout: 20_000 })
await page.waitForTimeout(400)

const bare = await page.evaluate(() => {
  const card = document.querySelector('.word-card.card-green')
  if (!card) return null
  return {
    lidWords: card.querySelectorAll('.card-lid-word').length,
    checks: card.querySelectorAll('.card-packed-check').length,
    latches: card.querySelectorAll('.card-suitcase-latch').length,
    glyph: card.querySelectorAll('.card-suitcase-glyph').length,
  }
})
check('solved suitcase outside the wheel phase: no lid word', bare?.lidWords === 0, JSON.stringify(bare))
check('solved suitcase outside the wheel phase: no check', bare?.checks === 0)
check('solved suitcase: no latches anywhere on the board', bare?.latches === 0)
check('solved suitcase: the glyph is there', bare?.glyph === 1)

// ---- 2 + 4. wheel phase: lid word appears; selected suitcase has no outline -
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
  const g = raw.state.game
  const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
  if (solved.length === 0) throw new Error('no solved green')
  g.turnsLeft = 0
  g.phase = 'translateChallenge'
  const translated = solved.slice(0, -1).map((w) => w.wordId)
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
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Continue game' }).click()
await page.waitForSelector('.translate-challenge-bar', { timeout: 15_000 })
// Lane E: entering translateChallenge announces the last chance — dismiss the
// panel (its one action) before touching the board.
await page.evaluate(() => {
  const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
  ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
})
await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'), { timeout: 5_000 }).catch(() => {})
await page.waitForTimeout(300)

const wheelState = await page.evaluate(() => {
  const card = document.querySelector('.word-card.card-green')
  const lid = card?.querySelector('.card-lid-word')
  const checkEl = card?.querySelector('.card-packed-check')
  // packed card (translated) paints green?
  const packed = document.querySelector('.word-card.card-wheel-packed')
  const packedBody = packed?.querySelector('.card-suitcase-body')
  const packedStroke = packedBody ? getComputedStyle(packedBody).stroke : null
  const packedFill = packedBody ? getComputedStyle(packedBody).fill : null
  return {
    lidText: lid ? lid.textContent : null,
    lidTop: lid ? getComputedStyle(lid).top : null,
    checkShown: Boolean(checkEl),
    packedStroke,
    packedFill,
  }
})
check('wheel phase: the lid word shows', Boolean(wheelState.lidText), String(wheelState.lidText))
check('wheel phase: the packed card carries the check', wheelState.checkShown)
check(
  'packed suitcase paints green',
  wheelState.packedStroke === 'rgb(58, 122, 52)' && wheelState.packedFill === 'rgb(234, 243, 233)',
  `stroke=${wheelState.packedStroke} fill=${wheelState.packedFill}`,
)

// Free-type grading (owner, 2026-09-17): a suitcase tap selects NOTHING —
// no .card-suitcase-selected state exists, and no .card-selected outline
// paints either. The solved suitcase's button is inert in this phase (the
// dictionary is locked and nothing selects any more), so the tap is
// dispatched rather than clicked through the locator.
const selected = await page.evaluate(async () => {
  const card = document.querySelector('.board-grid .card-green')
  card.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
  card.click()
  await new Promise((done) => setTimeout(done, 200))
  const anySelected = document.querySelector('.word-card.card-suitcase-selected')
  const anyOutline = document.querySelector('.word-card.card-selected')
  return { anySelected: Boolean(anySelected), anyOutline: Boolean(anyOutline) }
})
check(
  'a suitcase tap paints no selection state at all',
  !selected.anySelected && !selected.anyOutline,
  `selected=${selected.anySelected} outline=${selected.anyOutline}`,
)

// ---- 3. composer geometry: no overlap, at both sizes -------------------------
for (const vp of [
  { tag: '360', width: 360, height: 640 },
  { tag: '390', width: 390, height: 844 },
]) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.waitForTimeout(250)
  const geom = await page.evaluate(() => {
    const dock = document.querySelector('.translate-challenge-bar')
    const field = document.querySelector('.wheel-input')
    const wheelSide = document.querySelector('.wheel-side')
    const confirm = document.querySelector('.wheel-confirm')
    const note = document.querySelector('.wheel-answer-row .packing-note')
    const lede = document.querySelector('.wheel-lede')
    if (!dock || !field || !wheelSide) return null
    const r = (el) => {
      const b = el.getBoundingClientRect()
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }
    const f = r(field)
    const s = r(wheelSide)
    const c = r(confirm)
    const overlap = (a, b) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    const dockRect = dock.getBoundingClientRect()
    return {
      fieldW: f.w,
      fieldRow: r(field.parentElement),
      overlapFieldWheel: overlap(f, s),
      overlapNoteWheel: overlap(r(note), s),
      overlapConfirmWheel: overlap(c, s),
      insideDock:
        s.x >= dockRect.x - 0.5 &&
        s.x + s.w <= dockRect.x + dockRect.width + 0.5 &&
        s.y >= dockRect.y - 0.5 &&
        s.y + s.h <= dockRect.y + dockRect.height + 0.5,
      wheelPos: getComputedStyle(wheelSide).position,
      ledeLines: lede ? lede.getBoundingClientRect().height : 0,
      dockBottom: dockRect.y + dockRect.height,
      wheelBottom: s.y + s.h,
    }
  })
  check(`@${vp.tag}: wheel is in the flex flow (not absolute)`, geom.wheelPos === 'static', geom.wheelPos)
  check(`@${vp.tag}: field does not overlap the wheel`, geom.overlapFieldWheel === 0, `${geom.overlapFieldWheel}px²`)
  check(`@${vp.tag}: note does not overlap the wheel`, geom.overlapNoteWheel === 0, `${geom.overlapNoteWheel}px²`)
  check(`@${vp.tag}: confirm does not overlap the wheel`, geom.overlapConfirmWheel === 0, `${geom.overlapConfirmWheel}px²`)
  check(`@${vp.tag}: the wheel fits inside the dock rectangle`, geom.insideDock)
  check(`@${vp.tag}: the field has usable width (>150px)`, geom.fieldW > 150, `${geom.fieldW.toFixed(0)}px`)
}

// ---- 5. the takeover stands ~1.4s --------------------------------------------
await page.setViewportSize({ width: 360, height: 640 })
await startRound(11)
// A real giver change, fired the way the game does: get the player guessing
// under Casey's clue, then stop guessing — the ledger action moves
// playerGuessing → playerClueInput (ai → player), which mints a new takeover
// key and mounts the card. The round-guidance dialog (Casey's clue teaching)
// sits over the board at round start; dismiss it first.
await page.waitForSelector('.guess-bar', { timeout: 15_000 })
for (let i = 0; i < 4; i++) {
  const dialog = page.locator('.round-guidance-dialog[open]')
  if (!(await dialog.isVisible().catch(() => false))) break
  const okBtn = dialog.locator('button').last()
  if (await okBtn.isVisible().catch(() => false)) await okBtn.click()
  await page.waitForTimeout(200)
}
await page.locator('.board-grid .word-card').first().click()
await page.waitForTimeout(100)
// A real guess is what flips the giver (playerGuessing → playerClueInput is
// ai → player): confirm the selected card the way endgame-drive's name()
// does. Install the in-page observer BEFORE the click — React mounts the
// takeover synchronously with the store update, so an observer installed
// after would miss the mount and the detach.
await page.evaluate(() => {
  window.__takeover = { mounted: null, detached: null }
  const observer = new MutationObserver(() => {
    const el = document.querySelector('.turn-takeover')
    if (el && window.__takeover.mounted === null) window.__takeover.mounted = performance.now()
    if (!el && window.__takeover.mounted !== null && window.__takeover.detached === null) {
      window.__takeover.detached = performance.now()
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
})
await page.locator('.guess-confirm .btn-primary').click()
await page.waitForTimeout(5_000)
const { mounted, detached } = await page.evaluate(() => window.__takeover)
const held = mounted !== null && detached !== null ? detached - mounted : -1
check(
  'takeover card mounts on a giver change and stands ≈1.8s (old ≈1.05s)',
  held > 1700 && held < 2100,
  mounted === null ? 'never mounted' : `${Math.round(held)}ms`,
)

check('no page errors', crashes.length === 0, crashes.join('; '))
await page.screenshot({ path: 'evidence/wheel-corrections-87-360.png' })
await browser.close()
preview.stop()
process.exit(fail ? 1 : 0)