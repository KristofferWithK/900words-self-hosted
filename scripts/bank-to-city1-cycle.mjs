/**
 * Turn a board-engine City 1 bank (plus its appendix) into the files the app ships:
 *
 *   src/data/city1-board-cycle.da.json    the 150-board archive the game deals from (city1BoardCycle.ts)
 *   src/data/city1-board-cycle-appendix.da.json   the boards appended after it
 *   src/data/city1-playtest-clues.da.json Casey's precomputed clue groups
 *
 * Usage:
 *   node scripts/bank-to-city1-cycle.mjs [bank.json] [gloss.json] [appendix.json]
 *
 * With no arguments it reads the shipped, ordered v2 bank (the 150 archival
 * boards, bank_001-bank_150), the gloss file beside it, and the appendix beside
 * it when there is one: verified research boards added after the 150 as
 * bank_151 onward (docs/research/board-engine/city1-bank/appendix.mjs). The
 * appendix only ever appends, so every earlier board keeps its id and bytes.
 * (Until 2026-09-27 the default was bank.city1.pruned.json, the first
 * 100-board bank, which silently overwrote the shipped files when the script
 * was run bare.) Deterministic and idempotent: the same bank
 * bytes always produce the same two files, so re-running after a bank rebuild
 * is the only way these files are ever meant to change.
 *
 * The validation here is deliberately the same shape as `keysFromGreenIds`
 * (src/engine/keygen.ts): a bank board that would throw at deal time must fail
 * HERE, loudly, rather than reach a player's phone.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BANK_DIR = 'docs/research/board-engine/city1-bank'
const DEFAULT_BANK = `${BANK_DIR}/bank.city1.v2.ordered.json`
const DEFAULT_GLOSS = `${BANK_DIR}/gloss.json`
const DEFAULT_APPENDIX = `${BANK_DIR}/bank.city1.appendix.json`

const CYCLE_OUT = 'src/data/city1-board-cycle.da.json'
// The appended boards live in a file of their own: city1-board-cycle.da.json is
// the 150-board archive, and its bytes are pinned by the frozen City 1 review
// evidence (prototypes/finish-review/implementation/roster-extension/scope.json).
// city1BoardCycle.ts deals from both, archive first.
const APPENDIX_OUT = 'src/data/city1-board-cycle-appendix.da.json'
const CLUES_OUT = 'src/data/city1-playtest-clues.da.json'
// The same clue groups again, where Casey can read them: the Worker's private
// data directory (proxy/casey/authored-clues.js). The client copy is pinned by
// its test and never bundled; the Worker copy is what a round is advised from.
// Casey's greens and his groups only — nothing about the player's key crosses
// into the Worker's data, which is what keeps the firewall true by construction.
const WORKER_CLUES_OUT = 'proxy/data/authored-clues.da.1.json'
// Group MEMBERSHIP for both sides, and nothing else — no clue text — for the
// wrap-up composer (src/journey/wrapup.ts): which two or three greens of a
// key the bank found a gated clue for, as cell indexes into that board's
// wordIds. This one IS bundled. The client already holds both keys of every
// authored board (city1BoardCycle.ts), so membership adds no key information;
// what it adds is the bank's judgement of which greens go together, which is
// what a wrap-up board composed from collected words needs and the index
// cannot give it on the phone (SEC3).
const GROUPS_OUT = 'src/data/city1-clue-groups.da.json'

/**
 * Clues Casey may not give for a word of her own root (owner, 2026-09-27): «tanke»
 * for «tænke» all but names the card. Keyed by clue, the greens it may not point
 * at; a pre-written group that does is left out of her clue files. The first four
 * came from a stem scan of all 1,285 groups; the rest from a word-family scan the
 * same day, when German got the same rule (scripts/german-city1-course.mjs), and
 * each is a clue with the card's own word visible in it: «kom» in «ankomst»,
 * «børn» (the plural of «barn») in «børnesang», «vidst» in «bevidst». Read by
 * hand and kept on purpose: «horn» for «høre» only looks alike; «fodgænger»,
 * «afgang» and «gå» for «gang» and «gå» are the owner's call (2026-09-27, "the
 * gå/gang is fine"); «fjernsyn» and «gennemsigtig» for «se», «sæde» for «sidde»,
 * «udsagn» for «sige», «døgn» for «dag» and «alder» for «gammel» are related too
 * far back for a learner to see it.
 */
const SAME_ROOT_CLUES = {
  tanke: ['da:tænke'],
  nævne: ['da:navn'],
  størrelse: ['da:stor'],
  standse: ['da:stå'],
  benævne: ['da:navn'],
  ankomst: ['da:komme'],
  danmark: ['da:dansk'],
  børneopdragelse: ['da:barn'],
  børnesang: ['da:barn'],
  indkørsel: ['da:køre'],
  samkørsel: ['da:køre'],
  oplæsning: ['da:læse'],
  forhistorisk: ['da:historie'],
  kærlig: ['da:kæreste'],
  synspunkt: ['da:synes'],
  synlig: ['da:synes'],
  bevidst: ['da:vide'],
}
const sameRootClue = (group) => (SAME_ROOT_CLUES[group.clue] ?? []).some((id) => group.ids.includes(id))
let sameRootDropped = 0

