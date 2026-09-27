// T7's city context and the Guide contract in the built app, and Travel back.
// The state assertions deliberately read persisted stores as well as labels:
// a Home that says "Sønderborg" is not evidence that its deal stayed in
// Sønderborg after reload.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { stopDots, tapStop } from './map-stops.mjs'

const PORT = 4193
const preview = await startPreview(PORT)
const bundled = '/opt/pw-browsers/chromium'
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? (existsSync(bundled) ? bundled : windowsChrome),
})
const context = await browser.newContext({ viewport: { width: 360, height: 640 } })
const page = await context.newPage()
await installRoundGuidanceHandler(page)
const errors = []
const failed = []
page.on('pageerror', (error) => errors.push(error.message))
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}
const stored = (key) => page.evaluate((name) => JSON.parse(localStorage.getItem(name) ?? '{}').state, key)

// City four gives both a visited city and a genuinely future one. ?mock is an
// explicit local drive seam; the unit path separately pins that ordinary
// revisit rounds keep the normal model-backed Casey setting in production.
await page.goto(`${preview.base}?howto=0&mock=1&city=3&learned=30`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.home-screen')
await page.locator('.map-button').click()
await page.waitForSelector('.map-screen')

// ---- every stop is reachable, which is what the panel below the map needs.
//
// "Look ahead" and "Travel ahead" only exist for a stop AHEAD of you, so a map
// you cannot select a far stop on is a map those buttons are simply not on.
// That is what it was: nine transparent r=58 circles, in VIEW units, over a
// drawing scaled to whatever height the screen has left. Measured here, at
// 360x640, with a 44px tap centred on each dot — 16-29% of it selected the
// right stop and 47-75% selected nothing at all, while at 390x844 Roskilde
// lost 57% of its own tap to København, whose overlapping circle was painted
// later. See nearestStop in src/journey/map.ts.
//
// Two ways to the same place now, and both are asserted: a tap on the map
// (nearest stop wins, no gaps and no overlaps at any scale) and the stepper
// beside the stop's name, which is ordinary 42px buttons and does not depend
// on the drawing's size at all.
{
  const dots = await stopDots(page)
  const tapped = []
  for (const dot of dots) {
    await tapStop(page, { index: dot.index })
    tapped.push((await page.locator('.city-name').innerText()).trim())
  }
  const names = dots.map((d) => d.label.split(',')[0])
  check(
    'a tap on each stop selects that stop at 360x640',
    tapped.length === names.length && tapped.every((n, i) => n === names[i]),
    `${tapped.join(' ')} vs ${names.join(' ')}`,
  )

  const walk = []
  while (await page.getByRole('button', { name: 'Previous stop' }).isEnabled()) {
    await page.getByRole('button', { name: 'Previous stop' }).click()
  }
  for (;;) {
    walk.push((await page.locator('.city-name').innerText()).trim())
    const next = page.getByRole('button', { name: 'Next stop' })
    if (!(await next.isEnabled())) break
    await next.click()
  }
  check(
    'the stepper walks the whole route without touching the map',
    walk.length === names.length && walk.every((n, i) => n === names[i]),
    walk.join(' > '),
  )
}
await tapStop(page, { matching: '.map-city-current' })

const journeyBefore = await stored('cluecab-journey-v2')
const currentName = await page.locator('.map-city-current .map-hit').getAttribute('aria-label')
// The stop you stand in has no buttons in its card (owner, 2026-09-05): Play
// is Home's, one back-arrow away, and the chapter is the ride's and the
// Guide's. What the card keeps is the train and the counts.
check('the current city offers neither a board nor a lesson of its own',
  !!currentName && (await page.getByRole('button', { name: /^Play / }).count()) === 0 &&
  (await page.getByRole('button', { name: 'Train lesson' }).count()) === 0 &&
  (await page.locator('.map-detail .train-progress, .map-detail .train-board').count()) === 1)

// A visited stop offers no board and no lesson of its own either (owner,
// 2026-09-05): playing a city you have left means travelling back to it and
// pressing Play at home — asserted below, after Travel back — and its chapter
// is in the Travel Guide. What the stop keeps is the train back to it.
const past = await tapStop(page, { matching: '.map-city-visited' })
const pastName = past.label.split(',')[0]
check('a visited stop offers no board and no lesson of its own',
  (await page.getByRole('button', { name: 'Train lesson' }).count()) === 0 &&
  (await page.getByRole('button', { name: /^Play / }).count()) === 0 &&
  (await page.getByRole('button', { name: `Travel back → ${pastName}` }).count()) === 1)
check('looking at a visited stop does not move the route marker',
  (await stored('cluecab-journey-v2')).cityIndex === journeyBefore.cityIndex)

// Back to Home, then prove the map card has two sibling actions and that the
// Guide opens as a fixed pocket guide.
await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
await page.waitForSelector('.home-screen')
check('Home map has sibling Guide control',
  (await page.locator('.home-map-controls > .map-button').count()) === 1 &&
  (await page.locator('.home-map-controls > .home-guide-button').count()) === 1)
await page.locator('.home-guide-button').click({ force: true })
await page.waitForSelector('.travel-guide-book', { timeout: 5_000 })
check('Guide opens as a fixed physical book with only its two sections',
  (await page.locator('.travel-guide-book.guide-cover-screen').count()) === 1 &&
  (await page.locator('.guide-section-card').count()) === 0 &&
  (await page.locator('.guide-cover-tabs-row .guide-thumb-index').count()) === 2 &&
  (await page.getByText('Practice', { exact: true }).count()) === 0)
check('Guide has no inner scrolling region', await page.evaluate(() =>
  document.scrollingElement.scrollHeight <= innerHeight &&
  getComputedStyle(document.querySelector('.travel-guide-book')).overflowY !== 'auto'))
await page.locator('.guide-section-grammar').click()
await page.locator('.guide-city-row').first().click()
check('Guide chapter opens directly on its first reader page', (await page.locator('.book-reader').count()) === 1 && (await page.locator('.book-page-body').count()) === 1 && (await page.getByRole('button', { name: 'Open book' }).count()) === 0)
await page.getByRole('button', { name: 'Back to Grammar index' }).click()
await page.getByRole('button', { name: 'Back to Travel Guide cover' }).click()

await page.getByRole('button', { name: 'Back from Travel Guide' }).click()
await page.waitForSelector('.home-screen', { timeout: 5_000 })
await page.locator('.map-button').click()
await tapStop(page, { matching: '.map-city-ahead', pick: 'last' })
const beforeLookAheadJourney = await stored('cluecab-journey-v2')
const beforeGuide = await stored('cluecab-curriculum-v1')
check('future city exposes no word-board action', (await page.getByRole('button', { name: /^Play / }).count()) === 0)
check('normal build exposes no developer Travel ahead action, nor its switch',
  (await page.getByRole('button', { name: 'Travel ahead', exact: true }).count()) === 0 &&
  (await page.getByRole('button', { name: 'Enable Travel ahead' }).count()) === 0)
await page.getByRole('button', { name: 'Look ahead' }).click()
await page.waitForSelector('.guide-grammar-reader', { timeout: 5_000 })
const lookAheadReader = {
  context: await page.locator('.book-page-context').innerText(),
  currentGuide: await page.locator('.travel-guide-book.guide-grammar-reader').count(),
  oldTrainReader: await page.locator('.train-lesson-reader').count(),
  indexes: await page.locator('.guide-thumb-index').count(),
  document: await page.evaluate(() => document.scrollingElement.scrollHeight),
  viewport: await page.evaluate(() => innerHeight),
}
check('future city opens its chapter in the current pocket Travel Guide',
  lookAheadReader.context.toLocaleLowerCase('da').includes('københavn grammar') &&
  lookAheadReader.currentGuide === 1 &&
  lookAheadReader.oldTrainReader === 0 &&
  lookAheadReader.indexes === 2 &&
  lookAheadReader.document <= lookAheadReader.viewport + 1,
  JSON.stringify(lookAheadReader))
check('Look ahead creates no route unlock or curriculum evidence',
  JSON.stringify(await stored('cluecab-journey-v2')) === JSON.stringify(beforeLookAheadJourney) &&
  JSON.stringify(await stored('cluecab-curriculum-v1')) === JSON.stringify(beforeGuide))
await page.getByRole('button', { name: 'Back to Grammar index' }).click()
await page.getByRole('button', { name: 'Back to Travel Guide cover' }).click()
await page.getByRole('button', { name: 'Back from Travel Guide' }).click()
await page.waitForSelector('.map-screen')
check('closing the map preview returns to the selected city on the map',
  (await page.locator('.map-city-selected .map-hit').getAttribute('aria-label'))?.startsWith('København') === true)

// ---- Travel back.
//
// "Play again" changes the board and leaves the traveller where they are; this
// moves them. A stop already reached offers the train back to it — the same
// ride and the same arrival as first time, no gate — and once they have gone
// back, the city they came from is still a VISITED stop rather than a locked
// one, with the train on to it. Neither direction may touch the suitcase or
// the travel log, and neither may reach a stop the traveller never reached:
// the last stop stays ahead throughout.
{
  const startName = currentName.split(',')[0]
  const before = await stored('cluecab-journey-v2')
  await tapStop(page, { matching: '.map-city-visited' })
  const back = page.getByRole('button', { name: `Travel back → ${pastName}` })
  check('a visited stop offers the train back to it', (await back.count()) === 1)
  await back.click()
  await page.waitForSelector('.ride-screen')
  await page.click('.ride-skip')
  await page.waitForSelector('.arrival-city')
  check('the arrival names the city travelled back to',
    (await page.locator('.arrival-city').textContent())?.trim() === pastName)
  check('and says the words are already packed rather than promising new ones',
    /already|still/i.test((await page.locator('.arrival-unlock').textContent()) ?? ''))
  const wentBack = await stored('cluecab-journey-v2')
  check('Travel back moves the traveller and remembers how far they had got',
    wentBack.cityIndex === 0 && wentBack.furthest === before.cityIndex,
    JSON.stringify({ cityIndex: wentBack.cityIndex, furthest: wentBack.furthest }))
  check('Travel back touches neither the suitcase nor the travel log',
    JSON.stringify(wentBack.wrapped) === JSON.stringify(before.wrapped) &&
    JSON.stringify(wentBack.arrivedAt) === JSON.stringify(before.arrivedAt))
  await page.click('.arrival-screen .btn:not(.btn-primary)')
  await page.waitForSelector('.map-screen')

  // Play at home now deals the city travelled back to — the board that "Play
  // ⟨city⟩ again" used to deal from the map — and keeps its city context in
  // the persisted store, so a reload cannot quietly re-deal from elsewhere.
  await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.home-play').click()
  await page.waitForSelector('.game-screen')
  const replay = await stored('cluecab-game-v1')
  check('Play after Travel back deals the city travelled back to',
    replay.boardCityIndex === 0, JSON.stringify(replay.boardCityIndex))
  check('and that board uses only that city\'s pool',
    Array.isArray(replay.game?.words) && replay.game.words.every((word) => /^da:/.test(word.wordId)),
    String(replay.game?.words?.[0]?.wordId))
  check('and playing there does not move the route marker',
    (await stored('cluecab-journey-v2')).cityIndex === 0)
  await page.getByRole('button', { name: 'Home' }).click()
  await page.getByRole('button', { name: 'Pause game' }).click()
  await page.waitForSelector('.home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')

  // The suitcase belongs to the city you are standing in, and forgets nothing.
  // Back in the first city it opens on that city — which looks empty, since
  // the thirty collected words were seeded in the city travelled back FROM —
  // while that city keeps its chip, and its thirty are one tap away. Before
  // Travel back the chip row stopped at the position, so the city just left
  // would have vanished from the case together with its words.
  await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  const chips = await page.locator('.case-filter .chip').allTextContents()
  check('the suitcase offers every city reached, not only those behind you',
    chips.length === before.cityIndex + 2 && chips[0] === 'All' && chips.at(-1) === startName,
    chips.join(' | '))
  check('and opens on the city you are standing in',
    (await page.locator('.case-filter .chip-on').textContent())?.trim() === pastName &&
    (await page.locator('.case-filter .chip-home').textContent())?.trim() === pastName)
  const band = (text) => page.locator('.case-band-label', { hasText: text })
  check('which looks empty, because nothing was collected there',
    (await band(/^Collected: 0$/).count()) === 1 &&
    (await page.locator('.case-tile.case-collected').count()) === 0)
  await page.locator('.case-filter .chip', { hasText: startName }).click()
  check('while the city travelled back from still holds its thirty',
    (await band(/^Collected: 30$/).count()) === 1 &&
    (await page.locator('.case-tile.case-collected').count()) > 0,
    (await page.locator('.case-band-label').allTextContents()).join(' | '))
  await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')

  const dots = await stopDots(page)
  check('the stop travelled back from is visited, not locked',
    dots[before.cityIndex]?.className.includes('map-city-visited') === true &&
    dots[0]?.className.includes('map-city-current') === true,
    dots.map((d) => d.className).join(' | '))
  check('the last stop is still ahead', dots.at(-1)?.className.includes('map-city-ahead') === true)
  await tapStop(page, { index: before.cityIndex })
  const onward = page.getByRole('button', { name: `Travel on → ${startName}` })
  check('a reached stop ahead offers the train on to it, and no board of its own',
    (await page.getByRole('button', { name: /^Play / }).count()) === 0 &&
    (await onward.count()) === 1)
  await onward.click()
  await page.waitForSelector('.ride-screen')
  await page.click('.ride-skip')
  await page.waitForSelector('.arrival-city')
  await page.click('.arrival-screen .btn:not(.btn-primary)')
  await page.waitForSelector('.map-screen')
  const returned = await stored('cluecab-journey-v2')
  check('Travel on again lands where the traveller had got to, with the log intact',
    returned.cityIndex === before.cityIndex &&
    JSON.stringify(returned.arrivedAt) === JSON.stringify(before.arrivedAt) &&
    JSON.stringify(returned.wrapped) === JSON.stringify(before.wrapped),
    JSON.stringify(returned.cityIndex))
  await tapStop(page, { matching: '.map-city-ahead', pick: 'last' })
  check('an unreached stop still has no train to it',
    (await page.getByRole('button', { name: /^Travel (back|on) → / }).count()) === 0 &&
    (await page.getByRole('button', { name: /^Play / }).count()) === 0)
}
check('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
preview.stop()
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nREVISIT DRIVE OK')
if (failed.length) process.exitCode = 1
