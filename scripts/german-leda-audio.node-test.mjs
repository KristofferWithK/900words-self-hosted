import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildLeadMap,
  buildFrozenManifest,
  importVerifiedOutput,
  measureRmsOnset,
  nextAttemptCount,
  dryRunReport,
  providerPayload,
  REQUEST_CAP,
  validateReceiptData,
  validateSignalQuality,
  validateOutputDirectory,
  validateManifestData,
  validateSynthesisEnvironment,
  VERSION,
  VOICE,
  verifyInstalledAssets,
} from './german-leda-audio.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

function makeReceipt(manifest) {
  return {
    schemaVersion: 1,
    manifestSha256: manifest.manifestSha256,
    requestCap: REQUEST_CAP,
    status: 'complete',
    providerPostIntentsThisRun: REQUEST_CAP,
    runId: '123456',
    runAttempt: '1',
    slots: manifest.slots.map((slot) => ({
      slotId: slot.slotId,
      status: 'succeeded',
      requestSha256: slot.requestSha256,
      rawArtifactPath: slot.rawArtifactPath,
      bytes: 512,
      outputSha256: 'a'.repeat(64),
    })),
  }
}

function writeFakeArtifact(manifest, baseDir) {
  const outDir = join(baseDir, 'run')
  mkdirSync(join(outDir, 'raw'), { recursive: true })
  const receipt = makeReceipt(manifest)
  manifest.slots.forEach((slot, index) => {
    const bytes = Buffer.alloc(512, index % 251)
    bytes.write(slot.slotId)
    writeFileSync(join(outDir, slot.rawArtifactPath), bytes)
    receipt.slots[index].bytes = bytes.length
    receipt.slots[index].outputSha256 = hash(bytes)
  })
  writeFileSync(join(outDir, 'attempt-log.json'), JSON.stringify(receipt))
  return { outDir, receipt }
}

function fakeArtifactVerifier(manifest, outDir) {
  const receipt = JSON.parse(readFileSync(join(outDir, 'attempt-log.json'), 'utf8'))
  const byId = validateReceiptData(manifest, receipt)
  const clips = manifest.slots.map((slot) => {
    const bytes = readFileSync(join(outDir, slot.rawArtifactPath))
    const outputSha256 = hash(bytes)
    assert.equal(outputSha256, byId.get(slot.slotId).outputSha256)
    return {
      slotId: slot.slotId,
      leadMs: slot.kind === 'phrase' ? 400 : 70,
      leadClassification: slot.kind === 'phrase' ? 'long-but-compensated-lead' : 'compensated-leading-silence',
      sha256: outputSha256,
      bytes: bytes.length,
    }
  })
  const leadMap = buildLeadMap(manifest, clips)
  return { checked: clips.length, inventorySha256: hash(Buffer.from(JSON.stringify(clips))), clips, leadMap }
}

function seedLeadMapDraft(root, manifest) {
  const sourceDraft = {
    schemaVersion: 1,
    status: 'awaiting-audio',
    version: manifest.version,
    manifestSha256: manifest.manifestSha256,
    thresholdDbfs: -40,
    windowMs: 5,
    prerollMs: 60,
    note: 'Source-pinned lead map. Replace with the validated audio-lead.de.city1.json artifact before importing its raw MP3s; raw synthesis MP3s remain byte-identical.',
    entries: {},
  }
  mkdirSync(join(root, 'src/data'), { recursive: true })
  writeFileSync(join(root, 'src/data/audio-lead.de.city1.json'), JSON.stringify(sourceDraft))
}

