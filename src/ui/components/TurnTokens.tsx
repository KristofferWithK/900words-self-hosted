import { UI } from '../../i18n'

/**
 * One coffee cup, side on, with its saucer: a 12 x 9 box, the same height as
 * a dot. The body fills when the cup is full (77-cafe-puzzle.css), so a full
 * and an empty cup are one drawing.
 */
function CoffeeCup() {
  return (
    <svg className="token-cup-svg" viewBox="0 0 12 9" aria-hidden="true" focusable="false">
      <path className="token-cup-body" d="M1.6 1.4h6.8v2.7c0 2-1.5 3.3-3.4 3.3S1.6 6.1 1.6 4.1z" />
      <path className="token-cup-handle" d="M8.4 2.4h.9c1 0 1.6.6 1.6 1.4s-.6 1.4-1.6 1.4h-1" />
      <path className="token-cup-saucer" d="M.6 8.4h8.8" />
    </svg>
  )
}

/**
 * The shared clue pool, as pips — and the count in words.
 *
 * `given` is clues SUBMITTED, which is one behind the clue being composed
 * during a clue-input phase. It is labelled "given" rather than shown as an
 * ordinal ("Clue 4 of 5") for exactly that reason: a player would read the
 * ordinal as the clue they are about to give and be off by one.
 *
 * The label is on this element, not on the pips, so a screen reader is handed
 * the same number the screen shows. It used to say only how many were LEFT,
 * which is the complement — recoverable, but only by arithmetic nobody should
 * have to do. It also used to say whether the last chance was open; there is
 * no last chance to be open, so the sentence is just the count now.
 */
export function TurnTokens({
  total,
  left,
  given,
  cups = false,
}: {
  total: number
  left: number
  given: number
  /**
   * Coffee cups in place of the dots, inside a café puzzle (docs/roadmap/
   * cafe-world.md section 5; card CW-08). Same count, same row height: a full
   * cup is a clue still to give, an empty one a clue given.
   */
  cups?: boolean
}) {
  return (
    <div className="turn-tokens" aria-label={UI.game.turnTokensAria(given, total, left)}>
      {/* Drawn from `given`, not from `left`, so the pips and the sentence
          beneath them can never disagree.

          They used to come from turnsLeft, which the engine decrements when a
          turn ENDS rather than when a clue is given — so between submitting a
          clue and the guessing finishing, the screen read "1/6 clues given"
          above six untouched pips. Both numbers were true and the pair was
          not, and it reads as a clue that failed to register. */}
      <span className={`token-row${cups ? ' token-row-cups' : ''}`} aria-hidden="true">
        {Array.from({ length: total }, (_, i) =>
          cups ? (
            <span key={i} className={`token token-cup ${i < total - given ? 'token-full' : 'token-spent'}`}>
              <CoffeeCup />
            </span>
          ) : (
            <span key={i} className={`token ${i < total - given ? 'token-full' : 'token-spent'}`} />
          ),
        )}
      </span>
      <span className="token-count" aria-hidden="true">
        {UI.game.cluesGivenCount(given, total)}
      </span>
    </div>
  )
}
