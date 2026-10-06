// The first session, walk first (CW-13, docs/roadmap/cafe-world.md section 7):
// choose a country/language ticket, hear Casey's two lines, walk at once, find
// the first café, meet it on the real Home, play its practice table and its
// own puzzle, then tap Casey on Home to read the suitcase's three marks.
//
// What this drives, on the smallest phone we serve (360×640):
//   - the gate: fresh runs, veterans (rules seen / words in the SRS map) go
//     straight Home and are marked done silently, ?howto=0 suppresses without
//     writing, a mid-flow marker resumes at its act
//   - Skip on the ticket, Casey's lines, the walk's panels, Home's café
//     spotlight and the live practice/suitcase acts
//   - the ticket is a card, never a one-entry <select>, in the
//     `name (endonym)` format Settings' picker uses
//   - the walk two taps after the ticket; Home from it finds and introduces
//     the first café (the café gate is on)
//   - a complete 3×3 practice round at that café, then a normal 3×6 round and
//     the Casey hand-off into the live suitcase tour
//   - a reload mid-round resumes the round with its reveals intact
//   - a manually authored player clue reaches the real companion through
//     fixed fake replies; the tutorial has no hidden suggestion route
//   - after the round, Casey is the one door to the real suitcase
//   - Settings' "Replay the intro" reruns the flow without touching the flag
//   - no document scroll in any act
//
// And the aftercare around it (O4):
//   - the rules overlay NEVER opens itself; ? is its only door, and behind it
//     stands the trimmed reference card — four rules, the clue-giver's-key
//     rule stated exactly once, and a Replay-the-intro door of its own
//   - Casey's bubble opens the first sessions on the critical tips in
//     priority order, and leafing walks onward through them
//   - the two first-time dock lines each appear exactly once on a fresh
//     profile, and the tutorial spends neither flag
import { chromium } from 'playwright'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startWorker } from './worker-runtime.mjs'
import { createOnboardingFlow, firstWalkCafePanel } from './_onboarding-flow.mjs'
import { lessonMarkers, progressBytes, released, walkTour } from './_tutorial-lessons.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const PORT = 4183
const preview = await startPreview(PORT)
const fake = await startFakeOllama(4383 + Number(process.env.DRIVE_PORT_OFFSET ?? 0), {
  auto: true,
})
const casey = await startWorker(4483 + Number(process.env.DRIVE_PORT_OFFSET ?? 0), {
  bundler: 'rolldown',
  upstream: fake.baseUrl,
  apiKey: 'onboarding-worker-key',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fake-model' } }) },
})
if (!casey) throw new Error('Miniflare is required for onboarding-drive')
const LOCAL_CASEY_BASE = `${casey.base}/v1`

const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const BASE = preview.base
const SHOT_DIR = process.env.SHOT_DIR ?? 'test-results'
// The tight case. The whole flow is measured where it would give first.
// ONBOARDING_VP=390x844 runs the same journey at the common phone size.
const VP = process.env.ONBOARDING_VP === '390x844' ? { width: 390, height: 844 } : { width: 360, height: 640 }
const VPN = `${VP.width}x${VP.height}`

const browser = await chromium.launch({ executablePath: EXE })
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
const onboardingFlow = createOnboardingFlow(page)
const ticketToHome = () => onboardingFlow.ticketToHome('Denmark')
const homeToTutorial = () => onboardingFlow.homeToTutorial()
/** The café gate is on (CW-13): a board-about leg starts with the first café found. */
const seedFirstCafe = () => page.evaluate(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// The fresh-player journey is allowed to talk only to this fresh build and
// its two local Casey seams. Record every other request, not just Casey calls,
// so an accidental font, analytics, or production endpoint cannot hide behind
// the companion-specific assertions below.
const localOrigins = new Set([new URL(BASE).origin, new URL(fake.baseUrl).origin, new URL(casey.base).origin])
const externalRequests = []
page.on('request', (request) => {
  if (!localOrigins.has(new URL(request.url()).origin)) externalRequests.push(request.url())
})
/** The browser-side half of the local Casey seam, including CORS preflight. */
const caseyNetwork = []
const isCaseyRequest = (request) => request.url().includes('/casey/decision')
page.on('request', (request) => {
  if (isCaseyRequest(request)) caseyNetwork.push({ at: Date.now(), event: 'start', method: request.method(), url: request.url() })
})
page.on('response', (response) => {
  if (response.url().startsWith(casey.base)) {
    caseyNetwork.push({ at: Date.now(), event: 'response', status: response.status(), url: response.url() })
  }
})
page.on('requestfailed', (request) => {
  if (isCaseyRequest(request)) {
    caseyNetwork.push({ at: Date.now(), event: 'failed', method: request.method(), failure: request.failure()?.errorText ?? '' })
  }
})
// The first full tutorial reaches the learner-authored clue route too. Give
// that fresh profile only the local Casey base before its app modules hydrate;
// do not set an onboarding marker or mock flag, since this leg proves the
// actual first-run gate and the authored Casey half independently.
await page.addInitScript(
  ({ baseUrl }) => {
    if (sessionStorage.getItem('tu2-first-route-casey-seeded')) return
    sessionStorage.setItem('tu2-first-route-casey-seeded', '1')
    localStorage.setItem('cluecab-settings-v1', JSON.stringify({ state: { baseUrl }, version: 13 }))
  },
  { baseUrl: LOCAL_CASEY_BASE },
)

// Phase 1g put a screen BEFORE the ticket: which language do you speak. Every
// check below is about what comes after it, so these profiles arrive having
// answered it — which is what a device is, one tap in. The act itself gets its
// own section at the end, where the flag below stands this down.
await page.addInitScript(() => {
  if (sessionStorage.getItem('cluecab-drive-language-act')) return
  localStorage.setItem('cluecab-ui-language', 'en')
})
// Every turn-takeover card the page shows, in order, by its line. The practice
// round plays its turns like a normal round (owner, 2026-09-26), so its cards
// are checked from this record rather than by racing a 1.8 s animation.
await page.addInitScript(() => {
  window.__takeovers = []
  new MutationObserver(() => {
    const line = document.querySelector('.turn-takeover:not(.turn-takeover-out) .turn-takeover-line')?.textContent?.trim()
    const mode = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.mode ?? null
    const last = window.__takeovers.at(-1)
    if (line && !(last && last.line === line && last.open)) window.__takeovers.push({ line, mode, open: true })
    if (!line && last) last.open = false
  }).observe(document, { subtree: true, childList: true })
})
const takeoversSeen = () => page.evaluate(() => window.__takeovers ?? [])

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const open = async (query = '') => {
  await page.goto(BASE + query, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}
const act = () =>
  page.evaluate(() => document.querySelector('.onboard-screen')?.dataset.act ?? null)
const marker = () => page.evaluate(() => localStorage.getItem('cluecab-onboard-v5'))
const v3Marker = () => page.evaluate(() => localStorage.getItem('cluecab-onboard-v3'))
const oldestMarker = () => page.evaluate(() => localStorage.getItem('cluecab-onboard-v1'))
const atHome = async () => (await page.locator('.home-play').count()) === 1
const inTutorial = async () => (await page.locator('.tutorial-game .board-grid').count()) === 1
const inRealRound = async () =>
  (await page.locator('.board-grid').count()) === 1 &&
  (await page.locator('.word-card').count()) === 18 &&
  (await marker()) === 'real-round'
const storedGame = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game ?? null)
const requestTail = (requests) =>
  requests.slice(-3).map(({ at, raw, url, method, auth }) => ({
    at,
    method,
    auth: auth ? 'present' : '',
    tail: (raw ?? url ?? '').slice(-280),
  }))
const tutorialAiSnapshot = (requestStartedAt = null) =>
  page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {}
    const settings = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state ?? {}
    const panel = document.querySelector('.tutorial-game .ai-panel')
    return {
      phase: state.game?.phase ?? null,
      clue: state.game?.clueHistory?.at(-1)?.text ?? null,
      clueCount: state.game?.clueHistory?.length ?? 0,
      history: state.game?.clueHistory?.map((clue) => ({
        by: clue.by,
        text: clue.text,
        number: clue.number,
        guesses: clue.guesses.map((guess) => `${guess.wordId}:${guess.result}`),
      })) ?? [],
      queue: state.aiGuessQueue?.map((guess) => guess.wordId) ?? [],
      queueFor: state.planForClueIndex ?? null,
      busy: state.aiBusy ?? null,
      error: state.error ?? null,
      visibleError: document.querySelector('.error-banner')?.textContent?.trim() ?? null,
      settingsBaseUrl: settings.baseUrl ?? null,
      panel: panel
        ? { hurry: panel.getAttribute('data-hurry'), beat: panel.getAttribute('data-beat'), text: panel.textContent?.trim() }
        : null,
    }
  }).then((snapshot) => ({
    ...snapshot,
    request: {
      elapsedMs: requestStartedAt === null ? null : Date.now() - requestStartedAt,
      fakeReceived: fake.received.length,
      fakeTail: requestTail(fake.received),
      workerUpstreamCalls: casey.upstreamCalls.length,
      workerUpstreamTail: requestTail(casey.upstreamCalls),
      browserNetworkTail: caseyNetwork.slice(-6),
    },
  }))
const noScroll = async (name) => {
  const r = await page.evaluate(() => ({
    sh: document.scrollingElement.scrollHeight,
    ih: window.innerHeight,
  }))
  check(`no-scroll: ${name}`, r.sh <= r.ih + 1, `${r.sh} vs ${r.ih}`)
}
const skipOnScreen = async (where) => {
  const skip = await page.locator('.onboard-skip').boundingBox()
  check(
    `Skip is visible at the ${where}`,
    skip && skip.y >= 0 && skip.y + skip.height <= VP.height + 0.5,
    skip ? `bottom ${(skip.y + skip.height).toFixed(0)} of ${VP.height}` : 'no skip button',
  )
}
let practiceTokenIntroChecked = false
const recallScreenshots = new Set()

/**
 * The translation lesson on arrival in the translation challenge. `expect` is
 * 'done' / 'skip' / 'escape' (walk it and leave that way) or 'absent' (it must
 * not open, because it was already done or dismissed).
 */
