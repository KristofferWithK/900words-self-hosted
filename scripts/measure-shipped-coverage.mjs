// How much of spoken Danish the SHIPPED inventory covers — the 900 card
// headwords in src/data/words.da.json plus the 252 support forms in
// src/data/function-words.da.json — measured against the three frozen
// conversation corpora whose per-lemma counts are in the repository
// (docs/spoken-coverage-word-ranking.da.csv, produced by
// scripts/rank-spoken-vocabulary.py from docs/80-percent-research/data/*).
//
// This answers the question the app's first line makes a claim about:
// "900 words can cover 80% of everyday spoken Danish." The counts are
// lemma-aware (exact form, Stanza lemma, or an approved spoken equivalence
// such as ik => ikke), which is the rule that matches how the course teaches
// a word — a headword plus its inflections in the Guide — and the
// denominator is every running token of each corpus, filled pauses included.
// The older V1 claim pack measured exact surface forms only, on two of the
// corpora, and got 77–79% for the same inventory; that is the stricter rule,
// not a different inventory.
//
//   node scripts/measure-shipped-coverage.mjs
//
// Refuses to report if the CSV's `card` rows are not exactly the shipped 900
// forms, so a dataset change cannot quietly leave the number describing an
// older inventory.
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const normal = (value) => value.normalize('NFC').toLocaleLowerCase('da-DK')

const words = JSON.parse(read('src/data/words.da.json'))
const support = JSON.parse(read('src/data/function-words.da.json'))
const shippedCards = new Set(words.map((w) => normal(w.da)))
const shippedSupport = new Set(Object.values(support).flat().map(normal))

const lines = read('docs/spoken-coverage-word-ranking.da.csv').split(/\r?\n/).filter(Boolean)
const header = lines[0].split(',')
const col = (name) => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`ranking CSV has no ${name} column`)
  return i
}
const LEMMA = col('lemma')
const SELECTION = col('selection')
const CORPORA = [
  ['Gigaword spont', col('gigaword_count')],
  ['CoRal conversation', col('coral_count')],
  ['Dideriksen spontaneous', col('dideriksen_count')],
]
const rows = lines.slice(1).map((line) => line.split(','))

const csvCards = new Set(rows.filter((r) => r[SELECTION] === 'card').map((r) => normal(r[LEMMA])))
const csvSupport = new Set(rows.filter((r) => r[SELECTION] === 'support').map((r) => normal(r[LEMMA])))
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))
if (!same(csvCards, shippedCards)) {
  console.error(`the ranking CSV's card rows (${csvCards.size}) are not the shipped 900 — rerun the ranking before quoting a number`)
  process.exit(1)
}
if (!same(csvSupport, shippedSupport)) {
  console.error(`the ranking CSV's support rows (${csvSupport.size}) are not the shipped support forms (${shippedSupport.size})`)
  process.exit(1)
}

// The CSV lists every lemma the corpora contain, so the column sums are the
// corpora's running-token totals (cross-checked against runningTokens in
// docs/80-percent-research/data/*.pos-counts.da.json: 639,485 / 95,380 / 166,211).
const KNOWN_TOTALS = { 'Gigaword spont': 639_485, 'CoRal conversation': 95_380, 'Dideriksen spontaneous': 166_211 }
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`
const results = []
for (const [name, i] of CORPORA) {
  let total = 0
  let cards = 0
  let sup = 0
  let fillers = 0
  for (const r of rows) {
    const n = Number(r[i]) || 0
    total += n
    if (r[SELECTION] === 'card') cards += n
    else if (r[SELECTION] === 'support') sup += n
    if (/^(øh+e?|æh+|hm+|mm+|nåh?|ah+)$/.test(normal(r[LEMMA]))) fillers += n
  }
  if (total !== KNOWN_TOTALS[name]) {
    console.error(`${name}: CSV sums to ${total} tokens, expected ${KNOWN_TOTALS[name]} — the CSV or the aggregates changed`)
    process.exit(1)
  }
  results.push({ name, total, cards, sup, fillers })
}

console.log('Shipped inventory (900 cards + 252 support forms), lemma-aware, all running tokens:')
for (const { name, total, cards, sup, fillers } of results) {
  console.log(
    `  ${name.padEnd(24)} ${String(total).padStart(7)} tokens · cards ${pct(cards, total)} · cards+support ${pct(cards + sup, total)} · without filled pauses ${pct(cards + sup, total - fillers)}`,
  )
}
const low = Math.min(...results.map((r) => (100 * (r.cards + r.sup)) / r.total))
const high = Math.max(...results.map((r) => (100 * (r.cards + r.sup)) / r.total))
console.log(`  range across the three corpora: ${low.toFixed(1)}–${high.toFixed(1)}%`)
