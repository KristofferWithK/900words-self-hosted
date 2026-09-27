import associationIndexRaw from '../data/association-index.da.1.json'
import legalIndexCluesRaw from '../data/legal-index-clues.da.1.json'
import { checkClueLegality, normalize } from './language.js'
import { compareBySafety, formatScore, labelWithScore, lcsiRulerLine, lcsiScoresFor, localStatistics } from './lcsi.js'
import { aiGuessableIds, aiTargetableIds, isOpenFor } from './projections.js'

const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)
const raw = readAsset(associationIndexRaw)
const SOURCE_SHA256 = '6a6e669768db0d0ded6d73cae1d649af4db26f9c67c3dda8c7fb005debd12289'
const FINAL_POST_LEGALITY_SHA256 = 'b27cf47eec93535d0303fb224472662b63a7da2fb58d6ce2831df36c7b72116c'

function loadIndex(doc) {
  if (
    doc?.protocol !== 1 ||
    doc.lang !== 'da' ||
    doc.scope !== 'replacement-city1-first-100' ||
    !Array.isArray(doc.wordIds) ||
    doc.wordIds.length !== 100 ||
    !Array.isArray(doc.clues) ||
    doc.metrics?.edgeCount !== 51_213 ||
    doc.metrics?.clueCount !== 7_595 ||
    doc.source?.sha256 !== SOURCE_SHA256 ||
    doc.source?.finalPostLegalitySha256 !== FINAL_POST_LEGALITY_SHA256
  ) {
    throw new Error('the private replacement City 1 association index has an unsupported schema')
  }
  const wordIds = Object.freeze([...doc.wordIds])
  const wordIdSet = new Set(wordIds)
  const clues = new Map()
  // The same entries in the file's order: the position a clue holds here is
  // what proxy/data/legal-index-clues.da.1.json names when it says a clue is
  // illegal on a board.
  const entries = []
  let edges = 0
  for (const row of doc.clues) {
    if (
      !Array.isArray(row) ||
      row.length !== 2 ||
      typeof row[0] !== 'string' ||
      !Array.isArray(row[1]) ||
      row[1].some((index) => !Number.isInteger(index) || index < 0 || index >= wordIds.length)
    ) {
      throw new Error('the private replacement City 1 association index has a malformed clue row')
    }
    const key = normalize(row[0])
    if (clues.has(key)) throw new Error('the private replacement City 1 association index repeats a clue')
    edges += row[1].length
    const entry = Object.freeze({
      clue: row[0],
      wordIds: Object.freeze(row[1].map((index) => wordIds[index])),
    })
    clues.set(key, entry)
    entries.push([key, entry])
  }
  if (clues.size !== doc.metrics.clueCount || edges !== doc.metrics.edgeCount) {
    throw new Error('the private replacement City 1 association index metrics do not match its rows')
  }
  return Object.freeze({
    wordIds,
    wordIdSet,
    clues,
    entries,
    info: Object.freeze({ ...doc.metrics, sourceSha256: doc.source?.sha256, scope: doc.scope }),
  })
}

const INDEX = loadIndex(raw)
const MAX_CLUE_CANDIDATES = 12
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

export const associationIndexInfo = INDEX.info

/** Fail closed: a mixed or unauthored board receives no replacement-corpus advice. */
export function supportsAssociationBoard(view) {
  return view.words.length > 0 && view.words.every((word) => INDEX.wordIdSet.has(word.id))
}

const boardLabel = (view, id) => {
  const word = view.words.find((candidate) => candidate.id === id)
  return word ? `${id} (${word.da})` : id
}

function diversifyCandidates(candidates, limit) {
  const selected = []
  const selectedClues = new Set()
  const targetSets = new Map()
  // Give every target combination one representative before allowing a
  // second clue for the same combination. This keeps the packet useful rather
  // than filling it with cosmetic synonyms for one easy pair.
  for (const allowance of [1, 2]) {
    for (const candidate of candidates) {
      if (selected.length >= limit) return selected
      const key = candidate.targetWordIds.join('|')
      if (selectedClues.has(candidate.clue) || (targetSets.get(key) ?? 0) >= allowance) continue
      selected.push(candidate)
      selectedClues.add(candidate.clue)
      targetSets.set(key, (targetSets.get(key) ?? 0) + 1)
    }
  }
  return selected
}

/**
 * Positive structural candidates for Casey while clue-giving. No value here
 * is a strength score: the model must still judge meaning and the live board.
 */
