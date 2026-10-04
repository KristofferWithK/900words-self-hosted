// The way back down (putAway in src/ui/nativeKeyboard.ts, 2026-09-30).
//
// The owner's screen recording showed the composer staying up while the
// keyboard slid away, then dropping in one jump 150-200ms later, later still
// (up to 1.1s) when the same tap sent a clue or spun the wheel, and twice not
// at all. The page now puts itself back the moment the field loses focus and
// carries the dock down with a transform.
//
// Walked through the app's own keyboard stand-in (cluecab-kbsim), the way
// layout-drive walks the ride up. What a browser cannot show is timing
// against a real keyboard. What it can show:
//   - a blur restores the page in the same task (no waiting for the plugin),
//   - the dock rides down from where it was over the keyboard's duration and
//     rests exactly where a page that never had a keyboard puts it,
//   - Give clue puts the keyboard away first and sends the clue a frame later,
//   - under reduced motion nothing is transformed and the page is still restored.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const preview = await startPreview(4304)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
const failed = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}

const KB = 336
const DUR = 421

// Every inline style a dock or the surface is given, and when the body was
// restored and the composer left, in order. Registered once.
await page.addInitScript(() => {
  window.__sink = []
  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target
      if (!(el instanceof HTMLElement)) continue
      if (r.type === 'attributes' && el === document.body && document.body.style.height === '') {
        window.__sink.push({ what: 'body-restored', t: performance.now() })
      } else if (r.type === 'attributes' && (el.classList.contains('dock') || el.classList.contains('kb-surface'))) {
        window.__sink.push({
          what: el.classList.contains('dock') ? 'dock' : 'surface',
          transform: el.style.transform,
          transition: el.style.transition,
          t: performance.now(),
        })
      }
      if (r.type === 'childList') {
        for (const n of r.removedNodes) {
          if (n instanceof HTMLElement && (n.matches('.clue-input') || n.querySelector?.('.clue-input'))) {
            window.__sink.push({ what: 'composer-gone', t: performance.now() })
          }
        }
      }
    }
  }).observe(document, { attributes: true, subtree: true, childList: true, attributeFilter: ['style', 'class'] })
})

async function open(query) {
  await page.goto(`${preview.base}${query}`)
  await page.waitForSelector('#root > *')
}

/** A player clue turn, resumed by a reload so kbsim (read at mount) applies. */
async function clueTurn(kbsim) {
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-kbsim')
  })
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.waitForSelector('.clue-input #clue-word')
  await page.waitForTimeout(250)
  if (!kbsim) return
  await page.evaluate((v) => localStorage.setItem('cluecab-kbsim', v), `${KB}/${DUR}`)
  await open('?mock=1&howto=0')
  await page.waitForFunction(
    () =>
      document.documentElement.classList.contains('kb-up') &&
      document.body.style.height !== '' &&
      !document.querySelector('.dock.kb-lifted')?.style.transform,
    null,
    { timeout: 15000 },
  )
  await page.waitForSelector('.clue-input #clue-word')
}

const dockRect = () =>
  page.evaluate(() => {
    const b = document.querySelector('.clue-input').getBoundingClientRect()
    return { top: Math.round(b.top), bottom: Math.round(b.bottom) }
  })

