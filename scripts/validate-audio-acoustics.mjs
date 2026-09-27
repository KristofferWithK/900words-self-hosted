#!/usr/bin/env node
/**
 * The decoded-audio gate: every shipped Danish clip is decoded in Chromium —
 * the engine the app's own `decodeAudioData` and media elements use — and
 * held to scripts/lib/audio-acoustics.mjs's limits. `validate:audio` checks
 * that files exist and match their manifests; this checks what is IN them.
 *
 *   node scripts/validate-audio-acoustics.mjs                 gate (exit 1 on a problem)
 *   node scripts/validate-audio-acoustics.mjs --report <file> also write every measurement
 *
 * Needs a Chromium (CHROMIUM_PATH, default the container's /opt/pw-browsers),
 * so it is its own script in `verify` rather than part of `validate:audio`,
 * which deploy.yml runs on a runner with no browser installed.
 *
 * Three things are pinned beyond the family limits:
 *  - the sixteen owner-approved replacements (scripts/data/word-audio-
 *    replacements.da.json): exact bytes, manifest identity, and a release
 *    profile — so an unintended swap cannot pass on acoustics alone;
 *  - the documented outliers (scripts/data/audio-acoustic-exceptions.da.json):
 *    each holds only at its measured value, so drift is reported, not absorbed;
 *  - the onset map (src/data/audio-lead.da.json): the player seeks by it, so a
 *    clip whose bytes changed without a re-measure would start in the wrong place.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { CLIP_LEVEL, SIGNAL_DBFS, WINDOW_MS, dbfs, evaluateClip, familyOf, measurePcm } from './lib/audio-acoustics.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_ROOT = resolve(ROOT, 'public/audio/da')
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const reportAt = process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : undefined

const replacements = readJson(resolve(ROOT, 'scripts/data/word-audio-replacements.da.json'))
const exceptions = readJson(resolve(ROOT, 'scripts/data/audio-acoustic-exceptions.da.json')).clips
const leadMap = readJson(resolve(ROOT, 'src/data/audio-lead.da.json')).entries
const manifests = {
  '': readJson(resolve(AUDIO_ROOT, 'manifest.json')).entries,
  'slow/': readJson(resolve(AUDIO_ROOT, 'slow/manifest.json')).entries,
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name)
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.mp3') ? [path] : []
  })
}

const errors = []
const clips = walk(AUDIO_ROOT)
  .map((path) => ({ rel: relative(AUDIO_ROOT, path).split('\\').join('/'), path }))
  .sort((a, b) => a.rel.localeCompare(b.rel))

// ---- the sixteen replacements: identity and bytes, before any decoding ----
if (replacements.variants.length !== 16) errors.push(`replacement receipt must list 16 variants, found ${replacements.variants.length}`)
const replacementByPath = new Map()
for (const variant of replacements.variants) {
  if (replacementByPath.has(variant.path)) errors.push(`${variant.path}: listed twice in the replacement receipt`)
  replacementByPath.set(variant.path, variant)
  const prefix = variant.path.startsWith('slow/') ? 'slow/' : ''
  const slug = variant.path.slice(prefix.length).replace(/\.mp3$/, '')
  const row = manifests[prefix][slug]
  if (row?.id !== variant.id) errors.push(`${variant.path}: manifest names ${row?.id ?? 'nothing'}, receipt names ${variant.id}`)
  let bytes
  try {
    bytes = readFileSync(resolve(AUDIO_ROOT, variant.path))
  } catch {
    errors.push(`${variant.path}: approved replacement is missing`)
    continue
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== variant.sha256) errors.push(`${variant.path}: bytes are not the approved recording (${sha256})`)
}

// ---- every word clip has a manifest row and an onset entry ----
for (const [prefix, rows] of Object.entries(manifests)) {
  if (Object.keys(rows).length !== 900) errors.push(`${prefix || 'words'}: expected 900 manifest rows, found ${Object.keys(rows).length}`)
  for (const slug of Object.keys(rows)) {
    if (!Number.isFinite(leadMap[`${prefix}${slug}.mp3`])) errors.push(`${prefix}${slug}.mp3: no measured onset in audio-lead.da.json`)
  }
}

// ---- decode everything in Chromium ----
/**
 * The gate's own regression fixtures, decoded in the same page before the
 * inventory: each is a real failure this gate exists to catch — the original
 * near-silent «bo» the owner heard, the rejected slow «ord» synthesis, a raw
 * untrimmed lead, a gained-and-clipped word, a truncated and an empty file —
 * plus the approved «bo» as the control that must pass. If the gate stops
 * rejecting any of them it fails, rather than quietly passing everything.
 */
