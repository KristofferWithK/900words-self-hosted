// The real SEC3 decision client, through the real Worker, against a fake model.
//
// Every other drive runs the mock companion, which hands back ready-made
// objects and never calls the server. This drive crosses the complete boundary:
// typed public view from the browser, server-built prompt and model retry, then
// a finished decision back to the app.
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startFakeOllama, clueReply, guessReply } from './fake-ollama.mjs'
import { startWorker } from './worker-runtime.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4186
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const FAKE_PORT = 4187
const WORKER_PORT = 4188
const preview = await startPreview(PORT)
const fake = await startFakeOllama(FAKE_PORT + OFFSET)
const casey = await startWorker(WORKER_PORT + OFFSET, {
  upstream: fake.baseUrl,
  apiKey: 'worker-secret-for-tests',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fake-model' } }) },
  // This drive is deliberately model-free: use the bundler already installed
  // with Vite instead of `npx wrangler`, which may attempt a registry fetch.
  bundler: 'rolldown',
})
if (!casey) throw new Error('Miniflare is required for ai-drive')
// The browser's City 1 route uses an authored roster that deliberately mixes
// historical curriculum bands. The Worker therefore keeps it model-backed:
// an evaluator only advises on a complete historical shard. The browser tests
// below use a legal model reply for that real mixed-board path; the E5 retry
// fixture below sends a complete, source-backed shard through the same Worker.
const source = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const load = (id) => source.ssrLoadModule(id)
const [{ loadEvaluator, engineTrapIds, authoredCities }, { THETA }, { checkClueLegality }, { ACTIVE }] = await Promise.all([
  load('/src/ai/local/evaluator.ts'),
  load('/src/ai/local/search.ts'),
  load('/src/engine/legality.ts'),
  load('/src/lang/active.ts'),
])
const evaluators = new Map(
  await Promise.all(authoredCities.map(async (city) => [city, await loadEvaluator(city)])),
)

const BASE = preview.base
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

// S1: Casey's guesses are spoken. This is the drive that puts a real guess
// through the whole AI pipeline in a real browser, so it is where a clip
// request for that guess is observable — not on the network response's
// status (this build may have no bake at all), just that `playWord` asked.
const audioHits = []
page.on('response', (r) => {
  if (r.url().includes('/audio/')) audioHits.push(r.url())
})

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

// Casey talks to the fake, not to Ollama, and not through the mock.
await page.addInitScript(
  ({ baseUrl }) => {
    try {
      const queuedRound = sessionStorage.getItem('__ai-drive-primary-fixture-v1')
      if (queuedRound) {
        const { cache, sessions } = JSON.parse(queuedRound)
        localStorage.setItem('cluecab-game-v1', cache)
        localStorage.setItem('cluecab-progression-sessions-v1', sessions)
        sessionStorage.removeItem('__ai-drive-primary-fixture-v1')
      }
    } catch { /* opaque origins do not carry this test-only fixture */ }
    window.__feedback = { oscillatorStarts: [], vibrations: [] }
    // The web build's haptics are navigator.vibrate (src/ui/feedback.ts);
    // recorded here so the found-tile and full-clue responses can be counted.
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern) => {
        window.__feedback.vibrations.push(pattern)
        return true
      },
    })
    // The app's REAL AudioContext, with every oscillator start counted. Words
    // play through it since #413 (decoded buffers, src/ui/wordAudioWeb.ts),
    // so it must decode and play for real: the stand-in this used to be had
    // no decodeAudioData or buffer sources, and every word Casey guessed was
    // reported as a recording that did not load. It starts on the Give-clue
    // tap, a real click, as it does on a phone.
    const RealAudioContext = window.AudioContext
    if (RealAudioContext) {
      window.AudioContext = class extends RealAudioContext {
        createOscillator() {
          const osc = super.createOscillator()
          const start = osc.start.bind(osc)
          osc.start = (at = 0, ...rest) => {
            window.__feedback.oscillatorStarts.push(at)
            return start(at, ...rest)
          }
          return osc
        }
      }
    }
    localStorage.setItem(
      'cluecab-settings-v1',
      JSON.stringify({
        state: {
          baseUrl,
          clueLanguage: 'en',
          studyPhase: 'never',
          useMock: false,
        },
        version: 11,
      }),
    )
    window.__aiWritePrimaryFixture = (raw) => {
      const persisted = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
      const sessions = persisted?.state?.byCourse?.da
      if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
        throw new Error('AI drive needs an active durable primary slot')
      }
      sessions.primary.game = raw.state.game
      sessionStorage.setItem('__ai-drive-primary-fixture-v1', JSON.stringify({
        cache: JSON.stringify(raw), sessions: JSON.stringify(persisted),
      }))
    }
  },
  { baseUrl: `${casey.base}/v1` },
)

