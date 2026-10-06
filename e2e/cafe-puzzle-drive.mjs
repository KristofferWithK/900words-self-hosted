// The café puzzle on the real board (card CW-08; docs/roadmap/cafe-world.md
// section 5): coffee cups for the turn dots, the café's name on a tag where
// the phase caption stood, large faint pencil items on the table behind the
// cards, and Casey large while she thinks.
//
// Built app + a scripted Casey transport: every external origin is blocked and
// Casey's decisions are answered locally (as round-opening-guidance-drive
// does), so no Worker and no paid call is involved. It plays the first
// required board (Café Solen) through every turn state at 390x844 and 360x640
// and asserts, per state:
//   - the café chrome moves no card: card rects with the café chrome reverted
//     to the pre-café geometry (dots, caption, small Casey, no table) are
//     identical to the rects with it;
//   - the table is painted behind everything (a fixed, pointerless layer at
//     z-index -1), its ink is faint, every card is opaque paper over it, and
//     no item reaches the header's text or buttons;
//   - the header fits, and every one of the 100 café names fits its tag;
//   - the café's table is fixed (owner, build 122): the same six items in
//     the same places in every state, keyboard and Casey's turns included;
//     the page never scrolls.
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
  // The header must stay clear of the table: its text and its buttons.
  const keepClear = all('.game-header button, .game-header .turn-tokens, .game-header .phase-caption, .game-header .cafe-name-tag')
    .map((el) => ({ what: `header ${el.className}`, ...box(el) }))
  const items = [...document.querySelectorAll('.cafe-item')].map((el) => {
    const r = box(el)
    // The ink lies inside the drawing's circle (radius 22 of the 48 box).
    const inset = r.w * (1 - 44 / 48) / 2
    const s = getComputedStyle(el)
    return { spot: el.dataset.spot, drawing: el.dataset.drawing, shown: s.display !== 'none' && s.visibility !== 'hidden' && !el.closest('[hidden]'),
      layer: el.closest('.cafe-table-composer') ? 'composer' : el.closest('.cafe-table') ? 'board' : 'none',
      x: r.x + inset, y: r.y + inset, w: r.w - 2 * inset, h: r.h - 2 * inset }
  })
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const overlaps = []
  for (const item of items) for (const clear of keepClear) if (hit(item, clear)) overlaps.push(`${item.spot} x ${clear.what}`)
  const layer = document.querySelector('.cafe-table')
  const layerStyle = layer ? getComputedStyle(layer) : null
  const alpha = layerStyle ? Number(/rgba?\(([^)]+)\)/.exec(layerStyle.color)?.[1].split(',')[3] ?? 1) : null
  const behind = !!layerStyle && layerStyle.position === 'fixed' && Number(layerStyle.zIndex) < 0 && layerStyle.pointerEvents === 'none'
  const opaqueCards = [...document.querySelectorAll('.word-card-surface')].every((el) => getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)')
  // The bottom area's items ride with the dock (owner, build 123): their
  // layer's top is the dock's top in every state, the keyboard's included.
  const composerLayer = document.querySelector('.cafe-table-composer')
  const dock = document.querySelector('.game-screen .dock.clue-input, .game-screen .dock.guess-bar, .game-screen .dock.ai-panel')
  const composerStyle = composerLayer ? getComputedStyle(composerLayer) : null
  const header = document.querySelector('.game-header')
  const tag = document.querySelector('.cafe-name-tag-text')
  const doc = document.scrollingElement
  return {
    cards: [...document.querySelectorAll('.word-card')].map(box),
    items,
    overlaps,
    pairs: items.length * keepClear.length,
    behind,
    alpha,
    composerTop: composerLayer ? composerLayer.getBoundingClientRect().top : null,
    composerBehind: !!composerStyle && Number(composerStyle.zIndex) < 0 && composerStyle.pointerEvents === 'none' && composerStyle.color === layerStyle?.color,
    dockTop: dock ? dock.getBoundingClientRect().top : null,
    opaqueCards,
    cups: document.querySelectorAll('.game-header .token-cup').length,
    tag: tag?.textContent ?? null,
    tagTruncated: tag ? tag.scrollWidth > tag.clientWidth + 0.5 : null,
    headerOverflows: header.scrollWidth > header.clientWidth + 1,
    caseyWidth: document.querySelector('.game-screen .dock .cluey-mini')?.getBoundingClientRect().width ?? null,
    caseyAt: (({ x, y } = {}) => (x === undefined ? null : `${x.toFixed(1)},${y.toFixed(1)}`))(document.querySelector('.game-screen .dock .cluey-mini')?.getBoundingClientRect()),
    scrolls: doc.scrollHeight > doc.clientHeight + 1 || doc.scrollWidth > doc.clientWidth + 1,
  }
})

