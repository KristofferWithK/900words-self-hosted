// The Guide is one fixed, pencil-drawn pocket guide on a warm-paper canvas.
// A city choice opens real content immediately; all nine cities remain visible
// on each section's contents page. This drive sweeps every authored page.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4297)
const bundled = '/opt/pw-browsers/chromium'
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync(bundled) ? bundled : windowsChrome) })
const context = await browser.newContext({ viewport: { width: 360, height: 640 } })
const page = await context.newPage()
const failed = []
const check = (name, value, detail = '') => { console.log(`${value ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!value) failed.push(name) }

const cities = ['Sønderborg', 'Ribe', 'Kolding', 'Aarhus', 'Aalborg', 'Skagen', 'Odense', 'Roskilde', 'København']
const lessonCounts = [1, 2, 2, 2, 2, 2, 2, 3, 2]
let fixedMeasurements = 0
let grammarPages = 0
let survivalPages = 0
const scrollingPaperPages = []

async function fixed(name) {
  const measured = await page.evaluate(() => {
    const inspect = (element) => {
      if (!element) return null
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return { scroll: element.scrollHeight, client: element.clientHeight, overflowY: style.overflowY, top: rect.top, bottom: rect.bottom }
    }
    const nodes = {
      document: inspect(document.scrollingElement),
      reader: inspect(document.querySelector('.book-reader')),
      paper: inspect(document.querySelector('.book-page, .guide-cover-hero')),
    }
    const failures = []
    for (const key of ['document', 'reader']) {
      const node = nodes[key]
      if (node && (node.scroll > node.client + 1 || node.top < -1 || node.bottom > innerHeight + 1)) failures.push([key, node])
    }
    const paper = nodes.paper
    const readerPage = document.querySelector('.book-page')
    if (paper && (paper.top < -1 || paper.bottom > innerHeight + 1 || (readerPage && paper.scroll > paper.client + 1 && !['auto', 'scroll'].includes(paper.overflowY)))) failures.push(['paper', paper])
    return { failures, paperScrolls: !!readerPage && !!paper && paper.scroll > paper.client + 1 }
  })
  fixedMeasurements++
  if (measured.paperScrolls) scrollingPaperPages.push(name)
  check(name, measured.failures.length === 0, JSON.stringify(measured.failures))
}

async function openGuide(section) {
  await page.goto(`${preview.base}?howto=0&mock=1&city=8`, { waitUntil: 'domcontentloaded' })
  await page.locator('.home-guide-button').click()
  await page.waitForSelector('.travel-guide-book')
  await page.locator(`.guide-section-${section.toLowerCase()}`).click()
}

await page.goto(`${preview.base}?howto=0&mock=1&city=8`, { waitUntil: 'domcontentloaded' })
await page.locator('.home-guide-button').click()
check('cover uses its two large indexes as the only section choices', await page.locator('.guide-cover-tabs-row .guide-thumb-index').count() === 2 && await page.locator('.guide-section-card').count() === 0 && await page.getByText('Practice', { exact: true }).count() === 0)
check('cover indexes look out from behind the book without covering its face', await page.evaluate(() => {
  const coverNode = document.querySelector('.guide-cover-hero')
  const indexesNode = document.querySelector('.guide-cover-tabs-row > .guide-thumb-indexes')
  const grammarNode = document.querySelector('.guide-cover-tabs-row .guide-thumb-grammar')
  const cover = coverNode?.getBoundingClientRect()
  const indexes = indexesNode?.getBoundingClientRect()
  return !!cover && !!indexes && indexes.top < cover.top - 44 &&
    indexes.bottom >= cover.top + 8 && indexes.bottom <= cover.top + 12 &&
    Number(getComputedStyle(grammarNode).zIndex) < Number(getComputedStyle(coverNode).zIndex)
}))
check('back arrow shares the white top row to the left of Grammar', await page.evaluate(() => {
  const back = document.querySelector('.guide-cover-tabs-row .book-back')?.getBoundingClientRect()
  const grammar = document.querySelector('.guide-cover-tabs-row .guide-thumb-grammar')?.getBoundingClientRect()
  return !!back && !!grammar && back.right < grammar.left && Math.abs(back.top - grammar.top) < 8
}))
check('cover title header and DK badge are removed', await page.getByText('Travel Guide', { exact: true }).count() === 0 && await page.getByText('DK', { exact: true }).count() === 0)
check('cover indexes carry the retired cards useful labels', await page.getByText('How Danish works', { exact: true }).count() === 1 && await page.getByText('What to say out there', { exact: true }).count() === 1)
check('cover thumb indexes use the reference-led peach and sage cards', await page.evaluate(() => {
  const grammar = getComputedStyle(document.querySelector('.guide-thumb-grammar')).backgroundColor
  const survival = getComputedStyle(document.querySelector('.guide-thumb-survival')).backgroundColor
  return grammar === 'rgb(221, 168, 135)' && survival === 'rgb(175, 195, 154)'
}))
check('beige pocket guide sits on the game white', await page.evaluate(() => {
  const shell = getComputedStyle(document.querySelector('.travel-guide-book')).backgroundColor
  const cover = getComputedStyle(document.querySelector('.guide-cover-hero')).backgroundColor
  return shell === 'rgb(255, 255, 255)' && cover === 'rgb(242, 238, 227)'
}))
check('cover carries a broken hand-drawn travel route through its open middle', await page.evaluate(() => {
  const route = document.querySelector('.guide-cover-route path:first-child')
  const style = route ? getComputedStyle(route) : null
  return !!route && !!style && style.strokeDasharray !== 'none'
}))
check('cover balances its green route and origin with an orange arrow and city seal', await page.evaluate(() => {
  const sticker = document.querySelector('.guide-cover-sticker')
  const start = document.querySelector('.guide-cover-route circle')
  const arrow = document.querySelector('.guide-cover-route-arrow')
  const route = document.querySelector('.guide-cover-route path:first-child')
  if (!sticker || !start || !arrow || !route) return false
  const orange = 'rgb(183, 110, 73)'
  return getComputedStyle(sticker).color === orange &&
    getComputedStyle(sticker).borderTopColor === orange &&
    getComputedStyle(start).stroke !== orange &&
    getComputedStyle(arrow).stroke === orange &&
    getComputedStyle(route).stroke !== orange
}))
check('Casey clears the cover bottom rule', await page.evaluate(() => {
  const cover = document.querySelector('.guide-cover-hero')?.getBoundingClientRect()
  const casey = document.querySelector('.guide-cover-casey')
  const marks = casey ? [...casey.querySelectorAll('path, line, rect, circle, ellipse, polygon')].map((node) => node.getBoundingClientRect()).filter((rect) => rect.width || rect.height) : []
  const paintedBottom = marks.length ? Math.max(...marks.map((rect) => rect.bottom)) : Infinity
  return !!cover && cover.bottom - paintedBottom >= 8
}))
await fixed('Travel Guide cover stays inside the phone')

await page.locator('.guide-cover-hero').click()
check('tapping the cover opens the Grammar contents', await page.locator('.guide-thumb-grammar[aria-current="page"]').count() === 1 && await page.locator('.guide-city-row').count() === 9)
await page.getByRole('button', { name: 'Back to Travel Guide cover' }).click()

await page.locator('.guide-section-grammar').click()
check('Grammar contents shows all nine cities without a redundant count pill', await page.locator('.guide-city-row').count() === 9 && await page.getByText('ALL 9 CITIES', { exact: true }).count() === 0)
check('Grammar index stays large and marks the current section', await page.locator('.guide-thumb-grammar[aria-current="page"]').count() === 1 && await page.locator('.guide-thumb-grammar').evaluate((node) => node.getBoundingClientRect().height >= 58))
check('Grammar joins its orange paper while Survival stays behind the black book edge', await page.evaluate(() => {
  const grammar = document.querySelector('.guide-thumb-grammar')
  const survival = document.querySelector('.guide-thumb-survival')
  const paper = document.querySelector('.book-page')
  if (!grammar || !survival || !paper) return false
  const paperStyle = getComputedStyle(paper)
  const borderStyle = getComputedStyle(paper, '::before')
  const tabOutlineStyle = getComputedStyle(grammar, '::before')
  const connector = grammar.querySelector('.guide-thumb-connectors')
  const context = paper.querySelector('.book-page-context')
  const grammarRect = grammar.getBoundingClientRect()
  const paperRect = paper.getBoundingClientRect()
  const contextRect = context?.getBoundingClientRect()
  return Number(getComputedStyle(grammar).zIndex) > Number(paperStyle.zIndex) &&
    Number(getComputedStyle(survival).zIndex) < Number(paperStyle.zIndex) &&
    paperStyle.backgroundImage.includes('221, 168, 135') &&
    paperStyle.backgroundImage.includes('18, 18, 18') &&
    paperStyle.backgroundPosition.includes('15px') &&
    paperStyle.backgroundSize.includes('100%') &&
    Number.parseFloat(paperStyle.borderTopLeftRadius) > 0 &&
    Number.parseFloat(paperStyle.borderTopRightRadius) > 0 &&
    !!contextRect && contextRect.top - (paperRect.top + 16.7) >= 6 &&
    Math.abs((paperRect.width - 70) / 2 - grammarRect.width) < 2 &&
    Math.abs((grammarRect.bottom - Number.parseFloat(tabOutlineStyle.bottom)) - (paperRect.top + 2)) < 1 &&
    !!connector && getComputedStyle(connector).display === 'block' &&
    getComputedStyle(connector, '::before').borderBottomRightRadius === '8px' &&
    borderStyle.borderTopColor === 'rgb(18, 18, 18)'
}))
await fixed('Grammar nine-city contents')
const grammarCurrentOutline = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.guide-city-row')]
  const current = rows.filter((row) => row.classList.contains('is-current-city'))
  if (current.length !== 1) return { ok: false, currentCount: current.length }
  const currentRule = getComputedStyle(current[0], '::before')
  const otherRule = getComputedStyle(rows.find((row) => row !== current[0]), '::before')
  return {
    ok: Number.parseFloat(currentRule.borderTopWidth) > Number.parseFloat(otherRule.borderTopWidth) && currentRule.borderTopColor === 'rgb(18, 18, 18)',
    currentWidth: currentRule.borderTopWidth,
    otherWidth: otherRule.borderTopWidth,
    currentColor: currentRule.borderTopColor,
  }
})
check('Grammar subtly outlines only the current city topic', grammarCurrentOutline.ok, JSON.stringify(grammarCurrentOutline))
await page.getByRole('button', { name: /Aarhus: Time first/ }).click()
check('Grammar city opens real content in one click', await page.locator('.book-page-body').count() === 1 && await page.locator('.guide-city-overview').count() === 0 && await page.getByRole('button', { name: 'Open book' }).count() === 0)
check('Grammar reader uses the cover beige with pencil lines', await page.evaluate(() => {
  const reader = getComputedStyle(document.querySelector('.travel-guide-book'))
  const paper = getComputedStyle(document.querySelector('.travel-guide-book .book-page'))
  return reader.backgroundColor === 'rgb(255, 255, 255)' && paper.backgroundColor === 'rgb(242, 238, 227)'
}))
check('Grammar reader uses the same integrated top row as the cover', await page.locator('.guide-cover-tabs-row .book-back').count() === 1 && await page.locator('.guide-cover-tabs-row .guide-thumb-index').count() === 2 && await page.locator('.book-reader-top').count() === 0)
// The page turns are luggage tags since CW-12 (owner O2, "tags on every
// labelled button"): still compact and inside the paper, now with the 44px
// target every tag keeps.
check('Grammar page turns are compact tags inside the paper', await page.evaluate(() => {
  const paper = document.querySelector('.book-page')
  const turns = paper?.querySelector(':scope > .guide-inline-book-turns')
  const buttons = turns ? [...turns.querySelectorAll('.tag')] : []
  return !!turns && buttons.length === 2 && buttons.every((button) => {
    const { width, height } = button.getBoundingClientRect()
    return height >= 44 && height < 52 && width >= 44
  })
}))
check('Aarhus combines both lessons into one four-page chapter', (await page.locator('.guide-page-count').innerText()) === '1 / 4')
await page.getByRole('button', { name: 'Next', exact: true }).click()
await page.getByRole('button', { name: 'Next', exact: true }).click()
check('Aarhus second lesson follows by turning the page', (await page.locator('.book-page h1').innerText()).includes('Yesterday and today'))
await page.getByRole('button', { name: 'Back to Grammar index' }).click()
check('Grammar returns to the complete contents', await page.locator('.guide-city-row').count() === 9)

await page.getByRole('button', { name: 'Back to Travel Guide cover' }).click()
await page.locator('.guide-section-survival').click()
check('Survival contents shows all nine cities without a redundant count pill', await page.locator('.guide-city-row').count() === 9 && await page.getByText('ALL 9 CITIES', { exact: true }).count() === 0)
check('Survival thumb index is pulled forward', await page.locator('.guide-thumb-survival[aria-current="page"]').count() === 1)
check('Survival joins its sage paper while Grammar stays behind', await page.evaluate(() => {
  const grammar = document.querySelector('.guide-thumb-grammar')
  const survival = document.querySelector('.guide-thumb-survival')
  const paper = document.querySelector('.book-page')
  if (!grammar || !survival || !paper) return false
  const survivalRect = survival.getBoundingClientRect()
  const paperRect = paper.getBoundingClientRect()
  const paperStyle = getComputedStyle(paper)
  const contextRect = paper.querySelector('.book-page-context')?.getBoundingClientRect()
  return Number(getComputedStyle(survival).zIndex) > Number(paperStyle.zIndex) &&
    Number(getComputedStyle(grammar).zIndex) < Number(getComputedStyle(paper).zIndex) &&
    paperStyle.backgroundImage.includes('175, 195, 154') &&
    paperStyle.backgroundImage.includes('18, 18, 18') &&
    paperStyle.backgroundPosition.includes('15px') &&
    paperStyle.backgroundSize.includes('100%') &&
    Number.parseFloat(paperStyle.borderTopLeftRadius) > 0 &&
    Number.parseFloat(paperStyle.borderTopRightRadius) > 0 &&
    !!contextRect && contextRect.top - (paperRect.top + 16.7) >= 6 &&
    Math.abs((paperRect.width - 70) / 2 - survivalRect.width) < 2
}))
await fixed('Survival nine-city contents')
check('Survival uses the same current-city topic outline', await page.locator('.guide-city-row.is-current-city').count() === 1)
await page.locator('.guide-city-row').first().click()
check('Survival city opens a real exchange in one click', await page.locator('.survival-exchange-page').count() === 1 && await page.locator('.guide-city-overview').count() === 0 && await page.locator('.survival-exchange-row').count() === 0)
check('Survival page controls sit inside the paper', await page.locator('.survival-exchange-page > .guide-inline-book-turns').count() === 1)
check('Survival remains rereadable without a completion control', await page.getByRole('button', { name: /Mark read|Read again/ }).count() === 0)
check('Survival shows its city as a recommendation, not a lock', (await page.locator('.book-page-context').textContent()) === 'Recommended: Sønderborg')
check('each dialogue turn separates listening from English', await page.locator('.survival-listen').count() === 4 && await page.locator('.survival-english').count() === 4)
const firstEnglish = page.locator('.survival-english').first()
await firstEnglish.click()
check('English reveals without triggering the listening control', await page.locator('.survival-translation').count() === 1 && await firstEnglish.getAttribute('aria-expanded') === 'true')
await page.getByRole('button', { name: 'Next', exact: true }).click()
check('Survival exchanges continue as pages in the same chapter', (await page.locator('.guide-page-count').innerText()) === '2 / 4')

for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
  await openGuide('Grammar')
  check(`Grammar contents includes ${cities[cityIndex]}`, await page.locator('.guide-city-row').nth(cityIndex).count() === 1)
  await page.locator('.guide-city-row').nth(cityIndex).click()
  const pageCount = lessonCounts[cityIndex] * 2
  check(`Grammar ${cities[cityIndex]} starts directly on page one`, (await page.locator('.guide-page-count').innerText()) === `1 / ${pageCount}`)
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    await fixed(`Grammar ${cities[cityIndex]} page ${pageIndex + 1}`)
    grammarPages++
    if (pageIndex < pageCount - 1) await page.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Back to Grammar index' }).click()
  check(`Grammar ${cities[cityIndex]} returns to all nine cities`, await page.locator('.guide-city-row').count() === 9)
}

for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
  await openGuide('Survival')
  check(`Survival contents includes ${cities[cityIndex]}`, await page.locator('.guide-city-row').nth(cityIndex).count() === 1)
  await page.locator('.guide-city-row').nth(cityIndex).click()
  for (let exchangeIndex = 0; exchangeIndex < 4; exchangeIndex++) {
    check(`Survival ${cities[cityIndex]} exchange ${exchangeIndex + 1} opens`, (await page.locator('.guide-page-count').innerText()) === `${exchangeIndex + 1} / 4`)
    await page.locator('.survival-english').evaluateAll((buttons) => buttons.forEach((button) => button.click()))
    await fixed(`Survival ${cities[cityIndex]} exchange ${exchangeIndex + 1}`)
    survivalPages++
    if (exchangeIndex < 3) await page.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Back to Survival index' }).click()
  check(`Survival ${cities[cityIndex]} returns to all nine cities`, await page.locator('.guide-city-row').count() === 9)
}

check('swept all 18 Grammar lessons × two pages', grammarPages === 36, String(grammarPages))
check('swept all 36 Survival exchange pages', survivalPages === 36, String(survivalPages))
check('measured every reader page at 360×640', fixedMeasurements >= 74, String(fixedMeasurements))
console.log(`INFO page-local scroll used on ${scrollingPaperPages.length}/${fixedMeasurements} measured papers${scrollingPaperPages.length ? ` — ${scrollingPaperPages.join(', ')}` : ''}`)
await browser.close()
preview.stop()
console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'GUIDE BOOK DRIVE OK')
if (failed.length) process.exitCode = 1
