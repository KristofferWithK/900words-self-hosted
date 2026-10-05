import { useEffect } from 'react'
import { consumePressHaptic, prepareHaptics, tapHaptic } from './feedback'

const TAP_TARGET = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[data-hurry]',
].join(',')

// These are intentionally non-button, full-screen tap surfaces. Match only
// when the surface ITSELF was touched: whitespace inside the dialog it wraps
// is not an action, while the dimmed outside area closes it.
const DIRECT_TAP_TARGET = '.sheet-backdrop,.tour-overlay'

/**
 * One tactile language for the whole app. Listening on the bubble phase is
 * important: GameScreen deliberately stops a click whose only job was to put
 * the keyboard away, so that non-action never reaches this listener and never
 * feels like the covered card fired after all.
 */
export function useTapHaptics(): void {
  useEffect(() => {
    let lastPointerUp = -Infinity
    const onPointerUp = () => {
      lastPointerUp = performance.now()
    }
    // The finger is down: get the engine ready for the tick the click will
    // ask for. Any touch, not only one on a tap target. It is cheaper to warm
    // for a swipe than to work out at pointer-down what the gesture will be.
    const onPointerDown = () => prepareHaptics()
    const onClick = (event: MouseEvent) => {
      // Require a real pointer gesture immediately before the click. This
      // excludes keyboard activation and HTMLElement.click(), including the
      // hidden file input a Backup button opens (which would otherwise tick a
      // second time). isTrusted closes the programmatic-click case even when
      // it is dispatched synchronously inside the real button's own click.
      if (
        !event.isTrusted ||
        performance.now() - lastPointerUp > 750 ||
        !(event.target instanceof Element)
      ) {
        return
      }
      const semantic = event.target.closest<HTMLElement>(TAP_TARGET)
      const direct = event.target.matches(DIRECT_TAP_TARGET) ? event.target : null
      const target = semantic ?? direct
      if (!target) return
      if (
        target.matches(':disabled') ||
        target.getAttribute('aria-disabled') === 'true' ||
        target.closest('[inert]')
      ) {
        return
      }
      // A word card ticks as the finger lands (pressHaptic); its click is quiet.
      if (consumePressHaptic(target)) return
      tapHaptic()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('click', onClick)
    }
  }, [])
}
