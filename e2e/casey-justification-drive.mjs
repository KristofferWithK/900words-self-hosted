// Built client only: intercept fixture replies; never start a Worker or model.
// BASELINE=1 reinstates the original two-line clamp to prove the regression.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { THINK_MS, REVEAL_MS } from '../src/ui/aiBeats.ts'
import { holdNextClue } from './casey-justification-fixture.mjs'

// Retained pre-refinement prompt example, used ONLY for baseline clipping evidence.
// Replayed as presentation content, not evidence of association accuracy.
const baselineSentence = 'æble (apple) is literally a fruit; the nearest decoy is træ (tree), which is where fruit grows rather than a fruit'
const baseline = process.env.BASELINE === '1'
const output = resolve(process.env.SHOT_DIR ?? 'e2e-shots/casey-justification', baseline ? 'before' : 'refined')
mkdirSync(output, { recursive: true })
const evidence = []
let browser
let preview

// Text-node ranges include the hidden lines of a clamped paragraph. Checking
// DOM text or the dock rectangle alone would pass the original clipping bug.
function geometry() {
  const rect = (el) => el.getBoundingClientRect().toJSON()
  const panel = document.querySelector('.ai-panel[data-beat]')
  const bubble = panel.querySelector('.ai-bubble')
  const range = document.createRange()
  range.selectNodeContents(bubble)
  const text = [...range.getClientRects()].map((r) => r.toJSON())
  const box = rect(bubble)
  return {
    beat: panel.dataset.beat,
    sentence: bubble.textContent,
    bubble: box,
    text,
    clipped: text.some((r) => r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.right > box.right + 1),
    scrollHeight: bubble.scrollHeight,
    clientHeight: bubble.clientHeight,
    clamp: getComputedStyle(bubble).webkitLineClamp,
    panel: rect(panel),
    face: rect(panel.querySelector('.cluey-mini')),
    result: rect(panel.querySelector('.ai-guess-line')),
    board: rect(document.querySelector('.board-grid')),
    rows: getComputedStyle(document.querySelector('.board-grid')).gridTemplateRows.split(' ').map(parseFloat),
    cards: [...document.querySelectorAll('.word-card')].map(rect),
    documentHeight: document.scrollingElement.scrollHeight,
    viewportHeight: innerHeight,
    overflowers: [...document.querySelectorAll('body *')]
      .map((el) => ({
        tag: el.tagName,
        className: typeof el.className === 'string' ? el.className : '',
        ...el.getBoundingClientRect().toJSON(),
      }))
      .filter((r) => r.bottom > innerHeight + 1 || r.top < -1)
      .sort((a, b) => b.bottom - a.bottom)
      .slice(0, 12),
    hurry: panel.dataset.hurry,
    errorBanner: document.querySelector('.error-banner')?.textContent ?? null,
  }
}

function checkGeometry(g, dock, board, expected) {
  assert.equal(g.errorBanner, null, 'justification fixture keeps the following clue pending, without an error banner')
  assert.equal(g.sentence, expected)
  assert.equal(g.clipped, baseline, baseline ? 'baseline must reproduce hidden text' : 'full justification must fit')
  if (!baseline) assert.ok(g.scrollHeight <= g.clientHeight + 1, 'no vertical text clipping')
  assert.deepEqual(g.panel, dock, 'dock stays at composer rectangle')
  assert.deepEqual(g.board, board, 'board stays at composer rectangle')
  assert.ok(g.rows.every((height) => height >= 44), 'grid tracks retain 44px floor')
  assert.ok(g.cards.every((r) => r.height >= 44 && r.bottom <= g.panel.top), 'cards clear dock')
  assert.ok(g.bubble.top >= g.panel.top && g.bubble.bottom <= g.result.top, 'sentence clears result')
  assert.ok(g.face.right <= g.bubble.left && g.face.top >= g.panel.top, 'sentence clears face')
  assert.ok(g.face.bottom <= g.result.top && g.result.bottom <= g.panel.bottom, 'face and result fit dock')
  assert.ok(g.documentHeight <= g.viewportHeight, 'no document scrolling')
}

