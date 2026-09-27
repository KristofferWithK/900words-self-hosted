import { City1SentenceReview } from './City1SentenceReview'
import { lazy, Suspense, useCallback, useState } from 'react'
import type { GameState, Outcome } from '../../engine/types'
import type { CompletionReceipt } from '../../progression/types'
import { UI } from '../../i18n'
import { ReminderPrompt } from './ReminderPrompt'
import { useGame } from '../../stores/gameStore'
import { type GuideEntryIntent, useUi } from '../../stores/uiStore'
import { ROWS_BUDGET_PX, RoundSentences } from './RoundSentences'
import { TurnLogSheet } from './TurnLogSheet'
import { cityAt } from '../../journey/cities'
import { activeSurvivalGuide } from '../../lang/bookshelf'
import { lessonFinishOffers, type LessonFinishOffer } from '../../journey/lessonMilestones'
import { RECEIPT_UI } from '../../i18n/receipt'
import { resultTourSteps } from '../../onboarding/tour'
import type { OnboardLessonStatus } from '../../onboarding/flow'
import { CoachMarkTour } from './SuitcaseTour'
import { CITY1_CATALOG, currentReviewSentence } from '../../review/city1'

const ReceiptResult = lazy(() => import('./ReceiptResult').then(module => ({ default: module.ReceiptResult })))
// The Guide is an optional post-result detour, not finish-screen content. Keep
// its full lesson surface out of the offline result shell until the learner
// explicitly opens one of the receipt-created invitations.
const TravelGuideBook = lazy(() => import('../screens/TravelGuideBook').then(module => ({ default: module.TravelGuideBook })))

/**
 * Every ending, keyed by `result:reason`. Typed off the Outcome union rather
 * than `Record<string, …>`, so an ending added to the engine fails the build
 * here instead of reading `undefined!` and throwing on the finish screen the
 * first time a player reaches it.
 *
 * Receipt-backed endings use the playtest result headlines and rewards; the
 * map below still supplies the explanatory sub for loss reasons.
 * No emoji since P1: Casey is on the screen, wearing the outcome's own mood,
 * and a 🎉 beside a drawn suitcase is two mascots arguing about the tone; the
 * confetti carries the celebration.
 */
type OutcomeKey = Outcome extends infer O
  ? O extends Outcome
    ? `${O['result']}:${O['reason']}`
    : never
  : never

const OUTCOME_COPY: Record<OutcomeKey, { title: string; sub?: string }> = {
  'won:all-greens': { title: UI.game.outcomeWonTitle, sub: UI.game.outcomeWonSub },
  // The wheel ending's win: the spin landed green, so the round is won. The
  // settled receipt supplies its headline and reward reasons.
  'won:wheel-win': { title: UI.game.outcomeWonTitle },
  // Reached by giving up in the last chance now, not by the clock running out —
  // the clock hands you the last chance instead of ending the round.
  'lost:timeout': { title: UI.game.outcomeLostTitle, sub: UI.game.outcomeGivenUpSub },
  // Owner, 2026-09-18: no explanatory sub on a sudden-death loss — the headline
  // "Next time" and the round's own counts are the whole loss message.
  'lost:sudden-death': { title: UI.game.outcomeLostTitle },
  'lost:wheel-miss': { title: UI.game.outcomeLostTitle, sub: UI.game.outcomeWheelMissSub },
  // Won-and-used, not spun-and-missed: the token was earned, spent on a clue,
  // and the tokens still ran out. The wheel was the last chance, so the round
  // ends instead of falling to a naming phase (owner, build 90).
  'lost:wheel-spent-exhausted': { title: UI.game.outcomeLostTitle, sub: UI.game.outcomeWheelSpentSub },
}

/**
 * What the round did, in the two numbers a learner is actually counting —
 * said as ONE LINE of text after the result receipt since the owner's third pass
 * of 2026-09-05 ("C, but add the slight boxes of B around the sentences"):
 * no tiles, no box, the count and its word in the running text. The classes
 * are kept for the drives, which read the numbers off `.stat-n`.
 *
 * There were four tiles until P1: these two, plus "in Sønderborg" and "of
 * every word". Both of those are the collection rather than the round, and
 * both are drawn bigger one tap away. What is left is the pair of diffs
 * `finishRound` takes across the SRS: how many words were new, and how many
 * crossed into the suitcase.
 */
