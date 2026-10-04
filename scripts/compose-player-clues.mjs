/**
 * Derive the PLAYER's key for every authored City 1 board, where Casey's
 * server can read it:
 *
 *   proxy/data/authored-player-keys.da.1.json
 *
 * The owner's call (2026-09-06): a player who gives a clue this board was
 * made for should have Casey guess it with certainty. The bank shipped
 * Casey's clue groups and nothing for the player's seat, and the research
 * bank that might carry a player graph is not in the repo. What IS in the
 * repo is the index the bank was composed from — the private replacement
 * City 1 association index — so the player's "clues this board was made for"
 * are decided LIVE on the Worker from that index and the player's key
 * (proxy/casey/authored-player-clues.js): an indexed clue that reaches two
 * or more of the player's greens on this board and links to nothing else on
 * it. A first draft precomputed those groups into a file; it came to 41,780
 * rows and 6 MB for what is one lookup against data the Worker already
 * holds, so this file carries only what the Worker lacks — which board has
 * which player key.
 *
 * THIS FILE CARRIES THE PLAYER'S KEY. It stays under proxy/data (Worker-
 * private, never bundled into the client), is read by the guess path only,
 * and is never placed in any prompt. That is a deliberate hole in the
 * "no key of any kind on the guess side" firewall, taken on the owner's
 * call and recorded in DECISIONS.md.
 *
 * Deterministic: the cycle file's ids and keys, nothing else, and
 * authored-player-clues.test.mjs re-derives in memory and compares, so a
 * stale file fails a test rather than a round.
 *
 * Usage:
 *   node scripts/compose-player-clues.mjs           write the file
 *   node scripts/compose-player-clues.mjs --check   exit 1 if it would change
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CYCLE = 'src/data/city1-board-cycle.da.json'
const APPENDIX = 'src/data/city1-board-cycle-appendix.da.json'
const OUT = 'proxy/data/authored-player-keys.da.1.json'

/** The archive and the boards appended after it, as one cycle (see city1BoardCycle.ts). */
export function readFullCycle() {
  const cycle = JSON.parse(readFileSync(resolve(CYCLE), 'utf8'))
  let appendix = { boards: [] }
  try { appendix = JSON.parse(readFileSync(resolve(APPENDIX), 'utf8')) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  return { ...cycle, boards: [...cycle.boards, ...appendix.boards] }
}

export function derivePlayerKeys(cycle = readFullCycle()) {
  const boards = cycle.boards.map((board) => {
    const onBoard = new Set(board.wordIds)
    if (onBoard.size !== board.wordIds.length) throw new Error(`${board.id} repeats a word`)
    for (const id of board.playerGreenIds) {
      if (!onBoard.has(id)) throw new Error(`${board.id} has a player green off the board: ${id}`)
    }
    return { id: board.id, wordIds: [...board.wordIds], playerGreenIds: [...board.playerGreenIds] }
  })
  return {
    schemaVersion: 1,
    note: `The PLAYER's key per authored City 1 board, derived by scripts/compose-player-clues.mjs from city1-board-cycle.da.json (source sha256 ${cycle.sourceSha256}). Read by the guess lookup only (proxy/casey/authored-player-clues.js); never shown to a model. THIS FILE CARRIES THE PLAYER'S KEY and must stay Worker-private.`,
    sourceSha256: cycle.sourceSha256,
    boards,
  }
}

export const renderPlayerKeys = (document) => `${JSON.stringify(document, null, 2)}\n`

// fileURLToPath, not URL.pathname: on Windows the pathname is /C:/..., which never
// equals a resolved argv path, and the script used to do nothing there.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const text = renderPlayerKeys(derivePlayerKeys())
  if (process.argv.includes('--check')) {
    let current = null
    try {
      current = readFileSync(resolve(OUT), 'utf8')
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error(`${OUT} is stale — run node scripts/compose-player-clues.mjs`)
      process.exit(1)
    }
    console.log(`${OUT} is current`)
  } else {
    writeFileSync(resolve(OUT), text, 'utf8')
    console.log(`wrote ${OUT}`)
  }
}
