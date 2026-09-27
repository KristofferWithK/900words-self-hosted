import { describe, expect, it } from 'vitest'
import { RECEIPT_UI } from '../i18n/receipt'
import type { CompletionReceipt } from '../progression/types'
import { HOME_TOUR_STEPS, INTRO_GAME_TOUR_STEPS, resultTourSteps, TOUR_STEPS, translationTourSteps, wheelReadyTourSteps } from './tour'
import { UI } from '../i18n'

/**
 * The tour's shape and its one dangerous sentence. Whether each anchor still
 * matches a band on the LIVE SuitcaseScreen is onboarding-drive's assertion —
 * it resolves every selector on the real screen — so this file only pins what
 * a unit can: the order, and the copy's claims about the rules.
 */
describe('the Casey collection tour', () => {
  it('walks the live word and board collection in reading order', () => {
    expect(TOUR_STEPS.map((s) => s.anchor)).toEqual([
      '.case-panel-lid',
      '.collection-summary',
      '.collection-board-grid',
      '.collection-primary',
    ])
  })

  it('makes tiers and replay improvement the successor to obsolete wrapping guidance', () => {
    const [words, summary, boards, next] = TOUR_STEPS
    expect(words!.text).toMatch(/word/i)
    expect(summary!.text).toMatch(/tier/i)
    expect(boards!.text).toMatch(/replay/i)
    expect(next!.text).toMatch(/next required board/i)
    for (const step of TOUR_STEPS) expect(step.text).not.toMatch(/wrap|pack/i)
  })
})

describe('the intro game guided tour', () => {
  it('walks key → clue field → dictionary → stepper, the order a clue is built', () => {
    // The owner's order (2026-09-18): the key first — the frames are on the
    // board exactly when the practice round reaches the player's first clue
    // turn (playerKeyHidden in BoardGrid.tsx) — then the composer's three
    // controls, which all live there and are walked while it is open.
    expect(INTRO_GAME_TOUR_STEPS.map((step) => step.anchor)).toEqual([
      '.tutorial-game .mykey-green',
      '#clue-word',
      '.translate-input',
      '.stepper',
    ])
  })

  it('keeps the clue-giver key phrasing exact in the key line', () => {
    // The tone reference is the line the old TUTORIAL_TOUR_STEPS pinned: the
    // rule this repo has written backwards six times, said forwards.
    const key = INTRO_GAME_TOUR_STEPS[0]!
    expect(key.text).toMatch(/never see.*never see/i)
    expect(key.text).toMatch(/whoever gave the clue/)
    expect(key.text).toMatch(/secret words/)
  })

  it('teaches one Danish word, the lookup beside the field and the stepper', () => {
    const [, field, dictionary, stepper] = INTRO_GAME_TOUR_STEPS
    expect(field!.text).toMatch(/one Danish word/i)
    expect(field!.text).toMatch(/two or three/i)
    expect(dictionary!.text).toMatch(/look it up/i)
    expect(dictionary!.text).toMatch(/closes once your clue is sent/i)
    expect(stepper!.text).toMatch(/how many words/i)
    expect(stepper!.text).toMatch(/raise it/i)
  })
})