// The shipped board shape. Mirrored rather than imported because this script
// runs under plain node and src/ is TypeScript compiled for the browser.
const TOTAL_WORDS = 18
const GREENS_PER_SIDE = 8

const bankPath = resolve(process.argv[2] ?? DEFAULT_BANK)
const glossPath = resolve(process.argv[3] ?? DEFAULT_GLOSS)
const appendixPath = resolve(process.argv[4] ?? DEFAULT_APPENDIX)

const bankBytes = readFileSync(bankPath)
const bank = JSON.parse(bankBytes.toString('utf8'))
if (!Array.isArray(bank.boards) || bank.boards.length === 0) {
  throw new Error(`${bankPath}: expected a non-empty boards array`)
}
let appendixBytes = null
try {
  appendixBytes = readFileSync(appendixPath)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
const appendix = appendixBytes ? JSON.parse(appendixBytes.toString('utf8')).boards : []
if (!Array.isArray(appendix)) throw new Error(`${appendixPath}: expected a boards array`)

/** The gloss file is advisory: a clue with no gloss ships with an empty one. */
let gloss = {}
try {
  gloss = JSON.parse(readFileSync(glossPath, 'utf8'))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  console.warn(`no gloss file at ${glossPath} — every clueEnglish will be empty`)
}

const fail = (index, seed, message) =>
  new Error(`bank board ${index} (seed ${seed}): ${message}`)

const seenLayouts = new Map()
const seenKeyPairs = new Map()
const seenIds = new Set()

const cycleBoards = []
const clueBoards = []
const groupBoards = []
let missingGlosses = 0

/**
 * One side's groups as sorted cell-index strings ("4.9.13"), deduplicated by
 * membership: the bank's graph lists a group once per clue that reaches it,
 * and the composer only asks which greens go together. Singles are the
 * graph's "every green has a clue" guarantee and carry no membership.
 */
function groupCells(index, seed, side, graph, wordIds, keyIds) {
  const seen = new Set()
  const cells = []
  for (const group of graph ?? []) {
    if (!Array.isArray(group.ids) || group.ids.length < 2) continue
    if (group.ids.length > 3) throw fail(index, seed, `${side} group "${group.clue}" names ${group.ids.length} words`)
    for (const id of group.ids) {
      if (!keyIds.includes(id)) throw fail(index, seed, `${side} group "${group.clue}" targets a non-green: ${id}`)
    }
    const key = group.ids.map((id) => wordIds.indexOf(id)).sort((a, b) => a - b).join('.')
    if (seen.has(key)) continue
    seen.add(key)
    cells.push(key)
  }
  return cells
}

;[...bank.boards, ...appendix].forEach((board, index) => {
  const seed = board.seed
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw fail(index, seed, 'seed must be a uint32')
  }

  const id = `bank_${String(index + 1).padStart(3, '0')}`
  if (seenIds.has(id)) throw fail(index, seed, `duplicate board id ${id}`)
  seenIds.add(id)

  const wordIds = board.cells
  if (!Array.isArray(wordIds) || wordIds.length !== TOTAL_WORDS) {
    throw fail(index, seed, `needs ${TOTAL_WORDS} cells, got ${wordIds?.length}`)
  }
  if (new Set(wordIds).size !== TOTAL_WORDS) {
    throw fail(index, seed, `needs ${TOTAL_WORDS} DISTINCT cells`)
  }
  const onBoard = new Set(wordIds)

  const side = (name, ids) => {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length !== GREENS_PER_SIDE) {
      throw fail(index, seed, `${name} key needs ${GREENS_PER_SIDE} distinct greens`)
    }
    for (const wordId of ids) {
      if (!onBoard.has(wordId)) throw fail(index, seed, `${name} green off the board: ${wordId}`)
    }
    return [...ids]
  }
  const playerGreenIds = side('player', board.player)
  const aiGreenIds = side('ai', board.casey)

  const greenOverlap = playerGreenIds.filter((wordId) => aiGreenIds.includes(wordId)).length
  if (greenOverlap < 1 || greenOverlap > 3) {
    throw fail(index, seed, `overlap ${greenOverlap} is outside 1..3`)
  }
  // The bank states its own overlap; a disagreement means the bank is not the
  // board its own generator thinks it is, and nothing downstream would notice.
  if (board.shared !== undefined && board.shared !== greenOverlap) {
    throw fail(index, seed, `declares shared ${board.shared} but the keys overlap ${greenOverlap}`)
  }

  const layout = [...wordIds].sort().join('|')
  if (seenLayouts.has(layout)) {
    throw fail(index, seed, `repeats the word layout of ${seenLayouts.get(layout)}`)
  }
  seenLayouts.set(layout, id)

  const keyPair = [[...playerGreenIds].sort().join('|'), [...aiGreenIds].sort().join('|')]
    .sort()
    .join('::')
  if (seenKeyPairs.has(keyPair)) {
    throw fail(index, seed, `repeats the key pair of ${seenKeyPairs.get(keyPair)}`)
  }
  seenKeyPairs.set(keyPair, id)

  cycleBoards.push({
    id,
    seedHex: seed.toString(16).padStart(8, '0'),
    // Alternating rather than drawn from the bank: the bank has no opinion on
    // who opens, and alternating gives a player both seats at the same rate.
    firstGiver: index % 2 === 0 ? 'player' : 'ai',
    greenOverlap,
    wordIds: [...wordIds],
    playerGreenIds,
    aiGreenIds,
  })

  const aiGreens = new Set(aiGreenIds)
  const caseyClueGroups = (board.graph?.casey ?? [])
    .filter((group) => Array.isArray(group.ids) && group.ids.length >= 2)
    .filter((group) => { if (!sameRootClue(group)) return true; sameRootDropped += 1; return false })
    .map((group) => {
      for (const target of group.ids) {
        if (!aiGreens.has(target)) {
          throw fail(index, seed, `Casey clue "${group.clue}" targets a non-green: ${target}`)
        }
      }
      const clueEnglish = gloss[group.clue] ?? ''
      if (!clueEnglish) missingGlosses += 1
      return { clue: group.clue, clueEnglish, targetWordIds: [...group.ids] }
    })
  clueBoards.push({ id, wordIds: [...wordIds], aiGreenIds, caseyClueGroups })
  groupBoards.push({
    id,
    player: groupCells(index, seed, 'player', board.graph?.player, wordIds, playerGreenIds),
    casey: groupCells(index, seed, 'casey', board.graph?.casey, wordIds, aiGreenIds),
  })
})

