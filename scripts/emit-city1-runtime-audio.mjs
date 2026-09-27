/**
 * Emit the runtime audio projection consumed by the app bundle.
 *
 * The canonical manifest `src/data/city1-sentence-audio.da.json` carries the
 * full bake provenance (sourceUrl, voice, languageCode, audioEncoding,
 * payloadSha256, rawSha256, sha256, durationSeconds, leadMs, tailMs per
 * recording, plus sourceEvidence and the 352 pre-bake entries). None of that
 * is read at runtime: `src/review/city1.ts` narrows recordings to
 * `SentenceRecording` (8 fields). Shipping the provenance in the main bundle
 * pushed index-*.js past the 3 MiB workbox precache cap (vite.config.ts), so
 * per that file's own rule the provenance now stays script-side in the
 * canonical file and the app imports this projection instead.
 *
 * Regenerate whenever the canonical manifest changes:
 *   node scripts/emit-city1-runtime-audio.mjs
 * `src/review/city1.test.ts` asserts the projection is exact, so drift fails.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const CANONICAL = new URL('../src/data/city1-sentence-audio.da.json', import.meta.url)
const RUNTIME = new URL('../src/data/city1-sentence-audio.da.runtime.json', import.meta.url)

// Exactly the fields of SentenceRecording in src/review/city1.ts. Anything the
// runtime type grows must be added here AND in the projection test.
const RUNTIME_FIELDS = [
  'audioId', 'sentenceId', 'version', 'textDa', 'url', 'variant', 'bakeRate', 'playbackRate',
]

const canonical = JSON.parse(readFileSync(CANONICAL, 'utf8'))
if (canonical.status !== 'complete') throw new Error(`canonical status ${canonical.status} — projection is only defined for the baked manifest`)
if (!Array.isArray(canonical.recordings) || canonical.recordings.length === 0) throw new Error('canonical has no recordings to project')

const recordings = canonical.recordings.map((r) => {
  const row = {}
  for (const k of RUNTIME_FIELDS) row[k] = r[k]
  return row
})
const projection = { status: canonical.status, recordings }

const before = readFileSync(CANONICAL).length
writeFileSync(RUNTIME, `${JSON.stringify(projection, null, 2)}\n`)
const after = readFileSync(RUNTIME).length
console.log(`canonical: ${canonical.recordings.length} recordings, ${(before / 1024).toFixed(1)} KiB`)
console.log(`runtime projection written: ${recordings.length} recordings, ${(after / 1024).toFixed(1)} KiB (saves ${((before - after) / 1024).toFixed(1)} KiB from the main bundle)`)