test('freezes exactly 310 source-pinned German City 1 Leda slots', () => {
  const manifest = buildFrozenManifest()
  assert.equal(manifest.version, VERSION)
  assert.equal(manifest.voice, VOICE)
  assert.equal(manifest.requestCap, 310)
  assert.deepEqual(manifest.inventory, {
    city1Words: 100,
    articleNouns: 55,
    bareWords: 45,
    variants: ['normal', 'slow'],
    slots: 310,
  })
  assert.equal(manifest.slots.length, 310)
  assert.equal(new Set(manifest.slots.map((slot) => slot.slotId)).size, 310)
  assert.equal(new Set(manifest.slots.map((slot) => slot.outputPath)).size, 310)
  assert.ok(manifest.sourceFiles.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)))
  assert.ok(manifest.slots.every((slot) => /^[a-f0-9]{64}$/.test(slot.sourcePin.wordRecordSha256)))

  const byKindAndVariant = (kind, variant) => manifest.slots.filter((slot) => slot.kind === kind && slot.variant === variant)
  assert.equal(byKindAndVariant('word', 'normal').length, 100)
  assert.equal(byKindAndVariant('word', 'slow').length, 100)
  assert.equal(byKindAndVariant('phrase', 'normal').length, 55)
  assert.equal(byKindAndVariant('phrase', 'slow').length, 55)
  assert.ok(byKindAndVariant('word', 'normal').every((slot) => slot.rate === 1 && slot.outputPath.startsWith(`audio/de/${VERSION}/word/`)))
  assert.ok(byKindAndVariant('word', 'slow').every((slot) => slot.rate === 0.7 && slot.outputPath.startsWith(`audio/de/${VERSION}/word/slow/`)))
  assert.ok(byKindAndVariant('phrase', 'normal').every((slot) => slot.rate === 1 && slot.outputPath.startsWith(`audio/de/${VERSION}/phrase/`)))
  assert.ok(byKindAndVariant('phrase', 'slow').every((slot) => slot.rate === 0.7 && slot.outputPath.startsWith(`audio/de/${VERSION}/phrase/slow/`)))
  assert.ok(!manifest.slots.some((slot) => slot.wordId === 'de:ich'))
})

test('freezes article+noun text as a single capitalized performance', () => {
  const manifest = buildFrozenManifest()
  const phrase = manifest.slots.find((slot) => slot.wordId === 'de:Mädchen' && slot.kind === 'phrase' && slot.variant === 'normal')
  assert.equal(phrase.text, 'Das Mädchen')
  assert.equal(phrase.article, 'das')
  assert.deepEqual(phrase.providerInput, { text: 'Das Mädchen' })
  assert.equal(phrase.outputPath, `audio/de/${VERSION}/phrase/das-maedchen.mp3`)
  const bare = manifest.slots.find((slot) => slot.wordId === 'de:Mädchen' && slot.kind === 'word' && slot.variant === 'normal')
  assert.deepEqual(bare.providerInput, { text: 'Mädchen' })
  assert.equal(bare.outputPath, `audio/de/${VERSION}/word/maedchen.mp3`)
})

test('is deterministic and rejects a modified or stale frozen manifest', () => {
  const first = buildFrozenManifest()
  const second = buildFrozenManifest()
  assert.deepEqual(first, second)
  assert.equal(validateManifestData(first), first)

  const changed = structuredClone(first)
  changed.slots[0].text = 'changed'
  assert.throws(() => validateManifestData(changed), /digest/)

  const wrongVoice = structuredClone(first)
  wrongVoice.voice = 'de-DE-Chirp3-HD-Aoede'
  wrongVoice.manifestSha256 = '0'.repeat(64)
  assert.throws(() => validateManifestData(wrongVoice), /digest/)
})

test('checked-in German lead map is pinned and accepts the empty draft or verifies imported hashes', () => {
  const manifest = buildFrozenManifest()
  const leadMap = JSON.parse(readFileSync(new URL('../src/data/audio-lead.de.city1.json', import.meta.url), 'utf8'))
  assert.equal(leadMap.version, manifest.version)
  assert.equal(leadMap.manifestSha256, manifest.manifestSha256)

  if (leadMap.status === 'awaiting-audio') {
    assert.deepEqual(leadMap.entries, {})
  } else if (leadMap.status === 'complete') {
    assert.equal(Object.keys(leadMap.entries).length, REQUEST_CAP)
    assert.equal(verifyInstalledAssets(manifest, leadMap).checked, REQUEST_CAP)
  } else {
    assert.fail(`unexpected German lead-map status: ${leadMap.status}`)
  }
})

test('dry-run reports the fixed call count without enabling network access', () => {
  const report = dryRunReport(buildFrozenManifest())
  assert.equal(report.plannedProviderPosts, REQUEST_CAP)
  assert.equal(report.providerPostsMade, 0)
  assert.equal(report.networkAccess, false)
  assert.equal(report.inventory.slots, 310)
})

