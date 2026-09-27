/**
 * The finish screen.
 *
 * The owner's approved Board review design of 2026-09-11 (the Command/Inspect
 * pass, `prototypes/finish-review-redesign-20260910/README.md` on
 * `codex/finish-review-redesign-20260910`), and since the owner's follow-up
 * of the same day the ONE surface every round ends on — the fixed band
 * summary it used to replace at City 1 only is gone from the code. A
 * full-height opaque white foreground with no backdrop, no cream dialog and
 * no second set of exits underneath. Three regions, and only the middle one
 * may ever scroll:
 *
 *   1. the header — Casey wearing the outcome, a receipt-tier win headline or
 *      the participation headline for a loss, then reward reasons, the new
 *      postcard total and attempt tier, and the discovered/collected counts.
 *      RoundSummary owns that projection, so the result is said in exactly
 *      one place. A won round drops confetti over the whole surface from here.
 *   2. the reader — at City 1, one Danish sentence per clue the player gave:
 *      Danish first, one Listen and the snail, translation and About as
 *      INDEPENDENT disclosures that both reset on Next. A round with no
 *      sentence to offer, and every later city, fills the same region with
 *      `fallback` instead (the P1 sentence band for cities 2–9, a one-line
 *      note otherwise). `notes` opens the region and `footnote` — the
 *      transcript link — closes it.
 *   3. the anchored footer — Next sentence first while there is one, then
 *      the exits: replay and Home; on the last sentence replay becomes the
 *      single primary. A wrap-up's three Guide choices stand in for replay.
 *
 * There is no finish state underneath this any more, so there is nothing to
 * skip to: the Skip review control of the first implementation is gone, and
 * Escape goes Home — the same exit the footer offers — rather than closing
 * the screen onto an empty game column. `showModal()` is kept for what it
 * gives free (the rest of the document goes inert, so the game header behind
 * the surface cannot be tabbed into) and the backdrop is made transparent
 * because the surface is opaque and full-bleed anyway. Overlays that belong
 * to the round's end — the transcript sheet, the data-sharing and reminder
 * prompts — are rendered INSIDE the dialog as `children`: it is in the top
 * layer, and a fixed overlay outside it would paint underneath.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CITY1_CATALOG, currentReviewSentence, nextReviewSentenceAvailable, recordingUrl, type City1Catalog, type QueueState, type ReviewSentence, type Span } from '../../review/city1'
import { playCity1Sentence, preloadCity1Sentences, stopWordAudio, type PlaybackSource } from '../speak'
import { UI } from '../../i18n'

import { SlowIcon } from './AudioIcons'
import { ClueyFace } from './Cluey'
import { Confetti } from './Confetti'

// Recompute eligibility for every key: disclosures and special actions can change.
function eligible(element: HTMLElement): boolean {
  return element.isConnected && !element.matches(':disabled') &&
    !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden'
}
/** The one heading the surface is labelled by, and the one thing focus falls back to. */
const titleOf = (panel: ParentNode) => panel.querySelector<HTMLElement>('#city1-review-title')
function wrapTab(event: React.KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const panel = event.currentTarget
  const active = document.activeElement
  // An overlay riding the surface — the transcript sheet, a prompt — keeps
  // its own tabbing (useDialog wraps the sheet); this wrap is the surface's.
  if (active instanceof HTMLElement && active.closest('[role="dialog"]')) return
  const controls = [...panel.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]',
  )].filter(el => el.tabIndex >= 0 && eligible(el))
  const first = controls[0], last = controls.at(-1)
  if (!first || !last) {
    event.preventDefault()
    titleOf(panel)?.focus()
  } else if (!controls.includes(active as HTMLElement) ||
    (event.shiftKey ? active === first : active === last)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}
