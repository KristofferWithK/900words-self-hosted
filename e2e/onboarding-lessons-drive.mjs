// The contextual onboarding lessons on their harder paths, at 390×844 (the
// ordinary first run at 360×640 is onboarding-drive's):
//   - practice skipped BEFORE translation: the first full board teaches the
//     translation controls instead, and the ordinary translation panel does
//     not stack on top of it or come back after it
//   - a reload in the middle of an owed lesson offers it again; a dismissed
//     lesson (Skip or Escape) is never offered twice
//   - the result lesson re-offers itself after a reload without re-settling or
//     re-awarding anything, and it never opens the review for the player
//   - the Home stamp lesson, skipped, still leaves Casey's collection tour
//   - Settings' Replay the intro teaches translation on the practice board in
//     memory only, offers no "Continue" of the paused primary, plays the full
//     game (the first café, fresh) with its finish-screen stamp lesson
//     (owner 2026-10-04), and hands back the exact paused primary
// Each spotlight is checked on its live control: light on target, the tour
// holding the pointer while it is up, and nothing left over the control after.
import { chromium, webkit } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startWorker } from './worker-runtime.mjs'
import { createOnboardingFlow } from './_onboarding-flow.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { lessonMarkers, progressBytes, released, walkTour } from './_tutorial-lessons.mjs'

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const preview = await startPreview(4194)
const fake = await startFakeOllama(4394 + OFFSET, { auto: true })
const casey = await startWorker(4494 + OFFSET, {
  bundler: 'rolldown',
  upstream: fake.baseUrl,
  apiKey: 'onboarding-lessons-worker-key',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fake-model' } }) },
})
if (!casey) throw new Error('Miniflare is required for onboarding-lessons-drive')
const LOCAL_CASEY_BASE = `${casey.base}/v1`
const BASE = preview.base
const SHOT_DIR = process.env.SHOT_DIR ?? 'test-results'
const VP = { width: 390, height: 844 }

// DRIVE_BROWSER=webkit runs the same journey in Playwright's WebKit where one
// is installed (Linux WebKit is not an iPhone; it is the nearest engine a
// machine without a phone has).
const ENGINE = process.env.DRIVE_BROWSER === 'webkit' ? 'webkit' : 'chromium'
const browser = ENGINE === 'webkit'
  ? await webkit.launch()
  : await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
console.log(`engine: ${ENGINE} ${browser.version()}`)
const ctx = await browser.newContext({ viewport: VP, serviceWorkers: 'block' })
const page = await ctx.newPage()
const flow = createOnboardingFlow(page)
await installRoundGuidanceHandler(page)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const localOrigins = new Set([new URL(BASE).origin, new URL(fake.baseUrl).origin, new URL(casey.base).origin])
const externalRequests = []
page.on('request', (request) => {
  if (!localOrigins.has(new URL(request.url()).origin)) externalRequests.push(request.url())
})
await page.addInitScript(({ baseUrl }) => {
  if (!sessionStorage.getItem('lessons-drive-seeded')) {
    sessionStorage.setItem('lessons-drive-seeded', '1')
    localStorage.setItem('cluecab-settings-v1', JSON.stringify({ state: { baseUrl }, version: 13 }))
    localStorage.setItem('cluecab-ui-language', 'en')
  }
  // Every round-guidance panel that ever opens, by title: proof that the
  // ordinary translation panel never stood beside (or after) the lesson.
  window.__guidanceSeen = []
  new MutationObserver(() => {
    const open = document.querySelector('dialog.round-guidance-dialog[open] h2')
    const title = open?.textContent?.trim()
    if (title && window.__guidanceSeen.at(-1) !== title) window.__guidanceSeen.push(title)
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
}, { baseUrl: LOCAL_CASEY_BASE })

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}
const open = async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}
const marker = () => page.evaluate(() => localStorage.getItem('cluecab-onboard-v5'))
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {})
const guidanceSeen = () => page.evaluate(() => window.__guidanceSeen ?? [])
const noScroll = async (name) => {
  const r = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: window.innerHeight }))
  check(`no-scroll: ${name}`, r.sh <= r.ih + 1, `${r.sh} vs ${r.ih}`)
}

