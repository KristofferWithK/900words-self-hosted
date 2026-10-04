import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'
import { REVIEW_ATTEMPTS_PER_ADDRESS, REVIEW_GRANT_MS, codesMatch } from './review-access.js'

const SECRET = 'correct-horse-battery-staple'

function kv() {
  const values = new Map()
  return {
    values,
    get: vi.fn(async (key) => values.get(key) ?? null),
    put: vi.fn(async (key, value) => void values.set(key, value)),
  }
}

const request = (body, { method = 'POST', address = '203.0.113.7', raw } = {}) =>
  new Request('https://casey.example/v1/review-access', {
    method,
    headers: { Origin: 'https://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': address },
    ...(method === 'POST' ? { body: raw ?? JSON.stringify(body) } : {}),
  })

const env = (patch = {}) => ({ ALLOWED_ORIGIN: 'capacitor://localhost, https://localhost', PLAY_REVIEW_ACCESS_CODE: SECRET, QUOTA: kv(), ...patch })

let logs
beforeEach(() => {
  logs = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('review access must never call a model') }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Google Play review access on the Worker', () => {
  it('grants 30 days for the right code, and only then', async () => {
    const before = Date.now()
    const response = await worker.fetch(request({ code: ` ${SECRET} ` }), env())
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()
    expect(body.granted).toBe(true)
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + REVIEW_GRANT_MS)
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + REVIEW_GRANT_MS)
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'granted'])
  })

  it('refuses a wrong code without saying anything about the right one', async () => {
    const response = await worker.fetch(request({ code: 'correct-horse' }), env())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'invalid_code' } })
  })

  it('never logs the code, right or wrong', async () => {
    await worker.fetch(request({ code: SECRET }), env())
    await worker.fetch(request({ code: 'guess-number-one' }), env())
    const logged = JSON.stringify(logs.mock.calls)
    expect(logged).not.toContain(SECRET)
    expect(logged).not.toContain('guess-number-one')
  })

  it('fails closed without the secret or without the QUOTA namespace', async () => {
    for (const patch of [{ PLAY_REVIEW_ACCESS_CODE: undefined }, { PLAY_REVIEW_ACCESS_CODE: '  ' }, { QUOTA: undefined }]) {
      const response = await worker.fetch(request({ code: SECRET }), env(patch))
      expect(response.status).toBe(503)
    }
  })

  it('fails closed when KV throws', async () => {
    const broken = { get: vi.fn(async () => { throw new Error('kv down') }), put: vi.fn() }
    const response = await worker.fetch(request({ code: SECRET }), env({ QUOTA: broken }))
    expect(response.status).toBe(503)
  })

  it('limits attempts per address per day, and counts wrong guesses', async () => {
    const shared = env()
    for (let i = 0; i < REVIEW_ATTEMPTS_PER_ADDRESS; i += 1) {
      expect((await worker.fetch(request({ code: `guess-${i}` }), shared)).status).toBe(401)
    }
    const blocked = await worker.fetch(request({ code: SECRET }), shared)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    // Another address still gets its own tries.
    expect((await worker.fetch(request({ code: SECRET }, { address: '198.51.100.2' }), shared)).status).toBe(200)
  })

  it('accepts only a JSON POST with a sensible code', async () => {
    expect((await worker.fetch(request(null, { method: 'GET' }), env())).status).toBe(405)
    expect((await worker.fetch(request(null, { raw: '{broken' }), env())).status).toBe(400)
    expect((await worker.fetch(request({ code: 42 }), env())).status).toBe(400)
    expect((await worker.fetch(request({ code: '' }), env())).status).toBe(400)
    expect((await worker.fetch(request({ code: 'x'.repeat(201) }), env())).status).toBe(400)
    expect((await worker.fetch(request(null, { raw: JSON.stringify({ code: 'x'.repeat(2000) }) }), env())).status).toBe(413)
  })

  it('serves only the app\'s origins, like every other route', async () => {
    const foreign = new Request('https://casey.example/v1/review-access', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: SECRET }),
    })
    expect((await worker.fetch(foreign, env())).status).toBe(403)
  })

  it('compares codes exactly', async () => {
    expect(await codesMatch(SECRET, SECRET)).toBe(true)
    expect(await codesMatch(`${SECRET} `, SECRET)).toBe(false)
    expect(await codesMatch(SECRET.toUpperCase(), SECRET)).toBe(false)
  })
})
