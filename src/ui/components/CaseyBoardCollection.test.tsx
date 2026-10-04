import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { cityKey, boardKey, firstCompletionKey } from '../../progression/identity'
import { emptyProgressFacts } from '../../progression/facts'
import type { BoardIdentity, ProgressFacts, Tier } from '../../progression/types'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { cafeNameForBoard } from '../../cafe/cafeName'
import { useJourney } from '../../stores/journeyStore'
import { CaseyBoardCollection, readCollectionFacts, stampCardCells, stampCellAria } from './CaseyBoardCollection'

const boards = CITY1_REQUIRED_SET.boards
const nameOf = (index: number) => cafeNameForBoard(boards[index]!)!

const withBests = (bests: Readonly<Record<number, Tier>>): ProgressFacts => ({
  ...emptyProgressFacts(),
  boards: Object.fromEntries(Object.entries(bests).map(([index, best]) => {
    const board = boards[Number(index)]!
    return [boardKey(board), { board, best, claims: [] as const }]
  })),
})

const completions = (played: readonly BoardIdentity[]) => Object.fromEntries(played.map((board) => [
  firstCompletionKey(board), { board, requiredSet: { courseId: CITY1_REQUIRED_SET.courseId, cityId: CITY1_REQUIRED_SET.cityId, setVersion: CITY1_REQUIRED_SET.setVersion } },
]))

const lostOnly = (board: BoardIdentity): ProgressFacts => ({
  ...emptyProgressFacts(), completedLosses: { [boardKey(board)]: { board, firstPrimary: true } },
})

/** Café finds as a walk writes them (journey/cafes.ts): authored board id -> when. */
const found = (...indexes: number[]) => useJourney.setState({
  cafes: { [cityKey(CITY1_REQUIRED_SET)]: { found: Object.fromEntries(indexes.map((i) => [boards[i]!.authoredBoardId, 1])), toward: 0 } },
})

const render = (facts: ProgressFacts, sessions = initialCourseSessions(facts)) =>
  renderToStaticMarkup(<CaseyBoardCollection facts={facts} sessions={sessions} onReplay={() => false} />)

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length

afterEach(() => useJourney.setState({ cafes: {} }))