/**
 * Play the current round through its ordinary controls until `stopAt(game)`
 * says so or it finishes. Guesses follow the clue-giver's key read from the
 * persisted public state, like onboarding-drive; the translation step types
 * each remaining answer WITHOUT tapping a suitcase first.
 */
async function play({ practice = false, stopAt = () => false, cap = 260 } = {}) {
  let stalled = 0
  let playerTurn = 0
  for (let i = 0; i < cap; i++) {
    await page.waitForTimeout(100)
    const game = (await stored()).game
    if (!game) return 'no-game'
    if (stopAt(game)) return 'stopped'
    if (game.phase === 'finished') return 'finished'
    if (game.phase !== 'aiGuessing') stalled = 0
    // A spotlight that is up owns the screen; the caller walks it.
    if (await page.locator('.tour-overlay').count()) {
      const kind = await page.locator('.tour-overlay').getAttribute('data-tour-kind')
      if (kind === 'tutorial') {
        await page.locator('.tour-overlay .onboard-skip').click()
        continue
      }
      return `tour:${kind}`
    }
    if (game.phase === 'playerGuessing') {
      const clue = game.clueHistory.at(-1)
      const route = practice
        ? ({ drikke: ['da:vand', 'da:kaffe', 'da:mælk'], hjem: ['da:hus'] })[clue.text] ?? []
        : (clue.targets ?? game.words.filter((w) => game.aiKey[w.wordId] === 'green').map((w) => w.wordId))
      const done = new Set(clue.guesses.map((g) => g.wordId))
      const wordId = route.find((id) => !done.has(id) &&
        (game.reveals[id].kind === 'hidden' || (game.reveals[id].kind === 'bystander' && !game.reveals[id].against.includes('ai'))))
      if (!wordId) return `no-choice:${clue.text}`
      const word = game.words.find((w) => w.wordId === wordId).da
      await page.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
      await page.waitForFunction(({ n, g }) => {
        const s = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return (s?.clueHistory?.[n - 1]?.guesses?.length ?? 0) > g || s?.phase !== 'playerGuessing'
      }, { n: game.clueHistory.length, g: clue.guesses.length })
    } else if (game.phase === 'playerClueInput') {
      if (practice && !game.clueHistory.some((clue) => clue.by === 'player')) {
        // Like any round, "Give Casey a clue" plays first; the first-clue
        // tour opens after it. Let it, and skip it, before touching the dock.
        const tour = page.locator('.tour-overlay[data-tour-kind="tutorial"]')
        await tour.waitFor({ state: 'attached', timeout: 6000 }).catch(() => {})
        if (await tour.count()) {
          await tour.locator('.onboard-skip').click()
          await tour.waitFor({ state: 'detached' })
        }
      }
      const ids = practice
        ? [['da:mad', 'da:æble', 'da:ost']][playerTurn++] ?? []
        : game.words.filter((w) => game.playerKey[w.wordId] === 'green' && game.reveals[w.wordId].kind === 'hidden').map((w) => w.wordId).slice(0, 3)
      if (!ids.length) return 'no-player-targets'
      fake.queue(...ids.map((wordId) => ({ json: { guesses: [{ wordId, confidence: 0.9, reasoning: 'fixed lessons-drive reply' }] } })))
      await page.locator('.clue-input input[aria-label^="Your one-word clue"]').fill('spise')
      for (let n = 0; n < 3; n++) {
        if (Number(await page.locator('.stepper-value').innerText()) >= Math.min(ids.length, 3)) break
        await page.locator('[aria-label="more words"]').click()
      }
      await page.locator('.clue-input .btn-primary').click()
    } else if (game.phase === 'aiGuessing') {
      const panel = page.locator('.ai-panel')
      if ((await panel.getAttribute('data-hurry')) === '1') { stalled = 0; await panel.click() }
      else if (++stalled >= 60) return 'stalled-ai'
    } else if (game.phase === 'translateChallenge') {
      const next = game.wheel.segments.find((id) => game.reveals[id]?.kind === 'green' && !game.wheel.translated.includes(id))
      if (!next) return 'no-translation-target'
      await page.locator('.wheel-input').fill(game.words.find((w) => w.wordId === next).da)
      await page.locator('.wheel-confirm').click()
      await page.waitForFunction((count) => {
        const s = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
        return (s?.wheel?.translated?.length ?? 0) > count || s?.phase !== 'translateChallenge'
      }, game.wheel.translated.length)
    } else if (game.phase === 'translateWheel') {
      // An owed full-wheel lesson opens once the wheel's card has left: wait
      // for that, then look, rather than guessing a delay.
      await page.locator('.turn-takeover').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
      if (await page.locator('.tour-overlay').count()) continue
      await page.locator('.wheel-disc').click()
      await page.waitForTimeout(3200)
      // The board stays after the spin until See results (owner, 2026-09-27).
      await page.locator('.wheel-results:not([disabled])').click({ timeout: 15_000 })
    } else if (game.phase !== 'aiClueInput') {
      return `unexpected:${game.phase}`
    }
  }
  return 'cap'
}