async function checkTranslationLesson(where, expect) {
  const selector = '.tour-overlay[data-tour-kind="translation"]'
  if (expect === 'absent') {
    // Past the Translation time card (1.8 s), where the lesson would open.
    await page.waitForTimeout(2600)
    check(`the ${where} does not repeat a translation lesson already taken`, (await page.locator(selector).count()) === 0)
    return
  }
  // The handoff first: the lesson may not open over an unfinished takeover.
  await page.waitForSelector(selector, { timeout: 8000 })
  check(
    `the ${where} translation lesson opens only after Translation time has gone`,
    (await page.locator('.turn-takeover').count()) === 0,
  )
  check(
    `the ${where} lesson does not stack on the ordinary translation panel`,
    (await page.locator('dialog.round-guidance-dialog[open]').count()) === 0,
  )
  const before = await storedGame()
  const beats = await walkTour(page, 'translation', check, {
    label: `${where} translation lesson`,
    shots: `${SHOT_DIR}/da-${slug(where)}-translation-lesson-${VPN}`,
    finish: expect === 'done' ? 'done' : expect,
    atStep: 1,
  })
  if (expect === 'done') {
    check(
      `the ${where} translation lesson points at lids, answer field, then wheel`,
      beats.map((beat) => beat.anchor).join(' | ') ===
        '.word-card-wrap[data-translation-pending="true"] .card-lid-word | .wheel-answer-row | .wheel-disc',
      beats.map((beat) => beat.anchor).join(' | '),
    )
    check(`the ${where} lesson says no suitcase needs tapping first`, /do not need to tap a suitcase/i.test(beats[0]?.text ?? ''), beats[0]?.text ?? '')
    check(`the ${where} lesson names the Danish answer and the tick`, /Danish/.test(beats[1]?.text ?? '') && /tick/.test(beats[1]?.text ?? ''), beats[1]?.text ?? '')
    check(`the ${where} lesson explains the green wheel`, /green/i.test(beats[2]?.text ?? ''), beats[2]?.text ?? '')
    await page.screenshot({ path: `${SHOT_DIR}/da-${slug(where)}-translation-lesson-${VPN}.png` })
  }
  const after = await storedGame()
  check(`the ${where} lesson changed nothing in the game`, JSON.stringify(before) === JSON.stringify(after))
  const markers = await lessonMarkers(page)
  check(
    `the ${where} lesson is recorded as ${expect === 'done' ? 'done' : 'dismissed'}`,
    markers.translation === (expect === 'done' ? 'done' : 'dismissed'),
    JSON.stringify(markers),
  )
  check(`the ${where} answer field is released after the lesson`, await released(page, '.wheel-input'))
}
const slug = (where) => where.replace(/\s+/g, '-')
let practiceDockChecked = false
let practiceThinkingChecked = false

/** The one-beat lesson on a full wheel, before the player spins it. */
async function checkWheelLesson(where, expect) {
  const selector = '.tour-overlay[data-tour-kind="wheel"]'
  if (expect === 'absent') {
    // Only after the wheel phase's card has left can "no lesson" be judged.
    await page.locator('.turn-takeover').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(600)
    check(`the ${where} does not repeat the full-wheel lesson`, (await page.locator(selector).count()) === 0)
    return
  }
  const before = await storedGame()
  const beats = await walkTour(page, 'wheel', check, {
    label: `${where} full-wheel lesson`,
    finish: expect,
    shots: `${SHOT_DIR}/da-${slug(where)}-wheel-lesson-${VPN}`,
  })
  check(`the ${where} full-wheel lesson points at the live wheel`, beats[0]?.anchor === '.wheel-disc', beats[0]?.anchor ?? 'none')
  check(`the ${where} full-wheel lesson says this spin wins`, /this spin wins/.test(beats[0]?.text ?? ''), beats[0]?.text ?? '')
  const completed = expect === 'done' || expect === 'tap'
  check(`the ${where} full-wheel lesson is recorded`, (await lessonMarkers(page)).wheel === (completed ? 'done' : 'dismissed'), JSON.stringify(await lessonMarkers(page)))
  if (expect === 'tap') {
    // "Tap the wheel to spin": the tap on the lit wheel IS the spin (owner,
    // 2026-09-26), with no Next to press first.
    await page.waitForFunction(() => {
      const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
      return game?.wheel?.landed !== null && game?.wheel?.landed !== undefined
    }, null, { timeout: 5000 }).catch(() => {})
    const after = await storedGame()
    check(`the ${where} full-wheel lesson spins the wheel from a tap on the wheel itself`, after?.wheel?.landed !== null && after?.wheel?.landed !== undefined, JSON.stringify(after?.wheel ?? null))
    return true
  }
  const after = await storedGame()
  check(`the ${where} full-wheel lesson never spins for the player`, after?.phase === 'translateWheel' && JSON.stringify(before) === JSON.stringify(after), after?.phase ?? 'none')
  check(`the ${where} wheel is free to spin after the lesson`, await released(page, '.wheel-disc'))
  return false
}

/**
 * Play the practice round through the ordinary phase controls. The route is a
 * PLAYER choice, not an instruction from the UI: Casey never names a target.
 * Each player tap checks the reaction band against the reducer's own record.
 */
