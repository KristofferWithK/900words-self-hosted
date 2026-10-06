// Built app + scripted decision transport. Every external origin is blocked;
// no Worker deployment, private corpus import or paid model request is needed.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const preview = await startPreview(4324)
// preview.base includes /ClueCabulary/; navigation keeps that app path,
// while the allowlist and scripted Casey endpoint use the server origin.
const previewOrigin = new URL(preview.base).origin
const caseyBaseUrl = new URL('/v1', previewOrigin).href
const decisionUrl = `${caseyBaseUrl}/casey/decision`
const output = resolve(process.env.SHOT_DIR ?? 'e2e-shots', 'round-opening-guidance')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const checks = []
const blocked = []
const errors = []
let context
let page
let calls = []
let releaseClue = null
let holdClue = false
let replyAt = 0
const check = (name, value) => { assert.ok(value, name); checks.push(name) }
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state)
const panel = () => page.locator('dialog.round-guidance-dialog[open]')
const PANEL_TAG = 'dialog.round-guidance-dialog[open] .tag'

// The focus look of a tag, as an iPhone paints it. Every pop-up moves focus
// to its tag on open, and iOS WebKit matches :focus-visible for that script
// focus, where Chromium after a click does not: build 123 showed a green
// rectangle over "Start translating" that this drive never saw. So the tag is
// read at rest, then with :focus and :focus-visible forced through CDP, and
// the two must match: no outline, no shadow, no border, the tag's own ink.
const focusLook = (el) => {
  const s = getComputedStyle(el)
  return { outline: s.outlineStyle, boxShadow: s.boxShadow, border: s.borderTopStyle,
    ink: getComputedStyle(el, '::before').backgroundColor,
    modality: document.documentElement.getAttribute('data-focus-modality') }
}
async function checkNoFocusFrame(name, selector) {
  const element = page.locator(selector)
  check(`${name}: the tag has focus on open`, await element.evaluate((el) => el === document.activeElement))
  const cdp = await context.newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    assert.ok(nodeId, `${name}: ${selector} is on the page`)
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    const rest = await element.evaluate(focusLook)
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] })
    const focused = await element.evaluate(focusLook)
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    check(`${name}: the tag's script focus draws no frame (outline ${focused.outline}, shadow ${focused.boxShadow}, border ${focused.border})`,
      focused.outline === 'none' && focused.boxShadow === 'none' && focused.border === 'none' && focused.modality === null)
    check(`${name}: the tag's script focus looks as it does at rest (ink ${focused.ink})`, JSON.stringify(focused) === JSON.stringify(rest))
  } finally {
    await cdp.detach().catch(() => {})
  }
}

