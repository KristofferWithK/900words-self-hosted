import { emptyProgressFacts } from './facts'
import { boardKey } from './identity'
import type { ProgressFacts } from './types'

/**
 * Fixture facts for local browser drives. The journey UI reads the durable
 * settlement ledger, so a URL that packs a city must seed that ledger too.
 * This is only called behind the dev-switch guard; it is not a player reward
 * path and never runs in a normal or installed build.
 */
export function devTravelFacts(cityId: string, cityIndex: number, amount: number): ProgressFacts {
  const count = Math.max(0, Math.min(100, Math.trunc(amount)))
  return {
    ...emptyProgressFacts(),
    boards: Object.fromEntries(Array.from({ length: count }, (_, i) => {
      const board = {
        courseId: 'da' as const,
        cityId,
        authoredBoardId: `dev-travel-${cityIndex}-${i}`,
        contentRevision: 'dev-url-v1',
      }
      return [boardKey(board), { board, best: 'gold' as const, claims: ['solved'] as const }]
    })),
  }
}
