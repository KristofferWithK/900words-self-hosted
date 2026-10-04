import connectingDa from '../data/city1-connecting-words.da.json'
import type { WordEntry } from '../data/types'
import { ACTIVE } from '../lang/active'
import type { LanguageCode } from '../lang/types'
import { wordsForCity } from './progress'
import type { WordKind } from './wordMarks'

/**
 * A city's words are its board words plus its connecting words
 * (docs/roadmap/cafe-world.md, section 3). The board words are the hundred
 * `WordEntry` ids `wordsForCity` deals; the connecting words are the ones a
 * city teaches outside its cards, and they have no card, no `WordEntry` and
 * no place in the 900. This module gives them an identity of their own so
 * marks, photos and the train run can name them.
 *
 * ONE source: `src/data/city1-connecting-words.da.json` (card CW-14, 47 words
 * since #353 added skål, om and hen, with their recordings). It is read here
 * and copied nowhere.
 */

/** The least a word needs to be marked: a stable id and which rule collects it. */
export interface CityWord {
  readonly id: string
  readonly kind: WordKind
  /** The word as the learner sees it. */
  readonly text: string
}

export interface ConnectingWord extends CityWord {
  readonly kind: 'connecting'
  readonly course: LanguageCode
  readonly cityIndex: number
  /** The pool "same kind of word" wrong answers come from. */
  readonly pool: string
  readonly pos: string
  /** The English on the tag, and every English meaning it may be matched by. */
  readonly en: { readonly shown: string; readonly keys: readonly string[] }
  /** The German meaning for players whose app language is German. */
  readonly de: { readonly shown: string; readonly keys: readonly string[] }
  /** Key under public/audio/<course>/, e.g. `connecting/hej`, and what it says. */
  readonly audio: { readonly key: string; readonly spoken: string }
}

/**
 * Connecting-word ids live in their own namespace, `connecting:<course>:<text>`,
 * the same id the audio manifest row carries. Board words are `<course>:<text>`,
 * so the two can never collide in the photo ledger or the srs map even where
 * the texts agree.
 */
export const connectingWordId = (course: LanguageCode, text: string): string => `connecting:${course}:${text}`

export const isConnectingWordId = (id: string): boolean => id.startsWith('connecting:')

interface ConnectingWordList {
  readonly language: string
  readonly city: number
  readonly words: readonly {
    readonly da: string
    readonly kind: string
    readonly pos: string
    readonly en: { readonly shown: string; readonly keys: readonly string[] }
    readonly de: { readonly shown: string; readonly keys: readonly string[] }
    readonly audio: { readonly key: string; readonly spoken: string }
  }[]
}

const LISTS: readonly ConnectingWordList[] = [connectingDa]

const connectingCache = new Map<string, readonly ConnectingWord[]>()

/**
 * The connecting words of one city on one course. Empty where no list has
 * been written: today that is every city but Sønderborg, and every course but
 * Danish. Never pads, never guesses.
 */
export function connectingWordsForCity(cityIndex: number, course: LanguageCode = ACTIVE.code): readonly ConnectingWord[] {
  const cacheKey = `${course}:${cityIndex}`
  const cached = connectingCache.get(cacheKey)
  if (cached) return cached
  const list = LISTS.find((l) => l.language === course && l.city === cityIndex)
  const words: ConnectingWord[] = (list?.words ?? []).map((w) => ({
    id: connectingWordId(course, w.da),
    kind: 'connecting',
    text: w.da,
    course,
    cityIndex,
    pool: w.kind,
    pos: w.pos,
    en: w.en,
    de: w.de,
    audio: w.audio,
  }))
  connectingCache.set(cacheKey, words)
  return words
}

export const boardWord = (w: WordEntry): CityWord => ({ id: w.id, kind: 'board', text: w.da })

/**
 * Every word of a city, board words first in journey order, then connecting
 * words in list order. Sønderborg: 100 + 47 = 147, the length of the train run.
 */
export function cityWords(all: readonly WordEntry[], cityIndex: number, course: LanguageCode = ACTIVE.code): readonly CityWord[] {
  return [...wordsForCity(all, cityIndex).map(boardWord), ...connectingWordsForCity(cityIndex, course)]
}
