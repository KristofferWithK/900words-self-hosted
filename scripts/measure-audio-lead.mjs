#!/usr/bin/env node
/**
 * Measure the silence at the front of every baked clip, and write it where
 * the app can read it: src/data/audio-lead.<lang>.json.
 *
 * Why: the owner heard "a few words play a tiny bit delayed" on build 63
 * and wondered whether the clip itself starts with silence. It does — every
 * one of them. Chirp3 hands back each utterance with a run of silence in
 * front: 370 ms at the median for the ordinary words, 560 for the slow bake,
 * up to 1.3 s (see DECISIONS.md, 2026-09-06). That is ten times anything the
 * tap path was ever costing, and no cache or element pool can remove it —
 * only starting the clip where the voice starts can, which is what the
 * player does with this file (`clipStartAt` in src/ui/speak.ts).
 *
 * Decoded in headless Chromium (OfflineAudioContext.decodeAudioData), the
 * same decoder family the app plays through, because there is no ffmpeg in
 * the web container and a byte count says nothing about time. The onset is
 * the first 5 ms window whose RMS clears -40 dBFS (the bake's own noise floor sits at -50 to -60, and peaks at -47; -45 caught it 350 ms early in «amerikansk»); the player keeps 60 ms of
 * pre-roll before it so a soft consonant is never clipped.
 *
 *   node scripts/measure-audio-lead.mjs            # Danish, every bake
 *   node scripts/measure-audio-lead.mjs --lang da
 *
 * "Every bake" now includes the City 1 sentence bake under
 * `public/audio/da/city1/`, which is a TREE rather than a flat directory and
 * is walked as one. Those clips are trimmed by the importer, not by
 * scripts/trim-audio-silence.mjs — their bytes are hash-pinned in
 * src/data/city1-sentence-audio.da.json, so a second cut would invalidate the
 * manifest. Measuring them is what lets the player start them at the voice.
 *
 * Re-run after every bake that changes a clip; the unit test in
 * speak.test.ts fails if a word has no entry.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'da'
const BAKES = ['', 'slow', 'example', 'survival', 'task', 'article', 'phrase', 'phrase/slow']
/**
 * Bakes whose clips are not one flat directory of `<slug>.mp3`. The City 1
 * sentence bake is `city1/<kind>/<slug>/v<n>/<variant>.mp3`, four levels
 * deep, so it is walked rather than listed — the key stays the whole path
 * under `audio/<lang>/`, which is exactly what `clipStartAt` in speak.ts
 * pulls out of the URL.
 */
const TREES = ['city1']
const THRESHOLD_DBFS = -40
const WINDOW_MS = 5

/** Every .mp3 under `dir`, as paths relative to it, depth-first and sorted. */
function walk(dir, prefix = '') {
  const found = []
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) found.push(...walk(resolve(dir, e.name), `${prefix}${e.name}/`))
    else if (e.name.endsWith('.mp3')) found.push(`${prefix}${e.name}`)
  }
  return found
}

