import { describe, expect, it } from 'vitest'
import { applyEvent, createGame, IllegalEventError, isPerfectRound, isSolvedAndTranslated, isSolvedBoard } from './game'
import type { GameEvent, GameState, Side } from './types'
import { danish } from '../lang/da'
import { attemptFixture, FIXTURE_CONTENT, FIXTURE_TARGETS, FIXTURE_WORDS } from '../progression/fixtures'
import { evaluateAttempt, gameDelta, matchesAuthoredContent, rewardEligibility } from '../progression/rules'
import { mulberry32 } from './rng'
import { BOARD } from './config'
import { giverOf, targetableGreenIds } from './game'
import { CITY1_REQUIRED_BOARD_IDS, city1RequiredBoardById } from '../data/city1RequiredBoardManifest'

// C1-PC-1 F01-F12 through the actual reducer. No terminal-state construction,
// reveal mutation, wheel mutation, model, or store mock is used for these traces.
const start = (seed = 1) => createGame({
  config: { rows: 2, cols: 3, totalWords: 6, greensPerSide: 3, greenOverlap: 1, turnTokens: 3, maxNewWordsPerBoard: 6 },
  seed, firstGiver: 'player',
  words: FIXTURE_WORDS.map((wordId) => ({ wordId, da: wordId, en: [wordId], pos: 'noun' })),
  authoredGreenIds: { player: FIXTURE_CONTENT.playerGreenIds, ai: FIXTURE_CONTENT.aiGreenIds },
})
const step = (s: GameState, event: GameEvent) => applyEvent(s, event, danish)
const turn = (s: GameState, by: Side, ids: string[]) => ids.reduce(
  (game, wordId) => step(game, { type: 'GUESS', wordId }),
  step(s, { type: 'SUBMIT_CLUE', by, text: 'klods', number: ids.length }),
)
const translate = (s: GameState, ids: readonly string[]) => ids.reduce(
  (game, wordId) => step(game, { type: 'SUBMIT_TRANSLATION', wordId, answer: wordId }), s,
)
const spin = (s: GameState) => step(s, { type: 'SPIN_WHEEL' })
const reload = (s: GameState): GameState => JSON.parse(JSON.stringify(s))
const result = (s: GameState) => evaluateAttempt(attemptFixture(s))
const solved = (seed = 1) => turn(turn(start(seed), 'player', ['a', 'b', 'c']), 'ai', ['d', 'e'])
const partial = (seed = 1) => turn(turn(turn(start(seed), 'player', ['a', 'b']), 'ai', ['n']), 'player', ['n'])
const zeroFound = () => turn(turn(turn(start(), 'player', ['e']), 'ai', ['a']), 'player', ['d'])

