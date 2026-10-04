import { FAR, SPACING, type RunGate, type RunShopfront, type RunState } from './engine'
import { GATE_TIERS } from './tiers'
import type { RunWord } from './words'

/**
 * THE RUN, DRAWN.
 *
 * A port of the drawing in docs/design/cafe-world/door-dash.html with the
 * settled look only (contract §6; the prototype's look switches are gone):
 *
 *  - street: "Open street", pencil houses set back from the road, drawn as solids;
 *  - road: white, with open-stroke square cobbles;
 *  - gates: white suitcases under a tied manila tag, a different slant per gate;
 *  - the bar at the top: a luggage tag, with the camera beside the photo count;
 *  - a café found on the walk: a faint kiosk ON the road ahead, on an island
 *    between two gates, with its name in clear ink (contract §5); Casey walks
 *    through it. It never stands over a gate (`cafeBox`).
 *
 * Both walks share it. The Articles walk has two or three lanes, so lanes are
 * measured from the road's width (`lanesFor`), as in the prototype, and its
 * articles are large and never scribbled over: there is nothing to hide on them.
 *
 * Everything is drawn in the prototype's 480 x 800 game units and scaled to the
 * canvas, which is sized at device resolution by the screen. On a phone taller
 * than that frame the scene grows taller (`runFrame`): the horizon and Casey
 * keep their 540 units apart, so the perspective is the prototype's, and the
 * extra height is shared out evenly, more sky above the horizon and more road
 * below Casey. The new sky holds a far town in faint pencil, still on the
 * horizon, and three open pencil clouds (`skyLayout`). Text that grows
 * as its gate comes closer is drawn ONCE, large, and scaled as a picture: text
 * drawn at every new size snaps each letter to whole pixels and the words
 * jiggle (the prototype's own finding, kept in `stamp`).
 */

export const W = 480
export const H = 800
const CX = 240
const HOR = 150
const PY = 690
const LANE = 158

const C = {
  ink: '#121212',
  dim: '#6e6e6e',
  paper: '#fffdf7',
  guide: '#f2eee3',
  beige: '#e3dfd3',
  beigeDeep: '#c9c3b2',
  green: '#6aaa64',
  greenTile: '#4e8449',
  greenDeep: '#3a7a34',
  greenSoft: '#eaf3e9',
  red: '#a51c30',
  redSoft: '#fbeef0',
  pencil: 'rgba(18,18,18,.26)',
}
const SERIF = "Georgia, 'Times New Roman', 'Songti SC', serif"
const SANS = "-apple-system, system-ui, 'Segoe UI', 'PingFang SC', sans-serif"

const sAt = (z: number) => 1 / (1 + z)
const gy = (s: number) => HOR + (PY - HOR) * s
const lanesFor = (n: number) => (3 * LANE) / n
const laneAt = (i: number, n: number) => (i - (n - 1) / 2) * lanesFor(n)
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x) - 0.5
}
const rnd = (seed: number, n: number) => noise(seed * 7.31 + n * 3.17) + 0.5

/** The bottom edge of the bar (the luggage tag across the top), in game units from the top of the canvas. */
export const HUD_BOTTOM = 110
/** The sky's scenery keeps this far below the bar. */
const SKY_GAP = 14

/**
 * THE FRAME ON THIS SCREEN, in game units, for a stage `cssW` x `cssH` CSS px
 * whose bottom `insetPx` lies under the home indicator.
 *
 * The stage is 480 units wide, so it is `height` units tall. The prototype's
 * frame is 800 tall; whatever the safe part of the stage has beyond that is
 * split evenly: `sky` units of extra sky above the horizon, the same of extra
 * road below Casey. The world (road, houses, gates, Casey) is drawn in the
 * prototype's units moved down by `sky`, so the horizon stands at HOR + sky
 * and Casey at PY + sky, 540 apart as in the prototype. The road also runs on
 * under the home indicator, where nothing the player acts on is drawn.
 */
export function runFrame(cssW: number, cssH: number, insetPx = 0): { height: number; sky: number; inset: number; horizon: number; casey: number } {
  const u = cssW > 0 ? W / cssW : 1
  const height = Math.max(H, cssH * u)
  const inset = Math.max(0, Math.min(height - H, insetPx * u))
  const sky = Math.max(0, height - inset - H) / 2
  return { height, sky, inset, horizon: HOR + sky, casey: PY + sky }
}
export type RunFrame = ReturnType<typeof runFrame>

/**
 * The stage on a screen area `rW` x `rH` CSS px whose bottom `insetPx` lies
 * under the home indicator: as tall as the area, and as wide as it, but never
 * wider than the prototype's 480 x 800 shape over the safe part, so a wide
 * screen keeps the sideways letterbox.
 */
export function stageSize(rW: number, rH: number, insetPx = 0): { w: number; h: number } {
  const safeH = Math.max(0, rH - Math.max(0, insetPx))
  return { w: Math.floor(Math.min(rW, (safeH * W) / H)), h: Math.floor(rH) }
}

/**
 * THE FAR TOWN: a row of house outlines either side of the street's end, as
 * points [x, height above the horizon]. One church spire; the rest flat or
 * peaked roofs. It stands at the vanishing distance, so it never moves.
 */
const SKYLINE: readonly (readonly [number, number])[][] = (() => {
  const out: [number, number][][] = []
  const SPIRE = 2 // the third house left of the street
  for (const side of [-1, 1]) {
    let x = CX + side * 34
    for (let i = 0; side < 0 ? x > -20 : x < W + 20; i++) {
      const seed = 900 + i * 2 + (side > 0 ? 1 : 0)
      const w = 16 + rnd(seed, 1) * 20
      const hgt = 8 + rnd(seed, 2) * 16 + Math.abs(x - CX) * 0.05
      const l = Math.min(x, x + side * w)
      const r = Math.max(x, x + side * w)
      const pts: [number, number][] = [[l, 0], [l, hgt]]
      if (side < 0 && i === SPIRE) {
        const m = (l + r) / 2
        pts.push([m - 3, hgt], [m, hgt + 28], [m + 3, hgt])
      } else if (rnd(seed, 3) < 0.5) pts.push([(l + r) / 2, hgt + 7 + rnd(seed, 4) * 5])
      pts.push([r, hgt], [r, 0])
      out.push(pts)
      x += side * (w + 1 + rnd(seed, 5) * 4)
    }
  }
  return out
})()
/** The far town's tallest point (the spire), in game units above the horizon. */
export const SKYLINE_TALL = Math.max(...SKYLINE.flatMap((p) => p.map((q) => q[1])))
/** Below this share of its size the far town would be a smudge: it is left out instead. */
const SKYLINE_MIN_SCALE = 0.6
/** How far an open pencil cloud reaches above its base line. */
export const CLOUD_TALL = 24

/**
 * Where the sky's scenery goes in a frame, in game units from the top of the
 * canvas: the far town's size (1 = full, 0 = left out) and top, and the three
 * clouds' base lines. Everything keeps SKY_GAP clear of the bar; on a phone
 * with little extra sky the town shrinks or is left out, and the clouds are
 * left out when they have no room between the bar and the town.
 */
export function skyLayout(frame: RunFrame): {
  skylineScale: number
  skylineTop: number
  clouds: { x: number; y: number; w: number }[]
} {
  const base = frame.horizon + 1
  const room = base - (HUD_BOTTOM + SKY_GAP)
  const fits = Math.min(1, room / SKYLINE_TALL)
  const skylineScale = fits >= SKYLINE_MIN_SCALE ? fits : 0
  const skylineTop = base - SKYLINE_TALL * skylineScale
  const top = HUD_BOTTOM + SKY_GAP + CLOUD_TALL
  const bottom = skylineTop - 18
  const clouds: { x: number; y: number; w: number }[] = []
  if (bottom >= top) {
    // Left high, middle low, right between: loose, never a row.
    const high = [0.15, 0.85, 0.45]
    for (let c = 0; c < 3; c++) {
      const y = top + Math.max(0, Math.min(1, high[c] + noise(c * 2.7) * 0.2)) * (bottom - top)
      clouds.push({ x: 70 + c * 165 + noise(c * 4.1) * 40, y, w: 50 + rnd(c, 8) * 40 })
    }
  }
  return { skylineScale, skylineTop, clouds }
}

