import { UI } from '../i18n'
import {
  audienceAllowsLearnerPreview,
  audienceEnablesDeveloperTools,
  audienceEnablesFeedbackTravel,
  feedbackTravelAllowed,
  type BuildAudience,
} from '../build/audience'
import { canBoardForJourney } from '../purchase/accessPolicy'
import type { PassStatus } from '../purchase/pass'
import type { CityIdentity, ProgressFacts } from '../progression/types'
import { devSwitchesAllowed } from '../stores/uiStore'
import { CITIES } from './cities'
import { cityTravelReadiness } from './progress'

/**
 * Which part of the route the train serves at launch.
 *
 * The launch is City 1 (owner, 2026-09-07): Sønderborg fully playable, and
 * the train onward closed for maintenance until a later build opens it. This
 * is the ONE number that says how far the line runs — the index of the last
 * city a train will deliver a player to. 0 is Sønderborg, so no train leaves;
 * raising it to 1 opens the line to Ribe, and so on down the route. It is a
 * launch scope, deliberately separate from the dormant StoreKit pass in
 * `src/purchase/pass.ts`: that gate is a purchase, this one is a closed line,
 * and a player who has packed the whole suitcase is told the truth — the
 * train is not running yet — rather than sold something.
 *
 * Everything else stays as it is: the suitcase fills, the wrap-up rounds
 * pack it, the Guide's chapters for every city are readable, and the
 * authored City 1 bank keeps dealing. Only the departure is held.
 */
export const OPEN_ROUTE_END = 0

/**
 * Does the train leave `cityIndex` for the next stop?
 *
 * `bypass` is for the audiences that are meant to see the whole route: the
 * feedback build (F1), the owner's playtest jumper, and a local preview with
 * the dev switches on (every journey drive boards trains). A preview can ask
 * for the closed line with `?train=closed`, which is how a drive looks at the
 * notice.
 */
export function trainRunsFrom(
  cityIndex: number,
  options: { openTo?: number; bypass?: boolean } = {},
): boolean {
  if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= CITIES.length - 1) return false
  const openTo = options.openTo ?? OPEN_ROUTE_END
  if (options.bypass) return true
  return cityIndex + 1 <= openTo
}

export interface JourneyTravelGateInput {
  readonly facts: ProgressFacts
  /** The city whose postcards/readiness are being checked, not the board being viewed. */
  readonly city: CityIdentity
  readonly cityIndex: number
  readonly threshold?: number
  readonly historicalEligibility: boolean
  readonly passStatus: PassStatus
  readonly audience: BuildAudience
  /** An explicit developer control; restored route data never sets this. */
  readonly developerTravel?: boolean
  /** Test/future release seam. Ordinary calls use OPEN_ROUTE_END. */
  readonly openTo?: number
}

/**
 * Complete travel projection with three independent gates:
 *
 * 1. city-specific earned/historical readiness;
 * 2. current course/destination availability;
 * 3. the existing pass/audience access policy.
 *
 * A pass, old developer position or historical eligibility cannot open an
 * unreleased route. This selector is pure and cannot spend postcards.
 */
export function journeyTravelGate(input: JourneyTravelGateInput) {
  const feedbackTravel = audienceEnablesFeedbackTravel(input.audience)
  const developerTravel = audienceEnablesDeveloperTools(input.audience) && input.developerTravel === true
  const courseAvailable = input.city.courseId === 'da' || audienceAllowsLearnerPreview(input.audience)
  const identityMatchesPosition = CITIES[input.cityIndex]?.id === input.city.cityId
  const destinationAvailable = courseAvailable && identityMatchesPosition && trainRunsFrom(input.cityIndex, {
    openTo: input.openTo,
    bypass: feedbackTravel || developerTravel,
  })
  const accessAllowed = canBoardForJourney(input.cityIndex, input.passStatus, feedbackTravel)
  return {
    ...cityTravelReadiness(input.facts, input.city, {
      threshold: input.threshold,
      historicalEligibility: input.historicalEligibility,
      destinationAvailable,
      accessAllowed,
    }),
    identityMatchesPosition,
    destinationAvailable,
    accessAllowed,
  }
}

/**
 * Written by App.tsx's dev-switch effect for `?train=open`, on a load where
 * the switches are honoured, so a drive that then makes its page native
 * (journey-drive's StoreKit stub) can still ride. Session storage only: a
 * phone never writes it and it dies with the tab.
 */
export const DEV_TRAIN_OPEN_KEY = 'cluecab-dev-train-open'

/** The bypass the screens hand to `trainRunsFrom`; see there. */
export function trainServiceBypass(playtestTravel: boolean): boolean {
  if (feedbackTravelAllowed() || playtestTravel) return true
  try {
    if (sessionStorage.getItem(DEV_TRAIN_OPEN_KEY) === '1') return true
  } catch {
    // No session storage: no switch.
  }
  if (!devSwitchesAllowed()) return false
  try {
    return new URLSearchParams(window.location.search).get('train') !== 'closed'
  } catch {
    return true
  }
}

/**
 * The city the player is held at while the line is closed.
 *
 * Hard-coded, as the notice always was: there is one closed line and it is the
 * one out of City 1. It is a NAMED constant rather than a literal inside the
 * sentence so that the pipeline lane's City 1 generalisation has one place to
 * change instead of three, and so the sentence itself is a frame a translator
 * can write naturally in any word order.
 */
const HELD_AT = 'Sønderborg'

/** The name the train wears on Home and the map while the line is closed. */
export function closedLineLabel(nextCity: string): string {
  return UI.home.trainClosedLabel(nextCity)
}

/** What the player reads when they try to board a closed line. */
export function maintenanceNotice(nextCity: string): { title: string; body: string } {
  return {
    title: UI.home.trainClosedTitle,
    body: UI.home.trainClosedBody(nextCity, HELD_AT),
  }
}

/** What the player reads on the day the line reopens. */
export function reopenedNotice(nextCity: string): { title: string; body: string } {
  return {
    title: UI.home.trainReopenedTitle(nextCity),
    body: UI.home.trainReopenedBody,
  }
}