const FIXTURES = resolve(ROOT, 'scripts/fixtures/audio-acoustics')
const SELF_TEST = [
  ['original-near-silent-bo.mp3', /silent/],
  ['rejected-synthesis-slow-ord.mp3', /silent/],
  ['original-silent-tak.mp3', /silent/],
  ['untrimmed-lead-pude.mp3', /of silence before the voice exceeds/],
  ['gain-clipped-hus.mp3', /consecutive full-scale samples/],
  ['truncated-hus.mp3', /could not decode|shorter than the/],
  ['empty.mp3', /could not decode/],
  ['approved-bo.mp3', null],
]

// The same order run-drives uses (env, then the container's paths), then
// Playwright's own installed Chromium on a laptop that has one.
const executablePath = process.env.CHROMIUM_PATH ??
  ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p))
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const measurements = []
let selfTest = []
try {
  const page = await browser.newPage()
  // The page runs the same measurePcm the unit tests exercise.
  await page.addScriptTag({
    content: `const WINDOW_MS=${WINDOW_MS},SIGNAL_DBFS=${SIGNAL_DBFS},CLIP_LEVEL=${CLIP_LEVEL};const dbfs=${dbfs.toString()};window.measurePcm=${measurePcm.toString()};`,
  })
  const decode = (batch) => page.evaluate(async (batch) => {
    const out = []
    for (const clip of batch) {
      try {
        const bytes = Uint8Array.from(atob(clip.bytes), (c) => c.charCodeAt(0))
        if (!bytes.length) throw new Error('empty file')
        const buffer = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bytes.buffer)
        if (!buffer.length) throw new Error('decoded to zero samples')
        out.push({ rel: clip.rel, channels: buffer.numberOfChannels, ...window.measurePcm(buffer.getChannelData(0), buffer.sampleRate) })
      } catch (error) {
        out.push({ rel: clip.rel, error: String(error?.message ?? error) })
      }
    }
    return out
  }, batch)
  selfTest = await decode(SELF_TEST.map(([name]) => ({ rel: name, bytes: readFileSync(resolve(FIXTURES, name)).toString('base64') })))
  const BATCH = 120
  for (let i = 0; i < clips.length; i += BATCH) {
    measurements.push(...(await decode(clips.slice(i, i + BATCH).map(({ rel, path }) => ({ rel, bytes: readFileSync(path).toString('base64') })))))
  }
} finally {
  await browser.close()
}

// ---- the gate must still reject what it was built to reject ----
for (const [index, [name, expected]] of SELF_TEST.entries()) {
  // Judged as an ordinary word clip, the family every one of them belongs to.
  const problems = evaluateClip(`${name}`, selfTest[index])
  if (expected === null && problems.length) errors.push(`self-test: control ${name} should pass, got: ${problems.join('; ')}`)
  if (expected !== null && !problems.some((p) => expected.test(p))) {
    errors.push(`self-test: fixture ${name} was not rejected for ${expected} (got: ${problems.join('; ') || 'no problem'})`)
  }
}

