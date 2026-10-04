// The website's playable intro (900words.app/play/), end to end, against the
// website Casey on workerd (proxy/web-worker.js with its Durable Object and
// rate limiters), a fake model, and a stubbed Turnstile. Flavour-only, like
// feedback-access: it builds dist-web-demo itself.
//
//   node scripts/run-drives.mjs web-demo
//
// It proves the demo is the app's own onboarding (practice round, "Play your
// first full board", bank_001, the finish-screen lessons, then the demo's end
// card), and that it keeps its promises: nothing written to the visitor's real
// storage or cookies, no service worker, no request to anything but the site,
// its Casey and Turnstile, no usage counters, and "Casey is resting" when the
// day's budget is spent.
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { startWebCasey } from './worker-runtime.mjs'
import { walkTour } from './_tutorial-lessons.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const CASEY_PORT = 4496 + OFFSET
const SHOT_DIR = process.env.SHOT_DIR ?? 'test-results'
const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'

// ---- build the demo against this drive's Casey port ---------------------------
if (!process.argv.includes('--no-demo-build')) {
  const build = spawnSync('node', ['scripts/build-web-demo.mjs'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, WEB_CASEY_URL: `http://127.0.0.1:${CASEY_PORT}/v1`, TURNSTILE_SITE_KEY },
  })
  if (build.status !== 0) throw new Error('build:web-demo failed')
}

process.env.BUILD_AUDIENCE = 'web-demo'
process.env.WEB_CASEY_URL = `http://127.0.0.1:${CASEY_PORT}/v1`
process.env.TURNSTILE_SITE_KEY = TURNSTILE_SITE_KEY
process.env.PREVIEW_DIST = 'dist-web-demo'
process.env.PREVIEW_BASE = '/play/'
const preview = await startPreview(4197)
const previewOrigin = new URL(preview.base).origin
const fake = await startFakeOllama(4397 + OFFSET, { auto: true })
let casey = await startWebCasey(CASEY_PORT, { upstream: fake.baseUrl, vars: { ALLOWED_ORIGINS: previewOrigin } })
if (!casey) throw new Error('Miniflare is required for web-demo-drive')

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })

async function openDemo(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  // The full board shows the normal round-guidance panels; take their action.
  await installRoundGuidanceHandler(page)
  const requests = []
  const notFound = []
  const errors = []
  page.on('request', (r) => requests.push(r.url()))
  page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  // Turnstile, stubbed: renders nothing and passes, as the test site key does.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'window.turnstile={render:function(el,o){setTimeout(function(){o.callback("drive-token")},20);return "w"},remove:function(){},reset:function(){}}',
  }))
  await page.goto(preview.base, { waitUntil: 'networkidle' })
  return { context, page, requests, notFound, errors }
}

/** The visitor's REAL storage for the demo's origin, read beneath the page's shim. */
async function realStorage(context, page) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('DOMStorage.enable')
  const read = async (isLocalStorage) =>
    (await cdp.send('DOMStorage.getDOMStorageItems', { storageId: { securityOrigin: previewOrigin, isLocalStorage } })).entries
  // Positive control: this path really reads the page's real storage, so an
  // empty answer below is evidence and not an origin mismatch.
  const storageId = { securityOrigin: previewOrigin, isLocalStorage: true }
  await cdp.send('DOMStorage.setDOMStorageItem', { storageId, key: 'drive-control', value: '1' })
  const control = (await read(true)).some(([key]) => key === 'drive-control')
  await cdp.send('DOMStorage.removeDOMStorageItem', { storageId, key: 'drive-control' })
  return { control, local: await read(true), session: await read(false), cookies: await context.cookies() }
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {})

