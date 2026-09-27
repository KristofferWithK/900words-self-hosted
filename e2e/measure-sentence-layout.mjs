// §9.3 step 5: measure per-language sentenceLayout (CHARS_PER_LINE, LINE_PX)
// for every entry in UI_LANGUAGE_INFO, in a real browser at the tight
// 360×640 phone, using each language's OWN gloss text (after §9.3 step 1,
// .sentence-en shows the player-language example translation from
// da.<lang>.json — so that is the text whose wrapping the estimator must
// predict; es/nl/nb/hu keep English truthfully).
//
// Samples are the REAL dataset rows endgame-drive charges: the dataset's
// longest exampleDa + a short one for the Danish side; the language's longest
// `example` + a short one from da.<lang>.json for the gloss side (English
// rows' exampleEn for en and the non-launch languages).
//
// Method, mirroring e2e/endgame-drive.mjs's drawn() at the same viewport:
//   - .sentence-da / .sentence-en rendered inside .sentence-hear with the
//     app's real CSS, -webkit-line-clamp unset, data-long per the LONG_* rule.
//   - Short band: binary-search the largest prefix of a SHORT example that
//     still renders on one line — the honest chars-per-line for that band.
//   - Long band: wrap the longest example and divide chars by wrapped lines.
//   - linePx: computed line-height of each band.
// Writes /tmp/sentence-layout-perlang.json.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const EXE = process.env.CHROMIUM_PATH ?? '/opt/data/toolchain/playwright-browsers/chromium-1234/chrome-linux64/chrome'
const BASE = process.env.MEASURE_BASE ?? 'http://127.0.0.1:4183'
const LAUNCH = ['en', 'de', 'sv', 'pl', 'pt', 'zh', 'fr'] // da.<lang>.json exists only for launch languages
const ALL = ['en', 'de', 'es', 'zh', 'fr', 'pt', 'nl', 'pl', 'sv', 'nb', 'hu']

// The da side is the same Danish text for every player: the dataset rows the
// endgame drive charges (words.da.json).
const dataset = JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url), 'utf8'))
const daEx = dataset.map((r) => r.exampleDa).filter(Boolean)
const DA_LONG = daEx.reduce((a, b) => (b.length > a.length ? b : a))
const DA_SHORT = daEx.find((s) => s.length > 20 && s.length < 40) ?? DA_LONG.slice(0, 30)

function loadExamples(lang) {
  if (lang !== 'en' && LAUNCH.includes(lang)) {
    const glosses = JSON.parse(readFileSync(new URL(`../src/i18n/glosses/da.${lang}.json`, import.meta.url), 'utf8'))
    const ex = glosses.map((r) => r.example ?? '').filter(Boolean)
    const long = ex.reduce((a, b) => (b.length > a.length ? b : a), '')
    const short = ex.find((s) => s.length > 12 && s.length < 40) ?? long.slice(0, 30)
    return { long: long || DA_LONG, short }
  }
  // English (and non-launch languages, which keep English truthfully) keep
  // exampleEn.
  const ex = dataset.map((r) => r.exampleEn).filter(Boolean)
  const long = ex.reduce((a, b) => (b.length > a.length ? b : a), '')
  const short = ex.find((s) => s.length > 20 && s.length < 40) ?? long.slice(0, 30)
  return { long, short }
}

const browser = await chromium.launch({ executablePath: EXE })
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const out = {}
for (const lang of ALL) {
  const S = loadExamples(lang)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate((l) => localStorage.setItem('cluecab-ui-language', l), lang)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const m = await page.evaluate((arg) => {
    const app = document.querySelector('#root') ?? document.body
    const host = document.createElement('section')
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px;'
    const card = document.createElement('div')
    card.style.cssText = 'padding:0 16px;'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sentence-hear'
    const da = document.createElement('span'); da.className = 'sentence-da'
    const en = document.createElement('span'); en.className = 'sentence-en'
    btn.append(da, en); card.append(btn); host.append(card); app.appendChild(host)
    const lh = (el) => parseFloat(getComputedStyle(el).lineHeight)
    const linesOf = (el, text) => {
      el.textContent = text
      el.style.webkitLineClamp = 'unset'
      return Math.max(1, Math.round(el.getBoundingClientRect().height / lh(el)))
    }
    // Largest prefix of `text` that still renders on ONE line (height is
    // monotone in prefix length, so binary search is sound).
    const oneLinePrefix = (el, text) => {
      let best = 1
      for (let lo = 1, hi = text.length; lo <= hi; ) {
        const mid = (lo + hi) >> 1
        if (linesOf(el, text.slice(0, mid)) === 1) { best = mid; lo = mid + 1 } else hi = mid - 1
      }
      return best
    }
    const wrap = (el, text, long) => {
      el.textContent = text
      if (long) el.setAttribute('data-long', ''); else el.removeAttribute('data-long')
      el.style.webkitLineClamp = 'unset'
      return { n: linesOf(el, text), px: +lh(el).toFixed(2), len: text.length }
    }
    const daS = wrap(da, arg.daShort, false)
    const daL = wrap(da, arg.daLong, true)
    const enS = wrap(en, arg.short, false)
    const enL = wrap(en, arg.long, true)
    const daCpl = oneLinePrefix(da, arg.daShort)
    const enCpl = oneLinePrefix(en, arg.short)
    host.remove()
    return {
      sampleLen: { daShort: arg.daShort.length, daLong: arg.daLong.length, glShort: arg.short.length, glLong: arg.long.length },
      lines: { daLong: daL.n, glShort: enS.n, glLong: enL.n },
      charsPerLine: {
        da: daCpl,
        daLong: Math.floor(daL.len / daL.n),
        en: enCpl,
        enLong: Math.floor(enL.len / enL.n),
      },
      linePx: { da: daS.px, daLong: daL.px, en: enS.px, enLong: enL.px },
    }
  }, { long: S.long, short: S.short, daShort: DA_SHORT, daLong: DA_LONG })
  out[lang] = m
  console.log(lang, JSON.stringify(m))
}
await browser.close()
await (await import('node:fs/promises')).writeFile('/tmp/sentence-layout-perlang.json', JSON.stringify(out, null, 2))
console.log('WROTE /tmp/sentence-layout-perlang.json')