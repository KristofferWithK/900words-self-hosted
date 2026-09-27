/**
 * The original suitcase tour (O3), retained as reusable live-screen guidance.
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
 * The copy describes the durable word-state rules instead of assuming a
 * particular first-game result. The shortened v4 intro now points at Casey's
 * suitcase door on Home; this detailed tour can still be reused elsewhere.
 */

import { UI } from '../i18n'
import { RECEIPT_UI } from '../i18n/receipt'
import { ACTIVE } from '../lang/active'
import type { LanguageCode } from '../lang/types'
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
  { anchor: '.case-panel-lid', text: UI.onboarding.tourLoose },
  { anchor: '.collection-summary', text: UI.onboarding.tourLid },
  { anchor: '.collection-board-grid', text: UI.onboarding.tourTray },
  { anchor: '.collection-primary', text: UI.onboarding.tourWrapUp },
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
 * ONBOARDING ORDER DOES NOT CHANGE: ticket → home-intro → tutorial (intro
 * game) → real-round → Casey collection. The tour hangs off the practice beat
 * and writes no storage of its own.
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

/** Explain the actual immutable receipt, then introduce the review once. */
export function resultTourSteps(
  receipt: CompletionReceipt,
  review: { hasReview: boolean },
): TourStep[] {
  const loss = receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost'
  const hasTier = loss || receipt.evidence.game.outcome?.result === 'won'
  const best = receipt.newBest ?? receipt.previousBest
  const bestLabel = best ? receiptTierLabel(best) : UI.onboarding.resultTourNoBestYet
  const rewardLabel = (component: RewardComponent) => ({
    spinWin: RECEIPT_UI.rewardSpin,
    solved: RECEIPT_UI.rewardSolved,
    solvedAndTranslated: RECEIPT_UI.rewardTranslated,
  })[component]
  const list = (items: readonly RewardComponent[]) => items.length
    ? items.map(rewardLabel).join(' · ')
    : RECEIPT_UI.none

  // Everything below is read off the settled receipt. Nothing here computes
  // a reward: zero postcards, rewards already held and losses are told as the
  // receipt records them.
  const { newlyClaimed, alreadyHeld, postcards } = receipt.rewards
  const steps: TourStep[] = [
    {
      anchor: '.receipt-postcard-total',
      text: postcards > 0
        // The receipt line reads "+4 new postcards"; in a sentence the sign goes.
        ? UI.onboarding.resultTourPostcards(RECEIPT_UI.newPostcards(postcards).replace(/^\+\s*/, ''))
        : UI.onboarding.resultTourNoRewards,
    },
  ]
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
      anchor: '.receipt-tier-summary',
      text: loss
        ? UI.onboarding.resultTourLossTier(bestLabel)
        : UI.onboarding.resultTourWinTier(receiptTierLabel(receipt.attemptTier), bestLabel),
    })
  }

  // The review is introduced once. Its controls (listen, translation, about,
  // next) and Home explain themselves, so the lesson stops at the sentence
  // (owner, 2026-09-27).
  steps.push(review.hasReview
    ? { anchor: '.city1-review-sentence', text: UI.onboarding.resultTourSentence }
    : { anchor: '.city1-review-empty', text: UI.onboarding.resultTourNoReview })
  return steps
}

/** Home's live postcard total leads into Casey's real suitcase collection. */
export const HOME_TOUR_STEPS: TourStep[] = [
  { anchor: '.home-postcard-total', text: UI.onboarding.homeTourPostcards },
  { anchor: '.cluey-button', text: UI.onboarding.homeTourCollection },
]
