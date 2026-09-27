import { useState } from 'react'
import { UI } from '../../i18n'

/**
 * Which build this is, and a way to go and get a newer one.
 *
 * An installed PWA can sit on the same version for days: the service worker
 * only looks for an update when something asks it to. UpdateBanner asks
 * hourly, but a player staring at a screen that does not match the
 * instructions they were given needs to be able to ask themselves — and to say
 * which version they are on when they report a problem.
 *
 * Behind five taps on the stamp sit the two device flags that have no other
 * home on a phone (the composer ride's opt-out and the train story), both
 * still read live by `nativeKeyboard.ts` and `travelStory.ts`. The
 * "Travel to the next city" button that also lived here is gone (2026-09-12):
 * the map's Travel ahead is the developer's jumper, and it needs no taps.
 */
export function BuildFooter() {
  const [state, setState] = useState<'idle' | 'checking' | 'current' | 'found' | 'error'>('idle')
  const [debug, setDebug] = useState(() => {
    try {
      return localStorage.getItem('cluecab-kbdebug') === '1'
    } catch {
      return false
    }
  })
  const [still, setStill] = useState(() => {
    try {
      // One-time sweep of the ride's opt-IN era: the composer riding the
      // keyboard is the default now, and a device that had turned the old
      // flag on has nothing to say about the new one.
      localStorage.removeItem('cluecab-kbfast')
      return localStorage.getItem('cluecab-kbstill') === '1'
    } catch {
      return false
    }
  })
  const [ride, setRide] = useState(() => {
    try {
      return localStorage.getItem('cluecab-ride') === '1'
    } catch {
      return false
    }
  })

  /**
   * Five taps on the build stamp turns on the keyboard readout.
   *
   * The one thing that cannot be debugged from here is what iOS does with the
   * keyboard on a real phone, and shipping a build per guess is a slow way to
   * find out. This is the old five-taps-for-developer-mode trick: invisible
   * until wanted, and reachable without a rebuild.
   */
  const [taps, setTaps] = useState(0)
  const tap = () => {
    const next = taps + 1
    setTaps(next)
    if (next < 5) return
    setTaps(0)
    const on = !debug
    setDebug(on)
    try {
      if (on) localStorage.setItem('cluecab-kbdebug', '1')
      else localStorage.removeItem('cluecab-kbdebug')
    } catch {
      /* private mode */
    }
  }

  /**
   * The composer ride's OPT-OUT, on and off without a rebuild.
   *
   * The ride ships on — the composer travels with the keyboard — and the only
   * way to judge that against the old wait-for-the-document behaviour is to
   * film both on a real phone, one after the other. A TestFlight build has no
   * console to set localStorage from, so the switch sits here, behind the
   * five taps that already reveal the readout: invisible to anyone who has
   * not gone looking, one tap away for the person filming. It is also the
   * per-device revert if the ride ever misbehaves on hardware CI never met.
   *
   * Live rather than latched, which is why nativeKeyboard.ts reads the flag
   * at keyboardWillShow rather than at mount: put the keyboard away, tap the
   * field again, and it is already the other mode.
   */
  const toggleStill = () => {
    const on = !still
    setStill(on)
    try {
      if (on) localStorage.setItem('cluecab-kbstill', '1')
      else localStorage.removeItem('cluecab-kbstill')
    } catch {
      /* private mode */
    }
  }

  /**
   * The train ride (H9), which is one city of nine and speaks in the phone's
   * own voice rather than Aoede. Off for everyone by default; this is how it
   * gets looked at on a device without shipping a half-written feature.
   *
   * Latched rather than live, unlike the composer ride above: the story is
   * read when the ride mounts, so the flag only has to be right at the moment
   * the Travel button is pressed.
   */
  const toggleRide = () => {
    const on = !ride
    setRide(on)
    try {
      if (on) localStorage.setItem('cluecab-ride', '1')
      else localStorage.removeItem('cluecab-ride')
    } catch {
      /* private mode */
    }
  }

  const check = async () => {
    setState('checking')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) {
        setState('error')
        return
      }
      await reg.update()
      // A worker that is installing or waiting means a newer build exists.
      setState(reg.waiting || reg.installing ? 'found' : 'current')
    } catch {
      setState('error')
    }
  }

  return (
    <p className="build-footer">
      <span onClick={tap}>
        {__TF_BUILD__ ? UI.settings.testFlightBuild(__TF_BUILD__) : ''}
        {UI.settings.buildStamp(__BUILD_STAMP__)}
      </span>
      {debug && <span className="build-note">{UI.settings.keyboardReadoutNote}</span>}
      {debug && (
        <button className="btn btn-small" onClick={toggleStill}>
          {UI.settings.composerRideButton(
            still ? UI.settings.composerRideWaiting : UI.settings.stateOn,
          )}
        </button>
      )}
      {debug && (
        <button className="btn btn-small" onClick={toggleRide}>
          {UI.settings.trainStoryButton(ride ? UI.settings.stateOn : UI.settings.stateOff)}
        </button>
      )}
      <button className="btn btn-small" disabled={state === 'checking'} onClick={check}>
        {state === 'checking' ? UI.settings.updateChecking : UI.settings.checkUpdatesButton}
      </button>
      {state === 'current' && <span className="build-note">{UI.settings.updateCurrent}</span>}
      {state === 'found' && <span className="build-note">{UI.settings.updateFound}</span>}
      {state === 'error' && <span className="build-note">{UI.settings.updateCheckFailed}</span>}
    </p>
  )
}
