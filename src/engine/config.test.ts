import { describe, expect, it } from 'vitest'
import {
  BOARD,
  MAX_CLUE_NUMBER,
  SHIPPED_GREEN_OVERLAPS,
  TUTORIAL_CONFIG,
  assertConfigConsistent,
  caseyTopTwoAssistanceEnabled,
  distinctGreens,
  shippedBoardConfig,
  type GridConfig,
} from './config'
import { applyEvent as applyEventIn, createGame, giverOf, isSolvedBoard, remainingGreenIds } from './game'
import type { BoardWord } from './types'
import { danish } from '../lang/da'

/**
 * The engine takes the language pack now (H1). Wrapped here so the suite's
 * call sites stay exactly as they were and keep pinning what they pinned.
 */
const applyEvent = (s: Parameters<typeof applyEventIn>[0], e: Parameters<typeof applyEventIn>[1]) =>
  applyEventIn(s, e, danish)

// There is no wrapup entry any more (N2): newWrapUpGame deals BOARD itself,
// so a third row here would just be BOARD measured twice.
const CONFIGS: Array<[string, GridConfig]> = [
  ['board', BOARD],
  ['tutorial', TUTORIAL_CONFIG],
]

describe('the internal Casey assistance switch', () => {
  it('defaults on and accepts only explicit off values', () => {
    expect(caseyTopTwoAssistanceEnabled(undefined)).toBe(true)
    expect(caseyTopTwoAssistanceEnabled('')).toBe(true)
    expect(caseyTopTwoAssistanceEnabled('1')).toBe(true)
    expect(caseyTopTwoAssistanceEnabled('0')).toBe(false)
    expect(caseyTopTwoAssistanceEnabled(' false ')).toBe(false)
    expect(caseyTopTwoAssistanceEnabled('OFF')).toBe(false)
  })
})

describe('the shipped boards', () => {
  it('are internally consistent', () => {
    for (const [, c] of CONFIGS) assertConfigConsistent(c)
  })

  /**
   * THE board — there is one, since N1 — pinned by its shape rather than by
   * the win rate it produces. 3x6: eighteen cards, eight greens a side, three
   * of them shared, eight shared clue tokens.
   *
   * Pinned because every one of these numbers is a play-feel decision with a
   * measurement behind it in `config.ts`, and if one changes it should change
   * because someone meant it to.
   */
  it('are one board of eighteen cards, three across', () => {
    expect([BOARD.cols, BOARD.rows]).toEqual([3, 6])
    expect(BOARD.totalWords).toBe(18)
    expect(BOARD.greensPerSide).toBe(8)
    expect(BOARD.greenOverlap).toBe(3)
    expect(BOARD.turnTokens).toBe(8)
    // Thirteen distinct greens: three on both keys, five only-player, five
    // only-Casey. A shared green counts once, since finding it once is all the
    // game asks.
    expect(distinctGreens(BOARD)).toBe(13)
    // Five cards on nobody's key.
    expect(BOARD.totalWords - distinctGreens(BOARD)).toBe(5)
    // One never-seen word in three, the ratio every board has carried.
    expect(BOARD.maxNewWordsPerBoard).toBe(6)
  })

  it('varies ordinary and wrap-up deals evenly across one to three overlaps', () => {
    expect(SHIPPED_GREEN_OVERLAPS).toEqual([1, 2, 3])
    const resolved = Array.from({ length: 3000 }, (_, seed) => shippedBoardConfig(seed + 1))
    expect(new Set(resolved.map((config) => config.greenOverlap))).toEqual(new Set([1, 2, 3]))
    expect(new Set(resolved.map(distinctGreens))).toEqual(new Set([13, 14, 15]))
    const meanLoad =
      resolved.reduce((sum, config) => sum + distinctGreens(config) / config.turnTokens, 0) /
      resolved.length
    expect(+meanLoad.toFixed(2)).toBe(1.75)
  })

  /**
   * How much each clue has to carry: distinct greens over the shared token
   * pool. Codenames Duet, the game this is scaled from, sits at 15/9 = 1.67,
   * and the 3x5 this board replaces sat at 1.83 — the tightest budget the game
   * has ever had. 1.63 is a little kinder than either.
   */
  it('ask each clue to carry a known number of greens', () => {
    const load = (c: GridConfig) => +(distinctGreens(c) / c.turnTokens).toFixed(2)
    expect(load(BOARD)).toBe(1.63)
    expect(load(BOARD)).toBeLessThan(15 / 9)
    expect(load(TUTORIAL_CONFIG)).toBe(1)
  })

  it('uses a smaller nine-word practice board without changing normal play', () => {
    expect(TUTORIAL_CONFIG).not.toBe(BOARD)
    expect([TUTORIAL_CONFIG.cols, TUTORIAL_CONFIG.rows]).toEqual([3, 3])
    expect(TUTORIAL_CONFIG.totalWords).toBe(9)
    expect(TUTORIAL_CONFIG.greensPerSide).toBe(4)
    expect(TUTORIAL_CONFIG.greenOverlap).toBe(1)
    expect(distinctGreens(TUTORIAL_CONFIG)).toBe(7)
    expect(TUTORIAL_CONFIG.turnTokens).toBe(7)
  })

  it('keeps normal play on the fixed thirteen-green baseline', () => {
    expect(distinctGreens(BOARD)).toBe(13)
  })
})