describe('C1-07 reducer traces: AC01–AC06, AC27', () => {
  it('AC05/AC06: all 100 required authored boards reach Platinum without changing keys or content', () => {
    expect(CITY1_REQUIRED_BOARD_IDS).toHaveLength(100)
    for (const id of CITY1_REQUIRED_BOARD_IDS) {
      const { board, identity } = city1RequiredBoardById(id)
      let s = createGame({ config: { ...BOARD, greenOverlap: board.greenOverlap },
        seed: parseInt(board.seedHex, 16), firstGiver: board.firstGiver,
        words: board.wordIds.map((wordId) => {
          const word = danish.words.find((entry) => entry.id === wordId)!
          return { wordId, da: word.da, en: word.en, pos: word.pos }
        }), authoredGreenIds: { player: board.playerGreenIds, ai: board.aiGreenIds } })
      for (let guard = 0; guard < 8 && (s.phase === 'aiClueInput' || s.phase === 'playerClueInput'); guard++) {
        const by = giverOf(s.phase)
        s = turn(s, by, targetableGreenIds(s, by).slice(0, 4))
      }
      expect(s.phase, id).toBe('translateChallenge')
      expect(isSolvedBoard(s), id).toBe(true)
      expect(matchesAuthoredContent(s, { board: { ...identity, courseId: 'da' }, wordIds: board.wordIds,
        playerGreenIds: board.playerGreenIds, aiGreenIds: board.aiGreenIds }), id).toBe(true)
      for (const wordId of s.wheel!.segments) s = step(s, { type: 'SUBMIT_TRANSLATION', wordId, answer: s.words.find((word) => word.wordId === wordId)!.da })
      expect(result(spin(s)), id).toMatchObject({ status: 'completed', tier: 'platinum', solved: true })
    }
  })

  it('AC06: solves exactly the both-key union once, in board order, before any terminal verdict', () => {
    const s = solved()
    expect(s.phase).toBe('translateChallenge')
    expect(s.turnsLeft).toBe(2)
    expect(s.outcome).toBeUndefined()
    expect(s.wheel!.segments).toEqual(FIXTURE_TARGETS)
    expect(s.reveals.n).toEqual({ kind: 'hidden' })
    expect(isSolvedBoard(s)).toBe(true)
    expect(matchesAuthoredContent(s, FIXTURE_CONTENT)).toBe(true)
    expect(result(s)).toEqual({ status: 'pending' })
  })

  it('AC01/AC02: partial finds yield Bronze on miss and Silver on win, even when all found words translate', () => {
    const s = partial()
    expect(s.wheel!.segments).toEqual(['a', 'b'])
    expect(isSolvedBoard(s)).toBe(false)
    expect(result(spin(s))).toMatchObject({ status: 'completed', tier: 'bronze', solved: false, components: [] })
    const full = spin(translate(s, ['a', 'b']))
    expect(result(full)).toMatchObject({ status: 'completed', tier: 'silver', fullyTranslated: true, solved: false, components: ['spinWin'] })
    expect(isSolvedAndTranslated(full)).toBe(false)
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const terminal = spin(translate(partial(seed), ['a']))
      outcomes.add(terminal.outcome!.result)
      expect(result(terminal)).toMatchObject({ status: 'completed', tier: terminal.outcome!.result === 'won' ? 'silver' : 'bronze' })
    }
    expect(outcomes).toEqual(new Set(['won', 'lost']))
  })

  it('AC03/AC04: solve evidence survives partial translation, either wheel result, and reload', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const s = spin(translate(solved(seed), ['a', 'b']))
      outcomes.add(s.outcome!.result)
      expect(isSolvedBoard(reload(s))).toBe(true)
      expect(result(reload(s))).toMatchObject({ status: 'completed', tier: 'gold', solved: true, fullyTranslated: false,
        components: s.outcome!.result === 'won' ? ['spinWin', 'solved'] : ['solved'] })
      expect(matchesAuthoredContent(s, FIXTURE_CONTENT)).toBe(true)
    }
    expect(outcomes).toEqual(new Set(['won', 'lost']))
  })

  it('AC03: zero or wrong translations give a solved Gold miss, with free retries still available', () => {
    const s = solved()
    const wrong = step(s, { type: 'SUBMIT_TRANSLATION', wordId: 'a', answer: 'wrong' })
    expect(wrong.phase).toBe('translateChallenge')
    expect(wrong.wheel).toMatchObject({ attempts: 1, translated: [], filled: [] })
    expect(wrong.reveals).toEqual(s.reveals)
    for (const untranslated of [s, wrong]) {
      expect(result(spin(untranslated))).toMatchObject({ status: 'completed', tier: 'gold', outcome: 'lost', components: ['solved'] })
    }
  })

  it('AC05/AC06: earlier directional wrong guesses and repeated translation retries cannot demote Platinum', () => {
    let s = turn(start(), 'player', ['e'])
    expect(s.reveals.e).toEqual({ kind: 'bystander', against: ['player'] })
    expect(s.clueHistory[0].guesses[0].result).toBe('bystander')
    s = turn(turn(s, 'ai', ['c', 'd', 'e']), 'player', ['a', 'b'])
    for (let retry = 0; retry < 3; retry++) s = step(s, { type: 'SUBMIT_TRANSLATION', wordId: 'a', answer: 'wrong' })
    const retried = translate(s, ['a'])
    expect(step(retried, { type: 'SUBMIT_TRANSLATION', wordId: 'a', answer: 'a' })).toEqual(retried)
    s = translate(retried, ['b', 'c', 'd', 'e'])
    expect(s.phase).toBe('translateWheel')
    expect(s.wheel!.attempts).toBe(3)
    expect(result(s)).toEqual({ status: 'pending' })
    expect(isSolvedAndTranslated(s)).toBe(false)
    s = spin(s)
    expect(result(s)).toMatchObject({ status: 'completed', tier: 'platinum', components: ['spinWin', 'solved', 'solvedAndTranslated'] })
    expect(isSolvedAndTranslated(s)).toBe(true)
    expect(isPerfectRound(s)).toBe(true)
  })

  it('AC01/AC05/AC27: zero-found sudden death has terminal stop/loss or a complete solve followed by translation and spin', () => {
    const s = zeroFound()
    expect(s.phase).toBe('suddenDeath')
    expect(s.wheel).toBeUndefined()
    expect(isSolvedBoard(s)).toBe(false)
    for (const event of [{ type: 'STOP_GUESSING' }, { type: 'GUESS', wordId: 'n' }] as const) {
      const terminal = step(s, event)
      expect(terminal.wheel).toBeUndefined()
      expect(result(terminal)).toMatchObject({ status: 'completed', tier: 'bronze', outcome: 'lost' })
    }
    const one = step(s, { type: 'GUESS', wordId: 'a' })
    expect(result(step(one, { type: 'STOP_GUESSING' }))).toMatchObject({ status: 'completed', tier: 'bronze' })
    const all = FIXTURE_TARGETS.reduce((game, wordId) => step(game, { type: 'GUESS', wordId }), s)
    expect(all.phase).toBe('translateChallenge')
    expect(all.outcome).toBeUndefined()
    expect(all.wheel!.segments).toEqual(FIXTURE_TARGETS)
    expect(result(spin(translate(all, FIXTURE_TARGETS)))).toMatchObject({ status: 'completed', tier: 'platinum' })
  })

  it('reload before/after animation and duplicate spin cannot produce another verdict or random draw', () => {
    for (const initial of [solved(), partial()]) {
      const ready = translate(initial, ['a'])
      const expectedLanding = Math.floor(mulberry32(ready.seed ^ 0x5eed1dea ^ ready.wheel!.attempts)() * ready.wheel!.segments.length)
      const terminal = spin(ready)
      expect(terminal.wheel!.landed).toBe(expectedLanding)
      expect(spin(reload(ready))).toEqual(terminal)
      expect(spin(reload(terminal))).toEqual(terminal)
      expect(spin(spin(terminal))).toEqual(terminal)
      expect(ready.outcome).toBeUndefined()
    }
  })

  it('rejects an empty wheel instead of dividing by zero or accepting vacuous completion', () => {
    const s = { ...zeroFound(), phase: 'translateChallenge' as const }
    expect(step(s, { type: 'START_TRANSLATE_CHALLENGE' }).phase).toBe('suddenDeath')
    const malformed = { ...s, wheel: { segments: [], translated: [], filled: [], attempts: 0, landed: null, result: null, spent: null } }
    expect(() => spin(malformed)).toThrow(IllegalEventError)
    expect(() => step(malformed, { type: 'COMPLETE_CHALLENGE' })).toThrow(IllegalEventError)
    expect(isSolvedAndTranslated(malformed)).toBe(false)
  })

  it('AC27: tutorial practice uses the deterministic wheel but cannot earn progression or real game counts', () => {
    const s = spin(translate(solved(), FIXTURE_TARGETS))
    const practice = attemptFixture(s, { origin: 'tutorial' })
    expect(evaluateAttempt(practice)).toMatchObject({ status: 'completed', tier: 'platinum' })
    expect(rewardEligibility('tutorial', practice.board, null)).toEqual({ eligible: false, reason: 'excluded-origin' })
    expect(gameDelta('tutorial', 'won')).toEqual({ played: 0, won: 0, lost: 0, redeemed: 0 })
  })
})
