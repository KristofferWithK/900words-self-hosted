#!/usr/bin/env node
/**
 * Render the three UI sound effects to files: public/audio/ui/<name>.wav.
 *
 * The sound design lives in src/ui/sfxSynthesis.ts — the Web Audio graphs the
 * effects were first played live with. The app no longer runs them (a live
 * AudioContext went silent on the owner's iPhone mid-session; see sfx.ts), so
 * this script runs each graph ONCE on an OfflineAudioContext in headless
 * Chromium and freezes the result as 16-bit PCM WAV. The tick's noise burst
 * takes a seeded generator, so a re-render is the same
 * sound, not merely a similar one.
 *
 *   node scripts/render-ui-sfx.mjs            write the three files
 *   node scripts/render-ui-sfx.mjs --dry-run  render and report, write nothing
 *
 * Chromium: CHROMIUM_PATH, or the container's /opt/pw-browsers/chromium.
 * WAV rather than the word bake's MP3: these are a few KB each, and PCM has no
 * encoder delay or padding to put in front of a 50 ms tick.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'public', 'audio', 'ui')
const SAMPLE_RATE = 44100
const SEED = 900
/** Published file name for each synthesized kind. */
const FILES = {
  tick: 'wheel-tick.wav',
  blip: 'error-blip.wav',
  fanfare: 'wheel-win.wav',
}
const dryRun = process.argv.includes('--dry-run')

const source = readFileSync(join(root, 'src', 'ui', 'sfxSynthesis.ts'), 'utf8')
const { code } = transformSync(source, { loader: 'ts', format: 'iife', globalName: 'SFX' })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
try {
  const page = await browser.newPage()
  await page.addScriptTag({ content: code })
  const rendered = await page.evaluate(
    async ({ sampleRate, seed }) => {
      // mulberry32: small, seeded, good enough for a noise burst.
      const seeded = (s) => () => {
        s |= 0
        s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const out = {}
      for (const [kind, synth] of Object.entries(window.SFX.SFX_SYNTH)) {
        const seconds = window.SFX.SFX_DURATION[kind]
        const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate)
        synth(ctx, 0, seeded(seed))
        const buffer = await ctx.startRendering()
        out[kind] = Array.from(buffer.getChannelData(0))
      }
      return out
    },
    { sampleRate: SAMPLE_RATE, seed: SEED },
  )

  if (!dryRun) mkdirSync(OUT, { recursive: true })
  for (const [kind, samples] of Object.entries(rendered)) {
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    if (peak >= 1) throw new Error(`${kind} clips (peak ${peak.toFixed(3)}); the synthesis must stay under full scale`)
    if (peak === 0) throw new Error(`${kind} rendered silence`)
    const wav = encodeWav(samples, SAMPLE_RATE)
    const file = join(OUT, FILES[kind])
    console.log(
      `${FILES[kind].padEnd(20)} ${(samples.length / SAMPLE_RATE).toFixed(3)} s  peak ${peak.toFixed(3)}  ${wav.length} bytes`,
    )
    if (!dryRun) writeFileSync(file, wav)
  }
  if (dryRun) console.log('(dry run: nothing written)')
} finally {
  await browser.close()
}

/** Mono 16-bit PCM WAV. */
function encodeWav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
