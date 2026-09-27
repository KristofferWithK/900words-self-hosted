import { describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

const event = {
  protocol: 1,
  eventId: 'route_12345678',
  kind: 'round',
  sharing: 'diagnostics',
  at: 1_777_000_000_000,
  language: 'da',
  cityIndex: 0,
  mode: 'normal',
  result: 'won',
  reason: 'all-green',
  boardSize: 18,
  turns: 4,
  lookedUpCount: 0,
  packedCount: 0,
  wrappedCount: 0,
  newlyLearnedCount: 2,
  newlyDiscoveredCount: 3,
}

const request = (method, body) => new Request('https://casey.example/v1/data-sharing/events', {
  method,
  headers: {
    Origin: 'capacitor://localhost',
    'Content-Type': 'application/json',
    'X-Install-Id': 'install_12345678',
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

describe('H10 Worker route integration', () => {
  it('routes optional events to dedicated storage without a model request', async () => {
    const data = {
      put: vi.fn(async () => {}),
      list: vi.fn(async () => ({ keys: [], list_complete: true })),
      delete: vi.fn(async () => {}),
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('model must not be called') }))
    const response = await worker.fetch(request('POST', event), {
      ALLOWED_ORIGIN: 'capacitor://localhost',
      DATA_SHARING: data,
    })
    expect(response.status).toBe(202)
    expect(data.put).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('advertises DELETE in the browser preflight', async () => {
    const response = await worker.fetch(request('OPTIONS'), {
      ALLOWED_ORIGIN: 'capacitor://localhost',
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('DELETE')
  })
})
