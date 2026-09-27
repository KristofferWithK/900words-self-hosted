// The retired wrap-up actions stay retired, while legacy wrapped words remain
// readable in the lid and the durable board ledger occupies the lower tray.
import { chromium } from 'playwright'
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

page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith(preview.base) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))

try {
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&collected=20&wrapped=20`, { waitUntil: 'networkidle' })
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  await page.locator('.casey-board-collection').waitFor()
  await page.waitForSelector('.collection-board-slot')
  check('loose words retain their own page and undiscovered words',
    await page.locator('.case-loose .case-unknown').count() === 8 &&
    await page.locator('.case-loose .case-wrapped').count() === 0 &&
    (await page.locator('.case-loose .case-band-label').innerText()).includes('STILL OUT THERE: 76'),
  )
  check('legacy wrapped words remain in the lid with their wrapped accessible name',
    await page.locator('.case-panel-lid .case-wrapped').count() === 12 &&
    (await page.locator('.case-panel-lid .case-band-label').innerText()).includes('COLLECTED: 24') &&
    await page.locator('.case-panel-lid .case-wrapped[aria-label$=", wrapped"]').count() === 12,
  )
  await page.getByRole('button', { name: 'Collected: 24, next page' }).click()
  check('lid paging reaches the final eight legacy wrapped words',
    await page.locator('.case-panel-lid .case-wrapped').count() === 8 &&
    await page.locator('.case-panel-lid .case-collected').count() === 4,
  )
  await page.getByRole('button', { name: 'Collected: 24, previous page' }).click()
  check('Casey has a finite paged 100-board collection', await page.locator('.collection-board-slot').count() === 10 && await page.locator('.collection-pager').count() === 1 && (await page.locator('.collection-pager').innerText()).includes('1/10'))
  check('unplayed collection cells are not illegal launch buttons', await page.locator('.collection-board-unplayed').count() === 10 && await page.locator('button.collection-board-card').count() === 0)
  check('every miniature board face is exactly a 3-by-6 grid',
    await page.locator('.collection-board-face').count() === 10 &&
    await page.locator('.collection-board-cell').count() === 180,
  )
  check('collection summary retains city medal and primary-board status',
    (await page.locator('.collection-summary').innerText()).includes('City medal: Unplayed') &&
    (await page.locator('.collection-summary').innerText()).includes('Next primary board: 1'),
  )
  await page.locator('.collection-pager .icon-btn').nth(1).click()
  check('board collection paging advances to board 11',
    (await page.locator('.collection-board-card').first().innerText()).includes('11'),
  )
  check('second collection page contains boards 11–20',
    (await page.locator('.collection-board-card b').first().innerText()) === '11' &&
    (await page.locator('.collection-board-card b').last().innerText()) === '20' &&
    (await page.locator('.collection-pager').innerText()).includes('2/10'),
  )
  await page.locator('.collection-pager .icon-btn').first().click()
  check('collection paging returns to board 1',
    (await page.locator('.collection-board-card b').first().innerText()) === '01' &&
    (await page.locator('.collection-pager').innerText()).includes('1/10'),
  )

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
    check(`${geometry.viewport} summary, 5×2 cards, 44px targets and page fit`,
      geometry.minCardWidth >= 44 && geometry.minCardHeight >= 44 && geometry.rows === 2 && geometry.columns === 5 && geometry.outside === 0 &&
      geometry.cardContentOverflow === 0 &&
      !geometry.summaryOverflow && !geometry.summaryOverlapsPager && !geometry.gridOutsideTray &&
      !geometry.trayScrollOverflow && !geometry.documentOverflow,
      JSON.stringify(geometry),
    )
    await page.screenshot({ path: `${process.env.SHOT_DIR ?? '.'}/c1-15-casey-collection-${viewport.width}.png` })
  }
  const body = await page.locator('.suitcase-screen').innerText()
  check('no retired wrap-up or packing copy remains in the case', !/pack the board|continue wrap-up|translation postcard/i.test(body), body.replace(/\s+/g, ' ').slice(0, 200))
  check('zero external requests', external.length === 0, external.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nSUITCASE BOARD DRIVE OK')
if (failures.length) process.exitCode = 1
