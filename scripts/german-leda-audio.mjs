/**
 * Freeze, synthesize, and validate the one-shot German City 1 Leda inventory.
 *
 * The synthesis command is intentionally Actions-only. Every provider POST is
 * preceded by a fsynced write-ahead receipt entry. Raw MP3 responses remain
 * artifacts until the separate, full-inventory import command validates and
 * installs them.
 */
import { createHash } from 'node:crypto'
import {
  closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { audioSlug, slugForId } from './audio-slug.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const VERSION = 'city1-leda-v1'
export const VOICE = 'de-DE-Chirp3-HD-Leda'
export const LOCALE = 'de-DE'
export const REQUEST_CAP = 310
export const RATE_BY_VARIANT = Object.freeze({ normal: 1, slow: 0.7 })
export const WORDS_FILE = 'src/data/words.de.json'
export const CYCLE_FILE = 'src/data/city1-board-cycle.de.json'
export const PROVIDER_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const bytesSha256 = (value) => createHash('sha256').update(value).digest('hex')

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sourceBytes(relativePath, root = ROOT) {
  return readFileSync(resolve(root, relativePath))
}

function safeSlotId(kind, wordId, variant) {
  return `${kind}:${wordId}:${variant}`
}

function requestInputFor(text) {
  return { text }
}

export function providerPayload(slot) {
  return {
    input: slot.providerInput,
    voice: { languageCode: LOCALE, name: VOICE },
    audioConfig: { audioEncoding: 'MP3', speakingRate: slot.rate },
  }
}

function makeSlot({ kind, word, variant, text, article, sourcePins }) {
  const slug = kind === 'word' ? slugForId(word.id) : audioSlug(text, 'de')
  if (!slug) throw new Error(`${word.id}: cannot derive a safe ${kind} audio slug`)
  const slow = variant === 'slow' ? '/slow' : ''
  const outputPath = `audio/de/${VERSION}/${kind}${slow}/${slug}.mp3`
  const providerInput = requestInputFor(text)
  const sourcePin = {
    wordsFileSha256: sourcePins.wordsFileSha256,
    boardCycleSha256: sourcePins.boardCycleSha256,
    wordId: word.id,
    wordRecordSha256: sha256(canonical(word)),
  }
  const slot = {
    slotId: safeSlotId(kind, word.id, variant),
    kind,
    wordId: word.id,
    variant,
    text,
    providerInput,
    locale: LOCALE,
    voice: VOICE,
    rate: RATE_BY_VARIANT[variant],
    encoding: 'MP3',
    outputPath,
    rawArtifactPath: `raw/${sha256(safeSlotId(kind, word.id, variant)).slice(0, 32)}.mp3`,
    sourcePin,
  }
  if (article) slot.article = article
  slot.requestSha256 = sha256(canonical({
    provider: 'google-cloud-text-to-speech',
    voice: slot.voice,
    locale: slot.locale,
    rate: slot.rate,
    encoding: slot.encoding,
    providerInput: slot.providerInput,
    sourcePin: slot.sourcePin,
  }))
  return slot
}

function withManifestDigest(unsigned) {
  return { ...unsigned, manifestSha256: sha256(canonical(unsigned)) }
}

/** Rebuild the deterministic frozen inventory from the current source bytes. */
export function buildFrozenManifest({ root = ROOT, wordsBytes, cycleBytes } = {}) {
  wordsBytes ??= sourceBytes(WORDS_FILE, root)
  cycleBytes ??= sourceBytes(CYCLE_FILE, root)
  const words = JSON.parse(wordsBytes.toString('utf8'))
  const cycle = JSON.parse(cycleBytes.toString('utf8'))
  if (!Array.isArray(words) || !Array.isArray(cycle.boards)) throw new Error('German word data or City 1 cycle has an invalid shape')

  const byId = new Map()
  for (const word of words) {
    if (typeof word?.id !== 'string' || byId.has(word.id)) throw new Error(`invalid or duplicate German word id: ${word?.id}`)
    byId.set(word.id, word)
  }
  const roster = [...new Set(cycle.boards.flatMap((board) => board.wordIds ?? []))]
  if (roster.length !== 100) throw new Error(`expected exactly 100 distinct City 1 words; found ${roster.length}`)
  const rosterWords = roster.map((id) => {
    const word = byId.get(id)
    if (!word) throw new Error(`${id}: City 1 roster word is absent from ${WORDS_FILE}`)
    if (typeof word.da !== 'string' || !word.da.trim()) throw new Error(`${id}: missing German headword`)
    return word
  })
  const eligible = rosterWords.filter((word) => word.pos === 'noun' && ['der', 'die', 'das'].includes(word.article))
  const bare = rosterWords.length - eligible.length
  if (eligible.length !== 55 || bare !== 45) {
    throw new Error(`expected 55 article nouns and 45 bare words; found ${eligible.length} and ${bare}`)
  }

  const sourcePins = {
    wordsFileSha256: bytesSha256(wordsBytes),
    boardCycleSha256: bytesSha256(cycleBytes),
  }
  const slots = []
  for (const variant of Object.keys(RATE_BY_VARIANT)) {
    for (const word of rosterWords) {
      slots.push(makeSlot({ kind: 'word', word, variant, text: word.da, sourcePins }))
    }
    for (const word of eligible) {
      const text = `${word.article[0].toUpperCase()}${word.article.slice(1)} ${word.da}`
      slots.push(makeSlot({ kind: 'phrase', word, variant, text, article: word.article, sourcePins }))
    }
  }
  if (slots.length !== REQUEST_CAP) throw new Error(`frozen inventory is ${slots.length} slots, expected ${REQUEST_CAP}`)
  const ids = new Set()
  const paths = new Set()
  for (const slot of slots) {
    if (ids.has(slot.slotId)) throw new Error(`duplicate slot id ${slot.slotId}`)
    if (paths.has(slot.outputPath)) throw new Error(`duplicate runtime path ${slot.outputPath}`)
    ids.add(slot.slotId)
    paths.add(slot.outputPath)
  }

  return withManifestDigest({
    schemaVersion: 1,
    scope: 'german-city1-board-audio',
    status: 'frozen-source-inventory',
    version: VERSION,
    provider: 'google-cloud-text-to-speech',
    voice: VOICE,
    locale: LOCALE,
    encoding: 'MP3',
    rates: RATE_BY_VARIANT,
    requestCap: REQUEST_CAP,
    inventory: {
      city1Words: rosterWords.length,
      articleNouns: eligible.length,
      bareWords: bare,
      variants: Object.keys(RATE_BY_VARIANT),
      slots: slots.length,
    },
    sourceFiles: [
      { path: WORDS_FILE, sha256: sourcePins.wordsFileSha256 },
      { path: CYCLE_FILE, sha256: sourcePins.boardCycleSha256 },
    ],
    slots,
  })
}

export function validateManifestData(manifest, { root = ROOT } = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest must be an object')
  const { manifestSha256, ...unsigned } = manifest
  if (manifestSha256 !== sha256(canonical(unsigned))) throw new Error('manifest digest is missing or does not match its content')
  const expected = buildFrozenManifest({ root })
  if (canonical(manifest) !== canonical(expected)) {
    throw new Error('manifest does not match the current frozen German City 1 source inventory')
  }
  return manifest
}

export function dryRunReport(manifest) {
  return {
    manifestSha256: manifest.manifestSha256,
    version: manifest.version,
    provider: manifest.provider,
    voice: manifest.voice,
    locale: manifest.locale,
    rates: manifest.rates,
    inventory: manifest.inventory,
    plannedProviderPosts: manifest.slots.length,
    providerPostsMade: 0,
    networkAccess: false,
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`)
  const file = openSync(temp, 'r')
  try { fsyncSync(file) } finally { closeSync(file) }
  renameSync(temp, path)
  const directory = openSync(dirname(path), 'r')
  try { fsyncSync(directory) } finally { closeSync(directory) }
}

function syncFile(path) {
  const file = openSync(path, 'r')
  try { fsyncSync(file) } finally { closeSync(file) }
}

function syncDirectory(path) {
  const directory = openSync(path, 'r')
  try { fsyncSync(directory) } finally { closeSync(directory) }
}

function readManifest(path) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  return validateManifestData(manifest)
}

function parseOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`)
    if (key === '--help') {
      options.help = true
      continue
    }
    const value = args[++index]
    if (!value || value.startsWith('--')) throw new Error(`${key} requires a value`)
    options[key.slice(2)] = value
  }
  return options
}

