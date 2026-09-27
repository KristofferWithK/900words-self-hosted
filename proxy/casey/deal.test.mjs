import { describe, expect, it } from 'vitest'
import {
  certificationSeed,
  DEAL_CONFIG,
  generatedKeys,
  selectViableDeal,
  shippedDealConfig,
  shippedGreenOverlap,
  solvableRoute,
  VIABLE_RESERVOIR,
} from './deal.js'
import { BOARD, shippedGreenOverlap as clientShippedGreenOverlap } from '../../src/engine/config.ts'
import { generateKeys } from '../../src/engine/keygen.ts'
import { mulberry32 } from '../../src/engine/rng.ts'
import { certificationSeed as clientCertificationSeed } from '../../src/boardCertification.ts'

const board = (count = 6) =>
  Array.from({ length: count }, (_, i) => ({
    id: `da:ord${i}`,
    da: `ord${i}`,
    en: [`word${i}`],
    pos: 'noun',
  }))

function evaluator({ pairs = true, related = () => false } = {}) {
  const ids = board(24).map((word) => word.id)
  const pairClue = /^signal-(\d+)-(\d+)$/
  return {
    ids,
    has: (id) => ids.includes(id),
    assocFor: (id) => [{ da: `solo-${id.slice(6)}`, en: `single-${id.slice(6)}` }],
    pairFor: (a, b) =>
      pairs
        ? [{ da: `signal-${a.slice(6)}-${b.slice(6)}`, en: `pair-${a.slice(6)}-${b.slice(6)}` }]
        : [],
    sim: (clue, id) => {
      if (clue === `solo-${id.slice(6)}` || clue === `single-${id.slice(6)}`) return 3
      const hit = pairClue.exec(clue)
      return hit && (id === `da:ord${hit[1]}` || id === `da:ord${hit[2]}`) ? 3 : 0
    },
    related,
  }
}

describe('BQ1 route gate', () => {
  const words = board()
  const keys = {
    playerGreenIds: ['da:ord0', 'da:ord1', 'da:ord2'],
    aiGreenIds: ['da:ord2', 'da:ord3', 'da:ord4'],
  }

  it('rejects a known fixture that needs more one-word clues than the token budget', () => {
    expect(solvableRoute(evaluator({ pairs: false }), words, keys, 'player', 3)).toBeNull()
  })

  it('accepts the same keys when legal evaluator-safe pair clues form a route', () => {
    const route = solvableRoute(evaluator(), words, keys, 'player', 3)
    expect(route).not.toBeNull()
    expect(route.length).toBeLessThanOrEqual(3)
    expect(new Set(route.flatMap((step) => step.targets))).toEqual(
      new Set(['da:ord0', 'da:ord1', 'da:ord2', 'da:ord3', 'da:ord4']),
    )
  })
})

describe('BQ1 viable reservoir and pair memory', () => {
  const pool = board(24)
  const config = { totalWords: 6, greensPerSide: 3, greenOverlap: 1, turnTokens: 3 }
  const candidates = Array.from({ length: 12 }, (_, i) => ({
    // The first four repeat the supported ord0/ord1 pair; the rest do not.
    wordIds: i < 4
      ? ['da:ord0', 'da:ord1', 'da:ord2', 'da:ord3', 'da:ord4', 'da:ord5']
      : [
          `da:ord${i + 2}`,
          `da:ord${i + 3}`,
          `da:ord${i + 4}`,
          `da:ord${i + 5}`,
          `da:ord${i + 6}`,
          `da:ord${i + 7}`,
        ],
    needWeights: Array(6).fill(1),
  }))
  const request = {
    recentBoards: [
      ['da:ord12', 'da:ord13', 'da:ord14', 'da:ord15', 'da:ord16', 'da:ord17'],
      ['da:ord0', 'da:ord1', 'da:ord18', 'da:ord19', 'da:ord20', 'da:ord21'],
    ],
    candidates,
  }

  it('retains at most eight viable candidates and avoids recent supported pairs', () => {
    const result = selectViableDeal(
      request,
      evaluator({
        related: (a, b) =>
          new Set([a, b]).size === 2 &&
          [a, b].includes('da:ord0') &&
          [a, b].includes('da:ord1'),
      }),
      new Map(pool.map((word) => [word.id, word])),
      config,
    )
    expect(result.choices).toHaveLength(VIABLE_RESERVOIR)
    expect(result.choices.every(({ candidateIndex }) => candidateIndex >= 4)).toBe(true)
    expect(result.repeatRelaxed).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/playerGreenIds|aiGreenIds/)
  })

  it('relaxes pair memory, and only pair memory, when every solvable choice repeats', () => {
    const onlyRepeats = { ...request, candidates: candidates.slice(0, 4) }
    const result = selectViableDeal(
      onlyRepeats,
      evaluator({ related: (a, b) => [a, b].includes('da:ord0') && [a, b].includes('da:ord1') }),
      new Map(pool.map((word) => [word.id, word])),
      config,
    )
    expect(result.choices).toHaveLength(4)
    expect(result.repeatRelaxed).toBe(true)

    const impossible = selectViableDeal(
      onlyRepeats,
      evaluator({ pairs: false }),
      new Map(pool.map((word) => [word.id, word])),
      config,
    )
    expect(impossible).toBeNull()
  })
})

