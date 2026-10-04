import { installId, OWNER_CASEY_URL } from '../ai/client'
import { buildAudience } from '../build/audience'
import { billingPlatform } from './pass'

/**
 * Google Play review access: how a Play reviewer gets past the daily limit
 * without buying anything (docs/store/daily-games.md, "Google Play review
 * access").
 *
 * It is NOT a purchase and never pretends to be one. It creates no receipt, no
 * product ID and no Pass status; Google Play stays the only authority for
 * paid Unlimited. It lifts the daily limit and nothing else.
 *
 * The code lives only in the Worker secret PLAY_REVIEW_ACCESS_CODE and in the
 * private Play Console instructions. The app sends what the reviewer typed and
 * keeps only the Worker's answer: a grant that ends 30 days after it was
 * issued. Rotating the secret stops new unlocks but cannot reach a grant
 * already on a phone; it simply runs out. That is proportionate because the
 * limit it lifts is device-local anyway: clearing app data resets it.
 */
export const REVIEW_ACCESS_KEY = 'cluecab-play-review-access'
export const REVIEW_ACCESS_PATH = 'review-access'
/** Mirrors the Worker's REVIEW_GRANT_MS; a stored grant claiming longer is not ours. */
export const REVIEW_GRANT_MS = 30 * 24 * 60 * 60 * 1000
const CLOCK_SLACK_MS = 24 * 60 * 60 * 1000
const MAX_CODE_LENGTH = 200
const REQUEST_TIMEOUT_MS = 15_000

export interface ReviewGrant {
  expiresAt: number
}

export type ReviewUnlockResult =
  | { outcome: 'granted'; grant: ReviewGrant }
  | { outcome: 'invalid' | 'rate-limited' | 'error' | 'unavailable' }

/** Only the Android store build has reviewers to let in. iOS, the web and every other audience never do. */
export function reviewAccessApplies(): boolean {
  return buildAudience === 'normal' && billingPlatform() === 'android'
}

/** A grant the Worker could have issued, still running. Anything else reads as none. */
export function validGrant(value: unknown, now = Date.now()): ReviewGrant | null {
  if (typeof value !== 'object' || value === null) return null
  const expiresAt = (value as { expiresAt?: unknown }).expiresAt
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
  if (expiresAt <= now || expiresAt > now + REVIEW_GRANT_MS + CLOCK_SLACK_MS) return null
  return { expiresAt }
}

export function readReviewGrant(storage: Pick<Storage, 'getItem'>, now = Date.now()): ReviewGrant | null {
  try {
    const raw = storage.getItem(REVIEW_ACCESS_KEY)
    return raw === null ? null : validGrant(JSON.parse(raw), now)
  } catch {
    return null
  }
}

/** Whether review access lifts the daily limit on this device right now. */
export function reviewAccessActive(now = Date.now()): boolean {
  if (!reviewAccessApplies()) return false
  try {
    return readReviewGrant(localStorage, now) !== null
  } catch {
    return false
  }
}

/**
 * Ask the owner's Worker whether this code is the review code. Every failure
 * (network, timeout, a malformed answer, a Worker without the secret) leaves
 * the limit where it was.
 */
export async function unlockReviewAccess(
  code: string,
  fetcher: typeof fetch = fetch,
  storage: Pick<Storage, 'setItem'> = localStorage,
  now = () => Date.now(),
): Promise<ReviewUnlockResult> {
  if (!reviewAccessApplies()) return { outcome: 'unavailable' }
  const trimmed = code.trim()
  if (trimmed === '' || trimmed.length > MAX_CODE_LENGTH) return { outcome: 'invalid' }
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null
  try {
    const response = await fetcher(new URL(REVIEW_ACCESS_PATH, `${OWNER_CASEY_URL.replace(/\/+$/, '')}/`).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId() },
      body: JSON.stringify({ code: trimmed }),
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (response.status === 401 || response.status === 403) return { outcome: 'invalid' }
    if (response.status === 429) return { outcome: 'rate-limited' }
    if (!response.ok) return { outcome: 'error' }
    const body = await response.json() as { granted?: unknown; expiresAt?: unknown }
    const grant = body?.granted === true ? validGrant({ expiresAt: body.expiresAt }, now()) : null
    if (!grant) return { outcome: 'error' }
    storage.setItem(REVIEW_ACCESS_KEY, JSON.stringify(grant))
    return { outcome: 'granted', grant }
  } catch {
    return { outcome: 'error' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
