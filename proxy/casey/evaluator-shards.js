import matrix1Raw from '../data/matrix.da.1.json'
import matrix2Raw from '../data/matrix.da.2.json'
import matrix9Raw from '../data/matrix.da.9.json'
import book1Raw from '../data/book.da.1.json'
import book2Raw from '../data/book.da.2.json'
import book9Raw from '../data/book.da.9.json'
import dealIndex1Raw from '../data/deal-index.da.1.json'
import dealIndex2Raw from '../data/deal-index.da.2.json'
import dealIndex9Raw from '../data/deal-index.da.9.json'

/**
 * Which authored city shards this build of Casey carries, as raw imports
 * (evaluator.js parses them). The Worker carries every authored city. The
 * native app's on-device Casey swaps this module for
 * `evaluator-shards.city1.js` (vite.config.ts, on-device Casey builds only), so the app
 * bundle holds City 1 — the only city a player can reach — and no other
 * city's book or deal index; scripts/validate-client-boundary.mjs refuses a
 * native build that carries one, and a build without her that carries any.
 */
export const MATRIX_FILES = new Map([
  [1, matrix1Raw],
  [2, matrix2Raw],
  [9, matrix9Raw],
])

export const SHARD_FILES = new Map([
  [1, [book1Raw, dealIndex1Raw]],
  [2, [book2Raw, dealIndex2Raw]],
  [9, [book9Raw, dealIndex9Raw]],
])
