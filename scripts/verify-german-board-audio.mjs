import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slugForId } from './audio-slug.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const voice = 'de-DE-Chirp3-HD-Aoede'
let checked = 0
const digest = createHash('sha256')
const inventories = new Map()

for (const { dir, count, rate, kind } of [
  { dir: '.', count: 100, rate: 1, kind: 'word' },
  { dir: 'slow', count: 100, rate: 0.7, kind: 'word' },
  { dir: 'article', count: 3, rate: 1, kind: 'article' },
]) {
  const base = resolve(root, 'public/audio/de', dir)
  const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'))
  if (manifest.provider !== 'google' || manifest.voice !== voice || manifest.rate !== rate || manifest.lang !== 'de') {
    throw Error(`${dir}: wrong provider, voice, locale or rate in manifest`)
  }
  const entries = Object.entries(manifest.entries ?? {})
  if (entries.length !== count) throw Error(`${dir}: expected ${count} manifest entries, got ${entries.length}`)
  const files = readdirSync(base).filter(name => name.endsWith('.mp3')).map(name => name.slice(0, -4)).sort()
  const slugs = entries.map(([slug]) => slug).sort()
  if (files.length !== count || files.some((slug, index) => slug !== slugs[index])) {
    throw Error(`${dir}: MP3 files do not match the manifest inventory`)
  }
  const inventory = new Map()
  for (const [slug, entry] of entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string' || !entry.text.trim()) {
      throw Error(`${dir}/${slug}: missing source identity or text in manifest`)
    }
    if (kind === 'word' && (!entry.id.startsWith('de:') || slugForId(entry.id) !== slug)) {
      throw Error(`${dir}/${slug}: word id does not match its audio slug`)
    }
    if (kind === 'article' && (!['das', 'der', 'die'].includes(slug) || entry.id !== `article:de:${slug}` || entry.text !== `${slug[0].toUpperCase()}${slug.slice(1)}`)) {
      throw Error(`${dir}/${slug}: unexpected German article entry`)
    }
    if (inventory.has(slug)) throw Error(`${dir}/${slug}: duplicate inventory entry`)
    inventory.set(slug, { id: entry.id, text: entry.text })
    const stamp = createHash('sha256').update(['google', voice, 'de-DE', String(rate), entry.text].join('\\0')).digest('hex').slice(0, 16)
    if (entry.stamp !== stamp) {
      throw Error(`${dir}/${slug}: source stamp mismatch`)
    }
    const path = resolve(base, `${slug}.mp3`)
    const bytes = readFileSync(path)
    if (bytes.length < 500 || entry.bytes !== bytes.length || statSync(path).size !== bytes.length) {
      throw Error(`${dir}/${slug}: absent or invalid clip size`)
    }
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', path], { encoding: 'utf8' })
    const media = probe.status === 0 ? JSON.parse(probe.stdout) : null
    if (media?.streams?.[0]?.codec_name !== 'mp3' || !(Number(media.format?.duration) > 0.15)) {
      throw Error(`${dir}/${slug}: not a decodable MP3 of usable duration`)
    }
    // Chirp3 can return a valid MP3 containing only near-silence for a short
    // isolated word. Decoding and byte counts alone cannot certify it.
    const volume = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' })
    const peak = Number(volume.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1])
    if (volume.status !== 0 || !Number.isFinite(peak) || peak < -35) {
      throw Error(`${dir}/${slug}: effectively silent MP3 (peak ${peak} dBFS)`)
    }
    digest.update(`${dir}/${slug}:`).update(createHash('sha256').update(bytes).digest('hex')).update('\n')
    checked++
  }
  inventories.set(dir, inventory)
}

const normal = inventories.get('.')
const slow = inventories.get('slow')
if (normal.size !== 100 || slow.size !== 100 || [...normal].some(([slug, entry]) => {
  const slowEntry = slow.get(slug)
  return !slowEntry || slowEntry.id !== entry.id || slowEntry.text !== entry.text
})) throw Error('normal and slow word inventories do not match')
if (checked !== 203) throw Error(`expected 203 clips, got ${checked}`)
console.log(`Verified ${checked} German Aoede MP3 files against their manifests (100 normal, 100 slow, der/die/das); inventory digest ${digest.digest('hex')}`)
