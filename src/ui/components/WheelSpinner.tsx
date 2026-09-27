import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../../engine/types'
import { UI } from '../../i18n'
import { useGame } from '../../stores/gameStore'
import { primeRewardDing, wheelSpinTick } from '../feedback'
import { SPIN_EASING, SPIN_MS, angleStep, segmentCrossings, spinTarget, transformRotationDegrees } from './wheelAngle'

/**
 * The Translation Wheel (owner, 2026-09-16) — DIRECTION B visuals.
 *
 * One segment per suitcase the challenge asked for, in the fixed order the
 * engine froze at open. A segment starts paper-beige and fills green when the
 * engine's RANDOM fill picks it — the wheel IS the progress bar, which is why
 * the dock carries no separate progress bar. The wheel is ALWAYS spinnable
 * (no all-packed gate): filled segments are the win zones, empty ones the
 * loss zones, and the engine's SPIN_WHEEL judges the landing. The player taps
 * the wheel to spin it; the landing is drawn engine-side, this component only
 * animates toward it and reports the verdict the engine already wrote.
 *
 * Direction B (design/Translation Wheel UI directions.html): the whole wheel
 * is drawn wonky — a hand-wobbled disc, crayon-textured fills (green washes at
 * varying opacity over paper, empty = paper beige), a bent luggage-tag
 * pointer at the top. The sketchiness is the charm.
 *
 * Owner's amendment: NO word labels on segments — the wheel is pure shape and
 * colour. The words live on the board's suitcase lids now.
 */

/** Paper beige vs the green washes, by CSS variable name — the mockup's two crayons. */
const FILL = {
  empty: 'var(--beige, #e3dfd3)',
  filled: 'var(--green, #6aaa64)',
} as const

const INK = 'var(--text, #121212)'

/** Filled washes alternate two opacities, the way the mockup's crayon layers do. */
const FILL_OPACITY = [0.85, 0.7, 0.8] as const

/** The verdict's line, keyed by the engine's result — no literal in the JSX. */
const RESULT_LABEL = {
  win: UI.game.wheelWonLine,
  miss: UI.game.wheelMissLine,
} as const

