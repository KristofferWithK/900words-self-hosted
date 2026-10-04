import { useEffect } from 'react'
import { billingPlatform, passProducts, storeDisplayPrice, type PassProductKind } from '../../purchase/pass'
import { usePass } from '../../purchase/passStore'
import { dailyAllowance, dailyLimitKind, type DailyAllowance, type DailyLimitKind } from '../../purchase/dailyGames'
import { useUi } from '../../stores/uiStore'
import { feedbackTravelAllowed } from '../../build/audience'
import { UI } from '../../i18n'
import { ClueyFace } from '../components/Cluey'
import { Tag } from '../components/Tag'

/** The owner's address, not copy: it is the same in every language. */
const REVIEW_EMAIL = 'Kristoffer.kai@pm.me'

/**
 * App Review guideline 3.1.2 requires working links to the Terms of Use (EULA)
 * and the privacy policy wherever a subscription is offered. The terms are
 * Apple's Standard EULA; the privacy policy is the hosted copy of
 * public/privacy.html, the same URL as the App Store listing. Apple's EULA
 * means nothing to a Google Play purchase, so Android shows the privacy policy
 * alone; Google Play's own terms govern its purchases.
 */
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
const PRIVACY_URL = 'https://900words.app/app-privacy/'

/** Capacitor hands a _blank link to the system browser, so the game stays where it was. */
export function PurchaseLegalLinks({ googlePlay }: { googlePlay: boolean }) {
  return (
    <p className="purchase-legal">
      {!googlePlay && <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">{UI.home.purchaseTerms}</a>}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{UI.home.purchasePrivacy}</a>
    </p>
  )
}

/**
 * The pass route screen and the dismissible daily-limit upgrade dialog. Prices
 * and products come from this device's store; Apple-only pieces (the offer-code
 * sheet, Apple's EULA, Apple's wording) never appear on Android. A price is
 * only ever the store's own localized string (storeDisplayPrice); until the
 * store returns one, both surfaces say "Unavailable" rather than a price the
 * app made up (the route screen used to show "1.99 / month", a stale number
 * with no currency).
 */
export function PassScreen() {
  const { status, offers, message, thanked, refresh, purchase, restore, redeemCode, dismissThanks } = usePass()
  const dailyLimitOpen = useUi((s) => s.dailyLimitOpen)
  const close = useUi((s) => s.closeDailyLimit)
  const retryDailyLimit = useUi((s) => s.dailyLimitRetry)
  const goTo = useUi((s) => s.goTo)
  const feedbackBuild = feedbackTravelAllowed()
  const googlePlay = billingPlatform() === 'android'
  const products = passProducts()

  useEffect(() => {
    if (!feedbackBuild) void refresh()
  }, [feedbackBuild, refresh])
  useEffect(() => {
    if (feedbackBuild) goTo('map')
  }, [feedbackBuild, goTo])
  useEffect(() => {
    // A fresh purchase keeps the dialog up for the thank-you, whose button
    // then starts the game the limit stopped.
    if (dailyLimitOpen && status === 'entitled' && !thanked) close()
  }, [dailyLimitOpen, status, thanked, close])
  useEffect(() => {
    if (!dailyLimitOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dailyLimitOpen, close])

  if (feedbackBuild) return null

  const isBusy = status === 'checking'
  const buy = (kind: PassProductKind) => void purchase(kind)
  const dismiss = () => close()

  if (thanked) {
    const keepPlaying = () => {
      dismissThanks()
      if (!dailyLimitOpen) return
      const started = retryDailyLimit?.() ?? false
      close()
      if (started) goTo('game')
    }
    return <PassThanks onContinue={keepPlaying} />
  }

  if (dailyLimitOpen) {
    const limit = dailyLimitWords()
    const dailyOption = (kind: PassProductKind, title: string, detail: string) => {
      const price = storeDisplayPrice(offers, products[kind])
      return (
        <button className="pass-option" disabled={isBusy || !price} onClick={() => buy(kind)}>
          <span><strong>{title}</strong><small>{detail}</small></span>
          <b>{price ?? UI.home.dailyLimitUnavailable}</b>
        </button>
      )
    }
    return (
      <div className="daily-limit-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss() }}>
        <section className="daily-limit-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-limit-heading">
          <button type="button" className="icon-btn daily-limit-close" aria-label={UI.home.dailyLimitCloseAria} onClick={dismiss}>×</button>
          <ClueyFace className="daily-limit-casey" />
          <p className="pass-kicker" data-limit={limit.kind}>{limit.kicker}</p>
          <h2 id="daily-limit-heading">{UI.home.dailyLimitHeading}</h2>
          <p>
            {limit.stillOpen && <><span className="daily-limit-still">{limit.stillOpen}</span>{' '}</>}
            {UI.home.dailyLimitBody}
          </p>
          <div className="pass-options" aria-label={UI.home.dailyLimitOptionsAria}>
            {dailyOption('monthly', UI.home.dailyLimitMonthly, UI.home.dailyLimitMonthlyHelp)}
            {dailyOption('lifetime', UI.home.dailyLimitLifetime, UI.home.dailyLimitLifetimeHelp)}
          </div>
          {message && <p role="status" className={status === 'error' ? 'test-fail' : 'pass-note'}>{message}</p>}
          <div className="daily-limit-secondary">
            <Tag className="daily-limit-restore" disabled={isBusy} onClick={() => void restore()} label={UI.home.dailyLimitRestore} />
            {!googlePlay && <Tag className="daily-limit-redeem" disabled={isBusy} onClick={() => void redeemCode()} label={UI.home.passRedeem} />}
          </div>
          <Tag className="daily-limit-dismiss" onClick={dismiss} label={UI.home.dailyLimitDismiss} />
          <small>{googlePlay ? UI.home.dailyLimitDisclosurePlay : UI.home.dailyLimitDisclosure}</small>
          <PurchaseLegalLinks googlePlay={googlePlay} />
        </section>
      </div>
    )
  }

  return (
    <div className="screen pass-screen">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.home.passBackAria} onClick={() => goTo('map')}>←</button>
        <h1>{UI.home.passTitle}</h1>
      </header>

      <div className="pass-body">
        <p className="pass-kicker">{UI.home.passKicker}</p>
        <h2>{UI.home.passHeading}</h2>
        <p>{UI.home.passIntro}</p>

        <div className="pass-options" aria-label={UI.home.passOptionsAria}>
          <button className="pass-option" disabled={isBusy} onClick={() => buy('monthly')}>
            <span>
              <strong>{UI.home.passMonthly}</strong>
              <small>{UI.home.passMonthlyHelp}</small>
            </span>
            <b>{storeDisplayPrice(offers, products.monthly) ?? UI.home.dailyLimitUnavailable}</b>
          </button>
          <button className="pass-option" disabled={isBusy} onClick={() => buy('lifetime')}>
            <span>
              <strong>{UI.home.passLifetime}</strong>
              <small>{UI.home.passLifetimeHelp}</small>
            </span>
            <b>{storeDisplayPrice(offers, products.lifetime) ?? UI.home.dailyLimitUnavailable}</b>
          </button>
        </div>

        {status === 'entitled' && <p className="test-ok">{UI.home.passReady}</p>}
        {message && <p className={status === 'error' ? 'test-fail' : 'pass-note'}>{message}</p>}

        <div className="pass-actions">
          <button className="btn btn-quiet" disabled={isBusy} onClick={() => void restore()}>
            {UI.home.passRestore}
          </button>
          {!googlePlay && (
            <button className="btn btn-quiet" disabled={isBusy} onClick={() => void redeemCode()}>
              {UI.home.passRedeem}
            </button>
          )}
        </div>
        <PurchaseLegalLinks googlePlay={googlePlay} />

        <aside className="pass-kindness">
          <h3>{UI.home.passKindness}</h3>
          <p>
            {UI.home.passReviewBefore}{' '}
            <a href={`mailto:${REVIEW_EMAIL}`}>{REVIEW_EMAIL}</a>{' '}
            {UI.home.passReviewAfter}
          </p>
        </aside>
      </div>
    </div>
  )
}

/**
 * What the daily-limit dialog says about today (CW-15): which free limit was
 * reached (two walks, two café puzzles, or both) and, when only one was, how
 * many of the other kind are still free today. Read from today's counts when
 * the dialog draws (a read that writes nothing), so whatever opened it, it
 * says what is true now; when the counts cannot be read it only says what
 * the free plan is.
 */
export function dailyLimitWords(allowance?: DailyAllowance): { kind: DailyLimitKind; kicker: string; stillOpen: string | null } {
  let today: DailyAllowance | null = allowance ?? null
  if (!today) {
    try { today = dailyAllowance() } catch { today = null }
  }
  const kind: DailyLimitKind = today ? dailyLimitKind(today) : 'unknown'
  if (kind === 'runs' && today) {
    return { kind, kicker: UI.home.dailyLimitRunsKicker, stillOpen: UI.home.dailyLimitPuzzlesLeft(today.puzzles.limit - today.puzzles.used) }
  }
  if (kind === 'puzzles' && today) {
    return { kind, kicker: UI.home.dailyLimitPuzzlesKicker, stillOpen: UI.home.dailyLimitRunsLeft(today.runs.limit - today.runs.used) }
  }
  if (kind === 'both') return { kind, kicker: UI.home.dailyLimitBothKicker, stillOpen: null }
  // Counts that cannot be read, or a new day under the open dialog: no claim about today.
  return { kind: 'unknown', kicker: UI.home.dailyLimitKicker, stillOpen: null }
}

/**
 * Whether App draws the daily-limit dialog (CW-15): when it is open, over any
 * screen but the pass route (which is the offer itself). Over a replayed
 * intro too, whose walk and board are real and may be refused; never over a
 * first session (`persist`), which is not interrupted by an offer.
 */
export function dailyLimitDialogShown(onboarding: { readonly persist: boolean } | null, open: boolean, screen: string): boolean {
  return open && screen !== 'pass' && !onboarding?.persist
}

/** Casey's thank-you, over whatever screen the ticket arrived on. */
export function PassThanks({ onContinue }: { onContinue?: () => void }) {
  const dismissThanks = usePass((s) => s.dismissThanks)
  const done = onContinue ?? dismissThanks
  return (
    <div className="daily-limit-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) done() }}>
      <section className="daily-limit-dialog pass-thanks-dialog" role="dialog" aria-modal="true" aria-labelledby="pass-thanks-heading">
        <ClueyFace mood="happy" className="pass-thanks-casey" />
        <h2 id="pass-thanks-heading">{UI.home.passThanksHeading}</h2>
        <p>{UI.home.passThanksBody}</p>
        <button className="btn btn-primary" autoFocus onClick={done}>{UI.home.passThanksContinue}</button>
      </section>
    </div>
  )
}
