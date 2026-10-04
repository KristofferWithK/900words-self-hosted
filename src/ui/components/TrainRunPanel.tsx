import { useMemo } from 'react'
import { WORDS } from '../../data/words'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../../i18n'
import { CITIES, cityAt } from '../../journey/cities'
import { cityWords } from '../../journey/cityWords'
import { trainTicketFor, type TrainRunFact } from '../../journey/progress'
import { trainSlips } from '../../journey/trainSlips'
import { runCity } from '../../journey/trainTicket'
import { countMarks } from '../../journey/wordMarks'
import { askableWords } from '../../run/distractors'
import { runWordsForCity } from '../../run/sources'
import { chooseWalk } from '../../run/walks'
import { useJourney } from '../../stores/journeyStore'
import { useSrs } from '../../stores/srsStore'
import { useUi } from '../../stores/uiStore'
import { beginRunOrOffer } from '../runGate'
import { Tag } from './Tag'

/**
 * CATCH THE TRAIN on Home (card CW-07; contract section 4 and owner O3): the
 * train run's part of the train sheet (`TrainSheet` in HomeSheets.tsx renders
 * `TrainRunPanel` under its "Collected" line), the ticket drawing it shares
 * with the Sightseeing screen's "You caught the train" panel, and the counts
 * Home's train strip reads (`useCityTrain`).
 */

/** A city's train numbers, live: words collected by the three marks, of how many, and the slips they give. */
export function useCityTrain(cityIndex: number): { readonly collected: number; readonly total: number; readonly slips: number } {
  const photos = useJourney((s) => s.photos)
  const stats = useSrs((s) => s.stats)
  const words = useMemo(() => cityWords(WORDS, cityIndex), [cityIndex])
  const marks = useMemo(() => countMarks(words, stats, photos ?? {}), [words, stats, photos])
  return { collected: marks.collected, total: marks.total, slips: trainSlips(marks.collected) }
}

/**
 * The words a train run of this city asks: every city word the run can show
 * in the player's language (147 in Sønderborg for English and German tags).
 */
export function trainRunLength(cityIndex: number): number {
  return askableWords(runWordsForCity(cityIndex)).length
}

/**
 * Start the train run: the daily limit first (a run counts at its first
 * answer, O6), then the Sightseeing screen opens on the train run. `leaving`
 * runs before either, so a sheet can close itself.
 */
export function startTrainRun(leaving?: () => void): void {
  leaving?.()
  beginRunOrOffer(() => {
    chooseWalk('train')
    useUi.getState().goTo('sightseeing')
  })
}

/** A ticket's date, in the player's own language. */
export function ticketDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString(UI_LANGUAGE_INFO[UI_LANGUAGE].tag, { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return new Date(at).toLocaleDateString()
  }
}

/**
 * The ticket: beige, a notch in each side and a perforated line under its
 * heading (the prototype's train-ticket look), the route printed across it.
 * The arrow is drawn, not written, so the two city names are the only words.
 */
export function TrainTicket({ from, to, ticket, className = '' }: {
  readonly from: string
  readonly to: string
  readonly ticket: Pick<TrainRunFact, 'at' | 'words'>
  readonly className?: string
}) {
  const t = UI.sightseeing
  return (
    <div className={`train-ticket ${className}`.trimEnd()}>
      <p className="train-ticket-label">{t.ticketLabel}</p>
      <p className="train-ticket-route">
        <span>{from}</span>
        <svg className="train-ticket-arrow" viewBox="0 0 28 12" aria-hidden="true" focusable="false">
          <path d="M1 6 H25 M19 1.5 L26 6 L19 10.5" />
        </svg>
        <span className="visually-hidden">{', '}</span>
        <span>{to}</span>
      </p>
      <p className="train-ticket-line">{t.trainProgress(ticket.words, ticket.words)}</p>
      <p className="train-ticket-line">{t.ticketDate(ticketDate(ticket.at))}</p>
    </div>
  )
}

/**
 * The train run's part of the train sheet: the ticket when one is held, the
 * run's rule in one line, and the "Catch the train" tag that starts the run
 * (asking the daily limit first). The slips this collection gives are read
 * off the train drawn above it (`TrainSheet`, CW-07b) and repeated on the tag.
 * `onLeave` closes the sheet before the run opens.
 */
export function TrainRunPanel({ onLeave }: { readonly onLeave?: () => void }) {
  const t = UI.sightseeing
  const cityIndex = useJourney((s) => s.cityIndex)
  const trainRuns = useJourney((s) => s.trainRuns)
  const { slips } = useCityTrain(cityIndex)
  const words = useMemo(() => trainRunLength(cityIndex), [cityIndex])
  const here = cityAt(cityIndex).name
  const next = cityIndex + 1 < CITIES.length ? cityAt(cityIndex + 1).name : null
  const ticket = trainTicketFor(trainRuns ?? {}, runCity(cityIndex))
  return (
    <>
      {ticket && next && (
        <section className="train-sheet-panel train-run-ticket" aria-label={t.sheetTicketTitle}>
          <p className="train-sheet-collected">{t.sheetTicketTitle}</p>
          <TrainTicket from={here} to={next} ticket={ticket} />
          <p className="train-run-hint">{t.sheetTicketHint(next)}</p>
        </section>
      )}
      {words > 0 && (
        <Tag
          size="wide"
          tone="primary"
          className="train-run-catch"
          label={t.trainTitle}
          note={t.sheetCatchLine(words, slips)}
          onClick={() => startTrainRun(onLeave)}
        />
      )}
      <p className="train-sheet-rule train-run-rule">{t.trainRule}</p>
    </>
  )
}
