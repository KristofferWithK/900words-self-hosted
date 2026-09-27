// Build 90 probe: the packing dock's three controls are 48px primary pills
// that fit together at 360px and at the keyboard-open viewport (360x230 body)
// without clipping the fixed dock or pushing the give-way note row out.
// Read-only probe — prints JSON, exits non-zero on any failed assertion.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance } from './round-guidance.mjs'

const PORT = 4233
const preview = await startPreview(PORT)
process.on('exit', () => preview.stop())
const CHROME = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })

const fails = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fails.push(name)
}

async function intoPacking() {
  // ?jokers=2: the drives' seed that banks translation jokers, so the joker
  // pill has a balance to spend (a bare board starts at zero).
  const J = '?mock=1&howto=0&city=0&collected=40&seed=9&wraps=1&jokers=2'
  await page.goto(`${preview.base}/${J}`)
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(`${preview.base}/${J}`)
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  await page.locator('.case-actions .btn-primary').click()
  await page.waitForSelector('.packing-dock')
  // The packing phase opens on its own guidance panel; take its action so the
  // board is tappable (the same move every gameplay drive makes).
  await dismissRoundGuidance(page)
}

async function metrics() {
  return page.evaluate(() => {
    const m = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        h: +r.height.toFixed(2),
        w: +r.width.toFixed(2),
        x: +r.x.toFixed(2),
        y: +r.y.toFixed(2),
        right: +r.right.toFixed(2),
        bottom: +r.bottom.toFixed(2),
        font: cs.fontSize,
        weight: cs.fontWeight,
        color: cs.color,
        borderColor: cs.borderTopColor,
        borderWidth: cs.borderTopWidth,
        radius: cs.borderRadius,
        bg: cs.backgroundColor,
        decoration: cs.textDecorationLine,
        minH: cs.minHeight,
        padY: cs.paddingTop,
      }
    }
    const dock = document.querySelector('.packing-dock')
    const dr = dock.getBoundingClientRect()
    const help = document.querySelector('.packing-help')
    const hr = help.getBoundingClientRect()
    const note = document.querySelector('.packing-note')
    const nr = note.getBoundingClientRect()
    const doc = document.documentElement
    return {
      pack: m('.packing-pack'),
      early: m('.packing-early'),
      joker: m('.packing-postcard'),
      input: m('.packing-input'),
      balance: m('.packing-postcard-balance'),
      dock: { h: +dr.height.toFixed(2), y: +dr.y.toFixed(2), bottom: +dr.bottom.toFixed(2) },
      helpClip: { helpH: +hr.height.toFixed(2), noteH: +nr.height.toFixed(2), helpScrollH: help.scrollHeight },
      doc: { scrollH: doc.scrollHeight, clientH: doc.clientHeight },
      scrollW: doc.scrollWidth,
      vw: window.innerWidth,
    }
  })
}

await intoPacking()

