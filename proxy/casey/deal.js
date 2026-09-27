import { cityOfWord, loadEvaluator } from './evaluator.js'
import { checkClueLegality } from './language.js'
import wordsRaw from '../../src/data/words.da.json'

export const DEAL_CANDIDATES = 48
export const VIABLE_RESERVOIR = 8
export const PAIR_HISTORY = 4
export const DEAL_THETA = 0.5

export const DEAL_CONFIG = Object.freeze({
  totalWords: 18,
  greensPerSide: 8,
  greenOverlap: 3,
  turnTokens: 8,
})

export const SHIPPED_GREEN_OVERLAPS = Object.freeze([1, 2, 3])

/** Mirrored in src/engine/config.ts; keep certification and phone keys identical. */
export function shippedGreenOverlap(seed) {
  let x = (Math.trunc(seed) ^ 0x6d2b79f5) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x = (x ^ (x >>> 16)) >>> 0
  return SHIPPED_GREEN_OVERLAPS[x % SHIPPED_GREEN_OVERLAPS.length]
}

export function shippedDealConfig(seed) {
  return { ...DEAL_CONFIG, greenOverlap: shippedGreenOverlap(seed) }
}

const WORDS = new Map(wordsRaw.map(({ id, da, en, pos }) => [id, { id, da, en, pos }]))

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const headword = (id) => id.slice(id.indexOf(':') + 1)

function clueForms(evaluator, greenIds, boardIds) {
  const forms = new Set()
  const add = (entry) => {
    forms.add(entry.da)
    forms.add(entry.en)
  }
  for (const id of greenIds) for (const entry of evaluator.assocFor(id)) add(entry)
  for (let i = 0; i < greenIds.length; i++) {
    for (let j = i + 1; j < greenIds.length; j++) {
      for (const entry of evaluator.pairFor(greenIds[i], greenIds[j])) add(entry)
    }
  }
  const onBoard = new Set(boardIds)
  for (const id of evaluator.ids) if (!onBoard.has(id)) forms.add(headword(id))
  return forms
}

/**
 * Every edge is a legal clue whose weakest named target clears every live
 * neutral by the evaluator margin used in production. The BFS then asks the
 * real board question: can alternating givers reveal the union of both keys
 * before the shared eight-token pool is gone? Guesses on an edge are assumed
 * correct; this is a solvability gate, not a promise that either player will
 * read every clue perfectly.
 */
export function solvableRoute(evaluator, board, keys, firstGiver = 'player', maxTokens = 8) {
  const boardIds = board.map((word) => word.id)
  if (!boardIds.every((id) => evaluator.has(id))) return null
  const greens = {
    player: new Set(keys.playerGreenIds),
    ai: new Set(keys.aiGreenIds),
  }
  const allGreen = new Set([...greens.player, ...greens.ai])
  const boardForLegality = board.map(({ id, da, en, pos }) => ({ wordId: id, da, en, pos }))
  // Score each clue once against the full, hardest trap surface. A later turn
  // can only remove traps, so every retained plan remains safe throughout the
  // route. This conservative form is what makes 48 candidates practical: the
  // route search operates on target sets, never thousands of clues per state.
  const plansFor = (giver) => {
    const score = evaluator.dealSim ?? evaluator.sim
    const targetIds = [...greens[giver]]
    const traps = boardIds.filter((id) => !greens[giver].has(id))
    const unique = new Map()
    for (const clue of clueForms(evaluator, targetIds, boardIds)) {
      const indexed = evaluator.dealRow?.(clue) ?? null
      if (indexed ? !indexed.legalFor(boardIds) : !checkClueLegality(clue, boardForLegality).legal) continue
      const clueScore = indexed ? (_clue, id) => indexed.sim(id) : score
      const ranked = targetIds
        .map((id) => ({ id, sim: clueScore(clue, id) }))
        .sort((a, b) => b.sim - a.sim || a.id.localeCompare(b.id))
      if (!ranked[0] || ranked[0].sim <= 0) continue
      let trapScore = 0
      for (const id of traps) trapScore = Math.max(trapScore, clueScore(clue, id))
      for (let count = Math.min(4, ranked.length); count >= 1; count--) {
        if (ranked[count - 1].sim - trapScore < DEAL_THETA) continue
        const targets = ranked.slice(0, count).map(({ id }) => id).sort()
        const key = targets.join('|')
        if (!unique.has(key)) unique.set(key, { clue, targets })
        break
      }
    }
    const plans = [...unique.values()]
    // A clue that safely covers a strict superset always dominates the subset:
    // guesses are assumed correct by this solvability gate and both cost one
    // token. Removing dominated edges cuts the BFS by orders of magnitude.
    return plans.filter(
      (plan) =>
        !plans.some(
          (other) =>
            other.targets.length > plan.targets.length &&
            plan.targets.every((id) => other.targets.includes(id)),
        ),
    )
  }
  const plans = { player: plansFor('player'), ai: plansFor('ai') }
  const start = { found: new Set(), giver: firstGiver, route: [] }
  const queue = [start]
  const seen = new Set()
  while (queue.length) {
    const state = queue.shift()
    if (state.found.size === allGreen.size) return state.route
    if (state.route.length >= maxTokens) continue
    let giver = state.giver
    let remaining = [...greens[giver]].filter((id) => !state.found.has(id))
    if (remaining.length === 0) {
      giver = giver === 'player' ? 'ai' : 'player'
      remaining = [...greens[giver]].filter((id) => !state.found.has(id))
      if (remaining.length === 0) return state.route
    }
    const nextSets = new Map()
    for (const plan of plans[giver]) {
      const targets = plan.targets.filter((id) => !state.found.has(id))
      if (targets.length === 0) continue
      const key = targets.join('|')
      if (!nextSets.has(key)) nextSets.set(key, { clue: plan.clue, targets })
    }
    for (const plan of nextSets.values()) {
      const found = new Set([...state.found, ...plan.targets])
      const other = giver === 'player' ? 'ai' : 'player'
      const nextGiver = [...greens[other]].some((id) => !found.has(id)) ? other : giver
      const signature = `${nextGiver}:${[...found].sort().join(',')}`
      if (seen.has(signature)) continue
      seen.add(signature)
      queue.push({
        found,
        giver: nextGiver,
        route: [...state.route, { giver, clue: plan.clue, targets: plan.targets }],
      })
    }
  }
  return null
}

