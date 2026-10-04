// The café-world suitcase (CW-11): every word wears a ring that fills a third
// per mark, words with three marks sit in the lid under "Collected: n of N",
// old wrapped words show with the marks they have, and the tray is the city's
// stamp card (café name and stamp per cell; dashed circle for found but not
// played; "?" for not found; an empty solid circle for a café played with no
// stamp, never Bronze). Retired wrap-up actions stay retired.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4175)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const failures = []
const external = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// The Sønderborg café set as the app reads it: the frozen required boards in
// display order, and each board's café name through CW-08's fixed assignment
// (board id -> café id -> name), as src/cafe/cafeName.ts reads it.
const manifest = JSON.parse(readFileSync(new URL('../src/data/city1-required-board-manifest.da.json', import.meta.url), 'utf8'))
const nameById = Object.fromEntries(JSON.parse(readFileSync(new URL('../src/data/city1-cafe-names.da.json', import.meta.url), 'utf8')).names.map((n) => [n.id, n.name]))
const assignment = JSON.parse(readFileSync(new URL('../src/cafe/city1-cafe-assignment.da.json', import.meta.url), 'utf8')).boards
const cafeNames = manifest.displayOrder.map((id) => nameById[assignment[id]])
const revision = Object.fromEntries(manifest.requiredBoards.map((b) => [b.authoredBoardId, b.contentRevision]))
const boardAt = (i) => {
  const id = manifest.displayOrder[i]
  return { courseId: 'da', cityId: manifest.stableCityId, authoredBoardId: id, contentRevision: revision[id] }
}
const boardKey = (b) => JSON.stringify([b.courseId, b.cityId, b.authoredBoardId, b.contentRevision])

page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith(preview.base) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))

const openSuitcase = async () => {
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  await page.locator('.casey-board-collection').waitFor()
  await page.waitForSelector('.collection-board-slot')
}
const label = async (selector) => (await page.locator(selector).first().innerText()).replace(/\s+/g, ' ').trim()

