import type { LanguagePack } from '../types'
import type { WordEntry } from '../../data/types'
import words from '../../data/words.de.json'
import cycle from '../../data/city1-board-cycle.de.json'
import { germanCopy } from './copy'
import { germanCurriculum } from './curriculum'
import { germanGrammarCourse } from './curriculum-grammar'
import { germanGrammar } from './grammar'
import { germanMorphology } from './morphology'
import { germanOrthography } from './orthography'
import { germanPrompts } from './prompts'
import { germanRoute } from './route'

/** German course pack. Danish remains the fresh-install language. */
export const german: LanguagePack = {
  code: 'de',
  name: 'German',
  endonym: 'Deutsch',
  words: words as WordEntry[],
  readiness: 'playable',
  speech: {
    tag: 'de-DE',
    rate: 1,
    slowRate: 0.7,
  },
  orthography: germanOrthography,
  morphology: germanMorphology,
  grammar: germanGrammar,
  route: germanRoute,
  rosters: { 0: [...new Set(cycle.boards.flatMap((board) => board.wordIds))] },
  curriculum: germanCurriculum,
  grammarCourse: germanGrammarCourse(),
  prompts: germanPrompts,
  copy: germanCopy,
}
