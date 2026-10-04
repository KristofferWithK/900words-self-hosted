import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import words from '../../src/data/words.da.json'
import archive from '../../src/data/city1-board-cycle.da.json'
import appendix from '../../src/data/city1-board-cycle-appendix.da.json'
import index from '../data/association-index.da.1.json'
import keys from '../data/authored-player-keys.da.1.json'
import { derivePlayerKeys, renderPlayerKeys } from '../../scripts/compose-player-clues.mjs'

// The archive and the boards appended after it: the Worker serves both.
const cycle = { ...archive, boards: [...archive.boards, ...appendix.boards] }
import {
  authoredPlayerBoardFor,
  authoredPlayerGuesses,
  authoredPlayerKeysInfo,
  madeForTargets,
} from './authored-player-clues.js'
import { normalize } from './language.js'
import { decide, parseDecisionRequest } from './orchestrator.js'

/**
 * A player clue an authored board was made for is answered with certainty
 * (owner, 2026-09-06). These pin what "made for" means, that every such
 * guess is green on the player's key, that the lookup follows the board's
 * reveals and the clue's number, and that it fails closed.
 */
const byId = new Map(words.map((word) => [word.id, word]))
const board1 = cycle.boards[0]

/** An indexed clue on this board reaching >= 2 player greens and nothing else, or null. */
function madeForClueOn(board) {
  const greens = new Set(board.playerGreenIds)
  const onBoard = new Set(board.wordIds)
  for (const [clue, indices] of index.clues) {
    const linked = indices.map((i) => index.wordIds[i])
    const targets = linked.filter((id) => greens.has(id))
    if (targets.length < 2) continue
    if (linked.some((id) => onBoard.has(id) && !greens.has(id))) continue
    return { clue, targets }
  }
  return null
}

/** An indexed clue that reaches exactly ONE player green and nothing else on this board. */
function singleGreenClueOn(board) {
  const greens = new Set(board.playerGreenIds)
  const onBoard = new Set(board.wordIds)
  for (const [clue, indices] of index.clues) {
    const linked = indices.map((i) => index.wordIds[i])
    if (linked.filter((id) => greens.has(id)).length !== 1) continue
    if (linked.some((id) => onBoard.has(id) && !greens.has(id))) continue
    return clue
  }
  return null
}

/** An indexed clue that reaches a player green AND a neutral on this board. */
function leakyClueOn(board) {
  const greens = new Set(board.playerGreenIds)
  const onBoard = new Set(board.wordIds)
  for (const [clue, indices] of index.clues) {
    const linked = indices.map((i) => index.wordIds[i])
    if (linked.filter((id) => greens.has(id)).length < 2) continue
    if (linked.some((id) => onBoard.has(id) && !greens.has(id))) return clue
  }
  return null
}

const guessView = (board, clue, { number = 2, reveals = {}, boardId = board.id } = {}) => ({
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: board.wordIds.map((id) => {
    const entry = byId.get(id)
    return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal: reveals[id] ?? { kind: 'hidden' } }
  }),
  currentClue: { text: clue, number },
  history: [],
  flagged: [],
  ...(boardId ? { boardId } : {}),
})

describe('the Worker copy of the player keys', () => {
  it('is exactly what the script derives from the shipped cycle', () => {
    expect(readFileSync('proxy/data/authored-player-keys.da.1.json', 'utf8')).toBe(
      renderPlayerKeys(derivePlayerKeys(cycle)),
    )
    expect(authoredPlayerKeysInfo.boards).toBe(cycle.boards.length)
    for (const [i, board] of keys.boards.entries()) {
      expect(board.id).toBe(cycle.boards[i].id)
      expect(board.playerGreenIds).toEqual(cycle.boards[i].playerGreenIds)
    }
  })

  it("carries the player's key and nothing of Casey's", () => {
    for (const board of keys.boards) {
      expect(Object.keys(board).sort()).toEqual(['id', 'playerGreenIds', 'wordIds'])
    }
  })
})

describe('what a made-for clue is', () => {
  const made = madeForClueOn(board1)

  it('exists on the first board', () => {
    expect(made).not.toBeNull()
  })

  it('reaches two or more of the player’s greens and nothing else on the board', () => {
    const targets = madeForTargets(guessView(board1, made.clue))
    expect(targets).toEqual(made.targets)
    for (const id of targets) expect(board1.playerGreenIds).toContain(id)
  })

  it('is matched by exact normalised form only', () => {
    expect(madeForTargets(guessView(board1, `  ${made.clue.toUpperCase()} `))).toEqual(made.targets)
    expect(madeForTargets(guessView(board1, `${made.clue}x`))).toBeNull()
  })

  it('is not a clue the index links to a neutral as well', () => {
    const leaky = leakyClueOn(board1)
    expect(leaky).not.toBeNull()
    expect(madeForTargets(guessView(board1, leaky))).toBeNull()
  })

  it('is not a clue that reaches only one green — a board is made around groups, not words', () => {
    const single = singleGreenClueOn(board1)
    expect(single).not.toBeNull()
    expect(madeForTargets(guessView(board1, single))).toBeNull()
    expect(authoredPlayerGuesses(guessView(board1, single))).toBeNull()
  })

  it('is not a clue the index does not know', () => {
    expect(madeForTargets(guessView(board1, 'zzzz-not-a-clue'))).toBeNull()
  })
})

