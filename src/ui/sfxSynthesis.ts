/**
 * The SPECIFICATION of the three UI sound effects — the Web Audio graphs they
 * were first synthesized with, moved here verbatim from `feedback.ts`.
 *
 * Nothing in the shipping app runs this any more. The effects play as frozen
 * files through media elements (`sfx.ts`), because on the owner's iPhone the
 * shared AudioContext these graphs ran on went silent partway through a
 * session and took every effect with it — the same failure build 61 hit
 * for words ("it plays when I launch the app but then it stops"; see
 * `WEB_AUDIO` in speak.ts). `scripts/render-ui-sfx.mjs` renders each graph
 * once on an OfflineAudioContext in Chromium and writes the result to
 * `public/audio/ui/`. To change a sound: change it HERE, re-render, commit the
 * files and this together.
 *
 * Every function schedules from `at` (a time on `context`'s clock) and takes
 * its noise from `random`, so a render can use a seeded source and come out
 * the same twice. The numbers are the owner-approved sound design; the
 * comments beside them are the reasons they were chosen.
 */

type Random = () => number

/** How long each effect lasts, in seconds — the latest `stop()` it schedules. */
export const SFX_DURATION = {
  tick: 0.05,
  blip: 0.16,
  fanfare: 1.84,
  // Every café-collect candidate is this long, so the owner's pick can be
  // swapped by its file name alone (sfx.ts SFX_FILES).
  cafe: 0.8,
} as const

export type SfxKind = keyof typeof SFX_DURATION

/**
 * The short descending "no" — the error blip that replaced the ✕ mark
 * (owner, build 87: "maybe just some kind of like a negative sound that shows
 * that that was not the correct word"). A low tone sliding DOWN, ~150ms, quiet
 * enough to read as a shake's voice rather than as an alarm: deliberately not
 * a reward's rising two-note motif and not a noise burst.
 */
export function synthErrorBlip(context: BaseAudioContext, at: number): void {
  const now = at
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(220, now)
  oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.14)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.16)
}

/**
 * One wheel tick — the click-clack of a segment passing the pointer (owner,
 * 2026-09-18: "more click-clack ticks during the spin; the tick sound should
 * track the segments passing, not a fixed metronome"). A short, dry, woody
 * click: a faster, brighter cousin of the (retired) suitcase clack, pitched so a run of
 * them reads as a ratchet rather than as individual taps.
 */
export function synthWheelTick(context: BaseAudioContext, at: number, random: Random = Math.random): void {
  const now = at
  // The click: ~12ms of noise through a ~4kHz bandpass — shorter and higher
  // than the suitcase clack's 40ms/2.2kHz, so consecutive ticks stay distinct
  // even at the spin's fastest (a segment every ~60ms early in the spin).
  const burstLength = Math.round(context.sampleRate * 0.012)
  const burst = context.createBuffer(1, burstLength, context.sampleRate)
  const channel = burst.getChannelData(0)
  for (let i = 0; i < burstLength; i++) {
    channel[i] = random() * 2 - 1
  }
  const noise = context.createBufferSource()
  noise.buffer = burst
  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 4000
  bandpass.Q.value = 1.2
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.14, now + 0.002)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)
  noise.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(context.destination)
  noise.start(now)
  noise.stop(now + 0.025)
  // The body: a ~180Hz sine, ~40ms, quieter than the click — the peg the
  // pointer slaps, felt more than heard.
  const peg = context.createOscillator()
  const pegGain = context.createGain()
  peg.type = 'sine'
  peg.frequency.setValueAtTime(180, now)
  pegGain.gain.setValueAtTime(0.0001, now)
  pegGain.gain.exponentialRampToValueAtTime(0.06, now + 0.004)
  pegGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
  peg.connect(pegGain)
  pegGain.connect(context.destination)
  peg.start(now)
  peg.stop(now + 0.05)
}

/** A small brass-like ta-ta-daa for a green wheel landing, after the ticks stop. */
export function synthWheelWinFanfare(context: BaseAudioContext, at: number): void {
  const now = at
  // Rising notes lead into a held tonic/fifth for the win's celebration:
  // distinct from the wooden ratchet and suitcase latch.
  for (const [pitch, offset, length, volume] of [
    [392, 0, 0.13, 0.035],
    [523.25, 0.16, 0.13, 0.035],
    [659.25, 0.33, 1.5, 0.028],
    [523.25, 0.33, 1.5, 0.022],
  ] as const) {
    const start = now + offset
    const oscillator = context.createOscillator()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(pitch, start)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(850, start)
    filter.frequency.exponentialRampToValueAtTime(1700, start + 0.045)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025)
    gain.gain.setValueAtTime(volume, start + length - 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + length + 0.01)
  }
}

/**
 * One decaying sine partial: a few ms of attack, then an exponential fall to
 * silence over `length` — the shape a struck bell, coin or cup has.
 */
function partial(
  context: BaseAudioContext,
  destination: AudioNode,
  start: number,
  pitch: number,
  volume: number,
  length: number,
  type: OscillatorType = 'sine',
  attack = 0.003,
): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(pitch, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(start)
  oscillator.stop(start + length + 0.01)
}

/** A gentle lowpass in front of the speaker, so nothing in a café sound is shrill. */
function warmOut(context: BaseAudioContext, cutoff: number): AudioNode {
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  filter.Q.value = 0.5
  filter.connect(context.destination)
  return filter
}

