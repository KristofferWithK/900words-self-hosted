import type { GridConfig } from './config'

/**
 * Two roles, not three. A key used to carry `forbidden` as well — Duet's
 * assassin — and a guess landing on one ended the round (or opened the
 * translate-everything last chance, late enough in the round). Both are gone:
 * a card is either a target on this key or it is not.
 */
export type CardRole = 'green' | 'bystander'
export type Side = 'player' | 'ai'

/** The subset of dictionary data the engine needs about a board word. */
export interface BoardWord {
  wordId: string
  da: string
  en: string[]
  pos: string
  /**
   * The gender article, nouns only. Carried on the board because gender is
   * learned as a collocation — "et hus", not "hus (neuter)" — so the card has
   * to show the pair. Optional: verbs and adjectives have none, and a game
   * persisted before this existed simply renders without it.
   *
   * A plain string, like `WordEntry.article`, because the set of articles is
   * the language's: der/die/das are three where en/et are two.
   */
  article?: string
  /**
   * Carried alongside the article because a few nouns have no article at all
   * (plurale tantum: penge, bukser, briller) and the card still has to say what
   * gender they are. Keyed into the active pack's gender table; see
   * src/data/gender.ts for what gets printed.
   */
  gender?: string
  /** False for a mass noun: the card shows the gender, not an article. */
  countable?: boolean
}

export type Reveal =
  | { kind: 'hidden' }
  | { kind: 'green' } // global: found, done for both sides
  /**
   * Directional, Duet-style: `against` lists the CLUE-GIVER sides under which
   * this word was revealed as a bystander. It stays guessable under the other
   * side's clues (it may even be green there).
   */
  | { kind: 'bystander'; against: Side[] }

export interface GuessRecord {
  wordId: string
  result: CardRole
  /**
   * Why the AI named this word, and how sure it was — stored but hidden until
   * the round is over, like a clue's rationale.
   *
   * The model has always produced both and the engine always threw them away,
   * so the one thing a player could never find out was why Casey named the word
   * he named. That is the question they kept asking, and it is the question a
   * companion in a LEARNING game exists to answer: the association he saw is
   * worth as much as the word.
   *
   * Absent on the player's own guesses — nobody is asked to justify a tap.
   */
  reasoning?: string
  confidence?: number
}

export interface Clue {
  by: Side
  text: string
  number: number
  /** AI's intended wordIds — stored but hidden until the round is over. */
  targets?: string[]
  /** AI's reasoning — stored but hidden until the round is over. */
  rationale?: string
  guesses: GuessRecord[]
}

export type Phase =
  | 'playerClueInput' // player composes a clue; AI will guess
  | 'aiGuessing'
  | 'aiClueInput' // waiting for the AI's clue; player will guess
  | 'playerGuessing'
  /**
   * Clues are gone but the board is not finished. Codenames Duet's ending:
   * no more clues, keep naming words, one wrong name and it is over.
   *
   * Reached when tokens run out with zero found targets. Stop or a neutral
   * guess accepts a loss; finding the entire target union opens translation.
   */
  | 'suddenDeath'
  /**
   * Opens on solving or exhaustion with found targets, including practice.
   * Every found target shows its UI-language gloss on its suitcase and the player
   * types the Danish from memory — free retries, dictionary locked. Fills the
   * wheel as it goes; the spin itself is the next phase.
   */
  | 'translateChallenge'
  /**
   * The wheel stands ready to spin. Since the ending change (owner,
   * 2026-09-18) the spin IS the round's end: green finishes the round as a
   * win through the normal outcome path, empty as a loss. The old
   * post-win chooser phase never shows a live wheel any more — see
   * SPIN_WHEEL in engine/game.ts for what remains of it.
   */
  | 'translateWheel'
  | 'finished'

/**
 * Three endings, down from six. Gone with the forbidden words: 'forbidden-hit'
 * (the round ending on the spot), 'forbidden-failed' (the last chance opening
 * and being failed) and 'redeemed' (it being passed). Old saves may still hold
 * those strings — nothing reads a stored outcome back into this type, and the
 * game store's v4 migration throws away any in-flight round rather than trying.
 *
 * 'wheel-miss': the spin landed on a segment whose suitcase was never
 * translated. The owner's call (2026-09-16): a miss ends the round on the spot.
 *
 * 'wheel-spent-exhausted': the token was WON and spent, and the tokens ran out
 * again (build 90, owner: the old mode "should be gone" — the wheel was the
 * last chance). Sudden death keeps only the zero-suitcase edge case.
 */