function requirePath(options, key) {
  if (!options[key]) throw new Error(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`)
  return resolve(options[key])
}

export function validateSynthesisEnvironment(env = process.env) {
  const required = ['TTS_API_KEY', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'SYNTHESIS_HISTORY_GATE']
  for (const name of required) if (!env[name]) throw new Error(`${name} is required for synthesis`)
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'push') {
    throw new Error('synthesis is permitted only in the guarded workflow-file push run')
  }
  if (env.GITHUB_REF !== 'refs/heads/task/release-german-leda-phrases-20260924') {
    throw new Error(`synthesis is restricted to the assigned release branch; got ${env.GITHUB_REF ?? '(no ref)'}`)
  }
  if (env.GITHUB_RUN_ATTEMPT !== '1') throw new Error('workflow reruns are disabled for this one-shot synthesis')
  if (env.SYNTHESIS_HISTORY_GATE !== 'passed') throw new Error('the exact-branch workflow run-history gate did not pass')
  if (!/^\d+$/.test(env.GITHUB_RUN_ID)) throw new Error('GITHUB_RUN_ID must be numeric')
  return { apiKey: env.TTS_API_KEY, runId: env.GITHUB_RUN_ID }
}

export function validateReceiptData(manifest, receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error('synthesis receipt must be an object')
  if (receipt.schemaVersion !== 1) throw new Error('synthesis receipt schema version must be 1')
  if (receipt.manifestSha256 !== manifest.manifestSha256) throw new Error('synthesis receipt belongs to a different frozen manifest')
  if (receipt.status !== 'complete') throw new Error(`synthesis receipt is not complete (status ${receipt.status ?? 'missing'})`)
  if (receipt.requestCap !== REQUEST_CAP) throw new Error(`synthesis receipt request cap must be ${REQUEST_CAP}`)
  if (receipt.providerPostIntentsThisRun !== REQUEST_CAP) {
    throw new Error(`synthesis receipt records ${receipt.providerPostIntentsThisRun ?? 'no'} provider POST intents; expected ${REQUEST_CAP}`)
  }
  if (!/^\d+$/.test(String(receipt.runId ?? ''))) throw new Error('synthesis receipt runId must be numeric')
  if (String(receipt.runAttempt) !== '1') throw new Error('synthesis receipt must be from the first workflow attempt')
  if (!Array.isArray(receipt.slots) || receipt.slots.length !== manifest.slots.length) {
    throw new Error(`synthesis receipt must contain exactly ${manifest.slots.length} slot records`)
  }

  const byId = new Map()
  for (const entry of receipt.slots) {
    if (!entry || typeof entry.slotId !== 'string' || byId.has(entry.slotId)) {
      throw new Error(`synthesis receipt has an invalid or duplicate slot id ${entry?.slotId ?? '(missing)'}`)
    }
    byId.set(entry.slotId, entry)
  }
  if (byId.size !== manifest.slots.length) throw new Error('synthesis receipt slot inventory is incomplete')

  for (const slot of manifest.slots) {
    const entry = byId.get(slot.slotId)
    if (!entry) throw new Error(`${slot.slotId}: synthesis receipt record is missing`)
    if (entry.status !== 'succeeded') throw new Error(`${slot.slotId}: synthesis receipt status is ${entry.status ?? 'missing'}`)
    if (entry.requestSha256 !== slot.requestSha256) throw new Error(`${slot.slotId}: receipt request SHA-256 does not match the frozen manifest`)
    if (entry.rawArtifactPath !== slot.rawArtifactPath) throw new Error(`${slot.slotId}: receipt raw artifact path does not match the frozen manifest`)
    if (!Number.isInteger(entry.bytes) || entry.bytes < 500) throw new Error(`${slot.slotId}: receipt byte count is invalid`)
    if (!/^[a-f0-9]{64}$/.test(entry.outputSha256 ?? '')) throw new Error(`${slot.slotId}: receipt output SHA-256 is invalid`)
  }
  return byId
}

export function nextAttemptCount(currentCount) {
  if (!Number.isInteger(currentCount) || currentCount < 0) throw new Error(`invalid provider attempt count ${currentCount}`)
  if (currentCount >= REQUEST_CAP) throw new Error(`fixed provider POST cap ${REQUEST_CAP} reached`)
  return currentCount + 1
}

function safeError(error) {
  return String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 300)
}

function writeRunState(outDir, manifest, state) {
  state.updatedAt = new Date().toISOString()
  writeJsonAtomic(resolve(outDir, 'attempt-log.json'), {
    schemaVersion: 1,
    manifestSha256: manifest.manifestSha256,
    requestCap: REQUEST_CAP,
    policy: 'Exact-branch Actions history gate plus run_attempt=1; local write-ahead entry before each provider POST; no workflow reruns.',
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    ...state,
  })
}

async function synthesize(manifest, outDir) {
  const env = validateSynthesisEnvironment()
  mkdirSync(resolve(outDir, 'raw'), { recursive: true })
  writeJsonAtomic(resolve(outDir, 'manifest.json'), manifest)

  const state = {
    status: 'running',
    providerPostIntentsThisRun: 0,
    slots: manifest.slots.map((slot) => ({ slotId: slot.slotId, status: 'pending' })),
  }
  writeRunState(outDir, manifest, state)

  for (let index = 0; index < manifest.slots.length; index++) {
    const slot = manifest.slots[index]
    const record = state.slots[index]
    // Write and fsync this intent before the provider POST. The Actions run
    // history gate is the durable cross-run guard if the ephemeral runner dies.
    state.providerPostIntentsThisRun = nextAttemptCount(state.providerPostIntentsThisRun)
    record.status = 'intent-recorded'
    record.requestSha256 = slot.requestSha256
    record.intentRecordedAt = new Date().toISOString()
    writeRunState(outDir, manifest, state)

    let outcome
    try {
      const response = await fetch(PROVIDER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.apiKey },
        body: JSON.stringify(providerPayload(slot)),
        redirect: 'error',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        outcome = { status: 'provider-error', httpStatus: response.status, detail: safeError(body.error?.message ?? `HTTP ${response.status}`) }
      } else if (typeof body.audioContent !== 'string' || !body.audioContent) {
        outcome = { status: 'invalid-response', httpStatus: response.status, detail: 'response omitted audioContent' }
      } else {
        const bytes = Buffer.from(body.audioContent, 'base64')
        if (!bytes.length) outcome = { status: 'invalid-response', httpStatus: response.status, detail: 'audioContent decoded to zero bytes' }
        else {
          const rawPath = resolve(outDir, slot.rawArtifactPath)
          mkdirSync(dirname(rawPath), { recursive: true })
          writeFileSync(rawPath, bytes)
          outcome = { status: 'succeeded', httpStatus: response.status, bytes: bytes.length, outputSha256: bytesSha256(bytes), rawArtifactPath: slot.rawArtifactPath }
        }
      }
    } catch (error) {
      outcome = { status: 'transport-error', detail: safeError(error) }
    }

    Object.assign(record, outcome)
    writeRunState(outDir, manifest, state)
    console.log(`${outcome.status}: ${slot.slotId}`)
    if (outcome.status !== 'succeeded') {
      state.status = 'stopped-after-first-provider-failure'
      writeRunState(outDir, manifest, state)
      throw new Error(`${slot.slotId}: ${outcome.status}; this provider POST is permanently counted and will not be retried`)
    }
  }

  state.status = state.slots.every((slot) => slot.status === 'succeeded') ? 'complete' : 'incomplete'
  writeRunState(outDir, manifest, state)
  console.log(`POST intents this run: ${state.providerPostIntentsThisRun}; fixed cap: ${REQUEST_CAP}`)
}

function runMediaTool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.error) throw new Error(`${command} unavailable: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr ?? '').slice(-1000)}`)
  return result
}

function decodeMonoFloat32(path) {
  const result = spawnSync('ffmpeg', [
    '-nostdin', '-v', 'error', '-i', path,
    '-ac', '1', '-ar', '48000', '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1',
  ], { encoding: null, maxBuffer: 10 * 1024 * 1024 })
  if (result.error) throw new Error(`ffmpeg unavailable: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`ffmpeg PCM decode failed: ${(result.stderr ?? Buffer.alloc(0)).toString('utf8').slice(-1000)}`)
  return result.stdout
}

