/**
 * Produce the static bake input for S3's chapter performances.
 *
 * The Actions bake stays Node-builtins-only, while the accepted course is
 * TypeScript. This is the same deliberate projection boundary S4 uses for its
 * task audio: the validator loads the real language payload and refuses any
 * drift before a voice request is made.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const ROOT = process.cwd()
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'da'
// German is baked for City 1 only (owner, 2026-09-26); `--all-cities` widens it.
const cityLimit = lang === 'da' || process.argv.includes('--all-cities') ? Infinity : 1
const target = resolve(ROOT, `src/data/chapter-audio.${lang}.json`)
const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const lessons = lang === 'da'
    ? (await server.ssrLoadModule('/src/lang/da/chapter-audio.ts')).danishGrammarLessonAudio
    : lang === 'de'
      ? (await server.ssrLoadModule('/src/lang/de/chapter-audio.ts')).germanGrammarLessonAudio
      : null
  if (!lessons) throw new Error(`No grammar course for --lang ${lang}`)
  const payload = {
    language: lang,
    generatedFrom: `accepted fixed grammar lesson example performances${cityLimit === 1 ? ', City 1' : ''}`,
    entries: lessons.filter((chapter) => chapter.cityIndex < cityLimit).map((chapter) => ({
      ...chapter,
      sourceHash: createHash('sha256').update(chapter.textDa).digest('hex'),
    })),
  }
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (process.argv.includes('--write')) writeFileSync(target, json)
  else process.stdout.write(json)
} finally {
  await server.close()
}
