import { MARKS_TO_COLLECT } from '../../journey/wordMarks'

/**
 * A word's marks as a small ring that fills a third per mark (S2 in
 * docs/design/cafe-world/design-suitcase-tags-options.jpg; contract section 6).
 * A pie, not a stroke: at 11px a filled third reads where an arc does not.
 * Empty, it is the outline alone; full, a solid dot.
 *
 * Decorative: the tile's accessible name says the marks in words
 * (suitcaseWords.ts `markAria`). Its ink and size are the `--case-ring-*`
 * tokens at the top of styles/69-suitcase-marks-and-stamps.css.
 */
export function MarkRing({ earned }: { readonly earned: number }) {
  const filled = Math.max(0, Math.min(MARKS_TO_COLLECT, Math.floor(earned)))
  return (
    <svg className={`case-ring case-ring-${filled}`} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle className="case-ring-edge" cx="6" cy="6" r="5.1" />
      {filled === MARKS_TO_COLLECT ? <circle className="case-ring-fill" cx="6" cy="6" r="5.1" /> : filled > 0 && <path className="case-ring-fill" d={sector(filled / MARKS_TO_COLLECT)} />}
    </svg>
  )
}

/** A pie slice from twelve o'clock, clockwise, of `share` of the circle. */
function sector(share: number): string {
  const r = 5.1
  const angle = share * 2 * Math.PI
  const x = 6 + r * Math.sin(angle)
  const y = 6 - r * Math.cos(angle)
  const large = share > 0.5 ? 1 : 0
  return `M6 6 L6 ${6 - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`
}