export function measureRmsOnset(pcmBytes, sampleRate = 48_000, thresholdDbfs = -40, windowMs = 5) {
  if (!Buffer.isBuffer(pcmBytes) || pcmBytes.length < 4 || pcmBytes.length % 4 !== 0) {
    return { leadMs: null, leadClassification: 'no-signal' }
  }
  const samples = pcmBytes.length / 4
  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000))
  const threshold = 10 ** (thresholdDbfs / 20)
  for (let start = 0; start + windowSamples <= samples; start += windowSamples) {
    let sumSquares = 0
    for (let offset = 0; offset < windowSamples; offset++) {
      const sample = pcmBytes.readFloatLE((start + offset) * 4)
      sumSquares += sample * sample
    }
    if (Math.sqrt(sumSquares / windowSamples) > threshold) {
      const leadMs = Math.round((start / sampleRate) * 1000)
      return {
        leadMs,
        leadClassification: leadMs === 0
          ? 'onset-at-start'
          : leadMs > 120 ? 'long-but-compensated-lead' : 'compensated-leading-silence',
      }
    }
  }
  return { leadMs: null, leadClassification: 'no-signal' }
}

function verifyOneClip(slot, runEntry, outDir) {
  if (runEntry.status !== 'succeeded') throw new Error(`${slot.slotId}: run status is ${runEntry.status ?? 'missing'}`)
  if (runEntry.requestSha256 !== slot.requestSha256) throw new Error(`${slot.slotId}: receipt request SHA-256 does not match the frozen manifest`)
  if (runEntry.rawArtifactPath !== slot.rawArtifactPath) throw new Error(`${slot.slotId}: receipt raw artifact path does not match the frozen manifest`)
  const path = resolve(outDir, slot.rawArtifactPath)
  if (!existsSync(path)) throw new Error(`${slot.slotId}: raw artifact is missing`)
  if (!lstatSync(path).isFile()) throw new Error(`${slot.slotId}: raw artifact is not a regular file`)
  const bytes = readFileSync(path)
  const digest = bytesSha256(bytes)
  if (digest !== runEntry.outputSha256) throw new Error(`${slot.slotId}: raw output SHA-256 differs from the synthesis receipt`)
  if (bytes.length !== runEntry.bytes || bytes.length < 500) throw new Error(`${slot.slotId}: invalid byte count ${bytes.length}`)

  const probe = runMediaTool('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', path])
  const media = JSON.parse(probe.stdout)
  const duration = Number(media.format?.duration)
  if (media.streams?.[0]?.codec_name !== 'mp3' || !(duration >= 0.15 && duration <= 12)) {
    throw new Error(`${slot.slotId}: unexpected codec/duration (${media.streams?.[0]?.codec_name}, ${duration})`)
  }
  const volume = runMediaTool('ffmpeg', ['-nostdin', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'])
  const peak = Number(volume.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1])
  const mean = Number(volume.stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1])

  const pcm = decodeMonoFloat32(path)
  const onset = measureRmsOnset(pcm)
  validateSignalQuality({ peakDbfs: peak, meanDbfs: mean, onset })
  return { bytes: bytes.length, sha256: digest, durationSeconds: duration, peakDbfs: peak, ...onset }
}

