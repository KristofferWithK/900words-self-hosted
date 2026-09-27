import { ClueyFace } from '../ui/components/Cluey'
import { UI } from '../i18n'

/**
 * Where the website demo ends: after the first full board's finish screen,
 * instead of the app's Home and suitcase. The App Store link is a build-time
 * value; until the owner supplies it, the card says the app is coming.
 */
export function DemoEndAct() {
  const appStoreUrl = __APP_STORE_URL__
  return (
    <div className="screen onboard-screen demo-end" data-act="demo-end">
      <div className="cluey-band tutorial-finish-casey">
        <p className="cluey-bubble tutorial-finish-bubble" role="status">
          {UI.onboarding.demoEndTitle} {UI.onboarding.demoEndLine}
        </p>
        <div className="tutorial-finish-mascot" aria-hidden="true">
          <div className="cluey-live">
            <ClueyFace mood="happy" />
          </div>
        </div>
      </div>
      <div className="demo-end-actions">
        {appStoreUrl ? (
          <a className="btn btn-primary btn-big demo-app-store" href={appStoreUrl} target="_top" rel="noopener">
            {UI.onboarding.demoAppStore}
          </a>
        ) : (
          <p className="demo-app-soon">{UI.onboarding.demoAppStoreSoon}</p>
        )}
        <button type="button" className="btn demo-play-again" onClick={() => window.location.reload()}>
          {UI.onboarding.demoPlayAgain}
        </button>
      </div>
    </div>
  )
}
