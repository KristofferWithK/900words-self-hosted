// The map screen's vertical budget, printed. Opt-in; asserts nothing.
//
// The map is the flexible child of its column, so every pixel the card under
// it grows is a pixel of Denmark, and the card's height is mostly TEXT — which
// wraps differently in every font. That is how layout-drive came to fail in a
// Linux container while passing on Windows: the container's sans is a
// DejaVu-class face about a sixth wider than Segoe UI or San Francisco, three
// lines wrapped that fit on a phone, and the map went to 0px with the document
// two pixels too tall. PROBE_FONT reproduces that here without the container:
//
//   node e2e/map-budget-probe.mjs                       the app's own fonts
//   PROBE_FONT=Verdana node e2e/map-budget-probe.mjs    a wide stand-in
//   node e2e/map-budget-probe.mjs "city=1&wrapped=100"  one state only
//
// Each state is a dev-switch query; `stop=N` steps the card to another stop
// and `arrived=1` stamps an arrival date on the selected stop, which adds
// "· arrived …" to the collected line the way real play does.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4299)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const states = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'city=0&wrapped=100',
      'city=0',
      'city=1&wrapped=100',
      'city=1&wrapped=100&arrived=1',
      'city=1&wrapped=100&stop=0',
      'city=0&stop=8',
    ]
const style = process.env.PROBE_FONT ? `body, button, input { font-family: ${process.env.PROBE_FONT} !important }` : ''
try {
  for (const vp of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp)
    for (const state of states) {
      const params = new URLSearchParams(state)
      const stop = params.get('stop')
      await page.goto(`${preview.base}?mock=1&howto=0&${state}`)
      await page.waitForSelector('.home-screen')
      if (params.get('arrived') === '1') {
        // The switches cannot stamp an arrival; write it the way the store
        // does and reload so the card reads it back.
        await page.evaluate(() => {
          const key = 'cluecab-journey-v2'
          const saved = JSON.parse(localStorage.getItem(key))
          saved.state.arrivedAt = { ...saved.state.arrivedAt, [saved.state.cityIndex]: Date.now() }
          localStorage.setItem(key, JSON.stringify(saved))
        })
        await page.goto(`${preview.base}?howto=0`)
        await page.waitForSelector('.home-screen')
      }
      if (style) await page.addStyleTag({ content: style })
      await page.locator('.map-button').click()
      await page.waitForSelector('.map-screen')
      if (stop !== null) {
        while (await page.getByRole('button', { name: 'Previous stop' }).isEnabled()) {
          await page.getByRole('button', { name: 'Previous stop' }).click()
        }
        for (let i = 0; i < Number(stop); i++) await page.getByRole('button', { name: 'Next stop' }).click()
      }
      const r = await page.evaluate(() => {
        const h = (el) => Math.round(el.getBoundingClientRect().height * 10) / 10
        const name = (el) => (el.getAttribute('class') ?? '').split(' ')[0] || el.tagName.toLowerCase()
        const lines = (el) => {
          const cs = getComputedStyle(el)
          const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight)
          return Math.round(el.scrollHeight / lh)
        }
        const screen = document.querySelector('.map-screen')
        const detail = document.querySelector('.map-detail')
        const blurbs = document.querySelector('.city-blurbs')
        const out = {
          document: `${document.scrollingElement.scrollHeight} of ${innerHeight}`,
          screen: [...screen.children].map((c) => `${name(c)}=${h(c)}`).join(' '),
          card: [...detail.children].map((c) => `${name(c)}=${h(c)}`).join(' '),
          blurbs: blurbs ? `${h(blurbs)} shown of ${blurbs.scrollHeight} (${blurbs.scrollHeight > blurbs.clientHeight + 1 ? 'SCROLLS' : 'fits'})` : 'none',
          font: getComputedStyle(document.body).fontFamily.slice(0, 40),
        }
        for (const sel of ['.map-collected', '.map-case-note', '.city-blurb', '.city-blurb-en', '.map-locked', '.map-credit']) {
          const el = document.querySelector(sel)
          if (el) out[sel] = `${lines(el)} line(s)`
        }
        const acts = document.querySelector('.map-city-actions')
        if (acts) {
          out.actions = [...acts.children]
            .map((b) => {
              const box = b.getBoundingClientRect()
              return `"${b.textContent.trim()}" ${Math.round(box.width)}x${Math.round(box.height)} @y${Math.round(box.top)}`
            })
            .join(' | ')
        }
        return out
      })
      console.log(`\n== ${vp.width}x${vp.height} ${state}`)
      for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`)
    }
  }
} finally {
  await browser.close()
  preview.stop()
}
