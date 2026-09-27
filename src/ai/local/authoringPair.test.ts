import { describe, expect, it } from 'vitest'
import { authoringPairFromMatrix } from './authoringPair'

describe('the authored model pair', () => {
  it('comes from the city matrix metadata, including a non-default city', () => {
    expect(
      authoringPairFromMatrix({ city: 9, meta: { judges: ['sol', 'terra'] } }),
    ).toEqual(['sol', 'terra'])
  })

  it('cannot silently fall back when metadata is missing or invalid', () => {
    expect(() => authoringPairFromMatrix({ city: 9 })).toThrow(/exactly two judges/)
    expect(() =>
      authoringPairFromMatrix({ city: 9, meta: { judges: ['sol', 'sol'] } }),
    ).toThrow(/must be different/)
  })
})
