import { describe, expect, it } from 'vitest'
import { CLIP_RUN, evaluateClip, familyOf, measurePcm } from './audio-acoustics.mjs'

const SR = 48000
/** Silence, then a tone at `amplitude` for `voiceMs`, then silence. */
function clip({ leadMs = 60, voiceMs = 300, tailMs = 100, amplitude = 0.3, noise = 0 } = {}) {
  const n = (ms) => Math.round((SR * ms) / 1000)
  const out = new Float32Array(n(leadMs) + n(voiceMs) + n(tailMs))
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < out.length; i++) out[i] = noise * rand()
  for (let i = 0; i < n(voiceMs); i++) out[n(leadMs) + i] += amplitude * Math.sin((2 * Math.PI * 220 * i) / SR)
  return out
}

describe('measurePcm', () => {
  it('finds the voice where it starts, to the 5 ms window', () => {
    const m = measurePcm(clip({ leadMs: 120, voiceMs: 300, tailMs: 80 }), SR)
    expect(m.leadMs).toBe(120)
    expect(m.tailMs).toBe(80)
    expect(m.durationMs).toBe(500)
    expect(m.peakDbfs).toBeCloseTo(20 * Math.log10(0.3), 1)
  })

  it('reports no onset for a clip whose noise floor never clears -40 dBFS', () => {
    // The shape of the original «bo» and the rejected slow «ord»: bytes, a
    // duration, and nothing a listener can hear.
    const m = measurePcm(clip({ amplitude: 0.004, noise: 0.002 }), SR)
    expect(m.leadMs).toBeNull()
    expect(m.activeRmsDbfs).toBe(-Infinity)
  })

  it('does not call a long silent pad quiet speech', () => {
    const short = measurePcm(clip({ leadMs: 50 }), SR)
    const padded = measurePcm(clip({ leadMs: 900 }), SR)
    expect(padded.activeRmsDbfs).toBeCloseTo(short.activeRmsDbfs, 1)
  })

  it('counts consecutive full-scale samples, not single peaks', () => {
    const touching = clip({ amplitude: 1 })
    expect(measurePcm(touching, SR).longestClipRun).toBeLessThan(CLIP_RUN)
    const flattened = clip({ amplitude: 1 }).map((v) => Math.max(-1, Math.min(1, v * 4)))
    expect(measurePcm(flattened, SR).longestClipRun).toBeGreaterThanOrEqual(CLIP_RUN)
  })
})

describe('evaluateClip', () => {
  const ok = (rel, pcm = clip()) => evaluateClip(rel, measurePcm(pcm, SR))

  it('passes an ordinary, prompt, audible word', () => {
    expect(ok('hus.mp3')).toEqual([])
  })

  it('rejects silence, near-silence, a late start, clipping and truncation', () => {
    expect(ok('hus.mp3', clip({ amplitude: 0.004, noise: 0.002 })).join()).toMatch(/silent/)
    expect(ok('hus.mp3', clip({ amplitude: 0.04 })).join()).toMatch(/near-silent/)
    expect(ok('hus.mp3', clip({ leadMs: 700 })).join()).toMatch(/700ms of silence before the voice exceeds 300ms/)
    expect(ok('hus.mp3', clip({ amplitude: 1 }).map((v) => Math.max(-1, Math.min(1, v * 4)))).join()).toMatch(/clipped/)
    expect(ok('hus.mp3', clip({ leadMs: 10, voiceMs: 60, tailMs: 10 })).join()).toMatch(/truncated/)
    expect(evaluateClip('hus.mp3', { error: 'EncodingError' })).toEqual(['hus.mp3: could not decode (EncodingError)'])
  })

  it('rejects quiet speech that only a spike lifts over the peak floor', () => {
    // A voice at about -38 dBFS with one -20 dBFS click: the peak passes, the
    // speech level must not.
    const pcm = clip({ amplitude: 0.018 })
    for (let i = 0; i < 24; i++) pcm[Math.round(SR * 0.2) + i] = 0.1
    const m = measurePcm(pcm, SR)
    expect(m.peakDbfs).toBeGreaterThan(-25)
    expect(evaluateClip('hus.mp3', m).join()).toMatch(/speech level -3\d\.\d dBFS is at or below -32/)
  })

  it('holds sentences to their own lead limit and exempts nothing by family alone', () => {
    expect(ok('example/hus.mp3', clip({ leadMs: 500, voiceMs: 1500 }))).toEqual([])
    expect(ok('example/hus.mp3', clip({ leadMs: 700, voiceMs: 1500 })).join()).toMatch(/exceeds 600ms/)
    expect(familyOf('city1/board/ord/v1/slow.mp3')).toBe('sentence')
    expect(familyOf('slow/ord.mp3')).toBe('word')
    expect(familyOf('story/slow/0-001.mp3')).toBe('retired')
  })

  it('keeps a documented outlier only at its measured value', () => {
    const exceptions = { 'rejse.mp3': { leadMs: 820 } }
    expect(evaluateClip('rejse.mp3', measurePcm(clip({ leadMs: 820 }), SR), { exceptions })).toEqual([])
    expect(evaluateClip('rejse.mp3', measurePcm(clip({ leadMs: 900 }), SR), { exceptions }).join()).toMatch(/moved from 820ms to 900ms/)
    expect(evaluateClip('rejse.mp3', measurePcm(clip({ leadMs: 80 }), SR), { exceptions }).join()).toMatch(/no longer applies/)
  })

  it('keeps a documented silent file only while it is still silent', () => {
    const exceptions = { 'survival/x.mp3': { silent: true } }
    expect(evaluateClip('survival/x.mp3', measurePcm(clip({ amplitude: 0.004, noise: 0.002, voiceMs: 400 }), SR), { exceptions })).toEqual([])
    expect(evaluateClip('survival/x.mp3', measurePcm(clip({ voiceMs: 400 }), SR), { exceptions }).join()).toMatch(/remove the exception/)
  })

  it('catches an onset map that no longer describes the bytes', () => {
    // The player seeks by the map: a stale 40 ms entry on a clip whose voice
    // now starts at 65 ms would start it 25 ms late on top of its pre-roll.
    expect(evaluateClip('slow/ord.mp3', measurePcm(clip({ leadMs: 65 }), SR), { leadMap: { 'slow/ord.mp3': 40 } }).join())
      .toMatch(/measured onset 65ms disagrees with audio-lead map 40ms/)
    expect(evaluateClip('slow/ord.mp3', measurePcm(clip({ leadMs: 65 }), SR), { leadMap: { 'slow/ord.mp3': 65 } })).toEqual([])
  })
})
