/**
 * SEC3 release gate: authored Casey corpora belong in the Worker bundle, never
 * in GitHub Pages or the native web assets — with one exception: the
 * developer and normal native builds (CAP_BUILD=1) carry City 1's shards for
 * on-device Casey, in a chunk loaded when she first plays, never at start-up.
 *
 * Run only against a fresh `dist/` (package.json puts it after Vite). It checks
 * every emitted file, not source imports, because an accidental transitive
 * import is exactly the failure this gate exists to catch.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CORPUS_FILE = /^(?:matrix|book|deal-index|association-index|lcsi)\.[a-z]{2}\.\d+\.json$/
const LEXICON_FILE = 'clue-lexicon.da.json'
const ORCHESTRATION_SPECS = [
  ['casey/prompts.js', 'You are Casey, a cheerful travelling suitcase (with eyes)'],
  ['casey/prompts.js', 'THE ARITHMETIC:'],
  ['casey/orchestrator.js', 'That response was invalid:'],
]

function filesUnder(root) {
  const found = []
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    if (statSync(path).isDirectory()) found.push(...filesUnder(path))
    else found.push(path)
  }
  return found
}

export function corpusSentinels(dataDir) {
  if (!existsSync(dataDir)) throw new Error(`server corpus directory is missing: ${dataDir}`)
  const corpus = readdirSync(dataDir).filter((name) => CORPUS_FILE.test(name)).sort()
  if (corpus.length === 0) throw new Error(`no authored corpus files found in ${dataDir}`)
  const sentinels = []
  for (const name of corpus) {
    const raw = readFileSync(join(dataDir, name), 'utf8')
    const doc = JSON.parse(raw)
    sentinels.push({ source: name, value: name })
    if (name.startsWith('matrix.') || name.startsWith('deal-index.')) {
      if (typeof doc.data !== 'string' || doc.data.length < 96) {
        throw new Error(`${name} has no usable packed-data sentinel`)
      }
      sentinels.push({ source: name, value: doc.data.slice(0, 96) })
    } else if (name.startsWith('lcsi.')) {
      // The canonical strengths: provenance hash plus three scored clue rows
      // spread through the file, so neither the whole file nor a slice of it
      // can ride into a client chunk unnoticed.
      if (!/^[a-f0-9]{64}$/.test(doc.source?.mergedIndexSha256 ?? '') || !Array.isArray(doc.clues)) {
        throw new Error(`${name} has no usable LCSI provenance`)
      }
      sentinels.push({ source: name, value: doc.source.mergedIndexSha256 })
      // The entries alone, not the clue: `[[12,80,0],[34,46.7,1],…]` has no
      // quotes, so it survives being inlined as a JS literal or escaped inside
      // a string, where a quoted clue text would not match either way.
      const rows = doc.clues.filter((row) => Array.isArray(row) && Array.isArray(row[1]) && row[1].length >= 6)
      if (rows.length < 3) throw new Error(`${name} has too few strength-row sentinels`)
      for (const index of [0, Math.floor(rows.length / 2), rows.length - 1]) {
        sentinels.push({ source: name, value: JSON.stringify(rows[index][1]) })
      }
    } else if (name.startsWith('association-index.')) {
      if (!/^[a-f0-9]{64}$/.test(doc.source?.sha256 ?? '') || !Array.isArray(doc.clues)) {
        throw new Error(`${name} has no usable association-index provenance`)
      }
      sentinels.push({ source: name, value: doc.source.sha256 })
      const rows = doc.clues.filter(
        (row) => Array.isArray(row) && typeof row[0] === 'string' && Array.isArray(row[1]) && row[1].length >= 5,
      )
      if (rows.length < 3) throw new Error(`${name} has too few association-row sentinels`)
      for (const index of [0, Math.floor(rows.length / 2), rows.length - 1]) {
        sentinels.push({ source: name, value: JSON.stringify(rows[index]) })
      }
    } else {
      const entries = [
        ...Object.values(doc.words ?? {}).flatMap((word) => word.assoc ?? []),
        ...Object.values(doc.pairs ?? {}).flatMap((pair) => pair ?? []),
      ]
      const why = entries
        .map((entry) => entry?.why)
        .filter((value) => typeof value === 'string' && value.length >= 36)
      if (why.length < 3) throw new Error(`${name} has too few authored-rationale sentinels`)
      // Spread samples through the file so a partial or per-city accidental
      // bundle cannot evade a single first-entry check.
      for (const index of [0, Math.floor(why.length / 2), why.length - 1]) {
        sentinels.push({ source: name, value: why[index] })
      }
    }
  }
  return sentinels
}

export function orchestrationSentinels(dataDir) {
  const proxyDir = resolve(dataDir, '..')
  return ORCHESTRATION_SPECS.map(([name, value]) => {
    const source = join(proxyDir, name)
    if (!existsSync(source) || !readFileSync(source, 'utf8').includes(value)) {
      throw new Error(`server orchestration sentinel is stale or missing: ${name}`)
    }
    return { source: name, value }
  })
}

/**
 * The one explicit L1 allowance. The app may receive this generated list of
 * anonymous terms, but not a book-shaped object: two strings, no ids, scores,
 * rationales, votes, pair keys, model data, or source metadata. The generator
 * independently proves it is current; this gate keeps the boundary definition
 * beside the corpus sentinels it must not weaken.
 */
