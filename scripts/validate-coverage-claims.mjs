import { validateCity1Import } from './city1-content.mjs'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readCoverageClaims, validateCoverageClaims } from './coverage-claims-lib.mjs'

const defaultLedger = fileURLToPath(new URL('../docs/coverage-claims.v1.json', import.meta.url))
const cardsPath = fileURLToPath(new URL('../src/data/words.da.json', import.meta.url))
const supportPath = fileURLToPath(new URL('../src/data/function-words.da.json', import.meta.url))
const ledgerPath = process.argv[2] ?? defaultLedger
const ledger = readCoverageClaims(ledgerPath)
const errors = validateCoverageClaims(ledger)

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const normal = (value) => value.normalize('NFC').toLocaleLowerCase('da-DK')
const words = JSON.parse(readFileSync(cardsPath, 'utf8'))
// The instructional corpus remains the exact frozen research input.
// The accepted City1 presentation bank has independent provenance.
await validateCity1Import(words)
const frozenCardHash = createHash('sha256').update(JSON.stringify(words, null, 2) + '\n').digest('hex').toUpperCase()
const supportGroups = JSON.parse(readFileSync(supportPath, 'utf8'))
const cards = new Set(words.map((word) => normal(word.da)))
const support = new Set(Object.values(supportGroups).flat().map(normal))
const course = new Set([...cards, ...support])

if (frozenCardHash !== ledger.inventoryFreeze.cards.sha256) errors.push('current card inventory hash differs from the frozen claim inventory')
if (frozenCardHash !== ledger.inventoryFreeze.course.cardsSha256) errors.push('course card hash differs from the frozen claim inventory')
if (sha256(supportPath) !== ledger.inventoryFreeze.course.supportSha256) errors.push('current support inventory hash differs from the frozen claim inventory')
if (cards.size !== ledger.inventoryFreeze.cards.forms) errors.push('current distinct card-form count differs from the ledger')
if (support.size !== ledger.inventoryFreeze.course.supportForms) errors.push('current distinct support-form count differs from the ledger')
if (course.size !== ledger.inventoryFreeze.course.forms) errors.push('current distinct course-form count differs from the ledger')
const ranks = words.map((word) => word.curriculumRank).sort((a, b) => a - b)
if (ranks.length !== 900 || ranks.some((rank, index) => rank !== index + 1)) errors.push('curriculumRank is not the exact 1–900 prefix order required by derivative methods')

if (errors.length > 0) {
  console.error(`Coverage claim ledger failed (${errors.length}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`OK — ${ledger.ledgerVersion}: four atomic measurements, denominator-honest derivatives, four count answers and wording references agree; City1 original100 + extension76 independent presentation verified; original instructional corpus preserved.`)
