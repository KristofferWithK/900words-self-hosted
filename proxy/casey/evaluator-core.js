import { foldDanish, normalize } from './language.js'

export const TWO_HOP_DISCOUNT = 0.5

const pairKey = (a, b) => `${a}|${b}`

/** Canonical evaluator implementation, shared with the offline deal-index generator. */
export function buildEvaluator(matrix, book) {
  const n = matrix.n
  const index = new Map()
  matrix.ids.forEach((id, i) => index.set(id, i))

  const binary = atob(matrix.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const cell = (a, b) => {
    const i = a * n + b
    return (bytes[i >> 2] >> ((i & 3) * 2)) & 0b11
  }
  const matrixScore = (a, b) => {
    const ia = index.get(a)
    const ib = index.get(b)
    return ia === undefined || ib === undefined ? 0 : cell(ia, ib)
  }
  const keysOf = (value) => {
    const ordinary = normalize(value)
    const folded = foldDanish(ordinary)
    return folded === ordinary ? [ordinary] : [ordinary, folded]
  }

  const direct = new Map()
  const addDirect = (form, wordId, entry) => {
    let perWord = direct.get(form)
    if (!perWord) direct.set(form, (perWord = new Map()))
    const prior = perWord.get(wordId)
    if (!prior || entry.s > prior.s) perWord.set(wordId, entry)
  }
  const indexEntry = (wordId, entry) => {
    for (const form of [...keysOf(entry.da), ...keysOf(entry.en)]) addDirect(form, wordId, entry)
  }
  for (const [wordId, word] of Object.entries(book.words)) {
    for (const entry of word.assoc) indexEntry(wordId, entry)
  }
  for (const [key, entries] of Object.entries(book.pairs)) {
    const [a, b] = key.split('|')
    for (const entry of entries) {
      indexEntry(a, entry)
      indexEntry(b, entry)
    }
  }

  const headwords = new Map()
  for (const id of matrix.ids) {
    const da = id.slice(id.indexOf(':') + 1)
    for (const form of keysOf(da)) {
      const ids = headwords.get(form)
      if (ids) ids.push(id)
      else headwords.set(form, [id])
    }
  }

  // Per isolate and for its lifetime, so bounded: a round scores a few
  // hundred pairs, and the memo is worth nothing at all past a few boards.
  const SIM_CACHE_MAX = 50_000
  const cache = new Map()
  const sim = (clue, wordId) => {
    const cacheKey = `${clue}\0${wordId}`
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return cached
    if (cache.size >= SIM_CACHE_MAX) cache.clear()
    let best = 0
    for (const form of keysOf(clue)) {
      const perWord = direct.get(form)
      const own = perWord?.get(wordId)
      if (own && own.s > best) best = own.s
      for (const head of headwords.get(form) ?? []) best = Math.max(best, matrixScore(head, wordId))
      if (perWord) {
        for (const [via, entry] of perWord) {
          if (via === wordId) continue
          const through = matrixScore(via, wordId)
          if (through > 0) best = Math.max(best, Math.min(entry.s, through) - TWO_HOP_DISCOUNT)
        }
      }
      if (best >= 3) break
    }
    cache.set(cacheKey, best)
    return best
  }

  const scoreClue = (clue, targets, traps) => {
    let minTarget = targets.length === 0 ? 0 : Infinity
    for (const target of targets) minTarget = Math.min(minTarget, sim(clue, target))
    let riskiest = null
    for (const trap of traps) {
      const score = sim(clue, trap)
      if (!riskiest || score > riskiest.sim) riskiest = { id: trap, sim: score }
    }
    return { margin: minTarget - (riskiest?.sim ?? 0), riskiest, coverage: targets.length }
  }

  const whyFor = (clue, wordId) => {
    let best = null
    for (const form of keysOf(clue)) {
      const entry = direct.get(form)?.get(wordId)
      if (entry && (!best || entry.s > best.s)) best = entry
    }
    return best?.why ?? null
  }

  return {
    city: matrix.city,
    ids: matrix.ids,
    has: (wordId) => index.has(wordId),
    sim,
    scoreClue,
    assocFor: (wordId) => book.words[wordId]?.assoc ?? [],
    pairFor: (a, b) => book.pairs[pairKey(a, b)] ?? book.pairs[pairKey(b, a)] ?? [],
    related: (a, b) => matrixScore(a, b) > 0,
    whyFor,
  }
}

/**
 * Adds an exact O(1) score path for the finite clue forms used by board
 * certification. Unknown forms deliberately fall back to the canonical
 * evaluator so normal Casey clue evaluation is unchanged.
 */
export function attachDealIndex(evaluator, rawIndex) {
  const index = typeof rawIndex === 'string' ? JSON.parse(rawIndex) : rawIndex
  if (
    index?.protocol !== 1 ||
    index.city !== evaluator.city ||
    !Array.isArray(index.ids) ||
    index.ids.length !== evaluator.ids.length ||
    index.ids.some((id, i) => id !== evaluator.ids[i]) ||
    !Array.isArray(index.forms) ||
    index.forms.some((form) => typeof form !== 'string' || !form) ||
    typeof index.data !== 'string' ||
    typeof index.illegal !== 'string'
  ) {
    throw new Error('invalid deal score index')
  }
  const binary = atob(index.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const cells = index.forms.length * index.ids.length
  if (bytes.length !== Math.ceil(cells / 2)) throw new Error('invalid deal score index')
  const rows = new Map(index.forms.map((form, i) => [form, i]))
  const ids = new Map(index.ids.map((id, i) => [id, i]))
  const illegalBinary = atob(index.illegal)
  const illegal = new Uint8Array(illegalBinary.length)
  for (let i = 0; i < illegalBinary.length; i++) illegal[i] = illegalBinary.charCodeAt(i)
  if (illegal.length !== Math.ceil(cells / 8)) throw new Error('invalid deal score index')
  const scoreAt = (row, column) => {
    const cell = row * index.ids.length + column
    const packed = bytes[cell >> 1]
    return ((cell & 1 ? packed >> 4 : packed) & 0x0f) / 2
  }
  const dealSim = (clue, wordId) => {
    const row = rows.get(clue)
    const column = ids.get(wordId)
    if (row === undefined || column === undefined) return evaluator.sim(clue, wordId)
    return scoreAt(row, column)
  }
  const dealRow = (clue) => {
    const row = rows.get(clue)
    if (row === undefined) return null
    return {
      sim: (wordId) => {
        const column = ids.get(wordId)
        return column === undefined ? evaluator.sim(clue, wordId) : scoreAt(row, column)
      },
      legalFor: (wordIds) =>
        wordIds.every((wordId) => {
          const column = ids.get(wordId)
          if (column === undefined) return false
          const cell = row * index.ids.length + column
          return ((illegal[cell >> 3] >> (cell & 7)) & 1) === 0
        }),
    }
  }
  return { ...evaluator, dealSim, dealRow }
}
