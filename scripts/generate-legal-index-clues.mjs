#!/usr/bin/env node
/**
 * Precompute which clues of the private association index are ILLEGAL
 * against each authored City 1 board:
 *
 *   proxy/data/legal-index-clues.da.1.json
 *
 * Why this exists (2026-09-07): a City 1 clue request made Casey's server run
 * checkClueLegality over all 7,595 index clues against the board's eighteen
 * words — about one second of CPU per new board, measured in the real Worker
 * bundle — because which index clues are legal depends on the board's words
 * and nothing else. Every ordinary City 1 round is one of the bank's 150
 * boards, so the answer for all of them can be worked out here, once, and the
 * Worker looks it up: the same set, for about a millisecond. A board the file
 * does not know (a daily or seeded deal) still computes its own.
 *
 * The file stores the ILLEGAL clue positions (in the index's own clue order)
 * because there are few of them — a clue is illegal when it is a board word,
 * a form, a compound or a translation of one — and lists the board by the
 * same sorted word-id key the Worker's cache uses. It pins the index it was
 * derived from by the index's own source sha, so a regenerated index without
 * a regenerated file fails closed to the computed path rather than trusting
 * stale positions.
 *
 * Deterministic: the index, the bank and the dataset, nothing else. `--check`
 * verifies the pins and the whole file's shape and re-derives a sample of
 * boards (`--full` re-derives all 150, about two minutes).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { checkClueLegality } from '../proxy/casey/language.js'

export const INDEX_PATH = 'proxy/data/association-index.da.1.json'
export const BANK_PATH = 'proxy/data/authored-clues.da.1.json'
export const WORDS_PATH = 'src/data/words.da.json'
export const OUT_PATH = 'proxy/data/legal-index-clues.da.1.json'

const NOTE =
  'Illegal association-index clue positions per authored City 1 board, by sorted word-id key. Derived by scripts/generate-legal-index-clues.mjs; Worker-private.'

/** The board's sorted word-id key — the same key proxy/casey/association-index.js caches by. */
export const boardKey = (wordIds) => [...wordIds].sort().join('|')

export function illegalPositionsFor(index, boardWords) {
  const illegal = []
  index.clues.forEach(([clue], position) => {
    if (!checkClueLegality(clue, boardWords).legal) illegal.push(position)
  })
  return illegal
}

export function deriveLegalIndexClues({ index, bank, words }, boardIds = null, check = checkClueLegality) {
  const byId = new Map(words.map((word) => [word.id, word]))
  const selectedBoards = bank.boards.filter((board) => !boardIds || boardIds.has(board.id))
  const illegalByWord = new Map()
  for (const board of selectedBoards) {
    for (const id of board.wordIds) {
      if (illegalByWord.has(id)) continue
      const word = byId.get(id)
      if (!word) throw new Error(`${board.id} names ${id}, which is not in the dataset`)
      const boardWord = { da: word.da, en: word.en, pos: word.pos }
      const illegal = new Set()
      index.clues.forEach(([clue], position) => {
        if (!check(clue, [boardWord]).legal) illegal.add(position)
      })
      illegalByWord.set(id, illegal)
    }
  }

  const boards = selectedBoards.map((board) => {
    const illegal = new Set()
    for (const id of board.wordIds) {
      for (const position of illegalByWord.get(id)) illegal.add(position)
    }
    return {
      board: board.id,
      wordKey: boardKey(board.wordIds),
      illegal: [...illegal].sort((a, b) => a - b),
    }
  })
  const wordLegality = [...illegalByWord]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([id, illegal]) => {
      const word = byId.get(id)
      return {
        word: id,
        da: word.da,
        pos: word.pos ?? null,
        illegal: [...illegal].sort((a, b) => a - b),
      }
    })
  return {
    protocol: 1,
    lang: 'da',
    note: NOTE,
    source: { associationIndexSha256: index.source.sha256, bankBoards: bank.boards.length },
    clueCount: index.clues.length,
    wordLegality,
    boards,
  }
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))

function main(argv) {
  const check = argv.includes('--check')
  const full = argv.includes('--full')
  const inputs = { index: read(INDEX_PATH), bank: read(BANK_PATH), words: read(WORDS_PATH) }
  if (!check) {
    const doc = deriveLegalIndexClues(inputs)
    writeFileSync(OUT_PATH, `${JSON.stringify(doc)}\n`)
    const counts = doc.boards.map((board) => board.illegal.length).sort((a, b) => a - b)
    console.log(
      `wrote ${OUT_PATH}: ${doc.boards.length} boards, ${doc.clueCount} index clues; illegal per board min ${counts[0]}, median ${counts[counts.length >> 1]}, max ${counts[counts.length - 1]}`,
    )
    return 0
  }
  const current = read(OUT_PATH)
  const problems = []
  if (current.protocol !== 1 || current.lang !== 'da') problems.push('protocol or lang')
  if (current.source?.associationIndexSha256 !== inputs.index.source.sha256) problems.push('index sha pin')
  if (current.clueCount !== inputs.index.clues.length) problems.push('clue count')
  if (current.boards?.length !== inputs.bank.boards.length) problems.push('board count')
  const byBoard = new Map((current.boards ?? []).map((board) => [board.board, board]))
  const byWord = new Map((current.wordLegality ?? []).map((word) => [word.word, word]))
  const expectedWordIds = new Set(inputs.bank.boards.flatMap((board) => board.wordIds))
  if (byWord.size !== (current.wordLegality ?? []).length || byWord.size !== expectedWordIds.size) {
    problems.push('word legality count')
  }
  for (const id of expectedWordIds) {
    const expected = inputs.words.find((word) => word.id === id)
    const have = byWord.get(id)
    if (!expected || !have || have.da !== expected.da || (have.pos ?? null) !== (expected.pos ?? null)) {
      problems.push(`${id} word descriptor`)
    }
    if (!Array.isArray(have?.illegal) || have.illegal.some((position) => !Number.isInteger(position) || position < 0 || position >= inputs.index.clues.length)) {
      problems.push(`${id} illegal positions shape`)
    }
  }
  for (const board of inputs.bank.boards) {
    const row = byBoard.get(board.id)
    if (!row || row.wordKey !== boardKey(board.wordIds)) problems.push(`${board.id} word key`)
  }
  // A deterministic sample: every fifteenth board, or all of them with --full.
  const sample = new Set(inputs.bank.boards.filter((_, i) => full || i % 15 === 0).map((board) => board.id))
  const derived = deriveLegalIndexClues(inputs, sample)
  for (const word of derived.wordLegality) {
    const have = byWord.get(word.word)
    if (!have || have.da !== word.da || have.pos !== word.pos || JSON.stringify(have.illegal) !== JSON.stringify(word.illegal)) {
      problems.push(`${word.word} illegal positions differ`)
    }
  }
  for (const row of derived.boards) {
    const have = byBoard.get(row.board)
    if (!have || JSON.stringify(have.illegal) !== JSON.stringify(row.illegal)) problems.push(`${row.board} illegal positions differ`)
  }
  if (problems.length) {
    console.error(`${OUT_PATH} is stale: ${problems.join('; ')}. Run node scripts/generate-legal-index-clues.mjs`)
    return 1
  }
  console.log(`${OUT_PATH} matches (${sample.size} boards re-derived${full ? ', all' : ''})`)
  return 0
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  process.exit(main(process.argv.slice(2)))
}