/**
 * Which index clues are legal against a board depends on the board's words
 * and nothing else — not on reveals, not on the key, not on the history — so
 * it is computed once per board and kept. Before this, every City 1 clue
 * request ran checkClueLegality over all 7,595 index clues (about 700 ms in
 * the web container, the bulk of a request's CPU); the second and later
 * clues of a round now cost a Map read. A handful of boards is enough: a
 * Worker isolate serves one player's round at a time, and a reroll or a new
 * deal simply computes the next one and drops the oldest.
 */
const LEGAL_CACHE_BOARDS = 4
const legalByBoard = new Map()
// Unknown deals often reuse words across rerolls. Keep the expensive index
// comparison per Danish word, then union only those illegal positions for a
// board; the bounded size matches the replacement corpus.
const LEGAL_CACHE_WORDS = INDEX.wordIds.length
const illegalByWord = new Map()
let singletonLegalityCacheHits = 0

function illegalPositionsForWord(word) {
  if (precomputedWordIllegal === null) precomputedLegality()
  const da = normalize(word.da)
  const pos = word.pos ?? null
  const precomputed = precomputedWordIllegal.get(word.id)
  if (precomputed && precomputed.da === da && precomputed.pos === pos) {
    singletonLegalityCacheHits++
    return precomputed.illegal
  }

  const key = JSON.stringify([word.id ?? null, da, pos])
  const cached = illegalByWord.get(key)
  if (cached) {
    illegalByWord.delete(key)
    illegalByWord.set(key, cached)
    singletonLegalityCacheHits++
    return cached
  }

  const illegal = new Set()
  const singleton = { da, pos }
  INDEX.entries.forEach(([, entry], position) => {
    if (!checkClueLegality(entry.clue, [singleton]).legal) illegal.add(position)
  })
  if (illegalByWord.size >= LEGAL_CACHE_WORDS) illegalByWord.delete(illegalByWord.keys().next().value)
  illegalByWord.set(key, illegal)
  return illegal
}

function legalIndexEntriesForWords(board) {
  const illegal = new Set()
  for (const word of board) {
    for (const position of illegalPositionsForWord(word)) illegal.add(position)
  }
  return INDEX.entries.filter((_, position) => !illegal.has(position))
}

/**
 * And for the 150 authored City 1 boards — every ordinary City 1 round — the
 * answer is precomputed (scripts/generate-legal-index-clues.mjs): the
 * positions of the clues that are ILLEGAL on each board, by the same sorted
 * word-id key. Measured in the real Worker bundle (2026-09-07): the computed
 * path cost about a second of CPU per new board, which is the whole request
 * budget on the Workers Free plan and a cold isolate's first clue on any
 * plan; the lookup costs about a millisecond. The file pins the index it was
 * derived from; a board it does not know, or a stale file, takes the computed
 * path below, so nothing depends on it being present.
 */
let precomputedIllegal = null
let precomputedWordIllegal = null
function precomputedLegality() {
  if (precomputedIllegal) return precomputedIllegal
  precomputedIllegal = new Map()
  precomputedWordIllegal = new Map()
  const doc = readAsset(legalIndexCluesRaw)
  if (
    doc?.protocol === 1 &&
    doc.lang === 'da' &&
    doc.source?.associationIndexSha256 === SOURCE_SHA256 &&
    doc.clueCount === INDEX.entries.length &&
    Array.isArray(doc.boards)
  ) {
    for (const board of doc.boards) {
      if (typeof board?.wordKey !== 'string' || !Array.isArray(board.illegal)) continue
      if (board.illegal.some((i) => !Number.isInteger(i) || i < 0 || i >= INDEX.entries.length)) continue
      precomputedIllegal.set(board.wordKey, board.illegal)
    }
  } else {
    console.warn('casey: legal-index-clues does not match the association index; computing legality per board')
  }
  if (precomputedIllegal.size > 0 && Array.isArray(doc.wordLegality) && doc.wordLegality.length === INDEX.wordIds.length) {
    const rows = new Map()
    let valid = true
    for (const row of doc.wordLegality) {
      if (
        !INDEX.wordIdSet.has(row?.word) ||
        typeof row.da !== 'string' ||
        (row.pos !== null && typeof row.pos !== 'string') ||
        !Array.isArray(row.illegal) ||
        row.illegal.some((position, index) =>
          !Number.isInteger(position) ||
          position < 0 ||
          position >= INDEX.entries.length ||
          (index > 0 && position <= row.illegal[index - 1]),
        ) ||
        rows.has(row.word)
      ) {
        valid = false
        break
      }
      rows.set(row.word, {
        da: normalize(row.da),
        pos: row.pos,
        illegal: row.illegal,
      })
    }
    if (valid && rows.size === INDEX.wordIds.length) precomputedWordIllegal = rows
  }
  return precomputedIllegal
}

const boardKeyOf = (view, visibleOnly = false) => view.words
  .filter((word) => !visibleOnly || word.reveal?.kind !== 'green')
  .map((word) => word.id)
  .sort()
  .join('|')

