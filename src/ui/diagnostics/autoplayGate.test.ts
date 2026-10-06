import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The soak player is out of every player's reach: its key alone does nothing
 * in a normal-audience build away from a local dev host.
 */
const g = globalThis as unknown as Record<string, unknown>

afterEach(() => {
  delete g.localStorage
  vi.resetModules()
})

describe('the soak autoplay gate', { timeout: 60_000 }, () => {
  it('is off without its key', async () => {
    g.localStorage = { getItem: () => null }
    const { diagAutoplayOn } = await import('./autoplayGate')
    expect(diagAutoplayOn()).toBe(false)
  })

  it('stays off with the key in a normal build off a dev host', async () => {
    g.localStorage = { getItem: (k: string) => (k === 'cluecab-diag-autoplay' ? '1' : null) }
    const { diagAutoplayOn, diagRun, exposeRunForDiag } = await import('./autoplayGate')
    expect(diagAutoplayOn()).toBe(false)
    exposeRunForDiag({ state: { lane: 0, phase: 'play' }, activeGate: () => undefined })
    expect(diagRun()).toBeNull()
  })
})
