// C1-17's browser-level interruption contract. The reducer, durable journal,
// Home, Casey collection and language picker have all passed their focused
// tests; this drive makes them meet on a fresh built app. It uses only a
// loopback Worker and scripted provider response, and rejects any live host.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { startFakeOllama, guessReply } from './fake-ollama.mjs'
import { startWorker } from './worker-runtime.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
// startPreview itself applies DRIVE_PORT_OFFSET; fixture servers need the
// shift here because they bind directly.
const preview = await startPreview(4500)
const fake = await startFakeOllama(4501 + OFFSET)
const worker = await startWorker(4502 + OFFSET, {
  upstream: fake.baseUrl,
  apiKey: 'c1-17-loopback-secret',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'c1-17-fixture-model' } }) },
  // Do not let npx discover or download Wrangler. Rolldown is already part of
  // this checkout's toolchain and produces the same bundled Worker fixture.
  bundler: 'rolldown',
})
if (!worker) throw new Error('Miniflare is required for the C1-17 recovery drive')

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
// Guidance is part of a normal round transition. Take its visible action so
// the recovery assertions keep measuring the actual play surface beneath it.
await installRoundGuidanceHandler(page)
const failures = []
const external = []
const errors = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith('http://127.0.0.1:') && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
page.on('pageerror', (error) => errors.push(error.message))

await page.addInitScript(({ baseUrl }) => {
  // The primary fixture is always copied into both durable representations
  // before the new document hydrates. It never plants a finished result:
  // the player still takes STOP_GUESSING and the production settlement path.
  try {
    const queued = sessionStorage.getItem('__c1_17_primary_fixture')
    if (queued) {
      const fixture = JSON.parse(queued)
      localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
      localStorage.setItem('cluecab-game-v1', fixture.cache)
      sessionStorage.removeItem('__c1_17_primary_fixture')
    }
  } catch {
    // Opaque setup documents have no session storage.
  }

  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (key === 'cluecab-settlement-v1' && sessionStorage.getItem('__c1_17_fail_receipt_once') === '1') {
      sessionStorage.removeItem('__c1_17_fail_receipt_once')
      throw new DOMException('C1-17 injected receipt write failure', 'QuotaExceededError')
    }
    return setItem.call(this, key, value)
  }

  if (!localStorage.getItem('cluecab-settings-v1')) {
    localStorage.setItem('cluecab-settings-v1', JSON.stringify({
      version: 11,
      state: { baseUrl, clueLanguage: 'en', studyPhase: 'never', useMock: false, hidePlayerClueReminder: true },
    }))
  }
  if (!localStorage.getItem('cluecab-ui-language')) localStorage.setItem('cluecab-ui-language', 'en')
  window.__c1_17_write_primary = (raw) => {
    const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const course = sessions?.state?.byCourse?.da
    if (!course?.primary || !raw?.state?.game) throw new Error('C1-17 needs a durable primary slot')
    course.primary.game = raw.state.game
    sessionStorage.setItem('__c1_17_primary_fixture', JSON.stringify({
      sessions: JSON.stringify(sessions), cache: JSON.stringify(raw),
    }))
  }
}, { baseUrl: `${worker.base}/v1` })

const url = `${preview.base}?howto=0&first=player`
const stores = () => page.evaluate(() => ({
  game: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? null,
  sessions: JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state ?? null,
  ledger: JSON.parse(localStorage.getItem('cluecab-settlement-v1') ?? '{}'),
  srs: JSON.parse(localStorage.getItem('cluecab-srs-v1') ?? '{}').state ?? null,
  language: localStorage.getItem('cluecab-ui-language'),
}))

async function waitForFakeCalls(count, timeout = 5_000) {
  const deadline = Date.now() + timeout
  while (fake.received.length < count && Date.now() < deadline) await page.waitForTimeout(20)
  if (fake.received.length < count) throw new Error(`fixture provider received ${fake.received.length}/${count} expected calls`)
}

async function freshPrimary() {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen')
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
    return saved?.activeSlot === 'primary' && !!saved.primary
  })
}

async function forcePrimarySuddenDeath() {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}')
    raw.state.game = { ...raw.state.game, phase: 'suddenDeath', turnsLeft: 0 }
    window.__c1_17_write_primary(raw)
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen')
  await page.locator('.home-play').click()
  await page.waitForSelector('.sudden-death-bar')
}

