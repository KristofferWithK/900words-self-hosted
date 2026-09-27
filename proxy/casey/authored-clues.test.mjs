import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import words from '../../src/data/words.da.json'
import bank from '../data/authored-clues.da.1.json'
import {
  authoredBoardFor,
  authoredClueBankInfo,
  authoredClueCandidates,
  authoredFirstClue,
  authoredPath,
  buildAuthoredClueContext,
} from './authored-clues.js'
import { buildCluePrompt } from './prompts.js'
import { DANISH_LANGUAGE, normalize } from './language.js'
import { parseDecisionRequest } from './orchestrator.js'

/**
 * Casey has the bank's clue groups and the paths over his own key
 * (owner, 2026-09-06). These pin what he is handed on an authored board, that
 * the advice follows the board as it is revealed, and that it fails closed —
 * a board id is never enough on its own.
 */
const byId = new Map(words.map((word) => [word.id, word]))
const board1 = bank.boards[0]

/** The clue view the browser sends for an authored board, reveals by id. */
const viewFor = (board, { reveals = {}, history = [], clueLanguage = 'target', boardId = board.id } = {}) => ({
  kind: 'ai-clue',
  clueLanguage,
  turnsLeft: 8,
  words: board.wordIds.map((id) => {
    const entry = byId.get(id)
    if (!entry) throw new Error(`fixture word ${id} is not in the dataset`)
    return {
      id,
      da: entry.da,
      en: entry.en,
      pos: entry.pos,
      reveal: reveals[id] ?? { kind: 'hidden' },
      roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander',
    }
  }),
  history,
  flagged: [],
  ...(boardId ? { boardId } : {}),
})

describe('the Worker copy of the bank', () => {
  it('is the same clue groups the client pins, byte for byte', () => {
    const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
    expect(sha('proxy/data/authored-clues.da.1.json')).toBe(sha('src/data/city1-playtest-clues.da.json'))
    expect(authoredClueBankInfo.boards).toBe(bank.boards.length)
  })

  it("carries Casey's greens and groups and nothing about the player's key", () => {
    for (const board of bank.boards) {
      expect(Object.keys(board).sort()).toEqual(['aiGreenIds', 'caseyClueGroups', 'id', 'wordIds'])
    }
  })
})

describe('which board a view is', () => {
  it('finds the authored board a matching view names', () => {
    expect(authoredBoardFor(viewFor(board1))?.id).toBe(board1.id)
  })

  it('answers null for a view with no board id, which is every ordinary deal', () => {
    expect(authoredBoardFor(viewFor(board1, { boardId: null }))).toBeNull()
  })

  it('fails closed when the id names a board the view is not', () => {
    // The words of board 2 under the id of board 1: a client that got its
    // bookkeeping wrong must get no advice, not board 1's.
    const other = bank.boards[1]
    expect(authoredBoardFor(viewFor(other, { boardId: board1.id }))).toBeNull()
  })

  it("fails closed when the key on the view is not the bank's key for that board", () => {
    const view = viewFor(board1)
    const green = view.words.find((word) => word.roleOnMyKey === 'green')
    const neutral = view.words.find((word) => word.roleOnMyKey === 'bystander')
    green.roleOnMyKey = 'bystander'
    neutral.roleOnMyKey = 'green'
    expect(authoredBoardFor(view)).toBeNull()
    expect(authoredClueCandidates(view)).toEqual([])
    expect(buildAuthoredClueContext(view)).toBe('')
  })

  it('answers null for an id the bank does not hold', () => {
    expect(authoredBoardFor(viewFor(board1, { boardId: 'bank_999999' }))).toBeNull()
  })
})