export function validateSignalQuality({ peakDbfs, meanDbfs, onset }) {
  if (onset?.leadClassification === 'no-signal') throw new Error('no-signal; no 5 ms RMS onset detected above -40 dBFS')
  if (!Number.isFinite(peakDbfs) || !Number.isFinite(meanDbfs) || peakDbfs < -35 || meanDbfs < -35) {
    throw new Error(`near-silent MP3 (peak ${peakDbfs} dBFS, mean ${meanDbfs} dBFS)`)
  }
  if (!Number.isFinite(onset?.leadMs) || onset.leadMs < 0) throw new Error('invalid measured RMS onset')
  return true
}

export function buildLeadMap(manifest, checked) {
  if (!Array.isArray(checked) || checked.length !== manifest.slots.length) {
    throw new Error(`lead map needs ${manifest.slots.length} verified clip measurements; found ${checked?.length ?? 'invalid'}`)
  }
  const checkedById = new Map(checked.map((entry) => [entry.slotId, entry]))
  if (checkedById.size !== checked.length) throw new Error('lead map measurements contain duplicate slot ids')
  const entries = {}
  const leadClasses = new Set(['onset-at-start', 'compensated-leading-silence', 'long-but-compensated-lead'])
  for (const slot of manifest.slots) {
    const clip = checkedById.get(slot.slotId)
    if (!clip || !Number.isFinite(clip.leadMs) || clip.leadMs < 0 || !leadClasses.has(clip.leadClassification)
      || !/^[a-f0-9]{64}$/.test(clip.sha256) || !Number.isInteger(clip.bytes) || clip.bytes < 500) {
      throw new Error(`${slot.slotId}: incomplete or invalid verified lead measurement`)
    }
    const key = slot.outputPath.slice('audio/de/'.length)
    entries[key] = {
      leadMs: clip.leadMs,
      leadClassification: clip.leadClassification,
      sha256: clip.sha256,
      bytes: clip.bytes,
    }
  }
  if (Object.keys(entries).length !== manifest.slots.length) throw new Error('lead map output paths are not unique')
  return {
    schemaVersion: 1,
    status: 'complete',
    version: manifest.version,
    manifestSha256: manifest.manifestSha256,
    thresholdDbfs: -40,
    windowMs: 5,
    prerollMs: 60,
    onsetMethod: 'First 5 ms RMS window above -40 dBFS after FFmpeg mono float32 decode at 48 kHz; raw bytes are not trimmed or re-encoded.',
    entries,
  }
}