const overlapCounts = cycleBoards.reduce((counts, board) => {
  counts[board.greenOverlap] = (counts[board.greenOverlap] ?? 0) + 1
  return counts
}, {})
for (const value of [1, 2, 3]) {
  if (!overlapCounts[value]) throw new Error(`no board in the bank has overlap ${value}`)
}

const sourceSha256 = createHash('sha256').update(bankBytes).digest('hex')
// The appendix is provenance of its own: the bank hash keeps naming the 150,
// and an appended board is pinned by this second hash.
const appendixSha256 = appendixBytes ? createHash('sha256').update(appendixBytes).digest('hex') : null
const provenance = appendixSha256 ? { sourceSha256, appendixSha256 } : { sourceSha256 }

const writeJson = (path, value) =>
  writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8')

writeJson(CYCLE_OUT, { schemaVersion: 1, sourceSha256, boards: cycleBoards.slice(0, bank.boards.length) })
if (appendixSha256) {
  writeJson(APPENDIX_OUT, { schemaVersion: 1, sourceSha256, appendixSha256, boards: cycleBoards.slice(bank.boards.length) })
}
const cluesDocument = {
  schemaVersion: 1,
  // No source filename here on purpose: the bank is research output that gets
  // rebuilt and renamed, and a stale path in a shipped file reads as fact. The
  // sha256 is the provenance, and it is the same one city1-board-cycle.da.json
  // carries — the two files are only ever written together.
  note: `Precomputed Casey clue groups for the City 1 board bank (source sha256 ${sourceSha256}${appendixSha256 ? `, appendix sha256 ${appendixSha256}` : ''}). Generated by scripts/bank-to-city1-cycle.mjs alongside city1-board-cycle.da.json; the two are pinned to each other board for board, so regenerate both together.`,
  boards: clueBoards,
}
writeJson(CLUES_OUT, cluesDocument)
writeJson(WORKER_CLUES_OUT, cluesDocument)
writeJson(GROUPS_OUT, {
  schemaVersion: 1,
  ...provenance,
  note: `Clue-group membership of the City 1 board bank (source sha256 ${sourceSha256}${appendixSha256 ? `, appendix sha256 ${appendixSha256}` : ''}), both sides, no clue text: each entry names two or three greens of that key as cell indexes into the board's wordIds in city1-board-cycle.da.json, in ascending order. Generated by scripts/bank-to-city1-cycle.mjs alongside the cycle; regenerate both together.`,
  boards: groupBoards,
})

const clueCount = clueBoards.reduce((total, board) => total + board.caseyClueGroups.length, 0)
const groupCount = groupBoards.reduce((total, board) => total + board.player.length + board.casey.length, 0)
console.log(
  `wrote ${cycleBoards.length} boards (overlap 1/2/3 = ${overlapCounts[1]}/${overlapCounts[2]}/${overlapCounts[3]}), ` +
    `${clueCount} Casey clue groups (${missingGlosses} without a gloss, ${sameRootDropped} same-root left out) and ${groupCount} group memberships from ${sourceSha256}`,
)
