import { useEffect, useRef, useState } from 'react'
import {
  billingPlatform,
  manageSubscriptionUrl,
  passProducts,
  storeDisplayPrice,
  type BillingPlatform,
  type PassOffer,
  type PassPlan,
  type PassProductKind,
} from '../../purchase/pass'
import { selectPlan, usePass } from '../../purchase/passStore'
import { UI } from '../../i18n'
import { PurchaseLegalLinks } from '../screens/PassScreen'
import { Tag } from './Tag'

/**
 * "Your plan": what the player has bought, and the store's own ways to change
 * it (KristoffersRoom/subscription-compliance-2026-10-04.md, section 3). The
 * owner picked layout C (2026-10-04): a Free / Unlimited chip beside the
 * Settings title, and a plain section lower in Settings with the actions.
 *
 * Google Play's subscriptions policy requires a link to manage and cancel the
 * subscription in Settings; Apple asks for Restore and recommends its own
 * manage sheet. Neither store can turn the monthly plan into the one-time
 * purchase, so "Switch" says so before it sells anything.
 *
 * Shown only where a store sells Unlimited (billingPlatform() is not null):
 * never on the web, the website demo or a self-hosted build.
 */

/** The plan, held steady while a purchase, a restore or a foreground check is in flight. */
export function useYourPlan() {
  const pass = usePass()
  const platform = billingPlatform()
  const live = selectPlan(pass, platform)
  const settled = useRef<PassPlan>(live)
  if (live !== 'checking') settled.current = live
  const plan: PassPlan = live === 'checking' ? settled.current : live
  return {
    plan,
    busy: live === 'checking',
    platform,
    googlePlay: platform === 'android',
    offers: pass.offers,
    message: pass.message,
    messageIsError: pass.status === 'error',
    purchase: pass.purchase,
    restore: pass.restore,
    redeemCode: pass.redeemCode,
    manageSubscription: pass.manageSubscription,
  }
}

/** Only where something is sold. */
export function yourPlanApplies(): boolean {
  return billingPlatform() !== null
}

/** "Free" or "Unlimited"; nothing while the store has not answered. */
export function planShortLabel(plan: PassPlan): string | null {
  if (plan === 'free') return UI.settings.planFreeShort
  if (plan === 'monthly' || plan === 'lifetime' || plan === 'both') return UI.settings.planUnlimitedShort
  return null
}

export function planSentence(plan: PassPlan, googlePlay: boolean): string {
  switch (plan) {
    case 'free': return UI.settings.planFree
    case 'monthly': return UI.settings.planMonthly
    case 'lifetime': return UI.settings.planLifetime
    case 'both': return UI.settings.planBoth
    case 'error': return googlePlay ? UI.settings.planErrorPlay : UI.settings.planError
    case 'checking':
    case 'unavailable':
    default: return googlePlay ? UI.settings.planCheckingPlay : UI.settings.planChecking
  }
}

const unlimited = (plan: PassPlan) => plan === 'monthly' || plan === 'lifetime' || plan === 'both'

/**
 * Google Play's subscription page is a real link (the policy's word), handed
 * to the system browser and on to the Play Store by target=_blank, drawn as
 * the same luggage tag as the buttons around it (Tag.tsx; a Tag itself is a
 * <button>). On iOS it is Apple's own sheet, with Apple's page as the fallback.
 */