describe('BQ1 weighted key parity', () => {
  it('resolves the shipped overlap identically on the service and phone', () => {
    for (let seed = 0; seed < 3000; seed++) {
      expect(shippedGreenOverlap(seed)).toBe(clientShippedGreenOverlap(seed))
    }
  })

  it('builds each default certified key with the overlap resolved from its candidate seed', () => {
    const ids = Array.from({ length: DEAL_CONFIG.totalWords }, (_, i) => `da:test-${i}`)
    const weights = ids.map((_, i) => (i + 1) / 7)
    const seed = certificationSeed(ids, weights)
    const config = shippedDealConfig(seed)
    const keys = generatedKeys(config, ids, seed, Object.fromEntries(ids.map((id, i) => [id, weights[i]])))
    const overlap = ids.filter(
      (id) => keys.playerGreenIds.includes(id) && keys.aiGreenIds.includes(id),
    )
    expect(overlap).toHaveLength(config.greenOverlap)
  })

  it('mirrors the engine keygen exactly without putting either key in a response', () => {
    const ids = Array.from({ length: BOARD.totalWords }, (_, i) => `da:test-${i}`)
    const need = Object.fromEntries(ids.map((id, i) => [id, i % 4 === 0 ? 0.125 : (i + 1) / 3]))

    for (const seed of [0, 1, 0x5eed1234, 0xffffffff]) {
      const server = generatedKeys(BOARD, ids, seed, need)
      const engine = generateKeys(BOARD, ids, mulberry32(seed), { need })
      const enginePlayer = ids.filter((id) => engine.playerKey[id] === 'green')
      const engineAi = ids.filter((id) => engine.aiKey[id] === 'green')

      expect(new Set(server.playerGreenIds)).toEqual(new Set(enginePlayer))
      expect(new Set(server.aiGreenIds)).toEqual(new Set(engineAi))
    }
  })

  it('derives a stable non-secret key seed from ids and aligned need weights', () => {
    const ids = Array.from({ length: DEAL_CONFIG.totalWords }, (_, i) => `da:test-${i}`)
    const weights = ids.map((_, i) => (i + 1) / 7)
    expect(certificationSeed(ids, weights)).toBe(certificationSeed([...ids], [...weights]))
    expect(certificationSeed(ids, weights)).toBe(clientCertificationSeed(ids, weights))
    expect(certificationSeed(ids, weights)).not.toBe(certificationSeed([...ids].reverse(), weights))
  })

  it('uses the precomputed deal score path without consulting the cold evaluator', () => {
    const words = board()
    const keys = {
      playerGreenIds: ['da:ord0', 'da:ord1', 'da:ord2'],
      aiGreenIds: ['da:ord2', 'da:ord3', 'da:ord4'],
    }
    const indexed = evaluator()
    indexed.dealSim = indexed.sim
    indexed.sim = () => {
      throw new Error('cold evaluator was used')
    }
    expect(solvableRoute(indexed, words, keys, 'player', 3)).not.toBeNull()
  })
})
