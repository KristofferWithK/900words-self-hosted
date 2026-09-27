/**
 * Emit the frozen Danish example-sentence source used by S2's Actions-only
 * bake.  Keeping this projection in JSON lets make-audio stay Node-builtins
 * only, while the validator compares every row back to words.da.json.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const wordsPath = resolve(root, 'src/data/words.da.json')
const target = resolve(root, 'src/data/example-audio.da.json')
const words = JSON.parse(readFileSync(wordsPath, 'utf8'))

const payload = {
  language: 'da',
  generatedFrom: 'frozen words.da.json exampleDa (T3 Sol review)',
  entries: words.map(({ id, exampleDa }) => ({
    id,
    textDa: exampleDa,
    sourceHash: createHash('sha256').update(exampleDa).digest('hex'),
  })),
}

const json = `${JSON.stringify(payload, null, 2)}\n`
if (process.argv.includes('--write')) writeFileSync(target, json)
else process.stdout.write(json)