export function ManageSubscriptionAction({ primary = false }: { primary?: boolean }) {
  const { platform, busy, manageSubscription } = useYourPlan()
  const tone = primary ? 'primary' : 'plain'
  if (platform === 'android') {
    return (
      <a
        className={`tag tag-wide${primary ? ' tag-primary' : ''} your-plan-manage`}
        href={manageSubscriptionUrl('android') ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="tag-hole" aria-hidden="true" />
        <span className="tag-text"><span className="tag-label">{UI.settings.planManage}</span></span>
      </a>
    )
  }
  return (
    <Tag
      size="wide"
      tone={tone}
      className="your-plan-manage"
      disabled={busy}
      onClick={() => void manageSubscription()}
      label={UI.settings.planManage}
    />
  )
}

/** One store product as an offer, the same button the daily-limit dialog uses. */
function PlanOffer({
  kind,
  offers,
  platform,
  busy,
  onChoose,
}: {
  kind: PassProductKind
  offers: readonly PassOffer[]
  platform: BillingPlatform | null
  busy: boolean
  onChoose: () => void
}) {
  // The store's own string or nothing (the storeDisplayPrice rule of #355).
  const price = storeDisplayPrice(offers, passProducts(platform)[kind])
  const title = kind === 'monthly' ? UI.home.dailyLimitMonthly : UI.home.dailyLimitLifetime
  const detail = kind === 'monthly' ? UI.home.dailyLimitMonthlyHelp : UI.home.dailyLimitLifetimeHelp
  return (
    <button className="pass-option" disabled={busy || !price} onClick={onChoose}>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <b>{price ?? UI.home.dailyLimitUnavailable}</b>
    </button>
  )
}

/** The two offers, the store's disclosure, and Terms/Privacy, as everywhere a purchase is offered. */
function PlanOffers({ onDone }: { onDone: () => void }) {
  const { offers, platform, busy, googlePlay, purchase } = useYourPlan()
  return (
    <div className="your-plan-offers">
      <div className="pass-options" aria-label={UI.home.dailyLimitOptionsAria}>
        <PlanOffer kind="monthly" offers={offers} platform={platform} busy={busy} onChoose={() => void purchase('monthly')} />
        <PlanOffer kind="lifetime" offers={offers} platform={platform} busy={busy} onChoose={() => void purchase('lifetime')} />
      </div>
      <small className="settings-note">{googlePlay ? UI.home.dailyLimitDisclosurePlay : UI.home.dailyLimitDisclosure}</small>
      <PurchaseLegalLinks googlePlay={googlePlay} />
      <Tag size="wide" onClick={onDone} label={UI.settings.planNotNow} />
    </div>
  )
}

/**
 * Monthly to one-time. Neither store converts one into the other and the app
 * cannot cancel the subscription, so the note comes first and says so plainly.
 */
function SwitchNote({ onClose }: { onClose: () => void }) {
  const { offers, platform, busy, googlePlay, purchase } = useYourPlan()
  const price = storeDisplayPrice(offers, passProducts(platform).lifetime)
  return (
    <div className="your-plan-switch" role="group" aria-label={UI.settings.planSwitch}>
      <p className="settings-note">{googlePlay ? UI.settings.planSwitchNotePlay : UI.settings.planSwitchNote}</p>
      <Tag
        size="wide"
        tone="primary"
        disabled={busy || !price}
        onClick={() => void purchase('lifetime')}
        label={price ? UI.settings.planBuyFor(price) : UI.home.dailyLimitUnavailable}
      />
      <Tag size="wide" disabled={busy} onClick={onClose} label={UI.settings.planNotNow} />
      <PurchaseLegalLinks googlePlay={googlePlay} />
    </div>
  )
}

/** Restore, and on iOS while free, Apple's code sheet. */
function QuietActions({ plan }: { plan: PassPlan }) {
  const { busy, googlePlay, restore, redeemCode } = useYourPlan()
  if (plan === 'checking' || plan === 'unavailable') return null
  return (
    <div className="your-plan-quiet">
      <Tag size="wide" disabled={busy} onClick={() => void restore()} label={UI.home.dailyLimitRestore} />
      {plan === 'free' && !googlePlay && (
        <Tag size="wide" disabled={busy} onClick={() => void redeemCode()} label={UI.home.passRedeem} />
      )}
    </div>
  )
}

/**
 * The section lower in Settings: the plan in one sentence, then one to three
 * actions. The Free / Unlimited word is the chip's job (YourPlanChip).
 * Opening Settings reads the plan from the store again.
 */
export function YourPlanSection() {
  const refresh = usePass((s) => s.refresh)
  useEffect(() => {
    if (yourPlanApplies()) void refresh()
  }, [refresh])
  const { plan, googlePlay, message, messageIsError } = useYourPlan()
  const [panel, setPanel] = useState<'none' | 'offers' | 'switch'>('none')
  // A purchase that worked (or a plan that changed under the panel) closes it.
  useEffect(() => {
    if (panel === 'offers' && plan !== 'free') setPanel('none')
    if (panel === 'switch' && plan !== 'monthly') setPanel('none')
  }, [panel, plan])
  if (!yourPlanApplies()) return null
  return (
    <section className="settings-section your-plan" data-testid="your-plan-settings" data-plan={plan}>
      <h3>{UI.settings.planHeading}</h3>
      <p className={plan === 'error' ? 'test-fail' : 'settings-note'} role="status">{planSentence(plan, googlePlay)}</p>
      {message && <p role="alert" className={messageIsError ? 'test-fail' : 'pass-note'}>{message}</p>}
      {panel === 'offers' ? (
        <PlanOffers onDone={() => setPanel('none')} />
      ) : panel === 'switch' ? (
        <SwitchNote onClose={() => setPanel('none')} />
      ) : (
        <>
          {plan === 'free' && (
            <Tag size="wide" tone="primary" onClick={() => setPanel('offers')} label={UI.settings.planGetUnlimited} />
          )}
          {(plan === 'monthly' || plan === 'both') && <ManageSubscriptionAction primary={plan === 'both'} />}
          {plan === 'monthly' && (
            <Tag size="wide" onClick={() => setPanel('switch')} label={UI.settings.planSwitch} />
          )}
          <QuietActions plan={plan} />
        </>
      )}
    </section>
  )
}

/** Free or Unlimited, beside the Settings title. The section below it refreshes the plan. */
export function YourPlanChip() {
  const { plan } = useYourPlan()
  if (!yourPlanApplies()) return null
  const label = planShortLabel(plan)
  if (!label) return null
  return (
    <span
      className={`experimental-tag your-plan-chip${unlimited(plan) ? ' is-unlimited' : ''}`}
      role="status"
      aria-label={UI.settings.planChipAria(label)}
      data-testid="your-plan-chip"
    >
      {label}
    </span>
  )
}
