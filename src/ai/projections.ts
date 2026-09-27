import type { CardRole, GameState, Reveal, Side } from '../engine/types'

/**
 * THE FIREWALL. These projections are the only game data the AI layer may see.
 * - AiClueView: the AI's OWN key, never the player's.
 * - AiGuessView: no key of any kind.
 * Enforced by tests: prompts built from these views are byte-identical under
 * permutations of the player's key (and of both keys, for the guess view).
 */

export interface PublicWord {
  id: string
  da: string
  en: string[]
  pos: string
  /** Reveal state is public — both players watched it happen. */
  reveal: Reveal
}

export interface PublicClue {
  by: Side
  text: string
  number: number
  guesses: { da: string; result: CardRole }[]
}

/**
 * What the player marked as a bad call in a past round's review.
 *
 * Carries no key data of any kind — a clue word, a Danish board word, and the
 * account Casey himself gave — so it passes the firewall by construction. It
 * is here rather than in the store because prompts may only read projections.
 */
export interface FlaggedCall {
  kind: 'clue' | 'guess'
  what: string
  underClue?: string
  why?: string
}

export interface AiClueView {
  kind: 'ai-clue'
  /**
   * Always the language being learned. The setting that could switch Casey to
   * English clues is gone (owner, 2026-09-11: the dictionary is the help), and
   * the Worker stopped reading the key on 2026-09-12. The constant stays on
   * the wire until the client half of Phase 4 ships, because a deployed Worker
   * that no longer needs it still accepts it, while the Worker a player has
   * today would refuse a request shaped for tomorrow.
   */
  clueLanguage: 'target'
  turnsLeft: number
  words: (PublicWord & { roleOnMyKey: CardRole })[]
  history: PublicClue[]
  /** Past calls the player flagged. Empty when there are none. */
  flagged: FlaggedCall[]
  /**
   * The authored City 1 board this round is, when it is one (`bank_001`), so
   * Casey's server can hand him the clue groups the bank was built with for
   * HIS key. Absent on every other board. It names a board, not a key: the
   * Worker's copy of the bank carries Casey's greens and groups only, so the
   * id cannot be turned into the player's key on the far side either.
   */
  boardId?: string
}

export interface AiGuessView {
  kind: 'ai-guess'
  /** Wire compatibility only; see AiClueView. */
  clueLanguage: 'target'
  turnsLeft: number
  words: PublicWord[]
  currentClue: { text: string; number: number }
  history: PublicClue[]
  /** Past calls the player flagged. Empty when there are none. */
  flagged: FlaggedCall[]
  /**
   * The authored City 1 board this round is, when it is one. On the guess
   * side it lets Casey's server answer a clue the board was made for with
   * certainty (owner, 2026-09-06). Still no key on the view: the server
   * holds the player's key for authored boards, Worker-private, and that is
   * the one deliberate hole in the guess-side firewall — see DECISIONS.md.
   */
  boardId?: string
}

const publicWord = (state: GameState, wordId: string): PublicWord => {
  const w = state.words.find((x) => x.wordId === wordId)!
  return { id: w.wordId, da: w.da, en: w.en, pos: w.pos, reveal: state.reveals[wordId]! }
}

/**
 * History stripped of targets/rationale. They stay hidden until the round is
 * over, where the summary's turn log reads them straight off the game state —
 * there is no longer a projection carrying them to the model, because nothing
 * is asked of the model once the round ends.
 */
const publicHistory = (state: GameState): PublicClue[] =>
  state.clueHistory.map((c) => ({
    by: c.by,
    text: c.text,
    number: c.number,
    guesses: c.guesses.map((g) => ({
      da: state.words.find((w) => w.wordId === g.wordId)!.da,
      result: g.result,
    })),
  }))

export function buildAiClueView(
  state: GameState,
  flagged: readonly FlaggedCall[] = [],
  opts: { boardId?: string | null } = {},
): AiClueView {
  return {
    kind: 'ai-clue',
    clueLanguage: 'target',
    turnsLeft: state.turnsLeft,
    words: state.words.map((w) => ({
      ...publicWord(state, w.wordId),
      roleOnMyKey: state.aiKey[w.wordId]!,
    })),
    history: publicHistory(state),
    flagged: flagged.map(({ kind, what, underClue, why }) => ({ kind, what, underClue, why })),
    // Omitted rather than null: the Worker's contract rejects keys it does
    // not know, and an absent id is the ordinary case.
    ...(opts.boardId ? { boardId: opts.boardId } : {}),
  }
}

export function buildAiGuessView(
  state: GameState,
  flagged: readonly FlaggedCall[] = [],
  opts: { boardId?: string | null } = {},
): AiGuessView {
  const clue = state.clueHistory[state.clueHistory.length - 1]
  if (!clue || clue.by !== 'player') throw new Error('AI guess view requires an active player clue')
  return {
    kind: 'ai-guess',
    clueLanguage: 'target',
    turnsLeft: state.turnsLeft,
    words: state.words.map((w) => publicWord(state, w.wordId)),
    currentClue: { text: clue.text, number: clue.number },
    history: publicHistory(state),
    flagged: flagged.map(({ kind, what, underClue, why }) => ({ kind, what, underClue, why })),
    ...(opts.boardId ? { boardId: opts.boardId } : {}),
  }
}

/** Words the AI may legitimately target with its own clue (giver = 'ai'). */
export function aiTargetableIds(view: AiClueView): string[] {
  return view.words
    .filter((w) => w.roleOnMyKey === 'green' && isOpenFor(w.reveal, 'ai'))
    .map((w) => w.id)
}

/** Words the AI may guess under the player's clue (giver = 'player'). */
export function aiGuessableIds(view: AiGuessView): string[] {
  return view.words.filter((w) => isOpenFor(w.reveal, 'player')).map((w) => w.id)
}

/**
 * Could this card still be named under a clue GIVEN BY `giver`? The
 * directional heart of both id lists above, exported for the local engine's
 * trap set (`src/ai/local/evaluator.ts`), which must ask exactly this question
 * and not a lookalike: a bystander reveal burns the card only for the side
 * whose clue it was named under (`Reveal.against`), so a card the player has
 * already seen turn grey under their own clue is still live — and still a
 * trap — under Casey's. Takes only public reveal state, so exporting it moves
 * nothing across the firewall.
 */
export function isOpenFor(reveal: Reveal, giver: Side): boolean {
  if (reveal.kind === 'hidden') return true
  if (reveal.kind === 'bystander') return !reveal.against.includes(giver)
  return false
}
