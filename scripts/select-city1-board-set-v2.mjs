#!/usr/bin/env node
/**
 * City 1 required-board set v2: which 100 of the authored boards (the 150 of the
 * archive and the verified boards appended after it) Sønderborg is played on, and
 * in what order (owner decisions 2026-09-27, DECISIONS.md).
 *
 *   node scripts/select-city1-board-set-v2.mjs                 rewrite the evidence (and the manifest's pins) from the manifest's order
 *   node scripts/select-city1-board-set-v2.mjs --check         the manifest keeps every rule and the evidence is current
 *   node scripts/select-city1-board-set-v2.mjs --search [--seed N] [--write]
 *                                                              run the search (a few minutes); --write adopts its result
 *
 * v1 (C1-02) kept the bank's own order and filled coverage gaps at the end.
 * Played, that order put «tanke» and «tænke» on the same key on 12 boards,
 * showed some words ten times in the first 28 boards and others twice, and
 * left words waiting most of the course for their first turn on Casey's key —
 * «mulig» until board 100. Collecting a word needs a green each way (your clue,
 * then your guess under Casey's), so a word Casey never holds cannot be
 * collected however often you clue it.
 *
 * v2 keeps every board exactly as authored (no key, clue or Worker mapping
 * changes; board identity is unchanged) and chooses membership and order by
 * the rules below. A word that comes back should come back differently: on the
 * other key than last time (clued by you, then found under Casey's clue, or the
 * other way round) and away from the clue-group mates it had last time, so each
 * meeting is a new way into the word rather than a replay of a pattern. The hard rules are checked; the order itself comes from a
 * seeded search that scores waits, spread and repetition (`cost`). The search
 * is recorded, not re-run, by `--check`: the reviewed artifact is the order.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = 'src/data/city1-required-board-manifest.da.json'
const EVIDENCE_DIR = 'docs/releases/ios-1.0/postcard-progression/evidence/C1-02-v2'
const INPUTS = {
  roster: 'src/data/city1-replacement-corpus.da.json',
  words: 'src/data/words.da.json',
  cycle: 'src/data/city1-board-cycle.da.json',
  cycleAppendix: 'src/data/city1-board-cycle-appendix.da.json',
  difficulty: 'docs/research/board-engine/city1-bank/bank.city1.v2.ordered.json',
  appendix: 'docs/research/board-engine/city1-bank/bank.city1.appendix.json',
  supersededManifest: 'src/data/city1-required-board-manifest.da.v1.json',
  lcsi: 'proxy/data/lcsi.da.1.json',
  caseyClues: 'proxy/data/authored-clues.da.1.json',
}
const SUPPORT = {
  workerAuthoredClues: 'proxy/data/authored-clues.da.1.json',
  workerPlayerKeys: 'proxy/data/authored-player-keys.da.1.json',
  workerLegalClues: 'proxy/data/legal-index-clues.da.1.json',
  clientOpeningClues: 'src/data/city1-opening-clues.da.json',
}
const BASE_SHA = 'f1001fcbcdf6d5fcdde3ac869416e38c38e10ca7'

// ---- the rules -----------------------------------------------------------------
const COUNT = 100
const FIRST_BOARD = 'bank_001' // the onboarding hand-off and the web demo's first full board
/**
 * Two forms of one root on one board make one of them a free card. Never both.
 * «gå» and «gang» joined 2026-09-27 (owner): the course teaches «gang» as "time,
 * occasion", but the bank grouped the two under walking clues on 14 boards.
 */
const SAME_ROOT = [['da:tanke', 'da:tænke'], ['da:gå', 'da:gang']]
/** Every word has had a turn on each key by this board. */
const BOTH_KEYS_BY = 39
/** No word waits longer than this for its next turn on Casey's key (from the start, or since its last turn). */
const MAX_CASEY_WAIT = 37
/** The same, for a turn on the player's key. */
const MAX_PLAYER_WAIT = 41
/** The first EARLY boards show every word between EARLY_MIN and EARLY_MAX times. */
const EARLY = 28
const EARLY_MIN = 1
const EARLY_MAX = 9
/** Search only: the stretch after a word's last turn on a key counts as a wait beyond this many boards (off by default). */
const TAIL = Number(process.env.TAIL ?? 1000)
/** Search only: how heavily waits count against the other terms. */
const WAIT_WEIGHT = Number(process.env.WAIT_W ?? 1)
/** Every word gets this many turns on each key, or every turn the archive has if it has fewer. */
const MIN_TURNS = 3
/** No two words share more boards than this across the course. */
const MAX_PAIR = 11
/** A returning word comes back on the same key as its last green turn at most this often. */
const MAX_SAME_KEY_SHARE = 0.29
/** A returning word comes back beside a clue-group mate from its last green turn at most this often. */
const MAX_SAME_MATE_SHARE = 0.14
/** In the first 50 boards: at most this many boards carry three or more words of one family… */
const MAX_THEMED_EARLY = 9
/** …and no two boards in a row each carry two or more words of the same family. */
const MAX_CARRIED_EARLY = 0
/** A linked pair is back on one key together within 5 boards at most this often… */
const MAX_KEY_REPEAT_5 = 0
/** …and meets again on a board within 3 boards at most this often. */
const MAX_MEET_REPEAT_3 = 0
/** The first ten boards stay gentle: mean bank difficulty at most this. */
const MAX_OPENING_DIFFICULTY = 0.44

const fail = (message) => { throw new Error(message) }
const need = (condition, message) => { if (!condition) fail(message) }
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (path) => {
  const bytes = readFileSync(resolve(ROOT, path))
  return { path, bytes, sha256: sha256(bytes), json: JSON.parse(bytes.toString('utf8')) }
}
const exact = (a, b) => a.length === b.length && a.every((value, index) => value === b[index])

function load() {
  const input = Object.fromEntries(Object.entries(INPUTS).map(([name, path]) => [name, read(path)]))
  const roster = input.roster.json.wordIds
  need(Array.isArray(roster) && roster.length === COUNT && new Set(roster).size === COUNT, 'the City 1 roster is not 100 unique ids')
  const words = new Map(input.words.json.map((word) => [word.id, word]))
  // The 150-board archive, then the boards appended after it (city1BoardCycle.ts deals from both).
  const cycle = [...input.cycle.json.boards, ...input.cycleAppendix.json.boards]
  // The bank's 150, then the appendix: each cycle board has its source board, whose
  // difficulty and designed clue groups (two triples and a pair a side) are read here.
  const sources = [...input.difficulty.json.boards, ...input.appendix.json.boards]
  need(input.difficulty.json.boards.length === 150, 'the bank is not the 150 archival boards')
  need(cycle.length === sources.length, `the cycle has ${cycle.length} boards, the bank and appendix ${sources.length}`)
  need(input.difficulty.sha256 === input.cycle.json.sourceSha256, 'the difficulty source is not the bank the cycle was built from')
  need(input.appendix.sha256 === input.cycleAppendix.json.appendixSha256, 'the appendix is not the one the cycle was built from')
  const difficulty = new Map(), groups = new Map()
  cycle.forEach((board, index) => {
    const source = sources[index]
    need(source?.seed === Number.parseInt(board.seedHex, 16) && exact(source.cells, board.wordIds), `${board.id} does not match its bank board`)
    difficulty.set(board.id, source.order.difficulty)
    groups.set(board.id, source.groups.map((g) => ({ side: g.side, clue: g.clue, ids: g.ids })))
  })
  return { input, roster, words, cycle, byId: new Map(cycle.map((board) => [board.id, board])), difficulty, groups }
}

