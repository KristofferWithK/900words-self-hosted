// The café puzzle on the real board (card CW-08; docs/roadmap/cafe-world.md
// section 5): coffee cups for the turn dots, the café's name on a tag where
// the phase caption stood, faint pencil items on the table behind the cards,
// and Casey large while she thinks.
//
// Built app + a scripted Casey transport: every external origin is blocked and
// Casey's decisions are answered locally (as round-opening-guidance-drive
// does), so no Worker and no paid call is involved. It plays the first
// required board (Café Solen) through every turn state at 390x844 and 360x640
// and asserts, per state:
//   - the café chrome moves no card: card rects with the café chrome reverted
//     to the pre-café geometry (dots, caption, small Casey, no table) are
//     identical to the rects with it;
//   - no table item, and no edge SPOT any café could use, touches a card's
//     text, a ⓘ, a button, the header text or the dock's text and controls;
//   - the header fits, and every one of the 100 café names fits its tag;
//   - bottom items show only while Casey thinks; edge items hide with the
//     keyboard; the page never scrolls.
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const preview = await startPreview(4338)
const previewOrigin = new URL(preview.base).origin
const caseyBaseUrl = new URL('/v1', previewOrigin).href
const decisionUrl = `${caseyBaseUrl}/casey/decision`
const output = resolve(process.env.SHOT_DIR ?? 'e2e-shots', 'cafe-puzzle')
mkdirSync(output, { recursive: true })
const CAFE_NAMES = JSON.parse(readFileSync(resolve(ROOT, 'src/data/city1-cafe-names.da.json'), 'utf8')).names.map((n) => n.name)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const failures = []
const errors = []
const check = (label, pass, detail = '') => {
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures.push(label)
}
let context, page
let holdGuess = false
let releaseGuess = null
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state)

async function newProfile(viewport) {
  await context?.close()
  context = await browser.newContext({ viewport, serviceWorkers: 'block' })
  page = await context.newPage()
  // The café gate is on (CW-13): this drive's board needs its first café found.
  await page.addInitScript(mergeFirstCafe, seedArgs('da'))
  page.on('pageerror', (error) => errors.push(error.message))
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== previewOrigin) return route.abort('blockedbyclient')
    if (url.href === decisionUrl) {
      const request = route.request().postDataJSON()
      const { game } = await saved()
      let decision
      if (request.operation === 'clue') {
        const targets = game.words.filter((w) => game.aiKey[w.wordId] === 'green' && game.reveals[w.wordId].kind !== 'green').slice(0, 2).map((w) => w.wordId)
        decision = { clue: 'togetherness', number: targets.length, targetWordIds: targets, rationale: 'scripted' }
      } else if (request.operation === 'guess') {
        if (holdGuess) await new Promise((done) => { releaseGuess = done })
        const word = game.words.find((w) => game.playerKey[w.wordId] === 'bystander' && game.reveals[w.wordId].kind === 'hidden')
        decision = { guesses: [{ wordId: word.wordId, confidence: 0.9, reasoning: 'A scripted association.' }] }
      } else throw new Error(`Unexpected decision request: ${request.operation}`)
      return route.fulfill({ json: { protocol: 1, decision, report: { arm: 'scripted', refused: false } } })
    }
    return route.continue()
  })
  await page.addInitScript((baseUrl) => {
    if (!localStorage.getItem('cluecab-settings-v1')) {
      localStorage.setItem('cluecab-settings-v1', JSON.stringify({ version: 17, state: {
        baseUrl, studyPhase: 'never', clueLanguage: 'en', sound: false, usageStats: false,
      } }))
    }
    localStorage.setItem('cluecab-ui-language', 'en')
  }, caseyBaseUrl)
  // A durable primary-slot fixture, as round-opening-guidance-drive writes it.
  await page.addInitScript(() => {
    try {
      const queued = sessionStorage.getItem('__cafe-puzzle-fixture')
      if (queued) {
        const fixture = JSON.parse(queued)
        localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
        localStorage.setItem('cluecab-game-v1', fixture.cache)
        sessionStorage.removeItem('__cafe-puzzle-fixture')
      }
    } catch { /* no session storage */ }
    window.__cafePuzzleFixture = (raw) => {
      const stored = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
      const sessions = stored?.state?.byCourse?.da
      if (!sessions?.primary || sessions.activeSlot !== 'primary') throw new Error('no active primary slot')
      sessions.primary.game = raw.state.game
      sessionStorage.setItem('__cafe-puzzle-fixture', JSON.stringify({ sessions: JSON.stringify(stored), cache: JSON.stringify(raw) }))
    }
  })
}

async function dismissGuidance() {
  const dialog = page.locator('dialog.round-guidance-dialog[open]')
  for (let i = 0; i < 3 && (await dialog.count()); i++) {
    await dialog.locator('button').last().click()
    await page.waitForTimeout(150)
  }
}

