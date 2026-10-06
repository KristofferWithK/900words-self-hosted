import { describe, expect, it } from 'vitest'
import { nextWheelLanding } from './game'
import type { GameState } from './types'

// The spinner readies the spin's clack track before the tap from the engine's
// own next landing (owner, build 123: the sound must match the spin). It must
// be the landing SPIN_WHEEL then draws, which the reducer now reads from it.
describe('nextWheelLanding', () => {
  const at = (seed: number, attempts: number, n: number, result: 'win' | 'miss' | null = null) =>
    ({ seed, wheel: { segments: Array.from({ length: n }, (_, i) => `w${i}`), translated: [], filled: [], attempts, landed: null, result, spent: null } }) as unknown as GameState

  it('is a segment of the wheel, the same every time it is asked', () => {
    for (const seed of [1, 7, 12345, 0x7fffffff]) {
      for (const n of [1, 5, 15]) {
        const landing = nextWheelLanding(at(seed, 0, n))
        expect(landing).toBeGreaterThanOrEqual(0)
        expect(landing).toBeLessThan(n)
        expect(nextWheelLanding(at(seed, 0, n))).toBe(landing)
      }
    }
  })

  it('moves with the attempt, and is null once the wheel has spun or has nothing on it', () => {
    const draws = new Set(Array.from({ length: 12 }, (_, a) => nextWheelLanding(at(99, a, 15))))
    expect(draws.size).toBeGreaterThan(1)
    expect(nextWheelLanding(at(99, 0, 15, 'win'))).toBeNull()
    expect(nextWheelLanding(at(99, 0, 0))).toBeNull()
    expect(nextWheelLanding({ seed: 1, wheel: null } as unknown as GameState)).toBeNull()
  })
})