async function play(page, { practice, cap = 300 } = {}) {
  let stalled = 0
  let playerTurn = 0
  for (let i = 0; i < cap; i++) {
    await page.waitForTimeout(100)
    if (await page.locator('.demo-resting').count()) return 'resting'
    if (await page.locator('[data-act="demo-end"]').count()) return 'end'
    if (await page.locator('.tutorial-finish').count()) return 'practice-finish'
    if (await page.locator('.round-summary').count()) return 'summary'
    const tour = page.locator('.tour-overlay')
    if (await tour.count()) {
      const kind = await tour.getAttribute('data-tour-kind').catch(() => null)
      if (kind === 'tutorial') {
        await tour.locator('.onboard-skip').click().catch(() => {})
        continue
      }
      if (kind) return `tour:${kind}`
      continue
    }
    const game = (await stored(page)).game
    if (!game) continue
    if (game.phase !== 'aiGuessing') stalled = 0
    if (game.phase === 'playerGuessing') {
      const clue = game.clueHistory.at(-1)
      const route = practice
        ? ({ drikke: ['da:vand', 'da:kaffe', 'da:mælk'], hjem: ['da:hus'] })[clue.text] ?? []
        : (clue.targets ?? game.words.filter((w) => game.aiKey[w.wordId] === 'green').map((w) => w.wordId))
      const done = new Set(clue.guesses.map((g) => g.wordId))
      const wordId = route.find((id) => !done.has(id) &&
        (game.reveals[id].kind === 'hidden' || (game.reveals[id].kind === 'bystander' && !game.reveals[id].against.includes('ai'))))
      if (!wordId) return `no-choice:${clue.text}`
      await page.locator(`.word-card:has(.card-word:text-is("${game.words.find((w) => w.wordId === wordId).da}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
      await page.waitForFunction(({ n, g }) => {
        const s = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return (s?.clueHistory?.[n - 1]?.guesses?.length ?? 0) > g || s?.phase !== 'playerGuessing'
      }, { n: game.clueHistory.length, g: clue.guesses.length })
    } else if (game.phase === 'playerClueInput') {
      const ids = practice
        ? [['da:mad', 'da:æble', 'da:ost']][playerTurn++] ?? []
        : game.words.filter((w) => game.playerKey[w.wordId] === 'green' && game.reveals[w.wordId].kind === 'hidden').map((w) => w.wordId).slice(0, 3)
      if (!ids.length) return 'no-player-targets'
      fake.queue(...ids.map((wordId) => ({ json: { guesses: [{ wordId, confidence: 0.9, reasoning: 'fixed web-demo reply' }] } })))
      await page.locator('.clue-input input[aria-label^="Your one-word clue"]').fill('spise')
      for (let n = 0; n < 3; n++) {
        if (Number(await page.locator('.stepper-value').innerText()) >= Math.min(ids.length, 3)) break
        await page.locator('[aria-label="more words"]').click()
      }
      await page.locator('.clue-input .btn-primary').click()
    } else if (game.phase === 'aiGuessing') {
      const panel = page.locator('.ai-panel')
      if ((await panel.getAttribute('data-hurry').catch(() => null)) === '1') { stalled = 0; await panel.click().catch(() => {}) }
      else if (++stalled >= 80) return 'stalled-ai'
    } else if (game.phase === 'translateChallenge') {
      // An owed translation lesson opens once Translation time has left.
      await page.locator('.turn-takeover').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
      if (await page.locator('.tour-overlay').count()) continue
      const next = game.wheel.segments.find((id) => game.reveals[id]?.kind === 'green' && !game.wheel.translated.includes(id))
      if (!next) return 'no-translation-target'
      await page.locator('.wheel-input').fill(game.words.find((w) => w.wordId === next).da)
      await page.locator('.wheel-confirm').click()
      await page.waitForFunction((count) => {
        const s = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return (s?.wheel?.translated?.length ?? 0) > count || s?.phase !== 'translateChallenge'
      }, game.wheel.translated.length)
    } else if (game.phase === 'translateWheel') {
      await page.locator('.turn-takeover').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
      if (await page.locator('.tour-overlay').count()) continue
      await page.locator('.wheel-disc').click()
      await page.waitForTimeout(3200)
      // The board stays after the spin until See results (owner, 2026-09-27).
      await page.locator('.wheel-results:not([disabled])').click({ timeout: 15_000 })
    }
  }
  return 'cap'
}

/** Walk every coach mark to its end with the shared checks, then keep playing. */
async function playThrough(page, practice, label) {
  for (let guard = 0; guard < 12; guard++) {
    const leg = await play(page, { practice })
    if (!leg.startsWith('tour:')) return leg
    await walkTour(page, leg.slice(5), check, { label: `${label} ${leg.slice(5)} lesson` })
  }
  return 'too-many-tours'
}

// ---- A. the whole demo at 390×844 ----------------------------------------------
{
  const { context, page, requests, notFound, errors } = await openDemo({ width: 390, height: 844 })
  check('the demo opens straight on the Danish practice board', (await page.locator('.tutorial-game .word-card').count()) === 9)
  check('with the real storage replaced by memory', await page.evaluate(() => localStorage.constructor !== Storage))
  const practiceEnd = await playThrough(page, true, 'practice')
  check('the practice round plays to its finish through the website Casey', practiceEnd === 'practice-finish', practiceEnd)
  check('the practice finish offers the first full board', /Play your first full board/.test(await page.locator('.tutorial-full-round').innerText()))
  await page.screenshot({ path: `${SHOT_DIR}/web-demo-practice-finish-390x844.png` })
  await page.locator('.tutorial-full-round').click()
  await page.waitForSelector('.board-grid')
  const board = (await stored(page))
  check('the first full board is bank_001', board.authoredBoardId === 'bank_001' && board.game?.words?.length === 18, board.authoredBoardId)
  const fullEnd = await playThrough(page, false, 'first board')
  check('the first full board plays to its finish screen', fullEnd === 'summary', fullEnd)
  const resultTour = await walkTour(page, 'result', check, { label: 'demo result lesson' })
  check('the finish screen teaches the saved result', resultTour.length > 0)
  await page.locator('.city1-review-home').click()
  await page.waitForSelector('[data-act="demo-end"]')
  check('the demo ends on its own end card, never the app\'s Home', (await page.locator('.home-screen').count()) === 0)
  check('the end card offers to play again', (await page.locator('.demo-play-again').count()) === 1)
  await page.screenshot({ path: `${SHOT_DIR}/web-demo-end-390x844.png` })

  const real = await realStorage(context, page)
  check('the real-storage reader sees the page\'s actual storage (positive control)', real.control)
  check('nothing reached the visitor\'s real localStorage', real.local.length === 0, JSON.stringify(real.local).slice(0, 200))
  // What one whole demo costs: the per-session cap must leave room for it.
  const decisions = requests.filter((u) => u.endsWith('/casey/decision')).length
  check('one whole demo stays within a visit\'s budget (40 decisions)', decisions > 0 && decisions <= 40, `${decisions} decisions`)
  check('nor sessionStorage', real.session.length === 0)
  check('nor any cookie', real.cookies.length === 0, JSON.stringify(real.cookies))
  check('no service worker was registered', (await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)) === 0)
  const hosts = new Set(requests.map((u) => new URL(u).origin))
  const allowed = new Set([previewOrigin, casey.base, 'https://challenges.cloudflare.com'])
  check('it talked only to the site, its Casey and Turnstile', [...hosts].every((h) => allowed.has(h)), [...hosts].join(', '))
  check('it sent no usage counters', !requests.some((u) => u.includes('/stats')))
  check('no request came back 404', notFound.length === 0, notFound.slice(0, 5).join(', '))
  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
  check('the website Casey checked Turnstile once per session', casey.verifyCalls.length >= 1 && casey.verifyCalls.every((c) => c.response === 'drive-token'))
  check('and used its own model key, never the app\'s', casey.upstreamCalls.length > 0 && casey.upstreamCalls.every((c) => c.auth === 'Bearer web-casey-drive-key'))

  await page.locator('.demo-play-again').click()
  await page.waitForSelector('.tutorial-game .board-grid')
  check('Play again restarts the demo from the practice board', (await page.locator('.tutorial-game .word-card').count()) === 9)
  await context.close()
}

// ---- B. the small phone, and Casey resting -------------------------------------
{
  await casey.stop()
  casey = await startWebCasey(CASEY_PORT, { upstream: fake.baseUrl, vars: { ALLOWED_ORIGINS: previewOrigin, GLOBAL_DAILY_CAP: '1' } })
  const { context, page } = await openDemo({ width: 360, height: 640 })
  check('the demo fits a 360×640 phone', await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1))
  const leg = await play(page, { practice: true })
  check('when the day\'s budget is spent, Casey says she is resting', leg === 'resting', leg)
  check('and the resting card offers the app', (await page.locator('.demo-resting .demo-app-store, .demo-resting .demo-app-soon').count()) === 1)
  await page.screenshot({ path: `${SHOT_DIR}/web-demo-resting-360x640.png` })
  await context.close()
}

await browser.close()
preview.stop()
await casey.stop()
await fake.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nWEB DEMO DRIVE OK')
if (fail.length) process.exitCode = 1
