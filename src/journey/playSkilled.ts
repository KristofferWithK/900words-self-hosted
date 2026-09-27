import { WORDS } from '../data/words'
import type { WordEntry } from '../data/types'
import {
  applyEvent as applyEventIn,
  giverOf,
  isGuessable,
  remainingGreenIds,
  targetableGreenIds,
} from '../engine/game'
import { checkClueLegality } from '../engine/legality'
import type { Rng } from '../engine/rng'
import type { GameState } from '../engine/types'
import { danish } from '../lang/da'
import type { RoundWordResult } from '../srs/types'

/**
 * THE SIMULATED PLAYER the journey's harnesses share — `pacing.test.ts`,
 * which prices the wrap-up economy, and `wrapup-composition.test.ts`, which
 * measures what the composer deals. One copy, so a round measured in one is
 * a round measured in the other; it is test support and nothing in the app
 * imports it.
 *
 * The player is a hash with a probability: both sides clue for up to three
 * of whatever they have left with a legal nonsense word, and a guess finds a
 * word the giver meant with probability `skill`, otherwise lands anywhere
 * still open. It is the model `selfplay.test.ts` walks, so a win rate here
 * is a win rate there.
 */

const applyEvent = (s: GameState, e: Parameters<typeof applyEventIn>[1]) => applyEventIn(s, e, danish)

/** A legal nonsense clue for whatever is on this board. */
export function nonsenseClue(state: GameState, turn: number): string {
  for (let i = 0; i < 60; i++) {
    const candidate = `zxklodrup${turn}q${i}`
    const visibleWords = state.words.filter((word) => state.reveals[word.wordId]?.kind !== 'green')
    if (checkClueLegality(candidate, visibleWords, danish).legal) return candidate
  }
  throw new Error('could not produce a legal clue')
}

/** One round at a given skill, on the real engine. */
export function playSkilled(start: GameState, skill: number, rng: Rng): GameState {
  let s = start
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]!
  for (let guard = 0; s.phase !== 'finished' && guard < 400; guard++) {
    if (s.phase === 'playerClueInput' || s.phase === 'aiClueInput') {
      const giver = giverOf(s.phase)
      s = applyEvent(s, {
        type: 'SUBMIT_CLUE',
        by: giver,
        text: nonsenseClue(s, s.clueHistory.length),
        number: Math.min(3, targetableGreenIds(s, giver).length),
      })
      continue
    }
    if (s.phase === 'playerGuessing' || s.phase === 'aiGuessing') {
      const meant = targetableGreenIds(s, giverOf(s.phase))
      const open = s.words.filter((w) => isGuessable(s, w.wordId))
      const right = meant.length > 0 && rng() < skill
      s = applyEvent(s, { type: 'GUESS', wordId: right ? pick(meant) : pick(open).wordId })
      continue
    }
    // The last chance: no giver, so a green on either key counts.
    const alive = remainingGreenIds(s).filter((id) => isGuessable(s, id))
    const open = s.words.filter((w) => isGuessable(s, w.wordId))
    const right = alive.length > 0 && rng() < skill
    s = applyEvent(s, { type: 'GUESS', wordId: right ? pick(alive) : pick(open).wordId })
  }
  return s
}

/**
 * The SRS results a finished round owes — the credit rule from `finishRound`
 * (gameStore.ts), copied verbatim in shape. A green under a clue
 * `by: 'player'` is Casey finding the player's word, so the player's CLUE
 * earned it; a green under `by: 'ai'` is the player's own tap; and a green
 * that appears in no clue's guesses was named in sudden death, which is
 * guess credit. `progress.test.ts` pins the two readings of "collected" to
 * each other.
 */
export function resultsFor(game: GameState): RoundWordResult[] {
  const greenUnder = (side: 'player' | 'ai', wordId: string) =>
    game.clueHistory.some(
      (c) => c.by === side && c.guesses.some((g) => g.wordId === wordId && g.result === 'green'),
    )
  return game.words.map((w) => {
    const guessedGreen = game.reveals[w.wordId]!.kind === 'green'
    const greenByOwnClue = greenUnder('player', w.wordId)
    const greenByOwnGuess = greenUnder('ai', w.wordId) || (guessedGreen && !greenByOwnClue)
    return {
      wordId: w.wordId,
      guessedGreen,
      guessedWrong: game.clueHistory.some(
        (c) => c.by === 'ai' && c.guesses.some((g) => g.wordId === w.wordId && g.result !== 'green'),
      ),
      greenByOwnClue,
      greenByOwnGuess,
      lookedUp: false,
    }
  })
}

/** Dictionary entries as the engine's board words. */
export const boardWords = (ws: readonly WordEntry[]) =>
  ws.map((w) => ({ wordId: w.id, da: w.da, en: w.en, pos: w.pos }))

/** The shipped dictionary, re-exported so a harness needs one import for its board. */
export { WORDS }
