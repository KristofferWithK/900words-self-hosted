export interface GridConfig {
  rows: number
  cols: number
  totalWords: number
  /** Greens on each side's key. */
  greensPerSide: number
  /** Greens shared by both keys. */
  greenOverlap: number
  /** Total clues allowed across both sides (shared pool). */
  turnTokens: number
  /** SRS: cap on never-seen words per board. */
  maxNewWordsPerBoard: number
}

/**
 * THE BOARD. Three across, six down, and there is only one shape.
 *
 * There were three — beginner 3x4, middle 3x5, standard 4x5 — picked from a
 * select in Settings and stored as `gridSize`. The owner's call on 2026-08-21
 * is that a difficulty ladder is not what this game is: "we no longer have
 * beginner, we have one standardized board". So the union, the picker, the
 * persisted setting and the `?grid=` dev switch are all gone, and what is left
 * is this constant. The wrap-up enters a distinct mode but deals this same
 * board. The onboarding practice round is deliberately smaller: it teaches
 * the mechanic before this full board becomes the player’s first real round.
 *
 * ---- why 3x6, and why it could not have been 3x6 last week -----------------
 *
 * Because a sixth row now fits, and it did not before. Measured on the built
 * app at 360x640, the tight case, in the opening clue phase:
 *
 *                    board height   row     card min-height   a 6th row
 *   before K1/K2          239.30   41.46              44.00       33.22
 *   after  K1/K2          318.56   57.31              57.31       46.43
 *
 * 33.22px is under the 44px floor a card cannot go below, so a sixth row
 * before the composer work would have overflowed the phone — invisibly, since
 * a flex column overflows by painting over what is under it while
 * `scrollHeight` stays honest. K1 gave the dock its measured height and K2
 * collapsed every dock into it and deleted the key legend; between them the
 * board got 79.26px back, and the sixth row measures 46.43 — clear of the
 * floor by 2.43, and the six rows of a 3x6 are TALLER than the five rows of
 * the 3x5 it replaces. The bigger board is the roomier one, but only in that
 * order. `.word-card`'s `@container` threshold is set against that 46.43; see
 * index.css, which says which side of it this board sits on and why.
 *
 * ---- what it plays like ----------------------------------------------------
 *
 * `selfplay.test.ts` walks one dial — the chance a guess finds a word the
 * clue-giver actually meant — from a guesser that knows nothing up to perfect
 * play, and reports what each board does at each step. The whole table is
 * reproducible with
 *
 *   SELFPLAY_GAMES=2000 SELFPLAY_REPORT=1 npx vitest run src/ai/selfplay.test.ts
 *
 * and this is what it said for fixed overlap values, 2000 seeded games a cell,
 * both sides cluing up to three at a time. These are retained baselines, not a
 * measured claim for the shipped 1–3 mix:
 *
 *   board                  greens dead tok  g/tok   p=0.6   p=0.7   p=0.8  SD%@.7  clues@1
 *   3x6  8/3/8  fixed baseline 13    5   8   1.63    74.7    90.0    98.2    24.6     5.00
 *   4x5 10/4/10 (retired,N2)  16    4  10   1.60    84.8    95.2    99.2    12.7     6.00
 *   3x5  7/3/6  (replaced)    11    4   6   1.83    67.1    85.4    94.7    38.8     4.18
 *   3x6  8/2/8  fixed member  14    4   8   1.75    69.8    87.8    97.2    30.4     5.56
 *   3x6  8/4/8  (rejected)    12    6   8   1.50    79.8    93.4    98.8    17.9     4.52
 *   3x6  8/3/7  (rejected)    13    5   7   1.86    59.7    79.8    94.4    45.6     5.00
 *   3x6  8/3/9  (rejected)    13    5   9   1.44    84.9    95.9    99.6    11.8     5.00
 *
 * `g/tok` is the number worth watching when tuning: distinct greens divided by
 * turnTokens, i.e. how much each clue has to carry. Codenames Duet, the game
 * this is scaled from, sits at 15/9 = 1.67.
 *
 * Ordinary and wrap-up deals choose one, two, or three shared greens evenly
 * from their seed. Each side still has eight greens and both sides still share
 * eight tokens. The exact arithmetic is therefore 15/8, 14/8, or 13/8 distinct
 * greens per token (mean 14/8 = 1.75), with three, four, or five dead cards.
 * No mixed-policy win rate is claimed here.
 *
 * The old fixed-three baseline was thirteen distinct greens over eight shared
 * tokens, and against the 3x5 it replaced it was kinder in the two ways a
 * learner feels: **74.7% at p=0.6 against 67.1%**, and sudden death on **24.6%
 * of rounds at p=0.7 against 38.8%**. Losing the round to the clock, on the
 * board that is meant to be the ordinary one, roughly halves. A perfect pair
 * spends 5.00 of the eight tokens, so three are spare — room for two wrong
 * guesses and a wasted clue, where the 3x5 left 1.8.
 *
 * On that same fixed-three baseline, the floor did not move. A guesser that
 * knows literally nothing — both sides cluing nonsense, every guess a hash —
 * wins 0.1% of the time, spends all
 * 8.00 tokens, and reaches the last chance in 100.0% of rounds with 8.54 of the
 * thirteen greens still hidden. That is the distance a real player's word
 * associations have to cover, and it is why the floor is a floor rather than an
 * argument that this board is hard.
 *
 * It is also a bigger board in the sense the journey cares about: thirteen to
 * fifteen distinct greens a round against the 3x5's eleven. Green events feed
 * collection — a word is collected only once it has gone green each way
 * (`wordState` in journey/progress.ts).
 *
 * Tokens are a shared pool, not two each: a side whose greens are all found has
 * nothing left to clue, so the other side spends what remains. Eight of them is
 * four clue-givings each.
 *
 * ---- the neighbours, measured rather than argued ---------------------------
 *
 * Four boards were played against this one and are in the table above.
 *
 *   8/2/8 — now one member of the shipped mix. Its historical fixed row had
 *     fourteen greens, four dead cards, and played HARDER (69.8% at p=0.6),
 *     which is the counter-intuitive result this
 *     game keeps producing: a card on nobody's key is a card nobody ever has to
 *     point at, so padding makes a board easier, not slower. It also stretches
 *     a perfect round from 5.00 clues to 5.56.
 *   8/4/8 — twelve greens, six dead. The other direction, and it works
 *     (79.8%), but six of eighteen cards doing nothing is a third of the board
 *     the player reads and never needs, and the win rate is drifting toward the
 *     wrap-up board's.
 *   8/3/7 — one token fewer. 59.7% at p=0.6 and sudden death on 45.6% of
 *     rounds at p=0.7: harsher than the 3x5 this replaces, on a bigger board.
 *     A perfect round still spends 5.00, so seven tokens is two spare, which is
 *     not enough slack for a board with thirteen greens on it.
 *   8/3/9 — one token more. 84.9%, and the last chance all but disappears
 *     (11.8%). That used to be the wrap-up board's own economy; see below for
 *     why it is not any more.
 *
 * Eight is the token count where the round still has a losing side without the
 * clock being the thing you play against.
 *
 * ---- and the wrap-up round deals this board too (N2) ------------------------
 *
 * There is now one board shape in the whole game: `newWrapUpGame` resolves the
 * same seeded 8/1–3/8 policy as an ordinary deal rather than using the retired
 * `4x5 10/4/10` row in the table, which is kept only for the comparison. "wrap
 * up boards should
 * have the same amount of greens like normal rounds… what makes the wrap up
 * rounds special is the initial translation and no looking up words on the
 * board with the dictionary" (owner, 2026-08-21) — the packing gate and the
 * closed dictionary were always meant to carry the round's difficulty, and the
 * softer 4x5 was a second cushion under a round that did not need one.
 *
 * A wrap-up now packs 13–15 words a round, at most **15**, instead of 16. The
 * old fixed-three comparison put the 4x5 at 84.8% and the 3x6 at 74.7% at
 * p=0.6; those figures remain historical baselines, not a claim for the mix.
 * The packing gate — every card English-side
 * up, dictionary shut, first miss remembered — is untouched and still the
 * round's real difficulty. `finishRound` (gameStore.ts) wraps every card that
 * was packed AND ended green regardless of the round's outcome, so losing a
 * harder wrap-up costs nothing it did not already risk: the haul you packed is
 * banked win or lose. Losing more OFTEN is the actual cost of this card, and it
 * is the owner's call to take it.
 *
 * `maxNewWordsPerBoard` is not part of this sharing: it stays 0 for a wrap-up
 * deal, but that was never a board property to begin with — `newWrapUpGame`
 * deals from `wrapUpWords` (journey/wrapup.ts), which never goes through the
 * sampler `dealBoard` reads `maxNewWordsPerBoard` from, and draws only from
 * words already collected (`wrapUpPool`'s `isCollected` filter). Zero new
 * words was always a fact about that deal, not a number carried on a config
 * object, and it survives BOARD's 6 without either object needing to change.
 *
 * ---- and what is NOT here any more -----------------------------------------
 *
 * Duet's third card role — the assassin, which this game called a forbidden
 * word — is gone, along with the translate-every-word ending that used to
 * soften it. Every key holds greens and nothing else; a card that is not green
 * on a key is a bystander there. Rounds end by finding every green (win), by
 * the tokens running out into the last chance, or by walking away. Three to
 * five of these eighteen cards are on nobody's key. The fixed-three
 * member has the same proportion the 3x5 carried (4 of 15).
 *
 * These are floors and brackets, not forecasts: a hash-based guesser is not a
 * person, and the p dial stands in for reading a clue, which is the part of
 * this game a number cannot really hold.
 */