function RoundStats({ discoveredWords, collectedWords }: { discoveredWords: readonly string[]; collectedWords: readonly string[] }) {
  return (
    <p className="outcome-stats outcome-line" aria-label={UI.game.roundStatsAria}>
      <span className="stat stat-discovered">
        <span className="stat-n">{discoveredWords.length}</span> <span className="stat-label">{UI.game.newWordsLabel(discoveredWords.length)}</span>
      </span>
      <span aria-hidden="true"> · </span>
      <span className="stat stat-collected">
        <span className="stat-n">{collectedWords.length}</span>{' '}
        <span className="stat-label">{UI.game.collectedForCasey}</span>
      </span>
    </p>
  )
}

/** "bank_007" → "07": an authored board's number, as the finish header prints it. */
export function boardNumber(authoredBoardId: string | null): string | null {
  const m = authoredBoardId?.match(/(\d+)$/)
  return m ? String(Number(m[1])).padStart(2, '0') : null
}

function receiptHeadline(receipt: CompletionReceipt): string {
  if (receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost') {
    return RECEIPT_UI.participationTrophy
  }
  if (receipt.attemptTier === 'platinum') return RECEIPT_UI.perfectGame
  if (receipt.attemptTier === 'gold') return RECEIPT_UI.greatGame
  return RECEIPT_UI.goodGame
}

export function entryForLessonOffer(offer: LessonFinishOffer): GuideEntryIntent | null {
  if (offer.kind === 'curriculum') return { kind: 'curriculum-offer', cityIndex: offer.cityIndex, itemId: offer.itemId }
  const exchangeIndex = activeSurvivalGuide.cities[offer.cityIndex]?.exchanges
    .findIndex(exchange => exchange.targetActivityId === offer.itemId) ?? -1
  return exchangeIndex >= 0 ? { kind: 'survival', cityIndex: offer.cityIndex, exchangeIndex } : null
}

/** A receipt-created invitation is optional presentation, never a scheduler. */
export function ReceiptLessonOfferActions({ receipt, onOpen }: {
  readonly receipt: CompletionReceipt
  readonly onOpen: (entry: GuideEntryIntent) => void
}) {
  const offers = lessonFinishOffers(receipt)
    .map(offer => ({ offer, entry: entryForLessonOffer(offer) }))
    .filter((value): value is { offer: LessonFinishOffer; entry: GuideEntryIntent } => value.entry !== null)
  if (!offers.length) return null
  return <section className="receipt-lesson-offer" aria-label={UI.game.resultLesson}>
    <p>{UI.game.resultLesson}</p>
    {offers.map(({ offer, entry }) => <button className="btn receipt-lesson-open" key={`${offer.kind}:${offer.itemId}`} onClick={() => onOpen(entry)}>
      {offer.kind === 'curriculum' ? UI.game.resultOpenGrammar : UI.game.resultOpenSurvival}
    </button>)}
  </section>
}

/** The receipt-owned Guide stays above the result, with an explicit exit back. */
export function ReceiptGuideOverlay({ entry, onReturn }: {
  readonly entry: GuideEntryIntent
  readonly onReturn: () => void
}) {
  return <div className="receipt-guide-overlay" role="dialog" aria-label={UI.game.resultLesson}>
    <Suspense fallback={<div className="receipt-guide-loading" aria-busy="true" />}>
      <TravelGuideBook initialEntry={entry} onExit={onReturn} />
    </Suspense>
    <button className="btn receipt-guide-return" onClick={onReturn}>{UI.game.resultBackToResult}</button>
  </div>
}

