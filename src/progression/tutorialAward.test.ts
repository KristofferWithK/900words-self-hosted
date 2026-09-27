import { describe, expect, it } from 'vitest'
import { earnedPostcards, emptyProgressFacts, mergeProgressFacts } from './facts'
import { FIXTURE_BOARD, MATRIX_FIXTURES, attemptFixture } from './fixtures'
import { tutorialAwardKey } from './identity'
import { claimTutorialAward, tutorialAwardIdentity } from './tutorialAward'

const identity = tutorialAwardIdentity('profile-local-test', FIXTURE_BOARD, 'A1')
const win = attemptFixture(MATRIX_FIXTURES[5].game, { origin: 'tutorial', attemptId: 'practice-1' })

describe('one-time tutorial practice postcard', () => {
  it('awards one qualifying success, then reports already-held for replay/reload/double', () => {
    const first = claimTutorialAward(emptyProgressFacts(), identity, win, 100)
    expect(first).toMatchObject({ status: 'new', postcards: 1 })
    expect(earnedPostcards(first.facts, FIXTURE_BOARD)).toBe(1)
    for (const attemptId of ['practice-1', 'practice-2']) {
      const repeated = claimTutorialAward(first.facts, identity, { ...win, attemptId }, 200)
      expect(repeated).toMatchObject({ status: 'already-held', postcards: 0 })
      expect(earnedPostcards(repeated.facts, FIXTURE_BOARD)).toBe(1)
    }
  })

  it('does not award a miss or skipped/non-tutorial attempt', () => {
    expect(claimTutorialAward(emptyProgressFacts(), identity, { ...win, game: MATRIX_FIXTURES[0].game }, 1).status).toBe('not-eligible')
    expect(claimTutorialAward(emptyProgressFacts(), identity, { ...win, origin: 'primary' }, 1).status).toBe('not-eligible')
    expect(earnedPostcards(emptyProgressFacts(), FIXTURE_BOARD)).toBe(0)
  })

  it('keeps claims scoped and unions explicit markers without duplication', () => {
    const one = claimTutorialAward(emptyProgressFacts(), identity, win, 1)
    const other = claimTutorialAward(emptyProgressFacts(), tutorialAwardIdentity('other-profile', FIXTURE_BOARD), win, 2)
    const merged = mergeProgressFacts(one.facts, other.facts)
    expect(Object.keys(merged.tutorialAwards)).toHaveLength(2)
    expect(merged.tutorialAwards[tutorialAwardKey(identity)]).toBeDefined()
    expect(earnedPostcards(merged, FIXTURE_BOARD)).toBe(2)
  })

  it('treats a legacy export without a marker as unknown, while local proof still blocks reminting', () => {
    const known = claimTutorialAward(emptyProgressFacts(), identity, win, 1).facts
    const legacyIncoming = emptyProgressFacts()
    const retained = mergeProgressFacts(known, legacyIncoming)
    expect(claimTutorialAward(retained, identity, { ...win, attemptId: 'after-old-import' }, 2).status).toBe('already-held')
    expect(claimTutorialAward(legacyIncoming, identity, { ...win, attemptId: 'new-on-unknown-device' }, 2).status).toBe('new')
  })
})
