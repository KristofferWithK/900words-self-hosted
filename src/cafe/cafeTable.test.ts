import { describe, expect, it } from 'vitest'
import cafes from '../data/city1-cafe-names.da.json'
import {
  BOTTOM_SPOTS,
  DRAWINGS,
  EDGE_SPOTS,
  FALLBACK_DRAWING,
  ORDINARY_DRAWINGS,
  cafeArrangement,
  signatureDrawing,
} from './cafeTable'

describe('the café table (CW-08)', () => {
  it('keeps the drawing set small: fifteen, three of them ordinary', () => {
    expect(DRAWINGS.length).toBe(15)
    expect(new Set(DRAWINGS).size).toBe(DRAWINGS.length)
    expect(ORDINARY_DRAWINGS).toEqual(['cup', 'spoon', 'pencil'])
    expect(DRAWINGS).toContain(FALLBACK_DRAWING)
  })

  it('maps the signature items it was written for, and anything else to the postcard', () => {
    expect(signatureDrawing('a sun-shaped sugar bowl')).toBe('sun')
    expect(signatureDrawing('a seashell')).toBe('shell')
    expect(signatureDrawing('a cat basket')).toBe('paw')
    expect(signatureDrawing('a single flower in a vase')).toBe('flower')
    expect(signatureDrawing('a big old key')).toBe('key')
    expect(signatureDrawing('a paper boat')).toBe('boat')
    expect(signatureDrawing('something nobody wrote a rule for')).toBe('card')
  })

  it('gives every Sønderborg café a signature drawing, most of them not the fallback', () => {
    const counts = new Map<string, number>()
    for (const cafe of cafes.names) {
      const drawing = signatureDrawing(cafe.signatureItem)
      expect(DRAWINGS).toContain(drawing)
      expect(ORDINARY_DRAWINGS).not.toContain(drawing)
      counts.set(drawing, (counts.get(drawing) ?? 0) + 1)
    }
    // Every signature drawing is used by at least one café.
    for (const drawing of DRAWINGS) if (!ORDINARY_DRAWINGS.includes(drawing)) expect(counts.get(drawing) ?? 0).toBeGreaterThan(0)
    // 34 of 100 today (CW-08 report); more drawings would bring it down.
    expect(counts.get(FALLBACK_DRAWING) ?? 0).toBeLessThan(cafes.names.length * 0.4)
    expect(signatureDrawing('a butterfly')).toBe(FALLBACK_DRAWING)
  })

  it('is the same arrangement every time for the same café, and differs between cafés', () => {
    const solen = cafes.names[0]!
    expect(cafeArrangement(solen)).toEqual(cafeArrangement(solen))
    const layouts = new Set(cafes.names.map((cafe) => JSON.stringify({ ...cafeArrangement(cafe), cafeId: '', signature: '' })))
    expect(layouts.size).toBeGreaterThan(cafes.names.length * 0.9)
  })

  it('only uses the known spots, one item per spot, with the signature on the table twice', () => {
    for (const cafe of cafes.names) {
      const table = cafeArrangement(cafe)
      expect(table.edges).toHaveLength(3)
      expect(table.bottom).toHaveLength(2)
      for (const item of table.edges) expect(EDGE_SPOTS).toContain(item.spot)
      for (const item of table.bottom) expect(BOTTOM_SPOTS).toContain(item.spot)
      expect(new Set(table.edges.map((item) => item.spot)).size).toBe(3)
      expect(new Set(table.bottom.map((item) => item.spot)).size).toBe(2)
      expect(table.edges.filter((item) => item.signature).map((item) => item.drawing)).toEqual([table.signature])
      expect(table.bottom.find((item) => item.spot === 'bottom-large')).toMatchObject({ drawing: table.signature, signature: true })
      const ordinary = [...table.edges, ...table.bottom].filter((item) => !item.signature).map((item) => item.drawing)
      expect(new Set(ordinary).size).toBe(3)
      for (const item of [...table.edges, ...table.bottom]) {
        expect(Number.isInteger(item.turn)).toBe(true)
        expect(Math.abs(item.turn)).toBeLessThanOrEqual(30)
      }
    }
  })

  it('pins Café Solen, so a change to the generator is a visible decision', () => {
    expect(cafeArrangement(cafes.names[0]!)).toMatchSnapshot()
  })
})