const sameRootBoard = (board) => SAME_ROOT.some(([a, b]) => board.wordIds.includes(a) && board.wordIds.includes(b))

/**
 * Word families: the roster clustered by the strong clues its words share in the
 * LCSI index (average-link over shared-clue cosine, stop at 0.18). Deterministic.
 * The time words (tid, time, klokke, år, måned, dag, uge) are the one big family;
 * every other is two or three words. A board with most of a family on it reads as
 * that theme, and the same theme board after board is what makes a course feel
 * samey, even when every single word is at an ordinary count.
 */
function sharedClueCosine(data) {
  const l = data.input.lcsi.json
  const ids = l.wordIds, n = ids.length
  const deg = new Array(n).fill(0), sim = Array.from({ length: n }, () => new Array(n).fill(0))
  for (const [, rows] of l.clues) {
    const strong = rows.filter((r) => r[1] >= 53.3).map((r) => r[0])
    for (const i of strong) deg[i]++
    for (let a = 0; a < strong.length; a++) for (let b = a + 1; b < strong.length; b++) { sim[strong[a]][strong[b]]++; sim[strong[b]][strong[a]]++ }
  }
  return { ids, n, cos: (a, b) => sim[a][b] / Math.sqrt(Math.max(1, deg[a]) * Math.max(1, deg[b])) }
}

/**
 * Linked pairs: two words that share enough strong clues (the same cosine and
 * threshold as the families). A player clues them together, so two boards with
 * the same linked pair close together feel like the same game, and a linked pair
 * back on one key soon invites the very same clue.
 */
function linkedPairs(data) {
  const { ids, n, cos } = sharedClueCosine(data)
  const pairs = []
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (cos(a, b) >= 0.18) pairs.push([ids[a], ids[b]].sort())
  return pairs
}

function wordFamilies(data) {
  const { ids, cos } = sharedClueCosine(data)
  const link = (A, B) => { let t = 0; for (const a of A) for (const b of B) t += cos(a, b); return t / (A.length * B.length) }
  const clusters = ids.map((_, i) => [i])
  for (;;) {
    let best = null, value = 0
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) { const v = link(clusters[i], clusters[j]); if (v > value) { value = v; best = [i, j] } }
    if (!best || value < 0.18) break
    clusters[best[0]] = [...clusters[best[0]], ...clusters[best[1]]]
    clusters.splice(best[1], 1)
  }
  return clusters.filter((c) => c.length >= 3).map((c) => c.map((i) => ids[i]).sort())
}

/**
 * Boards the course must hold: every appended board (each was added for a word's
 * scarce turns), and every board that gives a word one of its MIN_TURNS or fewer
 * turns on a key anywhere in the archive. Leaving one out takes a turn away that
 * no other board can give back.
 */
function pinnedBoards(data) {
  const pool = data.cycle.filter((board) => !sameRootBoard(board))
  const pinned = new Set(pool.filter((board) => Number(board.id.slice(5)) > 150).map((board) => board.id))
  for (const id of data.roster) {
    for (const key of ['playerGreenIds', 'aiGreenIds']) {
      const holders = pool.filter((board) => board[key].includes(id))
      if (holders.length <= MIN_TURNS) for (const board of holders) pinned.add(board.id)
    }
  }
  return [...pinned].sort()
}

// ---- measurement ---------------------------------------------------------------
/**
 * How words come back. A return is a word's green turn after an earlier green
 * turn (bystander appearances are exposure, not a turn, and are skipped). It
 * returns on the SAME KEY when both turns are on the player's key or both on
 * Casey's (a shared green is on both and never counts), and BESIDE AN OLD MATE
 * when a word it shared a designed clue group with last time shares one with it
 * again. The designed groups are the composer's two triples and pair a side.
 */
function returns(data, boards) {
  const last = new Map()
  let greenReturns = 0, sameKey = 0, sameMates = 0
  const repeated = new Map()
  for (const board of boards) {
    const groups = data.groups.get(board.id)
    const pairsHere = new Set()
    for (const w of board.wordIds) {
      const p = board.playerGreenIds.includes(w), c = board.aiGreenIds.includes(w)
      if (!p && !c) continue
      const role = p && c ? 'shared' : p ? 'player' : 'casey'
      const mates = groups.filter((g) => g.ids.includes(w)).flatMap((g) => g.ids.filter((x) => x !== w))
      const prev = last.get(w)
      if (prev) {
        greenReturns++
        if (role !== 'shared' && role === prev.role) sameKey++
        const again = mates.filter((m) => prev.mates.includes(m))
        if (again.length) sameMates++
        for (const m of again) pairsHere.add([w, m].sort().join('+'))
      }
      last.set(w, { role, mates })
    }
    for (const key of pairsHere) repeated.set(key, (repeated.get(key) ?? 0) + 1)
  }
  const share = (n) => Number((n / greenReturns).toFixed(3))
  return {
    greenReturns,
    sameKeyShare: share(sameKey),
    sameGroupMateShare: share(sameMates),
    topRepeatedMates: [...repeated].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6)
      .map(([key, n]) => ({ words: key.split('+').map((id) => data.words.get(id)?.da ?? id), times: n })),
  }
}

/**
 * How themed the boards are: a board carrying three or more words of one family
 * reads as that family's board, and two boards in a row that each carry two or
 * more of the same family feel like the same board again.
 */
function themes(data, boards) {
  const families = wordFamilies(data)
  const time = families.findIndex((f) => f.includes('da:tid'))
  const loads = boards.map((b) => families.map((f) => b.wordIds.filter((id) => f.includes(id)).length))
  const within = (n) => {
    const L = loads.slice(0, n)
    return {
      boardsWithThreeOfAFamily: L.filter((l) => l.some((k) => k >= 3)).length,
      boardsWithTwoOrMoreTimeWords: time < 0 ? null : L.filter((l) => l[time] >= 2).length,
      boardsWithThreeOrMoreTimeWords: time < 0 ? null : L.filter((l) => l[time] >= 3).length,
      themeCarriedOver: L.slice(1).filter((l, i) => l.some((k, f) => k >= 2 && L[i][f] >= 2)).length,
    }
  }
  return { families: families.map((f) => f.map((id) => data.words.get(id)?.da ?? id)), first50: within(50), course: within(boards.length) }
}

/**
 * How soon things come back. For each linked pair: the gap (in boards) since the
 * two last met on a board, and since they were last on one key together. For each
 * of Casey's pre-written clue words: the gap since a board last offered it.
 */
