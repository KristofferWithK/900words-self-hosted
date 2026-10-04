// German as a switchable PREVIEW language: the picker offers it, switching
// changes the map and the Travel Guide, and every way into a round is gone.
//
// This is the drive that proves the language seam actually reaches the screen.
// The unit tests can only say the German pack is well-formed; the question
// that matters is whether a player who picks German in Settings gets Germany's
// map, Germany's cities and the German grammar book — and never a dealt board.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(Number(process.env.DRIVE_PORT ?? 4319))
const bundled = '/opt/pw-browsers/chromium'
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync(bundled) ? bundled : windowsChrome) })
const context = await browser.newContext({ viewport: { width: 360, height: 640 } })
const page = await context.newPage()
const failed = []
const overflowingSurvival = []
const check = (name, value, detail = '') => { console.log(`${value ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!value) failed.push(name) }

/**
 * Land on the app with a language already chosen, the way a reload does. The
 * UI store persists the screen you were last on, so it is cleared too —
 * otherwise a visit to Settings makes every later reload open Settings.
 */
async function open(language, query = '') {
  await page.goto(`${preview.base}?howto=0${query}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((code) => {
    localStorage.setItem('cluecab-language', code)
    localStorage.removeItem('cluecab-ui-v1')
  }, language)
  await page.goto(`${preview.base}?howto=0${query}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen, .onboard-screen')
}

// ── the map changes ────────────────────────────────────────────────────────
await open('da')
const danish = await page.evaluate(() => ({
  viewBox: document.querySelector('.home-map')?.getAttribute('viewBox'),
  city: document.querySelector('.home-map-here')?.textContent,
  land: document.querySelector('.map-land')?.getAttribute('d')?.length,
}))
await open('de')
const german = await page.evaluate(() => ({
  viewBox: document.querySelector('.home-map')?.getAttribute('viewBox'),
  city: document.querySelector('.home-map-here')?.textContent,
  land: document.querySelector('.map-land')?.getAttribute('d')?.length,
}))
check('the map is a different country', danish.land !== german.land && danish.viewBox !== german.viewBox, JSON.stringify({ danish, german }))
check('the first German city is Flensburg', german.city === 'Flensburg', String(german.city))
check('the German outline actually drew', (german.land ?? 0) > 2000, String(german.land))

// ── play is off ────────────────────────────────────────────────────────────
// The daily star came off Home (owner, 2026-09-15), so the star's absence no
// longer distinguishes a preview build; what a preview still lacks is the
// Play button itself, which this drive has always checked beside it.
const playable = await page.evaluate(() => ({
  play: !!document.querySelector('.home-play'),
  daily: !!document.querySelector('.home-daily'),
  preview: document.querySelector('.home-preview-heading')?.textContent ?? null,
}))
check('no Play button', !playable.play)
check('no daily challenge star anywhere on Home', !playable.daily)
check('the preview panel says why', !!playable.preview, String(playable.preview))
await page.screenshot({ path: 'evidence/german-preview-home.png' })

// Home must still not scroll at 360x640 — the preview panel replaced a band,
// it did not add one.
const homeFits = await page.evaluate(() => {
  const el = document.scrollingElement
  return !!el && el.scrollHeight <= el.clientHeight + 1
})
check('Home still does not scroll at 360x640', homeFits)

// ── the Travel Guide is German ─────────────────────────────────────────────
await page.locator('.home-guide-button, .home-preview .home-preview-guide').first().click()
await page.waitForSelector('.travel-guide-book')
const cover = await page.evaluate(() => document.body.innerText)
check('the cover says German, not Danish', /German/.test(cover) && !/Danish/.test(cover), cover.slice(0, 120).replace(/\n/g, ' · '))
await page.screenshot({ path: 'evidence/german-preview-guide-cover.png' })

// The whole cover opens the Grammar contents — the accepted default entry.
await page.locator('.guide-cover-hero').click()
await page.waitForSelector('.guide-city-list')
const grammarIndex = await page.evaluate(() => document.body.innerText)
check('the Grammar index lists the German route', /Flensburg/.test(grammarIndex) && /Berlin/.test(grammarIndex),
  grammarIndex.replace(/\n/g, ' · ').slice(0, 200))
check('no Danish city leaked in', !/Sønderborg|København/.test(grammarIndex))
await page.screenshot({ path: 'evidence/german-preview-grammar-index.png' })

await page.locator('.guide-city-row').first().click()
await page.waitForSelector('.book-page')
const lesson = await page.evaluate(() => document.body.innerText)
check('the first lesson is the articles chapter', /der Tisch/.test(lesson) && /die Tür/.test(lesson),
  lesson.replace(/\n/g, ' · ').slice(0, 240))
await page.screenshot({ path: 'evidence/german-preview-lesson.png' })

const lessonFits = await page.evaluate(() => {
  const el = document.scrollingElement
  const reader = document.querySelector('.book-reader')
  return !!el && el.scrollHeight <= el.clientHeight + 1 && !!reader && reader.scrollHeight <= reader.clientHeight + 1
})
check('the German lesson page does not scroll at 360x640', lessonFits)

// ── the Survival section ───────────────────────────────────────────────────
await open('de')
await page.locator('.home-guide-button, .home-preview .home-preview-guide').first().click()
await page.waitForSelector('.travel-guide-book')
await page.locator('.guide-thumb-survival').click()
await page.waitForSelector('.guide-city-list')
const survivalIndex = await page.evaluate(() => document.body.innerText)
check('the Survival index lists nine German cities', /Flensburg/.test(survivalIndex) && /Berlin/.test(survivalIndex),
  survivalIndex.replace(/\n/g, ' · ').slice(0, 160))
await page.locator('.guide-city-row').first().click()
await page.waitForSelector('.survival-exchange-page')
const firstExchange = await page.evaluate(() => ({
  text: document.body.innerText,
  register: document.querySelector('.survival-register')?.textContent ?? null,
  listenDisabled: [...document.querySelectorAll('.survival-listen')].every((b) => b.disabled),
  lang: document.querySelector('.survival-dialogue strong')?.getAttribute('lang'),
}))
check('the first exchange is the German one', /Ich heiße Mia/.test(firstExchange.text), firstExchange.text.replace(/\n/g, ' · ').slice(0, 160))
check('it declares its address form', firstExchange.register === 'Sie', String(firstExchange.register))
check('every Listen control is greyed out with no bake', firstExchange.listenDisabled)
check('the dialogue is marked as German for a screen reader', firstExchange.lang === 'de', String(firstExchange.lang))
await page.screenshot({ path: 'evidence/german-preview-survival.png' })

// Both registers must actually be reachable, and a du page must not be
// reachable only in the theory of the data file.
const registers = new Set()
for (let cityIndex = 0; cityIndex < 9; cityIndex++) {
  await open('de')
  await page.locator('.home-guide-button, .home-preview .home-preview-guide').first().click()
  await page.waitForSelector('.travel-guide-book')
  await page.locator('.guide-thumb-survival').click()
  await page.waitForSelector('.guide-city-list')
  await page.locator('.guide-city-row').nth(cityIndex).click()
  await page.waitForSelector('.survival-exchange-page')
  for (let i = 0; i < 4; i++) {
    registers.add(await page.evaluate(() => document.querySelector('.survival-register')?.textContent ?? null))
    const measured = await page.evaluate(() => {
      const paper = document.querySelector('.book-page')
      return paper ? paper.scrollHeight - paper.clientHeight : 0
    })
    if (measured > 1) overflowingSurvival.push(`city ${cityIndex + 1} exchange ${i + 1} +${measured}px`)
    if (i === 3) break
    await page.locator('.survival-book-turns .tag').last().click()
    await page.waitForTimeout(120)
  }
}
check('both du and Sie are reachable in the reader', registers.has('du') && registers.has('Sie'), [...registers].join(','))
check('no German Survival page is clipped', overflowingSurvival.length === 0, overflowingSurvival.join('; '))

// ── every authored page fits its paper ─────────────────────────────────────
// The Guide's rule (docs/travel-guide-decision.md): content moves to a
// continuation page when it does not fit, and is never clipped or put in an
// inner scroller. Eighteen of the twenty German rules pages overflowed when
// they were first authored, by up to 231px, and the reader clips silently —
// so this sweep is the only thing that would catch it coming back.
const overflowing = []
for (let city = 0; city < 9; city++) {
  await open('de')
  await page.locator('.home-guide-button, .home-preview .home-preview-guide').first().click()
  await page.waitForSelector('.travel-guide-book')
  await page.locator('.guide-cover-hero').click()
  await page.waitForSelector('.guide-city-list')
  await page.locator('.guide-city-row').nth(city).click()
  await page.waitForSelector('.book-page')
  for (let turn = 0; turn < 8; turn++) {
    const measured = await page.evaluate(() => {
      const paper = document.querySelector('.book-page')
      return { over: paper ? paper.scrollHeight - paper.clientHeight : 0, title: document.querySelector('.book-page h1')?.textContent ?? '' }
    })
    if (measured.over > 1) overflowing.push(`city ${city + 1} "${measured.title}" +${measured.over}px`)
    const next = page.locator('.book-next, [aria-label*="ext" i]').first()
    if (!(await next.isVisible().catch(() => false))) break
    const before = await page.evaluate(() => document.querySelector('.book-page h1')?.textContent ?? '')
    await next.click().catch(() => {})
    await page.waitForTimeout(120)
    const after = await page.evaluate(() => document.querySelector('.book-page h1')?.textContent ?? '')
    if (before === after && turn > 0) break
  }
}
check('no German Guide page is clipped', overflowing.length === 0, overflowing.join('; '))

// ── switching back leaves Danish alone ─────────────────────────────────────
await open('da')
const back = await page.evaluate(() => ({
  play: !!document.querySelector('.home-play'),
  city: document.querySelector('.home-map-here')?.textContent,
}))
check('Danish still plays after the round trip', back.play && back.city === 'Sønderborg', JSON.stringify(back))

// ── the picker ─────────────────────────────────────────────────────────────
// Last, because Settings is a persisted screen: opening it earlier makes every
// later reload land there.
await open('da')
await page.locator('[aria-label*="ettings" i], .home-gear').first().click()
await page.waitForTimeout(300)
const selects = await page.locator('select').all()
let learner = []
for (const select of selects) {
  const texts = await select.locator('option').allTextContents()
  if (texts.some((t) => /Danish|Dansk/i.test(t))) learner = texts
}
check('Settings offers both languages', learner.length === 2, JSON.stringify(learner))
check('German is marked as a preview', learner.some((o) => /German/i.test(o) && /preview/i.test(o)), JSON.stringify(learner))
await page.screenshot({ path: 'evidence/german-preview-settings.png' })

await browser.close()
preview.stop()
console.log(failed.length ? `\n${failed.length} failed: ${failed.join(', ')}` : '\nall checks passed')
process.exit(failed.length ? 1 : 0)