describe('the guesses it yields', () => {
  const made = madeForClueOn(board1)

  it('are all green on the player’s key, in the clue’s number', () => {
    const guesses = authoredPlayerGuesses(guessView(board1, made.clue, { number: 2 }))
    expect(guesses).toHaveLength(Math.min(2, made.targets.length))
    for (const guess of guesses) {
      expect(board1.playerGreenIds).toContain(guess.wordId)
      expect(guess.confidence).toBe(1)
      expect(guess.reasoning).toContain(normalize(made.clue))
      expect(guess.reasoning.length).toBeLessThanOrEqual(500)
    }
  })

  it.each(['top-two', undefined])('explains only each authored choice in %s mode without model calls', async (candidateMode) => {
    const askModel = vi.fn(async () => { throw new Error('the model must not be asked') })
    const request = parseDecisionRequest({
      protocol: 1, operation: 'guess', view: guessView(board1, made.clue),
      ...(candidateMode ? { candidateMode } : {}),
    })
    const result = await decide(request, askModel, 'cluey')
    expect(result.decision.guesses.length).toBeGreaterThanOrEqual(2)
    for (const guess of result.decision.guesses) {
      expect(guess.reasoning).toContain(normalize(made.clue))
      expect(guess.reasoning).toContain(byId.get(guess.wordId).da)
      expect(guess.reasoning).not.toContain('nothing else on this board')
      expect(guess.reasoning.split(/\s+/).length).toBeLessThanOrEqual(12)
    }
    expect(result.report).toEqual({ arm: 'authored', refused: false })
    expect(askModel).not.toHaveBeenCalled()
  })

  it('skip a target already revealed, and give nothing once none is left', () => {
    const [first, ...rest] = made.targets
    const one = authoredPlayerGuesses(guessView(board1, made.clue, { reveals: { [first]: { kind: 'green' } } }))
    if (rest.length > 0) {
      expect(one.map((g) => g.wordId)).not.toContain(first)
    } else {
      expect(one).toBeNull()
    }
    const reveals = Object.fromEntries(made.targets.map((id) => [id, { kind: 'green' }]))
    expect(authoredPlayerGuesses(guessView(board1, made.clue, { reveals }))).toBeNull()
  })

  it('never name a word burned against the player', () => {
    const [first] = made.targets
    const guesses = authoredPlayerGuesses(
      guessView(board1, made.clue, { number: 4, reveals: { [first]: { kind: 'bystander', against: ['player'] } } }),
    )
    if (guesses) expect(guesses.map((g) => g.wordId)).not.toContain(first)
  })
})

describe('it fails closed', () => {
  const made = madeForClueOn(board1)

  it('with no board id, which is every ordinary deal', () => {
    expect(authoredPlayerBoardFor(guessView(board1, made.clue, { boardId: null }))).toBeNull()
    expect(authoredPlayerGuesses(guessView(board1, made.clue, { boardId: null }))).toBeNull()
  })

  it('when the id names a board the view is not', () => {
    const other = cycle.boards[1]
    expect(authoredPlayerBoardFor(guessView(other, made.clue, { boardId: board1.id }))).toBeNull()
  })

  it('for an id the file does not hold', () => {
    expect(authoredPlayerBoardFor(guessView(board1, made.clue, { boardId: 'bank_999999' }))).toBeNull()
  })
})

describe('on the wire and in the decision', () => {
  const made = madeForClueOn(board1)

  it('the guess view accepts an authored board id and carries it through', () => {
    const request = parseDecisionRequest({ protocol: 1, operation: 'guess', view: guessView(board1, made.clue) })
    expect(request.view.boardId).toBe(board1.id)
    expect(() =>
      parseDecisionRequest({ protocol: 1, operation: 'guess', view: guessView(board1, made.clue, { boardId: 'x' }) }),
    ).toThrow(/view\.boardId/)
  })

  it('a made-for clue is answered without asking the model, and the ledger says so', async () => {
    const askModel = vi.fn(async () => {
      throw new Error('the model must not be asked')
    })
    const request = parseDecisionRequest({ protocol: 1, operation: 'guess', view: guessView(board1, made.clue) })
    const result = await decide(request, askModel, 'cluey')
    expect(askModel).not.toHaveBeenCalled()
    expect(result.report).toEqual({ arm: 'authored', refused: false })
    for (const guess of result.decision.guesses) expect(board1.playerGreenIds).toContain(guess.wordId)
  })

  it('keeps the complete finite authored plan under an assisted request', async () => {
    const askModel = vi.fn(async () => { throw new Error('the model must not be asked') })
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: guessView(board1, made.clue, { number: 4 }),
      candidateMode: 'top-two',
    })
    const result = await decide(request, askModel, 'cluey')
    expect(askModel).not.toHaveBeenCalled()
    expect(result.decision.guesses).toEqual(authoredPlayerGuesses(
      guessView(board1, made.clue, { number: 4 }),
    ))
    expect(result.report).toEqual({ arm: 'authored', refused: false })
  })

  it('keeps clue one at its original guaranteed first green', async () => {
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: guessView(board1, made.clue, { number: 1 }),
      candidateMode: 'top-two',
    })
    const result = await decide(request, vi.fn(), 'cluey')
    expect(result.decision.guesses).toHaveLength(1)
    expect(board1.playerGreenIds).toContain(result.decision.guesses[0].wordId)
  })

  it('any other clue still goes to the model', async () => {
    const [target] = board1.playerGreenIds
    const askModel = vi.fn(async () =>
      JSON.stringify({ guesses: [{ wordId: target, confidence: 0.8, reasoning: 'a guess' }] }),
    )
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: guessView(board1, 'zzzz-not-a-clue'),
    })
    const result = await decide(request, askModel, 'cluey')
    expect(askModel).toHaveBeenCalledOnce()
    expect(result.report).toEqual({ arm: 'cluey', refused: false })
  })
})
