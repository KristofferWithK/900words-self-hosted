import { validateExtensionManifest } from '../prototypes/finish-review/implementation/roster-extension/checkpoint.mjs'
import { extensionPredecessorWords } from '../prototypes/finish-review/implementation/roster-extension/predecessor.mjs'
import { inputs, check } from '../prototypes/finish-review/implementation/roster-extension/validate.mjs'
/** Successor import audit. Historical source identities stay frozen. No bake. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildInventory } from '../prototypes/finish-review/implementation/inventory.mjs'
import { validate, FILES } from '../prototypes/finish-review/implementation/validate.mjs'
const directory = new URL('../prototypes/finish-review/implementation/', import.meta.url)
const read = name => readFileSync(new URL(name, directory), 'utf8')
// Exact published checkpoints accepted by the parent (model reviews, not human signoff).
export const checkpoints = {
  board: '4d8652357dff39374f4375f62a3754bb4722a324',
  review: '195c87653ef7219e27916c0adde591ae78c9ea9d',
}
export const acceptedHashes = {
  "board-sentences.json": "608772e4447437861c588f1aa0de086f097c8360c428696ed7302fce5b7606fa",
  "board-editorial.md": "1ed22a8e8236c408cfda1d8e056ef218c84d5c743463ceac0e0f74b95382e83a",
  "review-sentences.json": "d46e446e503e4cd589d0ec9940154d2b94310adea7645590856698d204537d53",
  "about-targets.json": "d04d29aa3a7299592a53e675f5640d5218503c5740721c6221c47b36b2b6b0db",
  "review-editorial.md": "32c7a290ec8e8363f19ca67f2497089e81da8b86ebdb45b60c36a210199545ef"
}
export const originalSets = Object.fromEntries(Object.entries(FILES).map(([kind, file]) => [kind, JSON.parse(read(file))]))
export const extensionSets = Object.fromEntries(['board','review'].map(kind => [kind, JSON.parse(read('roster-extension/'+FILES[kind]))]))
export const sets = { ...originalSets, ...Object.fromEntries(['board','review'].map(kind => [kind, { ...originalSets[kind], rows: [...originalSets[kind].rows, ...extensionSets[kind].rows] }])) }
export const predecessor = JSON.parse(read('predecessor-examples.json'))
export function predecessorWords(words) {
  const byId = new Map(predecessor.map(row => [row.id, row]))
  return extensionPredecessorWords(words).map(word => ({ ...word, ...byId.get(word.id) }))
}
export async function validateCity1Import(words) {
  const frozen = JSON.parse(read('inventory.json')).sources['src/data/words.da.json']
  if (createHash('sha256').update(read('historical-words.json')).digest('hex') !== frozen) throw Error('frozen historical identity file drift')
  if (createHash('sha256').update(JSON.stringify(words, null, 2) + '\n').digest('hex') !== frozen) throw Error('instructional argument whole-file provenance drift')
  for (const [file, expected] of Object.entries(acceptedHashes)) {
    if (createHash('sha256').update(read(file)).digest('hex') !== expected) throw Error(`${file}: accepted checkpoint bytes changed`)
  }
  const inventory = await buildInventory()
  const stored = JSON.parse(read('inventory.json'))
  if (JSON.stringify(inventory) !== JSON.stringify(stored)) throw Error('City1 predecessor inventory or teaching sources drifted')
  const result = validate(originalSets, inventory, { mode: 'acceptance', readEvidence: read })
  const successor = check(await inputs(), { acceptance: true })
  result.errors.push(...successor.errors)
  const byId = new Map(words.map(word => [word.id, word]))
  for (const row of sets.board.rows) {
    const word = byId.get(row.wordId)
    if (!word) result.errors.push(`${row.wordId}: board presentation has no instructional word`)
    // Presentation equality is checked through the runtime contextual adapter in
    // unit/browser tests; author-source equality above is a separate contract.
  }
  if (result.errors.length) throw Error(result.errors.join('\n'))
  return result
}
export function preBakeManifest() {
  return { version: 2, language: 'da', status: 'pre-bake', bakeRates: { normal: 1, slow: 0.7 }, playbackRate: 1,
    sourceEvidence: { original: acceptedHashes, extension: validateExtensionManifest(read('roster-extension/successor-hashes.json')) },
    recordings: [], entries: ['board', 'review'].flatMap(kind => sets[kind].rows.map(row => ({
      kind, wordId: row.wordId, sentenceId: row.sentenceId, audioId: row.audioId, version: row.version,
      textDa: row.text.da, sourceHash: createHash('sha256').update(row.text.da).digest('hex'),
      variants: Object.entries({ normal: 1, slow: 0.7 }).map(([variant, bakeRate]) => ({
        variant, bakeRate, playbackRate: 1,
        url: `/audio/da/city1/${kind}/${encodeURIComponent(row.wordId)}/v${row.version}/${variant}.mp3`,
      })),
    }))) }
}

/** Runtime presentation is a separate contract from frozen authoring input. */
export function validateCity1Presentation(words, resolve) {
  const byId = new Map(words.map(word => [word.id, word]))
  for (const row of sets.board.rows) {
    const word = byId.get(row.wordId)
    const presentation = resolve(word, { kind: 'board', cityIndex: 0 })
    if (presentation.da !== row.text.da || presentation.en !== row.text.en || JSON.stringify(presentation.board) !== JSON.stringify(row)) throw Error(`${row.wordId}: contextual board presentation differs from accepted pair/spans/audio identity`)
    for (const context of [{ kind: 'instructional' }, { kind: 'board', cityIndex: 4 }]) {
      const original = resolve(word, context)
      if (original.da !== word.exampleDa || original.en !== word.exampleEn || original.board !== undefined) throw Error(`${row.wordId}: instructional context overwritten`)
    }
  }
}
