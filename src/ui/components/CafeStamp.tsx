import type { Tier } from '../../progression/types'

/**
 * A café's stamp, drawn in its tier's ink (owner, O7: Bronze orange, Silver
 * grey, Gold ochre, Platinum blue; the inks are the `--stamp-*` tokens in
 * styles/92-finish-screen.css). A ring, a cup and the tier word, after the
 * settled finish screen (docs/design/cafe-world/design-settled.jpg). With no
 * tier it is the empty place a stamp would go: a dashed circle, the mark the
 * stamp card uses for a café with no stamp yet.
 *
 * Decorative: the line beside it says the stamp in words, so the drawing is
 * hidden from assistive technology. `ring` is that word, already translated.
 */
export function CafeStamp({ tier, ring, className = '' }: {
  readonly tier: Tier | null
  readonly ring?: string
  readonly className?: string
}) {
  const classes = `cafe-stamp ${tier ? `cafe-stamp-${tier}` : 'cafe-stamp-empty'} ${className}`.trim()
  if (!tier) {
    return <svg viewBox="0 0 48 48" className={classes} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3.2 3" />
    </svg>
  }
  const word = (ring ?? '').toLocaleUpperCase()
  // Squeeze a long tier word into the ring rather than let it run outside.
  const squeeze = word.length > 6 ? { textLength: 25, lengthAdjust: 'spacingAndGlyphs' as const } : {}
  return <svg viewBox="0 0 48 48" className={classes} aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="21.6" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="24" cy="24" r="17.6" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity=".6" />
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.2 13.6h11.6v3.4a5.8 5.8 0 0 1-11.6 0z" />
      <path d="M28.8 14.6h1.3a2.3 2.3 0 0 1 0 4.6h-1.6" />
      <path d="M15.4 25.4h15.2" />
    </g>
    {word && <text x="24" y="34.6" textAnchor="middle" className="cafe-stamp-ring" fill="currentColor" {...squeeze}>{word}</text>}
  </svg>
}
