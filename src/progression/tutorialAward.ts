import { evaluateAttempt } from './rules'
import { cityKey, tutorialAwardKey } from './identity'
import { emptyProgressFacts, mergeProgressFacts } from './facts'
import type { AttemptEvidence, CityIdentity, ProgressFacts, TutorialAwardFact, TutorialAwardIdentity } from './types'

export type TutorialAwardResult =
  | { readonly status: 'new'; readonly postcards: 1; readonly facts: ProgressFacts }
  | { readonly status: 'already-held'; readonly postcards: 0; readonly facts: ProgressFacts }
  | { readonly status: 'not-eligible'; readonly postcards: 0; readonly facts: ProgressFacts }

/** Stable local identity. This is deliberately opaque and never leaves local storage. */
export function profileKey(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const key = 'cluecab-profile-v1'
  const existing = storage.getItem(key)
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing
  const made = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  storage.setItem(key, made)
  return made
}

export function tutorialAwardIdentity(profile: string, city: CityIdentity, policyRevision = 'A1'): TutorialAwardIdentity {
  if (!profile.trim()) throw new Error('Missing profile key')
  return { profileKey: profile, courseId: city.courseId, cityId: city.cityId, policyRevision }
}

/**
 * Pure claim proposal. The caller commits the returned facts atomically before
 * showing dialogue; repeating the proposal after an uncertain write is safe.
 */
export function claimTutorialAward(facts: ProgressFacts, identity: TutorialAwardIdentity, attempt: AttemptEvidence, acceptedAt: number): TutorialAwardResult {
  if (attempt.origin !== 'tutorial' || !Number.isSafeInteger(acceptedAt) || acceptedAt < 0) return { status: 'not-eligible', postcards: 0, facts }
  const result = evaluateAttempt(attempt)
  if (result.status !== 'completed' || result.outcome !== 'won' || !attempt.game.wheel || attempt.game.wheel.result !== 'win') return { status: 'not-eligible', postcards: 0, facts }
  if (attempt.board && cityKey(attempt.board) !== cityKey(identity)) return { status: 'not-eligible', postcards: 0, facts }
  const key = tutorialAwardKey(identity)
  if (facts.tutorialAwards[key]) return { status: 'already-held', postcards: 0, facts }
  const award: TutorialAwardFact = { identity, sourceAttemptId: attempt.attemptId, acceptedAt }
  const next = mergeProgressFacts(facts, { ...emptyProgressFacts(), tutorialAwards: { [key]: award } })
  return { status: 'new', postcards: 1, facts: next }
}