/**
 * The end of a round: everything the finish screen has to say, worked out
 * here and handed to the one surface that says it (`City1SentenceReview`).
 *
 * This used to be two screens. The reader replaced a fixed band summary at
 * City 1 only, and Skip review, Escape, an empty review queue or any later
 * city landed on the bands underneath — so a player met two different finish
 * screens for the same game. Since the owner's follow-up of 2026-09-11 the
 * reader IS the finish screen for every round that is not the tutorial: the
 * bands are gone, and what only they used to carry rides the surface now —
 * the token line under the header, cities 2–9's sentence band in the reader's
 * place, the transcript link at the end of the reader, the two prompts over
 * it. There is one Home route and one set of exits.
 */
export function RoundSummary({
  game,
  onHome,
  hideReplay = false,
  showResultLesson = false,
  onResultLessonComplete,
}: {
  game: GameState
  /** Onboarding's first real round returns to its gated Home, not ordinary navigation. */
  onHome?: () => void
  /** A first real round may be reviewed, but not replayed before Casey's case is opened. */
  hideReplay?: boolean
  /** First-board onboarding guidance, mounted only over the saved receipt. */
  showResultLesson?: boolean
  onResultLessonComplete?: (status: OnboardLessonStatus) => void
}) {
  /**
   * Collapsed to start with, and in React state rather than on a `<details>`.
   *
   * The `<details>` element keeps its open state on the DOM node, which is the
   * trap this codebase has already paid for once (README, the lookup field: it
   * was a drawer inside a dock that unmounts with the phase, so the lid cost a
   * tap every single turn). Here the direction of the bug would be the other
   * way — a `<details>` left open would hand the next round's finish screen an
   * expanded transcript before the player has read the outcome — and either
   * way the state belongs where the round can reset it.
  */
  const [logOpen, setLogOpen] = useState(false)
  const closeLog = useCallback(() => setLogOpen(false), [])
  const sentenceReview = useGame(s => s.sentenceReview)
  const nextReviewSentence = useGame(s => s.nextReviewSentence)
  const dismissReview = useGame(s => s.dismissSentenceReview)
  const boardCityIndex = useGame(s => s.boardCityIndex)
  const newGame = useGame((s) => s.newGame)
  const completionReceipt = useGame((s) => s.completionReceipt)
  const dismissResult = useGame((s) => s.dismissResult)
  const mode = useGame((s) => s.mode)
  const goTo = useUi((s) => s.goTo)
  const [guideEntry, setGuideEntry] = useState<GuideEntryIntent | null>(null)
  const [resultTourClosed, setResultTourClosed] = useState(false)
  // The normal/replay terminal screen is a projection of one settled receipt,
  // never a best effort from a mutable finished cache. C1-06 retires legacy
  // terminal saves; until then, fail closed rather than making any reward or
  // completion claim. Legacy wrap-up snapshots are retired by C1-06 rather
  // than receiving a second end screen here.
  if (game.phase === 'finished' && !completionReceipt) return null
  // A terminal result is a receipt projection, not a fresh reading of the
  // mutable game cache. Recovery pins this evidence before this surface opens.
  const resultGame: GameState = completionReceipt
    ? JSON.parse(JSON.stringify(completionReceipt.evidence.game)) as GameState
    : game
  const collectedWords = completionReceipt?.learning.newlyCollected ?? []
  const discoveredWords = completionReceipt?.learning.newlyDiscovered ?? []
  const currentReview = currentReviewSentence(sentenceReview, CITY1_CATALOG.review)
  const hasReview = currentReview !== null
  const resultTourOpen = showResultLesson && !resultTourClosed && completionReceipt !== null
  const outcome = resultGame.outcome!
  const copy = OUTCOME_COPY[`${outcome.result}:${outcome.reason}` as OutcomeKey]
  // Owner, 2026-09-18: the finish screen no longer names the card that ended
  // the last chance — the header says "Next time" and the round's counts, and
  // stops. The whole fatal-card hunt this component used to run (the one
  // neither-clue-touched bystander) is gone with the line that read it.
  const hasGreens = resultGame.words.some((w) => resultGame.reveals[w.wordId]?.kind === 'green')
  const home = () => {
    // Leaving the reader is an explicit dismissal of its durable resume
    // pointer. The receipt itself remains the history/claims authority.
    dismissResult()
    const leave = onHome ?? (() => goTo('home'))
    leave()
  }

  return (
    // The wrapper is the mount point the drives wait for; the surface itself
    // is a full-bleed <dialog> in the top layer and takes no room here.
    <div className="round-summary">
      <City1SentenceReview
        state={sentenceReview}
        outcome={{
          result: outcome.result,
          title: completionReceipt ? receiptHeadline(completionReceipt) : copy.title,
          // Keep the loss reason below its headline when the outcome copy has
          // one; the receipt itself stays compact above the word counts.
          sub: outcome.result === 'won' ? undefined : copy.sub,
          stats: <RoundStats discoveredWords={discoveredWords} collectedWords={collectedWords} />,
          meta: {
            place: [cityAt(boardCityIndex).name, completionReceipt && boardNumber(completionReceipt.evidence.board?.authoredBoardId ?? null)]
              .filter(Boolean).map((part, i) => i === 0 ? part : RECEIPT_UI.boardLabel(part as string)).join(' · '),
            label: RECEIPT_UI.resultLabel,
          },
          resultDetails: completionReceipt && <Suspense fallback={<div className="receipt-result" aria-busy="true" />}><ReceiptResult receipt={completionReceipt} /></Suspense>,
        }}
        // The reader's place when there is no accepted sentence to read: a
        // wrap-up's train (it builds no queue at all — finishRound refuses
        // one); otherwise the P1 sentence band (two to six of the round's
        // greens in their sentences) at cities 2–9, which have no review
        // catalogue; a line saying so at City 1, where the queue is built from
        // the player's own clues and a round can leave it empty.
        fallback={
          boardCityIndex !== 0 && hasGreens ? (
            // The wrap-up budget is gone from this call, not forgotten: the
            // branch above takes every wrap-up, so the band is only ever a
            // normal round's now.
            <RoundSentences
              game={resultGame}
              budgetPx={ROWS_BUDGET_PX.normal}
              cityName={cityAt(boardCityIndex).name}
            />
          ) : (
            <p className="city1-review-empty">
              {boardCityIndex === 0 ? UI.game.reviewNothingThisRound : UI.game.sentenceBandNoGreens}
            </p>
          )
        }
        footnote={<section className="log-section">
            <button
              className="log-toggle"
              aria-expanded={logOpen}
              aria-controls="turn-log-sheet"
              onClick={() => setLogOpen(true)}
            >
              <span className="log-toggle-label">{UI.game.caseysCalls}</span>
              <span className="log-toggle-count">
                {UI.game.turnCount(resultGame.clueHistory.length)}
              </span>
            </button>
          </section>}
        onNext={nextReviewSentence}
        onDismiss={dismissReview}
        onHome={home}
        onReplay={!hideReplay ? () => newGame() : undefined}
        // City 1 deals its next authored board; elsewhere it is the same deal again.
        replayLabel={boardCityIndex === 0 ? UI.game.playNextGame : UI.game.playAgain}
          specialActions={completionReceipt && !resultTourOpen ? <ReceiptLessonOfferActions receipt={completionReceipt} onOpen={setGuideEntry} /> : undefined}
      >
        {logOpen && <TurnLogSheet game={resultGame} onClose={closeLog} />}
        {!resultTourOpen && <ReminderPrompt
          eligible={mode !== 'tutorial'}
        />}
        {guideEntry && <ReceiptGuideOverlay entry={guideEntry} onReturn={() => setGuideEntry(null)} />}
        {resultTourOpen && completionReceipt && <CoachMarkTour
          steps={resultTourSteps(completionReceipt, { hasReview })}
          surfaceSelector=".city1-review-dialog"
          graceMs={8000}
          onDone={() => { setResultTourClosed(true); onResultLessonComplete?.('done') }}
          onSkip={() => { setResultTourClosed(true); onResultLessonComplete?.('dismissed') }}
          onUnavailable={() => setResultTourClosed(true)}
          kind="result"
        />}
      </City1SentenceReview>
    </div>
  )
}