export function validateOutputDirectory(manifest, outDir) {
  const runPath = resolve(outDir, 'attempt-log.json')
  if (!existsSync(runPath)) throw new Error(`missing synthesis receipt ${runPath}`)
  const run = JSON.parse(readFileSync(runPath, 'utf8'))
  const byId = validateReceiptData(manifest, run)
  const rawDir = resolve(outDir, 'raw')
  if (!existsSync(rawDir) || !lstatSync(rawDir).isDirectory()) throw new Error('raw artifact directory is missing or invalid')
  const expectedRawNames = new Set(manifest.slots.map((slot) => slot.rawArtifactPath.slice('raw/'.length)))
  const actualRawNames = readdirSync(rawDir)
  if (actualRawNames.length !== expectedRawNames.size || actualRawNames.some((name) => !expectedRawNames.has(name))) {
    throw new Error(`raw artifact directory must contain exactly ${expectedRawNames.size} frozen MP3 files`)
  }
  const checked = []
  for (const slot of manifest.slots) checked.push({ slotId: slot.slotId, ...verifyOneClip(slot, byId.get(slot.slotId) ?? {}, outDir) })
  const leadMap = buildLeadMap(manifest, checked)
  writeJsonAtomic(resolve(outDir, 'audio-lead.de.city1.json'), leadMap)
  return { checked: checked.length, inventorySha256: sha256(canonical(checked)), clips: checked, leadMap }
}

