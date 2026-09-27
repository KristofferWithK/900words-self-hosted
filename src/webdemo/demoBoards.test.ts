import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { webDemoBoards } from './demoBoards'
import { initialCourseSessions, nextRequiredBoard } from '../session/courseRuntime'
import { emptyProgressFacts } from '../progression/facts'

const PINNED = 'proxy/data/web-demo-boards.da.json'

describe('the website demo boards', () => {
  const boards = webDemoBoards()

  it('are the Danish practice board and a fresh player\'s first full board', () => {
    expect(boards.practice.boardId).toBeNull()
    expect(boards.practice.wordIds).toHaveLength(9)
    expect(boards.firstBoard.wordIds).toHaveLength(18)
    const facts = emptyProgressFacts()
    const next = nextRequiredBoard(initialCourseSessions(facts, 'da'), facts)
    expect(next?.authoredBoardId).toBe(boards.firstBoard.boardId)
  })

  it('carry a form and an audio slug for every word', () => {
    for (const board of [boards.practice, boards.firstBoard]) {
      expect(board.forms).toHaveLength(board.wordIds.length)
      expect(board.slugs).toHaveLength(board.wordIds.length)
      for (const slug of board.slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  // The Worker's board lock and the audio allowlist read this file; it must be
  // exactly what the app deals. WRITE_WEB_DEMO_BOARDS=1 regenerates it.
  it(`is pinned byte for byte in ${PINNED}`, () => {
    const expected = `${JSON.stringify(boards, null, 2)}\n`
    const envVar = (name: string) => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
    if (envVar('WRITE_WEB_DEMO_BOARDS') === '1') writeFileSync(PINNED, expected)
    expect(readFileSync(PINNED, 'utf8').replace(/\r\n/g, '\n')).toBe(expected)
  })
})
