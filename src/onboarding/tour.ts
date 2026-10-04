/**
 * The spotlight tours over live screens: the suitcase's three marks (CW-13),
 * the café's practice table, the translation and wheel lessons, the first
 * café puzzle's result and stamp, and Home in the first session.
 *
 * ── AN OVERLAY ON THE REAL SCREEN, NEVER A COPY ─────────────────────────────
 *
 * Each step is a spotlight anchored by SELECTOR to a band the real
 * SuitcaseScreen already renders, walked top to bottom in the order a word
 * travels — the exact order E1 built the screen to read. A copied mock of the
 * case could drift from the case it describes the same way the rules copy has
 * drifted from the engine; a selector cannot, because onboarding-drive
 * resolves every anchor on the live screen and fails when one stops matching.
 *
 * ── WHAT THE TOUR POINTS AT ────────────────────────────────────────────────
 *
 * The copy describes the durable rules instead of assuming a particular first
 * result: a word's ring fills a third per mark (a photo, a guess from Casey's
 * clue, a clue of the player's own; contract section 3), three marks put it in
 * the case, and the tray is the city's stamp card (CW-11). Nothing here
 * teaches postcards any more: stamps replaced them (contract section 4).
 */

import { UI } from '../i18n'
import { RECEIPT_UI } from '../i18n/receipt'
import { ACTIVE } from '../lang/active'
import type { LanguageCode } from '../lang/types'
import { cafeStamp } from '../progression/rules'
import type { CompletionReceipt, RewardComponent, Tier } from '../progression/types'

export interface TourStep {
  /**
   * Selector into the live surface under the coach marks. These are stable,
   * load-bearing class names: rename one and the browser drive fails here.
   */
  anchor: string
  /** Casey's line for the band under the light. */
  text: string
  /**
   * The lit control works: a tap on it ends this beat and presses the control
   * itself, for a beat whose line says "tap it" (the full wheel's spin). Every
   * other beat holds the pointer and moves on with Next.
   */
  tapThrough?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  { anchor: '.case-loose', text: UI.onboarding.tourLoose },
  { anchor: '.case-panel-lid', text: UI.onboarding.tourLid },
  { anchor: '.stamp-card', text: UI.onboarding.tourTray },
]

/**
 * The four-beat guided tour over the LIVE practice round (2026-09-18): the
 * intro game teaches its own controls with the same greying/highlighting the
 * Home intro uses. The beats are paced by real play, not by a clock —
 * `introGameTourDue` in tutorial.ts opens the tour on the player's FIRST clue
 * turn, the one beat where the green frames are actually on the board
 * (`playerKeyHidden` releases them exactly then), and the composer's three
 * controls are walked in the order a clue is built while that one composer is
 * open. GameScreen renders it with `kind: 'tutorial'`; the TutorialCaseyBand
 * holds its line while a step has the floor, so Casey speaks from one place.
 *
 * Since CW-13 the practice is the found café's first table (GameScreen dresses
 * it as that café): ticket → Casey → walk → Home's café → tutorial (this
 * tour) → the café's own puzzle → Casey collection. The tour hangs off the
 * practice beat and writes no storage of its own.
 */
export const INTRO_GAME_TOUR_STEPS: TourStep[] = [
  {
    // The green frames are inside .board-grid; the card selector is the
    // tighter, stable anchor at the one moment the tour can run — the
    // player's clue turn is exactly when `playerKeyHidden` releases them
    // (DECISIONS 2026-08-25), so this always resolves on the live screen.
    anchor: '.tutorial-game .mykey-green',
    text: UI.onboarding.introGameTourKey,
  },
  { anchor: '#clue-word', text: UI.onboarding.courseText(ACTIVE.code).clueField },
  { anchor: '.translate-input', text: UI.onboarding.courseText(ACTIVE.code).dictionary },
  { anchor: '.stepper', text: UI.onboarding.introGameTourStepper },
]

/**
 * A short explanation of the live, free-type translation controls. It runs in
 * the translation challenge only, where the wheel still has empty segments.
 * The full wheel has its own one-beat lesson (wheelReadyTourSteps), because
 * the engine turns the challenge into the wheel phase the moment every
 * segment is green.
 */
export function translationTourSteps(course: LanguageCode = ACTIVE.code): TourStep[] {
  const copy = UI.onboarding
  return [
    {
      anchor: '.word-card-wrap[data-translation-pending="true"] .card-lid-word',
      text: copy.translationTourBoard,
    },
    {
      anchor: '.wheel-answer-row',
      text: copy.translationTourInput(UI.onboarding.courseText(course).languageName),
    },
    {
      anchor: '.wheel-disc',
      text: copy.translationTourWheel,
    },
  ]
}

/**
 * The full wheel, before its spin: one beat on the live disc. It only
 * explains; the player makes the spin themselves once it is released.
 */
