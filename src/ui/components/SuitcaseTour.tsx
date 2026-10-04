import { useCallback, useEffect, useRef, useState } from 'react'
import { TOUR_STEPS, type TourStep } from '../../onboarding/tour'
import { ClueyFace } from './Cluey'
import { Tag } from './Tag'
import { UI } from '../../i18n'

/**
 * The spotlight walking the REAL SuitcaseScreen (O3). This component renders
 * nothing of the case itself: it measures the band the current step's anchor
 * selector finds on the live screen and draws a window around it — the scrim
 * is one box-shadow cast from the transparent spotlight div, so the band
 * stays exactly as bright as the screen drew it and everything else dims.
 *
 * The overlay covers the whole viewport and keeps underlying controls inert.
 * Learners advance only with explicit Next/Skip controls, so the action a step
 * describes is available after the lesson releases the screen.
 *
 * Fixed positioning throughout, so nothing here can lengthen the document —
 * the no-scroll rule holds by construction, and layout-drive measures it
 * anyway.
 */
export function SuitcaseTour({
  onDone,
  onSkip,
}: {
  /** Every band seen: the flow moves on (to the arrival). */
  onDone: () => void
  /** Skip, always visible — ends the whole intro, not just the tour. */
  onSkip: () => void
}) {
  return <CoachMarkTour steps={TOUR_STEPS} surfaceSelector=".onboard-home-act" onDone={onDone} onSkip={onSkip} />
}

/**
 * A fixed coach-mark layer over a REAL screen. The suitcase and map acts use
 * the same component so their anchor measurement and no-scroll behaviour
 * cannot quietly diverge.
 */
/**
 * Bring a control fully into view inside its nearest scrolling ancestor (the
 * review reader). Only an ancestor the player can scroll themselves is moved:
 * scrollIntoView would also shift overflow:hidden boxes, which nobody could
 * scroll back.
 */
function revealInScroller(target: Element) {
  for (let el = target.parentElement; el; el = el.parentElement) {
    const overflowY = window.getComputedStyle(el).overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    const box = el.getBoundingClientRect()
    const t = target.getBoundingClientRect()
    if (t.top < box.top) el.scrollTop -= box.top - t.top
    else if (t.bottom > box.bottom) el.scrollTop += Math.min(t.bottom - box.bottom, t.top - box.top)
    return
  }
}

