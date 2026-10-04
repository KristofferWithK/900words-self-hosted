import { useEffect, useRef, useState } from 'react'
import { UI } from '../../i18n'
import { wordById } from '../../data/words'
import { ACTIVE } from '../../lang/active'
import { useAssociations } from '../../stores/associationStore'
import { readClueTally } from '../../stores/clueTally'
import { useJourney } from '../../stores/journeyStore'
import { useSrs } from '../../stores/srsStore'
import { useUi } from '../../stores/uiStore'
import { personalLines } from '../casey-personal'
import {
  clueyLines,
  homeLineIndex,
  introLineIndex,
  silentDay,
  weightedLineIndex,
  type HomeLineKind,
} from '../cluey-tips'

/**
 * The mascot is called **Casey** everywhere a player can read her, and `Cluey`
 * everywhere only a developer can: this file, `ClueyFace`, `ClueyMood`,
 * `markClueyVerified`, `cluey-tips.ts` and every `cluey-*` class. That split is deliberate and it is the `klausVerifiedAt` precedent —
 * she has now been renamed twice, and renaming the identifiers each time buys a
 * migration, a stale-selector hunt and a drive rewrite for a label nobody sees.
 * The name in the copy is the only one that has to be right.
 */

/**
 * What Casey's face is doing. Every one of these is already a local variable at
 * the site that renders her — the AI panel knows it is waiting, the guess line
 * knows how the guess landed, the round summary knows the outcome — so a mood costs a
 * prop rather than any new state.
 */
export type ClueyMood = 'idle' | 'thinking' | 'happy' | 'oops'

/**
 * Casey herself: a suitcase with eyes.
 *
 * Hand-rolled inline SVG like the Denmark map: CSS-styleable strokes, no asset
 * pipeline. The eyes are the whole point — a face that blinks and looks around
 * reads as alive, and one that holds still reads as a picture of a suitcase.
 *
 * Each eye sits in its own <g> so it can be scaled to nothing for a blink
 * without moving the pupil inside it; that needs transform-box: fill-box, since
 * an SVG child's default transform origin is the viewBox corner rather than the
 * shape. The mood parts (arc eyes, brow, round mouth) are always in the markup
 * and switched by CSS, which keeps this a stylesheet decision and avoids
 * remounting the SVG mid-animation.
 */
export function ClueyFace({
  mood = 'idle',
  className = '',
  collected,
}: {
  mood?: ClueyMood
  className?: string
  /**
   * Words collected so far (clued green and guessed green), written in Casey's
   * green patch — the suitcase's own count, shown on the suitcase. Home's to
   * give; left out, the patch is a plain travel sticker. It used to default
   * to 0, which wrote a "0" on every small Casey — the finish screen's, the
   * AI panel's — that nobody had counted anything for (owner, 2026-09-11:
   * "Casey on the finish screen looks wrong").
   *
   * It was the daily streak until 2026-09-30. The owner swapped it: players
   * come back because the game is fun and the case is filling up, not for
   * fear of losing a streak (docs/DECISIONS.md, Q01).
   */
  collected?: number
}) {
  return (
    <svg
      className={`cluey-svg mood-${mood} ${className}`}
      viewBox="0 0 120 96"
      role="img"
      aria-hidden="true"
    >
      <g className="cluey-figure">
        {/* handle */}
        <path className="cluey-line" d="M45 18 v-6 a6 6 0 0 1 6-6 h18 a6 6 0 0 1 6 6 v6" fill="none" />
        {/* body */}
        <rect className="cluey-body" x="8" y="18" width="104" height="70" rx="12" />
        {/* pencil shading, in the corners a right-hander would have rested on */}
        <g className="cluey-hatch" aria-hidden="true">
          <line x1="14" y1="80" x2="22" y2="72" />
          <line x1="19" y1="82" x2="28" y2="73" />
          <line x1="25" y1="83" x2="34" y2="74" />
          <line x1="96" y1="26" x2="103" y2="19" />
        </g>
        {/* the lid seam and latches */}
        <line className="cluey-line" x1="8" y1="40" x2="112" y2="40" />
        <rect className="cluey-latch" x="26" y="36" width="8" height="8" rx="2" />
        <rect className="cluey-latch" x="86" y="36" width="8" height="8" rx="2" />
        {/* eyes on the lid, each in its own group so a blink scales the eye
            without dragging the pupil out of it */}
        <g className="cluey-eye-g">
          <circle className="cluey-eye" cx="46" cy="29" r="6" />
          <circle className="cluey-pupil" cx="47.5" cy="30" r="2.6" />
        </g>
        <g className="cluey-eye-g">
          <circle className="cluey-eye" cx="74" cy="29" r="6" />
          <circle className="cluey-pupil" cx="75.5" cy="30" r="2.6" />
        </g>
        {/* happy: the eyes become arcs */}
        <path className="cluey-arc" d="M40 31 q6 -7 12 0" fill="none" />
        <path className="cluey-arc" d="M68 31 q6 -7 12 0" fill="none" />
        {/* thinking: one raised brow */}
        <path className="cluey-brow" d="M40 19 q5 -3 10 -1" fill="none" />
        {/* a small smile under the seam, and the mouth it becomes when caught out */}
        <path className="cluey-line cluey-smile" d="M52 56 q8 8 16 0" fill="none" />
        <circle className="cluey-mouth-o" cx="60" cy="57" r="3.4" fill="none" />
        {/* travel sticker */}
        <circle className="cluey-sticker" cx="94" cy="70" r="9" />
        {collected !== undefined && (
          <text
            className={`cluey-collected-number${collected >= 100 ? ' cluey-collected-long' : ''}`}
            x="94"
            y={collected >= 100 ? 72.8 : 73.3}
            textAnchor="middle"
          >
            {collected}
          </text>
        )}
      </g>
    </svg>
  )
}