test('provider requests pin the exact voice, locale, rate, input, and MP3 encoding', () => {
  const phrase = buildFrozenManifest().slots.find((slot) => slot.slotId === 'phrase:de:Mädchen:slow')
  assert.deepEqual(providerPayload(phrase), {
    input: { text: 'Das Mädchen' },
    voice: { languageCode: 'de-DE', name: VOICE },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 0.7 },
  })
})

test('synthesis environment rejects local, wrong-branch, failed-gate, and rerun execution', () => {
  const valid = {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/task/release-german-leda-phrases-20260924',
    GITHUB_RUN_ID: '123456',
    GITHUB_RUN_ATTEMPT: '1',
    SYNTHESIS_HISTORY_GATE: 'passed',
    TTS_API_KEY: 'fixture-only',
  }
  assert.deepEqual(validateSynthesisEnvironment(valid), { apiKey: 'fixture-only', runId: '123456' })
  for (const [name, value] of [
    ['GITHUB_ACTIONS', 'false'],
    ['GITHUB_EVENT_NAME', 'workflow_dispatch'],
    ['GITHUB_REF', 'refs/heads/main'],
    ['GITHUB_RUN_ATTEMPT', '2'],
    ['SYNTHESIS_HISTORY_GATE', ''],
    ['TTS_API_KEY', ''],
  ]) {
    assert.throws(() => validateSynthesisEnvironment({ ...valid, [name]: value }), Error)
  }
})

test('the non-overridable write-ahead provider-attempt cap is exactly 310', () => {
  assert.equal(nextAttemptCount(0), 1)
  assert.equal(nextAttemptCount(309), REQUEST_CAP)
  assert.throws(() => nextAttemptCount(REQUEST_CAP), /fixed provider POST cap 310 reached/)
  assert.throws(() => nextAttemptCount(-1), /invalid provider attempt count/)
})

test('5 ms RMS onset measures long raw lead without rejecting it and labels no-signal separately', () => {
  const sampleRate = 48_000
  const samples = sampleRate
  const pcm = Buffer.alloc(samples * 4)
  for (let index = 0; index < samples; index++) {
    const value = index < sampleRate * 0.4 ? 0.00001 : 0.08
    pcm.writeFloatLE(value, index * 4)
  }
  assert.deepEqual(measureRmsOnset(pcm), {
    leadMs: 400,
    leadClassification: 'long-but-compensated-lead',
  })
  assert.deepEqual(measureRmsOnset(Buffer.alloc(samples * 4)), {
    leadMs: null,
    leadClassification: 'no-signal',
  })
  assert.deepEqual(measureRmsOnset(Buffer.alloc(2)), {
    leadMs: null,
    leadClassification: 'no-signal',
  })
})

test('signal gate refuses no-signal and near-silent clips but accepts long compensated lead', () => {
  assert.equal(validateSignalQuality({
    peakDbfs: -5,
    meanDbfs: -21,
    onset: { leadMs: 410, leadClassification: 'long-but-compensated-lead' },
  }), true)
  assert.throws(() => validateSignalQuality({
    peakDbfs: -6,
    meanDbfs: -42,
    onset: { leadMs: 0, leadClassification: 'onset-at-start' },
  }), /near-silent MP3/)
  assert.throws(() => validateSignalQuality({
    peakDbfs: -Infinity,
    meanDbfs: -Infinity,
    onset: { leadMs: null, leadClassification: 'no-signal' },
  }), /no-signal/)
})

test('builds a complete source-pinned lead map only from all 310 verified receipts', () => {
  const manifest = buildFrozenManifest()
  const checked = manifest.slots.map((slot) => ({
    slotId: slot.slotId,
    leadMs: slot.kind === 'phrase' ? 400 : 70,
    leadClassification: slot.kind === 'phrase' ? 'long-but-compensated-lead' : 'compensated-leading-silence',
    sha256: 'a'.repeat(64),
    bytes: 4096,
  }))
  const leadMap = buildLeadMap(manifest, checked)
  assert.equal(leadMap.status, 'complete')
  assert.equal(leadMap.manifestSha256, manifest.manifestSha256)
  assert.equal(Object.keys(leadMap.entries).length, 310)
  assert.equal(leadMap.entries['city1-leda-v1/phrase/das-maedchen.mp3'].leadMs, 400)
  assert.equal(leadMap.entries['city1-leda-v1/phrase/das-maedchen.mp3'].leadClassification, 'long-but-compensated-lead')
  assert.throws(() => buildLeadMap(manifest, checked.slice(0, -1)), /needs 310 verified clip measurements/)
  assert.throws(() => buildLeadMap(manifest, checked.map((entry, index) => index === 0 ? { ...entry, sha256: 'bad' } : entry)), /invalid verified lead measurement/)
})

