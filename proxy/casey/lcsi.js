import lcsiRaw from '../data/lcsi.da.1.json'
import { normalize } from './language.js'

/**
 * Casey's private strengths: the canonical City 1 LCSI-v4 index, compact.
 *
 * Every relationship is one directed `clue → word`, placed on a fixed 0–100
 * ruler by blind comparison against anchors (gpt-5.6-sol, three fresh votes a
 * comparison; LCSI-INDEXING-PROTOCOL.md). 27,742 of them, all edges of the
 * association index: 3,871 of its 7,595 clues were indexed, and 27,742 of
 * the 41,705 edges those clues carry were judged (837 clues completely) — so
 * this and the association index describe ONE graph, and this is the part of
 * it with numbers. Derived by scripts/generate-lcsi-index.mjs from the 88 MB merged
 * index on the research branch (PR #181); Casey had never seen it until the
 * owner asked why (2026-09-06).
 *
 * LOADED LAZILY, ON FIRST USE, AND KEPT FLAT. The first version built 27,742
 * frozen objects into nested Maps at import, which put about a second of
 * start-up work (measured in the web container) beside the association
 * index's own — and a Worker whose start-up exceeds Cloudflare's CPU limit is
 * killed with an error page that carries no CORS headers, which the phone
 * reports as "the connection dropped, or the server refused the browser
 * request (CORS)". That is what the owner saw within the hour of the deploy.
 * So the file is parsed on the first lookup, inside a request's CPU budget
 * like the matrix and book shards (`loadEvaluator`), and a clue's scores are
 * two parallel arrays scanned with indexOf (at most 74 entries) rather than
 * a Map of objects per row.
 *
 * How to read a number, and how the prompt is told to: an LCSI score is a
 * RANK on the ruler, not a probability that a player will guess the word
 * (docs/lcsi-judge-independence.md — three judges agree on ordering, not on
 * the exact rung, so a score is over-precise by about a rung). 90 is sko →
 * fod, 50 is by → hus, 10 is tæppe → ur. A clue → word with no entry is
 * UNKNOWN, never weak. Within this file every score is by one judge on one
 * anchor bank, so scores here may be compared with each other.
 *
 * The board-creation handoff's three local statistics are what Casey is
 * handed per candidate clue: the target FLOOR (weakest intended target), the
 * bystander CEILING (strongest scored neutral), and the rung MARGIN between
 * them. The handoff's zones: margin ≤ 0 is a neutral indexed as strongly as a
 * target; 1 is direct overlap; 2 is probable separation; ≥ 3 is strong
 * separation under the measured repeat forecast (within two rungs 97.4%).
 *
 * No key information: a strength is a fact about two words, and this module
 * never reads a role. The file stays Worker-private (SEC3 gate) because it is
 * authored corpus material, not because it could leak a key.
 */
const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)

/** The LCSI-v4 ladder; every score in the canonical index is one of these. Mirrors the generator. */
export const LCSI_LADDER = Object.freeze([5, 10, 15, 20, 26.7, 33.3, 40, 46.7, 53.3, 60, 66.7, 73.3, 80, 85, 90, 95])
const LADDER_RUNG = new Map(LCSI_LADDER.map((score, i) => [score, i]))
const DEFAULT_ANCHORS = Object.freeze({ 10: 'tæppe → ur', 50: 'by → hus', 90: 'sko → fod' })

function loadLcsi(doc) {
  if (
    doc?.protocol !== 1 ||
    doc.lang !== 'da' ||
    doc.ruler !== 'lcsi-v4' ||
    !Array.isArray(doc.wordIds) ||
    !Array.isArray(doc.clues) ||
    !Array.isArray(doc.ladder) ||
    !Array.isArray(doc.uncertainty)
  ) {
    throw new Error('the private LCSI index has an unsupported schema')
  }
  if (doc.ladder.length !== LCSI_LADDER.length || doc.ladder.some((s, i) => s !== LCSI_LADDER[i])) {
    throw new Error('the private LCSI index ladder is not the LCSI-v4 ladder')
  }
  const uncertainty = doc.uncertainty
  const wordIds = doc.wordIds
  // One entry per clue: parallel arrays, no per-row objects. `ids` are the
  // roster's word ids, `scores` the ladder values, `classes` indexes into
  // `uncertainty`. Rows come sorted by word index from the generator.
  const clues = new Map()
  let rows = 0
  for (const [clue, entries] of doc.clues) {
    const key = normalize(clue)
    if (clues.has(key)) throw new Error('the private LCSI index repeats a clue')
    const n = entries.length
    const ids = new Array(n)
    const scores = new Array(n)
    const classes = new Array(n)
    for (let i = 0; i < n; i++) {
      const [w, score, u] = entries[i]
      if (!Number.isInteger(w) || w < 0 || w >= wordIds.length || !LADDER_RUNG.has(score) || !uncertainty[u]) {
        throw new Error('the private LCSI index has a malformed row')
      }
      ids[i] = wordIds[w]
      scores[i] = score
      classes[i] = u
    }
    rows += n
    clues.set(key, { clue, ids, scores, classes })
  }
  if (rows !== doc.metrics?.rowCount || clues.size !== doc.metrics?.clueCount) {
    throw new Error('the private LCSI index metrics do not match its rows')
  }
  return {
    clues,
    uncertainty,
    anchors: doc.anchors ?? DEFAULT_ANCHORS,
    info: Object.freeze({
      ...doc.metrics,
      model: doc.model,
      anchorBank: doc.anchorBank,
      scope: doc.scope,
      mergedIndexSha256: doc.source?.mergedIndexSha256,
      associationIndexSha256: doc.source?.associationIndexSha256,
    }),
  }
}

