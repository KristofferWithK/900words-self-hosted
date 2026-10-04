import { useCallback, type ReactNode } from 'react'
import { UI } from '../../i18n'
import type { walksForCourse } from '../../run/walks'
import { useDialog } from '../useDialog'
import { Tag } from './Tag'
import { TrainProgress, slipTrain } from './TrainProgress'
import { TrainRunPanel } from './TrainRunPanel'

/** A walk, as src/run/walks.ts names them ('words' | 'articles'). */
export type HomeWalk = ReturnType<typeof walksForCourse>[number]

/**
 * Home's two bottom sheets (café world, card CW-10; the second and third
 * panels of docs/design/cafe-world/app-home-current.jpg): the Sightseeing
 * chooser and the train sheet. Both are the dictionary's sheet shell
 * (`.sheet-backdrop` / `.sheet`, styles/44) dressed as Home's, with the modal
 * behaviour of `useDialog`: focus moves in, Tab stays in, Escape and a tap
 * outside close it, and focus returns to the control that opened it.
 */
function HomeSheet({ id, title, sub, lead, className, onClose, children }: {
  readonly id: string
  readonly title: string
  readonly sub?: string
  /** A line above the title, for why the sheet opened ("Find a café in Sightseeing first."). */
  readonly lead?: string
  readonly className: string
  readonly onClose: () => void
  readonly children: ReactNode
}) {
  const close = useCallback(() => onClose(), [onClose])
  const ref = useDialog(true, close)
  return (
    <div className="sheet-backdrop home-sheet-backdrop" onClick={close}>
      <div
        ref={ref}
        className={`sheet home-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header className="home-sheet-head">
          {lead && <p className="home-sheet-lead">{lead}</p>}
          <h2 id={`${id}-title`} className="home-sheet-title">{title}</h2>
          {sub && <p className="home-sheet-sub">{sub}</p>}
        </header>
        {children}
        <button type="button" className="home-sheet-close" onClick={close}>
          {UI.game.close}
        </button>
      </div>
    </div>
  )
}

/**
 * "Words" or "Articles" (contract section 6). Home shows this when the course
 * has both walks (`walksForCourse`); a course with Words alone goes straight
 * to the walk, unless Home has a `lead` line to say first (no café found yet),
 * and then the sheet offers the one walk. `articleAsk` is the Articles walk's
 * own question for this course ("en or et?") and `lanes` how many articles it
 * has.
 */
export function SightseeingChooser({ walks, articleAsk, lanes, lead, onChoose, onClose }: {
  readonly walks: readonly HomeWalk[]
  readonly articleAsk: string
  readonly lanes: number
  readonly lead?: string
  readonly onChoose: (walk: HomeWalk) => void
  readonly onClose: () => void
}) {
  return (
    <HomeSheet id="sightseeing-chooser" title={UI.sightseeing.title} sub={walks.length > 1 ? UI.home.sightseeingAsk : undefined} lead={lead} className="sightseeing-chooser" onClose={onClose}>
      <div className="home-sheet-tags">
        <Tag size="wide" className="walk-words" label={UI.sightseeing.wordsWalk} note={UI.home.wordsWalkNote} onClick={() => onChoose('words')} />
        {walks.includes('articles') && (
          <Tag size="wide" className="walk-articles" label={UI.sightseeing.articlesWalk} note={UI.home.articlesWalkNote(articleAsk, lanes)} onClick={() => onChoose('articles')} />
        )}
      </div>
    </HomeSheet>
  )
}

/**
 * The train sheet, opened by the ticket at the left end of Home's train strip.
 * What the city's train asks of the player: every word of the city, and the
 * run as the only way on (contract section 4).
 *
 * First the train itself, drawn large (card CW-07b): the collected words and
 * the slips they give are one picture, so both counts are read off it. The
 * engine is the first slip and each full wagon of 20 words one more
 * (`slipTrain`); the line under the counts says how far the next slip is, or,
 * once every wagon is full, that the city's last few words add none.
 *
 * Under it comes the train run's own panel (card CW-07, `TrainRunPanel`): the
 * ticket when one is held, the run's rule and the "Catch the train" tag.
 * `children` replaces it where a caller has its own. Boarding itself stays
 * where it is, on the strip's train drawing, which turns into the board button
 * when the travel gate opens (a caught train and a released next city).
 */
export function TrainSheet({ title, cityWords, collected, total, onClose, children }: {
  readonly title: string
  /** "Sønderborg: 147 words (100 on the boards, 47 connecting)". */
  readonly cityWords: string
  readonly collected: number
  readonly total: number
  readonly onClose: () => void
  readonly children?: ReactNode
}) {
  const t = UI.sightseeing
  const train = slipTrain(collected, total)
  return (
    <HomeSheet id="train-sheet" title={title} sub={cityWords} className="train-sheet" onClose={onClose}>
      <section className="train-sheet-panel train-sheet-slips">
        {/* The counts are printed under it, so the drawing is not named too. */}
        <TrainProgress earned={collected} goal={total} className="train-sheet-train" />
        <div className="train-sheet-counts">
          <p className="train-sheet-collected">{UI.home.trainSheetCollected(collected, total)}</p>
          <p className="train-sheet-collected train-sheet-slip-count">{t.sheetSlips(train.slips)}</p>
        </div>
        <p className="train-run-hint train-sheet-next">
          {train.toNextSlip === null ? t.sheetSlipsAll(train.beyond) : t.sheetNextSlip(train.toNextSlip)}
        </p>
        <p className="train-run-hint">{t.sheetSlipsHint(train.per)}</p>
      </section>
      {children ?? <TrainRunPanel onLeave={onClose} />}
      <p className="train-sheet-rule">{UI.home.trainSheetRule}</p>
    </HomeSheet>
  )
}