function spacing(data, boards) {
  const pairs = linkedPairs(data)
  const clues = new Map(data.input.caseyClues.json.boards.map((b) => [b.id, [...new Set(b.caseyClueGroups.map((g) => g.clue))]]))
  const meet = new Map(), key = new Map(), clue = new Map()
  const within = { meet3: 0, meet6: 0, meets: 0, sameKey5: 0, sameKey10: 0, sameKeys: 0, clue3: 0, clue6: 0, clues: 0 }
  const tight = new Map()
  boards.forEach((b, p) => {
    for (const [x, y] of pairs) {
      if (!b.wordIds.includes(x) || !b.wordIds.includes(y)) continue
      const k = `${x}+${y}`
      if (meet.has(k)) {
        const g = p - meet.get(k)
        within.meets++; if (g <= 3) within.meet3++; if (g <= 6) within.meet6++
        tight.set(k, Math.min(tight.get(k) ?? Infinity, g))
      }
      meet.set(k, p)
      const together = (b.playerGreenIds.includes(x) && b.playerGreenIds.includes(y)) || (b.aiGreenIds.includes(x) && b.aiGreenIds.includes(y))
      if (together) {
        if (key.has(k)) { const g = p - key.get(k); within.sameKeys++; if (g <= 5) within.sameKey5++; if (g <= 10) within.sameKey10++ }
        key.set(k, p)
      }
    }
    for (const c of clues.get(b.id) ?? []) {
      if (clue.has(c)) { const g = p - clue.get(c); within.clues++; if (g <= 3) within.clue3++; if (g <= 6) within.clue6++ }
      clue.set(c, p)
    }
  })
  const tightest = [...tight].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, 5)
    .map(([k, g]) => ({ words: k.split('+').map((id) => data.words.get(id)?.da ?? id), closestGap: g }))
  return { linkedPairs: pairs.length, ...within, tightest }
}

/** Everything the report, the rules and the search read, for one ordered course. */
function measure(data, boards) {
  const { roster } = data
  const turns = (key) => new Map(roster.map((id) => [id, boards.flatMap((board, index) => (board[key].includes(id) ? [index + 1] : []))]))
  const longestWait = (positions) => positions.length ? Math.max(positions[0], ...positions.slice(1).map((p, i) => p - positions[i])) : null
  const player = turns('playerGreenIds'), casey = turns('aiGreenIds')
  const seen = new Map(roster.map((id) => [id, boards.flatMap((board, index) => (board.wordIds.includes(id) ? [index + 1] : []))]))
  const words = roster.map((id) => ({
    id, da: data.words.get(id)?.da ?? null,
    appearances: seen.get(id).length,
    firstBoardsAppearances: seen.get(id).filter((p) => p <= EARLY).length,
    playerKey: player.get(id).length, caseyKey: casey.get(id).length,
    firstOnPlayerKey: player.get(id)[0] ?? null, firstOnCaseyKey: casey.get(id)[0] ?? null,
    longestPlayerWait: longestWait(player.get(id)), longestCaseyWait: longestWait(casey.get(id)),
  }))
  const both = (n) => roster.filter((id) => (player.get(id)[0] ?? Infinity) <= n && (casey.get(id)[0] ?? Infinity) <= n).length
  const pairs = new Map()
  for (const board of boards) {
    const ids = [...board.wordIds].sort()
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const key = `${ids[i]}+${ids[j]}`
      pairs.set(key, (pairs.get(key) ?? 0) + 1)
    }
  }
  const topPairs = [...pairs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
    .map(([key, n]) => ({ words: key.split('+').map((id) => data.words.get(id)?.da ?? id), boards: n }))
  const mean = (list) => Number((list.reduce((sum, board) => sum + data.difficulty.get(board.id), 0) / list.length).toFixed(3))
  let previous = 0
  for (let i = 1; i < boards.length; i++) previous += boards[i].wordIds.filter((id) => boards[i - 1].wordIds.includes(id)).length
  const range = (field) => [Math.min(...words.map((w) => w[field] ?? Infinity)), Math.max(...words.map((w) => w[field] ?? -Infinity))]
  return {
    words,
    bothKeysAfter: Object.fromEntries([10, 20, 28, 40, 60, 100].filter((n) => n <= boards.length).map((n) => [n, both(n)])),
    allBothKeysBy: Array.from({ length: boards.length }, (_, i) => i + 1).find((n) => both(n) === roster.length) ?? null,
    longestCaseyWait: range('longestCaseyWait')[1],
    medianLongestCaseyWait: words.map((w) => w.longestCaseyWait).sort((a, b) => a - b)[Math.floor(words.length / 2)],
    longestPlayerWait: range('longestPlayerWait')[1],
    appearances: range('appearances'),
    firstBoardsAppearances: range('firstBoardsAppearances'),
    playerKeyTurns: range('playerKey'),
    caseyKeyTurns: range('caseyKey'),
    sameRootBoards: boards.filter(sameRootBoard).map((board) => board.id),
    maxPairBoards: topPairs[0].boards,
    topPairs,
    sharedWithPreviousBoard: Number((previous / (boards.length - 1)).toFixed(2)),
    difficulty: { first10: mean(boards.slice(0, 10)), last10: mean(boards.slice(-10)) },
    overlapMix: Object.fromEntries([1, 2, 3].map((k) => [k, boards.filter((board) => board.greenOverlap === k).length])),
    returns: returns(data, boards),
    themes: themes(data, boards),
    spacing: spacing(data, boards),
    appendixBoards: boards.filter((board) => Number(board.id.slice(5)) > 150).map((board) => board.id),
  }
}