export function wheelReadyTourSteps(): TourStep[] {
  // "Tap the wheel to spin" means the wheel: the tap spins it and ends the
  // lesson, with no Next to press first (owner, 2026-09-26).
  return [{ anchor: '.wheel-disc', text: UI.onboarding.wheelReadyTour, tapThrough: true }]
}

const receiptTierLabel = (tier: Tier) => ({
  bronze: RECEIPT_UI.bronze,
  silver: RECEIPT_UI.silver,
  gold: RECEIPT_UI.gold,
  platinum: RECEIPT_UI.platinum,
})[tier]

/**
 * Explain the actual immutable receipt (its ticks, then the café's stamp and
 * the city's percentage beside it, CW-09), then introduce the review once.
 */
export function resultTourSteps(
  receipt: CompletionReceipt,
  review: { hasReview: boolean; cityPercentOf?: string | null },
): TourStep[] {
  const loss = receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost'
  const hasTier = loss || receipt.evidence.game.outcome?.result === 'won'
  const best = receipt.newBest ?? receipt.previousBest
  const bestLabel = best ? receiptTierLabel(best) : UI.onboarding.resultTourNoBestYet
  // A completed loss on a café earns Bronze (owner, 2026-10-04, CW-03b): the
  // café's stamp after a lost round is its won best, or Bronze. A round that
  // is not a café (no stamp card) still says its best plainly.
  const lossStamp = receipt.cityEligible ? cafeStamp(best, true) : best
  const lossLabel = lossStamp ? receiptTierLabel(lossStamp) : UI.onboarding.resultTourNoBestYet
  const rewardLabel = (component: RewardComponent) => ({
    spinWin: RECEIPT_UI.rewardSpin,
    solved: RECEIPT_UI.rewardSolved,
    solvedAndTranslated: RECEIPT_UI.rewardTranslated,
  })[component]
  const list = (items: readonly RewardComponent[]) => items.length
    ? items.map(rewardLabel).join(' · ')
    : RECEIPT_UI.none

  // Everything below is read off the settled receipt. Nothing here computes
  // a reward: rewards already held and losses are told as the receipt
  // records them. The ticks are .receipt-reward-list, the café's stamp
  // .receipt-stamp and the city's percentage .receipt-city-percent, which is
  // drawn only with a stamp (`cityPercentOf` names its city then).
  const { newlyClaimed, alreadyHeld } = receipt.rewards
  const steps: TourStep[] = []
  if (newlyClaimed.length > 0 || alreadyHeld.length > 0) {
    steps.push({
      anchor: '.receipt-reward-list',
      text: [
        newlyClaimed.length > 0 ? UI.onboarding.resultTourRewardNew(list(newlyClaimed)) : null,
        alreadyHeld.length > 0 ? UI.onboarding.resultTourRewardHeld(list(alreadyHeld)) : null,
      ].filter(Boolean).join(' '),
    })
  }
  if (hasTier) {
    steps.push({
      anchor: '.receipt-stamp',
      text: loss
        ? UI.onboarding.resultTourLossTier(lossLabel)
        : UI.onboarding.resultTourWinTier(receiptTierLabel(receipt.attemptTier), bestLabel),
    })
    // The percentage stands beside the stamp only where the screen draws one.
    if (review.cityPercentOf) {
      steps.push({ anchor: '.receipt-city-percent', text: UI.onboarding.resultTourCityPercent(review.cityPercentOf) })
    }
  }

  // The review is introduced once. Its controls (listen, translation, about,
  // next) and Home explain themselves, so the lesson stops at the sentence
  // (owner, 2026-09-27).
  steps.push(review.hasReview
    ? { anchor: '.city1-review-sentence', text: UI.onboarding.resultTourSentence }
    : { anchor: '.city1-review-empty', text: UI.onboarding.resultTourNoReview })
  return steps
}

/**
 * Home after the walk (CW-13, contract section 7 step 5): Sightseeing, the
 * walk just taken, then the café it found. The last beat is the Café puzzle
 * tag itself, and tapping it plays the café (`tapThrough`).
 */
export function homeCafeTourSteps(cafeName: string | null): TourStep[] {
  return [
    { anchor: '.home-tag-sightseeing', text: UI.onboarding.homeTourSightseeing },
    { anchor: '.home-play', text: UI.onboarding.homeTourCafe(cafeName), tapThrough: true },
  ]
}

/**
 * Home after the first café puzzle: the city's stamp, where the postcard total
 * was, leads into Casey's real suitcase collection.
 */
export const HOME_TOUR_STEPS: TourStep[] = [
  { anchor: '.home-city-stamp', text: UI.onboarding.homeTourStamp },
  { anchor: '.cluey-button', text: UI.onboarding.homeTourCollection },
]
