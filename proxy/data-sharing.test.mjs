import { describe, expect, it } from 'vitest'
import {
  DATA_SHARING_PATH,
  DIAGNOSTIC_TTL_SECONDS,
  LEARNING_TTL_SECONDS,
  handleDataSharing,
  parseDataSharingEvent,
} from './data-sharing.js'

const base = {
  protocol: 1,
  eventId: 'event_12345678',
  kind: 'round',
  sharing: 'diagnostics',
  at: 1_777_000_000_000,
  language: 'da',
  cityIndex: 0,
  mode: 'wrapup',
  result: 'won',
  reason: 'all-green',
  boardSize: 18,
  turns: 4,
  lookedUpCount: 2,
  packedCount: 10,
  wrappedCount: 8,
  newlyLearnedCount: 1,
  newlyDiscoveredCount: 0,
}
const learning = {
  ...base,
  sharing: 'learning',
  examples: [{ by: 'player', clue: 'warm places', number: 2, guesses: [{ wordId: 'da:sol', result: 'green' }] }],
}

class FakeKv {
  store = new Map()
  puts = []
  async put(key, value, options) { this.store.set(key, value); this.puts.push({ key, value, options }) }
  async delete(key) { this.store.delete(key) }
  async list({ prefix }) {
    return { keys: [...this.store.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }
  }
}
const request = (method, body) => new Request(`https://casey.example${DATA_SHARING_PATH}`, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Install-Id': 'install_12345678' },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

describe('H10 receiving boundary', () => {
  it('keeps diagnostics schema closed against content', () => {
    expect(parseDataSharingEvent(base)).toEqual(base)
    expect(parseDataSharingEvent({ ...base, clue: 'private words' })).toBeNull()
    expect(parseDataSharingEvent({ ...base, examples: [] })).toBeNull()
  })

  it('accepts only the named learning example fields', () => {
    expect(parseDataSharingEvent(learning)).toEqual(learning)
    expect(parseDataSharingEvent({ ...learning, examples: [{ ...learning.examples[0], email: 'x@y.test' }] })).toBeNull()
  })

  it('uses a dedicated store with mode-specific automatic expiry', async () => {
    const kv = new FakeKv()
    expect((await handleDataSharing(request('POST', base), { DATA_SHARING: kv }, {})).status).toBe(202)
    expect(kv.puts[0].options.expirationTtl).toBe(DIAGNOSTIC_TTL_SECONDS)
    expect((await handleDataSharing(request('POST', learning), { DATA_SHARING: kv }, {})).status).toBe(202)
    expect(kv.puts[1].options.expirationTtl).toBe(LEARNING_TTL_SECONDS)
  })

  it('deletes every event for this random installation and no other', async () => {
    const kv = new FakeKv()
    kv.store.set('h10:install_12345678:a', '{}')
    kv.store.set('h10:install_12345678:b', '{}')
    kv.store.set('h10:someone_else:c', '{}')
    expect((await handleDataSharing(request('DELETE'), { DATA_SHARING: kv }, {})).status).toBe(204)
    expect([...kv.store.keys()]).toEqual(['h10:someone_else:c'])
  })

  it('fails closed when dedicated storage or a valid install id is absent', async () => {
    expect((await handleDataSharing(request('POST', base), {}, {})).status).toBe(503)
    const bad = new Request(`https://casey.example${DATA_SHARING_PATH}`, { method: 'DELETE' })
    expect((await handleDataSharing(bad, { DATA_SHARING: new FakeKv() }, {})).status).toBe(400)
  })
})
