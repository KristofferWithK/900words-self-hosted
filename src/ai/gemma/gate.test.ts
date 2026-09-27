import { describe, expect, it } from 'vitest'
import { onDeviceCaseyAvailable, playsOnDevice, requestGemmaDecision } from './gate'

/**
 * Tests build like the web: no on-device Casey. Only the
 * developer and normal native builds (vite.config.ts, ON_DEVICE_CASEY) turn her on.
 */
describe('on-device Casey exists only in the native builds that carry her', () => {
  it('is absent from a build without her', () => {
    expect(onDeviceCaseyAvailable).toBe(false)
  })

  it('plays a saved Gemma choice with the Worker where she does not exist', () => {
    // A build without her, installed over one that had her, keeps its settings.
    expect(playsOnDevice('gemma4-e4b')).toBe(false)
    expect(playsOnDevice('worker')).toBe(false)
  })

  it('refuses a direct call rather than loading her chunk', async () => {
    await expect(requestGemmaDecision({ baseUrl: '' }, { protocol: 1, operation: 'ping' })).rejects.toMatchObject({
      kind: 'server',
    })
  })
})
