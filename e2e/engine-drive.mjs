// `?mock=1` is the conspicuously labelled local/e2e seam, not Casey. SEC3
// deliberately puts the evaluator beyond the server boundary, so this drive
// proves the mock remains offline WITHOUT importing that authored brain.
//
// Three claims, each of which could be true in the module and false in the
// app:
//
//   1. OFFLINE. Under ?mock=1 nothing may leave the page — no proxy, no AI
//      call, nothing. Every request to any origin but the preview server is
//      recorded and fails the drive.
//   2. HONEST LABEL. The one baked opening is identified from the shipped
//      opening manifest; every later clue is the mock's `mok<n>` counter.
//   3. NO CORPUS. No book or matrix resource is emitted or fetched.
import { chromium } from 'playwright'
import openings from '../src/data/city1-opening-clues.da.json' with { type: 'json' }
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = 4187
const preview = await startPreview(PORT)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

// ---- claim 1: nothing leaves the page ------------------------------------
const escaped = []
await page.route('**/*', (route) => {
  const url = route.request().url()
  if (url.startsWith(preview.base) || url.startsWith('data:')) return route.continue()
  escaped.push(url)
  return route.abort()
})

try {
  await page.goto(`${preview.base}?mock=1&howto=0&fresh=1`)
  await page.waitForSelector('.city-card')

  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()

  // ---- play the round to its end, whatever the phases turn out to be ------
  // The same loop smoke-drive settled on: the player clues something legal and
  // unguessable, guesses once when it is their turn, and the engine does the
  // rest. Sudden death needs no handling — the player keeps guessing there
  // too, and a miss ends the round.
  let sawAiClue = false
  let spunWheel = false
  const roundDeadline = Date.now() + 60_000
  for (let i = 0; Date.now() < roundDeadline && (await page.locator('.round-summary').count()) === 0; i++) {
    await dismissRoundGuidance(page)
    const wheel = page.locator('.translate-challenge-bar .wheel-disc')
    if (!spunWheel && (await wheel.isVisible().catch(() => false))) {
      await wheel.click()
      spunWheel = true
    }
    const cap = (await page.locator('.phase-caption').textContent().catch(() => '')) ?? ''
    if (/Give Casey a clue/.test(cap)) {
      await page.fill('.clue-input input', `huskeliste${i}`)
      await page.click('.clue-input .btn-primary')
    } else if (/Your turn to guess|Last chance/.test(cap)) {
      const title = await page
        .locator('.guess-bar .dock-title')
        .textContent()
        .catch(() => null)
      if (title) {
        sawAiClue = true
        console.log('    Casey clues:', title.replace(/\s+/g, ' ').trim())
      }
      const card = page.locator('.word-card.card-guessable').first()
      if ((await card.count()) > 0) {
        await card.click()
        const confirm = page.locator('.guess-confirm .btn-primary')
        if (await confirm.isVisible().catch(() => false)) await confirm.click()
      }
    }
    // Casey thinks aloud before each guess now (U3), which is two beats per
    // guess rather than one interval. A tap on her panel skips to the next
    // beat, so this loop's forty iterations still reach a summary — and the
    // rationale it goes on to read is written on the way past either way. A
    // deadline, rather than an iteration budget, keeps added animation beats
    // from silently shrinking the proof window.
    const casey = page.locator('.dock.ai-panel[data-hurry]')
    if (await casey.isVisible().catch(() => false)) await casey.click().catch(() => {})
    await page.waitForTimeout(250)
  }
  check('the round reaches its summary', (await page.locator('.round-summary').count()) > 0)
  check('a Casey clue reached the board', sawAiClue)

  // ---- claim 2: the clues are visibly mock output --------------------------
  const stored = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}')
    const g = raw.state?.game
    return {
      authoredBoardId: raw.state?.authoredBoardId ?? null,
      history: (g?.clueHistory ?? []).map((c) => ({
        by: c.by,
        text: c.text,
        rationale: c.rationale ?? '',
        targets: c.targets ?? [],
      })),
    }
  })
  const history = stored.history
  const caseys = history.filter((c) => c.by === 'ai')
  check('Casey gave an opening and a later mock clue', caseys.length > 1, `${caseys.length} of ${history.length}`)
  const expectedOpening = openings.boards.find((entry) => entry.id === stored.authoredBoardId)
  check(
    'the sole non-mock clue is the exact baked opening for this authored board',
    expectedOpening != null && caseys[0]?.text === expectedOpening.clue,
    `${stored.authoredBoardId}: ${caseys[0]?.text ?? '(none)'}`,
  )
  const mockClues = caseys.slice(1)
  check(
    'every later clue is the explicit mock counter',
    mockClues.length > 0 && mockClues.every((c) => /^mok\d+$/i.test(c.text)),
    caseys.map((c) => c.text).join(', '),
  )
  check(
    'every later clue identifies itself as mock output',
    mockClues.length > 0 && mockClues.every((c) => /mock clue/.test(c.rationale)),
    mockClues[0]?.rationale.slice(0, 80),
  )
  const targeted = caseys.filter((c) => c.targets.length >= 1)
  check('every clue names its targets', targeted.length === caseys.length)

  // ---- claim 3: authored data never entered the client ---------------------
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => r.name.split('/').pop() ?? ''),
  )
  const dataChunks = resources.filter((n) => /^(book|matrix)/.test(n))
  check(
    'no book or matrix resource was emitted',
    dataChunks.length === 0,
    dataChunks.join(', ') || `resources: ${resources.filter((n) => n.endsWith('.js')).join(', ')}`,
  )

  // ---- and claim 1, settled last so the whole session counts --------------
  check('nothing left the page', escaped.length === 0, escaped.slice(0, 3).join(', '))
  check('no page crashes', crashes.length === 0, crashes.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

if (fail.length > 0) {
  console.error(`\n${fail.length} failure(s): ${fail.join(', ')}`)
  process.exit(1)
}
console.log('\nengine-drive: the baked opening plus explicit mock remain offline and carry no server corpus')
