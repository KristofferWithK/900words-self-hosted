import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { chooseCaseyGuess } from './caseyAssist'

const candidate = (wordId: string, confidence: number) => ({
  wordId,
  confidence,
  reasoning: `reasoning for ${wordId}`,
})

const state = (first: 'green' | 'bystander', second: 'green' | 'bystander') =>
  ({
    phase: 'aiGuessing',
    playerKey: { first, second },
    reveals: {
      first: { kind: 'hidden' },
      second: { kind: 'hidden' },
    },
  }) as unknown as GameState

describe('Casey top-two assistance', () => {
  it('rescues a first-choice miss with the second-ranked green', () => {
    const result = chooseCaseyGuess(
      state('bystander', 'green'),
      [candidate('first', 0.9), candidate('second', 0.4)],
      true,
    )

    expect(result).toEqual({
      choice: candidate('second', 0.4),
      unassistedWordId: 'first',
      rescued: true,
      secondChoiceWordId: 'first',
    })
  })

  it.each([
    { name: 'first green', roles: ['green', 'bystander'] as const, assisted: true, chosen: 'first', rescued: false },
    { name: 'both green', roles: ['green', 'green'] as const, assisted: true, chosen: 'first', rescued: false },
    { name: 'neither green', roles: ['bystander', 'bystander'] as const, assisted: true, chosen: 'first', rescued: false },
    { name: 'assistance off', roles: ['bystander', 'green'] as const, assisted: false, chosen: 'first', rescued: false },
  ])('uses the first model choice for $name', ({ roles, assisted, chosen, rescued }) => {
    const result = chooseCaseyGuess(
      state(roles[0], roles[1]),
      [candidate('first', 0.1), candidate('second', 0.99)],
      assisted,
    )
    expect(result?.choice.wordId).toBe(chosen)
    expect(result?.secondChoiceWordId).toBe('second')
    expect(result?.rescued).toBe(rescued)
  })

  it('preserves model rank instead of reordering alternatives by confidence', () => {
    const result = chooseCaseyGuess(
      state('green', 'green'),
      [candidate('first', 0.1), candidate('second', 0.99)],
      true,
    )
    expect(result?.choice).toEqual(candidate('first', 0.1))
  })

  it('fails safely for duplicate, unknown, revealed, and missing candidates', () => {
    const base = state('bystander', 'green')
    base.playerKey.unsupplied = 'green'
    base.reveals.unsupplied = { kind: 'hidden' }
    base.playerKey.revealed = 'green'
    base.reveals.revealed = { kind: 'green' }

    const result = chooseCaseyGuess(
      base,
      [
        candidate('unknown', 1),
        candidate('first', 0.9),
        candidate('first', 0.8),
        candidate('revealed', 0.7),
      ],
      true,
    )
    expect(result?.choice.wordId).toBe('first')
    expect(result?.unassistedWordId).toBe('first')
    expect(result?.rescued).toBe(false)
    expect(result?.secondChoiceWordId).toBeUndefined()
    expect(result?.choice.wordId).not.toBe('unsupplied')
    expect(chooseCaseyGuess(base, [], true)).toBeNull()
  })

  it('applies directional reveal legality under the player clue', () => {
    const base = state('bystander', 'green')
    base.reveals.first = { kind: 'bystander', against: ['ai'] }
    expect(chooseCaseyGuess(base, [candidate('first', 0.9), candidate('second', 0.8)], true)?.choice.wordId)
      .toBe('second')

    base.reveals.first = { kind: 'bystander', against: ['player'] }
    const burned = chooseCaseyGuess(base, [candidate('first', 0.9), candidate('second', 0.8)], true)
    expect(burned).toMatchObject({ unassistedWordId: 'second', rescued: false })
  })

  it('pairs assisted and unassisted fixture outcomes from the same returned candidates', () => {
    const candidates = [candidate('first', 0.92), candidate('second', 0.41)]
    const fixture = state('bystander', 'green')
    const unassisted = chooseCaseyGuess(fixture, candidates, false)!
    const assisted = chooseCaseyGuess(fixture, candidates, true)!

    // Fixture measurement only, not a claim about live model performance.
    expect({
      sameReturnedCandidates: true,
      unassisted: unassisted.choice.wordId,
      assisted: assisted.choice.wordId,
      rescued: assisted.rescued,
    }).toEqual({
      sameReturnedCandidates: true,
      unassisted: 'first',
      assisted: 'second',
      rescued: true,
    })
  })
})
