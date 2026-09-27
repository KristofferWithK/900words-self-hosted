import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { acknowledgeEffect, emptySettlementLedger, prepareSettlement } from '../../progression/settlement'
import { FIXTURE_CONTENT, FIXTURE_SET, MATRIX_FIXTURES, attemptFixture, settlementFixture } from '../../progression/fixtures'
import type { CompletionReceipt, LearningEffect } from '../../progression/types'
import { ReceiptResult } from './ReceiptResult'
import { ReceiptLessonOfferActions } from './RoundSummary'
import { UI } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'

const learning: LearningEffect = {
  results: [],
  newlyCollected: ['a'], newlyDiscovered: ['a'],
  changes: [{ wordId: 'a', before: null, after: {
    box: 1, lastSeenAt: 1_789_776_000_000, seen: 1, correctGuesses: 1, misses: 0, lookups: 0,
    redemptionRight: 0, redemptionWrong: 0, greenByClue: 1, greenByGuess: 0,
  } }],
}

function receiptFor(index: number, ledger = emptySettlementLedger(), origin: 'primary' | 'replay' = 'primary'): { receipt: CompletionReceipt; ledger: ReturnType<typeof emptySettlementLedger> } {
  const game = MATRIX_FIXTURES[index]!.game
  const attempt = attemptFixture(game, { attemptId: `receipt-ui-${index}-${origin}-${Object.keys(ledger.settlements).length}`, origin })
  const result = prepareSettlement(ledger, settlementFixture(game, {
    attempt, learning, required: FIXTURE_SET, authoredContent: FIXTURE_CONTENT,
    continuation: origin === 'primary' ? settlementFixture(game).continuation : null,
  }))
  if (result.status === 'blocked') throw new Error(result.reason)
  // A replay begins only after the prior terminal receipt has completed its
  // durable recovery. This models the persisted/reloaded path, rather than
  // slipping around settlement's one-at-a-time invariant in a UI fixture.
  const settled = result.receipt.effects.reduce(
    (next, effect) => acknowledgeEffect(next, result.receipt.receiptId, effect),
    result.ledger,
  )
  return { receipt: result.receipt, ledger: settled }
}

