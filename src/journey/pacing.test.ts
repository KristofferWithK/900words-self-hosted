import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { newStats } from '../srs/scheduler'
import type { SrsMap } from '../srs/types'
import { wordsForCity } from './progress'
import { wrapUpUnlocked } from './wrapup'

/**
 * Wrap-up availability is deliberately separate from the reward economy.
 * Normal wins grant postcards in `srsStore`; they never buy or gate
 * a wrap-up. The only pacing floor is one word that has earned a green each
 * way and can therefore be packed.
 */
describe('wrap-up availability', () => {
  const city = wordsForCity(WORDS, 0)
  const NOW = Date.UTC(2026, 0, 1)

  it('opens as soon as one word is collected, without a wins counter', () => {
    const word = city[0]!
    const srs: SrsMap = {
      [word.id]: { ...newStats(NOW), greenByClue: 1, greenByGuess: 1 },
    }

    expect(wrapUpUnlocked(WORDS, {}, {}, 0)).toBe(false)
    expect(wrapUpUnlocked(WORDS, srs, {}, 0)).toBe(true)
  })
})