try {
  // Where the composer rests on a page that never had a keyboard.
  await clueTurn(false)
  const resting = await dockRect()

  // ---- a tap away: blur ------------------------------------------------------
  await clueTurn(true)
  const lifted = await dockRect()
  check('the stand-in keyboard lifts the composer', lifted.top < resting.top - 100, `${lifted.top} vs ${resting.top}`)
  await page.evaluate(() => document.querySelector('#clue-word').focus())
  await page.evaluate(() => { window.__sink.length = 0 })
  // Blur and read the page in the SAME task: the restore must not wait for
  // anything (a native notice, a timer, a frame).
  const sameTask = await page.evaluate(() => {
    document.querySelector('#clue-word').blur()
    const dock = document.querySelector('.clue-input')
    return {
      body: document.body.style.height,
      kbUp: document.documentElement.classList.contains('kb-up'),
      transform: dock.style.transform,
      transition: dock.style.transition,
      // Where the transition starts: the computed value at time zero.
      startY: new DOMMatrix(getComputedStyle(dock).transform).m42,
      surfaceStartY: new DOMMatrix(getComputedStyle(document.querySelector('.kb-surface')).transform).m42,
      sinking: dock.classList.contains('kb-sinking'),
      surface: document.querySelector('.kb-surface')?.classList.contains('kb-sinking') ?? false,
    }
  })
  check('a blur restores the page in the same task', sameTask.body === '' && !sameTask.kbUp, JSON.stringify(sameTask))
  check('and sets the composer riding down with its surface', sameTask.sinking && sameTask.surface && sameTask.transform === 'translateY(0px)',
    JSON.stringify(sameTask))
  check(`over the keyboard's own duration (${DUR}ms)`, sameTask.transition.includes(`${DUR}ms`), sameTask.transition)
  check('from where it was: the dock and its surface start at the lift, negated',
    Math.abs(sameTask.startY - (lifted.top - resting.top)) <= 2 && Math.abs(sameTask.surfaceStartY - sameTask.startY) <= 1,
    `dock ${sameTask.startY}, surface ${sameTask.surfaceStartY}, lift ${lifted.top - resting.top}`)
  await page.waitForTimeout(DUR + 200)
  const after = await page.evaluate(() => {
    const dock = document.querySelector('.clue-input')
    return {
      transform: dock.style.transform,
      sinking: dock.classList.contains('kb-sinking'),
      surface: document.querySelector('.kb-surface')?.classList.contains('kb-sinking') ?? false,
      surfaceTop: document.querySelector('.kb-surface')?.style.top ?? '',
    }
  })
  const rest = await dockRect()
  check('the ride ends clean: no transform, no sinking classes', after.transform === '' && !after.sinking && !after.surface && after.surfaceTop === '',
    JSON.stringify(after))
  check('and rests exactly where a page without a keyboard puts it', rest.top === resting.top && rest.bottom === resting.bottom,
    `${JSON.stringify(rest)} vs ${JSON.stringify(resting)}`)
  const scroll = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight }))
  check('and the document does not scroll', scroll.doc <= scroll.vh + 1, `${scroll.doc}/${scroll.vh}`)

  // ---- Give clue: the keyboard first, the clue a frame later ------------------
  await clueTurn(true)
  await page.locator('#clue-word').fill('hverdag')
  await page.evaluate(() => { window.__sink.length = 0 })
  await page.locator('.clue-input .btn-primary').click()
  await page.waitForFunction(() => window.__sink.some((e) => e.what === 'composer-gone'), null, { timeout: 10000 })
  const give = await page.evaluate(() => window.__sink)
  const restored = give.find((e) => e.what === 'body-restored')
  const gone = give.find((e) => e.what === 'composer-gone')
  check('Give clue restores the page before the clue is sent', Boolean(restored && gone && restored.t < gone.t),
    restored && gone ? `restored at ${restored.t.toFixed(0)}, composer gone at ${gone.t.toFixed(0)}` : JSON.stringify(give.map((e) => e.what)))
  check('with at least a frame between them', Boolean(restored && gone && gone.t - restored.t >= 8),
    restored && gone ? `${(gone.t - restored.t).toFixed(1)}ms` : '')
  const turned = await page.locator('.ai-panel, .turn-takeover').count()
  check('and the clue still arrives: Casey takes the turn', turned > 0, `${turned}`)

  // ---- reduced motion: restored, never transformed ---------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await clueTurn(true)
  await page.evaluate(() => document.querySelector('#clue-word').focus())
  await page.evaluate(() => { window.__sink.length = 0 })
  const reduced = await page.evaluate(() => {
    document.querySelector('#clue-word').blur()
    return { body: document.body.style.height, kbUp: document.documentElement.classList.contains('kb-up') }
  })
  await page.waitForTimeout(100)
  const moved = (await page.evaluate(() => window.__sink)).filter((e) => e.what === 'dock' && e.transform !== '')
  check('under reduced motion the page is restored and the dock never transformed',
    reduced.body === '' && !reduced.kbUp && moved.length === 0, `${JSON.stringify(reduced)}, ${moved.length} transforms`)
  const reducedRest = await dockRect()
  check('and it rests in the same place', reducedRest.top === resting.top, `${reducedRest.top} vs ${resting.top}`)
  await page.emulateMedia({ reducedMotion: null })
} catch (error) {
  console.log('KEYBOARD HIDE DRIVE FAILED:', error.message)
  failed.push('keyboard hide drive threw')
} finally {
  await page.evaluate(() => localStorage.removeItem('cluecab-kbsim')).catch(() => {})
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nKEYBOARD HIDE DRIVE OK')
if (failed.length) process.exitCode = 1
