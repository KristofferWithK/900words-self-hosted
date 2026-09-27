import { attachDealIndex, buildEvaluator } from './evaluator-core.js'
import { MATRIX_FILES, SHARD_FILES } from './evaluator-shards.js'
import { isOpenFor } from './projections.js'

export { buildEvaluator, TWO_HOP_DISCOUNT } from './evaluator-core.js'

const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)

/**
 * The matrices are tiny (5 KB a city) and say which words a city holds, so
 * they are read at start-up. The books and deal indexes (about 1.2 MB a city)
 * are parsed on the first request that needs THAT city: parsing all three
 * cities at import was most of a 310 ms start-up measured in the real Worker
 * bundle (2026-09-07), against Cloudflare's 400 ms start-up CPU limit, for
 * shards a City 1 round never reads. A killed isolate answers with an error
 * page that carries no CORS headers, which the phone reports as a dropped
 * connection. Which cities exist at all is evaluator-shards.js's business.
 */
const MATRICES = new Map([...MATRIX_FILES].map(([city, raw]) => [city, readAsset(raw)]))
const CITY_OF_WORD = new Map()
for (const [city, matrix] of MATRICES) {
  for (const id of matrix.ids) CITY_OF_WORD.set(id, city)
}

export const authoredCities = Object.freeze([...MATRICES.keys()].sort((a, b) => a - b))

/** Which authored city shard holds a word, or null: read off the matrices, no book parsed. */
export const cityOfWord = (wordId) => CITY_OF_WORD.get(wordId) ?? null

const loaded = new Map()

export function loadEvaluator(city = 1) {
  if (loaded.has(city)) return loaded.get(city)
  const matrix = MATRICES.get(city)
  const files = SHARD_FILES.get(city)
  const evaluator =
    matrix && files ? attachDealIndex(buildEvaluator(matrix, readAsset(files[0])), readAsset(files[1])) : null
  loaded.set(city, evaluator)
  return evaluator
}

/** Test seam: which cities have had their shards parsed so far. */
export const loadedCities = () => [...loaded.keys()].filter((city) => loaded.get(city)).sort((a, b) => a - b)

/** Finds a shard from its own ids; journey/replay state never gates this lookup. */
export function evaluatorForBoard(view) {
  const first = view.words[0]?.id
  if (!first) return null
  const city = cityOfWord(first)
  // A city shard advises only on a complete city board. This both keeps the
  // score meaningful and prevents a caller from combining authored and
  // unauthored words into a synthetic evaluator query.
  if (city === null || !view.words.every((word) => cityOfWord(word.id) === city)) return null
  return loadEvaluator(city)
}

export function engineTrapIds(view) {
  return view.words
    .filter((word) => word.roleOnMyKey === 'bystander' && isOpenFor(word.reveal, 'ai'))
    .map((word) => word.id)
}
