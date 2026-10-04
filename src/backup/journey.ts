import type { LanguageCode } from '../lang/types'
import { mergePhotoLedgers, type PhotoLedger } from '../journey/wordMarks'
import { mergeCafeFinds, type CafeFindsByCity } from '../journey/cafes'
import { mergeTrainRuns, type TrainRunFacts } from '../journey/progress'

export interface JourneyBackup {
  cityIndex: number
  wrapped: Record<string, number>
  arrivedAt: Record<number, number>
  /** See JourneySchema. Absent from files and snapshots written before it. */
  furthest?: number
  /**
   * Photo marks (journey/wordMarks.ts), word id -> local day -> first photo.
   * Absent from every file and save written before the café world; absent
   * reads as none, which is the truth for a player who never ran a street.
   */
  photos?: PhotoLedger
  /**
   * Café finds (journey/cafes.ts), city key -> found cafés and the count
   * toward the next. Absent from every file and save written before the café
   * world, the same way as `photos`; absent reads as nothing found by a walk.
   */
  cafes?: CafeFindsByCity
  /**
   * Train tickets (journey/progress.ts `TrainRunFact`, card CW-07), city key
   * -> the caught train run. Absent from every file and save written before
   * the train run, the same way as `cafes`; absent reads as no ticket.
   */
  trainRuns?: TrainRunFacts
  historicalTravelEligibility?: Record<string, true>
  parked?: Partial<Record<LanguageCode, { cityIndex: number; arrivedAt: Record<number, number>; furthest?: number }>>
  historicalRoutes?: JourneyBackup['parked']
}

export const furthestOf = (j: { cityIndex: number; furthest?: number }): { furthest?: number } =>
  j.furthest !== undefined && j.furthest > j.cityIndex ? { furthest: j.furthest } : {}

export const numKeyed = (r: Record<number, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(r))

export const earliestByKey = (
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> => {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.min(out[k] ?? v, v)
  return out
}

/**
 * A journey as it goes into `parked` / `historicalRoutes` when a whole
 * journey is filed there (backup merge across languages, restore). Those
 * entries hold a route position; photo marks are word knowledge and café
 * finds are keyed by their own city identity, both kept once at the top of
 * the journey, and a second frozen copy inside the route history would only
 * grow the save. Everything else is filed exactly as before the café world,
 * so the stored shape is unchanged for older builds. (The name predates the
 * café finds and the train tickets; it drops all three. Tickets are keyed by
 * their own city identity too.)
 */
export function withoutPhotos<T extends { photos?: unknown; cafes?: unknown; trainRuns?: unknown }>(journey: T): Omit<T, 'photos' | 'cafes' | 'trainRuns'> {
  const route: T = { ...journey }
  delete route.photos
  delete route.cafes
  delete route.trainRuns
  return route
}

export function mergeRouteHistory(a: NonNullable<JourneyBackup['parked']>, b: NonNullable<JourneyBackup['parked']>): NonNullable<JourneyBackup['parked']> {
  return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((code) => {
    const left = a[code as LanguageCode], right = b[code as LanguageCode]
    return [code, !left ? right : !right ? left : {
      cityIndex: Math.max(left.cityIndex, right.cityIndex),
      furthest: Math.max(left.furthest ?? left.cityIndex, right.furthest ?? right.cityIndex),
      arrivedAt: earliestByKey(left.arrivedAt, right.arrivedAt),
    }]
  }))
}

/**
 * Fold two journeys together without losing ground, by the rules above. Shared
 * with the rescue of progress stranded by an old storage key, so there is one
 * definition of "merging cannot cost you anything".
 */
export function mergeJourney(
  current: JourneyBackup,
  incoming: { cityIndex: number } & Record<string, unknown>,
): JourneyBackup {
  const j = incoming as unknown as {
    cityIndex: number
    wrapped: Record<string, number>
    arrivedAt: Record<string, number>
    furthest?: number
    photos?: PhotoLedger
    cafes?: CafeFindsByCity
    trainRuns?: TrainRunFacts
    historicalTravelEligibility?: Record<string, true>
    parked?: JourneyBackup['parked']
    historicalRoutes?: JourneyBackup['historicalRoutes']
  }
  const cityIndex = Math.max(current.cityIndex, j.cityIndex)
  return {
    cityIndex,
    wrapped: earliestByKey(current.wrapped, j.wrapped),
    // Photo days union, earliest first photo kept: a mark, once earned, is
    // never lost to a merge (wordMarks.ts).
    photos: mergePhotoLedgers(current.photos ?? {}, j.photos ?? {}),
    // Finds union, earlier find kept; the count toward the next comes from
    // the side that has found more (journey/cafes.ts#mergeCafeFinds).
    cafes: mergeCafeFinds(current.cafes ?? {}, j.cafes ?? {}),
    // Tickets union; a caught train beats one not caught, the earlier ticket
    // is kept (journey/progress.ts#mergeTrainRuns). A merge never loses one.
    trainRuns: mergeTrainRuns(current.trainRuns ?? {}, j.trainRuns ?? {}),
    arrivedAt: earliestByKey(numKeyed(current.arrivedAt), j.arrivedAt) as unknown as Record<
      number,
      number
    >,
    // Furthest of everything either side knows, by the same rule as the
    // position: merging cannot cost ground.
    ...furthestOf({ cityIndex, furthest: Math.max(current.furthest ?? 0, j.furthest ?? 0) }),
    historicalTravelEligibility: { ...current.historicalTravelEligibility, ...j.historicalTravelEligibility },
    parked: Object.fromEntries([...new Set([...Object.keys(current.parked ?? {}), ...Object.keys(j.parked ?? {})])].map((code) => {
      const a = current.parked?.[code as LanguageCode], b = j.parked?.[code as LanguageCode]
      return [code, !a ? b : !b ? a : { cityIndex: Math.max(a.cityIndex, b.cityIndex),
        arrivedAt: earliestByKey(a.arrivedAt, b.arrivedAt), furthest: Math.max(a.furthest ?? a.cityIndex, b.furthest ?? b.cityIndex) }]
    })),
    historicalRoutes: mergeRouteHistory(current.historicalRoutes ?? {}, j.historicalRoutes ?? {}),
  }
}
