// Focused Home CTA regression. Uses the existing local mock switches and
// onboarding resume fixtures; all non-preview network requests are blocked.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const SHOT_DIR = process.env.SHOT_DIR ?? resolve('e2e-shots')
mkdirSync(SHOT_DIR, { recursive: true })
const preview = await startPreview(4201)
let browser
const WHITE = 'rgb(255, 255, 255)'
// --green-deep: the primary's label and its line, since the owner's
// "Direction B" (2026-09-11) — a primary is a white pill drawn in green, not
// a filled one. The visible line is the pencil pass's ::before, so that is
// what `edge*` reads; the element's own border is transparent on every pill.
const GREEN = 'rgb(58, 122, 52)'
const styles = (button) => button.evaluate((el) => {
  const s = getComputedStyle(el)
  const edge = getComputedStyle(el, '::before')
  return {
    background: s.backgroundColor, color: s.color,
    border: s.borderTopColor, borderWidth: s.borderTopWidth,
    borderStyle: s.borderTopStyle, transform: s.transform,
    edge: edge.borderTopColor, edgeWidth: edge.borderTopWidth,
    edgeStyle: edge.borderTopStyle, edgeDisplay: edge.display,
    outline: s.outlineStyle, outlineWidth: parseFloat(s.outlineWidth),
    active: el.matches(':active'), focusVisible: el.matches(':focus-visible'),
    tag: el.tagName,
  }
})
const luminance = (rgb) => rgb.match(/\d+/g).slice(0, 3)
  .map((n) => Number(n) / 255)
  .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
  .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)

/** The primary as every screen draws it: white, green label, one 2px green
 * ring — the SINGLE-RING amendment (owner, 2026-09-16): the pencil ::before
 * pass is retired, the element's own border is the ring. */
async function outlinePrimary(button, label) {
  assert.ok(await button.isVisible(), `${label}: visible`)
  const s = await styles(button)
  assert.equal(s.tag, 'BUTTON', `${label}: native button`)
  assert.equal(s.background, WHITE, `${label}: white background`)
  assert.equal(s.color, GREEN, `${label}: green text`)
  assert.equal(s.edgeDisplay, 'none', `${label}: single ring (no second pencil pass)`)
  assert.equal(s.borderStyle, 'solid', `${label}: drawn ring`)
  assert.equal(s.border, GREEN, `${label}: green ring`)
  assert.equal(s.borderWidth, '2px', `${label}: the primary's heavier edge`)
  const contrast = (luminance(s.background) + 0.05) / (luminance(s.color) + 0.05)
  assert.ok(contrast >= 4.5, `${label}: text contrast ${contrast}`)
  console.log(`OK ${label}: white/green, green 2px edge, contrast ${contrast.toFixed(2)}:1`)
}

async function focusWithTab(page, button) {
  // Real Tab navigation, not programmatic focus(), exercises native tab order.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    if (await button.evaluate((el) => el === document.activeElement)) break
  }
  const s = await styles(button)
  assert.ok(s.focusVisible && s.outline !== 'none' && s.outlineWidth > 0,
    'Tab reaches Play with a visible focus outline')
}

async function fits(page, button) {
  assert.ok(await button.isVisible())
  assert.ok(await button.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight &&
      r.height >= 48 && document.scrollingElement.scrollHeight <= innerHeight &&
      document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
  }), 'Play fits the viewport, has a 48px target, and receives its own taps')
}

