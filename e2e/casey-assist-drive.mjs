// Focused Casey top-two smoke: built app + real Worker + scripted fake provider.
// This measures integration and presentation, never live-model accuracy.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startFakeOllama } from './fake-ollama.mjs'
import { startWorker } from './worker-runtime.mjs'
import { REVEAL_MS, THINK_MS } from '../src/ui/aiBeats.ts'
import { audioSlug } from '../scripts/audio-slug.mjs'

// Keep this in sync with speak.ts without importing the browser-side module:
// Node's direct drive loader cannot resolve that module's extensionless TS
// dependencies. This is the maximum article lead-in before the word starts.
const ARTICLE_MAX_MS = 1_200

const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const preview = await startPreview(4286)
const fake = await startFakeOllama(4287 + OFFSET)
const casey = await startWorker(4288 + OFFSET, {
  upstream: fake.baseUrl,
  apiKey: 'scripted-fixture-key',
  bundler: 'rolldown',
  vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'scripted-fixture-model' } }) },
})
if (!casey) throw new Error('Miniflare is required for casey-assist-drive')

const outputDir = resolve('.hermes', 'casey-assist-smoke')
mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
})
const forbiddenOrigins = []
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname === '127.0.0.1' || ['data:', 'blob:'].includes(url.protocol)) {
    await route.continue()
    return
  }
  forbiddenOrigins.push(url.origin)
  await route.abort('blockedbyclient')
})
await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
const page = await context.newPage()
await installRoundGuidanceHandler(page)
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
await page.addInitScript(({ baseUrl }) => {
  window.__caseyAudio = []
  window.addEventListener('cluecab-audio', (event) => window.__caseyAudio.push(event.detail))
  localStorage.setItem('cluecab-settings-v1', JSON.stringify({
    state: { baseUrl, clueLanguage: 'en', studyPhase: 'never', useMock: false, sound: true },
    version: 13,
  }))
}, { baseUrl: `${casey.base}/v1` })

const checks = []
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail })
const savedGame = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game,
)

// A selected noun says its article first. The player-facing event reports the
// final word start, which is the observable this drive cares about; waiting for
// it keeps the assertion about each applied Casey guess rather than racing the
// intentional article chain.
const selectedWordAudioCount = (audio, wordId) => audio.filter((entry) => {
  const url = String(entry?.url ?? '')
  const slug = audioSlug(wordId.slice(3))
  // A City 1 noun is one phrase clip («et hus» → phrase/et-hus.mp3).
  return !url.includes('/article/') && (url.includes(`/${slug}.mp3`) || (url.includes('/phrase/') && url.endsWith(`-${slug}.mp3`)))
}).length