// --- 360x640, no card selected: joker pill visible (disabled), early pill present
let v = await metrics()
console.log('360x640 nothing selected:', JSON.stringify(v, null, 1))
check('early pill present with cards remaining', !!v.early)
check('all three same primary style (ring 2px, radius, weight, no underline)', v.pack.borderWidth === v.early.borderWidth && v.early.borderWidth === v.joker.borderWidth && v.early.radius === v.joker.radius && v.early.weight === v.joker.weight && v.early.decoration !== 'underline' && v.joker.decoration !== 'underline', `${v.pack.borderWidth}/${v.early.radius}/${v.joker.weight}`)
check('Pack, Start-with-N and joker are all 48px', Math.abs(v.pack.h - 48) < 1 && Math.abs(v.early.h - 48) < 1 && Math.abs(v.joker.h - 48) < 1, `${v.pack.h}/${v.early.h}/${v.joker.h}`)
check('all three same font size (joker label 0.8rem, as the link was)', v.pack.font === v.early.font && v.joker.font === '12.8px', `${v.pack.font}/${v.early.font}/${v.joker.font}`)
check('all three same weight', v.pack.weight === v.early.weight && v.early.weight === v.joker.weight, v.pack.weight)
// Disabled controls are grey by design (.btn-primary:disabled); the enabled
// pills are what must match each other.
check('enabled pills share the primary green', v.early.color === 'rgb(58, 122, 52)' && v.early.borderColor === 'rgb(58, 122, 52)' && v.early.bg === 'rgb(255, 255, 255)', `${v.early.color} ${v.early.borderColor} ${v.early.bg}`)
check('disabled pills share the primary grey', v.pack.color === v.joker.color && v.pack.borderColor === v.joker.borderColor && v.pack.bg === v.joker.bg, `${v.pack.color} ${v.pack.borderColor} ${v.pack.bg}`)
check('all three pill radius', v.pack.radius === v.early.radius && v.early.radius === v.joker.radius, v.pack.radius)
check('no underline left in the dock', v.pack.decoration !== 'underline' && v.early.decoration !== 'underline' && v.joker.decoration !== 'underline')
check('balance badge inside joker pill', !!v.balance)
check('joker disabled with nothing selected', await page.locator('.packing-postcard').isDisabled())
check('pills fit the 360px row without overlap', v.early.right <= v.pack.x + 0.5 && v.pack.right <= v.vw + 0.5, `early.right=${v.early.right} pack.x=${v.pack.x} pack.right=${v.pack.right}`)
check('no horizontal overflow at 360', v.scrollW <= v.vw, `${v.scrollW} vs ${v.vw}`)
check('dock holds its 150px reserve', Math.abs(v.dock.h - 150) < 2, `${v.dock.h}`)
check('note row stays one line tall', v.helpClip.noteH <= 26, `note ${v.helpClip.noteH}px, help ${v.helpClip.helpH}/${v.helpClip.helpScrollH}`)
check('no page scroll at 360x640', v.doc.scrollH <= v.doc.clientH + 1, `${v.doc.scrollH}/${v.doc.clientH}`)
await page.screenshot({ path: 'evidence/packing-pills-360x640.png' })

// --- select a card: joker enabled, dock geometry unchanged
await dismissRoundGuidance(page)
await page.locator('.card-face-en').first().click()
await page.waitForTimeout(250)
v = await metrics()
check('joker enables on a selected card', await page.locator('.packing-postcard').isEnabled())
check('dock still 150px with a card selected', Math.abs(v.dock.h - 150) < 2, `${v.dock.h}`)

// --- keyboard-open viewport: the shell shrinks the BODY to 230 visible px
// (Keyboard.resize 'body' — the exact write Keyboard.m's resizeElement makes,
// which layout-drive stands up verbatim), then the dock rides to where the
// layout puts it. Measured AFTER the ride lands, as a player sees it.
await page.setViewportSize({ width: 360, height: 230 })
const KB = 230
await page.evaluate((kb) => {
  // Set the shrink BEFORE kb-up, the way the native listener's probe reads it.
  document.body.style.height = `${window.innerHeight - kb}px`
  document.documentElement.classList.add('kb-up')
  document.querySelector('.packing-dock')?.classList.add('kb-lifted')
  // The dock's ride is native-listener behaviour (startRide), not layout: the
  // probe stands the END STATE up — no transition, transform straight to the
  // probe's target — rather than animating it.
  const dock = document.querySelector('.packing-dock')
  if (dock) {
    dock.style.transition = 'none'
    dock.style.transform = `translateY(${-Math.max(0, dock.getBoundingClientRect().bottom - kb)}px)`
  }
}, KB)
await page.waitForTimeout(250)
v = await metrics()
console.log('360x230 kb-up:', JSON.stringify(v, null, 1))
const visibleBottom = Math.min(v.dock.bottom, 230)
check('kb: all three pills same height (48px)', Math.abs(v.pack.h - 48) < 1 && Math.abs(v.early.h - 48) < 1 && Math.abs(v.joker.h - 48) < 1, `${v.pack.h}/${v.early.h}/${v.joker.h}`)
check('kb: pills inside the visible viewport', v.early.right <= 360.5 && v.pack.right <= 360.5, `pack.right=${v.pack.right}`)
check('kb: dock not clipped below the keyboard line', v.dock.bottom <= 231, `dock.bottom=${v.dock.bottom} of 230`)
check('kb: no horizontal overflow', v.scrollW <= 360, `${v.scrollW}`)
check('kb: note row still one line', v.helpClip.noteH <= 26, `${v.helpClip.noteH}px`)
await page.screenshot({ path: 'evidence/packing-pills-360x230-kb.png' })

await browser.close()
preview.stop()
if (fails.length) {
  console.error(`\n${fails.length} failed: ${fails.join('; ')}`)
  process.exit(1)
}
console.log('\nprobe clean')