#!/usr/bin/env node
/**
 * Cut the silence off the front and back of every baked clip, in place,
 * without re-encoding: whole MP3 frames are dropped, and the audio that is
 * kept is bit-for-bit what the bake produced.
 *
 * Why: Chirp3 pads every utterance — 365 ms at the median before a word's
 * voice, up to 1.3 s — and that was the delay the owner could still feel
 * after every tap-path change (DECISIONS.md, 2026-09-06). The app can start
 * a clip at its measured onset (src/data/audio-lead.da.json), but the owner
 * asked the better question: "can't we just cut the silence? No rebake?"
 *
 * How, and why it is safe without a decoder:
 *
 * The bake is MPEG-2 Layer III, 32 kbps, 24 kHz, mono: 96-byte frames of
 * 576 samples, 24 ms each, no Xing/Info frame, contiguous. Dropping whole
 * frames keeps every remaining frame's bytes intact. The one thing a cut
 * can disturb is the BIT RESERVOIR: a Layer III frame's main data may begin
 * up to `main_data_begin` (≤ 255) bytes BEFORE its header, inside the main
 * data areas of earlier frames, so the first frames after a cut can point
 * at bytes that are gone. A decoder treats such a frame the way it treats
 * the first frame after a SEEK — which is exactly what this is — and mutes
 * it until the reservoir is whole again. So the cut is placed where the
 * frames that would be muted are silence by measurement: the cut point is
 * the nearest frame boundary (2–4 frames before the onset frame) at which
 * the onset frame, the one before it and the two after it all find their
 * whole reservoir among the kept frames' main-data areas (83 bytes each).
 *
 * (Rewriting the side info of the cut frames into "silent, self-contained"
 * frames was tried first, and made things WORSE in Chromium's decoder — it
 * keeps a compacted reservoir of the bytes a frame did not consume, so
 * changing what the leading frames consume moves every later frame's data.
 * A raw frame cut is what every player does when it seeks; leave it raw.)
 *
 * Trailing frames are simply dropped (the reservoir only reaches backwards),
 * leaving TAIL_KEEP_MS after the last sound.
 *
 * Then it VERIFIES, in headless Chromium: every trimmed clip decodes, its
 * voice matches the original sample for sample from the frame after the
 * onset (the onset frame itself may differ by the overlap of a muted
 * neighbour, under −34 dBFS), and the frames before the onset decode no
 * louder than the original's own silence. A clip that fails verification
 * is left untouched and reported.
 *
 *   node scripts/measure-audio-lead.mjs     # first: the onsets and tails
 *   node scripts/trim-audio-silence.mjs     # then this, in place
 *   node scripts/measure-audio-lead.mjs     # again: the leads should read ~90 ms
 *
 * Re-baking into the same filenames needs the service worker's cacheName
 * bumped (vite.config.ts) — done with the first trim — and the TestFlight
 * bundle carries the trimmed files as it carries any build.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'da'
/**
 * `--only article/` restricts the pass to the entries under one prefix. The
 * trap it exists for: this script is NOT idempotent over clips it has
 * already cut. A second pass reads the ~70 ms lead the first one left and
 * takes another two frames off — 234 word, example, survival and task
 * clips changed bytes on 2026-09-07 when a pass meant for two new article
 * clips ran over everything, which would have meant a cacheName bump for
 * two files' worth of work. Trim a NEW bake by its directory; leave the
 * rest alone.
 */
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : ''
const MIN_PRE_FRAMES = 2
const MAX_PRE_FRAMES = 4
const TAIL_KEEP_MS = 100
const BITRATES_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
const SAMPLE_RATES_MPEG2 = [22050, 24000, 16000, 0]
const SAMPLES_PER_FRAME = 576