// ---- A. practice skipped before translation ---------------------------------
await open()
await flow.ticketToHome('Denmark')
await flow.homeToTutorial()
await page.locator('.tutorial-game .onboard-skip').click()
await page.waitForSelector('.board-grid')
check('skipping practice opens the required first full board', (await marker()) === 'real-round' && (await page.locator('.word-card').count()) === 18)
check('and leaves the translation lesson owed', (await lessonMarkers(page)).translation === undefined)

const toTranslation = await play({ stopAt: (game) => game.phase === 'translateChallenge' })
check('the first full board reaches its translation step', toTranslation === 'stopped' || toTranslation === 'tour:translation', toTranslation)
await page.waitForSelector('.tour-overlay[data-tour-kind="translation"]', { timeout: 8000 })
check('the owed lesson opens on the full board after Translation time', (await page.locator('.turn-takeover').count()) === 0)
check('with the ordinary translation panel held back', (await page.locator('dialog.round-guidance-dialog[open]').count()) === 0)
const reloadBefore = (await stored()).game
await open()
await page.waitForSelector('.tour-overlay[data-tour-kind="translation"]', { timeout: 8000 })
const boardOf = (game) => JSON.stringify({ phase: game?.phase, words: game?.words?.map((w) => w.wordId), reveals: game?.reveals, clues: game?.clueHistory?.length, wheel: game?.wheel })
const reloadAfter = (await stored()).game
check('a reload mid-lesson offers the owed lesson again on the same board',
  boardOf(reloadAfter) === boardOf(reloadBefore), `${boardOf(reloadBefore).slice(0, 120)} → ${boardOf(reloadAfter).slice(0, 120)}`)