export const BOARD: GridConfig = {
  // Portrait: phones want more rows than columns, and three across is what
  // keeps `.card-da` at a full 16px — it is sized in cqw off the card, so a
  // four-wide board shrinks the word rather than the layout.
  rows: 6,
  cols: 3,
  totalWords: 18,
  greensPerSide: 8,
  greenOverlap: 3, // fixed baseline; shipped rounds resolve 1–3 before dealing
  turnTokens: 8,
  // One in three, the ratio every board has carried. The sampler's cap on
  // never-seen words; see srs/sampler.ts.
  maxNewWordsPerBoard: 6,
}

/**
 * The genuinely smaller guided practice deal. It is not a selectable
 * difficulty: normal and wrap-up play still have one 3×6 board.
 *
 * Seven distinct greens fit into the nine cards (one shared, three per side).
 * Seven shared clues make the teaching round deliberately generous: its token
 * load is one green per clue, and the authored three-turn route leaves five
 * tokens showing when the final green lands. This is rehearsal, not the place
 * where the ordinary round's clock should bite.
 */
export const TUTORIAL_CONFIG: GridConfig = {
  rows: 3,
  cols: 3,
  totalWords: 9,
  greensPerSide: 4,
  greenOverlap: 1,
  turnTokens: 7,
  maxNewWordsPerBoard: 3,
}

