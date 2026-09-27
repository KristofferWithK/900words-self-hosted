import { describe, expect, it, vi } from 'vitest'
import { WORDS } from './data/words'
import { curriculumBand, wordsForCity } from './journey/progress'
import {
  CERTIFICATION_CANDIDATES,
  clearCertificationPrefetch,
  prepareCertificationBatch,
  prefetchCertification,
  requestCertification,
  takeCertifiedBoard,
  type CertificationRequest,
} from './boardCertification'
// @ts-expect-error Worker-only certification implementation stays outside the app graph.
import { certifyDeal, parseDealRequest } from '../proxy/casey/deal-contract.js'

const ids = curriculumBand(WORDS, 0).slice(0, 18).map((word) => word.id)
const request: CertificationRequest = {
  protocol: 1,
  recentBoards: [ids],
  candidates: Array.from({ length: CERTIFICATION_CANDIDATES }, () => ({
    wordIds: ids,
    needWeights: ids.map((_, index) => 0.1 + index / 10),
  })),
}

const envVar = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]

describe('BQ1 client boundary', () => {
  it('uses the first-party no-identity route and sends only the authorized payload', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ protocol: 1, certifiedCandidateIndices: [3, 7] }), { status: 200 }),
    )
    expect(await requestCertification(request, fetcher as typeof fetch)).toEqual([3, 7])

    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toBe('https://cluecabulary-proxy.kristoffer-kai.workers.dev/v1/casey/deal')
    expect(init.credentials).toBe('omit')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    const body = JSON.parse(String(init.body))
    expect(Object.keys(body).sort()).toEqual(['candidates', 'protocol', 'recentBoards'])
    expect(Object.keys(body.candidates[0]).sort()).toEqual(['needWeights', 'wordIds'])
    expect(JSON.stringify({ headers: init.headers, body })).not.toMatch(
      /authorization|install|identity|playerKey|aiKey|typedClue|analytics|srsHistory/i,
    )
  })

  it('rejects expanded, duplicate, empty, and out-of-range certification output', async () => {
    for (const value of [
      { protocol: 1, certifiedCandidateIndices: [0], route: [] },
      { protocol: 1, certifiedCandidateIndices: [1, 1] },
      { protocol: 1, certifiedCandidateIndices: [] },
      { protocol: 1, certifiedCandidateIndices: [48] },
    ]) {
      const fetcher = vi.fn(async () => new Response(JSON.stringify(value), { status: 200 }))
      await expect(requestCertification(request, fetcher as typeof fetch)).rejects.toThrow(
        /invalid certification/,
      )
    }
  })
})

describe('BQ1 post-round transient prefetch', () => {
  const batch = () =>
    prepareCertificationBatch({
      cityIndex: 0,
      pool: curriculumBand(WORDS, 0),
      stats: {},
      wrapped: new Set(),
      recentBoards: [],
      now: 1_800_000_000_000,
      seed: 0xb01,
    })!

  it('uses only a successfully certified candidate and consumes it once', async () => {
    const prepared = batch()
    expect(new TextEncoder().encode(JSON.stringify(prepared.request)).byteLength).toBeLessThan(
      64 * 1024,
    )
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ protocol: 1, certifiedCandidateIndices: [5] }), { status: 200 }),
    )
    await prefetchCertification(prepared, fetcher as typeof fetch)
    const selected = takeCertifiedBoard(0, [], () => 0.9)
    expect(selected?.entries.map((word) => word.id)).toEqual(
      prepared.candidates[5]!.entries.map((word) => word.id),
    )
    expect(takeCertifiedBoard(0, [])).toBeNull()
  })

  it('falls back without a hard result after failure or a changed board context', async () => {
    clearCertificationPrefetch()
    await prefetchCertification(
      batch(),
      vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch,
    )
    expect(takeCertifiedBoard(0, [])).toBeNull()

    const prepared = batch()
    await prefetchCertification(
      prepared,
      vi.fn(async () =>
        new Response(JSON.stringify({ protocol: 1, certifiedCandidateIndices: [0] }), { status: 200 }),
      ) as unknown as typeof fetch,
    )
    expect(takeCertifiedBoard(0, [ids])).toBeNull()
  })

  it('does not build certification requests outside cities 1, 2, and 9', () => {
    expect(
      prepareCertificationBatch({
        cityIndex: 2,
        pool: wordsForCity(WORDS, 2),
        stats: {},
        wrapped: new Set(),
        recentBoards: [],
        now: 1_800_000_000_000,
        seed: 1,
      }),
    ).toBeNull()
  })
})

describe('BQ1 client/server preparation parity', () => {
  // `curriculumBand`, not `wordsForCity`: the Worker's shard for city 1 was
  // authored against the curriculumRank band, and parity is about the
  // protocol. The journey's City 1 is the authored roster now, which the
  // shard cannot certify — the test below pins that no request is built.
  it('turns the real client batch into opaque viable indices without exposing a key', () => {
    const batch = prepareCertificationBatch({
      cityIndex: 0,
      pool: curriculumBand(WORDS, 0),
      stats: {},
      wrapped: new Set(),
      recentBoards: [],
      now: 1_800_000_000_000,
      seed: 0xb01,
    })!
    const response = certifyDeal(parseDealRequest(batch.request))
    expect(response?.certifiedCandidateIndices.length).toBeGreaterThan(0)
    expect(JSON.stringify(response)).not.toMatch(/green|key|route|score|viable|pair/i)
  }, 45_000)

  it('builds no batch for a journey city the shard does not cover', () => {
    // City 1 is the authored roster; 76 of its words lie outside the shard's
    // band, so a request would only be refused. No batch, no egress.
    expect(
      prepareCertificationBatch({
        cityIndex: 0,
        pool: wordsForCity(WORDS, 0),
        stats: {},
        wrapped: new Set(),
        recentBoards: [],
        now: 1_800_000_000_000,
        seed: 0xb01,
      }),
    ).toBeNull()
  })
})

describe('BQ1 deployed certification smoke', () => {
  const live = envVar('BQ1_LIVE') === '1' ? it : it.skip

  live('accepts an identifier-free authored-city batch from the deployed first-party Worker', async () => {
    const batch = prepareCertificationBatch({
      cityIndex: 0,
      pool: curriculumBand(WORDS, 0),
      stats: {},
      wrapped: new Set(),
      recentBoards: [],
      now: 1_800_000_000_000,
      seed: 0xb01,
    })!
    // Browsers supply Origin themselves; Node needs the same permitted app
    // origin for this opt-in deployed-service smoke check.
    const capacitorFetcher: typeof fetch = (input, init) =>
      fetch(input, {
        ...init,
        headers: { ...(init?.headers ?? {}), Origin: 'capacitor://localhost' },
      })
    const indices = await requestCertification(batch.request, capacitorFetcher)
    expect(indices.length).toBeGreaterThan(0)
    expect(indices.length).toBeLessThanOrEqual(8)
  }, 45_000)
})
