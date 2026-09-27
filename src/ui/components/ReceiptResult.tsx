import type { CompletionReceipt, RewardComponent, Tier } from '../../progression/types'
import { RECEIPT_UI } from '../../i18n/receipt'
import { REWARD_WEIGHTS } from '../../progression/rules'
import { PostcardGlyph } from './PostcardGlyph'

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

/**
 * The postcard line with its number drawn large (owner's mockup, 2026-09-26).
 * The catalogue says the whole phrase in each language, so the number is
 * found inside it rather than the phrase being split into new strings; the
 * text a screen reader or a drive reads is unchanged.
 */
function PostcardCount({ text, count }: { readonly text: string; readonly count: number }) {
  const at = text.indexOf(String(count))
  if (at < 0) return <>{text}</>
  const end = at + String(count).length
  // Keep a leading "+" with the number it belongs to.
  const start = at > 0 && text[at - 1] === '+' ? at - 1 : at
  return <>
    {text.slice(0, start)}
    <span className="receipt-postcards-n">{text.slice(start, end)}</span>
    <span className="receipt-postcards-label">{text.slice(end)}</span>
  </>
}

/**
 * Presentation-only projection of the settlement receipt. It deliberately
 * has no store writes or callbacks: settlement is complete before this screen
 * is mounted, and revisiting it can therefore never mint a reward.
 */
export function ReceiptResult({ receipt }: { readonly receipt: CompletionReceipt }) {
  const rewards = receipt.rewards
  const loss = receipt.completedLoss === true || receipt.evidence.game.outcome?.result === 'lost'
  const hasOutcome = loss || receipt.evidence.game.outcome?.result === 'won'
  const displayTier: Tier = loss ? 'bronze' : receipt.attemptTier
  const personalBest = receipt.previousBest
    ? receipt.newBest && receipt.newBest !== receipt.previousBest
      ? RECEIPT_UI.bestChange(tierLabel(receipt.previousBest), tierLabel(receipt.newBest))
      : tierLabel(receipt.previousBest)
    : receipt.newBest ? RECEIPT_UI.firstBest(tierLabel(receipt.newBest)) : null
  return <section className="receipt-result" aria-label={RECEIPT_UI.title} data-tier-lesson={receipt.evidence.origin === 'primary' || receipt.evidence.origin === 'replay' ? 'normal' : undefined}>
    <ul className="receipt-reward-list" aria-label={RECEIPT_UI.rewards}>
      {rewards.newlyClaimed.map(component => <li className="receipt-reward-new" key={`new-${component}`}>
        <span className="receipt-reward-amount">+{REWARD_WEIGHTS[component]}</span>
        <span className="receipt-reward-name">{componentLabel(component)}</span>
      </li>)}
      {rewards.alreadyHeld.length > 0 && <li className="receipt-reward-held" key="already-earned">
        <span className="receipt-reward-held-label">{RECEIPT_UI.alreadyEarnedLabel}:</span>
        {rewards.alreadyHeld.map((component, index) => <span className="receipt-reward-held-item" key={`held-${component}`}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <span className="receipt-reward-amount">{REWARD_WEIGHTS[component]} ×</span>
          {' '}{componentLabel(component)}
        </span>)}
      </li>}
      {rewards.newlyClaimed.length === 0 && rewards.alreadyHeld.length === 0 && <li className="receipt-no-rewards">{RECEIPT_UI.noRewards}</li>}
    </ul>
    <div className="receipt-result-summary">
      <div className="receipt-postcard-total">
        <PostcardGlyph className="receipt-postcard-glyph" />
        <p className="receipt-postcards"><PostcardCount text={RECEIPT_UI.newPostcards(rewards.postcards)} count={rewards.postcards} /></p>
      </div>
      {hasOutcome && <div className="receipt-tier-summary">
        <span className="receipt-tier-line">
          <span className={`receipt-tier-medal receipt-tier-medal-${displayTier}`} aria-hidden="true" />
          <strong className={`receipt-tier receipt-tier-${displayTier}`}>{tierLabel(displayTier)}</strong>
        </span>
        <span className="receipt-tier-label">{RECEIPT_UI.tier}</span>
        {loss && <span className="receipt-tier-qualifier">{RECEIPT_UI.participationOnly}</span>}
      </div>}
    </div>
    {personalBest && <p className="receipt-best"><span>{RECEIPT_UI.personalBest}:</span> {personalBest}</p>}
  </section>
}
