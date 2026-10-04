import { useRef, useState } from 'react'
import { wheelFoundIds } from '../../engine/game'
import type { GameState } from '../../engine/types'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { useGame } from '../../stores/gameStore'
import { WheelSpinner } from './WheelSpinner'
import { Tag } from './Tag'

/**
 * The Translation Wheel's docks (owner, 2026-09-17) — FREE-TYPE GRADING.
 *
 * The board is the prompt: each solved suitcase on it carries its UI-language
 * word on the lid (BoardGrid's lid label), and nothing selects on tap. The
 * composer below is one line (the wheel lede), then the field the player
 * types the Danish translation into and the confirm tick. On submit the
 * answer is graded against EVERY untranslated wheel word with the engine's
 * own grader (matchesAnswer — the same one packing uses; never a fork).
 * Exactly one match = that suitcase packs: click sound + haptic + a random
 * segment fills + the field clears (gameStore.submitWheelTranslation drives
 * it for the resolved word). No match, or more than one = a miss: blip + the
 * retry line, and the text STAYS so a typo is correctable — the field clears
 * only on a hit. Correct = the suitcase packs (its card turns green, the
 * glyph gains the small check). Wrong = a gentle shake and a free retry. No
 * dock prompt sequence — no title, no per-word prompt, no hint line.
 *
 * AMBIGUITY RULE (documented per the task): if the answer matches more than
 * one untranslated word, the store refuses to guess and treats it as a miss.
 * The tiebreak order is (1) prefer an already-translated match — the word
 * that still needs packing is the untranslated one, so a translated match
 * with exactly one untranslated co-match packs THAT; (2) otherwise miss.
 * The census (src/engine/lane-f-ambig.test.ts) measured the shipped corpus:
 * no answer matches two Danish words of the 900 under the real grader, so
 * the branch is unreachable today and exists to keep the rule explicit for
 * the day the vocabulary widens.
 *
 * The wheel stands in the dock the whole time and is ALWAYS spinnable: filled
 * segments are win zones, empty ones loss zones (engine SPIN_WHEEL judges).
 * The wheel has one slice per key word on the board (owner, 2026-09-27); a
 * word the round never found keeps a grey slice nothing can fill. The spin
 * decides the round, and the board then shows every suitcase's Danish until
 * the player taps "See results".
 */

/** The verdict, keyed by the engine's result: said once the disc rests. */
const RESULT_LABEL = {
  win: UI.game.wheelWonLine,
  miss: UI.game.wheelMissLine,
} as const

/**
 * The free-type dock. One line, one field, one tick — and the wheel beside
 * them, spinnable at any moment. The wheel is IN the flex flow (a 104px
 * column aligned centre-right, owner build 87: it used to hang absolutely
 * over the field row and squeezed/overlapped it at phone width) — the same
 * dock rectangle, the same three-row rhythm the reference composer keeps:
 * lede, then one row block holding the field + note stacked beside the wheel.
 */