async function playPractice({ stopBeforePlayerClue = false, stopAfterPlayerClue = false, cap = 100, normal = false, translationLesson = null, wheelLesson = null } = {}) {
  let translationLessonChecked = translationLesson === null
  let wheelLessonChecked = wheelLesson === null
  const choices = {
    drikke: ['da:vand', 'da:kaffe', 'da:mælk'],
    hjem: ['da:hus'],
  }
  let playerTurn = 0
  let stalledAiGuesses = 0
  let playerRequestStartedAt = null
  let checkedOrdinaryHearBoard = false
  for (let i = 0; i < cap; i++) {
    await page.waitForTimeout(100)
    const game = await storedGame()
    if (!game) return 'no-game'
    if (game.phase === 'finished') return 'finished'

    if (game.phase !== 'aiGuessing') stalledAiGuesses = 0

    if (game.phase === 'playerGuessing') {
      if (normal && !checkedOrdinaryHearBoard) {
        checkedOrdinaryHearBoard = true
        const hearBoard = page.locator('.game-header .hear-board')
        check(
          'hear the board stays out of ordinary gameplay (owner, 2026-09-26)',
          (await hearBoard.count()) === 0,
        )
        await page.screenshot({ path: `${SHOT_DIR}/da-ordinary-answer-audio-${VPN}.png`, fullPage: true })
      }
      const clue = game.clueHistory.at(-1)
      const route = normal
        ? (clue.targets ?? game.words.filter((word) => game.aiKey[word.wordId] === 'green').map((word) => word.wordId)).slice()
        : choices[clue.text] ?? game.words.filter((word) => game.aiKey[word.wordId] === 'green').map((word) => word.wordId)
      const already = new Set(clue.guesses.map((guess) => guess.wordId))
      const wordId = route.find((id) => {
        if (already.has(id)) return false
        const reveal = game.reveals[id]
        return reveal.kind === 'hidden' ||
          (reveal.kind === 'bystander' && !reveal.against.includes('ai'))
      })
      if (!wordId) return `no-free-choice:${clue.text}`
      const word = game.words.find((entry) => entry.wordId === wordId).da
      await page.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
      await page.waitForFunction(
        ({ clueCount, guessCount }) => {
          const state = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
          const clue = state?.clueHistory?.[clueCount - 1]
          return state?.clueHistory?.length >= clueCount && clue?.guesses?.length > guessCount
        },
        { clueCount: game.clueHistory.length, guessCount: clue.guesses.length },
      )
      const after = await storedGame()
      const landed = after.clueHistory[game.clueHistory.length - 1].guesses.at(-1)
      check(`the ordinary board records tap ${word}`, landed.wordId === wordId)
    } else if (game.phase === 'playerClueInput') {
      if (stopBeforePlayerClue) return 'player-clue'
      if (playerTurn === 0) {
        const storedBaseUrl = await page.evaluate(
          () => JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state?.baseUrl ?? null,
        )
        check('the first manual tutorial clue uses its local Casey Worker', storedBaseUrl === LOCAL_CASEY_BASE, storedBaseUrl ?? '')
      }
      // The guess prompt intentionally contains no player key. This explicit,
      // fixed script makes the authored browser route repeatable without
      // pretending a suggestion chip or hidden key reached Casey.
      // The practice board's player-only greens are the three food words. The
      // companion receives deterministic responses from fake-ollama so this
      // route proves the real clue submission seam without exposing the key
      // in the UI.
      const ids = normal
        ? game.words
            .filter((word) => game.playerKey[word.wordId] === 'green' && game.reveals[word.wordId].kind === 'hidden')
            .map((word) => word.wordId)
            .slice(0, 3)
        : [['da:mad', 'da:æble', 'da:ost']][playerTurn++] ?? []
      if (ids.length === 0) return `no-player-targets:${JSON.stringify(game)}`
      // Top-two assistance asks afresh for each actual continued guess. A
      // single multi-row response supplies alternatives for only the first
      // guess; later requests would exhaust the script and use auto-reply.
      fake.queue(...ids.map((wordId) => ({
        json: { guesses: [{ wordId, confidence: 0.9, reasoning: 'fixed tutorial fake' }] },
      })))
      await page.locator('.clue-input input[aria-label^="Your one-word clue"]').fill('spise')
      const clueNumber = Math.min(ids.length, 3)
      for (let n = 0; n < 3; n++) {
        const current = Number(await page.locator('.stepper-value').innerText())
        if (current >= clueNumber) break
        await page.locator('[aria-label="more words"]').click()
      }
      playerRequestStartedAt = Date.now()
      await page.locator('.clue-input .btn-primary').click()
      if (stopAfterPlayerClue) {
        await page.waitForSelector('.ai-panel[data-hurry="1"]', { timeout: 20000 })
        return 'player-clue'
      }
    } else if (game.phase === 'aiGuessing') {
      if (!normal && game.clueHistory.length === 2 && !practiceTokenIntroChecked) {
        practiceTokenIntroChecked = true
        await page.waitForFunction(() =>
          document.querySelector('.tutorial-casey-bubble')?.textContent?.includes('shared round tokens'),
        )
        const tokenLabel = await page.locator('.tutorial-game .turn-tokens').getAttribute('aria-label') ?? ''
        check('the first player clue points out the shared round-token row', /shared round tokens/.test(await page.locator('.tutorial-casey-bubble').innerText()))
        check('the generous practice row shows the second of seven clues', /2 of 7 clues given/.test(tokenLabel), tokenLabel)
      }
      const panel = page.locator('.ai-panel')
      if (!normal && !practiceDockChecked && (await panel.locator('.ai-say').count()) === 1) {
        practiceDockChecked = true
        const dock = await panel.evaluate((el) => ({
          face: !!el.querySelector('.ai-say .cluey-svg'),
          bubble: el.querySelector('.ai-bubble')?.textContent?.trim() ?? '',
          statusOnly: el.classList.contains('tutorial-turn-panel') || !!el.querySelector('.tutorial-turn-status'),
        }))
        check('Casey guesses in the practice round with her face and a speech bubble, like a normal round', dock.face && dock.bubble.length > 0 && !dock.statusOnly, JSON.stringify(dock))
        await noScroll('practice Casey guessing dock at 360×640')
        await page.screenshot({ path: `${SHOT_DIR}/da-practice-casey-guessing-${VPN}.png` })
      }
      if ((await panel.getAttribute('data-hurry')) === '1') {
        stalledAiGuesses = 0
        await panel.click()
      } else if (++stalledAiGuesses >= 30) {
        // A fake response should install a plan almost immediately. Do not
        // turn a rejected/stranded response into a hundred reassuring "one
        // Casey" checks: preserve the exact persisted queue and panel state.
        return `stalled-ai-guessing:${JSON.stringify(await tutorialAiSnapshot(playerRequestStartedAt))}`
      }
    } else if (game.phase === 'translateChallenge') {
      if (!normal) {
        check(
          'answer audio is absent during the translation challenge',
          (await page.locator('.game-header .hear-board').count()) === 0,
        )
        if (!recallScreenshots.has('challenge')) {
          recallScreenshots.add('challenge')
          await noScroll('Danish translation challenge at 360×640')
          await page.screenshot({ path: `${SHOT_DIR}/da-translation-challenge-${VPN}.png`, fullPage: true })
        }
      }
      if (!normal) {
        await page.waitForFunction(() => {
          const line = document.querySelector('.tutorial-casey-bubble')?.textContent ?? ''
          return line.includes('back in Danish') && !line.includes('Platinum')
        })
        const line = await page.locator('.tutorial-casey-bubble').innerText()
        check('the solved practice board says the words go back into Danish, without a tier lesson', /back in Danish/.test(line) && !/Platinum|normal boards/i.test(line), line)
      }
      if (!translationLessonChecked) {
        translationLessonChecked = true
        await checkTranslationLesson(normal ? 'full board' : 'practice', translationLesson)
      }
      const next = game.wheel.segments.find((id) => game.reveals[id]?.kind === 'green' && !game.wheel.translated.includes(id))
      if (!next) return `missing-translation-target:${JSON.stringify(game.wheel)}`
      const answer = game.words.find((word) => word.wordId === next).da
      await page.locator('.wheel-input').fill(answer)
      await page.locator('.wheel-confirm').click()
    } else if (game.phase === 'translateWheel') {
      if (!normal) {
        check(
          'answer audio is absent while the translation wheel is active',
          (await page.locator('.game-header .hear-board').count()) === 0,
        )
        if (!recallScreenshots.has('wheel')) {
          recallScreenshots.add('wheel')
          await noScroll('Danish translation wheel at 360×640')
          await page.screenshot({ path: `${SHOT_DIR}/da-translation-wheel-${VPN}.png`, fullPage: true })
        }
      }
      if (!normal) check('the completed practice translations visibly fill the wheel', (await page.locator('.wheel-disc').count()) === 1)
      let spun = false
      if (!wheelLessonChecked) {
        wheelLessonChecked = true
        spun = (await checkWheelLesson(normal ? 'full board' : 'practice', wheelLesson)) === true
      }
      if (!spun) await page.locator('.wheel-disc').click()
      await page.waitForTimeout(3200)
      // The board stays after the spin until See results (owner, 2026-09-27).
      await page.locator('.wheel-results:not([disabled])').click({ timeout: 15_000 })
    } else if (game.phase === 'aiClueInput') {
      // Casey's next clue in practice: like a normal round, she is seen
      // thinking (face and dots) once her turn card has left.
      if (!normal && !practiceThinkingChecked && (await page.locator('.turn-takeover').count()) === 0 && (await page.locator('.ai-panel .ai-bubble.thinking').count()) === 1) {
        practiceThinkingChecked = true
        check('after her turn card leaves, Casey is seen thinking in the practice round, with her face and the dots', (await page.locator('.ai-panel .ai-say .cluey-svg').count()) === 1 && (await page.locator('.ai-panel .dots').count()) === 1)
        await noScroll('practice Casey thinking dock at 360×640')
        await page.screenshot({ path: `${SHOT_DIR}/da-practice-casey-thinking-${VPN}.png` })
      }
    } else {
      return `unexpected-phase:${game.phase}`
    }
  }
  return `cap:${JSON.stringify(await tutorialAiSnapshot(playerRequestStartedAt))}`
}

// ---- a genuinely fresh device opens on the ticket --------------------------
await open()
check('a fresh device opens on the language ticket', (await act()) === 'ticket')
const tickets = await page.locator('.onboard-ticket').count()
check('two shipped courses have two ticket cards', tickets === 2, `${tickets} cards`)
check('the picker uses ticket cards, never a select', (await page.locator('.onboard-screen select').count()) === 0)
const ticketTexts = (await page.locator('.onboard-ticket').allInnerTexts()).map((text) => text.replace(/\s+/g, ' '))
const danishTicketText = ticketTexts.find((text) => /Denmark/.test(text)) ?? ''
const germanTicketText = ticketTexts.find((text) => /Germany/.test(text)) ?? ''
check('the Danish ticket names Danish (Dansk)', /Danish \(Dansk\)/.test(danishTicketText), danishTicketText)
check('the Danish ticket says where and how much', /Denmark/.test(danishTicketText) && /900 words/.test(danishTicketText), danishTicketText)
check('the German ticket names Germany and German (Deutsch)', /Germany/.test(germanTicketText) && /German \(Deutsch\)/.test(germanTicketText), germanTicketText)
// The ticket writes no marker: a fresh device is decided 'fresh' on every
// load and opens here anyway (uiStore's initial onboarding state persists
// only from the first advance). The old check wanted 'ticket' written at
// once; nothing has written it since the intro rework, and a reload lands on
// the ticket either way — which is what this now says.
const ticketMarker = await marker()
check('the ticket needs no marker to survive a reload', ticketMarker === null || ticketMarker === 'ticket', `marker ${ticketMarker}`)
await skipOnScreen('ticket')
await noScroll('the ticket act')
const ticketHeadingGeometry = await page.evaluate(() => {
  const heading = document.querySelector('[data-act="ticket"] h1')?.getBoundingClientRect()
  const banner = document.querySelector('.update-banner')?.getBoundingClientRect()
  return { heading: heading ? { top: heading.top, bottom: heading.bottom } : null, banner: banner ? { top: banner.top, bottom: banner.bottom } : null, viewport: window.innerHeight }
})
check(
  'offline-ready banner cannot overlap or clip the onboarding H1 at 360×640',
  !!ticketHeadingGeometry.heading && ticketHeadingGeometry.heading.top >= 0 && ticketHeadingGeometry.heading.bottom <= ticketHeadingGeometry.viewport && ticketHeadingGeometry.banner === null,
  JSON.stringify(ticketHeadingGeometry),
)
await page.screenshot({ path: `${SHOT_DIR}/onboarding-en-${VPN}-ticket.png`, fullPage: true })

// ---- Casey's two lines, the first walk, Home's café (CW-13) -----------------
await ticketToHome()
check('the ticket lands on Casey’s lines before the walk', (await act()) === 'intro')
check('and writes the intro marker', (await marker()) === 'intro')
const introGames = (await page.locator('.onboard-intro-bubble').innerText()).replace(/\s+/g, ' ').trim()
check(
  'Casey opens with the 900-words coverage line',
  /^Did you know that 900 words can cover over 80% of daily speech in most languages\?/.test(introGames),
  introGames,
)
check(
  'then says flashcards are boring, so there are two games',
  /Flashcards are boring/.test(introGames) && /sightseeing to collect words/.test(introGames) && /word puzzle in a café/.test(introGames),
  introGames,
)
check('the 900-words line no longer asks for a tap on the bubble', !/Tap to continue/.test(introGames))
await skipOnScreen('Casey’s lines')
await noScroll('Casey before the walk')
await page.locator('.onboard-intro-next').click()
const introExplore = (await page.locator('.onboard-intro-bubble').innerText()).trim()
check('"Let’s explore Sønderborg and see if we can find a café."', introExplore === 'Let’s explore Sønderborg and see if we can find a café.', introExplore)
await noScroll('Let’s explore')
await page.locator('.onboard-intro-go').click()
await page.waitForSelector('.run-screen .run-pause')
check('"Let’s go" starts the first walk at once, two taps after the ticket', (await marker()) === 'walk' && (await page.locator('.run-scrim').count()) === 0)
check('the train is not introduced on the first walk', (await page.locator('.run-screen').getAttribute('aria-label')) === 'Sightseeing')
// Paused before its first answer, the walk costs no daily run (O6). The café
// on the walk itself is the CW-13 probe's (it steers with ?auto).
await page.locator('.run-pause').click()
await page.waitForSelector('.run-panel .run-home')
check('the paused first walk offers Skip', (await page.locator('.run-panel .onboard-skip').count()) === 1)
await page.locator('.run-panel .run-home').click()
await page.waitForSelector('.tour-overlay[data-tour-kind="home"]')
check('Home from the first walk is onboarding’s café act', (await marker()) === 'home-cafe')
check(
  'a walk that found nothing still lands on a playable first café',
  (await page.locator('.home-first-session .home-play').getAttribute('data-cafe-action')) === 'next',
)
check('the first-session Home keeps Settings and the map out of the flow',
  (await page.locator('.home-first-session .icon-btn[aria-label="Settings"]').count()) === 0 &&
    (await page.locator('.home-first-session button.map-button').count()) === 0)
