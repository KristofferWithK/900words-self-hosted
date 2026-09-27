import authoredCluesRaw from '../data/authored-clues.da.1.json'
import germanCluesRaw from '../data/authored-clues.de.1.json'
import { languageForView } from './languages.js'
import { describeCandidate, indexedWordIdsFor } from './association-index.js'
import { normalize } from './language.js'
import { compareBySafety, formatScore, lcsiRulerLine, localStatistics } from './lcsi.js'
import { aiTargetableIds, isOpenFor } from './projections.js'

/**
 * Casey's own authored clue groups for the City 1 board bank, and the paths
 * they make over what he still holds.
 *
 * The bank was built with a set of pre-verified clue groups per board — each
 * a Danish clue and the words on CASEY'S key it reaches — and until this
 * module the app shipped them and never handed them to him: the Worker did not
 * know which authored board a round was, and the clue view carried the words
 * and his key only. The owner's correction (2026-09-06): Casey has the clues
 * and the path options for his own key. So the view now names the authored
 * board (`view.boardId`, e.g. `bank_001`), and this module turns the groups
 * into what is still live on the board in front of him — the groups whose
 * targets are still hidden on his key, minus any clue already given — and one
 * covering path over them.
 *
 * Advisory, like the association index and the evaluator: the model still
 * judges the live board (a neutral revealed under the player's clue, the other
 * side's pulls) and the orchestrator still validates and vetoes. This is the
 * "first path", not the answer sheet.
 *
 * THE FIREWALL HOLDS BY CONSTRUCTION. The private file carries the board's
 * words, Casey's greens and his clue groups, and nothing about the player's
 * key — so a board id cannot be turned into the other key on this side of the
 * boundary. And a view that names a board the file knows but shows a
 * different key gets nothing: the lookup fails closed on any mismatch, rather
 * than advising the wrong board.
 */
const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)
const raw = readAsset(authoredCluesRaw)

const BOARD_ID = /^bank_\d{3,}$/

function loadBank(doc) {
  if (doc?.schemaVersion !== 1 || !Array.isArray(doc.boards) || doc.boards.length === 0) {
    throw new Error('the private authored clue bank has an unsupported schema')
  }
  const boards = new Map()
  for (const board of doc.boards) {
    if (
      typeof board?.id !== 'string' ||
      !BOARD_ID.test(board.id) ||
      !Array.isArray(board.wordIds) ||
      !Array.isArray(board.aiGreenIds) ||
      !Array.isArray(board.caseyClueGroups) ||
      boards.has(board.id)
    ) {
      throw new Error('the private authored clue bank has a malformed board')
    }
    // A key that names a word off the board, or a group that targets a
    // non-green, is the bank being wrong about itself. Refuse at load, where
    // a deploy fails, rather than at play, where a round would.
    const wordIdSet = new Set(board.wordIds)
    const greenSet = new Set(board.aiGreenIds)
    if (wordIdSet.size !== board.wordIds.length || greenSet.size !== board.aiGreenIds.length) {
      throw new Error(`authored board ${board.id} repeats a word`)
    }
    for (const id of board.aiGreenIds) {
      if (!wordIdSet.has(id)) throw new Error(`authored board ${board.id} has a green off the board`)
    }
    const groups = board.caseyClueGroups.map((group) => {
      if (
        typeof group?.clue !== 'string' ||
        group.clue.trim() === '' ||
        !Array.isArray(group.targetWordIds) ||
        group.targetWordIds.length === 0 ||
        group.targetWordIds.some((id) => !greenSet.has(id))
      ) {
        throw new Error(`authored board ${board.id} has a malformed clue group`)
      }
      return Object.freeze({
        clue: group.clue,
        clueEnglish: typeof group.clueEnglish === 'string' ? group.clueEnglish : '',
        targetWordIds: Object.freeze([...new Set(group.targetWordIds)]),
      })
    })
    boards.set(
      board.id,
      Object.freeze({ id: board.id, wordIdSet, greenSet, groups: Object.freeze(groups) }),
    )
  }
  return Object.freeze({ boards, info: Object.freeze({ boards: boards.size, note: doc.note ?? '' }) })
}

const BANK = loadBank(raw)
let germanBank
const bankFor = (view) => languageForView(view).code === 'de'
  ? (germanBank ??= loadBank(readAsset(germanCluesRaw)))
  : BANK
const MAX_AUTHORED_CANDIDATES = 12

export const authoredClueBankInfo = BANK.info

/** The exact shape a view's board id must take; the contract uses the same test. */
export const isAuthoredBoardId = (value) => typeof value === 'string' && BOARD_ID.test(value)

/**
 * The authored board this view is playing, or null. Null is the ordinary
 * answer — every board outside the City 1 cycle — and also the fail-closed
 * one: a board the bank knows whose words or key on the view do not match it
 * exactly gets no advice at all rather than another board's.
 */
export function authoredBoardFor(view) {
  if (!isAuthoredBoardId(view?.boardId)) return null
  const board = bankFor(view).boards.get(view.boardId)
  if (!board) return null
  if (view.words.length !== board.wordIdSet.size) return null
  for (const word of view.words) {
    if (!board.wordIdSet.has(word.id)) return null
    if ((word.roleOnMyKey === 'green') !== board.greenSet.has(word.id)) return null
  }
  return board
}

