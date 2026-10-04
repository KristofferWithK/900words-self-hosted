import { describe, expect, it } from 'vitest'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import { wordById } from '../data/words'
import { BOARD } from '../engine/config'
import { createGame } from '../engine/game'
import type { GameState } from '../engine/types'
import { createPrimaryContinuation, emptyProgressFacts } from '../progression/facts'
import { boardKey, firstCompletionKey } from '../progression/identity'
import type { AttemptSlot, BoardIdentity, CourseSessions, ProgressFacts, RequiredBoardSet } from '../progression/types'
import {
  knownRequiredSetsForCourse, needsRebase, nextRequiredBoard, rebaseCourseSessions, requiredSetForCourse, validateCourseSessions,
} from './courseRuntime'

const v2 = requiredSetForCourse('da')
const v1 = knownRequiredSetsForCourse('da')[0]!
const inV2 = new Set(v2.boards.map(boardKey))
const inV1 = new Set(v1.boards.map(boardKey))
// A board both sets hold that is not the first of either, and one only v1 has.
const kept = v1.boards.find((board, index) => index > 0 && inV2.has(boardKey(board)) && boardKey(board) !== boardKey(v2.boards[0]!))!
const dropped = v1.boards.find((board) => !inV2.has(boardKey(board)))!

function authoredGame(board: BoardIdentity, phase?: GameState['phase']): GameState {
  const authored = CITY1_BOARD_CYCLE.find((entry) => entry.id === board.authoredBoardId)!
  const game = createGame({
    config: { ...BOARD, greenOverlap: authored.greenOverlap },
    words: authored.wordIds.map((id) => {
      const w = wordById(id)!
      return { wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article, gender: w.gender, countable: w.countable }
    }),
    seed: Number.parseInt(authored.seedHex, 16) >>> 0,
    firstGiver: 'ai',
    authoredGreenIds: { player: authored.playerGreenIds, ai: authored.aiGreenIds },
  })
  return phase ? { ...game, phase } : game
}