async function newProfile(viewport) {
  await context?.close()
  context = await browser.newContext({ viewport, serviceWorkers: 'block' })
  page = await context.newPage()
  // The café gate is on (CW-13): this drive's board needs its first café found.
  await page.addInitScript(mergeFirstCafe, seedArgs('da'))
  calls = []
  page.on('pageerror', (error) => errors.push(error.message))
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== previewOrigin) {
      blocked.push(url.origin)
      await route.abort('blockedbyclient')
      return
    }
    if (url.href === decisionUrl) {
      const request = route.request().postDataJSON()
      calls.push(request.operation)
      const { game } = await saved()
      let decision
      if (request.operation === 'clue') {
        if (holdClue) await new Promise((resolve) => { releaseClue = resolve })
        const targets = game.words.filter((w) => game.aiKey[w.wordId] === 'green' && game.reveals[w.wordId].kind !== 'green').slice(0, 2).map((w) => w.wordId)
        decision = { clue: 'togetherness', number: targets.length, targetWordIds: targets, rationale: 'PRIVATE_RATIONALE_SENTINEL' }
      } else if (request.operation === 'guess') {
        // Script one harmless neutral result so the next Casey clue is reached.
        const word = game.words.find((w) => game.playerKey[w.wordId] === 'bystander' && game.reveals[w.wordId].kind === 'hidden')
        decision = { guesses: [{ wordId: word.wordId, confidence: 0.9, reasoning: 'A scripted association.' }] }
      } else {
        throw new Error(`Unexpected decision request: ${request.operation}`)
      }
      replyAt = Date.now()
      await route.fulfill({ json: { protocol: 1, decision, report: { arm: 'scripted', refused: false } } })
      return
    }
    await route.continue()
  })
  await page.addInitScript((baseUrl) => {
    // Seed before app code runs, once per profile. Reload must retain the
    // player's new preference, and even unload analytics stay on loopback.
    if (!localStorage.getItem('cluecab-settings-v1')) {
      localStorage.setItem('cluecab-settings-v1', JSON.stringify({ version: 17, state: {
        baseUrl, studyPhase: 'never', clueLanguage: 'en', sound: false, usageStats: false,
      } }))
    }
  }, caseyBaseUrl)
  // A resumed board is owned by the durable primary slot.  Fixture changes
  // that write only the legacy cache are deliberately discarded during
  // hydration, so queue both stores for the next document just as a real
  // persisted board would carry them together.
  await page.addInitScript(() => {
    try {
      const queued = sessionStorage.getItem('__round-guidance-primary-fixture-v1')
      if (queued) {
        const fixture = JSON.parse(queued)
        localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
        localStorage.setItem('cluecab-game-v1', fixture.cache)
        sessionStorage.removeItem('__round-guidance-primary-fixture-v1')
      }
    } catch { /* opaque pre-navigation document has no session storage */ }
    window.__writeRoundGuidancePrimaryFixture = (raw) => {
      const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
      const sessions = saved?.state?.byCourse?.da
      if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
        throw new Error('round-guidance fixture has no active durable primary slot')
      }
      sessions.primary.game = raw.state.game
      sessionStorage.setItem('__round-guidance-primary-fixture-v1', JSON.stringify({
        sessions: JSON.stringify(saved), cache: JSON.stringify(raw),
      }))
    }
  })
// A device that has already answered the UI-language question, which every
// device here is meant to be: this drive measures what comes AFTER it. Phase
// 1g turned that question on for everyone, so without this the intro opens on
// the language act and each check below would be reading the wrong screen.
await page.addInitScript(() => localStorage.setItem('cluecab-ui-language', 'en'))
  await page.goto(`${preview.base}?howto=0&first=ai`)
  await page.waitForSelector('.city-card')
}

async function start(first = 'ai', { seed } = {}) {
  await page.goto(`${preview.base}?howto=0&first=${first}${seed === undefined ? '' : `&seed=${seed}`}`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
}
async function fresh(first = 'ai', options) {
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await start(first, options)
}
async function geometry(name) {
  const measured = await panel().evaluate((el) => {
    const r = el.getBoundingClientRect()
    const button = el.querySelector('button').getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
      centerX: r.x + r.width / 2, centerY: r.y + r.height / 2,
      width: innerWidth, height: innerHeight, scroll: el.scrollHeight > el.clientHeight,
      button: { top: button.top, bottom: button.bottom },
      backdrop: getComputedStyle(el, '::backdrop').backgroundColor }
  })
  check(`${name}: panel and action fit the viewport`, measured.left >= 0 && measured.top >= 0 && measured.right <= measured.width && measured.bottom <= measured.height && measured.button.bottom <= measured.height && !measured.scroll)
  check(`${name}: centered and dimmed`, Math.abs(measured.centerX - measured.width / 2) < 2 && Math.abs(measured.centerY - measured.height / 2) < 2 && measured.backdrop !== 'rgba(0, 0, 0, 0)')
  await page.screenshot({ path: resolve(output, `${name}.png`) })
}
// Force a valid wheel from the current board, as a round reaching
// translation would leave it; the next document loads it as the primary.
async function toTranslationFixture() {
  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const game = value.state.game
    const greens = game.words.filter((word) =>
      game.playerKey[word.wordId] === 'green' || game.aiKey[word.wordId] === 'green')
    for (const word of greens) game.reveals[word.wordId] = { kind: 'green' }
    game.phase = 'translateChallenge'
    game.turnsLeft = 0
    game.wheel = {
      segments: greens.map((word) => word.wordId), translated: [], filled: [],
      attempts: 0, landed: null, result: null, spent: null,
    }
    window.__writeRoundGuidancePrimaryFixture(value)
  })
}
async function dismissCasey() {
  await panel().getByRole('button', { name: 'Start guessing', exact: true }).click()
  await panel().waitFor({ state: 'detached' })
}
async function reachPlayerClue() {
  const { game } = await saved()
  const word = game.words.find((w) => game.aiKey[w.wordId] === 'bystander' && game.reveals[w.wordId].kind === 'hidden')
  assert.ok(word, 'an unrevealed neutral card is available for the player guess')
  await page.locator('.word-card').filter({ has: page.getByText(word.da, { exact: true }) }).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.clue-input')
}

