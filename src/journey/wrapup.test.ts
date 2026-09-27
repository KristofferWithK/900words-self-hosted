import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../data/types'
import { WORDS } from '../data/words'
import { CITY1_CLUE_GROUPS } from '../data/city1ClueGroups'
import { BOARD, distinctGreens, shippedBoardConfig } from '../engine/config'
import { createGame } from '../engine/game'
import { mulberry32 } from '../engine/rng'
import { boardablePrefix, conflicts } from '../srs/sampler'
import { newStats } from '../srs/scheduler'
import type { SrsMap } from '../srs/types'
import { wordsForCity } from './progress'
import {
  MAX_WRAPPED_PER_ROUND,
  WRAP_UP_FLOOR,
  wrapUpEvidence,
  wrapUpPool,
  wrapUpUnlocked,
  wrapUpWords,
  type GroupEvidence,
} from './wrapup'

const NOW = 1_700_000_000_000
const city = wordsForCity(WORDS, 0)

/**
 * A conflict-free slice of the city, so "a pool of N seats N" holds exactly.
 * The real first-twenty contains sharing pairs (measured: a pool of 20 seats
 * 19), which is the draw's business to survive — the boundary tests' fixtures
 * must not depend on it.
 */
const clean: WordEntry[] = boardablePrefix(city, 45)

/** The given words collected — a green earned each way. */
const collectedOf = (words: readonly WordEntry[]): SrsMap =>
  Object.fromEntries(
    words.map((w) => [w.id, { ...newStats(NOW), greenByClue: 1, greenByGuess: 1 }]),
  )

/** The first n city words collected. */
const collectedStats = (n: number): SrsMap => collectedOf(city.slice(0, n))

/** Seen but not collected — the middle pool a topped-up board reaches for. */
const discoveredOf = (words: readonly WordEntry[]): SrsMap =>
  Object.fromEntries(words.map((w) => [w.id, { ...newStats(NOW), seen: 1 }]))

const wrappedOf = (ids: readonly string[]): Record<string, number> =>
  Object.fromEntries(ids.map((id) => [id, NOW]))

describe('the wrap-up pool', () => {
  it('holds exactly the collected-or-better words of the city', () => {
    const srs = collectedStats(25)
    const pool = wrapUpPool(WORDS, srs, {}, 0)
    expect(pool.length).toBe(25)
    // A wrapped word without stats still belongs — the ledger outranks them.
    const wrapped = wrappedOf([city[80]!.id])
    expect(wrapUpPool(WORDS, srs, wrapped, 0).length).toBe(26)
  })

  it('never reaches into another city', () => {
    const srs = collectedStats(25)
    expect(wrapUpPool(WORDS, srs, {}, 1).length).toBe(0)
  })
})