function slot(board: BoardIdentity, origin: 'primary' | 'replay', phase?: GameState['phase']): AttemptSlot {
  return { attemptId: `${origin}-${board.authoredBoardId}`, board, origin, promptLanguage: 'en', game: authoredGame(board, phase),
    lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1' }
}

/** Completed under v1, as a phone that played the old course would hold it. */
function completedUnderV1(facts: ProgressFacts, boards: readonly BoardIdentity[]): ProgressFacts {
  const set = { courseId: v1.courseId, cityId: v1.cityId, setVersion: v1.setVersion }
  return {
    ...facts,
    boards: { ...facts.boards, ...Object.fromEntries(boards.map((board) => [boardKey(board), { board, best: 'bronze' as const, claims: [] }])) },
    firstPrimaryCompletions: { ...facts.firstPrimaryCompletions,
      ...Object.fromEntries(boards.map((board) => [firstCompletionKey(board), { board, requiredSet: set }])) },
  }
}

function v1Sessions(facts: ProgressFacts, changes: Partial<CourseSessions> = {}, anchor?: BoardIdentity): CourseSessions {
  return { continuation: createPrimaryContinuation(v1, facts, anchor), primary: null, replay: null, activeSlot: null, ...changes }
}

describe('the superseded City 1 set', () => {
  it('is a different frozen set of the same city, and dropping it would orphan real boards', () => {
    expect(v1.setVersion).toBe('city1-required-boards-v1')
    expect(v2.setVersion).toBe('city1-required-boards-v2')
    expect(v1.cityId).toBe(v2.cityId)
    expect(v1.boards).toHaveLength(100)
    expect(v2.boards).toHaveLength(100)
    expect(dropped).toBeDefined()
    expect(kept).toBeDefined()
    expect(inV1.has(boardKey(dropped))).toBe(true)
  })
})

describe('rebaseCourseSessions', () => {
  it('leaves a queue that is already on the current set alone', () => {
    const facts = emptyProgressFacts()
    const current = { continuation: createPrimaryContinuation(v2, facts), primary: null, replay: null, activeSlot: null }
    expect(needsRebase(current, v2)).toBe(false)
    expect(rebaseCourseSessions(current, facts, v2)).toEqual({ sessions: current, retired: [] })
  })

  it('becomes the new display order minus every board already completed, under whichever set', () => {
    // Twenty-eight boards played the old way: some v2 keeps, some it dropped.
    const played = v1.boards.slice(0, 28)
    const facts = completedUnderV1(emptyProgressFacts(), played)
    const { sessions, retired } = rebaseCourseSessions(v1Sessions(facts), facts, v2)
    const playedKeys = new Set(played.map(boardKey))
    expect(retired).toEqual([])
    expect(sessions.continuation.requiredSet.setVersion).toBe('city1-required-boards-v2')
    expect(sessions.continuation.source).toBe('rebased')
    expect(sessions.continuation.remainingBoardKeys).toEqual(v2.boards.map(boardKey).filter((key) => !playedKeys.has(key)))
    expect(nextRequiredBoard(sessions, facts, v2)).toEqual(v2.boards.find((board) => !playedKeys.has(boardKey(board))))
    // Nothing earned moves: the old boards stay completed, v2 counts the overlap.
    expect(Object.keys(facts.boards)).toHaveLength(28)
  })

  it('anchors an unfinished primary on a board both sets hold, and keeps it on the table', () => {
    const facts = emptyProgressFacts()
    const primary = slot(kept, 'primary')
    const { sessions, retired } = rebaseCourseSessions(v1Sessions(facts, { primary, activeSlot: 'primary' }, kept), facts, v2)
    expect(retired).toEqual([])
    expect(sessions.primary).toBe(primary)
    expect(sessions.activeSlot).toBe('primary')
    expect(sessions.continuation.remainingBoardKeys[0]).toBe(boardKey(kept))
    expect(sessions.continuation.remainingBoardKeys).toHaveLength(100)
  })

  it('anchors a finished primary whose receipt was never written, so it can still settle as the next board', () => {
    const facts = emptyProgressFacts()
    const primary = slot(kept, 'primary', 'finished')
    const { sessions, retired } = rebaseCourseSessions(v1Sessions(facts, { primary, activeSlot: 'primary' }, kept), facts, v2)
    expect(retired).toEqual([])
    expect(sessions.continuation.remainingBoardKeys[0]).toBe(boardKey(kept))
  })

  it('retires an unfinished primary on a board v2 dropped and opens v2 at its first unplayed board', () => {
    const facts = emptyProgressFacts()
    const primary = slot(dropped, 'primary')
    const { sessions, retired } = rebaseCourseSessions(v1Sessions(facts, { primary, activeSlot: 'primary' }, dropped), facts, v2)
    expect(retired).toEqual([primary])
    expect(sessions.primary).toBeNull()
    expect(sessions.activeSlot).toBeNull()
    expect(sessions.continuation.remainingBoardKeys).toEqual(v2.boards.map(boardKey))
  })

  it('lets a settled finished round on a dropped board go without calling it retired', () => {
    const facts = completedUnderV1(emptyProgressFacts(), [dropped])
    const primary = slot(dropped, 'primary', 'finished')
    const { sessions, retired } = rebaseCourseSessions(v1Sessions(facts, { primary, activeSlot: 'primary' }), facts, v2)
    expect(retired).toEqual([])
    expect(sessions.primary).toBeNull()
    expect(facts.boards[boardKey(dropped)]).toBeDefined()
  })

  it('treats replays the same way: kept on a kept board, retired on a dropped one', () => {
    const facts = completedUnderV1(emptyProgressFacts(), [kept, dropped])
    const keptReplay = slot(kept, 'replay')
    const keptRebase = rebaseCourseSessions(v1Sessions(facts, { replay: keptReplay, activeSlot: 'replay' }), facts, v2)
    expect(keptRebase.sessions.replay).toBe(keptReplay)
    expect(keptRebase.sessions.activeSlot).toBe('replay')
    const droppedReplay = slot(dropped, 'replay')
    const droppedRebase = rebaseCourseSessions(v1Sessions(facts, { replay: droppedReplay, activeSlot: 'replay' }), facts, v2)
    expect(droppedRebase.retired).toEqual([droppedReplay])
    expect(droppedRebase.sessions.replay).toBeNull()
    expect(droppedRebase.sessions.activeSlot).toBeNull()
  })

  it('validates what it returns against the current set', () => {
    const facts = completedUnderV1(emptyProgressFacts(), v1.boards.slice(0, 10))
    const { sessions } = rebaseCourseSessions(v1Sessions(facts), facts, v2)
    expect(validateCourseSessions(sessions, facts, v2)).toEqual(sessions)
  })

  it('refuses to move a queue to another city', () => {
    const facts = emptyProgressFacts()
    const german: RequiredBoardSet = requiredSetForCourse('de')
    expect(() => rebaseCourseSessions(v1Sessions(facts), facts, german)).toThrow('another city')
  })
})
