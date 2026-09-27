/**
 * SEC4 release package gate.
 *
 * Import checks are not evidence about a release: Vite can copy a public file,
 * Capacitor can sync a stale one, and Xcode can package a different tree. This
 * inspects the files that are actually handed to a browser, native shell, or
 * IPA. Credentials are always server material, and so is Casey's authored
 * corpus — except City 1's shards in an on-device Casey native build, which she
 * runs beside the model (validate-client-boundary.mjs holds that rule and
 * checks they load lazily). Reviewed orchestration is likewise allowed only
 * in the native Gemma build; the web release still rejects both.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { corpusSentinels, derivedLexicon, onDeviceCaseyBuild, onDeviceCorpus, orchestrationSentinels } from './validate-client-boundary.mjs'
import {
  RELEASE_PROVENANCE_FILE,
  RELEASE_PROVENANCE_SCHEMA,
  validatePublicPolicy,
} from './stamp-release-package.mjs'

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.plist', '.txt', '.xml'])
const CORPUS_FILE = /(?:^|\/)(?:matrix|book|deal-index|association-index|lcsi|authored-clues|authored-player-keys|legal-index-clues)\.[a-z]{2}\.\d+\.json$/i
const RAW_VOTES_OR_RATIONALES = /(?:^|\/)(?:raw[-_.]?)?(?:votes?|rationales?)(?:[-_.]|$)/i
const ON_DEVICE_MODEL = /\.litertlm$/i
const INTERNAL_PLAN = /(?:^|\/)(?:docs?|internal)(?:\/|$)|(?:^|\/)(?:plan(?:-\d+)?|decisions|security-private-cutover)\.md$/i
const RESEARCH_OR_WORKER_PATH = /(?:^|\/)(?:experiments|research|proxy)(?:\/|$)/i
const SECRET_FILENAME = /(?:^|\/)(?:\.env(?:[.-].*)?|[^/]*(?:secret|credential|api[-_.]?key|token)[^/]*\.(?:json|pem|p8|key|txt))$/i
const SECRET_TEXT = [
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
  /\b(?:OLLAMA|GEMINI|OPENAI|ANTHROPIC|CLOUDFLARE)_API_KEY\b/,
  /\bAIza[\w-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
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

function textRecord(name, bytes) {
  return TEXT_EXTENSIONS.has(extname(name).toLowerCase()) || basename(name).startsWith('.env')
    ? bytes.toString('utf8')
    : null
}

/** Read a .ipa without shelling out, so the same gate works on CI and locally. */
function ipaEntries(path) {
  const bytes = readFileSync(path)
  // End of central directory is in the final 65,557 bytes of a ZIP file.
  const start = Math.max(0, bytes.length - 65_557)
  let end = -1
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error(`${path}: not a readable IPA/ZIP (missing central directory)`)
  const count = bytes.readUInt16LE(end + 10)
  let offset = bytes.readUInt32LE(end + 16)
  const entries = []
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error(`${path}: malformed IPA central directory`)
    const compression = bytes.readUInt16LE(offset + 10)
    const compressedSize = bytes.readUInt32LE(offset + 20)
    const nameLength = bytes.readUInt16LE(offset + 28)
    const extraLength = bytes.readUInt16LE(offset + 30)
    const commentLength = bytes.readUInt16LE(offset + 32)
    const localOffset = bytes.readUInt32LE(offset + 42)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`${path}:${name}: malformed IPA entry`)
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localExtraLength = bytes.readUInt16LE(localOffset + 28)
    const body = bytes.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize)
    if (compression === 0) entries.push({ name: `${path}:${name}`, bytes: body })
    else if (compression === 8) entries.push({ name: `${path}:${name}`, bytes: inflateRawSync(body) })
    else throw new Error(`${path}:${name}: unsupported IPA compression method ${compression}`)
  }
  return entries
}

export function packageEntries(target) {
  if (!existsSync(target)) throw new Error(`release package is missing: ${target}`)
  if (statSync(target).isDirectory()) {
    return filesUnder(target).map((path) => ({ name: path, bytes: readFileSync(path) }))
  }
  if (extname(target).toLowerCase() === '.ipa') return ipaEntries(target)
  return [{ name: target, bytes: readFileSync(target) }]
}