/**
 * WHERE A GATE STANDS ON THE SCREEN, in game units: the foot of its suitcases
 * (`base`), the top of its suitcases and the top of its tag. The same sums
 * `drawGate` draws with, kept here so they can be tested without a canvas.
 */
export function gateBox(z: number, lanes: number): { base: number; suitcaseTop: number; tagTop: number } {
  const s = sAt(z)
  const base = gy(s)
  const cs = (lanesFor(lanes) * 0.93 * s) / 104
  const suitcaseTop = base - 70 * cs
  // The tag's top edge, level (its slant lifts one corner a little and lowers the other).
  const tagTop = suitcaseTop - 12 * cs - 28 * s - 84 * s
  return { base, suitcaseTop, tagTop }
}

/** A box on the screen in the world's game units (before the extra sky is added). */
export interface ScreenBox {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

/** The most a gate's tag leans either way, in radians: `noise` stays within ±0.5 and `drawGate` takes 0.16 of it. */
const TAG_TILT = 0.08

/**
 * EVERYTHING A GATE DRAWS, as three boxes on the screen: its suitcases with
 * their handles, the string from the tag down to the handle, and the tag at
 * its steepest possible slant. The same sums `drawGate` draws with, so a test
 * can prove that nothing else stands in front of a gate.
 */
export function gateRects(z: number, lanes: number): ScreenBox[] {
  const s = sAt(z)
  const base = gy(s)
  const w = lanesFor(lanes) * 0.93 * s
  const cs = w / 104
  const h = 70 * cs
  const outer = Math.abs(laneAt(0, lanes)) * s + w / 2
  const handleTop = base - h - 12 * cs
  const tw = 3 * LANE * s * 0.8
  const th = 84 * s
  const cy = handleTop - 28 * s - th / 2
  const co = Math.cos(TAG_TILT)
  const si = Math.sin(TAG_TILT)
  const hx = (tw / 2) * co + (th / 2) * si
  const hy = (tw / 2) * si + (th / 2) * co
  // Each box is padded by the widest ink line drawn on its edge.
  const pad = 3 * s
  const box = (left: number, right: number, top: number, bottom: number): ScreenBox =>
    ({ left: left - pad, right: right + pad, top: top - pad, bottom: bottom + pad })
  return [
    box(CX - outer, CX + outer, handleTop, base),
    // The string's curve stays inside its control points: at most 25 units
    // left of the tag's edge (the hole, then 50 more), never right of the
    // middle, and it may lean up as far as the tag does.
    box(CX - tw / 2 - 34 * s, CX + 10 * s, cy - hy, handleTop),
    box(CX - hx, CX + hx, cy - hy, cy + hy),
  ]
}

/**
 * THE CAFÉ ON THE ROAD: a small kiosk on a little island in the middle of the
 * road, which splits around it, its name on a board on its roof (owner,
 * 2026-10-04: "The cafés should be on the road and not on the side"; of three
 * looks tried, the owner chose this one).
 *
 * The room it takes, in game units at its own scale: half its width from the
 * middle of the road, its height above its foot, and how far its island
 * reaches nearer than its foot. It is drawn clipped to this box, so the box is
 * all of it.
 */
export const CAFE_SIZE = { half: 134, tall: 184, below: 20 } as const

/**
 * WHERE THE CAFÉ ON THE ROAD STANDS ON THE SCREEN, in the world's game units.
 *
 * It never stands over a gate. The engine places it halfway between two gates
 * (engine.ts `findCafe`), and gates and cafés move with the road, so it keeps
 * that place. On the screen the road between its foot and the foot of the gate
 * behind it is at least 81 units when it is placed (and more as it comes
 * nearer); its 184 units at its scale (0.41 there) take 75 of them, so the
 * gate behind, its suitcases and every word on them, stands wholly above it.
 * The gate in front of it is the one just passed, at Casey's feet or behind
 * her: its tag's top is lower on the screen than the café's foot (and the
 * kiosk's island). cafeHold.test.ts checks it along its whole way, for two
 * and three lanes, and in every frame of a walk.
 */
export function cafeBox(z: number): ScreenBox {
  const s = sAt(z)
  const base = gy(s)
  const k = CAFE_SIZE
  return { left: CX - k.half * s, right: CX + k.half * s, top: base - k.tall * s, bottom: base + k.below * s }
}

/** A café that did not hold the run comes out of the road over this much of it as it comes nearer. */
export const CAFE_FADE_IN = 0.35
/**
 * And it goes as Casey passes beside it: from this far ahead of her...
 * (`cafeAlphaAt`)
 */
const CAFE_FADE_FROM = 0.1
/** ...until this far behind her, where it is gone. Its name board stays above her head until then. */
export const CAFE_GONE_AT = -0.03

/** How much of a café is drawn at `z` as Casey reaches and passes it (1 = all, 0 = gone). Its coming out of the road is apart. */
export function cafeAlphaAt(z: number): number {
  return Math.max(0, Math.min(1, (z - CAFE_GONE_AT) / (CAFE_FADE_FROM - CAFE_GONE_AT)))
}

/**
 * THE KIOSK'S PARTS ON THE SCREEN, in the world's game units: the island with
 * the kiosk, its awning and the posts of its board (`below` under its foot to
 * 140 up, 76 either side of the middle of the road), and the name board on top
 * (140 to 180 up, 128 either side). The same sums `drawCafe` draws with, so a
 * test can prove Casey never runs into it (`caseyBox`).
 */
export function kioskRects(z: number): ScreenBox[] {
  const s = sAt(z)
  const base = gy(s)
  const box = (half: number, from: number, to: number): ScreenBox => ({ left: CX - half * s, right: CX + half * s, top: base - to * s, bottom: base - from * s })
  return [box(KIOSK_HALF, -CAFE_SIZE.below, KIOSK_BOARD_FROM), box(KIOSK_BOARD_HALF, KIOSK_BOARD_FROM, KIOSK_BOARD_TO)]
}
/** The island's half width (the kiosk itself is 60, its awning 72), and the name board's. */
const KIOSK_HALF = 76
const KIOSK_BOARD_HALF = 128
const KIOSK_BOARD_FROM = 140
const KIOSK_BOARD_TO = 180

/**
 * CASEY GOES ROUND THE KIOSK. The kiosk stands in the middle of the road, and
 * the middle lane (Words) or both lanes' inner edges (Articles) run into it.
 * So the road splits round it: as it comes near, Casey is drawn on the branch
 * of her side, at least DODGE_X from the middle of the road, and once it is
 * gone she is drawn back in her lane. Only the drawing moves: her lane, and so
 * every answer, is the engine's, and no gate is near while she goes round
 * (the kiosk stands halfway between two gates; `caseyDodge` is 0 whenever a
 * gate is within reach, cafeHold.test.ts).
 */
export const DODGE_X = 160
/** The dodge eases in while the kiosk comes from DODGE_IN[0] to DODGE_IN[1] ahead of her... */
const DODGE_IN: readonly [number, number] = [0.7, 0.36]
/** ...and out once it is gone, from CAFE_GONE_AT to DODGE_OUT behind her. */
const DODGE_OUT = -0.4
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/** How far Casey has gone round a kiosk at `z` (0 in her lane, 1 on her branch). */
export function caseyDodge(z: number): number {
  if (z >= DODGE_IN[1]) return smooth((DODGE_IN[0] - z) / (DODGE_IN[0] - DODGE_IN[1]))
  if (z >= CAFE_GONE_AT) return 1
  return smooth((z - DODGE_OUT) / (CAFE_GONE_AT - DODGE_OUT))
}

/** The branch Casey takes round a kiosk, from where she is across the road (`x` from the middle) as it comes near: her own side, the right from the middle. */
export const dodgeSide = (x: number): -1 | 1 => (x < 0 ? -1 : 1)

/** Where Casey is drawn across the road (from its middle), `w` of the way round a kiosk on branch `side`. */
export function dodgedX(x: number, w: number, side: -1 | 1): number {
  return side > 0 ? x + w * Math.max(0, DODGE_X - x) : x - w * Math.max(0, DODGE_X + x)
}

/**
 * EVERYTHING CASEY DRAWS, as one box on the screen in the world's game units:
 * the suitcase and its handle (drawCasey: the 120 x 96 face scaled 1.25 about
 * its foot), turned by `angle`, lifted by her bob, and the pencil shadow at
 * her feet. `x` is from the middle of the road.
 */
export function caseyBox(x: number, bob: number, angle: number): ScreenBox {
  const cx = CX + x
  const cy = PY + bob
  const co = Math.cos(angle)
  const si = Math.sin(angle)
  const xs: number[] = []
  const ys: number[] = []
  for (const [u, v] of [[-52, -82], [52, -82], [-52, 0], [52, 0]]) {
    xs.push(cx + 1.25 * (u * co - v * si))
    ys.push(cy + 1.25 * (u * si + v * co))
  }
  const pad = 2.5
  return {
    left: Math.min(...xs, cx - 63) - pad,
    right: Math.max(...xs, cx + 63) + pad,
    top: Math.min(...ys) - pad,
    bottom: Math.max(...ys, PY + 11) + pad,
  }
}


/** Whether two boxes on the screen share any point. */
export function boxesOverlap(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** The bar's word (the gate's tag text): its full size, and the smallest it may shrink to on one line. */
export const HUD_WORD_SIZE = 34
export const HUD_WORD_MIN = 20
/** On two lines it is at most this large, so the two fit between the small labels and the progress line. */
export const HUD_WORD_TWO_LINES = 22
/** The smallest any text in the bar is drawn. */
const HUD_TEXT_FLOOR = 7
/** The bar's left and right columns: the photo count, and the best with the slips pill under it. */
const HUD_LX = 62
const HUD_RX = W - 30
const HUD_PILL_W = 92
/** The camera beside the photo count: from the count's end to the camera's far edge at the top of its jump (24 + 12 x 1.28). */
const HUD_CAMERA_REACH = 24 + 12 * 1.28
/** Clear space kept between the word and either column. */
const HUD_WORD_GAP = 8

/**
 * THE ROOM FOR THE BAR'S WORD, in game units across: between the photo block
 * (the count, `photosW` wide in its bold 24 type, and the camera at the top of
 * its jump) and the best block (the best, `bestW` wide, over the slips pill).
 */
export function hudWordRoom(photosW: number, bestW: number): { left: number; right: number } {
  return { left: HUD_LX + photosW + HUD_CAMERA_REACH + HUD_WORD_GAP, right: HUD_RX - Math.max(bestW, HUD_PILL_W) - HUD_WORD_GAP }
}

export interface HudWordLine {
  readonly text: string
  /** The line's middle, in game units from the top of the canvas. */
  readonly y: number
  readonly size: number
}

/** Where a line may break: at a space, or, in a text without spaces that is written in Chinese characters, between any two. */
function breakPoints(text: string): { at: number; skip: number }[] {
  const spaces = [...text.matchAll(/ /g)].map((m) => ({ at: m.index!, skip: 1 }))
  if (spaces.length) return spaces.filter((b) => b.at > 0 && b.at < text.length - 1)
  const chinese = [...text].some((ch) => {
    const c = ch.codePointAt(0) ?? 0
    return (c >= 0x3000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)
  })
  if (!chinese) return []
  return Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => ({ at: i + 1, skip: 0 }))
}

