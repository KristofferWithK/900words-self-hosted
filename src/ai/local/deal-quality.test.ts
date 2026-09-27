import { describe, expect, it } from 'vitest'
import { BOARD } from '../../engine/config'
import { mulberry32 } from '../../engine/rng'
// `curriculumBand`, not `wordsForCity`: the shards, tags and boards this file
// measures were authored against the curriculumRank band a city used to be,
// before City 1 became the authored roster (2026-09-11). See progress.ts.
import { curriculumBand } from '../../journey/progress'
import { selectBoardWords } from '../../srs/sampler'
import type { SrsMap } from '../../srs/types'
import { WORDS } from '../../data/words'
import { practiceNeed } from '../../srs/scheduler'
// This test imports the Worker-only gate deliberately. It never enters the app
// graph; validate-client-boundary still proves the production bundle contains
// no evaluator shard or association data.
// @ts-expect-error the Worker is plain JS and intentionally outside tsconfig's app types
import { DEAL_CANDIDATES, evaluatorForDeal, selectViableDeal } from '../../../proxy/casey/deal.js'

const NOW = Date.UTC(2026, 7, 23, 12)

const envVar = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]

function seenStats(ids: readonly string[], city: number): SrsMap {
  return Object.fromEntries(
    ids.map((id, index) => [
      id,
      {
        box: (index % 5) as 0 | 1 | 2 | 3 | 4,
        lastSeenAt: NOW - ((index * 17 + city * 11) % 40) * 86_400_000,
        seen: 2 + (index % 7),
        correctGuesses: index % 4,
        misses: index % 3,
        lookups: index % 2,
        redemptionRight: 0,
        redemptionWrong: 0,
        greenByClue: index % 2,
        greenByGuess: (index + 1) % 2,
      },
    ]),
  )
}

function candidateBatch(city: number, baseSeed: number) {
  const pool = curriculumBand(WORDS, city - 1)
  const stats = seenStats(pool.map((word) => word.id), city)
  let recentBoards: string[][] = []
  const draw = (seed: number) =>
    selectBoardWords(
      pool,
      stats,
      {
        totalWords: BOARD.totalWords,
        maxNewWordsPerBoard: BOARD.maxNewWordsPerBoard,
        recentBoards: recentBoards.slice(0, 2).map((ids) => new Set(ids)),
      },
      mulberry32(seed ^ 0x9e3779b9),
      NOW,
    ).map((word) => word.id)

  // Four actually played boards seed both the carry-over rule (newest two)
  // and BQ1's semantic-pair memory (all four).
  for (let i = 0; i < 4; i++) {
    const ids = draw(baseSeed + i)
    recentBoards = [ids, ...recentBoards].slice(0, 4)
  }
  const candidates = Array.from({ length: DEAL_CANDIDATES as number }, (_, i) => {
    const seed = (baseSeed + 100 + i * 0x9e37) >>> 0
    const wordIds = draw(seed)
    return {
      wordIds,
      needWeights: wordIds.map((id) => practiceNeed(stats[id], false, NOW)),
    }
  })
  return {
    recentBoards,
    candidates,
  }
}

describe('BQ1 seeded authored-city benchmark', () => {
  const benchmark = envVar('BQ1_REPORT') === '1' ? it : it.skip
  benchmark('reports viable candidates, supported-pair diversity and generation time', () => {
    const rows = [1, 2, 9].map((city) => {
      const request = candidateBatch(city, 0xb010000 + city * 10_000)
      const started = performance.now()
      const result = selectViableDeal(request, evaluatorForDeal(request))
      const generationMs = performance.now() - started
      expect(result, `city ${city} produced no viable candidate`).not.toBeNull()
      expect(result.choices.length).toBeGreaterThan(0)
      expect(result.choices.length).toBeLessThanOrEqual(8)
      expect(result.maxRouteLength).toBeLessThanOrEqual(BOARD.turnTokens)
      return {
        city,
        viable: result.viableCount,
        varied: result.variedCount,
        retained: result.choices.length,
        pairDiversity: result.pairDiversity,
        maxRoute: result.maxRouteLength,
        generationMs: Number(generationMs.toFixed(1)),
      }
    })
    console.table(rows)
  }, 120_000)
})
