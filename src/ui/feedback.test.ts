import { describe, expect, it } from 'vitest'
import type { GameState } from '../engine/types'
import { completedClue } from './feedback'

const gameWith = (number: number, results: Array<'green' | 'bystander'>) =>
  ({
    clueHistory: [
      {
        by: 'ai',
        text: 'test',
        number,
        guesses: results.map((result, index) => ({ wordId: `${index}`, result })),
      },
    ],
  }) as GameState

describe('completedClue', () => {
  it('rewards exactly the promised number of correct guesses', () => {
    expect(completedClue(gameWith(2, ['green']))).toBe(false)
    expect(completedClue(gameWith(2, ['green', 'green']))).toBe(true)
  })

  it('does not reward a turn that ended on a neutral', () => {
    expect(completedClue(gameWith(2, ['green', 'bystander']))).toBe(false)
  })

  it('works the same regardless of which side gave the clue', () => {
    const game = gameWith(1, ['green'])
    game.clueHistory[0]!.by = 'player'
    expect(completedClue(game)).toBe(true)
  })
})