/**
 * HOW THE BAR'S WORD FITS ITS ROOM (`hudWordRoom`). `unit(s)` is the width of
 * `s` in the word's type at 1 unit. Full size if it fits; else shrunk on one
 * line down to HUD_WORD_MIN; else on two lines, broken where the longer line
 * is shortest (at a space; anywhere in Chinese), at most HUD_WORD_TWO_LINES;
 * a word that cannot break shrinks on its one line. It stands in the middle of
 * the bar unless that would push it out of its room, and never leaves it.
 */
export function hudWordLayout(text: string, unit: (s: string) => number, room: { left: number; right: number }): { x: number; width: number; lines: HudWordLine[] } {
  const avail = Math.max(1, room.right - room.left)
  const whole = Math.max(1e-6, unit(text))
  let size = Math.min(HUD_WORD_SIZE, avail / whole)
  let lines: HudWordLine[] = [{ text, y: 64, size }]
  let width = whole * size
  if (size < HUD_WORD_MIN) {
    let best: { a: string; b: string; w: number } | null = null
    for (const { at, skip } of breakPoints(text)) {
      const a = text.slice(0, at)
      const b = text.slice(at + skip)
      const w = Math.max(unit(a), unit(b))
      if (!best || w < best.w) best = { a, b, w }
    }
    const two = best ? Math.min(HUD_WORD_TWO_LINES, avail / Math.max(1e-6, best.w)) : 0
    if (best && two > size) {
      size = two
      const step = size * 0.55
      lines = [
        { text: best.a, y: 64 - step, size },
        { text: best.b, y: 64 + step, size },
      ]
      width = best.w * size
    }
  }
  if (size < HUD_TEXT_FLOOR) {
    width *= HUD_TEXT_FLOOR / size
    lines = lines.map((l) => ({ ...l, size: HUD_TEXT_FLOOR }))
  }
  const x = Math.max(room.left + width / 2, Math.min(room.right - width / 2, CX))
  return { x, width, lines }
}

/** A queued gate is drawn fully once no more than this share of its suitcases is behind the gate in front. */
const CLEAR_SHOWN = 0.35
/** ...and not at all while this share or more is: its tag would sit on the front gate's tag like a stack. */
const CLEAR_HIDDEN = 0.6

/**
 * How much of a queued gate to draw (0 to 1), given the gate in front of it.
 *
 * The road is in perspective, so two gates SPACING apart come closer together
 * on the screen the further away they are, faster than the gates themselves
 * shrink. Far down the road a gate's suitcases ended up wholly behind the tag
 * of the gate in front, and the two tags read as one stack of tags near the
 * horizon, from the first frame of a run. So a queued gate comes out from
 * behind the gate in front: it is drawn once its suitcases are mostly clear of
 * that gate's tag, fading in as they clear. The gates keep their spacing on
 * the road; this only decides when the one behind is worth drawing.
 */
export function queuedGateAlpha(z: number, zAhead: number | undefined, lanes: number): number {
  if (zAhead === undefined) return 1
  const me = gateBox(z, lanes)
  const front = gateBox(zAhead, lanes)
  const hidden = Math.max(0, Math.min(1, (me.base - front.tagTop) / (me.base - me.suitcaseTop)))
  return Math.max(0, Math.min(1, (CLEAR_HIDDEN - hidden) / (CLEAR_HIDDEN - CLEAR_SHOWN)))
}

/** What the bar and the notes say, from the catalogue. */
export interface RunLabels {
  readonly photos: string
  readonly best: string
  /** The small line over the word in the bar. */
  readonly ask: string
  /** Said after `ask` for the gate ahead, when the walk has more to say ("EN OR ET?  ·  house"). */
  readonly askDetail?: (gate: RunGate) => string
  readonly slipsLeft: (n: number) => string
  readonly faster: string
  /** The red note after a forgiven wrong answer: the right answer ("house = hus", "et hus"). */
  readonly slipNote: (word: RunWord) => string
}

export interface RunView {
  readonly labels: RunLabels
  readonly best: number
  /** Wrong words forgiven in this run. */
  readonly forgiven: number
  /** Paused or on a panel: Casey stops and turns round. */
  readonly running: boolean
  readonly reducedMotion: boolean
  /** CSS px at the bottom of the canvas that lie under the home indicator (env(safe-area-inset-bottom)). */
  readonly safeBottom?: number
}