try {
  // Launch first so a sandbox browser failure does not orphan a preview server.
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
  preview = await startPreview(4289)
  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    // Authored replies deliberately take the legacy queue path even in the
    // normal assisted build. An OFF build can additionally use EXPECT_LEGACY=1.
    for (const scenario of (baseline ? ['green', 'authored'] : ['green', 'miss', 'single', 'authored'])) {
      const arm = scenario === 'authored' ? 'authored' : 'cluey'
      const label = `${viewport.width}x${viewport.height}-${scenario}`
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
      const page = await context.newPage()
      // The café gate is on (CW-13): this drive's board needs its first café found.
      await page.addInitScript(mergeFirstCafe, seedArgs('da'))
      await page.clock.install()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await installRoundGuidanceHandler(page)
      await page.addInitScript(() => {
        localStorage.setItem('cluecab-settings-v1', JSON.stringify({
          state: { baseUrl: 'https://casey.invalid/v1', clueLanguage: 'en', studyPhase: 'never', useMock: false, sound: false },
          version: 13,
        }))
      })
      let selected
      let rejected
      let sentence
      let alternateName
      const requests = []
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.hostname === 'casey.invalid' && url.pathname.endsWith('/casey/decision')) {
          const body = route.request().postDataJSON()
          requests.push(body)
          if (body.operation === 'guess') {
            assert.equal(body.candidateMode, process.env.EXPECT_LEGACY === '1' ? undefined : 'top-two')
            const selectedRow = { wordId: selected, confidence: 0.9, reasoning: sentence }
            const otherRow = { wordId: rejected, confidence: 0.1, reasoning: 'Another everyday association.' }
            // Both authored rows are green: a finite plan, never a runner-up.
            // Green model case exercises the existing second-green rescue.
            const guesses = scenario === 'single' ? [selectedRow]
              : scenario === 'green' ? [otherRow, selectedRow] : [selectedRow, otherRow]
            await route.fulfill({ json: {
              protocol: 1,
              report: { arm, refused: false },
              decision: { guesses },
            } })
          } else {
            // The next AI clue is deliberately left waiting, with no external call.
            assert.equal(body.operation, 'clue')
            await holdNextClue(route, context)
          }
          return
        }
        if (url.origin === new URL(preview.base).origin || ['data:', 'blob:'].includes(url.protocol)) {
          await route.continue()
        } else {
          errors.push(`Unexpected external request: ${url.origin}`)
          await route.abort()
        }
      })
      await page.goto(`${preview.base}?howto=0&first=player&seed=9`)
      if (baseline) await page.addStyleTag({ content: '.ai-bubble { -webkit-line-clamp: 2; }' })
      await page.locator('.home-play').click()
      await page.waitForSelector('.clue-input')
      const game = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game)
      const greens = game.words.filter((w) => game.playerKey[w.wordId] === 'green')
      const neutrals = game.words.filter((w) => game.playerKey[w.wordId] === 'bystander')
      const chosen = scenario === 'miss' || scenario === 'single' ? neutrals[0] : greens[0]
      const other = scenario === 'authored' ? greens[1] : neutrals[scenario === 'miss' ? 1 : 0]
      selected = chosen.wordId
      rejected = other.wordId
      alternateName = other.da
      // Scripted public-word presentation fixtures, not live model evidence.
      sentence = baseline ? baselineSentence : `${chosen.da} (${chosen.en[0]}) makes me think of everyday life.`
      assert.ok(selected && rejected)

      const dock = await page.locator('.clue-input').evaluate((el) => el.getBoundingClientRect().toJSON())
      const board = await page.locator('.board-grid').evaluate((el) => el.getBoundingClientRect().toJSON())
      await page.locator('#clue-word').fill('hverdag')
      await page.locator('.clue-input .btn-primary').click()
      await page.waitForSelector('.ai-panel[data-beat="think"]', { timeout: 10000 })
      // Freeze only after the actual provider/queue path has produced the DOM.
      // Browser clock controls the existing timers; production pacing is untouched.
      await page.clock.pauseAt(new Date())
      const think = await page.evaluate(geometry)
      writeFileSync(resolve(output, `${label}-think.json`), JSON.stringify(think, null, 2))
      await page.screenshot({ path: resolve(output, `${label}-think.png`) })
      checkGeometry(think, dock, board, sentence)
      assert.ok(!think.sentence.includes('My second choice'))
      assert.equal(think.hurry, '1', 'whole dock remains the hurry target')
      if (viewport.width === 390) {
        await page.locator('.ai-panel').click()
      } else {
        // Locate the automatic reveal edge to within 10ms, without changing
        // the timers or racing screenshots against the two-second preview.
        let elapsed = 0
        while (await page.locator('.ai-panel[data-beat="think"]').count()) {
          assert.ok(elapsed <= THINK_MS, 'existing think timer advances the guess')
          await page.clock.runFor(10)
          elapsed += 10
        }
      }
      await page.waitForSelector('.ai-panel[data-beat="reveal"]')
      const reveal = await page.evaluate(geometry)
      writeFileSync(resolve(output, `${label}-reveal.json`), JSON.stringify(reveal, null, 2))
      await page.screenshot({ path: resolve(output, `${label}-reveal.png`) })
      const expectedReveal = scenario === 'miss' && process.env.EXPECT_LEGACY !== '1'
        ? `${sentence} My second choice would have been ${alternateName}.` : sentence
      checkGeometry(reveal, dock, board, expectedReveal)
      const history = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game.clueHistory)
      const guesses = history.findLast((turn) => turn.by === 'player').guesses
      assert.equal(guesses.length, 1)
      assert.equal(guesses[0].wordId, selected)
      assert.equal(guesses[0].result, ['miss', 'single'].includes(scenario) ? 'bystander' : 'green')
      assert.equal(guesses[0].reasoning, sentence)
      await page.clock.runFor(REVEAL_MS - 11)
      assert.equal(await page.locator('.ai-panel[data-beat="reveal"]').count(), 1, 'reveal held for existing duration')
      await page.clock.runFor(11)
      assert.equal(await page.locator('.ai-panel[data-beat="reveal"]').count(), 0, 'reveal ends on existing timer')
      assert.deepEqual(errors, [])
      evidence.push({ label, arm, interaction: viewport.width === 390 ? 'tap' : 'timer', think, reveal, guesses, guessRequests: requests.filter((r) => r.operation === 'guess').length })
      writeFileSync(resolve(output, 'geometry.json'), JSON.stringify(evidence, null, 2))
      console.log(`OK ${label}: ${sentence.length} characters, ${think.clientHeight}/${think.scrollHeight}px, clamp ${think.clamp}`)
      await context.close()
    }
  }
} finally {
  await browser?.close()
  preview?.stop()
}