const homeCafeBeats = await walkTour(page, 'home', check, { label: 'Home café lesson', finish: 'tap', shots: `${SHOT_DIR}/da-home-cafe-lesson-${VPN}` })
check(
  'Home introduces Sightseeing, then the café found',
  homeCafeBeats.map((beat) => beat.anchor).join(' | ') === '.home-tag-sightseeing | .home-play',
  homeCafeBeats.map((beat) => beat.anchor).join(' | '),
)
check('the café beat names the café', /^Our first café is Café /.test(homeCafeBeats[1]?.text ?? ''), homeCafeBeats[1]?.text ?? '')

// ---- the complete small neutral practice round -----------------------------
await page.waitForSelector('.tutorial-game .board-grid')
check('the practice board is a compact 3×3', (await page.locator('.tutorial-game .word-card').count()) === 9)
check('and writes the tutorial marker', (await marker()) === 'tutorial')
await page.waitForSelector('.tutorial-casey-bubble')
check('Casey gives the first clue on the neutral board', /drikke/.test(await page.locator('.tutorial-casey-bubble').innerText()))
check('the first board hides the player key', (await page.locator('.tutorial-game .mykey-green').count()) === 0)
check('and keeps the existing information controls available', (await page.locator('.tutorial-game .card-info').count()) === 9)
const openingTokenLabel = await page.locator('.tutorial-game .turn-tokens').getAttribute('aria-label') ?? ''
check('all seven generous round tokens are visible from the start', /1 of 7 clues given, 7 left/.test(openingTokenLabel), openingTokenLabel)
const infoControlsOnCards = await page.locator('.tutorial-game .word-card-surface').evaluateAll((surfaces) =>
  surfaces.every((surface) => {
    const card = surface.querySelector('.word-card')?.getBoundingClientRect()
    const info = surface.querySelector('.card-info')?.getBoundingClientRect()
    return card && info && info.top >= card.top - 0.5 && info.right <= card.right + 0.5
  }),
)
check('each information control sits on its visible card', infoControlsOnCards)
// "Tap the ⓘ on a word" since CW-13; "You can tap the ⓘ on words" before.
check('the opening Casey line points out the ⓘ lookup', /[Tt]ap the ⓘ/.test(await page.locator('.tutorial-casey-bubble').innerText()), (await page.locator('.tutorial-casey-bubble').innerText()).slice(0, 120))
check('and welcomes the player to the café', /Welcome to the café/.test(await page.locator('.tutorial-casey-bubble').innerText()))
check('the practice table wears the café found: its name tag and cups', (await page.locator('.tutorial-game .cafe-name-tag').count()) === 1 && (await page.locator('.tutorial-game .token-cup').count()) > 0)
await page.waitForSelector('.tutorial-game .guess-bar')
await noScroll('practice board before the first guess')

// Let Casey’s opening clue play through. The key stays private until that
// turn ends; then the player’s greens appear for the clue-giving half.
const firstTurn = await playPractice({ stopBeforePlayerClue: true })
check('the first Casey turn ends before the player clues', firstTurn === 'player-clue', firstTurn)
check('the player key appears only after Casey’s turn', (await page.locator('.tutorial-game .mykey-green').count()) >= 3)
const firstTurnTokenLabel = await page.locator('.tutorial-game .turn-tokens').getAttribute('aria-label') ?? ''
check('the token row records Casey’s opening clue', /1 of 7 clues given, 6 left/.test(firstTurnTokenLabel), firstTurnTokenLabel)
// The tour opens on this same beat and holds the band, so the handoff line
// may be in the band OR already on the tour panel — one voice, one place.
await page.waitForFunction(() => {
  const band = document.querySelector('.tutorial-casey-bubble')?.textContent ?? ''
  const tour = document.querySelector('.tour-overlay[data-tour-kind="tutorial"] .tutorial-bubble')?.textContent ?? ''
  return band.includes('Now it’s your turn') || tour.includes('whoever gave the clue')
})
// The band holds its line while the tour is up (one voice), so the handoff
// line is only IN the band once the tour has been dismissed: asserted after
// the walk below, where 'the band resumes after it' checks it.
const handoffFits = await page.locator('.tutorial-casey-bubble').evaluate(
  (bubble) => bubble.scrollHeight <= bubble.clientHeight + 1,
)
check('the player-turn handoff fits Casey’s larger band', handoffFits)
await noScroll('practice player-key reveal')