export type Outcome =
  // all-greens is historical compatibility only; new solves open translation.
  | { result: 'won'; reason: 'all-greens' | 'wheel-win' }
  | { result: 'lost'; reason: 'timeout' | 'sudden-death' | 'wheel-miss' | 'wheel-spent-exhausted' }

/**
 * The wheel endings' state, carried on the game so a round put down mid-challenge
 * resumes exactly where it stood. `segments` is the wheel's fixed order — the
 * solved word ids at the moment the challenge opened — and every other field
 * reads against it. Since the ending change (owner, 2026-09-18) the spin
 * decides the ROUND, so `spent` keeps only its historical shape: new rounds
 * never set it (the chooser is gone) and a v15 migration rewinds a won spin
 * from before the change so it re-resolves through the new path.
 */
export interface WheelState {
  /**
   * Wheel order: every key word on the board, in board order, found or not
   * (owner, 2026-09-27). A save from before then holds only the words found
   * when the challenge opened; `wheelMissedSegments` derives none for it.
   */
  segments: string[]
  /** Word ids translated so far, in the order they were answered. */
  translated: string[]
  /**
   * Segment indices filled so far, in the order they were filled. The owner's
   * amendment (2026-09-16): a correct translation fills a RANDOM empty segment,
   * not the next one in board order — the fill is the engine's draw, not the
   * player's position on the board. The spin's verdict reads THIS list, not
   * `translated`: a landed segment wins because it was filled, whatever word
   * the answer that filled it was for. Old saves carry no `filled`; the store's
   * v14 migration rebuilds it from `translated`'s board order.
   */
  filled: number[]
  /** Wrong submissions so far. Free retries — this counts, it never punishes. */
  attempts: number
  /** Index into `segments` the spin landed on, once it has spun. */
  landed: number | null
  /**
   * The spin's verdict, set with `landed`. Historic shape only since the
   * ending change: the chooser that read it is gone from play.
   */
  result: 'win' | 'miss' | null
  /**
   * Which side the OLD post-win chooser sent the earned clue to. Never set by
   * new code — the spin now decides the round outright (owner, 2026-09-18) —
   * and read only by the v15 migration, which clears it alongside the won
   * verdict it belonged to.
   */
  spent: Side | null
}

export interface GameState {
  config: GridConfig
  seed: number
  words: BoardWord[]
  reveals: Record<string, Reveal>
  playerKey: Record<string, CardRole>
  aiKey: Record<string, CardRole>
  phase: Phase
  turnsLeft: number
  clueHistory: Clue[]
  outcome?: Outcome
  /** Retained through finished: accepted spin and translation evidence survives reload. */
  wheel?: WheelState
}

export type GameEvent =
  | {
      type: 'SUBMIT_CLUE'
      by: Side
      text: string
      number: number
      targets?: string[]
      rationale?: string
    }
  /** `reasoning`/`confidence` carry the AI's own account of the guess. */
  | { type: 'GUESS'; wordId: string; reasoning?: string; confidence?: number }
  | { type: 'STOP_GUESSING' }
  /**
   * Opened by endTurn when the last token is spent with at least one solved
   * word on the board; the store may also open it for a round resuming there.
   * No player-visible event — the phase arrives.
   */
  | { type: 'START_TRANSLATE_CHALLENGE' }
  /**
   * One answer in the challenge. Validated case-insensitively against the
   * target's `da` (the app passes the active language pack; the grader is the
   * packing grader, so articles and inflections are forgiven). A miss is free:
   * it moves the attempt counter and nothing else.
   */
  | { type: 'SUBMIT_TRANSLATION'; wordId: string; answer: string }
  /** Every suitcase translated — the wheel stands filled, ready to spin. */
  | { type: 'COMPLETE_CHALLENGE' }
  /**
   * Spin the wheel. The landing segment is drawn engine-side from the seed, so
   * the result is a fact of the round and not of the renderer. THE SPIN DECIDES
   * THE ROUND (owner, 2026-09-18): a green landing finishes the round as a win
   * through the normal outcome path (reason 'wheel-win', so the summary's
   * reward logic runs unchanged); an empty landing finishes it as lost.
   */
  | { type: 'SPIN_WHEEL' }
  /**
   * Historic: the OLD wheel's won-token chooser event. The spin now decides
   * the round outright (owner, 2026-09-18), so no live round reaches it; the
   * event type stays so a replayed or reloaded pre-change save cannot produce
   * a hole in the reducer's switch. The engine refuses it outright.
   */
  | { type: 'SPEND_WHEEL_TOKEN'; to: Side }