const fallbackBeats = await walkTour(page, 'translation', check, { label: 'full-board translation lesson', finish: 'skip', atStep: 1, shots: `${SHOT_DIR}/lessons-full-board-translation-lesson-390x844` })
check('the full-board lesson starts on the waiting suitcase lids', fallbackBeats[0]?.anchor === '.word-card-wrap[data-translation-pending="true"] .card-lid-word', fallbackBeats[0]?.anchor)
check('its answer-field beat names the Danish course and the tick', /Danish/.test(fallbackBeats[1]?.text ?? '') && /tick/.test(fallbackBeats[1]?.text ?? ''), fallbackBeats[1]?.text)
check('Skip records the lesson as dismissed', (await lessonMarkers(page)).translation === 'dismissed')
await page.waitForTimeout(800)
check('the ordinary translation panel does not follow the lesson', !(await guidanceSeen()).includes('Translation time'), JSON.stringify(await guidanceSeen()))
check('the answer field is free after the lesson', await released(page, '.wheel-input'))
await page.screenshot({ path: `${SHOT_DIR}/lessons-full-board-translation-390x844.png` })
// Translate one word with no suitcase selected: any remaining answer counts.
const beforeAnswer = (await stored()).game
const anyWord = beforeAnswer.wheel.segments.filter((id) => beforeAnswer.reveals[id]?.kind === 'green' && !beforeAnswer.wheel.translated.includes(id)).at(-1)
await page.locator('.wheel-input').fill(beforeAnswer.words.find((w) => w.wordId === anyWord).da)
await page.locator('.wheel-confirm').click()
await page.waitForFunction((id) => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.wheel?.translated?.includes(id), anyWord)
check('the LAST waiting word is accepted without selecting its suitcase', (await stored()).selectedWordId == null)
await open()
await page.waitForTimeout(2600)
check('a reload after dismissal does not bring the lesson back', (await page.locator('.tour-overlay[data-tour-kind="translation"]').count()) === 0)

const toWheel = await play()
check('practice skipped: the first full board offers the full-wheel lesson', toWheel === 'tour:wheel', toWheel)
const wheelBefore = (await stored()).game
await walkTour(page, 'wheel', check, {
  label: 'full-board full-wheel lesson',
  finish: 'skip',
  atStep: 0,
  shots: `${SHOT_DIR}/lessons-full-board-wheel-lesson-390x844`,
})
check('Skip records the full-wheel lesson as dismissed', (await lessonMarkers(page)).wheel === 'dismissed')
check('the lesson never spins for the player', JSON.stringify((await stored()).game) === JSON.stringify(wheelBefore))
check('the full wheel is free to spin after it', await released(page, '.wheel-disc'))
await open()
await page.waitForTimeout(2600)
check('a reload does not bring a dismissed full-wheel lesson back', (await page.locator('.tour-overlay[data-tour-kind="wheel"]').count()) === 0)

const toSummary = await play()
check('the first full board finishes', toSummary === 'finished' || toSummary === 'tour:result', toSummary)
await page.waitForSelector('.round-summary')
await page.waitForSelector('.tour-overlay[data-tour-kind="result"]', { timeout: 8000 })
const settledBytes = await progressBytes(page)
await open()
await page.waitForSelector('.tour-overlay[data-tour-kind="result"]', { timeout: 8000 })
check('a reload on the result re-offers the owed result lesson from its start',
  (await page.locator('.tour-overlay[data-tour-kind="result"]').getAttribute('data-tour-step')) === '0')
check('and re-settles or re-awards nothing', JSON.stringify(await progressBytes(page)) === JSON.stringify(settledBytes))
await walkTour(page, 'result', check, { label: 'reloaded result lesson', finish: 'escape', atStep: 1 })
check('Escape records the result lesson as dismissed', (await lessonMarkers(page)).result === 'dismissed')
check('Escape closed only the lesson, not the result', (await page.locator('.round-summary').count()) === 1)
await open()
await page.waitForSelector('.round-summary')
await page.waitForTimeout(600)
check('a dismissed result lesson stays dismissed across a reload', (await page.locator('.tour-overlay[data-tour-kind="result"]').count()) === 0)
check('and still nothing was awarded twice', JSON.stringify(await progressBytes(page)) === JSON.stringify(settledBytes))
await noScroll('the first-board result at 390×844')
await page.locator('.city1-review-home').click()
await page.waitForSelector('.onboard-home-act .home-first-session')
await walkTour(page, 'home', check, { label: 'skipped Home lesson', finish: 'skip', atStep: 0 })
check('skipping the Home lesson keeps the intro going', (await lessonMarkers(page)).home === 'dismissed' && (await marker()) === 'home-return')
check('Casey is tappable after the skipped Home lesson', await released(page, '.home-first-session .cluey-button'))
await page.locator('.home-first-session .cluey-button').click()
await page.waitForSelector('.tour-overlay[data-tour-kind="suitcase"]')
check('the existing collection tour still follows', (await page.locator('.suitcase-screen').count()) === 1)
await walkTour(page, 'suitcase', check, { label: 'collection tour after a skipped Home lesson' })
await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
await page.waitForSelector('.home-screen:not(.home-first-session)')
check('the intro ends on ordinary Home with its markers cleared',
  (await marker()) === 'done' && await page.evaluate(() => localStorage.getItem('cluecab-onboard-lessons-v1') === null))

