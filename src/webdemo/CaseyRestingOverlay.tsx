import { ClueyFace } from '../ui/components/Cluey'
import { UI } from '../i18n'
import { useWebDemo } from './webDemoStore'

/**
 * The website Casey's daily budget is spent (or the demo is switched off).
 * Covers the demo honestly instead of leaving a round waiting on a Casey who
 * will not answer today.
 */
export function CaseyRestingOverlay() {
  const resting = useWebDemo((s) => s.resting)
  if (!resting) return null
  const appStoreUrl = __APP_STORE_URL__
  return (
    <div className="demo-resting" role="alertdialog" aria-labelledby="demo-resting-title" aria-describedby="demo-resting-body">
      <div className="demo-resting-card">
        <ClueyFace mood="idle" className="cluey-mini" />
        <h2 id="demo-resting-title">{UI.onboarding.demoRestingTitle}</h2>
        <p id="demo-resting-body">{UI.onboarding.demoRestingBody}</p>
        {appStoreUrl ? (
          <a className="btn btn-primary demo-app-store" href={appStoreUrl} target="_top" rel="noopener">
            {UI.onboarding.demoAppStore}
          </a>
        ) : (
          <p className="demo-app-soon">{UI.onboarding.demoAppStoreSoon}</p>
        )}
      </div>
    </div>
  )
}
