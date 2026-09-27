import { useEffect } from 'react'
import { tapHaptic } from './feedback'

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
      tapHaptic()
    }

    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('click', onClick)
    }
  }, [])
}