/*
 * THE CAFÉ-COLLECT CANDIDATES — Casey walks through a café found on the road
 * (owner, 2026-10-05: "Add a satisfying sound when someone collects the
 * cafés"). Three directions for the owner to hear side by side; each is
 * rendered to its own file (public/audio/ui/cafe-collect-<a|b|c>.wav) and the
 * one that plays is picked by its file name in sfx.ts SFX_FILES. All three are
 * `SFX_DURATION.cafe` long and sit at the level of the error blip and the
 * wheel fanfare. None is a rising sawtooth (the fanfare), a falling tone (the
 * blip) or a dry click (the tick).
 */

/**
 * A — the café door bell: two notes rising a fourth (G5, C6), each a bell —
 * a fundamental with a slow 2 Hz beat against a twin, its octave and a faint
 * inharmonic shimmer — ringing out together.
 */
export function synthCafeDoorBell(context: BaseAudioContext, at: number): void {
  const out = warmOut(context, 6000)
  for (const [pitch, offset, volume] of [
    [783.99, 0, 0.036],
    [1046.5, 0.13, 0.04],
  ] as const) {
    const start = at + offset
    for (const [ratio, share, length] of [
      [1, 1, 0.66],
      [1.0026, 0.35, 0.6],
      [2, 0.3, 0.3],
      [2.76, 0.12, 0.16],
      [5.4, 0.04, 0.06],
    ] as const) {
      partial(context, out, start, pitch * ratio, volume * share, length)
    }
  }
}

/**
 * B — a soft "ka-ching": a felt stamp landing (a short thump and a muffled
 * tap of noise), a coin's bright ring on top of it, and three tiny sparkles
 * climbing after.
 */
export function synthCafeStamp(context: BaseAudioContext, at: number, random: Random = Math.random): void {
  const out = warmOut(context, 7000)
  // "ka": the stamp — a low thump sliding down, and 25 ms of muffled noise.
  const thump = context.createOscillator()
  const thumpGain = context.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(150, at)
  thump.frequency.exponentialRampToValueAtTime(80, at + 0.07)
  thumpGain.gain.setValueAtTime(0.0001, at)
  thumpGain.gain.exponentialRampToValueAtTime(0.1, at + 0.004)
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.08)
  thump.connect(thumpGain)
  thumpGain.connect(out)
  thump.start(at)
  thump.stop(at + 0.09)
  const burstLength = Math.round(context.sampleRate * 0.025)
  const burst = context.createBuffer(1, burstLength, context.sampleRate)
  const channel = burst.getChannelData(0)
  for (let i = 0; i < burstLength; i++) channel[i] = random() * 2 - 1
  const noise = context.createBufferSource()
  noise.buffer = burst
  const band = context.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1600
  band.Q.value = 0.9
  const noiseGain = context.createGain()
  noiseGain.gain.setValueAtTime(0.0001, at)
  noiseGain.gain.exponentialRampToValueAtTime(0.08, at + 0.002)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
  noise.connect(band)
  band.connect(noiseGain)
  noiseGain.connect(out)
  noise.start(at)
  noise.stop(at + 0.03)
  // "ching": a coin's ring, slightly inharmonic so it reads as metal.
  const ring = at + 0.055
  for (const [pitch, volume, length] of [
    [1567.98, 0.04, 0.55],
    [2093, 0.03, 0.42],
    [2960, 0.016, 0.28],
    [4186, 0.008, 0.16],
  ] as const) {
    partial(context, out, ring, pitch, volume, length, 'sine', 0.002)
  }
  // The sparkle: three quiet pips climbing.
  for (const [pitch, offset] of [
    [3135.96, 0.17],
    [3951.07, 0.23],
    [4698.63, 0.29],
  ] as const) {
    partial(context, out, at + offset, pitch, 0.012, 0.12)
  }
}

/**
 * C — a cup set down on its saucer (two small porcelain clinks, the second
 * softer) and a short bright chord after it: F major with an added ninth,
 * in soft triangles, fading by the end.
 */
export function synthCafeClink(context: BaseAudioContext, at: number): void {
  const out = warmOut(context, 5000)
  for (const [offset, scale, level] of [
    [0, 1, 1],
    [0.065, 0.94, 0.55],
  ] as const) {
    const start = at + offset
    for (const [pitch, volume, length] of [
      [2380, 0.05, 0.11],
      [3710, 0.033, 0.08],
      [5160, 0.017, 0.05],
    ] as const) {
      partial(context, out, start, pitch * scale, volume * level, length, 'sine', 0.0015)
    }
  }
  const chord = at + 0.13
  for (const [pitch, volume] of [
    [698.46, 0.032],
    [880, 0.027],
    [1046.5, 0.026],
    [1567.98, 0.016],
  ] as const) {
    partial(context, out, chord, pitch, volume, 0.66, 'triangle', 0.018)
  }
}

/**
 * The café-collect candidates by letter; each is rendered to
 * `audio/ui/cafe-collect-<letter>.wav`, `SFX_DURATION.cafe` long.
 */
export const CAFE_COLLECT_CANDIDATES = {
  a: synthCafeDoorBell,
  b: synthCafeStamp,
  c: synthCafeClink,
} as const satisfies Record<string, (context: BaseAudioContext, at: number, random?: Random) => void>

/**
 * Each effect's graph, by kind — what the render script walks. The café
 * sound is not here: it is one of `CAFE_COLLECT_CANDIDATES`, chosen by file.
 */
export const SFX_SYNTH: Record<Exclude<SfxKind, 'cafe'>, (context: BaseAudioContext, at: number, random?: Random) => void> = {
  tick: synthWheelTick,
  blip: synthErrorBlip,
  fanfare: synthWheelWinFanfare,
}