try {
  // A finished reducer state reaches the journal through the normal Stop
  // control. The injected write throws once; the next boot must recover the
  // accepted terminal verdict exactly once before making it viewable.
  await freshPrimary()
  await forcePrimarySuddenDeath()
  const beforeFailure = await stores()
  const firstAttempt = beforeFailure.sessions.byCourse.da.primary.attemptId
  const firstBoard = beforeFailure.sessions.byCourse.da.primary.board.authoredBoardId
  await page.evaluate(() => sessionStorage.setItem('__c1_17_fail_receipt_once', '1'))
  await page.locator('.sudden-death-bar .btn-ghost').click()
  await page.waitForSelector('.error-banner')
  const interrupted = await stores()
  check('a failed terminal receipt write leaves a recoverable finished primary, not a claimed reward',
    interrupted.game?.game?.phase === 'finished' && interrupted.game?.roundRecorded === false &&
      Object.keys(interrupted.ledger.settlements ?? {}).length === 0,
    JSON.stringify({ phase: interrupted.game?.game?.phase, recorded: interrupted.game?.roundRecorded, receipts: Object.keys(interrupted.ledger.settlements ?? {}).length }),
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.home-screen')
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('cluecab-settlement-v1') ?? '{}').settlements ?? {}).length === 1)
  const recovered = await stores()
  const recoveredReceipts = Object.values(recovered.ledger.settlements ?? {})
  const recoveredReceipt = recoveredReceipts[0]?.receipt
  const expectedEffects = ['learning', 'games', 'streak', 'associations', 'session']
  check('reload recovers the same terminal attempt and applies every durable effect once',
    recoveredReceipt?.attemptId === firstAttempt && recoveredReceipts.length === 1 &&
      JSON.stringify(recoveredReceipt?.effects) === JSON.stringify(expectedEffects) &&
      JSON.stringify(recoveredReceipts[0]?.acknowledgedEffects) === JSON.stringify(expectedEffects) &&
      recovered.srs?.games?.played === 1,
    JSON.stringify({ attemptId: recoveredReceipt?.attemptId, planned: recoveredReceipt?.effects, acknowledged: recoveredReceipts[0]?.acknowledgedEffects, played: recovered.srs?.games?.played }),
  )
  await page.locator('.home-play').click()
  await page.waitForSelector('.receipt-result')
  await page.waitForSelector('.receipt-postcard-total')
  check('the recovered immutable receipt is rendered through the Home result route',
    (await page.locator('.receipt-postcard-total').count()) === 1,
  )
  if (process.env.SHOT_DIR) {
    await page.screenshot({ path: `${process.env.SHOT_DIR}/c1-17-recovered-receipt.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Play next game' }).click()
  await page.waitForSelector('.board-grid')
  const primaryBeforeReplay = (await stores()).sessions.byCourse.da.primary
  check('the next primary starts only after the recovered result is acknowledged',
    primaryBeforeReplay.board.authoredBoardId !== firstBoard && primaryBeforeReplay.game.phase !== 'finished',
    JSON.stringify({ firstBoard, nextBoard: primaryBeforeReplay.board.authoredBoardId, phase: primaryBeforeReplay.game.phase }),
  )

  // Pause the primary, open its completed predecessor in Casey's collection,
  // and start a replay from the actual collection control.
  await page.locator('.game-header > .icon-btn').first().click()
  await page.waitForSelector('.leave-game-dialog')
  await page.locator('.leave-game-dialog .btn-primary').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.casey-board-collection')
  await page.locator('button.collection-board-card').first().click()
  await page.waitForSelector('.collection-detail[open]')
  await page.locator('.collection-detail .btn-primary').click()
  await page.waitForSelector('.board-grid')
  const replayStarted = await stores()
  check('collection replay preserves the exact parked primary and records an independent replay slot',
    JSON.stringify(replayStarted.sessions.byCourse.da.primary) === JSON.stringify(primaryBeforeReplay) &&
      replayStarted.sessions.byCourse.da.replay?.board?.authoredBoardId === firstBoard &&
      replayStarted.sessions.byCourse.da.activeSlot === 'replay',
    JSON.stringify({ active: replayStarted.sessions.byCourse.da.activeSlot, replay: replayStarted.sessions.byCourse.da.replay?.board?.authoredBoardId }),
  )

  // This selection reloads the app through the real Settings control. An active
  // attempt retains its captured English prompt language while future chrome
  // becomes German; the slot must not settle, move, or disappear.
  await page.locator('.game-header > .icon-btn').first().click()
  await page.waitForSelector('.leave-game-dialog')
  await page.locator('.leave-game-dialog .btn-primary').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.home-top .icon-btn').click()
  await page.waitForSelector('.settings-screen')
  await page.getByLabel(/^Your language/).selectOption('de')
  await page.waitForSelector('.home-screen')
  const switched = await stores()
  const shellLanguage = await page.evaluate(() => document.documentElement.lang)
  check('a UI-language switch preserves both slots and their captured prompt language',
    switched.language === 'de' && shellLanguage === 'de' &&
      JSON.stringify(switched.sessions.byCourse.da.primary) === JSON.stringify(primaryBeforeReplay) &&
      switched.sessions.byCourse.da.replay?.promptLanguage === 'en' &&
      Object.keys(switched.ledger.settlements ?? {}).length === 1,
    JSON.stringify({ language: switched.language, replayPrompt: switched.sessions.byCourse.da.replay?.promptLanguage, receipts: Object.keys(switched.ledger.settlements ?? {}).length }),
  )
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const replayAfterSwitch = await stores()
  check('the localized shell resumes the same replay rather than issuing a new attempt',
    replayAfterSwitch.sessions.byCourse.da.activeSlot === 'replay' &&
      replayAfterSwitch.game?.attemptId === replayStarted.sessions.byCourse.da.replay.attemptId &&
      replayAfterSwitch.game?.gameUiLanguage === 'en',
    JSON.stringify({ active: replayAfterSwitch.sessions.byCourse.da.activeSlot, attempt: replayAfterSwitch.game?.attemptId, prompt: replayAfterSwitch.game?.gameUiLanguage }),
  )
  await page.locator('.game-header > .icon-btn').first().click()
  await page.waitForSelector('.leave-game-dialog')
  await page.locator('.leave-game-dialog .btn-danger').click()
  await page.waitForSelector('.home-screen')
  const replayCancelled = await stores()
  check('cancelling a replay removes only that slot and never changes the parked primary or receipt',
    replayCancelled.sessions.byCourse.da.replay === null &&
      JSON.stringify(replayCancelled.sessions.byCourse.da.primary) === JSON.stringify(primaryBeforeReplay) &&
      Object.keys(replayCancelled.ledger.settlements ?? {}).length === 1,
    JSON.stringify({ replay: replayCancelled.sessions.byCourse.da.replay, receipts: Object.keys(replayCancelled.ledger.settlements ?? {}).length }),
  )
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const returnedPrimary = await stores()
  check('Home returns from the cancelled replay to the exact suspended primary',
    returnedPrimary.game?.attemptId === primaryBeforeReplay.attemptId &&
      JSON.stringify(returnedPrimary.game?.game) === JSON.stringify(primaryBeforeReplay.game),
  )

  // A real browser request crosses the local Worker and then waits on the
  // scripted provider. Cancelling before it answers followed by a new primary
  // must make the delayed reply an inert stale event.
  await freshPrimary()
  const staleStart = await stores()
  const staleAttempt = staleStart.sessions.byCourse.da.primary.attemptId
  const staleBoard = staleStart.sessions.byCourse.da.primary.board.authoredBoardId
  const staleTarget = staleStart.game.game.words.find((word) => staleStart.game.game.playerKey[word.wordId] === 'green').wordId
  fake.reset()
  fake.queue({ ...guessReply([staleTarget]), delayMs: 750 })
  await page.locator('#clue-word').fill('fælles')
  await page.locator('.clue-input .btn-primary').click()
  await page.waitForSelector('.dock.ai-panel')
  await waitForFakeCalls(1)
  await page.locator('.game-header > .icon-btn').first().click()
  await page.waitForSelector('.leave-game-dialog')
  await page.locator('.leave-game-dialog .btn-danger').click()
  await page.waitForSelector('.home-screen')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const replacement = await stores()
  await page.waitForTimeout(850)
  const afterStaleReply = await stores()
  check('the delayed local Casey reply cannot mutate a cancelled attempt or consume its board',
    fake.received.length === 1 && replacement.game.attemptId !== staleAttempt &&
      afterStaleReply.game.attemptId === replacement.game.attemptId &&
      afterStaleReply.sessions.byCourse.da.primary.board.authoredBoardId === staleBoard &&
      Object.keys(afterStaleReply.ledger.settlements ?? {}).length === 0,
    JSON.stringify({ fakeCalls: fake.received.length, oldAttempt: staleAttempt, currentAttempt: afterStaleReply.game.attemptId, board: afterStaleReply.sessions.byCourse.da.primary.board.authoredBoardId }),
  )

  check('the recovery fixture made no browser request to a live host', external.length === 0, external.join(' | '))
  check('no browser error occurred during failure recovery, replay, language switch or stale reply', errors.length === 0, errors.join(' | '))
} catch (error) {
  console.log('C1-17 INTEGRATION RECOVERY DRIVE FAILED:', error.stack ?? error.message)
  failures.push('drive execution')
} finally {
  await browser.close()
  await worker.stop()
  await fake.stop()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nC1-17 INTEGRATION RECOVERY DRIVE OK')
if (failures.length) process.exitCode = 1
