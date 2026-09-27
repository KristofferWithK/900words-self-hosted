/** Validate generated canonical grammar documents against accepted live data. */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { grammarDocumentStats, renderGrammarDocument, renderGrammarHtml } from './grammar-document.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const documents = [
  ['docs/grammar-da.md', renderGrammarDocument()],
  ['docs/grammar-da.html', renderGrammarHtml()],
]
const problems = []

for (const [fileName, expected] of documents) {
  const actual = readFileSync(resolve(ROOT, fileName), 'utf8')
  if (actual !== expected) problems.push(`${fileName} differs from the accepted source; run npm run render:grammar`)
}

const doc = documents[0][1]
if (/^## \d+ · Leaving /m.test(doc)) problems.push('canonical document contains a departure-owned chapter heading')
if ((doc.match(/^## \d+ · /gm) ?? []).length !== 9) problems.push('canonical document does not contain nine destination chapters')

if (problems.length > 0) {
  console.error(`${problems.length} grammar document problem${problems.length === 1 ? '' : 's'}:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

const stats = grammarDocumentStats()
console.log(`destination grammar · ${stats.chapters} accepted chapters · ${stats.lessons} reader lessons · ${stats.examples} translated examples · documents match source bytes`)