// ---- the rules, checked --------------------------------------------------------
function checkRules(data, ids) {
  need(ids.length === COUNT && new Set(ids).size === COUNT, `the course is not ${COUNT} distinct boards`)
  need(ids[0] === FIRST_BOARD, `the course must open on ${FIRST_BOARD}`)
  const boards = ids.map((id) => data.byId.get(id) ?? fail(`${id} is not an authored board`))
  const m = measure(data, boards)
  need(m.sameRootBoards.length === 0, `same-root words share a board: ${m.sameRootBoards.join(', ')}`)
  const missing = pinnedBoards(data).filter((id) => !ids.includes(id))
  need(missing.length === 0, `the course leaves out boards that carry a scarce turn or were appended for one: ${missing.join(', ')}`)
  for (const w of m.words) {
    need(w.playerKey > 0, `${w.id} is never on the player's key`)
    need(w.caseyKey > 0, `${w.id} is never on Casey's key`)
  }
  need(m.allBothKeysBy !== null && m.allBothKeysBy <= BOTH_KEYS_BY, `not every word is on both keys by board ${BOTH_KEYS_BY} (${m.allBothKeysBy})`)
  need(m.longestCaseyWait <= MAX_CASEY_WAIT, `a word waits ${m.longestCaseyWait} boards for Casey's key (limit ${MAX_CASEY_WAIT})`)
  need(m.longestPlayerWait <= MAX_PLAYER_WAIT, `a word waits ${m.longestPlayerWait} boards for the player's key (limit ${MAX_PLAYER_WAIT})`)
  need(m.firstBoardsAppearances[0] >= EARLY_MIN && m.firstBoardsAppearances[1] <= EARLY_MAX,
    `the first ${EARLY} boards show a word ${m.firstBoardsAppearances.join('-')} times (allowed ${EARLY_MIN}-${EARLY_MAX})`)
  need(m.maxPairBoards <= MAX_PAIR, `two words share ${m.maxPairBoards} boards (limit ${MAX_PAIR})`)
  need(m.difficulty.first10 <= MAX_OPENING_DIFFICULTY, `the opening ten boards average difficulty ${m.difficulty.first10}`)
  need(m.themes.first50.boardsWithThreeOfAFamily <= MAX_THEMED_EARLY, `${m.themes.first50.boardsWithThreeOfAFamily} of the first 50 boards carry three words of one family (limit ${MAX_THEMED_EARLY})`)
  need(m.themes.first50.themeCarriedOver <= MAX_CARRIED_EARLY, `a family theme carries over between consecutive boards ${m.themes.first50.themeCarriedOver} times in the first 50`)
  need(m.spacing.sameKey5 <= MAX_KEY_REPEAT_5, `a linked pair is back on one key within 5 boards ${m.spacing.sameKey5} times (limit ${MAX_KEY_REPEAT_5})`)
  need(m.spacing.meet3 <= MAX_MEET_REPEAT_3, `a linked pair meets again within 3 boards ${m.spacing.meet3} times (limit ${MAX_MEET_REPEAT_3})`)
  need(m.returns.sameKeyShare <= MAX_SAME_KEY_SHARE, `${Math.round(m.returns.sameKeyShare * 100)}% of returns are on the same key as last time (limit ${MAX_SAME_KEY_SHARE * 100}%)`)
  need(m.returns.sameGroupMateShare <= MAX_SAME_MATE_SHARE, `${Math.round(m.returns.sameGroupMateShare * 100)}% of returns are beside an old clue-group mate (limit ${MAX_SAME_MATE_SHARE * 100}%)`)
  return { boards, measured: m }
}

/** Every chosen board still resolves through the exact Worker and client seams it did in v1. */
function checkSupport(data, boards) {
  const support = Object.fromEntries(Object.entries(SUPPORT).map(([name, path]) => [name, read(path).json]))
  const authored = new Map(support.workerAuthoredClues.boards.map((board) => [board.id, board]))
  const playerKeys = new Map(support.workerPlayerKeys.boards.map((board) => [board.id, board]))
  const legal = new Map(support.workerLegalClues.boards.map((board) => [board.board, board]))
  const opening = new Map(support.clientOpeningClues.boards.map((board) => [board.id, board]))
  for (const board of boards) {
    const a = authored.get(board.id), p = playerKeys.get(board.id), l = legal.get(board.id), o = opening.get(board.id)
    need(a && exact(a.wordIds, board.wordIds) && exact(a.aiGreenIds, board.aiGreenIds), `${board.id} Worker authored identity differs`)
    need(p && exact(p.wordIds, board.wordIds) && exact(p.playerGreenIds, board.playerGreenIds), `${board.id} Worker player-key identity differs`)
    need(l?.wordKey === [...board.wordIds].sort().join('|'), `${board.id} Worker legal-clue identity differs`)
    need(o && a.caseyClueGroups.some((g) => g.clue === o.clue && exact(g.targetWordIds, o.targetWordIds)), `${board.id} opening clue is not backed by its authored groups`)
  }
  return boards.length
}

// ---- the search ----------------------------------------------------------------
/**
 * What the search minimises. Waits dominate: a squared penalty on every stretch a
 * word spends off a key beyond a tolerance (18 boards before its first turn, 14
 * between turns), half again as heavy for Casey's key, since that is the turn
 * the player cannot make happen. Then spread (appearances near 18 overall and
 * near 5 in the first 28, with a band), repeated pairs, words shared with the
 * previous board, and a gentle opening. Then how words come back (`returns`):
 * a flat cost for every return on the same key as last time, and for every
 * return beside a clue-group mate it had last time. Weights are stage-dependent:
 * the first stage finds a good region with the spread terms soft; the second
 * tightens them.
 */
