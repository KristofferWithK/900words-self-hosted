/**
 * Exact-form coverage of a Danish transcript corpus by the 900words inventory.
 *
 * This is deliberately a local counter, not an AI judgement: it lowercases
 * NFC-normalised transcript text, removes transcript speaker labels, then asks
 * whether each running word is one of the frozen word forms. It cannot turn
 * `huset` into `hus`, guess compounds, or claim that a learner knows a word.
 * Those are separate, explicitly labelled later analyses.
 *
 * Usage:
 *   node scripts/measure-spoken-coverage.mjs --input corpus.jsonl
 *   node scripts/measure-spoken-coverage.mjs --input corpus.json --text-field text
 *   node scripts/measure-spoken-coverage.mjs --input corpus.jsonl --with-support --out report.json
 *
 * Input is either a JSON array or JSON Lines. Each document needs the field
 * named by --text-field (default: text). A plain-text file is also accepted,
 * one document per line. Keep downloaded transcripts outside the repository:
 * source corpus terms, not git, govern those files.
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? null : args[at + 1] ?? null
}
const input = option('--input')
const textField = option('--text-field') ?? 'text'
const output = option('--out')
const withSupport = args.includes('--with-support')

if (args.includes('--help') || !input) {
  console.log('Usage: node scripts/measure-spoken-coverage.mjs --input <corpus.jsonl|json|txt> [--text-field text] [--with-support] [--out report.json]')
  process.exit(args.includes('--help') ? 0 : 1)
}

const words = JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url), 'utf8'))
const supportGroups = JSON.parse(
  readFileSync(new URL('../src/data/function-words.da.json', import.meta.url), 'utf8'),
)
const normal = (value) => value.normalize('NFC').toLocaleLowerCase('da-DK')
const cardWords = new Set(words.map((word) => normal(word.da)))
const supportWords = new Set(Object.values(supportGroups).flat().map(normal))
const inventory = new Set([...cardWords, ...(withSupport ? supportWords : [])])

// A transcript may prefix a turn with "Taler 6:". It is metadata, not Danish
// speech, so remove only that prefix at the start of a line. All remaining
// lexical tokens, including filled pauses if they are alphabetic, remain in
// the denominator.
const transcript = (text) => String(text).replace(/^\s*(?:taler|speaker)\s+[^:\n]+:\s*/gimu, '')
const tokens = (text) => transcript(text).normalize('NFC').match(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu) ?? []

let documents = 0
let totalTokens = 0
let coveredTokens = 0
const frequencies = new Map()
const coveredForms = new Set()

const count = (text) => {
  documents++
  for (const raw of tokens(text)) {
    const word = normal(raw)
    totalTokens++
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
    if (inventory.has(word)) {
      coveredTokens++
      coveredForms.add(word)
    }
  }
}

const textFrom = (value) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value[textField] === 'string') return value[textField]
  return null
}

if (input.toLowerCase().endsWith('.json')) {
  const value = JSON.parse(readFileSync(input, 'utf8'))
  const documentsInFile = Array.isArray(value) ? value : [value]
  for (const document of documentsInFile) {
    const text = textFrom(document)
    if (text !== null) count(text)
  }
} else {
  const lines = createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.trim()) continue
    let value = line
    try { value = JSON.parse(line) } catch { /* plain text is a supported input */ }
    const text = textFrom(value)
    if (text !== null) count(text)
  }
}

const pct = (part, whole) => whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(3))
const outside = [...frequencies.entries()]
  .filter(([word]) => !inventory.has(word))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'da'))
  .slice(0, 30)
  .map(([word, count]) => ({ word, count }))
const report = {
  method: 'exact NFC-normalised word-form coverage; no lemmatisation, inflection, or compound credit',
  input,
  textField,
  documents,
  runningTokens: totalTokens,
  inventory: withSupport ? '900 cards + 252 support-ledger forms' : '900 card headwords',
  inventoryForms: inventory.size,
  coveredTokens,
  coveragePercent: pct(coveredTokens, totalTokens),
  coveredInventoryForms: coveredForms.size,
  inventoryFormPercent: pct(coveredForms.size, inventory.size),
  mostFrequentOutsideInventory: outside,
}

console.log(JSON.stringify(report, null, 2))
if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
