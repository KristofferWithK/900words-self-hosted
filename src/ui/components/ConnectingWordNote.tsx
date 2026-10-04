import { useLayoutEffect, useRef } from 'react'
import { UI, UI_LANGUAGE } from '../../i18n'
import type { ConnectingWord } from '../../journey/cityWords'
import type { WordMarks } from '../../journey/wordMarks'
import { connectingMeaningLanguage } from '../../run/sources'
import { useSettings } from '../../stores/settingsStore'
import { clipStartAt, loadBakedClip, playLoadedClip, reportAudioFailure } from '../speak'
import { MarkRing } from './MarkRing'

/**
 * A connecting word opened from the suitcase (card CW-11). Connecting words
 * have no card and no word sheet, so they open here: the word as written, its
 * meaning in the language the player's run tags are written in (English, or
 * German for a German player: `connectingMeaningLanguage`), and its marks.
 */

/** The meaning shown for a connecting word: the run's tag language, English where there is none. */
export function connectingMeaning(word: ConnectingWord): string {
  return connectingMeaningLanguage(UI_LANGUAGE) === 'de' ? word.de.shown : word.en.shown
}

/** Says a connecting word's own recording (audio/<course>/connecting/*.mp3). Never rejects. */
export async function sayConnectingWord(word: ConnectingWord): Promise<void> {
  if (!useSettings.getState().sound) return
  const url = `${import.meta.env.BASE_URL}audio/${word.course}/${word.audio.key}.mp3`
  try {
    const got = await loadBakedClip(url)
    if (got.kind !== 'clip') {
      reportAudioFailure({ kind: 'word', reason: got.kind })
      return
    }
    await playLoadedClip(got.clip, { url, startAt: clipStartAt(url) })
  } catch {
    // Interrupted by the next tap, or refused: nothing else waits on it.
  }
}

export function ConnectingWordNote({ word, marks, marksText, onClose }: {
  readonly word: ConnectingWord
  readonly marks: WordMarks
  /** The marks in words, as the tile's accessible name has them. */
  readonly marksText: string
  readonly onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement | null>(null)
  useLayoutEffect(() => {
    const panel = dialog.current!
    panel.showModal()
    panel.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (panel.open) panel.close() }
  }, [])
  return (
    <dialog ref={dialog} className="collection-detail case-word-note" aria-modal="true" aria-label={word.text}
      onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="collection-detail-card">
        <button className="icon-btn" aria-label={UI.home.back} onClick={onClose}>←</button>
        <p className="case-word-note-kind">{UI.home.connectingWord}</p>
        <h3 className="case-word-note-word" lang={word.course}>{word.text}</h3>
        <p className="case-word-note-meaning">{connectingMeaning(word)}</p>
        <p className="case-word-note-marks"><MarkRing earned={marks.earned} /> {marksText}</p>
        <p className="case-word-note-rule">{UI.home.connectingWordRule}</p>
      </div>
    </dialog>
  )
}
