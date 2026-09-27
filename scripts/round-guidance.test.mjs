import { describe, expect, it } from 'vitest'
import { actionFor } from '../e2e/round-guidance.mjs'

describe('round guidance harness actions', () => {
  it('accepts the current and legacy English player-clue titles', () => {
    expect(actionFor('Your turn!')).toBe('Write a clue')
    expect(actionFor('Your turn to give a clue')).toBe('Write a clue')
  })

  it('keeps localized actions intact', () => {
    expect(actionFor('Zeit zum Übersetzen')).toBe('Übersetzen starten')
    expect(actionFor('Tijd om te vertalen')).toBe('Begin met vertalen')
  })
})
