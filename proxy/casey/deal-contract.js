import { DEAL_CANDIDATES, PAIR_HISTORY, evaluatorForDeal, selectViableDeal } from './deal.js'

export const DEAL_PROTOCOL = 1
export const DEAL_PATH = '/v1/casey/deal'
export const DEAL_MAX_REQUEST_BYTES = 64 * 1024

export class DealRequestError extends Error {}

const fail = (message) => {
  throw new DealRequestError(message)
}
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function exactObject(value, keys, at) {
  if (!plainObject(value)) fail(`${at} must be an object`)
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${at}.${key} is not part of the deal protocol`)
  }
  return value
}

function wordIds(value, at, exactLength) {
  if (!Array.isArray(value) || value.length !== exactLength) {
    fail(`${at} must contain ${exactLength} word ids`)
  }
  const ids = value.map((id, index) => {
    if (typeof id !== 'string' || id.length < 1 || id.length > 80) fail(`${at}[${index}] is invalid`)
    return id
  })
  if (new Set(ids).size !== ids.length) fail(`${at} contains duplicate ids`)
  return ids
}

function recentBoardIds(value, at) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 18) {
    fail(`${at} must contain 1-18 word ids`)
  }
  const ids = value.map((id, index) => {
    if (typeof id !== 'string' || id.length < 1 || id.length > 80) fail(`${at}[${index}] is invalid`)
    return id
  })
  if (new Set(ids).size !== ids.length) fail(`${at} contains duplicate ids`)
  return ids
}

/** Strict allowlist for the complete owner-authorized gameplay payload. */
export function parseDealRequest(value) {
  const object = exactObject(value, ['protocol', 'candidates', 'recentBoards'], 'request')
  if (object.protocol !== DEAL_PROTOCOL) fail(`request.protocol must be ${DEAL_PROTOCOL}`)
  if (!Array.isArray(object.candidates) || object.candidates.length !== DEAL_CANDIDATES) {
    fail(`request.candidates must contain ${DEAL_CANDIDATES} candidates`)
  }
  const candidates = object.candidates.map((value, index) => {
    const at = `request.candidates[${index}]`
    const candidate = exactObject(value, ['wordIds', 'needWeights'], at)
    const ids = wordIds(candidate.wordIds, `${at}.wordIds`, 18)
    if (!Array.isArray(candidate.needWeights) || candidate.needWeights.length !== ids.length) {
      fail(`${at}.needWeights must align with wordIds`)
    }
    const needWeights = candidate.needWeights.map((weight, weightIndex) => {
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0.000001 || weight > 100) {
        fail(`${at}.needWeights[${weightIndex}] is invalid`)
      }
      return weight
    })
    return { wordIds: ids, needWeights }
  })
  if (!Array.isArray(object.recentBoards) || object.recentBoards.length > PAIR_HISTORY) {
    fail(`request.recentBoards must contain at most ${PAIR_HISTORY} boards`)
  }
  const recentBoards = object.recentBoards.map((value, index) =>
    recentBoardIds(value, `request.recentBoards[${index}]`),
  )
  const request = { candidates, recentBoards }
  if (!evaluatorForDeal(request)) fail('all candidates must belong to one authored city')
  return request
}

/** Return only opaque indices; routes, scores, keys and seeds stay in memory. */
export function certifyDeal(request) {
  const selected = selectViableDeal(request, evaluatorForDeal(request))
  return selected ? certificationEnvelope(selected) : null
}

export function certificationEnvelope(selected) {
  return {
    protocol: DEAL_PROTOCOL,
    certifiedCandidateIndices: selected.choices.map(({ candidateIndex }) => candidateIndex),
  }
}