const boardLabel = (view, id) => {
  const word = view.words.find((candidate) => candidate.id === id)
  return word ? `${id} (${word.da})` : id
}

/**
 * The groups still worth giving on the board as it stands: their targets
 * narrowed to what is still hidden on Casey's key, at least two of them (one
 * only when one green is left), the clue still legal against the board and
 * not already spent this round. Each carries the live neutrals the
 * association index links to its clue — the bank shipped no trap data of its
 * own, and the index knows every bank clue (measured: 1135 of 1135, 706 of
 * them pulling at least one neutral on their own board) — so the model is
 * told what else the clue reaches before it commits. "More of my words
 * first", then the safer of equals, then bank order, which is the authoring
 * rank.
 */
export function authoredClueCandidates(view, limit = MAX_AUTHORED_CANDIDATES) {
  const board = authoredBoardFor(view)
  if (!board) return []
  const targetable = new Set(aiTargetableIds(view))
  const minimum = targetable.size === 1 ? 1 : 2
  const used = new Set(view.history.map((entry) => normalize(entry.text)))
  // A pull is a NEUTRAL on his key that a guess could still land on: hidden,
  // or burned against the player only. One already burned against Casey is
  // no longer guessable under his clue, so it cannot cost him a turn — and
  // his own greens outside the group are not traps at all: under his clue a
  // guess that lands on one scores, so they are left out rather than listed
  // as risk.
  const open = new Set(
    view.words
      .filter((word) => word.roleOnMyKey === 'bystander' && isOpenFor(word.reveal, 'ai'))
      .map((word) => word.id),
  )
  const legalityBoard = view.words
    .filter((word) => word.reveal?.kind !== 'green')
    .map(({ da, en, pos }) => ({ da, en, pos }))
  const seen = new Set()
  const candidates = []
  board.groups.forEach((group, rank) => {
    const key = normalize(group.clue)
    if (used.has(key)) return
    const targetWordIds = group.targetWordIds.filter((id) => targetable.has(id))
    if (targetWordIds.length < minimum) return
    const signature = `${key}|${[...targetWordIds].sort().join(',')}`
    if (seen.has(signature)) return
    const language = languageForView(view)
    if (!language.checkClueLegality(group.clue, legalityBoard).legal) return
    seen.add(signature)
    const indexed = language.code === 'de' ? null : indexedWordIdsFor(group.clue)
    const targetSet = new Set(targetWordIds)
    const otherBoardWordIds = indexed
      ? indexed.filter((id) => open.has(id) && !targetSet.has(id))
      : null
    // The canonical LCSI strengths (lcsi.js): every authored group's targets
    // are scored (measured: 3,116 of 3,116 pairs), the pulls where the index
    // judged them. Floor, ceiling and rung margin order the rows safer-first
    // and are printed for the model.
    const strength = language.code === 'de'
      ? {
          targets: targetWordIds.map((id) => ({ id, score: null, uncertainty: null })),
          neutrals: [],
          floor: null,
          ceiling: null,
          margin: null,
          unscoredTargets: targetWordIds.length,
        }
      : localStatistics(group.clue, targetWordIds, otherBoardWordIds ?? [])
    // A group that play has narrowed — one of its words already found — is
    // marked, because that is the owner's first named reason for the model
    // to leave the path: a triple that lost a word may no longer be the best
    // cover for what is still held.
    const narrowedFrom = group.targetWordIds.length > targetWordIds.length ? group.targetWordIds.length : null
    candidates.push({ clue: group.clue, clueEnglish: group.clueEnglish, targetWordIds, otherBoardWordIds, strength, narrowedFrom, rank })
  })
  candidates.sort(
    (left, right) =>
      right.targetWordIds.length - left.targetWordIds.length ||
      compareBySafety(left.strength, right.strength) ||
      (left.otherBoardWordIds?.length ?? 0) - (right.otherBoardWordIds?.length ?? 0) ||
      left.rank - right.rank,
  )
  // The bank lists «kvart» → hel, halv, klokke and «kvart» → hel, halv as two
  // groups. Once the bigger is live the smaller says nothing the model could
  // use, so a clue whose targets are a subset of an earlier row's is dropped.
  const kept = []
  for (const candidate of candidates) {
    const key = normalize(candidate.clue)
    const covered = kept.some(
      (other) =>
        normalize(other.clue) === key &&
        candidate.targetWordIds.every((id) => other.targetWordIds.includes(id)),
    )
    if (!covered) kept.push(candidate)
  }
  const bounded = Number.isInteger(limit) ? Math.max(0, Math.min(limit, MAX_AUTHORED_CANDIDATES)) : MAX_AUTHORED_CANDIDATES
  return kept.slice(0, bounded).map(({ rank, ...candidate }) => candidate)
}

/**
 * One path over what Casey still holds: greedily the group that covers the
 * most still-uncovered targets, again until no group reaches two of what is
 * left (or the last one). What it leaves is named, so the model knows which
 * words the bank has no group for and must reach on its own.
 */