describe('the live clue groups', () => {
  it('hands over every whole group on a fresh board, biggest first', () => {
    const candidates = authoredClueCandidates(viewFor(board1))
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(candidate.targetWordIds.length).toBeGreaterThanOrEqual(2)
      for (const id of candidate.targetWordIds) expect(board1.aiGreenIds).toContain(id)
    }
    const sizes = candidates.map((candidate) => candidate.targetWordIds.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('narrows a group to what is still hidden, and drops it under two', () => {
    // «forrige» → uge, sidste, måned on board 1. Reveal uge as green and the
    // group is two; reveal sidste too and it is gone.
    const group = board1.caseyClueGroups.find((g) => g.targetWordIds.length === 3)
    const [first, second] = group.targetWordIds
    const one = authoredClueCandidates(viewFor(board1, { reveals: { [first]: { kind: 'green' } } }))
    const narrowed = one.find((c) => c.clue === group.clue && c.targetWordIds.length === 2)
    expect(narrowed).toBeDefined()
    expect(narrowed.targetWordIds).not.toContain(first)
    const two = authoredClueCandidates(
      viewFor(board1, { reveals: { [first]: { kind: 'green' }, [second]: { kind: 'green' } } }),
    )
    expect(two.find((c) => c.clue === group.clue && c.targetWordIds.length < 2)).toBeUndefined()
  })

  /**
   * The bank shipped no trap data, so the neutrals a bank clue also pulls
   * come from the association index: «tid» on board 1 reaches uge and klokke
   * and, on the same board, komme, synes, svær, mulig and menneske.
   */
  it('names the live neutrals the index links to each clue', () => {
    const tid = authoredClueCandidates(viewFor(board1)).find((c) => c.clue === 'tid')
    expect(tid).toBeDefined()
    expect(tid.otherBoardWordIds).toContain('da:komme')
    // Neutrals only: his own greens outside the group score under his clue,
    // so they are not risk and are not listed (the index links «tid» to
    // sidste and måned too, both green on his key here).
    expect(tid.otherBoardWordIds).not.toContain('da:sidste')
    for (const id of tid.otherBoardWordIds) {
      expect(board1.wordIds).toContain(id)
      expect(board1.aiGreenIds).not.toContain(id)
    }
    for (const candidate of authoredClueCandidates(viewFor(board1))) {
      expect(candidate.otherBoardWordIds === null || Array.isArray(candidate.otherBoardWordIds)).toBe(true)
    }
  })

  it('drops a pull once that neutral can no longer be guessed under his clue', () => {
    const burnedForCasey = authoredClueCandidates(
      viewFor(board1, { reveals: { 'da:komme': { kind: 'bystander', against: ['ai'] } } }),
    ).find((c) => c.clue === 'tid')
    expect(burnedForCasey.otherBoardWordIds).not.toContain('da:komme')
    // Burned against the player only, it is still live under Casey's clue.
    const burnedForPlayer = authoredClueCandidates(
      viewFor(board1, { reveals: { 'da:komme': { kind: 'bystander', against: ['player'] } } }),
    ).find((c) => c.clue === 'tid')
    expect(burnedForPlayer.otherBoardWordIds).toContain('da:komme')
  })

  it('puts the safer of two equal-sized groups first', () => {
    const candidates = authoredClueCandidates(viewFor(board1))
    for (let i = 1; i < candidates.length; i++) {
      const a = candidates[i - 1]
      const b = candidates[i]
      if (a.targetWordIds.length !== b.targetWordIds.length) continue
      expect(a.otherBoardWordIds?.length ?? 0).toBeLessThanOrEqual(b.otherBoardWordIds?.length ?? 0)
    }
  })

  it('does not repeat a clue for a subset of targets it already lists', () => {
    // Board 1's bank has «kvart» twice: hel/halv/klokke and hel/halv.
    const candidates = authoredClueCandidates(viewFor(board1))
    const kvart = candidates.filter((c) => c.clue === 'kvart')
    expect(kvart).toHaveLength(1)
    expect(kvart[0].targetWordIds).toHaveLength(3)
    const clues = candidates.map((c) => normalize(c.clue))
    expect(new Set(clues).size).toBe(clues.length)
  })

  it('leaves out a clue already given this round', () => {
    const spent = board1.caseyClueGroups[0].clue
    const candidates = authoredClueCandidates(
      viewFor(board1, {
        history: [{ by: 'ai', text: spent.toUpperCase(), number: 2, guesses: [] }],
      }),
    )
    expect(candidates.some((c) => normalize(c.clue) === normalize(spent))).toBe(false)
  })

  it('offers a one-word group only when one green is left', () => {
    const [keep, ...rest] = board1.aiGreenIds
    const reveals = Object.fromEntries(rest.map((id) => [id, { kind: 'green' }]))
    const candidates = authoredClueCandidates(viewFor(board1, { reveals }))
    for (const candidate of candidates) expect(candidate.targetWordIds).toEqual([keep])
  })
})

describe('the path over what Casey still holds', () => {
  it('covers as much of his key as the groups allow, without naming a word twice', () => {
    const view = viewFor(board1)
    const path = authoredPath(view)
    expect(path.steps.length).toBeGreaterThan(0)
    const named = path.steps.flatMap((step) => step.targetWordIds)
    expect(new Set(named).size).toBe(named.length)
    expect(new Set([...named, ...path.uncovered])).toEqual(new Set(board1.aiGreenIds))
    for (const step of path.steps) expect(step.targetWordIds.length).toBeGreaterThanOrEqual(2)
  })

  it('shrinks as the board is revealed', () => {
    const fresh = authoredPath(viewFor(board1))
    const covered = fresh.steps[0].targetWordIds
    const reveals = Object.fromEntries(covered.map((id) => [id, { kind: 'green' }]))
    const later = authoredPath(viewFor(board1, { reveals }))
    for (const step of later.steps) {
      for (const id of step.targetWordIds) expect(covered).not.toContain(id)
    }
  })
})

describe('what reaches the prompt', () => {
  it('names every live group and the path, and the clue prompt carries it', () => {
    const view = viewFor(board1)
    const context = buildAuthoredClueContext(view)
    expect(context).toMatch(/^AUTHORED CLUE GROUPS FOR THIS EXACT BOARD — YOUR KEY ONLY:/)
    for (const candidate of authoredClueCandidates(view)) {
      expect(context).toContain(`“${candidate.clue}”`)
    }
    const rows = context.split('\n').filter((line) => line.startsWith('- “'))
    expect(rows.length).toBe(authoredClueCandidates(view).length)
    for (const row of rows) expect(row).toMatch(/; other live board pulls: (not indexed|none indexed|da:)/)
    expect(context).toMatch(/“tid”.*other live board pulls: .*da:komme \(komme\)/)
    expect(context).toMatch(/A path (that covers everything you still hold|over what you still hold)/)
    const prompt = buildCluePrompt(view, DANISH_LANGUAGE, context)
    expect(prompt.find((message) => message.role === 'system').content).toContain(
      'AUTHORED CLUE GROUPS FOR THIS EXACT BOARD',
    )
  })

  /**
   * Owner: the precomputed paths and clues are the first choice; the model
   * leaves them only when a triple lost a word to play and something else
   * now covers more, or when it sees a clearly better clue.
   */
  it('makes the groups the first choice and names the two reasons to leave them', () => {
    const context = buildAuthoredClueContext(viewFor(board1))
    expect(context).toContain('THESE ARE YOUR FIRST CHOICE')
    expect(context).toContain('NARROWED by play')
    expect(context).toContain('clearly STRONGER and SAFER')
    expect(context).toContain('A merely different clue is not a reason')
  })

  it('marks a group that play has narrowed, so the model can see the triple lost a word', () => {
    const group = board1.caseyClueGroups.find((g) => g.targetWordIds.length === 3)
    const [found] = group.targetWordIds
    const candidates = authoredClueCandidates(viewFor(board1, { reveals: { [found]: { kind: 'green' } } }))
    const narrowed = candidates.find((c) => c.clue === group.clue && c.targetWordIds.length === 2)
    expect(narrowed).toBeDefined()
    expect(narrowed.narrowedFrom).toBe(3)
    const whole = authoredClueCandidates(viewFor(board1)).find((c) => c.clue === group.clue && c.targetWordIds.length === 3)
    expect(whole.narrowedFrom).toBeNull()
    const context = buildAuthoredClueContext(viewFor(board1, { reveals: { [found]: { kind: 'green' } } }))
    expect(context).toMatch(new RegExp(`“${group.clue}”.*NARROWED from 3 — one of its words is already found`))
    expect(buildAuthoredClueContext(viewFor(board1))).not.toContain('NARROWED from')
  })

  it('says so when no group still reaches enough of his words', () => {
    const [keep, ...rest] = board1.aiGreenIds
    const reveals = Object.fromEntries(rest.map((id) => [id, { kind: 'green' }]))
    const view = viewFor(board1, {
      reveals,
      history: board1.caseyClueGroups
        .filter((g) => g.targetWordIds.includes(keep))
        .map((g) => ({ by: 'ai', text: g.clue, number: 2, guesses: [] }))
        .slice(0, 24),
    })
    if (authoredClueCandidates(view).length === 0) {
      expect(buildAuthoredClueContext(view)).toContain('No authored group still reaches')
    }
  })

  it('is empty for a board that is not authored', () => {
    expect(buildAuthoredClueContext(viewFor(board1, { boardId: null }))).toBe('')
  })
})

describe('the board id on the wire', () => {
  it('is accepted on a clue view and carried through', () => {
    const request = parseDecisionRequest({ protocol: 1, operation: 'clue', view: viewFor(board1) })
    expect(request.view.boardId).toBe(board1.id)
  })

  it('is optional, and absent when absent', () => {
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'clue',
      view: viewFor(board1, { boardId: null }),
    })
    expect('boardId' in request.view).toBe(false)
  })

  it('must look like an authored board id', () => {
    for (const bad of ['', 'board_01', 'bank_1', 42, null, '../book.da.1.json']) {
      const view = { ...viewFor(board1), boardId: bad }
      expect(() => parseDecisionRequest({ protocol: 1, operation: 'clue', view })).toThrow(
        /view\.boardId/,
      )
    }
  })

  it('is accepted on a guess view too — the made-for lookup reads it there', () => {
    const clue = viewFor(board1)
    const guess = {
      kind: 'ai-guess',
      clueLanguage: 'target',
      turnsLeft: 8,
      words: clue.words.map(({ roleOnMyKey, ...word }) => word),
      currentClue: { text: 'huskeliste', number: 2 },
      history: [],
      flagged: [],
      boardId: board1.id,
    }
    expect(parseDecisionRequest({ protocol: 1, operation: 'guess', view: guess }).view.boardId).toBe(board1.id)
  })
})

