import matrix1Raw from '../data/matrix.da.1.json'
import book1Raw from '../data/book.da.1.json'
import dealIndex1Raw from '../data/deal-index.da.1.json'

/**
 * The native app's on-device Casey carries City 1 only: vite.config.ts
 * resolves `./evaluator-shards.js` to this file in the native builds that
 * carry on-device Casey (developer and normal). A board
 * from any other city finds no shard and is played exactly as the Worker
 * plays an unauthored board. Keep the export shape identical to
 * evaluator-shards.js.
 */
export const MATRIX_FILES = new Map([[1, matrix1Raw]])

export const SHARD_FILES = new Map([[1, [book1Raw, dealIndex1Raw]]])