// ---- B. Settings replay with a paused primary --------------------------------
// The café gate is on (CW-13): the next café is found as a walk would find it.
await page.evaluate(mergeFirstCafe, seedArgs('da', 2))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.locator('.home-play').click()
await page.waitForSelector('.game-screen .board-grid')
await play({ stopAt: (game) => game.phase === 'playerGuessing' || game.phase === 'playerClueInput' })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(750)
const parked = await page.evaluate(() => {
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return { active: sessions?.activeSlot ?? null, primary: sessions?.primary ? JSON.stringify(sessions.primary) : null }
})
check('the replay starts over a real paused primary', parked.active === 'primary' && parked.primary !== null)
await page.locator('.icon-btn[aria-label="Settings"]').click()
await page.waitForSelector('.settings-screen')
await page.locator('.replay-intro').click()
await page.waitForTimeout(300)
await flow.ticketToHome('Denmark')
await flow.introToWalk()
await flow.walkToHome()
// Home's café act over the paused primary: the Café puzzle tag names the
// city's first café, as a first session sees it, never "Continue board".
check('the replayed Home café act does not offer to continue the paused round',
  (await page.locator('.home-play').getAttribute('data-cafe-action')) !== 'continue' &&
  !/Continue/.test(await page.locator('.home-play').innerText()) &&
  (await page.locator('.home-play-second').count()) === 0,
  await page.locator('.home-play').innerText())
await flow.homeCafeToTutorial()
check('the replay sits down at a fresh practice table', await page.evaluate(() => {
  const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state
  // At most Casey's opening clue, and not one card turned yet.
  return game?.mode === 'tutorial' && game?.tutorialDemo === true && (game?.game?.clueHistory?.length ?? 9) <= 1 &&
    Object.values(game?.game?.reveals ?? { x: {} }).every((reveal) => reveal.kind === 'hidden')
}))
const practiceLeg = await play({ practice: true, stopAt: (game) => game.phase === 'translateChallenge' })
check('the replayed practice reaches translation', practiceLeg === 'stopped' || practiceLeg === 'tour:translation', practiceLeg)
const replayBeats = await walkTour(page, 'translation', check, { label: 'replayed practice translation lesson', shots: `${SHOT_DIR}/lessons-replay-translation-lesson-390x844` })
check('the replay teaches translation again on the practice board', replayBeats.length === 3 && replayBeats[2]?.anchor === '.wheel-disc')
check('a replay writes no lesson markers', await page.evaluate(() => localStorage.getItem('cluecab-onboard-lessons-v1') === null))
const replayWheel = await play({ practice: true })
check('the replayed practice offers the full-wheel lesson again', replayWheel === 'tour:wheel', replayWheel)
await walkTour(page, 'wheel', check, { label: 'replayed practice full-wheel lesson', shots: `${SHOT_DIR}/lessons-replay-wheel-lesson-390x844` })
check('and a replay still writes no lesson markers', await page.evaluate(() => localStorage.getItem('cluecab-onboard-lessons-v1') === null))
const practiceEnd = await play({ practice: true })
check('the replayed practice finishes', practiceEnd === 'finished', practiceEnd)
await page.waitForSelector('.tutorial-finish')
check('the replay finish leads into the café puzzle, as on the first time', /Play the café puzzle/.test(await page.locator('.tutorial-full-round').innerText()),
  await page.locator('.tutorial-full-round').innerText())
