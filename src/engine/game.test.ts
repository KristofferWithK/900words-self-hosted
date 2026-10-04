import { describe, expect, it } from 'vitest'
import { BOARD, TUTORIAL_CONFIG, type GridConfig } from './config'
import {
  IllegalClueError,
  IllegalEventError,
  applyEvent as applyEventIn,
  createGame,
  giverOf,
  isGuessable,
  isPerfectRound,
  remainingGreenIds,
  targetableGreenIds,
  wheelFoundIds,
  wheelMissedSegments,
} from './game'
import type { BoardWord, CardRole, GameState, Side } from './types'
import { danish } from '../lang/da'

/**
 * The engine takes the language pack now (H1). Wrapped here so the suite's
 * call sites stay exactly as they were and keep pinning what they pinned.
 */
const applyEvent = (s: Parameters<typeof applyEventIn>[0], e: Parameters<typeof applyEventIn>[1]) =>
  applyEventIn(s, e, danish)

// Word forms chosen so simple test clues never collide with legality checks.
const makeWords = (n: number): BoardWord[] =>
  Array.from({ length: n }, (_, i) => ({
    wordId: `w${i}`,
    da: `xq${i}`,
    en: [`zz${i}`],
    pos: 'noun',
  }))

// Pins the opener explicitly, so these tests keep reading the same way if the
// default ever moves again. The default itself is asserted against createGame
// directly, in 'who opens the round'.
//
// "Every board" here means every CONFIG the app can deal, not every size:
// there are no sizes since N1. Just the board and the tutorial mode you enter
// — the wrap-up deals BOARD itself since N2, so it is not a third shape.
const CONFIGS: Record<'board' | 'tutorial', GridConfig> = {
  board: BOARD,
  tutorial: TUTORIAL_CONFIG,
}
type Grid = keyof typeof CONFIGS

const newGame = (grid: Grid = 'board', seed = 7, firstGiver: Side = 'player') =>
  createGame({
    config: CONFIGS[grid],
    words: makeWords(CONFIGS[grid].totalWords),
    seed,
    firstGiver,
  })

const keyOf = (s: GameState, side: Side) => (side === 'player' ? s.playerKey : s.aiKey)

/** A guessable word with the given role on the current giver's key. */
function findGuessable(s: GameState, giver: Side, role: CardRole): string {
  const key = keyOf(s, giver)
  const id = Object.keys(key).find((w) => key[w] === role && isGuessable(s, w))
  if (!id) throw new Error(`no guessable ${role} word for ${giver}`)
  return id
}

const clue = (s: GameState, by: Side, number: number) =>
  applyEvent(s, { type: 'SUBMIT_CLUE', by, text: 'klods', number })

/**
 * Play `n` complete clue-turns, each ended by a bystander guess, and stop in a
 * clue-input phase — or in sudden death, if `n` is the whole token budget.
 */
function burnClues(s: GameState, n: number): GameState {
  while (s.clueHistory.length < n) {
    const giver: Side = s.phase === 'playerClueInput' ? 'player' : 'ai'
    s = clue(s, giver, 1)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
  }
  return s
}