export function TranslateChallengeBar({ game }: { game: GameState }) {
  const wheel = game.wheel!
  const submit = useGame((s) => s.submitWheelTranslation)
  const spinning = useGame((s) => s.wheelSpinHold)
  const closeReview = useGame((s) => s.closeWheelReview)
  const [text, setText] = useState('')
  const [missed, setMissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The submit grades the typed text against every untranslated wheel word
  // (the store resolves it to a wordId with the engine's grader); this view
  // only needs the remaining glosses and course language for its accessible
  // name. No Danish answers are included in the control label.
  // Only the FOUND words can be typed; the wheel holds every key word, and
  // the ones the round missed keep grey slices (owner, 2026-09-27).
  const found = wheelFoundIds(game)
  const remainingWords = found
    .filter((id) => !wheel.translated.includes(id))
    .map((id) => game.words.find((word) => word.wordId === id)!)
  const courseLanguage = UI.onboarding.courseText(ACTIVE.code).languageName
  const missedCount = wheel.segments.length - found.length
  // After the tap the field gives way to the verdict and "See results": the
  // board now shows every suitcase's Danish, and the player reads it for as
  // long as they like before the finish screen (owner, 2026-09-27).
  const result = wheel.result
  const rested = result !== null && !spinning

  const submitAnswer = () => {
    if (!text.trim()) return
    const hit = submit(text)
    setMissed(!hit)
    // Clear on a hit only (owner: "the text field gets cleared" when it
    // matches — a miss keeps the text so the typo is correctable).
    if (hit) setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="dock guess-bar translate-challenge-bar">
      {/* The owner's copy, exactly ONE line on top. The wheel progress is the
          wheel itself — no title, no prompt line. When the clues ran out
          before every key word was found, the line says how many were, so
          the grey slices and the dashed words read as one fact. */}
      {result === null ? (
        <p className="dim wheel-lede">
          {missedCount > 0
            ? UI.game.wheelLedeMissed(found.length, wheel.segments.length, courseLanguage)
            : UI.game.wheelLede(courseLanguage)}
        </p>
      ) : (
        <p className={`wheel-verdict${rested && result === 'win' ? ' wheel-verdict-win' : ''}`} role="status">
          {rested ? RESULT_LABEL[result] : UI.game.wheelSpinning}
        </p>
      )}
      <div className="wheel-actions">
        {result !== null ? (
          <div className="wheel-answer-row wheel-review-row">
            <p className="packing-note dim wheel-answers-line">
              {remainingWords.length > 0 ? UI.game.wheelAnswersLine : ' '}
            </p>
            {/* Standing (but hidden) while the disc turns, so the dock never
                changes height when it rests. */}
            <Tag tone="primary" className="wheel-results" label={UI.game.wheelSeeResults} onClick={closeReview} disabled={!rested} />
          </div>
        ) : (
        <div className="wheel-answer-row">
          <div className="clue-row">
            <input
              ref={inputRef}
              className={`packing-input wheel-input${missed ? ' wheel-miss-shake' : ''}`}
              type="text"
              value={text}
              placeholder={UI.game.wheelAnswerPlaceholder(courseLanguage)}
              aria-label={UI.game.wheelAnswerAria(courseLanguage, remainingWords.map((word) => word.en[0]))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
            />
            {/* The confirm tick (the mockup's green check button): submits
                what was typed. Enabled whenever the field is non-empty — no
                selection is needed any more (owner, 2026-09-17). Nothing else
                in the row — the board is the prompt. */}
            {/* The tap must not take focus from the field. On Android the
                button would take it, nativeKeyboard would read that as the
                keyboard going away and put the board back to the top, so a
                player working on the bottom row was thrown up after every
                tick. Cancelling mousedown keeps focus; click still fires. */}
            <button
              className="wheel-confirm"
              aria-label={UI.game.wheelSubmit}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submitAnswer}
              disabled={!text.trim()}
            >
              ✓
            </button>
          </div>
          {/* One line, always standing, so the dock's height never moves —
              the same rule PackingDock's note row follows. The retry line is
              the free-retry promise said once, on the miss that earned it. */}
          <p className={`packing-note ${missed ? 'packing-miss' : 'dim'}`} role="status">
            {missed ? UI.game.wheelRetryLine : '\u00a0'}
          </p>
        </div>
        )}
        {/* The wheel lives IN the row block beside the field, always
            spinnable — filled segments are the win zones, empty ones the loss
            zones. In the flex flow, so it can never paint over the field. */}
        <div className="wheel-side">
          <WheelSpinner game={game} />
        </div>
      </div>
    </div>
  )
}

/**
 * The chooser after a won spin is GONE (owner, 2026-09-18): the spin decides
 * the round outright, so there is no token to spend and no door to pick. The
 * ending's dock is TranslateChallengeBar itself; its verdict line and the
 * finish screen carry the result.
 */
