// Focused Home CTA regression. Uses the existing local mock switches and
// onboarding resume fixtures; all non-preview network requests are blocked.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const SHOT_DIR = process.env.SHOT_DIR ?? resolve('e2e-shots')
mkdirSync(SHOT_DIR, { recursive: true })
const preview = await startPreview(4201)
// Café world (CW-04): a required board is a café, and Play cannot deal one
// before a Sightseeing walk has found it. This drive is about the Play button,
// not the walk, so the profile starts as a player whose first walk found the
// first café (the first board of the frozen Danish manifest) and nothing else.
const FIRST_CAFE = JSON.parse(readFileSync(resolve('src/data/city1-required-board-manifest.da.json'), 'utf8')).requiredBoards[0].authoredBoardId
const FOUND_FIRST_CAFE = JSON.stringify({ version: 7, state: {
  cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
  waitingForTrain: false, historicalTravelEligibility: {}, photos: {},
  cafes: { [JSON.stringify(['da', 'sonderborg'])]: { found: { [FIRST_CAFE]: Date.now() }, toward: 0 } },
} })
let browser
const WHITE = 'rgb(255, 255, 255)'
// --green-deep: a primary tag's label (CW-10/CW-12), as it was the primary
// pill's since the owner's "Direction B" (2026-09-11).
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

const INK = 'rgb(18, 18, 18)'
const PRESSED_FILL = 'rgb(239, 234, 220)'
const PENCIL_INK = 'rgb(201, 195, 178)'
const tagStyles = (button) => button.evaluate((el) => {
  const ink = getComputedStyle(el, '::before')
  const fill = getComputedStyle(el, '::after')
  const label = el.querySelector('.tag-label')
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName, type: el.getAttribute('type'), disabled: el.disabled,
    ink: ink.backgroundColor, inkClip: ink.clipPath, fill: fill.backgroundColor, fillClip: fill.clipPath,
    label: label ? getComputedStyle(label).color : null, ownClip: getComputedStyle(el).clipPath,
    active: el.matches(':active'), focusVisible: el.matches(':focus-visible'),
    outline: getComputedStyle(el).outlineStyle, outlineWidth: parseFloat(getComputedStyle(el).outlineWidth),
    width: r.width, height: r.height, hole: !!el.querySelector('.tag-hole'),
  }
})

/** Café world (CW-10): Play is the Café puzzle TAG. A real button, one ink
 * outline clipped to the tag's shape, white inside, ink label, a punched hole,
 * and at least 44 x 44 CSS px. */
async function tagLook(button, label, { fill = WHITE, labelColor = null, ink = INK } = {}) {
  assert.ok(await button.isVisible(), `${label}: visible`)
  const t = await tagStyles(button)
  assert.equal(t.tag, 'BUTTON', `${label}: native button`)
  assert.equal(t.type, 'button', `${label}: type=button`)
  assert.equal(t.ink, ink, `${label}: ink outline layer`)
  assert.equal(t.fill, fill, `${label}: fill`)
  assert.ok(t.inkClip.startsWith('polygon') && t.fillClip.startsWith('polygon'), `${label}: clipped to the tag's shape`)
  assert.equal(t.ownClip, 'none', `${label}: the button itself is not clipped`)
  assert.ok(t.hole, `${label}: punched hole`)
  if (labelColor) assert.equal(t.label, labelColor, `${label}: label colour`)
  assert.ok(t.width >= 44 && t.height >= 44, `${label}: 44px target (${t.width.toFixed(1)}x${t.height.toFixed(1)})`)
  const contrast = (luminance(t.fill) + 0.05) / (luminance(t.label) + 0.05)
  assert.ok(contrast >= 4.5, `${label}: label contrast ${contrast}`)
  console.log(`OK ${label}: tag ${t.width.toFixed(0)}x${t.height.toFixed(0)}, ink outline, fill ${t.fill}, contrast ${contrast.toFixed(2)}:1`)
  return t
}

async function focusWithTab(page, button) {
  // Real Tab navigation, not programmatic focus(), exercises native tab order.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    if (await button.evaluate((el) => el === document.activeElement)) break
  }
  // Keyboard focus is the tag's own outline, green and heavier (99-tag.css),
  // never a rectangle around the square box: that rectangle is what iOS
  // painted on every pop-up's script-focused tag (build 123).
  const s = await styles(button)
  const t = await tagStyles(button)
  assert.ok(s.focusVisible && s.outline === 'none' && t.ink === GREEN,
    `Tab reaches Play with a visible focus on the tag's own outline (outline ${s.outline}, ink ${t.ink})`)
}

