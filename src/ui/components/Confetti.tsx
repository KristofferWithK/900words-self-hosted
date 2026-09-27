/**
 * The scraps, in the board's own hand.
 *
 * They used to be plain coloured rectangles in a five-colour palette that
 * belonged to nothing else on screen — the one thing left in the app the
 * pencil pass had never reached. Four torn shapes now, drawn through
 * `#pencil-edge` in the `.cluey-hatch` weight and tinted from the card
 * palette, so a win is celebrated by the same hand that drew the round.
 *
 * The fall is untouched: the same deterministic left/delay/duration triple
 * over the same twenty-eight pieces, the same one-shot `confetti-fall`, the
 * same `prefers-reduced-motion` rule. Still no dependency.
 *
 * Its own module since the finish screen became the reader: the finish
 * surface drops it over a won round and the tutorial's win beat celebrates
 * without the summary, and neither should import the other for it.
 */
const SCRAP_PATHS = [
  'M1 2 L11 1 L9 9 L2 11 Z',
  'M2 1 L10 4 L6 11 L1 7 Z',
  'M1 6 Q6 0 11 5 Q6 11 1 6 Z',
  'M3 1 L11 3 L8 10 L1 8 Z',
]
const SCRAP_TINTS = ['var(--green)', 'var(--line)', 'var(--beige-deep)']

/** One-shot pencil confetti — deterministic layout, no dependencies. */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <svg
          key={i}
          className="confetti-piece"
          viewBox="0 0 12 12"
          style={{
            left: `${(i * 37) % 100}%`,
            // The tint travels as `color`, so one `fill: currentColor` in the
            // stylesheet draws every scrap.
            color: SCRAP_TINTS[i % SCRAP_TINTS.length],
            animationDelay: `${(i % 7) * 0.12}s`,
            animationDuration: `${2 + (i % 5) * 0.3}s`,
          }}
        >
          <path className="confetti-scrap" d={SCRAP_PATHS[i % SCRAP_PATHS.length]} />
        </svg>
      ))}
    </div>
  )
}