try {
  // ?collected=20 collects twenty boardable words (a green each way and a
  // photo: three marks). ?wrapped=20 wraps the city's first twenty words the
  // old way, with a green each way and no photo: two marks.
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&collected=20&wrapped=20`, { waitUntil: 'networkidle' })
  await openSuitcase()
  const wrappedOnly = await page.evaluate(() => {
    const srs = JSON.parse(localStorage.getItem('cluecab-srs-v1')).state.stats
    const journey = JSON.parse(localStorage.getItem('cluecab-journey-v2')).state
    return Object.keys(journey.wrapped).filter((id) => !(id in (journey.photos ?? {})) && srs[id]?.greenByClue >= 1 && srs[id]?.greenByGuess >= 1).length
  })

  check('the lid counts words with three marks out of all the city\'s words, connecting words included',
    (await label('.case-panel-lid .case-band-label')).toUpperCase() === 'COLLECTED: 20 OF 147' &&
    await page.locator('.case-panel-lid .case-collected').count() === 12 &&
    await page.locator('.case-panel-lid .case-collected[aria-label$=" 3 of 3: photo, guess, clue"]').count() === 12 &&
    await page.locator('.case-panel-lid .case-collected .case-ring-3').count() === 12,
    await label('.case-panel-lid .case-band-head'))
  check('the lid explains the ring under its label',
    (await label('.case-panel-lid .case-band-note')) === 'A third each for a photo, a guess and a clue')
  check('old wrapped words not collected by marks show above the case with the marks they have (successor of the wrapped lid)',
    wrappedOnly > 0 &&
    (await label('.case-loose .case-band-label')).toUpperCase() === 'STILL OUT THERE: 127' &&
    await page.locator('.case-loose .case-discovered[data-marks="2"][aria-label$=" 2 of 3: guess, clue"]').count() === Math.min(8, wrappedOnly) &&
    await page.locator('.case-loose .case-discovered .case-ring-2').count() === Math.min(8, wrappedOnly) &&
    await page.locator('.case-loose .case-unknown').count() === 8 - Math.min(8, wrappedOnly) &&
    await page.locator('.suitcase-screen .case-wrapped').count() === 0,
    `${wrappedOnly} wrapped-only words`)
  await page.getByRole('button', { name: 'Collected: 20 of 147, next page' }).click()
  check('lid paging reaches the final eight collected words',
    await page.locator('.case-panel-lid .case-collected').count() === 8)
  await page.getByRole('button', { name: 'Collected: 20 of 147, previous page' }).click()

  check('the stamp card is a finite paged 100-café card', await page.locator('.collection-board-slot').count() === 10 && (await page.locator('.collection-pager').innerText()).includes('1/10'))
  check('the stamp card says its city, percentage, next medal and cafés stamped',
    (await label('.collection-summary h2')) === 'Sønderborg stamp card' &&
    (await label('.collection-summary .stamp-card-line')) === '0% · Bronze at 25% · 0 of 100 cafés',
    await label('.collection-summary'))
  check('cafés no walk has found are "?", are not controls, and do not give their names away',
    await page.locator('.stamp-cell-unfound').count() === 10 &&
    await page.locator('button.collection-board-card').count() === 0 &&
    (await page.locator('.stamp-cell-unfound .stamp-cell-name').allInnerTexts()).every((t) => t.trim() === '?') &&
    (await page.locator('.collection-board-card').first().getAttribute('aria-label')) === 'Café 1: not found yet' &&
    !(await label('.collection-board-grid')).includes(cafeNames[0]))
  check('the next-café line sends the player to Sightseeing while the next café is not found',
    (await label('.collection-primary')) === 'Find the next café in Sightseeing.')
  await page.locator('.collection-pager .icon-btn').nth(1).click()
  check('stamp card paging advances to cafés 11–20',
    (await page.locator('.collection-board-card').first().getAttribute('aria-label')) === 'Café 11: not found yet' &&
    (await page.locator('.collection-board-card').last().getAttribute('aria-label')) === 'Café 20: not found yet' &&
    (await page.locator('.collection-pager').innerText()).includes('2/10'))
  await page.locator('.collection-pager .icon-btn').first().click()
  check('stamp card paging returns to café 1', (await page.locator('.collection-pager').innerText()).includes('1/10'))

  // Seed every cell state through the app's own stores: the settlement ledger
  // the board game writes (bests and a completed loss) and the café finds a
  // walk writes. Cafés 1-4 stamped Platinum, Gold, Silver, Bronze; café 5 only
  // ever lost (Bronze, read from the loss); cafés 6-7 found; the café with the longest name found too.
  const longest = cafeNames.reduce((best, name, i) => (name.length > cafeNames[best].length ? i : best), 0)
  await page.evaluate(({ stamped, lost, found, cityKey }) => {
    const facts = { boards: {}, completedLosses: {}, firstPrimaryCompletions: {}, milestones: {}, cityAchievements: {}, tutorialAwards: {}, legacyCredit: { identity: 'danish-city1-legacy-v1', amount: 0 } }
    for (const { key, board, best, requiredSet } of stamped) {
      facts.boards[key] = { board, best, claims: [] }
      // A stamped café was finished as a primary board, as real play records it.
      facts.firstPrimaryCompletions[JSON.stringify(['primary-v1', key])] = { board, requiredSet }
    }
    facts.completedLosses[lost.key] = { board: lost.board, firstPrimary: true }
    localStorage.setItem('cluecab-settlement-v1', JSON.stringify({ schemaVersion: 1, facts, settlements: {} }))
    const journey = JSON.parse(localStorage.getItem('cluecab-journey-v2'))
    journey.state.cafes = { [cityKey]: { found: Object.fromEntries(found.map((id) => [id, 1759600000000])), toward: 0 } }
    localStorage.setItem('cluecab-journey-v2', JSON.stringify(journey))
  }, {
    stamped: ['platinum', 'gold', 'silver', 'bronze'].map((best, i) => ({
      key: boardKey(boardAt(i)), board: boardAt(i), best,
      requiredSet: { courseId: 'da', cityId: manifest.stableCityId, setVersion: manifest.boardSetVersion },
    })),
    lost: { key: boardKey(boardAt(4)), board: boardAt(4) },
    found: [5, 6, longest].map((i) => boardAt(i).authoredBoardId),
    cityKey: JSON.stringify(['da', manifest.stableCityId]),
  })
  await page.goto(`${preview.base}?mock=1&howto=0`, { waitUntil: 'networkidle' })
  await openSuitcase()
  const cell = (i) => page.locator('.collection-board-slot').nth(i)
  const tiers = ['platinum', 'gold', 'silver', 'bronze']
  const stampedOk = []
  for (const [i, tier] of tiers.entries()) {
    stampedOk.push(
      (await cell(i).getAttribute('class')).includes(`stamp-cell-stamped tier-${tier}`) &&
      await cell(i).locator(`button.collection-board-card .cafe-stamp-${tier}`).count() === 1 &&
      (await cell(i).locator('.collection-board-card').getAttribute('aria-label')) === `${cafeNames[i]}: ${tier[0].toUpperCase()}${tier.slice(1)} stamp`)
  }
  check('stamped cafés show their name and their stamp in tier ink, as replay controls', stampedOk.every(Boolean), JSON.stringify(stampedOk))
  // A completed loss earns a Bronze stamp (owner, 2026-10-04, CW-03b).
  check('a café only ever lost shows Bronze, still replayable',
    (await cell(4).getAttribute('class')).includes('stamp-cell-stamped tier-bronze') &&
    await cell(4).locator('button.collection-board-card .cafe-stamp-bronze').count() === 1 &&
    await cell(4).locator('.cafe-stamp-empty').count() === 0 &&
    await page.locator('.stamp-cell-no-stamp, .cafe-stamp-none').count() === 0 &&
    (await cell(4).locator('.collection-board-card').getAttribute('aria-label')) === `${cafeNames[4]}: Bronze stamp` &&
    (await cell(4).locator('small').innerText()).trim().toUpperCase() === 'BRONZE')
  check('found cafés show their name and a dashed circle, and are not controls',
    await page.locator('.stamp-cell-found').count() === 2 &&
    await page.locator('.stamp-cell-found span.collection-board-card .cafe-stamp-empty').count() === 2 &&
    (await cell(5).locator('.collection-board-card').getAttribute('aria-label')) === `${cafeNames[5]}: found, not played yet`)
  check('the rest are still "?"', await page.locator('.stamp-cell-unfound').count() === 3)
  check('the card counts the stamps, the lost café as Bronze: 11 of 400 points is 2%',
    (await label('.collection-summary .stamp-card-line')) === '2% · Bronze at 25% · 5 of 100 cafés',
    await label('.collection-summary .stamp-card-line'))
  check('the next-café line names the next café once it is found',
    (await label('.collection-primary')) === `Next café: ${cafeNames[5]}`, await label('.collection-primary'))

  // The replay path is the old one: a played café opens its detail, whose
  // replay control is the shared luggage tag.
  await cell(4).locator('button.collection-board-card').click()
  await page.waitForSelector('.collection-detail[open]')
  check('a played café opens its detail with the stamp in words and a replay tag',
    (await label('.collection-detail h3')) === 'Bronze stamp' &&
    (await label('.collection-detail p')) === cafeNames[4] &&
    await page.locator('.collection-detail button.tag').count() === 1)
  await page.locator('.collection-detail .icon-btn').click()
  await page.waitForSelector('.collection-detail', { state: 'detached' })

  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(50)
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null
      const screen = rect('.suitcase-screen')
      const lid = rect('.case-panel-lid')
      const tray = rect('.case-panel-tray')
      const summary = rect('.collection-summary')
      const summaryCopy = document.querySelector('.collection-summary-copy')
      const pager = rect('.collection-pager')
      const grid = rect('.collection-board-grid')
      const trayBox = document.querySelector('.case-panel-tray')
      const collection = document.querySelector('.casey-board-collection')
      const gridBox = document.querySelector('.collection-board-grid')
      const handle = rect('.case-handle')
      const cards = [...document.querySelectorAll('.collection-board-card')].map((node) => node.getBoundingClientRect())
      const looseSlots = [...document.querySelectorAll('.case-loose .case-slot')].map((node) => node.getBoundingClientRect())
      const handleLooseOverlapArea = handle ? looseSlots.reduce((area, slot) => {
        const width = Math.max(0, Math.min(handle.right, slot.right) - Math.max(handle.left, slot.left))
        const height = Math.max(0, Math.min(handle.bottom, slot.bottom) - Math.max(handle.top, slot.top))
        return area + width * height
      }, 0) : -1
      const cardContentOverflow = [...document.querySelectorAll('.collection-board-card')].filter((card) => card.scrollHeight > card.clientHeight + 1).length
      // A café name may take two lines and then ends; its stamp must stay visible below it.
      const names = [...document.querySelectorAll('.stamp-cell-name')]
      const namesOverTwoLines = names.filter((n) => n.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(n).lineHeight) + 1).length
      const stampsTooSmall = [...document.querySelectorAll('.stamp-cell-mark')].filter((s) => s.getBoundingClientRect().height < 12).length
      const tileWordsClipped = [...document.querySelectorAll('.case-tile-word')].filter((w) => w.scrollWidth > w.clientWidth + 1).length
      const ringsOutside = [...document.querySelectorAll('.case-tile .case-ring')].filter((r) => {
        const box = r.getBoundingClientRect()
        const tile = r.closest('.case-tile').getBoundingClientRect()
        return box.left < tile.left - .5 || box.right > tile.right + .5
      }).length
      const minCardWidth = cards.length ? Math.min(...cards.map((box) => box.width)) : 0
      const minCardHeight = cards.length ? Math.min(...cards.map((box) => box.height)) : 0
      const outside = screen ? cards.filter((box) => box.left < screen.left - .5 || box.right > screen.right + .5) : []
      const rows = new Set(cards.map((box) => Math.round(box.top)))
      const columns = new Set(cards.map((box) => Math.round(box.left)))
      return {
        viewport: `${innerWidth}x${innerHeight}`,
        lidHeight: lid?.height ?? 0,
        trayHeight: tray?.height ?? 0,
        minCardWidth,
        minCardHeight,
        rows: rows.size,
        columns: columns.size,
        outside: outside.length,
        handleLooseOverlapArea,
        cardContentOverflow,
        namesOverTwoLines,
        stampsTooSmall,
        tileWordsClipped,
        ringsOutside,
        summaryOverflow: !!summaryCopy && (summaryCopy.scrollWidth > summaryCopy.clientWidth + 1 || summaryCopy.scrollHeight > summaryCopy.clientHeight + 1),
        summaryOverlapsPager: !!summary && !!pager && summaryCopy.getBoundingClientRect().right > pager.left + .5,
        gridOutsideTray: !!grid && !!tray && (grid.top < tray.top || grid.bottom > tray.bottom + .5),
        trayScroll: trayBox ? [trayBox.scrollHeight, trayBox.clientHeight] : null,
        collectionScroll: collection ? [collection.scrollHeight, collection.clientHeight] : null,
        gridScroll: gridBox ? [gridBox.scrollHeight, gridBox.clientHeight] : null,
        trayScrollOverflow: !!trayBox && trayBox.scrollHeight > trayBox.clientHeight + 1,
        documentOverflow: document.documentElement.scrollWidth > innerWidth || document.scrollingElement.scrollHeight > innerHeight,
      }
    })
    check(`${geometry.viewport} case keeps a full tray below the lid`,
      geometry.lidHeight > geometry.trayHeight && (viewport.height > 650 || (geometry.trayHeight >= 190 && geometry.trayHeight <= 205)),
      JSON.stringify(geometry),
    )
    check(`${geometry.viewport} handle rectangle does not intersect any loose-word slot`,
      geometry.handleLooseOverlapArea === 0,
      `${geometry.handleLooseOverlapArea}px² total intersection`,
    )
    check(`${geometry.viewport} summary, 5×2 cells, 44px targets and page fit`,
      geometry.minCardWidth >= 44 && geometry.minCardHeight >= 44 && geometry.rows === 2 && geometry.columns === 5 && geometry.outside === 0 &&
      geometry.cardContentOverflow === 0 &&
      !geometry.summaryOverflow && !geometry.summaryOverlapsPager && !geometry.gridOutsideTray &&
      !geometry.trayScrollOverflow && !geometry.documentOverflow,
      JSON.stringify(geometry),
    )
    check(`${geometry.viewport} café names stop at two lines, stamps stay visible, rings and words fit their tiles`,
      geometry.namesOverTwoLines === 0 && geometry.stampsTooSmall === 0 && geometry.ringsOutside === 0 && geometry.tileWordsClipped === 0,
      JSON.stringify({ names: geometry.namesOverTwoLines, stamps: geometry.stampsTooSmall, rings: geometry.ringsOutside, words: geometry.tileWordsClipped }),
    )
    await page.screenshot({ path: `${process.env.SHOT_DIR ?? '.'}/c1-15-casey-collection-${viewport.width}.png` })
  }

  // The longest default café name: clamped on the card, whole for the screen reader.
  for (let i = 0; i < Math.floor(longest / 10); i++) await page.locator('.collection-pager .icon-btn').nth(1).click()
  const longName = await page.locator('.collection-board-slot').nth(longest % 10).evaluate((slot) => {
    const name = slot.querySelector('.stamp-cell-name')
    const style = getComputedStyle(name)
    return { label: slot.querySelector('.collection-board-card').getAttribute('aria-label'), clamp: style.webkitLineClamp, height: name.getBoundingClientRect().height, line: parseFloat(style.lineHeight) }
  })
  check('a long café name wraps to two lines and then ends, while the screen reader hears it whole',
    longName.label === `${cafeNames[longest]}: found, not played yet` && longName.clamp === '2' && longName.height <= 2 * longName.line + 1,
    JSON.stringify(longName))

  const body = await page.locator('.suitcase-screen').innerText()
  check('no retired wrap-up or packing copy remains in the case', !/pack the board|continue wrap-up|translation postcard|wrapped/i.test(body), body.replace(/\s+/g, ' ').slice(0, 200))
  check('zero external requests', external.length === 0, external.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nSUITCASE BOARD DRIVE OK')
if (failures.length) process.exitCode = 1
