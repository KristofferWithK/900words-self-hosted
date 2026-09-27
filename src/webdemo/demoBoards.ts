/**
 * The two boards the website's playable intro can ever show: the Danish
 * practice board and the first City 1 board a fresh player is dealt.
 *
 * Derived from the app's own sources, never retyped, so the website demo and
 * the app cannot drift apart. `proxy/data/web-demo-boards.da.json` is a pinned
 * copy of `webDemoBoards()` (demoBoards.test.ts fails when they differ). Two
 * readers depend on it:
 *   - the website Casey Worker's board lock, which refuses any view whose
 *     words are not exactly one of these boards;
 *   - scripts/web-demo-assets.mjs, which ships only these words' audio.
 */
import words from '../data/words.da.json'
import { CITY1_BOARD_CYCLES } from '../data/city1BoardCycle'
import { tutorialScriptFor } from '../onboarding/tutorial'
import { audioSlug } from '../ui/speak'
import { danishOrthography } from '../lang/da/orthography'

export interface WebDemoBoard {
  /** Absent for the practice board, which carries no boardId on the wire. */
  boardId: string | null
  wordIds: string[]
  /** The Danish headword per id, in the same order: the lock checks both. */
  forms: string[]
  /** Audio file slugs per id, in the same order. */
  slugs: string[]
  /**
   * The English glosses and part of speech per id, exactly as the app sends
   * them. The website Casey rebuilds every view from these, so no text the
   * caller writes into a word ever reaches a prompt.
   */
  en: string[][]
  pos: string[]
}

export interface WebDemoBoards {
  schemaVersion: 1
  course: 'da'
  practice: WebDemoBoard
  firstBoard: WebDemoBoard
}

interface Entry { id: string; da: string; en: string[]; pos: string }
const byId = new Map((words as Entry[]).map((word) => [word.id, word]))

function board(boardId: string | null, wordIds: readonly string[]): WebDemoBoard {
  const entries = wordIds.map((id) => {
    const entry = byId.get(id)
    if (!entry) throw new Error(`web demo board word ${id} is not in the Danish dataset`)
    return entry
  })
  const forms = entries.map((entry) => entry.da)
  return {
    boardId,
    wordIds: [...wordIds],
    forms,
    slugs: forms.map((form) => audioSlug(form, danishOrthography.fold)),
    en: entries.map((entry) => [...entry.en]),
    pos: entries.map((entry) => entry.pos),
  }
}

export function webDemoBoards(): WebDemoBoards {
  const first = CITY1_BOARD_CYCLES.da[0]
  if (!first) throw new Error('the Danish City 1 board cycle is empty')
  return {
    schemaVersion: 1,
    course: 'da',
    practice: board(null, tutorialScriptFor('da').wordIds),
    firstBoard: board(first.id, first.wordIds),
  }
}
