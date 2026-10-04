import { ACTIVE } from '../lang/active'
import type { LanguageCode } from '../lang/types'
import type { CityIdentity } from '../progression/types'
import type { RunResult } from '../run/results'
import { useJourney } from '../stores/journeyStore'
import { cityAt } from './cities'
import type { TrainRunFact } from './progress'

/**
 * THE TICKET (card CW-07; contract section 4 and owner O3): a train run that
 * answers every word of the city catches the train, and the app keeps a ticket
 * for it. "Catching the train gives a ticket and a 'Ribe opens soon' screen.
 * The ticket is honoured when Ribe is released. Nothing opens an unreleased
 * city."
 *
 * The ticket is the city's `TrainRunFact` (journey/progress.ts), kept in the
 * journey store under `trainRuns`, keyed by `cityKey`. It is read by the travel
 * gate (`journeyTravelGate`, journey/trainService.ts) as the city's readiness;
 * whether the next city is released and whether the player may board stay
 * separate gates, so a ticket alone opens nothing.
 */

/** The city a run's result belongs to, on the course being played. */
export function runCity(cityIndex: number, course: LanguageCode = ACTIVE.code): CityIdentity {
  return { courseId: course, cityId: cityAt(cityIndex).id }
}

/**
 * The ticket a caught train run earns, or null for any other result (a walk,
 * a missed train, a run left): only `caught` is a ticket.
 */
export function ticketFromResult(result: RunResult, city: CityIdentity): TrainRunFact | null {
  if (result.walk !== 'train' || result.end !== 'caught') return null
  return {
    city,
    passed: true,
    at: result.endedAt,
    words: result.answered,
    photos: result.photos,
    slips: result.misses.length,
    allowed: result.forgiven,
  }
}

/**
 * Store the ticket of a caught train run in the journey store. Called by the
 * run's results sink (src/run/sinkSetup.ts) when a train run ends `caught`.
 * The first ticket for a city is kept: catching the train again changes
 * nothing.
 */
export function recordCaughtTrainNow(result: RunResult): void {
  const ticket = ticketFromResult(result, runCity(result.cityIndex))
  if (ticket) useJourney.getState().recordTrainRun(ticket)
}
