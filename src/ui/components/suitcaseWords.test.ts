import { describe, expect, it } from 'vitest'
import { WORDS } from '../../data/words'
import { CATALOGUES } from '../../i18n'
import { connectingWordsForCity } from '../../journey/cityWords'
import { wordsForCity } from '../../journey/progress'
import { recordPhoto, recordPhotos, type PhotoLedger } from '../../journey/wordMarks'
import type { SrsMap, WordStats } from '../../srs/types'
import { markAria, suitcaseBands, suitcaseWords } from './suitcaseWords'

const en = CATALOGUES.en.home
const de = CATALOGUES.de.home
const UTC = 'UTC'
const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 9, 4, 12)

const stats = (greenByGuess: number, greenByClue: number): WordStats => ({
  box: 1, lastSeenAt: T0, seen: 1, correctGuesses: 0, misses: 0, lookups: 0,
  redemptionRight: 0, redemptionWrong: 0, greenByGuess, greenByClue,
})

const hus = WORDS.find((w) => w.da === 'hus')!
const city0 = wordsForCity(WORDS, 0)
const [hej] = connectingWordsForCity(0)

describe('the suitcase words (CW-11)', () => {
  it('reads a board word with the three-mark model and says its marks', () => {
    const photos = recordPhoto({}, hus.id, T0, UTC)
    const [word] = suitcaseWords([hus], [], { [hus.id]: stats(1, 0) }, photos, {})
    expect(word).toMatchObject({ id: hus.id, text: 'hus', place: 'loose', connecting: null })
    expect(word!.marks.earned).toBe(2)
    expect(markAria(word!, en, 'en')).toBe('hus, 2 of 3: photo, guess')
    expect(markAria(word!, de, 'de')).toBe('hus, 2 von 3: Foto und Rateversuch')
  })

  it('puts a word with all three marks in the lid', () => {
    const [word] = suitcaseWords([hus], [], { [hus.id]: stats(2, 1) }, recordPhoto({}, hus.id, T0, UTC), {})
    expect(word!.place).toBe('lid')
    expect(markAria(word!, en, 'en')).toBe('hus, 3 of 3: photo, guess, clue')
  })

  it('shows a word with no record at all as "?", and a word met on a board with an empty ring', () => {
    expect(suitcaseWords([hus], [], {}, {}, {})[0]!.place).toBe('unknown')
    const [met] = suitcaseWords([hus], [], { [hus.id]: stats(0, 0) }, {}, {})
    expect(met!.place).toBe('loose')
    expect(markAria(met!, en, 'en')).toBe('hus, 0 of 3')
  })

  it('keeps an old wrapped word with the marks it has: never in the lid on wrapping alone, never "?"', () => {
    const wrapped = { [hus.id]: T0 }
    const [twoGreens] = suitcaseWords([hus], [], { [hus.id]: stats(1, 1) }, {}, wrapped)
    expect(twoGreens!.place).toBe('loose')
    expect(twoGreens!.marks.earned).toBe(2)
    expect(suitcaseWords([hus], [], {}, {}, wrapped)[0]!.place).toBe('loose')
    const [collected] = suitcaseWords([hus], [], { [hus.id]: stats(1, 1) }, recordPhoto({}, hus.id, T0, UTC), wrapped)
    expect(collected!.place).toBe('lid')
  })

  it('collects a connecting word at photos on three different days, and names it as a word', () => {
    expect(suitcaseWords([], [hej!], {}, {}, {})[0]!.place).toBe('unknown')
    let photos: PhotoLedger = recordPhoto({}, hej!.id, T0, UTC)
    photos = recordPhoto(photos, hej!.id, T0 + DAY, UTC)
    const [two] = suitcaseWords([], [hej!], {}, photos, {})
    expect(two).toMatchObject({ text: 'hej', place: 'loose', entry: null })
    expect(two!.connecting?.id).toBe('connecting:da:hej')
    expect(markAria(two!, en, 'en')).toBe('hej, 2 of 3: photos on 2 days')
    expect(markAria(suitcaseWords([], [hej!], {}, recordPhoto({}, hej!.id, T0, UTC), {})[0]!, en, 'en')).toBe('hej, 1 of 3: a photo on 1 day')
    photos = recordPhoto(photos, hej!.id, T0 + 2 * DAY, UTC)
    expect(suitcaseWords([], [hej!], {}, photos, {})[0]!.place).toBe('lid')
  })

  it("counts Sønderborg's 147 words: met words first above the case, then the places still out there", () => {
    const first = city0.slice(0, 3)
    const srs: SrsMap = Object.fromEntries(first.map((w) => [w.id, stats(1, 1)]))
    const photos = recordPhotos({}, [first[0]!.id], T0, UTC)
    const bands = suitcaseBands(suitcaseWords(city0, connectingWordsForCity(0), srs, photos, {}))
    expect(bands.total).toBe(147)
    expect(bands.lid.map((w) => w.id)).toEqual([first[0]!.id])
    expect(bands.loose).toHaveLength(146)
    expect(bands.loose.slice(0, 2).map((w) => w.id)).toEqual([first[1]!.id, first[2]!.id])
    expect(bands.loose.slice(2).every((w) => w.place === 'unknown')).toBe(true)
  })
})
