// The hidden performance log (src/ui/diagnostics): found by seven taps on the
// build stamp in Settings, recording a Sightseeing run's answers and a café
// card tap, and exporting one valid JSON document. Also checks the promise to
// players: with the log off, nothing of the page is wrapped.
//
//   DIAG_SHOTS=_shots node e2e/diagnostics-drive.mjs   also saves screenshots
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const SHOTS = process.env.DIAG_SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, name) })
}

const preview = await startPreview(4313)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? chromium.executablePath() })
const fail = (message) => {
  throw new Error(message)
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  const page = await context.newPage()
  await page.addInitScript(mergeFirstCafe, seedArgs('da'))
  await installRoundGuidanceHandler(page)
  page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

  // ── off: nothing wrapped, nothing shown ─────────────────────────────────
  await page.goto(`${preview.base}?howto=0&seed=1701&mock=1`)
  await page.locator('.home-play').first().waitFor()
  const native = await page.evaluate(() => ({
    setTimeout: String(window.setTimeout).includes('[native code]'),
    setItem: String(Storage.prototype.setItem).includes('[native code]'),
    play: String(HTMLMediaElement.prototype.play).includes('[native code]'),
    audio: String(window.Audio).includes('[native code]'),
    hook: '__REACT_DEVTOOLS_GLOBAL_HOOK__' in window,
  }))
  for (const [k, v] of Object.entries(native)) if (k === 'hook' ? v : !v) fail(`with the log off, ${k} was touched`)

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const stamp = page.locator('.build-footer > span').first()
  await stamp.waitFor()
  if (await page.locator('[data-testid="diag-section"]').count()) fail('the performance log shows before the taps')
  // Five taps with a pause keep their old meaning (the keyboard readout) and do not reveal the log.
  for (let i = 0; i < 5; i++) await stamp.click()
  await page.waitForTimeout(900)
  if (await page.locator('[data-testid="diag-section"]').count()) fail('five taps revealed the performance log')
  if ((await page.evaluate(() => localStorage.getItem('cluecab-kbdebug'))) !== '1') fail('five taps no longer toggle the keyboard readout')
  for (let i = 0; i < 5; i++) await stamp.click()
  await page.waitForTimeout(900)
  if ((await page.evaluate(() => localStorage.getItem('cluecab-kbdebug'))) !== null) fail('five more taps did not toggle the readout back')

  for (let i = 0; i < 7; i++) await stamp.click()
  const section = page.locator('[data-testid="diag-section"]')
  await section.waitFor()
  if ((await page.evaluate(() => localStorage.getItem('cluecab-kbdebug'))) !== null) fail('seven taps toggled the keyboard readout on the way')
  await section.locator('.diag-rec-toggle').check()
  if ((await page.evaluate(() => localStorage.getItem('cluecab-diag-rec'))) !== '1') fail('recording was not remembered')
  await page.locator('.build-footer').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await shot(page, 'diag-section-390x844.png')

  // ── a short Sightseeing walk, recorded from launch (so React commits count) ──
  await page.goto(`${preview.base}?howto=0&mock=1&sightseeing=words&auto=4`)
  const hooked = await page.evaluate(() => '__REACT_DEVTOOLS_GLOBAL_HOOK__' in window && !String(window.setTimeout).includes('[native code]'))
  if (!hooked) fail('recording did not start at launch')
  await page.locator('.run-screen .run-panel .run-tag-btn-primary').click()
  // A tap on the road: a `steer` hit.
  await page.waitForTimeout(600)
  const box = await page.locator('.run-stage').boundingBox()
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.6)
  await page.locator('.run-title-wrong').waitFor({ timeout: 90_000 })
  await page.waitForTimeout(1800)
  await page.locator('.run-home').click()
  await page.locator('.home-play').first().waitFor()

  // ── a café card tap ──────────────────────────────────────────────────────
  await page.locator('.home-play[data-cafe-action="next"]').click()
  await page.locator('.game-screen').waitFor()
  await dismissRoundGuidance(page)
  const card = page.locator('.word-card:not([disabled])').first()
  await card.waitFor()
  await card.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' })
  await page.waitForTimeout(1800)

  // ── back in Settings: the summary, the switches, the export ─────────────
  // Leave the round paused (the arrow, then Pause), as a player would.
  await page.getByRole('button', { name: 'Home', exact: true }).first().click()
  const pause = page.locator('.leave-pause')
  await pause.waitFor({ timeout: 3000 }).then(() => pause.click(), () => {})
  const toSettings = page.getByRole('button', { name: 'Settings', exact: true })
  await toSettings.waitFor()
  await toSettings.click()
  await section.waitFor()
  const summary = await section.locator('.diag-summary').textContent()
  console.log(`summary: ${summary}`)
  if (!/^[1-9]\d* hits/.test(summary ?? '')) fail(`no hits in the summary: ${summary}`)
  await section.locator('.diag-switch[data-switch="runPictures"] input').check()
  if (!(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-diag-switches') ?? '{}').runPictures === true))) fail('a switch was not stored')
  await page.locator('.build-footer').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await shot(page, 'diag-section-recording-390x844.png')

  const [download] = await Promise.all([page.waitForEvent('download'), section.locator('.diag-send').click()])
  const log = JSON.parse(readFileSync(await download.path(), 'utf8'))
  if (log.format !== '900words-perf-log' || log.version !== 1) fail('the export is not a performance log')
  if (!log.switches.includes('runPictures')) fail('the export does not name the switches that are on')
  if (!log.device || typeof log.device.dpr !== 'number' || !log.device.userAgent) fail('the export has no device info')
  const hits = log.events.filter((e) => e.type === 'hit')
  const kinds = new Set(hits.map((h) => h.kind))
  // Since #403 a walk mixes meaning and article gates: either kind of answer counts.
  const has = (...any) => any.some((k) => kinds.has(k))
  if (!has('answer-right', 'article-right')) fail(`no right answer recorded (got ${[...kinds].join(', ')})`)
  if (!has('answer-wrong', 'article-wrong')) fail(`no wrong answer recorded (got ${[...kinds].join(', ')})`)
  if (!kinds.has('card')) fail(`no card hit recorded (got ${[...kinds].join(', ')})`)
  for (const h of hits) {
    for (const field of ['inputDelay', 'handler', 'firstFrame', 'worstGap', 'haptic', 'playCall', 'playResolved', 'cost']) {
      if (!(field in h)) fail(`a hit has no ${field}`)
    }
    if (h.handler === null || h.worstGap === null) fail(`a ${h.kind} hit was not measured: ${JSON.stringify(h)}`)
  }
  const right = hits.find((h) => h.kind === 'answer-right' || h.kind === 'article-right')
  if (right.playCall === null) fail(`a right answer's word was not timed: ${JSON.stringify(right)}`)
  const snaps = log.events.filter((e) => e.type === 'snap')
  if (!snaps.some((s) => s.reason === 'home')) fail('no Home snapshot')
  const last = snaps.at(-1)
  if (!(last.reactCommits > 0)) fail('React commits were not counted')
  if (typeof last.audio.reloaded !== 'number') fail('no media reuse count')
  if (!(last.audio.created > 0) || !(last.canvas.created > 0) || !(last.storage.chars > 0)) fail(`the snapshot counted nothing: ${JSON.stringify(last)}`)
  console.log(`export: ${hits.length} hits (${[...kinds].join(', ')}), ${snaps.length} snapshots, ${log.events.length} events, ${JSON.stringify(log).length} chars`)
  console.log(`last snapshot: audio ${JSON.stringify(last.audio)} canvas ${JSON.stringify(last.canvas)} storage ${last.storage.chars} chars, listeners ${JSON.stringify(last.listeners.window)}/${JSON.stringify(last.listeners.document)}, timers ${JSON.stringify(last.timers)}, commits ${last.reactCommits}`)

  // ── off again: everything put back ──────────────────────────────────────
  await section.locator('.diag-switch[data-switch="runPictures"] input').uncheck()
  await section.locator('.diag-rec-toggle').uncheck()
  const restored = await page.evaluate(() => String(window.setTimeout).includes('[native code]') && String(Storage.prototype.setItem).includes('[native code]'))
  if (!restored) fail('turning recording off did not put the originals back')
  console.log('DIAGNOSTICS DRIVE OK')
} finally {
  await browser.close()
  preview.stop()
}
