import { describe, expect, it } from 'vitest'
import { MemoryStorage, installMemoryStorage } from './installMemoryStorage'

describe('the web demo keeps storage in memory', () => {
  it('is a complete Storage: get, set, remove, key, length, clear', () => {
    const storage = new MemoryStorage()
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    expect(storage.getItem('a')).toBe('1')
    expect(storage.getItem('missing')).toBeNull()
    expect(storage.length).toBe(2)
    expect(storage.key(1)).toBe('b')
    expect(storage.key(9)).toBeNull()
    storage.removeItem('a')
    expect(storage.length).toBe(1)
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('replaces both globals on its target, so a write never reaches the real storage', () => {
    const real = new Map<string, string>()
    const target: Record<string, unknown> = {
      localStorage: { setItem: (k: string, v: string) => void real.set(k, v) },
      sessionStorage: {},
    }
    installMemoryStorage(target)
    ;(target.localStorage as Storage).setItem('cluecab-game-v1', '{}')
    expect(real.size).toBe(0)
    expect((target.localStorage as Storage).getItem('cluecab-game-v1')).toBe('{}')
    expect(target.sessionStorage).toBeInstanceOf(MemoryStorage)
  })

  it('is idempotent: a second install keeps the same memory', () => {
    const target: Record<string, unknown> = {}
    installMemoryStorage(target)
    ;(target.localStorage as Storage).setItem('k', 'v')
    installMemoryStorage(target)
    expect((target.localStorage as Storage).getItem('k')).toBe('v')
  })

  it('fails closed when the global cannot be replaced', () => {
    const target: Record<string, unknown> = {}
    Object.defineProperty(target, 'localStorage', { configurable: false, value: {} })
    expect(() => installMemoryStorage(target)).toThrow()
  })
})
