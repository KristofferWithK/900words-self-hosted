// How long the app takes to answer a tap on slower phones, with and without a
// long play history.
//
// Measures the built app (run `npm run build` first) in Chromium at 390x844,
// with the main thread slowed by CDP's CPU throttling (1x, 4x and 6x by
// default; 4x is about a mid-range Android, 6x a low-end one). Each rate runs
// on a fresh save and on one with a long history: 250 rounds settled by the
// app's own settlement code (e2e/_latency-seed.mjs). Casey is the mock
// (`?mock=1`), so no Worker is needed.
//
// What is measured, per labelled step:
//   - tap: Event Timing's duration for the step's input (pointer or key), from
//     the input to the next paint after its handlers ran. Entries under 16 ms
//     are not reported by the browser and show as "<16".
//   - task: the longest main-thread task (Long Tasks API) while the step ran.
//   - screen changes also report the time from the tap to the new screen
//     being painted, and app start the time from navigation to Home.
//
// It prints a table (label x rate x history), the median over --runs of each
// run's worst value. Exit is non-zero only if, at --gate-rate with
// --gate-history rounds, a tap exceeds --budget (200 ms) or a screen change
// (Play to the board, See results) exceeds --screen-budget (500 ms): the
// owner's release targets. So later PRs can use it as a gate. Timing is
// machine-dependent: compare base and branch on the same machine, one probe
// at a time, with nothing else building.
//
//   node e2e/latency-probe.mjs [--rates=1,4,6] [--history=0,250] [--runs=3]
//     [--budget=200] [--screen-budget=500] [--gate-rate=4] [--gate-history=250]
//     [--json=<file>]
//     [--no-wheel] [--verbose] [--legacy-seed]
//
// The seeded save is what the app now keeps: recent rounds in full, older
// ones summarised in the ledger with their full receipts in the history
// archive (IndexedDB). --legacy-seed instead seeds every round in full, as
// builds before the archive left a save: its first settle then also moves the
// old rounds to the archive, a one-time cost on the first update.
//
// PREVIEW_DIST=<absolute dir> measures another build (a branch's dist/) with
// this probe and this tree's cached seed, so base and branch are compared on
// the identical save.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'
import { buildLatencySeed } from './_latency-seed.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const RATES = arg('rates', '1,4,6').split(',').map(Number)
const HISTORIES = arg('history', '0,250').split(',').map(Number)
const RUNS = Number(arg('runs', '3'))
const BUDGET = Number(arg('budget', '200'))
const SCREEN_BUDGET = Number(arg('screen-budget', '500'))
const GATE_RATE = Number(arg('gate-rate', '4'))
const GATE_HISTORY = Number(arg('gate-history', '250'))
const JSON_OUT = arg('json', null)
const VERBOSE = process.argv.includes('--verbose')
const WHEEL = !process.argv.includes('--no-wheel')
const LEGACY_SEED = process.argv.includes('--legacy-seed')

// Steps whose tap or screen time is an interaction the budget applies to.
// App start and Casey's guessing turn are reported, not gated: neither is a
// response to a tap.
const LABELS = [
  ['app-start', 'App start to Home'],
  ['home-to-board', 'Home: Play to board'],
  ['board-to-clue', 'Board dealt to Casey\'s clue shown'],
  ['guidance', 'Round guidance: take its action'],
  ['info-open', 'Card ⓘ: open the sheet'],
  ['info-close', 'Sheet: close'],
  ['card-tap', 'Guess: tap a card'],
  ['guess-confirm', 'Guess: confirm'],
  ['guess-stop', 'Guess: stop'],
  ['clue-keystroke', 'Clue box: first keystroke'],
  ['clue-typing', 'Clue box: later keystrokes'],
  ['clue-submit', 'Clue box: give the clue'],
  ['casey-guessing', 'Casey guessing (whole turn)'],
  ['wheel-submit', 'Wheel: pack a word'],
  ['wheel-spin', 'Wheel: spin'],
  ['wheel-results', 'Wheel: See results (settles the round)'],
]
const GATED = new Set(['home-to-board', 'guidance', 'info-open', 'info-close', 'card-tap', 'guess-confirm', 'guess-stop',
  'clue-keystroke', 'clue-typing', 'clue-submit', 'wheel-submit', 'wheel-spin', 'wheel-results'])
