// How often does ONE typed answer match MORE than one Danish word of City 1,
// under the engine's own matchesAnswer? Enumerated in vitest so the TS imports
// resolve. Run: npx vitest run src/engine/lane-f-ambig.test.ts
import { describe, expect, it } from 'vitest'
import { matchesAnswer } from './packing'
import { WORDS, isHeadword } from '../data/words'
import { danish } from '../lang/da'

describe('ambiguity census: one answer, two Danish words', () => {
  it('lists every ordered pair where word j\'s citation form also packs word i', () => {
    const das = WORDS.map((w) => w.da)
    const collisions: [string, string][] = []
    for (let i = 0; i < das.length; i++) {
      for (let j = 0; j < das.length; j++) {
        if (i === j) continue
        if (matchesAnswer(das[j]!, das[i]!, danish, isHeadword)) {
          collisions.push([das[i]!, das[j]!])
        }
      }
    }
    // Pin: a change to the grader that widens matching has to face this list.
    // Written to stdout via a failure message if the census ever grows.
    expect(
      collisions,
      `ambiguity census grew to ${collisions.length}: ${JSON.stringify(collisions)}`,
    ).toEqual([])
  })
})