/** What the bubble says when the player's own key has never produced a reply. */
const CONNECT_LINE = UI.casey.notAnsweredBubble

/**
 * Casey on Home: the bubble above her speaks — a tip or fun fact, fresh every
 * time the player comes Home, leafing on a tap — and tapping Casey opens the
 * case. On a silent day (about one in three, and never during the intro
 * window or the setup nudge) the bubble is absent and only the figure shows.
 *
/**
 * Casey on Home: the bubble above her speaks — a tip or fun fact, fresh every
 * time the player comes Home, leafing on a tap — and tapping Casey opens the
 * case. On a silent day (about one in three, and never during the intro
 * window or the setup nudge) the bubble is absent and only the figure shows.
 *
 * Her eyes follow the pointer while one is over her. On a phone that fires
 * rarely, which is why the idle wander does the work by default and the follow
 * is a bonus rather than the mechanism.
 *
 * `needsConnection` is Home's one remaining setup prompt, and it speaks
 * *through* Casey rather than as a banner above the map — she is the thing that
 * is not answering, so she is the one who should say so. It keeps the
 * `setup-nudge` class it had as a banner: the class names the affordance
 * ("tap this and land in Settings"), not the position, and three drives walk
 * that path.
 */
export function Cluey({
  needsConnection = false,
  collected = 0,
  momentumLine,
  onOpenSuitcase,
}: {
  needsConnection?: boolean
  /** Words collected so far, for the sticker (see `ClueyFace`). */
  collected?: number
  /** Home's evidence-based daily encouragement, before ordinary rotating tips. */
  momentumLine?: string
  /**
   * The first session's Home (CW-13): tapping Casey goes where onboarding
   * goes next, and the bubble stays quiet, since the spotlight speaks for
   * her there and the first sessions' tips are not spent on it.
   */
  onOpenSuitcase?: () => void
} = {}) {
  const goTo = useUi((s) => s.goTo)
  const cityIndex = useJourney((s) => s.cityIndex)
  // The pool is read once per Home visit, so the index into it stays
  // meaningful while the player leafs. Keep the critical intro tips at their
  // established offsets (the word of the day is index 0): the momentum line
  // and the lines about the player's own play (casey-personal.ts) are
  // appended, so the intro cursor cannot land on them or displace the
  // required sequence.
  const [pool] = useState(() => {
    const lines = clueyLines(cityIndex)
    const srs = useSrs.getState()
    const personal = personalLines({
      stats: srs.stats,
      games: srs.games,
      groups: useAssociations.getState().groups,
      clues: readClueTally(ACTIVE.code),
      wordById,
    })
    const extra: [string, HomeLineKind][] = [
      ...(momentumLine ? [[momentumLine, 'momentum'] as [string, HomeLineKind]] : []),
      ...personal.map((p): [string, HomeLineKind] => [p, 'personal']),
    ]
    return {
      lines: [...lines, ...extra.map(([text]) => text)],
      kinds: [...lines.map((): HomeLineKind => 'ordinary'), ...extra.map(([, kind]) => kind)],
    }
  })
  const homeLines = pool.lines
  // The first sessions open on the critical tips in priority order; after that
  // window, every Home visit opens on a fresh line (owner, 2026-09-15), picked
  // by share rather than uniformly (owner, 2026-09-26): the momentum line and
  // the personal lines are weighted above the sixty-odd fun facts
  // (HOME_LINE_SHARE). `homeLineIndex` remembers the last opener to avoid an
  // immediate repeat when at least two lines are available.
  const quiet = onOpenSuitcase !== undefined
  const [index, setIndex] = useState(() =>
    quiet ? 0 : homeLineIndex(homeLines.length, undefined, undefined, undefined, pool.kinds),
  )
  const [mood, setMood] = useState<ClueyMood>('idle')
  const svgRef = useRef<HTMLDivElement>(null)
  // Silent days are moot while the bubble has a job: the setup nudge speaks
  // through it, and the intro window's critical tips must be seen.
  const silent = !needsConnection && !momentumLine && silentDay() && introLineIndex(homeLines.length) === null
  const line = needsConnection ? CONNECT_LINE : homeLines[index % homeLines.length]!
  // A tap leafs onward. Inside the intro window that is the next line, so the
  // critical tips are walked in priority order; after it, another weighted
  // pick that is never the line just read.
  const leaf = (i: number) =>
    introLineIndex(homeLines.length) !== null
      ? i + 1
      : weightedLineIndex(pool.kinds, Math.random, i % homeLines.length)

  // A tap is a small celebration; it ends on its own so Home settles back to
  // idle rather than grinning permanently.
  useEffect(() => {
    if (mood === 'idle') return
    const t = setTimeout(() => setMood('idle'), 900)
    return () => clearTimeout(t)
  }, [mood])

  useEffect(() => {
    const host = svgRef.current
    if (!host) return
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    let idle: ReturnType<typeof setTimeout>
    const follow = (e: PointerEvent) => {
      const pupils = host.querySelectorAll<SVGCircleElement>('.cluey-pupil')
      const box = host.getBoundingClientRect()
      if (!box.width) return
      // The SVG is 120 units wide however many pixels it is drawn at, so a
      // pointer offset has to be converted before it means anything here.
      const scale = 120 / box.width
      host.classList.add('cluey-looking')
      pupils.forEach((p) => {
        const eye = p.getBoundingClientRect()
        const dx = (e.clientX - (eye.left + eye.width / 2)) * scale
        const dy = (e.clientY - (eye.top + eye.height / 2)) * scale
        const reach = Math.min(1, 2.3 / (Math.hypot(dx, dy) || 1))
        p.style.transform = `translate(${(dx * reach).toFixed(1)}px, ${(dy * reach).toFixed(1)}px)`
      })
      clearTimeout(idle)
      idle = setTimeout(() => {
        host.classList.remove('cluey-looking')
        pupils.forEach((p) => (p.style.transform = ''))
      }, 1600)
    }
    window.addEventListener('pointermove', follow)
    return () => {
      window.removeEventListener('pointermove', follow)
      clearTimeout(idle)
    }
  }, [])

  return (
    <div className="cluey-band">
      {silent || quiet ? null : (
        <button
          className={`cluey-bubble${needsConnection ? ' setup-nudge' : ''}`}
          aria-label={needsConnection ? UI.casey.notAnsweredAria : UI.casey.bubbleAria(line)}
          onClick={() => (needsConnection ? goTo('settings') : setIndex(leaf))}
        >
          {line}
        </button>
      )}
      <button
        className="cluey-button"
        aria-label={UI.casey.suitcaseAria}
        onClick={() => (onOpenSuitcase ? onOpenSuitcase() : goTo('suitcase'))}
        onPointerDown={() => setMood('happy')}
      >
        <div ref={svgRef} className="cluey-live">
          <ClueyFace mood={mood} collected={collected} />
        </div>
      </button>
    </div>
  )
}
