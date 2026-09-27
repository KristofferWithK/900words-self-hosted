import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { boardKey, firstCompletionKey } from '../../progression/identity'
import { emptyProgressFacts } from '../../progression/facts'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { CaseyBoardCollection, collectionBoards, readCollectionFacts } from './CaseyBoardCollection'

describe('Casey board collection', () => {
  it('uses 100 display numbers while keeping stable authored IDs out of the visible card label', () => {
    const entries = collectionBoards()
    expect(entries).toHaveLength(100)
    expect(entries[0]).toMatchObject({ displayNumber: 1, tier: null })
    expect(entries.at(-1)).toMatchObject({ displayNumber: 100, tier: null })
    expect(new Set(entries.map((entry) => entry.stableId)).size).toBe(100)
  })

  it('renders grey unplayed boards as non-controls and completed medals as detail controls', () => {
    const first = CITY1_REQUIRED_SET.boards[0]!
    const facts = { ...emptyProgressFacts(), boards: {
      [boardKey(first)]: { board: first, best: 'gold' as const, claims: ['spinWin', 'solved'] as const },
    } }
    const html = renderToStaticMarkup(<CaseyBoardCollection facts={facts} sessions={null} onReplay={() => false} />)
    expect(html).toContain('tier-gold')
    expect(html).toContain('Gold')
    expect(html).toContain('collection-board-unplayed')
    expect(html).toContain('Next primary board: 1')
    expect(html).toContain('1/10')
    expect(html).toContain('aria-label="Board 1: Gold"')
    expect(html).toContain('<b>10</b>')
    expect(html).not.toContain(first.authoredBoardId)
    expect(html).toMatch(/<span class="collection-board-card collection-board-unplayed" role="img" aria-label="Board 2: Unplayed">/)
    expect((html.match(/class="collection-board-slot tier-unplayed"/g) ?? []).length).toBe(9)
    expect((html.match(/class="collection-board-cell"/g) ?? []).length).toBe(180)
    expect(html).toContain('collection-board-face')
    expect(html).toContain('collection-pager')
    expect(html).not.toContain('case-open collection-case')
  })

  it('shows a city medal only from the frozen board set, independently of travel readiness', () => {
    const facts = { ...emptyProgressFacts(), boards: Object.fromEntries(CITY1_REQUIRED_SET.boards.map((board) => [
      boardKey(board), { board, best: 'platinum' as const, claims: [] as const },
    ])) }
    const html = renderToStaticMarkup(<CaseyBoardCollection facts={facts} sessions={initialCourseSessions(facts)} onReplay={() => false} />)
    expect(html).toContain('City medal: Platinum')
    expect(html).not.toContain('Ready to travel')
  })

  it('uses the runtime launch selector when imported leading completions leave a retained queue behind', () => {
    const retained = initialCourseSessions(emptyProgressFacts())
    const imported = { ...emptyProgressFacts(), firstPrimaryCompletions: Object.fromEntries(CITY1_REQUIRED_SET.boards.slice(0, 10).map((board) => [
      firstCompletionKey(board), { board, requiredSet: { courseId: CITY1_REQUIRED_SET.courseId, cityId: CITY1_REQUIRED_SET.cityId, setVersion: CITY1_REQUIRED_SET.setVersion } },
    ])) }
    const runtimeTarget = nextRequiredBoard(retained, imported)
    expect(runtimeTarget?.authoredBoardId).toBe(CITY1_REQUIRED_SET.boards[10]!.authoredBoardId)
    const html = renderToStaticMarkup(<CaseyBoardCollection facts={imported} sessions={retained} onReplay={() => false} />)
    expect(html).toContain('Next primary board: 11')
  })

  it('fails closed when the durable ledger contains malformed board facts', () => {
    const malformed = { schemaVersion: 1, facts: {
      ...emptyProgressFacts(), boards: { malformed: { board: CITY1_REQUIRED_SET.boards[0], best: 'not-a-tier', claims: [] } },
    }, settlements: {} }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(malformed) })
    try { expect(readCollectionFacts()).toEqual(emptyProgressFacts()) } finally { vi.unstubAllGlobals() }
  })

  it('keeps a primary waiting message separate from board medal and replay detail state', () => {
    const facts = emptyProgressFacts()
    const sessions = { ...initialCourseSessions(facts), primary: {
      attemptId: 'primary-1', board: CITY1_REQUIRED_SET.boards[0]!, origin: 'primary' as const,
      promptLanguage: 'en' as const, game: {} as never, lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1' as const,
    }, replay: {
      attemptId: 'replay-1', board: CITY1_REQUIRED_SET.boards[1]!, origin: 'replay' as const,
      promptLanguage: 'en' as const, game: {} as never, lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1' as const,
    } }
    const html = renderToStaticMarkup(<CaseyBoardCollection facts={facts} sessions={sessions} onReplay={() => false} />)
    expect(html).toContain('A replay is open. Your primary board is waiting unchanged.')
    expect(html).toContain('City medal: Unplayed')
  })
})