describe('drawing a wrap-up board', () => {
  it('fills a full board from a pool far too thin to fill one (W1)', () => {
    // Eight collected words and a board of eighteen. Before W1 this could not
    // be dealt at all; now the eight are on it, they are the only wrappable
    // cards, and the other ten are ordinary city words. (The conflict-free
    // slice: the roster's first eight hold by/bo, which the draw may not seat
    // together, and that is the draw's business rather than this test's.)
    const srs = collectedOf(clean.slice(0, 8))
    const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(7))
    expect(deal.words.length).toBe(BOARD.totalWords)
    expect(deal.wrappable.length).toBe(8)
    const ids = new Set(deal.words.map((w) => w.id))
    for (const w of clean.slice(0, 8)) expect(ids.has(w.id)).toBe(true)
    // Every card is a word of this city, wrappable or not.
    const cityIds = new Set(city.map((w) => w.id))
    for (const w of deal.words) expect(cityIds.has(w.id)).toBe(true)
  })

  it('takes the collected words first, then the discovered, then the unseen', () => {
    // 4 collected, 6 discovered, the rest of the city unseen. The board must
    // seat all four and all six before it reaches for a `?`.
    const srs: SrsMap = { ...collectedOf(clean.slice(0, 4)), ...discoveredOf(clean.slice(4, 10)) }
    const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(11))
    const ids = new Set(deal.words.map((w) => w.id))
    for (const w of clean.slice(0, 10)) expect(ids.has(w.id)).toBe(true)
    expect(deal.wrappable.sort()).toEqual(clean.slice(0, 4).map((w) => w.id).sort())
  })

  it('every wrappable word is collected — the invariant the mode stands on', () => {
    const srs = collectedStats(40)
    const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(7))
    expect(deal.words.length).toBe(BOARD.totalWords)
    // 40 collected against an 18-card board: nothing needs topping up.
    expect(deal.wrappable.length).toBe(BOARD.totalWords)
    const pool = new Set(wrapUpPool(WORDS, srs, {}, 0).map((w) => w.id))
    for (const id of deal.wrappable) expect(pool.has(id)).toBe(true)
  })

  it('unwrapped words come first; wrapped ones only pad', () => {
    // 22 unwrapped + 18 wrapped, against BOARD's 18-word board: the board must
    // seat every unwrapped word it can before a single wrapped one, and since
    // 22 unwrapped exceeds the board size the whole board should be unwrapped
    // bar the odd conflict exclusion.
    const srs = collectedStats(40)
    const wrapped = wrappedOf(city.slice(22, 40).map((w) => w.id))
    const deal = wrapUpWords(WORDS, srs, wrapped, 0, mulberry32(7))
    const unwrappedOnBoard = deal.words.filter((w) => !(w.id in wrapped)).length
    // Conflict exclusions may cost a seat or two, never more.
    expect(unwrappedOnBoard).toBeGreaterThanOrEqual(BOARD.totalWords - 2)
  })

  it('near the end of a city, wrapped words fill the board', () => {
    // Only 5 unwrapped left: a full board still deals.
    const srs = collectedStats(40)
    const wrapped = wrappedOf(city.slice(5, 40).map((w) => w.id))
    const deal = wrapUpWords(WORDS, srs, wrapped, 0, mulberry32(7))
    expect(deal.words.length).toBe(BOARD.totalWords)
    for (const w of city.slice(0, 5)) {
      expect(deal.words.some((b) => b.id === w.id)).toBe(true)
    }
  })

  it('a top-up card never displaces a collected one, even a repeated one', () => {
    // The avoid set IS the whole collected pool. A filler word is fresh and a
    // collected word is stale, and the collected word must still win the seat:
    // a repeat that can be wrapped beats a new word that cannot.
    const srs = collectedOf(clean.slice(0, 6))
    const avoid = new Set(clean.slice(0, 6).map((w) => w.id))
    const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(5), avoid)
    expect(deal.wrappable.length).toBe(6)
  })

  it('the avoid set goes to the back of the queue, never dropped', () => {
    // A pool exactly BOARD.totalWords wide: the previous board IS the pool,
    // and a short board would be a worse answer than a repeat — the old exam
    // draw's lesson.
    const srs = collectedOf(clean.slice(0, BOARD.totalWords))
    const first = wrapUpWords(WORDS, srs, {}, 0, mulberry32(7))
    expect(first.words.length).toBe(BOARD.totalWords)
    const second = wrapUpWords(
      WORDS,
      srs,
      {},
      0,
      mulberry32(8),
      new Set(first.words.map((w) => w.id)),
    )
    expect(second.words.length).toBe(first.words.length)
    // Every collected word is still on it — the top-up may not push one off.
    expect(second.wrappable.length).toBe(BOARD.totalWords)

    // With words to spare, the previous board stays off the new one.
    const srsWide = collectedOf(clean)
    const a = wrapUpWords(WORDS, srsWide, {}, 0, mulberry32(7))
    const b = wrapUpWords(WORDS, srsWide, {}, 0, mulberry32(8), new Set(a.words.map((w) => w.id)))
    const repeats = b.words.filter((w) => a.words.some((x) => x.id === w.id))
    expect(repeats.length).toBe(0)
  })

  it('never seats two words the board rules call conflicting', () => {
    const srs = collectedStats(60)
    const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(3))
    const glosses = deal.words.map((w) => w.en[0]!.toLowerCase())
    expect(new Set(glosses).size).toBe(glosses.length)
  })
})