export function derivedLexicon(dataDir) {
  const path = resolve(dataDir, '..', '..', 'src', 'data', LEXICON_FILE)
  if (!existsSync(path)) throw new Error(`L1 derived lexicon is missing: ${path}`)
  const entries = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`L1 derived lexicon is empty: ${path}`)
  const seen = new Set()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`L1 derived lexicon has a non-object entry: ${path}`)
    }
    const keys = Object.keys(entry).sort()
    if (keys.length !== 2 || keys[0] !== 'da' || keys[1] !== 'en') {
      throw new Error(`L1 derived lexicon entry is wider than {da,en}: ${path}`)
    }
    if (typeof entry.da !== 'string' || !entry.da.trim() || typeof entry.en !== 'string' || !entry.en.trim()) {
      throw new Error(`L1 derived lexicon has a blank term: ${path}`)
    }
    const normalized = entry.da.normalize('NFC').trim().toLowerCase()
    if (seen.has(normalized)) throw new Error(`L1 derived lexicon repeats ${entry.da}: ${path}`)
    seen.add(normalized)
  }
  return { path, entries }
}

/**
 * City 1's shards: the one corpus an on-device Casey build may carry, for on-device
 * Casey (src/ai/gemma/decision.ts runs the Worker's orchestrator there, and
 * vite.config.ts narrows its evaluator to City 1). Every other city's corpus
 * stays Worker-only in every build, and web builds carry none at all. SEC4
 * (validate-release-package.mjs) applies the same rule to the package.
 */
const ON_DEVICE_CORPUS = /\.1\.json$/

/** The corpus sentinels a native build's on-device Casey may carry. */
export const onDeviceCorpus = (sentinels) => sentinels.filter((item) => ON_DEVICE_CORPUS.test(item.source))

/**
 * Whether the build under inspection runs Casey's logic in the app, as
 * vite.config.ts's IN_APP_CASEY: native developer or normal (on-device Casey),
 * and every open-source build, web included (a player's own AI key, or Gemma).
 * A feedback or store-web package must not carry City 1's shards. The
 * TestFlight workflow names the audience BUILD_AUDIENCE while building and
 * RELEASE_EXPECTED_AUDIENCE when it inspects the signed app, so both are read.
 */
export function onDeviceCaseyBuild(env = process.env) {
  const audience = buildAudienceOf(env)
  if (audience === 'open-source') return true
  return env.CAP_BUILD === '1' && (audience === 'developer' || audience === 'normal')
}

/** The audience the build was made for, as the TestFlight workflow names it. */
export function buildAudienceOf(env = process.env) {
  return env.BUILD_AUDIENCE || env.RELEASE_EXPECTED_AUDIENCE || 'open-source'
}

/**
 * What only a self-build may carry: the player's own-key store and desktop
 * Gemma (LiteRT-LM and its WebAssembly). Both are folded away at build time
 * everywhere else (owner, 2026-09-27); this proves it on every other build.
 */
const SELF_BUILD_SENTINELS = [
  { value: 'cluecab-own-ai-v1', source: 'the self-build’s own AI key store' },
  { value: 'litertlm', source: 'desktop Gemma (LiteRT-LM)' },
]

