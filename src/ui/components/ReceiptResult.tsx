import type { CompletionReceipt, RewardComponent, Tier } from '../../progression/types'
import { RECEIPT_UI } from '../../i18n/receipt'
import { CafeStamp } from './CafeStamp'
import type { FinishStamp } from './finishStamp'

const tierLabel = (tier: Tier) => ({
  bronze: RECEIPT_UI.bronze,
  silver: RECEIPT_UI.silver,
  gold: RECEIPT_UI.gold,
  platinum: RECEIPT_UI.platinum,
})[tier]

const componentLabel = (component: RewardComponent) => ({
  spinWin: RECEIPT_UI.rewardSpin,
  solved: RECEIPT_UI.rewardSolved,
  solvedAndTranslated: RECEIPT_UI.rewardTranslated,
})[component]

function Tick() {
  return <svg viewBox="0 0 16 16" className="receipt-tick-mark" aria-hidden="true" focusable="false">
    <path d="M2.6 8.6l3.6 3.6 7.2-8.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

/**
 * The stamp line: the café's stamp in its ink, and what this round did to it.
 * A new or raised stamp lands (the press animation is one CSS block in
 * styles/92-finish-screen.css, `data-stamp-state="new"`); a kept stamp is
 * simply there. A lost first visit lands Bronze, because a completed loss
 * earns a Bronze stamp (owner, 4 October 2026).
 */
function StampLine({ stamp, fallbackTier }: { readonly stamp: FinishStamp | null; readonly fallbackTier: Tier | null }) {
  if (!stamp) {
    // Not a café of the city's stamp card (a later city, a board outside the
    // required set): no stamp to give, so the attempt's tier is said plainly.
    return <div className="receipt-stamp" data-stamp-state="none">
      <CafeStamp tier={null} className="receipt-stamp-glyph" />
      <p className="receipt-stamp-text">
        <strong className="receipt-stamp-title">{RECEIPT_UI.noNewStamp}</strong>
        {fallbackTier && <span className="receipt-stamp-card">{RECEIPT_UI.tier} · {tierLabel(fallbackTier)}</span>}
      </p>
    </div>
  }
  const title = stamp.state === 'new' ? RECEIPT_UI.stamp(stamp.tier) : RECEIPT_UI.noNewStamp
  const line = stamp.state === 'new' ? RECEIPT_UI.stampOnCard(stamp.cafeName) : RECEIPT_UI.stampKept(stamp.cafeName, stamp.tier)
  return <div className="receipt-stamp" data-stamp-state={stamp.state} data-stamp-tier={stamp.tier}>
    <CafeStamp tier={stamp.tier} ring={RECEIPT_UI.stampRing[stamp.tier]} className="receipt-stamp-glyph" />
    <p className="receipt-stamp-text">
      <strong className="receipt-stamp-title">{title}</strong>
      <span className="receipt-stamp-card">{line}</span>
    </p>
  </div>
}

/**
 * Presentation-only projection of the settlement receipt. It deliberately
 * has no store writes or callbacks: settlement is complete before this screen
 * is mounted, and revisiting it can therefore never mint a reward.
 *
 * The café world's finish screen (docs/roadmap/cafe-world.md section 6): the
 * round's result lines as ticks, then the café's stamp where the postcard
 * total was, with the city's percentage beside it. `stamp` is worked out by
 * `finishStamp` from the CW-03 rules; this component decides nothing.
 */
export function ReceiptResult({ receipt, stamp = null, cityName = null }: {
  readonly receipt: CompletionReceipt
  readonly stamp?: FinishStamp | null
  readonly cityName?: string | null
}) {
  const loss = receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost'
  const hasOutcome = loss || receipt.evidence.game.outcome?.result === 'won'
  // What this round did, ticked: the receipt's eligible components, whether or
  // not an earlier round already earned them. A completed loss has none.
  const ticks = loss ? [] : receipt.rewards.eligible
  return <section className="receipt-result" aria-label={RECEIPT_UI.title} data-tier-lesson={receipt.evidence.origin === 'primary' || receipt.evidence.origin === 'replay' ? 'normal' : undefined}>
    {ticks.length > 0 && <ul className="receipt-reward-list receipt-ticks" aria-label={RECEIPT_UI.roundTicks}>
      {ticks.map(component => <li className="receipt-tick" data-reward={component} key={component}>
        <Tick />
        <span className="receipt-reward-name">{componentLabel(component)}</span>
      </li>)}
    </ul>}
    <div className="receipt-result-summary">
      <StampLine stamp={stamp} fallbackTier={hasOutcome && !loss ? receipt.attemptTier : null} />
      {stamp && <p className="receipt-city-percent" data-city-medal={stamp.cityMedal ?? 'none'}>
        <strong className="receipt-city-percent-n">{RECEIPT_UI.cityPercent(stamp.cityPercent)}</strong>
        {cityName && <span className="receipt-city-percent-label">{RECEIPT_UI.ofCity(cityName)}</span>}
      </p>}
    </div>
  </section>
}
