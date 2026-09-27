import { DEFAULT_BASE_URL } from './ai/client'
import type { WordEntry } from './data/types'
import { BOARD } from './engine/config'
import { mulberry32 } from './engine/rng'
import { curriculumBand, isCollected } from './journey/progress'
import { selectBoardWords } from './srs/sampler'
import { practiceNeed } from './srs/scheduler'
import type { SrsMap } from './srs/types'

export const CERTIFICATION_CANDIDATES = 48
export const CERTIFICATION_HISTORY = 4
const CERTIFICATION_TIMEOUT_MS = 30_000
const AUTHORED_CITY_INDICES = new Set([0, 1, 8])

export interface CertificationCandidate {
  wordIds: string[]
  needWeights: number[]
}

export interface CertificationRequest {
  protocol: 1
  candidates: CertificationCandidate[]
  recentBoards: string[][]
}

export interface PreparedCandidate extends CertificationCandidate {
  entries: WordEntry[]
  gameSeed: number
  need: Record<string, number>
}

export interface PreparedBatch {
  cityIndex: number
  context: string
  request: CertificationRequest
  candidates: PreparedCandidate[]
}

export interface CertifiedBoard {
  entries: WordEntry[]
  gameSeed: number
  need: Record<string, number>
}

type Fetcher = typeof fetch

const nextSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0

/** Mirrored in proxy/casey/deal.js; neither this seed nor either key is sent. */
export function certificationSeed(wordIds: readonly string[], needWeights: readonly number[]): number {
  let hash = 2166136261
  const add = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  for (let i = 0; i < wordIds.length; i++) add(`${wordIds[i]}\0${needWeights[i]}\x01`)
  return hash >>> 0
}

const contextFor = (cityIndex: number, recentBoards: readonly (readonly string[])[]) =>
  JSON.stringify([cityIndex, recentBoards.slice(0, CERTIFICATION_HISTORY)])

export function canCertifyCity(cityIndex: number): boolean {
  return AUTHORED_CITY_INDICES.has(cityIndex)
}

/** Build 48 ordinary SRS/carry-over-compatible choices without any egress. */
export function prepareCertificationBatch(args: {
  cityIndex: number
  pool: readonly WordEntry[]
  stats: SrsMap
  wrapped: ReadonlySet<string>
  recentBoards: readonly (readonly string[])[]
  now: number
  seed: number
}): PreparedBatch | null {
  if (!canCertifyCity(args.cityIndex) || args.pool.length < BOARD.totalWords) return null
  // The Worker's evaluator shards were authored against the curriculumRank
  // bands (E6) and certify a candidate only when every word is in one shard.
  // Since City 1 became the authored roster (2026-09-11) the journey's cities
  // no longer coincide with those bands, so a pool with a word outside its
  // shard's hundred would only buy a rejected request: no batch, and the deal
  // keeps its local path, which is what a refused request ends in anyway.
  // Re-banding the shards to the journey is the pipeline's, recorded in
  // docs/DECISIONS.md under the roster decision.
  if (curriculumBand(args.pool, args.cityIndex).length !== args.pool.length) return null
  const recentBoards = args.recentBoards
    .slice(0, CERTIFICATION_HISTORY)
    .map((ids) => [...ids])
  const candidates: PreparedCandidate[] = []
  let seed = args.seed >>> 0
  for (let i = 0; i < CERTIFICATION_CANDIDATES; i++) {
    seed = nextSeed(seed)
    const entries = selectBoardWords(
      args.pool,
      args.stats,
      {
        totalWords: BOARD.totalWords,
        maxNewWordsPerBoard: BOARD.maxNewWordsPerBoard,
        collected: args.wrapped,
        recentBoards: recentBoards.map((ids) => new Set(ids)),
      },
      mulberry32(seed),
      args.now,
    )
    if (entries.length !== BOARD.totalWords) return null
    const wordIds = entries.map((word) => word.id)
    const needWeights = entries.map((word) =>
      practiceNeed(
        args.stats[word.id],
        isCollected(args.stats[word.id], args.wrapped.has(word.id)),
        args.now,
      ),
    )
    candidates.push({
      entries,
      wordIds,
      needWeights,
      gameSeed: certificationSeed(wordIds, needWeights),
      need: Object.fromEntries(wordIds.map((id, index) => [id, needWeights[index]!])),
    })
  }
  return {
    cityIndex: args.cityIndex,
    context: contextFor(args.cityIndex, recentBoards),
    request: {
      protocol: 1,
      recentBoards,
      candidates: candidates.map(({ wordIds, needWeights }) => ({ wordIds, needWeights })),
    },
    candidates,
  }
}

function certificationEndpoint(): URL {
  const endpoint = new URL(DEFAULT_BASE_URL)
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/casey/deal`
  return endpoint
}

/** No install id, credentials, cookies, telemetry, or player-authored text. */
export async function requestCertification(
  request: CertificationRequest,
  fetcher: Fetcher = fetch,
): Promise<number[]> {
  const response = await fetcher(certificationEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    credentials: 'omit',
    signal: AbortSignal.timeout(CERTIFICATION_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`board certification unavailable (${response.status})`)
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid certification')
  const object = value as Record<string, unknown>
  if (
    Object.keys(object).length !== 2 ||
    object.protocol !== 1 ||
    !Array.isArray(object.certifiedCandidateIndices) ||
    object.certifiedCandidateIndices.length < 1 ||
    object.certifiedCandidateIndices.length > 8 ||
    object.certifiedCandidateIndices.some(
      (index) => !Number.isInteger(index) || (index as number) < 0 || (index as number) >= CERTIFICATION_CANDIDATES,
    ) ||
    new Set(object.certifiedCandidateIndices).size !== object.certifiedCandidateIndices.length
  ) {
    throw new Error('invalid certification')
  }
  return object.certifiedCandidateIndices as number[]
}

let generation = 0
let ready: { batch: PreparedBatch; indices: number[] } | null = null

/** Start only after a round; failures remain silent and leave no durable state. */
export async function prefetchCertification(
  batch: PreparedBatch | null,
  fetcher?: Fetcher,
): Promise<void> {
  const mine = ++generation
  ready = null
  if (!batch) return
  try {
    const indices = await requestCertification(batch.request, fetcher)
    if (mine === generation) ready = { batch, indices }
  } catch {
    // Safe local fallback is the product behavior. This path logs and stores nothing.
  }
}

/** Consume only a response certified for the unchanged city/recent-board context. */
export function takeCertifiedBoard(
  cityIndex: number,
  recentBoards: readonly (readonly string[])[],
  random: () => number = Math.random,
): CertifiedBoard | null {
  const available = ready
  ready = null
  if (!available || available.batch.context !== contextFor(cityIndex, recentBoards)) return null
  const candidateIndex = available.indices[Math.floor(random() * available.indices.length)]
  const candidate = candidateIndex === undefined ? undefined : available.batch.candidates[candidateIndex]
  return candidate
    ? { entries: candidate.entries, gameSeed: candidate.gameSeed, need: candidate.need }
    : null
}

export function clearCertificationPrefetch(): void {
  generation++
  ready = null
}
