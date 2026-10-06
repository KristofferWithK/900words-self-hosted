#!/usr/bin/env node
/**
 * Are the UI sound effects actually in this tree, and are they the files
 * the player expects?
 *
 *   node scripts/validate-ui-sfx.mjs                     public/ (the source)
 *   node scripts/validate-ui-sfx.mjs dist ios/App/App/public
 *
 * The effects used to be synthesized in code, so a build could not ship
 * without them. Frozen into files (sfx.ts, scripts/render-ui-sfx.mjs), they
 * can: a stray ignore rule or a bad `cap sync` would type-check, build, pass
 * every unit test and reach a phone silent — the same way build 22 shipped
 * with no word audio. The TestFlight workflow runs this over the Vite output
 * and the tree Capacitor staged for Xcode.
 *
 * The file list is read out of src/ui/sfx.ts (SFX_FILES) and each length out
 * of src/ui/sfxSynthesis.ts (SFX_DURATION), so neither is restated here. Each
 * file must be mono 16-bit PCM WAV, as long as its synthesis to the sample,
 * and not silent.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = process.argv.slice(2)
if (dirs.length === 0) dirs.push('public')

const sfxSource = readFileSync(join(root, 'src', 'ui', 'sfx.ts'), 'utf8')
const files = Object.fromEntries(
  [...sfxSource.matchAll(/^\s*(\w+): '(audio\/ui\/[\w-]+\.wav)',$/gm)].map((m) => [m[1], m[2]]),
)
const synthSource = readFileSync(join(root, 'src', 'ui', 'sfxSynthesis.ts'), 'utf8')
const durations = Object.fromEntries(
  [...(synthSource.match(/SFX_DURATION = \{([^}]*)\}/)?.[1] ?? '').matchAll(/(\w+): ([\d.]+)/g)].map((m) => [
    m[1],
    Number(m[2]),
  ]),
)
const kinds = ['tick', 'blip', 'fanfare', 'cafe']
for (const kind of kinds) {
  if (!files[kind]) fail(`src/ui/sfx.ts names no file for "${kind}" (SFX_FILES changed shape?)`)
  if (!durations[kind]) fail(`src/ui/sfxSynthesis.ts gives no duration for "${kind}" (SFX_DURATION changed shape?)`)
}

let problems = 0
for (const dir of dirs) {
  for (const kind of kinds) {
    const path = join(resolve(root, dir), files[kind])
    const problem = check(path, durations[kind])
    if (problem) {
      problems++
      console.error(`::error::${dir}/${files[kind]}: ${problem}`)
    } else {
      console.log(`${dir}/${files[kind]} ok`)
    }
  }
}
if (problems) {
  console.error(`${problems} UI sound effect file(s) missing or wrong — the build would play those effects as silence`)
  process.exit(1)
}

function check(path, seconds) {
  if (!existsSync(path)) return 'missing'
  const b = readFileSync(path)
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    return 'not a RIFF/WAVE file'
  }
  if (b.toString('ascii', 12, 16) !== 'fmt ' || b.readUInt16LE(20) !== 1) return 'not PCM'
  const channels = b.readUInt16LE(22)
  const rate = b.readUInt32LE(24)
  const bits = b.readUInt16LE(34)
  if (channels !== 1 || bits !== 16) return `expected mono 16-bit, found ${channels} ch ${bits}-bit`
  if (b.toString('ascii', 36, 40) !== 'data') return 'no data chunk where the renderer writes it'
  const frames = b.readUInt32LE(40) / 2
  const expected = Math.ceil(seconds * rate)
  if (frames !== expected) return `${frames} frames, the synthesis is ${expected} (${seconds} s at ${rate} Hz) — re-render`
  let peak = 0
  for (let i = 44; i + 1 < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)))
  if (peak === 0) return 'silent'
  return null
}

function fail(message) {
  console.error(`::error::${message}`)
  process.exit(1)
}