export function CoachMarkTour({
  steps,
  onDone,
  onSkip,
  onUnavailable,
  doneLabel = UI.onboarding.tourDone,
  kind = 'suitcase',
  surfaceSelector,
  graceMs = 2500,
}: {
  steps: readonly TourStep[]
  onDone: () => void
  onSkip: () => void
  /** Anchor failure dismisses without claiming this lesson was completed. */
  onUnavailable?: () => void
  doneLabel?: string
  kind?: 'suitcase' | 'map' | 'home' | 'tutorial' | 'translation' | 'wheel' | 'result'
  surfaceSelector?: string
  /** How long a beat waits for its control to render before it is passed over. */
  graceMs?: number
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const step = steps[index] ?? null
  const last = index >= steps.length - 1
  const overlayRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onDoneRef = useRef(onDone)
  const onSkipRef = useRef(onSkip)
  const onUnavailableRef = useRef(onUnavailable)
  const embeddedInModal = surfaceSelector === '.city1-review-dialog'
  onDoneRef.current = onDone
  onSkipRef.current = onSkip
  onUnavailableRef.current = onUnavailable

  // Save the intended control once. While the tour owns the screen it moves
  // focus to its own action; on exit it restores only a still-mounted control.
  useEffect(() => {
    const active = document.activeElement
    previousFocus.current = active instanceof HTMLElement ? active : null
    if (active instanceof HTMLElement) active.blur()
    const frame = window.requestAnimationFrame(() => nextRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      const restore = previousFocus.current
      if (restore?.isConnected && !restore.matches(':disabled,[hidden]')) restore.focus()
      previousFocus.current = null
    }
  }, [])

  // A control the screen does not render right now (a lazy receipt or board
  // collection still loading) is waited for: every DOM change on the surface
  // looks again, for up to `graceMs`. A beat whose control never appears is
  // passed over rather than pointed at nothing, and the tour goes on. Only a
  // tour that could show none of its beats reports itself unavailable. Never
  // Skip: for the suitcase tour Skip ends the whole intro, and a missing band
  // is not the learner's choice.
  const shownAny = useRef(false)
  const indexRef = useRef(index)
  indexRef.current = index
  const stepsLength = steps.length
  const passOver = useCallback(() => {
    const from = indexRef.current
    if (from < stepsLength - 1) {
      setIndex((current) => (current === from ? from + 1 : current))
      return
    }
    if (shownAny.current) onDoneRef.current()
    else (onUnavailableRef.current ?? onDoneRef.current)()
  }, [stepsLength])

  useEffect(() => {
    if (!step) {
      ;(onUnavailableRef.current ?? onDoneRef.current)()
      return
    }
    const surface = surfaceSelector ? document.querySelector(surfaceSelector) : document
    let giveUpTimer = 0
    let scrolled = false
    let observed: Element | null = null
    let resizes: ResizeObserver | null = null
    let mutations: MutationObserver | null = null
    const visibleTarget = () => {
      const target = surface?.querySelector(step.anchor) ?? null
      if (!target?.isConnected) return null
      const box = target.getBoundingClientRect()
      const style = window.getComputedStyle(target)
      return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        ? target
        : null
    }
    const findAndMeasure = () => {
      const target = visibleTarget()
      if (target) {
        // A control inside a scrolling region (the review reader) is brought
        // into view once, so the light never lands on a clipped control.
        if (!scrolled) {
          scrolled = true
          revealInScroller(target)
        }
        const box = target.getBoundingClientRect()
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
        shownAny.current = true
        if (giveUpTimer) window.clearTimeout(giveUpTimer)
        giveUpTimer = 0
        if (resizes && observed !== target) {
          resizes.observe(target)
          observed = target
        }
        return
      }
      setRect(null)
      if (!giveUpTimer) {
        giveUpTimer = window.setTimeout(() => {
          giveUpTimer = 0
          if (!visibleTarget()) passOver()
          else findAndMeasure()
        }, graceMs)
      }
    }
    const onChange = () => findAndMeasure()
    if (typeof ResizeObserver !== 'undefined') {
      resizes = new ResizeObserver(onChange)
      if (surface instanceof Element) resizes.observe(surface)
    }
    if (typeof MutationObserver !== 'undefined') {
      mutations = new MutationObserver(onChange)
      mutations.observe(surface instanceof Element ? surface : document.body, { childList: true, subtree: true })
    }
    findAndMeasure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    window.visualViewport?.addEventListener('resize', onChange)
    window.visualViewport?.addEventListener('scroll', onChange)
    return () => {
      if (giveUpTimer) window.clearTimeout(giveUpTimer)
      resizes?.disconnect()
      mutations?.disconnect()
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
      window.visualViewport?.removeEventListener('resize', onChange)
      window.visualViewport?.removeEventListener('scroll', onChange)
    }
  }, [step?.anchor, surfaceSelector, passOver, graceMs])

  // The keyboard belongs to the tour while it is up, wherever focus has
  // wandered (a tap on the dimmed area moves it out of the overlay). Caught
  // on the document in the capture phase, so Escape closes only the lesson
  // and never reaches the result <dialog>'s own cancel, and Enter or Space
  // can never press a control that sits under the dim.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const overlay = overlayRef.current
      if (!overlay) return
      const inside = overlay.contains(document.activeElement)
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onSkipRef.current()
        return
      }
      if (event.key === 'Tab') {
        const controls = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        if (controls.length === 0) {
          event.preventDefault()
          return
        }
        const first = controls[0]!
        const lastControl = controls[controls.length - 1]!
        if (!inside) {
          event.preventDefault()
          ;(event.shiftKey ? lastControl : first).focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          lastControl.focus()
        } else if (!event.shiftKey && document.activeElement === lastControl) {
          event.preventDefault()
          first.focus()
        }
        return
      }
      if (!inside) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const advance = () => (last ? onDoneRef.current() : setIndex(current => current + 1))
  // A tap-through beat: the tap on the light ends the beat and presses the
  // real control in the same gesture, so anything that control primes on a
  // user gesture (the wheel's sounds) is still allowed.
  const pressTarget = () => {
    const target = step ? document.querySelector<HTMLElement>(step.anchor) : null
    advance()
    target?.click()
  }
  if (!step) return null
  // The tap-through light is named for the control it presses (the wheel's
  // own translated label), falling back to Casey's line for the beat.
  const tapLabel = step.tapThrough
    ? document.querySelector(step.anchor)?.getAttribute('aria-label') ?? step.text
    : undefined

  // The bubble takes whichever half of the screen the band is not in, so the
  // light and the words about it never cover each other.
  const vh = typeof window === 'undefined' ? 640 : window.innerHeight
  const bandInTopHalf = rect !== null && rect.top + rect.height / 2 < vh / 2
  return (
    <div
      ref={overlayRef}
      className="tour-overlay"
      role={embeddedInModal ? 'group' : 'dialog'}
      aria-modal={embeddedInModal ? undefined : 'true'}
      aria-labelledby="tour-current-text"
      data-tour-kind={kind}
      data-tour-step={index}
      data-tour-steps={steps.length}
      data-tour-anchor={step.anchor}
    >
      {rect && (
        <div
          className="tour-spot"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          aria-hidden="true"
        />
      )}
      {rect && step.tapThrough && (
        <button
          type="button"
          className="tour-spot-tap"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          aria-label={tapLabel}
          onClick={pressTarget}
        />
      )}
      <div
        className={`tour-panel ${bandInTopHalf ? 'tour-panel-bottom' : 'tour-panel-top'}`}
      >
        <div className="tutorial-say">
          <ClueyFace mood={last ? 'happy' : 'idle'} className="cluey-mini" />
          {/* role=status: each step is announced without stealing focus, the
              same pattern every onboarding bubble uses. */}
          <p id="tour-current-text" className="tutorial-bubble" role="status">
            {step.text}
          </p>
        </div>
        <div className="onboard-controls">
          <Tag ref={nextRef} tone="primary" className="onboard-next" onClick={advance} label={last ? doneLabel : UI.onboarding.tourNext} />
          <Tag className="onboard-skip" onClick={onSkip} label={UI.onboarding.skip} />
        </div>
      </div>
    </div>
  )
}
