import { describe, expect, it } from 'vitest'
import { emptyProgressFacts } from '../../progression/facts'
import { bestsWorth, cafeSetFixture, FIXTURE_CONTENT, FIXTURE_SET, MATRIX_FIXTURES, attemptFixture, settlementFixture } from '../../progression/fixtures'
import { boardKey } from '../../progression/identity'
import { acknowledgeEffect, emptySettlementLedger, prepareSettlement } from '../../progression/settlement'
import type { CompletionReceipt, ProgressFacts, RequiredBoardSet, SettlementLedger, Tier } from '../../progression/types'
import { requiredSetForCourse } from '../../session/courseRuntime'
import { displayCityPercent, finishStamp } from './finishStamp'

/** Settle one fixture game (MATRIX_FIXTURES index) as the app does, on `ledger`. */
function settle(index: number, ledger: SettlementLedger = emptySettlementLedger(), origin: 'primary' | 'replay' = 'primary') {
  const game = MATRIX_FIXTURES[index]!.game
  const attempt = attemptFixture(game, { attemptId: `stamp-${index}-${origin}-${Object.keys(ledger.settlements).length}`, origin })
  const result = prepareSettlement(ledger, settlementFixture(game, {
    attempt, required: FIXTURE_SET, authoredContent: FIXTURE_CONTENT,
    continuation: origin === 'primary' ? settlementFixture(game).continuation : null,
  }))
  if (result.status === 'blocked') throw new Error(result.reason)
  const settled = result.receipt.effects.reduce((next, effect) => acknowledgeEffect(next, result.receipt.receiptId, effect), result.ledger)
  return { receipt: result.receipt, ledger: settled }
}

/** Matrix indexes: 1 Silver, 4 Gold, 5 Platinum (wins); 0 and 3 are completed losses (3 solved, spin missed). */
const SILVER = 1, GOLD = 4, PLATINUM = 5, LOSS = 0, SOLVED_LOSS = 3

const factsWith = (bests: Readonly<Record<string, Tier>>, required: RequiredBoardSet): ProgressFacts => ({
  ...emptyProgressFacts(),
  boards: Object.fromEntries(Object.entries(bests).map(([key, best]) => [key, {
    board: required.boards.find((board) => boardKey(board) === key)!, best, claims: [],
  }])),
})