function listTreeFiles(directory, prefix = '') {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...listTreeFiles(resolve(directory, entry.name), key))
    else if (entry.isFile()) files.push(key)
    else throw new Error(`installed audio tree contains a link or unsupported file type: ${key}`)
  }
  return files
}

function verifyAudioTree(manifest, leadMap, versionDir) {
  if (leadMap.status !== 'complete' || leadMap.version !== manifest.version || leadMap.manifestSha256 !== manifest.manifestSha256) {
    throw new Error('German lead map does not match the complete frozen source manifest')
  }
  if (!existsSync(versionDir) || !lstatSync(versionDir).isDirectory()) throw new Error(`installed audio directory is missing: ${versionDir}`)

  const expectedFiles = new Set(manifest.slots.map((slot) => slot.outputPath.slice(`audio/de/${manifest.version}/`.length)))
  const actualFiles = listTreeFiles(versionDir)
  if (actualFiles.length !== expectedFiles.size || actualFiles.some((file) => !expectedFiles.has(file))) {
    throw new Error(`installed audio tree must contain exactly ${expectedFiles.size} versioned MP3 files`)
  }
  const leadEntries = leadMap.entries
  if (!leadEntries || Object.keys(leadEntries).length !== manifest.slots.length) {
    throw new Error(`German lead map must contain exactly ${manifest.slots.length} source hashes`)
  }

  const inventory = []
  let totalBytes = 0
  for (const slot of manifest.slots) {
    const key = slot.outputPath.slice('audio/de/'.length)
    const entry = leadEntries[key]
    if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !Number.isInteger(entry.bytes)) {
      throw new Error(`${slot.slotId}: installed lead-map source hash is missing or invalid`)
    }
    const path = resolve(versionDir, slot.outputPath.slice(`audio/de/${manifest.version}/`.length))
    if (!lstatSync(path).isFile()) throw new Error(`${slot.slotId}: installed asset is not a regular file`)
    const bytes = readFileSync(path)
    const digest = bytesSha256(bytes)
    if (bytes.length !== entry.bytes || digest !== entry.sha256) {
      throw new Error(`${slot.slotId}: installed asset differs from its measured source bytes`)
    }
    totalBytes += bytes.length
    inventory.push({ path: slot.outputPath, bytes: bytes.length, sha256: digest })
  }
  return { checked: inventory.length, totalBytes, inventorySha256: sha256(canonical(inventory)) }
}

