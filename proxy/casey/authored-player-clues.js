import playerKeysRaw from '../data/authored-player-keys.da.1.json'
import { indexedWordIdsFor } from './association-index.js'
import { normalize } from './language.js'
import { lcsiScore } from './lcsi.js'
import { aiGuessableIds } from './projections.js'

/**
 * A player clue this authored board was made for is answered with certainty.
 *
 * The owner's call (2026-09-06): "if the player gives a clue that matches the
 * precomputed clues of the board generation from their key, then Casey should
 * also be able to guess that with 100% accuracy." The bank shipped no player
 * groups, so "a clue this board was made for" is decided here from the index
 * the bank was composed from and the player's key for the board: the clue is
 * an exact entry in the private association index, it links to TWO OR MORE
 * of the player's greens on this board, and it links to NOTHING ELSE on the
 * board. Then Casey names those greens, up to the number, and no model is
 * asked. Every guess is green on the player's key by construction, so the
 * accuracy is exactly what was asked for — a guess under the player's clue
 * is judged against the player's key and nothing else.
 *
 * Anything short of that — a clue the index does not know, one that reaches
 * a single green, one that also pulls a neutral, an inflected or English form
 * of a matching clue — falls through to the model as before. This is a
 * reward for finding a clue the board was built around, not a general
 * shortcut.
 *
 * THE FIREWALL, AND THE HOLE IN IT. The guess view carries no key of any
 * kind and the guess prompt is byte-identical under permutation of both
 * keys; that stays true. What this module adds is Worker-side knowledge of
 * the PLAYER's key for authored boards, read off `view.boardId`. It is
 * confined to this lookup, never reaches a prompt, and fails closed: a
 * board id whose words do not match the file exactly gets nothing. The
 * player-key file is Worker-private (proxy/data) and never bundled.
 */
const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)
const raw = readAsset(playerKeysRaw)

const BOARD_ID = /^bank_\d{3,}$/

function loadKeys(doc) {
  if (doc?.schemaVersion !== 1 || !Array.isArray(doc.boards) || doc.boards.length === 0) {
    throw new Error('the private authored player-key file has an unsupported schema')
  }
  const boards = new Map()
  for (const board of doc.boards) {
    if (
      typeof board?.id !== 'string' ||
      !BOARD_ID.test(board.id) ||
      !Array.isArray(board.wordIds) ||
      !Array.isArray(board.playerGreenIds) ||
      boards.has(board.id)
    ) {
      throw new Error('the private authored player-key file has a malformed board')
    }
    const wordIdSet = new Set(board.wordIds)
    const greenSet = new Set(board.playerGreenIds)
    if (wordIdSet.size !== board.wordIds.length || greenSet.size !== board.playerGreenIds.length) {
      throw new Error(`authored board ${board.id} repeats a word`)
    }
    for (const id of board.playerGreenIds) {
      if (!wordIdSet.has(id)) throw new Error(`authored board ${board.id} has a player green off the board`)
    }
    boards.set(board.id, Object.freeze({ id: board.id, wordIdSet, greenSet }))
  }
  return Object.freeze({ boards, info: Object.freeze({ boards: boards.size }) })
}

const KEYS = loadKeys(raw)
const MIN_TARGETS = 2

export const authoredPlayerKeysInfo = KEYS.info

/** The authored board a GUESS view is playing, or null — fail closed on any word mismatch. */
export function authoredPlayerBoardFor(view) {
  if (typeof view?.boardId !== 'string' || !BOARD_ID.test(view.boardId)) return null
  const board = KEYS.boards.get(view.boardId)
  if (!board) return null
  if (!Array.isArray(view.words) || view.words.length !== board.wordIdSet.size) return null
  for (const word of view.words) if (!board.wordIdSet.has(word.id)) return null
  return board
}

/**
 * The player's greens this clue was made to reach, or null when the clue is
 * not one the board was made for. Independent of reveals: this is the
 * question "is it a made-for clue", and the caller narrows to what can still
 * be guessed.
 */
export function madeForTargets(view) {
  const board = authoredPlayerBoardFor(view)
  if (!board) return null
  const linked = indexedWordIdsFor(view.currentClue.text)
  if (!linked) return null
  const targets = linked.filter((id) => board.greenSet.has(id))
  if (targets.length < MIN_TARGETS) return null
  const pullsSomethingElse = linked.some((id) => board.wordIdSet.has(id) && !board.greenSet.has(id))
  if (pullsSomethingElse) return null
  return targets
}

/**
 * Casey's guesses for a made-for clue, ready for the decision envelope, or
 * null to let the model answer. At most the clue's number, only words a
 * guess could still land on, in the index's own link order.
 */
export function authoredPlayerGuesses(view) {
  const targets = madeForTargets(view)
  if (!targets) return null
  const guessable = new Set(aiGuessableIds(view))
  // Strongest first by the canonical LCSI strength where it has judged the
  // link, so a clue of two on a three-word group names the two it reaches
  // best; unscored links keep the index's order after the scored ones.
  const scoreOf = (id) => lcsiScore(view.currentClue.text, id)?.score ?? null
  const live = targets
    .filter((id) => guessable.has(id))
    .sort((a, b) => {
      const sa = scoreOf(a)
      const sb = scoreOf(b)
      if (sa === null && sb === null) return 0
      if (sa === null) return 1
      if (sb === null) return -1
      return sb - sa
    })
  if (live.length === 0) return null
  const number = Number.isInteger(view.currentClue.number) ? view.currentClue.number : 1
  const clue = normalize(view.currentClue.text)
  return live.slice(0, Math.max(1, number)).map((wordId) => {
    const word = view.words.find((candidate) => candidate.id === wordId)
    const da = word ? word.da : wordId
    return {
      wordId,
      confidence: 1,
      // Read by the player during the reveal beat and in the round summary.
      // Explain this word's link only, without comparing the rest of the board.
      // It does not announce the lookup — the owner's rule
      // is that Casey still seems to be thinking (the phone holds the answer
      // for a model's worth of time), and a line saying "the board was built
      // around this" would give the mechanism away in the same breath.
      reasoning: `«${clue}» points me straight at ${da}.`,
    }
  })
}