// Taps that open a new screen get the screen budget (owner, 2026-09-29):
// their next paint IS the new screen.
const SCREEN_CHANGES = new Set(['home-to-board', 'wheel-results'])
const budgetFor = (label) => (SCREEN_CHANGES.has(label) ? SCREEN_BUDGET : BUDGET)

if (!existsSync(resolve(process.env.PREVIEW_DIST ?? resolve(ROOT, 'dist'), 'index.html'))) throw new Error('no build to measure: run npm run build first')

/** The seed is slow to build (every settle re-validates the whole ledger), so
 * it is kept per source tree under node_modules/.cache, never committed. */
async function seedFor(rounds) {
  if (!rounds) return null
  const hash = createHash('sha256')
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|tsx|json)$/.test(entry.name) && !/\.test\./.test(entry.name)) hash.update(entry.name).update(readFileSync(path))
    }
  }
  for (const dir of ['src/progression', 'src/srs', 'src/session', 'src/journey', 'src/data', 'src/engine']) walk(resolve(ROOT, dir))
  hash.update(readFileSync(resolve(ROOT, 'src/stores/settlementStore.ts')))
  hash.update(readFileSync(resolve(ROOT, 'src/stores/historyArchive.ts')))
  hash.update(readFileSync(resolve(ROOT, 'e2e/_latency-seed.mjs')))
  const cache = resolve(ROOT, 'node_modules', '.cache', 'latency-probe', `seed-${rounds}${LEGACY_SEED ? '-legacy' : ''}-${hash.digest('hex').slice(0, 16)}.json`)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  console.log(`building the ${rounds}-round seed (a few minutes, once per source tree)…`)
  const started = Date.now()
  const { seedStorage, archiveEntries, ledgerBytes } = await buildLatencySeed({ rounds, archive: !LEGACY_SEED })
  console.log(`  built in ${Math.round((Date.now() - started) / 1000)} s; ledger ${Math.round(ledgerBytes / 1024)} KB, ${archiveEntries.length} rounds archived`)
  const seed = { storage: seedStorage, archive: archiveEntries }
  mkdirSync(dirname(cache), { recursive: true })
  writeFileSync(cache, JSON.stringify(seed))
  return seed
}

// Installed before any app script. Small on purpose: it runs inside the
// measured boot.
const INSTRUMENT = () => {
  const probe = { marks: [{ label: 'app-start', t: 0 }], events: [], tasks: [], inputAt: null }
  window.__probe = probe
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) probe.events.push({ name: e.name, start: e.startTime, duration: e.duration, id: e.interactionId ?? 0 })
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) probe.tasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* reported as missing entries */ }
  // The first input since a screen step began: a later one (the round
  // guidance handler dismissing a panel, say) must not move the start.
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, (e) => { probe.inputAt ??= e.timeStamp }, true)
  probe.mark = (label) => probe.marks.push({ label, t: performance.now() })
  // Resolves once `selector` matches and the frame that shows it has
  // painted, or with NaN after two minutes.
  probe.painted = (selector, gone = false) => new Promise((done) => {
    const until = performance.now() + 120_000
    const check = () => {
      const present = !!document.querySelector(selector)
      if (present !== gone) requestAnimationFrame(() => setTimeout(() => done(performance.now())))
      else if (performance.now() > until) done(Number.NaN)
      else requestAnimationFrame(check)
    }
    check()
  })
  probe.home = probe.painted('.city-card')
}

/**
 * Seed through a same-origin page outside the app's base, so the (several
 * megabyte) save is never part of the measured boot. The history archive is
 * written only for the seed check (`withArchive`): nothing in play reads it, a
 * settle adds one round whatever it holds, and writing megabytes of it just
 * before a measured run slowed the run's first steps, which no phone does.
 */
