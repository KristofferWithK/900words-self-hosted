import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '../../stores/settingsStore'
import { OSS_GEMMA_OFFERED_KEY, offerGemmaOnFirstRun } from './firstRun'
import type { GemmaStatus } from './native'

/**
 * A self-built iPhone 900words works out of the box with Gemma: the first
 * launch offers her download, once, with what the player needs to decide.
 */

const status = (overrides: Partial<GemmaStatus> = {}): GemmaStatus => ({
  supported: true,
  installed: false,
  downloading: false,
  progress: 0,
  expectedBytes: 2_969_059_328,
  freeBytes: 10_000_000_000,
  physicalMemory: 8_000_000_000,
  ...overrides,
})

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  useSettings.setState({ caseyMode: 'gemma4-e4b' })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the self-build’s first-run offer of offline Casey', () => {
  it('explains the download, the iPhones and the key alternative, then downloads on yes', async () => {
    const confirm = vi.fn((_text: string) => true)
    const download = vi.fn(async () => {})
    expect(await offerGemmaOnFirstRun(async () => status(), confirm, download)).toBe('offered')
    const text = confirm.mock.calls[0]![0] as string
    expect(text).toContain('3.0 GB')
    expect(text).toContain('iPhone 15 Pro')
    expect(text).toContain('iPhone 17 Pro Max')
    expect(text).not.toContain('less memory')
    expect(download).toHaveBeenCalledOnce()
    expect(store.has(OSS_GEMMA_OFFERED_KEY)).toBe(true)
  })

  it('warns on an iPhone with less memory than the listed ones', async () => {
    const confirm = vi.fn((_text: string) => false)
    await offerGemmaOnFirstRun(async () => status({ physicalMemory: 5_700_000_000 }), confirm, async () => {})
    expect(confirm.mock.calls[0]![0]).toContain('less memory')
  })

  it('downloads nothing when the player says not now, and does not ask again', async () => {
    const download = vi.fn(async () => {})
    await offerGemmaOnFirstRun(async () => status(), () => false, download)
    expect(download).not.toHaveBeenCalled()
    const confirm = vi.fn((_text: string) => true)
    expect(await offerGemmaOnFirstRun(async () => status(), confirm, download)).toBe('skipped')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('stays quiet when there is nothing to offer', async () => {
    const confirm = vi.fn((_text: string) => true)
    for (const s of [status({ installed: true }), status({ downloading: true }), status({ supported: false })]) {
      expect(await offerGemmaOnFirstRun(async () => s, confirm, async () => {})).toBe('skipped')
    }
    useSettings.setState({ caseyMode: 'own-key' })
    expect(await offerGemmaOnFirstRun(async () => status(), confirm, async () => {})).toBe('skipped')
    expect(confirm).not.toHaveBeenCalled()
  })
})
