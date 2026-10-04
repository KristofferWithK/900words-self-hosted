import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { BottomSpot, CafeArrangement, DrawingId, EdgeSpot, TableItem } from '../../cafe/cafeTable'

/**
 * The café puzzle's table and name tag (docs/roadmap/cafe-world.md section 5;
 * card CW-08). What lies where is decided by `src/cafe/cafeTable.ts`; this
 * file draws it. Spots, sizes and the pencil ink are custom properties in
 * `src/styles/77-cafe-puzzle.css`.
 *
 * Section 6's rule: things the player acts on are bold ink, everything else
 * faint pencil. Every item here is faint pencil, decorative (aria-hidden) and
 * takes no pointer, so it can never be tapped instead of a card.
 */

/**
 * The drawings: simple pencil line art in a 48 x 48 box, drawn inside a
 * circle of radius 22 round the centre, so an item can lie at any angle
 * without leaving its box. Strokes only; the colour is the item's
 * `currentColor`. One entry per drawing, so a drawing is one easy swap.
 */
const PATHS: Record<DrawingId, ReactElement> = {
  // Ordinary table things.
  cup: (
    <>
      <circle cx="24" cy="24" r="19" />
      <circle cx="24" cy="24" r="10.5" />
      <circle cx="24" cy="24" r="7.5" />
      <path d="M34.5 21.5c4.5 0 5.5 1.2 5.5 2.5s-1 2.5-5.5 2.5" />
    </>
  ),
  spoon: (
    <>
      <ellipse cx="15" cy="15" rx="6" ry="8.5" transform="rotate(-45 15 15)" />
      <path d="M20 20l17 17c1.2 1.2 1.2 2.6 0 3.4-.8.8-2.2.6-3.2-.4L17.5 22.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M8 40l-3 4 4.5-1.5L40 12l-3.5-3.5z" />
      <path d="M8 40l3.5 3.5" />
      <path d="M33 12l3.5 3.5" />
      <path d="M5 44l2-1" />
    </>
  ),
  // Signature items.
  sun: (
    <>
      <circle cx="24" cy="24" r="8" />
      <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M11.3 36.7l4.2-4.2M32.5 15.5l4.2-4.2" />
    </>
  ),
  star: <path d="M24 5l5.3 12.2 13.2 1.2-10 8.8 3 13-11.5-6.8-11.5 6.8 3-13-10-8.8 13.2-1.2z" />,
  shell: (
    <>
      <path d="M24 41L7 19c4-9 10-12 17-12s13 3 17 12z" />
      <path d="M24 41L13 12M24 41l-5-33M24 41l5-33M24 41l11-29" />
      <path d="M20 41h8l-1 3h-6z" />
    </>
  ),
  paw: (
    <>
      <path d="M24 26c-6 0-11 6-11 10s4 5 6 5 3-1.5 5-1.5 3 1.5 5 1.5 6-1 6-5-5-10-11-10z" />
      <ellipse cx="12.5" cy="20" rx="3.4" ry="4.4" />
      <ellipse cx="19.5" cy="12.5" rx="3.4" ry="4.6" />
      <ellipse cx="28.5" cy="12.5" rx="3.4" ry="4.6" />
      <ellipse cx="35.5" cy="20" rx="3.4" ry="4.4" />
    </>
  ),
  flower: (
    <>
      <path d="M17 44h14l2-13H15z" />
      <path d="M24 31V17M24 26c-3-1-6-4-6-7 3 0 6 2 6 5" />
      <circle cx="24" cy="12" r="2.6" />
      <path d="M24 9.4c-1.5-3-1.5-5 0-6 1.5 1 1.5 3 0 6M26.6 12c3-1.5 5-1.5 6 0-1 1.5-3 1.5-6 0M24 14.6c1.5 3 1.5 5 0 6-1.5-1-1.5-3 0-6M21.4 12c-3 1.5-5 1.5-6 0 1-1.5 3-1.5 6 0" />
    </>
  ),
  leaf: (
    <>
      <path d="M9 39C8 22 18 10 40 8c1 20-11 32-31 31z" />
      <path d="M9 39L33 15M17 31h8M22 26v-7M27 21h6" />
    </>
  ),
  book: (
    <>
      <path d="M24 15c-6-4-13-5-19-3v26c6-2 13-1 19 3 6-4 13-5 19-3V12c-6-2-13-1-19 3z" />
      <path d="M24 15v26M9 18c4-1 8-.5 11 1M9 23c4-1 8-.5 11 1M28 19c3-1.5 7-2 11-1M28 24c3-1.5 7-2 11-1" />
    </>
  ),
  key: (
    <>
      <circle cx="13" cy="24" r="7.5" />
      <circle cx="13" cy="24" r="2.5" />
      <path d="M20.5 24H43M36 24v6M41 24v4" />
    </>
  ),
  teapot: (
    <>
      <path d="M11 22c0 11 5 18 13 18s13-7 13-18z" />
      <path d="M11 26L4 17l2-1 7 6M37 23c6-1 7 3 6 7-1 3-4 5-7 5" />
      <path d="M16 22c2-5 14-5 16 0M24 15.5v2" />
      <circle cx="24" cy="14" r="1.8" />
    </>
  ),
  cake: (
    <>
      <path d="M6 33l34-13v14L6 44z" />
      <path d="M6 38.5l34-12.5M6 33l8-8 26-5" />
      <circle cx="31" cy="15" r="3" />
      <path d="M31 12c0-2 1-4 3-5" />
    </>
  ),
  boat: (
    <>
      <path d="M5 28h38l-8 11H13z" />
      <path d="M17 28l7-20 7 20M24 8v20" />
      <path d="M4 43c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 8 0 5-2 8 0" />
    </>
  ),
  // The fallback: a postcard with a stamp, for a name no drawing fits.
  card: (
    <>
      <rect x="5" y="12" width="38" height="25" rx="1.5" />
      <rect x="33" y="15" width="7" height="8" />
      <path d="M24 15v19M9 20h11M9 25h11M9 30h8M27 28h12M27 32h12" />
    </>
  ),
}