describe('unlocking wrap-up rounds', () => {
  it('opens at the FLOOR — one word to pack, not a boardful or a win count', () => {
    expect(wrapUpUnlocked(WORDS, {}, {}, 0)).toBe(false)
    expect(wrapUpUnlocked(WORDS, collectedOf(clean.slice(0, WRAP_UP_FLOOR)), {}, 0)).toBe(true)
    // The old gate: a boardful of collected words. It is no longer the test —
    // one word short of it must now open, and that is the whole of W1.
    expect(wrapUpUnlocked(WORDS, collectedOf(clean.slice(0, BOARD.totalWords - 1)), {}, 0)).toBe(
      true,
    )
  })

  it('a pool that cannot seat a whole board still opens one, because the board tops up', () => {
    // BOARD.totalWords collected words, two of which conflict — the fixture
    // that used to be the counter-example to counting instead of dealing. The
    // board fills from the city now, so it deals either way.
    const seatable = BOARD.totalWords - 1
    const conflicted = city.find((w) => clean.slice(0, seatable).some((c) => conflicts(w, c)))!
    const srs = collectedOf([...clean.slice(0, seatable), conflicted])
    expect(wrapUpUnlocked(WORDS, srs, {}, 0)).toBe(true)
    expect(wrapUpWords(WORDS, srs, {}, 0, mulberry32(2)).words.length).toBe(BOARD.totalWords)
  })
})

/**
 * THE STRUCTURAL HALF OF W1, the composer's by construction: the greens are
 * packed from the collected queues before any filler, so a collected word
 * that can seat is green for as long as there are green slots, and a filler
 * card is green only in the slots left over. Checked over two hundred seeds
 * on every overlap, because "usually" is what the old bias gave and what
 * this replaced (`wrapUpBias`, a lean; `greenPool`, the rule that patched it).
 */
describe('the wrap-up deal puts collected words on the keys first', () => {
  const boardOf = (srs: SrsMap, wrapped: Record<string, number>, seed: number) => {
    const config = shippedBoardConfig(seed)
    const deal = wrapUpWords(WORDS, srs, wrapped, 0, mulberry32(seed), new Set(), [], config)
    const pool = new Set(deal.wrappable)
    const greens = [...new Set([...deal.greens.player, ...deal.greens.ai])]
    return { deal, greens, pool, config }
  }

  it('with a board full of collected words every green is wrappable (invariant)', () => {
    const srs = collectedStats(40)
    for (let seed = 1; seed <= 200; seed++) {
      const { deal, greens, config } = boardOf(srs, {}, seed)
      expect(deal.wrappable.length).toBe(BOARD.totalWords)
      expect(greens.length).toBe(distinctGreens(config))
    }
  })

  it('with a deep collected pool, no filler is green — on every seed', () => {
    const srs = collectedStats(40)
    for (let seed = 1; seed <= 200; seed++) {
      const { greens, pool, config } = boardOf(srs, {}, seed)
      expect(pool.size).toBeGreaterThanOrEqual(distinctGreens(config))
      for (const id of greens) expect(pool.has(id)).toBe(true)
    }
  })

  // This retains all 180 deterministic seed cases. Under the full parallel
  // suite their complete authored-deal search can exceed Vitest's generic 5s
  // budget despite passing in isolation; a local timeout keeps the historical
  // invariant executable instead of silently reducing its coverage.
  it('with fewer, filler fills exactly the green slots left over', () => {
    for (const n of [1, 8, 12]) {
      const srs = collectedOf(clean.slice(0, n))
      for (let seed = 1; seed <= 60; seed++) {
        const { greens, pool, config } = boardOf(srs, {}, seed)
        expect(greens.length).toBe(distinctGreens(config))
        // Every collected word on the board is green...
        for (const id of pool) expect(greens).toContain(id)
        // ...and the filler greens are exactly the remainder.
        const fillerGreens = greens.filter((id) => !pool.has(id))
        expect(fillerGreens.length).toBe(distinctGreens(config) - pool.size)
      }
    }
  }, 15_000)

  it('hands createGame keys of exactly the config’s shape, on every seed and overlap', () => {
    const srs = collectedStats(40)
    const overlaps = new Set<number>()
    for (let seed = 1; seed <= 200; seed++) {
      const { deal, config } = boardOf(srs, {}, seed)
      const game = createGame({
        config,
        words: deal.words.map((w) => ({ wordId: w.id, da: w.da, en: w.en, pos: w.pos })),
        seed,
        authoredGreenIds: deal.greens,
      })
      const shared = deal.words.filter(
        (w) => game.playerKey[w.id] === 'green' && game.aiKey[w.id] === 'green',
      )
      expect(shared.length).toBe(config.greenOverlap)
      overlaps.add(config.greenOverlap)
    }
    expect([...overlaps].sort()).toEqual([1, 2, 3])
  })

  it('unwrapped words are the greens before wrapped ones pad', () => {
    // 12 unwrapped and 28 wrapped, every card collected. The round exists to
    // pack the twelve, so all twelve are green on every seed, and only the
    // slots beyond them go to words already in the suitcase.
    const srs = collectedOf(clean.slice(0, 40))
    const wrapped = wrappedOf(clean.slice(12, 40).map((w) => w.id))
    for (let seed = 1; seed <= 40; seed++) {
      const { deal, greens } = boardOf(srs, wrapped, seed)
      const unwrappedOnBoard = deal.wrappable.filter((id) => !(id in wrapped))
      expect(unwrappedOnBoard.length).toBe(12)
      for (const id of unwrappedOnBoard) expect(greens).toContain(id)
      // The board is all collected: a deep pool never seats filler.
      expect(deal.wrappable.length).toBe(BOARD.totalWords)
    }
  })
})

