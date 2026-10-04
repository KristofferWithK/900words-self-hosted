import { describe, expect, it } from 'vitest'
import { HUD_WORD_MIN, HUD_WORD_SIZE, HUD_WORD_TWO_LINES, hudWordLayout, hudWordRoom, W } from './draw'

/**
 * The bar's word between the photo block and the best block (coordinator,
 * 2026-10-04: French "bonjour (le matin)" ran into the camera at 206 photos).
 * Widths are generous stand-ins for the real type: a bold serif letter is at
 * most 0.62 of its size wide, a bold digit in the 24 sans 14.4 units.
 */
const serif = (s: string) => [...s].length * 0.62
const digits = (n: number) => String(n).length * 14.4
/** The camera's far edge at the top of its jump, after a count `w` wide (draw.ts: 62 + w + 24 + 12 x 1.28). */
const cameraEdge = (w: number) => 62 + w + 24 + 12 * 1.28
/** The slips pill's left edge (draw.ts: the right column at 450, the pill 92 wide). */
const PILL_LEFT = W - 30 - 92

const LONG = ['bonjour (le matin)', 'dzień dobry (rano)', 'bom dia (de manhã)', 'ter permissão', 'il / elle', 'fram till', '是（过去式）', 'avoir le droit de faire quelque chose']

describe('the word in the bar', () => {
  for (const photos of [5, 42, 206, 999])
    for (const text of LONG) {
      it(`"${text}" at ${photos} photos stays clear of the camera and the best block`, () => {
        const room = hudWordRoom(digits(photos), digits(photos))
        expect(room.left).toBeGreaterThan(cameraEdge(digits(photos)))
        expect(room.right).toBeLessThan(PILL_LEFT)
        const fit = hudWordLayout(text, serif, room)
        for (const line of fit.lines) {
          const w = serif(line.text) * line.size
          expect(fit.x - w / 2, line.text).toBeGreaterThanOrEqual(room.left - 1e-9)
          expect(fit.x + w / 2, line.text).toBeLessThanOrEqual(room.right + 1e-9)
          // Under the small labels (their foot at 38) and above the progress line (99).
          expect(line.y - line.size * 0.6).toBeGreaterThanOrEqual(38)
          expect(line.y + line.size * 0.6).toBeLessThanOrEqual(99)
        }
        // Readable: one line no smaller than the minimum, or two lines.
        if (fit.lines.length === 1) expect(fit.lines[0].size).toBeGreaterThanOrEqual(HUD_WORD_MIN)
        else {
          expect(fit.lines).toHaveLength(2)
          expect(fit.lines[0].size).toBeLessThanOrEqual(HUD_WORD_TWO_LINES)
          expect(fit.lines.map((l) => l.text).join(text.includes(' ') ? ' ' : '')).toBe(text)
        }
      })
    }

  it('"bonjour (le matin)" at 206 photos is the case that ran into the camera: it no longer fits whole at full size', () => {
    const room = hudWordRoom(digits(206), digits(206))
    const fit = hudWordLayout('bonjour (le matin)', serif, room)
    expect(serif('bonjour (le matin)') * HUD_WORD_SIZE).toBeGreaterThan(room.right - room.left)
    expect(fit.lines.length === 2 || fit.lines[0].size < HUD_WORD_SIZE).toBe(true)
  })

  it('a short word stays full size, in the middle of the bar', () => {
    const fit = hudWordLayout('house', serif, hudWordRoom(digits(206), digits(206)))
    expect(fit.lines).toEqual([{ text: 'house', y: 64, size: HUD_WORD_SIZE }])
    expect(fit.x).toBe(240)
  })

  it('a long word that cannot break shrinks on its one line and still keeps its room', () => {
    const room = hudWordRoom(digits(206), digits(206))
    const fit = hudWordLayout('Donaudampfschifffahrtsgesellschaft', serif, room)
    expect(fit.lines).toHaveLength(1)
    expect(fit.width).toBeLessThanOrEqual(room.right - room.left + 1e-9)
  })
})
