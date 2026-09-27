import { useState } from 'react'
import { useGame } from '../../stores/gameStore'
import { MAX_CLUE_NUMBER } from '../../engine/config'
import { targetableGreenIds } from '../../engine/game'
import { checkClueLegality, type LegalityVerdict } from '../../engine/legality'
import type { GameState } from '../../engine/types'
import { useDictionary } from './TranslateBox'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { HINT_KEYS, useFirstTimeHint } from '../hints'
import { primeRewardDing, primeTurnClick } from '../feedback'
import { primeWordAudio } from '../speak'

interface Props {
  game: GameState
  onSubmit: (text: string, number: number) => void
  firstTimeHint?: boolean
  /** This clue turn is part of a wrap-up round. */
  firstWrapTeaching?: boolean
  /** The first practice clue gives the Danish-only rule in the existing hint row. */
  tutorialTeaching?: boolean
  /** The small practice board asks for associations of two or three words. */
  tutorial?: boolean
}

export function clueNumberBounds(tutorial: boolean, remainingPracticeGreens = 2): readonly [number, number] {
  return tutorial
    ? remainingPracticeGreens === 1 ? [1, 1] : [2, 3]
    : [1, MAX_CLUE_NUMBER]
}

/** Start on the ordinary two-word clue without breaking the one-green tutorial end. */
export function defaultClueNumber(minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, 2))
}

/** The composer judges a clue against the remaining Danish board, offline. */
export function clueComposerVerdict(
  text: string,
  game: Pick<GameState, 'words' | 'reveals'>,
): LegalityVerdict | null {
  const clue = text.trim()
  if (!clue) return null
  const visibleWords = game.words.filter((word) => game.reveals[word.wordId]?.kind !== 'green')
  return checkClueLegality(clue, visibleWords, ACTIVE)
}

/**
 * The composer, and it is exactly three rows tall in every state it can be in
 * (K1). The owner's rule: "I don't want the size of the composer to change
 * ever. Below clue and dictionary should be enough space for one small line of
 * text where the translation or legality warning can be."
 *
 *   [ Your clue          ] [ Dictionary        ]      the field row
 *   clue hint / legality             dictionary answer    ONE shared line
 *   [−] 2 [+]                        [ Give clue ]    the action row
 *
 * Nothing here may render a fourth row. Everything that used to appear and
 * vanish — the first-clue hint and the illegality verdict,
 * the dictionary's four-row scroller, its "Ask Casey" button and its error
 * paragraph — is now one of the two halves of the middle line, and the line is
 * always there whether or not it has anything in it. The height that follows
 * is measured and written down as --dock-h in index.css, and layout-drive
 * samples the panel's rectangle per frame across every state below.
 */
/**
 * The engine's refusal, as a sentence in the player's language.
 *
 * `checkClueLegality` returns both: `reason`, the English the engine has
 * always produced for its own tests and logs, and `why`, the same refusal as
 * data. This reads the data, so a German player is told why their clue was
 * refused in German. An older shape with no `why` falls back to the English
 * rather than showing nothing.
 */
function refusal(verdict: LegalityVerdict): string {
  const why = verdict.why
  if (!why) return verdict.reason ?? ''
  switch (why.kind) {
    case 'not-single-word':
      return UI.game.clueNotSingleWord
    case 'on-board':
      return UI.game.clueOnBoard(why.clue)
    case 'typo-of':
      return UI.game.clueTypoOf(why.clue, why.candidate)
    case 'compound-of':
      return UI.game.clueCompoundOfWord(why.clue, why.candidate)
    case 'form-of':
      return UI.game.clueFormOfWord(why.clue, why.candidate)
    // 'empty' never reaches the screen: the dock only asks once there is text.
    default:
      return verdict.reason ?? ''
  }
}