/** Test seam: whether this board's legal index clues come from the precomputed file. */
export const legalityPrecomputedFor = (view) => precomputedLegality().has(boardKeyOf(view))

function legalIndexEntriesFor(view) {
  const key = boardKeyOf(view, true)
  const cached = legalByBoard.get(key)
  if (cached) return cached
  const fullBoardKey = boardKeyOf(view)
  const illegal = key === fullBoardKey ? precomputedLegality().get(fullBoardKey) : null
  let legal
  if (illegal) {
    const skip = new Set(illegal)
    legal = INDEX.entries.filter((_, position) => !skip.has(position))
  } else {
    const board = view.words
      .filter((word) => word.reveal?.kind !== 'green')
      .map(({ id, da, en, pos }) => ({ id, da, en, pos }))
    legal = legalIndexEntriesForWords(board)
  }
  if (legalByBoard.size >= LEGAL_CACHE_BOARDS) legalByBoard.delete(legalByBoard.keys().next().value)
  legalByBoard.set(key, legal)
  return legal
}

/** Test seam: how many boards' legality sets are held right now. */
export const legalCacheSize = () => legalByBoard.size

/** Test seam: the computed answer for a board, bypassing its board-level file and cache. */
export function computeLegalIndexKeys(view) {
  const board = view.words
    .filter((word) => word.reveal?.kind !== 'green')
    .map(({ id, da, en, pos }) => ({ id, da, en, pos }))
  return legalIndexEntriesForWords(board).map(([key]) => key)
}

/** Test seam: the bounded fallback singleton-legality cache size. */
export const legalWordCacheSize = () => illegalByWord.size
/** Test seam: count of singleton legality lookups served from either cache. */
export const legalWordCacheHitCount = () => singletonLegalityCacheHits

export function clueAssociationCandidates(view, limit = MAX_CLUE_CANDIDATES) {
  if (!supportsAssociationBoard(view)) return []
  const targetable = new Set(aiTargetableIds(view))
  const open = new Set(
    view.words.filter((word) => isOpenFor(word.reveal, 'ai')).map((word) => word.id),
  )
  const used = new Set(view.history.map((entry) => normalize(entry.text)))
  const minimum = targetable.size === 1 ? 1 : 2
  const candidates = []

  for (const [key, entry] of legalIndexEntriesFor(view)) {
    if (used.has(key)) continue
    const targetWordIds = entry.wordIds.filter((id) => targetable.has(id))
    if (targetWordIds.length < minimum || targetWordIds.length > 4) continue
    const targetSet = new Set(targetWordIds)
    const otherBoardWordIds = entry.wordIds.filter((id) => open.has(id) && !targetSet.has(id))
    // The LCSI strengths for this clue against its targets and its live
    // pulls (lcsi.js): floor, ceiling and rung margin ride with the candidate
    // so the packet can be ordered safer-first and the model can read them.
    const strength = localStatistics(entry.clue, targetWordIds, otherBoardWordIds)
    candidates.push({
      clue: entry.clue,
      targetWordIds,
      otherBoardWordIds,
      degree: entry.wordIds.length,
      strength,
    })
  }

  candidates.sort(
    (left, right) =>
      right.targetWordIds.length - left.targetWordIds.length ||
      compareBySafety(left.strength, right.strength) ||
      left.otherBoardWordIds.length - right.otherBoardWordIds.length ||
      left.degree - right.degree ||
      compare(left.clue, right.clue),
  )
  const boundedLimit = Number.isInteger(limit) ? Math.max(0, Math.min(limit, MAX_CLUE_CANDIDATES)) : MAX_CLUE_CANDIDATES
  return diversifyCandidates(candidates, boundedLimit)
}

export function buildClueAssociationContext(view) {
  if (!supportsAssociationBoard(view)) return ''
  const candidates = clueAssociationCandidates(view)
  const lines = [
    'PRIVATE ASSOCIATION INDEX — FIRST PATH:',
    'This replacement City 1 index is positive structural evidence: an indexed link is a candidate, not proof of safety; a missing link means unknown, never unrelated. Where the canonical LCSI index has judged a link, its strength is printed beside the word.',
    lcsiRulerLine(),
    'Start with the candidates below, but independently judge the semantic connection to every proposed target and perform the normal lookahead over EVERY live board word. Reject them all and use your normal reasoning if none is genuinely clear and safe.',
  ]
  if (candidates.length === 0) {
    lines.push('No legal indexed candidate currently reaches the required number of your targets; use the normal semantic path.')
  } else {
    for (const candidate of candidates) {
      lines.push(`- ${describeCandidate(view, candidate)}; corpus degree: ${candidate.degree}/100.`)
    }
  }
  return lines.join('\n')
}

