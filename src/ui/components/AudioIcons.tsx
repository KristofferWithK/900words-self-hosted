/**
 * The two audio glyphs, drawn rather than typed.
 *
 * They were 🔊 and 🐢 — emoji, which render in whatever face the phone
 * carries and in none of the app's own hand (owner, 2026-09-05: "change the
 * turtle symbol to make it fit with our brand and our style", and the
 * speaker "can go because it all plays automatically"). A word plays when it
 * is tapped and a sentence when its ⓘ opens, so the speaker announced
 * nothing; what a second tap does is say it AGAIN, which is an arrow that
 * comes back round. Slow is a snail, which reads as slow at 20px where a
 * turtle reads as a rock.
 *
 * Same graphite stroke as Casey, the train and the coastline, with
 * `vector-effect` so the line stays a line at any size. `currentColor`, so a
 * button's own colour carries into its glyph.
 */
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const

/** Say it again: an arrow that comes back round on itself. */
export function ReplayIcon({ className = 'audio-icon' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path {...STROKE} d="M19 12a7 7 0 1 1-2.2-5.1" />
      <path {...STROKE} d="M17.6 3.2v4h-4" />
    </svg>
  )
}

/** Slowly: a snail, shell and all. */
export function SlowIcon({ className = 'audio-icon' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {/* the shell, a spiral */}
      <path {...STROKE} d="M14.5 15.5a4.5 4.5 0 1 0-1.5-8.7 3 3 0 0 0 .3 5.9 1.6 1.6 0 0 0 .9-3" />
      {/* the body and the head, feelers up */}
      <path {...STROKE} d="M4 17.5c1.2-2.4 2.8-3.6 4.8-3.7h9.7" />
      <path {...STROKE} d="M4 17.5h15.5" />
      <path {...STROKE} d="M5.2 14.2 4 11.3M6.6 14 7 11" />
    </svg>
  )
}