const render = (receipt: CompletionReceipt) => renderToStaticMarkup(<ReceiptResult receipt={receipt} />)
// The postcard count is drawn large inside its phrase, so the phrase is read as text.
const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('ReceiptResult', () => {
  it('renders compact immutable receipt facts without a raw learning dump', () => {
    const { receipt } = receiptFor(4)
    const html = render(receipt)
    expect(html).toContain('class="receipt-reward-amount">+1</span>')
    expect(html).toContain(RECEIPT_UI.rewardSpin)
    expect(html).toContain(RECEIPT_UI.rewardSolved)
    expect(html).toContain(RECEIPT_UI.gold)
    expect(text(html)).toContain(RECEIPT_UI.newPostcards(2))
    expect(html.indexOf('receipt-reward-list')).toBeLessThan(html.indexOf('receipt-postcard-total'))
    expect(html.indexOf('receipt-postcard-total')).toBeLessThan(html.indexOf('receipt-tier-label'))
    expect(html).not.toContain(RECEIPT_UI.learningChange('a', RECEIPT_UI.learningNew, RECEIPT_UI.learningState(1, 1, 1, 0, 0, 1, 0)))
    expect(html).not.toContain('all neutral')
    expect(html).not.toContain('receipt-facts')
  })
  it('covers first Bronze, Silver, Gold and Platinum from persisted settlement receipts', () => {
    for (const [index, tier, postcards] of [[1, RECEIPT_UI.silver, 1], [4, RECEIPT_UI.gold, 2], [5, RECEIPT_UI.platinum, 4]] as const) {
      const html = render(receiptFor(index).receipt)
      expect(html).toContain(tier)
      expect(text(html)).toContain(RECEIPT_UI.newPostcards(postcards))
    }
  })

  it('keeps attempt tier, best, claimed components and incremental rewards truthful on replays', () => {
    const silver = receiptFor(1)
    const silverToPlatinum = receiptFor(5, silver.ledger, 'replay').receipt
    const silverReplayHtml = render(silverToPlatinum)
    expect(text(silverReplayHtml)).toContain(RECEIPT_UI.newPostcards(3))
    expect(silverReplayHtml).toContain(`${RECEIPT_UI.alreadyEarnedLabel}:`)
    expect(silverReplayHtml).toContain(RECEIPT_UI.rewardSpin)
    expect(silverReplayHtml).toContain(RECEIPT_UI.bestChange(RECEIPT_UI.silver, RECEIPT_UI.platinum))

    const gold = receiptFor(4)
    const goldToPlatinum = receiptFor(5, gold.ledger, 'replay').receipt
    const goldReplayHtml = render(goldToPlatinum)
    expect(text(goldReplayHtml)).toContain(RECEIPT_UI.newPostcards(2))
    expect(goldReplayHtml).toContain(RECEIPT_UI.bestChange(RECEIPT_UI.gold, RECEIPT_UI.platinum))

    const platinum = receiptFor(5)
    const repeatedPlatinum = receiptFor(5, platinum.ledger, 'replay').receipt
    const replayHtml = render(repeatedPlatinum)
    expect(text(replayHtml)).toContain(RECEIPT_UI.newPostcards(0))
    expect(replayHtml).toContain(`${RECEIPT_UI.alreadyEarnedLabel}:`)
    expect(replayHtml.match(/class="receipt-reward-amount">1 ×<\/span>/g)).toHaveLength(2)
    expect(replayHtml).toContain(RECEIPT_UI.rewardSpin)
    expect(replayHtml).toContain(RECEIPT_UI.rewardSolved)
    expect(replayHtml).toContain('class="receipt-reward-amount">2 ×</span>')
    expect(replayHtml).toContain(RECEIPT_UI.rewardTranslated)
    expect(replayHtml).toContain(RECEIPT_UI.platinum)

    const lowerReplay = receiptFor(3, platinum.ledger, 'replay').receipt
    const lowerReplayHtml = render(lowerReplay)
    expect(lowerReplayHtml).toContain(RECEIPT_UI.bronze)
    expect(lowerReplayHtml).toContain(RECEIPT_UI.platinum)
    expect(lowerReplayHtml).toContain(`${RECEIPT_UI.personalBest}:</span> ${RECEIPT_UI.platinum}`)
  })

  it('renders the same immutable facts after a persisted receipt is reloaded', () => {
    const receipt = receiptFor(5).receipt
    const reloaded = JSON.parse(JSON.stringify(receipt)) as CompletionReceipt
    expect(render(reloaded)).toBe(render(receipt))
  })

  it('does not present an A1 completed loss as solved or ranked', () => {
    for (const index of [0, 3] as const) {
      const source = receiptFor(index).receipt
      const receipt = { ...source, completedLoss: true, previousBest: null, newBest: null,
        rewards: { ...source.rewards, eligible: [], newlyClaimed: [], alreadyHeld: [], postcards: 0 } } as CompletionReceipt
      const html = render(receipt)
      expect(html).toContain(RECEIPT_UI.tier)
      expect(html).toContain(RECEIPT_UI.bronze)
      expect(html).toContain(RECEIPT_UI.participationOnly)
      expect(html).toContain(RECEIPT_UI.noRewards)
      expect(html).not.toContain(RECEIPT_UI.rewardSolved)
      expect(html).not.toContain(RECEIPT_UI.rewardTranslated)
      expect(text(html)).toContain(RECEIPT_UI.newPostcards(0))
      expect(html).not.toContain('receipt-best')
      expect(receipt).toMatchObject({ previousBest: null, newBest: null, rewards: { postcards: 0 } })
    }
  })

  it('shows a receipt-created lesson invitation as a secondary Guide action without scheduling anything', () => {
    const receipt = {
      ...receiptFor(5).receipt,
      lessons: {
        courseId: 'da',
        curriculum: { before: null, after: { itemStates: { 'sonderborg-notice': 'offered' } } },
        survival: { before: null, after: { exchanges: { 'sonderborg-situation-1': { unlockedAt: 1, replayedAt: [] } } } },
      } as never,
    }
    const html = renderToStaticMarkup(<ReceiptLessonOfferActions receipt={receipt} onOpen={() => { throw new Error('presentation must not schedule') }} />)
    expect(html).toContain(UI.game.resultLesson)
    expect(html).toContain(UI.game.resultOpenGrammar)
    expect(html).toContain(UI.game.resultOpenSurvival)
  })
})
