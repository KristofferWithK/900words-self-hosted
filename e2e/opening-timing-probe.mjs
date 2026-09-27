// One-off timing probe (owner question, 2026-09-18): how fast from pressing
// Play on Home to Casey's first clue pop-up?
//
// Measures the REAL user path against the REAL Worker:
//   Home -> tap .home-play -> game screen -> (authored opening request to the
//   production Worker) -> clue banner/round-guidance panel visible.
//
// Two modes:
//   default        — network NOT blocked: the authored opening goes to the live
//                    Worker like the phone does (only /v1/stats beacons are
//                    aborted). Reports ms from click to clue + to guidance panel.
//   MOCK=1         — the ?mock=1 local prototype (no network): measures the
//                    client-side floor without the Worker.
//
// No app changes. Read-only measurement of dist/.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const SHOT_DIR = process.env.SHOT_DIR ?? resolve('e2e-shots')
mkdirSync(SHOT_DIR, { recursive: true })
const preview = await startPreview(Number(process.env.DRIVE_PORT_OFFSET ?? 0) + 4290)
let browser

const RUNS = Number(process.env.RUNS ?? 3)

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
  const viewport = { width: 390, height: 844 }
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
    const external = []
    const decisions = []
    await context.route('**/*', async (route) => {
      const url = route.request().url()
      if (new URL(url).origin === new URL(preview.base).origin) return route.continue()
      if (new URL(url).pathname.endsWith('/v1/casey/decision')) {
        const d0 = Date.now()
        const headers = { ...route.request().headers(), origin: 'capacitor://localhost' }
        const live = await route.fetch({ headers })
        if (route.request().method() === 'POST') {
          decisions.push({ t: Date.now(), body: route.request().postData() })
          console.error(`  decision POST -> ${live.status()} in ${Date.now() - d0}ms`)
        }
        // The live Worker answers with ACAO capacitor://localhost (the phone's
        // origin). Echo THIS page's origin so the app can read the response.
        const body = await live.body()
        const liveHeaders = { ...live.headers() }
        for (const k of Object.keys(liveHeaders)) if (k.startsWith('access-control-')) delete liveHeaders[k]
        await route.fulfill({
          status: live.status(),
          headers: {
            ...liveHeaders,
            'access-control-allow-origin': new URL(preview.base).origin,
            'access-control-allow-headers': 'Authorization, Content-Type, X-Install-Id',
            'access-control-allow-methods': 'POST, OPTIONS',
          },
          body,
        })
        return
      }
      if (/\/v1\/stats$/.test(new URL(url).pathname)) return route.abort()
      external.push(url)
      return route.abort()
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    await page.addInitScript(() => {
      const of = window.fetch
      window.__fetchLog = []
      window.fetch = async (...args) => {
        const res = await of(...args)
        try {
          const u = String(args[0])
          window.__fetchLog.push({ u: String(args[0]).slice(-60), status: res.status,
            body: u.includes('/casey/decision') ? (await res.clone().text()).slice(0, 160) : undefined })
        } catch {}
        return res
      }
      const start = () => {
        window.__t = {}
        const mark = (k) => { if (!window.__t[k]) window.__t[k] = Math.round(performance.now()) }
        new MutationObserver(() => {
          if (document.querySelector('.board-grid')) mark('board')
          if (document.querySelector('dialog.round-guidance-dialog[open]')) mark('guidance-dialog')
          if (document.querySelector('.guess-bar .clue-lookup')) mark('guess-bar-clue')
          if (document.querySelector('.ai-bubble.thinking')) mark('thinking-bubble')
          const say = document.querySelector('.ai-panel')
          if (say && !document.querySelector('.ai-bubble.thinking')) mark('ai-panel-no-think')
        }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open'] })
      }
      if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start)
    })
    const home = preview.base + (process.env.MOCK ? '?mock=1&howto=0&city=0' : '?howto=0&city=0')
    await page.goto(home, { waitUntil: 'networkidle' })
    const play = page.locator('.home-play')
    assert.ok(await play.isVisible(), 'Play visible')

    const t0 = Date.now()
    await play.click()
    await page.evaluate(() => { window.__t = window.__t || {}; window.__t['click'] = Math.round(performance.now()) }).catch(() => {})
    // The clue pop-up: the round-guidance 'casey' panel shows clue text/number.
    // But on b90 it only fires AFTER her clue lands and the phase reaches the
    // player's guessing turn. The FIRST evidence of the clue on screen is the
    // dock's clue bar. Measure BOTH: dock clue visible, guidance panel visible.
    await page.waitForSelector('.game-screen .board-grid', { timeout: 15_000 })
    const tBoard = Date.now()
    // The clue lands in the dock: phase flips to playerGuessing with clue text.
    await page.waitForSelector('.round-guidance-dialog, .guess-bar .clue-lookup', { timeout: 20_000 }).catch(() => {})
    // Fallback: wait for the guidance dialog (the 'casey' panel) OR the clue text element.
    // Wait until the guidance dialog has been seen (or 20s cap) so marks are complete.
    await page.waitForFunction(() => window.__t && window.__t['guidance-dialog'], { timeout: 20_000 }).catch(() => {})
    const marks = await page.evaluate(() => window.__t).catch(() => ({}))
    console.log(`marks: ${JSON.stringify(marks)}`)
    const decisionLatencies = []
    for (const d of decisions) {
      const view = JSON.parse(d.body || '{}')
      decisionLatencies.push({ at: d.t - t0 })
    }
    const rel = (k) => (marks['click'] != null && marks[k] != null) ? `${marks[k] - marks['click']}ms` : 'n/a'
    console.log(`run ${run}: play->board ${tBoard - t0} ms | play->thinking ${rel('thinking-bubble')} | play->clue-popup ${rel('guidance-dialog')} | decision requests: ${JSON.stringify(decisionLatencies)}`)
    await page.screenshot({ path: resolve(SHOT_DIR, `opening-timing-${run}.png`) })
    const phase = await page.evaluate(() => {
      const say = document.querySelector('.ai-panel')
      const banner = document.querySelector('.error-banner, [class*=error]')
      return { aiPanel: !!say, dlg: !!document.querySelector('dialog.round-guidance-dialog[open]'),
               banner: banner ? banner.textContent?.slice(0, 120) : null,
               fetchLog: window.__fetchLog, t: window.__t }
    }).catch(() => null)
    console.log('end-state:', JSON.stringify(phase))
    await context.close()
  }
  console.log('PROBE OK')
} finally {
  if (browser) await browser.close()
  process.exit(process.exitCode ?? 0)
}