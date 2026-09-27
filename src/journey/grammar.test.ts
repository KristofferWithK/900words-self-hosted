import { describe, expect, it } from 'vitest'
import { CITIES } from './cities'
import {
  grammarChapters,
  grammarForDestination,
  grammarLessonsForDestination,
  unlockedGrammarCount,
} from './grammar'

describe('the train grammar course', () => {
  it('renders nine accepted chapters in destination-city route order', () => {
    expect(grammarChapters()).toHaveLength(9)
    expect(grammarChapters().map((chapter) => chapter.cityId)).toEqual(
      CITIES.map((city) => city.id),
    )
    expect(grammarForDestination(0)?.titleDa).toBe('En ting, et sted')
    expect(grammarForDestination(8)?.titleDa).toBe('Jeg skriver, fordi tiden ikke passer')
  })

  it('keeps nine route cities while Aarhus owns two ordered fixed lessons', () => {
    expect(grammarLessonsForDestination(3).map((lesson) => lesson.id)).toEqual([
      'aarhus-time-v2', 'aarhus-practical-recent-past',
    ])
    expect(grammarLessonsForDestination(3).every((lesson) => lesson.examples.length > 0 && lesson.rules.length > 0)).toBe(true)
  })

  it('has accepted content for every destination and no post-København lesson', () => {
    for (let i = 0; i < grammarChapters().length; i++) {
      expect(grammarForDestination(i)?.body.length).toBeGreaterThan(250)
    }
    expect(grammarForDestination(9)).toBeUndefined()
  })

  it('makes chapter one available before the first board and accumulates on arrival', () => {
    expect(unlockedGrammarCount(0)).toBe(1)
    expect(unlockedGrammarCount(1)).toBe(2)
    expect(unlockedGrammarCount(4)).toBe(5)
    expect(unlockedGrammarCount(8)).toBe(9)
  })

  it('keeps a skipped destination chapter through reload and never makes travel depend on it', () => {
    // Chapter availability is derived from the persisted destination, rather
    // than a "read" flag. The same saved city produces the same library after
    // a reload, and travelling to Ribe is enough to make chapter two readable.
    const arrivedAtRibe = 1
    expect(unlockedGrammarCount(arrivedAtRibe)).toBe(2)
    expect(unlockedGrammarCount(arrivedAtRibe)).toBe(2)
    expect(grammarForDestination(arrivedAtRibe)?.cityId).toBe('ribe')
  })
})
