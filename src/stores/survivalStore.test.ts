import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE } from '../lang/active'
import { initialSurvivalProgress } from '../journey/survival'
import { useSurvival } from './survivalStore'

const NOW = 1_700_000_000_000
const FIRST = 'sonderborg-situation-1'

describe('survivalStore', () => {
  beforeEach(() => useSurvival.getState().reset())

  it('keeps optional Survival history language-keyed and separate from any score/evidence ledger', () => {
    // A legitimate old persisted reader history remains readable and replayable,
    // but no new wrap-up can unlock it.
    useSurvival.setState({ byLanguage: {
      [ACTIVE.code]: { ...initialSurvivalProgress(ACTIVE.code), exchanges: { [FIRST]: { unlockedAt: NOW, firstCompletedAt: NOW + 1, replayedAt: [] } } },
    } })
    const da = useSurvival.getState().byLanguage[ACTIVE.code]!
    expect(da.exchanges[FIRST]).toMatchObject({ firstCompletedAt: NOW + 1, replayedAt: [] })

    useSurvival.getState().complete(FIRST, NOW + 2)
    expect(useSurvival.getState().byLanguage[ACTIVE.code]!.exchanges[FIRST]!.firstCompletedAt).toBe(NOW + 1)
    expect(useSurvival.getState().byLanguage[ACTIVE.code]!.exchanges[FIRST]!.replayedAt).toEqual([NOW + 2])
    // Reading or replaying one optional exchange cannot open another.
    expect(Object.keys(useSurvival.getState().byLanguage[ACTIVE.code]!.exchanges)).toEqual([FIRST])
    expect(Object.keys(da)).toEqual(['routeLanguage', 'exchanges'])
    expect(useSurvival.getState()).not.toHaveProperty('unlockAfterWrap')
  })

  it('does not create city progress just by opening an unavailable exchange', () => {
    useSurvival.getState().complete(FIRST, NOW)
    expect(useSurvival.getState().byLanguage[ACTIVE.code]).toBeUndefined()
  })

  it('clears settlement markers with the learning history on reset', () => {
    useSurvival.setState({ settlementEffects: { receipt: 'fingerprint' }, settlementMilestones: { milestone: NOW } })
    useSurvival.getState().reset()
    expect(useSurvival.getState()).toMatchObject({ settlementEffects: {}, settlementMilestones: {}, byLanguage: {} })
  })
})