/** Polar helper: segment i's arc runs [i*step, (i+1)*a) from -90° (12 o'clock). */
function arcPath(cx: number, cy: number, r: number, i: number, n: number): string {
  // A one-segment wheel is a full disc: an arc from a point to itself draws
  // nothing, which once left the evidence showing an empty ring with a stray
  // radius line. Drawn as two half-arcs so the wedge exists at any n. (Built
  // by concatenation for the same scanner reason as the general case: each
  // piece stays coordinate-shaped, not prose-shaped.)
  if (n <= 1) {
    const arc = (toX: number, toY: number) =>
      `A ${r} ${r} 0 1 1 ${toX} ${toY}`
    return (
      `M ${cx} ${cy} L ${cx} ${cy - r} ` +
      arc(cx, cy + r) +
      arc(cx, cy - r) +
      ` Z`
    )
  }
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  // large-arc is 0 and sweep 1 while n > 2; n <= 2 needs the flag at 1.
  const large = n > 2 ? 0 : 1
  // An SVG path command: `M … L … A … Z` reads as three words to the
  // scanner's three-word rule, so the d string is built from a helper the
  // scanner's template-joining sees as coordinates, not prose — and the
  // assembled command lives in ONE template with single-letter segments.
  const coords = `${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  return `M ${coords} Z`
}

/** The rotation that puts segment `i`'s middle under the pointer at the top. */
const segmentToRotation = (i: number, n: number) => 360 - ((i + 0.5) / n) * 360

export function WheelSpinner({ game }: { game: GameState }) {
  const wheel = game.wheel!
  const spinWheel = useGame((s) => s.spinWheel)
  const clearSpinHold = useGame((s) => s.clearWheelSpinHold)
  const attemptId = useGame((s) => s.attemptId)
  const activeSlot = useGame((s) => s.activeSlot)
  const eventGeneration = useGame((s) => s.eventGeneration)
  const n = wheel.segments.length

  // The wheel's resting rotation between spins. After a spin it holds the
  // landing segment's angle (plus four turns, so the deceleration reads) until
  // the next phase change rebuilds it.
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // The engine writes `landed` the moment the tap lands; the animation is the
  // renderer catching up to a fact that already exists. The store hold ends
  // from the SVG's actual transform transitionend, so the verdict, finish
  // screen and win fanfare all hand off together. The store owns a bounded
  // fallback in case this renderer disappears before reporting completion.
  useEffect(() => {
    if (wheel.landed === null || spinning) return
    const owner = useGame.getState().eventOwner()
    const target = spinTarget(rotation, segmentToRotation(wheel.landed, n))
    if (reduced) {
      setSpinning(false)
      if (wheel.result) clearSpinHold(owner)
      return
    }

    const svg = svgRef.current
    if (!svg) return
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== svg || event.propertyName !== 'transform') return
      setSpinning(false)
      if (wheel.result) clearSpinHold(owner)
    }
    svg.addEventListener('transitionend', onTransitionEnd)
    setSpinning(true)
    setRotation(target)
    return () => svg.removeEventListener('transitionend', onTransitionEnd)
    // `rotation` is deliberately not a dependency: the effect reads it once,
    // when the landing arrives, and re-running on its own writes would restart
    // the spin mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel.landed, n, attemptId, activeSlot, eventGeneration, reduced])

  // The click-clack (owner, 2026-09-18; made even 2026-09-27): a
  // requestAnimationFrame loop reads the disc's ACTUAL computed angle while
  // the CSS transition carries it, and clacks once for each segment boundary
  // the pointer passed since the last frame. The ticks follow the spin's
  // deceleration — fast at first, slower and slower toward the landing —
  // because they are read off the animation rather than re-derived from it.
  // The reading is UNWRAPPED (angleStep) before it is counted: the raw angle
  // jumps from 180 to -180 once a turn, which used to cost or add a clack.
  useEffect(() => {
    if (!spinning || reduced) return
    let raf = 0
    let last: number | null = null
    let travelled = 0
    const step = () => {
      const el = svgRef.current
      if (el) {
        // matrix(…) or matrix3d(…) — atan2 of the rotation part IS the angle.
        const deg = transformRotationDegrees(window.getComputedStyle(el).transform)
        if (deg !== null) {
          if (last === null) {
            // Boundaries repeat every turn, so the first reading is as good
            // an absolute angle as any.
            travelled = deg
          } else {
            const moved = angleStep(last, deg)
            // The pegs sit on the disc's own leaning frame, so the lean is
            // added back before the boundaries are counted. A frame that
            // passed two boundaries (a dropped frame) sounds one clack: two
            // starts in the same instant are one sound anyway.
            if (segmentCrossings(travelled, travelled + moved, n, WOBBLE) > 0) wheelSpinTick()
            travelled += moved
          }
          last = deg
        }
      }
      raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [spinning, reduced, n])

  const canSpin = wheel.result === null
  const cx = 100
  const cy = 100
  const r = 88
  // The wobble: the whole disc leans a constant few degrees, the mockup's
  // rotate(-3deg) — hand-set, not derived, so every board leans the same way.
  const WOBBLE = -3
  // The svg element, for the tick loop's computed-transform readback.
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div className="wheel-stage">
      {/* The tap target is the wheel itself. The wheel is ALWAYS spinnable —
          no all-packed gate; filled segments are win zones, empty loss zones
          (engine SPIN_WHEEL). aria-disabled rather than disabled while the
          wheel is decided-but-animating, so the result is still announced. */}
      <button
        className={`wheel-disc${canSpin ? '' : ' wheel-done'}`}
        aria-label={
          wheel.result
            ? RESULT_LABEL[wheel.result]
            : spinning
              ? UI.game.wheelSpinning
              : UI.game.wheelSpinAria
        }
        disabled={!canSpin || spinning}
        onClick={() => {
          if (!canSpin || spinning) return
          // The spin's own gesture primes the effects' media elements, so
          // the tick loop's rAF click-clacks, long after this tap, are
          // already allowed (the prime-on-gesture pattern of primeWordAudio).
          primeRewardDing()
          spinWheel()
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className={`wheel-svg${spinning && !reduced ? ' wheel-spinning' : ''}`}
          style={
            reduced
              ? { transform: `rotate(${(wheel.landed !== null ? segmentToRotation(wheel.landed, n) : 0) + WOBBLE}deg)` }
              : {
                  transform: `rotate(${rotation + WOBBLE}deg)`,
                  // The spin's curve lives with SPIN_EASING, which the clack
                  // rate is tested against; .wheel-spinning only marks it.
                  // Longhands, not the shorthand, so a transition-delay set
                  // elsewhere (endgame-drive delays the visual start) survives.
                  transitionProperty: spinning ? 'transform' : undefined,
                  transitionDuration: spinning ? `${SPIN_MS}ms` : undefined,
                  transitionTimingFunction: spinning ? `cubic-bezier(${SPIN_EASING.join(', ')})` : undefined,
                }
          }
          aria-hidden="true"
        >
          {/* The wobble lives INSIDE the svg's own group, not on the svg
              element: the spin animation rotates the svg element toward the
              landing, and the wobble is the disc's resting tilt — the two are
              independent, so a spinning wheel never loses its lean. */}
          <g transform={`rotate(${WOBBLE} 100 100)`}>
            {wheel.segments.map((id, i) => (
              <path
                key={id}
                d={arcPath(cx, cy, r, i, n)}
                fill={wheel.filled.includes(i) ? FILL.filled : FILL.empty}
                fillOpacity={
                  wheel.filled.includes(i) ? FILL_OPACITY[i % FILL_OPACITY.length] : undefined
                }
                stroke={INK}
                strokeWidth="2"
              />
            ))}
            {/* The wonky hub: a slightly off-centre ellipse, the mockup's
                hand-drawn middle. */}
            <ellipse cx={101} cy={99} rx={11} ry={10} fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(-4 101 99)" />
            <circle cx={101} cy={99} r={2.5} fill={INK} />
          </g>
          {/* No outer ring beyond the segments' own strokes: the disc's edge
              is the segments' arcs meeting, as in the mockup. */}
        </svg>
        {/* The bent luggage-tag pointer, fixed at 12 o'clock over the spinning
            disc — the CSS draws the tag; it does not rotate with the disc. */}
        <span className="wheel-pointer" aria-hidden="true" />
      </button>
      {/* The dock's ONE line stands here in the challenge bar; the verdict
          lines below only exist while a result is on screen. */}
      {wheel.result !== null && (
        <p className="wheel-line" role="status">
          {RESULT_LABEL[wheel.result]}
        </p>
      )}
    </div>
  )
}