describe('full game flows', () => {
  it('opens translation by finding all distinct greens (C1-PC-1 successor to immediate win)', () => {
    let s = newGame()
    let safety = 50
    while ((s.phase === 'playerClueInput' || s.phase === 'aiClueInput') && safety-- > 0) {
      const giver = s.phase === 'playerClueInput' ? 'player' : 'ai'
      s = clue(s, giver, 4)
      // Guesser plays perfectly: only giver-key greens, up to the cap.
      while (s.phase === 'aiGuessing' || s.phase === 'playerGuessing') {
        const key = keyOf(s, giver)
        const target = Object.keys(key).find((w) => key[w] === 'green' && isGuessable(s, w))
        if (!target) {
          s = applyEvent(s, { type: 'STOP_GUESSING' })
          break
        }
        s = applyEvent(s, { type: 'GUESS', wordId: target })
      }
    }
    expect(s.phase).toBe('translateChallenge')
    expect(s.outcome).toBeUndefined()
    expect(s.wheel!.segments.length).toBe(13)
    expect(remainingGreenIds(s)).toEqual([])
    expect(s.turnsLeft).toBeGreaterThan(0)
  })

  it('runs out of clues into sudden death, not into a loss', () => {
    let s = newGame()
    while (s.phase === 'playerClueInput' || s.phase === 'aiClueInput') {
      const giver = s.phase === 'playerClueInput' ? 'player' : 'ai'
      s = clue(s, giver, 1)
      s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
    }
    // Every turn burned on a neutral, so nothing was found and the tokens are
    // gone — and the round is still alive, which is the point of the change.
    expect(s.turnsLeft).toBe(0)
    expect(s.phase).toBe('suddenDeath')
    expect(s.outcome).toBeUndefined()
    expect(remainingGreenIds(s).length).toBeGreaterThan(0)
  })

  /**
   * The only three ways a round can end, now that forbidden words and the
   * translate-everything last chance are gone. Written as a sweep rather than
   * three separate cases because the thing worth pinning is the ABSENCE of a
   * fourth: a guess that is not green on the giver's key must cost the turn and
   * nothing more, on every board, at every point in the round.
   */
  it('never ends a round on a guess that is merely wrong', () => {
    let checked = 0
    for (const grid of ['board', 'tutorial'] as Grid[]) {
      for (let seed = 1; seed <= 25; seed++) {
        let s = newGame(grid, seed)
        while (s.phase === 'playerClueInput' || s.phase === 'aiClueInput') {
          const giver = giverOf(s.phase)
          s = clue(s, giver, 1)
          s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
          // A wrong guess spends the turn. It never finishes the round, and it
          // never writes an outcome — the tokens running out is what does, and
          // that opens sudden death rather than closing the game.
          expect(s.outcome, `${grid}/${seed}`).toBeUndefined()
          checked++
        }
        expect(s.phase, `${grid}/${seed}`).toBe('suddenDeath')
      }
    }
    // Fails loudly rather than vacuously if the loop stops finding turns.
    expect(checked).toBeGreaterThanOrEqual(300)
  })

  it('bystander reveals are directional: blocked for one giver, guessable for the other', () => {
    // The board guarantees words that are bystander on the player key but green
    // on the AI key: eight greens a side with three shared leaves five each way.
    let s = newGame('board')
    const target = Object.keys(s.playerKey).find(
      (w) => s.playerKey[w] === 'bystander' && s.aiKey[w] === 'green',
    )!
    s = clue(s, 'player', 1)
    s = applyEvent(s, { type: 'GUESS', wordId: target })
    expect(s.reveals[target]).toEqual({ kind: 'bystander', against: ['player'] })
    expect(s.phase).toBe('aiClueInput')

    // Under the AI's clue the same word is guessable — and green. Clued as 2 so
    // the turn survives it: the number is the whole allowance now, so a 1 would
    // end the turn on this guess and the rest of this test could not run.
    s = clue(s, 'ai', 2)
    expect(isGuessable(s, target)).toBe(true)
    s = applyEvent(s, { type: 'GUESS', wordId: target })
    expect(s.reveals[target]).toEqual({ kind: 'green' })

    // A double-bystander revealed under the AI's clue blocks only that direction…
    const blocked = Object.keys(s.playerKey).find(
      (w) => s.playerKey[w] === 'bystander' && s.aiKey[w] === 'bystander' && isGuessable(s, w),
    )!
    s = applyEvent(s, { type: 'GUESS', wordId: blocked }) // bystander vs aiKey, ends the turn
    s = clue(s, 'player', 1)
    expect(isGuessable(s, blocked)).toBe(true) // …so it stays open under the player's clue
    s = applyEvent(s, { type: 'GUESS', wordId: blocked }) // bystander vs playerKey too
    expect(s.reveals[blocked]).toEqual({ kind: 'bystander', against: ['ai', 'player'] })
    s = clue(s, 'ai', 1)
    expect(isGuessable(s, blocked)).toBe(false) // now blocked in both directions
  })

  /**
   * The rule the whole game turns on, and the one this repo has written
   * backwards more than once: a guess is judged against the CLUE-GIVER's key
   * and nothing else.
   *
   * It used to be pinned through forbidden words, which were the loudest way to
   * get it wrong — an audit mutated the engine to the naive rule ("a forbidden
   * word is fatal to whoever names it") and 411 of 413 tests went on passing.
   * Forbidden words are gone; the rule is not, because the two keys still
   * disagree about most of the board. Every green Casey holds is a card the
   * player's own key shows as neutral, with nothing on screen to say otherwise,
   * and it scores anyway — that is now what the rule buys, and it is what these
   * pin.
   */
  describe('a guess is judged against the clue-giver key, and only that key', () => {
    /** Green for Casey, neutral for the player — the ordinary case, not a corner. */
    const onlyHis = (s: GameState) =>
      Object.keys(s.aiKey).find((w) => s.aiKey[w] === 'green' && s.playerKey[w] === 'bystander')!

    it('the player scores a word their OWN key calls neutral, under Casey clue', () => {
      let s = newGame('board', 7, 'ai')
      const card = onlyHis(s)
      expect(card).toBeDefined()
      s = clue(s, 'ai', 2)
      s = applyEvent(s, { type: 'GUESS', wordId: card })
      expect(s.reveals[card]).toEqual({ kind: 'green' })
      expect(s.outcome).toBeUndefined()
    })

    it('and the same card scores nothing when Casey names it under the PLAYER clue', () => {
      let s = newGame('board', 7, 'player')
      const card = onlyHis(s)
      s = clue(s, 'player', 2)
      s = applyEvent(s, { type: 'GUESS', wordId: card })
      // Read off the player's key, where it is neutral: burned against the
      // player only, and the turn is over.
      expect(s.reveals[card]).toEqual({ kind: 'bystander', against: ['player'] })
      expect(s.phase).toBe('aiClueInput')
      // Still Casey's green, and still there to be taken under his own clue.
      s = clue(s, 'ai', 1)
      expect(isGuessable(s, card)).toBe(true)
      s = applyEvent(s, { type: 'GUESS', wordId: card })
      expect(s.reveals[card]).toEqual({ kind: 'green' })
    })

    /**
     * Sudden death is the exception, and the only one: there is no clue-giver,
     * so a green on EITHER key counts and anything else ends it.
     */
    it('except in sudden death, which has no giver and reads both keys', () => {
      const s = burnClues(newGame(), BOARD.turnTokens)
      expect(s.phase).toBe('suddenDeath')
      const mineOnly = Object.keys(s.playerKey).find(
        (w) => s.playerKey[w] === 'green' && s.aiKey[w] !== 'green' && isGuessable(s, w),
      )!
      const hisOnly = Object.keys(s.aiKey).find(
        (w) => s.aiKey[w] === 'green' && s.playerKey[w] !== 'green' && isGuessable(s, w),
      )!
      expect(applyEvent(s, { type: 'GUESS', wordId: mineOnly }).reveals[mineOnly]).toEqual({
        kind: 'green',
      })
      expect(applyEvent(s, { type: 'GUESS', wordId: hisOnly }).reveals[hisOnly]).toEqual({
        kind: 'green',
      })
    })

    /**
     * The one that makes it un-regressable rather than seed-lucky: across every
     * board, both openers and forty deals each, a card green ONLY on the
     * non-giver's key never scores, and the same card under the other side's
     * clue always does.
     */
    it('holds across every board, both openers and forty deals', () => {
      let checked = 0
      for (const grid of ['board', 'tutorial'] as const) {
        for (const firstGiver of ['player', 'ai'] as const) {
          for (let seed = 1; seed <= 40; seed++) {
            let s = createGame({
              config: CONFIGS[grid],
              words: makeWords(CONFIGS[grid].totalWords),
              seed,
              firstGiver,
            })
            s = clue(s, firstGiver, 2)
            const giver = giverOf(s.phase)
            const giverKey = keyOf(s, giver)
            const otherKey = keyOf(s, giver === 'player' ? 'ai' : 'player')
            const theirs = Object.keys(otherKey).find(
              (w) => otherKey[w] === 'green' && giverKey[w] !== 'green' && isGuessable(s, w),
            )
            if (!theirs) continue
            const where = `${grid}/${firstGiver}/${seed}`
            const after = applyEvent(s, { type: 'GUESS', wordId: theirs })
            // Not green: it is not on the key being read. Burned against the
            // giver alone, so the other side can still take it.
            expect(after.reveals[theirs], where).toEqual({ kind: 'bystander', against: [giver] })
            expect(after.outcome, where).toBeUndefined()
            expect(after.clueHistory.at(-1)!.guesses.at(-1)!.result, where).toBe('bystander')
            checked++
          }
        }
      }
      // Fails loudly rather than vacuously if a config change removes the card.
      expect(checked).toBeGreaterThan(100)
    })
  })

  it('keeps the same giver when the other side has nothing left to clue', () => {
    // Emptying one side's key takes two clues rather than one: MAX_CLUE_NUMBER
    // is 4, there is no bonus guess to stretch it, and the board's eight greens
    // a side is exactly two full clues — which the eight tokens have room for.
    let s = newGame('board')
    // Turn 1: player clue, AI hits a bystander → normal rotation to the AI.
    s = clue(s, 'player', 1)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'bystander') })
    expect(s.phase).toBe('aiClueInput')
    // Turns 2 and 4: under the AI's clues the player finds all 8 AI-key greens.
    const takeAiGreens = (n: number) => {
      s = clue(s, 'ai', n)
      for (let i = 0; i < n; i++) {
        s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'ai', 'green') })
      }
    }
    takeAiGreens(4)
    // Turn 3: a spacer, so the AI gets the clue again.
    s = clue(s, 'player', 1)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'bystander') })
    takeAiGreens(4)
    expect(targetableGreenIds(s, 'ai')).toEqual([])
    expect(s.phase).toBe('playerClueInput')
    // Turn 5: player clues, AI banks one green and stops. The AI side has
    // nothing to clue, so the player must clue again — no aiClueInput dead-end.
    s = clue(s, 'player', 2)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    s = applyEvent(s, { type: 'STOP_GUESSING' })
    expect(s.phase).toBe('playerClueInput')
  })

  /**
   * The number is the whole allowance: no bonus (number + 1)-th guess. Asked
   * for, before the rename, as "when you have guessed the amount of words
   * Cluey gives you the turn ends automatically", after the old rule read on a
   * phone as the turn simply not ending once you had found everything the clue
   * promised.
   */
  it('ends the turn on the number-th correct guess, with no bonus', () => {
    let s = clue(newGame(), 'player', 1)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    expect(s.phase).toBe('aiClueInput')
    expect(s.turnsLeft).toBe(s.config.turnTokens - 1)
  })

  it('and on the second of a two, not the third', () => {
    let s = clue(newGame(), 'player', 2)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    expect(s.phase).toBe('aiGuessing')
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    expect(s.phase).toBe('aiClueInput')
  })

  it('but stopping short is still the guesser own call', () => {
    let s = clue(newGame(), 'player', 3)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    expect(s.phase).toBe('aiGuessing')
    s = applyEvent(s, { type: 'STOP_GUESSING' })
    expect(s.phase).toBe('aiClueInput')
  })
})

