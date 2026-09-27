/**
 * A solved card's mark: Casey's suitcase, without the face.
 *
 * A word that has been guessed is "put away, out of the game" — the packed
 * thing is Casey's suitcase, so that is the mark. Reuses the body, handle,
 * seam and latches from `ClueyFace` in Cluey.tsx but deliberately NO eyes,
 * NO pupils, NO sticker, NO mouth or brow: a face would make this a second
 * Casey on the board, and the glyph is a symbol, not a character.
 *
 * SUITCASE-AS-CARD (owner, 2026-09-16): on a solved card the drawing IS the
 * card — the body rect is the card's outline, no card border or background
 * behind it. The seam moves up (y 40 → 30) so the lid area is a thin band and
 * the word sits BELOW the seam line in the body area, never cut by the seam.
 * The viewBox crops tight (4 6 112 84) and the strokes draw at weight 4, the
 * mockup's marker line.
 *
 * NO LATCHES (owner, build 87): the two small rects that sat on the seam read
 * as eyes — a suitcase is body + handle + seam + corner hatching, nothing on
 * the seam line. (ClueyFace keeps its latches; Casey keeps her face. This
 * change is only for the card glyph.)
 *
 * Hand-rolled inline SVG like ClueyFace: CSS-styleable strokes, no asset
 * pipeline. The lid word is NOT drawn here — BoardGrid overlays it, so the
 * glyph stays aria-hidden decoration and the accessible name keeps the word.
 */
import { SuitcaseBorderFrames } from './BorderFrames'

export function SuitcaseGlyph({ borderMotion = false }: { borderMotion?: boolean }) {
  return (
    <svg
      className="card-suitcase-glyph"
      viewBox="4 6 112 84"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g className="card-suitcase-figure">
        {/* handle */}
        <path className="card-suitcase-line" d="M45 18 v-6 a6 6 0 0 1 6-6 h18 a6 6 0 0 1 6 6 v6" fill="none" />
        {/* body — the card's outline when the glyph fills the card */}
        <rect
          className={`card-suitcase-body${borderMotion ? ' card-suitcase-body-motion' : ''}`}
          x="8"
          y="18"
          width="104"
          height="70"
          rx="12"
        />
        {borderMotion && <SuitcaseBorderFrames />}
        {/* pencil shading, the same corners ClueyFace rests on */}
        <g className="card-suitcase-hatch" aria-hidden="true">
          <line x1="14" y1="80" x2="22" y2="72" />
          <line x1="19" y1="82" x2="28" y2="73" />
          <line x1="25" y1="83" x2="34" y2="74" />
          <line x1="96" y1="26" x2="103" y2="19" />
        </g>
        {/* the lid seam, moved UP so the word below the seam is never
            crowded — a suitcase, not a box. No latches: on the seam they
            read as eyes (owner, build 87). */}
        <line className="card-suitcase-line" x1="8" y1="30" x2="112" y2="30" />
        {/* no face: a solved word is put away, not watching */}
      </g>
    </svg>
  )
}