async function applySeed(page, preview, seed, withArchive = false) {
  await page.goto(new URL('/latency-probe-seed', preview.base).href)
  await page.evaluate(async ({ storage, archive }) => {
    localStorage.clear()
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    if (!archive.length) return
    // The app's history archive (src/stores/historyArchive.ts), as it would
    // have filled it.
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('cluecab-history-v1', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('receipts')
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    await new Promise((resolve, reject) => {
      const tx = db.transaction('receipts', 'readwrite')
      for (const entry of archive) tx.objectStore('receipts').put(entry, entry.receipt.receiptId)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, withArchive ? seed : { ...seed, archive: [] })
}

/** What the save holds now: the ledger's size, its full and archived rounds,
 * and the history archive's count. */
const savedShape = (page) => page.evaluate(async () => {
  const raw = localStorage.getItem('cluecab-settlement-v1') ?? '{"settlements":{}}'
  const ledger = JSON.parse(raw)
  const archive = await new Promise((resolve) => {
    const open = indexedDB.open('cluecab-history-v1', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('receipts')
    open.onerror = () => resolve(-1)
    open.onsuccess = () => {
      const count = open.result.transaction('receipts').objectStore('receipts').count()
      count.onsuccess = () => { open.result.close(); resolve(count.result) }
      count.onerror = () => { open.result.close(); resolve(-1) }
    }
  })
  return `ledger ${Math.round(raw.length / 1024)} KB, ${Object.keys(ledger.settlements ?? {}).length} rounds in full, ` +
    `${Object.keys(ledger.archived ?? {}).length} summarised; history archive ${archive} rounds`
})

/** Once per seed, unthrottled and unmeasured: the seeded save must boot to
 * Home and open Casey's collection with its played boards, without errors. */
async function checkSeed({ browser, preview, seed, rounds }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await applySeed(page, preview, seed, true)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location()?.url ?? ''}`))
  await page.goto(`${preview.base}?mock=1&seed=5&howto=0`)
  await page.waitForSelector('.city-card', { timeout: 30_000 })
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.casey-board-collection', { timeout: 30_000 })
  await page.waitForSelector('button.collection-board-card', { timeout: 30_000 }).catch(() => {})
  const played = await page.locator('button.collection-board-card').count()
  const next = await page.locator('.collection-primary').innerText()
  const shape = await savedShape(page)
  await context.close()
  if (errors.length || !played) throw new Error(`the ${rounds}-round seed does not boot cleanly: ${played} played boards shown; ${errors.slice(0, 3).join(' | ')}`)
  console.log(`seed check, ${rounds} rounds: Home and Casey's collection render (${played} played boards on its first page; "${next}"), no page errors; ${shape}`)
}

async function measure({ browser, preview, rate, seed }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await installRoundGuidanceHandler(page)

  if (seed) await applySeed(page, preview, seed)
  // Before any number is trusted: the app must run without errors, the
  // seeded save included.
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location()?.url ?? ''}`))
  await page.addInitScript(INSTRUMENT)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })

  const screens = {}
  const mark = (label) => page.evaluate((l) => window.__probe.mark(l), label)
  /** Tap-to-painted time for a screen change, beside the step's own entries. */
  const screen = async (label, selector, act, gone = false) => {
    await mark(label)
    await page.evaluate(({ s, g }) => { window.__probe.inputAt = null; window.__probe.waiting = window.__probe.painted(s, g) }, { s: selector, g: gone })
    await act()
    const [shown, input] = await page.evaluate(async () => [await window.__probe.waiting, window.__probe.inputAt])
    if (!Number.isFinite(shown) || input === null) throw new Error(`${label}: ${selector} was never ${gone ? 'removed' : 'shown'} after the tap`)
    screens[label] = Math.max(screens[label] ?? 0, shown - input)
  }
  // Quiet: no long task for 400 ms (or 8 s passed), so one step's leftover
  // work is not charged to the next.
  const settle = () => page.evaluate(() => new Promise((done) => {
    const until = performance.now() + 8000
    const check = () => {
      const last = window.__probe.tasks.reduce((end, t) => Math.max(end, t.start + t.duration), 0)
      if (performance.now() - last > 400 || performance.now() > until) done()
      else setTimeout(check, 100)
    }
    setTimeout(check, 100)
  }))
  const guidance = async () => {
    await mark('guidance')
    const took = await dismissRoundGuidance(page)
    await settle()
    return took
  }
  const phase = () => page.locator('.phase-caption').textContent().catch(() => '')
  const game = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game ?? null)

  await page.goto(`${preview.base}?mock=1&seed=5&howto=0`)
  const appStart = await page.evaluate(() => window.__probe.home)
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  await settle()

  await screen('home-to-board', '.board-grid', () => page.locator('.home-play').click())
  await mark('board-to-clue')
  await page.waitForFunction(() => document.querySelector('dialog.round-guidance-dialog[open]') ||
    document.querySelector('.word-card.card-guessable'), undefined, { timeout: 60_000 })
  await settle()
  await guidance()

  // Casey's opening clue: look a card up, then guess her words until the
  // turn ends (a wrong guess or the clue's count), then stop if still asked.
  async function guessTurn() {
    await page.waitForSelector('.word-card.card-guessable', { timeout: 60_000 })
    const infoCard = page.locator('.word-card-surface .card-info').first()
    if (await infoCard.isVisible().catch(() => false)) {
      await screen('info-open', '.sheet', () => infoCard.click())
      await settle()
      await screen('info-close', '.sheet', () => page.click('.sheet .sheet-close'), true)
      await settle()
    }
    for (let guess = 0; guess < 4; guess++) {
      if (await dismissRoundGuidance(page)) await settle()
      const state = await game()
      if (!state || state.phase !== 'playerGuessing') break
      // Cards render in the game's word order; guess one of Casey's words.
      const index = await page.evaluate((s) => [...document.querySelectorAll('.word-card')].findIndex((card, i) =>
        card.classList.contains('card-guessable') && s.aiKey[s.words[i]?.wordId] === 'green' &&
        s.reveals[s.words[i]?.wordId]?.kind === 'hidden'), state)
      const target = index >= 0 ? page.locator('.word-card').nth(index) : page.locator('.word-card.card-guessable').first()
      await mark('card-tap')
      await target.click()
      await page.waitForSelector('.guess-confirm .btn-primary', { timeout: 30_000 })
      await settle()
      await mark('guess-confirm')
      await page.locator('.guess-confirm .btn-primary').click()
      await settle()
    }
    const stop = page.locator('.guess-bar .btn-ghost')
    if (await stop.isVisible().catch(() => false)) {
      await mark('guess-stop')
      await stop.click()
      await settle()
    }
  }
  await guessTurn()

  // The player's clue, typed as a player types it.
  for (let i = 0; i < 3 && !(await page.locator('#clue-word').isVisible().catch(() => false)); i++) {
    if (!(await dismissRoundGuidance(page))) await page.waitForTimeout(500)
    await settle()
  }
  await page.waitForSelector('#clue-word', { timeout: 60_000 })
  await page.locator('#clue-word').click()
  await settle()
  await mark('clue-keystroke')
  await page.keyboard.press('h')
  await settle()
  await mark('clue-typing')
  await page.keyboard.type('uskeliste', { delay: 60 })
  await settle()
  await mark('clue-submit')
  await page.click('.clue-input .btn-primary')
  await mark('casey-guessing')
  await page.waitForFunction(() => !document.querySelector('.phase-caption')?.textContent?.includes('Casey is guessing'), undefined, { timeout: 120_000 })
  await settle()

  // Casey's next clue, if the round goes on: a second sample of each guess step.
  await guidance()
  if ((await phase())?.includes('Your turn')) await guessTurn()

  // To the wheel: play the round out (Casey's words on her clues, a new clue
  // on the player's turns, the remaining key words in sudden death), pack one
  // word and spin. The play-out itself is not reported; the wheel's steps are.
  if (WHEEL) {
    const clues = ['dyreliv', 'trafik', 'kæledyr', 'sommer', 'køkken', 'familie', 'vejret', 'skolen', 'penge', 'musik', 'havet', 'bilen']
    let clue = 0
    for (let step = 0; step < 60; step++) {
      await mark('play-out')
      if (await dismissRoundGuidance(page)) { await settle(); continue }
      const state = await game()
      if (!state || ['translateChallenge', 'translateWheel', 'finished'].includes(state.phase)) break
      if (state.phase === 'playerGuessing' || state.phase === 'suddenDeath') {
        const index = await page.evaluate((s) => [...document.querySelectorAll('.word-card')].findIndex((card, i) => {
          const id = s.words[i]?.wordId
          const key = s.phase === 'suddenDeath' ? s.playerKey[id] === 'green' || s.aiKey[id] === 'green' : s.aiKey[id] === 'green'
          return card.classList.contains('card-guessable') && key && s.reveals[id]?.kind === 'hidden'
        }), state)
        if (index < 0) {
          const stop = page.locator('.guess-bar .btn-ghost')
          if (await stop.isVisible().catch(() => false)) await stop.click()
          else await page.waitForTimeout(500)
        } else {
          await page.locator('.word-card').nth(index).click()
          const confirm = page.locator('.guess-confirm .btn-primary')
          if (await confirm.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await confirm.click()
        }
      } else if (state.phase === 'playerClueInput' && await page.locator('#clue-word').isVisible().catch(() => false)) {
        for (let tries = 0; tries < clues.length; tries++) {
          await page.fill('#clue-word', clues[clue++ % clues.length])
          if (await page.locator('.clue-input .btn-primary').isEnabled()) break
        }
        await page.click('.clue-input .btn-primary')
      } else {
        await page.waitForFunction((was) => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase !== was,
          state.phase, { timeout: 120_000 }).catch(() => {})
      }
      await settle()
    }
    const state = await game()
    if (state?.phase !== 'translateChallenge') throw new Error(`the play-out did not reach the wheel (phase ${state?.phase})`)
    await page.waitForSelector('.wheel-input', { timeout: 30_000 })
    const packable = state.words.find((w) => state.reveals[w.wordId]?.kind === 'green' && state.wheel.segments.includes(w.wordId))
    await page.fill('.wheel-input', packable.da)
    await settle()
    await mark('wheel-submit')
    await page.locator('.wheel-confirm').click()
    await page.waitForFunction(() => document.querySelectorAll('.card-wheel-packed').length === 1, undefined, { timeout: 30_000 })
    await settle()
    await mark('wheel-spin')
    await page.locator('.wheel-disc').click()
    await page.locator('.wheel-results:not([disabled])').waitFor({ timeout: 60_000 })
    await settle()
    // See results settles the round: the receipt, its learning and every
    // effect are written here, so it is the step a long history weighs on most.
    await screen('wheel-results', '.city1-review-dialog[open]', () => page.locator('.wheel-results').click())
    await settle()
  }

  const raw = await page.evaluate(() => window.__probe)
  if (VERBOSE && seed) console.log(`    after the run: ${await savedShape(page)}`)
  if (VERBOSE) console.log(`    steps: ${raw.marks.map((m) => `${m.label}@${Math.round(m.t)}`).join(' ')}`)
  await context.close()
  if (errors.length) throw new Error(`the page reported errors: ${errors.slice(0, 3).join(' | ')}`)

  // Charge each entry to the step whose window holds its start.
  const marks = [...raw.marks].sort((a, b) => a.t - b.t)
  const labelAt = (t) => { let label = null; for (const m of marks) if (m.t <= t) label = m.label; return label }
  const result = {}
  const slot = (label) => (result[label] ??= { tap: null, task: null, screen: null })
  for (const e of raw.events) {
    if (!['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'keypress', 'input', 'beforeinput'].includes(e.name)) continue
    const label = labelAt(e.start)
    if (label) slot(label).tap = Math.max(slot(label).tap ?? 0, e.duration)
  }
  for (const t of raw.tasks) {
    const label = labelAt(t.start)
    if (label) slot(label).task = Math.max(slot(label).task ?? 0, t.duration)
  }
  for (const [label, ms] of Object.entries(screens)) slot(label).screen = ms
  slot('app-start').screen = appStart
  for (const m of marks) slot(m.label)
  return { result, metrics: { script: metrics.ScriptDuration * 1000, task: metrics.TaskDuration * 1000 } }
}

const median = (values) => {
  const v = values.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b)
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null
}
const fmt = (ms, seen) => (ms === null ? (seen ? '<16' : '-') : String(Math.round(ms)))

const preview = await startPreview(4330)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const cells = {}
try {
  const seeds = {}
  for (const h of HISTORIES) seeds[h] = await seedFor(h)
  for (const h of HISTORIES) if (seeds[h]) await checkSeed({ browser, preview, seed: seeds[h], rounds: h })
  for (const history of HISTORIES) {
    for (const rate of RATES) {
      const runs = []
      for (let run = 0; run < RUNS; run++) {
        const started = Date.now()
        runs.push(await measure({ browser, preview, rate, seed: seeds[history] }))
        console.log(`  ${rate}x, ${history} rounds, run ${run + 1}/${RUNS}: ${Math.round((Date.now() - started) / 1000)} s`)
      }
      const cell = {}
      for (const [label] of LABELS) {
        const seen = runs.some((r) => r.result[label])
        cell[label] = { seen, ...Object.fromEntries(['tap', 'task', 'screen'].map((k) => [k, median(runs.map((r) => r.result[label]?.[k] ?? null))])) }
      }
      cell.boot = { script: median(runs.map((r) => r.metrics.script)), task: median(runs.map((r) => r.metrics.task)) }
      cells[`${rate}x/${history}`] = cell
    }
  }
} finally {
  await browser.close()
  preview.stop()
}

const columns = HISTORIES.flatMap((h) => RATES.map((r) => `${r}x/${h}`))
const table = (title, key, labels) => {
  console.log(`\n${title}\n`)
  console.log(`| Step | ${columns.map((c) => c.replace('/', ', ') + ' rounds').join(' | ')} |`)
  console.log(`|---|${columns.map(() => '---:').join('|')}|`)
  for (const [label, name] of labels) {
    console.log(`| ${name} | ${columns.map((c) => fmt(cells[c][label][key], cells[c][label].seen && key === 'tap')).join(' | ')} |`)
  }
}
console.log(`\nMedian of ${RUNS} run(s), each run's worst value, in ms. Budget ${BUDGET} ms per tap, ${SCREEN_BUDGET} ms per screen change, at ${GATE_RATE}x with ${GATE_HISTORY} rounds.`)
table('Tap to next paint (Event Timing)', 'tap', LABELS.filter(([l]) => l !== 'app-start' && l !== 'casey-guessing' && l !== 'board-to-clue'))
table('Tap to new screen painted', 'screen', LABELS.filter(([l]) => ['app-start', 'home-to-board', 'info-open', 'info-close', 'wheel-results'].includes(l)))
table('Longest main-thread task during the step', 'task', LABELS)
console.log(`\n| Boot (Performance.getMetrics) | ${columns.join(' | ')} |\n|---|${columns.map(() => '---:').join('|')}|`)
for (const k of ['script', 'task']) console.log(`| ${k === 'script' ? 'ScriptDuration' : 'TaskDuration'} | ${columns.map((c) => fmt(cells[c].boot[k])).join(' | ')} |`)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ rates: RATES, histories: HISTORIES, runs: RUNS, cells }, null, 2))

const gateCell = cells[`${GATE_RATE}x/${GATE_HISTORY}`]
const over = gateCell
  ? LABELS.filter(([l]) => GATED.has(l)).flatMap(([l, name]) => ['tap', 'screen']
    .filter((k) => (gateCell[l][k] ?? 0) > budgetFor(l)).map((k) => `${name} (${k} ${Math.round(gateCell[l][k])} ms, budget ${budgetFor(l)})`))
  : []
if (over.length) {
  console.log(`\nOVER BUDGET at ${GATE_RATE}x with ${GATE_HISTORY} rounds: ${over.join('; ')}`)
  process.exit(1)
}
console.log(gateCell ? `\nWithin budget at ${GATE_RATE}x with ${GATE_HISTORY} rounds.` : '\n(gate cell not measured)')
