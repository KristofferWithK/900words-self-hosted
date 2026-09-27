import type { GameState } from '../engine/types'
import type { LearningEffect } from '../progression/types'
import { applyRoundResults } from './scheduler'
import type { RoundWordResult, SrsMap, WordStats } from './types'

// Same collection predicate as journey/progress, without its ACTIVE/data import:
// receipt validation must also run before language selection/store hydration.
const isCollected = (stats: WordStats | undefined, wrapped: boolean): boolean =>
  wrapped || (!!stats && stats.greenByClue >= 1 && stats.greenByGuess >= 1)

/** The existing finish signals, independent of translation, medals and rewards. */
export function roundLearningResults(game: GameState, lookedUp: readonly string[]): RoundWordResult[] {
  const ids = new Set(game.words.map((word) => word.wordId))
  if (lookedUp.some((id) => !ids.has(id))) throw new Error('Unknown learning lookup')
  for (const clue of game.clueHistory) {
    const key = clue.by === 'player' ? game.playerKey : game.aiKey
    if (clue.guesses.some((guess) => !ids.has(guess.wordId) || key[guess.wordId] !== guess.result ||
      (guess.result === 'green' && game.reveals[guess.wordId]?.kind !== 'green'))) {
      throw new Error('Learning history conflicts with clue-giver key')
    }
  }
  return game.words.map(({ wordId }) => {
    const greenUnder = (side: 'player' | 'ai') => game.clueHistory.some((clue) =>
      clue.by === side && clue.guesses.some((guess) => guess.wordId === wordId && guess.result === 'green'))
    const guessedGreen = game.reveals[wordId]?.kind === 'green'
    const greenByOwnClue = greenUnder('player')
    return {
      wordId, guessedGreen,
      guessedWrong: game.clueHistory.some((clue) => clue.by === 'ai' &&
        clue.guesses.some((guess) => guess.wordId === wordId && guess.result !== 'green')),
      greenByOwnClue, greenByOwnGuess: greenUnder('ai') || (guessedGreen && !greenByOwnClue),
      lookedUp: lookedUp.includes(wordId),
    }
  })
}

/** Compute once, before committing the receipt. Recovery applies exact patches. */
export function prepareLearning(game: GameState, lookedUp: readonly string[], before: SrsMap,
  wrapped: Readonly<Record<string, number>>, acceptedAt: number): LearningEffect {
  const results = roundLearningResults(game, lookedUp)
  const after = applyRoundResults(before, results, acceptedAt)
  const ids = results.map((result) => result.wordId)
  return {
    results,
    changes: ids.map((wordId) => ({ wordId, before: before[wordId] ?? null, after: after[wordId]! })),
    newlyDiscovered: ids.filter((id) => !before[id]),
    newlyCollected: ids.filter((id) => !isCollected(before[id], id in wrapped) && isCollected(after[id], id in wrapped)),
  }
}