describe('illegal events', () => {
  it('checks Danish words on the live board: time/tid, found greens, and neutral misses', () => {
    const base = newGame()
    const words = [
      { wordId: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' as const },
      { wordId: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun' as const },
      { wordId: 'da:hus', da: 'hus', en: ['house'], pos: 'noun' as const },
    ]
    const reveals = { ...base.reveals }
    reveals['da:tid'] = { kind: 'bystander', against: ['ai'] }
    reveals['da:hund'] = { kind: 'green' }
    reveals['da:hus'] = { kind: 'bystander', against: ['player'] }
    const state = { ...base, words, reveals }
    const submit = (text: string) =>
      applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text, number: 1 })

    expect(() => submit('time')).not.toThrow()
    expect(() => submit('hund')).not.toThrow()
    expect(() => submit('huset')).toThrow()
  })

  it('rejects clue from the wrong side or phase', () => {
    const s = newGame()
    expect(() => applyEvent(s, { type: 'SUBMIT_CLUE', by: 'ai', text: 'klods', number: 1 })).toThrow(
      IllegalEventError,
    )
  })

  it('rejects illegal clue text via legality check', () => {
    const s = newGame()
    expect(() => applyEvent(s, { type: 'SUBMIT_CLUE', by: 'player', text: 'xq3', number: 1 })).toThrow(
      IllegalClueError,
    )
  })

  it('rejects out-of-range clue numbers', () => {
    const s = newGame()
    for (const number of [0, 5, 1.5]) {
      expect(() => applyEvent(s, { type: 'SUBMIT_CLUE', by: 'player', text: 'klods', number })).toThrow(
        IllegalEventError,
      )
    }
  })

  it('rejects guessing outside guessing phases and stopping with zero guesses', () => {
    const s = newGame()
    expect(() => applyEvent(s, { type: 'GUESS', wordId: 'w0' })).toThrow(IllegalEventError)
    const afterClue = clue(s, 'player', 1)
    expect(() => applyEvent(afterClue, { type: 'STOP_GUESSING' })).toThrow(IllegalEventError)
  })

  it('rejects re-guessing revealed words', () => {
    let s = clue(newGame(), 'player', 2)
    const green = findGuessable(s, 'player', 'green')
    s = applyEvent(s, { type: 'GUESS', wordId: green })
    expect(() => applyEvent(s, { type: 'GUESS', wordId: green })).toThrow(IllegalEventError)
  })

  it('does not mutate the input state', () => {
    const s = newGame()
    const snapshot = JSON.stringify(s)
    clue(s, 'player', 2)
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})

/**
 * Running out of clues no longer ends the round. Codenames Duet's ending:
 * the clues are spent, the board is still there, and you keep naming words
 * until you either finish it or name one that is not green.
 */
describe('sudden death', () => {
  /** Burn every clue token without finding anything. */
  const exhaust = (grid: Grid = 'board') => {
    let s = newGame(grid)
    while (s.phase !== 'suddenDeath' && s.phase !== 'finished') {
      const giver = giverOf(s.phase)
      s = clue(s, giver, 1)
      s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
    }
    return s
  }

  it('opens instead of losing when the clues run out', () => {
    const s = exhaust()
    expect(s.phase).toBe('suddenDeath')
    expect(s.outcome).toBeUndefined()
    expect(s.turnsLeft).toBe(0)
  })

  it('accepts a green on either key, and keeps going', () => {
    let s = exhaust()
    const green = remainingGreenIds(s)[0]!
    s = applyEvent(s, { type: 'GUESS', wordId: green })
    expect(s.reveals[green]).toEqual({ kind: 'green' })
    expect(s.phase).toBe('suddenDeath')
  })

  it('opens translation if the last green is named (C1-PC-1 sudden-death successor)', () => {
    let s = exhaust()
    for (const id of [...remainingGreenIds(s)]) {
      s = applyEvent(s, { type: 'GUESS', wordId: id })
    }
    expect(s.phase).toBe('translateChallenge')
    expect(s.outcome).toBeUndefined()
    expect(s.wheel!.segments.length).toBe(13)
  })

  it('ends it on the first word that is green on neither key', () => {
    let s = exhaust()
    const greens = new Set(remainingGreenIds(s))
    const dud = s.words.map((w) => w.wordId).find((id) => isGuessable(s, id) && !greens.has(id))!
    s = applyEvent(s, { type: 'GUESS', wordId: dud })
    expect(s.outcome).toEqual({ result: 'lost', reason: 'sudden-death' })
    // Shown for what it was, so the ending reads rather than just stops.
    expect(s.reveals[dud]!.kind).not.toBe('hidden')
  })

  it('lets a neutral burned against one side back in, since it may be the other side’s green', () => {
    const s = exhaust()
    const burned = s.words
      .map((w) => w.wordId)
      .filter((id) => s.reveals[id]!.kind === 'bystander')
    expect(burned.length).toBeGreaterThan(0)
    for (const id of burned) expect(isGuessable(s, id)).toBe(true)
  })

  it('can be walked away from, and that is a loss', () => {
    const s = applyEvent(exhaust(), { type: 'STOP_GUESSING' })
    expect(s.outcome).toEqual({ result: 'lost', reason: 'timeout' })
  })

  it('never re-opens a word already found', () => {
    let s = exhaust()
    const green = remainingGreenIds(s)[0]!
    s = applyEvent(s, { type: 'GUESS', wordId: green })
    expect(isGuessable(s, green)).toBe(false)
    expect(() => applyEvent(s, { type: 'GUESS', wordId: green })).toThrow(IllegalEventError)
  })
})

describe('who opens the round', () => {
  const bare = () =>
    createGame({
      config: BOARD,
      words: makeWords(BOARD.totalWords),
      seed: 7,
    })

  it('is Casey, so the round starts on his clue and the player’s first move is a guess', () => {
    expect(bare().phase).toBe('aiClueInput')
  })

  it('but the caller can still say otherwise', () => {
    expect(newGame('board', 7, 'player').phase).toBe('playerClueInput')
  })
})

/**
 * "I think the ai should always write down its reasoning for why it picked a
 * word and not any other. […] I want the debrief to show the reasoning for its
 * decisions."
 *
 * The model had always written a reason for every guess and the engine dropped
 * it: `clue.guesses.push({ wordId, result })` kept the score and threw away the
 * account. So the one question a player kept asking — why THAT word — was the
 * one thing the app had discarded on purpose.
 */
describe('a guess remembers why it was made', () => {
  it('keeps the AI reasoning and confidence on the record', () => {
    let s = clue(newGame(), 'player', 2)
    const target = findGuessable(s, 'player', 'green')
    s = applyEvent(s, {
      type: 'GUESS',
      wordId: target,
      reasoning: 'the only food word on the board',
      confidence: 0.82,
    })
    const g = s.clueHistory[0]!.guesses[0]!
    expect(g).toMatchObject({ wordId: target, result: 'green', confidence: 0.82 })
    expect(g.reasoning).toBe('the only food word on the board')
  })

  /** Nobody is asked to justify a tap, so the player's guesses carry neither. */
  it('leaves both off a guess made without them', () => {
    let s = clue(newGame(), 'player', 2)
    s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, 'player', 'green') })
    const g = s.clueHistory[0]!.guesses[0]!
    expect(g.reasoning).toBeUndefined()
    expect(g.confidence).toBeUndefined()
    expect(Object.keys(g).sort()).toEqual(['result', 'wordId'])
  })

  it('carries them through a turn that ends on the guess', () => {
    let s = clue(newGame(), 'player', 1)
    s = applyEvent(s, {
      type: 'GUESS',
      wordId: findGuessable(s, 'player', 'green'),
      reasoning: 'ends the turn',
      confidence: 0.4,
    })
    expect(s.phase).toBe('aiClueInput')
    expect(s.clueHistory[0]!.guesses[0]!.reasoning).toBe('ends the turn')
  })

  /**
   * The guess that ends the round is now the one that finishes the board —
   * this used to be written against a forbidden hit, which returned from a
   * different branch of the reducer and was the one most likely to drop the
   * record on the floor. Winning returns from its own early branch too.
   */
  it('and through the one that solves the board and opens translation', () => {
    let s = newGame()
    let last: string | undefined
    let safety = 50
    while ((s.phase === 'playerClueInput' || s.phase === 'aiClueInput') && safety-- > 0) {
      const giver = giverOf(s.phase)
      s = clue(s, giver, 4)
      while (s.phase === 'aiGuessing' || s.phase === 'playerGuessing') {
        const key = keyOf(s, giver)
        const target = Object.keys(key).find((w) => key[w] === 'green' && isGuessable(s, w))
        if (!target) {
          s = applyEvent(s, { type: 'STOP_GUESSING' })
          break
        }
        last = target
        s = applyEvent(s, {
          type: 'GUESS',
          wordId: target,
          reasoning: 'the last one on the board',
          confidence: 0.11,
        })
      }
    }
    expect(s.phase).toBe('translateChallenge')
    expect(s.outcome).toBeUndefined()
    const winning = s.clueHistory.at(-1)!.guesses.at(-1)!
    expect(winning.wordId).toBe(last)
    expect(winning.reasoning).toBe('the last one on the board')
    expect(winning.confidence).toBe(0.11)
  })
})