/**
 * One candidate row, shared with the authored groups so the model reads both
 * the same way: targets with strengths, live pulls with strengths, and the
 * floor / ceiling / margin summary when there is anything to summarise.
 */
export function describeCandidate(view, candidate, { targetsLabel = 'proposed targets' } = {}) {
  const { strength } = candidate
  const targets = strength.targets.map((t) => labelWithScore(boardLabel(view, t.id), t)).join(', ')
  const others =
    strength.neutrals.length > 0
      ? strength.neutrals.map((n) => labelWithScore(boardLabel(view, n.id), n)).join(', ')
      : candidate.otherBoardWordIds === null
        ? 'not indexed'
        : 'none indexed'
  const summary = []
  if (strength.floor !== null) summary.push(`target floor ${formatScore(strength.floor)}`)
  if (strength.unscoredTargets > 0) summary.push(`${strength.unscoredTargets} target${strength.unscoredTargets === 1 ? '' : 's'} unscored`)
  if (strength.ceiling !== null) summary.push(`bystander ceiling ${formatScore(strength.ceiling)}`)
  if (strength.margin !== null) summary.push(`margin ${strength.margin >= 0 ? '+' : ''}${strength.margin} rung${Math.abs(strength.margin) === 1 ? '' : 's'}`)
  if (candidate.narrowedFrom) {
    summary.push(`NARROWED from ${candidate.narrowedFrom} — one of its words is already found; still a clue for the rest`)
  }
  const gloss = candidate.clueEnglish ? ` (${candidate.clueEnglish})` : ''
  return `“${candidate.clue}”${gloss} → ${targetsLabel}: ${targets}; other live board pulls: ${others}${summary.length ? `; ${summary.join(', ')}` : ''}`
}

/**
 * Every word the index links to a clue, or null for a clue it does not know.
 * Exact normalized lookup, like the guess lookup below; the authored clue
 * groups use it to say which live neutrals a bank clue also pulls.
 */
export function indexedWordIdsFor(clue) {
  const entry = INDEX.clues.get(normalize(clue))
  return entry ? entry.wordIds : null
}

/** Exact normalized lookup only; loose spelling/stemming would manufacture evidence. */
export function guessAssociationLookup(view) {
  if (!supportsAssociationBoard(view)) return null
  const key = normalize(view.currentClue.text)
  const entry = INDEX.clues.get(key)
  if (!entry) return Object.freeze({ matched: false, clue: view.currentClue.text, degree: 0, wordIds: [] })
  const guessable = new Set(aiGuessableIds(view))
  const scores = lcsiScoresFor(entry.clue)
  // Strongest first where the LCSI index has judged the link; unscored links
  // keep the index's own order after the scored ones. No role is read here:
  // a strength is a fact about two words.
  const linked = entry.wordIds.filter((id) => guessable.has(id))
  const scoreOf = (id) => scores?.get(id)?.score ?? null
  const ordered = [...linked].sort((a, b) => {
    const sa = scoreOf(a)
    const sb = scoreOf(b)
    if (sa === null && sb === null) return 0
    if (sa === null) return 1
    if (sb === null) return -1
    return sb - sa
  })
  return Object.freeze({
    matched: true,
    clue: entry.clue,
    degree: entry.wordIds.length,
    wordIds: Object.freeze(ordered),
    strengths: Object.freeze(ordered.map((id) => ({ id, score: scoreOf(id) }))),
  })
}

export function buildGuessAssociationContext(view) {
  const lookup = guessAssociationLookup(view)
  if (!lookup) return ''
  const lines = [
    'PRIVATE ASSOCIATION INDEX — FIRST PATH:',
    'This replacement City 1 index contains positive, unscored word associations only. It contains no key information. An absent link means unknown, never unrelated.',
  ]
  if (!lookup.matched) {
    lines.push(`There is no exact normalized entry for “${view.currentClue.text}”. Use the normal semantic ranking; do not draw a negative inference from the miss.`)
  } else if (lookup.wordIds.length === 0) {
    lines.push(`“${lookup.clue}” has corpus links, but none point to a currently guessable board word. Use normal semantic ranking; this does not rule any board word out.`)
  } else {
    lines.push(
      `Exact entry “${lookup.clue}” positively links to these currently guessable board words, strongest first: ${lookup.strengths
        .map((s) => labelWithScore(boardLabel(view, s.id), s))
        .join(', ')}. Corpus degree: ${lookup.degree}/100.`,
      lcsiRulerLine(),
      'Use these as the fast starting set, then compare them and every other visible word against the clue meaning and stated number before choosing the final ranking.',
    )
  }
  return lines.join('\n')
}