const gameState = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game)

const describeRound = (game) => {
  const green = (key) =>
    Object.entries(key)
      .filter(([, role]) => role === 'green')
      .map(([id]) => id)
  return {
    ids: game.words.map((w) => w.wordId),
    aiGreens: green(game.aiKey),
    // U3's section needs guesses that KEEP the turn alive, and under the
    // player's clue that means green on the PLAYER's key — the guess is judged
    // against the clue-giver's key and nothing else. A bystander would end the
    // turn on the first reveal and there would be no second one to compare.
    playerGreens: green(game.playerKey),
    da: Object.fromEntries(game.words.map((w) => [w.wordId, w.da])),
  }
}

/**
 * A deterministic developer round with the PLAYER cluing first.
 *
 * Casey opens by default now, which would spend the first queued fake response
 * on his opening clue and shift every scenario below by one. ?first=player is
 * a local-only dev switch for exactly this: these tests are about the AI
 * client's parsing, retries and error taxonomy, not about who goes first.
 */
async function freshRound(seed = 5) {
  await page.goto(`${BASE}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    // A seeded developer round is intentionally separate from a persisted
    // course slot. Clear both before its second load so a preceding resume
    // test cannot race the seeded setup back onto the old board.
    localStorage.removeItem('cluecab-progression-sessions-v1')
  })
  await page.goto(`${BASE}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  return describeRound(await gameState())
}

/** A normal City 1 round whose primary slot owns the reload fixture below. */
async function courseRound() {
  await page.goto(`${BASE}?howto=0&first=player`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await page.goto(`${BASE}?howto=0&first=player`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.waitForFunction(() => {
    const persisted = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = persisted?.state?.byCourse?.da
    return sessions?.activeSlot === 'primary' && !!sessions.primary
  })
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
}

async function forceSuddenDeath() {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    raw.state.game.phase = 'suddenDeath'
    raw.state.game.turnsLeft = 0
    window.__aiWritePrimaryFixture(raw)
  })
  await page.reload()
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.sudden-death-bar', { timeout: 20_000 })
}

/**
 * Skip whatever is left of Casey's current beat (U3), the way a thumb does.
 *
 * Her turn is two beats per guess now — her reasoning, then the guess it
 * explains — and a tap on the panel hurries to the next one. Used where a
 * section is waiting for the turn to be OVER rather than watching it happen.
 */
const hurryCasey = async (taps = 10) => {
  const panel = page.locator('.dock.ai-panel[data-hurry]')
  for (let i = 0; i < taps; i++) {
    if (!(await panel.isVisible().catch(() => false))) return i
    await panel.click({ timeout: 1000 }).catch(() => {})
    await sleep(70)
  }
  return taps
}

/**
 * One reply per card Casey will name. Since top-two assistance (#207) she
 * asks the model again before EVERY guess — "propose alternatives for the
 * NEXT ONE actual guess" — so a plan of two greens is two requests, each
 * answered with the guesses still to come, ranked. One reply carrying both
 * used to be enough; queued that way now, the second request ate the clue
 * reply behind it, and the clue reply was consumed by a guess prompt (the
 * "could not find an evaluator-safe clue" failure of 2026-09-11).
 */
const guessBeats = (ids, reasoning) =>
  ids.map((_, i) => ({
    json: {
      guesses: ids.slice(i).map((wordId, j) => ({
        wordId,
        confidence: 0.9 - j * 0.05,
        reasoning: reasoning(wordId),
      })),
    },
  }))

const submitClue = async (text = 'huskeliste') => {
  try {
    await page.fill('.clue-input input', text)
  } catch (error) {
    const game = await gameState()
    throw new Error(`AI drive expected the player composer, found ${game?.phase ?? 'no game'} (${game?.turn ?? 'no turn'}): ${error.message}`)
  }
  await page.click('.clue-input .btn-primary')
}

const errorText = async () => {
  await page.waitForSelector('.error-banner', { timeout: 15000 })
  return (await page.locator('.error-banner p').textContent()).trim()
}

const promptText = (request) => (request?.messages ?? []).map((m) => m.content ?? '').join('\n')
const promptView = (request) => {
  const words = []
  for (const line of promptText(request).split('\n')) {
    const m = line.match(/^(\S+) \| .+? \(.+?\) \[(.+?)\] \| (.*?)(?: \| my key: (GREEN|BYSTANDER))?(?: \|.*)?$/)
    if (!m) continue
    const [, id, pos, status, role] = m
    if (!wordById(id)) continue
    const reveal =
      status === 'hidden'
        ? { kind: 'hidden' }
        : status === 'revealed green'
          ? { kind: 'green' }
          : { kind: 'bystander', against: [...(status.match(/under (.+) clue/)?.[1] ?? 'player').split('+')] }
    // The evaluator only needs ids, roles and reveals. `searchClue`'s legality
    // needs the rest, so reuse the prompt's id via the source dataset below.
    words.push({ id, pos, roleOnMyKey: role?.toLowerCase() ?? 'bystander', reveal })
  }
  return words
}
const wordById = (await load('/src/data/words.ts')).wordById
const sourceView = (request) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: Number(promptText(request).match(/Turns left: (\d+)/)?.[1] ?? 5),
  words: promptView(request).map((w) => {
    const data = wordById(w.id)
    return { ...w, da: data.da, en: data.en, pos: data.pos }
  }),
  history: [],
  flagged: [],
})
const legalClueReply = (request) => {
  const view = sourceView(request)
  if (/You are the GUESSER/.test(promptText(request))) {
    const target = view.words.find((word) => word.reveal.kind === 'hidden')
    if (!target) throw new Error('AI drive could not find a guess target')
    return guessReply([target.id])
  }
  const targets = view.words.filter((word) => word.roleOnMyKey === 'green').map((word) => word.id).slice(0, 2)
  if (targets.length === 0) throw new Error('AI drive could not find a clue target')
  return clueReply(targets, 'forbindelse')
}
const evaluatorRetryFixture = () => {
  for (const evaluator of evaluators.values()) {
    if (!evaluator) continue
    for (const target of evaluator.ids) {
      for (const trap of evaluator.ids) {
        if (target === trap) continue
        const asWord = (id, roleOnMyKey, reveal = { kind: 'hidden' }) => {
          const data = wordById(id)
          return { id, da: data.da, en: data.en, pos: data.pos, roleOnMyKey, reveal }
        }
        const view = {
          kind: 'ai-clue',
          clueLanguage: 'target',
          turnsLeft: 5,
          words: [asWord(target, 'green'), asWord(trap, 'bystander', { kind: 'bystander', against: ['player'] })],
          history: [],
          flagged: [],
        }
        const board = view.words.map(({ da, en, pos }) => ({ da, en, pos }))
        const candidates = evaluator
          .assocFor(target)
          .filter((entry) => checkClueLegality(entry.da, board, ACTIVE).legal)
          .map((entry) => ({ entry, margin: evaluator.scoreClue(entry.da, [target], [trap]).margin }))
        const unsafe = candidates.find((candidate) => candidate.margin < THETA)
        const safe = candidates.find((candidate) => candidate.margin >= THETA)
        if (unsafe && safe) return { target, trap, view, unsafe, safe }
      }
    }
  }
  throw new Error('E5 drive could not find an evaluator retry fixture')
}