describe('the guard against a board that cannot be cleared', () => {
  it('refuses a token count no perfect player could survive', () => {
    // 13 greens, at most 4 taken per clue: three clues can never be enough.
    expect(() => assertConfigConsistent({ ...BOARD, turnTokens: 3 })).toThrow(/cannot clear/)
  })

  // Both of these assert what the CLEARING guard does, so they are written as
  // "not this complaint" rather than "no complaint". There was a second,
  // unrelated bound below them for a while — a board with no clue left after
  // the last chance opened — and a bare not.toThrow() would have quietly
  // started testing that one instead. It is gone with the last chance; the
  // narrow assertion is kept, because the next guard added here will do it
  // again.
  it('allows the arithmetic floor, tight as it is', () => {
    const floor = Math.ceil(distinctGreens(BOARD) / MAX_CLUE_NUMBER)
    expect(floor).toBe(4)
    expect(() => assertConfigConsistent({ ...BOARD, turnTokens: floor })).not.toThrow(
      /cannot clear/,
    )
  })

  it('is a bound on the impossible, not on the merely hard', () => {
    // Deliberately not an opinion about difficulty: 5 tokens for 13 greens is
    // a brutal game and a legal one. Only unwinnable configurations are
    // refused.
    expect(() => assertConfigConsistent({ ...BOARD, turnTokens: 5 })).not.toThrow(/cannot clear/)
  })

  it('refuses a key that does not fit the board', () => {
    // 18 cards cannot hold 9 + 9 distinct greens with nothing shared.
    expect(() =>
      assertConfigConsistent({ ...BOARD, greensPerSide: 10, greenOverlap: 0 }),
    ).toThrow(/key slots/)
  })

  it('refuses a grid whose rows and columns do not make its word count', () => {
    expect(() => assertConfigConsistent({ ...BOARD, rows: 5 })).toThrow(/!= totalWords/)
  })
})

/**
 * Is the token count actually enough? Play the board and find out.
 *
 * The first answer to this was measured with fixed-ambition strategies —
 * "always clue 2", "always clue 3" — and reported that cluing pairs loses
 * every board, which was true and was the wrong emphasis: nobody clues 2
 * while eight of their greens are still hidden. A person clues for what is
 * left, up to about three at a time. Both are worth playing, though, and it is
 * the pair-by-pair line that decides whether a token count is generous or
 * merely survivable.
 */
const makeWords = (n: number): BoardWord[] =>
  Array.from({ length: n }, (_, i) => ({ wordId: `w${i}`, da: `xq${i}`, en: [`zz${i}`], pos: 'noun' }))