// ---- the intro game's four-beat guided tour (2026-09-18) --------------------
// It opens on THIS first clue turn — the one moment the green frames are on
// the board — and walks key → clue field → dictionary → stepper, each step
// one tap. The band holds its line while a step has the floor (one voice),
// and Skip ends only the tour: the practice continues with the band.
const tourOverlay = page.locator('.tour-overlay[data-tour-kind="tutorial"]')
await page.waitForSelector('.tour-overlay[data-tour-kind="tutorial"]')
check('the practice player turn opens with the normal "Give Casey a clue" card', (await takeoversSeen()).some((card) => card.mode === 'tutorial' && card.line === 'Give Casey a clue'), JSON.stringify(await takeoversSeen()))
check('the first-clue tour opens only after that card has gone', (await page.locator('.turn-takeover').count()) === 0)
check('the intro-game tour opens on the first player clue turn', (await tourOverlay.count()) === 1)
const tourAnchors = ['.tutorial-game .mykey-green', '#clue-word', '.translate-input', '.stepper']
const spokenByBeat = []
for (let step = 0; step < 4; step++) {
  const state = await page.evaluate(() => {
    const overlay = document.querySelector('.tour-overlay[data-tour-kind="tutorial"]')
    const spot = document.querySelector('.tour-spot')
    return {
      step: overlay?.getAttribute('data-tour-step') ?? null,
      anchor: overlay?.getAttribute('data-tour-anchor') ?? null,
      spoken: overlay?.querySelector('.tour-panel .tutorial-bubble')?.textContent?.trim() ?? null,
      band: document.querySelector('.tutorial-casey-bubble')?.textContent?.trim() ?? null,
      spotVisible: !!spot && spot.getBoundingClientRect().width > 0,
      clueInputUp: !!document.querySelector('.tutorial-game .clue-input'),
    }
  })
  spokenByBeat.push(state.spoken ?? '')
  check(`tour beat ${step + 1} is anchored at ${tourAnchors[step]}`, state.anchor === tourAnchors[step], state.anchor ?? 'none')
  check(`tour beat ${step + 1} has a spotlight and Casey's line`, state.spotVisible && !!state.spoken, (state.spoken ?? '').slice(0, 60))
  check(`tour beat ${step + 1} silences the band, not the composer`, state.band === '' && state.clueInputUp, `band="${state.band}"`)
  check(`no-scroll: tour beat ${step + 1}`, await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1))
  if (step < 3) await page.locator('.tour-panel .onboard-next').click()
}
check(
  'the key step says who judges a guess',
  /whoever gave the clue/.test(spokenByBeat[0] ?? ''),
  (spokenByBeat[0] ?? '').slice(0, 80),
)
// The composer's own anchors really sit under the spotlight at beats 2–4.
for (const selector of ['#clue-word', '.translate-input', '.stepper']) {
  check(`the tour's ${selector} anchor resolves on the live composer`, (await page.locator(`.tutorial-game ${selector}`).count()) === 1)
}
await tourOverlay.locator('.onboard-skip').click()
await page.waitForTimeout(250)
check('Skip closes the whole tour', (await tourOverlay.count()) === 0)
await page.waitForFunction(() => (document.querySelector('.tutorial-casey-bubble')?.textContent ?? '').length > 0)
const resumedBand = await page.locator('.tutorial-casey-bubble').innerText()
check('and the band resumes after it', resumedBand.trim().length > 0, resumedBand)
check('the tour wrote no storage of its own', await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5') === 'tutorial'))
await noScroll('practice after the tour closed')

const practiceBeforeReload = await storedGame()
await open()
const practiceAfterReload = await storedGame()
check(
  'a reload preserves the 3×3 player-clue stage and its reveal state',
  await inTutorial() && (await page.locator('.tutorial-game .clue-input').count()) === 1 &&
    (await page.locator('.tutorial-game .word-card').count()) === 9 &&
    practiceAfterReload?.phase === 'playerClueInput' &&
    JSON.stringify(practiceAfterReload?.reveals) === JSON.stringify(practiceBeforeReload?.reveals),
)
// Reload-safety of the tour: the player had already SEEN the tour this round —
// but the tour's position is derived from the game state, and after the skip
// GameScreen's own flag is fresh again, so the same first clue turn re-opens
// the tour at step 1. One step replayed at worst is the contract; it must not
// reopen mid-deck or refuse the player their composer.
const reloadedTour = page.locator('.tour-overlay[data-tour-kind="tutorial"]')
await page.waitForSelector('.tour-overlay[data-tour-kind="tutorial"]')
check('a reload mid-tour replays the tour from its derived start', (await reloadedTour.getAttribute('data-tour-step')) === '0', await reloadedTour.getAttribute('data-tour-anchor') ?? 'none')
await reloadedTour.locator('.onboard-skip').click()
await page.waitForTimeout(250)
check('and skipping again leaves the composer free', (await reloadedTour.count()) === 0 && (await page.locator('.tutorial-game .clue-input').count()) === 1)
await noScroll('reloaded practice player-clue stage')

const practiceRequestStart = fake.received.length
const endLeg = await playPractice({ translationLesson: 'done', wheelLesson: 'tap' })
check('the complete practice round finishes through the live companion seam', endLeg === 'finished', endLeg)
check('the practice round\'s Casey dock was really inspected while she guessed', practiceDockChecked)
check('and while she thought about her next clue', practiceThinkingChecked)
{
  const practiceCards = (await takeoversSeen()).filter((card) => card.mode === 'tutorial').map((card) => card.line)
  check(
    // The record restarts with the reload above; the player's card was checked
    // before it, where the first-clue tour waits for that card.
    'after the reload, the practice round shows Casey\'s turn card and Translation time',
    practiceCards.includes('Casey prepares a clue') && practiceCards.includes('Translation time'),
    practiceCards.join(' | '),
  )
}
// Pin the continued-reply contract before waiting for the finish UI: an
// exhausted script can still produce legal guesses via auto-reply, including
// greens, so request count alone would not catch the stale one-response turn.
const practiceRequests = fake.received.slice(practiceRequestStart)
check('the practice clue makes three fresh provider requests', practiceRequests.length === 3, `${practiceRequests.length} calls`)
for (const [index, request] of practiceRequests.entries()) {
  const prompt = request.messages.map((message) => message.content ?? '').join('\n')
  check(
    `practice request ${index + 1} carries the advancing public clue history`,
    prompt.includes('Your partner\'s clue: "spise" (3)') &&
      prompt.includes(`public history shows ${index} guess(es) already made for it and ${3 - index} remaining in its allowance`),
  )
}
const practicePlayerClue = (await storedGame())?.clueHistory.find((clue) => clue.by === 'player')
check(
  'all three practice guesses use their scripted replies in order',
  practicePlayerClue?.guesses.length === 3 &&
    ['da:mad', 'da:æble', 'da:ost'].every((wordId, index) => {
      const guess = practicePlayerClue.guesses[index]
      return guess.wordId === wordId && guess.result === 'green' &&
        guess.confidence === 0.9 && guess.reasoning === 'fixed tutorial fake'
    }),
  JSON.stringify(practicePlayerClue?.guesses),
)
await page.waitForSelector('.tutorial-finish')
check('Casey’s practice finish reports the real practice outcome', /Every green found|got away from us/.test(await page.locator('.tutorial-finish-bubble').innerText()))
check('the practice finish teaches no postcards', !/postcard/i.test(await page.locator('.tutorial-finish').innerText()) && (await page.locator('.tutorial-award-result').count()) === 0)
check('the practice finish offers the café puzzle', /Play the café puzzle/i.test(await page.locator('.tutorial-full-round').innerText()))
await noScroll('practice finish speech and full-round button')
// The practice round uses the real docks, but its own reaction band and chips
// teach those moments. The once-ever hints stay for the first ordinary round —
// which is the round that follows, so this is measured BEFORE it. (It sat
// after the real round from #123 until 2026-09-07, where the round it was
// saving the hints for had already spent them; and the Back tap that followed
// it was a second Back on a Home the tour hand-off had already reached.)
const hintFlags = await page.evaluate(() => ({
  clue: localStorage.getItem('cluecab-hint-clue'),
  guess: localStorage.getItem('cluecab-hint-guess'),
}))
check('the tutorial spends neither first-time hint flag', hintFlags.clue === null && hintFlags.guess === null, JSON.stringify(hintFlags))
await page.locator('.tutorial-full-round').click()

// ---- the first real round: normal 3×6 board and summary hand-off -----------
await page.waitForSelector('.board-grid')
check('Casey opens a normal 3×6 round after practice', (await page.locator('.word-card').count()) === 18)
check('the flow marker is now the real-round stage', (await marker()) === 'real-round')
{
  // Like every normal board, the first one opens with Casey's clue, not the
  // player's (owner, 2026-09-26), whatever the authored board declares.
  const opening = await storedGame()
  const first = opening?.clueHistory?.[0]?.by ?? (opening?.phase === 'aiClueInput' ? 'ai' : opening?.phase)
  check('the first full board opens with Casey giving the clue', first === 'ai', first ?? 'none')
}
await noScroll('normal real-round board')

// The round itself is model-backed. Its fake provider answers from the live
// prompt; the browser route chooses only from the persisted public game state
// so this remains a genuine round rather than a shortcut to its ending.
const realLeg = await playPractice({ normal: true, cap: 220, translationLesson: 'absent', wheelLesson: 'absent' })
check('the normal round completes through Casey', realLeg === 'finished', realLeg)
await page.waitForSelector('.round-summary')
check('the real round reaches its summary', (await page.locator('.round-summary').count()) === 1)
// ---- the first full board's result lesson, read from its saved receipt -----
// It opens only over the settled receipt (the summary is not mounted before
// settlement or while the wheel is still landing), inside the result dialog.
// The café world (CW-09) took the postcard total off this screen: the result
// lines are ticks and the café's stamp stands where the total was, with the
// city's percentage beside it. The lesson (CW-13) walks the ticks (when there
// are any), the stamp, the percentage, then the review.
await page.waitForSelector('.receipt-stamp')
const resultBytesBefore = await progressBytes(page)
const receiptShown = await page.evaluate(() => ({
  ticks: document.querySelectorAll('.receipt-tick').length,
  hasStamp: !!document.querySelector('.receipt-stamp'),
  hasPercent: !!document.querySelector('.receipt-city-percent'),
  loss: !!document.querySelector('.outcome-lost'),
  hasReview: !!document.querySelector('.city1-review-sentence'),
  translationOpen: document.querySelector('#review-translation-toggle')?.getAttribute('aria-expanded') ?? null,
}))
const resultBeats = await walkTour(page, 'result', check, { label: 'first full board result lesson', shots: `${SHOT_DIR}/da-first-board-result-lesson-${VPN}` })
const resultAnchors = resultBeats.map((beat) => beat.anchor)
check('the result lesson starts on the ticked result lines, or on the stamp when nothing is ticked',
  resultAnchors[0] === (receiptShown.ticks > 0 ? '.receipt-reward-list' : '.receipt-stamp'), resultAnchors.join(' | '))
check('the result lesson never speaks of postcards on this screen', !/postcard/i.test(resultBeats.map((beat) => beat.text).join(' ')),
  resultBeats.map((beat) => beat.text).join(' | '))
check('the result lesson explains the tier at the stamp line', resultAnchors.includes('.receipt-stamp') === receiptShown.hasStamp)
check('and the city’s percentage beside it', resultAnchors.includes('.receipt-city-percent') === receiptShown.hasPercent, resultAnchors.join(' | '))
check('the stamp beat speaks of the café’s stamp', /stamp/.test(resultBeats.find((beat) => beat.anchor === '.receipt-stamp')?.text ?? ''))
check(
  'a won board is not described as a loss, nor a loss as a win',
  receiptShown.loss ? /lost/.test(resultBeats.find((beat) => beat.anchor === '.receipt-stamp')?.text ?? '')
    : !/lost/.test(resultBeats.map((beat) => beat.text).join(' ')),
)
check(
  'the result lesson introduces the review once, or says there is none, and stops there',
  resultAnchors.at(-1) === (receiptShown.hasReview ? '.city1-review-sentence' : '.city1-review-empty') &&
    !['.city1-review-audio', '#review-translation-toggle', '#review-about-toggle', '.city1-review-next', '.city1-review-home']
      .some((anchor) => resultAnchors.includes(anchor)),
  resultAnchors.join(' | '),
)
check('the result lesson never opens the translation for the player', await page.evaluate(
  (was) => (document.querySelector('#review-translation-toggle')?.getAttribute('aria-expanded') ?? null) === was,
  receiptShown.translationOpen,
))
check('the result lesson awards nothing and changes no progress', JSON.stringify(await progressBytes(page)) === JSON.stringify(resultBytesBefore))
check('the result lesson is recorded as done', (await lessonMarkers(page)).result === 'done')
check('Home in the result dialog is usable again after the lesson', await released(page, '.city1-review-home'))
await page.screenshot({ path: `${SHOT_DIR}/da-first-board-result-after-lesson-${VPN}.png` })
// The lesson points at Listen; after it, Listen must still play the SHIPPED
// sentence recording. Observed through the player's own start event, then the
// same bytes are fetched and decoded in the page. Decoding and starting prove
// the asset and the path; nobody listened, so this is not a hearing test.
if (receiptShown.hasReview) {
  await page.evaluate(() => {
    window.__reviewAudio = []
    window.addEventListener('cluecab-audio', (event) => window.__reviewAudio.push(String(event.detail?.url ?? '')))
  })
  await page.locator('.city1-review-listen').click()
  await page.waitForFunction(() => window.__reviewAudio.length > 0, null, { timeout: 5000 }).catch(() => {})
  const reviewClip = await page.evaluate(async () => {
    const url = window.__reviewAudio[0]
    if (!url) return { url: null }
    const res = await fetch(url)
    const type = res.headers.get('content-type') ?? ''
    const bytes = await res.arrayBuffer()
    // Read before decoding: decodeAudioData detaches the buffer.
    const size = bytes.byteLength
    let seconds = 0
    try { seconds = (await new AudioContext().decodeAudioData(bytes)).duration } catch { seconds = -1 }
    return { url, type, size, seconds }
  })
  check(
    'after the lesson, Listen starts the shipped review recording, which decodes as audio',
    !!reviewClip.url && /audio\//.test(reviewClip.type) && reviewClip.size > 1000 && reviewClip.seconds > 0.3,
    JSON.stringify(reviewClip),
  )
}
await page.locator('.city1-review-home').click()
await page.waitForSelector('.onboard-home-act .home-first-session')
check('the summary hands back to Home behind Casey', await atHome() && (await marker()) === 'home-return')
// ---- Home: the city's stamp, then Casey's collection (CW-13) ----------------
check('the returning Home shows the city’s stamp, not a postcard total',
  (await page.locator('.home-first-session .home-city-stamp').count()) === 1 && (await page.locator('.home-postcard-total').count()) === 0)
const homeBeats = await walkTour(page, 'home', check, { label: 'Home stamp lesson', shots: `${SHOT_DIR}/da-home-stamp-lesson-${VPN}` })
check(
  'Home highlights the city’s stamp before Casey',
  homeBeats.map((beat) => beat.anchor).join(' | ') === '.home-city-stamp | .cluey-button',
  homeBeats.map((beat) => beat.anchor).join(' | '),
)
check('the Home lesson never speaks of postcards', !/postcard/i.test(homeBeats.map((beat) => beat.text).join(' ')))
check('the Home lesson says "city stamp", never medal', /city stamp/i.test(homeBeats[0]?.text ?? '') && !/medal/i.test(homeBeats.map((beat) => beat.text).join(' ')), homeBeats[0]?.text ?? '')
// Casey's beat (owner, 2026-10-04): tapping her is the only way on. No Next,
// the light on her is the named, focused button, a tap elsewhere does nothing
// (walkTour checks all three), and her tap opens the suitcase.
check('Casey\'s beat has no Next and is passed only by tapping Casey', homeBeats[1]?.tapOnly === true && /tap me/i.test(homeBeats[1]?.text ?? ''), homeBeats[1]?.text ?? '')
await page.waitForSelector('.suitcase-screen')
check('the Home lesson is recorded as done', (await lessonMarkers(page)).home === 'done')
check('tapping Casey opens the real suitcase tour', (await page.locator('.suitcase-screen').count()) === 1 && (await page.locator('.tour-overlay[data-tour-kind="suitcase"]').count()) === 1)
const suitcaseBeats = await walkTour(page, 'suitcase', check, { label: 'Casey collection tour after the first board', shots: `${SHOT_DIR}/da-suitcase-marks-lesson-${VPN}` })
check('the collection tour teaches the three marks, the case and the stamp card', suitcaseBeats.map((beat) => beat.anchor).join(' | ') === '.case-loose | .case-panel-lid | .stamp-card', suitcaseBeats.map((beat) => beat.anchor).join(' | '))
check('and names the three marks', /photo/.test(suitcaseBeats[0]?.text ?? '') && /guess/.test(suitcaseBeats[0]?.text ?? '') && /clue of your own/.test(suitcaseBeats[0]?.text ?? ''), suitcaseBeats[0]?.text ?? '')
await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
await page.waitForSelector('.home-screen:not(.home-first-session)')
check('finishing the suitcase tour restores ordinary Home', await atHome() && (await marker()) === 'done')
check('finishing onboarding clears the lesson markers', await page.evaluate(() => localStorage.getItem('cluecab-onboard-lessons-v1') === null))
const discovered = await page.evaluate(() => {
  const raw = localStorage.getItem('cluecab-srs-v1')
  const stats = raw ? JSON.parse(raw)?.state?.stats : null
  return stats ? Object.keys(stats).length : 0
})
check('practice and real-round words entered the SRS for real', discovered >= 9, `${discovered} records`)
const games = await page.evaluate(() => {
  const raw = localStorage.getItem('cluecab-srs-v1')
  const s = raw ? JSON.parse(raw)?.state : null
  return s ? { played: s.games?.played ?? 0, won: s.games?.won ?? 0, jokers: s.translationJokers ?? 0 } : null
})
check('the first real game counts without reviving the retired joker economy', games && games.played === 1 && games.jokers === 0, JSON.stringify(games))
// Home preserves the first-session priority order, then moves into the
// ordinary rules-and-language rotation.
const bubble1 = (await page.locator('.cluey-bubble').innerText()).trim()
check("the bubble opens on the key rule — Casey's greens count", /Casey's greens/.test(bubble1), bubble1.slice(0, 60))
await page.locator('.cluey-bubble').click()
await page.waitForTimeout(150)
const bubble2 = (await page.locator('.cluey-bubble').innerText()).trim()
check('then collecting needs one green each way', /one green each way/.test(bubble2), bubble2.slice(0, 60))
await page.locator('.cluey-bubble').click()
await page.waitForTimeout(150)
const bubble3 = (await page.locator('.cluey-bubble').innerText()).trim()
check('then tapping Casey opens the case', /Tap Casey to open the case/.test(bubble3), bubble3.slice(0, 60))
await page.locator('.cluey-bubble').click()
await page.waitForTimeout(150)
const bubble4 = (await page.locator('.cluey-bubble').innerText()).trim()
check('and the English Danish-alphabet fact follows', /The Danish alphabet ends with three extra letters/.test(bubble4), bubble4.slice(0, 80))
check(
  'none of the first four bubbles contains retired wrap-up text',
  ![bubble1, bubble2, bubble3, bubble4].some((bubble) => /wrap[- ]?up/i.test(bubble)),
)
await open()
check('a reload goes straight Home', (await atHome()) && (await act()) === null)

// ---- player-clue seam: the real companion hears the learner’s own clue -----
// Start at the tutorial marker with live settings pointed at the local
// OpenAI-compatible stand-in. Seed it BEFORE this document loads: writing the
// blob into a running page can lose to that page's already-hydrated settings
// store re-persisting its former default during the next navigation. ?mock is
// deliberately true: the tutorial must still bypass the local mock for a
// learner-authored clue.
await page.addInitScript(
  ({ baseUrl }) => {
    if (sessionStorage.getItem('tu2-live-seam-seeded')) return
    sessionStorage.setItem('tu2-live-seam-seeded', '1')
    localStorage.clear()
    localStorage.setItem('cluecab-onboard-v5', 'tutorial')
    localStorage.setItem(
      'cluecab-settings-v1',
      JSON.stringify({
        state: {
          useMock: true,
          baseUrl,
          sound: false,
          slowAudio: false,
          studyPhase: 'off',
          clueLanguage: 'target',
          language: 'da',
          klausVerifiedAt: null,
        },
        version: 13,
      }),
    )
  },
  { baseUrl: LOCAL_CASEY_BASE },
)
fake.reset()
await open('?mock=1')
const seededBaseUrl = await page.evaluate(
  () => JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state?.baseUrl ?? null,
)
check('the manual-clue seam boots against its local Casey Worker', seededBaseUrl === LOCAL_CASEY_BASE, seededBaseUrl ?? '')
await page.waitForSelector('.guess-bar')
await page.locator('.word-card:has(.card-word:text-is("hund"))').click()
await page.locator('.guess-confirm .btn-primary').click()
await page.waitForSelector('.clue-input')
// This profile is a SECOND tutorial round on a fresh store: its first player
// clue turn opens the intro-game tour again. Dismiss it before the composer
// is driven — the overlay eats taps by design.
const seamTour = page.locator('.tour-overlay[data-tour-kind="tutorial"]')
if (await seamTour.count()) await seamTour.locator('.onboard-skip').click()
const playerClueLeg = await playPractice({ stopAfterPlayerClue: true })
check('a player-written clue reaches the real companion seam', playerClueLeg === 'player-clue', playerClueLeg)
check('the fake live companion received exactly one request', fake.received.length === 1, `${fake.received.length} calls`)
check(
  'and the request carries the player’s clue',
  fake.received[0]?.raw.includes('spise') === true,
)
check(
  'the real Casey panel paces the returned guess',
  (await page.locator('.ai-panel[data-hurry="1"]').count()) === 1,
)
await page.locator('.onboard-skip').click()
await page.waitForTimeout(250)

// ---- skip stays available on explicit tutorial acts ------------------------
await page.evaluate(() => localStorage.clear())
await open()
check('skip at the ticket act…', (await act()) === 'ticket')
await page.locator('.onboard-skip').click()
await page.waitForTimeout(300)
check('…lands Home', await atHome())
check('…and marks done', (await marker()) === 'done')

await page.evaluate(() => localStorage.clear())
await open()
await ticketToHome()
check('Casey’s lines before the walk keep Skip', (await page.locator('[data-act="intro"] .onboard-skip').count()) === 1)
await homeToTutorial()
await page.locator('.tutorial-game .onboard-skip').click()
await page.waitForSelector('.board-grid')
check('the first-run practice Skip opens the required normal round', await inRealRound())

await page.evaluate(() => localStorage.clear())
await open()
await ticketToHome()
await homeToTutorial()
check('skip at the tutorial act…', await inTutorial())
await page.locator('.tutorial-game .onboard-skip').click()
await page.waitForSelector('.board-grid')
check('…opens the required normal round too', await inRealRound())

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'home-return')
})
await open()
check(
  'the Home return gate has no bubble or floating Skip',
  (await page.locator('.home-first-session .cluey-bubble').count()) === 0 &&
    (await page.locator('.home-first-session .onboard-skip').count()) === 0,
)
check('it is the real Home, its stamp where the postcard total was', (await page.locator('.home-first-session .home-city-stamp').count()) === 1)

