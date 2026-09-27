import { describe, it } from 'vitest'
import { WORDS } from '../data/words'
import type { WordEntry } from '../data/types'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import { CITY1_CLUE_GROUPS } from '../data/city1ClueGroups'
import { BOARD, shippedBoardConfig } from '../engine/config'
import { createGame } from '../engine/game'
import { generateKeys, type KeyPair } from '../engine/keygen'
import { mulberry32, shuffle } from '../engine/rng'
import type { GameState } from '../engine/types'
import { applyRoundResults, newStats, practiceNeed } from '../srs/scheduler'
import { selectBoardWords } from '../srs/sampler'
import type { SrsMap } from '../srs/types'
import { boardWords, playSkilled, resultsFor } from './playSkilled'
import { curriculumBand, wordsForCity } from './progress'
import { wrapUpEvidence, wrapUpUnlocked, wrapUpWords, type GroupEvidence } from './wrapup'
// These two imports are Worker-only data and code, taken deliberately, the way
// `src/ai/local/deal-quality.test.ts` takes the deal gate: a test never enters
// the app graph, and validate-client-boundary still proves the production
// bundle carries no index. The LCSI index is the ruler the City 1 bank was
// composed against, so it is the only honest ruler for "as composed as".
// @ts-expect-error the Worker is plain JS and intentionally outside tsconfig's app types
import { checkClueLegality as workerClueLegality } from '../../proxy/casey/language.js'
import lcsiRaw from '../../proxy/data/lcsi.da.1.json'

/**
 * HOW COMPOSED IS A WRAP-UP BOARD, AND WHAT LIMITS IT. A report harness, opt-in:
 *
 *   WRAPUP_COMPOSITION=1 npx vitest run --reporter=verbose src/journey/wrapup-composition.test.ts
 *
 * An ordinary City 1 round deals one of 150 authored boards, composed against
 * the LCSI index under gate 1 of the bank toolchain (compose.mjs in
 * docs/research/board-engine/city1-bank): every key is two triples and a
 * pair whose links score 53.3 or better with an anchor at 60, every off-key
 * card sits two rungs under the group's weakest link, and every green has a
 * legal single-word clue. Then two model gates. A wrap-up round deals
 * `wrapUpWords`: until 2026-09-11 the collected words, topped up, shuffled,
 * with keys from `generateKeys` — no index, no groups; since then composed
 * from the bank's clue groups and the player's own ledger. This harness
 * measures both with the same gate-1 ruler, so the gap is a number rather
 * than an impression, and with no evidence the composer IS the old draw.
 *
 * MEASURED 2026-09-11 (three tables; the commands print them again):
 *
 * 1. Composition, every deal on the authored roster so the ruler covers
 *    every word. A "group" is a clue linking two or three of a key's greens
 *    that passes gate 1 on that board; "clues to clear" is a greedy cover of
 *    the eight greens by groups and single clues.
 *
 *    boards                          groups/side  greens grouped/8  all 8  connected  clues to clear
 *    authored cycle (150)                  43.2             8.00     100%       82%           3.23
 *    ordinary sampled (local fallback)     13.2             5.77      14%       10%           5.61
 *    wrap-up draw, 8..100 collected    15.2-16.9        6.06-6.51   16-25%    12-18%      5.25-5.47
 *    wrap-up draw, 5 or 15 left            14.6             6.05      19%       15%           5.49
 *
 *    The wrap-up draw is exactly as composed as any non-authored deal, which
 *    is to say not at all: composition comes only from the bank. Dead ends
 *    are zero everywhere (every roster word has a passing single clue), so a
 *    wrap-up board is clueable, just not grouped — five and a half clues to
 *    clear a key that an authored board clears in three.
 *
 * 2. Selection and composition, measured in real play at every mid-city
 *    wrap-up opportunity (WRAPUP_COMPOSITION_K=48; 42 sides over three seeded
 *    cities on the roster). Selection deals K candidates and keeps the best
 *    by the gate-1 ruler, which only the Worker can apply (the index is
 *    SEC3-private), or by an on-device proxy (pairs that sat together on a
 *    shipped authored key). The composer is the shipped `wrapUpWords` with
 *    the bank's clue groups as evidence and an empty player ledger.
 *
 *    pick                                  all 8 grouped  connected  clues to clear  wrappable
 *    today's draw (no evidence)                    12%       12%          5.52          9.3
 *    best of 48 by the ruler (Worker-side)         45%       36%          4.33
 *    best of 48 by the proxy (on-device)           24%       19%          5.02
 *    the shipped composer on the bank's groups     64%       52%          4.31          9.8
 *
 *    The composer gets further than certifying 48 draws by the index would,
 *    with no request, and packs the same number of wrappable words. What is
 *    left to the bank is the two model gates and the bridges its keys were
 *    steered toward; a player's own ledger, which this harness cannot
 *    measure, sits on top of the bank's groups in the shipped deal.
 *
 * 3. The roster. Until 2026-09-11 `wordsForCity(WORDS, 0)` was curriculumRank
 *    1-100 — the wrap-up pool, the suitcase count and the travel gate — and
 *    shared 24 words with the authored roster the 150 boards are built on;
 *    76 City 1 words appeared on no authored board. Measured before the
 *    change: a greedy simulated player walking the cycle wrapped 24 words in
 *    400 rounds, and once those were collected the draw seated only
 *    collected words, so 71 City 1 words were never dealt at all. With City
 *    1 on the roster (owner decision, `docs/DECISIONS.md` 2026-09-11) the
 *    same player wraps the city in about 160 rounds. The harness now prints
 *    the roster world and, beside it, how much of the historical band the
 *    boards ever touched.
 *
 * Honest limits: the ruler is gate 1 only (the bank also passed a concept
 * judge and a blind guesser); the player is a hash with a probability, so
 * nothing here can measure what a player's OWN clue history would add; the
 * proxy and the composer are first versions.
 */

