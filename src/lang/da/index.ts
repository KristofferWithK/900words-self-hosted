import type { WordEntry } from '../../data/types'
import city1Roster from '../../data/city1-replacement-corpus.da.json'
import raw from '../../data/words.da.json'
import type { LanguagePack } from '../types'
import { danishCopy } from './copy'
import { danishCurriculum } from './curriculum'
import { danishGrammarCourse } from './curriculum-grammar'
import { danishGrammar } from './grammar'
import { danishMorphology } from './morphology'
import { danishOrthography } from './orthography'
import { danishPrompts } from './prompts'
import { danishRoute } from './route'

/**
 * Danish: the only pack that ships, and the one every rule in the engine was
 * measured against.
 *
 * It is deliberately assembled the same way a second pack would be — nothing
 * here is a shortcut the seam allows only because Danish came first. If adding
 * German turns out to need a change outside `src/lang/`, that is the seam
 * leaking rather than German being unusual.
 */
export const danish: LanguagePack = {
  code: 'da',
  name: 'Danish',
  endonym: 'Dansk',
  words: raw as WordEntry[],
  // The only playable pack: nine hundred cards, an authored City 1 bank and
  // reviewed content behind every one of them.
  readiness: 'playable',
  speech: {
    tag: 'da-DK',
    // Ordinary pace. It was 0.88 while there was no way to ask for slow at
    // all — measured on the device voice, where the default ran «hvad hedder
    // du» together into one word — and the sheet's 🐢 is what that was really
    // hedging for.
    rate: 1,
    // The rate the slow clips are baked at, so the device voice and the baked
    // one answer 🐢 with the same pace.
    slowRate: 0.6,
  },
  orthography: danishOrthography,
  morphology: danishMorphology,
  grammar: danishGrammar,
  route: danishRoute,
  // City 1 is the hundred words the authored boards, the LCSI index and
  // Casey's authored clues were built on — see `LanguagePack.rosters`. The
  // file is the same one `city1BoardCycle.test.ts` pins the bank to, so the
  // boards and the suitcase cannot drift apart again.
  rosters: { 0: city1Roster.wordIds },
  curriculum: danishCurriculum,
  grammarCourse: danishGrammarCourse,
  prompts: danishPrompts,
  copy: danishCopy,
}