/** One drawing, lying at its angle inside its own square. */
export function CafeDrawing({ drawing, turn = 0, flip = false }: { drawing: DrawingId; turn?: number; flip?: boolean }) {
  return (
    <svg className="cafe-drawing" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g transform={`rotate(${turn} 24 24)${flip ? ' translate(48 0) scale(-1 1)' : ''}`}>{PATHS[drawing]}</g>
    </svg>
  )
}

function Item<Spot extends string>({ item }: { item: TableItem<Spot> }) {
  return (
    <span
      className={`cafe-item${item.signature ? ' cafe-item-signature' : ''}`}
      data-spot={item.spot}
      data-drawing={item.drawing}
    >
      <CafeDrawing drawing={item.drawing} turn={item.turn} flip={item.flip} />
    </span>
  )
}

/**
 * The items at the board's two side edges, behind the cards. A layer inside
 * `.board-area` that reaches out over the screen's side padding and clips
 * there, so nothing can widen the page. Hidden while the keyboard is up.
 */
export function CafeTableEdges({ table }: { table: CafeArrangement }) {
  return (
    <div className="cafe-table cafe-table-edges" aria-hidden="true" data-cafe={table.cafeId}>
      {table.edges.map((item) => (
        <Item<EdgeSpot> key={item.spot} item={item} />
      ))}
    </div>
  )
}

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * The bottom area's items. Rendered only by Casey's thinking dock, the one
 * state in which that area is not in use: the composer, the guess bar, the
 * keyboard, her reasoning and translation all take it and these go.
 *
 * A guard after layout puts away any item that would touch Casey or what she
 * is saying (a longer line in another language can reach the spot), so an
 * item never covers text or a control whatever the copy is.
 */
export function CafeTableBottom({ table }: { table: CafeArrangement }) {
  const layer = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = layer.current
    const dock = root?.parentElement
    if (!root || !dock) return
    const guard = () => {
      const keepClear = [...dock.querySelectorAll('.ai-bubble, .cluey-mini, button, input')].map((el) => el.getBoundingClientRect())
      for (const item of root.querySelectorAll<HTMLElement>('.cafe-item')) {
        item.hidden = false
        const box = item.getBoundingClientRect()
        item.hidden = keepClear.some((clear) => overlaps(box, clear))
      }
    }
    guard()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(guard)
    observer.observe(dock)
    for (const el of dock.querySelectorAll('.ai-bubble')) observer.observe(el)
    return () => observer.disconnect()
  }, [table])
  return (
    <div ref={layer} className="cafe-table cafe-table-bottom" aria-hidden="true" data-cafe={table.cafeId}>
      {table.bottom.map((item) => (
        <Item<BottomSpot> key={item.spot} item={item} />
      ))}
    </div>
  )
}

/**
 * The café's name on a small luggage tag, where the phase caption stood. Not
 * a control, so it is drawn smaller and thinner than a Tag button. The name
 * is a Danish proper name and is never translated.
 */
export function CafeNameTag({ name }: { name: string }) {
  return (
    <p className="cafe-name-tag" lang="da">
      <span className="cafe-name-tag-hole" aria-hidden="true" />
      <span className="cafe-name-tag-text">{name}</span>
    </p>
  )
}
