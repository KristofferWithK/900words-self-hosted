import { validateCity1Import } from './city1-content.mjs'
/** Validate T3's exact-text sidecar and print the curriculum coverage ledger. */
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const ROOT = process.cwd()
const words = JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url), 'utf8'))
const generated = process.argv.includes('--generated')
const committedIndex = generated
  ? null
  : JSON.parse(readFileSync(new URL('../src/data/example-curriculum.da.json', import.meta.url), 'utf8'))

const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const { buildDanishExampleIndex, validateDanishExampleIndex, T3_CITY_TARGETS } = await server.ssrLoadModule('/src/lang/da/example-curriculum.ts')
  const { danishCurriculumContent } = await server.ssrLoadModule('/src/lang/da/curriculum-content.ts')
  await validateCity1Import(words)
  const historical = validateDanishExampleIndex(committedIndex ?? buildDanishExampleIndex(words, danishCurriculumContent), words, danishCurriculumContent)
  if (historical.errors.length) throw Error(historical.errors.join('\n'))
  // Evaluate present-day coverage without rewriting the historical Sol artifact.
  const index = buildDanishExampleIndex(words, danishCurriculumContent)
  const report = validateDanishExampleIndex(index, words, danishCurriculumContent)

  console.log(`Danish examples · ${report.examples} exact bilingual rows · original instructional corpus, exact historical Sol evidence; City1 board presentation accepted separately`)
  console.log(`  level path: A1 ${report.byLevel.a1} · A2 ${report.byLevel.a2}`)
  console.log(
    `  rows carrying target roles: receptive ${report.byRole.receptive} · ` +
    `controlled ${report.byRole.controlled} · productive ${report.byRole.productive}`,
  )
  console.log('  city structure coverage:')
  for (const city of report.cities) {
    console.log(
      `    ${city.city + 1}: ${city.cityTargetHits}/${city.examples} ` +
      `(floor ${city.cityTargetFloor}) · ${T3_CITY_TARGETS[city.city].label}`,
    )
  }

  const requiredLedger = report.ledger.filter((row) => row.target !== 'ambient')
  const passingLedger = requiredLedger.filter((row) =>
    row.meaningfulInputs >= row.meaningfulInputFloor &&
    row.distinctTemplates >= row.distinctTemplateFloor &&
    row.lexicalFamilies >= row.lexicalFamilyFloor,
  )
  const passingSupplemental = report.supplemental.filter((row) =>
    row.meaningfulInputs >= row.meaningfulInputFloor &&
    row.distinctTemplates >= row.distinctTemplateFloor &&
    row.lexicalFamilies >= row.lexicalFamilyFloor,
  )
  const passingFunctions = report.functions.filter((row) => row.meaningfulInputs >= row.meaningfulInputFloor)
  console.log(
    `  required support: ledger ${passingLedger.length}/${requiredLedger.length} · ` +
    `sentence-only ${passingSupplemental.length}/${report.supplemental.length} · ` +
    `functions ${passingFunctions.length}/${report.functions.length}`,
  )
  console.log(
    '  ambient/deferred (reported, never gated): ' +
    report.ambientObserved.map((row) => `${row.id} ${row.occurrences}`).join(' · '),
  )

  const allCoverage = [...requiredLedger, ...report.supplemental]
  const thinnest = allCoverage
    .map((row) => ({
      ...row,
      inputMargin: row.meaningfulInputs - row.meaningfulInputFloor,
      templateMargin: row.distinctTemplates - row.distinctTemplateFloor,
    }))
    .sort((left, right) => left.inputMargin - right.inputMargin || left.templateMargin - right.templateMargin || left.id.localeCompare(right.id))
    .slice(0, 12)
  console.log('  twelve thinnest required targets:')
  for (const row of thinnest) {
    console.log(
      `    ${row.id}: input ${row.meaningfulInputs}/${row.meaningfulInputFloor} · ` +
      `templates ${row.distinctTemplates}/${row.distinctTemplateFloor}` +
      (row.lexicalFamilyFloor ? ` · families ${row.lexicalFamilies}/${row.lexicalFamilyFloor}` : ''),
    )
  }

  if (report.errors.length > 0) {
    console.error(`\n${report.errors.length} example-curriculum problem${report.errors.length === 1 ? '' : 's'}:`)
    for (const error of report.errors) console.error(`  ${error}`)
    process.exit(1)
  }
  console.log('OK — text fingerprints, structural tags, city/level/role coverage and target-specific floors agree.')
} finally {
  await server.close()
}
