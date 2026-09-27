import { describe, expect, it } from 'vitest'
import { parseLedger, parseSessions } from './storageSchema'
import {
  BASELINE_REPRODUCTION_LIMITS,
  PLAYTEST_FIXTURES,
  RESTORED_OLD_SAVE,
  UNFINISHED_PRIMARY_BENEATH_REPLAY,
  validatedReceiptFixture,
} from './fixtures'
import { evaluateAttempt, type AttemptResult } from './rules'
import type { AttemptEvidence } from './types'

function completed(attempt: AttemptEvidence): Extract<AttemptResult, { status: 'completed' }> {
  const result = evaluateAttempt(attempt)
  expect(result.status).toBe('completed')
  if (result.status !== 'completed') throw new Error(`fixture was not completed: ${result.status}`)
  return result
}

describe('P01 reusable playtest fixtures', () => {
  it('covers named outcomes without manufacturing a win', () => {
    expect(completed(PLAYTEST_FIXTURES.firstPlatinum).tier).toBe('platinum')
    expect(completed(PLAYTEST_FIXTURES.firstGold).tier).toBe('gold')
    expect(completed(PLAYTEST_FIXTURES.firstSilver).tier).toBe('silver')
    expect(evaluateAttempt(PLAYTEST_FIXTURES.solvedMiss)).toMatchObject({ outcome: 'lost', tier: 'gold' })
    expect(evaluateAttempt(PLAYTEST_FIXTURES.zeroFoundLoss)).toMatchObject({ outcome: 'lost', tier: 'bronze' })
    expect(completed(PLAYTEST_FIXTURES.oneTimePracticeReward).components).toEqual(['spinWin', 'solved', 'solvedAndTranslated'])
  })

  it('loads completion receipts and suspended primary/replay sessions through real schemas', () => {
    const prepared = validatedReceiptFixture()
    expect(parseLedger(prepared.ledger).settlements[prepared.receipt.receiptId].receipt.evidence.game.phase).toBe('finished')
    expect(parseSessions(UNFINISHED_PRIMARY_BENEATH_REPLAY).activeSlot).toBe('replay')
    expect(parseSessions(RESTORED_OLD_SAVE).continuation.source).toBe('legacy-anchor')
  })

  it('records source-only reproduction limits instead of claiming UI/native evidence', () => {
    expect(Object.keys(BASELINE_REPRODUCTION_LIMITS)).toEqual(['layout', 'homeDismissal', 'lookup', 'crossOuts'])
    expect(Object.values(BASELINE_REPRODUCTION_LIMITS).every((value) => /not captured/.test(value))).toBe(true)
  })
})
