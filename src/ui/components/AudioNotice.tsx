import { useEffect, useState } from 'react'
import { UI } from '../../i18n'
import { onAudioFailure, type AudioFailure } from '../speak'

/** How long the note stays. Long enough to read, short enough to be a note. */
const SHOW_MS = 4000

/**
 * The one place a recording's failure is said for taps that show no result of
 * their own — a card on the board, a tile in the suitcase, a word in the
 * packing dock. The screens that DO show a result (the sentence review, the
 * dictionary sheet, the Survival lines, the chapter recording) say it in
 * place as well, and this appears for them too; twice said is fine, silence
 * is not.
 *
 * This exists because the alternative was tried for weeks: with a second
 * voice standing in for a failed clip, nothing on screen ever said a clip had
 * failed, and the whole Aoede bake went unheard on the phone through four
 * TestFlight builds. The app has one voice now, and when it does not play,
 * the player is told rather than served another.
 */
export function AudioNotice() {
  const [failure, setFailure] = useState<AudioFailure | null>(null)
  useEffect(() => onAudioFailure(setFailure), [])
  useEffect(() => {
    if (!failure) return
    const t = setTimeout(() => setFailure(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [failure])
  if (!failure) return null
  return (
    <div className="update-banner update-banner-quiet audio-notice" role="status" data-audio-failure={failure.kind}>
      <span>{UI.system.audioFailed(NOUN[failure.kind])}</span>
    </div>
  )
}

const NOUN: Record<AudioFailure['kind'], string> = {
  word: UI.system.audioWord,
  example: UI.system.audioExample,
  chapter: UI.system.audioChapter,
  task: UI.system.audioTask,
  survival: UI.system.audioSurvival,
}
