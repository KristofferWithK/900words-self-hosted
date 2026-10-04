import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { acknowledgeEffect, emptySettlementLedger, prepareSettlement } from '../../progression/settlement'
import { FIXTURE_CONTENT, FIXTURE_SET, MATRIX_FIXTURES, attemptFixture, settlementFixture } from '../../progression/fixtures'
import type { CompletionReceipt, LearningEffect } from '../../progression/types'
import { ReceiptResult } from './ReceiptResult'
import { ReceiptLessonOfferActions } from './RoundSummary'
import { finishStamp, type FinishStamp } from './finishStamp'
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

type Settled = { receipt: CompletionReceipt; ledger: ReturnType<typeof emptySettlementLedger> }

function receiptFor(index: number, ledger = emptySettlementLedger(), origin: 'primary' | 'replay' = 'primary'): Settled {
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

const CAFE = 'Café Solen'
/** The stamp line as the finish screen works it out, with a café name. */
const stampFor = ({ receipt, ledger }: Settled, cafeName: string | null = CAFE): FinishStamp =>
  ({ ...finishStamp(receipt, ledger.facts, FIXTURE_SET)!, cafeName })

const render = (receipt: CompletionReceipt, stamp: FinishStamp | null = null) =>
  renderToStaticMarkup(<ReceiptResult receipt={receipt} stamp={stamp} cityName="Sønderborg" />)
// Read the line as text: the title and its card line are separate elements.
const text = (html: string) => html.replace(/<[^>]+>/g, '')

/** Matrix indexes: 1 Silver, 4 Gold, 5 Platinum (wins); 0 and 3 are completed losses. */
describe('ReceiptResult', () => {
  it('ticks the result lines, then shows the stamp beside the city percentage, and no postcards', () => {
    const settled = receiptFor(5)
    const html = render(settled.receipt, stampFor(settled))
    for (const reward of [RECEIPT_UI.rewardSpin, RECEIPT_UI.rewardSolved, RECEIPT_UI.rewardTranslated]) expect(html).toContain(reward)
    expect(html.match(/class="receipt-tick"/g)).toHaveLength(3)
    expect(html.match(/class="receipt-tick-mark"/g)).toHaveLength(3)
    expect(html).toContain('data-stamp-state="new"')
    expect(html).toContain('data-stamp-tier="platinum"')
    expect(html).toContain('cafe-stamp cafe-stamp-platinum receipt-stamp-glyph')
    expect(text(html)).toContain(RECEIPT_UI.stamp('platinum'))
    expect(text(html)).toContain(RECEIPT_UI.stampOnCard(CAFE))
    expect(text(html)).toContain('Platinum stamp')
    expect(text(html)).toContain('on your Café Solen card')
    expect(text(html)).toContain(`${RECEIPT_UI.cityPercent(100)}${RECEIPT_UI.ofCity('Sønderborg')}`)
    expect(html).toContain('data-city-medal="platinum"')
    expect(html.indexOf('receipt-reward-list')).toBeLessThan(html.indexOf('receipt-stamp'))
    expect(html.indexOf('receipt-stamp')).toBeLessThan(html.indexOf('receipt-city-percent'))
    // Postcard numbers and the old tier block are gone from this screen.
    expect(text(html)).not.toMatch(/postcard/i)
    expect(text(html)).not.toMatch(/\+\d/)
    for (const retired of ['receipt-postcard', 'receipt-tier-summary', 'receipt-reward-amount', 'receipt-best']) expect(html).not.toContain(retired)
    expect(html).not.toContain('all neutral')
  })

  it('draws every tier in its own ink with its own words', () => {
    for (const [index, tier] of [[1, 'silver'], [4, 'gold'], [5, 'platinum']] as const) {
      const settled = receiptFor(index)
      const html = render(settled.receipt, stampFor(settled))
      expect(html).toContain(`cafe-stamp-${tier}`)
      expect(html).toContain(`data-stamp-tier="${tier}"`)
      expect(text(html)).toContain(RECEIPT_UI.stamp(tier))
      expect(html).toContain(RECEIPT_UI.stampRing[tier].toLocaleUpperCase())
    }
    // Bronze is never earned by a win under G1 A1 (a Bronze attempt is a
    // completed loss); it reaches this screen as a café's kept stamp from an
    // older save, in its own ink.
    const lost = receiptFor(0)
    const keptBronze: FinishStamp = { state: 'kept', tier: 'bronze', cafeName: CAFE, cityPercent: 0, cityMedal: null }
    const html = render(lost.receipt, keptBronze)
    expect(html).toContain('cafe-stamp-bronze')
    expect(text(html)).toContain(RECEIPT_UI.stampKept(CAFE, 'bronze'))
    expect(text(html)).toContain('Your Café Solen card keeps its Bronze stamp')
  })

  it('says plainly when a replay does not improve the stamp, and ticks what the replay did', () => {
    const platinum = receiptFor(5)
    const lower = receiptFor(1, platinum.ledger, 'replay')
    const html = render(lower.receipt, stampFor(lower))
    expect(html).toContain('data-stamp-state="kept"')
    expect(html).toContain('cafe-stamp-platinum')
    expect(text(html)).toContain(RECEIPT_UI.noNewStamp)
    expect(text(html)).toContain('Your Café Solen card keeps its Platinum stamp')
    expect(html.match(/class="receipt-tick"/g)).toHaveLength(1)
    expect(html).toContain(RECEIPT_UI.rewardSpin)

    const gold = receiptFor(4)
    const sameGold = receiptFor(4, gold.ledger, 'replay')
    expect(text(render(sameGold.receipt, stampFor(sameGold)))).toContain('Your Café Solen card keeps its Gold stamp')

    const raised = receiptFor(5, gold.ledger, 'replay')
    const raisedHtml = render(raised.receipt, stampFor(raised))
    expect(raisedHtml).toContain('data-stamp-state="new"')
    expect(text(raisedHtml)).toContain('Platinum stamp')
  })

  it('lands a Bronze stamp for a lost first visit (CW-03b), whatever tier the attempt reached, and ticks nothing', () => {
    for (const index of [0, 3] as const) {
      const lost = receiptFor(index)
      expect(lost.receipt.completedLoss).toBe(true)
      const html = render(lost.receipt, stampFor(lost))
      expect(html).toContain('data-stamp-state="new"')
      expect(html).toContain('data-stamp-tier="bronze"')
      expect(html).toContain('cafe-stamp-bronze')
      expect(html).not.toContain('cafe-stamp-empty')
      expect(html).not.toContain('receipt-tick')
      expect(text(html)).toContain(`${RECEIPT_UI.stamp('bronze')}${RECEIPT_UI.stampOnCard(CAFE)}`)
      expect(text(html)).toContain('Bronze stamp')
      expect(text(html)).toContain('on your Café Solen card')
      expect(text(html)).not.toContain(RECEIPT_UI.noNewStamp)
      expect(text(html)).toContain(RECEIPT_UI.cityPercent(25))
      expect(html).not.toContain(RECEIPT_UI.rewardSolved)
      expect(text(html)).not.toMatch(/postcard|gold/i)
    }
    // A lost replay of a café that is only Bronze says the card keeps it.
    const bronze = receiptFor(0)
    const lostAgain = receiptFor(3, bronze.ledger, 'replay')
    const again = render(lostAgain.receipt, stampFor(lostAgain))
    expect(again).toContain('data-stamp-state="kept"')
    expect(text(again)).toContain(RECEIPT_UI.noNewStamp)
    expect(text(again)).toContain('Your Café Solen card keeps its Bronze stamp')
    // A lost replay keeps the stamp the café already had.
    const gold = receiptFor(4)
    const lostReplay = receiptFor(0, gold.ledger, 'replay')
    const html = render(lostReplay.receipt, stampFor(lostReplay))
    expect(html).toContain('data-stamp-state="kept"')
    expect(text(html)).toContain('Your Café Solen card keeps its Gold stamp')
  })

  it('speaks of a café without a name yet, and of a round with no stamp card', () => {
    const settled = receiptFor(5)
    expect(text(render(settled.receipt, stampFor(settled, null)))).toContain(RECEIPT_UI.stampOnCard(null))
    const lower = receiptFor(1, settled.ledger, 'replay')
    expect(text(render(lower.receipt, stampFor(lower, null)))).toContain(RECEIPT_UI.stampKept(null, 'platinum'))
    const noCard = render(settled.receipt, null)
    expect(noCard).toContain('data-stamp-state="none"')
    expect(noCard).not.toContain('receipt-city-percent')
    expect(text(noCard)).toContain(RECEIPT_UI.platinum)
  })

  it('renders the same immutable facts after a persisted receipt is reloaded', () => {
    const settled = receiptFor(5)
    const reloaded = JSON.parse(JSON.stringify(settled.receipt)) as CompletionReceipt
    expect(render(reloaded, stampFor(settled))).toBe(render(settled.receipt, stampFor(settled)))
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