describe('finishStamp', () => {
  it('lands a first stamp in the tier the round reached, with the city share after the round', () => {
    for (const [index, tier] of [[SILVER, 'silver'], [GOLD, 'gold'], [PLATINUM, 'platinum']] as const) {
      const { receipt, ledger } = settle(index)
      const stamp = finishStamp(receipt, ledger.facts, FIXTURE_SET)!
      expect(stamp).toMatchObject({ state: 'new', tier })
      // One café: its stamp is the whole city.
      expect(stamp.cityPercent).toBe({ silver: 50, gold: 75, platinum: 100 }[tier])
      expect(stamp.cityMedal).toBe(tier)
    }
  })

  it('reads the city after this round even when the saved facts do not hold it yet', () => {
    const { receipt, ledger } = settle(GOLD)
    expect(finishStamp(receipt, emptyProgressFacts(), FIXTURE_SET)).toEqual(finishStamp(receipt, ledger.facts, FIXTURE_SET))
  })

  it('says a replay that does not raise the stamp keeps it, and lands a raised one', () => {
    const platinum = settle(PLATINUM)
    const lower = settle(SILVER, platinum.ledger, 'replay')
    expect(finishStamp(lower.receipt, lower.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'kept', tier: 'platinum', cityPercent: 100 })
    const same = settle(PLATINUM, platinum.ledger, 'replay')
    expect(finishStamp(same.receipt, same.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'kept', tier: 'platinum' })

    const gold = settle(GOLD)
    const raised = settle(PLATINUM, gold.ledger, 'replay')
    expect(finishStamp(raised.receipt, raised.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'new', tier: 'platinum', cityPercent: 100 })
  })

  it('lands Bronze for a lost first visit (CW-03b), and a lost replay keeps the stamp it had', () => {
    const lost = settle(LOSS)
    expect(lost.receipt.completedLoss).toBe(true)
    expect(finishStamp(lost.receipt, lost.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'new', tier: 'bronze', cityPercent: 25, cityMedal: 'bronze' })
    // Also before the saved facts hold the loss: the round's own Bronze is laid over them.
    expect(finishStamp(lost.receipt, emptyProgressFacts(), FIXTURE_SET)).toEqual(finishStamp(lost.receipt, lost.ledger.facts, FIXTURE_SET))

    // Solved, but the spin missed: the attempt reached Gold, the stamp is Bronze.
    const solvedLost = settle(SOLVED_LOSS)
    expect(solvedLost.receipt).toMatchObject({ completedLoss: true, attemptTier: 'gold' })
    expect(finishStamp(solvedLost.receipt, solvedLost.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'new', tier: 'bronze', cityPercent: 25 })

    // A lost replay of a café that is only Bronze keeps Bronze: nothing lands.
    const lostAgain = settle(SOLVED_LOSS, lost.ledger, 'replay')
    expect(finishStamp(lostAgain.receipt, lostAgain.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'kept', tier: 'bronze', cityPercent: 25 })

    // A win after Bronze raises it, and lands.
    const raised = settle(SILVER, lostAgain.ledger, 'replay')
    expect(finishStamp(raised.receipt, raised.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'new', tier: 'silver', cityPercent: 50 })

    const gold = settle(GOLD)
    const lostReplay = settle(LOSS, gold.ledger, 'replay')
    expect(lostReplay.receipt.completedLoss).toBe(true)
    expect(finishStamp(lostReplay.receipt, lostReplay.ledger.facts, FIXTURE_SET)).toMatchObject({ state: 'kept', tier: 'gold', cityPercent: 75 })
  })

  it('floors the percentage, so 100% is shown only for an all-Platinum city', () => {
    const required = cafeSetFixture(100)
    const board = required.boards[0]!
    const receipt = { ...settle(PLATINUM).receipt, evidence: { ...settle(PLATINUM).receipt.evidence, board } } as CompletionReceipt
    // 399 of 400 points is 99.75%: Gold, shown as 99%, never 100%.
    const almost = finishStamp(receipt, factsWith(bestsWorth(required, 399), required), required)!
    expect(almost.cityPercent).toBe(99)
    expect(almost.cityMedal).toBe('gold')
    const full = finishStamp(receipt, factsWith(bestsWorth(required, 400), required), required)!
    expect(full.cityPercent).toBe(100)
    expect(full.cityMedal).toBe('platinum')
    // A single Bronze-worth point of 400 is 0.25%: floored to 0.
    expect(displayCityPercent(1, 400)).toBe(0)
    expect(displayCityPercent(99, 400)).toBe(24)
    expect(displayCityPercent(100, 400)).toBe(25)
    expect(displayCityPercent(0, 0)).toBe(0)
  })

  it('names the café from the interim resolver for a real Danish course board', () => {
    const danish = requiredSetForCourse('da')
    const { receipt } = settle(PLATINUM)
    const board = danish.boards.find((entry) => entry.authoredBoardId === danish.boards[0]!.authoredBoardId)!
    const onDanish = { ...receipt, evidence: { ...receipt.evidence, board } } as CompletionReceipt
    const stamp = finishStamp(onDanish, emptyProgressFacts(), danish)!
    expect(stamp.cafeName).toEqual(expect.any(String))
    expect(stamp.state).toBe('new')
    // One Platinum of 100 cafés is 4 of 400 points.
    expect(stamp.cityPercent).toBe(1)
    expect(stamp.cityMedal).toBeNull()
    // The fixture board is outside the Danish set: no café name.
    expect(finishStamp(receipt, emptyProgressFacts(), FIXTURE_SET)!.cafeName).toBeNull()
  })

  it('has no stamp line for a round that is not a café of the set', () => {
    const { receipt } = settle(PLATINUM)
    expect(finishStamp({ ...receipt, cityEligible: false } as CompletionReceipt, emptyProgressFacts(), FIXTURE_SET)).toBeNull()
    expect(finishStamp({ ...receipt, evidence: { ...receipt.evidence, board: null } } as CompletionReceipt, emptyProgressFacts(), FIXTURE_SET)).toBeNull()
    expect(finishStamp(receipt, emptyProgressFacts(), cafeSetFixture(3))).toBeNull()
  })
})
