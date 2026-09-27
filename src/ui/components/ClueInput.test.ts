import { describe, expect, it } from 'vitest'
import { clueNumberBounds, clueComposerVerdict, defaultClueNumber } from './ClueInput'

describe('clue number bounds', () => {
  it('keeps ordinary clue counts at one through four', () => {
    expect(clueNumberBounds(false)).toEqual([1, 4])
  })

  it('limits the practice clue to the taught two-or-three-word association', () => {
    expect(clueNumberBounds(true)).toEqual([2, 3])
  })

  it('allows one only when it is the final practice green', () => {
    expect(clueNumberBounds(true, 1)).toEqual([1, 1])
  })

  it('starts ordinary and taught practice clues at two words', () => {
    expect(defaultClueNumber(...clueNumberBounds(false))).toBe(2)
    expect(defaultClueNumber(...clueNumberBounds(true))).toBe(2)
  })

  it('keeps the final one-green practice clue at one', () => {
    expect(defaultClueNumber(...clueNumberBounds(true, 1))).toBe(1)
  })
})

describe('offline clue composer legality', () => {
  it('lets restaurant and restauraunt be sent without certifying their language', () => {
    const word = { wordId: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' as const }
    const game = {
      words: [word],
      reveals: { [word.wordId]: { kind: 'bystander' as const, against: ['ai' as const] } },
    }

    for (const clue of ['time', 'restaurant', 'restauraunt']) {
      expect(clueComposerVerdict(clue, game)?.legal, clue).toBe(true)
    }
  })

  it('keeps visible Danish words restrictive but lets found greens leave the rule surface', () => {
    const words = [
      { wordId: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' as const },
      { wordId: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun' as const },
      { wordId: 'da:hus', da: 'hus', en: ['house'], pos: 'noun' as const },
    ]
    const game = {
      words,
      reveals: {
        'da:tid': { kind: 'bystander' as const, against: ['ai' as const] },
        'da:hund': { kind: 'green' as const },
        'da:hus': { kind: 'bystander' as const, against: ['player' as const] },
      },
    }

    expect(clueComposerVerdict('time', game)?.legal).toBe(true)
    expect(clueComposerVerdict('hund', game)?.legal).toBe(true)
    expect(clueComposerVerdict('huset', game)?.legal).toBe(false)
  })
})
