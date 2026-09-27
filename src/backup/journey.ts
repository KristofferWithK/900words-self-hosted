import type { LanguageCode } from '../lang/types'

export interface JourneyBackup {
  cityIndex: number
  wrapped: Record<string, number>
  arrivedAt: Record<number, number>
  /** See JourneySchema. Absent from files and snapshots written before it. */
  furthest?: number
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
    historicalTravelEligibility?: Record<string, true>
    parked?: JourneyBackup['parked']
    historicalRoutes?: JourneyBackup['historicalRoutes']
  }
  const cityIndex = Math.max(current.cityIndex, j.cityIndex)
  return {
    cityIndex,
    wrapped: earliestByKey(current.wrapped, j.wrapped),
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