/**
 * THE COMPOSITION. Evidence says which greens go together; the composer packs
 * keys from it, keeps every group on one side, seats the cards judged safe
 * beside the groups it used, and never a card seen to pull toward one.
 */
describe('the wrap-up deal composes from evidence', () => {
  const pool = clean.slice(0, 40)
  const srs = collectedOf(pool)
  const at = (...i: number[]) => i.map((n) => pool[n]!.id)
  const group = (ids: string[], extra: Partial<GroupEvidence> = {}): GroupEvidence => ({ ids, weight: 1, ...extra })
  const sideOf = (deal: ReturnType<typeof wrapUpWords>, ids: string[]) =>
    ids.every((id) => deal.greens.player.includes(id)) || ids.every((id) => deal.greens.ai.includes(id))

  it('keeps every group it uses whole, on one side', () => {
    const evidence = [
      group(at(0, 1, 2)),
      group(at(3, 4, 5)),
      group(at(6, 7)),
      group(at(8, 9, 10)),
      group(at(11, 12, 13)),
      group(at(14, 15)),
    ]
    for (let seed = 1; seed <= 40; seed++) {
      const config = shippedBoardConfig(seed)
      const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(seed), new Set(), evidence, config)
      const onBoard = new Set(deal.words.map((w) => w.id))
      for (const g of evidence) {
        const seated = g.ids.filter((id) => onBoard.has(id))
        // A group the room cut short is fine; a group split across keys is not.
        if (seated.length >= 2) expect(sideOf(deal, seated)).toBe(true)
      }
      expect(deal.greens.player.length).toBe(config.greensPerSide)
      expect(deal.greens.ai.length).toBe(config.greensPerSide)
    }
  })

  it('seats the cards judged safe beside a group as bystanders, and never a known trap', () => {
    // Forty collected words, so the board is all collected and the queue
    // decides nothing between them: the one group in evidence carries two
    // cards judged safe beside it and one seen to pull toward it. The safe
    // pair are bystanders on every seed; the trap, last of its queue, is
    // never dealt.
    const [safeA, safeB, trap] = at(37, 38, 39) as [string, string, string]
    const evidence = [group(at(0, 1, 2), { safeBeside: new Set([safeA, safeB]), traps: new Set([trap]) })]
    for (let seed = 1; seed <= 40; seed++) {
      const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(seed), new Set(), evidence, shippedBoardConfig(seed))
      const ids = deal.words.map((w) => w.id)
      expect(ids).toContain(safeA)
      expect(ids).toContain(safeB)
      expect(ids).not.toContain(trap)
      const greens = deal.greens.player.concat(deal.greens.ai)
      expect(greens).not.toContain(safeA)
      expect(greens).not.toContain(safeB)
    }
  })

  it('prefers what the player found over the bank when both want the same seat', () => {
    // Two groups share two words; only one can be whole. The heavier — the
    // player's — is the one kept together.
    const evidence = [group(at(0, 1, 2), { weight: 1 }), group(at(0, 1, 3), { weight: 2 })]
    for (let seed = 1; seed <= 40; seed++) {
      const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(seed), new Set(), evidence, shippedBoardConfig(seed))
      expect(sideOf(deal, at(0, 1, 3))).toBe(true)
    }
  })

  it('layers the ledger over the authored groups, heavier and with its traps', () => {
    const authored = CITY1_CLUE_GROUPS.slice(0, 1)
    const evidence = wrapUpEvidence(authored, {
      groups: { 'da:a|da:b': { ids: ['da:a', 'da:b'], count: 2 } },
      traps: { 'da:a|da:b': ['da:z'] },
    })
    expect(evidence[0]).toMatchObject({ ids: authored[0]!.ids, weight: 1 })
    expect(evidence[0]!.safeBeside).toBe(authored[0]!.safeBeside)
    expect(evidence[1]).toMatchObject({ ids: ['da:a', 'da:b'], weight: 2 })
    expect(evidence[1]!.traps?.has('da:z')).toBe(true)
  })

  it('never seats two words the board rules call conflicting, with the shipped groups on the real city', () => {
    // 151 of the bank's 2,967 groups hold a pair the board refuses (by/bo,
    // synes/tænke); a group is seated member by member against the board AND
    // its own members, so none of them reaches a packing screen as two cards
    // reading the same English. Real pool, real evidence, every overlap.
    const evidence = wrapUpEvidence(CITY1_CLUE_GROUPS, { groups: {}, traps: {} })
    for (const n of [8, 20, 40, 100]) {
      const srs = collectedStats(n)
      for (let seed = 1; seed <= 25; seed++) {
        const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(seed), new Set(), evidence, shippedBoardConfig(seed))
        expect(deal.words.length).toBe(BOARD.totalWords)
        for (let i = 0; i < deal.words.length; i++) {
          for (let j = i + 1; j < deal.words.length; j++) {
            expect(conflicts(deal.words[i]!, deal.words[j]!)).toBe(false)
          }
        }
      }
    }
  }, 60_000)

  it('with the shipped groups, a City 1 key holds more whole groups than the plain draw', () => {
    // The harness (wrapup-composition.test.ts) measures this with the bank’s
    // own ruler; here a proxy that needs no index: how many distinct authored
    // groups sit whole inside a key. (Pairs alone saturate — the bank's
    // groups reach nearly every pair of roster words — so whole groups it is.)
    const evidence = wrapUpEvidence(CITY1_CLUE_GROUPS, { groups: {}, traps: {} })
    const wholeGroupsPerKey = (ev: readonly GroupEvidence[]): number => {
      let whole = 0
      let keys = 0
      for (let seed = 1; seed <= 40; seed++) {
        const deal = wrapUpWords(WORDS, srs, {}, 0, mulberry32(seed), new Set(), ev, shippedBoardConfig(seed))
        for (const key of [deal.greens.player, deal.greens.ai]) {
          keys++
          const seen = new Set<string>()
          for (const g of CITY1_CLUE_GROUPS) {
            if (g.ids.every((id) => key.includes(id))) seen.add([...g.ids].sort().join('|'))
          }
          whole += seen.size
        }
      }
      return whole / keys
    }
    const composed = wholeGroupsPerKey(evidence)
    const plain = wholeGroupsPerKey([])
    expect(composed).toBeGreaterThan(plain * 1.3)
  })
})

describe('what one wrap-up can hold', () => {
  it('is the hardest shipped board’s distinct greens, so the suitcase can say it out loud', () => {
    expect(MAX_WRAPPED_PER_ROUND).toBeGreaterThanOrEqual(distinctGreens(BOARD))
    expect(MAX_WRAPPED_PER_ROUND).toBe(15)
  })
})
