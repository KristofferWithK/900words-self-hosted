import type { WordEntry } from '../../data/types'
import type { Catalogue } from '../../i18n'
import { connectingWordsForCity, type ConnectingWord } from '../../journey/cityWords'
import { MARKS_TO_COLLECT, wordMarks, type PhotoLedger, type WordMarks } from '../../journey/wordMarks'
import type { SrsMap } from '../../srs/types'

/**
 * What the suitcase shows of one word (docs/roadmap/cafe-world.md section 6,
 * card CW-11): its marks, read with the three-mark model of CW-02
 * (journey/wordMarks.ts), and where it sits.
 *
 * - `lid`: collected, three marks. The lid's "Collected: n of N".
 * - `loose`: met but not collected: any mark, an srs record (a board word met
 *   on a board), or an old wrap-up. Shown with the marks it has.
 * - `unknown`: nothing at all yet. Shown as "?".
 *
 * OLD WRAPPED WORDS (CW-02 note; "Decisions for the orchestrator" in the
 * CW-11 PR): the three-mark model has no wrapped state. A wrapped word goes
 * where its marks put it: in the lid when they collect it, otherwise above
 * the case with the marks it has. Wrapping counts as having met the word, so
 * an old wrapped word is never shown as "?". Nothing here writes or awards.
 */
export type SuitcasePlace = 'lid' | 'loose' | 'unknown'

export interface SuitcaseWord {
  readonly id: string
  /** The word as the learner sees it. */
  readonly text: string
  /** The course word, for a board word: its word sheet opens on tap. */
  readonly entry: WordEntry | null
  /** The connecting word, for a word with no card. */
  readonly connecting: ConnectingWord | null
  readonly marks: WordMarks
  readonly place: SuitcasePlace
}

/** Board words then connecting words, city by city, as `cityWords` orders them. */
export function suitcaseWords(
  boardWords: readonly WordEntry[],
  connecting: readonly ConnectingWord[],
  srs: SrsMap,
  photos: PhotoLedger,
  wrapped: Readonly<Record<string, number>>,
): SuitcaseWord[] {
  const board = boardWords.map((entry): SuitcaseWord => {
    const marks = wordMarks({ id: entry.id, kind: 'board' }, srs[entry.id], photos)
    const met = marks.earned > 0 || entry.id in srs || entry.id in wrapped
    return { id: entry.id, text: entry.da, entry, connecting: null, marks, place: marks.collected ? 'lid' : met ? 'loose' : 'unknown' }
  })
  const linking = connecting.map((word): SuitcaseWord => {
    const marks = wordMarks(word, srs[word.id], photos)
    return { id: word.id, text: word.text, entry: null, connecting: word, marks, place: marks.collected ? 'lid' : marks.earned > 0 ? 'loose' : 'unknown' }
  })
  return [...board, ...linking]
}

/** The connecting words of every city from 0 to `through`, for the "All" view. */
export function connectingWordsThrough(through: number): ConnectingWord[] {
  return Array.from({ length: Math.max(0, through + 1) }, (_, i) => connectingWordsForCity(i)).flat()
}

export interface SuitcaseBands {
  /** Above the case: met words first, then the "?" places. */
  readonly loose: readonly SuitcaseWord[]
  /** In the lid: collected words. */
  readonly lid: readonly SuitcaseWord[]
  /** Every word of the view: the N of "Collected: n of N". */
  readonly total: number
}

export function suitcaseBands(words: readonly SuitcaseWord[]): SuitcaseBands {
  return {
    loose: [...words.filter((w) => w.place === 'loose'), ...words.filter((w) => w.place === 'unknown')],
    lid: words.filter((w) => w.place === 'lid'),
    total: words.length,
  }
}

const listFormats = new Map<string, Intl.ListFormat>()

/** "photo, guess, clue" in the language's own list style: narrow, so English and Chinese need no "and". */
function listOf(items: readonly string[], locale: string): string {
  let format = listFormats.get(locale)
  if (!format) {
    try {
      format = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' })
    } catch {
      format = new Intl.ListFormat('en', { style: 'narrow', type: 'conjunction' })
    }
    listFormats.set(locale, format)
  }
  return format.format(items)
}

/** The marks a word has, in words: "photo, guess" or "photos on 2 days". Empty with none. */
export function markWords(marks: WordMarks, copy: Catalogue['home'], locale: string): string {
  if (marks.kind === 'connecting') return marks.earned > 0 ? copy.markPhotoDays(marks.earned) : ''
  const names = [marks.photo && copy.markPhoto, marks.guess && copy.markGuess, marks.clue && copy.markClue].filter(
    (name): name is string => typeof name === 'string',
  )
  return listOf(names, locale)
}

/** A word tile's accessible name: "hus, 2 of 3: photo, guess". `locale` is the UI language's tag. */
export function markAria(word: Pick<SuitcaseWord, 'text' | 'marks'>, copy: Catalogue['home'], locale: string): string {
  return copy.markAria(word.text, word.marks.earned, MARKS_TO_COLLECT, markWords(word.marks, copy, locale))
}