const evaluatorFixture = evaluatorRetryFixture()
fake.reset()
fake.queue(
  clueReply([evaluatorFixture.target], evaluatorFixture.unsafe.entry.da),
  clueReply([evaluatorFixture.target], evaluatorFixture.safe.entry.da),
)
const evaluatorResponse = await fetch(`${casey.base}/v1/casey/decision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Install-Id': 'ai-drive-evaluator' },
  body: JSON.stringify({ protocol: 1, operation: 'clue', view: evaluatorFixture.view }),
})
const evaluatorBody = await evaluatorResponse.text()
let evaluatorResult = null
try {
  evaluatorResult = JSON.parse(evaluatorBody)
} catch {}
const evaluatorRetry = fake.received.find((request) => /evaluator check/.test(request.raw))
check(
  'an evaluator-rejected clue is corrected and retried by the real Worker',
  evaluatorResponse.ok && evaluatorResult?.decision?.clue === evaluatorFixture.safe.entry.da &&
    engineTrapIds(evaluatorFixture.view).join(',') === evaluatorFixture.trap &&
    !!evaluatorRetry && fake.received.length === 2,
  `HTTP ${evaluatorResponse.status}; ${fake.received.length} calls; ${evaluatorRetry ? 'checked correction sent' : evaluatorBody}`,
)

try {
  // ---- clean JSON: the round actually advances -------------------------------
  let round = await freshRound()
  fake.reset()
  fake.queue(...guessBeats(round.playerGreens.slice(0, 2), () => 'fake'), legalClueReply)
  await submitClue()
  await page.waitForSelector('.ai-guess-line, .guess-bar', { timeout: 20000 })
  // Hurried rather than waited out: since U3 the first card does not flip
  // until the think beat has had its two seconds, and a fixed 2.5s sleep would
  // be measuring the beat clock rather than the client. The taps put the turn
  // where this section wants it — finished — in about a fifth of the time.
  await hurryCasey()
  await sleep(2500)
  check('clean JSON drives a real round', fake.received.length >= 1, `${fake.received.length} calls`)
  check(
    'only the Worker attached its server credential upstream',
    fake.received[0].auth === 'Bearer worker-secret-for-tests',
  )
  check(
    "Casey's guess is spoken (S1): a clip was requested for it",
    audioHits.some((u) => u.includes('/audio/da/')),
    audioHits.length ? audioHits.map((u) => u.split('/').pop()).join(', ') : 'no audio requested',
  )

  // ---- U3: she says why, and THEN she guesses --------------------------------
  // The claim is an order, not a presence: the sentence in the bubble is up
  // BEFORE the card it explains flips, and it is that card's sentence and not
  // the next one's. Driven through the real client so the reasoning travels the
  // whole way — model reply, schema, plan, store, panel — and read off the DOM
  // rather than off the store, because a reasoning that reaches the state and
  // not the screen is exactly the failure this is here to catch.
  //
  // Two guesses, both green on the PLAYER's key so the turn survives the first
  // one, each with its own word named in its own sentence.
  await page.addInitScript(() => {
    // Word clips PLAYED, as the app announces each start (`cluecab-audio`,
    // from a decoded buffer or an element alike): S1 speaks each guess as it
    // lands, and the two beats must not turn one guess into two plays.
    // Plays rather than fetches, and word clips rather than every clip: the
    // deal preloads the whole board since #205, so a fetch count read 18 for
    // two guesses, and a word is said with its article (audio/da/article/)
    // since 2026-09-07, which is a second clip and not a second saying.
    window.__clips = []
    window.addEventListener('cluecab-audio', (e) => {
      // A City 1 noun is one phrase clip (audio/da/phrase/et-hus.mp3) since
      // 2026-09-26; a chained article clip still does not count.
      const m = String(e.detail?.url ?? '').match(/\/audio\/[a-z]+\/(?:phrase\/(?:slow\/)?)?([^/?]+)\.mp3$/)
      if (m) window.__clips.push(m[1])
    })
  })
  round = await freshRound()
  const spoken = round.playerGreens.slice(0, 2)
  await page.evaluate(() => { window.__feedback.oscillatorStarts = []; window.__feedback.vibrations = [] })
  fake.reset()
  fake.queue(
    ...guessBeats(spoken, (wordId) => `I am naming ${round.da[wordId]} here, and nothing else on the board.`),
    legalClueReply,
  )
  // Sampled rather than polled with locators: a beat is about a second long and
  // a round-trip per read would miss the edges. Only CHANGES are recorded, so
  // the transcript is the sequence of states the panel actually passed through.
  await page.evaluate(() => {
    window.__u3 = []
    // Only what the turn below says: the deal and the sections above have
    // already played clips of their own.
    window.__clips = []
    window.__u3timer = setInterval(() => {
      const panel = document.querySelector('.dock.ai-panel[data-beat]')
      if (!panel) return
      const face = panel.querySelector('.cluey-figure')
      if (face) (window.__anim ??= new Set()).add(getComputedStyle(face).animationName)
      const at = {
        beat: panel.dataset.beat,
        bubble: (document.querySelector('.ai-bubble')?.textContent ?? '').trim(),
        line: (document.querySelector('.ai-guess-line')?.textContent ?? '').trim(),
        t: Date.now(),
      }
      const last = window.__u3[window.__u3.length - 1]
      if (!last || last.beat !== at.beat || last.bubble !== at.bubble || last.line !== at.line) {
        window.__u3.push(at)
      }
    }, 40)
  })
  await submitClue()
  // Until both reveals are on the transcript (not a fixed 9 s: a second reveal
  // landing in the last sampling gap was counted as spoken but not as
  // revealed), then long enough for a doubled saying to show up.
  await page.waitForFunction(
    (n) => window.__u3.filter((b) => b.beat !== 'think' && /«[^»]+»/.test(b.line)).length >= n,
    spoken.length,
    { timeout: 20_000 },
  ).catch(() => {})
  await sleep(1500)
  const transcript = await page.evaluate(() => {
    clearInterval(window.__u3timer)
    return { beats: window.__u3, clips: window.__clips, anim: [...(window.__anim ?? [])] }
  })
  // Walk the transcript into one entry per card that flipped, carrying the
  // think beat that stood immediately before it.
  const flips = []
  let pending = null
  for (const b of transcript.beats) {
    if (b.beat === 'think') {
      if (!pending) pending = b
      continue
    }
    const named = b.line.match(/«([^»]+)»/)
    if (named) {
      flips.push({ da: named[1], thought: pending?.bubble ?? '', waited: pending ? b.t - pending.t : 0 })
      pending = null
    }
  }
  check(
    'Casey reveals a guess per planned word, in order',
    flips.length === spoken.length &&
      flips.every((f, i) => f.da === round.da[spoken[i]]),
    flips.map((f) => f.da).join(' → ') || 'no card flipped',
  )
  check(
    'and the bubble before each reveal is that guess’s own reasoning',
    flips.length > 0 && flips.every((f) => f.thought.includes(f.da)),
    flips.map((f) => `${f.da} ← "${f.thought.slice(0, 46)}…"`).join(' | ') || 'nothing to read',
  )
  check(
    'and it stood there long enough to read',
    flips.length > 0 && flips.every((f) => f.waited >= 1500),
    flips.map((f) => `${f.waited}ms`).join(', '),
  )
  check(
    'and S1 still speaks each guess exactly once',
    transcript.clips.length === flips.length,
    `${transcript.clips.length} clips for ${flips.length} guesses: ${transcript.clips.join(', ')}`,
  )
  // The tile-found cue and the reward ding were Web Audio tones until
  // 2026-09-24, when a suitcase clack replaced them; #291 retired the clack
  // too (owner, 2026-09-26: the green haptic is that moment's response) and
  // moved every remaining effect onto media elements. So a found tile is the
  // light green haptic, completing the clue is the success haptic, and no
  // effect is synthesized on the shared AudioContext any more.
  const feedback = await page.evaluate(() => window.__feedback)
  const vibrated = (pattern) =>
    feedback.vibrations.filter((v) => JSON.stringify(v) === JSON.stringify(pattern)).length
  check(
    'and each found tile earns exactly one light green haptic',
    vibrated(15) === spoken.length,
    JSON.stringify(feedback),
  )
  check(
    'and reaching the clue’s full number earns exactly one success haptic',
    vibrated([25, 45, 20]) === 1,
    JSON.stringify(feedback),
  )
  check(
    'and no effect is synthesized on the shared AudioContext',
    feedback.oscillatorStarts.length === 0,
    JSON.stringify(feedback),
  )

  // ---- and the same beats for someone who asked for stillness ---------------
  // The beats are a clock, not an animation, so reduced motion must not skip
  // any of them — while Casey's face, which IS animated, holds still. The
  // allowlist that stops it is in src/styles/48-confetti-and-reduced-motion.css under "reduced motion"; this is the
  // check that it covers the face this panel renders.
  //
  // Not vacuous, and this is what says so: her face on the ORDINARY path,
  // sampled in the section above, is running a named keyframe rather than
  // sitting at `none`, so the reading below has something to have turned off.
  check(
    'her face is animated at all when nobody asked for stillness',
    transcript.anim.length > 0 && transcript.anim.some((a) => a !== 'none'),
    transcript.anim.join('/') || 'unread',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  round = await freshRound()
  fake.reset()
  fake.queue(
    ...guessBeats(round.playerGreens.slice(0, 2), (wordId) => `Still ${round.da[wordId]}, and still for the same reason.`),
    legalClueReply,
  )
  await page.evaluate(() => {
    window.__still = new Set()
    window.__stillAnim = new Set()
    window.__stillTimer = setInterval(() => {
      const panel = document.querySelector('.dock.ai-panel[data-beat]')
      if (!panel) return
      window.__still.add(panel.dataset.beat)
      const face = panel.querySelector('.cluey-figure')
      if (face) window.__stillAnim.add(getComputedStyle(face).animationName)
    }, 40)
  })
  await submitClue()
  await sleep(7000)
  const still = await page.evaluate(() => {
    clearInterval(window.__stillTimer)
    return { beats: [...window.__still].sort(), anim: [...window.__stillAnim] }
  })
  check(
    'reduced motion gets both beats, without the face animation',
    still.beats.join(',') === 'reveal,think' && still.anim.every((a) => a === 'none'),
    `beats ${still.beats.join('+') || 'none'}; face animation ${still.anim.join('/') || 'unread'}`,
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  // ---- messy but recoverable replies -----------------------------------------
  const shapes = [
    {
      name: 'fenced JSON is unwrapped',
      body: (id) => '```json\n' + JSON.stringify(guessReply([id]).json) + '\n```',
    },
    {
      name: 'JSON buried in prose is salvaged',
      body: (id) =>
        `Sure! Here is my answer:\n${JSON.stringify(guessReply([id]).json)}\nHope that helps.`,
    },
  ]
  for (const shape of shapes) {
    round = await freshRound()
    fake.reset()
    fake.queue(
      { body: shape.body(round.playerGreens[0]) },
      ...guessBeats(round.playerGreens.slice(1, 2), () => 'fake'),
      legalClueReply,
    )
    await submitClue()
    await sleep(2500)
    check(shape.name, (await page.locator('.error-banner').count()) === 0)
  }

  // ---- a valid shape naming a word that is not guessable → corrective retry ---
  round = await freshRound()
  fake.reset()
  fake.queue(guessReply(['not-a-word-on-this-board']), ...guessBeats(round.playerGreens.slice(0, 2), () => 'fake'), legalClueReply)
  await submitClue()
  await sleep(3000)
  check('an off-board wordId is retried, not accepted', fake.received.length >= 2, `${fake.received.length} calls`)
  check('and the retry says what was wrong', /invalid|corrected JSON/i.test(fake.received[1]?.raw ?? ''))

  // ---- nothing usable, ever → the round says so rather than hanging ----------
  // Five, because the call gets three corrections after its first attempt. The
  // fake auto-replies once its script drains, so a short queue would be rescued
  // by a valid reply and this would assert nothing.
  round = await freshRound()
  fake.reset()
  fake.queue(...Array.from({ length: 5 }, (_, i) => ({ body: `No JSON from me (${i}).` })))
  await submitClue()
  const neverValid = await errorText()
  check('a model that never returns JSON surfaces an error', neverValid.length > 0, neverValid)
  check('and it took every correction first', fake.received.length === 4, `${fake.received.length} calls`)
  // What the player reads is about their game. The validator's own words —
  // "not an unrevealed GREEN word on your key", "schema mismatch" — are written
  // for the model, and used to reach the screen verbatim under "The AI kept
  // answering invalidly".
  check(
    'and the message is written for the player, not for the model',
    /^Casey could not/.test(neverValid) && !/JSON|schema|wordId|invalid/i.test(neverValid),
    neverValid,
  )

  // ---- the HTTP error taxonomy ----------------------------------------------
  const httpCases = [
    // Upstream details stay behind the boundary. A model-side 401/404 is a
    // server configuration problem, not a credential or model for the player
    // to edit on the phone.
    [401, /server could not complete/i, 'hidden upstream auth'],
    [404, /server could not complete/i, 'hidden upstream model'],
    [429, /busy|wait a moment/i, 'rate-limit'],
  ]
  for (const [status, pattern, label] of httpCases) {
    round = await freshRound()
    fake.reset()
    fake.queue({ status })
    await submitClue()
    const msg = await errorText()
    check(`HTTP ${status} reads as ${label}`, pattern.test(msg), msg)
  }

  // ---- 500 is retried exactly once, then succeeds ----------------------------
  round = await freshRound()
  fake.reset()
  fake.queue({ status: 500 }, ...guessBeats(round.playerGreens.slice(0, 2), () => 'fake'), legalClueReply)
  await submitClue()
  await sleep(3000)
  check('a 500 is retried and the round continues', (await page.locator('.error-banner').count()) === 0)
  check('and it was retried exactly once', fake.received.length >= 2, `${fake.received.length} calls`)

  // ---- a Casey error keeps the board and never substitutes an agent ----------
  round = await freshRound()
  fake.reset()
  fake.queue({ status: 401 })
  await submitClue()
  await errorText()
  const banner = await page.locator('.error-banner').boundingBox()
  const actions = await page.locator('.error-actions').boundingBox()
  check(
    'both Casey error actions fit the phone',
    actions.x >= banner.x - 0.5 && actions.x + actions.width <= banner.x + banner.width + 0.5,
    `${actions.width.toFixed(0)}px inside ${banner.width.toFixed(0)}px`,
  )
  check(
    'there is no player-facing agentless fallback',
    (await page.getByRole('button', { name: /without Casey/i }).count()) === 0,
  )
  check('the connection escape hatch is Casey settings', await page.getByRole('button', { name: 'Casey settings' }).isVisible())
  // Keep Casey inside the same guessing turn while the assertion observes the
  // retry. A one-word plan can finish and start her next automatic clue during
  // U3's reveal beat, which turns an exact request-count check into a timer.
  fake.queue(...guessBeats(round.playerGreens.slice(0, 2), () => 'fake'))
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.waitForFunction(() => !document.querySelector('.error-banner'), { timeout: 20000 })
  await sleep(2500)
  check(
    'retry asks model-backed Casey again',
    fake.received.length >= 2 && /You are the GUESSER/.test(fake.received[1]?.raw ?? ''),
    `${fake.received.length} calls`,
  )

  await page.reload()
  await page.waitForSelector('.city-card')
  const savedRound = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state ?? {},
  )
  check('the saved round has no agentless fallback flag', !('practiceFallback' in savedRound))
  // The companion selection is `caseyMode` since v15 of the settings, and
  // `useMock` is no longer persisted at all (v16: agentless play is not a
  // player mode), so the persisted mode is what a retry must leave alone.
  const modeAfter = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state?.caseyMode,
  )
  check('and retry changes no companion setting', modeAfter === 'worker', `caseyMode ${modeAfter}`)

  round = await freshRound()
  fake.reset()
  fake.queue(...guessBeats(round.playerGreens.slice(0, 2), () => 'fake'), legalClueReply)
  await submitClue()
  await sleep(2500)
  check('the next round still uses Casey', fake.received.length >= 1, `${fake.received.length} calls`)

  // ---- and the round ENDS without asking the model anything -----------------
  // The summary is entirely local: its sentences, turn count and outcome are
  // already in the board and stores, so finishing a round must not spend a
  // proxy request. Check both a green and a greenless ending because a hidden
  // post-round call can otherwise look harmless in the common path.
  //
  // Sudden death is the cheap way to both endings. The clue-and-guess loop
  // above would need a scripted reply for every turn of a full round; this
  // needs none, because sudden death has no clue-giver and therefore no AI
  // turn — and a green on either key keeps it going, so one round can bank a
  // green and then end on a dud.
  await courseRound()
  await forceSuddenDeath()
  const sd = await gameState()
  const dud = sd.words.find(
    (w) =>
      sd.playerKey[w.wordId] !== 'green' &&
      sd.aiKey[w.wordId] !== 'green' &&
      sd.reveals[w.wordId].kind === 'hidden',
  )
  if (!dud) throw new Error('no non-green word to end sudden death on')
  // Reset AFTER the round is set up and BEFORE the guess that ends it, so the
  // count below covers exactly the ending.
  fake.reset()
  await page.locator(`.word-card:has(.card-word:text-is("${dud.da}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.round-summary', { timeout: 20000 })
  await sleep(2500)
  check(
    'a round ending with nothing green sends nothing to the model',
    fake.received.length === 0,
    `${fake.received.length} calls`,
  )

  // The green ending: bank one green in sudden death, then end on the dud.
  await courseRound()
  await forceSuddenDeath()
  const sd2 = await gameState()
  const green = sd2.words.find(
    (w) =>
      (sd2.playerKey[w.wordId] === 'green' || sd2.aiKey[w.wordId] === 'green') &&
      sd2.reveals[w.wordId].kind === 'hidden',
  )
  const dud2 = sd2.words.find(
    (w) =>
      sd2.playerKey[w.wordId] !== 'green' &&
      sd2.aiKey[w.wordId] !== 'green' &&
      sd2.reveals[w.wordId].kind === 'hidden',
  )
  if (!green || !dud2) throw new Error('sudden death board lacks a green or a dud')
  await page.locator(`.word-card:has(.card-word:text-is("${green.da}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.sudden-death-bar', { timeout: 20000 })
  fake.reset()
  await page.locator(`.word-card:has(.card-word:text-is("${dud2.da}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
  await page.waitForSelector('.round-summary', { timeout: 20000 })
  await sleep(1500)
  check(
    'a round ending with a green sends nothing to the model',
    fake.received.length === 0,
    `${fake.received.length} calls`,
  )
  check(
    'and the fixed summary has no live story section',
    (await page.locator('.story-section').count()) === 0,
  )

  console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nAI DRIVE OK')
  if (fail.length) process.exitCode = 1
} catch (e) {
  console.log('AI DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  await casey.stop()
  await fake.stop()
  preview.stop()
  await source.close()
}