export function ClueInput({
  game,
  onSubmit,
  firstTimeHint = true,
  firstWrapTeaching = false,
  tutorialTeaching = false,
  tutorial = false,
}: Props) {
  const [minimum, maximum] = clueNumberBounds(
    tutorial,
    tutorial ? targetableGreenIds(game, 'player').length : 0,
  )
  const [text, setText] = useState('')
  const [number, setNumber] = useState(() => defaultClueNumber(minimum, maximum))
  // The first clue ever asked of this device gets one extra sentence (O4).
  // Gone the moment typing starts, so it never stands beside a verdict.
  const firstClueEver = useFirstTimeHint(HINT_KEYS.clue, firstTimeHint)
  // This component only mounts when the player's clue turn actually begins,
  // unlike GameScreen which stays mounted throughout the round. That makes the
  // first-wrap key lesson resilient to a packing-phase reload.
  const firstWrapPlayerKey = useFirstTimeHint(HINT_KEYS.wrapPlayerKey, firstWrapTeaching)
  const teachingLine = tutorialTeaching
    ? UI.onboarding.courseText(ACTIVE.code).tutorialHint
    : firstWrapPlayerKey
    ? UI.game.wrapPlayerKeyHint
    : undefined
  // The re-deal ("a reroll button at the beginning, if I have no idea how to
  // connect the words") now lives in the game header as a symbol — see
  // GameScreen. It kept the same conditions and lost a line of this dock,
  // which is a line of board while the keyboard is up.

  const trimmed = text.trim()
  const verdict = clueComposerVerdict(text, game)
  const canSubmit = trimmed.length > 0 && verdict?.legal === true

  // The dictionary, taken apart: its field belongs in the row above, its one
  // answer in the line below. The box that used to hold both would have been a
  // column of its own inside the field row.
  const dictionaryCity = useGame(s => s.boardCityIndex)
  const dictionary = useDictionary(undefined, { kind: 'board', cityIndex: dictionaryCity })

  const submit = () => {
    onSubmit(trimmed, number)
    setText('')
  }

  // The left half of the shared line. At most one of these is ever true, and
  // the first-clue hint shares the `!trimmed` moment with the verdicts, so a
  // hint and a verdict can never stack.
  let verdictLine = null
  // A hint says where the missing word lives; once the Dictionary has answered,
  // the answer is what the player came for, so the hint steps aside rather than
  // squeezing the answer to a word's first letters on a narrow screen.
  if ((teachingLine || firstClueEver) && !trimmed && !dictionary.line) {
    // The first-encounter line (O4). The highest-friction act in the game
    // arrives here with zero Danish, so the first composer says what is being
    // asked for and where the missing word lives. Once ever — the
    // cluecab-hint-clue flag.
    // One line now rather than two: onboarding-drive reads it for "One Danish
    // word" and for "Dictionary", and both survive the cut.
      verdictLine = (
      <span className="first-hint dim">{teachingLine ?? UI.game.firstClueHint(UI.onboarding.courseText(ACTIVE.code).languageName)}</span>
    )
  } else if (verdict && !verdict.legal) {
    // role=alert so a rejected clue is spoken; id so the field points at it.
    // The refusals are one clause each, so they fit; anything longer is
    // ellipsized on screen and kept whole in the title.
    const line = refusal(verdict)
    verdictLine = (
      <span className="clue-error" id="clue-error" role="alert" title={line}>
        {line}
      </span>
    )
  }

  return (
    <div className="dock clue-input">
      {/* A "Last turn — you clued «x»: …" recap stood here. It was a line the
          composer paid for on every turn but the first, and it was one of the
          two things that made the board a different size in every phase — the
          board is a flex:1 area sharing this column, so a recap appearing took
          36px straight off the grid. The turn log in the round summary says
          the same thing afterwards, at leisure, and the player has just
          watched the turn happen. */}
      {/* The two things you need while composing, side by side: the clue, and
          the word you do not have yet. They fit on one line because a clue is
          one short word.

          No labels above them. The placeholder says what each field is, in
          English — Danish is what you TYPE, not what the app says to you — and
          a label line costs a row of board to repeat a word already on screen.
          The re-deal moved to the header for the same reason. */}
      <div className="composer-fields">
        <input
          id="clue-word"
          type="text"
          value={text}
          placeholder={UI.game.cluePlaceholder}
          aria-label={UI.game.clueFieldAria(ACTIVE.name)}
          aria-invalid={trimmed ? !canSubmit : undefined}
          aria-describedby={verdict && !verdict.legal ? 'clue-error' : undefined}
          autoCapitalize="off"
          autoComplete="off"
          // The one field in the app that asks for DANISH and the only one that
          // was leaving the phone keyboard's English autocorrect on — every
          // other free-text field (the dictionary, the packing dock, Settings,
          // Backup) sets both of these. On an English keyboard a Danish word is
          // rewritten at the space or submit boundary, and what arrives is an
          // English dictionary word the player never typed.
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
        />
        {/* Clueing in Danish means needing a word you do not have yet — which
            is the moment to look one up, not after abandoning the turn. */}
        {dictionary.field}
      </div>
      {/* THE line. Always rendered, empty or not: it is the whole reason the
          composer has one height, and a line that only exists when it has
          something to say is a line that moves the board when it arrives.
          Verdict on the left, the dictionary's answer on the right; either one
          alone takes the full width, and when both are up the answer is the
          half that gives way (see .composer-line in index.css). */}
      <div className="composer-line">
        {verdictLine}
        {dictionary.line}
      </div>
      {/* How many words the clue points at, and the send: one line, the way a
          messenger composer puts its send button next to what it sends. */}
      <div className="composer-actions">
        <div className="stepper">
          <button
            aria-label={UI.game.fewerWordsAria}
            disabled={number <= minimum}
            onClick={() => setNumber((n) => Math.max(minimum, n - 1))}
          >
            −
          </button>
          <span className="stepper-value" aria-live="polite" aria-label={UI.game.wordCountAria(number)}>
            {number}
          </span>
          {/* Shared with the engine: the config guard checks a board is
              clearable using this same ceiling, so the two must not drift. */}
          <button
            aria-label={UI.game.moreWordsAria}
            disabled={number >= maximum}
            onClick={() => setNumber((n) => Math.min(maximum, n + 1))}
          >
            +
          </button>
        </div>
        <button
          className="btn btn-primary"
          disabled={!canSubmit}
          onClick={() => {
            // Synchronous, before `submit()`'s async body — the last real
            // gesture before Casey's first guess, which arrives from a
            // `setInterval` in AiTurnPanel with no gesture of its own behind
            // it. See `primeWordAudio` in speak.ts (S1) for why that guess
            // needs the element unlocked ahead of time rather than at the tap
            // that plays it.
            primeWordAudio()
            primeRewardDing()
            // The same unlock covers the turn-click: the takeover it plays on
            // fires from a phase effect later, with no gesture behind it.
            primeTurnClick()
            void submit()
          }}
        >
          {/* "Give clue anyway" wrapped to a second line beside the stepper at
              360px, and a wrapped button is 18px of the dock's reserve — which
              is 18px off the board, in every phase, for a state most turns
              never reach. */}
          {UI.game.giveClue}
        </button>
      </div>
    </div>
  )
}
