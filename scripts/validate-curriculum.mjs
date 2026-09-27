/**
 * Validate a language-owned curriculum manifest and print its coverage ledger.
 *
 * The manifest is TypeScript because a language pack owns it; this script loads
 * the real pack through Vite instead of restating the contract in JavaScript.
 * That makes a changed type, route, or support inventory fail here rather than
 * quietly turning the report into a second source of truth.
 *
 *   node scripts/validate-curriculum.mjs       (Danish, the only shipping pack)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const ROOT = process.cwd()
const argLang = process.argv.indexOf('--lang')
const lang = argLang === -1 ? 'da' : process.argv[argLang + 1]
if (!/^[a-z]{2}$/.test(lang ?? '')) {
  console.error(`--lang must be a two-letter code, got "${lang}"`)
  process.exit(2)
}

const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const { LANGUAGES } = await server.ssrLoadModule('/src/lang/index.ts')
  const { validateCurriculum } = await server.ssrLoadModule('/src/lang/curriculum.ts')
  const { validateCurriculumContent } = await server.ssrLoadModule('/src/lang/curriculum-content.ts')
  const { danishCurriculumContent } = await server.ssrLoadModule('/src/lang/da/curriculum-content.ts')
  if (typeof validateCurriculum !== 'function') {
    throw new Error('src/lang/curriculum.ts no longer exports validateCurriculum()')
  }
  if (typeof validateCurriculumContent !== 'function') {
    throw new Error('src/lang/curriculum-content.ts no longer exports validateCurriculumContent()')
  }
  const pack = LANGUAGES[lang]
  if (!pack?.curriculum || !pack.route) {
    throw new Error(`No shipped ${lang} curriculum pack — the check would pass vacuously`)
  }

  const ledger = JSON.parse(readFileSync(resolve(ROOT, `src/data/function-words.${lang}.json`), 'utf8'))
  const categoryByTerm = new Map()
  for (const [category, terms] of Object.entries(ledger)) {
    if (!Array.isArray(terms) || terms.length === 0) {
      throw new Error(`function-word ledger category "${category}" is empty — coverage would pass vacuously`)
    }
    for (const term of terms) categoryByTerm.set(term, category)
  }
  if (categoryByTerm.size === 0) throw new Error('function-word ledger has no terms — coverage would pass vacuously')

  const report = validateCurriculum(pack.curriculum, pack.route, { ledgerTerms: new Set(categoryByTerm.keys()) })
  if (lang !== 'da' || !danishCurriculumContent) {
    throw new Error(`No authored ${lang} curriculum content — the T6 check would pass vacuously`)
  }
  const contentReport = validateCurriculumContent(
    danishCurriculumContent,
    pack.curriculum,
    { ledgerTerms: new Set(categoryByTerm.keys()) },
  )
  const referenced = new Set(pack.curriculum.supportItems.flatMap((item) => item.ledgerTerms))
  const byCategory = new Map()
  for (const term of referenced) {
    const category = categoryByTerm.get(term)
    if (category) byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
  }

  console.log(`${pack.name} curriculum · ${report.cityCount} cities · ${report.queueCount} post-wrap items`)
  console.log(`  chapters/scenes/exits: ${report.cityCount}/${report.cityCount}/${report.cityCount}`)
  console.log(
    `  support inventory: ${report.supportCount} items ` +
    `(A1 ${report.byLevel.a1}, A2 ${report.byLevel.a2}; ` +
    `receptive ${report.byRole.receptive}, controlled ${report.byRole.controlled}, productive ${report.byRole.productive})`,
  )
  console.log(`  function ledger: ${referenced.size}/${categoryByTerm.size} forms deliberately referenced by the T4 contract`)
  for (const [category, total] of Object.entries(ledger)) {
    console.log(`    ${category}: ${byCategory.get(category) ?? 0}/${total.length}`)
  }
  console.log('  queue shape: every city has five grammar slots followed by four situation slots')
  console.log('  checkpoints: Skagen A1 readiness · København A2 readiness')

  console.log(`  T6 status: ${contentReport.status} · Sol review complete`)
  console.log(
    `  authored route: ${contentReport.capsules} capsules · ${contentReport.exchanges} exchanges · ` +
    `${contentReport.dueReviews} due reviews · ${contentReport.exits} exits/${contentReport.exitSteps} steps`,
  )
  console.log(
    `  scored activities: ${contentReport.scoredActivities} · readiness ${contentReport.readinessTasks} tasks/` +
    `${contentReport.readinessVariants} parallel variants · ` +
    `${contentReport.audioLines} Danish audio lines`,
  )
  console.log(
    `  support classification: ${contentReport.ledgerClassified}/${categoryByTerm.size} ledger forms · ` +
    `${contentReport.supplementalSupport} sentence-only supports · ${contentReport.descriptorLinks} descriptor links`,
  )
  for (const [target, count] of Object.entries(contentReport.byTarget)) {
    console.log(`    ${target}: ${count}`)
  }
  console.log('  form/chunk use stages:')
  for (const [use, count] of Object.entries(contentReport.byUse)) {
    console.log(`    ${use}: ${count}`)
  }

  const errors = [...report.errors, ...contentReport.errors]
  if (errors.length > 0) {
    console.error(`\n${errors.length} curriculum problem${errors.length === 1 ? '' : 's'}:`)
    for (const error of errors) console.error(`  ${error}`)
    process.exit(1)
  }
  console.log('OK — route, authored coverage, reachability, blind-answer checks, readiness variants and review gate agree.')
} finally {
  await server.close()
}
