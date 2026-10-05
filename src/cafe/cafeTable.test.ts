import { describe, expect, it } from 'vitest'
import cafes from '../data/city1-cafe-names.da.json'
import {
  COMPANIONS,
  DRAWINGS,
  FALLBACK_DRAWING,
  LONG_DRAWINGS,
  ORDINARY_DRAWINGS,
  SPOTS,
  SPOT_IDS,
  cafeArrangement,
  signatureDrawing,
} from './cafeTable'

describe('the café table (CW-08)', () => {
  it('keeps the drawing set small: eighteen, five of them ordinary', () => {
    expect(DRAWINGS.length).toBe(18)
    expect(new Set(DRAWINGS).size).toBe(DRAWINGS.length)
    expect(ORDINARY_DRAWINGS).toEqual(['cup', 'spoon', 'pencil', 'plate', 'lamp'])
    for (const long of Object.keys(LONG_DRAWINGS)) expect(ORDINARY_DRAWINGS).toContain(long)
    expect(DRAWINGS).toContain(FALLBACK_DRAWING)
    for (const companion of Object.values(COMPANIONS)) expect(DRAWINGS).toContain(companion)
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
    // Every signature drawing (not the ordinary things, not a companion) is used by at least one café.
    const companions = new Set(Object.values(COMPANIONS))
    for (const drawing of DRAWINGS) {
      if (!ORDINARY_DRAWINGS.includes(drawing) && !companions.has(drawing)) expect(counts.get(drawing) ?? 0).toBeGreaterThan(0)
    }
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

  it('lays six items, one per spot: three behind the board, three in the bottom area', () => {
    for (const cafe of cafes.names) {
      const table = cafeArrangement(cafe)
      expect(table.items).toHaveLength(6)
      for (const item of table.items) {
        expect(SPOT_IDS).toContain(item.spot)
        expect(item.region).toBe(SPOTS[item.spot].region)
        // Near its spot: a few percent of jitter, never a different place.
        expect(Math.abs(item.x - SPOTS[item.spot].x)).toBeLessThanOrEqual(3)
        expect(Math.abs(item.y - SPOTS[item.spot].y)).toBeLessThanOrEqual(4)
        expect(Math.abs(item.size - SPOTS[item.spot].size)).toBeLessThanOrEqual(4)
        expect(Number.isInteger(item.turn)).toBe(true)
      }
      expect(new Set(table.items.map((item) => item.spot)).size).toBe(6)
      expect(table.items.filter((item) => item.region === 'board')).toHaveLength(3)
      expect(table.items.filter((item) => item.region === 'bottom')).toHaveLength(3)
      // The signature lies on the table twice: at a board edge and in the corner.
      const signature = table.items.filter((item) => item.signature)
      expect(signature.map((item) => item.drawing)).toEqual([table.signature, table.signature])
      expect(signature.map((item) => item.spot).sort()).toEqual(expect.arrayContaining(['corner']))
      expect(signature.find((item) => item.region === 'board')?.spot).toMatch(/^(left|right)-/)
      // The ordinary things on one table are different things.
      const ordinary = table.items.filter((item) => ORDINARY_DRAWINGS.includes(item.drawing)).map((item) => item.drawing)
      expect(new Set(ordinary).size).toBe(ordinary.length)
      // A long thing lies nearly level along the bottom.
      const along = table.items.find((item) => item.spot === 'along')!
      const level = LONG_DRAWINGS[along.drawing]!
      expect(Math.abs(along.turn - (along.flip ? -level : level))).toBeLessThanOrEqual(10)
      // The companion: the concept's yarn by the paws, starfish by the shell.
      const beside = table.items.find((item) => item.spot === 'beside')!.drawing
      const companion = COMPANIONS[table.signature]
      if (companion) expect(beside).toBe(companion)
      else expect(ORDINARY_DRAWINGS).toContain(beside)
    }
  })

  it('pins Café Solen, so a change to the generator is a visible decision', () => {
    expect(cafeArrangement(cafes.names[0]!)).toMatchSnapshot()
  })
})