// ---- judge ----
const seenExceptions = new Set()
for (const m of measurements) {
  const problems = evaluateClip(m.rel, m, { exceptions, leadMap })
  if (exceptions[m.rel]) seenExceptions.add(m.rel)
  if (!m.error && m.channels !== 1) problems.push(`${m.rel}: expected mono, found ${m.channels} channels`)
  if (exceptions[m.rel]?.sha256) {
    const sha256 = createHash('sha256').update(readFileSync(resolve(AUDIO_ROOT, m.rel))).digest('hex')
    if (sha256 !== exceptions[m.rel].sha256) problems.push(`${m.rel}: bytes changed since the exception was recorded; re-measure and remove or re-review it`)
  }
  const replacement = replacementByPath.get(m.rel)
  if (replacement && !m.error) {
    const { release } = replacements
    if (m.peakDbfs <= release.minPeakDbfs) problems.push(`${m.rel}: replacement peak ${m.peakDbfs.toFixed(1)} dBFS is at or below ${release.minPeakDbfs}`)
    if (m.leadMs === null || m.leadMs > release.maxLeadMs) problems.push(`${m.rel}: replacement onset ${m.leadMs}ms exceeds ${release.maxLeadMs}ms`)
    if (m.longestClipRun > release.maxClipRun) problems.push(`${m.rel}: replacement has ${m.longestClipRun} consecutive full-scale samples (processing clipped it)`)
    if (m.leadMs !== null && m.leadMs < release.minLeadMs) problems.push(`${m.rel}: replacement onset ${m.leadMs}ms leaves less than ${release.minLeadMs}ms before the voice (a clipped consonant)`)
    for (const field of ['durationMs', 'leadMs', 'tailMs']) {
      if (Math.abs(m[field] - replacement.measured[field]) > WINDOW_MS) problems.push(`${m.rel}: ${field} ${m[field]} differs from its receipt (${replacement.measured[field]})`)
    }
  }
  errors.push(...problems)
}
for (const rel of Object.keys(exceptions)) {
  if (!seenExceptions.has(rel)) errors.push(`${rel}: documented exception names a clip that is not shipped`)
}
if (measurements.length !== clips.length) errors.push(`decoded ${measurements.length} of ${clips.length} clips`)

if (reportAt) {
  writeFileSync(reportAt, `${JSON.stringify({ root: 'public/audio/da', count: measurements.length, measurements }, null, 1)}\n`)
  console.log(`wrote ${measurements.length} measurements to ${reportAt}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  console.error(`\n${errors.length} problem(s) in ${measurements.length} decoded Danish clips.`)
  process.exit(1)
}

const byFamily = {}
for (const m of measurements) (byFamily[familyOf(m.rel)] ??= []).push(m)
console.log(`Danish audio acoustics: ${measurements.length} clips decoded in Chromium, 0 problems; ${SELF_TEST.length - 1} failure fixtures rejected and the control passed.`)
for (const [family, all] of Object.entries(byFamily)) {
  const rows = all.filter((m) => m.leadMs !== null)
  const leads = rows.map((m) => m.leadMs).sort((a, b) => a - b)
  const peaks = rows.map((m) => m.peakDbfs)
  console.log(`  ${family}: ${rows.length} clips; onset median ${leads[leads.length >> 1]}ms, max ${leads.at(-1)}ms; quietest peak ${Math.min(...peaks).toFixed(1)} dBFS`)
}
console.log(`  ${replacements.variants.length} approved replacements byte-pinned; ${Object.keys(exceptions).length} documented outliers held at their measured values:`)
for (const [rel, known] of Object.entries(exceptions)) if (known.releaseBlocker) console.warn(`RELEASE BLOCKER (passes only by documented exception): ${rel} — ${known.disposition}`)
for (const [rel, known] of Object.entries(exceptions)) console.log(`    ${known.silent ? 'SILENT' : `lead ${known.leadMs}ms`}  ${rel}${known.disposition.startsWith('BLOCKED') ? '  (blocked: see scripts/data/audio-acoustic-exceptions.da.json)' : ''}`)