const envVar = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]

const NOW = Date.UTC(2026, 8, 1)

// ---- the gate-1 ruler --------------------------------------------------------

const LADDER = [5, 10, 15, 20, 26.7, 33.3, 40, 46.7, 53.3, 60, 66.7, 73.3, 80, 85, 90, 95]
const rungOf = (s: number) => LADDER.indexOf(s)
const FLOOR = rungOf(53.3)
const ANCHOR = rungOf(60)
const CLEAR = rungOf(60)
const MARGIN = 2

interface ClueRow {
  clue: string
  rungs: Map<string, number>
}
const clueRows: ClueRow[] = []
const clueByName = new Map<string, ClueRow>()
const topClues = new Map<string, { clue: string; rung: number }[]>()
{
  const doc = lcsiRaw as unknown as { wordIds: string[]; clues: [string, [number, number, number][]][] }
  for (const [clue, entries] of doc.clues) {
    const rungs = new Map<string, number>()
    for (const [w, score] of entries) rungs.set(doc.wordIds[w]!, rungOf(score))
    const row = { clue, rungs }
    clueRows.push(row)
    clueByName.set(clue, row)
    for (const [id, r] of rungs) {
      if (r < FLOOR) continue
      if (!topClues.has(id)) topClues.set(id, [])
      topClues.get(id)!.push({ clue, rung: r })
    }
  }
  for (const list of topClues.values()) list.sort((a, b) => b.rung - a.rung)
}

const containsWord = (clue: string, board: WordEntry[]) =>
  board.some((w) => {
    const da = w.da.toLowerCase()
    return da.length >= 3 && clue.toLowerCase() !== da && clue.toLowerCase().includes(da)
  })

/** compose.mjs's judge: legal, no off-key card at 60+, two rungs under the group's weakest link. */
function judge(row: ClueRow, min: number, key: Set<string>, board: WordEntry[]): boolean {
  if (!(workerClueLegality(row.clue, board) as { legal: boolean }).legal) return false
  if (containsWord(row.clue, board)) return false
  let worst = -1
  for (const w of board) {
    if (key.has(w.id)) continue
    const r = row.rungs.get(w.id)
    if (r === undefined) continue
    if (r >= CLEAR) return false
    if (r > worst) worst = r
  }
  return !(worst >= 0 && min - worst < MARGIN)
}

