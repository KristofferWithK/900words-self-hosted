import { sfxUrl } from './sfx'

/**
 * The wheel's clack track: one short WAV per spin with every clack already
 * in place, played on ONE media element (sfx.ts `playSfxTrack`).
 *
 * Why a track (owner, build 123: "When I spun the wheel, the sound wasn't
 * matching the spinning. That felt like a clunky experience."). The clacks
 * were right on paper: a frame loop read the disc's angle back and started
 * the frozen tick file once per segment boundary. But each of those was a
 * media-element start, and on an iPhone a media element takes a varying
 * 20–90 ms from `play()` to sound even when it is loaded and waiting (ios-sim
 * run 21, audioContext.ts) — more when it has to seek back to 0 or is still
 * sounding the previous clack. At up to 30 clacks a second that turns an
 * even, slowing rattle into a late and lumpy one, and the starts already
 * asked for kept sounding after the disc had stopped. The app cannot use Web
 * Audio buffers instead (iOS drops them once a media element ends; see
 * `WEB_AUDIO` in speak.ts), so the clacks are mixed into one file here, from
 * the same frozen tick and the same curve the disc turns on
 * (`spinTickTimes`), and the media element is started once. Its start-up
 * cost is paid before the disc moves: the spinner waits for the track to be
 * `playing` and then starts the disc on it.
 *
 * Nothing here plays anything. It decodes the tick file and writes WAV bytes.
 */

/** A mono 16-bit PCM clip: the tick as the render script froze it. */
export interface PcmClip {
  readonly rate: number
  readonly samples: Int16Array
}

/**
 * Read a RIFF/WAVE file of 16-bit PCM (what scripts/render-ui-sfx.mjs
 * writes) into its samples, first channel only. `null` for anything else, so
 * a file that is not what the renderer writes leaves the spinner on its
 * per-clack fallback rather than playing noise.
 */
export function parseWavPcm16(bytes: ArrayBuffer): PcmClip | null {
  if (bytes.byteLength < 44) return null
  const view = new DataView(bytes)
  const tag = (at: number) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let format: { channels: number; rate: number; bits: number; audioFormat: number } | null = null
  let at = 12
  while (at + 8 <= bytes.byteLength) {
    const id = tag(at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (id === 'fmt ' && size >= 16) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      }
    } else if (id === 'data') {
      if (!format || format.audioFormat !== 1 || format.bits !== 16 || format.channels < 1 || format.rate <= 0) return null
      const frames = Math.floor(Math.min(size, bytes.byteLength - body) / (2 * format.channels))
      const samples = new Int16Array(frames)
      for (let i = 0; i < frames; i++) samples[i] = view.getInt16(body + i * 2 * format.channels, true)
      return { rate: format.rate, samples }
    }
    at = body + size + (size % 2)
  }
  return null
}

/**
 * Mix `clip` in at each of `timesMs` (plus `leadMs` of silence in front) and
 * return the whole thing as a mono 16-bit WAV file. The file ends where the
 * last clack ends: nothing in it sounds after the last boundary's clack.
 * Overlapping clacks add, clipped to the 16-bit range.
 */
export function renderClackTrack(clip: PcmClip, timesMs: readonly number[], leadMs = 0): Uint8Array {
  const at = timesMs.map((t) => Math.max(0, Math.round(((leadMs + t) * clip.rate) / 1000)))
  const frames = at.length ? Math.max(...at) + clip.samples.length : Math.round((leadMs * clip.rate) / 1000)
  const mix = new Int32Array(frames)
  for (const start of at) {
    for (let i = 0; i < clip.samples.length; i++) mix[start + i]! += clip.samples[i]!
  }
  const out = new Uint8Array(44 + frames * 2)
  const view = new DataView(out.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, clip.rate, true)
  view.setUint32(28, clip.rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, mix[i]!)), true)
  return out
}

/**
 * The bytes as a `data:` URL. Not a `blob:` URL: inside the native shell a
 * media element could not load a blob minted at `capacitor://localhost`
 * (build 58, see `clipSource` in speak.ts). A data URL carries its bytes with
 * it and needs no loader at all.
 */
export function wavDataUrl(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x2000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}

let tick: PcmClip | null = null
let loading: Promise<PcmClip | null> | null = null

/**
 * Fetch and decode the frozen tick once, ahead of the first spin (the
 * spinner asks when it mounts). Quiet: a tick that will not load leaves the
 * spinner on its per-clack fallback.
 */
export function loadClackSample(): Promise<PcmClip | null> {
  if (tick) return Promise.resolve(tick)
  if (loading) return loading
  if (typeof fetch === 'undefined') return Promise.resolve(null)
  loading = fetch(sfxUrl('tick'))
    // The native shell answers a media file with status 0 and no type (see
    // the loader in speak.ts), so the bytes are the verdict, not the status.
    .then((res) => res.arrayBuffer())
    .then((bytes) => (tick = parseWavPcm16(bytes)))
    .catch(() => null)
    .finally(() => {
      loading = null
    })
  return loading
}

/** The decoded tick, if `loadClackSample` has finished; a spin never waits for it. */
export function clackSample(): PcmClip | null {
  return tick
}

/** Tests only. */
export function resetClackSampleForTests(sample: PcmClip | null = null): void {
  tick = sample
  loading = null
}
