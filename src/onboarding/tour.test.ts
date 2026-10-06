import { describe, expect, it } from 'vitest'
import { RECEIPT_UI } from '../i18n/receipt'
import type { CompletionReceipt, Tier } from '../progression/types'
import { HOME_TOUR_STEPS, homeCafeTourSteps, INTRO_GAME_TOUR_STEPS, resultTourSteps, TOUR_STEPS, translationTourSteps, wheelReadyTourSteps } from './tour'
import { UI } from '../i18n'

/**
 * The tour's shape and its one dangerous sentence. Whether each anchor still
 * matches a band on the LIVE SuitcaseScreen is onboarding-drive's assertion —
 * it resolves every selector on the real screen — so this file only pins what
 * a unit can: the order, and the copy's claims about the rules.
 */
describe('the suitcase tour: the three marks and the stamp card', () => {
  it('walks the words still out, the case, then the city’s stamp card', () => {
    expect(TOUR_STEPS.map((s) => s.anchor)).toEqual([
      '.case-loose',
      '.case-panel-lid',
      '.stamp-card',
    ])
  })

  it('teaches the three marks, collected words and stamps, never postcards', () => {
    const [marks, lid, card] = TOUR_STEPS
    // Contract section 3: a photo, a guess from Casey's clue, a clue of your own.
    expect(marks!.text).toMatch(/photo/i)
    expect(marks!.text).toMatch(/guess/i)
    expect(marks!.text).toMatch(/clue of your own/i)
    expect(lid!.text).toMatch(/three marks/i)
    expect(lid!.text).toMatch(/collected/i)
    expect(card!.text).toMatch(/stamp card/i)
    for (const step of TOUR_STEPS) {
      expect(step.text).not.toMatch(/wrap|pack|postcard/i)
      // Say "collected", not "learned" (contract section 3).
      expect(step.text).not.toMatch(/learn/i)
    }
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

  // The finish screen has no postcard total (CW-09): the lesson starts at the
  // ticks and points its tier beat at the café's stamp (CW-13).
  it('walks the result ticks, the stamp line, and introduces the review once', () => {
    const steps = resultTourSteps(receipt(), { hasReview: true })
    // The review's own controls and Home explain themselves (owner, 2026-09-27).
    expect(steps.map(step => step.anchor)).toEqual([
      '.receipt-reward-list',
      '.receipt-stamp',
      '.city1-review-sentence',
    ])
    expect(steps[0]!.text).toBe(`${UI.onboarding.resultTourRewardNew(RECEIPT_UI.rewardSolved)} ${UI.onboarding.resultTourRewardHeld(RECEIPT_UI.rewardSpin)}`)
    expect(steps[1]!.text).toBe(UI.onboarding.resultTourWinTier(RECEIPT_UI.gold, RECEIPT_UI.gold))
    expect(steps[2]!.text).toBe(UI.onboarding.resultTourSentence)
    expect(steps.map(step => step.text).join(' ')).not.toMatch(/postcard/i)
  })

  it('describes zero-reward losses and says when there is no sentence to review', () => {
    const steps = resultTourSteps(receipt({
      attemptTier: 'bronze',
      completedLoss: true,
      cityEligible: true,
      previousBest: 'silver',
      newBest: 'silver',
      rewards: { eligible: [], postcards: 0, newlyClaimed: [], alreadyHeld: [] },
      evidence: { game: { outcome: { result: 'lost' } } } as CompletionReceipt['evidence'],
    }), { hasReview: false })
    // No ticks to point at: the stamp line is the result's one beat.
    expect(steps.map(step => step.anchor)).toEqual([
      '.receipt-stamp',
      '.city1-review-empty',
    ])
    expect(steps[0]!.text).toBe(UI.onboarding.resultTourLossTier(RECEIPT_UI.silver))
    // The passed value is the café's stamp: a loss keeps the better Silver.
    expect(steps[0]!.text).toContain(`best so far is ${RECEIPT_UI.silver}.`)
    expect(steps[1]!.text).toBe(UI.onboarding.resultTourNoReview)
    expect(steps.map(step => step.text).join(' ')).not.toMatch(/[1-9] new postcards?/)
  })

  it('CW-03b names the café stamp after a loss: Bronze on a first visit, the better stamp on a replay', () => {
    const lost = (previousBest: Tier | null, origin: 'primary' | 'replay', cityEligible = true) => resultTourSteps(receipt({
      attemptTier: 'gold', completedLoss: true, cityEligible, previousBest, newBest: previousBest,
      rewards: { eligible: [], postcards: 0, newlyClaimed: [], alreadyHeld: [] },
      evidence: { origin, game: { outcome: { result: 'lost' } } } as CompletionReceipt['evidence'],
    }), { hasReview: false })[0]!
    // A lost first visit: the attempt reached Gold, the café's stamp is Bronze.
    const first = lost(null, 'primary')
    expect(first.anchor).toBe('.receipt-stamp')
    expect(first.text).toBe(UI.onboarding.resultTourLossTier(RECEIPT_UI.bronze))
    expect(first.text).toContain(`best so far is ${RECEIPT_UI.bronze}.`)
    expect(first.text).not.toContain(UI.onboarding.resultTourNoBestYet)
    // A lost replay of a Gold café keeps Gold, as the stamp line says.
    const gold = lost('gold', 'replay')
    expect(gold.text).toBe(UI.onboarding.resultTourLossTier(RECEIPT_UI.gold))
    expect(gold.text).toContain(`best so far is ${RECEIPT_UI.gold}.`)
    // A lost replay of a café only ever lost (no won best) is Bronze.
    expect(lost(null, 'replay').text).toBe(UI.onboarding.resultTourLossTier(RECEIPT_UI.bronze))
    // A round that is not a café has no stamp card: no Bronze is claimed.
    expect(lost(null, 'primary', false).text).toBe(UI.onboarding.resultTourLossTier(UI.onboarding.resultTourNoBestYet))
  })

  it('tells a win that earned nothing new as held rewards', () => {
    const steps = resultTourSteps(receipt({
      attemptTier: 'silver',
      previousBest: 'gold',
      newBest: null,
      rewards: { eligible: [], postcards: 0, newlyClaimed: [], alreadyHeld: ['solved', 'spinWin'] } as never,
    }), { hasReview: false })
    expect(steps[0]!.anchor).toBe('.receipt-reward-list')
    expect(steps[0]!.text).toBe(UI.onboarding.resultTourRewardHeld(`${RECEIPT_UI.rewardSolved} · ${RECEIPT_UI.rewardSpin}`))
    expect(steps[0]!.text).not.toMatch(/New this time/)
    // The best stays the earlier Gold; this attempt's Silver is not a new best.
    expect(steps[1]!.anchor).toBe('.receipt-stamp')
    expect(steps[1]!.text).toBe(UI.onboarding.resultTourWinTier(RECEIPT_UI.silver, RECEIPT_UI.gold))
  })

  it('reads only the receipt: the same receipt always gives the same lesson', () => {
    const r = receipt()
    const review = { hasReview: true }
    const frozen = JSON.stringify(r)
    expect(resultTourSteps(r, review)).toEqual(resultTourSteps(r, review))
    expect(JSON.stringify(r)).toBe(frozen)
  })

  it('points at the city’s stamp where the postcard total was, then the live Casey suitcase button', () => {
    expect(HOME_TOUR_STEPS.map(step => step.anchor)).toEqual([
      '.home-city-stamp',
      '.cluey-button',
    ])
    expect(HOME_TOUR_STEPS[0]!.text).toMatch(/stamp/i)
    expect(HOME_TOUR_STEPS[1]!.text).toMatch(/suitcase|collection/i)
    for (const step of HOME_TOUR_STEPS) expect(step.text).not.toMatch(/postcard/i)
  })

  it('makes tapping Casey the only way on from her beat (owner, 2026-10-04)', () => {
    const casey = HOME_TOUR_STEPS.at(-1)!
    expect(casey).toMatchObject({ anchor: '.cluey-button', tapThrough: true, tapOnly: true })
    // The line says plainly to tap her, now.
    expect(casey.text).toMatch(/tap me/i)
    // Only Casey's beat is tap-only: the stamp beat still moves on with Next.
    expect(HOME_TOUR_STEPS.slice(0, -1).some((step) => step.tapOnly)).toBe(false)
  })

  it("explains the city stamp's percentage truthfully on Home and on the finish screen", () => {
    expect(HOME_TOUR_STEPS[0]!.text).toMatch(/city stamp/i)
    expect(HOME_TOUR_STEPS[0]!.text).toMatch(/percentage/i)
    expect(HOME_TOUR_STEPS[0]!.text).toMatch(/again/i)
    const line = UI.onboarding.resultTourCityPercent('Sønderborg')
    expect(line).toContain('Sønderborg’s city stamp')
    for (const level of ['Bronze at 25%', 'Silver at 50%', 'Gold at 75%', 'Platinum at 100%']) expect(line).toContain(level)
  })

  it('introduces Sightseeing, then the café found, whose tag plays it', () => {
    const steps = homeCafeTourSteps('Café Solen')
    expect(steps.map(step => step.anchor)).toEqual(['.home-tag-sightseeing', '.home-play'])
    expect(steps[1]!.text).toContain('Café Solen')
    expect(steps[1]!.tapThrough).toBe(true)
    // The German course has no café names: the line still reads.
    expect(homeCafeTourSteps(null)[1]!.text).toBe(UI.onboarding.homeTourCafe(null))
    expect(homeCafeTourSteps(null)[1]!.text).not.toMatch(/null/)
  })

  it('adds the city’s percentage beside the stamp only where the screen draws it', () => {
    const withPercent = resultTourSteps(receipt(), { hasReview: false, cityPercentOf: 'Sønderborg' })
    expect(withPercent.map(step => step.anchor)).toEqual([
      '.receipt-reward-list',
      '.receipt-stamp',
      '.receipt-city-percent',
      '.city1-review-empty',
    ])
    expect(withPercent[2]!.text).toBe(UI.onboarding.resultTourCityPercent('Sønderborg'))
  })
})

describe('the wheel lessons', () => {
  it('lets the full wheel spin from a tap on the wheel itself, and only there', () => {
    expect(wheelReadyTourSteps()).toEqual([expect.objectContaining({ anchor: '.wheel-disc', tapThrough: true })])
    expect(translationTourSteps('da').some((step) => step.tapThrough)).toBe(false)
    expect([...TOUR_STEPS, ...INTRO_GAME_TOUR_STEPS].some((step) => step.tapThrough)).toBe(false)
    // The other tap-throughs: Home's Café puzzle tag in the first session, and
    // Casey on Home's stamp lesson, whose tap opens the suitcase.
    expect(homeCafeTourSteps(null).filter((step) => step.tapThrough).map((step) => step.anchor)).toEqual(['.home-play'])
    expect(HOME_TOUR_STEPS.filter((step) => step.tapThrough).map((step) => step.anchor)).toEqual(['.cluey-button'])
  })
})
