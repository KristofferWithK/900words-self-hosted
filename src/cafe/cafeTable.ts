import type { Cafe } from './cafeName'

/**
 * The café table (docs/roadmap/cafe-world.md section 5): "faint pencil items
 * lie on the table behind the cards. Each café has one signature item from
 * its name plus a few ordinary things, in its own arrangement."
 *
 * This file decides WHAT lies on a café's table and WHERE, from the café's
 * identity alone, so a café looks the same every time it is opened and on
 * every device. How each item is drawn is `src/ui/components/CafeTable.tsx`;
 * how a spot sits on the screen is `src/styles/77-cafe-puzzle.css`.
 *
 * THE LOOK IN ONE PLACE: the drawing set, the signature rules and the spots
 * are the three tables below. Swapping a drawing for a café is an edit to
 * `SIGNATURE_RULES`; moving a spot is an edit to the stylesheet.
 */

/** Every drawing there is. Fifteen: three ordinary things, eleven signatures and a fallback. */
export const DRAWINGS = [
  // Ordinary table things, on every café's table in some arrangement.
  'cup',
  'spoon',
  'pencil',
  // Signature items, chosen from the café's name.
  'sun',
  'star',
  'shell',
  'paw',
  'flower',
  'leaf',
  'book',
  'key',
  'teapot',
  'cake',
  'boat',
  // The signature fallback: a postcard, for a name none of the above fits.
  'card',
] as const
export type DrawingId = (typeof DRAWINGS)[number]

export const ORDINARY_DRAWINGS: readonly DrawingId[] = ['cup', 'spoon', 'pencil']
export const FALLBACK_DRAWING: DrawingId = 'card'

/**
 * The signature item (the names file's English suggestion, `signatureItem`)
 * to a drawing: the first rule that matches wins, and a café no rule matches
 * gets the postcard. The suggestions are for an artist, so this is a reading
 * of them, not a translation; cafeTable.test.ts prints the coverage.
 */
export const SIGNATURE_RULES: readonly (readonly [RegExp, DrawingId])[] = [
  [/\bsun\b|rainbow/i, 'sun'],
  [/star|telescope|snow globe|moon/i, 'star'],
  [/shell|bucket and spade|beach ball/i, 'shell'],
  [/\bcat\b|\bdog\b/i, 'paw'],
  [/flower|plant|herbs|watering can/i, 'flower'],
  [/leaf|leaves|twig|pine cone|clover|mushroom|picnic|park bench|rope swing/i, 'leaf'],
  [/book|reading glasses|newspaper|town map|slate|globe|calendar/i, 'book'],
  [/\bkey\b|door knocker|welcome mat/i, 'key'],
  [/teapot|coffee pot|jug|thermos|grinder|teacups|cups on one tray|oversized cup/i, 'teapot'],
  [/cake|biscuit|cookie|meringue|\bbutter\b|egg cup|cheese/i, 'cake'],
  [/boat|ship|oars|lighthouse|lantern|fishing float|drawbridge|bridge/i, 'boat'],
]

export function signatureDrawing(signatureItem: string): DrawingId {
  for (const [pattern, drawing] of SIGNATURE_RULES) if (pattern.test(signatureItem)) return drawing
  return FALLBACK_DRAWING
}

/**
 * The spots a table item may lie in. Edge spots are the board's two side
 * margins, high, middle and low; an item there shows only in the screen's
 * gutter and never reaches a card's text or ⓘ. Bottom spots are the dock's
 * free lower right while Casey thinks (the only time the bottom area is not
 * in use); the large one holds the signature item.
 */
export const EDGE_SPOTS = ['left-high', 'left-mid', 'left-low', 'right-high', 'right-mid', 'right-low'] as const
export const BOTTOM_SPOTS = ['bottom-large', 'bottom-small'] as const
export type EdgeSpot = (typeof EDGE_SPOTS)[number]
export type BottomSpot = (typeof BOTTOM_SPOTS)[number]

export interface TableItem<Spot extends string> {
  readonly drawing: DrawingId
  readonly spot: Spot
  /** Degrees, a whole number in -30..30: how the item happens to lie. */
  readonly turn: number
  /** Mirrored left to right. */
  readonly flip: boolean
  readonly signature: boolean
}

export interface CafeArrangement {
  readonly cafeId: string
  readonly signature: DrawingId
  /** Three items at the board's edges: the signature and two ordinary things. */
  readonly edges: readonly TableItem<EdgeSpot>[]
  /** Two items in the bottom area: the signature, large, and one ordinary thing. */
  readonly bottom: readonly TableItem<BottomSpot>[]
}

/** FNV-1a, 32 bit: the café id to a seed. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** mulberry32: a small seeded generator, so an arrangement never depends on Math.random. */
function generator(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * The café's table: which items, in which spots, lying how. Deterministic
 * from the café's id (never its board, its position or the date), so the
 * same café is the same table every time.
 *
 * The three edge items take three different heights, so no two share a
 * spot, and the ordinary things on one table are three different things.
 */
export function cafeArrangement(cafe: Pick<Cafe, 'id' | 'signatureItem'>): CafeArrangement {
  const next = generator(hash(cafe.id))
  const signature = signatureDrawing(cafe.signatureItem)
  const turn = () => Math.round(next() * 60) - 30
  const flip = () => next() < 0.5
  const [first, second, third] = shuffled(ORDINARY_DRAWINGS, next) as [DrawingId, DrawingId, DrawingId]
  const side = next() < 0.5 ? 'left' : 'right'
  const other = side === 'left' ? 'right' : 'left'
  const heights = shuffled(['high', 'mid', 'low'] as const, next)
  const edges: TableItem<EdgeSpot>[] = [
    { drawing: signature, spot: `${side}-${heights[0]!}`, turn: turn(), flip: flip(), signature: true },
    { drawing: first, spot: `${other}-${heights[1]!}`, turn: turn(), flip: flip(), signature: false },
    { drawing: second, spot: `${next() < 0.5 ? side : other}-${heights[2]!}`, turn: turn(), flip: flip(), signature: false },
  ]
  const bottom: TableItem<BottomSpot>[] = [
    { drawing: signature, spot: 'bottom-large', turn: turn(), flip: flip(), signature: true },
    { drawing: third, spot: 'bottom-small', turn: turn(), flip: flip(), signature: false },
  ]
  return { cafeId: cafe.id, signature, edges, bottom }
}