test('rejects a stale or mismatched synthesis receipt before inspecting media files', () => {
  const manifest = buildFrozenManifest()
  const dir = mkdtempSync(join(tmpdir(), 'german-leda-receipt-'))
  try {
    const stale = makeReceipt(manifest)
    stale.manifestSha256 = '0'.repeat(64)
    writeFileSync(join(dir, 'attempt-log.json'), JSON.stringify(stale))
    assert.throws(() => validateOutputDirectory(manifest, dir), /different frozen manifest/)

    const mismatched = makeReceipt(manifest)
    mismatched.slots[0].requestSha256 = '0'.repeat(64)
    writeFileSync(join(dir, 'attempt-log.json'), JSON.stringify(mismatched))
    assert.throws(() => validateOutputDirectory(manifest, dir), /receipt request SHA-256 does not match/)

    const partial = makeReceipt(manifest)
    partial.status = 'stopped-after-first-provider-failure'
    writeFileSync(join(dir, 'attempt-log.json'), JSON.stringify(partial))
    assert.throws(() => validateOutputDirectory(manifest, dir), /receipt is not complete/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('import refuses an incomplete verifier result before creating runtime paths', () => {
  const manifest = buildFrozenManifest()
  const root = mkdtempSync(join(tmpdir(), 'german-leda-import-partial-'))
  try {
    seedLeadMapDraft(root, manifest)
    assert.throws(() => importVerifiedOutput(manifest, join(root, 'missing-run'), {
      root,
      validateOutput: () => ({ checked: 309, leadMap: { status: 'complete' } }),
    }), /requires all 310 media-verified clips/)
    assert.equal(existsSync(join(root, 'public/audio/de', VERSION)), false)
    assert.equal(JSON.parse(readFileSync(join(root, 'src/data/audio-lead.de.city1.json'), 'utf8')).status, 'awaiting-audio')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('imports only the exact verified 310 assets, writes source hashes, and is idempotent', () => {
  const manifest = buildFrozenManifest()
  const root = mkdtempSync(join(tmpdir(), 'german-leda-import-complete-'))
  try {
    seedLeadMapDraft(root, manifest)
    const { outDir } = writeFakeArtifact(manifest, root)
    const options = { root, validateOutput: fakeArtifactVerifier }
    const first = importVerifiedOutput(manifest, outDir, options)
    assert.equal(first.copied, true)
    assert.equal(first.installed.checked, REQUEST_CAP)
    assert.equal(verifyInstalledAssets(manifest, first.leadMap, { root }).checked, REQUEST_CAP)

    const installedMap = JSON.parse(readFileSync(join(root, 'src/data/audio-lead.de.city1.json'), 'utf8'))
    assert.equal(installedMap.status, 'complete')
    assert.equal(Object.keys(installedMap.entries).length, REQUEST_CAP)
    const phrase = manifest.slots.find((slot) => slot.kind === 'phrase' && slot.wordId === 'de:Mädchen')
    const phraseKey = phrase.outputPath.slice('audio/de/'.length)
    assert.equal(installedMap.entries[phraseKey].sha256, hash(readFileSync(join(outDir, phrase.rawArtifactPath))))
    assert.equal(readFileSync(join(root, 'public', phrase.outputPath)).compare(readFileSync(join(outDir, phrase.rawArtifactPath))), 0)

    const second = importVerifiedOutput(manifest, outDir, options)
    assert.equal(second.copied, false)
    assert.equal(second.installed.checked, REQUEST_CAP)

    writeFileSync(join(root, 'public', manifest.slots[0].outputPath), 'tampered')
    assert.throws(() => importVerifiedOutput(manifest, outDir, options), /installed asset differs from its measured source bytes/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