/** What the round came to, said once by RoundSummary and drawn in the header. */
export interface FinishOutcome {
  result: 'won' | 'lost'
  /** "Congratulations!" or "Next time". */
  title: string
  /** Why a lost round was lost; a won round says what it won. */
  sub?: string
  /** What the round did, in one line — the discovered and collected counts. */
  stats: ReactNode
  /** Receipt facts that sit above Board review, never inside its scroller. */
  resultDetails?: ReactNode
  /** Legacy slot for callers without a settled receipt. */
  reward?: ReactNode
  /** The small-caps line over the headline: where ("Sønderborg · Board 07") and what ("Result"). */
  meta?: { place: string; label: string }
}
interface Props {
  state: QueueState | null
  catalog?: City1Catalog
  outcome: FinishOutcome
  /** Lines under the header that open the reader: the token economy, a wrap-up's reassurance. */
  notes?: ReactNode
  /** What fills the reader when there is no sentence to read. */
  fallback?: ReactNode
  /**
   * What the reader region is called. "Board review" for a round that offers
   * sentences; a wrap-up builds no queue at all, so it names its own region
   * after what the region actually shows.
   */
  readerHeading?: string
  /** What closes the reader: the transcript link. */
  footnote?: ReactNode
  /** Overlays that ride the surface: the transcript sheet, the two prompts. */
  children?: ReactNode
  onNext: () => void
  onDismiss: () => void
  onHome: () => void
  onReplay?: () => void
  /** "Play next game" where the next board is authored (City 1); "Play again" elsewhere. */
  replayLabel?: string
  specialActions?: ReactNode
}
function MarkedSentence({ row }: { row: ReviewSentence }) {
  const boundaries = [...new Set([0, row.text.da.length, row.wordSpan.start, row.wordSpan.end,
    row.targetSpan.start, row.targetSpan.end])].sort((a, b) => a - b)
  return <>{boundaries.slice(0, -1).map((start, i) => <span key={start}
    className={[start >= row.wordSpan.start && start < row.wordSpan.end ? 'review-headword' : '',
      start >= row.targetSpan.start && start < row.targetSpan.end ? 'review-target' : ''].join(' ')}
  >{row.text.da.slice(start, boundaries[i + 1])}</span>)}</>
}
/** The About note's own example, with the high-frequency word underlined in it. */
function MarkedSpanText({ text, span }: { text: string; span: Span }) {
  const boundaries = [...new Set([0, text.length, span.start, span.end])]
    .filter(at => at >= 0 && at <= text.length).sort((a, b) => a - b)
  return <>{boundaries.slice(0, -1).map((start, i) => <span key={start}
    className={start >= span.start && start < span.end ? 'review-target' : ''}
  >{text.slice(start, boundaries[i + 1])}</span>)}</>
}
/** One collapsed row: its own label, its own chevron, its own body. */
function Disclosure({ id, label, open, onToggle, children }: {
  id: string; label: string; open: boolean; onToggle: () => void; children: ReactNode
}) {
  return <section className={`city1-review-disclosure city1-review-${id === 'review-translation' ? 'translation' : 'about'}`}>
    <button id={`${id}-toggle`} className="city1-review-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span>{label}</span>
      <span className="city1-review-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="city1-review-body" id={id}>{children}</div>}
  </section>
}
// Keyed per pin: translation, About and audio feedback reset independently on Next.
function Sentence({ row, catalog }: { row: ReviewSentence; catalog: City1Catalog }) {
  const [translation, setTranslation] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [playback, setPlayback] = useState<PlaybackSource>()
  const request = useRef(0)
  useLayoutEffect(() => () => { request.current++; stopWordAudio() }, [])
  useEffect(() => { void preloadCity1Sentences([row], catalog.recordings) }, [row, catalog.recordings])
  const about = catalog.about.find(a => a.targetId === row.targetId)
  return <>
    <p className="city1-review-sentence" lang={row.wordId.slice(0, 2)}><MarkedSentence row={row} /></p>
    <div className="city1-review-audio">
      <button className="btn city1-review-listen" onClick={() => { const mine = ++request.current; void playCity1Sentence(row, catalog.recordings).then(result => { if (mine === request.current) setPlayback(result) }) }}>{UI.game.reviewListen}</button>
      <button className="btn city1-review-slow" aria-label={UI.game.reviewListenSlowlyAria} onClick={() => { const mine = ++request.current; void playCity1Sentence(row, catalog.recordings, { slow: true }).then(result => { if (mine === request.current) setPlayback(result) }) }}><SlowIcon /></button>
      {/* Beside the pills rather than on a line of its own under them: the
          line it reserved was empty nearly always, and it was the gap under
          Listen that pushed About this word off the phone (owner, 2026-09-27). */}
      <p className="city1-review-audio-note" role="status">{!recordingUrl(row, catalog.recordings) && !recordingUrl(row, catalog.recordings, 'slow') ? UI.game.reviewNoRecordings : playback === 'failed' ? UI.game.reviewRecordingUnavailable : playback === 'silent' ? UI.game.reviewSoundOff : ''}</p>
    </div>
    <div className="city1-review-disclosures">
      <Disclosure id="review-translation" label={translation ? UI.game.reviewHideTranslation : UI.game.reviewShowTranslation}
        open={translation} onToggle={() => setTranslation(!translation)}>
        <p lang="en">{row.text.en}</p>
      </Disclosure>
      <Disclosure id="review-about" label={UI.game.reviewAboutWord} open={aboutOpen} onToggle={() => setAboutOpen(!aboutOpen)}>
        <p className="city1-review-target-label">{UI.game.reviewHighFrequencyWord} <span lang={row.wordId.slice(0, 2)} className="review-target">{row.targetSpan.text}</span></p>
        {about ? <>
          <p>{about.meaningEn}</p><p>{about.usageEn}</p>
          <div className="city1-review-example">
            <p lang={row.wordId.slice(0, 2)}><MarkedSpanText text={about.example.da} span={about.targetSpan} /></p>
            <p lang="en">{about.example.en}</p>
          </div>
        </> : <p>{UI.game.reviewNoNotes}</p>}
      </Disclosure>
    </div>
  </>
}
export function City1SentenceReview({
  state, catalog = CITY1_CATALOG, outcome, notes, fallback, footnote, children,
  onNext, onDismiss, onHome, onReplay, replayLabel = UI.game.playNextGame, specialActions,
  readerHeading = UI.game.reviewTitle,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  // Set before the unmount cleanup closes the dialog, so the `close` event
  // that close() fires is told apart from one the browser forced.
  const leaving = useRef(false)
  // A pin to read: the queue's current row while the review is live. A
  // dismissed or empty queue reads as nothing to show, and the surface stays —
  // it is the finish screen, with or without a sentence in it.
  const current = currentReviewSentence(state, catalog.review)
  const pin = current?.pin
  const row = current?.row
  useLayoutEffect(() => {
    const panel = dialog.current
    if (!panel) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.showModal()
    titleOf(panel)?.focus()
    return () => { leaving.current = true; panel.close(); stopWordAudio(); if (previous && eligible(previous)) previous.focus() }
  }, [])
  const exit = (callback: () => void) => { stopWordAudio(); onDismiss(); callback() }
  const hasNext = nextReviewSentenceAvailable(state, catalog.review)
  // Replay / Home. Grouped into one row under Next sentence while there is a
  // next sentence, so the primary action owns the first line; otherwise
  // replay IS the primary and Home sits under it. A wrap-up's three Guide
  // choices already occupy that row, so it stacks.
  const exits = <>
    {onReplay && <button className={hasNext ? 'btn' : 'btn btn-primary'} onClick={() => exit(onReplay)}>{replayLabel}</button>}
    <button className="btn city1-review-home" onClick={() => exit(onHome)}>{UI.game.home}</button>
  </>
  return <dialog ref={dialog} className="city1-review-dialog" aria-modal="true" aria-labelledby="city1-review-title"
    onKeyDown={wrapTab}
    // Escape is the keyboard's way out, and the way out of a finished round
    // is Home. Never a bare close: a closed dialog over a finished game is an
    // empty column with nothing on it.
    onCancel={e => { e.preventDefault(); exit(onHome) }}
    // A close the browser forced through anyway (an Escape with no user
    // activation behind it is not cancelable) takes the same exit; the close
    // this component's own unmount performs is not one.
    onClose={() => { if (!leaving.current) exit(onHome) }}>
    {outcome.result === 'won' && <Confetti />}
    <header className={`city1-review-context${outcome.resultDetails ? ' city1-review-context-receipt' : ''}`}>
      {outcome.resultDetails ? <>
        {/* The owner's finish-screen mockup of 2026-09-26: a small-caps line
            saying where the round was, then the headline with Casey to its
            RIGHT, then the receipt. */}
        {outcome.meta && <p className="city1-review-meta">
          <span>{outcome.meta.place}</span>
          <span>{outcome.meta.label}</span>
        </p>}
        <div className={`outcome-banner outcome-${outcome.result}`}>
          <div className="outcome-said">
            <h2 id="city1-review-title" tabIndex={-1} className="city1-review-outcome">{outcome.title}</h2>
            {outcome.sub && <p className="outcome-sub">{outcome.sub}</p>}
          </div>
          <ClueyFace mood={outcome.result === 'won' ? 'happy' : 'oops'} className="cluey-mini city1-review-casey" />
        </div>
        <div className="city1-review-result-details">
          {outcome.resultDetails}
          {outcome.stats}
        </div>
      </> : <div className={`outcome-banner outcome-${outcome.result}`}>
        <ClueyFace mood={outcome.result === 'won' ? 'happy' : 'oops'} className="cluey-mini city1-review-casey" />
        <div className="outcome-said">
          <h2 id="city1-review-title" tabIndex={-1} className="city1-review-outcome">{outcome.title}</h2>
          {outcome.sub && <p className="outcome-sub">{outcome.sub}</p>}
          {outcome.stats}
          {outcome.result === 'won' && outcome.reward && (
            <div className="outcome-reward">{outcome.reward}</div>
          )}
        </div>
      </div>}
    </header>
    <div className="city1-review-scroll">
      {notes}
      <div className="city1-review-head">
        <h3>{readerHeading}</h3>
        {row && state && <span className="city1-review-progress">{UI.game.reviewProgress(state.cursor + 1, state.queue.length)}</span>}
      </div>
      {row && pin ? <>
        <p className="city1-review-optional">{UI.game.reviewOptional}</p>
        <Sentence key={`${pin.clueHistoryIndex}:${pin.sentenceId}`} row={row} catalog={catalog} />
      </> : fallback}
      {footnote}
    </div>
    <footer className="city1-review-actions">
      {hasNext && <button className="btn btn-primary city1-review-next" onClick={() => { stopWordAudio(); titleOf(dialog.current!)?.focus(); onNext() }}>{UI.game.reviewNextSentence} <span aria-hidden="true">→</span></button>}
      {specialActions}
      {/* Replay and Home share one row under Next sentence. A lesson offer
          above them used to stack them too, and since the offer is an
          element even when it renders nothing, they were stacked always:
          a whole button's height of the phone, spent on every finish. */}
      {hasNext ? <div className="city1-review-exit-row">{exits}</div> : exits}
    </footer>
    {children}
  </dialog>
}
