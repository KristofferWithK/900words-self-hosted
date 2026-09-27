/**
 * Print (or deliberately refresh) the bake-only projection of accepted T6
 * task audio. The checked-in JSON lets the Actions bake stay node-builtins
 * only; validate:audio compares it back to this real TypeScript payload.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const ROOT = process.cwd()
const lang = 'da'
const target = resolve(ROOT, `src/data/curriculum-audio.${lang}.json`)
const server = await createServer({
  configFile: false,
  root: ROOT,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  logLevel: 'silent',
})

try {
  const { danishCurriculumTaskAudio } = await server.ssrLoadModule('/src/lang/da/curriculum-audio.ts')
  const payload = {
    language: lang,
    generatedFrom: 'accepted T6 curriculum task audio',
    entries: danishCurriculumTaskAudio.map((line) => ({
      ...line,
      // Full source text, not the provider stamp: a reviewer can tell exactly
      // which frozen utterance a manifest row was made from.
      sourceHash: createHash('sha256').update(line.textDa).digest('hex'),
    })),
  }
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (process.argv.includes('--write')) writeFileSync(target, json)
  else process.stdout.write(json)
} finally {
  await server.close()
}