const entries = []
for (const bake of BAKES) {
  const dir = resolve(ROOT, 'public', 'audio', lang, bake)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.mp3')).sort()) {
    entries.push([bake ? `${bake}/${f}` : f, readFileSync(resolve(dir, f)).toString('base64')])
  }
}
for (const tree of TREES) {
  const dir = resolve(ROOT, 'public', 'audio', lang, tree)
  if (!existsSync(dir)) continue
  for (const f of walk(dir)) {
    entries.push([`${tree}/${f}`, readFileSync(resolve(dir, f)).toString('base64')])
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
const measured = await page.evaluate(async ({ entries, threshold, windowMs }) => {
  const out = {}
  const failed = []
  const th = Math.pow(10, threshold / 20)
  for (const [key, b64] of entries) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    let buf
    try {
      buf = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(bytes.buffer)
    } catch (e) {
      failed.push(`${key}: ${String(e)}`)
      continue
    }
    const d = buf.getChannelData(0)
    const win = Math.round((buf.sampleRate * windowMs) / 1000)
    let onset = -1
    for (let i = 0; i + win <= d.length; i += win) {
      let s = 0
      for (let j = i; j < i + win; j++) s += d[j] * d[j]
      if (Math.sqrt(s / win) > th) {
        onset = i
        break
      }
    }
    let end = -1
    for (let i = d.length - win; i >= 0; i -= win) {
      let s = 0
      for (let j = i; j < i + win; j++) s += d[j] * d[j]
      if (Math.sqrt(s / win) > th) {
        end = i + win
        break
      }
    }
    out[key] = {
      lead: onset < 0 ? 0 : Math.round((onset / buf.sampleRate) * 1000),
      tail: end < 0 ? 0 : Math.round(((d.length - end) / buf.sampleRate) * 1000),
      duration: Math.round(buf.duration * 1000),
    }
  }
  return { out, failed }
}, { entries, threshold: THRESHOLD_DBFS, windowMs: WINDOW_MS })
await browser.close()

const keys = Object.keys(measured.out).sort()
const json = {
  thresholdDbfs: THRESHOLD_DBFS,
  windowMs: WINDOW_MS,
  note: 'Milliseconds of silence before the voice in each baked clip, measured by scripts/measure-audio-lead.mjs. The player starts a clip 60 ms before this point.',
  entries: Object.fromEntries(keys.map((k) => [k, measured.out[k].lead])),
  // The silence AFTER the voice, for scripts/trim-audio-silence.mjs; the app
  // reads only `entries`.
  tails: Object.fromEntries(keys.map((k) => [k, measured.out[k].tail])),
}
const target = resolve(ROOT, 'src', 'data', `audio-lead.${lang}.json`)
writeFileSync(target, JSON.stringify(json, null, 0).replace(/,"/g, ',\n"') + '\n')
const report = (label, ks) => {
  const leads = ks.map((k) => measured.out[k].lead).sort((a, b) => a - b)
  if (!leads.length) return
  const q = (p) => leads[Math.floor((leads.length - 1) * p)]
  console.log(`${label}: ${leads.length} clips, lead ms min ${leads[0]} median ${q(0.5)} p90 ${q(0.9)} max ${leads[leads.length - 1]}`)
}
for (const bake of BAKES) {
  report(bake || 'words', keys.filter((k) => (bake ? k.startsWith(`${bake}/`) : !k.includes('/'))))
}
for (const tree of TREES) report(tree, keys.filter((k) => k.startsWith(`${tree}/`)))
/**
 * The City 1 sentence bake trims inside the importer, and 45 of its 704 clips
 * came back `original_preserved_cut_verification_failed` — the cut would not
 * verify sample-for-sample against the original, so the original was kept
 * whole, silence and all. Those are the clips the player's `clipStartAt`
 * offset is actually load-bearing for, and pooling them with the 659 that did
 * trim hides them. Reported apart when the bake's own ledger is on disk;
 * `evidence/**\/raw/` is gitignored but ledger.json is committed.
 */
const ledgerPath = resolve(ROOT, 'evidence', 'city1-aoede-bake-20260910', 'ledger.json')
if (existsSync(ledgerPath)) {
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', 'city1-sentence-audio.da.json'), 'utf8'))
  const untrimmed = new Set(ledger.entries
    .map((e, i) => (e.trim?.method === 'whole_mp3_frames_no_reencode' ? undefined : manifest.recordings[i]?.url))
    .filter(Boolean)
    .map((u) => u.replace(`/audio/${lang}/`, '')))
  report('city1 trimmed', keys.filter((k) => k.startsWith('city1/') && !untrimmed.has(k)))
  report('city1 UNTRIMMED (cut would not verify)', keys.filter((k) => untrimmed.has(k)))
}
if (measured.failed.length) console.log(`not decoded (no entry, played from 0): ${measured.failed.length}\n  ${measured.failed.join('\n  ')}`)
console.log(`wrote ${keys.length} entries to ${target}`)