export function createRunPainter(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
  /** Device pixels per game unit. */
  let K = 1
  let haze: CanvasGradient | null = null
  let F = runFrame(W, H)
  /** The nearest z the road is drawn from: far enough back to reach the bottom of the canvas. */
  let zNear = -0.2
  /** The far town and the clouds, drawn once per frame shape. */
  let skyline: Path2D | null = null
  let clouds: Path2D | null = null

  /** Size the backing store to the element at device resolution. */
  function fit(dpr: number, safeBottom: number): void {
    const cssW = canvas.clientWidth || W
    const cssH = canvas.clientHeight || H
    const k = Math.max(0.5, (cssW * dpr) / W)
    const f = runFrame(cssW, cssH, safeBottom)
    if (Math.abs(k - K) < 0.001 && Math.abs(f.height - F.height) < 0.01 && Math.abs(f.sky - F.sky) < 0.01 && canvas.width === Math.round(W * k)) return
    K = k
    F = f
    // The bottom of the canvas, in the world's units (moved down by the extra sky).
    const sBottom = (F.height - F.sky - HOR) / (PY - HOR)
    zNear = Math.min(-0.2, 1 / sBottom - 1 - 0.03)
    buildSky()
    canvas.width = Math.round(W * k)
    canvas.height = Math.round(F.height * k)
  }

  // ── the sky: a far town on the horizon and three clouds, in faint pencil ─
  function buildSky(): void {
    const sky = skyLayout(F)
    skyline = null
    clouds = null
    if (sky.skylineScale > 0) {
      const base = F.horizon + 1
      const k = sky.skylineScale
      skyline = new Path2D()
      for (const pts of SKYLINE) {
        pts.forEach(([x, v], i) => (i ? skyline!.lineTo(x, base - v * k) : skyline!.moveTo(x, base - v * k)))
      }
    }
    if (sky.clouds.length) {
      clouds = new Path2D()
      for (const { x, y, w } of sky.clouds) {
        // An open loop: a pencil line over the top, none along the bottom.
        clouds.moveTo(x - w / 2, y)
        clouds.quadraticCurveTo(x - w / 3, y - 16, x - w / 8, y - 8)
        clouds.quadraticCurveTo(x + w / 8, y - CLOUD_TALL, x + w / 3, y - 8)
        clouds.quadraticCurveTo(x + w / 2 + 6, y - 6, x + w / 2, y)
      }
    }
  }

  function drawSky(): void {
    if (!skyline && !clouds) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (skyline) {
      ctx.strokeStyle = 'rgba(18,18,18,.16)'
      ctx.lineWidth = 1.1
      ctx.stroke(skyline)
    }
    if (clouds) {
      ctx.strokeStyle = 'rgba(18,18,18,.13)'
      ctx.lineWidth = 1.3
      ctx.stroke(clouds)
    }
  }

  // ── pencil helpers ──────────────────────────────────────────────────────
  function sketch(x1: number, y1: number, x2: number, y2: number, seed: number, amp = 2.5): void {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const n = Math.max(2, Math.round(len / 45))
    const nx = -(y2 - y1) / len
    const ny = (x2 - x1) / len
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    for (let i = 1; i <= n; i++) {
      const a = (i - 0.5) / n
      const b = i / n
      const o = noise(seed + i) * amp
      const e = i === n ? 0 : noise(seed + i + 50) * amp * 0.5
      ctx.quadraticCurveTo(
        x1 + (x2 - x1) * a + nx * o,
        y1 + (y2 - y1) * a + ny * o,
        x1 + (x2 - x1) * b + nx * e,
        y1 + (y2 - y1) * b + ny * e,
      )
    }
    ctx.stroke()
  }

  // Text size is worked out from one measurement at a fixed size, never from
  // the size being drawn: measuring at each new size rounds differently every
  // frame and made words jiggle.
  const refW = new Map<string, number>()
  let TF = { size: 16, font: SANS, weight: 'bold' }
  /** The width of `text` at 1 unit, measured once at 100. Leaves the context's font as it found it. */
  function unitWidth(text: string, font = SANS, weight = 'bold'): number {
    const key = `${weight}|${font}|${text}`
    let w = refW.get(key)
    if (w === undefined) {
      const was = ctx.font
      ctx.font = `${weight} 100px ${font}`
      w = ctx.measureText(text).width / 100
      ctx.font = was
      refW.set(key, w)
      if (refW.size > 600) refW.clear()
    }
    return w
  }
  function fitText(text: string, maxW: number, size: number, font = SANS, weight = 'bold'): void {
    const w = unitWidth(text, font, weight)
    if (w * size > maxW) size = Math.max(7, maxW / w)
    ctx.font = `${weight} ${size}px ${font}`
    TF = { size, font, weight }
  }

  // A word that grows as its gate comes closer is drawn once, large, and then
  // scaled as a picture. Three picture sizes, so a far-away word is not shrunk
  // from a huge one.
  const sprites = new Map<string, { c: HTMLCanvasElement; B: number }>()
  function stamp(text: string, x: number, y: number): void {
    const want = TF.size * K
    const B = want <= 34 ? 36 : want <= 70 ? 72 : 150
    const fill = String(ctx.fillStyle)
    const key = `${B}|${TF.weight}|${TF.font}|${fill}|${text}`
    let sp = sprites.get(key)
    if (!sp) {
      if (sprites.size > 120) sprites.clear()
      const c = document.createElement('canvas')
      const g = c.getContext('2d') as CanvasRenderingContext2D
      const font = `${TF.weight} ${B}px ${TF.font}`
      g.font = font
      c.width = Math.ceil(g.measureText(text).width) + 12
      c.height = Math.ceil(B * 1.5)
      g.font = font
      g.fillStyle = fill
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, c.width / 2, c.height / 2)
      sprites.set(key, (sp = { c, B }))
    }
    const k = TF.size / sp.B
    ctx.drawImage(sp.c, x - (sp.c.width * k) / 2, y - (sp.c.height * k) / 2, sp.c.width * k, sp.c.height * k)
  }

  // A word that is not in play yet is scribbled over in pencil. When its gate
  // comes into play the scribble is rubbed out from the left and the word appears.
  function word(text: string, x: number, y: number, reveal: number, ww: number, hh: number, seed: number, col: string): void {
    const a = ctx.globalAlpha
    if (reveal > 0) {
      ctx.globalAlpha = a * reveal
      stamp(text, x, y)
      ctx.globalAlpha = a
    }
    if (reveal >= 1) return
    const N = 11
    const from = Math.floor(reveal * N)
    ctx.strokeStyle = col
    ctx.lineWidth = Math.max(1, hh * 0.13)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath()
      for (let i = from; i <= N; i++) {
        const px = x - ww / 2 + (ww * i) / N + noise(seed + i + pass * 31) * ww * 0.05
        const py = y + ((i + pass) % 2 ? 1 : -1) * hh * (0.38 + noise(seed + i * 7 + pass * 13) * 0.3)
        if (i === from) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }

  function rr(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)))
  }

  // ── the street: open street, low pencil houses standing back from the road ─
  const OPEN = 1.5 * LANE + 170
  const PITCH = 0.62
  const wp = (side: number, z: number, v: number, X: number): [number, number] => {
    const s = sAt(z)
    return [CX + side * X * s, gy(s) - v * s]
  }
  const openX = (seed: number) => OPEN + (rnd(seed, 7) - 0.5) * 90

  // Low houses standing back from the road, in loose pencil, drawn as solids
  // rather than flat fronts: a roof that runs back from the street, houses that
  // step forward and back, hatching on the side wall where one steps forward.
  function openHouse(side: number, z1: number, z2: number, seed: number): void {
    const s = sAt((z1 + z2) / 2)
    const X = openX(seed)
    const Xn = openX(seed - 2)
    const zm = (z1 + z2) / 2
    const R = 100
    const Hh = 230 + rnd(seed, 1) * 170
    const peak = rnd(seed, 2) > 0.45
    const top = Hh + 125
    const rh = 70 + rnd(seed, 3) * 50
    const P = (z: number, x: number, v: number) => wp(side, z, v, x)
    let n = 0
    const sk = (a: [number, number], b: [number, number], f = 1) => {
      const x2 = a[0] + (b[0] - a[0]) * f
      const y2 = a[1] + (b[1] - a[1]) * f
      if (Math.hypot(x2 - a[0], y2 - a[1]) > 1) sketch(a[0], a[1], x2, y2, seed * 13 + n++, 5 * s)
    }
    const paper = (pts: [number, number][]) => {
      ctx.beginPath()
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])))
      ctx.closePath()
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
    ctx.strokeStyle = C.pencil
    ctx.lineWidth = Math.max(0.5, 1.7 * s)
    if (peak) {
      paper([P(z1, X, Hh), P(zm, X, top), P(zm, X + R, top), P(z1, X + R, Hh)])
      sk(P(zm, X, top), P(zm, X + R, top), 0.85)
      sk(P(z1, X, Hh), P(z1, X + R, Hh), 0.7)
      for (const f of [0.35, 0.7]) sk(P(zm, X + R * f, top), P(z1, X + R * f, Hh), 0.6)
    } else {
      paper([P(z1, X, Hh), P(z2, X, Hh), P(z2, X + R, Hh + rh), P(z1, X + R, Hh + rh)])
      sk(P(z1, X, Hh), P(z1, X + R, Hh + rh))
      sk(P(z1, X + R, Hh + rh), P(z2, X + R, Hh + rh), 0.85)
      for (const f of [0.3, 0.55, 0.8]) {
        const z = z1 + (z2 - z1) * f
        sk(P(z, X, Hh), P(z, X + R, Hh + rh), 0.45)
      }
      if (rnd(seed, 5) > 0.5) {
        const za = z1 + (z2 - z1) * 0.55
        const zb = z1 + (z2 - z1) * 0.7
        const v = Hh + rh
        sk(P(za, X + R, v), P(za, X + R, v + 48))
        sk(P(za, X + R, v + 48), P(zb, X + R, v + 48))
        sk(P(zb, X + R, v + 48), P(zb, X + R, v), 0.8)
      }
    }
    if (Xn > X + 10) {
      paper([P(z1, X, 0), P(z1, X, Hh), P(z1, Xn, Hh), P(z1, Xn, 0)])
      sk(P(z1, X, Hh), P(z1, Xn, Hh))
      const w = Xn - X
      for (let k = 0; k < 6; k++) {
        const v = Hh * (0.16 + k * 0.13)
        sk(P(z1, X + w * 0.12, v), P(z1, X + w * 0.9, v + Hh * 0.09))
      }
    }
    const front: [number, number][] = peak
      ? [[z1, 0], [z1, Hh], [zm, top], [z2, Hh], [z2, 0]]
      : [[z1, 0], [z1, Hh], [z2, Hh], [z2, 0]]
    paper(front.map(([z, v]) => P(z, X, v)))
    if (peak) {
      sk(P(z1, X, Hh), P(zm, X, top))
      sk(P(zm, X, top), P(z2, X, Hh))
    } else sk(P(z1, X, Hh), P(z2, X, Hh))
    sk(P(z2, X, Hh), P(z2, X, Hh * 0.12))
    sk(P(z1, X, Hh), P(z1, X, Xn > X + 10 ? Hh * 0.1 : Hh * 0.4))
    const at = (u: number, v: number) => P(z1 + u * (z2 - z1), X, v)
    const rows = Math.max(1, Math.floor((Hh - 110) / 105))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        if (rnd(seed, 20 + r * 3 + c) < 0.35) continue
        const u = 0.13 + c * 0.28
        const v = 150 + r * 105
        sk(at(u, v), at(u + 0.17, v + 5))
      }
    }
    if (rnd(seed, 6) > 0.5) for (let k = 0; k < 3; k++) sk(at(0.08 + k * 0.06, 30), at(0.17 + k * 0.06, 105))
  }

  function drawStreet(scroll: number): void {
    const off = scroll % PITCH
    const base = Math.floor(scroll / PITCH)
    for (let k = 13; k >= -1; k--) {
      const zA = k * PITCH - off
      const z2 = zA + PITCH * 0.96
      const id = k + base
      if (z2 < 0.1) continue
      ctx.globalAlpha = Math.max(0, Math.min(1, (5 - zA) / 3))
      if (ctx.globalAlpha <= 0) continue
      for (const side of [-1, 1]) {
        const seed = id * 2 + (side > 0 ? 1 : 0)
        openHouse(side, Math.max(zA, -0.12), z2, seed)
      }
    }
    ctx.globalAlpha = 1
  }

  // ── a café found on the walk, on the road ahead ──────────────────────────
  // From the prototype's place drawing (door-dash.html `drawPlace`, a café
  // standing on the road): a name board, a striped and scalloped awning, a
  // door. Faint pencil, since it is nothing to steer into; only the name has
  // clear ink, drawn once and scaled like the gates' words. It is drawn in
  // units of the café at its scale and clipped to its `cafeBox`.
  function drawCafe(shop: RunShopfront): void {
    // A café that held the run was already standing there behind the panel;
    // one found on the move comes out of the road; both go once walked through.
    let a = shop.held ? 1 : Math.min(1, (shop.placedZ - shop.z) / CAFE_FADE_IN)
    a = Math.min(a, cafeAlphaAt(shop.z))
    if (a <= 0) return
    const s = sAt(shop.z)
    const box = cafeBox(shop.z)
    const base = gy(s)
    const X = (u: number) => CX + u * s
    const Y = (v: number) => base - v * s
    const line = 'rgba(18,18,18,.42)'
    const lw = Math.max(0.6, 1.8 * s)
    const seed = shop.id * 41
    ctx.save()
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.rect(box.left, box.top, box.right - box.left, box.bottom - box.top)
    ctx.clip()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = line
    ctx.lineWidth = lw
    /** A striped awning from u0 to u1, its top at v1, scalloped along its bottom edge at v0. */
    const awning = (u0: number, u1: number, v0: number, v1: number, n: number) => {
      const sw = (u1 - u0) / n
      ctx.beginPath()
      ctx.moveTo(X(u0), Y(v1))
      ctx.lineTo(X(u1), Y(v1))
      ctx.lineTo(X(u1), Y(v0))
      for (let k = n - 1; k >= 0; k--) ctx.arc(X(u0 + (k + 0.5) * sw), Y(v0), (sw / 2) * s, 0, Math.PI)
      ctx.closePath()
      ctx.fillStyle = C.guide
      ctx.fill()
      ctx.strokeStyle = line
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.strokeStyle = 'rgba(201,195,178,.9)'
      ctx.lineWidth = Math.max(0.5, 1.2 * s)
      ctx.beginPath()
      for (let k = 1; k < n; k++) {
        ctx.moveTo(X(u0 + k * sw), Y(v1 - 3))
        ctx.lineTo(X(u0 + k * sw), Y(v0))
      }
      ctx.stroke()
      ctx.strokeStyle = line
      ctx.lineWidth = lw
    }
    /** The name board: paper, u0 to u1 across, v0 to v1 up, the name in clear ink. */
    const nameBoard = (u0: number, u1: number, v0: number, v1: number, size: number) => {
      ctx.fillStyle = C.paper
      rr(X(u0), Y(v1), (u1 - u0) * s, (v1 - v0) * s, 5 * s)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = C.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      fitText(shop.name, (u1 - u0 - 20) * s, size * s, SERIF)
      stamp(shop.name, X((u0 + u1) / 2), Y((v0 + v1) / 2))
    }
    /** A cup and its saucer, in pencil, its middle at (u, v), `r0` units across. */
    const cup = (u: number, v: number, r0: number) => {
      const cx = X(u)
      const cy = Y(v)
      const r = r0 * s
      ctx.lineWidth = Math.max(0.5, 1.3 * s)
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.6, cy - r * 0.2)
      ctx.lineTo(cx - r * 0.5, cy + r * 0.45)
      ctx.quadraticCurveTo(cx, cy + r * 0.7, cx + r * 0.3, cy + r * 0.45)
      ctx.lineTo(cx + r * 0.4, cy - r * 0.2)
      ctx.closePath()
      ctx.moveTo(cx + r * 0.4, cy - r * 0.05)
      ctx.quadraticCurveTo(cx + r * 0.85, cy, cx + r * 0.36, cy + r * 0.35)
      ctx.moveTo(cx - r * 0.8, cy + r * 0.75)
      ctx.lineTo(cx + r * 0.6, cy + r * 0.75)
      ctx.stroke()
      ctx.lineWidth = lw
    }
    // A kiosk on a little island in the middle of the road; the road splits around it.
    ctx.beginPath()
    ctx.ellipse(X(0), Y(0), (KIOSK_HALF - 2) * s, 17 * s, 0, 0, Math.PI * 2)
    ctx.fillStyle = C.guide
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.fillRect(X(-60), Y(102), 120 * s, 100 * s)
    sketch(X(-60), Y(2), X(-60), Y(102), seed + 1, 1.5 * s)
    sketch(X(60), Y(102), X(60), Y(2), seed + 3, 1.5 * s)
    sketch(X(-60), Y(2), X(60), Y(2), seed + 4, 1 * s)
    // The serving hatch with its counter, and a cup on the counter.
    ctx.fillStyle = C.paper
    rr(X(-44), Y(88), 88 * s, 42 * s, 3 * s)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(X(-50), Y(46))
    ctx.lineTo(X(50), Y(46))
    ctx.stroke()
    cup(18, 56, 12)
    awning(-72, 72, 102, 122, 6)
    ctx.beginPath()
    for (const u of [-46, 46]) {
      ctx.moveTo(X(u), Y(122))
      ctx.lineTo(X(u), Y(KIOSK_BOARD_FROM))
    }
    ctx.stroke()
    nameBoard(-KIOSK_BOARD_HALF + 1, KIOSK_BOARD_HALF - 1, KIOSK_BOARD_FROM, KIOSK_BOARD_TO - 1, 26)
    ctx.restore()
  }

  // ── the world: the white road with its kerbs and cobbles ─────────────────
  function drawWorld(scroll: number): void {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const edge = 1.5 * LANE
    // An old street has a kerb, not a painted edge: one loose pencil line a
    // side, in broken lengths.
    {
      const step = 0.55
      const off = scroll % step
      const base = Math.floor(scroll / step)
      ctx.strokeStyle = 'rgba(18,18,18,.4)'
      // From the bottom of the canvas: a tall phone shows more road below Casey.
      for (let k = Math.floor((zNear + 0.2) / step); k < 9; k++) {
        const z1 = Math.max(zNear + 0.01, -0.2 + k * step - off)
        const z2 = -0.2 + k * step - off + step * (0.72 + noise(k + base) * 0.3)
        if (z2 <= z1) continue
        const s1 = sAt(z1)
        const s2 = sAt(z2)
        ctx.globalAlpha = Math.max(0, Math.min(1, (4 - z1) / 2.5))
        ctx.lineWidth = Math.max(0.6, 2 * s1)
        for (const side of [-1, 1]) sketch(CX + side * edge * s1, gy(s1), CX + side * edge * s2, gy(s2), (k + base) * 2 + side, 2.5 * s1)
      }
      ctx.globalAlpha = 1
    }
    // Square cobbles, as on an old European street: small setts in staggered
    // rows, only patches of them, in faint pencil. Each stone is two or three
    // quick strokes that stop short of the corners and never close the box.
    {
      const step = 0.05
      const off = scroll % step
      const base = Math.floor(scroll / step)
      const n = 18
      const cw = (2 * edge) / n
      ctx.strokeStyle = 'rgba(18,18,18,.24)'
      for (let k = Math.floor((zNear + 0.18) / step); k < 76; k++) {
        const z = -0.18 + k * step - off
        const id = k + base
        if (z < zNear + 0.01) continue
        const s1 = sAt(z)
        const s2 = sAt(z + step * 0.8)
        const y1 = gy(s1)
        const y2 = gy(s2)
        ctx.globalAlpha = Math.max(0, Math.min(1, (3.4 - z) / 2.4))
        if (ctx.globalAlpha <= 0) continue
        ctx.lineWidth = Math.max(0.5, 1.3 * s1)
        const stag = id % 2 ? 0.5 : 0
        ctx.beginPath()
        for (let j = -1; j < n; j++) {
          if (noise(Math.floor(id / 5) * 9.1 + Math.floor((j + 20) / 3) * 5.7) < 0.02 || noise(id * 17.3 + j * 3.1) < -0.25) continue
          const a = -edge + (j + stag + 0.1) * cw
          const b = a + cw * 0.8
          if (a < -edge || b > edge) continue
          const sd = id * 31.7 + j * 7.3
          const q = (i: number, amt: number) => noise(sd + i) * amt
          const A: [number, number] = [CX + a * s1 + q(1, 3 * s1), y1 + q(2, 2 * s1)]
          const B: [number, number] = [CX + b * s1 + q(3, 3 * s1), y1 + q(4, 2 * s1)]
          const Cc: [number, number] = [CX + b * s2 + q(5, 3 * s1), y2 + q(6, 2 * s1)]
          const D: [number, number] = [CX + a * s2 + q(7, 3 * s1), y2 + q(8, 2 * s1)]
          const cut = (P: [number, number], Q: [number, number], f0: number, f1: number) => {
            ctx.moveTo(P[0] + (Q[0] - P[0]) * f0, P[1] + (Q[1] - P[1]) * f0)
            ctx.lineTo(P[0] + (Q[0] - P[0]) * f1, P[1] + (Q[1] - P[1]) * f1)
          }
          const v = Math.floor((noise(sd + 9) + 0.5) * 5)
          if (v === 0) { cut(D, Cc, 0.1, 1); cut(Cc, B, 0, 0.75) }
          else if (v === 1) { cut(Cc, D, 0.1, 1); cut(D, A, 0, 0.7) }
          else if (v === 2) { cut(A, B, 0.15, 1); cut(B, Cc, 0, 0.8) }
          else if (v === 3) { cut(D, Cc, 0.05, 0.9); cut(A, B, 0.3, 0.8) }
          else { cut(D, Cc, 0.1, 1); cut(Cc, B, 0, 0.8); cut(B, A, 0.1, 0.6) }
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    // paper haze at the horizon
    if (!haze) {
      haze = ctx.createLinearGradient(0, HOR, 0, HOR + 120)
      haze.addColorStop(0, 'rgba(255,255,255,.95)')
      haze.addColorStop(1, 'rgba(255,255,255,0)')
    }
    ctx.fillStyle = haze
    ctx.fillRect(0, HOR + 1, W, 120)
    drawStreet(scroll)
  }

  // ── a gate: white suitcases under a tied manila tag ──────────────────────
  function drawGate(gate: RunGate, behind = 1): void {
    const n = gate.options.length
    const s = sAt(gate.z)
    const base = gy(s)
    const w = lanesFor(n) * 0.93 * s
    const cs = w / 104 // the app's suitcase drawing (body 104 x 70) scaled to the lane
    const h = 70 * cs
    let a = Math.min(1, (FAR - gate.z) / 0.6)
    if (gate.z < 0) a = Math.max(0, 1 + gate.z / 0.18)
    a *= behind
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const lw = Math.max(1, 2.2 * s)
    const labelW = w - 16 * cs
    let labelY = 0
    for (let i = 0; i < n; i++) {
      const x = CX + laneAt(i, n) * s
      const right = gate.resolved && i === gate.correct
      const wrong = i === gate.wrongLane
      const x0 = x - w / 2
      const y0 = base - h
      const col = right ? C.greenTile : wrong ? C.red : C.ink
      ctx.strokeStyle = col
      ctx.lineWidth = right || wrong ? lw * 1.6 : lw * 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - 15 * cs, y0)
      ctx.lineTo(x - 15 * cs, y0 - 6 * cs)
      ctx.quadraticCurveTo(x - 15 * cs, y0 - 12 * cs, x - 9 * cs, y0 - 12 * cs)
      ctx.lineTo(x + 9 * cs, y0 - 12 * cs)
      ctx.quadraticCurveTo(x + 15 * cs, y0 - 12 * cs, x + 15 * cs, y0 - 6 * cs)
      ctx.lineTo(x + 15 * cs, y0)
      ctx.stroke()
      ctx.fillStyle = right ? C.greenSoft : wrong ? C.redSoft : '#fff'
      rr(x0, y0, w, h, 12 * cs)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x0, y0 + 12 * cs)
      ctx.lineTo(x0 + w, y0 + 12 * cs)
      ctx.stroke()
      ctx.strokeStyle = C.pencil
      ctx.lineWidth = Math.max(0.6, 1.2 * cs)
      for (const [a1, b1, a2, b2] of [[6, 62, 14, 54], [11, 64, 20, 55], [17, 65, 26, 56], [88, 8, 95, 1]]) {
        ctx.beginPath()
        ctx.moveTo(x0 + a1 * cs, y0 + b1 * cs)
        ctx.lineTo(x0 + a2 * cs, y0 + b2 * cs)
        ctx.stroke()
      }
      labelY = y0 + 41 * cs
    }
    // The tag: clipped corners at the string end, a punched hole, and a pencil
    // string tied to the middle suitcase's handle. A different slant on every
    // gate, up to about 4.5 degrees either way.
    const tw = 3 * LANE * s * 0.8
    const th = 84 * s
    const ty = base - h - 12 * cs - 28 * s - th
    const tilt = noise(gate.id * 3.3) * 0.16
    ctx.save()
    ctx.translate(CX, ty + th / 2)
    ctx.rotate(tilt)
    const x0 = -tw / 2
    const x1 = tw / 2
    const c = 26 * s
    const r = 9 * s
    ctx.beginPath()
    ctx.moveTo(x0, -th / 2 + c)
    ctx.lineTo(x0 + c, -th / 2)
    ctx.lineTo(x1 - r, -th / 2)
    ctx.quadraticCurveTo(x1, -th / 2, x1, -th / 2 + r)
    ctx.lineTo(x1, th / 2 - r)
    ctx.quadraticCurveTo(x1, th / 2, x1 - r, th / 2)
    ctx.lineTo(x0 + c, th / 2)
    ctx.lineTo(x0, th / 2 - c)
    ctx.closePath()
    ctx.fillStyle = C.guide
    ctx.strokeStyle = C.ink
    ctx.lineWidth = lw * 1.2
    ctx.fill()
    ctx.stroke()
    const hx = x0 + c * 0.95
    ctx.fillStyle = '#fff'
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(hx, 0, 6.5 * s, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(18,18,18,.5)'
    ctx.lineWidth = Math.max(0.7, 1.5 * s)
    ctx.beginPath()
    ctx.moveTo(hx, 0)
    {
      const dx = (n === 2 ? laneAt(0, 2) : 0) * s
      const dy = base - h - 12 * cs - (ty + th / 2)
      const co = Math.cos(tilt)
      const si = Math.sin(tilt)
      const ex = dx * co + dy * si
      const ey = -dx * si + dy * co
      ctx.bezierCurveTo(hx - 50 * s, 34 * s, ex - 70 * s, ey - 4 * s, ex, ey)
    }
    ctx.stroke()
    ctx.fillStyle = C.ink
    fitText(gate.prompt, tw - c * 2.1 - 14 * s, 62 * s, SERIF)
    word(gate.prompt, c * 0.55, 0, gate.reveal, tw * 0.5, 44 * s, gate.id * 10 + 5, 'rgba(18,18,18,.45)')
    ctx.restore()
    // The words in the learner's language, as large as their suitcase allows.
    // The articles always say the same thing in the same lane, so they are
    // never scribbled over, and they are larger (the prototype's 58 for two
    // lanes; a step down for three, which are narrower).
    const article = gate.kind === 'article'
    for (let i = 0; i < n; i++) {
      const wrong = i === gate.wrongLane
      ctx.fillStyle = wrong ? C.red : C.ink
      const label = gate.options[i].target
      fitText(label, labelW, (article ? (n === 2 ? 58 : 44) : 30) * s + 6)
      word(label, CX + laneAt(i, n) * s, labelY, article ? 1 : gate.reveal, w * 0.72, 24 * s, gate.id * 10 + i, 'rgba(18,18,18,.45)')
    }
    ctx.restore()
  }

  // ── Casey: the app's ClueyFace drawing (viewBox 120 x 96) ─────────────────
  const P = {
    handle: new Path2D('M45 18 v-6 a6 6 0 0 1 6-6 h18 a6 6 0 0 1 6 6 v6'),
    smile: new Path2D('M52 56 q8 8 16 0'),
  }
  /** The branch Casey takes round each kiosk, chosen as it comes near and kept until it is gone. */
  const dodgeSides = new Map<number, -1 | 1>()
  function drawCasey(state: RunState, view: RunView): void {
    const running = view.running && state.phase === 'play'
    const still = view.reducedMotion
    // Round a kiosk on the road: the nearest one she is going round, if any.
    let w = 0
    let side: -1 | 1 = 1
    for (const shop of state.shopfronts) {
      const d = caseyDodge(shop.z)
      if (d <= 0) {
        if (shop.z < DODGE_IN[1]) dodgeSides.delete(shop.id)
        continue
      }
      let sd = dodgeSides.get(shop.id)
      if (sd === undefined) dodgeSides.set(shop.id, (sd = dodgeSide(laneAt(state.laneX, state.lanes))))
      if (d > w) {
        w = d
        side = sd
      }
    }
    if (!state.shopfronts.length) dodgeSides.clear()
    const caseyX = CX + dodgedX(laneAt(state.laneX, state.lanes), w, side)
    const targetX = CX + dodgedX(laneAt(state.lane, state.lanes), w, side)
    const bob = running && !still ? Math.abs(Math.sin(state.clock * 9)) * -7 : 0
    const lean = still ? 0 : (targetX - caseyX) * 0.004
    ctx.strokeStyle = C.pencil
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    for (let i = -5; i <= 5; i++) {
      const x = caseyX + i * 11
      const r = 9 * (1 - Math.abs(i) / 9) * (1 + bob / 20)
      ctx.beginPath()
      ctx.moveTo(x - r * 0.7, PY + 4 + r * 0.6)
      ctx.lineTo(x + r * 0.7, PY + 4 - r * 0.6)
      ctx.stroke()
    }
    ctx.save()
    ctx.translate(caseyX, PY + bob)
    ctx.rotate(lean + (running && !still ? Math.sin(state.clock * 9) * 0.03 : 0))
    ctx.scale(1.25, 1.25)
    ctx.translate(-60, -88)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 3
    ctx.stroke(P.handle)
    ctx.fillStyle = C.beige
    rr(8, 18, 104, 70, 12)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = C.pencil
    ctx.lineWidth = 1.2
    for (const [x1, y1, x2, y2] of [[14, 80, 22, 72], [19, 82, 28, 73], [25, 83, 34, 74], [96, 26, 103, 19]]) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(8, 40)
    ctx.lineTo(112, 40)
    ctx.stroke()
    if (running) {
      // On the road she faces the gates: we see her back, two pencil ribs and no face.
      ctx.strokeStyle = C.pencil
      ctx.lineWidth = 1.6
      for (const x of [40, 80]) {
        ctx.beginPath()
        ctx.moveTo(x, 46)
        ctx.lineTo(x, 82)
        ctx.stroke()
      }
    } else {
      // Stopped, she turns round to the player.
      ctx.fillStyle = C.ink
      rr(26, 36, 8, 8, 2)
      ctx.fill()
      rr(86, 36, 8, 8, 2)
      ctx.fill()
      const blink = !still && state.clock % 3.1 < 0.11
      for (const cx of [46, 74]) {
        if (blink) {
          ctx.beginPath()
          ctx.moveTo(cx - 6, 29)
          ctx.lineTo(cx + 6, 29)
          ctx.stroke()
          continue
        }
        ctx.fillStyle = '#fff'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(cx, 29, 6, 0, 7)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = C.ink
        ctx.beginPath()
        ctx.arc(cx + Math.max(-2.6, Math.min(2.6, lean * 40)), 28, 2.6, 0, 7)
        ctx.fill()
        ctx.lineWidth = 3
      }
      if (state.phase === 'over' && state.endReason === 'second-wrong') {
        ctx.beginPath()
        ctx.arc(60, 57, 3.4, 0, 7)
        ctx.stroke()
      } else ctx.stroke(P.smile)
    }
    // the green travel sticker carries the score
    ctx.fillStyle = C.greenSoft
    ctx.strokeStyle = C.greenTile
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(94, 70, 9, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 8px ui-monospace, Menlo, Consolas, monospace'
    ctx.fillText(state.photos > 99 ? '99+' : String(state.photos), 94, 70.5)
    ctx.restore()
  }

  // ── the bar: a luggage tag across the top ────────────────────────────────
  function drawHud(state: RunState, view: RunView, active: RunGate | undefined): void {
    const { labels } = view
    const LX = HUD_LX
    const RX = HUD_RX
    const MIDW = 230
    ctx.textBaseline = 'middle'
    const x0 = 14
    const x1 = W - 14
    const y0 = 12
    const y1 = HUD_BOTTOM
    const c = 26
    const r = 10
    ctx.beginPath()
    ctx.moveTo(x0, y0 + c)
    ctx.lineTo(x0 + c, y0)
    ctx.lineTo(x1 - r, y0)
    ctx.quadraticCurveTo(x1, y0, x1, y0 + r)
    ctx.lineTo(x1, y1 - r)
    ctx.quadraticCurveTo(x1, y1, x1 - r, y1)
    ctx.lineTo(x0 + c, y1)
    ctx.lineTo(x0, y1 - c)
    ctx.closePath()
    ctx.fillStyle = C.guide
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 2.2
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x0 + 24, 61, 7, 0, 7)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(18,18,18,.5)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x0 + 24, 61)
    ctx.bezierCurveTo(x0 + 2, 40, x0 + 6, 16, x0 - 6, -4)
    ctx.stroke()

    ctx.fillStyle = C.dim
    ctx.font = `bold 11px ${SANS}`
    ctx.textAlign = 'left'
    ctx.fillText(labels.photos, LX, 32)
    ctx.textAlign = 'right'
    ctx.fillText(labels.best, RX, 32)
    ctx.textAlign = 'center'
    const ask = active && labels.askDetail ? `${labels.ask}  \u00b7  ${labels.askDetail(active)}` : labels.ask
    fitText(ask, MIDW, 11)
    ctx.fillText(ask, CX, 32)
    const NUM = `bold 24px ${SANS}`
    ctx.fillStyle = C.ink
    ctx.font = NUM
    ctx.textAlign = 'left'
    // The train run (state.total > 0) counts words answered on the left and
    // words to go on the right, as the prototype's train bar did; a walk
    // counts photos and its best.
    const trainRun = state.total > 0
    const mine = String(trainRun ? state.answered : state.photos)
    ctx.fillText(mine, LX, 59)
    // A small camera beside the photo count: it gives a little jump and its
    // lens lights when a word is photographed. No flash over the road and no
    // shutter sound: the spoken word is the sound (contract §2).
    {
      const t = Math.max(0, state.flash / 0.35)
      const k = view.reducedMotion ? 1 : 1 + Math.sin(t * Math.PI) * 0.28
      const cx = LX + ctx.measureText(mine).width + 24
      const cy = 58
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(k, k)
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 1.8
      ctx.fillStyle = C.paper
      ctx.lineJoin = 'round'
      rr(-5, -11.5, 9, 5, 1.5)
      ctx.fill()
      ctx.stroke()
      rr(-12, -8, 24, 16, 3.5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = t > 0 ? C.green : '#fff'
      ctx.beginPath()
      ctx.arc(0, 0, 4.6, 0, 7)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = C.ink
      ctx.font = NUM
    }
    ctx.textAlign = 'right'
    const theirs = String(trainRun ? Math.max(0, state.total - state.answered) : Math.max(view.best, state.photos))
    ctx.fillText(theirs, RX, 59)
    ctx.textAlign = 'center'
    if (active) {
      // Between the photo block and the best block, whatever the count: shrunk
      // to fit, then on two lines (`hudWordLayout`). Each line is drawn once
      // and scaled, like the words on the road.
      const room = hudWordRoom(ctx.measureText(mine).width, ctx.measureText(theirs).width)
      const fit = hudWordLayout(active.prompt, (t) => unitWidth(t, SERIF), room)
      for (const line of fit.lines) {
        ctx.font = `bold ${line.size}px ${SERIF}`
        TF = { size: line.size, font: SERIF, weight: 'bold' }
        stamp(line.text, fit.x, line.y)
      }
    }
    // speed pips, the one forgiven slip, and the distance left to the next gate
    for (let i = 0; i < GATE_TIERS.length; i++) {
      ctx.beginPath()
      ctx.arc(LX + 4 + i * 13, 84, 4, 0, 7)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = i <= state.tier ? C.greenTile : C.beigeDeep
      ctx.fillStyle = i <= state.tier ? C.green : '#fff'
      ctx.fill()
      ctx.stroke()
    }
    const slipsLeft = Math.max(0, view.forgiven - state.slips)
    const used = slipsLeft <= 0
    ctx.fillStyle = used ? C.redSoft : C.greenSoft
    ctx.strokeStyle = used ? C.red : C.greenTile
    ctx.lineWidth = 1.2
    rr(RX - 92, 75, 92, 19, 9.5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = used ? C.red : C.greenDeep
    const slipText = labels.slipsLeft(slipsLeft)
    fitText(slipText, 84, 11)
    ctx.textAlign = 'center'
    ctx.fillText(slipText, RX - 46, 84.5)
    if (active && state.phase === 'play') {
      ctx.fillStyle = C.green
      rr(LX, 99, (RX - LX) * Math.max(0, Math.min(1, active.z / SPACING)), 4, 2)
      ctx.fill()
    }
    if (state.slipFlash > 0 && !view.reducedMotion) {
      ctx.fillStyle = `rgba(165,28,48,${state.slipFlash * 0.3})`
      ctx.fillRect(0, 0, W, F.height)
    }
    const note = state.note
    if (note && state.phase === 'play') {
      const text = note.kind === 'faster' ? labels.faster : labels.slipNote(note.word)
      fitText(text, W - 60, 16)
      const tw = ctx.measureText(text).width + 36
      ctx.globalAlpha = view.reducedMotion ? 1 : Math.min(1, note.t * 2)
      ctx.fillStyle = note.kind === 'slip' ? C.red : C.ink
      rr(CX - tw / 2, 122, tw, 34, 17)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(text, CX, 139.5)
      ctx.globalAlpha = 1
    }
  }

  function draw(state: RunState, view: RunView): void {
    fit(window.devicePixelRatio || 1, view.safeBottom ?? 0)
    ctx.setTransform(K, 0, 0, K, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, F.height)
    drawSky()
    // The world in the prototype's units, moved down by the extra sky.
    ctx.setTransform(K, 0, 0, K, 0, K * F.sky)
    drawWorld(state.scroll)
    const ahead = state.gates.filter((g) => g.z > 0).sort((a, b) => b.z - a.z)
    // Far to near; each queued gate comes out from behind the one in front of
    // it, and a café on the road is drawn in its place between them.
    const cafes = [...state.shopfronts].sort((a, b) => b.z - a.z)
    let c = 0
    ahead.forEach((g, i) => {
      while (c < cafes.length && cafes[c].z > g.z) drawCafe(cafes[c++])
      drawGate(g, queuedGateAlpha(g.z, ahead[i + 1]?.z, g.options.length))
    })
    while (c < cafes.length) drawCafe(cafes[c++])
    drawCasey(state, view)
    for (const g of state.gates) if (g.z <= 0) drawGate(g)
    const active = state.gates.find((g) => !g.resolved)
    // The bar stays at the top of the canvas.
    ctx.setTransform(K, 0, 0, K, 0, 0)
    drawHud(state, view, active)
  }

  return { draw }
}

export type RunPainter = ReturnType<typeof createRunPainter>
