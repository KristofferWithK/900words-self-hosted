import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = process.argv[2]
if (!sourcePath) {
  throw new Error('usage: node scripts/import-city1-board-cycle.mjs <research-boards.json>')
}

const sourceBytes = readFileSync(resolve(sourcePath))
const source = JSON.parse(sourceBytes.toString('utf8'))
if (!Array.isArray(source.allBoards) || source.allBoards.length === 0) {
  throw new Error('research artifact must contain a non-empty allBoards array')
}

const ids = new Set()
const boards = source.allBoards.map((board, index) => {
  const id = `board_${String(index + 1).padStart(2, '0')}`
  if (ids.has(id)) throw new Error(`duplicate production board id: ${id}`)
  ids.add(id)

  if (!/^[0-9a-f]{64}$/.test(board.generationSeed)) {
    throw new Error(`board at index ${index} has an invalid generation seed`)
  }
  if (board.scheduledStarter !== 'player' && board.scheduledStarter !== 'casey') {
    throw new Error(`board at index ${index} has an invalid scheduled starter`)
  }
  if (![1, 2, 3].includes(board.actualOverlap)) {
    throw new Error(`board at index ${index} has an invalid overlap`)
  }

  return {
    id,
    seedHex: board.generationSeed.slice(0, 8),
    firstGiver: board.scheduledStarter === 'casey' ? 'ai' : 'player',
    greenOverlap: board.actualOverlap,
    wordIds: board.boardWordIds,
    playerGreenIds: board.playerKeyWordIds,
    aiGreenIds: board.caseyKeyWordIds,
  }
})

const output = {
  schemaVersion: 1,
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  boards,
}

writeFileSync(
  resolve('src/data/city1-board-cycle.da.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
)
console.log(`wrote ${boards.length} City 1 boards from ${output.sourceSha256}`)
