import { isWebDemo } from '../../build/audience'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { UI } from '../../i18n'
import { useGame } from '../../stores/gameStore'
import { Tag } from './Tag'


/** How often an installed app looks for a new version. */
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * The service worker is the WEB's update mechanism. A native shell updates
 * through its store and bundles its assets, so registering the worker there
 * would at best precache a second copy of the app and at worst offer a
 * "reload for the new version" that the store has not shipped. On iOS this
 * was moot — WKWebView exposes no serviceWorker on the capacitor:// scheme —
 * but Android serves the shell from https://localhost, a secure context where
 * the registration would go through. So the shell gets nothing, by decision
 * rather than by scheme.
 */
export function UpdateBanner(props: { readonly suppressOfflineReady?: boolean }) {
  // The website demo has no service worker either: it is a page on
  // 900words.app, not an installable app.
  if (Capacitor.isNativePlatform() || isWebDemo()) return null
  return <WebUpdateBanner {...props} />
}

/**
 * An installed PWA can sit on the same build for weeks: nothing re-fetches the
 * service worker unless you ask. This asks — hourly and whenever the app comes
 * back to the foreground — and then tells the player, rather than swapping the
 * app out from under them.
 */
function WebUpdateBanner({ suppressOfflineReady = false }: { readonly suppressOfflineReady?: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      const timer = setInterval(check, CHECK_EVERY_MS)
      const onVisible = () => {
        if (document.visibilityState === 'visible') check()
      }
      document.addEventListener('visibilitychange', onVisible)
      // The registration outlives the component, so nothing here unsubscribes;
      // both handlers are idempotent and cost a HEAD request at most.
      void timer
    },
  })

  // "You can play this on the plane" is worth saying once, and briefly. This
  // used to set its own state as its first act, which re-ran the effect and
  // cleared the very timeout meant to hide the notice — so it never went away.
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  // Never interrupt a round in progress — a state a reload would spoil, and
  // the update will still be there afterwards.
  const busy = useGame((s) => !!s.game && s.game.phase !== 'finished')

  if (needRefresh && !dismissed && !busy) {
    return (
      <div className="update-banner" role="status">
        <span>{UI.system.updateReady}</span>
        <div className="update-actions">
          <Tag tone="primary" className="update-reload" label={UI.system.updateReload} onClick={() => void updateServiceWorker(true)} />
          <Tag
            className="update-later"
            label={UI.system.updateLater}
            onClick={() => {
              setDismissed(true)
              setNeedRefresh(false)
            }}
          />
        </div>
      </div>
    )
  }

  if (offlineReady && !suppressOfflineReady) {
    return (
      <div className="update-banner update-banner-quiet" role="status">
        <span>{UI.system.offlineReady}</span>
      </div>
    )
  }

  return null
}