describe('the stamp card (CW-11)', () => {
  it('has one cell per café of the frozen set, by stable id, and never prints the authored id', () => {
    const cells = stampCardCells(emptyProgressFacts())
    expect(cells).toHaveLength(100)
    expect(cells[0]).toMatchObject({ displayNumber: 1, state: 'unfound', tier: null, replayable: false, name: nameOf(0) })
    expect(new Set(cells.map((cell) => cell.stableId)).size).toBe(100)
    const html = render(emptyProgressFacts())
    expect(html).not.toContain(boards[0]!.authoredBoardId)
    expect(html).toContain('1/10')
  })

  it('shows a café not found as "?", without its name, and names it to the screen reader by place', () => {
    const html = render(emptyProgressFacts())
    expect(count(html, /class="collection-board-slot stamp-cell-unfound"/g)).toBe(10)
    expect(html).toMatch(/<span class="collection-board-card collection-board-unplayed" role="img" aria-label="Café 1: not found yet">/)
    expect(html).toContain('<span class="stamp-cell-name" lang="da" aria-hidden="true">?</span>')
    expect(html).not.toContain(nameOf(0))
    expect(html).toContain('Not found')
    expect(html).toContain('Find the next café in Sightseeing.')
  })

  it('shows a café found but not played with its name and a dashed circle, not as a control', () => {
    found(1)
    const html = render(emptyProgressFacts())
    expect(stampCardCells(emptyProgressFacts())[1]!.state).toBe('found')
    expect(html).toMatch(new RegExp(`<span class="collection-board-card collection-board-unplayed" role="img" aria-label="${nameOf(1)}: found, not played yet">`))
    expect(html).toContain('stroke-dasharray="3.2 3"')
    expect(html).toContain('Found')
  })

  it('stamps a café in its tier ink and opens it for replay, as the collection did', () => {
    found(0)
    const html = render(withBests({ 0: 'gold' }))
    expect(html).toContain('class="collection-board-slot stamp-cell-stamped tier-gold"')
    expect(html).toMatch(new RegExp(`<button class="collection-board-card" aria-label="${nameOf(0)}: Gold stamp">`))
    expect(html).toContain('cafe-stamp cafe-stamp-gold')
    expect(stampCellAria(stampCardCells(withBests({ 0: 'platinum' }))[0]!)).toBe(`${nameOf(0)}: Platinum stamp`)
  })

  it('shows a café only ever lost as Bronze, and keeps it replayable (CW-03b)', () => {
    const facts = lostOnly(boards[0]!)
    const [cell] = stampCardCells(facts)
    expect(cell).toMatchObject({ state: 'stamped', tier: 'bronze', replayable: true })
    const html = render(facts)
    expect(html).toContain('class="collection-board-slot stamp-cell-stamped tier-bronze"')
    expect(html).toMatch(new RegExp(`<button class="collection-board-card" aria-label="${nameOf(0)}: Bronze stamp">`))
    expect(html).toContain('cafe-stamp cafe-stamp-bronze')
    expect(html).not.toContain('stamp-cell-no-stamp')
    expect(html).not.toContain('cafe-stamp-none')
    expect(html).not.toContain('No stamp')
    // 1 of 400 points is 0.25%, floored to 0%; the café counts as stamped.
    expect(html).toContain('0% · Bronze at 25% · 1 of 100 cafés')
  })

  it('shows the city percentage floored, the next medal and the stamped count', () => {
    // 33 Platinum stamps: 132 of 400 points, 33%: Bronze reached, Silver next.
    const bests = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [i, 'platinum' as Tier]))
    expect(render(withBests(bests))).toContain('33% · Silver at 50% · 33 of 100 cafés')
    // One Silver among 99 Platinum: 398 of 400 is 99.5%, shown as 99%, never 100%.
    const almost = Object.fromEntries(boards.map((_, i) => [i, (i === 0 ? 'silver' : 'platinum') as Tier]))
    expect(render(withBests(almost))).toContain('99% · Platinum at 100% · 100 of 100 cafés')
    const all = Object.fromEntries(boards.map((_, i) => [i, 'platinum' as Tier]))
    const html = render({ ...withBests(all), firstPrimaryCompletions: completions(boards) })
    expect(html).toContain('100% · 100 of 100 cafés')
    expect(html).toContain('Every café is played. Tap one to play it again.')
    expect(html).toContain('Sønderborg stamp card')
  })

  it('names the next café the Café puzzle deals once it is found, using the runtime launch selector', () => {
    const retained = initialCourseSessions(emptyProgressFacts())
    const imported = { ...emptyProgressFacts(), firstPrimaryCompletions: completions(boards.slice(0, 10)) }
    expect(nextRequiredBoard(retained, imported)?.authoredBoardId).toBe(boards[10]!.authoredBoardId)
    expect(render(imported, retained)).toContain('Find the next café in Sightseeing.')
    found(10)
    expect(render(imported, retained)).toContain(`Next café: ${nameOf(10)}`)
  })

  it('keeps a long café name whole for the screen reader while the face clamps it', () => {
    const longest = boards.map((_, i) => i).sort((a, b) => nameOf(b).length - nameOf(a).length)[0]!
    found(longest)
    const cell = stampCardCells(emptyProgressFacts())[longest]!
    expect(stampCellAria(cell)).toBe(`${nameOf(longest)}: found, not played yet`)
  })

  it('fails closed when the durable ledger contains malformed board facts', () => {
    const malformed = { schemaVersion: 1, facts: {
      ...emptyProgressFacts(), boards: { malformed: { board: boards[0], best: 'not-a-tier', claims: [] } },
    }, settlements: {} }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(malformed) })
    try { expect(readCollectionFacts()).toEqual(emptyProgressFacts()) } finally { vi.unstubAllGlobals() }
  })

  it('keeps a primary waiting message separate from the stamp card and replay detail state', () => {
    const facts = emptyProgressFacts()
    const sessions = { ...initialCourseSessions(facts), primary: {
      attemptId: 'primary-1', board: boards[0]!, origin: 'primary' as const,
      promptLanguage: 'en' as const, game: {} as never, lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1' as const,
    }, replay: {
      attemptId: 'replay-1', board: boards[1]!, origin: 'replay' as const,
      promptLanguage: 'en' as const, game: {} as never, lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1' as const,
    } }
    const html = render(facts, sessions)
    expect(html).toContain('A replay is open. Your primary board is waiting unchanged.')
    expect(html).toContain('0% · Bronze at 25% · 0 of 100 cafés')
  })
})