let loaded = null
/** The index, parsed on first use rather than at Worker start-up. */
function index() {
  if (!loaded) loaded = loadLcsi(readAsset(lcsiRaw))
  return loaded
}

/** Provenance and counts; forces the load, so tests and diagnostics read the real thing. */
export const lcsiIndexInfo = () => index().info

/** The rung (0-based position on the ladder) of a score, or null off-ladder. */
export function rungOf(score) {
  if (typeof score !== 'number') return null
  const exact = LADDER_RUNG.get(score)
  if (exact !== undefined) return exact
  let best = null
  let bestDistance = Infinity
  LCSI_LADDER.forEach((value, i) => {
    const d = Math.abs(value - score)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}

/** `{score, uncertainty}` for one clue → word, or null when the index has no entry. */
export function lcsiScore(clue, wordId) {
  const entry = index().clues.get(normalize(clue))
  if (!entry) return null
  const i = entry.ids.indexOf(wordId)
  if (i < 0) return null
  return { score: entry.scores[i], uncertainty: index().uncertainty[entry.classes[i]] }
}

/**
 * Every scored word for a clue as a Map wordId → {score, uncertainty}, or
 * null for an unindexed clue. Built on demand for the one clue asked about.
 */
export function lcsiScoresFor(clue) {
  const entry = index().clues.get(normalize(clue))
  if (!entry) return null
  const u = index().uncertainty
  const scores = new Map()
  for (let i = 0; i < entry.ids.length; i++) {
    scores.set(entry.ids[i], { score: entry.scores[i], uncertainty: u[entry.classes[i]] })
  }
  return scores
}

/** One decimal at most, the way the ladder is written: 66.7, 60, 46.7. */
export const formatScore = (score) => (Number.isInteger(score) ? String(score) : score.toFixed(1))

/**
 * The three local statistics for a clue against a set of intended targets and
 * a set of live neutrals: weakest target, strongest scored neutral, and the
 * rung margin between them. Targets without a score do not lower the floor
 * (unknown is not weak) but are reported, so the model knows the floor is
 * over fewer words than the clue names.
 */
export function localStatistics(clue, targetWordIds, neutralWordIds) {
  const entry = index().clues.get(normalize(clue)) ?? null
  const u = index().uncertainty
  const stat = (id) => {
    const i = entry ? entry.ids.indexOf(id) : -1
    return i < 0
      ? { id, score: null, uncertainty: null }
      : { id, score: entry.scores[i], uncertainty: u[entry.classes[i]] }
  }
  const targets = targetWordIds.map(stat)
  const neutrals = neutralWordIds.map(stat)
  const scoredTargets = targets.filter((t) => t.score !== null)
  const scoredNeutrals = neutrals.filter((n) => n.score !== null)
  const floor = scoredTargets.length ? Math.min(...scoredTargets.map((t) => t.score)) : null
  const ceiling = scoredNeutrals.length ? Math.max(...scoredNeutrals.map((n) => n.score)) : null
  const margin = floor !== null && ceiling !== null ? rungOf(floor) - rungOf(ceiling) : null
  return {
    targets,
    neutrals,
    floor,
    ceiling,
    margin,
    unscoredTargets: targets.length - scoredTargets.length,
  }
}

/**
 * Sort key for "safer first" among candidates of equal reach: a clue whose
 * neutrals are all unscored or absent ranks above any measured margin (the
 * index found nothing to pull), then margins descend, then the floor.
 * Returns a negative number when `a` should come before `b`.
 */
export function compareBySafety(a, b) {
  const classOf = (s) => (s.ceiling === null ? Infinity : s.margin)
  const ca = classOf(a)
  const cb = classOf(b)
  if (ca !== cb) return cb - ca
  return (b.floor ?? -1) - (a.floor ?? -1)
}

/** "uge 66.7" / "uge (unscored)" for one word on a clue, using the board's label. */
export function labelWithScore(label, stat) {
  return stat.score === null ? `${label} (unscored)` : `${label} ${formatScore(stat.score)}`
}

/** The one-line reading guide the prompt carries once per section. */
export function lcsiRulerLine() {
  const a = index().anchors
  return (
    `Strengths are LCSI ranks on a fixed 0–100 ruler — ${a[90] ?? DEFAULT_ANCHORS[90]} is 90, ${a[50] ?? DEFAULT_ANCHORS[50]} is 50, ${a[10] ?? DEFAULT_ANCHORS[10]} is 10 — judged by comparison, so a number is a rank, not a probability that your partner names the word, and is reliable to about one rung. ` +
    'A word with no number is UNKNOWN to the index, never weak. Margins are in rungs of that ladder: 0 or less means a neutral is indexed as strongly as your weakest target; 1 is direct overlap; 2 is probable separation; 3 or more is strong separation. ' +
    'All of this is private to you: your partner never sees it, so none of it — no number, no term — belongs in a rationale or reasoning.'
  )
}