interface SideMetrics {
  groups: number
  covered: number
  singles: number
  components: number
  greedyClues: number
}

function sideMetrics(key: string[], board: WordEntry[]): SideMetrics {
  const keySet = new Set(key)
  const groups: string[][] = []
  for (const row of clueRows) {
    const linked = key
      .filter((id) => (row.rungs.get(id) ?? -1) >= FLOOR)
      .sort((a, b) => row.rungs.get(b)! - row.rungs.get(a)!)
    if (linked.length < 2 || row.rungs.get(linked[0]!)! < ANCHOR) continue
    for (const size of [3, 2]) {
      if (linked.length < size) continue
      const ids = linked.slice(0, size)
      if (judge(row, row.rungs.get(ids[size - 1]!)!, keySet, board)) {
        groups.push(ids)
        break
      }
    }
  }
  const covered = new Set(groups.flat())
  const hasSingle = new Set<string>()
  for (const id of key) {
    for (const t of topClues.get(id) ?? []) {
      if (judge(clueByName.get(t.clue)!, t.rung, keySet, board)) {
        hasSingle.add(id)
        break
      }
    }
  }
  const parent = new Map(key.map((id) => [id, id]))
  const find = (x: string): string => {
    const p = parent.get(x)!
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  for (const g of groups) for (let i = 1; i < g.length; i++) parent.set(find(g[0]!), find(g[i]!))
  const components = new Set(key.map(find)).size
  const uncovered = new Set(key)
  let greedyClues = 0
  for (;;) {
    let best: string[] | null = null
    let bestGain = 1
    for (const g of groups) {
      const gain = g.filter((id) => uncovered.has(id)).length
      if (gain > bestGain) {
        bestGain = gain
        best = g
      }
    }
    if (!best) break
    for (const id of best) uncovered.delete(id)
    greedyClues++
  }
  // A green with no passing clue at all costs a guess or two, not one clue.
  for (const id of uncovered) greedyClues += hasSingle.has(id) ? 1 : 3
  return { groups: groups.length, covered: covered.size, singles: hasSingle.size, components, greedyClues }
}

const sidesOf = (keys: KeyPair, board: WordEntry[]): SideMetrics[] => {
  const ids = board.map((w) => w.id)
  return [
    sideMetrics(ids.filter((id) => keys.playerKey[id] === 'green'), board),
    sideMetrics(ids.filter((id) => keys.aiKey[id] === 'green'), board),
  ]
}

/** Rank candidates: fewer clues to clear, then fewer dead ends. */
const rulerScore = (sides: SideMetrics[]): number =>
  sides.reduce((a, s) => a + s.greedyClues, 0) * 10 + sides.reduce((a, s) => a + (8 - s.singles), 0)

/**
 * An on-device stand-in for the ruler, built only from what the app ships:
 * which pairs of words sat together on an authored key. Fewer components
 * under those edges, then more such pairs, ranks first.
 */
const COKEY = new Set<string>()
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
for (const b of CITY1_BOARD_CYCLE) {
  for (const key of [b.playerGreenIds, b.aiGreenIds]) {
    for (let i = 0; i < key.length; i++) {
      for (let j = i + 1; j < key.length; j++) COKEY.add(pairKey(key[i]!, key[j]!))
    }
  }
}
function proxyScore(keys: KeyPair, board: WordEntry[]): number {
  const ids = board.map((w) => w.id)
  let score = 0
  for (const side of ['playerKey', 'aiKey'] as const) {
    const key = ids.filter((id) => keys[side][id] === 'green')
    const parent = new Map(key.map((id) => [id, id]))
    const find = (x: string): string => {
      const p = parent.get(x)!
      if (p === x) return x
      const root = find(p)
      parent.set(x, root)
      return root
    }
    let pairs = 0
    for (let i = 0; i < key.length; i++) {
      for (let j = i + 1; j < key.length; j++) {
        if (!COKEY.has(pairKey(key[i]!, key[j]!))) continue
        pairs++
        parent.set(find(key[i]!), find(key[j]!))
      }
    }
    score += new Set(key.map(find)).size * 10 - pairs
  }
  return score
}

// ---- rosters and deals -------------------------------------------------------

const byId = new Map(WORDS.map((w) => [w.id, w]))
/** City 1: the authored roster, since 2026-09-11 (`LanguagePack.rosters`). */
const roster = wordsForCity(WORDS, 0)

const collectedOf = (ws: readonly WordEntry[]): SrsMap =>
  Object.fromEntries(ws.map((w) => [w.id, { ...newStats(NOW), seen: 3, greenByClue: 1, greenByGuess: 1 }]))
const discoveredOf = (ws: readonly WordEntry[]): SrsMap =>
  Object.fromEntries(ws.map((w) => [w.id, { ...newStats(NOW), seen: 1 }]))

/** The shipped composer: no evidence is the plain draw, evidence composes. */
function wrapUpDeal(all: readonly WordEntry[], srs: SrsMap, wrapped: Record<string, number>, seed: number, evidence: readonly GroupEvidence[] = []) {
  const config = shippedBoardConfig(seed)
  const deal = wrapUpWords(all, srs, wrapped, 0, mulberry32(seed ^ 0x9e3779b9), new Set(), evidence, config)
  const pool = new Set(deal.wrappable)
  const ids = deal.words.map((w) => w.id)
  const keys: KeyPair = {
    playerKey: Object.fromEntries(ids.map((id) => [id, deal.greens.player.includes(id) ? 'green' : 'bystander'])),
    aiKey: Object.fromEntries(ids.map((id) => [id, deal.greens.ai.includes(id) ? 'green' : 'bystander'])),
  }
  return { deal, keys, pool }
}

const AUTHORED_EVIDENCE = wrapUpEvidence(CITY1_CLUE_GROUPS, { groups: {}, traps: {} })

interface Row {
  label: string
  sides: SideMetrics[]
  extra?: Record<string, string | number>
}

function printComposition(rows: Row[]) {
  console.table(
    rows.map((r) => {
      const n = r.sides.length || 1
      const mean = (f: (s: SideMetrics) => number) => (r.sides.reduce((a, s) => a + f(s), 0) / n).toFixed(2)
      const pct = (f: (s: SideMetrics) => boolean) => `${((100 * r.sides.filter(f).length) / n).toFixed(0)}%`
      return {
        boards: r.label,
        sides: r.sides.length,
        'groups/side': mean((s) => s.groups),
        'greens grouped (of 8)': mean((s) => s.covered),
        'all 8 grouped': pct((s) => s.covered === 8),
        'dead ends/side': mean((s) => 8 - s.singles),
        'connected key': pct((s) => s.components === 1),
        'clues to clear': mean((s) => s.greedyClues),
        ...(r.extra ?? {}),
      }
    }),
  )
}

// ---- the player: `playSkilled.ts`, shared with the pacing harness ------------

type Dealt = ReturnType<typeof wrapUpDeal>

function playCity(
  all: readonly WordEntry[],
  seed: number,
  maxRounds: number,
  /** Called with the deal, the words left to wrap, and a re-draw from the same state. */
  onWrapUp?: (dealt: Dealt, left: number, redeal: (seed: number) => Dealt, state: { srs: SrsMap; wrapped: Record<string, number>; seed: number }) => void,
) {
  const cityIds = new Set(wordsForCity(all, 0).map((w) => w.id))
  let srs: SrsMap = {}
  const wrapped: Record<string, number> = {}
  let cursor = 0
  let wrapUps = 0
  let roundsToWrap = maxRounds
  const rng = mulberry32(seed)
  for (let round = 1; round <= maxRounds; round++) {
    const now = NOW + round * 60 * 60 * 1000
    const boardSeed = Math.floor(rng() * 0xffffffff)
    // Once there is a collected word, a player may choose a wrap-up without
    // first earning a win. This report takes that choice every round.
    const isWrapUp = wrapUpUnlocked(all, srs, wrapped, 0)
    let game: GameState
    let wrappable: string[] = []
    if (isWrapUp) {
      const dealt = wrapUpDeal(all, srs, wrapped, boardSeed)
      if (dealt.deal.words.length < BOARD.totalWords) break
      onWrapUp?.(dealt, 100 - Object.keys(wrapped).length, (s) => wrapUpDeal(all, srs, wrapped, s), { srs, wrapped, seed: boardSeed })
      wrappable = dealt.deal.wrappable
      game = createGame({
        config: shippedBoardConfig(boardSeed),
        words: boardWords(dealt.deal.words),
        seed: boardSeed,
        authoredGreenIds: dealt.deal.greens,
      })
      wrapUps++
    } else {
      const b = CITY1_BOARD_CYCLE[cursor++ % CITY1_BOARD_CYCLE.length]!
      game = createGame({
        config: { ...BOARD, greenOverlap: b.greenOverlap },
        words: boardWords(b.wordIds.map((id) => byId.get(id)!)),
        seed: boardSeed,
        authoredGreenIds: { player: b.playerGreenIds, ai: b.aiGreenIds },
      })
    }
    const end = playSkilled(game, 0.7, rng)
    if (isWrapUp) {
      for (const id of wrappable) {
        if (end.reveals[id]!.kind === 'green' && cityIds.has(id)) wrapped[id] = now
      }
    }
    srs = applyRoundResults(srs, resultsFor(end), now)
    if (Object.keys(wrapped).length >= 100) {
      roundsToWrap = round
      break
    }
  }
  const everDealt = new Set(Object.keys(srs).filter((id) => cityIds.has(id)))
  return { roundsToWrap, wrapUps, wrappedCount: Object.keys(wrapped).length, neverDealt: cityIds.size - everDealt.size }
}

// ---- the report ----------------------------------------------------------------

describe('how composed a wrap-up board is', () => {
  const report = envVar('WRAPUP_COMPOSITION') === '1' ? it : it.skip

  report(
    'composition: authored, sampled and wrap-up deals on the same roster',
    () => {
      const rows: Row[] = []
      rows.push({
        label: 'authored cycle (150)',
        sides: CITY1_BOARD_CYCLE.flatMap((b) => {
          const board = b.wordIds.map((id) => byId.get(id)!)
          return [sideMetrics(b.playerGreenIds, board), sideMetrics(b.aiGreenIds, board)]
        }),
      })
      {
        const seen = shuffle(roster, mulberry32(99)).slice(0, 60)
        const srs: SrsMap = { ...discoveredOf(seen.slice(0, 30)), ...collectedOf(seen.slice(30)) }
        let recent: string[][] = []
        const sides: SideMetrics[] = []
        for (let seed = 1; seed <= 150; seed++) {
          const entries = selectBoardWords(
            roster,
            srs,
            { totalWords: BOARD.totalWords, maxNewWordsPerBoard: BOARD.maxNewWordsPerBoard, recentBoards: recent.map((b) => new Set(b)) },
            mulberry32(seed ^ 0x9e3779b9),
            NOW,
          )
          recent = [entries.map((w) => w.id), ...recent].slice(0, 2)
          const keys = generateKeys(shippedBoardConfig(seed), entries.map((w) => w.id), mulberry32(seed), {
            need: Object.fromEntries(entries.map((w) => [w.id, practiceNeed(srs[w.id], false, NOW)])),
          })
          sides.push(...sidesOf(keys, entries))
        }
        rows.push({ label: 'ordinary sampled (150, the local fallback)', sides })
      }
      const wrapUpRow = (label: string, pools: { srs: SrsMap; wrapped: Record<string, number> }[], deals: number) => {
        const sides: SideMetrics[] = []
        let seed = 1000
        for (const { srs, wrapped } of pools) {
          for (let i = 0; i < deals; i++) {
            const { deal, keys } = wrapUpDeal(WORDS, srs, wrapped, ++seed)
            if (deal.words.length === BOARD.totalWords) sides.push(...sidesOf(keys, deal.words))
          }
        }
        rows.push({ label, sides })
      }
      for (const n of [8, 15, 40, 100]) {
        wrapUpRow(
          `wrap-up draw, ${n} collected`,
          Array.from({ length: 10 }, (_, p) => ({
            srs: { ...discoveredOf(roster), ...collectedOf(shuffle(roster, mulberry32(500 + p)).slice(0, n)) },
            wrapped: {},
          })),
          15,
        )
      }
      for (const left of [15, 5]) {
        wrapUpRow(
          `wrap-up draw, all collected, ${left} left to wrap`,
          Array.from({ length: 10 }, (_, p) => ({
            srs: collectedOf(roster),
            wrapped: Object.fromEntries(shuffle(roster, mulberry32(700 + p)).slice(left).map((w) => [w.id, NOW])),
          })),
          15,
        )
      }
      printComposition(rows)
    },
    600_000,
  )

  report(
    'selection: the best of K draws by the ruler and by the on-device proxy, in real play',
    () => {
      const K = Number(envVar('WRAPUP_COMPOSITION_K') ?? 8)
      const today: SideMetrics[] = []
      const byRuler: SideMetrics[] = []
      const byProxy: SideMetrics[] = []
      const composed: SideMetrics[] = []
      let todayHaul = 0
      let composedHaul = 0
      let tokens = 0
      for (const seed of [1, 2, 3]) {
        let token = 0
        playCity(WORDS, seed, 400, (dealt, left, redeal, state) => {
          token++
          // Sample the mid-city, where a wrap-up has a pool worth composing from.
          if (left <= 15 || left > 85) return
          tokens++
          const fresh = (ids: readonly string[]) => ids.filter((id) => !(id in state.wrapped)).length
          const greensOf = (keys: KeyPair, ids: readonly string[]) =>
            ids.filter((id) => keys.playerKey[id] === 'green' || keys.aiKey[id] === 'green')
          todayHaul += fresh(greensOf(dealt.keys, dealt.deal.wrappable))
          const built = wrapUpDeal(WORDS, state.srs, state.wrapped, state.seed, AUTHORED_EVIDENCE)
          composed.push(...sidesOf(built.keys, built.deal.words))
          composedHaul += fresh(built.deal.wrappable)
          const candidates = [dealt]
          for (let i = 1; i < K; i++) candidates.push(redeal((seed * 104729 + token * 7919 + i * 0x9e37) >>> 0))
          const measured = candidates.map((c) => ({ c, sides: sidesOf(c.keys, c.deal.words) }))
          today.push(...measured[0]!.sides)
          byRuler.push(...measured.reduce((a, b) => (rulerScore(b.sides) < rulerScore(a.sides) ? b : a)).sides)
          const bestProxy = measured.reduce((a, b) =>
            proxyScore(b.c.keys, b.c.deal.words) < proxyScore(a.c.keys, a.c.deal.words) ? b : a,
          )
          byProxy.push(...bestProxy.sides)
        })
      }
      printComposition([
        { label: "today's draw", sides: today, extra: { 'wrappable greens': (todayHaul / tokens).toFixed(1) } },
        { label: `best of ${K} by the gate-1 ruler (Worker-side)`, sides: byRuler },
        { label: `best of ${K} by the co-key proxy (on-device)`, sides: byProxy },
        { label: 'the shipped composer on the bank’s groups', sides: composed, extra: { 'wrappable greens': (composedHaul / tokens).toFixed(1) } },
      ])
    },
    1_800_000,
  )

  report('the roster: what City 1 is now, and what the historical band could pack', () => {
    const city1 = wordsForCity(WORDS, 0)
    const band = curriculumBand(WORDS, 0)
    const onBoards = new Set(CITY1_BOARD_CYCLE.flatMap((b) => b.wordIds))
    console.table([
      {
        'City 1 (the authored roster)': city1.length,
        'of which on an authored board': city1.filter((w) => onBoards.has(w.id)).length,
        'the historical curriculumRank band': band.length,
        'of which on an authored board ': band.filter((w) => onBoards.has(w.id)).length,
      },
    ])
    const runs = [1, 2, 3].map((seed) => playCity(WORDS, seed, 400))
    const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[1]!
    console.table([
      {
        'rounds to wrap 100 (median of 3; 400 = never)': med(runs.map((r) => r.roundsToWrap)),
        'wrapped by round 400': med(runs.map((r) => r.wrappedCount)),
        'wrap-ups': med(runs.map((r) => r.wrapUps)),
        'city words never dealt': med(runs.map((r) => r.neverDealt)),
      },
    ])
  }, 600_000)
})