/** Every frame of an MPEG-2 Layer III stream: where it is, how long, and where its main data begins. */
function parseFrames(buf) {
  let i = 0
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    i = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f))
  }
  const frames = []
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return { error: `lost sync at byte ${i}`, frames }
    const version = (buf[i + 1] >> 3) & 3
    const layer = (buf[i + 1] >> 1) & 3
    const noCrc = buf[i + 1] & 1
    const bitrateIndex = buf[i + 2] >> 4
    const sampleRateIndex = (buf[i + 2] >> 2) & 3
    const padding = (buf[i + 2] >> 1) & 1
    const mode = buf[i + 3] >> 6
    if (version !== 2 || layer !== 1 || mode !== 3 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      return { error: `frame at ${i} is not MPEG-2 Layer III mono (version ${version}, layer ${layer}, mode ${mode})`, frames }
    }
    const sampleRate = SAMPLE_RATES_MPEG2[sampleRateIndex]
    const length = Math.floor((72 * BITRATES_MPEG2[bitrateIndex] * 1000) / sampleRate) + padding
    if (i + length > buf.length) return { error: `truncated frame at ${i}`, frames }
    const sideInfoAt = i + 4 + (noCrc ? 0 : 2)
    frames.push({ at: i, length, sampleRate, sideInfoAt, mainDataBegin: buf[sideInfoAt], mainDataArea: length - (sideInfoAt - i) - 9 })
    i += length
  }
  return { frames }
}

/** Drop frames before `cut` and from `end`; every kept frame's bytes stay as they were. */
function trim(buf, frames, cut, end) {
  return Buffer.concat(frames.slice(cut, end).map((f) => buf.subarray(f.at, f.at + f.length)))
}

/**
 * The cut for an onset frame: the latest boundary at which the onset frame,
 * the frame before it and the two after it can all reach their reservoir
 * in kept frames, between MIN_PRE_FRAMES and MAX_PRE_FRAMES before it.
 */
function cutBefore(frames, onsetFrame) {
  for (let pre = MIN_PRE_FRAMES; pre <= MAX_PRE_FRAMES; pre++) {
    const cut = onsetFrame - pre
    if (cut <= 0) return 0
    const reaches = [onsetFrame - 1, onsetFrame, onsetFrame + 1, onsetFrame + 2].every((f) => {
      if (f >= frames.length) return true
      const available = frames.slice(cut, f).reduce((n, k) => n + k.mainDataArea, 0)
      return frames[f].mainDataBegin <= available
    })
    if (reaches) return cut
  }
  return Math.max(0, onsetFrame - MAX_PRE_FRAMES)
}

const lead = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', `audio-lead.${lang}.json`), 'utf8'))
const jobs = []
let skipped = 0
for (const key of Object.keys(lead.entries).sort()) {
  if (only && !key.startsWith(only)) continue
  // The City 1 sentence bake trims inside its own importer and pins every
  // clip's sha256 in src/data/city1-sentence-audio.da.json, which
  // `npm run validate:audio` checks. A cut here would change those bytes and
  // fail that check — and, unlike the word bakes, there is no re-bake to
  // recover from it: the run was a one-shot authorised paid workflow. The
  // clips are in audio-lead.<lang>.json only so the player can start them at
  // the voice.
  if (key.startsWith('city1/')) continue
  const path = resolve(ROOT, 'public', 'audio', lang, key)
  if (!existsSync(path)) continue
  const onsetMs = lead.entries[key]
  const tailMs = lead.tails?.[key] ?? 0
  if (!onsetMs) {
    skipped++
    continue
  }
  const original = readFileSync(path)
  const { frames, error } = parseFrames(original)
  if (error) {
    console.log(`SKIP ${key}: ${error}`)
    skipped++
    continue
  }
  const frameMs = (SAMPLES_PER_FRAME / frames[0].sampleRate) * 1000
  const onsetFrame = Math.floor(onsetMs / frameMs)
  const cut = cutBefore(frames, onsetFrame)
  const durationMs = frames.length * frameMs
  const end = Math.min(frames.length, Math.ceil((durationMs - tailMs + TAIL_KEEP_MS) / frameMs))
  if (cut === 0 && end === frames.length) {
    skipped++
    continue
  }
  const out = trim(original, frames, cut, end)
  jobs.push({ key, path, original, out, cut, end, total: frames.length, onsetFrame, frameMs, sampleRate: frames[0].sampleRate })
}