function makeCost(data, pool, weights) {
  const R = data.roster.length
  const last = new Int32Array(R), seen = new Uint8Array(R), app = new Int32Array(R), early = new Int32Array(R), co = new Int32Array(R * R)
  const lastRole = new Int8Array(R), lastMates = new Int32Array(R * 4)
  const lastMeet = new Int32Array(pool.linkedCount), lastKey = new Int32Array(pool.linkedCount), lastClue = new Int32Array(pool.clueCount)
  const playerTurns = new Int32Array(R), caseyTurns = new Int32Array(R)
  const needPlayer = new Int32Array(R), needCasey = new Int32Array(R)
  for (const b of pool) { for (const w of b.P) needPlayer[w]++; for (const w of b.C) needCasey[w]++ }
  for (let w = 0; w < R; w++) { needPlayer[w] = Math.min(MIN_TURNS, needPlayer[w]); needCasey[w] = Math.min(MIN_TURNS, needCasey[w]) }
  const target = EARLY * 0.18
  return (seq) => {
    let c = 0
    lastMeet.fill(-1000); lastKey.fill(-1000); lastClue.fill(-1000)
    for (let p = 0; p < seq.length; p++) {
      const b = pool[seq[p]]
      for (let t = 0; t < b.pairs.length; t++) {
        const k = b.pairs[t], g = p - lastMeet[k]
        if (g < MEET_GAP) c += weights.meet * (MEET_GAP - g) * (MEET_GAP - g)
        lastMeet[k] = p
      }
      for (let t = 0; t < b.keyPairs.length; t++) {
        const k = b.keyPairs[t], g = p - lastKey[k]
        if (g < KEY_GAP) c += weights.key * (KEY_GAP - g) * (KEY_GAP - g)
        lastKey[k] = p
      }
      for (let t = 0; t < b.clues.length; t++) {
        const k = b.clues[t], g = p - lastClue[k]
        if (g < CLUE_GAP) c += weights.clue * (CLUE_GAP - g) * (CLUE_GAP - g)
        lastClue[k] = p
      }
    }
    for (let p = 0; p < seq.length; p++) {
      const load = pool[seq[p]].load, prev = p ? pool[seq[p - 1]].load : null, early = p < 50 ? 2 : 1
      for (let f = 0; f < load.length; f++) {
        if (load[f] > 2) c += weights.family * (load[f] - 2) * (load[f] - 2) * early
        if (prev && load[f] >= 2 && prev[f] >= 2) c += weights.carry * early
      }
    }
    lastRole.fill(0)
    for (let p = 0; p < seq.length; p++) {
      const b = pool[seq[p]]
      for (let t = 0; t < b.G.length; t++) {
        const w = b.G[t], role = b.role[w], prev = lastRole[w]
        if (prev) {
          if (role !== 3 && role === prev) c += weights.role
          let again = false
          for (let i = 0; i < 4 && !again; i++) {
            const m = b.mates[w * 4 + i]
            if (m < 0) break
            for (let j = 0; j < 4; j++) { const n = lastMates[w * 4 + j]; if (n < 0) break; if (n === m) { again = true; break } }
          }
          if (again) c += weights.mate
        }
        lastRole[w] = role
        for (let i = 0; i < 4; i++) lastMates[w * 4 + i] = b.mates[w * 4 + i]
      }
    }
    for (let k = 0; k < 2; k++) {
      const wgt = (k ? 1.5 : 1) * WAIT_WEIGHT
      last.fill(0); seen.fill(0)
      for (let p = 0; p < seq.length; p++) {
        const ws = k ? pool[seq[p]].C : pool[seq[p]].P
        for (let t = 0; t < ws.length; t++) {
          const w = ws[t], g = p + 1 - last[w], tol = seen[w] ? 14 : 18
          if (g > tol) c += wgt * (g - tol) * (g - tol)
          last[w] = p + 1; seen[w] = 1
        }
      }
      for (let w = 0; w < R; w++) {
        if (!seen[w]) { c += wgt * 5000; continue }
        // The wait for a turn that never comes: from the last turn to the end.
        const tail = seq.length + 1 - last[w]
        if (tail > TAIL) c += wgt * (tail - TAIL) * (tail - TAIL)
      }
      // Up to three turns a key, as far as the pool allows (`need`).
      const turns = k ? caseyTurns : playerTurns
      turns.fill(0)
      for (let p = 0; p < seq.length; p++) { const ws = k ? pool[seq[p]].C : pool[seq[p]].P; for (let t = 0; t < ws.length; t++) turns[ws[t]]++ }
      const need = k ? needCasey : needPlayer
      for (let w = 0; w < R; w++) if (turns[w] < need[w]) c += 500 * (need[w] - turns[w])
    }
    app.fill(0); early.fill(0); co.fill(0)
    let overlap = 0
    for (let p = 0; p < seq.length; p++) {
      const A = pool[seq[p]].A
      for (let i = 0; i < A.length; i++) {
        const w = A[i]; app[w]++; if (p < EARLY) early[w]++
        for (let j = i + 1; j < A.length; j++) co[w * R + A[j]]++
      }
      if (p) {
        const B = pool[seq[p - 1]].A; let i = 0, j = 0
        while (i < A.length && j < B.length) { if (A[i] === B[j]) { overlap++; i++; j++ } else if (A[i] < B[j]) i++; else j++ }
      }
    }
    for (let w = 0; w < R; w++) {
      c += 2 * (app[w] - 18) ** 2 + weights.early * (early[w] - target) ** 2
      c += weights.band * (Math.max(0, early[w] - 7) ** 2 + Math.max(0, 3 - early[w]) ** 2)
    }
    for (let i = 0; i < co.length; i++) if (co[i] > 6) c += 30 * (co[i] - 6) ** 2
    c += 20 * overlap
    let run = 0
    for (let p = 0; p < seq.length; p++) {
      const d = pool[seq[p]].d
      if (p < 10 && d > 0.4) c += 4000 * (d - 0.4) ** 2 * (10 - p)
      run = d >= 0.55 ? run + 1 : 0
      if (run >= 3) c += 500
    }
    return c
  }
}

function lcg(seed) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296)
}

function anneal(cost, start, candidates, { seed, iterations, t0, t1 }, pinned = new Set()) {
  const rnd = lcg(seed)
  const ri = (n) => Math.floor(rnd() * n)
  let seq = start.slice()
  let out = candidates.filter((i) => !seq.includes(i))
  let current = cost(seq), best = seq.slice(), bestCost = current
  for (let it = 0; it < iterations; it++) {
    const t = t0 * (t1 / t0) ** (it / iterations)
    const move = rnd()
    const next = seq.slice(); let nextOut = out
    const a = 1 + ri(COUNT - 1)
    if (move < 0.35) { const b = 1 + ri(COUNT - 1); [next[a], next[b]] = [next[b], next[a]] }
    else if (move < 0.7) { const b = 1 + ri(COUNT - 1); const [x] = next.splice(a, 1); next.splice(b, 0, x) }
    else {
      if (pinned.has(next[a])) continue // a pinned board may move, never leave
      const k = ri(out.length); nextOut = out.slice(); [next[a], nextOut[k]] = [nextOut[k], next[a]]
    }
    const c = cost(next)
    if (c <= current || rnd() < Math.exp((current - c) / t)) {
      seq = next; out = nextOut; current = c
      if (c < bestCost) { best = next; bestCost = c }
    }
  }
  return { seq: best, cost: bestCost }
}

/** Search only: a linked pair meeting again sooner than this many boards costs (MEET_GAP - gap)². */
const MEET_GAP = Number(process.env.MEET_GAP ?? 6)
/** …back on one key together sooner than this… */
const KEY_GAP = Number(process.env.KEY_GAP ?? 10)
/** …and one of Casey's clue words offered again sooner than this. */
const CLUE_GAP = Number(process.env.CLUE_GAP ?? 6)
/** Search only: multiplies both stages' iterations (recorded with the result). */
const SEARCH_SCALE = Number(process.env.SEARCH_SCALE ?? 1)
export const SEARCH = {
  gaps: { meet: MEET_GAP, key: KEY_GAP, clue: CLUE_GAP },
  stage1: { iterations: 1_000_000 * SEARCH_SCALE, t0: 400, t1: 0.5, weights: { early: 6, band: 0, role: Number(process.env.W_ROLE ?? 60), mate: Number(process.env.W_MATE ?? 100), family: Number(process.env.W_FAMILY ?? 400), carry: Number(process.env.W_CARRY ?? 200), meet: Number(process.env.W_MEET ?? 30), key: Number(process.env.W_KEY ?? 25), clue: Number(process.env.W_CLUE ?? 20) } },
  stage2: { iterations: 3_000_000 * SEARCH_SCALE, t0: 60, t1: 0.3, weights: { early: 15, band: 150, role: Number(process.env.W_ROLE ?? 60), mate: Number(process.env.W_MATE ?? 100), family: Number(process.env.W_FAMILY ?? 400), carry: Number(process.env.W_CARRY ?? 200), meet: Number(process.env.W_MEET ?? 30), key: Number(process.env.W_KEY ?? 25), clue: Number(process.env.W_CLUE ?? 20) } },
}