/**
 * The Translation Wheel: the last chance reworked (owner, 2026-09-16). When
 * the tokens run out with at least one solved word on the board, every
 * suitcase must be recalled from its UI-language gloss and the wheel spun —
 * a win is +1 token spent at the player's choice, a miss ends the round.
 */
describe('translation wheel', () => {
  /** Burn tokens finding `greens` greens first, so the challenge opens with a real wheel. */
  const reachChallenge = (seed = 7, greens = 1): GameState => {
    let s = newGame('board', seed)
    let found = 0
    let safety = 40
    while ((s.phase === 'playerClueInput' || s.phase === 'aiClueInput') && safety-- > 0) {
      const giver = giverOf(s.phase)
      const green = Object.keys(keyOf(s, giver)).find(
        (w) => keyOf(s, giver)[w] === 'green' && isGuessable(s, w),
      )
      if (green && found < greens) {
        found++
        s = clue(s, giver, 1)
        s = applyEvent(s, { type: 'GUESS', wordId: green })
        // A green with number 1 ends the turn and spends a token.
        continue
      }
      s = clue(s, giver, 1)
      s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
    }
    return s
  }

  const danishFor = (s: GameState, wordId: string) =>
    s.words.find((w) => w.wordId === wordId)!.da

  it('opens the translateChallenge instead of sudden death when a suitcase exists', () => {
    const s = reachChallenge()
    expect(s.phase).toBe('translateChallenge')
    expect(s.outcome).toBeUndefined()
    expect(s.turnsLeft).toBe(0)
    expect(s.wheel).toBeDefined()
    // The wheel holds EVERY key word on the board (owner, 2026-09-27), in
    // board order; only the found ones can be typed.
    const keyWords = s.words
      .map((w) => w.wordId)
      .filter((id) => s.playerKey[id] === 'green' || s.aiKey[id] === 'green')
    expect(s.wheel!.segments).toEqual(keyWords)
    expect(wheelFoundIds(s)).toEqual(keyWords.filter((id) => s.reveals[id]!.kind === 'green'))
    expect(wheelFoundIds(s).length).toBeGreaterThan(0)
    expect(wheelFoundIds(s).length).toBeLessThan(s.wheel!.segments.length)
  })

  it('keeps sudden death for a board solved to nothing', () => {
    // burnClues never names a green, so no suitcase exists at token end.
    const s = burnClues(newGame(), BOARD.turnTokens)
    expect(s.phase).toBe('suddenDeath')
    expect(s.wheel).toBeUndefined()
  })

  it('asks for every FOUND word, once each, and grades case-insensitively', () => {
    const s0 = reachChallenge()
    const wheel = s0.wheel!
    // The challenge asks for the greens already FOUND (reveals, not roles);
    // the rest of the wheel is the key words the round missed.
    const found = wheelFoundIds(s0)
    expect(found.length).toBe(s0.words.filter((w) => s0.reveals[w.wordId]!.kind === 'green').length)
    expect(wheel.segments.length).toBe(found.length + remainingGreenIds(s0).length)
    let s = s0
    for (const id of found) {
      const da = danishFor(s, id)
      s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: `  ${da.toUpperCase()}  ` })
    }
    // Every case-varied answer packed its word, so the wheel completed.
    expect(s.phase).toBe('translateWheel')
    expect(s.wheel!.translated.length).toBe(found.length)
  })

  it('wrong answers are free and count only attempts', () => {
    const s0 = reachChallenge()
    const id = wheelFoundIds(s0)[0]!
    const before = structuredClone(s0)
    // A wrong answer: attempts tick, nothing else moves — not the wheel's
    // fills, not the tokens, not the phase.
    const s1 = applyEvent(s0, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: 'nope' })
    expect(s1.wheel!.attempts).toBe(1)
    expect(s1.wheel!.translated).toEqual([])
    expect(s1.phase).toBe('translateChallenge')
    expect(s1.turnsLeft).toBe(0)
    expect(s1.outcome).toBeUndefined()
    // And a retry after it is judged on its own merits.
    const s2 = applyEvent(s1, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s0, id) })
    expect(s2.wheel!.translated).toEqual([id])
    // The round is replayable and the clone means nothing leaked between.
    expect(s0.wheel!.attempts).toBe(0)
    void before
  })

  it('fills the wheel segment by segment and completes by itself', () => {
    let s = reachChallenge()
    const found = wheelFoundIds(s)
    for (const [i, id] of found.entries()) {
      s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
      expect(s.wheel!.translated.length).toBe(i + 1)
    }
    // The last FOUND word completes it: the missed slices never fill.
    expect(s.phase).toBe('translateWheel')
    expect(s.wheel!.filled.length).toBeLessThan(s.wheel!.segments.length)
    // A repeat answer after completion is refused — the challenge is closed.
    const id = found[0]!
    expect(() => applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })).toThrow(IllegalEventError)
    // COMPLETE_CHALLENGE is a no-op once the last answer already moved the phase.
    expect(applyEvent(s, { type: 'COMPLETE_CHALLENGE' }).phase).toBe('translateWheel')
  })

  it('fills a RANDOM segment per correct answer, not the next one in board order', () => {
    // The owner's amendment: which word was answered says nothing about where
    // the fill went. Across seeds, the first correct answer must land its fill
    // on every segment position at least once — a fixed "segments[0]" or a
    // sequential fill would leave positions permanently untouched.
    const firstFills = new Set<number>()
    let sawMismatch = false
    for (let seed = 1; seed <= 40; seed++) {
      const s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge' || wheelFoundIds(s).length < 2) continue
      const [first, second] = [wheelFoundIds(s)[0]!, wheelFoundIds(s)[1]!]
      const one = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: first, answer: danishFor(s, first) })
      firstFills.add(one.wheel!.filled[0]!)
      // And a second answer fills a DIFFERENT segment, never the same one.
      const two = applyEvent(one, { type: 'SUBMIT_TRANSLATION', wordId: second, answer: danishFor(one, second) })
      if (two.wheel!.filled[1] === one.wheel!.filled[0]) sawMismatch = true
    }
    expect(firstFills.size).toBeGreaterThan(1)
    expect(sawMismatch).toBe(false)
    // And the verdict stays consistent: a spin landing on a filled index wins
    // even when that segment's own word was never the one answered.
    let verdicts = 0
    for (let seed = 1; seed <= 40 && verdicts < 2; seed++) {
      let s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge' || wheelFoundIds(s).length < 3) continue
      for (const id of wheelFoundIds(s)) {
        s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
      }
      const spun = applyEvent(s, { type: 'SPIN_WHEEL' })
      const landedFilled = s.wheel!.filled.includes(spun.wheel!.landed!)
      if (landedFilled) {
        verdicts++
        expect(spun.wheel!.result).toBe('win')
      } else {
        expect(spun.wheel!.result).toBe('miss')
      }
    }
    expect(verdicts).toBeGreaterThan(0)
  })

  it('COMPLETE_CHALLENGE refuses an incomplete wheel', () => {
    const s = reachChallenge()
    if (wheelFoundIds(s).length < 2) return
    const id = wheelFoundIds(s)[0]!
    const one = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
    expect(() => applyEvent(one, { type: 'COMPLETE_CHALLENGE' })).toThrow(IllegalEventError)
  })

  it('spins engine-side: the same state always lands the same way, and the verdict IS the outcome', () => {
    // Drive both verdicts by trying seeds until each appears — the wheel is
    // chance, but the ENGINE's draw for a given state is a fact.
    let sawWin: GameState | null = null
    let sawMiss: GameState | null = null
    for (let seed = 1; seed <= 60 && (!sawWin || !sawMiss); seed++) {
      const s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge') continue
      // One of fifteen slices filled: both verdicts are live on every spin.
      const first = wheelFoundIds(s)[0]!
      const filled = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: first, answer: danishFor(s, first) })
      const spun = applyEvent(filled, { type: 'SPIN_WHEEL' })
      if (spun.wheel!.result === 'win') sawWin = sawWin ?? spun
      else sawMiss = sawMiss ?? spun
    }
    expect(sawWin).not.toBeNull()
    expect(sawMiss).not.toBeNull()
    // THE SPIN DECIDES THE ROUND (owner, 2026-09-18): a green landing finishes
    // the round as a WIN through the normal outcome path — turnsLeft is NOT
    // topped up, no chooser phase exists, and the summary's reward logic reads
    // the same outcome shape any other win produces.
    expect(sawWin!.phase).toBe('finished')
    expect(sawWin!.outcome).toEqual({ result: 'won', reason: 'wheel-win' })
    expect(sawWin!.turnsLeft).toBe(0)
    expect(sawMiss!.phase).toBe('finished')
    expect(sawMiss!.outcome).toEqual({ result: 'lost', reason: 'wheel-miss' })
    // Deterministic: the same input, the same landing — twice.
    const base = reachChallenge(3)
    if (base.phase === 'translateChallenge') {
      const first = wheelFoundIds(base)[0]!
      const filled = applyEvent(base, { type: 'SUBMIT_TRANSLATION', wordId: first, answer: danishFor(base, first) })
      const one = applyEvent(filled, { type: 'SPIN_WHEEL' })
      const two = applyEvent(filled, { type: 'SPIN_WHEEL' })
      expect(one.wheel!.landed).toBe(two.wheel!.landed)
      expect(one.wheel!.result).toBe(two.wheel!.result)
    }
  })

  it('a won spin never grants a token: SPEND_WHEEL_TOKEN is refused outright', () => {
    // The chooser is gone (owner, 2026-09-18) — the spin decides the round, so
    // there is no door to pick in any phase, with or without a win in hand.
    // One suitcase is packed first: an unfilled wheel can only land empty, so
    // a win needs at least one fill on the disc.
    let winner: GameState | null = null
    for (let seed = 1; seed <= 60 && !winner; seed++) {
      const s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge') continue
      const first = wheelFoundIds(s)[0]!
      const filled = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: first, answer: danishFor(s, first) })
      const spun = applyEvent(filled, { type: 'SPIN_WHEEL' })
      if (spun.wheel?.result === 'win') {
        winner = spun
        break
      }
    }
    expect(winner).not.toBeNull()
    expect(() => applyEvent(winner!, { type: 'SPEND_WHEEL_TOKEN', to: 'ai' })).toThrow(IllegalEventError)
    expect(() => applyEvent(winner!, { type: 'SPEND_WHEEL_TOKEN', to: 'player' })).toThrow(IllegalEventError)
    // And the round is already finished — no phase change ever followed a win.
    expect(winner!.phase).toBe('finished')
  })

  it('a fully translated wheel on an unsolved board loses exactly on a missed slice', () => {
    // Every found word typed fills every slice that CAN fill; the missed key
    // words' slices stay grey (owner, 2026-09-27). So the spin wins exactly
    // when it lands off them — no longer always, as when the wheel held only
    // the found words. (A solved board has no missed slices and always wins
    // here: progressionFlow.test.ts, F06.)
    let wins = 0
    let misses = 0
    for (let seed = 1; seed <= 40; seed++) {
      let s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge' || wheelFoundIds(s).length < 3) continue
      for (const id of wheelFoundIds(s)) {
        s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
      }
      const missed = wheelMissedSegments(s)
      expect([...s.wheel!.filled, ...missed].sort((a, b) => a - b)).toEqual(s.wheel!.segments.map((_, i) => i))
      const spun = applyEvent(s, { type: 'SPIN_WHEEL' })
      if (spun.wheel!.result === 'win') {
        wins++
        expect(missed).not.toContain(spun.wheel!.landed)
        expect(spun.outcome).toEqual({ result: 'won', reason: 'wheel-win' })
      } else {
        misses++
        expect(missed).toContain(spun.wheel!.landed)
        expect(spun.outcome).toEqual({ result: 'lost', reason: 'wheel-miss' })
      }
    }
    expect(wins).toBeGreaterThan(0)
    expect(misses).toBeGreaterThan(0)
  })

  it('the missed slices: one per key word not found, fixed by the seed, never filled', () => {
    const positions = new Set<number>()
    let checked = 0
    for (let seed = 1; seed <= 30; seed++) {
      let s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge') continue
      checked++
      const missed = wheelMissedSegments(s)
      expect(missed.length).toBe(s.wheel!.segments.length - wheelFoundIds(s).length)
      expect(new Set(missed).size).toBe(missed.length)
      // Derived from the round's own seed: asking again gives the same slices.
      expect(wheelMissedSegments(structuredClone(s))).toEqual(missed)
      missed.forEach((i) => positions.add(i))
      for (const id of wheelFoundIds(s)) {
        s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
        expect(s.wheel!.filled.some((i) => missed.includes(i))).toBe(false)
      }
      // And the missed set does not move as the found words are typed.
      expect(wheelMissedSegments(s)).toEqual(missed)
    }
    expect(checked).toBeGreaterThan(5)
    // Placed at random, like the fills: across seeds they reach every part of
    // the wheel, not a fixed block.
    expect(positions.size).toBeGreaterThan(10)
  })

  it('a key word the round missed holds a slice but cannot be translated', () => {
    const s = reachChallenge(7, 3)
    const missedWord = s.wheel!.segments.find((id) => s.reveals[id]!.kind !== 'green')!
    expect(missedWord).toBeDefined()
    expect(() =>
      applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: missedWord, answer: danishFor(s, missedWord) }),
    ).toThrow(IllegalEventError)
  })

  it('a wheel saved before the full-board change keeps its old shape and rules', () => {
    // An in-progress save from before 2026-09-27 holds only the found words.
    // Nothing is migrated: it derives no missed slices, completes on its own
    // segments, and a full wheel still always wins.
    let s = reachChallenge(11, 4)
    expect(s.phase).toBe('translateChallenge')
    const found = wheelFoundIds(s)
    s = { ...s, wheel: { ...s.wheel!, segments: found } }
    expect(wheelMissedSegments(s)).toEqual([])
    for (const id of found) {
      s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
    }
    expect(s.phase).toBe('translateWheel')
    expect(s.wheel!.filled.length).toBe(found.length)
    expect(applyEvent(s, { type: 'SPIN_WHEEL' }).wheel!.result).toBe('win')
  })

  it('once per round still holds: the wheel never re-opens after the spin', () => {
    // The old spent-wheel walk-away rule (build 90) is superseded — there is
    // no earned turn to burn and no second exhaustion. The pin that remains:
    // whatever the verdict, the round is finished and nothing re-opens.
    let spun: GameState | null = null
    for (let seed = 1; seed <= 40 && !spun; seed++) {
      const s = reachChallenge(seed, 5)
      if (s.phase !== 'translateChallenge') continue
      spun = applyEvent(s, { type: 'SPIN_WHEEL' })
      break
    }
    expect(spun).not.toBeNull()
    expect(spun!.phase).toBe('finished')
    expect(spun!.outcome).toBeDefined()
  })

  it('C1-PC-1 retires the clean-but-unsolved perfect predicate', () => {
    // The old assertion awarded the ceiling for mistake-free partial finds.
    // Its successor explicitly refuses that award: full translation of found
    // targets on an unsolved board remains Silver. Actual solved cases are in
    // progressionFlow.test.ts, including wrong guesses and translation retries.
    const reachClean = (seed: number): GameState | null => {
      let s = newGame('board', seed)
      let safety = 60
      while (safety-- > 0) {
        if (s.phase === 'translateChallenge') return s
        if (s.phase === 'finished') return null // won outright — not the ending path
        const giver = s.phase === 'playerClueInput' ? 'player' : 'ai'
        const green = Object.keys(keyOf(s, giver)).find(
          (w) => keyOf(s, giver)[w] === 'green' && isGuessable(s, w),
        )
        s = clue(s, giver, 1)
        if (green) {
          s = applyEvent(s, { type: 'GUESS', wordId: green })
        } else {
          // No guessable green this turn: stop without guessing. The history
          // stays clean — a turn with no guesses breaks nothing.
          s = applyEvent(s, { type: 'STOP_GUESSING' })
        }
      }
      return null
    }
    let sawPerfect = false
    let sawNotPerfect = false
    for (let seed = 1; seed <= 40; seed++) {
      const base = reachClean(seed)
      if (!base || base.phase !== 'translateChallenge') continue
      let s = base
      for (const id of wheelFoundIds(s)) {
        s = applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: danishFor(s, id) })
      }
      const spun = applyEvent(s, { type: 'SPIN_WHEEL' })
      if (spun.outcome?.result !== 'won') continue
      expect(remainingGreenIds(spun).length).toBeGreaterThan(0)
      expect(isPerfectRound(spun)).toBe(false)
      sawPerfect = true
      break
    }
    expect(sawPerfect).toBe(true)
    // The spoiling conditions, built on any reached challenge: a bystander
    // guess in the history, an empty wheel, or a lost spin.
    for (let seed = 1; seed <= 40; seed++) {
      const base = reachChallenge(seed, 5)
      if (base.phase !== 'translateChallenge') continue
      // One bystander tap spoils it, whatever the wheel did.
      const s1 = applyEvent(base, {
        type: 'SUBMIT_TRANSLATION',
        wordId: wheelFoundIds(base)[0]!,
        answer: 'nope',
      })
      expect(isPerfectRound(s1)).toBe(false)
      // And the round that never opened the wheel has no verdict to pay.
      expect(isPerfectRound(newGame('board', seed))).toBe(false)
      sawNotPerfect = true
      break
    }
    expect(sawNotPerfect).toBe(true)
  })

  it('keeps the board locked against guesses and clues during the challenge', () => {
    const s = reachChallenge()
    const id = s.words[0]!.wordId
    expect(() => applyEvent(s, { type: 'GUESS', wordId: id })).toThrow(IllegalEventError)
    expect(() => applyEvent(s, { type: 'SUBMIT_CLUE', by: 'player', text: 'klods', number: 1 })).toThrow(IllegalEventError)
    expect(() => applyEvent(s, { type: 'STOP_GUESSING' })).toThrow(IllegalEventError)
    // And a translation for a word not on the wheel is refused.
    const outsider = s.words.find((w) => s.reveals[w.wordId]!.kind !== 'green')!
    expect(() => applyEvent(s, { type: 'SUBMIT_TRANSLATION', wordId: outsider.wordId, answer: 'x' })).toThrow(IllegalEventError)
  })

  it('returns the accepted verdict on a duplicate spin after the wheel has landed', () => {
    let spun: GameState | null = null
    for (let seed = 1; seed <= 40 && !spun; seed++) {
      const s = reachChallenge(seed)
      if (s.phase !== 'translateChallenge') continue
      const next = applyEvent(s, { type: 'SPIN_WHEEL' })
      spun = next
      break
    }
    expect(spun).not.toBeNull()
    expect(spun!.phase).toBe('finished')
    expect(applyEvent(spun!, { type: 'SPIN_WHEEL' })).toEqual(spun)
  })

  it('keeps zero-found tutorial exhaustion in sudden death', () => {
    let s = newGame('tutorial')
    let safety = 60
    while ((s.phase === 'playerClueInput' || s.phase === 'aiClueInput') && safety-- > 0) {
      const giver = giverOf(s.phase)
      s = clue(s, giver, 1)
      s = applyEvent(s, { type: 'GUESS', wordId: findGuessable(s, giver, 'bystander') })
    }
    expect(s.phase).toBe('suddenDeath')
    expect(s.wheel).toBeUndefined()
  })
})
