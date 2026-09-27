import { describe, expect, it } from 'vitest'
import { MATRIX_FIXTURES } from '../progression/fixtures'
import { newStats } from './scheduler'
import { prepareLearning, roundLearningResults } from './settlement'

describe('captured settlement learning', () => {
  it('uses actual clue-giver history, with sudden-death reveals giving only guess credit', () => {
    const game = structuredClone(MATRIX_FIXTURES[5].game)
    game.clueHistory = [{ by: 'player', text: 'clue', number: 2, guesses: [{ wordId: 'a', result: 'green' }, { wordId: 'b', result: 'green' }] }]
    const results = roundLearningResults(game, ['a'])
    expect(results.find((r) => r.wordId === 'a')).toMatchObject({ greenByOwnClue: true, greenByOwnGuess: false, lookedUp: true })
    expect(results.find((r) => r.wordId === 'c')).toMatchObject({ greenByOwnClue: false, greenByOwnGuess: true })
    expect(results.find((r) => r.wordId === 'n')).toMatchObject({ guessedGreen: false, greenByOwnClue: false, greenByOwnGuess: false })
  })

  it('translation completion adds no directional evidence and preserves wrapped collection', () => {
    const complete = structuredClone(MATRIX_FIXTURES[5].game)
    const partial = structuredClone(MATRIX_FIXTURES[4].game)
    const stats = { a: { ...newStats(50), greenByClue: 1 } }
    const a = prepareLearning(complete, [], stats, { a: 10 }, 100)
    const b = prepareLearning(partial, [], stats, { a: 10 }, 100)
    expect(a).toEqual(b)
    expect(a.newlyCollected).toEqual([])
    expect(a.changes[0].after).toMatchObject({ seen: 1, greenByClue: 1, greenByGuess: 1, lastSeenAt: 100 })
    expect(stats.a).toEqual({ ...newStats(50), greenByClue: 1 })
  })

  it('refuses unknown lookups and impossible history rather than minting learning', () => {
    const game = structuredClone(MATRIX_FIXTURES[5].game)
    expect(() => roundLearningResults(game, ['missing'])).toThrow('Unknown learning lookup')
    game.clueHistory = [{ by: 'ai', text: 'clue', number: 1, guesses: [{ wordId: 'a', result: 'green' }] }]
    expect(() => roundLearningResults(game, [])).toThrow('clue-giver key')
  })
})
