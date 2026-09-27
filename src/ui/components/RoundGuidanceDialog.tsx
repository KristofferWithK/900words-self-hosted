import { useLayoutEffect, useRef, useState } from 'react'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'

interface Props {
  /**
   * Casey's opening, the first player clue, translation/wheel entry, retained
   * sudden death, or an archival wrap-up packing lesson.
   */
  kind: 'casey' | 'player' | 'translation' | 'last-chance' | 'packing'
  /** Only the public announcement crosses into this component. */
  clue?: { text: string; number: number }
  /**
   * The last chance arrived with the Translation Wheel still to play
   * (`translateChallenge`): the panel then says the spin sentence instead of
   * the sudden-death rule, which stays the no-wheel path's copy.
   */
  wheel?: boolean
  onDismiss: (hidePlayerReminder: boolean) => void
}

/** Translation has its own lesson. The wheel flag also supports older callers. */
const COPY = {
  casey: { title: UI.game.guidanceCaseyTitle, action: UI.game.guidanceStartGuessing },
  player: { title: UI.game.guidancePlayerTitle, action: UI.game.guidanceWriteClue },
  translation: { title: UI.game.phaseTranslateChallenge, action: UI.game.guidanceStartTranslation },
  // Capitalised on the owner's word (2026-09-11), unlike the dock's caption.
  'last-chance': { title: UI.game.guidanceLastChanceTitle, action: UI.game.guidanceKeepNaming },
  packing: { title: UI.game.guidancePackingTitle, action: UI.game.guidanceStartPacking },
} as const

export function RoundGuidanceDialog({ kind, clue, wheel = false, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [hideReminder, setHideReminder] = useState(false)
  useLayoutEffect(() => {
    const panel = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Native modality makes the rest of the document inert, including the
    // header, dictionary, board and dock. A scrim alone cannot protect keys.
    previous?.blur()
    panel.showModal()
    panel.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      panel.close()
      const target = previous?.isConnected && previous !== document.body
        ? previous
        : document.querySelector<HTMLElement>('.game-header button')
      target?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="round-guidance-dialog"
      aria-modal="true"
      aria-labelledby="round-guidance-title"
      aria-describedby={kind === 'casey'
        ? 'round-guidance-clue round-guidance-number round-guidance-description'
        : 'round-guidance-description'}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss(hideReminder)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = dialog.current!.querySelectorAll<HTMLElement>('button, input')
        const first = controls[0]!
        const last = controls[controls.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <h2 id="round-guidance-title">{kind === 'last-chance' && wheel ? COPY.translation.title : COPY[kind].title}</h2>
      {kind === 'casey' && clue ? (
        <>
          <p id="round-guidance-clue" className="round-guidance-clue">{clue.text}</p>
          <p id="round-guidance-number" className="round-guidance-number">{UI.game.guidanceWordCount(clue.number)}</p>
          <p id="round-guidance-description">{UI.game.guidanceCaseyBody}</p>
        </>
      ) : kind === 'packing' ? (
        // Short, and in the order the phase happens (owner, 2026-09-11): the
        // board is translated first, and the round begins when it is done OR
        // when you can get no further. The first draft explained wrapping as
        // well, which is the round's business and not this moment's; what the
        // panel exists for is the second sentence, since a player stuck on one
        // word has no other way to learn they may begin anyway.
        <p id="round-guidance-description">{UI.game.guidancePackingBody}</p>
      ) : kind === 'translation' ? (
        <p id="round-guidance-description">{UI.game.guidanceTranslationBody(UI.onboarding.courseText(ACTIVE.code).languageName)}</p>
      ) : kind === 'last-chance' ? (
        wheel ? (
          // The wheel arrival's own sentence (owner, 2026-09-17): the pop-up
          // announces the spin and the translate-to-improve-the-odds bargain,
          // in the wheelLede's voice — the dock under it repeats the short
          // form for the rest of the phase. The no-wheel sudden death keeps
          // the original "keep naming" rule below.
          <p id="round-guidance-description">{UI.game.guidanceTranslationBody(UI.onboarding.courseText(ACTIVE.code).languageName)}</p>
        ) : (
          // The rule the last chance runs on, in the owner's words (2026-09-11),
          // said once as the phase opens; the dock under it repeats the short
          // form for the rest of the phase.
          <p id="round-guidance-description">{UI.game.guidanceLastChanceBody}</p>
        )
      ) : (
        <p id="round-guidance-description">{UI.game.guidancePlayerBody}</p>
      )}
      {kind === 'player' && (
        <label className="round-guidance-preference">
          <input type="checkbox" checked={hideReminder} onChange={(event) => setHideReminder(event.target.checked)} />
          <span>{UI.game.guidanceHideReminder}</span>
        </label>
      )}
      <button className="btn btn-primary btn-big" type="button" onClick={() => onDismiss(hideReminder)}>
        {/* Translation introduces both typing and the upcoming spin. */}
        {kind === 'last-chance' && wheel ? COPY.translation.action : COPY[kind].action}
      </button>
    </dialog>
  )
}
