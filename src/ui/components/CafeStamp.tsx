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
export function CafeStamp({ tier, ring, emptyLabel, className = '' }: {
  readonly tier: Tier | null
  readonly ring?: string
  /** Words written inside the empty circle (Home's "No stamp"), already translated. Ignored once there is a tier. */
  readonly emptyLabel?: string
  readonly className?: string
}) {
  const classes = `cafe-stamp ${tier ? `cafe-stamp-${tier}` : 'cafe-stamp-empty'} ${className}`.trim()
  if (!tier) {
    const lines = emptyLabel ? emptyLabelLines(emptyLabel) : []
    const top = lines.length === 2 ? 22.4 : 27
    return <svg viewBox="0 0 48 48" className={classes} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3.2 3" />
      {lines.map((line, i) => {
        const squeeze = estimatedWidth(line) > EMPTY_LABEL_MAX ? { textLength: EMPTY_LABEL_MAX, lengthAdjust: 'spacingAndGlyphs' as const } : {}
        return <text key={i} x="24" y={top + i * 9} textAnchor="middle" fontSize={EMPTY_LABEL_SIZE} className="cafe-stamp-empty-label" fill="currentColor" {...squeeze}>{line}</text>
      })}
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

/** The empty circle's words: their size and the widest a line may run inside the dashed ring, in viewBox units. */
const EMPTY_LABEL_SIZE = 8.4
const EMPTY_LABEL_MAX = 33

/** A rough width for squeezing: CJK glyphs are about an em wide, Latin ones a little over half. */
function estimatedWidth(line: string): number {
  return [...line].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.56), 0) * EMPTY_LABEL_SIZE
}

/** One line for one word ("无印章"), two for more, split where the halves come out most even ("No" / "stamp"). */
export function emptyLabelLines(label: string): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return words
  let best = 1
  let bestWidth = Infinity
  for (let i = 1; i < words.length; i++) {
    const widest = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length)
    if (widest < bestWidth) {
      best = i
      bestWidth = widest
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}