describe('the precomputed OPENING clue', () => {
  /**
   * The owner's correction (2026-09-17): the round's FIRST clue must arrive
   * with no thinking at all, because it is already decided before the round
   * starts. `authoredFirstClue` is that decision — the bank's first path
   * step, and only for a fresh view of an authored board.
   */
  it('returns the bank’s first path step for a fresh view of an authored board', () => {
    const view = viewFor(board1)
    const path = authoredPath(view)
    const first = authoredFirstClue(view)
    expect(first).not.toBeNull()
    expect(first.clue).toBe(path.steps[0].clue)
    expect(first.targetWordIds).toEqual(path.steps[0].targetWordIds)
    // The rationale input stays in Casey's voice inputs: a clue the bank
    // holds, its English gloss, and only words on his key.
    expect(typeof first.clueEnglish).toBe('string')
    for (const id of first.targetWordIds) expect(board1.aiGreenIds).toContain(id)
  })

  it('answers null once the round has any clue history', () => {
    expect(
      authoredFirstClue(
        viewFor(board1, {
          history: [{ by: 'player', text: 'huskeliste', number: 2, guesses: [] }],
        }),
      ),
    ).toBeNull()
  })

  it('answers null for a board that is not authored, failing closed', () => {
    expect(authoredFirstClue(viewFor(board1, { boardId: null }))).toBeNull()
    // And for a view whose key does not match the bank's for the id.
    const view = viewFor(board1)
    const green = view.words.find((word) => word.roleOnMyKey === 'green')
    green.roleOnMyKey = 'bystander'
    expect(authoredFirstClue(view)).toBeNull()
  })
})
