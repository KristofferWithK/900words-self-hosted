import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Sha256 } from './sha256'

/** Desktop Gemma's download is checked chunk by chunk against its pinned hash. */
describe('SHA-256 fed in pieces', () => {
  it('matches the standard vectors', () => {
    expect(new Sha256().hex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(new Sha256().update(new TextEncoder().encode('abc')).hex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('gives the same digest however the bytes are split, at every padding boundary', () => {
    for (const size of [55, 56, 63, 64, 65, 119, 120, 127, 128, 1000, 70_001]) {
      const data = randomBytes(size)
      const expected = createHash('sha256').update(data).digest('hex')
      const hash = new Sha256()
      let offset = 0
      for (const step of [1, 7, 64, 3, 129]) {
        if (offset >= size) break
        hash.update(data.subarray(offset, offset + step))
        offset += step
      }
      hash.update(data.subarray(offset))
      expect(hash.hex(), `${size} bytes`).toBe(expected)
    }
  })
})
