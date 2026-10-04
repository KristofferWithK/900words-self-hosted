import { describe, expect, it } from 'vitest'
import { CLOUD_TALL, H, HUD_BOTTOM, runFrame, skyLayout, SKYLINE_TALL, stageSize, W } from './draw'

/** Phones as CSS px (the stage area: the screen less the status bar's inset, which the body keeps). */
const phones: [string, number, number, number][] = [
  ['360 x 640, no home indicator', 360, 640, 0],
  ['390 x 844', 390, 844, 0],
  ['390 x 844 with a 34 px home indicator', 390, 844, 34],
  ['430 x 932', 430, 932, 0],
  ['430 x 932 with a 34 px home indicator', 430, 932, 34],
]

describe('the taller scene (option C)', () => {
  it('is the prototype frame on a 480 x 800 screen', () => {
    const f = runFrame(480, 800)
    expect(f).toMatchObject({ height: H, sky: 0, inset: 0, horizon: 150, casey: 690 })
    expect(stageSize(480, 800)).toEqual({ w: 480, h: 800 })
  })

  it.each(phones)('keeps the perspective and shares the extra height evenly on %s', (_name, w, h, inset) => {
    const stage = stageSize(w, h, inset)
    expect(stage).toEqual({ w, h })
    const f = runFrame(stage.w, stage.h, inset)
    expect(f.height).toBeCloseTo((h * W) / w, 6)
    // Horizon to Casey as in the prototype.
    expect(f.casey - f.horizon).toBeCloseTo(540, 9)
    // As much new sky above the horizon as new road below Casey, over the safe part.
    const skyGained = f.horizon - 150
    const roadGained = f.height - f.inset - f.casey - 110
    expect(skyGained).toBeCloseTo(roadGained, 9)
    expect(skyGained).toBeGreaterThan(0)
    // Casey stands at least the prototype's 110 units above the home indicator.
    expect(f.height - f.inset - f.casey).toBeGreaterThanOrEqual(110)
    expect(f.inset).toBeCloseTo((inset * W) / w, 6)
  })

  it('keeps Casey as high above a home indicator as on the same phone without one, less the indicator', () => {
    const withBar = runFrame(390, 844, 34)
    const shorter = runFrame(390, 810, 0)
    expect(withBar.sky).toBeCloseTo(shorter.sky, 9)
    expect(withBar.casey).toBeCloseTo(shorter.casey, 9)
  })

  it('letterboxes sideways on a screen wider than the frame, against the safe height', () => {
    expect(stageSize(480, 768)).toEqual({ w: 460, h: 768 })
    expect(stageSize(480, 834, 34)).toEqual({ w: 480, h: 834 })
    expect(stageSize(480, 700, 20)).toEqual({ w: 408, h: 700 })
    // Never shorter than the prototype's frame in game units.
    const f = runFrame(408, 700, 20)
    expect(f.height - f.inset).toBeGreaterThanOrEqual(H - 1e-9)
  })
})

describe('the sky over a taller scene', () => {
  it.each([...phones, ['480 x 800', 480, 800, 0] as [string, number, number, number]])(
    'never reaches the bar on %s',
    (_name, w, h, inset) => {
      const f = runFrame(w, h, inset)
      const sky = skyLayout(f)
      if (sky.skylineScale > 0) {
        expect(sky.skylineTop).toBeGreaterThan(HUD_BOTTOM + 10)
        expect(sky.skylineScale).toBeLessThanOrEqual(1)
      }
      for (const c of sky.clouds) {
        expect(c.y - CLOUD_TALL).toBeGreaterThan(HUD_BOTTOM + 10)
        expect(c.y).toBeLessThan(sky.skylineTop)
        expect(c.x - c.w / 2).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w / 2 + 6).toBeLessThanOrEqual(W)
      }
    },
  )

  it('is empty on the prototype frame, where there is no extra sky', () => {
    const sky = skyLayout(runFrame(480, 800))
    expect(sky.skylineScale).toBe(0)
    expect(sky.clouds).toEqual([])
  })

  it('shows the town on a small phone, smaller if it must, and the town and three clouds on a tall one', () => {
    const small = skyLayout(runFrame(360, 640))
    expect(small.skylineScale).toBeGreaterThan(0)
    for (const [w, h] of [[390, 844], [430, 932]]) {
      const sky = skyLayout(runFrame(w, h))
      expect(sky.skylineScale).toBe(1)
      expect(sky.clouds).toHaveLength(3)
    }
    // The spire is the tallest thing in the town, and the town stays low.
    expect(SKYLINE_TALL).toBeGreaterThan(30)
    expect(SKYLINE_TALL).toBeLessThan(70)
  })
})
