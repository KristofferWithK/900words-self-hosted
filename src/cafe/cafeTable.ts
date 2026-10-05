import type { Cafe } from './cafeName'

/**
 * The café table (docs/roadmap/cafe-world.md section 5): "large faint pencil
 * items lie on the table behind the cards. Each café has one signature item
 * from its name plus a few ordinary things, in its own arrangement. Each
 * café's table art is fixed and does not change during the puzzle."
 *
 * This file decides WHAT lies on a café's table and WHERE, from the café's
 * identity alone, so a café looks the same every time it is opened, on every
 * device and in every state of its puzzle. How each item is drawn is
 * `src/ui/components/CafeTable.tsx`; the two regions the spots are measured
 * in, the ink and the stacking are `src/styles/77-cafe-puzzle.css`.
 *
 * The look is the owner's concept (build 122 feedback, the three-phone
 * "Café Solen / Katten / Havet" image): big pencil drawings lying behind and
 * around the opaque cards, showing in the gutters, the margins and the bottom
 * area, partly covered by whatever lies on top of them.
 *
 * THE LOOK IN ONE PLACE: the drawing set, the signature rules and the spots
 * are the tables below. Swapping a drawing for a café is an edit to
 * `SIGNATURE_RULES`; moving or resizing a spot is an edit to `SPOTS`.
 */

/** Every drawing there is. */
export const DRAWINGS = [
  // Ordinary table things, on every café's table in some arrangement.
  'cup',
  'spoon',
  'pencil',
  'plate',
  'lamp',
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
  // A signature's companion: the ball of yarn beside a cat café's paw prints.
  'yarn',
  // The signature fallback: a postcard, for a name none of the above fits.
  'card',
] as const
export type DrawingId = (typeof DRAWINGS)[number]

export const ORDINARY_DRAWINGS: readonly DrawingId[] = ['cup', 'spoon', 'pencil', 'plate', 'lamp']
/**
 * The long, thin ordinary things, and the turn (degrees) that lays each one
 * level: the drawings lie diagonally in their square. One of them lies along
 * the bottom of every table.
 */
export const LONG_DRAWINGS: Readonly<Partial<Record<DrawingId, number>>> = { pencil: 45, spoon: -45 }
export const FALLBACK_DRAWING: DrawingId = 'card'

/**
 * A signature item's companion on the table, where the concept gives it one:
 * a cat café's paw prints come with a ball of yarn, a seaside café's shell
 * with a starfish. Every other café's companion is an ordinary thing.
 */
export const COMPANIONS: Readonly<Partial<Record<DrawingId, DrawingId>>> = {
  paw: 'yarn',
  shell: 'star',
}

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
 * Where an item may lie. Two regions of the screen, both fixed to the phone's
 * screen rather than to anything the game draws (77-cafe-puzzle.css):
 *
 *   board   from under the header to the top of the dock. An item here lies
 *           behind the cards; what falls in the gutters between them and in
 *           the screen's side margins shows.
 *   bottom  the dock's height at the foot of the screen. Whatever the dock
 *           holds lies on top of these; the keyboard simply covers them.
 *
 * `x` and `y` place the item's centre, in percent of its region's width and
 * height (an edge spot's centre is near the screen's edge, so much of the
 * item is under the cards or off the screen). `size` is the item's side, in
 * percent of the screen's width, so the table scales with the phone.
 */
export const SPOTS = {
  'left-high': { region: 'board', x: 4, y: 30, size: 62 },
  'left-low': { region: 'board', x: 6, y: 72, size: 66 },
  'right-high': { region: 'board', x: 96, y: 32, size: 60 },
  'right-low': { region: 'board', x: 94, y: 74, size: 68 },
  middle: { region: 'board', x: 50, y: 52, size: 74 },
  corner: { region: 'bottom', x: 82, y: 56, size: 36 },
  beside: { region: 'bottom', x: 58, y: 22, size: 24 },
  along: { region: 'bottom', x: 46, y: 80, size: 44 },
} as const satisfies Record<string, { region: 'board' | 'bottom'; x: number; y: number; size: number }>
export type SpotId = keyof typeof SPOTS
export type Region = (typeof SPOTS)[SpotId]['region']
export const SPOT_IDS = Object.keys(SPOTS) as SpotId[]

export interface TableItem {
  readonly drawing: DrawingId
  readonly spot: SpotId
  readonly region: Region
  /** Centre, in percent of the region (see `SPOTS`). */
  readonly x: number
  readonly y: number
  /** Side, in percent of the screen's width. */
  readonly size: number
  /** Degrees, a whole number: how the item happens to lie. */
  readonly turn: number
  /** Mirrored left to right. */
  readonly flip: boolean
  readonly signature: boolean
}

export interface CafeArrangement {
  readonly cafeId: string
  readonly signature: DrawingId
  /**
   * Six items, every one in its own spot: three lying behind the board (the
   * signature at one edge, an ordinary thing at the other, one more behind
   * the middle) and three in the bottom area (the signature again in the
   * corner, its companion beside it, a long thing along the bottom).
   */
  readonly items: readonly TableItem[]
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
 * from the café's id (never its board, its position, the date or the state
 * of its puzzle), so the same café is the same table every time.
 *
 * The ordinary things on one table are different things, and a long thing
 * (a spoon, a pencil) lies nearly level along the bottom. Each item's place,
 * size and angle move a little from its spot's, so two cafés with the same
 * items still differ.
 */
export function cafeArrangement(cafe: Pick<Cafe, 'id' | 'signatureItem'>): CafeArrangement {
  const next = generator(hash(cafe.id))
  const signature = signatureDrawing(cafe.signatureItem)
  const jitter = (spread: number) => Math.round((next() * 2 - 1) * spread)
  const place = (drawing: DrawingId, spot: SpotId, isSignature: boolean, level = 0, turnSpread = 30): TableItem => {
    const at = SPOTS[spot]
    // A mirrored long thing lies the other way, so it is levelled the other way.
    const flip = next() < 0.5
    return {
      drawing,
      spot,
      region: at.region,
      x: at.x + jitter(3),
      y: at.y + jitter(4),
      size: at.size + jitter(4),
      turn: (flip ? -level : level) + jitter(turnSpread),
      flip,
      signature: isSignature,
    }
  }
  const longs = Object.keys(LONG_DRAWINGS) as DrawingId[]
  const long = longs[Math.floor(next() * longs.length)]!
  const [first, second, third] = shuffled(ORDINARY_DRAWINGS.filter((d) => d !== long), next) as [DrawingId, DrawingId, DrawingId]
  const companion = COMPANIONS[signature] ?? third
  const side = next() < 0.5 ? 'left' : 'right'
  const other = side === 'left' ? 'right' : 'left'
  const high = next() < 0.5
  const items: TableItem[] = [
    place(signature, `${side}-${high ? 'high' : 'low'}`, true),
    place(first, `${other}-${high ? 'low' : 'high'}`, false),
    place(second, 'middle', false),
    place(signature, 'corner', true),
    place(companion, 'beside', false),
    place(long, 'along', false, LONG_DRAWINGS[long], 10),
  ]
  return { cafeId: cafe.id, signature, items }
}