function search(data, seed) {
  const R = new Map(data.roster.map((id, i) => [id, i]))
  const families = wordFamilies(data)
  const linked = linkedPairs(data)
  const clueIndex = new Map()
  const caseyClues = new Map(data.input.caseyClues.json.boards.map((b) => [b.id, [...new Set(b.caseyClueGroups.map((g) => g.clue))]]))
  const pool = data.cycle.filter((board) => !sameRootBoard(board)).map((board) => {
    // role per word: 1 player's key, 2 Casey's, 3 both; mates: up to four designed-group mates, -1 padded
    const role = new Int8Array(R.size), mates = new Int32Array(R.size * 4).fill(-1)
    const greens = [...new Set([...board.playerGreenIds, ...board.aiGreenIds])]
    for (const id of greens) {
      const w = R.get(id)
      role[w] = (board.playerGreenIds.includes(id) ? 1 : 0) + (board.aiGreenIds.includes(id) ? 2 : 0)
      const m = data.groups.get(board.id).filter((g) => g.ids.includes(id)).flatMap((g) => g.ids.filter((x) => x !== id))
      m.slice(0, 4).forEach((x, i) => { mates[w * 4 + i] = R.get(x) })
    }
    return {
      id: board.id, d: data.difficulty.get(board.id),
      P: Int32Array.from(board.playerGreenIds.map((id) => R.get(id))),
      C: Int32Array.from(board.aiGreenIds.map((id) => R.get(id))),
      A: Int32Array.from(board.wordIds.map((id) => R.get(id)).sort((a, b) => a - b)),
      G: Int32Array.from(greens.map((id) => R.get(id))), role, mates,
      load: Int8Array.from(families.map((f) => board.wordIds.filter((id) => f.includes(id)).length)),
      pairs: Int32Array.from(linked.flatMap(([x, y], i) => (board.wordIds.includes(x) && board.wordIds.includes(y) ? [i] : []))),
      keyPairs: Int32Array.from(linked.flatMap(([x, y], i) => (((board.playerGreenIds.includes(x) && board.playerGreenIds.includes(y)) ||
        (board.aiGreenIds.includes(x) && board.aiGreenIds.includes(y))) ? [i] : []))),
      clues: Int32Array.from((caseyClues.get(board.id) ?? []).map((c) => { if (!clueIndex.has(c)) clueIndex.set(c, clueIndex.size); return clueIndex.get(c) })),
    }
  })
  pool.linkedCount = linked.length
  pool.clueCount = clueIndex.size
  const first = pool.findIndex((board) => board.id === FIRST_BOARD)
  const candidates = pool.map((_, i) => i).filter((i) => i !== first)
  const rnd = lcg(seed ^ 0x5eed)
  const shuffled = candidates.slice()
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
  const pinned = new Set(pinnedBoards(data).map((id) => pool.findIndex((board) => board.id === id)))
  const start = [first, ...[...pinned].filter((i) => i !== first), ...shuffled.filter((i) => !pinned.has(i))].slice(0, COUNT)
  if (start.length !== COUNT || new Set(start).size !== COUNT) fail('the pinned boards do not fit the course')
  const one = anneal(makeCost(data, pool, SEARCH.stage1.weights), start, candidates, { seed, ...SEARCH.stage1 }, pinned)
  const two = anneal(makeCost(data, pool, SEARCH.stage2.weights), one.seq, candidates, { seed: seed + 1, ...SEARCH.stage2 }, pinned)
  return { ids: two.seq.map((i) => pool[i].id), cost: Math.round(two.cost) }
}

// ---- artifacts -----------------------------------------------------------------
function manifestText(previous, ids, pins) {
  const head = {
    schemaVersion: 1,
    kind: 'city1-required-board-manifest',
    status: 'approved-frozen',
    boardSetVersion: 'city1-required-boards-v2',
    supersedes: 'city1-required-boards-v1',
    learnerCourse: 'da',
    stableCityId: 'sonderborg',
    requiredBoardCount: COUNT,
    claimIdentityFields: previous.claimIdentityFields,
    contentRevisionRule: previous.contentRevisionRule,
    approval: { owner: 'Kristoffer, chat 2026-09-27', baseSha: BASE_SHA, search: pins.search },
    sources: pins.sources,
    approvedEvidence: pins.evidence,
  }
  let text = JSON.stringify(head, null, 2).replace(/\n}$/, '')
  text += ',\n  "requiredBoards": [\n' + ids.map((id) => `    { "authoredBoardId": "${id}", "contentRevision": "1" }`).join(',\n') + '\n  ],\n'
  text += '  "displayOrder": [\n' + ids.map((id) => `    "${id}"`).join(',\n') + '\n  ]\n}\n'
  return text
}

