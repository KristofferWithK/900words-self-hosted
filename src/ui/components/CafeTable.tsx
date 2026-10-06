import { memo, type CSSProperties, type ReactElement } from 'react'
import type { CafeArrangement, DrawingId, TableItem } from '../../cafe/cafeTable'

/**
 * The café puzzle's table and name tag (docs/roadmap/cafe-world.md section 5;
 * card CW-08). What lies where is decided by `src/cafe/cafeTable.ts`; this
 * file draws it. The two regions, the pencil ink and the stacking are in
 * `src/styles/77-cafe-puzzle.css`.
 *
 * Section 6's rule: things the player acts on are bold ink, everything else
 * faint pencil. Every item here is faint pencil, decorative (aria-hidden),
 * takes no pointer and is painted behind everything else on the screen, so it
 * can never cover text or be tapped instead of a card.
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
  plate: (
    <>
      <circle cx="24" cy="24" r="20" />
      <circle cx="24" cy="24" r="13.5" />
      <path d="M10.5 15.5c1.2-1.8 2.6-3.2 4.3-4.4M35.5 34.8c-1.3 1.6-2.8 3-4.6 4" />
    </>
  ),
  lamp: (
    <>
      <path d="M15 8h18l7 15H8z" />
      <path d="M24 23v14M24 37c-7 0-11 2-11 4s4 3 11 3 11-1 11-3-4-4-11-4z" />
      <path d="M13 23c0 2 1 3 2 3M29 27v4" />
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
  // Paw prints: a little trail of three, as a cat walks across the table.
  paw: (
    <>
      <path d="M12 38.5c-2.6 0-4.6 2.4-4.6 4s1.6 2 2.6 2 1.3-.6 2-.6 1.2.6 2.1.6 2.5-.4 2.5-2-2-4-4.6-4z" />
      <circle cx="7.2" cy="35.6" r="1.5" />
      <circle cx="10.3" cy="33.2" r="1.6" />
      <circle cx="14" cy="33.2" r="1.6" />
      <circle cx="17" cy="35.6" r="1.5" />
      <path d="M25 24.5c-2.6 0-4.6 2.4-4.6 4s1.6 2 2.6 2 1.3-.6 2-.6 1.2.6 2.1.6 2.5-.4 2.5-2-2-4-4.6-4z" />
      <circle cx="20.2" cy="21.6" r="1.5" />
      <circle cx="23.3" cy="19.2" r="1.6" />
      <circle cx="27" cy="19.2" r="1.6" />
      <circle cx="30" cy="21.6" r="1.5" />
      <path d="M36 11.5c-2.6 0-4.6 2.4-4.6 4s1.6 2 2.6 2 1.3-.6 2-.6 1.2.6 2.1.6 2.5-.4 2.5-2-2-4-4.6-4z" />
      <circle cx="31.2" cy="8.6" r="1.5" />
      <circle cx="34.3" cy="6.2" r="1.6" />
      <circle cx="38" cy="6.2" r="1.6" />
      <circle cx="41" cy="8.6" r="1.5" />
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
  // A companion: the ball of yarn beside a cat café's paw prints.
  yarn: (
    <>
      <circle cx="22" cy="22" r="15" />
      <path d="M9 16c6 1 13 7 15 20M12 30c5-9 14-15 24-15M17 8.5c5 6 7 15 6 28M29 9c-1 8-6 16-16 22" />
      <path d="M35 28c3 4 5 8 3 11s-6 2-6 5" />
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

function Item({ item }: { item: TableItem }) {
  // Placed by custom properties the stylesheet reads, so where a spot sits on
  // the screen stays a stylesheet matter (77-cafe-puzzle.css).
  const place = { '--x': `${item.x}%`, '--y': `${item.y}%`, '--size': item.size } as CSSProperties
  return (
    <span
      className={`cafe-item${item.signature ? ' cafe-item-signature' : ''}`}
      data-spot={item.spot}
      data-drawing={item.drawing}
      style={place}
    >
      <CafeDrawing drawing={item.drawing} turn={item.turn} flip={item.flip} />
    </span>
  )
}

/**
 * The café's table: drawn behind everything on the game screen, the board's
 * region and the bottom area's (docs/roadmap/cafe-world.md section 5: "each
 * café's table art is fixed and does not change during the puzzle"). Nothing
 * in the game reaches it: it takes the arrangement and nothing else, so no
 * turn, phase or Casey state can show, hide, move or redraw an item. Memoised
 * on that one prop (GameScreen makes it once per café), so the round's
 * re-renders, a card tap's included, never touch these drawings.
 *
 * Two layers of the one arrangement. The board's region is fixed to the
 * phone's screen. The bottom area's rides with the dock (owner, build 123:
 * with the keyboard up the art around the composer "switches the artwork or
 * takes it from the board"): it is anchored to the dock's rectangle, so when
 * the composer goes up with the keyboard its own items go up with it,
 * exactly as they lie at rest, and come back down with it
 * (77-cafe-puzzle.css, and the ride in src/ui/nativeKeyboard.ts).
 */
export const CafeTable = memo(function CafeTable({ table }: { table: CafeArrangement }) {
  const region = (name: TableItem['region']) => (
    <div className={`cafe-table-region cafe-table-${name}`}>
      {table.items.filter((item) => item.region === name).map((item) => (
        <Item key={item.spot} item={item} />
      ))}
    </div>
  )
  return (
    <>
      <div className="cafe-table" aria-hidden="true" data-cafe={table.cafeId}>
        {region('board')}
      </div>
      <div className="cafe-table-composer" aria-hidden="true" data-cafe={table.cafeId}>
        {region('bottom')}
      </div>
    </>
  )
})

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