// ---- Skip at the new acts lands Home with the first café playable (CW-13) --
for (const where of ['intro', 'explore', 'walk', 'home-cafe']) {
  await page.evaluate(() => localStorage.clear())
  await open()
  await ticketToHome()
  if (where === 'intro') await page.locator('[data-act="intro"] .onboard-skip').click()
  else if (where === 'explore') {
    await page.locator('.onboard-intro-next').click()
    await page.locator('[data-act="intro"] .onboard-skip').click()
  } else {
    await onboardingFlow.introToWalk()
    await page.locator('.run-pause').click()
    if (where === 'walk') await page.locator('.run-panel .onboard-skip').click()
    else {
      await page.locator('.run-panel .run-home').click()
      await page.waitForSelector('.tour-overlay[data-tour-kind="home"]')
      await page.locator('.tour-panel .onboard-skip').click()
    }
  }
  await page.waitForSelector('.home-screen:not(.home-first-session) .home-play')
  check(
    `skip at ${where} lands Home, done, its first café playable`,
    (await marker()) === 'done' && (await page.locator('.home-play').getAttribute('data-cafe-action')) === 'next',
  )
}

// ---- resume: a reload mid-flow picks up at the recorded act ----------------
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'ticket')
})
await open()
check('a mid-flow reload resumes at the ticket', (await act()) === 'ticket')

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'home-intro')
})
await open()
check('the retired staged-Home marker resumes at Casey’s lines', (await act()) === 'intro')

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'walk')
})
await open()
check('a walk marker resumes on the walk’s ready panel, spending no run by itself',
  (await page.locator('.run-screen .run-panel .run-tag-btn-primary').count()) === 1 && (await page.locator('.run-pause').count()) === 0)

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'home-cafe')
})
await open()
await page.waitForSelector('.tour-overlay[data-tour-kind="home"]')
check('a home-cafe marker resumes on Home with the first café found', (await page.locator('.home-first-session .home-play').getAttribute('data-cafe-action')) === 'next')

