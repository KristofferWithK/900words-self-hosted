import { useEffect, useState } from 'react'
import { caseyReachable } from '../ai/client'

/**
 * How often an offline round asks whether Casey's server answers again. Each
 * ask is one bare OPTIONS request (`caseyReachable`), and none is sent while
 * the phone says it is offline or the app is off screen.
 */
export const CASEY_BACK_CHECK_MS = 30_000

export interface CaseyBackWatch {
  /** Whether Casey's server answers right now. */
  reachable: () => Promise<boolean>
  /** Called once, the first time it does; the watch then stops. */
  onBack: () => void
  /** Where the phone's `online` and the page's `visibilitychange` arrive. */
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>
  isOnScreen: () => boolean
  /** `navigator.onLine`: false is certain, true only means "maybe". */
  maybeOnline: () => boolean
  everyMs?: number
}

/**
 * Watches for Casey's server during an offline round: every half minute, and
 * at once when the phone reports a connection or the app comes back on
 * screen. The phone's own signal is not enough on its own: "online" can mean a
 * connection that reaches nothing, and a round can go offline because Casey's
 * server was unreachable while the phone stayed online, so it never fires.
 * Returns the stop.
 */
export function watchForCaseyBack(watch: CaseyBackWatch): () => void {
  let live = true
  let asking = false
  const check = async () => {
    if (!live || asking || !watch.isOnScreen() || !watch.maybeOnline()) return
    asking = true
    try {
      if ((await watch.reachable()) && live) {
        stop()
        watch.onBack()
      }
    } finally {
      asking = false
    }
  }
  const onEvent = () => void check()
  const timer = setInterval(onEvent, watch.everyMs ?? CASEY_BACK_CHECK_MS)
  watch.events.addEventListener('online', onEvent)
  watch.events.addEventListener('visibilitychange', onEvent)
  function stop() {
    live = false
    clearInterval(timer)
    watch.events.removeEventListener('online', onEvent)
    watch.events.removeEventListener('visibilitychange', onEvent)
  }
  return stop
}

/**
 * True once Casey's server answers again while `watching` (an offline round in
 * play that the player has not chosen to keep offline). The game screen then
 * offers normal Casey back. Resets whenever `watching` changes.
 */
export function useCaseyBackOnline(watching: boolean, baseUrl: string): boolean {
  const [back, setBack] = useState(false)
  useEffect(() => {
    setBack(false)
    if (!watching) return
    return watchForCaseyBack({
      reachable: () => caseyReachable(baseUrl),
      onBack: () => setBack(true),
      events: window,
      isOnScreen: () => document.visibilityState !== 'hidden',
      maybeOnline: () => navigator.onLine !== false,
    })
  }, [watching, baseUrl])
  return back
}
