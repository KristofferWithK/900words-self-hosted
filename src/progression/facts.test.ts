import { describe, expect, it } from 'vitest'
import { completedPrimaryCount, createPrimaryContinuation, earnedPostcards, emptyProgressFacts, factsForImport, mergeProgressFacts, withLegacyCredit } from './facts'
import { FIXTURE_BOARD, FIXTURE_SET } from './fixtures'
import { boardKey, firstCompletionKey, milestoneKey, requiredSetKey } from './identity'
import { cityTier } from './rules'
import type { ProgressFacts } from './types'

const key = boardKey(FIXTURE_BOARD)
const a: ProgressFacts = { ...withLegacyCredit(emptyProgressFacts(), 12), boards: { [key]: { board: FIXTURE_BOARD, best: 'silver', claims: ['spinWin'] } } }
const b: ProgressFacts = { ...withLegacyCredit(emptyProgressFacts(), 15), boards: { [key]: { board: FIXTURE_BOARD, best: 'gold', claims: ['spinWin', 'solved'] } } }

describe('portable facts and legacy credit', () => {
  it('F30 old exports 12,12,7,15 raise one Danish City 1 high-water credit only', () => {
    let facts = emptyProgressFacts()
    const observed: number[] = []
    for (const amount of [12, 12, 7, 15]) {
      facts = withLegacyCredit(facts, amount)
      observed.push(earnedPostcards(facts, FIXTURE_BOARD))
    }
    expect(observed).toEqual([12, 12, 12, 15])
    expect(facts.boards).toEqual({})
    expect(earnedPostcards(facts, { courseId: 'de', cityId: 'sonderborg' })).toBe(0)
    expect(earnedPostcards(facts, { courseId: 'da', cityId: 'ribe' })).toBe(0)
    expect(() => withLegacyCredit(facts, NaN)).toThrow()
    expect(() => withLegacyCredit(facts, 1.5)).toThrow()
  })

  it('F31 union/max merge is commutative, associative and idempotent, total 17', () => {
    const c: ProgressFacts = { ...emptyProgressFacts(), boards: { [key]: { board: FIXTURE_BOARD, best: 'bronze', claims: [] } } }
    const ab = mergeProgressFacts(a, b)
    expect(ab).toEqual(mergeProgressFacts(b, a))
    expect(mergeProgressFacts(ab, b)).toEqual(ab)
    expect(mergeProgressFacts(mergeProgressFacts(a, b), c)).toEqual(mergeProgressFacts(a, mergeProgressFacts(b, c)))
    expect(JSON.stringify(mergeProgressFacts(a, b))).toBe(JSON.stringify(mergeProgressFacts(b, a)))
    expect(earnedPostcards(ab, FIXTURE_BOARD)).toBe(17)
    expect(ab.boards[key].best).toBe('gold')
    expect(ab).not.toHaveProperty('total')
    expect(ab).not.toHaveProperty('translationPostcards')
  })

  it('AC19 earlier-city and other-course claims stay isolated', () => {
    const ribe = { ...FIXTURE_BOARD, cityId: 'ribe' }
    const german = { ...FIXTURE_BOARD, courseId: 'de' as const }
    const facts = mergeProgressFacts(a, { ...emptyProgressFacts(), boards: {
      [boardKey(ribe)]: { board: ribe, best: 'gold', claims: ['solved'] },
      [boardKey(german)]: { board: german, best: 'platinum', claims: ['spinWin', 'solved', 'solvedAndTranslated'] },
    } })
    expect(earnedPostcards(facts, FIXTURE_BOARD)).toBe(13)
    expect(earnedPostcards(facts, ribe)).toBe(1)
    expect(earnedPostcards(facts, german)).toBe(4)
  })

  it('AC19 display reorder and optional inventory cannot change the frozen medal or remint claims', () => {
    const second = { ...FIXTURE_BOARD, authoredBoardId: 'fixture-b' }
    const required = { ...FIXTURE_SET, boards: [FIXTURE_BOARD, second] }
    const facts: ProgressFacts = {
      ...emptyProgressFacts(),
      boards: Object.fromEntries(required.boards.map((board) => [boardKey(board), { board, best: 'platinum', claims: ['spinWin', 'solved', 'solvedAndTranslated'] }])),
      cityAchievements: { [requiredSetKey(required)]: { requiredSet: required, tier: 'platinum' } },
    }
    const presentation = { ...required, boards: [...required.boards].reverse(), optionalBoards: [{ ...FIXTURE_BOARD, authoredBoardId: 'optional-c' }] }
    expect(cityTier(presentation, Object.fromEntries(required.boards.map((board) => [boardKey(board), 'platinum']))).tier).toBe('platinum')
    expect(mergeProgressFacts(facts, emptyProgressFacts()).cityAchievements).toEqual(facts.cityAchievements)
    expect(earnedPostcards(facts, FIXTURE_BOARD)).toBe(8)
  })

  it('100 unique three-component boards cap new claims at 400, separate from legacy credit', () => {
    const boards = Array.from({ length: 100 }, (_, i) => ({ ...FIXTURE_BOARD, authoredBoardId: `fixture-${i}` }))
    const facts: ProgressFacts = { ...emptyProgressFacts(), boards: Object.fromEntries(boards.map((board) => [boardKey(board), { board, best: 'platinum', claims: ['spinWin', 'solved', 'solvedAndTranslated'] }])) }
    expect(earnedPostcards(mergeProgressFacts(facts, facts), FIXTURE_BOARD)).toBe(400)
    expect(earnedPostcards(withLegacyCredit(facts, 15), FIXTURE_BOARD)).toBe(415)
  })

  it('rejects inconsistent identity fields before a merge proposal', () => {
    expect(() => mergeProgressFacts(a, { ...b, boards: { incorrect: b.boards[key] } })).toThrow('Invalid board facts')
  })

  it('imports milestone availability as handled without importing executable jobs', () => {
    const id = milestoneKey(FIXTURE_SET, 10)
    const incoming: ProgressFacts = { ...a, milestones: { [id]: { requiredSet: FIXTURE_SET, completedCount: 10, notificationHandled: false } } }
    const normalized = factsForImport(incoming)
    expect(normalized.milestones[id].notificationHandled).toBe(true)
    expect(factsForImport(normalized)).toEqual(normalized)
    expect(incoming.milestones[id].notificationHandled).toBe(false)
  })
})

