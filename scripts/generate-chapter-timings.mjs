// Runs after the manual S3 chapter bake. No timing map is emitted until every
// clip has exactly one ffmpeg-detected interior silence per sentence boundary.
// That all-or-nothing write is what makes the app's fallback safe.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chapterStarts } from './chapter-timings.mjs'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const lang = value('lang', 'da')
if (!/^[a-z]{2}$/.test(lang)) {
  console.error(`--lang must be a two-letter code, got "${lang}"`)
  process.exit(2)
}

const sourcePath = resolve(ROOT, `src/data/chapter-audio.${lang}.json`)
const dir = resolve(ROOT, `public/audio/${lang}/chapter`)
const manifestPath = resolve(dir, 'manifest.json')
// The tiny map is precached with the app shell. The large performances remain
// on-demand audio requests; a cached chapter clip is therefore still seekable
// on an offline revisit without spending an entry in the audio LRU.
const out = resolve(ROOT, `public/chapter-timings.${lang}.json`)
if (!existsSync(sourcePath) || !existsSync(manifestPath)) {
  console.error(`Need ${sourcePath.replace(ROOT, '.')} and ${manifestPath.replace(ROOT, '.')} before timing chapters.`)
  process.exit(2)
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const errors = []
const entries = []

const durationOf = (clip) => {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', clip], { encoding: 'utf8' })
  if (probe.status !== 0) {
    throw new Error(probe.error?.message || String(probe.stderr ?? '').trim() || 'ffprobe failed')
  }
  const duration = Number(probe.stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`invalid duration ${probe.stdout.trim()}`)
  return duration
}

for (const chapter of source.entries ?? []) {
  const clip = resolve(dir, `${chapter.id}.mp3`)
  const baked = manifest.entries?.[chapter.id]
  if (!existsSync(clip)) {
    errors.push(`${chapter.id}: no clip at ${clip.replace(ROOT, '.')}`)
    continue
  }
  if (baked?.id !== chapter.id || baked?.sourceHash !== chapter.sourceHash) {
    errors.push(`${chapter.id}: manifest does not match the accepted source hash`)
    continue
  }
  try {
    const duration = durationOf(clip)
    const detect = spawnSync(
      'ffmpeg',
      // Chapter SSML inserts one full second of silence between authored
      // lines. The 0.8-second floor rejects ordinary rhetorical pauses inside
      // a line, which invalidated the original 0.28-second Aoede detector.
      ['-hide_banner', '-i', clip, '-af', 'silencedetect=noise=-36dB:d=0.8', '-f', 'null', '-'],
      { encoding: 'utf8' },
    )
    if (detect.status !== 0) {
      throw new Error(detect.error?.message || String(detect.stderr ?? '').trim() || 'ffmpeg silencedetect failed')
    }
    entries.push({
      id: chapter.id,
      sourceHash: chapter.sourceHash,
      duration,
      starts: chapterStarts(detect.stderr, duration, chapter.linesDa.length),
    })
  } catch (error) {
    errors.push(`${chapter.id}: ${error.message}`)
  }
}

if (errors.length) {
  console.error(`Chapter timing generation failed (${errors.length} chapter${errors.length === 1 ? '' : 's'}):`)
  for (const error of errors) console.error(`  ✗ ${error}`)
  process.exit(1)
}

writeFileSync(out, `${JSON.stringify({ language: lang, entries }, null, 2)}\n`)
console.log(`${entries.length} chapter performances timed → ${out.replace(ROOT, '.')}`)