function assertFlatLexicon(entries) {
  const seen = new Set()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('derived lexicon has a non-object entry')
    const keys = Object.keys(entry).sort()
    if (keys.join(',') !== 'da,en') throw new Error('derived lexicon is not flat {da,en} data')
    const normalized = entry.da.normalize('NFC').trim().toLowerCase()
    if (!normalized || !entry.en.trim() || seen.has(normalized)) throw new Error('derived lexicon has blank or repeated terms')
    seen.add(normalized)
  }
}

function packageHasEveryLexiconTerm(records, entries) {
  const text = records.map((record) => textRecord(record.name, record.bytes) ?? '').join('\n')
  // This proves the generated asset made it through the package, rather than
  // merely validating its source file. The accompanying sentinel sweep proves
  // those terms did not bring their source-book membership along with them.
  const missing = entries.filter((entry) => !text.includes(entry.da) || !text.includes(entry.en))
  return missing.slice(0, 3).map((entry) => `${entry.da} / ${entry.en}`)
}

function inspectProvenance(records, expectedAudience, expectedSourceSha) {
  if (!expectedAudience) return []
  const violations = []
  const matches = records.filter((record) => basename(record.name) === RELEASE_PROVENANCE_FILE)
  if (matches.length !== 1) {
    return [`package must contain exactly one ${RELEASE_PROVENANCE_FILE}; found ${matches.length}`]
  }
  let provenance
  try {
    provenance = JSON.parse(matches[0].bytes.toString('utf8'))
  } catch {
    return [`${matches[0].name}: release provenance is not valid JSON`]
  }
  if (provenance.schemaVersion !== RELEASE_PROVENANCE_SCHEMA) violations.push(`${matches[0].name}: unsupported release provenance schema`)
  if (provenance.audience !== expectedAudience) violations.push(`${matches[0].name}: expected ${expectedAudience} audience, found ${JSON.stringify(provenance.audience)}`)
  if (expectedSourceSha && provenance.sourceSha !== expectedSourceSha) violations.push(`${matches[0].name}: source SHA does not match the approved source`)
  if (provenance.checkoutSha !== provenance.sourceSha) violations.push(`${matches[0].name}: checkout SHA does not match source SHA`)
  if (expectedAudience === 'normal') {
    if (provenance.expectedSourceSha !== provenance.sourceSha) violations.push(`${matches[0].name}: normal build has no matching expected source SHA`)
    if (provenance.workflowSha !== provenance.sourceSha) violations.push(`${matches[0].name}: workflow definition SHA does not match source SHA`)
    if (provenance.appVersion !== '1.0') violations.push(`${matches[0].name}: normal build is not app version 1.0`)
    for (const error of validatePublicPolicy(provenance.publicPolicy ?? {})) {
      violations.push(`${matches[0].name}: ${error}`)
    }
  }

  const packagedText = records.map((record) => textRecord(record.name, record.bytes) ?? '').join('\n')
  const expectedMarker = `__900WORDS_BUILD_AUDIENCE__:${expectedAudience}`
  if (!packagedText.includes(expectedMarker)) violations.push(`${matches[0].name}: package is missing ${expectedMarker}`)
  for (const audience of ['normal', 'feedback', 'developer', 'web-demo']) {
    if (audience !== expectedAudience && packagedText.includes(`__900WORDS_BUILD_AUDIENCE__:${audience}`)) {
      violations.push(`${matches[0].name}: package contains conflicting ${audience} audience marker`)
    }
  }
  return violations
}

