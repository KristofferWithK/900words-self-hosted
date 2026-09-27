/**
 * Bake the OPENING clue for every authored City 1 board into the client
 * bundle: one entry per board in `src/data/city1-opening-clues.da.json`.
 *
 * The owner's decision (2026-09-18, after two failed softer versions): the
 * first clue must be IN THE APP, not fetched at round start — "zero delay from
 * when you press game and the first clue appears because it has already
 * pre-computed". Casey's model work (later clues and guesses) stays
 * server-side; the OPENING is baked and synchronous.
 *
 * One entry per board: `{ id, clue, clueEnglish, targetWordIds }` — EXACTLY
 * the first step of `authoredPath(view)` for a canonical opening view of that
 * board (every word hidden, empty history, full Casey key). Nothing else from
 * the bank crosses: no groups, no strengths, no player-key data, no
 * association data. The clue is text the player sees the moment the round
 * starts; the Worker remains the source of truth for the bank, and this file
 * is generated FROM it.
 *
 * No logic is re-implemented: the REAL `authoredFirstClue` (and with it
 * `authoredPath` + `authoredBoardFor`) runs here, bundled in-memory from
 * `proxy/casey/authored-clues.js` with esbuild — the proven approach of the
 * 2026-09-17 opening-delay investigation — so drift is impossible by
 * construction. Each baked clue is re-checked with the bundled
 * `checkClueLegality` (proxy/casey/language.js, the Worker's own rule) and the
 * bake FAILS if any is illegal (they pass by construction; the repo test
 * already proves all bank groups legal — this is defence, not hope).
 *
 * THE PINNING RULE: the file records the cycle's `sourceSha256`. A
 * regenerated bank without a re-bake fails `src/data/city1OpeningClues.test.ts`
 * (the drift alarm) and `node scripts/bake-opening-clues.mjs --check`.
 *
 * Usage:
 *   node scripts/bake-opening-clues.mjs           write the file
 *   node scripts/bake-opening-clues.mjs --check   exit 1 if it would change
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CYCLE = join(ROOT, 'src/data/city1-board-cycle.da.json')
const WORDS = join(ROOT, 'src/data/words.da.json')
const OUT = join(ROOT, 'src/data/city1-opening-clues.da.json')

/**
 * The real Worker modules, bundled in memory — no copy of their logic anywhere.
 * `write:false` keeps the private bank out of the tree; the data-URL import
 * executes the bundle without touching the filesystem.
 */
async function workerModule(entry) {
  const result = await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    // The Worker's JSON imports arrive as bundled string constants; the json
    // loader keeps them in-memory exactly as Wrangler ships them.
    loader: { '.json': 'json' },
    logLevel: 'silent',
  })
  const source = result.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(source, 'utf8').toString('base64'))
}

const cycle = JSON.parse(readFileSync(CYCLE, 'utf8'))
if (cycle?.schemaVersion !== 1 || !Array.isArray(cycle.boards) || cycle.boards.length === 0) {
  throw new Error('city1-board-cycle.da.json has an unsupported schema')
}
const words = JSON.parse(readFileSync(WORDS, 'utf8'))
const wordById = new Map(words.map((word) => [word.id, word]))

/**
 * The canonical opening view of an authored board: the same shape the browser
 * sends for a fresh round (buildAiClueView) — every word hidden, empty
 * history, no flags, the board id naming the bank, and Casey's key from the
 * cycle's aiGreenIds. The parity test builds THE SAME view, which is what
 * makes the baked file and the runtime agree by construction.
 */
function openingView(board) {
  return {
    kind: 'ai-clue',
    clueLanguage: 'target',
    turnsLeft: 8,
    words: board.wordIds.map((id) => {
      const entry = wordById.get(id)
      if (!entry) throw new Error(`authored board ${board.id} names an unknown word: ${id}`)
      return {
        id,
        da: entry.da,
        en: entry.en,
        pos: entry.pos,
        reveal: { kind: 'hidden' },
        roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander',
      }
    }),
    history: [],
    flagged: [],
    boardId: board.id,
  }
}

export async function bakeOpeningClues() {
  const [authored, language] = await Promise.all([
    workerModule('proxy/casey/authored-clues.js'),
    workerModule('proxy/casey/language.js'),
  ])
  const { authoredFirstClue, authoredBoardFor } = authored
  const { checkClueLegality } = language
  if (
    typeof authoredFirstClue !== 'function' ||
    typeof authoredBoardFor !== 'function' ||
    typeof checkClueLegality !== 'function'
  ) {
    throw new Error('the bundled Worker modules are missing an expected export')
  }
  const boards = []
  for (const board of cycle.boards) {
    const view = openingView(board)
    // Fails closed like every bank read: the view must match the bank for the
    // id it names. If the cycle and the bank ever drift apart board by board,
    // this refuses before anything is written.
    if (!authoredBoardFor(view)) throw new Error(`authored board ${board.id} failed its own lookup`)
    const opening = authoredFirstClue(view)
    if (!opening) throw new Error(`authored board ${board.id} has no opening clue`)
    // Legality re-check with the Worker's own rule and pack. A failure here is
    // the bake refusing to ship a clue the engine would throw on.
    const verdict = checkClueLegality(
      opening.clue,
      view.words.map(({ da, en, pos }) => ({ da, en, pos })),
    )
    if (!verdict.legal) {
      throw new Error(`${board.id}: baked clue «${opening.clue}» is illegal — ${verdict.reason ?? ''}`)
    }
    for (const id of opening.targetWordIds) {
      if (!board.aiGreenIds.includes(id)) {
        throw new Error(`${board.id}: baked target ${id} is not on Casey's key`)
      }
    }
    boards.push({
      id: board.id,
      clue: opening.clue,
      clueEnglish: opening.clueEnglish,
      targetWordIds: [...opening.targetWordIds],
    })
  }
  boards.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  return {
    schemaVersion: 1,
    sourceSha256: cycle.sourceSha256,
    note: 'One OPENING clue per authored City 1 board, the first step of authoredPath for a canonical fresh view (all words hidden, empty history, full Casey key). Generated by scripts/bake-opening-clues.mjs from the Worker bank (proxy/data/authored-clues.da.1.json) with the REAL authoredPath — nothing else from the bank crosses into the client. Applied synchronously by runAiClue with no network; the Worker stays the source of truth. PINNED to the cycle: regenerate the bank and you must re-run this bake, or src/data/city1OpeningClues.test.ts fails. Owner decision 2026-09-18: the first clue is IN the app — zero delay from Play.',
    boards,
  }
}

export const renderOpeningClues = (document) => `${JSON.stringify(document, null, 2)}\n`

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const document = await bakeOpeningClues()
  const rendered = renderOpeningClues(document)
  if (process.argv.includes('--check')) {
    const existing = readFileSync(OUT, 'utf8')
    if (existing !== rendered) {
      console.error('bake-opening-clues: src/data/city1-opening-clues.da.json is stale — run `node scripts/bake-opening-clues.mjs`')
      process.exit(1)
    }
    console.log(`bake-opening-clues: --check OK, ${document.boards.length} boards match the bank (${document.sourceSha256.slice(0, 12)}…)`)
  } else {
    writeFileSync(OUT, rendered)
    console.log(`bake-opening-clues: wrote ${document.boards.length} opening clues to src/data/city1-opening-clues.da.json (${document.sourceSha256.slice(0, 12)}…)`)
  }
}