import type { PassStatus } from './pass'
import { canBoardWithPass } from './pass'

/**
 * F1 changes exactly the dormant money gate. Callers must still separately
 * prove that the current city's suitcase is packed before travelling.
 */
export function canBoardForJourney(
  cityIndex: number,
  passStatus: PassStatus,
  feedbackTravel: boolean,
): boolean {
  return feedbackTravel || canBoardWithPass(cityIndex, passStatus)
}
