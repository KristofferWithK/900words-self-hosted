import { describe, expect, it } from 'vitest'
import { checkClueLegality as clientCheckClueLegality } from '../../src/engine/legality.ts'
import { german } from '../../src/lang/de/index.ts'
import { DANISH_LANGUAGE } from './language.js'
import { GERMAN_LANGUAGE } from './language.de.js'
import { languageFor, languageForView } from './languages.js'

describe('Casey course-language registry', () => {
  it('keeps Danish as the default and resolves German independently', () => {
    expect(languageFor()).toMatchObject(DANISH_LANGUAGE)
    expect(languageFor('da')).toMatchObject(DANISH_LANGUAGE)
    expect(languageFor('de')).toBe(GERMAN_LANGUAGE)
    expect(languageFor('fr')).toBeNull()
  })

  it('routes by course word IDs and matches client legality across German clue cases', () => {
    const board = [
      { id: 'de:zimmer', da: 'Zimmer', en: ['room'], pos: 'noun' },
      { id: 'de:haus', da: 'Haus', en: ['house'], pos: 'noun' },
      { id: 'de:buch', da: 'Buch', en: ['book'], pos: 'noun' },
      { id: 'de:wohnung', da: 'Wohnung', en: ['apartment'], pos: 'noun' },
      { id: 'de:ei', da: 'Ei', en: ['egg'], pos: 'noun' },
      { id: 'de:kaufen', da: 'kaufen', en: ['buy'], pos: 'verb' },
      { id: 'de:katze', da: 'Katze', en: ['cat'], pos: 'noun' },
    ]
    expect(languageForView({ words: board })).toBe(GERMAN_LANGUAGE)
    expect(languageForView({ words: [{ ...board[0], id: 'da:hus', da: 'hus' }] })).toMatchObject(DANISH_LANGUAGE)

    const decision = ({ legal, why, conflictWord }) => ({ legal, why, conflictWord })
    const cases = [
      { clue: 'Zimmer', expectedLegal: false },
      { clue: 'room', expectedLegal: true },
      { clue: 'Wohnung', expectedLegal: false },
      { clue: 'Zimmers', expectedLegal: false },
      { clue: 'Bücher', expectedLegal: false },
      { clue: 'Häuser', expectedLegal: false },
      { clue: 'Eier', expectedLegal: false },
      { clue: 'gekauft', expectedLegal: false },
      { clue: 'Kater', expectedLegal: true },
      { clue: 'Blume', expectedLegal: true },
    ]
    for (const { clue, expectedLegal } of cases) {
      const worker = GERMAN_LANGUAGE.checkClueLegality(clue, board)
      const client = clientCheckClueLegality(clue, board, german)
      expect(worker.legal, clue).toBe(expectedLegal)
      expect(decision(worker), clue).toEqual(decision(client))
    }
  })

  it('retains German umlaut-plural and compound protections', () => {
    expect(GERMAN_LANGUAGE.checkClueLegality('Häuser', [
      { id: 'de:haus', da: 'Haus', en: ['house'], pos: 'noun' },
    ])).toMatchObject({
      legal: false,
      why: { kind: 'form-of', clue: 'Häuser', candidate: 'Haus' },
      conflictWord: 'Haus',
    })
    expect(GERMAN_LANGUAGE.checkClueLegality('Schlafzimmer', [
      { id: 'de:zimmer', da: 'Zimmer', en: ['room'], pos: 'noun' },
    ])).toMatchObject({
      legal: false,
      why: { kind: 'compound-of', clue: 'Schlafzimmer', candidate: 'Zimmer' },
      conflictWord: 'Zimmer',
    })
  })

  it('matches German compound legality without rejecting non-compounds', () => {
    const board = [
      { id: 'de:zimmer', da: 'Zimmer', en: ['room'], pos: 'noun' },
    ]
    const cases = [
      { clue: 'Schlafzimmer', expectedLegal: false },
      { clue: 'Schlaf', expectedLegal: true },
      { clue: 'Kater', expectedLegal: true },
      { clue: 'Blume', expectedLegal: true },
    ]

    for (const { clue, expectedLegal } of cases) {
      const worker = GERMAN_LANGUAGE.checkClueLegality(clue, board)
      const client = clientCheckClueLegality(clue, board, german)
      expect(worker.legal, `Worker: ${clue}`).toBe(expectedLegal)
      expect(client.legal, `client: ${clue}`).toBe(expectedLegal)
      expect({ legal: worker.legal, why: worker.why, conflictWord: worker.conflictWord }, `parity: ${clue}`)
        .toEqual({ legal: client.legal, why: client.why, conflictWord: client.conflictWord })
    }
  })
})
