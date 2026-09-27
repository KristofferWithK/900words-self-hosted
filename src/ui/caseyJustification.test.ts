import { describe, expect, it } from 'vitest'
import type { GameState } from '../engine/types'
import { UI } from '../i18n'
import { landedCaseyGuess, caseyBubble } from './caseyJustification'

const guess = { wordId: 'chosen', reasoning: 'Chosen fits the clue.', secondChoiceWordId: 'other' }
const game = (result: 'green' | 'bystander') => ({
  words: [{ wordId: 'chosen', da: 'hus' }, { wordId: 'other', da: 'hjem' }],
  reveals: { chosen: { kind: result }, other: { kind: 'hidden' } },
  clueHistory: [{ by: 'player', guesses: [{ wordId: 'chosen', result }] }],
}) as unknown as GameState

describe('Casey reveal justification', () => {
  it('never shows an alternate before the actual reveal', () => {
    const before = game('bystander')
    before.clueHistory[0]!.guesses = []
    expect(landedCaseyGuess(before, guess)).toBeNull()
    expect(caseyBubble(null, guess)).toBe(guess.reasoning)
  })
  it('green shows only the selected reasoning even with another hidden card', () => {
    expect(caseyBubble(landedCaseyGuess(game('green'), guess), guess)).toBe(guess.reasoning)
  })
  it('non-green shows the actual alternate, holding selected reasoning across queue shift', () => {
    const landed = landedCaseyGuess(game('bystander'), guess)
    expect(caseyBubble(landed, { reasoning: 'Next turn reason.' })).toBe(
      UI.casey.withSecondChoice(guess.reasoning, 'hjem'),
    )
    expect(caseyBubble(null, { reasoning: 'Next turn reason.' })).toBe('Next turn reason.')
  })
  it.each([undefined, 'chosen', 'unknown'])('omits unavailable/duplicate candidate %s', (secondChoiceWordId) => {
    expect(caseyBubble(landedCaseyGuess(game('bystander'), { ...guess, secondChoiceWordId }), guess)).toBe(guess.reasoning)
  })
  it.each([{ kind: 'green' }, { kind: 'bystander', against: ['player'] }])('omits a candidate already revealed under this clue', (reveal) => {
    const state = game('bystander')
    state.reveals.other = reveal as GameState['reveals'][string]
    expect(caseyBubble(landedCaseyGuess(state, guess), guess)).toBe(guess.reasoning)
  })
  it('legacy/authored queue rows never imply an alternate', () => {
    expect(caseyBubble(landedCaseyGuess(game('bystander'), { wordId: 'chosen', reasoning: guess.reasoning }), { reasoning: 'Next authored guess.' })).toBe(guess.reasoning)
  })
  it('reload and a new clue cannot resurrect a landed alternate', () => {
    expect(landedCaseyGuess(game('bystander'), null)).toBeNull()
    const state = game('bystander')
    state.clueHistory.push({ ...state.clueHistory[0]!, guesses: [] })
    expect(landedCaseyGuess(state, guess)).toBeNull()
  })
})
