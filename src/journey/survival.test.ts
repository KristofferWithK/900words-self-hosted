import { describe, expect, it } from 'vitest'
import { danishSurvivalGuide } from '../lang/da/survival'
import {
  cityExitAvailable,
  completeSurvivalExchange,
  initialSurvivalProgress,
  survivalState,
  unlockSurvivalAfterWrap,
} from './survival'

const NOW = 1_700_000_000_000
const CITY = 0
const FIRST = 'sonderborg-situation-1'

describe('Survival progression', () => {
  it('unlocks one optional exchange per completed wrap-up, in city order', () => {
    let progress = initialSurvivalProgress('da')
    for (let wraps = 0; wraps < 4; wraps++) {
      progress = unlockSurvivalAfterWrap(danishSurvivalGuide, progress, CITY, NOW + wraps)
    }
    const ids = danishSurvivalGuide.cities[CITY]!.exchanges.map((item) => item.targetActivityId)
    expect(Object.keys(progress.exchanges)).toEqual(ids)
    expect(unlockSurvivalAfterWrap(danishSurvivalGuide, progress, CITY, NOW + 5)).toBe(progress)
  })

  it('does not unlock, score, or otherwise change a city without a completed wrap-up', () => {
    const progress = initialSurvivalProgress('da')
    expect(survivalState(progress, FIRST)).toBe('locked')
    expect(completeSurvivalExchange(progress, FIRST, NOW)).toBe(progress)
  })

  it('records the first completion once and retains later reads only as replays', () => {
    const unlocked = unlockSurvivalAfterWrap(danishSurvivalGuide, initialSurvivalProgress('da'), CITY, NOW)
    const first = completeSurvivalExchange(unlocked, FIRST, NOW + 10)
    const replay = completeSurvivalExchange(first, FIRST, NOW + 20)
    expect(survivalState(first, FIRST)).toBe('completed')
    expect(replay.exchanges[FIRST]).toEqual({
      unlockedAt: NOW,
      firstCompletedAt: NOW + 10,
      replayedAt: [NOW + 20],
    })
  })

  it('keeps the city exit independent and available only at 100 wrapped city words', () => {
    expect(cityExitAvailable(99)).toBe(false)
    expect(cityExitAvailable(100)).toBe(true)
    expect(cityExitAvailable(100, 101)).toBe(false)
  })
})