let failure = null
try {
  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    const size = `${viewport.width}x${viewport.height}`
    await newProfile(viewport)
    // A seeded developer board has no baked entry. Keep the old fallback
    // coverage first, before an authored primary can legitimately take resume
    // precedence over the developer seed.
    calls = []
    holdClue = true
    await start('ai', { seed: 911 })
    await page.waitForFunction(() => document.querySelector('.thinking'))
    check(`${size}: unknown-board fallback waits for its provider reply`, await panel().count() === 0)
    for (let i = 0; !releaseClue && i < 100; i++) await page.waitForTimeout(20)
    assert.ok(releaseClue, 'unknown-board fallback reached the scripted clue gate')
    holdClue = false
    releaseClue()
    releaseClue = null
    await panel().waitFor()
    check(`${size}: fallback reply reaches the modal`, Date.now() - replyAt < 1000)
    check(`${size}: unknown-board fallback makes one opening request`, calls.filter((op) => op === 'clue').length === 1)

    // A fresh profile then proves the normal authored opening. It is baked
    // into the app, so it reaches its modal without thinking or a request.
    await newProfile(viewport)
    calls = []
    await start()
    await panel().waitFor()
    check(`${size}: baked opening skips provider thinking`, await page.locator('.thinking').count() === 0)
    check(`${size}: baked opening makes no Casey decision request`, calls.filter((op) => op === 'clue').length === 0)
    const baked = await saved()
    check(`${size}: baked opening is immediately in the persisted game`,
      baked.game.clueHistory.length === 1 && baked.game.clueHistory[0]?.by === 'ai')
    const { game } = await saved()
    const clue = game.clueHistory[0]
    assert.equal(await panel().locator('.round-guidance-clue').textContent(), clue.text)
    assert.equal(await panel().locator('.round-guidance-number').textContent(), `${clue.number} words`)
    check(`${size}: no private clue fields in the panel`, !/PRIVATE_RATIONALE_SENTINEL|da:|targetWordIds|aiKey/.test(await panel().innerHTML()))
    check(`${size}: normal dock retains the same clue`, (await page.locator('.guess-bar .dock-title').textContent()).includes(clue.text))
    await geometry(`casey-${size}`)
    await checkNoFocusFrame(`${size}: Casey's first clue`, PANEL_TAG)
    await page.keyboard.press('Tab')
    check(`${size}: forward Tab stays inside`, await panel().evaluate((el) => el.contains(document.activeElement)))
    // Keyboard focus is still shown, on the tag's own outline: green and
    // heavier ink, never a rectangle around it.
    const keyboard = await page.locator(PANEL_TAG).evaluate(focusLook)
    check(`${size}: keyboard focus redraws the tag's own outline in green`,
      keyboard.modality === 'keyboard' && keyboard.ink === 'rgb(58, 122, 52)' && keyboard.outline === 'none' && keyboard.boxShadow === 'none')
    await page.screenshot({ path: resolve(output, `casey-keyboard-focus-${size}.png`) })
    await page.keyboard.press('Shift+Tab')
    check(`${size}: reverse Tab stays inside`, await panel().evaluate((el) => el.contains(document.activeElement)))
    // A real coordinate tap outside the dialog must not select or reveal a card.
    const card = await page.locator('.word-card').first().boundingBox()
    const modal = await panel().boundingBox()
    check(`${size}: test tap is outside the dialog`, card.y + 4 < modal.y || card.x + 4 < modal.x)
    const before = JSON.stringify((await saved()).game)
    await page.mouse.click(card.x + 4, card.y + 4)
    assert.equal(JSON.stringify((await saved()).game), before)
    check(`${size}: no behind-modal board selection`, await page.locator('.guess-confirm').count() === 0)
    await dismissCasey()
    check(`${size}: dismissal restores page focus`, await page.evaluate(() => document.activeElement !== document.body && !document.activeElement.closest('dialog')))
    await page.reload()
    await page.locator('.home-play').click()
    await page.waitForSelector('.guess-bar')
    check(`${size}: reload resumes announced round quietly`, await panel().count() === 0)
    await reachPlayerClue()
    await panel().waitFor()
    const playerLesson = await panel().innerText()
    check(`${size}: player lesson appears on turn transition`,
      playerLesson.includes('Write one Danish word') && playerLesson.includes('1–4 of your green words.'))
    await geometry(`player-${size}`)
    await checkNoFocusFrame(`${size}: Your turn`, PANEL_TAG)
    await page.keyboard.press('Tab')
    check(`${size}: player Tab wraps to checkbox`, await panel().locator('input').evaluate((el) => el === document.activeElement))
    await page.keyboard.press('Shift+Tab')
    check(`${size}: player reverse Tab wraps to action`, await panel().locator('button').evaluate((el) => el === document.activeElement))
    await page.keyboard.press('Escape')
    await panel().waitFor({ state: 'detached' })
    await page.reload()
    await page.locator('.home-play').click()
    await page.waitForSelector('.clue-input')
    check(`${size}: reload does not repeat player lesson`, await panel().count() === 0)
    await page.locator('#clue-word').fill('huskeliste')
    await page.locator('.clue-input .btn-primary').click()
    await page.waitForSelector('.guess-bar', { timeout: 20000 })
    check(`${size}: later Casey clue stays in dock`, await panel().count() === 0)
    await reachPlayerClue()
    check(`${size}: second player clue turn has no repeated lesson`, await panel().count() === 0)
    await page.locator('#clue-word').fill('huskeliste')
    await page.locator('.clue-input .btn-primary').click()
    await page.waitForSelector('.guess-bar', { timeout: 20000 })
    await reachPlayerClue()
    check(`${size}: third player clue turn has no repeated lesson`, await panel().count() === 0)
    // Translation time replaces the retired last-chance introduction. Force a
    // valid wheel from the current board: the panel must teach both translating
    // and the coming spin, persist at announcement, and stay quiet on reload.
    await toTranslationFixture()
    await page.reload()
    await page.locator('.home-play').click()
    await panel().waitFor()
    const translationIntro = await panel().innerText()
    check(`${size}: entering translation is announced`, translationIntro.includes('Translation time') && /wheel|spin/i.test(translationIntro))
    check(`${size}: translation panel replaces last-chance copy`, !translationIntro.includes('Last Chance') && !translationIntro.includes('one wrong guess and you lose'))
    // The same "Don't remind me again" box as the Your turn panel, unticked.
    check(`${size}: translation panel has the opt-out box and no clue`,
      await panel().getByRole('checkbox', { name: 'Don’t remind me again' }).count() === 1 &&
      !(await panel().getByRole('checkbox').isChecked()) && await panel().locator('.round-guidance-clue').count() === 0)
    assert.equal((await saved()).roundGuidance.translation, 'announced')
    await geometry(`translation-${size}`)
    await checkNoFocusFrame(`${size}: Translation time`, PANEL_TAG)
    const translationBefore = JSON.stringify((await saved()).game)
    await panel().getByRole('button', { name: 'Start translating', exact: true }).click()
    await panel().waitFor({ state: 'detached' })
    // Like Your turn, the closed panel hands over to the bottom card.
    await page.waitForSelector('.turn-takeover-line')
    check(`${size}: Translation time card plays at the bottom after the panel`,
      (await page.locator('.turn-takeover-line').innerText()) === 'Translation time')
    await page.waitForSelector('.translate-challenge-bar')
    check(`${size}: Start translating leaves the wheel as it was`, JSON.stringify((await saved()).game) === translationBefore && (await saved()).roundGuidance.translation === 'dismissed')
    await page.reload()
    await page.locator('.home-play').click()
    await page.waitForSelector('.translate-challenge-bar')
    check(`${size}: reload does not repeat the translation panel`, await panel().count() === 0)
    check(`${size}: closing without the box keeps the translation preference off`,
      await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-settings-v1')).state.hideTranslationReminder) === false)
    // Tick the box on the next round's translation panel: later rounds then
    // reach Translation time with no panel, and the bottom card still plays.
    await fresh('player')
    await panel().waitFor()
    await panel().getByRole('button', { name: 'Write a clue' }).click()
    await toTranslationFixture()
    await page.reload()
    await page.locator('.home-play').click()
    await panel().waitFor()
    check(`${size}: a new round announces translation again`, (await panel().innerText()).includes('Translation time'))
    await panel().getByRole('checkbox').check()
    await panel().getByRole('button', { name: 'Start translating', exact: true }).click()
    await panel().waitFor({ state: 'detached' })
    check(`${size}: ticking the box persists the translation opt-out`,
      await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-settings-v1')).state.hideTranslationReminder) === true)
    await fresh('player')
    await panel().waitFor()
    check(`${size}: the translation opt-out leaves the Your turn panel alone`, (await panel().innerText()).includes('Your turn!'))
    await panel().getByRole('button', { name: 'Write a clue' }).click()
    await toTranslationFixture()
    await page.reload()
    await page.locator('.home-play').click()
    await page.waitForSelector('.turn-takeover-line')
    check(`${size}: opted out, the Translation time card plays without a panel`,
      (await page.locator('.turn-takeover-line').innerText()) === 'Translation time' && await panel().count() === 0)
    await page.waitForSelector('.translate-challenge-bar')
    check(`${size}: opted out, no translation panel follows the card`, await panel().count() === 0)
    await fresh('player')
    await panel().waitFor()
    check(`${size}: player-first gets only the player lesson`, (await panel().innerText()).includes('Your turn!') && await panel().locator('.round-guidance-clue').count() === 0)
    await panel().getByRole('checkbox').check()
    await panel().getByRole('button', { name: 'Write a clue' }).click()
    await fresh('player')
    await page.waitForSelector('.clue-input')
    check(`${size}: persisted opt-out suppresses next round lesson`, await panel().count() === 0)
    await fresh('ai')
    await panel().waitFor()
    check(`${size}: opt-out still allows each new Casey opening`, (await panel().innerText()).includes('Casey’s first clue'))
    // Reload while the opening is STILL OPEN: announcement itself is persisted.
    await page.reload()
    await page.locator('.home-play').click()
    await page.waitForSelector('.guess-bar')
    check(`${size}: even an undismissed announced opening stays quiet after reload`, await panel().count() === 0)
    // Legacy cache-only migration belongs to the store/backup migration suite.
    // This browser drive stays on today's durable primary contract; injecting
    // a retired cache-only schema correctly opens recovery UI instead of this
    // round-guidance surface.
    // A new player gets guidance straight into the round, with no retired
    // study screen in front of it.
    await page.evaluate(() => {
      const value = JSON.parse(localStorage.getItem('cluecab-settings-v1'))
      value.state.hidePlayerClueReminder = false
      localStorage.setItem('cluecab-settings-v1', JSON.stringify(value))
    })
    await fresh('player')
    await panel().waitFor()
    check(`${size}: retired study phase is absent`, await page.locator('.study-dock').count() === 0)
    await panel().getByRole('button', { name: 'Write a clue' }).click()
    await page.goto(`${preview.base}?onboard=1`)
    await page.locator('.onboard-screen[data-act="ticket"]').waitFor()
    // The existing full onboarding drive verifies the scripted round. This
    // profile additionally proves the new dialog does not cover the intro.
    check(`${size}: intro has no stacked guidance`, await panel().count() === 0)
    // The intro's Next tag is autofocused too: no frame there either.
    await page.locator('.onboard-ticket').filter({ hasText: 'Denmark' }).click()
    await page.locator('.onboard-intro-next').waitFor()
    await checkNoFocusFrame(`${size}: onboarding intro Next`, '.onboard-intro-next')
  }
  check('no external origins requested', blocked.length === 0)
  check('no uncaught browser errors', errors.length === 0)
} catch (error) {
  failure = error.stack ?? String(error)
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {})
  process.exitCode = 1
} finally {
  releaseClue?.()
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ ok: !failure, checks, blocked, errors, failure }, null, 2))
  console.log(JSON.stringify({ checks: checks.length, failure, output }))
  await browser.close()
  preview.stop()
}
