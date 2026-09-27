// The train's chapter, city by city, at the smallest supported phone size:
// every grammar lesson as the Guide's own rules and examples pages with one
// compact recording under each examples table, then the city's four Survival
// exchanges, then the arrival. It RIDES: from København with every stop
// reached, Travel back to the first stop and then Travel on, stop by stop —
// the map's "Train lesson" replay that this used to click went on 2026-09-05,
// and the ride is the one way a chapter is read under the pencil train now.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'
import { tapStop } from './map-stops.mjs'

const PORT = 4199
const preview = await startPreview(PORT)
const bundled = '/opt/pw-browsers/chromium'
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? (existsSync(bundled) ? bundled : windowsChrome),
})
const context = await browser.newContext({ viewport: { width: 360, height: 640 } })
const page = await context.newPage()
let pagesMeasured = 0
const cities = ['Sønderborg', 'Ribe', 'Kolding', 'Aarhus', 'Aalborg', 'Skagen', 'Odense', 'Roskilde', 'København']
const failures = []
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

function check(name, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

/**
 * A grammar page, held to the owner's rule for this reader (2026-09-03):
 * "grammar can scroll if it has to, but generally shouldn't if it can be
 * avoided."
 *
 * Which is three things and not one. The DOCUMENT still may not scroll — that
 * is the shell's rule and it is not this reader's to relax. The page turns
 * still have to be on screen, because a sheet you can scroll and cannot leave
 * is worse than one that is simply full. And when a sheet does overflow there
 * has to be exactly one scroller to reach the rest with: overflow WITHOUT a
 * scroller is the bad case, where the tail of a rule is painted over the nav
 * or clipped away with nothing to say so.
 *
 * "Generally shouldn't" is the tally at the end of the run rather than a
 * verdict here — one page needing room is the rule working, and every page
 * needing it is the reader having quietly become a scrolling one.
 */
const scrolled = []
async function readableSheet(label, where) {
  const layout = await page.evaluate(() => {
    const reader = document.querySelector('.ride-reader')
    const sheet = reader?.querySelector('.book-page')
    const nav = reader?.querySelector('.book-turns')?.getBoundingClientRect()
    return {
      document: document.scrollingElement.scrollHeight,
      viewport: innerHeight,
      pageOverflow: sheet ? sheet.scrollHeight > sheet.clientHeight + 1 : true,
      internalScrollers: reader ? [...reader.querySelectorAll('*')].filter((node) => {
        const overflow = getComputedStyle(node).overflowY
        return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1
      }).length : -1,
      navBottom: nav?.bottom ?? 0,
    }
  })
  pagesMeasured++
  if (layout.pageOverflow) scrolled.push(where)
  check(label,
    layout.document <= layout.viewport + 1 &&
      layout.navBottom <= layout.viewport + 1 &&
      layout.internalScrollers === (layout.pageOverflow ? 1 : 0),
    JSON.stringify(layout))
}

try {
  await page.goto(`${preview.base}?howto=0&mock=1&city=8&learned=30`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen')
  await page.locator('.map-button').click()
  await page.waitForSelector('.map-screen')

  let lessonsRead = 0
  let lessonsOffered = 0
  for (let cityIndex = 0; cityIndex < cities.length; cityIndex++) {
    const city = cities[cityIndex]
    await tapStop(page, { index: cityIndex })
    // Back to the first stop from København, then on again one stop at a
    // time: every stop is reached, so each offers its train.
    await page.getByRole('button', { name: `Travel ${cityIndex === 0 ? 'back' : 'on'} → ${city}` }).click()
    await page.waitForSelector('.ride-reader')

    // How many lessons a chapter has is the chapter's business. A table in
    // here saying "only Aarhus has two" went stale the day the guide grew a
    // second lesson for eight of the nine cities (and a third for Roskilde),
    // and every city after Ribe went unvisited behind the first failure. Read
    // it off the page count the Guide's reader prints: two pages a lesson.
    const count = (await page.locator('.guide-page-count').innerText()).trim()
    const pageCount = Number(count.match(/\/ (\d+)$/)?.[1] ?? 0)
    const lessonCount = pageCount / 2
    check(`${city} says how many lessons it has`, lessonCount >= 1 && Number.isInteger(lessonCount), count)
    check(`${city} rides on the Guide's grammar paper`,
      (await page.locator('.ride-reader.guide-grammar-reader').count()) === 1 &&
      (await page.locator('.train-lesson-reader').count()) === 0 &&
      (await page.locator('.ride-bar-label').innerText()).includes(`${city} · Grammar`))
    lessonsOffered += lessonCount

    const pageNo = async () => (await page.locator('.guide-page-count').innerText()).trim()
    for (let lesson = 1; lesson <= lessonCount; lesson++) {
      check(`${city} lesson ${lesson} starts on rules`, (await pageNo()) === `${lesson * 2 - 1} / ${pageCount}`, await pageNo())
      check(`${city} lesson ${lesson} rules carry no recording`, (await page.locator('.chapter-performance').count()) === 0)
      await readableSheet(`${city} lesson ${lesson} rules are readable at 360×640`, `${city} ${lesson}/rules`)

      await page.getByRole('button', { name: 'Next', exact: true }).click()
      check(`${city} lesson ${lesson} reaches examples`, (await pageNo()) === `${lesson * 2} / ${pageCount}`, await pageNo())
      await readableSheet(`${city} lesson ${lesson} examples are readable at 360×640`, `${city} ${lesson}/examples`)
      check(`${city} lesson ${lesson} has one compact grammar-lesson recording`,
        (await page.locator('.chapter-performance').count()) === 1 &&
        (await page.locator('.chapter-lines').count()) === 0)
      lessonsRead++
      // Past the last examples page the same Next says where it goes.
      const next = page.getByRole('button', { name: 'Next', exact: true })
      if (lesson === lessonCount) check(`${city} hands over to Survival after its last lesson`, (await next.innerText()).trim() === 'Survival →')
      await next.click()
    }

    // The second half: four exchanges on the Guide's Survival paper, each
    // with its four Listen lines, and the last Next closes the replay.
    await page.waitForSelector('.survival-exchange-page')
    check(`${city} ride continues into Survival`, (await page.locator('.ride-bar-label').innerText()).includes(`${city} · Survival`))
    for (let exchange = 1; exchange <= 4; exchange++) {
      check(`${city} exchange ${exchange} of 4`, (await pageNo()) === `${exchange} / 4`, await pageNo())
      check(`${city} exchange ${exchange} has four Listen lines`, (await page.locator('.survival-listen').count()) === 4)
      await readableSheet(`${city} exchange ${exchange} is readable at 360×640`, `${city} survival ${exchange}`)
      const next = page.getByRole('button', { name: 'Next', exact: true })
      if (exchange === 4) check(`${city} continues into the arrival after its last exchange`, (await next.innerText()).trim() === 'Continue')
      await next.click()
    }
    await page.waitForSelector('.arrival-city')
    check(`${city} is the city arrived in`, (await page.locator('.arrival-city').textContent())?.trim() === city)
    await page.click('.arrival-screen .btn:not(.btn-primary)')
    await page.waitForSelector('.map-screen')
  }

  // Every lesson the guide offered, counted from the guide rather than from a
  // number in here — the same staleness as the per-city table above, one line
  // lower. Ten was true when eight of the nine cities had one lesson each.
  // A quarter is the ceiling, not the target: three of thirty-six pages need
  // the room today, and the number is printed either way so the next lesson
  // that reaches for it is visible in the log rather than only in a failure.
  check(
    'scrolling a chapter page stays the exception',
    scrolled.length * 4 <= pagesMeasured,
    `${scrolled.length} of ${pagesMeasured} pages scroll${scrolled.length ? `: ${scrolled.join(', ')}` : ''}`,
  )
  check(
    'every lesson every chapter offered was read',
    lessonsRead === lessonsOffered && lessonsOffered >= cities.length,
    `${lessonsRead} read of ${lessonsOffered} offered across ${cities.length} cities`,
  )
  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nTRAIN GRAMMAR DRIVE OK')
if (failures.length) process.exitCode = 1