/** Everything a state is judged on, read in the page. */
const read = () => page.evaluate(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }
  const shown = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('.visually-hidden, [hidden]') }
  const all = (sel) => [...document.querySelectorAll(sel)].filter(shown)
  const keepClear = [
    ...all('.card-da, .card-word, .card-lid-word, .card-info').map((el) => ({ what: el.className, ...box(el) })),
    ...all('.game-header button, .game-header .turn-tokens, .game-header .phase-caption, .game-header .cafe-name-tag').map((el) => ({ what: `header ${el.className}`, ...box(el) })),
    ...all('.game-screen .dock button, .game-screen .dock input, .game-screen .dock p, .game-screen .dock .cluey-mini')
      .filter((el) => el.tagName !== 'P' || el.textContent.trim())
      .map((el) => ({ what: `dock ${el.tagName}`, ...box(el) })),
  ]
  const items = all('.cafe-item').map((el) => ({ spot: el.dataset.spot, drawing: el.dataset.drawing, ...box(el) }))
  // Every edge spot any café could use, measured from a clone of the layer.
  const spots = []
  const layer = document.querySelector('.cafe-table-edges')
  if (layer && getComputedStyle(layer).display !== 'none') {
    const clone = layer.cloneNode(true)
    const template = clone.querySelector('.cafe-item')
    clone.replaceChildren(...['left-high', 'left-mid', 'left-low', 'right-high', 'right-mid', 'right-low'].map((spot) => {
      const item = template.cloneNode(true)
      item.dataset.spot = spot
      return item
    }))
    layer.after(clone)
    for (const el of clone.querySelectorAll('.cafe-item')) spots.push({ spot: `any ${el.dataset.spot}`, ...box(el) })
    clone.remove()
  }
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const overlaps = []
  for (const item of [...items, ...spots]) for (const clear of keepClear) if (hit(item, clear)) overlaps.push(`${item.spot} x ${clear.what}`)
  const header = document.querySelector('.game-header')
  const tag = document.querySelector('.cafe-name-tag-text')
  const doc = document.scrollingElement
  return {
    cards: [...document.querySelectorAll('.word-card')].map(box),
    items,
    overlaps,
    pairs: (items.length + spots.length) * keepClear.length,
    cups: document.querySelectorAll('.game-header .token-cup').length,
    tag: tag?.textContent ?? null,
    tagTruncated: tag ? tag.scrollWidth > tag.clientWidth + 0.5 : null,
    headerOverflows: header.scrollWidth > header.clientWidth + 1,
    caseyWidth: document.querySelector('.game-screen .dock .cluey-mini')?.getBoundingClientRect().width ?? null,
    scrolls: doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1,
  }
})

/** Card rects with the café chrome put back to the pre-café geometry. */
const cardsWithoutCafeChrome = () => page.evaluate(() => {
  const style = document.createElement('style')
  style.textContent = `
    .cafe-name-tag, .cafe-table { display: none !important; }
    .phase-caption.visually-hidden { position: static !important; width: auto !important; height: auto !important; margin: 0 !important; clip: auto !important; }
    .token.token-cup { width: 9px !important; }
    .cluey-mini.cluey-thinking-large { width: 44px !important; }`
  const row = document.querySelector('.token-row-cups')
  row?.classList.remove('token-row-cups')
  document.head.append(style)
  const cards = [...document.querySelectorAll('.word-card')].map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  style.remove()
  row?.classList.add('token-row-cups')
  return cards
})

const maxDelta = (a, b) => a.length !== b.length ? Infinity
  : Math.max(0, ...a.flatMap((r, i) => ['x', 'y', 'w', 'h'].map((f) => Math.abs(r[f] - b[i][f]))))