function evidenceFiles(data, ids, searchRecord) {
  const { boards, measured } = checkRules(data, ids)
  const supported = checkSupport(data, boards)
  const v1Ids = data.input.supersededManifest.json.displayOrder
  const v1 = measure(data, v1Ids.map((id) => data.byId.get(id)))
  const inputs = Object.fromEntries(Object.entries(data.input).map(([name, value]) => [name, { path: value.path, sha256: value.sha256 }]))
  const rules = { count: COUNT, firstBoard: FIRST_BOARD, sameRootPairs: SAME_ROOT, bothKeysBy: BOTH_KEYS_BY, maxCaseyWait: MAX_CASEY_WAIT,
    maxPlayerWait: MAX_PLAYER_WAIT, firstBoards: EARLY, firstBoardsAppearances: [EARLY_MIN, EARLY_MAX], maxPairBoards: MAX_PAIR,
    maxOpeningDifficulty: MAX_OPENING_DIFFICULTY, maxSameKeyShare: MAX_SAME_KEY_SHARE, maxSameGroupMateShare: MAX_SAME_MATE_SHARE,
    minTurnsPerKey: MIN_TURNS, pinnedBoards: pinnedBoards(data), maxThemedBoardsInFirst50: MAX_THEMED_EARLY, maxThemeCarryOverInFirst50: MAX_CARRIED_EARLY,
    maxLinkedPairBackOnOneKeyWithin5: MAX_KEY_REPEAT_5, maxLinkedPairMeetingWithin3: MAX_MEET_REPEAT_3 }
  const summary = (m) => { const { words, ...rest } = m; return rest }
  const candidate = {
    schemaVersion: 1, kind: 'city1-required-board-candidate-v2', baseSha: BASE_SHA, search: searchRecord,
    boardIds: ids, keptFromV1: ids.filter((id) => v1Ids.includes(id)).length,
    addedFromArchive: ids.filter((id) => !v1Ids.includes(id)), droppedFromV1: v1Ids.filter((id) => !ids.includes(id)),
    workerAndClientLookupMappings: supported,
  }
  const coverage = { schemaVersion: 1, kind: 'city1-board-coverage-v2', baseSha: BASE_SHA, noLiveCalls: true, inputs, rules,
    v2: summary(measured), v1: summary(v1), words: measured.words }
  const row = (label, a, b) => `| ${label} | ${a} | ${b} |`
  const pct = (share) => `${Math.round(share * 100)}%`
  const mates = (list) => list.slice(0, 3).map((m) => `${m.words.join('+')} ${m.times}`).join(', ')
  const span = (r) => `${r[0]}–${r[1]}`
  const report = [
    '# City 1 required-board set v2: balance audit',
    '',
    `> **Status: reference.** Deterministic evidence for \`city1-required-boards-v2\` (owner decision 2026-09-27), from base \`${BASE_SHA}\`. Regenerate with \`node scripts/select-city1-board-set-v2.mjs\`; \`--check\` verifies it. No model, index, judge, audio or network call is part of it.`,
    '',
    '## What changed',
    '',
    `v2 is 100 of the ${data.cycle.length} authored boards (the 150 of the archive and ${data.cycle.length - 150} verified boards appended after it), each exactly as authored, chosen and ordered by the rules below. ${candidate.keptFromV1} boards are kept from v1, ${candidate.addedFromArchive.length} come in from the rest of the archive (${measured.appendixBoards.length} of them from the appendix: ${measured.appendixBoards.join(', ') || 'none'}), and ${candidate.droppedFromV1.length} v1 boards leave the course (they stay in the archive and keep any claims already earned on them). It opens on \`${FIRST_BOARD}\`.`,
    '',
    '## Rules (checked)',
    '',
    `- No board holds both ${SAME_ROOT.map(([a, b]) => `«${data.words.get(a).da}» and «${data.words.get(b).da}»`).join(', ')}.`,
    `- Every word is on the player's key and on Casey's key at least once, and on both by board ${BOTH_KEYS_BY}.`,
    `- No word waits more than ${MAX_CASEY_WAIT} boards for its next turn on Casey's key, or ${MAX_PLAYER_WAIT} for the player's, while it still has one.`,
    `- The first ${EARLY} boards show every word ${EARLY_MIN}–${EARLY_MAX} times; no two words share more than ${MAX_PAIR} boards.`,
    `- The first ten boards average bank difficulty at most ${MAX_OPENING_DIFFICULTY}.`,
    `- A word that comes back is on the same key as its last green turn in at most ${MAX_SAME_KEY_SHARE * 100}% of returns, and beside a clue-group mate it had last time in at most ${MAX_SAME_MATE_SHARE * 100}%.`,
    `- No linked pair (two words that share many strong clues) meets again within 3 boards${MAX_MEET_REPEAT_3 ? ` more than ${MAX_MEET_REPEAT_3} times` : ''}, or is back on one key together within 5 boards${MAX_KEY_REPEAT_5 ? ` more than ${MAX_KEY_REPEAT_5} times` : ''}.`,
    `- In the first 50 boards, at most ${MAX_THEMED_EARLY} carry three or more words of one family, and no family theme carries over from one board to the next. The families come from the shared clues in the LCSI index: ${wordFamilies(data).map((f) => f.map((id) => data.words.get(id)?.da ?? id).join(', ')).join('; ')}.`,
    `- Every appended board is in the course, and so is every board that gives a word one of its ${MIN_TURNS} or fewer turns on a key in the archive (${pinnedBoards(data).length} boards).`,
    `- Every board resolves through the Worker authored-clue, player-key and legal-clue mappings and the client opening clue (${supported}/${COUNT}).`,
    '',
    '## v1 against v2',
    '',
    '| Measure | v1 | v2 |',
    '|---|---:|---:|',
    row(`Boards with ${SAME_ROOT.map(([a, b]) => `«${data.words.get(a).da}» and «${data.words.get(b).da}»`).join(' or ')}`, v1.sameRootBoards.length, measured.sameRootBoards.length),
    row('Every word on both keys by board', v1.allBothKeysBy, measured.allBothKeysBy),
    ...Object.keys(measured.bothKeysAfter).map((n) => row(`Words on both keys after ${n} boards`, v1.bothKeysAfter[n], measured.bothKeysAfter[n])),
    row('Longest wait for a turn on Casey\'s key', v1.longestCaseyWait, measured.longestCaseyWait),
    row('Median word\'s longest wait for Casey\'s key', v1.medianLongestCaseyWait, measured.medianLongestCaseyWait),
    row('Longest wait for a turn on the player\'s key', v1.longestPlayerWait, measured.longestPlayerWait),
    row(`Appearances per word in the first ${EARLY} boards`, span(v1.firstBoardsAppearances), span(measured.firstBoardsAppearances)),
    row('Appearances per word over the course', span(v1.appearances), span(measured.appearances)),
    row('Turns on Casey\'s key per word', span(v1.caseyKeyTurns), span(measured.caseyKeyTurns)),
    row('Most boards two words share', `${v1.maxPairBoards} (${v1.topPairs[0].words.join('+')})`, `${measured.maxPairBoards} (${measured.topPairs[0].words.join('+')})`),
    row('Words shared with the previous board', v1.sharedWithPreviousBoard, measured.sharedWithPreviousBoard),
    row('Difficulty, first ten / last ten boards', `${v1.difficulty.first10} / ${v1.difficulty.last10}`, `${measured.difficulty.first10} / ${measured.difficulty.last10}`),
    row('Shared-green mix 1/2/3', Object.values(v1.overlapMix).join('/'), Object.values(measured.overlapMix).join('/')),
    row('A returning word is on the same key as last time', pct(v1.returns.sameKeyShare), pct(measured.returns.sameKeyShare)),
    row('A returning word is beside a clue-group mate from last time', pct(v1.returns.sameGroupMateShare), pct(measured.returns.sameGroupMateShare)),
    row('First 50: boards with three or more words of one family', v1.themes.first50.boardsWithThreeOfAFamily, measured.themes.first50.boardsWithThreeOfAFamily),
    row('First 50: boards with three or more time words', v1.themes.first50.boardsWithThreeOrMoreTimeWords, measured.themes.first50.boardsWithThreeOrMoreTimeWords),
    row('Same theme on two boards in a row (first 50 / course)', `${v1.themes.first50.themeCarriedOver} / ${v1.themes.course.themeCarriedOver}`, `${measured.themes.first50.themeCarriedOver} / ${measured.themes.course.themeCarriedOver}`),
    row('Linked pairs meeting again within 3 / 6 boards', `${v1.spacing.meet3} / ${v1.spacing.meet6}`, `${measured.spacing.meet3} / ${measured.spacing.meet6}`),
    row('Linked pairs back on one key within 5 / 10 boards', `${v1.spacing.sameKey5} / ${v1.spacing.sameKey10}`, `${measured.spacing.sameKey5} / ${measured.spacing.sameKey10}`),
    row("Casey's clue words offered again within 3 / 6 boards", `${v1.spacing.clue3} / ${v1.spacing.clue6}`, `${measured.spacing.clue3} / ${measured.spacing.clue6}`),
    row('Most repeated clue-group mates', mates(v1.returns.topRepeatedMates), mates(measured.returns.topRepeatedMates)),
    '',
    'A wait is counted in boards, from the start of the course to a word\'s first turn on that key and between its turns. It ends at the last turn: «ny» is on Casey\'s key on two authored boards in the whole archive, and «mulig» on three even with the appendix (bank_151 and bank_153 were appended for it), so after the last of them has passed there is no further turn to wait for. That scarcity is the archive\'s, not the order\'s; the order can only hold every such board and spread them.',
    '',
    '## How the order was found',
    '',
    `A two-stage simulated annealing over membership and order (\`--search --seed ${searchRecord.seed}\`), starting from a seeded shuffle of the ${data.cycle.filter((board) => !sameRootBoard(board)).length} archive boards that pass the same-root rule, with \`${FIRST_BOARD}\` pinned first and the ${pinnedBoards(data).length} required boards held in (they may move, never leave). It minimises squared waits beyond 18 boards before a word's first turn on a key and 14 between turns (Casey's key weighted 1.5), spread of appearances overall and in the first ${EARLY}, pairs sharing more than six boards, words shared with the previous board, difficulty above 0.40 in the opening ten, returns that repeat the last turn (${SEARCH.stage2.weights.role} for a word back on the same key, ${SEARCH.stage2.weights.mate} for a word back beside a clue-group mate it had last time), and themes (${SEARCH.stage2.weights.family} times the square of each word beyond two of one family on a board, ${SEARCH.stage2.weights.carry} for a family theme carried from one board to the next, both doubled in the first 50), and repeats that come too soon (a linked pair meeting again within ${SEARCH.gaps.meet - 1} boards, ${SEARCH.stage2.weights.meet} times the square of how much too soon; back on one key together within ${SEARCH.gaps.key - 1}, ${SEARCH.stage2.weights.key}; one of Casey's clue words offered again within ${SEARCH.gaps.clue - 1}, ${SEARCH.stage2.weights.clue}). Linked pairs are the ${linkedPairs(data).length} word pairs that share enough strong clues in the LCSI index, by the same measure as the families. Final cost ${searchRecord.cost}. The rules above are checked on the result; the search is not re-run by \`--check\`.`,
    '',
    '## Per word',
    '',
    `Counts over the course; \`first\` is the board of the word's first turn on that key; \`wait\` its longest wait for that key.`,
    '',
    '| Word | Boards | First 28 | Your key | Casey\'s key | First yours | First Casey\'s | Wait yours | Wait Casey\'s |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...measured.words.map((w) => `| ${w.da} | ${w.appearances} | ${w.firstBoardsAppearances} | ${w.playerKey} | ${w.caseyKey} | ${w.firstOnPlayerKey} | ${w.firstOnCaseyKey} | ${w.longestPlayerWait} | ${w.longestCaseyWait} |`),
    '',
  ].join('\n')
  return {
    candidate: JSON.stringify(candidate, null, 2) + '\n',
    coverage: JSON.stringify(coverage, null, 2) + '\n',
    report,
  }
}

