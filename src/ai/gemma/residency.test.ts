import { beforeEach, describe, expect, it, vi } from 'vitest'

const { unload } = vi.hoisted(() => ({ unload: vi.fn() }))
vi.mock('./native', () => ({ unloadGemma: unload }))

import { offlineCaseyWanted, setOfflineCaseyWanted } from './residency'

/**
 * Offline Casey's model is about 3.4 GB in memory. It is put away the moment
 * nothing wants her, and only then: not on every render that repeats "not
 * wanted", and not between two moves of a round she is still playing.
 */
describe('offline Casey stays loaded only while she is wanted', () => {
  beforeEach(() => {
    setOfflineCaseyWanted(false)
    unload.mockReset()
    unload.mockResolvedValue(undefined)
  })

  it('puts her away when her round stops wanting her', () => {
    setOfflineCaseyWanted(true)
    expect(offlineCaseyWanted()).toBe(true)
    expect(unload).not.toHaveBeenCalled()
    setOfflineCaseyWanted(false)
    expect(offlineCaseyWanted()).toBe(false)
    expect(unload).toHaveBeenCalledTimes(1)
  })

  it('does not reload-churn: repeating either state asks nothing of the phone', () => {
    setOfflineCaseyWanted(false)
    expect(unload).not.toHaveBeenCalled()
    setOfflineCaseyWanted(true)
    setOfflineCaseyWanted(true)
    expect(unload).not.toHaveBeenCalled()
  })

  it('never lets a failed put-away reach the game', async () => {
    unload.mockRejectedValue(new Error('plugin gone'))
    setOfflineCaseyWanted(true)
    expect(() => setOfflineCaseyWanted(false)).not.toThrow()
    await Promise.resolve()
  })
})
