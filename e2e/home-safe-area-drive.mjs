// Check the Home name removal against iPhone safe-area budgets, including
// the paused board/Continue path seen on device. Chromium does not populate
// iOS env(safe-area-inset-*), so apply those body insets directly.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const preview = await startPreview(4202)
// Café world (CW-04, gate on since #366): Play deals a café only once a walk
// has found it, and a fresh profile's Café puzzle tag opens "Find a café in
// Sightseeing first" instead of a board. This drive is about Home's geometry
// around a paused board, so each profile starts as home-play-drive's does: a
// player whose first walk found the first café and nothing else.
const FIRST_CAFE = JSON.parse(readFileSync(resolve('src/data/city1-required-board-manifest.da.json'), 'utf8')).requiredBoards[0].authoredBoardId
const FOUND_FIRST_CAFE = JSON.stringify({ version: 7, state: {
  cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
  waitingForTrain: false, historicalTravelEligibility: {}, photos: {},
  cafes: { [JSON.stringify(['da', 'sonderborg'])]: { found: { [FIRST_CAFE]: Date.now() }, toward: 0 } },
} })
let browser
const failures = []
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
  for (const { width, height, top, bottom } of [
    { width: 320, height: 568, top: 20, bottom: 0 },
    { width: 375, height: 667, top: 20, bottom: 0 },
    { width: 375, height: 812, top: 50, bottom: 34 },
    { width: 393, height: 852, top: 59, bottom: 34 },
    { width: 430, height: 932, top: 59, bottom: 34 },
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
    await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(preview.base).origin ? route.continue() : route.abort())
    await context.addInitScript((journey) => {
      if (sessionStorage.getItem('drive-seeded')) return
      sessionStorage.setItem('drive-seeded', '1')
      localStorage.setItem('cluecab-journey-v2', journey)
    }, FOUND_FIRST_CAFE)
    const page = await context.newPage()
    // The café gate is on (CW-13): this drive's board needs its first café found.
    await page.addInitScript(mergeFirstCafe, seedArgs('da'))
    await installRoundGuidanceHandler(page)
    await page.goto(`${preview.base}?mock=1&howto=0&city=0&first=player`, { waitUntil: 'networkidle' })
    await page.addStyleTag({ content: `body { padding-top: ${top}px !important; padding-bottom: ${bottom}px !important; }` })
    await page.locator('.home-play').click()
    await page.waitForSelector('.game-screen .board-grid')
    await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
    await page.getByRole('button', { name: 'Pause game', exact: true }).click()
    const result = await page.evaluate(() => {
      const box = (selector) => document.querySelector(selector)?.getBoundingClientRect()
      const casey = box('.cluey-svg')
      const button = box('.cluey-button')
      const play = box('.home-play')
      return {
        labelCount: document.querySelectorAll('.home-screen .cluey-name').length,
        accessibleCasey: document.querySelector('.cluey-button')?.getAttribute('aria-label'),
        // Café world (CW-10): Play is the Café puzzle tag, and its note line
        // says what it does; a paused board reads "Continue board" there.
        playText: document.querySelector('.home-play .tag-note')?.textContent?.trim(),
        caseyWidth: casey?.width,
        caseyHeight: casey?.height,
        gap: play && button ? play.top - button.bottom : null,
        drawingGap: play && casey ? play.top - casey.bottom : null,
        playBottom: play?.bottom,
        // The tag's centre is its label: a tap there lands inside the button.
        tap: play ? !!document.querySelector('.home-play')?.contains(document.elementFromPoint(play.x + play.width / 2, play.y + play.height / 2)) : false,
        scrollHeight: document.scrollingElement.scrollHeight,
      }
    })
    const size = `${width}x${height}`
    if (width === 375 && height === 812) {
      mkdirSync(resolve('e2e-shots/home-hide-name'), { recursive: true })
      await page.screenshot({ path: resolve('e2e-shots/home-hide-name/safe-area-375x812.png') })
    }
    console.log(`MEASURE ${size} inset ${top}/${bottom}: ${JSON.stringify(result)}`)
    assert.equal(result.playText, 'Continue board', `${size}: paused board CTA`)
    assert.equal(result.labelCount, 0, `${size}: no visible Home name`)
    assert.ok(result.accessibleCasey, `${size}: suitcase retains its accessible name`)
    for (const [label, pass] of [
      ['suitcase button clears Continue', result.gap >= 0],
      // The SVG's box contains transparent bottom pixels and can protrude
      // past the button box even when its painted suitcase clears the CTA.
      ['Continue clears bottom inset', result.playBottom <= height - bottom],
      ['Continue receives taps', result.tap],
      ['no page overflow', result.scrollHeight <= height],
    ]) if (!pass) failures.push(`${size}: ${label}`)
    await context.close()
  }
  assert.deepEqual(failures, [], 'safe-area Home geometry failures')
  console.log('HOME SAFE-AREA DRIVE OK')
} finally {
  await browser?.close()
  preview.stop()
}
