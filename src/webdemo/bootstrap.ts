import { setDecisionAuth, setRestingHandler } from '../ai/client'
import { isWebDemo } from '../build/audience'
import { prefetchSession, webDemoAuth } from './session'
import { useWebDemo } from './webDemoStore'

/** Wire the website demo's Casey session and resting state. A no-op elsewhere. */
export function bootstrapWebDemo(): void {
  if (!isWebDemo()) return
  setDecisionAuth(webDemoAuth)
  setRestingHandler(() => useWebDemo.getState().setResting())
  // The website shows the board as the page loads, so the bot check waits for
  // the visitor's first touch or key: someone who only scrolls past never
  // loads Turnstile, and Casey's first real decision (after the scripted
  // opening turn) still finds the session ready.
  const start = () => {
    window.removeEventListener('pointerdown', start, true)
    window.removeEventListener('keydown', start, true)
    prefetchSession()
  }
  window.addEventListener('pointerdown', start, true)
  window.addEventListener('keydown', start, true)
}
