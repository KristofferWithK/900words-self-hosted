import { CITY1_CATALOG, recordingUrl } from '../../review/city1'
import { examplePresentation, type ExampleContext } from '../../review/examplePresentation'
import { useEffect, useLayoutEffect, useState } from 'react'
import { articleLabel } from '../../data/gender'
import { wordById } from '../../data/words'
import { useGame } from '../../stores/gameStore'
import { useSettings } from '../../stores/settingsStore'

import { useUi } from '../../stores/uiStore'
import { canPlayWords, playCity1Sentence, preloadCity1Sentences, playExample, playWord, preloadExampleAudio, preloadWordAudio, WORD_POOL_LIMITS, type PlaybackSource } from '../speak'
import { useWordPool } from '../useWordPool'
import { markDanish, markEnglish, type Segment } from '../exampleHighlight'
import { ReplayIcon, SlowIcon } from './AudioIcons'
import { Tag } from './Tag'
import { useDialog } from '../useDialog'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'

export function DictionarySheet() {
  const { sheetWordId, sheetContext, sheetAudio, closeSheet } = useUi()
  const entry = sheetWordId ? wordById(sheetWordId) : undefined
  const presentation = entry ? examplePresentation(entry, sheetContext) : undefined
  const board = presentation?.board
  const mode = useGame((s) => s.mode)
  const packingDone = useGame((s) => s.packingDone)
  // An open sheet readies its own few clips and lets them go as it closes;
  // the board's stay in the board's pool underneath.
  useWordPool('sheet', WORD_POOL_LIMITS.sheet, !!sheetWordId)

  // An open sheet must not survive into a phase that closes the dictionary —
  // it would display the answer to a card the player is being asked to type.
  // That used to mean the redemption challenge, which is retired; the wrap-up
  // packing phase makes the same bargain in the other direction, so the guard
  // moves rather than going away.
  const locked = mode === 'wrapup' && !packingDone
  useEffect(() => {
    if (locked && sheetWordId) closeSheet()
  }, [locked, sheetWordId, closeSheet])

  /**
   * Whether the example last asked for actually played. There is no second
   * voice any more, so a recording that did not load is said in words here,
   * the way the sentence review's replay button says it. Reset per word, so a
   * stale note does not carry over to the next lookup.
   */
  const [playback, setPlayback] = useState<PlaybackSource | undefined>(undefined)
  useEffect(() => setPlayback(undefined), [sheetWordId, sheetContext])
  useLayoutEffect(() => () => sheetAudio.cancel(), [sheetAudio])

  // Ready the three clips this sheet can play the moment it opens, so a tap
  // on any of them is a start rather than a load. The word itself is usually
  // warm already — it was tapped or dealt — but the 🐢 and the sentence are
  // not, and the sentence is the one most often asked for next.
  useEffect(() => {
    if (!sheetWordId) return
    void preloadWordAudio([sheetWordId])
    void preloadWordAudio([sheetWordId], { slow: true })
    if (board) void preloadCity1Sentences([board])
    else void preloadExampleAudio([sheetWordId])
  }, [sheetWordId, sheetContext])

  const open = !!entry && !locked
  const dialogRef = useDialog(open, closeSheet)
  if (!open || !entry || !presentation) return null

  const danishSegments: Segment[] = board ? [
    { text: presentation.da.slice(0, board.wordSpan.start), hit: false },
    { text: board.wordSpan.text, hit: true },
    { text: presentation.da.slice(board.wordSpan.end), hit: false },
  ] : markDanish(presentation.da, entry.da)
  return (
    <div className="sheet-backdrop" onClick={closeSheet}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 id="sheet-title" lang={ACTIVE.code}>
            {articleLabel(entry) ? `${articleLabel(entry)} ` : ''}
            {entry.da}
          </h2>
          <span className="pos-badge">{entry.pos}</span>
          {/* The slow button plays a second BAKE, not the same clip slowed
              down — see wordAudioUrl. It sits beside the replay rather than
              replacing it because looking a word up is exactly when a learner
              wants to hear it twice, and the second time slowly. The replay
              is an arrow, not a speaker: the word was said when it was tapped,
              so what this press does is say it again. */}
          {canPlayWords() && (
            <>
              <button
                className="speak-btn"
                aria-label={UI.game.sayAgainAria(entry.da)}
                onClick={() => sheetAudio.run(() => playWord(entry.id))}
              >
                <ReplayIcon />
              </button>
              <button
                className="speak-btn"
                aria-label={UI.game.saySlowlyAria(entry.da)}
                onClick={() => sheetAudio.run(() => playWord(entry.id, { slow: true }))}
              >
                <SlowIcon />
              </button>
            </>
          )}
        </div>
        <p className="sheet-glosses">{entry.en.join(', ')}</p>
        <blockquote className="sheet-example">
          {/* The word being looked up, marked in both sentences — its Danish
              form as the sentence inflects it, its gloss as the English uses
              it — so the pair can be picked out at a glance. */}
          <p lang={ACTIVE.code}>
            <Marked segments={danishSegments} />
            {canPlayWords() && (
              <>
                <button
                  className="speak-btn speak-btn-inline"
                  aria-label={UI.game.sayExampleAria}
                  onClick={() => sheetAudio.run(() => board ? playCity1Sentence(board) : playExample(entry.id), setPlayback)}
                >
                  <ReplayIcon />
                </button>
                {<button
                  className="speak-btn speak-btn-inline"
                  aria-label={UI.game.sayExampleSlowlyAria}
                  onClick={() => sheetAudio.run(() => board ? playCity1Sentence(board, undefined, { slow: true }) : playExample(entry.id, { slow: true }), setPlayback)}
                >
                  <SlowIcon />
                </button>}
              </>
            )}
          </p>
          <p className="sheet-example-en">
            <Marked segments={markEnglish(presentation.en, entry.en, entry.da)} />
            {/* Inline in the English line rather than a row of its own: the
                sheet's height is what it is, and the only job here is to be
                visible when the recording did not play. */}
            {board && !recordingUrl(board, CITY1_CATALOG.recordings) && !recordingUrl(board, CITY1_CATALOG.recordings, 'slow') ? <span className="sheet-example-source" role="status">{UI.game.recordingsUnavailableNote}</span> : playback === 'failed' && <span className="sheet-example-source">{UI.game.recordingFailedNote}</span>}
          </p>
        </blockquote>
        <Tag size="wide" className="sheet-close" label={UI.game.close} onClick={closeSheet} />
      </div>
    </div>
  )
}

/** A sentence with its headword marked. `<mark>` so a screen reader can say so. */
function Marked({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.hit ? <mark className="example-hit" key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  )
}

/** Open the sheet for a word and log the lookup as an SRS signal. */
export function useOpenDictionary(context: ExampleContext) {
  const openSheet = useUi((s) => s.openSheet)
  const recordLookup = useGame((s) => s.recordLookup)
  return (wordId: string) => {
    const word = wordById(wordId)
    const row = word ? examplePresentation(word, context).board : undefined
    recordLookup(wordId)
    openSheet(wordId, context)
    const audio = useUi.getState().sheetAudio
    if (!word) return
    // A board lookup is a pronunciation aid for the card the player just
    // tapped: always say the article and word, independently of the setting
    // that controls instructional example-sentence lookups. The sentence is
    // still available through the explicit replay buttons in the sheet.
    if (context.kind === 'board') {
      audio.run(() => playWord(wordId))
    } else if (useSettings.getState().playExampleOnLookup) {
      audio.run(() => row ? playCity1Sentence(row) : playExample(wordId))
    } else {
      // `playWord` owns the global tap-audio preference, so this both uses the
      // shorter word when requested and remains silent when sound is off.
      audio.run(() => playWord(wordId))
    }
  }
}
