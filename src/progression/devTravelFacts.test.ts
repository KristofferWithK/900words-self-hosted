import { describe, expect, it } from 'vitest'
import { earnedPostcards } from './facts'
import { devTravelFacts } from './devTravelFacts'

describe('dev travel fixtures', () => {
  it('seeds durable earned facts for the city named by the drive URL', () => {
    const facts = devTravelFacts('ribe', 1, 100)
    expect(Object.keys(facts.boards)).toHaveLength(100)
    expect(earnedPostcards(facts, { courseId: 'da', cityId: 'ribe' })).toBe(100)
    expect(earnedPostcards(facts, { courseId: 'da', cityId: 'sonderborg' })).toBe(0)
  })

  it('clamps malformed fixture amounts without creating facts', () => {
    expect(Object.keys(devTravelFacts('ribe', 1, -4).boards)).toHaveLength(0)
    expect(Object.keys(devTravelFacts('ribe', 1, 101).boards)).toHaveLength(100)
  })
})