await page.locator('.tutorial-full-round').click()
// Phase 2 of the intro is a full game whose finish screen explains the stamp
// (owner, 2026-10-04). A replay plays it too: the city's first café, dealt
// fresh beside the paused primary, which it never touches.
await page.waitForSelector('.game-screen .board-grid')
const replayBoard = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return { board: state?.authoredBoardId, slot: state?.activeSlot, cards: state?.game?.words?.length, clues: state?.game?.clueHistory?.length,
    primary: sessions?.primary ? JSON.stringify(sessions.primary) : null }
})
check('the replay plays the full game: the first café, fresh, not the paused round',
  replayBoard.board === 'bank_001' && replayBoard.slot === 'replay' && replayBoard.cards === 18 && replayBoard.clues <= 1 && replayBoard.primary === parked.primary,
  JSON.stringify({ ...replayBoard, primary: replayBoard.primary === parked.primary }))
check('no Continue offer during the replay', (await page.getByText('Continue board').count()) === 0)
await page.screenshot({ path: `${SHOT_DIR}/lessons-replay-full-game-390x844.png` })
const replayEnd = await play()
check('the replayed full game finishes', replayEnd === 'finished' || replayEnd === 'tour:result', replayEnd)
await page.waitForSelector('.round-summary')
// The light is drawn once the saved receipt's lines are laid out (the
// summary's receipt is lazy): measure the beats from there, as a player sees them.
await page.waitForSelector('.tour-overlay[data-tour-kind="result"] .tour-spot', { timeout: 8000 })
await walkTour(page, 'result', check, { label: 'replayed finish-screen stamp lesson', shots: `${SHOT_DIR}/lessons-replay-result-lesson-390x844` })
check('the replay finish screen taught the stamp, and wrote no lesson marker', await page.evaluate(() => localStorage.getItem('cluecab-onboard-lessons-v1') === null))
await page.locator('.city1-review-home').click()
await page.waitForSelector('.onboard-home-act .home-first-session')
const restored = await page.evaluate(() => {
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return { primary: sessions?.primary ? JSON.stringify(sessions.primary) : null }
})
check('the paused primary is the exact same round after the full game', restored.primary === parked.primary)
check('Home inside the replay offers no Continue', (await page.locator('.home-play').getAttribute('data-cafe-action')) !== 'continue')
await page.screenshot({ path: `${SHOT_DIR}/lessons-replay-home-stamp-lesson-390x844.png` })
await walkTour(page, 'home', check, { label: 'replayed Home lesson' })
await page.locator('.home-first-session .cluey-button').click()
await page.waitForSelector('.tour-overlay[data-tour-kind="suitcase"]')
await walkTour(page, 'suitcase', check, { label: 'replayed collection tour' })
await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
await page.waitForSelector('.home-screen:not(.home-first-session)')
check('after the replay, ordinary Home offers the paused round again',
  (await page.locator('.home-play').getAttribute('data-cafe-action')) === 'continue')
await page.locator('.home-play').click()
await page.waitForSelector('.game-screen .board-grid')
check('and it is the same round, continued', await page.evaluate((before) => {
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return sessions?.activeSlot === 'primary' && sessions.primary?.attemptId === JSON.parse(before).attemptId
}, parked.primary))
check('and the done flag never moved', (await marker()) === 'done')

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
check('zero external requests', externalRequests.length === 0, externalRequests.join(', '))
await browser.close()
preview.stop()
await casey.stop()
await fake.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nONBOARDING LESSONS DRIVE OK')
if (fail.length) process.exitCode = 1