// ---- verify in Chromium before anything is written ---------------------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
const verdicts = await page.evaluate(async (items) => {
  // Decoded at the file's own rate: decodeAudioData resamples to the
  // context's rate, and a resampled buffer no longer lines up frame for frame.
  const decode = async (b64, rate) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const buf = await new OfflineAudioContext(1, rate, rate).decodeAudioData(bytes.buffer)
    return buf.getChannelData(0)
  }
  const out = {}
  for (const it of items) {
    try {
      const a = await decode(it.original, it.sampleRate)
      const b = await decode(it.trimmed, it.sampleRate)
      const shift = it.cut * 576
      // The voice, from the frame after the onset: must be the same samples.
      // The onset frame itself may carry the overlap of a muted neighbour.
      const onsetAt = (it.onsetFrame - it.cut) * 576
      const from = onsetAt + 576
      let maxDiff = 0
      let compared = 0
      for (let i = from; i < b.length && i + shift < a.length; i++) {
        const d = Math.abs(a[i + shift] - b[i])
        if (d > maxDiff) maxDiff = d
        compared++
      }
      let onsetDiff = 0
      for (let i = onsetAt; i < from && i + shift < a.length; i++) onsetDiff = Math.max(onsetDiff, Math.abs(a[i + shift] - b[i]))
      // Before the onset: silence, and no click from a patched frame.
      let prePeak = 0
      const preEnd = Math.min(b.length, (it.onsetFrame - it.cut) * 576)
      for (let i = 0; i < preEnd; i++) prePeak = Math.max(prePeak, Math.abs(b[i]))
      // And the original's own level in that stretch, for the comparison.
      let origPrePeak = 0
      for (let i = shift; i < shift + preEnd && i < a.length; i++) origPrePeak = Math.max(origPrePeak, Math.abs(a[i]))
      out[it.key] = { ok: true, maxDiff, onsetDiff, compared, prePeak, origPrePeak, samples: b.length }
    } catch (e) {
      out[it.key] = { ok: false, error: String(e) }
    }
  }
  return out
}, jobs.map((j) => ({ key: j.key, original: j.original.toString('base64'), trimmed: j.out.toString('base64'), cut: j.cut, onsetFrame: j.onsetFrame, sampleRate: j.sampleRate })))
await browser.close()

let written = 0
let bytesBefore = 0
let bytesAfter = 0
const failed = []
let worstDiff = 0
let worstOnset = 0
let worstPre = 0
for (const j of jobs) {
  const v = verdicts[j.key]
  // A voice that decodes differently, or a click before it, is a failed cut.
  const good = v.ok && v.compared > 0 && v.maxDiff < 1e-3 && v.onsetDiff < 0.02 && v.prePeak <= Math.max(0.02, v.origPrePeak * 1.5)
  if (!good) {
    failed.push(`${j.key}: ${JSON.stringify(v)}`)
    continue
  }
  writeFileSync(j.path, j.out)
  written++
  bytesBefore += j.original.length
  bytesAfter += j.out.length
  worstDiff = Math.max(worstDiff, v.maxDiff)
  worstOnset = Math.max(worstOnset, v.onsetDiff)
  worstPre = Math.max(worstPre, v.prePeak)
}
console.log(`trimmed ${written} clips in place (${skipped} left as they were): ${bytesBefore} → ${bytesAfter} bytes`)
console.log(`verified in Chromium: voice identical to the original from the frame after the onset (worst sample difference ${worstDiff.toExponential(2)}; onset frame itself ≤ ${worstOnset.toExponential(2)}), pre-onset peak ≤ ${worstPre.toFixed(4)}`)
if (failed.length) {
  console.log(`NOT trimmed, verification failed (${failed.length}):\n  ${failed.join('\n  ')}`)
  process.exitCode = 1
}