export function verifyInstalledAssets(manifest, leadMap, { root = ROOT } = {}) {
  return verifyAudioTree(manifest, leadMap, resolve(root, 'public/audio/de', manifest.version))
}

function checkReplaceableLeadMap(path, manifest, expected) {
  if (!existsSync(path)) throw new Error(`source-pinned German lead-map draft is missing: ${path}`)
  const current = JSON.parse(readFileSync(path, 'utf8'))
  if (current.version !== manifest.version || current.manifestSha256 !== manifest.manifestSha256) {
    throw new Error('checked-in German lead map is pinned to a different source manifest')
  }
  if (canonical(current) === canonical(expected)) return 'complete'
  if (current.status === 'awaiting-audio' && current.entries && Object.keys(current.entries).length === 0) return 'draft'
  throw new Error('checked-in German lead map is neither the empty source-pinned draft nor this verified complete map')
}

/** Validate the complete raw artifact before staging any runtime asset. */
export function importVerifiedOutput(manifest, outDir, { root = ROOT, validateOutput = validateOutputDirectory } = {}) {
  const report = validateOutput(manifest, outDir)
  if (report.checked !== REQUEST_CAP || report.leadMap?.status !== 'complete') {
    throw new Error(`import requires all ${REQUEST_CAP} media-verified clips`)
  }

  const targetDir = resolve(root, 'public/audio/de', manifest.version)
  const stagingDir = resolve(root, 'public/audio/de', `.${manifest.version}.import-staging`)
  const leadMapPath = resolve(root, 'src/data/audio-lead.de.city1.json')
  const stagingLeadMapPath = resolve(root, 'src/data/.audio-lead.de.city1.json.import-staging')
  const leadMapState = checkReplaceableLeadMap(leadMapPath, manifest, report.leadMap)

  if (existsSync(targetDir)) {
    const installed = verifyInstalledAssets(manifest, report.leadMap, { root })
    if (leadMapState === 'draft') writeJsonAtomic(leadMapPath, report.leadMap)
    const installedMap = JSON.parse(readFileSync(leadMapPath, 'utf8'))
    if (canonical(installedMap) !== canonical(report.leadMap)) throw new Error('installed German lead map differs from the verified artifact')
    return { ...report, installed, copied: false }
  }
  if (existsSync(stagingDir) || existsSync(stagingLeadMapPath)) {
    throw new Error('German Leda import staging path already exists; inspect it before retrying')
  }

  mkdirSync(dirname(targetDir), { recursive: true })
  mkdirSync(stagingDir)
  let movedToTarget = false
  let leadMapInstalled = false
  try {
    for (const slot of manifest.slots) {
      const relativePath = slot.outputPath.slice(`audio/de/${manifest.version}/`.length)
      const destination = resolve(stagingDir, relativePath)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(resolve(outDir, slot.rawArtifactPath), destination)
      syncFile(destination)
    }
    const stagedAssets = verifyAudioTree(manifest, report.leadMap, stagingDir)
    writeJsonAtomic(stagingLeadMapPath, report.leadMap)
    renameSync(stagingDir, targetDir)
    movedToTarget = true
    const installed = verifyInstalledAssets(manifest, report.leadMap, { root })
    if (installed.inventorySha256 !== stagedAssets.inventorySha256) throw new Error('installed audio inventory changed during import')
    renameSync(stagingLeadMapPath, leadMapPath)
    leadMapInstalled = true
    syncDirectory(dirname(leadMapPath))
    const installedMap = JSON.parse(readFileSync(leadMapPath, 'utf8'))
    if (canonical(installedMap) !== canonical(report.leadMap)) throw new Error('installed German lead map differs from the verified artifact')
    return { ...report, installed, copied: true }
  } catch (error) {
    if (!leadMapInstalled) {
      if (movedToTarget && existsSync(targetDir) && !existsSync(stagingDir)) renameSync(targetDir, stagingDir)
      if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true })
      if (existsSync(stagingLeadMapPath)) rmSync(stagingLeadMapPath, { force: true })
    }
    throw error
  }
}