/**
 * The scripts index.html loads before anything else: the entry and its
 * modulepreloads. On-device Casey is a dynamic import, so her corpus belongs
 * in a chunk loaded the first time she plays — never in one of these, which
 * every launch of the app parses.
 */
function startupScripts(distDir) {
  const html = join(distDir, 'index.html')
  if (!existsSync(html)) return new Set()
  const refs = readFileSync(html, 'utf8').matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+\.m?js)"/g)
  return new Set([...refs].map((match) => basename(match[1])))
}

export function inspectClientBuild(
  distDir,
  dataDir,
  { allowOnDeviceOrchestration = false, allowOnDeviceCity1Corpus = false, allowSelfBuild = false } = {},
) {
  if (!existsSync(distDir)) throw new Error(`client build is missing: ${distDir}`)
  const files = filesUnder(distDir)
  if (files.length === 0) throw new Error(`client build is empty: ${distDir}`)
  // Validate the narrowly allowed generated asset before inspecting emitted
  // chunks. Its terms may appear in a lazy JS chunk; private-book sentinels
  // below still scan every one of those chunks and fail as before.
  derivedLexicon(dataDir)
  // Native Gemma needs the reviewed prompt/controller specification on the
  // same device as the model, and on-device Casey needs City 1's shards
  // beside it. Every other city's books, matrices, association indexes and
  // certified deal indexes remain private Worker material in every build.
  const corpus = corpusSentinels(dataDir)
  const onDevice = allowOnDeviceCity1Corpus ? onDeviceCorpus(corpus) : []
  const sentinels = [
    ...corpus.filter((item) => !onDevice.includes(item)),
    ...(allowOnDeviceOrchestration ? [] : orchestrationSentinels(dataDir)),
  ]
  const startup = allowOnDeviceCity1Corpus ? startupScripts(distDir) : new Set()
  const violations = []

  for (const path of files) {
    const name = basename(path)
    if (CORPUS_FILE.test(name)) violations.push(`${path}: authored corpus filename was emitted`)
    if (!allowSelfBuild && /[\\/]litert-lm[\\/]/.test(path)) violations.push(`${path}: desktop Gemma's engine was emitted outside a self-build`)
    const bytes = readFileSync(path)
    // Binary audio/images cannot contain useful JS strings often enough to be
    // worth decoding megabytes repeatedly. Filename checks still cover a raw
    // copied corpus; textual assets cover bundled or inlined JSON.
    if (!/\.(?:js|mjs|json|html|css|map|txt)$/i.test(name)) continue
    const content = bytes.toString('utf8')
    for (const sentinel of sentinels) {
      if (content.includes(sentinel.value)) {
        violations.push(`${path}: contains private server material from ${sentinel.source}`)
      }
    }
    if (!allowSelfBuild) {
      for (const sentinel of SELF_BUILD_SENTINELS) {
        if (content.includes(sentinel.value)) violations.push(`${path}: contains ${sentinel.source}, which only a self-build carries`)
      }
    }
    if (startup.has(name)) {
      for (const sentinel of onDevice) {
        if (content.includes(sentinel.value)) {
          violations.push(`${path}: loads on-device Casey's ${sentinel.source} at start-up; it belongs in her lazily loaded chunk`)
        }
      }
    }
  }
  return { files: files.length, sentinels: sentinels.length + onDevice.length, violations }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (invoked) {
  const root = process.cwd()
  // --dist <dir> checks another build folder (the web demo's dist-web-demo).
  const distFlag = process.argv.indexOf('--dist')
  const distDir = distFlag > 0 && process.argv[distFlag + 1] ? process.argv[distFlag + 1] : 'dist'
  const result = inspectClientBuild(join(root, distDir), join(root, 'proxy', 'data'), {
    allowOnDeviceOrchestration: process.env.CAP_BUILD === '1' || onDeviceCaseyBuild(),
    allowOnDeviceCity1Corpus: onDeviceCaseyBuild(),
    allowSelfBuild: buildAudienceOf() === 'open-source',
  })
  if (result.violations.length > 0) {
    console.error('SEC3 client boundary failed:')
    for (const violation of result.violations) console.error(`  ${violation}`)
    process.exit(1)
  }
  console.log(
    `SEC3 client boundary: ${result.files} production files clear of ${result.sentinels} private-server sentinels`,
  )
}