function playClueingForWhatIsLeft(
  seed: number,
  cap: number,
  config: GridConfig = shippedBoardConfig(seed),
) {
  // Opener pinned to the seat order the table was measured under; the app's
  // default moved to Casey on 2026-09-06 and this harness is not about that.
  let s = createGame({ config, words: makeWords(config.totalWords), seed, firstGiver: 'player' })
  const numbers: number[] = []
  for (let guard = 0; s.phase !== 'finished' && guard < 30; guard++) {
    if (s.phase !== 'playerClueInput' && s.phase !== 'aiClueInput') break
    const giver = giverOf(s.phase)
    const key = giver === 'player' ? s.playerKey : s.aiKey
    const mine = remainingGreenIds(s).filter((id) => key[id] === 'green')
    if (mine.length === 0) break
    const n = Math.min(cap, mine.length)
    numbers.push(n)
    s = applyEvent(s, { type: 'SUBMIT_CLUE', by: giver, text: 'klods', number: n })
    for (const id of mine.slice(0, n)) {
      if (s.phase !== 'playerGuessing' && s.phase !== 'aiGuessing') break
      s = applyEvent(s, { type: 'GUESS', wordId: id })
    }
    if (s.phase === 'playerGuessing' || s.phase === 'aiGuessing') {
      s = applyEvent(s, { type: 'STOP_GUESSING' })
    }
  }
  // C1-PC-1: token-budget tests prove association solving, before translation
  // and the actual spin decide the terminal won/lost outcome.
  expect(s.phase).toBe('translateChallenge')
  expect(s.outcome).toBeUndefined()
  return { won: isSolvedBoard(s), clues: s.clueHistory.length, numbers }
}

describe('the board, played the way a person plays', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i * 7 + 1)

  it('clears every board, cluing at most three at a time', () => {
    const runs = seeds.map((s) => playClueingForWhatIsLeft(s, 3))
    expect(runs.every((r) => r.won)).toBe(true)
  })

  /**
   * The seeded 1–3 overlap yields thirteen to fifteen distinct greens. Cluing
   * ambitiously takes five clues on the softer shapes and six on the hardest,
   * leaving at least two of the shared eight tokens as slack.
   *
   * The 3x5 this replaced took three of its six and left two spare. The board
   * is a little longer AND a little more forgiving, which is the trade the
   * table in config.ts argues for — checked here rather than asserted in prose.
   */
  it('takes five or six of its eight clues when clued ambitiously', () => {
    const runs = seeds.map((s) => playClueingForWhatIsLeft(s, 3))
    const shapes = new Set(runs.map((r) => r.numbers.join('+')))
    expect([...shapes].sort()).toEqual(['3+3+3+2+2', '3+3+3+3+2', '3+3+3+3+2+1'])
    expect(runs.every((r) => r.clues <= BOARD.turnTokens - 2)).toBe(true)
  })

  /**
   * And the pair-by-pair line, which is the one an arithmetic floor forbids
   * first: thirteen or fourteen greens take seven clues; fifteen take all
   * eight. This is the check that once caught the 3x4 at four
   * tokens, where cluing in pairs was arithmetically impossible on the first
   * board a learner met — a whole way of playing forbidden by the budget
   * rather than by the board.
   *
   * The one-overlap board is a pair-only tightrope with no spare token; the
   * two- and three-overlap boards retain one.
   */
  it('and clears it cluing nothing but pairs, which seven tokens would not', () => {
    const runs = seeds.map((s) => playClueingForWhatIsLeft(s, 2))
    expect(runs.every((r) => r.won)).toBe(true)
    expect(new Set(runs.map((r) => r.clues))).toEqual(new Set([7, 8]))
    expect(BOARD.turnTokens).toBe(8)
  })

  /** The tutorial board still clears, since a scripted round is dealt on it. */
  it('and the tutorial board clears too', () => {
    const runs = seeds.map((s) => playClueingForWhatIsLeft(s, 3, TUTORIAL_CONFIG))
    expect(runs.every((r) => r.won)).toBe(true)
  })
})