function build(data, ids, searchRecord) {
  const files = evidenceFiles(data, ids, searchRecord)
  const evidence = {
    candidate: { path: `${EVIDENCE_DIR}/candidate-board-ids.json`, sha256: sha256(Buffer.from(files.candidate)) },
    coverage: { path: `${EVIDENCE_DIR}/coverage.json`, sha256: sha256(Buffer.from(files.coverage)) },
    report: { path: `${EVIDENCE_DIR}/coverage.md`, sha256: sha256(Buffer.from(files.report)) },
  }
  const sources = {
    roster: { path: INPUTS.roster, sha256: data.input.roster.sha256 },
    archivalCycle: { path: INPUTS.cycle, sha256: data.input.cycle.sha256, sourceSha256: data.input.cycle.json.sourceSha256, boardCount: data.input.cycle.json.boards.length },
    cycleAppendix: { path: INPUTS.cycleAppendix, sha256: data.input.cycleAppendix.sha256, boardCount: data.input.cycleAppendix.json.boards.length },
    difficulty: { path: INPUTS.difficulty, sha256: data.input.difficulty.sha256 },
    appendix: { path: INPUTS.appendix, sha256: data.input.appendix.sha256, boardCount: data.input.appendix.json.boards.length },
    supersededManifest: { path: INPUTS.supersededManifest, sha256: data.input.supersededManifest.sha256 },
  }
  const manifest = manifestText(data.input.supersededManifest.json, ids, { sources, evidence, search: searchRecord })
  return { files, evidence, manifest }
}

// ---- main ----------------------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const data = load()

if (flag('--search')) {
  const seed = Number(option('--seed') ?? 1)
  const t = Date.now()
  const found = search(data, seed)
  const record = { seed, cost: found.cost, stages: SEARCH }
  let rules = 'pass'
  try { checkRules(data, found.ids) } catch (error) { rules = String(error.message) }
  const { words, ...summary } = measure(data, found.ids.map((id) => data.byId.get(id)))
  process.stdout.write(`${JSON.stringify({ seed, cost: found.cost, seconds: Math.round((Date.now() - t) / 1000), rules, ...summary, order: found.ids }, null, 2)}\n`)
  if (rules !== 'pass' && flag('--write')) fail(`seed ${seed} breaks a rule, not writing: ${rules}`)
  if (flag('--write')) {
    const built = build(data, found.ids, record)
    mkdirSync(resolve(ROOT, EVIDENCE_DIR), { recursive: true })
    writeFileSync(resolve(ROOT, built.evidence.candidate.path), built.files.candidate)
    writeFileSync(resolve(ROOT, built.evidence.coverage.path), built.files.coverage)
    writeFileSync(resolve(ROOT, built.evidence.report.path), built.files.report)
    writeFileSync(resolve(ROOT, MANIFEST), built.manifest)
    process.stdout.write(`wrote ${MANIFEST} and ${EVIDENCE_DIR}/\n`)
  }
} else {
  const manifest = read(MANIFEST).json
  need(manifest.boardSetVersion === 'city1-required-boards-v2', 'the manifest is not the v2 set')
  need(exact(manifest.requiredBoards.map((entry) => entry.authoredBoardId), manifest.displayOrder), 'requiredBoards and displayOrder differ')
  need(manifest.requiredBoards.every((entry) => entry.contentRevision === '1'), 'a v2 board changed content revision')
  const ids = manifest.displayOrder
  const built = build(data, ids, manifest.approval.search)
  const current = {
    candidate: readFileSync(resolve(ROOT, built.evidence.candidate.path), 'utf8'),
    coverage: readFileSync(resolve(ROOT, built.evidence.coverage.path), 'utf8'),
    report: readFileSync(resolve(ROOT, built.evidence.report.path), 'utf8'),
    manifest: readFileSync(resolve(ROOT, MANIFEST), 'utf8'),
  }
  if (flag('--check')) {
    for (const name of ['candidate', 'coverage', 'report']) need(current[name] === built.files[name], `${EVIDENCE_DIR} ${name} is stale: run node scripts/select-city1-board-set-v2.mjs`)
    need(current.manifest === built.manifest, `${MANIFEST} is stale: run node scripts/select-city1-board-set-v2.mjs`)
    process.stdout.write(`city1 board set v2: ${ids.length} boards, rules hold, evidence current\n`)
  } else {
    mkdirSync(resolve(ROOT, EVIDENCE_DIR), { recursive: true })
    writeFileSync(resolve(ROOT, built.evidence.candidate.path), built.files.candidate)
    writeFileSync(resolve(ROOT, built.evidence.coverage.path), built.files.coverage)
    writeFileSync(resolve(ROOT, built.evidence.report.path), built.files.report)
    writeFileSync(resolve(ROOT, MANIFEST), built.manifest)
    process.stdout.write(`wrote ${MANIFEST} and ${EVIDENCE_DIR}/\n`)
  }
}
