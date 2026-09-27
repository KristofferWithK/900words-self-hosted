/**
 * Precomputes the finite clue/word score surface used by BQ1 certification.
 * The Worker still runs the exact route solver; this removes only repeated
 * evaluator work from a cold request. Generated files stay server-only.
 *
 *   node scripts/generate-deal-index.mjs
 *   node scripts/generate-deal-index.mjs --check
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildEvaluator } from '../proxy/casey/evaluator-core.js'
import { checkClueLegality } from '../proxy/casey/language.js'

const CHECK = process.argv.includes('--check')
const DATA = join(process.cwd(), 'proxy', 'data')
const matrices = readdirSync(DATA)
  .map((name) => /^matrix\.da\.(\d+)\.json$/.exec(name))
  .filter(Boolean)
  .map((match) => Number(match[1]))
  .sort((a, b) => a - b)

if (matrices.length === 0) throw new Error('no Danish evaluator shards found')

const read = (name) => JSON.parse(readFileSync(join(DATA, name), 'utf8'))
const words = new Map(
  JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'words.da.json'), 'utf8')).map((word) => [word.id, word]),
)
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function clueForms(matrix, book) {
  const forms = new Set(matrix.ids.map((id) => id.slice(id.indexOf(':') + 1)))
  const add = (entry) => {
    forms.add(entry.da)
    forms.add(entry.en)
  }
  for (const word of Object.values(book.words)) for (const entry of word.assoc) add(entry)
  for (const entries of Object.values(book.pairs)) for (const entry of entries) add(entry)
  return [...forms].sort(order)
}

let stale = false
for (const city of matrices) {
  const matrix = read(`matrix.da.${city}.json`)
  const book = read(`book.da.${city}.json`)
  const evaluator = buildEvaluator(matrix, book)
  const forms = clueForms(matrix, book)
  const cells = new Uint8Array(Math.ceil((forms.length * matrix.ids.length) / 2))
  const illegal = new Uint8Array(Math.ceil((forms.length * matrix.ids.length) / 8))
  let at = 0
  for (const form of forms) {
    for (const id of matrix.ids) {
      const doubled = evaluator.sim(form, id) * 2
      if (!Number.isInteger(doubled) || doubled < 0 || doubled > 15) {
        throw new Error(`deal score cannot be nibble-packed: city ${city}, ${form}, ${id}, ${doubled / 2}`)
      }
      if (at & 1) cells[at >> 1] |= doubled << 4
      else cells[at >> 1] = doubled
      const word = words.get(id)
      if (!word) throw new Error(`deal index city ${city} has unknown word ${id}`)
      if (!checkClueLegality(form, [word]).legal) illegal[at >> 3] |= 1 << (at & 7)
      at++
    }
  }
  const doc = {
    protocol: 1,
    lang: 'da',
    city,
    ids: matrix.ids,
    forms,
    data: Buffer.from(cells).toString('base64'),
    illegal: Buffer.from(illegal).toString('base64'),
  }
  const content = `${JSON.stringify(doc)}\n`
  const name = `deal-index.da.${city}.json`
  const path = join(DATA, name)
  const current = (() => {
    try {
      return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    } catch {
      return null
    }
  })()
  if (CHECK) {
    if (current !== content) {
      console.error(`${name} is stale; run node scripts/generate-deal-index.mjs`)
      stale = true
    }
  } else {
    writeFileSync(path, content)
  }
  const gzipKb = (gzipSync(content).byteLength / 1024).toFixed(1)
  console.log(`${name}: ${forms.length} forms × ${matrix.ids.length} words (${gzipKb} KB gzip)`)
}

if (stale) process.exit(1)
