import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../../engine/types'
import { useGame, wrappableIds } from '../../stores/gameStore'
import { useSrs } from '../../stores/srsStore'
import { playWord } from '../speak'
import { ACTIVE } from '../../lang/active'
import { HINT_KEYS, useFirstTimeHint } from '../hints'
import { UI } from '../../i18n'

/**
 * The wrap-up packing phase: every card starts English-side up, and typing a
 * card's Danish flips it. The dictionary is locked — this is the recall the
 * round exists to demand — and retries are free, but the first miss on a word
 * is recorded. When every card is packed the clues start by themselves; the
 * player can also start early, at a price the button spells out.
 */
export function PackingDock({ game }: { game: GameState }) {
  const packed = useGame((s) => s.packed)
  const wrappable = useGame((s) => s.wrappable)
  const packingTranslated = useGame((s) => s.packingTranslated)
  const selectedWordId = useGame((s) => s.selectedWordId)
  const translationPostcards = useSrs((s) => s.translationPostcards)
  const [text, setText] = useState('')
  const [missed, setMissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = selectedWordId ? game.words.find((w) => w.wordId === selectedWordId) : null
  // Every count in this dock is over the WRAPPABLE cards, not the board (W1).
  // A topped-up board holds cards with nothing to pack, and «3 of 18» on a
  // board where only nine can ever be packed is a progress bar that cannot
  // fill — the dock would be counting toward a number the round cannot reach.
  const packable = wrappableIds(game, wrappable)
  const remaining = packable.length - packed.length
  const selectedCanUsePostcard = !!selected && packable.includes(selected.wordId) && !packed.includes(selected.wordId)
  const selectedAlreadyTranslated = !!selected && packingTranslated.includes(selected.wordId)
  // The first wrap-up starts with the only act that is unfamiliar: recall.
  // One concise line covers both legitimate exits, so the fixed dock stays
  // fixed and starting early is taught as freedom rather than a failure.
  const firstWrapPacking = useFirstTimeHint(HINT_KEYS.wrapPacking)

  // A fresh card gets a fresh field — and focus, so packing flows tap, type,
  // enter, tap.
  useEffect(() => {
    setText(selected && selectedAlreadyTranslated ? selected.da : '')
    setMissed(false)
    if (selectedWordId) inputRef.current?.focus()
  }, [selectedWordId, selected, selectedAlreadyTranslated])

  const submit = () => {
    if (!selected || !text.trim()) return
    const hit = useGame.getState().submitPacking(selected.wordId, text)
    if (hit) {
      // The one moment in the app where the player produced the Danish from
      // memory. Hearing it back confirms the spelling was a word and not just
      // a match — and it only ever fires on a hit: saying the answer after a
      // miss would hand over the thing this phase exists to withhold.
      void playWord(selected.wordId)
      useGame.getState().selectWord(null)
    } else {
      setMissed(true)
      setText('')
      inputRef.current?.focus()
    }
  }

  const usePostcard = () => {
    if (!selected || !selectedCanUsePostcard) return
    if (useGame.getState().usePostcard(selected.wordId)) {
      setText(selected.da)
      setMissed(false)
      inputRef.current?.focus()
    }
  }
  const postcardTitleState = selectedAlreadyTranslated
    ? 'shown'
    : !selected
      ? 'select'
      : translationPostcards <= 0
        ? 'empty'
        : 'ready'

  return (
    // Three rows and one height, the same --dock-h every other dock in a round
    // holds (K2). It used to be five, two of which came and went with the
    // selection — the word being packed had a prompt row of its own, the miss
    // note appeared under the field, and "Start with N unpacked" was a ghost
    // button whose sentence wrapped to two lines at 360px. The clue phases of
    // the same wrap-up round were sized against that, so the board moved
    // between packing and cluing.
    //
    // What replaced them: the word goes INTO the title, the field row is
    // rendered in both states (disabled with nothing selected, so the row
    // cannot appear and move the rest), the note is one line that always
    // stands. The two links became real pills in build 90 (owner: "here I want
    // the start with 12 and use postcard to look like the pack button"): "Start
    // with N" rides the actions row as a third pill, "Use postcard N" shares the
    // note row with it, and all three are the same 48px primary pill (the
    // packing-early / packing-postcard rules in index.css). The long sentences
    // each used to carry survive as title/aria only, and the no-wrap contract
    // of the one-line note is kept by the note's own rules.
    <div className="dock packing-dock">
      <div className="dock-head">
        <p className="dock-title">
          {selected ? UI.home.packWord(selected.en[0]!) : UI.home.packTheBoard}{' '}
          {UI.home.packCount(packed.length, packable.length)}
        </p>
      </div>
      <div className="clue-row">
        <input
          ref={inputRef}
          className="packing-input"
          type="text"
          value={text}
          disabled={!selected}
          placeholder={selected ? ACTIVE.copy.answerPlaceholder : UI.home.tapEnglishCard}
          aria-label={
            selected
              ? UI.home.theWordFor(ACTIVE.name, selected.en[0]!)
              : UI.home.tapEnglishCardFirst
          }
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {remaining > 0 && (
          // A primary pill beside Pack, not a .btn of its own at full padding:
          // the sentence it used to carry ("they stay English and cannot be
          // wrapped this round") wrapped to two lines in a ghost button, and
          // both lines came off the board. The warning survives as the
          // accessible name and the tooltip.
          <button
            className="btn btn-primary packing-early"
            title={UI.home.startEarlyWarning(remaining)}
            aria-label={UI.home.startEarlyWarning(remaining)}
            onClick={() => useGame.getState().startRoundEarly()}
          >
            {UI.home.startEarly(remaining)}
          </button>
        )}
        <button
          className="btn btn-primary packing-pack"
          onClick={submit}
          disabled={!selected || !text.trim()}
        >
          {UI.home.pack}
        </button>
      </div>
      <div className="packing-help">
        <p className={`packing-note ${missed ? 'packing-miss' : 'dim'}`} role="status">
          {missed
            ? UI.home.packMiss
            : selectedAlreadyTranslated
              ? UI.home.packingAnswerShown
              : !selected
                ? UI.home.packTapAndType(ACTIVE.name)
                : translationPostcards === 0
                  ? UI.home.packingNoPostcards
                  : firstWrapPacking
                    ? UI.home.packingFirstPostcardHint(ACTIVE.name)
                    : UI.home.postcardHelp}
        </p>
        <button
          className="btn btn-primary packing-postcard"
          disabled={!selectedCanUsePostcard || (!selectedAlreadyTranslated && translationPostcards <= 0)}
          title={UI.home.packingPostcardTitle(postcardTitleState, ACTIVE.name)}
          aria-label={UI.home.packingPostcardAria(selectedAlreadyTranslated, translationPostcards)}
          onClick={usePostcard}
        >
          {selectedAlreadyTranslated ? UI.home.packingPostcardShowAnswer : UI.home.usePostcard}{' '}
          <span className="packing-postcard-balance">{translationPostcards}</span>
        </button>
      </div>
    </div>
  )
}
