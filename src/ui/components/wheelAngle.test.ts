import { describe, expect, it } from 'vitest'
import { SPIN_EASING, SPIN_MS, angleStep, segmentCrossings, spinTarget, transformRotationDegrees } from './wheelAngle'

/** What a browser writes for rotate(θ) in each form. */
const matrix2d = (deg: number) => {
  const r = (deg * Math.PI) / 180
  return `matrix(${Math.cos(r)}, ${Math.sin(r)}, ${-Math.sin(r)}, ${Math.cos(r)}, 0, 0)`
}
const matrix3d = (deg: number) => {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return `matrix3d(${c}, ${s}, 0, 0, ${-s}, ${c}, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)`
}

describe('transformRotationDegrees — the wheel tick loop reads the disc angle back', () => {
  it.each([0, 30, 90, 135, -45, -170])('reads %s° out of matrix(…)', (deg) => {
    expect(transformRotationDegrees(matrix2d(deg))).toBeCloseTo(deg, 6)
  })

  it.each([0, 30, 90, 135, -45, -170])('reads %s° out of matrix3d(…) the same', (deg) => {
    expect(transformRotationDegrees(matrix3d(deg))).toBeCloseTo(deg, 6)
  })

  it('agrees between the two forms across a whole spin, so both tick at the same boundaries', () => {
    for (let deg = -179; deg < 180; deg += 7) {
      expect(transformRotationDegrees(matrix3d(deg))).toBeCloseTo(transformRotationDegrees(matrix2d(deg))!, 9)
    }
  })

  it('reads the exact strings Chromium and WebKit print', () => {
    expect(transformRotationDegrees('matrix(0, 1, -1, 0, 0, 0)')).toBeCloseTo(90)
    expect(transformRotationDegrees('matrix3d(0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')).toBeCloseTo(-90)
  })

  it.each(['none', '', 'matrix(1, 0)', 'matrix3d(1, 0, 0, 1, 0, 0)', 'rotate(30deg)', 'matrix(a, b, c, d, 0, 0)'])(
    'answers null for %j rather than a wrong angle',
    (value) => {
      expect(transformRotationDegrees(value)).toBeNull()
    },
  )

  it('answers null for a missing value', () => {
    expect(transformRotationDegrees(null)).toBeNull()
    expect(transformRotationDegrees(undefined)).toBeNull()
  })
})

/** CSS cubic-bezier(x1, y1, x2, y2) at time fraction x, solved the way a browser does. */
function bezier([x1, y1, x2, y2]: readonly number[], x: number): number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  let lo = 0, hi = 1, t = x
  for (let i = 0; i < 60; i++) {
    t = (lo + hi) / 2
    if (at(x1!, x2!, t) < x) lo = t
    else hi = t
  }
  return at(y1!, y2!, t)
}

/**
 * One spin as the tick loop sees it: the disc's angle at every 60 Hz frame,
 * written as a browser would write it, read back, unwrapped and counted.
 */
function simulate(n: number, from: number, to: number, wobble = -3) {
  const frames = Math.round(SPIN_MS / (1000 / 60))
  let last: number | null = null
  let travelled = 0
  const clacksAt: number[] = []
  let doubled = 0
  for (let f = 0; f <= frames; f++) {
    const angle = from + (to - from) * bezier(SPIN_EASING, f / frames) + wobble
    const deg = transformRotationDegrees(matrix2d(angle))!
    if (last === null) travelled = deg
    else {
      const moved = angleStep(last, deg)
      const crossed = segmentCrossings(travelled, travelled + moved, n, wobble)
      if (crossed > 0) clacksAt.push(f)
      if (crossed > 1) doubled++
      travelled += moved
    }
    last = deg
  }
  return { clacksAt, doubled }
}

describe('the wheel clacks once for every segment that passes the pointer', () => {
  it('turns the short way round across the ±180° seam', () => {
    expect(angleStep(179, -179)).toBeCloseTo(2, 9)
    expect(angleStep(-179, 179)).toBeCloseTo(-2, 9)
    expect(angleStep(10, 40)).toBeCloseTo(30, 9)
  })

  it('counts boundaries on the leaning disc, not the upright one', () => {
    // A 12-segment wheel has a boundary at every 30°; with the -3° lean the
    // pointer meets them at 3°, 33°, 63°, ...
    expect(segmentCrossings(4, 32, 12, -3)).toBe(0)
    expect(segmentCrossings(4, 34, 12, -3)).toBe(1)
    expect(segmentCrossings(34, 94, 12, -3)).toBe(2)
  })

  it('always spins two turns plus the way round to the landing', () => {
    for (const from of [0, 17, 360 * 3 + 200]) {
      for (const landed of [12, 180, 348]) {
        const to = spinTarget(from, landed)
        expect(to - from).toBeGreaterThanOrEqual(720)
        expect(to - from).toBeLessThan(1080)
        expect((((to - landed) % 360) + 360) % 360).toBeCloseTo(0, 9)
      }
    }
  })

  it.each([13, 14, 15])('sounds every boundary of a %s-segment spin, never two in a frame', (n) => {
    const arc = 360 / n
    for (const from of [0, 5 * arc + 1, 1234.5]) {
      for (const landedSegment of [0, Math.floor(n / 2), n - 1]) {
        const to = spinTarget(from, 360 - ((landedSegment + 0.5) / n) * 360)
        const { clacksAt, doubled } = simulate(n, from, to)
        const boundaries = Math.floor((to - 3) / arc) - Math.floor((from - 3) / arc)
        expect(doubled, `${n} from ${from}`).toBe(0)
        expect(clacksAt).toHaveLength(boundaries)
      }
    }
  })

  it('never runs faster than 30 clacks a second, and slows into the landing', () => {
    const n = 15
    const { clacksAt } = simulate(n, 0, spinTarget(0, 359.9))
    // No second of the spin holds more than 30 (60 frames = one second).
    for (let i = 0; i < clacksAt.length; i++) {
      expect(clacksAt.filter((f) => f >= clacksAt[i]! && f < clacksAt[i]! + 60).length).toBeLessThanOrEqual(30)
    }
    const gaps = clacksAt.slice(1).map((f, i) => f - clacksAt[i]!)
    expect(gaps.at(-1)).toBe(Math.max(...gaps))
  })
})
