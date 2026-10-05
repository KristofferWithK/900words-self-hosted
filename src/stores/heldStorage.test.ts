import { describe, expect, it } from 'vitest'
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { holdableStorage } from './heldStorage'

function fake() {
  const stored = new Map<string, StorageValue<number>>()
  const writes: [string, number][] = []
  const inner: PersistStorage<number> = {
    getItem: (name) => stored.get(name) ?? null,
    setItem: (name, value) => {
      writes.push([name, value.state])
      stored.set(name, value)
    },
    removeItem: (name) => void stored.delete(name),
  }
  return { inner, writes, stored }
}
const v = (state: number): StorageValue<number> => ({ state, version: 1 })

describe('a holdable persist storage', () => {
  it('writes straight through outside a hold', () => {
    const f = fake()
    const h = holdableStorage(f.inner)
    h.storage!.setItem('k', v(1))
    h.storage!.setItem('k', v(2))
    expect(f.writes).toEqual([['k', 1], ['k', 2]])
  })

  it('coalesces a hold into one write of the last state, and a read inside sees it', () => {
    const f = fake()
    const h = holdableStorage(f.inner)
    const out = h.hold(() => {
      h.storage!.setItem('k', v(1))
      h.storage!.setItem('k', v(2))
      h.storage!.setItem('k', v(3))
      expect(f.writes).toEqual([])
      expect(h.storage!.getItem('k')).toEqual(v(3))
      return 'done'
    })
    expect(out).toBe('done')
    expect(f.writes).toEqual([['k', 3]])
    expect(h.writes).toBe(1)
  })

  it('nested holds write once, when the outermost ends; a hold that throws still writes', () => {
    const f = fake()
    const h = holdableStorage(f.inner)
    h.hold(() => {
      h.storage!.setItem('k', v(1))
      h.hold(() => h.storage!.setItem('k', v(2)))
      expect(f.writes).toEqual([])
    })
    expect(f.writes).toEqual([['k', 2]])
    expect(() =>
      h.hold(() => {
        h.storage!.setItem('k', v(5))
        throw new Error('mid-batch')
      }),
    ).toThrow('mid-batch')
    expect(f.writes).toEqual([['k', 2], ['k', 5]])
  })

  it('a hold with nothing set writes nothing; no storage at all passes through', () => {
    const f = fake()
    const h = holdableStorage(f.inner)
    h.hold(() => {})
    expect(f.writes).toEqual([])
    const none = holdableStorage<number>(undefined)
    expect(none.storage).toBeUndefined()
    expect(none.hold(() => 7)).toBe(7)
  })
})
