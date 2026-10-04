import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { startWorker } from './worker-runtime.mjs'
import { createOnboardingFlow } from './_onboarding-flow.mjs'
import { released, walkTour } from './_tutorial-lessons.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ASSETS = resolve(ROOT, 'dist/assets')
const SHOT_DIR = process.env.SHOT_DIR ?? 'test-results'
const bundles = readdirSync(ASSETS)
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(resolve(ASSETS, file), 'utf8'))
const audienceMarkers = bundles.flatMap((bundle) =>
  [...bundle.matchAll(/__900WORDS_BUILD_AUDIENCE__:(normal|feedback|developer|open-source)/g)].map((match) => match[1]),
)
assert.ok(audienceMarkers.includes('normal'), 'the served build must carry the normal release-audience marker')
assert.ok(audienceMarkers.every((audience) => audience === 'normal'), `unexpected build audience markers: ${audienceMarkers.join(', ')}`)

const offset = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const preview = await startPreview(4193)
const fake = await startFakeOllama(4393 + offset, { auto: true })
let worker
let browser
try {
  worker = await startWorker(4493 + offset, {
    bundler: 'rolldown',
    upstream: fake.baseUrl,
    apiKey: 'german-onboarding-worker-key',
    vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fake-model' } }) },
  })
  assert.ok(worker, 'Miniflare is required for german-onboarding-drive')
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await context.newPage()
  const onboardingFlow = createOnboardingFlow(page)
  const errors = []
  const externalRequests = []
  const localOrigins = new Set([new URL(preview.base).origin, new URL(fake.baseUrl).origin, new URL(worker.base).origin])
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (!localOrigins.has(new URL(request.url()).origin)) externalRequests.push(request.url())
  })

  // The fresh profile gets only the local Casey endpoint required to complete
  // the real practice loop. No course/UI language, onboarding marker, or mock
  // route is preseeded.
  await page.addInitScript(({ baseUrl }) => {
    if (sessionStorage.getItem('german-onboarding-casey-seeded')) return
    sessionStorage.setItem('german-onboarding-casey-seeded', '1')
    localStorage.setItem('cluecab-settings-v1', JSON.stringify({ state: { baseUrl }, version: 13 }))
  }, { baseUrl: `${worker.base}/v1` })
  // Every turn card the page shows, by its line: no racing its 1.8 s life.
  await page.addInitScript(() => {
    window.__takeoverLines = []
    new MutationObserver(() => {
      const line = document.querySelector('.turn-takeover .turn-takeover-line')?.textContent?.trim()
      if (line && window.__takeoverLines.at(-1) !== line) window.__takeoverLines.push(line)
    }).observe(document, { subtree: true, childList: true })
  })
  await page.goto(preview.base, { waitUntil: 'networkidle' })
  const firstRunStorage = await page.evaluate(() => ({
    course: localStorage.getItem('cluecab-language'),
    ui: localStorage.getItem('cluecab-ui-language'),
  }))
  assert.deepEqual(firstRunStorage, { course: null, ui: null }, 'fresh first-run profile must not have a preseeded language')
  assert.equal(await page.locator('.onboard-screen').getAttribute('data-act'), 'language')

  // Answer the distinct "what do you speak?" question through its visible UI.
  await page.locator('.onboard-language').filter({ hasText: 'English' }).click()
  await page.waitForSelector('.onboard-screen[data-act="ticket"]')
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-language')), null, 'course language stays unselected until a ticket is tapped')

  const tickets = page.locator('.onboard-ticket')
  assert.equal(await tickets.count(), 2, 'normal release audience offers both course tickets')
  assert.equal(await page.locator('[data-act="ticket"] select').count(), 0, 'course choice uses tickets, not a select')
  const ticketTexts = (await tickets.allInnerTexts()).map((text) => text.replace(/\s+/g, ' '))
  const danishTicket = ticketTexts.find((text) => /Denmark/.test(text)) ?? ''
  const germanTicket = ticketTexts.find((text) => /Germany/.test(text)) ?? ''
  assert.match(danishTicket, /Danish \(Dansk\)/)
  assert.match(danishTicket, /900 words/)
  assert.match(germanTicket, /German \(Deutsch\)/)
  assert.match(germanTicket, /Germany/)

  // Reuse onboarding-drive's ticket → Casey → walk → Home's café → practice
  // sequence (CW-13). German is selected only by tapping its ordinary
  // visible course ticket.
  await onboardingFlow.ticketToHome('Germany')
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-language')), 'de')
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5')), 'intro')
  await page.locator('.onboard-intro-next').click()
  assert.match(await page.locator('.onboard-intro-bubble').innerText(), /Let’s explore Flensburg and see if we can find a café\./)
  await page.locator('.onboard-intro-go').click()
  await page.waitForSelector('.run-screen .run-pause')
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5')), 'walk')
  await onboardingFlow.walkToHome()
  // The German course has no café names (Flensburg): its first café is found
  // by index, and Home's line falls back to a café without a name.
  const flensburgFinds = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}').state?.cafes?.['["de","flensburg"]']?.found ?? {})
  assert.deepEqual(Object.keys(flensburgFinds), ['bank_001'], 'the walk finds Flensburg’s first café by index')
  assert.equal(await page.locator('.home-first-session .home-play').getAttribute('data-cafe-action'), 'next')
  await page.locator('.tour-panel .onboard-next').click()
  assert.equal(await page.locator('.tour-panel .tutorial-bubble').innerText(), 'Our first café is waiting. Tap Café puzzle to sit down and play it.')
  await page.locator('.tour-spot-tap').click()
  await page.waitForSelector('.tutorial-game .board-grid')
  assert.equal(await page.locator('.tutorial-game .cafe-name-tag').count(), 0, 'a café without a name wears no name tag')

  const storedState = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {})
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('cluecab-game-v1')
    const game = raw ? JSON.parse(raw).state?.game : null
    return game?.clueHistory?.some((clue) => clue.by === 'ai' && clue.text === 'Zeit')
  })
  let practiceState = await storedState()
  const tutorialGame = practiceState.game
  assert.equal(practiceState.mode, 'tutorial')
  assert.equal(await page.locator('.tutorial-game .word-card').count(), 9, 'German tutorial is the authored 3×3 practice board')
  assert.deepEqual(tutorialGame.words.map((word) => word.wordId), [
    'de:Uhr', 'de:Mutter', 'de:Vater', 'de:Haus', 'de:Monat',
    'de:Stadt', 'de:Kind', 'de:Hund', 'de:Woche',
  ])
  assert.match(await page.locator('.tutorial-casey-bubble').innerText(), /Zeit/, 'Casey visibly gives a German clue')

  // Same phase-driven interaction as onboarding-drive's playPractice loop,
  // with the German script and the real local Casey guess endpoint.
  const targetsByClue = {
    Zeit: ['de:Uhr', 'de:Monat', 'de:Woche'],
    Zuhause: ['de:Haus'],
  }
  const playerTargets = ['de:Mutter', 'de:Vater', 'de:Kind']
  let sentPlayerClue = false
  let introTourDismissed = false
  let translationLessonWalked = false
  let wheelLessonWalked = false
  let stalledAiGuesses = 0
  let practiceFinished = false
  for (let action = 0; action < 180; action++) {
    await page.waitForTimeout(100)
    practiceState = await storedState()
    const game = practiceState.game
    assert.ok(game, 'tutorial game remains persisted while the practice round runs')
    if (game.phase === 'finished') {
      practiceFinished = true
      break
    }
    if (game.phase !== 'aiGuessing') stalledAiGuesses = 0

    if (game.phase === 'playerGuessing') {
      assert.equal(
        await page.locator('.game-header .hear-board').count(),
        0,
        'hear the board is gone from the game header (owner, 2026-09-26)',
      )
      await page.screenshot({ path: `${SHOT_DIR}/de-ordinary-answer-audio-390x844.png`, fullPage: true })
      const clue = game.clueHistory.at(-1)
      const route = targetsByClue[clue?.text]
      assert.ok(route, `unexpected German Casey clue: ${clue?.text ?? '(missing)'}`)
      const already = new Set(clue.guesses.map((guess) => guess.wordId))
      const wordId = route.find((id) => {
        if (already.has(id)) return false
        const reveal = game.reveals[id]
        return reveal.kind === 'hidden' || (reveal.kind === 'bystander' && !reveal.against.includes('ai'))
      })
      assert.ok(wordId, `no available German target for Casey's ${clue.text} clue`)
      const word = game.words.find((entry) => entry.wordId === wordId)?.da
      assert.ok(word, `missing German card text for ${wordId}`)
      await page.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
      await page.waitForFunction(({ clueCount, guessCount }) => {
        const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        const activeClue = state?.clueHistory?.[clueCount - 1]
        return state?.clueHistory?.length >= clueCount && activeClue?.guesses?.length > guessCount
      }, { clueCount: game.clueHistory.length, guessCount: clue.guesses.length })
    } else if (game.phase === 'playerClueInput') {
      assert.equal(sentPlayerClue, false, 'the authored practice route asks for one player clue')
      assert.deepEqual(playerTargets.filter((id) => game.playerKey[id] === 'green' && game.reveals[id].kind === 'hidden'), playerTargets)
      const introTour = page.locator('.tour-overlay[data-tour-kind="tutorial"]')
      // Like any round, the player's turn opens with the "Give Casey a clue"
      // card; the first-clue tour waits for it to leave, then opens.
      if (!introTourDismissed) {
        assert.ok((await page.evaluate(() => window.__takeoverLines ?? [])).includes('Give Casey a clue'), 'the German practice player turn opens with the normal turn card')
        await introTour.waitFor({ state: 'attached', timeout: 6000 })
        assert.equal(await page.locator('.turn-takeover').count(), 0, 'the first-clue tour opens only after the turn card has gone')
      }
      if (await introTour.count()) {
        assert.equal(await introTour.getAttribute('data-tour-step'), '0', 'the intro-game tour opens on the first player clue')
        await introTour.locator('.onboard-skip').click()
        await introTour.waitFor({ state: 'detached' })
        introTourDismissed = true
      }
      fake.queue(...playerTargets.map((wordId) => ({
        json: { guesses: [{ wordId, confidence: 0.9, reasoning: 'fixed German onboarding reply' }] },
      })))
      await page.locator('.clue-input input[aria-label^="Your one-word clue"]').fill('Familie')
      for (let n = 0; n < 3; n++) {
        const current = Number(await page.locator('.stepper-value').innerText())
        if (current >= 3) break
        await page.locator('[aria-label="more words"]').click()
      }
      await page.locator('.clue-input .btn-primary').click()
      sentPlayerClue = true
    } else if (game.phase === 'aiGuessing') {
      const panel = page.locator('.ai-panel')
      if ((await panel.getAttribute('data-hurry')) === '1') {
        stalledAiGuesses = 0
        await panel.click()
      } else if (++stalledAiGuesses >= 100) {
        throw new Error(`German practice AI guessing stalled: ${JSON.stringify({ game: game.phase, queue: practiceState.aiGuessQueue, error: practiceState.error })}`)
      }
    } else if (game.phase === 'translateChallenge') {
      assert.equal(
        await page.locator('.game-header .hear-board').count(),
        0,
        'answer audio is absent during the translation challenge',
      )
      const challengeGeometry = await page.evaluate(() => ({
        scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        viewportHeight: window.innerHeight,
        answerAudioControls: document.querySelectorAll('.game-header .hear-board').length,
      }))
      assert.ok(challengeGeometry.scrollHeight <= challengeGeometry.viewportHeight + 1, `German translation challenge should fit: ${JSON.stringify(challengeGeometry)}`)
      await page.screenshot({ path: `${SHOT_DIR}/de-translation-challenge-390x844.png`, fullPage: true })
      if (!translationLessonWalked) {
        translationLessonWalked = true
        // The lesson opens once Translation time has gone, on the live German
        // controls, in the English UI the learner chose.
        await page.waitForSelector('.tour-overlay[data-tour-kind="translation"]', { timeout: 8000 })
        assert.equal(await page.locator('.turn-takeover').count(), 0, 'the lesson waits for the Translation time card')
        const lessonFailures = []
        const beats = await walkTour(page, 'translation', (name, ok, detail = '') => { if (!ok) lessonFailures.push(`${name} ${detail}`) }, { label: 'German practice translation lesson' })
        assert.deepEqual(lessonFailures, [], `German translation lesson beats: ${lessonFailures.join(' | ')}`)
        assert.deepEqual(beats.map((beat) => beat.anchor), [
          '.word-card-wrap[data-translation-pending="true"] .card-lid-word',
          '.wheel-answer-row',
          '.wheel-disc',
        ])
        assert.match(beats[1].text, /German/, 'the German course asks for German answers')
        assert.doesNotMatch(beats.map((beat) => beat.text).join(' '), /Danish/, 'the German course is never told to answer in Danish')
        assert.match(beats[0].text, /do not need to tap a suitcase/i)
        assert.equal(await released(page, '.wheel-input'), true, 'the German answer field is free after the lesson')
        await page.screenshot({ path: `${SHOT_DIR}/de-translation-lesson-done-390x844.png` })
      }
      const next = game.wheel.segments.find((id) => game.reveals[id]?.kind === 'green' && !game.wheel.translated.includes(id))
      assert.ok(next, 'practice translation wheel has an untranslated German word')
      const answer = game.words.find((word) => word.wordId === next)?.da
      assert.ok(answer, `missing German translation answer for ${next}`)
      await page.locator('.wheel-input').fill(answer)
      await page.locator('.wheel-confirm').click()
    } else if (game.phase === 'translateWheel') {
      assert.equal(
        await page.locator('.game-header .hear-board').count(),
        0,
        'answer audio is absent while the translation wheel is active',
      )
      const wheelGeometry = await page.evaluate(() => ({
        scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        viewportHeight: window.innerHeight,
        answerAudioControls: document.querySelectorAll('.game-header .hear-board').length,
      }))
      assert.ok(wheelGeometry.scrollHeight <= wheelGeometry.viewportHeight + 1, `German translation wheel should fit: ${JSON.stringify(wheelGeometry)}`)
      await page.screenshot({ path: `${SHOT_DIR}/de-translation-wheel-390x844.png`, fullPage: true })
      if (!wheelLessonWalked) {
        wheelLessonWalked = true
        // The full wheel gets its own one-beat lesson before the player spins.
        const wheelFailures = []
        const beats = await walkTour(page, 'wheel', (name, ok, detail = '') => { if (!ok) wheelFailures.push(`${name} ${detail}`) }, {
          label: 'German practice full-wheel lesson',
          shots: `${SHOT_DIR}/de-wheel-lesson-390x844`,
        })
        assert.deepEqual(wheelFailures, [], `German full-wheel lesson beats: ${wheelFailures.join(' | ')}`)
        assert.deepEqual(beats.map((beat) => beat.anchor), ['.wheel-disc'])
        assert.match(beats[0].text, /this spin wins/)
        assert.equal((await storedState()).game.phase, 'translateWheel', 'the lesson never spins for the player')
        assert.equal(await released(page, '.wheel-disc'), true, 'the German wheel is free to spin after the lesson')
      }
      await page.locator('.wheel-disc').click()
      await page.waitForTimeout(3200)
      // The board stays after the spin until See results (owner, 2026-09-27).
      await page.locator('.wheel-results:not([disabled])').click({ timeout: 15_000 })
    } else {
      assert.equal(game.phase, 'aiClueInput', `unexpected German practice phase ${game.phase}`)
    }
  }
  assert.ok(practiceFinished, 'the scripted German tutorial completes through its translation wheel')
  assert.equal(sentPlayerClue, true)
  assert.equal(introTourDismissed, true, 'the German practice visits and dismisses its visible first-clue coach mark')
  assert.equal(translationLessonWalked, true, 'the German practice teaches its translation controls')
  assert.equal(wheelLessonWalked, true, 'the German practice teaches the full wheel before its spin')
  assert.match(await page.locator('.tutorial-full-round').innerText(), /Play the café puzzle/)
  practiceState = await storedState()
  const scriptedClues = practiceState.game.clueHistory.filter((clue) => clue.by === 'ai').map((clue) => clue.text)
  assert.ok(scriptedClues.includes('Zeit'), `missing German Casey clue Zeit: ${scriptedClues.join(', ')}`)
  assert.ok(scriptedClues.includes('Zuhause'), `missing German Casey clue Zuhause: ${scriptedClues.join(', ')}`)
  assert.equal(await page.locator('.tutorial-finish').count(), 1)

  // Finish the tutorial on its ordinary full-round button, not Skip.
  await page.locator('.tutorial-full-round').click()
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {}
    return state.mode === 'normal' && state.authoredBoardId === 'bank_001'
  })
  const cityOneState = await storedState()
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-language')), 'de')
  assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5')), 'real-round')
  assert.equal(cityOneState.mode, 'normal')
  assert.equal(cityOneState.boardCityIndex, 0)
  assert.equal(cityOneState.authoredBoardId, 'bank_001')
  assert.equal(cityOneState.game.words.length, 18)
  assert.ok(cityOneState.game.words.every((word) => word.wordId.startsWith('de:')), 'German City 1 board contains German word IDs')

  assert.deepEqual(errors, [], `browser page errors: ${errors.join(' | ')}`)
  assert.deepEqual(externalRequests, [], `unexpected external requests: ${externalRequests.join(', ')}`)
  console.log('PASS German first run: normal audience → Germany ticket → 9-card German practice (Zeit/Zuhause) → City 1 bank_001')
} finally {
  await browser?.close()
  await worker?.stop()
  await fake.stop()
  preview.stop()
}
