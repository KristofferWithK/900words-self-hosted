/**
 * Print (or deliberately refresh) the bake-only projection of the Survival
 * Guide's dialogue turns: all 144 Danish ones, or German's with `--lang de`.
 * The checked-in JSON keeps the bake on Node builtins; validate:audio compares
 * the Danish one back to the authored guide.
 *
 * German is baked for City 1 only (owner, 2026-09-26), so `--lang de`
 * projects the first city's exchanges unless `--all-cities` asks for more.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const ROOT = process.cwd()
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'da'
const GUIDES = {
  da: ['/src/lang/da/survival.ts', 'danishSurvivalGuide', 'Danish'],
  de: ['/src/lang/de/survival.ts', 'germanSurvivalGuide', 'German'],
}
if (!GUIDES[lang]) throw new Error(`No Survival Guide for --lang ${lang}`)
const cityLimit = lang === 'da' || process.argv.includes('--all-cities') ? Infinity : 1
const target = resolve(ROOT, `src/data/survival-audio.${lang}.json`)
const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const [modulePath, exportName, languageName] = GUIDES[lang]
  const guide = (await server.ssrLoadModule(modulePath))[exportName]
  const entries = guide.cities.slice(0, cityLimit).flatMap((city) =>
    city.exchanges.flatMap((exchange) =>
      exchange.dialogue.map((line, lineIndex) => ({
        id: `${exchange.targetActivityId}-line-${lineIndex + 1}`,
        activityId: exchange.targetActivityId,
        lineIndex,
        textDa: line.da,
        sourceHash: createHash('sha256').update(line.da).digest('hex'),
      })),
    ),
  )
  const payload = {
    language: lang,
    generatedFrom: `the authored ${languageName} Survival Guide dialogue${cityLimit === 1 ? ', City 1' : ''}`,
    entries,
  }
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (process.argv.includes('--write')) writeFileSync(target, json)
  else process.stdout.write(json)
} finally {
  await server.close()
}
