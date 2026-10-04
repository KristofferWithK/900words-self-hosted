import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { capacitor, build } = vi.hoisted(() => ({
  capacitor: { isNativePlatform: vi.fn(), getPlatform: vi.fn() },
  build: { audience: 'normal' as string },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

vi.mock('../build/audience', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../build/audience')>()
  return { ...actual, get buildAudience() { return build.audience } }
})

const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
  removeItem: (key: string) => void values.delete(key),
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const {
  REVIEW_ACCESS_KEY,
  REVIEW_GRANT_MS,
  readReviewGrant,
  reviewAccessActive,
  reviewAccessApplies,
  unlockReviewAccess,
} = await import('./reviewAccess')
const { OWNER_CASEY_URL } = await import('../ai/client')
const { usePass } = await import('./passStore')
const { BackupSchema } = await import('../backup/backup')

const NOW = 1_800_000_000_000
const answer = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

function on(platform: 'ios' | 'android' | 'web', audience = 'normal') {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
  build.audience = audience
}

beforeEach(() => {
  values.clear()
  on('android')
  usePass.setState({ status: 'not-entitled', productId: undefined })
})

describe('where review access exists', () => {
  it('is the Android store build only', () => {
    expect(reviewAccessApplies()).toBe(true)
    on('ios'); expect(reviewAccessApplies()).toBe(false)
    on('web'); expect(reviewAccessApplies()).toBe(false)
    on('android', 'developer'); expect(reviewAccessApplies()).toBe(false)
    on('android', 'open-source'); expect(reviewAccessApplies()).toBe(false)
  })

  it('cannot affect iOS: no request, and a stored grant is ignored there', async () => {
    on('ios')
    const fetcher = answer(200, { granted: true, expiresAt: NOW + REVIEW_GRANT_MS })
    expect(await unlockReviewAccess('the-code', fetcher, storage, () => NOW)).toEqual({ outcome: 'unavailable' })
    expect(fetcher).not.toHaveBeenCalled()
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: Date.now() + 1000 }))
    expect(reviewAccessActive()).toBe(false)
  })
})

describe('unlocking', () => {
  it('asks the owner Worker, and a valid answer unlocks only the daily limit', async () => {
    const fetcher = answer(200, { granted: true, expiresAt: NOW + REVIEW_GRANT_MS })
    const result = await unlockReviewAccess('  the-code  ', fetcher, storage, () => NOW)
    expect(result).toEqual({ outcome: 'granted', grant: { expiresAt: NOW + REVIEW_GRANT_MS } })
    const [url, init] = vi.mocked(fetcher).mock.calls[0]!
    expect(url).toBe(`${OWNER_CASEY_URL}/review-access`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ code: 'the-code' })
    // The grant is its own record: no product, no receipt, no Pass status.
    expect(JSON.parse(values.get(REVIEW_ACCESS_KEY)!)).toEqual({ expiresAt: NOW + REVIEW_GRANT_MS })
    expect(values.get(REVIEW_ACCESS_KEY)).not.toMatch(/product|pass\.|receipt|transaction/i)
    expect(usePass.getState().status).toBe('not-entitled')
    expect(usePass.getState().productId).toBeUndefined()
  })

  it('does not unlock on a wrong code', async () => {
    for (const status of [401, 403]) {
      expect(await unlockReviewAccess('wrong', answer(status, { error: { code: 'invalid_code' } }), storage, () => NOW))
        .toEqual({ outcome: 'invalid' })
    }
    expect(values.has(REVIEW_ACCESS_KEY)).toBe(false)
  })

  it('does not even ask about an empty or absurd code', async () => {
    const fetcher = answer(200, { granted: true, expiresAt: NOW + REVIEW_GRANT_MS })
    expect(await unlockReviewAccess('   ', fetcher, storage, () => NOW)).toEqual({ outcome: 'invalid' })
    expect(await unlockReviewAccess('x'.repeat(201), fetcher, storage, () => NOW)).toEqual({ outcome: 'invalid' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fails closed on every backend failure', async () => {
    const cases: Array<[typeof fetch, string]> = [
      [answer(429, { error: { code: 'rate_limited' } }), 'rate-limited'],
      [answer(503, { error: { code: 'not_configured' } }), 'error'],
      [answer(500), 'error'],
      [vi.fn(async () => { throw new TypeError('offline') }) as unknown as typeof fetch, 'error'],
      [vi.fn(async () => new Response('not json', { status: 200 })) as unknown as typeof fetch, 'error'],
      [answer(200, { granted: false }), 'error'],
      [answer(200, { granted: true }), 'error'],
      [answer(200, { granted: true, expiresAt: NOW - 1 }), 'error'],
      // A grant longer than the Worker ever issues is not the Worker's.
      [answer(200, { granted: true, expiresAt: NOW + 10 * REVIEW_GRANT_MS }), 'error'],
    ]
    for (const [fetcher, outcome] of cases) {
      expect(await unlockReviewAccess('the-code', fetcher, storage, () => NOW)).toEqual({ outcome })
    }
    expect(values.has(REVIEW_ACCESS_KEY)).toBe(false)
  })
})

describe('the stored grant', () => {
  it('counts only while it runs, and only in its own shape', () => {
    values.set(REVIEW_ACCESS_KEY, JSON.stringify({ expiresAt: NOW + 1000 }))
    expect(readReviewGrant(storage, NOW)).toEqual({ expiresAt: NOW + 1000 })
    expect(readReviewGrant(storage, NOW + 1000)).toBeNull()
    for (const raw of ['true', '{broken', '{}', JSON.stringify({ expiresAt: 'soon' })]) {
      values.set(REVIEW_ACCESS_KEY, raw)
      expect(readReviewGrant(storage, NOW)).toBeNull()
    }
  })

  it('never travels in a backup file', () => {
    const fields = JSON.stringify(Object.keys(BackupSchema.shape))
    expect(fields).not.toMatch(/review|access|grant/i)
    const backupDir = join(process.cwd(), 'src/backup')
    for (const file of readdirSync(backupDir).filter((name) => name.endsWith('.ts'))) {
      expect(readFileSync(join(backupDir, file), 'utf8')).not.toContain(REVIEW_ACCESS_KEY)
    }
  })
})