/** Card rects with the café chrome put back to the pre-café geometry. */
const cardsWithoutCafeChrome = () => page.evaluate(() => {
  const style = document.createElement('style')
  style.textContent = `
    .cafe-name-tag, .cafe-table, .cafe-table-composer { display: none !important; }
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

async function state(size, name) {
  await page.waitForFunction(() => !document.querySelector('.turn-takeover'), undefined, { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  const seen = await read()
  const plain = await cardsWithoutCafeChrome()
  await page.screenshot({ path: resolve(output, `${size}-${name}.png`) })
  const at = `${name} @${size}`
  check(`${at}: the café chrome moves no card`, maxDelta(seen.cards, plain) === 0, `max delta ${maxDelta(seen.cards, plain)} over ${seen.cards.length} cards`)
  check(`${at}: the table lies behind everything, faint, under opaque cards`, seen.behind && seen.alpha !== null && seen.alpha <= 0.3 && seen.opaqueCards, JSON.stringify({ behind: seen.behind, alpha: seen.alpha, opaqueCards: seen.opaqueCards }))
  check(`${at}: no table item reaches the header's text or buttons`, seen.overlaps.length === 0, seen.overlaps.length ? seen.overlaps.join('; ') : `${seen.pairs} pairs`)
  check(`${at}: Café Solen on the tag, eight cups, the header fits`, seen.tag === 'Café Solen' && !seen.tagTruncated && seen.cups === 8 && !seen.headerOverflows, JSON.stringify({ tag: seen.tag, cups: seen.cups, overflow: seen.headerOverflows }))
  // The board's items by where they lie on the screen; the bottom area's by
  // where they lie from the dock's top.
  const table = seen.items.map((i) => `${i.drawing}@${i.spot}/${i.layer} ${i.shown ? '' : 'HIDDEN '}${[i.x, i.layer === 'composer' ? i.y - seen.composerTop : i.y, i.w].map((n) => n.toFixed(2)).join(',')}`).join(' | ')
  tables[size] ??= table
  check(`${at}: the café's table is the same as in the first state (six items, none hidden; the bottom three measured from the dock)`, seen.items.length === 6 && seen.items.every((i) => i.shown) && seen.items.filter((i) => i.layer === 'composer').length === 3 && seen.items.filter((i) => i.layer === 'board').length === 3 && table === tables[size], table || 'no items')
  check(`${at}: the bottom area's layer starts at the dock's top, behind it, in the table's ink`, seen.composerBehind && (seen.dockTop === null || Math.abs(seen.composerTop - seen.dockTop) < 0.5), JSON.stringify({ composerTop: seen.composerTop, dockTop: seen.dockTop, behind: seen.composerBehind }))
  check(`${at}: the page does not scroll`, !seen.scrolls)
  return seen
}

/**
 * The longest bubble Casey can show in each UI catalogue: a twelve-word
 * reasoning (the prompt's cap, proxy/casey/player-language.js; 25 characters
 * in Chinese) built from long words, plus that catalogue's second-choice
 * sentence (src/i18n/<lang>/casey.ts) naming a long board word.
 */
const LONGEST_EXPLANATIONS = [
  ['en', 'sygeplejerske (nurse) works nights in hospitals, caring for exhausted patients through emergencies. My second choice would have been vaskemaskine.'],
  ['de', 'badevaerelse (Badezimmer) gehört zur Wohnungseinrichtung, genau wie Waschmaschine und Kühlschrank zusammengehören. Meine zweite Wahl wäre sygeplejerske gewesen.'],
  ['es', 'sygeplejerske (enfermera) trabaja en hospitales, cuidando pacientes agotados durante emergencias nocturnas complicadas. Mi segunda opción habría sido vaskemaskine.'],
  ['fr', 'sygeplejerske (infirmière) travaille dans les hôpitaux, soignant patients épuisés pendant urgences nocturnes. Mon second choix aurait été vaskemaskine.'],
  ['hu', 'sygeplejerske (ápolónő) kórházakban dolgozik, kimerült betegeket gondoz éjszakai sürgősségi ügyeletekben folyamatosan. A második választásom vaskemaskine lett volna.'],
  ['nb', 'sygeplejerske (sykepleier) arbeider på sykehusene, pleier utmattede pasienter gjennom nattlige akuttsituasjoner kontinuerlig. Andrevalget mitt ville vært vaskemaskine.'],
  ['nl', 'sygeplejerske (verpleegkundige) werkt in ziekenhuizen, verzorgt uitgeputte patiënten tijdens nachtelijke spoedgevallen voortdurend. Mijn tweede keus zou vaskemaskine zijn geweest.'],
  ['pl', 'sygeplejerske (pielęgniarka) pracuje w szpitalu, opiekując się chorymi pacjentami podczas nocnych dyżurów. Moim drugim wyborem byłoby vaskemaskine.'],
  ['pt', 'sygeplejerske (enfermeira) trabalha nos hospitais, cuidando de pacientes exaustos durante emergências noturnas. A minha segunda escolha teria sido vaskemaskine.'],
  ['sv', 'sygeplejerske (sjuksköterska) arbetar på sjukhusen, vårdar utmattade patienter under nattliga akutsituationer kontinuerligt. Mitt andra val hade varit vaskemaskine.'],
  ['zh', 'sygeplejerske（护士）在医院工作，夜里照顾疲惫的病人，对应医院这个线索很合适 我本来的第二选择是 vaskemaskine。'],
]

const tables = {}

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
    await state(size, 'your-turn-to-guess')

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
    const atRest = await state(size, 'your-turn-to-clue')

    // The simulated keyboard the board drives use (keyboard-board-drive).
    await page.locator('.clue-input input').first().focus()
    await page.evaluate((keyboardHeight) => {
      const grid = document.querySelector('.board-grid')
      document.documentElement.style.setProperty('--board-h', `${Math.round(grid.getBoundingClientRect().height)}px`)
      document.documentElement.classList.add('kb-up')
      document.querySelector('.clue-input')?.classList.add('kb-lifted')
      document.body.style.height = `${window.innerHeight - keyboardHeight}px`
    }, 336)
    const kbOpen = await state(size, 'keyboard-open')
    // Owner, build 123: with the keyboard up the art around the composer
    // "switches the artwork or takes it from the board". The composer's own
    // items go up with it, at the same offsets from it; the board's stay put.
    const fromComposer = (seen) => {
      const top = seen.dockTop
      return seen.items.filter((i) => i.layer === 'composer').map((i) => `${i.spot}:${(i.x).toFixed(2)},${(i.y - top).toFixed(2)}`).join(' ')
    }
    const boardItems = (seen) => seen.items.filter((i) => i.layer === 'board').map((i) => `${i.spot}:${i.x.toFixed(2)},${i.y.toFixed(2)}`).join(' ')
    check(`keyboard-open @${size}: the composer went up and its own items with it, at the same offsets`,
      kbOpen.dockTop < atRest.dockTop - 100 && fromComposer(kbOpen) === fromComposer(atRest),
      `dock ${atRest.dockTop} -> ${kbOpen.dockTop}; ${fromComposer(atRest)} vs ${fromComposer(kbOpen)}`)
    check(`keyboard-open @${size}: the board's items have not moved`, boardItems(kbOpen) === boardItems(atRest), `${boardItems(atRest)} vs ${boardItems(kbOpen)}`)
    // And none of the board's items shows through the composer instead: its
    // layer is the page's white while the keyboard is up.
    const composerPaper = await page.evaluate(() => getComputedStyle(document.querySelector('.cafe-table-composer')).backgroundColor)
    check(`keyboard-open @${size}: the composer's layer holds back the board's items behind it`, composerPaper === 'rgb(255, 255, 255)', composerPaper)
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
    const thinking = await state(size, 'casey-thinking')
    check(`casey-thinking @${size}: Casey is large`, thinking.caseyWidth === 96, `${thinking.caseyWidth}px`)
    holdGuess = false
    releaseGuess?.()
    releaseGuess = null
    await page.waitForSelector('.ai-bubble:not(.thinking)')
    await page.waitForTimeout(200)
    const guessing = await read()
    // Owner, build 123: she used to drop back to 44px as soon as she explained
    // her pick. She keeps her thinking size through the whole turn.
    check(`casey-explaining @${size}: Casey stays as large as she was while thinking, in the same spot`, guessing.caseyWidth === thinking.caseyWidth && guessing.caseyWidth === 96 && guessing.caseyAt === thinking.caseyAt, `${thinking.caseyWidth}px at ${thinking.caseyAt} -> ${guessing.caseyWidth}px at ${guessing.caseyAt}`)
    // The bubble beside her is narrower now. The longest a reasoning can be is
    // one twelve-word sentence (proxy/casey/player-language.js) and, after a
    // miss, the second-choice sentence: every catalogue's worst case must sit
    // in the bubble unclipped, with the dock inside its height and the page
    // unscrolled.
    const explained = await page.evaluate((cases) => {
      const bubble = document.querySelector('.ai-bubble:not(.thinking)')
      const panel = document.querySelector('.dock.ai-panel')
      const original = bubble.textContent
      const doc = document.scrollingElement
      const out = []
      for (const [lang, text] of cases) {
        bubble.textContent = text
        const b = bubble.getBoundingClientRect()
        const p = panel.getBoundingClientRect()
        const line = panel.querySelector('.ai-guess-line').getBoundingClientRect()
        out.push({
          lang,
          // Clamped (a line clamp hides lines inside the bubble) or cut by
          // the row it sits in (which clips whatever runs past the dock).
          clipped: bubble.scrollHeight > bubble.clientHeight + 1 || b.bottom > bubble.parentElement.getBoundingClientRect().bottom + 0.5,
          spills: panel.scrollHeight > panel.clientHeight + 1 || b.bottom > line.top + 0.5 || line.bottom > p.bottom + 0.5,
          scrolls: doc.scrollHeight > doc.clientHeight + 1,
        })
      }
      bubble.textContent = original
      return out
    }, LONGEST_EXPLANATIONS)
    const bad = explained.filter((e) => e.clipped || e.spills || e.scrolls)
    check(`casey-explaining @${size}: the longest explanation in every catalogue fits beside her, unclipped`, bad.length === 0 && explained.length === LONGEST_EXPLANATIONS.length, JSON.stringify(bad))

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
    await state(size, 'translation-time')
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