async function state(size, name, expect) {
  await page.waitForFunction(() => !document.querySelector('.turn-takeover'), undefined, { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  const seen = await read()
  const plain = await cardsWithoutCafeChrome()
  await page.screenshot({ path: resolve(output, `${size}-${name}.png`) })
  const at = `${name} @${size}`
  check(`${at}: the café chrome moves no card`, maxDelta(seen.cards, plain) === 0, `max delta ${maxDelta(seen.cards, plain)} over ${seen.cards.length} cards`)
  check(`${at}: no table item or edge spot touches text or a control`, seen.overlaps.length === 0, seen.overlaps.length ? seen.overlaps.join('; ') : `${seen.pairs} pairs`)
  check(`${at}: Café Solen on the tag, eight cups, the header fits`, seen.tag === 'Café Solen' && !seen.tagTruncated && seen.cups === 8 && !seen.headerOverflows, JSON.stringify({ tag: seen.tag, cups: seen.cups, overflow: seen.headerOverflows }))
  check(`${at}: ${expect.label}`, expect.items(seen.items), seen.items.map((i) => `${i.drawing}@${i.spot}`).join(', ') || 'no items')
  check(`${at}: the page does not scroll`, !seen.scrolls)
  return seen
}

const edgesOnly = (items) => items.length === 3 && items.every((i) => /^(left|right)-/.test(i.spot))

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    const size = `${viewport.width}x${viewport.height}`
    await newProfile(viewport)
    await page.goto(`${preview.base}?howto=0&first=ai`)
    await page.waitForSelector('.home-play')
    await page.locator('.home-play').click()
    await page.waitForSelector('.board-grid')
    await page.waitForTimeout(2600)
    await dismissGuidance()
    await page.waitForSelector('.guess-bar')
    await state(size, 'your-turn-to-guess', { label: 'the three edge items only', items: edgesOnly })

    const fit = await page.evaluate((names) => {
      const text = document.querySelector('.cafe-name-tag-text')
      const header = document.querySelector('.game-header')
      const before = header.getBoundingClientRect().height
      const original = text.textContent
      const bad = []
      for (const name of names) {
        text.textContent = name
        if (text.scrollWidth > text.clientWidth + 0.5 || header.scrollWidth > header.clientWidth + 1 || header.getBoundingClientRect().height !== before) bad.push(name)
      }
      text.textContent = original
      return bad
    }, CAFE_NAMES)
    check(`every one of the ${CAFE_NAMES.length} café names fits its tag on one line @${size}`, fit.length === 0, fit.join(', '))

    const { game } = await saved()
    const word = game.words.find((w) => game.aiKey[w.wordId] === 'bystander' && game.reveals[w.wordId].kind === 'hidden')
    await page.locator('.word-card').filter({ has: page.getByText(word.da, { exact: true }) }).click()
    await page.locator('.guess-confirm .btn-primary').click()
    await page.waitForSelector('.clue-input')
    await page.waitForTimeout(2600)
    await dismissGuidance()
    await state(size, 'your-turn-to-clue', { label: 'the three edge items only', items: edgesOnly })

    // The simulated keyboard the board drives use (keyboard-board-drive).
    await page.locator('.clue-input input').first().focus()
    await page.evaluate((keyboardHeight) => {
      const grid = document.querySelector('.board-grid')
      document.documentElement.style.setProperty('--board-h', `${Math.round(grid.getBoundingClientRect().height)}px`)
      document.documentElement.classList.add('kb-up')
      document.querySelector('.clue-input')?.classList.add('kb-lifted')
      document.body.style.height = `${window.innerHeight - keyboardHeight}px`
    }, 336)
    await state(size, 'keyboard-open', { label: 'no items while the keyboard is up', items: (items) => items.length === 0 })
    await page.evaluate(() => {
      document.body.style.height = ''
      document.documentElement.classList.remove('kb-up')
      document.documentElement.style.removeProperty('--board-h')
      document.querySelector('.clue-input')?.classList.remove('kb-lifted')
    })

    holdGuess = true
    await page.locator('.clue-input input').first().fill('togetherness')
    await page.locator('.clue-input .btn-primary').click()
    await page.waitForSelector('.ai-bubble.thinking')
    await page.waitForTimeout(2600)
    const thinking = await state(size, 'casey-thinking', {
      label: 'edge items and the large signature item in the bottom area',
      items: (items) => items.filter((i) => /^(left|right)-/.test(i.spot)).length === 3 && items.some((i) => i.spot === 'bottom-large' && i.drawing === 'sun'),
    })
    check(`casey-thinking @${size}: Casey is large`, thinking.caseyWidth === 96, `${thinking.caseyWidth}px`)
    holdGuess = false
    releaseGuess?.()
    releaseGuess = null
    await page.waitForSelector('.ai-bubble:not(.thinking)')
    await page.waitForTimeout(200)
    const guessing = await read()
    check(`casey-guessing @${size}: her reasoning has the bottom area, Casey is small again`,
      !guessing.items.some((i) => i.spot.startsWith('bottom')) && guessing.caseyWidth === 44,
      JSON.stringify({ casey: guessing.caseyWidth, items: guessing.items.map((i) => i.spot) }))

    await page.evaluate(() => {
      const value = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const g = value.state.game
      const greens = g.words.filter((w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green')
      for (const w of greens) g.reveals[w.wordId] = { kind: 'green' }
      g.phase = 'translateChallenge'
      g.turnsLeft = 0
      g.wheel = { segments: greens.map((w) => w.wordId), translated: [], filled: [], attempts: 0, landed: null, result: null, spent: null }
      window.__cafePuzzleFixture(value)
    })
    await page.goto(`${preview.base}?howto=0`)
    await page.waitForSelector('.home-play')
    await page.locator('.home-play').click()
    await page.waitForSelector('.board-grid')
    await page.waitForTimeout(2600)
    await dismissGuidance()
    await page.waitForSelector('.translate-challenge, .dock')
    await state(size, 'translation-time', { label: 'the three edge items only', items: edgesOnly })
  }
  check('no page errors', errors.length === 0, errors.join(' | '))
} catch (error) {
  failures.push(`drive: ${error.stack ?? error}`)
  console.log(`FAIL drive — ${error.stack ?? error}`)
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {})
} finally {
  await browser.close()
  preview.stop()
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall café puzzle checks passed')
process.exit(failures.length ? 1 : 0)