// A tutorial marker with no round in the store deals the round afresh.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'tutorial')
})
await open()
check('a tutorial marker with no round resumes by dealing it', await inTutorial())

// The post-practice stages are all durable hand-offs, not transient screens.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'real-round')
})
await open()
check('a real-round marker resumes on the normal 3×6 board', (await marker()) === 'real-round' && (await page.locator('.board-grid').count()) === 1 && (await page.locator('.word-card').count()) === 18)

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'suitcase')
})
await open()
check('a suitcase marker resumes inside the live suitcase tour', (await marker()) === 'suitcase' && (await page.locator('.suitcase-screen').count()) === 1 && (await page.locator('.tour-overlay[data-tour-kind="suitcase"]').count()) === 1)
// An empty profile: the collection bands may still be loading or empty. The
// tour waits for them rather than giving up, and never ends the intro on its
// own. (Its 800 ms give-up once called Skip, which finished onboarding.)
await page.waitForTimeout(3000)
check('an owed collection tour never ends the intro by itself', (await marker()) === 'suitcase' && (await page.locator('.suitcase-screen').count()) === 1)
const resumedSuitcaseBeats = await walkTour(page, 'suitcase', check, { label: 'resumed collection tour on an empty suitcase' })
check('and it still walks to its last beat', resumedSuitcaseBeats.at(-1)?.step === resumedSuitcaseBeats.at(-1)?.steps - 1)
check('finishing it marks the suitcase tour read, not the intro skipped', (await marker()) === 'suitcase-ready')

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'suitcase-ready')
})
await open()
check('a suitcase-ready marker resumes with the tour complete', (await marker()) === 'suitcase-ready' && (await page.locator('.suitcase-screen').count()) === 1 && (await page.locator('.tour-overlay[data-tour-kind="suitcase"]').count()) === 0)

// The final Home marker resumes at the one-action Casey gate.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'home-return')
})
await open()
check(
  'a Home-return marker resumes at the Casey gate',
  (await page.locator('.home-first-session').count()) === 1 && await atHome(),
)
// The Home lesson was never taken on this profile, so it is still owed after
// the reload. Escape dismisses only the lesson; a second reload respects that.
await walkTour(page, 'home', check, { label: 'resumed Home lesson', finish: 'escape', atStep: 0 })
check('Escape records the Home lesson as dismissed, not done', (await lessonMarkers(page)).home === 'dismissed' && (await marker()) === 'home-return')
await open()
await page.waitForTimeout(400)
check('a dismissed Home lesson does not come back after a reload', (await page.locator('.tour-overlay[data-tour-kind="home"]').count()) === 0)
check('and the Casey gate is intact under it', await released(page, '.home-first-session .cluey-button'))
await page.locator('.home-first-session .cluey-button').click()
await page.waitForSelector('.suitcase-screen')
check('tapping Casey resumes the required suitcase tutorial', (await marker()) === 'suitcase')

// Older arrival/map markers migrate into the consolidated Home return prompt.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v1', 'arrival')
})
await open()
check(
  'an old arrival marker resumes at the Home return prompt',
  (await oldestMarker()) === 'arrival' &&
    (await page.locator('.home-first-session').count()) === 1 && await atHome(),
)

await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v3', 'map')
})
await open()
check('a v3 map marker also migrates to the Home return prompt', (await v3Marker()) === 'map' && (await page.locator('.home-first-session').count()) === 1)

// ---- veterans are never ambushed --------------------------------------------
// The rules overlay seen once is proof enough of an existing device.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-howto-v4', 'seen')
})
await open()
check('a device that has seen the rules goes straight Home', await atHome())
check('and is marked done silently', (await marker()) === 'done')

// So are words in the SRS map — seeded through the real dev switch so the
// record is exactly the shape the store writes, then read on a plain load.
await page.evaluate(() => localStorage.clear())
await open('?mock=1&howto=0&learned=5')
check('seeding left the onboarding key untouched', (await marker()) === null)
await open()
check('a device with words in the case goes straight Home', await atHome())
check('and is marked done silently too', (await marker()) === 'done')

// ---- ?howto=0 suppresses, writing nothing ------------------------------------
// Dozens of drive URLs carry it; a fresh profile under it must stay fresh.
await page.evaluate(() => localStorage.clear())
await open('?howto=0')
check('?howto=0 suppresses the flow', await atHome())
check('and writes no marker at all', (await marker()) === null)

// ---- replay from Settings: transient, the flag untouched ---------------------
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'done')
})
await seedFirstCafe()
await open('?mock=1&howto=0')
// Settings' replay-intro path must never trade an unfinished real board for
// the practice board. Start a real primary, reload to Home as an ordinary
// player would, then drive the actual Settings door through tutorial Skip.
await page.locator('.home-play').click()
await page.waitForSelector('.game-screen .board-grid')
await open('?mock=1&howto=0')
// Rehydration restores the slot asynchronously. Snapshot only after its
// durable projection has settled, exactly as a Settings visitor sees Home.
await page.waitForTimeout(750)
const pausedCourse = await page.evaluate(() => Object.fromEntries(
  ['cluecab-game-v1', 'cluecab-progression-sessions-v1', 'cluecab-settlement-v1', 'cluecab-srs-v1'].map((key) => [key, localStorage.getItem(key)]),
))
check('Settings intro replay begins with a real active primary', await page.evaluate(() => {
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return sessions?.activeSlot === 'primary' && sessions?.primary !== null
}))
await page.locator('.icon-btn[aria-label="Settings"]').click()
await page.waitForSelector('.settings-screen')
await page.locator('.replay-intro').click()
await page.waitForTimeout(300)
check('Replay the intro starts at the ticket again', (await act()) === 'ticket')
await ticketToHome()
await homeToTutorial()
check('the replay reaches the tutorial round too', await inTutorial())
await page.locator('.tutorial-game .onboard-skip').click()
await page.waitForTimeout(300)
check('skipping the replay lands Home', await atHome())
check('and the done flag never moved', (await marker()) === 'done')
const resumedCourse = await page.evaluate(() => Object.fromEntries(
  ['cluecab-game-v1', 'cluecab-progression-sessions-v1', 'cluecab-settlement-v1', 'cluecab-srs-v1'].map((key) => [key, localStorage.getItem(key)]),
))
const resumedCourseDifferences = Object.keys(pausedCourse).filter((key) => pausedCourse[key] !== resumedCourse[key])
const pausedCourseSummary = (snapshot) => {
  const sessions = JSON.parse(snapshot['cluecab-progression-sessions-v1'] ?? '{}').state?.byCourse?.da ?? null
  const game = JSON.parse(snapshot['cluecab-game-v1'] ?? '{}').state ?? null
  return { active: sessions?.activeSlot ?? null, primary: sessions?.primary?.attemptId ?? null, replay: sessions?.replay?.attemptId ?? null,
    queue: sessions?.continuation?.remainingBoardKeys?.length ?? null, game: game?.attemptId ?? null, gameSlot: game?.activeSlot ?? null,
    recent: game?.recentBoards?.map((board) => board.length) ?? null }
}
check('skipping intro replay restores every paused course byte without a reward', resumedCourseDifferences.length === 0,
  resumedCourseDifferences.length ? `${resumedCourseDifferences.join(', ')} ${JSON.stringify({ before: pausedCourseSummary(pausedCourse), after: pausedCourseSummary(resumedCourse) })}` : '')
await page.locator('.home-play').click()
await page.waitForSelector('.game-screen .board-grid')
check('the restored primary opens instead of dealing a new board', await page.evaluate(() => {
  const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
  return sessions?.activeSlot === 'primary' && sessions?.primary?.attemptId === JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.attemptId
}))

// ---- no rules card: the round header has no ? (owner, 2026-09-26) ----------
// The How to play card is deleted; Settings → Replay the intro is the way back
// to the rules.
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('cluecab-onboard-v5', 'done')
})
await seedFirstCafe()
await open('?mock=1&howto=0')
await page.locator('.home-play').click()
await page.waitForSelector('.game-screen .board-grid')
check('the round header offers no ?', (await page.locator('.game-header .icon-btn[aria-label="How to play"]').count()) === 0)

