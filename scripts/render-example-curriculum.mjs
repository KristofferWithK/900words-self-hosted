import { validateCity1Import, validateCity1Presentation } from './city1-content.mjs'
/** Generate the machine-readable T3 index from the exact bilingual corpus. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const ROOT = process.cwd()
const WORDS_PATH = new URL('../src/data/words.da.json', import.meta.url)
const INDEX_PATH = new URL('../src/data/example-curriculum.da.json', import.meta.url)
const check = process.argv.includes('--check')
const acceptedReview = process.argv.includes('--accept-sol-review')

if (!check && !acceptedReview) {
  console.error('Refusing to stamp a Sol-reviewed sidecar without --accept-sol-review; use --check after the review freeze.')
  process.exit(1)
}

const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const { buildDanishExampleIndex } = await server.ssrLoadModule('/src/lang/da/example-curriculum.ts')
  const { danishCurriculumContent } = await server.ssrLoadModule('/src/lang/da/curriculum-content.ts')
  const words = JSON.parse(readFileSync(WORDS_PATH, 'utf8'))
  await validateCity1Import(words)
  const { examplePresentation } = await server.ssrLoadModule('/src/review/examplePresentation.ts')
  validateCity1Presentation(words, examplePresentation)
  const rendered = `${JSON.stringify(buildDanishExampleIndex(words, danishCurriculumContent), null, 2)}\n`

  if (check) {
    const actual = readFileSync(INDEX_PATH, 'utf8')
    // Git may check this large generated JSON out with CRLF on Windows. Its
    // source fingerprints already bind the meaningful text; a platform line
    // ending must not turn a frozen, otherwise identical index into a false
    // stale-corpus failure.
    if (actual.replaceAll('\r\n', '\n') !== rendered) {
      console.error('src/data/example-curriculum.da.json is stale; run npm run render:examples')
      process.exit(1)
    }
    console.log('historical example index matches its exact 900 instructional pairs; City1 original100 + extension76 independent board presentation acceptance and contextual adapter pass')
  } else {
    writeFileSync(INDEX_PATH, rendered)
    console.log('wrote src/data/example-curriculum.da.json')
  }
} finally {
  await server.close()
}
