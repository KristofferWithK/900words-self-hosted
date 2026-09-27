#!/usr/bin/env node
/**
 * Bake the City 1 review sentences that the frozen Aoede manifest does not
 * cover: German's 100 (Leda, the German board voice) and the Danish focus
 * upgrade's 29 (Aoede, the voice of every other Danish review sentence).
 * Each sentence gets the same two performances as the accepted Danish set:
 * normal at rate 1 and slow at rate 0.7, both played back at 1.
 *
 *   node scripts/bake-city1-review-audio.mjs --lang de --dry-run
 *   node scripts/bake-city1-review-audio.mjs --lang de            (reads $TTS_API_KEY)
 *   node scripts/bake-city1-review-audio.mjs --lang da
 *
 * Resumable: a clip already on disk whose provenance row names the same text,
 * voice and rate is kept. Every new clip must decode, last at least 0.4 s and
 * peak above -30 dBFS (Chirp3 answered four «Tak.» Survival lines with silence,
 * #294), or the bake stops before writing any manifest.
 *
 * Writes the runtime projection the app imports (the eight SentenceRecording
 * fields) and, beside it, a provenance file the app never imports.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { slugForId } from './audio-slug.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : ''
const dryRun = args.includes('--dry-run')
const CONFIG = {
  de: {
    rows: 'src/data/city1-review.de.json', voice: 'de-DE-Chirp3-HD-Leda', locale: 'de-DE',
    runtime: 'src/data/city1-sentence-audio.de.runtime.json', provenance: 'src/data/city1-sentence-audio.de.provenance.json',
  },
  da: {
    rows: 'src/data/city1-review-upgrade.da.json', voice: 'da-DK-Chirp3-HD-Aoede', locale: 'da-DK',
    runtime: 'src/data/city1-sentence-audio.da.upgrade.runtime.json', provenance: 'src/data/city1-sentence-audio.da.upgrade.provenance.json',
  },
}
const RATES = { normal: 1, slow: 0.7 }
const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize'
const cfg = CONFIG[lang]
if (!cfg) {
  console.error('Usage: node scripts/bake-city1-review-audio.mjs --lang de|da [--dry-run]')
  process.exit(2)
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const readJson = (path, fallback) => existsSync(resolve(ROOT, path)) ? JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) : fallback

function measure(path) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' })
  const volume = spawnSync('ffmpeg', ['-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' })
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(volume.stderr ?? '')?.[1])
  return { durationSeconds: Number(probe.stdout.trim()), peakDb: peak }
}

const rows = readJson(cfg.rows).review
const previous = new Map((readJson(cfg.provenance, { recordings: [] }).recordings).map((r) => [r.url, r]))
const slots = rows.flatMap((row) => Object.entries(RATES).map(([variant, bakeRate]) => {
  const slug = slugForId(row.wordId)
  if (!slug) throw new Error(`${row.wordId}: no audio slug`)
  return {
    audioId: row.audioId, sentenceId: row.sentenceId, version: row.version, textDa: row.text.da,
    url: `/audio/${lang}/city1/review/${slug}/v${row.version}/${variant}.mp3`, variant, bakeRate, playbackRate: 1,
  }
}))
const kept = slots.filter((slot) => {
  const before = previous.get(slot.url)
  return before && before.textDa === slot.textDa && before.voice === cfg.voice && before.bakeRate === slot.bakeRate &&
    existsSync(resolve(ROOT, 'public', slot.url.slice(1))) && sha256(readFileSync(resolve(ROOT, 'public', slot.url.slice(1)))) === before.sha256
})
const todo = slots.filter((slot) => !kept.includes(slot))
const characters = todo.reduce((sum, slot) => sum + slot.textDa.length, 0)
console.log(`${cfg.voice}: ${slots.length} clips for ${rows.length} sentences · ${kept.length} kept · ${todo.length} to make · ${characters} characters (about $${(characters * 30 / 1e6).toFixed(2)} at list price)`)
if (dryRun) process.exit(0)
const key = process.env.TTS_API_KEY
if (!key && todo.length) {
  console.error('Set $TTS_API_KEY to bake.')
  process.exit(2)
}

const provenance = new Map([...previous].filter(([url]) => kept.some((slot) => slot.url === url)))
const problems = []
for (const [index, slot] of todo.entries()) {
  const body = JSON.stringify({
    input: { text: slot.textDa }, voice: { languageCode: cfg.locale, name: cfg.voice },
    audioConfig: { audioEncoding: 'MP3', speakingRate: slot.bakeRate },
  })
  let bytes
  for (let attempt = 1; attempt <= 3 && !bytes; attempt++) {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    if (res.ok) bytes = Buffer.from((await res.json()).audioContent, 'base64')
    else if (attempt === 3) problems.push(`${slot.url}: provider answered ${res.status}`)
    else await new Promise((done) => setTimeout(done, 1000 * attempt))
  }
  if (!bytes) continue
  const path = resolve(ROOT, 'public', slot.url.slice(1))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
  const { durationSeconds, peakDb } = measure(path)
  if (!(durationSeconds >= 0.4) || !(peakDb > -30)) problems.push(`${slot.url}: ${durationSeconds}s, peak ${peakDb} dB — no voice`)
  provenance.set(slot.url, {
    ...slot, voice: cfg.voice, languageCode: cfg.locale, audioEncoding: 'MP3',
    payloadSha256: sha256(body), sha256: sha256(bytes), durationSeconds, peakDb,
  })
  process.stdout.write(`\r${index + 1}/${todo.length}`)
}
if (todo.length) process.stdout.write('\n')
if (problems.length) {
  console.error(`Stopped without writing a manifest:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

const ordered = slots.map((slot) => provenance.get(slot.url))
writeFileSync(resolve(ROOT, cfg.provenance), `${JSON.stringify({ language: lang, voice: cfg.voice, recordings: ordered }, null, 2)}\n`)
const fields = ['audioId', 'sentenceId', 'version', 'textDa', 'url', 'variant', 'bakeRate', 'playbackRate']
const runtime = ordered.map((r) => Object.fromEntries(fields.map((field) => [field, r[field]])))
writeFileSync(resolve(ROOT, cfg.runtime), `${JSON.stringify({ status: 'complete', recordings: runtime }, null, 2)}\n`)
console.log(`${ordered.length} recordings → ${cfg.runtime}`)