export function authoredPath(view, candidates = authoredClueCandidates(view, MAX_AUTHORED_CANDIDATES)) {
  const remaining = new Set(aiTargetableIds(view))
  const steps = []
  const usedClues = new Set()
  while (remaining.size > 0) {
    const minimum = remaining.size === 1 ? 1 : 2
    let best = null
    let bestTargets = []
    for (const candidate of candidates) {
      if (usedClues.has(normalize(candidate.clue))) continue
      const targets = candidate.targetWordIds.filter((id) => remaining.has(id))
      if (targets.length < minimum || targets.length <= bestTargets.length) continue
      best = candidate
      bestTargets = targets
    }
    if (!best) break
    steps.push({ clue: best.clue, targetWordIds: bestTargets, floor: best.strength?.floor ?? null })
    usedClues.add(normalize(best.clue))
    for (const id of bestTargets) remaining.delete(id)
  }
  return { steps, uncovered: [...remaining] }
}

/**
 * The round's OPENING clue, decided before the round starts.
 *
 * The owner's correction (2026-09-17): the first clue of a round should have
 * NO thinking at all, not even the genuine model trip — "she should already
 * have the first clue from the precomputed list". On an authored board whose
 * view carries no clue history yet, the bank's first path step IS that clue:
 * the board was authored with pre-verified groups for Casey's key, so the
 * opening is known before the round starts. The orchestrator returns it
 * before any model call; the evaluator advises from the second clue onward.
 *
 * Fails closed like every other bank read: a view that is not an authored
 * board (or whose words/key do not match it) gets null, and any view with
 * history — the opening has been played — gets null.
 */
export function authoredFirstClue(view, path = authoredPath(view)) {
  if (view?.kind !== 'ai-clue') return null
  if (!Array.isArray(view.history) || view.history.length > 0) return null
  if (!authoredBoardFor(view)) return null
  const step = path.steps[0]
  if (!step) return null
  const clueEnglish =
    authoredClueCandidates(view).find((candidate) => normalize(candidate.clue) === normalize(step.clue))
      ?.clueEnglish ?? ''
  return { clue: step.clue, clueEnglish, targetWordIds: [...step.targetWordIds] }
}

/** The prompt section. Empty for every board that is not an authored one. */
export function buildAuthoredClueContext(view) {
  if (!authoredBoardFor(view)) return ''
  const german = languageForView(view).code === 'de'
  const candidates = authoredClueCandidates(view)
  const lines = [
    'AUTHORED CLUE GROUPS FOR THIS EXACT BOARD — YOUR KEY ONLY:',
    german
      ? 'This board was built with clue groups verified for YOUR green words. Each line below is one such group, narrowed to the targets you can still name, still legal and not yet given. Judge its strength and every other live word yourself; no numerical strengths or neutral pulls were measured for German.'
      : 'This board was built with clue groups verified for YOUR green words. Each line below is one such group, narrowed to the targets you can still name, still legal, not yet given, with the other live board words the association index links to the same clue — the neutrals your lookahead must score first — and the canonical LCSI strength beside every judged word.',
    'THESE ARE YOUR FIRST CHOICE. Take the next group on the path below unless one of two things is true: a group has been NARROWED by play — one of its words is already found — AND another group or a clue of your own now covers more of what you still hold; or you see a clue that is clearly STRONGER and SAFER for the same words than the one listed. A narrowed group is usually still a strong clue for the pair it still reaches — its target floor says how strong — so narrowing alone is not a reason to leave it. Only for one of those two reasons write your own clue, and say in your rationale which it was. A merely different clue is not a reason.',
    german
      ? 'These German groups were reviewed during the board transfer. German has no LCSI scores or association index: unknown neutral pulls are not evidence of safety. Check every live word yourself.'
      : lcsiRulerLine(),
  ]
  if (candidates.length === 0) {
    lines.push('No authored group still reaches enough of your remaining words; use the association index and your normal reasoning.')
    return lines.join('\n')
  }
  for (const candidate of candidates) {
    // The same row shape the index rows use, so the model reads both the same
    // way: named neutrals are the lookahead's starting point, "none indexed"
    // is positive evidence, "not indexed" is no evidence at all, and every
    // judged word carries its strength.
    lines.push(`- ${describeCandidate(view, candidate, { targetsLabel: 'targets' })}`)
  }
  const path = authoredPath(view, candidates)
  if (path.steps.length > 0) {
    const route = path.steps
      .map((step) => {
        const floor = step.floor === null ? '' : `, floor ${formatScore(step.floor)}`
        return `“${step.clue}” (${step.targetWordIds.map((id) => boardLabel(view, id)).join(', ')}${floor})`
      })
      .join(' → ')
    lines.push(
      path.uncovered.length === 0
        ? `A path that covers everything you still hold, in ${path.steps.length} clue${path.steps.length === 1 ? '' : 's'}: ${route}.`
        : `A path over what you still hold: ${route}; it leaves ${path.uncovered.map((id) => boardLabel(view, id)).join(', ')} for a clue of your own.`,
    )
  }
  return lines.join('\n')
}