async function fits(page, button) {
  assert.ok(await button.isVisible())
  assert.ok(await button.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight &&
      r.height >= 44 && document.scrollingElement.scrollHeight <= innerHeight &&
      el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  }), 'Play fits the viewport, has a 44px target, and receives its own taps')
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
    // Seeded once per tab, before the app's first load; the onboarding checks
    // below clear storage themselves and are not re-seeded.
    await context.addInitScript((journey) => {
      if (sessionStorage.getItem('drive-seeded')) return
      sessionStorage.setItem('drive-seeded', '1')
      localStorage.setItem('cluecab-journey-v2', journey)
    }, FOUND_FIRST_CAFE)
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
    const note = page.locator('.home-play .tag-note')
    // Café world (CW-10): Play became the Café puzzle tag, with the café it
    // opens on its note line; Sightseeing is the second tag beside it.
    assert.equal(await page.locator('.home-play .tag-label').innerText(), 'Café puzzle')
    assert.equal(await note.innerText(), 'Café Solen')
    await tagLook(play, `${size} Café puzzle`)
    const sightseeingTag = page.locator('.home-tag-sightseeing')
    await tagLook(sightseeingTag, `${size} Sightseeing`)
    // The train strip (owner, 2026-10-04): no ticket; the train, someone
    // running after it, and a "Catch the train" tag that opens the train
    // sheet. All three inside the strip's border, none over another, the tag
    // a 44px target.
    assert.equal(await page.locator('.home-ticket').count(), 0, `${size}: the ticket is gone from the strip`)
    const catchTrain = page.getByRole('button', { name: 'Catch the train', exact: true })
    await tagLook(catchTrain, `${size} Catch the train`)
    const strip = await page.evaluate(() => {
      const box = (selector) => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null }
      return { band: box('.home-progress-band'), train: box('.home-progress-band .train-progress'), runner: box('.home-progress-band .train-runner'), tag: box('.home-progress-band .home-catch-train') }
    })
    const inside = (inner, outer) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom
    const apart = (a, b) => a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5
    for (const part of ['train', 'runner', 'tag']) assert.ok(strip[part] && inside(strip[part], strip.band), `${size}: the ${part} is inside the strip's border ${JSON.stringify(strip)}`)
    assert.ok(apart(strip.train, strip.runner) && apart(strip.runner, strip.tag) && apart(strip.train, strip.tag), `${size}: train, runner and tag do not overlap ${JSON.stringify(strip)}`)
    assert.ok(strip.runner.left >= strip.train.right - 0.5 && strip.tag.left >= strip.runner.right - 0.5, `${size}: the runner is at the back of the train, the tag to its right`)
    await catchTrain.click()
    await page.getByRole('dialog').waitFor()
    assert.equal(await page.locator('.train-sheet').count(), 1, `${size}: Catch the train opens the train sheet`)
    await page.locator('.home-sheet-close').click()
    await page.locator('.train-sheet').waitFor({ state: 'detached' })
    console.log(`OK ${size}: train strip runner and Catch the train tag inside a ${(strip.band.bottom - strip.band.top).toFixed(1)}px strip`)
    // Disabled: no Home tag is disabled today, so set it on the Sightseeing
    // tag for a moment and read the state the stylesheet gives it.
    await sightseeingTag.evaluate((el) => { el.disabled = true })
    const off = await tagStyles(sightseeingTag)
    assert.ok(off.disabled, `${size}: tag disables natively`)
    assert.equal(off.ink, PENCIL_INK, `${size}: a disabled tag is drawn in pencil`)
    assert.notEqual(off.label, INK, `${size}: a disabled tag's label is grey`)
    assert.ok(off.width >= 44 && off.height >= 44, `${size}: a disabled tag keeps its size`)
    await sightseeingTag.evaluate((el) => { el.disabled = false })
    console.log(`OK ${size}: disabled tag in pencil ink ${off.ink}, label ${off.label}`)
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
    assert.deepEqual(await play.boundingBox(), box, 'pressed tag does not move')
    await tagLook(play, `${size} pressed Café puzzle`, { fill: PRESSED_FILL })
    await page.mouse.up()
    await page.waitForSelector('.game-screen .board-grid')
    assert.equal(await page.locator('.word-card').count(), 18, 'click starts a standard game')
    const board = await page.locator('.card-word').allTextContents()

    await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
    await tagLook(page.getByRole('button', { name: 'Pause game', exact: true }), `${size} Pause game`, { labelColor: GREEN })
    await page.getByRole('button', { name: 'Pause game', exact: true }).click()
    assert.equal(await note.innerText(), 'Continue board')
    await tagLook(play, `${size} Continue game`)
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
    await tagLook(play, `${size} keyboard-pressed Café puzzle`, { fill: PRESSED_FILL, ink: GREEN })
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
    // The first session's Home (CW-13) is the real Home with its doors
    // routed: after the walk, a spotlight introduces the café found, and the
    // Café puzzle tag opens its practice table.
    await onboarding('home-cafe')
    const cafeLesson = page.locator('.tour-overlay[data-tour-kind="home"]')
    await cafeLesson.waitFor({ state: 'attached' })
    await page.locator('.tour-panel .onboard-next').click()
    await page.locator('.tour-panel .onboard-next').click()
    await cafeLesson.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.home-first-session').count(), 1, 'the first session shows the real Home')
    assert.equal(await play.getAttribute('data-cafe-action'), 'next', 'the first café is found and playable')
    await tagLook(play, `${size} first-session Café puzzle`)
    await fits(page, play)
    await assertHomeGeometry(page, `${size} first-session Home`)
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-intro-${size}.png`), animations: 'disabled' })
    await play.click()
    await page.waitForSelector('.tutorial-game .board-grid')
    assert.equal(await page.locator('.word-card').count(), 9, 'the first-session Café puzzle tag starts the practice table')

    await onboarding('home-return')
    // A fresh profile still owes the Home stamp lesson, which dims Home and
    // holds the pointer until it closes. Close it: every door then leads to
    // Casey's suitcase, the one step left, so no tap is dead.
    const homeLesson = page.locator('.tour-overlay[data-tour-kind="home"]')
    await homeLesson.waitFor({ state: 'attached' })
    await page.keyboard.press('Escape')
    await homeLesson.waitFor({ state: 'detached' })
    await fits(page, play)
    await assertHomeGeometry(page, `${size} onboarding return Home`)
    await page.screenshot({ path: resolve(SHOT_DIR, `white-play-disabled-${size}.png`) })
    await play.click()
    await page.waitForSelector('.suitcase-screen')
    assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5')), 'suitcase', 'the Café puzzle tag leads to the suitcase step')
    assert.equal(await page.locator('.board-grid').count(), 0, 'and cannot start a game inside the flow')
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