async function freshRound(seed) {
  await page.goto(`${preview.base}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(`${preview.base}?howto=0&first=player&seed=${seed}`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  const game = await savedGame()
  const greens = Object.entries(game.playerKey).filter(([, role]) => role === 'green').map(([id]) => id)
  const bystanders = Object.entries(game.playerKey).filter(([, role]) => role === 'bystander').map(([id]) => id)
  return {
    game,
    greens,
    bystanders,
    da: Object.fromEntries(game.words.map((word) => [word.wordId, word.da])),
  }
}

const answer = (rows, delayMs = 0) => ({
  delayMs,
  json: { guesses: rows.map(([wordId, confidence, reasoning]) => ({ wordId, confidence, reasoning })) },
})

async function runScenario(label, seed, nextDelayMs) {
  fake.reset()
  const round = await freshRound(seed)
  const [green1, green2] = round.greens
  const [rejected1, rejected2, finalBystander, finalAlternative] = round.bystanders
  const selected = [green1, green2, finalBystander]
  const reasons = selected.map((id, index) => `selected-${index + 1} connects ${round.da[id]} to the clue.`)
  fake.queue(
    answer([
      [rejected1, 0.99, `rejected-first names ${round.da[rejected1]}.`],
      [green1, 0.2, reasons[0]],
    ]),
    answer([
      [green2, 0.15, reasons[1]],
      [rejected2, 0.98, `rejected-second names ${round.da[rejected2]}.`],
    ], nextDelayMs),
    answer([
      [finalBystander, 0.7, reasons[2]],
      [finalAlternative, 0.6, `final alternative names ${round.da[finalAlternative]}.`],
    ], nextDelayMs),
  )

  await page.evaluate(() => {
    window.__caseyAudio = []
    window.__assistFrames = []
    window.__assistTimer = setInterval(() => {
      const panel = document.querySelector('.dock.ai-panel')
      const saved = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
      const playerClue = [...(saved?.clueHistory ?? [])].reverse().find((clue) => clue.by === 'player')
      const guesses = playerClue?.guesses ?? []
      const frame = {
        at: Date.now(),
        beat: panel?.dataset?.beat ?? null,
        bubble: (panel?.querySelector('.ai-bubble')?.textContent ?? '').trim(),
        line: (panel?.querySelector('.ai-guess-line')?.textContent ?? '').trim(),
        history: guesses.map((guess) => ({
          wordId: guess.wordId,
          confidence: guess.confidence,
          reasoning: guess.reasoning,
          result: guess.result,
        })),
        turnsLeft: saved?.turnsLeft,
      }
      const last = window.__assistFrames.at(-1)
      if (!last || JSON.stringify({ ...last, at: 0 }) !== JSON.stringify({ ...frame, at: 0 })) {
        window.__assistFrames.push(frame)
      }
    }, 20)
  })

  await page.getByRole('button', { name: 'more words' }).click()
  await page.locator('#clue-word').fill('huskeliste')
  await page.locator('.clue-input .btn-primary').click()
  await page.waitForFunction(() => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    return (game?.clueHistory?.at(-1)?.guesses?.length ?? 0) >= 3
  }, null, { timeout: 20_000 })
  // Nouns speak their short article clip before the word itself. Wait for the
  // final selected-word event, not a preload/network observation.
  await sleep(selected.length * (ARTICLE_MAX_MS + 1_000))
  const observed = await page.evaluate(() => {
    clearInterval(window.__assistTimer)
    return { frames: window.__assistFrames, audio: window.__caseyAudio }
  })
  const game = await savedGame()
  const history = [...game.clueHistory].reverse().find((clue) => clue.by === 'player').guesses
  const revealFrames = observed.frames.filter((frame) => frame.beat === 'reveal' && /«[^»]+»/.test(frame.line))
  const revealWords = []
  for (const frame of revealFrames) {
    const da = frame.line.match(/«([^»]+)»/)?.[1]
    if (da && revealWords.at(-1) !== da) revealWords.push(da)
  }
  const revealHolds = revealFrames.map((frame) => {
    const next = observed.frames.find((candidate) => candidate.at > frame.at &&
      (candidate.beat !== 'reveal' || candidate.line !== frame.line))
    return (next?.at ?? observed.frames.at(-1)?.at ?? frame.at) - frame.at
  })
  const maxHistoryJump = observed.frames.reduce((max, frame, index) =>
    Math.max(max, frame.history.length - (observed.frames[index - 1]?.history.length ?? 0)), 0)
  const guessRequests = fake.received.filter((request) => /You are the GUESSER/.test(request.raw))
  const visibleText = observed.frames.map((frame) => `${frame.bubble}\n${frame.line}`).join('\n')

  check(`${label}: strict second-green rescue ignores reversed confidence`, history[0]?.wordId === green1,
    history.map((guess) => guess.wordId).join(' -> '))
  check(`${label}: sequential history records only selected rows`,
    JSON.stringify(history.slice(0, 3).map((guess) => guess.wordId)) === JSON.stringify(selected),
    history.map((guess) => guess.wordId).join(' -> '))
  check(`${label}: selected reasoning/confidence stay with each actual guess`,
    history.slice(0, 3).every((guess, index) => guess.reasoning === reasons[index] &&
      guess.confidence === [0.2, 0.15, 0.7][index]))
  check(`${label}: every reveal remains visible and ordered`,
    JSON.stringify(revealWords.slice(0, 3)) === JSON.stringify(selected.map((id) => round.da[id])),
    revealWords.join(' -> '))
  check(`${label}: a ready next plan cannot preempt the complete reveal hold`,
    revealHolds.slice(0, 2).length === 2 && revealHolds.slice(0, 2).every((ms) => ms >= 1000),
    revealHolds.join(', '))
  check(`${label}: each visible reveal carries its own reasoning`,
    revealFrames.every((frame) => {
      const index = selected.findIndex((id) => frame.line.includes(round.da[id]))
      return index < 0 || frame.bubble === (index === 2
        ? `${reasons[index]} My second choice would have been ${round.da[finalAlternative]}.` : reasons[index])
    }))
  check(`${label}: no second-choice sentence before a reveal`,
    observed.frames.filter((frame) => frame.beat === 'think').every((frame) => !frame.bubble.includes('My second choice')))
  check(`${label}: rejected candidate stays hidden and absent from presentation`,
    game.reveals[rejected1]?.kind === 'hidden' && !visibleText.includes(`rejected-first names ${round.da[rejected1]}`))
  check(`${label}: fresh top-two request follows the first green`,
    guessRequests.length >= 3 && /public history shows 1 guess\(es\) already made/.test(guessRequests[1].raw),
    `${guessRequests.length} guess requests`)
  check(`${label}: one guess is applied per observed step`, maxHistoryJump <= 1, `max jump ${maxHistoryJump}`)
  check(`${label}: clue above two continues without spending a token on greens`,
    observed.frames.some((frame) => frame.history.length === 2 && frame.turnsLeft === round.game.turnsLeft))
  const turnEndFrame = observed.frames.find((frame) => frame.history.length === 3)
  check(`${label}: one bystander ends the turn with one token spent`,
    history[2]?.result === 'bystander' && turnEndFrame?.turnsLeft === round.game.turnsLeft - 1)
  const played = selected.map((id) => selectedWordAudioCount(observed.audio, id))
  check(`${label}: each applied guess reaches its final word audio once`,
    played.every((count) => count === 1), `${played.join(', ')} word events`)

  await page.screenshot({ path: resolve(outputDir, `${label}.png`), fullPage: true })
  return { label, nextDelayMs, selected, rejected: rejected1, revealWords, revealHolds, history, audio: observed.audio, guessRequests: guessRequests.length }
}

async function runHeldRevealHurryScenario(seed) {
  const label = 'held-reveal-tap-to-hurry'
  fake.reset()
  const round = await freshRound(seed)
  const [green1, green2] = round.greens
  const [rejected1, rejected2] = round.bystanders
  const firstReason = `hurry-first names ${round.da[green1]}.`
  const nextReason = `hurry-next names ${round.da[green2]}.`
  fake.queue(
    answer([
      [rejected1, 0.99, `hurry rejected-first names ${round.da[rejected1]}.`],
      [green1, 0.2, firstReason],
    ]),
    answer([
      [green2, 0.15, nextReason],
      [rejected2, 0.98, `hurry rejected-second names ${round.da[rejected2]}.`],
    ]),
  )

  await page.evaluate(() => {
    window.__caseyAudio = []
    window.__hurryFrames = []
    window.__hurryTimer = setInterval(() => {
      const panel = document.querySelector('.dock.ai-panel')
      const saved = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
      const playerClue = [...(saved?.clueHistory ?? [])].reverse().find((clue) => clue.by === 'player')
      const frame = {
        at: performance.now(),
        beat: panel?.dataset?.beat ?? null,
        hurry: panel?.dataset?.hurry ?? null,
        bubble: (panel?.querySelector('.ai-bubble')?.textContent ?? '').trim(),
        line: (panel?.querySelector('.ai-guess-line')?.textContent ?? '').trim(),
        history: (playerClue?.guesses ?? []).map((guess) => ({
          wordId: guess.wordId,
          reasoning: guess.reasoning,
          result: guess.result,
        })),
      }
      const last = window.__hurryFrames.at(-1)
      if (!last || JSON.stringify({ ...last, at: 0 }) !== JSON.stringify({ ...frame, at: 0 })) {
        window.__hurryFrames.push(frame)
      }
    }, 10)
  })

  await page.getByRole('button', { name: 'more words' }).click()
  await page.locator('#clue-word').fill('hastetest')
  await page.locator('.clue-input .btn-primary').click()

  const heldReady = page.locator('.ai-panel[data-beat="reveal"][data-hurry="1"]')
  await heldReady.waitFor({ state: 'visible', timeout: THINK_MS + REVEAL_MS + 10_000 })
  await page.waitForFunction(({ firstId }) => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return clue?.guesses?.length === 1 && clue.guesses[0]?.wordId === firstId
  }, { firstId: green1 })

  const beforeTap = await page.evaluate(({ firstId, nextId }) => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return {
      at: performance.now(),
      beat: document.querySelector('.ai-panel')?.dataset?.beat ?? null,
      hurry: document.querySelector('.ai-panel')?.dataset?.hurry ?? null,
      history: clue?.guesses?.map((guess) => guess.wordId) ?? [],
      firstAudio: window.__caseyAudio.filter((entry) => String(entry?.url ?? '').includes(firstId.slice(3))).length,
      nextAudio: window.__caseyAudio.filter((entry) => String(entry?.url ?? '').includes(nextId.slice(3))).length,
    }
  }, { firstId: green1, nextId: green2 })

  await heldReady.click()
  const tapAdvanced = await page.waitForFunction(({ reasoning }) => {
    const panel = document.querySelector('.ai-panel[data-beat="think"]')
    return panel?.querySelector('.ai-bubble')?.textContent?.trim() === reasoning
  }, { reasoning: nextReason }, { timeout: 500 }).then(() => true, () => false)
  const afterTap = await page.evaluate(({ nextId }) => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return {
      at: performance.now(),
      beat: document.querySelector('.ai-panel')?.dataset?.beat ?? null,
      bubble: document.querySelector('.ai-panel .ai-bubble')?.textContent?.trim() ?? '',
      history: clue?.guesses?.map((guess) => guess.wordId) ?? [],
      nextAudio: window.__caseyAudio.filter((entry) => String(entry?.url ?? '').includes(nextId.slice(3))).length,
    }
  }, { nextId: green2 })

  check(`${label}: held reveal exposes a ready eligible hurry target`,
    beforeTap.beat === 'reveal' && beforeTap.hurry === '1' && JSON.stringify(beforeTap.history) === JSON.stringify([green1]))
  check(`${label}: real tap ends the hold on the next selected explanation`,
    tapAdvanced && afterTap.beat === 'think' && afterTap.bubble === nextReason,
    `${afterTap.beat}: ${afterTap.bubble}`)
  check(`${label}: tap itself commits no guess or selected-word audio`,
    JSON.stringify(afterTap.history) === JSON.stringify([green1]) && afterTap.nextAudio === 0,
    `${afterTap.history.join(' -> ')}; audio ${afterTap.nextAudio}`)
  if (!tapAdvanced) {
    const frames = await page.evaluate(() => {
      clearInterval(window.__hurryTimer)
      return window.__hurryFrames
    })
    await page.screenshot({ path: resolve(outputDir, `${label}.png`), fullPage: true })
    return { label, selected: [green1, green2], beforeTap, afterTap, frames }
  }

  const oldHoldDeadline = beforeTap.at + REVEAL_MS
  await page.waitForTimeout(REVEAL_MS + 120)
  const pastOldHold = await page.evaluate(() => ({
    at: performance.now(),
    beat: document.querySelector('.ai-panel')?.dataset?.beat ?? null,
    bubble: document.querySelector('.ai-panel .ai-bubble')?.textContent?.trim() ?? '',
  }))

  await page.waitForFunction(({ secondId }) => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return clue?.guesses?.length === 2 && clue.guesses[1]?.wordId === secondId
  }, { secondId: green2 }, { timeout: THINK_MS + 2_000 })
  // The second selected word can be a noun, so its final word event follows
  // the article. Count only after that event has actually started.
  await sleep(ARTICLE_MAX_MS + 1_000)
  const committed = await page.evaluate(({ secondId }) => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return {
      at: performance.now(),
      history: clue?.guesses?.map((guess) => ({ wordId: guess.wordId, reasoning: guess.reasoning, result: guess.result })) ?? [],
      nextAudio: window.__caseyAudio.filter((entry) => !String(entry?.url ?? '').includes('/article/') && String(entry?.url ?? '').includes(secondId.slice(3))).length,
    }
  }, { secondId: green2 })
  await sleep(250)
  const observed = await page.evaluate(({ secondId }) => {
    clearInterval(window.__hurryTimer)
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game
    const clue = [...(game?.clueHistory ?? [])].reverse().find((entry) => entry.by === 'player')
    return {
      frames: window.__hurryFrames,
      history: clue?.guesses?.map((guess) => ({ wordId: guess.wordId, reasoning: guess.reasoning, result: guess.result })) ?? [],
      nextAudio: window.__caseyAudio.filter((entry) => !String(entry?.url ?? '').includes('/article/') && String(entry?.url ?? '').includes(secondId.slice(3))).length,
    }
  }, { secondId: green2 })
  const thinkElapsed = committed.at - afterTap.at

  check(`${label}: cleared reveal timer leaves next THINK intact past its old deadline`,
    pastOldHold.beat === 'think' && pastOldHold.bubble === nextReason &&
      pastOldHold.at >= oldHoldDeadline && pastOldHold.at < afterTap.at + THINK_MS,
    `${pastOldHold.beat} at ${Math.round(pastOldHold.at - afterTap.at)}ms`)
  check(`${label}: next selected word waits its normal THINK interval`,
    thinkElapsed >= THINK_MS - 120,
    `${Math.round(thinkElapsed)}ms (target ${THINK_MS}ms)`)
  check(`${label}: matching reasoning and word commit once in actual history`,
    observed.history.length === 2 && observed.history[1]?.wordId === green2 && observed.history[1]?.reasoning === nextReason,
    observed.history.map((guess) => `${guess.wordId}:${guess.reasoning}`).join(' | '))
  check(`${label}: hurry causes no duplicate selected-word speech`,
    committed.nextAudio === 1 && observed.nextAudio === 1,
    `${committed.nextAudio} at commit; ${observed.nextAudio} after settle`)

  await page.screenshot({ path: resolve(outputDir, `${label}.png`), fullPage: true })
  return {
    label,
    timing: { THINK_MS, REVEAL_MS, thinkElapsed, oldHoldDeadline, tapAt: afterTap.at },
    selected: [green1, green2],
    beforeTap,
    afterTap,
    pastOldHold,
    committed,
    frames: observed.frames,
  }
}

let scenarios = []
let fatal = null
try {
  scenarios = [
    await runScenario('immediate-next-reply', 7301, 0),
    await runScenario('delayed-next-reply', 7302, 650),
    await runHeldRevealHurryScenario(7303),
  ]
  check('browser made no external-origin request', forbiddenOrigins.length === 0, [...new Set(forbiddenOrigins)].join(', '))
  check('page raised no uncaught error', pageErrors.length === 0, pageErrors.join(' | '))
} catch (error) {
  fatal = error instanceof Error ? error.stack ?? error.message : String(error)
  await page.screenshot({ path: resolve(outputDir, 'failure.png'), fullPage: true }).catch(() => {})
} finally {
  await context.tracing.stop({ path: resolve(outputDir, 'trace.zip') }).catch(() => {})
  const result = {
    label: 'built app + real Worker + scripted fake provider; not live model accuracy',
    ok: !fatal && checks.every((entry) => entry.ok),
    fatal,
    checks,
    scenarios,
    forbiddenOrigins: [...new Set(forbiddenOrigins)],
    pageErrors,
  }
  writeFileSync(resolve(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  for (const entry of checks) console.log(`${entry.ok ? 'OK  ' : 'FAIL'} ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`)
  if (fatal) console.error(fatal)
  if (!result.ok) process.exitCode = 1
  await browser.close()
  await casey.stop()
  await fake.stop()
  preview.stop()
  if (!result.ok) process.exitCode = 1
}