export function inspectReleasePackage(target, dataDir, {
  allowOnDeviceOrchestration = false,
  allowOnDeviceCity1Corpus = false,
  expectedAudience = '',
  expectedSourceSha = '',
} = {}) {
  const records = packageEntries(target)
  if (records.length === 0) throw new Error(`release package is empty: ${target}`)
  const lexicon = derivedLexicon(dataDir)
  assertFlatLexicon(lexicon.entries)
  const corpus = corpusSentinels(dataDir)
  const onDevice = allowOnDeviceCity1Corpus ? onDeviceCorpus(corpus) : []
  const sentinels = [
    ...corpus.filter((item) => !onDevice.includes(item)),
    ...(allowOnDeviceOrchestration ? [] : orchestrationSentinels(dataDir)),
  ]
  const violations = []

  for (const record of records) {
    const normalizedName = record.name.replaceAll('\\', '/')
    const file = basename(normalizedName)
    if (CORPUS_FILE.test(normalizedName)) violations.push(`${record.name}: authored book or matrix was packaged`)
    if (RAW_VOTES_OR_RATIONALES.test(normalizedName)) violations.push(`${record.name}: raw votes or rationales were packaged`)
    if (ON_DEVICE_MODEL.test(normalizedName)) violations.push(`${record.name}: on-device model was packaged instead of downloaded`)
    if (INTERNAL_PLAN.test(normalizedName)) violations.push(`${record.name}: internal plan was packaged`)
    if (RESEARCH_OR_WORKER_PATH.test(normalizedName)) violations.push(`${record.name}: research or Worker-only path was packaged`)
    if (SECRET_FILENAME.test(normalizedName)) violations.push(`${record.name}: secret-shaped file was packaged`)
    if (file.endsWith('.map')) violations.push(`${record.name}: source map was packaged`)
    const content = textRecord(normalizedName, record.bytes)
    if (content === null) continue
    if (/sourceMappingURL\s*=|sourceMappingURL=/i.test(content)) violations.push(`${record.name}: source-map reference was packaged`)
    // `rationale` is a live Casey response field the client needs to render.
    // The private *raw* corpus instead uses `why` beside scores and votes; do
    // not make this gate reject the product's public decision projection.
    // On-device Casey's own chunk carries City 1's book, `why` lines and all;
    // no other file may, and every other city's sentinels still apply to it.
    const onDeviceChunk = onDevice.some((sentinel) => content.includes(sentinel.value))
    if (!onDeviceChunk && /"(?:votes?|why)"\s*:/i.test(content)) {
      violations.push(`${record.name}: raw votes or rationales were packaged`)
    }
    for (const pattern of SECRET_TEXT) {
      if (pattern.test(content)) violations.push(`${record.name}: API key or secret material was packaged`)
    }
    for (const sentinel of sentinels) {
      if (content.includes(sentinel.value)) violations.push(`${record.name}: contains private server material from ${sentinel.source}`)
    }
  }

  const missingLexiconTerms = packageHasEveryLexiconTerm(records, lexicon.entries)
  if (missingLexiconTerms.length) {
    violations.push(`${target}: missing derived {da,en} lexicon terms (${missingLexiconTerms.join(', ')})`)
  }
  violations.push(...inspectProvenance(records, expectedAudience, expectedSourceSha))
  return { files: records.length, sentinels: sentinels.length, lexiconTerms: lexicon.entries.length, violations }
}

function main() {
  const root = process.cwd()
  const targets = process.argv.slice(2)
  if (targets.length === 0) targets.push('dist')
  const dataDir = join(root, 'proxy', 'data')
  const results = targets.map((target) => ({
    target,
    ...inspectReleasePackage(resolve(root, target), dataDir, {
      allowOnDeviceOrchestration: process.env.CAP_BUILD === '1' || onDeviceCaseyBuild(),
      allowOnDeviceCity1Corpus: onDeviceCaseyBuild(),
      expectedAudience: process.env.RELEASE_EXPECTED_AUDIENCE ?? '',
      expectedSourceSha: process.env.RELEASE_EXPECTED_SOURCE_SHA ?? '',
    }),
  }))
  const violations = results.flatMap((result) => result.violations)
  if (violations.length) {
    console.error('SEC4 release package gate failed:')
    for (const violation of violations) console.error(`  ${violation}`)
    process.exit(1)
  }
  for (const result of results) {
    console.log(`SEC4 package: ${result.target} (${result.files} files, ${result.lexiconTerms} flat L1 terms, ${result.sentinels} private sentinels clear)`)
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (invoked) main()
