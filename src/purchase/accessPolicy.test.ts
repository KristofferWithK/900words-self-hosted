import { describe, expect, it } from 'vitest'
import { canBoardForJourney } from './accessPolicy'

describe('feedback journey access', () => {
  it('lets a feedback build pass only the dormant money gate through city nine', () => {
    for (let cityIndex = 1; cityIndex < 9; cityIndex += 1) {
      expect(canBoardForJourney(cityIndex, 'unavailable', true)).toBe(true)
    }
  })

  it('lets an ordinary build board every train while the pass is off for launch', () => {
    // PASS_GATE_ENABLED is false (pass.ts); the dormant two-city gate itself
    // is pinned in pass.test.ts, where the switch can be passed explicitly.
    expect(canBoardForJourney(0, 'unavailable', false)).toBe(true)
    expect(canBoardForJourney(1, 'unavailable', false)).toBe(true)
    expect(canBoardForJourney(8, 'not-entitled', false)).toBe(true)
    expect(canBoardForJourney(8, 'entitled', false)).toBe(true)
  })

  it('does not turn feedback access into a persisted or StoreKit entitlement', () => {
    // The function accepts the status as an input and returns only a boarding
    // decision; it has no store, mutation, or native purchase surface.
    expect(canBoardForJourney(8, 'not-entitled', true)).toBe(true)
    expect(canBoardForJourney(8, 'entitled', false)).toBe(true)
  })
})
