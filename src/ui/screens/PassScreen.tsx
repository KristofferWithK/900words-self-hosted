import { useEffect } from 'react'
import { PASS_PRODUCTS, type PassProductKind } from '../../purchase/pass'
import { usePass } from '../../purchase/passStore'
import { useUi } from '../../stores/uiStore'
import { feedbackTravelAllowed } from '../../build/audience'
import { UI } from '../../i18n'
import { ClueyFace } from '../components/Cluey'

const PRICE_COPY: Record<PassProductKind, string> = {
  monthly: UI.home.passPriceMonthly,
  lifetime: UI.home.passPriceLifetime,
}

/** The owner's address, not copy: it is the same in every language. */
const REVIEW_EMAIL = 'Kristoffer.kai@pm.me'

function priceFor(id: string, fallback: string, offers: readonly { id: string; displayPrice: string }[]) {
  return offers.find((offer) => offer.id === id)?.displayPrice ?? fallback
}

/** The StoreKit route screen and the dismissible daily-limit upgrade dialog. */
export function PassScreen() {
  const { status, offers, message, thanked, refresh, purchase, restore, redeemCode, dismissThanks } = usePass()
  const dailyLimitOpen = useUi((s) => s.dailyLimitOpen)
  const close = useUi((s) => s.closeDailyLimit)
  const retryDailyLimit = useUi((s) => s.dailyLimitRetry)
  const goTo = useUi((s) => s.goTo)
  const feedbackBuild = feedbackTravelAllowed()

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
    const dailyOption = (kind: PassProductKind, title: string, detail: string) => {
      const price = offers.find((offer) => offer.id === PASS_PRODUCTS[kind])?.displayPrice
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
          <p className="pass-kicker">{UI.home.dailyLimitKicker}</p>
          <h2 id="daily-limit-heading">{UI.home.dailyLimitHeading}</h2>
          <p>{UI.home.dailyLimitBody}</p>
          <div className="pass-options" aria-label={UI.home.dailyLimitOptionsAria}>
            {dailyOption('monthly', UI.home.dailyLimitMonthly, UI.home.dailyLimitMonthlyHelp)}
            {dailyOption('lifetime', UI.home.dailyLimitLifetime, UI.home.dailyLimitLifetimeHelp)}
          </div>
          {message && <p role="status" className={status === 'error' ? 'test-fail' : 'pass-note'}>{message}</p>}
          <button className="btn btn-quiet" disabled={isBusy} onClick={() => void restore()}>{UI.home.dailyLimitRestore}</button>
          <button className="btn btn-quiet" disabled={isBusy} onClick={() => void redeemCode()}>{UI.home.passRedeem}</button>
          <button className="btn btn-quiet" onClick={dismiss}>{UI.home.dailyLimitDismiss}</button>
          <small>{UI.home.dailyLimitDisclosure}</small>
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
            <b>{priceFor(PASS_PRODUCTS.monthly, PRICE_COPY.monthly, offers)}</b>
          </button>
          <button className="pass-option" disabled={isBusy} onClick={() => buy('lifetime')}>
            <span>
              <strong>{UI.home.passLifetime}</strong>
              <small>{UI.home.passLifetimeHelp}</small>
            </span>
            <b>{priceFor(PASS_PRODUCTS.lifetime, PRICE_COPY.lifetime, offers)}</b>
          </button>
        </div>

        {status === 'entitled' && <p className="test-ok">{UI.home.passReady}</p>}
        {message && <p className={status === 'error' ? 'test-fail' : 'pass-note'}>{message}</p>}

        <div className="pass-actions">
          <button className="btn btn-quiet" disabled={isBusy} onClick={() => void restore()}>
            {UI.home.passRestore}
          </button>
          <button className="btn btn-quiet" disabled={isBusy} onClick={() => void redeemCode()}>
            {UI.home.passRedeem}
          </button>
        </div>

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
