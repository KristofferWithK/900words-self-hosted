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

/** Each effect's graph, by kind — what the render script walks. */
export const SFX_SYNTH: Record<SfxKind, (context: BaseAudioContext, at: number, random?: Random) => void> = {
  tick: synthWheelTick,
  blip: synthErrorBlip,
  fanfare: synthWheelWinFanfare,
}
