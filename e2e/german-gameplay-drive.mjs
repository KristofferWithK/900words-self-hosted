// Built app + Wrangler's actual Worker bundle + a scripted model provider.
// This proves gameplay integration and request boundaries, not model quality.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { startWorker } from './worker-runtime.mjs'
import { startFakeOllama, clueReply, guessReply } from './fake-ollama.mjs'
import { installRoundGuidanceHandler, dismissRoundGuidance } from './round-guidance.mjs'

const offset = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const preview = await startPreview(4350)
const fake = await startFakeOllama(4351 + offset)
let worker, browser
const failures = []
const decisions = []
const audio = []
let playerGreens = []
let modelCalls = 0
const started = Date.now()
mkdirSync('evidence', { recursive: true })
try {
  worker = await startWorker(4352 + offset, { upstream: fake.baseUrl, apiKey: 'fixture-key' })
  assert.ok(worker, 'the real Worker runtime is required')
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && !['data:', 'blob:'].includes(url.protocol)) {
      failures.push(`unexpected external request: ${url.origin}`)
      return route.abort()
    }
    if (url.pathname.includes('/audio/')) audio.push(url.pathname)
    if (url.pathname.endsWith('/casey/decision')) decisions.push(route.request().postDataJSON())
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  page.on('response', response => {
    if (response.url().includes('/audio/de/') && response.status() !== 200) {
      failures.push(`German audio HTTP ${response.status()}: ${new URL(response.url()).pathname}`)
    }
  })
  await installRoundGuidanceHandler(page)
  await page.addInitScript(({ baseUrl }) => {
    localStorage.setItem('cluecab-language', 'de')
    localStorage.setItem('cluecab-settings-v1', JSON.stringify({ version: 13, state: {
      baseUrl, clueLanguage: 'target', studyPhase: 'never', useMock: false, sound: true,
    } }))
  }, { baseUrl: `${worker.base}/v1` })
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game)
  await page.goto(`${preview.base}?howto=0&first=player&seed=german-release`)
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const first = await saved()
  assert.equal(first.words.length, 18)
  assert.ok(first.words.every(word => word.wordId.startsWith('de:')))
  playerGreens = Object.keys(first.playerKey).filter(id => first.playerKey[id] === 'green')

  const respond = request => {
    modelCalls++
    const prompt = request.messages.map(message => message.content).join('\n')
    assert.match(prompt, /German/)
    assert.doesNotMatch(prompt, /Write Danish/)
    const rows = [...prompt.matchAll(/^(de:\S+) \| .+? \| ([A-Za-z ]+?)(?: \| my key: (\w+))?(?: \|.*)?$/gm)]
    if (/You are the GUESSER/.test(prompt)) {
      assert.doesNotMatch(prompt, /my key:|playerGreenIds/)
      const open = rows.filter(row => /hidden|unrevealed/i.test(row[2])).map(row => row[1])
      return guessReply(open.filter(id => playerGreens.includes(id)).slice(0, 2))
    }
    const greens = rows.filter(row => /GREEN/i.test(row[3] ?? '') && /hidden|unrevealed/i.test(row[2])).map(row => row[1])
    return clueReply(greens.slice(0, 2), 'Astronaut')
  }
  fake.queue(...Array.from({ length: 60 }, () => respond))
  await page.screenshot({ path: 'evidence/german-gameplay-board.png' })
  for (let action = 0; action < 80; action++) {
    await dismissRoundGuidance(page)
    const game = await saved()
    if (game.phase === 'finished') break
    if (game.phase === 'playerClueInput') {
      await page.locator('#clue-word').fill('Horizont')
      await page.locator('.clue-input .btn-primary').click()
    } else if (game.phase === 'playerGuessing' || game.phase === 'suddenDeath') {
      const id = Object.keys(game.aiKey).find(id => game.aiKey[id] === 'green' && game.reveals[id].kind !== 'green')
      assert.ok(id, 'there is a remaining target')
      await page.locator('.word-card').nth(game.words.findIndex(word => word.wordId === id)).click()
      await page.locator('.guess-confirm .btn-primary').click()
    } else if (game.phase === 'translateChallenge' && game.wheel) {
      const id = game.wheel.segments.find(wordId => !game.wheel.translated.includes(wordId))
      if (id) {
        const answer = game.words.find(word => word.wordId === id)?.da
        assert.ok(answer, `translation target ${id} is on the board`)
        await page.locator('.translate-challenge-bar .wheel-input').fill(answer)
        await page.locator('.translate-challenge-bar .wheel-confirm').click()
      }
    } else if (game.phase === 'translateWheel') {
      await page.locator('.translate-challenge-bar .wheel-disc').click()
    }
    await sleep(500)
    assert.ok(Date.now() - started < 180_000, 'round makes progress within three minutes')
  }
  const done = await saved()
  assert.equal(done.phase, 'finished', JSON.stringify({ phase: done.phase, decisions: decisions.length }))
  assert.equal(done.outcome.result, 'won')
  assert.ok(modelCalls > 0)
  assert.ok(decisions.some(request => request.operation === 'clue'))
  assert.ok(decisions.some(request => request.operation === 'guess'))
  assert.ok(decisions.every(request => request.language === 'de'))
  const germanCity1Audio = audio.filter(path => path.includes('/audio/de/'))
  assert.ok(germanCity1Audio.some(path => /\/audio\/de\/city1-leda-v1\/word\/(?:slow\/)?[a-z0-9-]+\.mp3$/.test(path)), `German bare playback requests a versioned Leda word clip: ${JSON.stringify(germanCity1Audio)}`)
  assert.ok(germanCity1Audio.some(path => /\/audio\/de\/city1-leda-v1\/phrase\/(?:slow\/)?[a-z0-9-]+\.mp3$/.test(path)), `German noun playback requests a continuous versioned Leda phrase: ${JSON.stringify(germanCity1Audio)}`)
  assert.ok(!germanCity1Audio.some(path => /\/audio\/de\/article\/(?:der|die|das)\.mp3$/.test(path)), `a German article must not be requested as a separate clip: ${JSON.stringify(germanCity1Audio)}`)
  assert.ok(germanCity1Audio.every(path => /\/audio\/de\/city1-leda-v1\/(?:word|phrase)\//.test(path)), `German board audio must stay on the versioned City 1 Leda paths: ${JSON.stringify(germanCity1Audio)}`)
  assert.ok(!audio.some(path => /\/audio\/de\/(?:example|survival|task)\//.test(path)), 'deferred German audio is not requested')
  assert.deepEqual(failures, [])
  await page.screenshot({ path: 'evidence/german-gameplay-finished.png' })
  writeFileSync('evidence/german-gameplay.json', JSON.stringify({
    scope: 'Wrangler/workerd integration with scripted model replies',
    board: decisions[0].view.boardId, outcome: done.outcome, modelCalls, requests: decisions.length,
    germanAudioRequests: audio.filter(path => path.includes('/audio/de/')), failures,
  }, null, 2) + '\n')
  console.log('PASS German round: 18 cards, both Casey roles, won, German word audio requested, no browser errors')
} finally {
  await browser?.close()
  await worker?.stop()
  await fake.stop()
  await preview.stop()
}