const HELP = `German City 1 Leda audio (zero-cost unless the Actions-only synth command is run)

  node scripts/german-leda-audio.mjs freeze --out PATH [--github-output PATH]
  node scripts/german-leda-audio.mjs dry-run --manifest PATH
  node scripts/german-leda-audio.mjs synthesize --manifest PATH --out DIR
  node scripts/german-leda-audio.mjs validate --manifest PATH --out DIR
  node scripts/german-leda-audio.mjs import --manifest PATH --out DIR

Synthesis is restricted to the disarmed-until-coordinator-reviewed workflow-file
push on task/release-german-leda-phrases-20260924, after its exact-branch run-
history gate. It writes and fsyncs an attempt-log intent before each POST.
Import is a separate local command: it validates the complete receipt and all
310 raw MP3s before staging runtime files and the measured source lead map.
Workflow reruns and identical request retries are disabled; there is no cap override.
`

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  const options = parseOptions(args)
  if (options.help) {
    console.log(HELP)
    return
  }
  if (command === 'freeze') {
    const manifest = buildFrozenManifest()
    const out = requirePath(options, 'out')
    writeJsonAtomic(out, manifest)
    console.log(`frozen ${manifest.inventory.slots} source-pinned slots; sha256 ${manifest.manifestSha256}`)
    if (options['github-output']) writeFileSync(resolve(options['github-output']), `manifest_sha256=${manifest.manifestSha256}\n`, { flag: 'a' })
    return
  }
  const manifest = readManifest(requirePath(options, 'manifest'))
  if (command === 'dry-run') {
    const report = dryRunReport(manifest)
    console.log(JSON.stringify(report, null, 2))
    console.log('DRY RUN: zero provider POSTs; no network access')
    return
  }
  if (command === 'synthesize') {
    await synthesize(manifest, requirePath(options, 'out'))
    return
  }
  if (command === 'validate') {
    const report = validateOutputDirectory(manifest, requirePath(options, 'out'))
    console.log(`Verified ${report.checked} original German Leda MP3 artifacts; inventory sha256 ${report.inventorySha256}`)
    return
  }
  if (command === 'import') {
    const report = importVerifiedOutput(manifest, requirePath(options, 'out'))
    console.log(`${report.copied ? 'Imported' : 'Already installed'} ${report.installed.checked} exact German Leda MP3 assets; ${report.installed.totalBytes} bytes; inventory sha256 ${report.installed.inventorySha256}`)
    return
  }
  throw new Error(`unknown command ${command}\n${HELP}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`german-leda-audio: ${safeError(error)}`)
    process.exitCode = 1
  })
}