// ---- the first-time dock lines: once each, and only in real play (O4) --------
// A fresh profile under ?howto=0 — the flow suppressed, the flags unspent —
// plays its first real round. Each line stands in an existing dock hint slot
// (C1 reserved every dock's height, so neither moves the board), speaks once,
// and its flag keeps it from ever speaking again.
// Casey opens (2026-09-06), so the first turn a fresh profile meets is the
// GUESS turn, under his clue, and the clue turn comes after it — the two lines
// now arrive in that order.
await page.evaluate(() => localStorage.clear())
await seedFirstCafe()
await open('?mock=1&howto=0&seed=5&city=0')
await page.locator('.home-play').click()
await page.waitForSelector('.guess-bar', { timeout: 20000 })
check('the first guessing turn says whose key counts now', /Casey's key/.test(await page.locator('.guess-bar .dim').innerText()))
check('…in the one existing hint slot', (await page.locator('.first-hint').count()) === 1)
check('…and its flag is down', (await page.evaluate(() => localStorage.getItem('cluecab-hint-guess'))) !== null)
// The flag spent: a remount of the same phase — the same round, reloaded —
// shows the ordinary line, which is "exactly once" made observable.
await open('?mock=1&howto=0')
const resumeActiveBoard = page.locator('.home-play').first()
check('reload offers the active board continuation', (await resumeActiveBoard.count()) === 1 && await resumeActiveBoard.isEnabled())
await resumeActiveBoard.click()
await page.waitForSelector('.guess-bar')
check('reloaded into the same phase, the line is gone', (await page.locator('.first-hint').count()) === 0)
check('and the ordinary hint stands in the slot', /Tap a word you think Casey means/.test(await page.locator('.guess-bar .dim').innerText()))
// One guess, then stop if the turn is still open, and the turn passes to the
// player's first clue — whose line is the other of the two.
await page.locator('.word-card.card-guessable').first().click()
await page.locator('.guess-confirm .btn-primary').click()
const stop = page.locator('.guess-bar .btn-ghost')
if (await stop.isVisible().catch(() => false)) await stop.click()
await page.waitForFunction(
  () => document.querySelector('.phase-caption')?.textContent === 'Give Casey a clue',
  undefined,
  { timeout: 20000 },
)
check('the first clue turn carries its line, exactly once', (await page.locator('.first-hint').count()) === 1)
const clueHint = (await page.locator('.first-hint').innerText()).replace(/\s+/g, ' ')
check('…naming one word and the lookup beside it', /One Danish word/.test(clueHint) && /Dictionary/.test(clueHint), clueHint.slice(0, 70))
check('…and its flag is down too', (await page.evaluate(() => localStorage.getItem('cluecab-hint-clue'))) !== null)
// Typing takes the slot back — the verdict lines and the hint never stack.
await page.fill('.clue-input input', 'huskeliste')
check('typing clears the line for the verdict slot', (await page.locator('.first-hint').count()) === 0)

// ---- the language act, which now comes before the ticket ---------------------
//
// Two questions in a row, and the order is the point: this one asks what you
// SPEAK so the app can talk to you, and the ticket asks what you want to
// LEARN. Asking the second one in a language you cannot read would be a poor
// joke. The flag stands the seeding init script down, so this is a device that
// has genuinely never answered.
await page.evaluate(() => {
  sessionStorage.setItem('cluecab-drive-language-act', '1')
  localStorage.clear()
})
await open('?onboard=1')
check('a device that has never chosen is asked which language it speaks', (await act()) === 'language')
const languageCards = (await page.locator('.onboard-language .ticket-lang').allTextContents()).map((t) => t.trim())
// The phone in this drive speaks English, so English leads and the rest
// follow in shipped order. Asserted as a set plus a first element rather than
// one long string: the order after the device's own guess is UI_LANGUAGES, and
// pinning the whole string here would make adding a language a two-file edit
// for no extra safety.
// iOS 1.0 ships the picker with SEVEN languages (src/i18n/types.ts): the
// es/nl/nb/hu catalogues stay compiled but are not offered. The drive used to
// expect all eleven; the shipped seven are what a player can be offered.
check(
  'and is offered every language, each in its own name',
  languageCards.length === 7 && languageCards[0] === 'English',
  languageCards.join(','),
)
check(
  'with nothing named in English but English itself',
  ['Deutsch', '中文（简体）', 'Français', 'Português', 'Polski', 'Svenska'].every(
    (name) => languageCards.includes(name),
  ),
  languageCards.join(','),
)
const actScroll = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight])
check('seven cards and a heading do not scroll at 360x640', actScroll[0] <= actScroll[1] + 1, `${actScroll[0]}/${actScroll[1]}`)

// Answering in German: the app comes back speaking German, and the SECOND
// question — the ticket — is readable by the person who answered the first.
await page.locator('.onboard-language').filter({ hasText: 'Deutsch' }).first().click()
await page.waitForTimeout(1200)
check('answering stores the choice', (await page.evaluate(() => localStorage.getItem('cluecab-ui-language'))) === 'de')
check('and stamps the language on the document', (await page.evaluate(() => document.documentElement.lang)) === 'de')
check('the question is not asked twice', (await act()) === 'ticket')
const ticketHeading = (await page.locator('[data-act="ticket"] h1').textContent())?.trim()
check('and the ticket now asks in German', ticketHeading === 'Welche Sprache willst du lernen?', ticketHeading)

// ---- ?onboard=1 forces a transient run (dev/e2e switch) ----------------------
await page.evaluate(() => {
  sessionStorage.removeItem('cluecab-drive-language-act')
  localStorage.clear()
})
await open('?onboard=1')
check('?onboard=1 forces the ticket', (await act()) === 'ticket')
await page.locator('.onboard-skip').click()
await page.waitForTimeout(300)
check('and being transient, writes nothing on the way out', (await marker()) === null)

// The complete journey above stays intentionally in English at the smallest
// shipped phone.  Re-open its real entry points in the longest shipped Latin
// UI at the normal phone size as well: the ticket must still fit, and the
// first-run Guide must be a keyboard-operable, 44px target with a way back.
const deCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const dePage = await deCtx.newPage()
const deExternalRequests = []
dePage.on('request', (request) => {
  if (new URL(request.url()).origin !== new URL(BASE).origin) deExternalRequests.push(request.url())
})
await dePage.addInitScript(() => {
  localStorage.setItem('cluecab-ui-language', 'de')
})
await dePage.goto(`${BASE}?onboard=1`, { waitUntil: 'networkidle' })
await dePage.waitForSelector('.onboard-screen[data-act="ticket"]')
const deTicket = dePage.locator('.onboard-ticket').filter({ hasText: 'Denmark' })
const deTicketBox = await deTicket.boundingBox()
const deGeometry = await dePage.evaluate(() => ({
  scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
  viewportHeight: window.innerHeight,
  language: document.documentElement.lang,
  title: document.querySelector('[data-act="ticket"] h1')?.textContent?.trim() ?? '',
  titleBox: (() => { const box = document.querySelector('[data-act="ticket"] h1')?.getBoundingClientRect(); return box ? { top: box.top, bottom: box.bottom } : null })(),
  updateBanner: document.querySelector('.update-banner') !== null,
}))
check(
  'German ticket fits at 390×844 with its real long copy',
  deGeometry.language === 'de' && deGeometry.scrollHeight <= deGeometry.viewportHeight + 1 && deGeometry.title === 'Welche Sprache willst du lernen?' && deGeometry.titleBox !== null && deGeometry.titleBox.top >= 0 && deGeometry.titleBox.bottom <= deGeometry.viewportHeight && !deGeometry.updateBanner,
  JSON.stringify(deGeometry),
)
check('German ticket remains a 44px keyboard target', !!deTicketBox && deTicketBox.height >= 44 && deTicketBox.width >= 44, JSON.stringify(deTicketBox))
await dePage.screenshot({ path: `${SHOT_DIR}/onboarding-de-390x844-ticket.png`, fullPage: true })
await deTicket.focus()
check('German ticket receives keyboard focus', await deTicket.evaluate((element) => document.activeElement === element))
await deTicket.press('Enter')
await dePage.waitForSelector('[data-act="intro"]')
const deFlow = createOnboardingFlow(dePage)
await deFlow.introToWalk()
await deFlow.walkToHome()
// "On we go" closes Home's café spotlight; the real Home is the player's.
await dePage.locator('.tour-panel .onboard-next').click()
await dePage.locator('.tour-panel .onboard-next').click()
await dePage.waitForSelector('.tour-overlay', { state: 'detached' })
const deGuide = dePage.locator('.home-first-session button.travel-guide-button')
await deGuide.waitFor({ state: 'visible' })
const deGuideBox = await deGuide.boundingBox()
check('first-run German Travel Guide remains a 44px target', !!deGuideBox && deGuideBox.height >= 44 && deGuideBox.width >= 44, JSON.stringify(deGuideBox))
await deGuide.focus()
check('first-run German Travel Guide receives keyboard focus', await deGuide.evaluate((element) => document.activeElement === element))
await deGuide.press('Enter')
await dePage.waitForSelector('.guide-cover-screen')
check('keyboard opens the first-run Guide in German', (await dePage.locator('.guide-cover-screen').count()) === 1)
await dePage.screenshot({ path: `${SHOT_DIR}/onboarding-de-390x844-guide.png`, fullPage: true })
await dePage.locator('.guide-cover-screen .book-back').press('Enter')
await dePage.waitForSelector('.home-first-session')
check('Guide return restores the first-session Home', (await dePage.locator('.home-first-session').count()) === 1)
check('German geometry leg makes zero external requests', deExternalRequests.length === 0, deExternalRequests.join(', '))
await deCtx.close()

// The first walk's café (owner, after build 123): found on the fifth photo,
// it comes down the road in a gate's place, and "You found a café" opens as
// Casey reaches it, not at the find. A fresh player in a context of its own.
const cafeWalk = await firstWalkCafePanel(browser, BASE, { country: 'Denmark', viewport: VP, shot: `${SHOT_DIR}/onboarding-en-${VPN}-cafe-reached.png` })
check('the first walk finds its café on the fifth photo and walks on: no panel, no hold at the find',
  cafeWalk.atFind.photos === 5 && !cafeWalk.atFind.held && !cafeWalk.atFind.panel && cafeWalk.atFind.cafeZ > 8, JSON.stringify(cafeWalk.atFind))
check('"You found a café" opens as Casey reaches the café',
  cafeWalk.atCafe.held && cafeWalk.atCafe.photos > 5 && cafeWalk.atCafe.cafeZ !== null && cafeWalk.atCafe.cafeZ > 0 && cafeWalk.atCafe.cafeZ <= 0.1, JSON.stringify(cafeWalk.atCafe))
// The café-collect sound (owner, 2026-10-05): asked for once, as Casey reaches
// the café (not at the find), from its own file, and not with an answer's word.
const cafeSound = cafeWalk.atCafe.cafeSounds[0]
check('no café sound at the find, before Casey reaches it', cafeWalk.atFind.cafeSounds === 0, JSON.stringify(cafeWalk.atFind))
check('the café sound is asked for once, as Casey reaches the café',
  cafeWalk.atCafe.cafeSounds.length === 1 && /audio\/ui\/cafe-collect-[abc]\.wav$/.test(cafeSound.url) && cafeSound.cafeZ !== null && cafeSound.cafeZ > 0 && cafeSound.cafeZ <= 0.1,
  JSON.stringify(cafeWalk.atCafe.cafeSounds))
check('the café sound is not in an answer’s frame', cafeSound !== undefined && cafeSound.fromAnswerMs > 200, JSON.stringify(cafeSound))
check('Keep sightseeing carries on from the café', !cafeWalk.after.held)
check('no page errors on the walk to the café', cafeWalk.errors.length === 0, cafeWalk.errors.join(' | '))

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300))
check('the full fresh-player journey made zero external requests', externalRequests.length === 0, externalRequests.join(', '))

await browser.close()
preview.stop()
await casey.stop()
await fake.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nONBOARDING DRIVE OK')
if (fail.length) process.exitCode = 1