function supportedPairs(evaluator, ids) {
  const pairs = new Set()
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (evaluator.related(ids[i], ids[j])) pairs.add(pairKey(ids[i], ids[j]))
    }
  }
  return pairs
}

const mulberry32 = (seed) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generatedKeys(config, wordIds, seed, need) {
  const rng = mulberry32(seed)
  // This is the production engine keygen's Efraimidis-Spirakis order. Keeping
  // the server-only certifier byte-equivalent prevents it from proving a
  // different hidden deal than the engine would construct from the same
  // already-available inputs. No key assignment leaves this module.
  const ordered = need
    ? wordIds
        .map((id) => ({ id, key: Math.pow(rng(), 1 / Math.max(need[id] ?? 1, 1e-6)) }))
        .sort((a, b) => b.key - a.key)
        .map(({ id }) => id)
    : (() => {
        // Preserve the original benchmark/prototype path byte-for-byte when
        // no SRS weights are supplied.
        const shuffled = [...wordIds]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      })()
  const shared = new Set(ordered.slice(0, config.greenOverlap))
  const aiOnly = new Set(ordered.slice(config.greenOverlap, config.greensPerSide))
  const playerOnly = new Set(
    ordered.slice(config.greensPerSide, config.greensPerSide * 2 - config.greenOverlap),
  )
  return {
    playerGreenIds: [...shared, ...playerOnly],
    aiGreenIds: [...shared, ...aiOnly],
  }
}

/** Derive the shared key seed without transmitting it or either secret key. */
export function certificationSeed(wordIds, needWeights) {
  let hash = 2166136261
  const add = (value) => {
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  for (let i = 0; i < wordIds.length; i++) add(`${wordIds[i]}\0${needWeights[i]}\x01`)
  return hash >>> 0
}

/**
 * Certify up to eight choices. The phone makes the final random pick, so the
 * service never learns which certified deal was actually played. Seeds and
 * secret-key assignments never cross this boundary.
 */
export function selectViableDeal(request, evaluator, words = WORDS, config = null) {
  if (!evaluator) return null
  const historyPairs = new Set()
  for (const ids of request.recentBoards.slice(0, PAIR_HISTORY)) {
    for (const pair of supportedPairs(evaluator, ids)) historyPairs.add(pair)
  }
  const viable = []
  for (let index = 0; index < request.candidates.length; index++) {
    const candidate = request.candidates[index]
    const board = candidate.wordIds.map((id) => words.get(id))
    if (board.some((word) => !word)) continue
    const need = Object.fromEntries(candidate.wordIds.map((id, i) => [id, candidate.needWeights[i]]))
    const keySeed = certificationSeed(candidate.wordIds, candidate.needWeights)
    const candidateConfig = config ?? shippedDealConfig(keySeed)
    const keys = generatedKeys(
      candidateConfig,
      candidate.wordIds,
      keySeed,
      need,
    )
    const route = solvableRoute(evaluator, board, keys, 'player', candidateConfig.turnTokens)
    if (!route) continue
    const carry = new Set(candidate.wordIds.filter((id) => request.recentBoards[0]?.includes(id)))
    const repeats = [...supportedPairs(evaluator, candidate.wordIds)].filter(
      (pair) => historyPairs.has(pair) && !pair.split('|').every((id) => carry.has(id)),
    )
    viable.push({ index, route, repeats, pairs: supportedPairs(evaluator, candidate.wordIds).size })
  }
  if (viable.length === 0) return null
  const varied = viable.filter((deal) => deal.repeats.length === 0)
  // This is the only relaxation BQ1 permits: a repeated supported pair may
  // return when every solvable candidate contains one. Solvability is never
  // weakened and an empty viable set stays empty.
  const reservoir = (varied.length > 0 ? varied : viable).slice(0, VIABLE_RESERVOIR)
  return {
    choices: reservoir.map((deal) => ({ candidateIndex: deal.index })),
    viableCount: viable.length,
    variedCount: varied.length,
    pairDiversity: new Set(
      reservoir.flatMap((deal) => [
        ...supportedPairs(evaluator, request.candidates[deal.index].wordIds),
      ]),
    ).size,
    maxRouteLength: Math.max(...reservoir.map((deal) => deal.route.length)),
    repeatRelaxed: varied.length === 0,
  }
}

/** A batch must belong wholly to one of the three authored evaluator shards. */
export function evaluatorForDeal(request) {
  const ids = request.candidates.flatMap((candidate) => candidate.wordIds)
  const city = ids.length > 0 ? cityOfWord(ids[0]) : null
  if (city === null || !ids.every((id) => cityOfWord(id) === city)) return null
  return loadEvaluator(city)
}