async function assertHomeGeometry(page, label, { expectTrain = false } = {}) {
  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const { left, top, right, bottom, width, height } = el.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const intersectionArea = (a, b) => {
      if (!a || !b) return null
      return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    }
    const casey = rect('.cluey-svg')
    const caseyButton = rect('.cluey-button')
    const play = rect('.home-play')
    const train = rect('.home-progress-band .train-progress')
    const progress = rect('.home-progress-band')
    return {
      nameCount: document.querySelectorAll('.home-screen .cluey-name').length,
      caseyPlayOverlap: intersectionArea(casey, play),
      caseyButtonPlayOverlap: intersectionArea(caseyButton, play),
      caseyButtonClearance: caseyButton && play ? play.top - caseyButton.bottom : null,
      caseyButtonName: document.querySelector('.home-screen .cluey-button')?.getAttribute('aria-label'),
      train,
      progress,
      innerHeight,
      scrollHeight: document.scrollingElement.scrollHeight,
    }
  })

  assert.equal(geometry.nameCount, 0, `${label}: Casey's visible Home name is removed`)
  assert.ok(geometry.caseyButtonName, `${label}: suitcase retains its accessible name`)
  assert.equal(geometry.caseyPlayOverlap, 0, `${label}: Casey drawing and Play rectangles do not overlap`)
  assert.equal(geometry.caseyButtonPlayOverlap, 0, `${label}: Casey button and Play rectangles do not overlap`)
  assert.ok(geometry.caseyButtonClearance >= 0,
    `${label}: Casey button clears Play (measured ${geometry.caseyButtonClearance}px)`)
  assert.ok(geometry.scrollHeight <= geometry.innerHeight,
    `${label}: Home remains within the viewport (${geometry.scrollHeight}/${geometry.innerHeight}px)`)

  if (expectTrain) {
    assert.ok(geometry.train, `${label}: Home train is rendered`)
    assert.ok(geometry.train.height >= 24.5,
      `${label}: Home train uses reclaimed card space (measured ${geometry.train.height}px)`)
    assert.ok(geometry.progress.height <= 50.5,
      `${label}: enlarged train keeps the progress card within its 50.5px budget (measured ${geometry.progress.height}px)`)
    assert.ok(geometry.train.top >= geometry.progress.top && geometry.train.bottom <= geometry.progress.bottom,
      `${label}: train rectangle stays inside its progress card`)
  }

  console.log(
    `OK ${label}: no visible name, Casey/Play overlap 0px², ${geometry.caseyButtonClearance.toFixed(1)}px button clearance` +
      (expectTrain ? `, train ${geometry.train.height.toFixed(1)}px in ${geometry.progress.height.toFixed(1)}px card` : ''),
  )
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
    const external = []
    const beacons = []
    const errors = []
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (new URL(url).origin === new URL(preview.base).origin) return route.continue()
      // The anonymous usage counters (src/analytics/stats.ts, on by default
      // since 2026-09-07) leave as a beacon to the Casey Worker's /v1/stats
      // every time the page hides — which every goto below is. That is the
      // one outside request Home is allowed to make, so it is kept apart and
      // checked for shape at the end; anything else is still a failure.
      if (/\/v1\/stats$/.test(new URL(url).pathname)) {
        beacons.push(url)
        return route.abort()
      }
      external.push(url)
      return route.abort()
    })
    const page = await context.newPage()
    await installRoundGuidanceHandler(page)
    page.setDefaultTimeout(10_000)
    page.on('pageerror', (error) => errors.push(error.message))
    // A seeded request is a non-manifest developer attempt; it correctly has
    // no course slot to resume. This retention check must start the ordinary
    // finite primary instead, otherwise "Continue game" would test a retired
    // persistence shape rather than the current primary-slot contract.
    const home = preview.base + '?mock=1&howto=0&city=0&first=player'
    await page.goto(home, { waitUntil: 'networkidle' })
    const play = page.locator('.home-play')
    assert.equal(await play.innerText(), 'Play')
    await outlinePrimary(play, `${size} Play`)
    await fits(page, play)
    await assertHomeGeometry(page, `${size} initial Play`, { expectTrain: true })
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-${size}.png`) })

    // The existing button has no custom pressed transform or color rule.
    // Hold the real pointer down and check :active before releasing to click.
    const idle = await styles(play)
    const box = await play.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    assert.ok((await styles(play)).active, 'pointer down enters native :active')
    assert.equal((await styles(play)).transform, idle.transform, 'pressed geometry is unchanged')
    await outlinePrimary(play, `${size} pressed Play`)
    await page.mouse.up()
    await page.waitForSelector('.game-screen .board-grid')
    assert.equal(await page.locator('.word-card').count(), 18, 'click starts a standard game')
    const board = await page.locator('.card-word').allTextContents()

    await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
    await outlinePrimary(page.getByRole('button', { name: 'Pause game', exact: true }), `${size} Pause game`)
    await page.getByRole('button', { name: 'Pause game', exact: true }).click()
    assert.equal(await play.innerText(), 'Continue board')
    await outlinePrimary(play, `${size} Continue game`)
    await fits(page, play)
    await assertHomeGeometry(page, `${size} Continue game`, { expectTrain: true })
    await focusWithTab(page, play)
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-focus-${size}.png`) })
    await page.keyboard.press('Enter')
    await page.waitForSelector('.game-screen .board-grid')
    assert.deepEqual(await page.locator('.card-word').allTextContents(), board, 'Enter resumes the same game')

    await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
    await page.getByRole('button', { name: 'Cancel round', exact: true }).click()
    await focusWithTab(page, play)
    await page.keyboard.down('Space')
    assert.ok((await styles(play)).active, 'Space enters native :active')
    await outlinePrimary(play, `${size} keyboard-pressed Play`)
    assert.equal(await page.locator('.game-screen').count(), 0, 'Space waits for release')
    await page.keyboard.up('Space')
    await page.waitForSelector('.game-screen .board-grid')
    assert.equal(await page.locator('.word-card').count(), 18, 'Space release starts a game')

    // The same persisted fixtures used by onboarding-drive, with no full
    // model-backed tutorial required to inspect the Home hand-off.
    async function onboarding(step) {
      await page.evaluate((marker) => {
        localStorage.clear()
        localStorage.setItem('cluecab-onboard-v5', marker)
      }, step)
      await page.goto(preview.base + '?mock=1', { waitUntil: 'networkidle' })
    }
    await onboarding('home-intro')
    assert.ok(await play.isDisabled(), 'unrevealed intro Play is disabled')
    assert.ok(await play.isHidden(), 'unrevealed intro Play stays hidden')
    for (let i = 0; i < 3; i++) await page.locator('.home-intro-bubble').click()
    await page.waitForSelector('.home-intro-play .home-play:enabled')
    assert.equal(await play.innerText(), 'Play your first game')
    await outlinePrimary(play, `${size} intro Play`)
    await fits(page, play)
    await assertHomeGeometry(page, `${size} onboarding Play`)
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-intro-${size}.png`), animations: 'disabled' })
    await play.click()
    await page.waitForSelector('.tutorial-game .board-grid')
    assert.equal(await page.locator('.word-card').count(), 9, 'intro Play starts the tutorial')

    await onboarding('home-return')
    // A fresh profile still owes the Home postcard lesson, which dims Home
    // and holds the pointer until it closes. Close it, then measure the gate
    // it hands back: the same Play, now receiving its own taps again.
    const homeLesson = page.locator('.tour-overlay[data-tour-kind="home"]')
    await homeLesson.waitFor({ state: 'attached' })
    await page.keyboard.press('Escape')
    await homeLesson.waitFor({ state: 'detached' })
    assert.equal(await play.innerText(), 'Tap Casey')
    assert.ok(await play.isDisabled(), 'Tap Casey remains natively disabled')
    const disabled = await styles(play)
    assert.equal(disabled.background, 'rgb(230, 230, 230)', 'disabled background unchanged')
    assert.equal(disabled.color, 'rgb(155, 155, 155)', 'disabled text unchanged')
    assert.equal(disabled.border, 'rgb(230, 230, 230)', 'disabled border unchanged')
    await fits(page, play)
    await assertHomeGeometry(page, `${size} onboarding Tap Casey`)
    await play.click({ force: true })
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      assert.ok(await play.evaluate((el) => el !== document.activeElement), 'Tab skips disabled Play')
    }
    assert.equal(await page.locator('.home-intro-return').count(), 1, 'disabled click cannot start a game')
    assert.equal(await page.locator('.board-grid').count(), 0)
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-disabled-${size}.png`) })
    assert.deepEqual(external, [], 'no external API requests beyond the usage-counter beacon')
    assert.ok(new Set(beacons.map((u) => new URL(u).origin)).size <= 1, `usage-counter beacons go to one Worker: ${beacons.join(', ')}`)
    assert.deepEqual(errors, [], 'no browser errors')
    console.log(`OK ${size}: click, Enter, Space, focus, intro and disabled behavior; no external requests`)
    await context.close()
  }
  console.log('HOME PLAY DRIVE OK')
} finally {
  await browser?.close()
  preview.stop()
}