/**
 * There used to be a WRAPUP_CONFIG here: 4x5, ten greens a side, ten shared
 * tokens — a config of its own so the packing phase's added difficulty could
 * sit under a forgiving clue economy. N2 (2026-08-22) deletes it as a distinct
 * shape: `newWrapUpGame` now deals `BOARD` itself, on the owner's call that a
 * wrap-up round should have the same number of greens as a normal one and
 * lean on the packing gate and the closed dictionary for its difficulty,
 * rather than on a second board tuned soft underneath them. See BOARD's own
 * comment, "the wrap-up round deals this board too", for the numbers that
 * decision costs and what it does not touch.
 */

/** The largest number the clue stepper offers; a clue of N allows N guesses. */
export const MAX_CLUE_NUMBER = 4

/**
 * Internal Casey assistance ships on. Set VITE_CASEY_TOP_TWO_ASSIST=0 (also
 * accepts "false" or "off") at build time to restore the legacy first-choice
 * and one-response-per-clue behaviour. This is deliberately not a player
 * setting or persisted state.
 */
export const CASEY_TOP_TWO_ASSIST_DEFAULT = true

export function caseyTopTwoAssistanceEnabled(
  value: string | undefined = import.meta.env.VITE_CASEY_TOP_TWO_ASSIST,
): boolean {
  if (value === undefined || value.trim() === '') return CASEY_TOP_TWO_ASSIST_DEFAULT
  return !['0', 'false', 'off'].includes(value.trim().toLowerCase())
}

/**
 * Normal and wrap-up rounds vary the key overlap evenly between one and three.
 * BOARD remains the fixed 8/3/8 baseline for experiments and the authored
 * tutorial. A fresh production round resolves this policy from its game seed
 * and stores the returned concrete config in GameState.
 */
export const SHIPPED_GREEN_OVERLAPS = [1, 2, 3] as const

export function shippedGreenOverlap(seed: number): (typeof SHIPPED_GREEN_OVERLAPS)[number] {
  let x = (Math.trunc(seed) ^ 0x6d2b79f5) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x = (x ^ (x >>> 16)) >>> 0
  return SHIPPED_GREEN_OVERLAPS[x % SHIPPED_GREEN_OVERLAPS.length]!
}

export function shippedBoardConfig(seed: number): GridConfig {
  return { ...BOARD, greenOverlap: shippedGreenOverlap(seed) }
}

/** Greens that must be found to win — shared ones count once. */
export function distinctGreens(c: GridConfig): number {
  return c.greenOverlap + 2 * (c.greensPerSide - c.greenOverlap)
}

export function assertConfigConsistent(c: GridConfig): void {
  if (c.rows * c.cols !== c.totalWords) {
    throw new Error(`grid ${c.rows}x${c.cols} != totalWords ${c.totalWords}`)
  }
  const perSideOnlyGreens = c.greensPerSide - c.greenOverlap
  if (perSideOnlyGreens < 0) {
    throw new Error('greensPerSide too small for greenOverlap')
  }
  const used = c.greenOverlap + 2 * perSideOnlyGreens
  if (used > c.totalWords) {
    throw new Error(`key slots (${used}) exceed board size (${c.totalWords})`)
  }
  // Cutting tokens shortens the game, and past a point it stops being a game
  // at all: a clue of N ends the turn on the Nth correct guess, so no clue can
  // ever take more than MAX_CLUE_NUMBER words and below this many tokens the
  // board cannot be cleared by a perfect player on a perfect day. A loose bound
  // on purpose — it catches an impossible config, not a hard one, which is a
  // judgement no assertion should be making.
  const needed = Math.ceil(distinctGreens(c) / MAX_CLUE_NUMBER)
  if (c.turnTokens < needed) {
    throw new Error(
      `${c.turnTokens} tokens cannot clear ${distinctGreens(c)} greens: ` +
        `${MAX_CLUE_NUMBER} guesses per clue means at least ${needed}`,
    )
  }
  // There was a third guard here, against a board with no clue left after the
  // last chance opened — it would have shipped RedemptionView, the grader and
  // the 'redeemed' ending with none of them reachable. Both the threshold and
  // the screens it protected are gone, so the guard has nothing left to guard.
}
