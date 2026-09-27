import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STATS_BATCH, flushStats, pendingStats, track, useStatsPorts, type StatsPorts } from './stats'

describe('anonymous usage counters', () => {
  const sent: { url: string; body: string }[] = []
  let enabled = true
  const ports: StatsPorts = {
    enabled: () => enabled,
    baseUrl: () => 'https://casey.example/v1',
    send: (url, body) => void sent.push({ url, body }),
    build: () => 'b70',
    platform: () => 'ios',
  }
  beforeEach(() => {
    sent.length = 0
    enabled = true
    useStatsPorts(ports)
  })
  afterEach(() => useStatsPorts(null))

  it('carries no identifier of any kind — that is what lets it be on by default', () => {
    track({ name: 'app_open' })
    track({ name: 'round_end', city: 0, mode: 'normal', outcome: 'won', kind: 'all-greens', n: 5 })
    flushStats()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe('https://casey.example/v1/stats')
    const batch = JSON.parse(sent[0]!.body)
    expect(Object.keys(batch).sort()).toEqual(['build', 'events', 'lang', 'platform', 'protocol'])
    expect(JSON.stringify(batch)).not.toMatch(/install|device|session|id"/i)
    expect(batch.events).toEqual([
      { name: 'app_open' },
      { name: 'round_end', city: 0, mode: 'normal', outcome: 'won', kind: 'all-greens', n: 5 },
    ])
  })

  it('is silent when the switch is off, and drops what was queued rather than sending it later', () => {
    track({ name: 'app_open' })
    enabled = false
    track({ name: 'round_start', mode: 'normal' })
    flushStats()
    expect(sent).toHaveLength(0)
    expect(pendingStats()).toHaveLength(0)
  })

  it('keeps every field to the Worker’s shape and drops the rest', () => {
    // @ts-expect-error — an unknown name is dropped, not sent
    track({ name: 'clue_text', kind: 'hund' })
    track({ name: 'casey_error', kind: 'Not A Kind!', outcome: 'x'.repeat(40), n: -1, city: 99 })
    flushStats()
    const batch = JSON.parse(sent[0]!.body)
    expect(batch.events).toEqual([{ name: 'casey_error' }])
  })

  it('sends a full batch at once and never throws into the game', () => {
    for (let i = 0; i < STATS_BATCH; i++) track({ name: 'app_open' })
    expect(sent).toHaveLength(1)
    expect(pendingStats()).toHaveLength(0)
    useStatsPorts({ ...ports, send: () => { throw new Error('boom') } })
    expect(() => {
      for (let i = 0; i <= STATS_BATCH; i++) track({ name: 'app_open' })
    }).not.toThrow()
  })
})