describe('the saved result and Home guidance', () => {
  const receipt = (overrides: Partial<CompletionReceipt> = {}) => ({
    attemptTier: 'gold',
    completedLoss: false,
    previousBest: null,
    newBest: 'gold',
    rewards: { postcards: 2, newlyClaimed: ['solved'], alreadyHeld: ['spinWin'] },
    evidence: { game: { outcome: { result: 'won' } } },
    ...overrides,
  }) as CompletionReceipt

  it('walks postcard total and reasons, result tier, and introduces the review once', () => {
    const steps = resultTourSteps(receipt(), { hasReview: true })
    // The review's own controls and Home explain themselves (owner, 2026-09-27).
    expect(steps.map(step => step.anchor)).toEqual([
      '.receipt-postcard-total',
      '.receipt-reward-list',
      '.receipt-tier-summary',
      '.city1-review-sentence',
    ])
    expect(steps[0]!.text).toBe(UI.onboarding.resultTourPostcards(RECEIPT_UI.newPostcards(2).replace(/^\+\s*/, '')))
    expect(steps[0]!.text).toContain('added 2 new postcards')
    expect(steps[1]!.text).toBe(`${UI.onboarding.resultTourRewardNew(RECEIPT_UI.rewardSolved)} ${UI.onboarding.resultTourRewardHeld(RECEIPT_UI.rewardSpin)}`)
    expect(steps[2]!.text).toBe(UI.onboarding.resultTourWinTier(RECEIPT_UI.gold, RECEIPT_UI.gold))
    expect(steps[3]!.text).toBe(UI.onboarding.resultTourSentence)
  })

  it('describes zero-reward losses and says when there is no sentence to review', () => {
    const steps = resultTourSteps(receipt({
      attemptTier: 'bronze',
      completedLoss: true,
      previousBest: 'silver',
      newBest: null,
      rewards: { eligible: [], postcards: 0, newlyClaimed: [], alreadyHeld: [] },
      evidence: { game: { outcome: { result: 'lost' } } } as CompletionReceipt['evidence'],
    }), { hasReview: false })
    // No reward reasons to point at: the postcard band says so once, honestly.
    expect(steps.map(step => step.anchor)).toEqual([
      '.receipt-postcard-total',
      '.receipt-tier-summary',
      '.city1-review-empty',
    ])
    expect(steps[0]!.text).toBe(UI.onboarding.resultTourNoRewards)
    expect(steps[1]!.text).toBe(UI.onboarding.resultTourLossTier(RECEIPT_UI.silver))
    expect(steps[2]!.text).toBe(UI.onboarding.resultTourNoReview)
    expect(steps.map(step => step.text).join(' ')).not.toMatch(/[1-9] new postcards?/)
  })

  it('tells a win that earned nothing new as held rewards, never as fresh postcards', () => {
    const steps = resultTourSteps(receipt({
      attemptTier: 'silver',
      previousBest: 'gold',
      newBest: null,
      rewards: { eligible: [], postcards: 0, newlyClaimed: [], alreadyHeld: ['solved', 'spinWin'] } as never,
    }), { hasReview: false })
    expect(steps[0]!.text).toBe(UI.onboarding.resultTourNoRewards)
    expect(steps[1]!.anchor).toBe('.receipt-reward-list')
    expect(steps[1]!.text).toBe(UI.onboarding.resultTourRewardHeld(`${RECEIPT_UI.rewardSolved} · ${RECEIPT_UI.rewardSpin}`))
    expect(steps[1]!.text).not.toMatch(/New this time/)
    // The best stays the earlier Gold; this attempt's Silver is not a new best.
    expect(steps[2]!.text).toBe(UI.onboarding.resultTourWinTier(RECEIPT_UI.silver, RECEIPT_UI.gold))
  })

  it('reads only the receipt: the same receipt always gives the same lesson', () => {
    const r = receipt()
    const review = { hasReview: true }
    const frozen = JSON.stringify(r)
    expect(resultTourSteps(r, review)).toEqual(resultTourSteps(r, review))
    expect(JSON.stringify(r)).toBe(frozen)
  })

  it('targets the Home postcard total and the live Casey suitcase button', () => {
    expect(HOME_TOUR_STEPS.map(step => step.anchor)).toEqual([
      '.home-postcard-total',
      '.cluey-button',
    ])
    expect(HOME_TOUR_STEPS[0]!.text).toMatch(/postcard/i)
    expect(HOME_TOUR_STEPS[1]!.text).toMatch(/suitcase|collection/i)
  })
})

describe('the wheel lessons', () => {
  it('lets the full wheel spin from a tap on the wheel itself, and only there', () => {
    expect(wheelReadyTourSteps()).toEqual([expect.objectContaining({ anchor: '.wheel-disc', tapThrough: true })])
    expect(translationTourSteps('da').some((step) => step.tapThrough)).toBe(false)
    expect([...TOUR_STEPS, ...INTRO_GAME_TOUR_STEPS, ...HOME_TOUR_STEPS].some((step) => step.tapThrough)).toBe(false)
  })
})
