import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateCity1Import } from './city1-content.mjs'
const words = JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url), 'utf8'))
test('supplied clone rank mutation cannot bypass disk provenance', async () => {
  const clone = structuredClone(words); clone[0].curriculumRank = 9999
  await assert.rejects(validateCity1Import(clone), /provenance|source|drift/)
})
import { validateExtensionManifest, EXTENSION_FILES } from '../prototypes/finish-review/implementation/roster-extension/checkpoint.mjs'
import { createHash } from 'node:crypto'
import { preBakeManifest, predecessorWords } from './city1-content.mjs'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
test('exact restored corpus and accepted import pass with unchanged prebake identities', async () => {
  await validateCity1Import(words)
  assert.deepEqual(predecessorWords(words), words)
  assert.deepEqual(preBakeManifest(), { ...JSON.parse(read('../src/data/city1-sentence-audio.da.json')), status: 'pre-bake', recordings: [] })
  const expected = JSON.parse(read('../prototypes/finish-review/implementation/inventory.json')).sources['src/data/words.da.json']
  assert.equal(createHash('sha256').update(read('../src/data/words.da.json')).digest('hex'), expected)
})
test('extension authorization pins checkpoint bytes and all eight evidence keys', () => {
  const raw = read('../prototypes/finish-review/implementation/roster-extension/successor-hashes.json')
  assert.deepEqual(Object.keys(validateExtensionManifest(raw)).sort(), [...EXTENSION_FILES].sort())
  for (const mutate of [m => { delete m['scope.json'] }, m => { m['board-sentences.json'] = '0'.repeat(64) }, m => { m.extra = '0'.repeat(64) }]) {
    const manifest = JSON.parse(raw); mutate(manifest)
    assert.throws(() => validateExtensionManifest(JSON.stringify(manifest, null, 2) + '\n'), /checkpoint drift/)
  }
})
