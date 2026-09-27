import { describe, expect, it } from 'vitest'
import words from '../../src/data/words.da.json'
import { certificationEnvelope, parseDealRequest } from './deal-contract.js'

const city = (number) =>
  words
    .filter((word) => Math.floor(((word.curriculumRank ?? word.freqRank) - 1) / 100) + 1 === number)
    .slice(0, 18)
    .map((word) => word.id)

const request = (ids = city(1)) => ({
  protocol: 1,
  recentBoards: [ids, [...ids].reverse()],
  candidates: Array.from({ length: 48 }, (_, candidate) => ({
    wordIds: [...ids.slice(candidate % ids.length), ...ids.slice(0, candidate % ids.length)],
    needWeights: ids.map((_, index) => 0.1 + index / 10),
  })),
})

describe('BQ1 deal request firewall', () => {
  it('accepts only candidate ids, aligned anonymous weights, and four recent id sets', () => {
    const { protocol: _protocol, ...parsed } = request()
    expect(parseDealRequest(request())).toEqual(parsed)

    for (const extra of [
      { installId: 'installation-123' },
      { playerKey: {} },
      { typedClue: 'family' },
      { srsHistory: [] },
      { analytics: {} },
    ]) {
      expect(() => parseDealRequest({ ...request(), ...extra })).toThrow(/not part of the deal protocol/)
    }
  })

  it('rejects seeds, key assignments, word text, malformed weights, and unauthored cities', () => {
    for (const extra of [
      { seed: 7 },
      { playerGreenIds: city(1).slice(0, 8) },
      { da: 'mor' },
      { clue: 'familie' },
    ]) {
      const value = request()
      value.candidates[0] = { ...value.candidates[0], ...extra }
      expect(() => parseDealRequest(value)).toThrow(/not part of the deal protocol/)
    }
    const badWeight = request()
    badWeight.candidates[0].needWeights[0] = Number.NaN
    expect(() => parseDealRequest(badWeight)).toThrow(/needWeights/)
    expect(() => parseDealRequest(request(city(3)))).toThrow(/authored city/)
  })

  it('returns only opaque candidate indices, never solver evidence or secret keys', () => {
    const envelope = certificationEnvelope({
      choices: [{ candidateIndex: 2 }, { candidateIndex: 7 }],
      viableCount: 48,
      variedCount: 11,
      pairDiversity: 99,
      maxRouteLength: 6,
      repeatRelaxed: false,
      playerGreenIds: ['secret'],
    })
    expect(envelope).toEqual({ protocol: 1, certifiedCandidateIndices: [2, 7] })
    expect(JSON.stringify(envelope)).not.toMatch(/green|key|route|score|viable|pair/i)
  })
})