describe('finite continuation interfaces', () => {
  const boards = ['A', 'B', 'Q', 'C'].map((authoredBoardId) => ({ ...FIXTURE_BOARD, authoredBoardId }))
  const required = { ...FIXTURE_SET, boards }

  it('F33 anchors compatible legacy Q then retains every earlier unproven board', () => {
    const queue = createPrimaryContinuation(required, emptyProgressFacts(), boards[2])
    expect(queue.remainingBoardKeys).toEqual([boards[2], boards[0], boards[1], boards[3]].map(boardKey))
    expect(queue.source).toBe('legacy-anchor')
    expect(() => createPrimaryContinuation(required, emptyProgressFacts(), FIXTURE_BOARD)).toThrow('Unknown legacy anchor')
  })

  it('F24 completed finite queue is empty and never wraps modulo its length', () => {
    const facts: ProgressFacts = { ...emptyProgressFacts(), firstPrimaryCompletions: Object.fromEntries(boards.map((board) => [firstCompletionKey(board), { board, requiredSet: required }])) }
    expect(createPrimaryContinuation(required, facts).remainingBoardKeys).toEqual([])
    expect(completedPrimaryCount(facts, required)).toBe(4)
    expect(createPrimaryContinuation(required, facts)).toEqual(createPrimaryContinuation(required, facts))
  })
})
