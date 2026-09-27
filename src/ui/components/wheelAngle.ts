/**
 * The rotation, in degrees, of a computed CSS `transform` — what the wheel's
 * tick loop reads back off the spinning disc every frame.
 *
 * A browser may answer a 2D rotation as `matrix(a, b, c, d, tx, ty)` or, once
 * the element is composited in 3D, as `matrix3d(a1, b1, c1, d1, a2, …)`. For
 * a rotation about the screen's axis both lead with cos θ, sin θ, so
 * atan2(second, first) is the angle either way. Reading only `matrix(` left a
 * wheel that visibly spun with no ticks on an engine that answers `matrix3d(`.
 *
 * `null` for `none`, an empty string, or anything that does not parse.
 */
export function transformRotationDegrees(transform: string | null | undefined): number | null {
  if (!transform) return null
  const match = /^matrix(3d)?\(([^)]*)\)$/.exec(transform.trim())
  if (!match) return null
  const values = match[2]!.split(',').map(Number)
  if (values.length !== (match[1] ? 16 : 6)) return null
  const [a, b] = values
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return (Math.atan2(b!, a!) * 180) / Math.PI
}

/**
 * The shortest signed turn from one read-back angle to the next, in degrees.
 *
 * `transformRotationDegrees` answers in (-180, 180], so a disc turning
 * steadily clockwise reads 179 and then -179 one frame later. Counting
 * segments straight off those readings saw that jump as a segment change of
 * its own, and the wheel clacked once too often (or once too few) every
 * turn. A frame never turns the disc half a revolution, so the short way
 * round is the way it went.
 */
export function angleStep(previous: number, next: number): number {
  return ((((next - previous + 180) % 360) + 360) % 360) - 180
}

/**
 * How many segment boundaries the pointer passed between two UNWRAPPED
 * angles of an `n`-segment wheel — one clack each, the way a real wheel's
 * pegs slap the pointer. Boundaries sit at every multiple of the segment arc
 * once the disc's own resting lean (`offset`) is added back.
 */
export function segmentCrossings(from: number, to: number, n: number, offset = 0): number {
  if (n < 2) return 0
  const arc = 360 / n
  return Math.abs(Math.floor((to + offset) / arc) - Math.floor((from + offset) / arc))
}

/**
 * The spin itself, shared by the renderer and the tests so the easing the
 * disc moves on and the one the clack rate is checked against are one.
 *
 * Owner, 2026-09-27: the clack "is uneven and doesn't match the spinning.
 * With every segment there should be the clack." The curve it replaced,
 * cubic-bezier(0.12, 0.6, 0.08, 1) over four-plus turns, left the rest at
 * five times its average speed: 2,700°/s, over a hundred segment boundaries
 * a second on a fifteen-segment wheel. A frame can start one media element,
 * so most of the opening clacks never sounded and the ones that did ran
 * together, then the rest spaced out suddenly. Now every spin is two turns
 * plus the way round to its landing (720–1080°) on a curve whose fastest
 * stretch is under 30 clacks a second on the largest wheel (fifteen
 * segments): never two boundaries in one 60 Hz frame, so one clack per
 * boundary, each one heard, slowing with the disc into the landing. SPIN_MS stays the store's verdict hold.
 */
export const SPIN_MS = 3000
export const SPIN_EASING = [0.45, 0.75, 0.4, 1] as const
export const SPIN_TURNS = 2

/** Where a spin that starts at `rotation` ends, with segment `landed` under the pointer. */
export function spinTarget(rotation: number, landedRotation: number): number {
  const toLanding = (((landedRotation - rotation) % 360) + 360) % 360
  return rotation + 360 * SPIN_TURNS + toLanding
}
