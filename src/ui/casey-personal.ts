import { spokenArticle } from '../data/gender'
import type { WordEntry } from '../data/types'
import { UI } from '../i18n'
import type { FoundGroup } from '../stores/associationStore'
import type { GamesTally } from '../stores/srsStore'
import type { SrsMap } from '../srs/types'

/**
 * Casey's lines about the player's OWN play (owner, 2026-09-26: "fun facts
 * about the favourite clues players like to give, what their weakest words
 * are and their translations"). They join the Home rotation as the
 * `personal` kind (cluey-tips.ts, HOME_LINE_SHARE) and are built fresh from
 * what the phone already holds each time Home mounts:
 *
 * - the SRS stats — the word that trips the player up most, with its meaning,
 *   and the one they know best;
 * - the association ledger — two words the player's clues keep finding
 *   together;
 * - the games tally;
 * - and one thing no store held before: which clue words the player reaches
 *   for (`src/stores/clueTally.ts`).
 *
 * Each line needs real evidence before it is said — a word is only "trickiest"
 * after it has been missed twice — so a new player simply has no personal
 * lines yet and the rotation is what it always was.
 */

export interface PersonalEvidence {
  /** The SRS map; ids carry their language, so other languages' words fall out via `wordById`. */
  stats: SrsMap
  games: GamesTally
  groups: Record<string, FoundGroup>
  clues: Record<string, number>
  wordById: (id: string) => WordEntry | undefined
}

/** Thresholds: below these a line would be a coincidence, not a fact about the player. */
export const PERSONAL_MIN = {
  misses: 2,
  greens: 3,
  groupFinds: 2,
  clueUses: 2,
  games: 5,
} as const

// The article a tap would say («et hus»), never a gender tag like «(neut)»:
// this is prose, not a card.
const said = (w: WordEntry) => (spokenArticle(w) ? `${spokenArticle(w)} ${w.da}` : w.da)
const meaning = (w: WordEntry) => w.en[0] ?? ''

/** Everything Casey can say about this player today; empty for a new one. */
export function personalLines(e: PersonalEvidence): string[] {
  const out: string[] = []
  const known = Object.entries(e.stats)
    .map(([id, s]) => ({ w: e.wordById(id), s }))
    .filter((x): x is { w: WordEntry; s: SrsMap[string] } => x.w !== undefined)

  // The weakest words: most misses, then the lowest box. Two of them, so a
  // player working on a handful hears about more than one.
  const weak = known
    .filter((x) => x.s.misses >= PERSONAL_MIN.misses)
    .sort((a, b) => b.s.misses - a.s.misses || a.s.box - b.s.box || a.w.da.localeCompare(b.w.da))
    .slice(0, 2)
  for (const { w, s } of weak) out.push(UI.casey.personalTrickyWord(said(w), meaning(w), s.misses))

  const strong = known
    .map((x) => ({ ...x, greens: x.s.greenByClue + x.s.greenByGuess }))
    .filter((x) => x.greens >= PERSONAL_MIN.greens && !weak.some((k) => k.w.id === x.w.id))
    .sort((a, b) => b.greens - a.greens || a.w.da.localeCompare(b.w.da))[0]
  if (strong) out.push(UI.casey.personalBestWord(said(strong.w), meaning(strong.w), strong.greens))

  // A pair the player's own clues keep finding together.
  const pair = Object.values(e.groups)
    .filter((g) => g.by === 'player' && g.count >= PERSONAL_MIN.groupFinds && g.ids.length >= 2)
    .map((g) => ({ g, words: g.ids.map(e.wordById) }))
    .filter((x) => x.words[0] && x.words[1])
    .sort((a, b) => b.g.count - a.g.count || b.g.lastAt - a.g.lastAt)[0]
  if (pair) out.push(UI.casey.personalCluedTogether(pair.words[0]!.da, pair.words[1]!.da, pair.g.count))

  const favourite = Object.entries(e.clues)
    .filter(([, n]) => n >= PERSONAL_MIN.clueUses)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  if (favourite) out.push(UI.casey.personalFavouriteClue(favourite[0], favourite[1]))

  if (e.games.played >= PERSONAL_MIN.games) out.push(UI.casey.personalGames(e.games.played, e.games.won))

  return out
}
