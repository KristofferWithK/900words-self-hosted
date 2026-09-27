// Built-app probe for the build-88 last-chance polish (Lane E, one-off).
// Serves the FRESH dist/ and proves with getComputedStyle / instrumentation
// that the five corrections actually render:
//   1. entering translateChallenge pops the last-chance guidance panel with
//      the wheel sentence (and dismissal records lastChance);
//   2. non-suitcase cards carry .card-dimmed during the wheel phase, the
//      packed suitcase does not;
//   3. a suitcase tap in the wheel phase calls playWord ZERO times (spied);
//   4. the wheel visibly spins >=2.8s to its landing on a WIN and on a MISS;
//   5. the composer's focus ring is unclipped at 360px, keyboard-open sized.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const PORT = 4237
const preview = await startPreview(PORT)
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({ executablePath: EXE })
const page = await (await browser.newContext({ reducedMotion: 'no-preference' })).newPage()
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))
// Instrument playWord BEFORE the app boots: the module reads at import time,
// so the spy has to be on the prototype path the board uses. The board's tap
// handler calls `playWord` from src/ui/speak.ts, which routes through the
// player's `playWord` port — instrumenting at this layer counts real plays.
await page.addInitScript(() => {
  window.__playWordCalls = []
  const origPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__playWordCalls.push(this.src ?? String(this.currentSrc ?? ''))
    return origPlay.apply(this, args)
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
}

try {
  // ---- 1. the arrival pop-up -------------------------------------------------
  await page.setViewportSize({ width: 360, height: 640 })
  await seedWheelChallenge()
  await page.waitForSelector('dialog.round-guidance-dialog[open]', { timeout: 10_000 })
  const popup = await page.evaluate(() => document.querySelector('dialog.round-guidance-dialog[open]')?.innerText ?? '')
  check('entering translateChallenge pops the guidance panel', true)
  check('the panel is the last-chance one', popup.includes('Last Chance'), popup.split('\n')[0])
  check(
    'the panel says the wheel sentence, not the sudden-death rule',
    popup.includes('Spin the wheel for the chance') && !popup.includes('one wrong guess and you lose'),
  )
  await page.screenshot({ path: 'evidence/lastchance-polish/popup-arrival-360.png' })
  // Dismissal records itself, and a second announcement does not re-open.
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    const button = [...(dialog?.querySelectorAll('button') ?? [])].at(-1)
    button?.click()
  })
  await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'))
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.roundGuidance.lastChance)
  check('dismissal records lastChance=dismissed', record === 'dismissed', String(record))
  await page.waitForTimeout(300)
  const quiet = await page.evaluate(() => !!document.querySelector('dialog.round-guidance-dialog[open]'))
  check('the panel fires once per round', !quiet)
  // The no-wheel sudden death keeps the original copy: force the phase.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    raw.state.game.phase = 'suddenDeath'
    raw.state.game.turnsLeft = 0
    raw.state.game.wheel = { ...raw.state.game.wheel, spent: 'player' }
    raw.state.roundGuidance.lastChance = 'pending'
    localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue game' }).click()
  await page.waitForSelector('dialog.round-guidance-dialog[open]', { timeout: 10_000 })
  const sdPopup = await page.evaluate(() => document.querySelector('dialog.round-guidance-dialog[open]')?.innerText ?? '')
  check(
    'sudden death (no wheel) keeps the keep-naming copy',
    sdPopup.includes('one wrong guess and you lose') && !sdPopup.includes('Spin the wheel for the chance'),
  )

  // ---- 2. dimming + 3. silent taps (fresh round, pop-up dismissed) -----------
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await seedWheelChallenge({ keepOneUntranslated: true })
  // Take the arrival pop-up's action; the board tap-flow below needs it gone.
  await page.waitForSelector('dialog.round-guidance-dialog[open]', { timeout: 10_000 })
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
  })
  await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]') && !!document.querySelector('.translate-challenge-bar'))
  const dim = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.board-grid .word-card')]
    const dimmed = cards.filter((c) => c.classList.contains('card-dimmed'))
    const greens = cards.filter((c) => c.classList.contains('card-green'))
    const dimStyle = dimmed[0] ? getComputedStyle(dimmed[0]) : null
    return {
      total: cards.length,
      dimCount: dimmed.length,
      greenTotal: greens.length,
      greenDimmed: greens.filter((c) => c.classList.contains('card-dimmed')).length,
      dimOpacity: dimStyle?.opacity ?? null,
    }
  })
  check(
    'non-suitcase cards are dimmed, the suitcases never',
    dim.greenDimmed === 0 && dim.dimCount === dim.total - dim.greenTotal,
    JSON.stringify(dim),
  )
  check(
    'the dim is real (computed opacity ~0.5)',
    dim.dimOpacity !== null && Math.abs(parseFloat(dim.dimOpacity) - 0.5) < 0.06,
    String(dim.dimOpacity),
  )
  // The dim is visual only. Since free-type grading (owner, 2026-09-17) the
  // wheel phase's tap flow is gone entirely: solved suitcases select nothing
  // and the dictionary is locked, so their buttons are inert again — the same
  // disabled state a solved card carried before the build-88 tap flow made
  // them selectable, and exactly "taps on suitcases do nothing new". The
  // dimmed bystanders' disabled state matches the base behaviour too. The
  // meaningful assertion is that the dim CHANGED nothing: no button's
  // disabled state differs from the phase's own rules, and no tap-state
  // class paints anywhere.
  check(
    'the dim changes nothing — suitcases inert by design, no selection state paints',
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.board-grid .word-card')]
      const greens = cards.filter((c) => c.classList.contains('card-green'))
      return (
        greens.length > 0 &&
        greens.every((c) => c.disabled) &&
        !document.querySelector('.card-suitcase-selected') &&
        !document.querySelector('.card-selected')
      )
    }),
  )

  // The tap must not speak: instrument the audio element and count plays of
  // the suitcase's word while tapping it.
  const taps = await page.evaluate(async () => {
    const card = document.querySelector('.board-grid .card-green')
    const label = card?.getAttribute('aria-label') ?? ''
    let played = 0
    const origPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      played++
      return origPlay.apply(this, args)
    }
    card.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
    card.click()
    await new Promise((done) => setTimeout(done, 400))
    HTMLMediaElement.prototype.play = origPlay
    return { label, played }
  })
  check(
    'suitcase tap in the wheel phase plays NO Danish audio',
    taps.played === 0,
    `${taps.played} plays for "${taps.label}"`,
  )
  // And a tap selects NOTHING any more: free-type grading classifies on
  // submit, so no tap-state ever paints (owner, 2026-09-17).
  await page.waitForTimeout(150)
  check(
    'a suitcase tap selects nothing — no selection state paints',
    await page.evaluate(
      () =>
        !document.querySelector('.card-suitcase-selected') &&
        !document.querySelector('.card-selected'),
    ),
  )

  // ---- 4. the spin: measured on WIN and MISS ---------------------------------
  for (const miss of [false, true]) {
    await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
    // The wheel phase itself: every segment translated, the disc armed. On the
    // miss run the fills are stripped, so the landing can only lose.
    await seedWheelChallenge({ keepOneUntranslated: false })
    if (miss) {
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
        raw.state.game.wheel.filled = []
        localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
      })
    }
    await page.waitForSelector('.wheel-disc', { timeout: 15_000 })
    // Take the arrival pop-up's action; the disc's tap needs it gone. The
    // dialog persists until dismissed, so this wait may resolve instantly.
    const dialogGone = await page
      .waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'), null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (!dialogGone) {
      await page.evaluate(() => {
        const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
        ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
      })
      await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'), null, { timeout: 5000 })
    }
    // Reach the wheel phase directly: the dock is the spinner either way. The
    // disc itself is the enabled tap target here (the hidden cards are
    // disabled in this seeded state — the wheel, not the board, is the
    // surface under test).
    const discDisabled = await page.evaluate(() => document.querySelector('.wheel-disc')?.disabled ?? true)
    check('the wheel disc is armed for the spin', !discDisabled)
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      raw.state.game.phase = 'translateWheel'
      localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Continue game' }).click()
    await page.waitForSelector('.wheel-disc', { timeout: 15_000 })
    await page.waitForTimeout(300)
    const t0 = Date.now()
    await page.locator('.wheel-disc').click()
    const spin = await page.evaluate(
      (started) =>
        new Promise((done) => {
          const start = Date.now()
          const sawSpinning = () => !!document.querySelector('.wheel-svg.wheel-spinning')
          const holdSeen = () => {
            // wheelSpinHold is transient on purpose (deliberately absent from
            // the store's partialize), so it is NOT in localStorage — the
            // runtime signal is behavioural: the chooser (.wheel-chooser) and
            // the round summary (.round-summary) stay absent while the hold
            // stands, and the spinning class is on the disc. sawHold therefore
            // reads the DOM: the hold is up iff the verdict UI has NOT yet
            // replaced the wheel while the result is already in the saved game.
            const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
            const resultIn = raw?.state?.game?.wheel?.result ?? null
            const verdictUi = !!document.querySelector('.wheel-chooser') || !!document.querySelector('.round-summary')
            return resultIn !== null && !verdictUi
          }
          let sawClass = false
          let sawHold = false
          const iv = setInterval(() => {
            if (sawSpinning()) sawClass = true
            if (holdSeen()) sawHold = true
            const chooserOrSummary = document.querySelector('.wheel-chooser') || document.querySelector('.round-summary')
            if (chooserOrSummary) {
              clearInterval(iv)
              done({ spinMs: Date.now() - start, sawClass, sawHold, verdict: chooserOrSummary.className })
            }
            if (Date.now() - start > 12_000) {
              clearInterval(iv)
              done({ spinMs: -1, sawClass, sawHold, verdict: 'timeout' })
            }
          }, 50)
        }),
      t0,
    )
    const result = await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      return g.wheel?.result ?? null
    })
    check(
      `spin @${miss ? 'miss' : 'win'}: the disc visibly spun >=2.8s before the handoff`,
      spin.sawClass && spin.spinMs >= 2800,
      `class=${spin.sawClass} hold=${spin.sawHold} verdictAt=${spin.spinMs}ms result=${result}`,
    )
    check(
      `spin @${miss ? 'miss' : 'win'}: the store held the verdict during the animation`,
      spin.sawHold,
    )
    await page.screenshot({ path: `evidence/lastchance-polish/spin-${miss ? 'miss' : 'win'}-360.png` })
  }

  // ---- 5. composer clipping at 360px, keyboard-open sized --------------------
  // Seed at a normal height (the home flow needs it), then shrink to the
  // keyboard-open viewport the dock must survive.
  await page.setViewportSize({ width: 360, height: 640 })
  await seedWheelChallenge({ keepOneUntranslated: true })
  await page.setViewportSize({ width: 360, height: 230 })
  await page.waitForFunction(() => !!document.querySelector('.wheel-input'))
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    ;[...(dialog?.querySelectorAll('button') ?? [])].at(-1)?.click()
  })
  await page.focus('.wheel-input')
  await page.waitForTimeout(200)
  const focus = await page.evaluate(() => {
    const input = document.querySelector('.wheel-input')
    const row = input.closest('.wheel-answer-row')
    const ir = input.getBoundingClientRect()
    const rr = row.getBoundingClientRect()
    const cs = getComputedStyle(input)
    const outline = { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), offset: parseFloat(cs.outlineOffset || '0') }
    // The ring paints outside the border box by (offset + width/2 …); the
    // row's clip must leave room for it on BOTH edges.
    const leftGap = ir.left - rr.left
    const rightGap = rr.right - ir.right
    const needed = outline.style !== 'none' ? outline.width + Math.max(0, outline.offset) : 0
    return { leftGap, rightGap, needed, outline, borderLeft: cs.borderLeftWidth, radius: cs.borderTopLeftRadius }
  })
  check(
    'focus ring unclipped at 360px: the row leaves room on both edges',
    focus.leftGap >= focus.needed && focus.rightGap >= focus.needed,
    `left gap ${focus.leftGap}px, right gap ${focus.rightGap}px, needed ${focus.needed}px`,
  )
  await page.screenshot({ path: 'evidence/lastchance-polish/composer-focus-360x230.png' })
  // And the field itself does not clip inside the row (bottom border intact).
  const note = await page.evaluate(() => {
    const input = document.querySelector('.wheel-input')
    const note = input.closest('.wheel-answer-row')?.querySelector('.packing-note')
    const ir = input.getBoundingClientRect()
    const nr = note?.getBoundingClientRect()
    return { overlap: nr ? Math.max(0, ir.bottom - nr.top) : -1 }
  })
  check('the note row does not clip the field\u2019s bottom border', note.overlap === 0, `${note.overlap}px overlap`)

  if (crashes.length) {
    check('no page errors', false, crashes.join(' | ').slice(0, 200))
  }
  console.log(fail ? `\nFAILED: ${fail} check(s)` : '\nLASTCHANCE POLISH PROBE OK')
  if (fail) process.exitCode = 1
} catch (e) {
  console.log('PROBE FAILED:', e.stack?.split('\n').slice(0, 3).join(' | '))
  await page.screenshot({ path: 'evidence/lastchance-polish/probe-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}