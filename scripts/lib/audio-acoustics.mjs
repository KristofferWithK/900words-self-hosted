/**
 * Decoded-audio measurements and the release gate built on them.
 *
 * Pure functions over PCM samples, so the thresholds can be tested against
 * synthetic fixtures in node (scripts/lib/audio-acoustics.test.mjs) while the
 * real clips are decoded where the app decodes them — Chromium's
 * `decodeAudioData` (scripts/validate-audio-acoustics.mjs). The onset rule is
 * the one scripts/measure-audio-lead.mjs has always used: the first 5 ms
 * window whose RMS exceeds -40 dBFS.
 *
 * A level is not a pronunciation. Everything here says a clip decodes, is
 * loud enough to hear, starts promptly and was not clipped; whether it says
 * the right word is a listener's call.
 */

export const WINDOW_MS = 5
export const SIGNAL_DBFS = -40
/** |sample| at or above this counts as full scale. */
export const CLIP_LEVEL = 0.999
/**
 * Consecutive full-scale samples that count as clipping. Chirp3's own bakes
 * are mastered to 0 dBFS and decode with inter-sample overs: across the 3,805
 * shipped Danish clips the longest full-scale run is 3 samples (2026-09-26).
 * Gain pushed into a limiter flattens tens of samples per peak, so 6 separates
 * the two with margin on both sides. Processed replacements are held tighter
 * (their receipt's `maxClipRun`).
 */
export const CLIP_RUN = 6

export const dbfs = (linear) => (linear > 0 ? 20 * Math.log10(linear) : -Infinity)

/** Measure one decoded mono channel. */
export function measurePcm(samples, sampleRate) {
  const windowSamples = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000))
  const threshold = Math.pow(10, SIGNAL_DBFS / 20)
  let peak = 0
  let clippedSamples = 0
  let longestClipRun = 0
  let run = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
    if (a >= CLIP_LEVEL) {
      clippedSamples++
      run++
      if (run > longestClipRun) longestClipRun = run
    } else {
      run = 0
    }
  }
  let onset = -1
  let end = -1
  let activeSquares = 0
  let activeCount = 0
  for (let i = 0; i + windowSamples <= samples.length; i += windowSamples) {
    let squareSum = 0
    for (let j = i; j < i + windowSamples; j++) squareSum += samples[j] * samples[j]
    const rms = Math.sqrt(squareSum / windowSamples)
    if (rms > threshold) {
      if (onset < 0) onset = i
      end = i + windowSamples
      activeSquares += squareSum
      activeCount += windowSamples
    }
  }
  const ms = (n) => Math.round((n / sampleRate) * 1000)
  return {
    durationMs: ms(samples.length),
    peakDbfs: dbfs(peak),
    leadMs: onset < 0 ? null : ms(onset),
    tailMs: end < 0 ? null : ms(samples.length - end),
    // Speech level: the RMS of only the windows above the onset threshold, so
    // a long silent pad does not make a clip look quiet.
    activeRmsDbfs: activeCount ? dbfs(Math.sqrt(activeSquares / activeCount)) : -Infinity,
    activeMs: ms(activeCount),
    clippedSamples,
    longestClipRun,
  }
}

/**
 * `minActiveRmsDbfs` is the speech level: RMS over the windows above the
 * -40 dBFS onset threshold, so it cannot fall to -40 itself; the floor has to
 * sit above that to mean anything. The quietest shipped speech is -27.0 dBFS
 * (a normal word) against a median near -18, so -32 leaves 5 dB of margin
 * under today's quietest clip and still rejects a voice that only a spike
 * lifts over the peak floor.
 *
 * The gate's limits per family. Measured against the shipped inventory on
 * 2026-09-26 (docs/evidence/release-audio-completion-2026-09-26.md has the
 * distribution each limit was set against); a limit is the edge of what ships
 * today plus the owner's "prompt start" rule, never widened to admit a new
 * outlier. `maxLeadMs` is null where the lead is not a prompt-start concern
 * (a chapter performance opens with its own breath).
 */
export const FAMILY_LIMITS = {
  word: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: 300, minDurationMs: 180 },
  article: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: 300, minDurationMs: 120 },
  sentence: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: 600, minDurationMs: 400 },
  line: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: 600, minDurationMs: 250 },
  chapter: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: null, minDurationMs: 1000 },
  // The old train ride's sentences: shipped, reached by nothing but their
  // tests since 2026-09-05 (CLAUDE.md, src/journey/). Decoded and level-checked;
  // their lead is not a prompt-start concern while no screen plays them.
  retired: { minPeakDbfs: -25, minActiveRmsDbfs: -32, maxLeadMs: null, minDurationMs: 400 },
}

/** Which limits a path under public/audio/<lang>/ is held to. */
export function familyOf(relPath) {
  if (relPath.startsWith('article/')) return 'article'
  if (relPath.startsWith('chapter/')) return 'chapter'
  if (relPath.startsWith('story/')) return 'retired'
  if (/^(example|city1)\//.test(relPath)) return 'sentence'
  if (/^(survival|task)\//.test(relPath)) return 'line'
  return 'word'
}

/**
 * Every reason a measured clip fails its family's limits. `exceptions` pins a
 * known, documented outlier to its measured value: the exception holds only
 * while the clip still measures what was recorded, so a drift in either
 * direction is reported rather than absorbed.
 */
export function evaluateClip(relPath, m, { exceptions = {}, leadMap } = {}) {
  const problems = []
  if (m.error) return [`${relPath}: could not decode (${m.error})`]
  const limits = FAMILY_LIMITS[familyOf(relPath)]
  if (m.durationMs < limits.minDurationMs) problems.push(`${relPath}: ${m.durationMs}ms is shorter than the ${limits.minDurationMs}ms floor (empty or truncated)`)
  const known = exceptions[relPath]
  if (m.leadMs === null) {
    if (!known?.silent) problems.push(`${relPath}: no ${WINDOW_MS}ms window rises above ${SIGNAL_DBFS} dBFS (silent)`)
    return problems
  }
  if (known?.silent) problems.push(`${relPath}: documented as silent but now decodes with a voice; remove the exception`)
  if (m.peakDbfs <= limits.minPeakDbfs) problems.push(`${relPath}: peak ${m.peakDbfs.toFixed(1)} dBFS is at or below the ${limits.minPeakDbfs} dBFS floor (near-silent)`)
  if (m.activeRmsDbfs <= limits.minActiveRmsDbfs) problems.push(`${relPath}: speech level ${m.activeRmsDbfs.toFixed(1)} dBFS is at or below ${limits.minActiveRmsDbfs} dBFS`)
  if (m.longestClipRun >= CLIP_RUN) problems.push(`${relPath}: ${m.longestClipRun} consecutive full-scale samples (clipped)`)
  if (limits.maxLeadMs !== null && m.leadMs > limits.maxLeadMs) {
    if (known?.leadMs === undefined) {
      problems.push(`${relPath}: ${m.leadMs}ms of silence before the voice exceeds ${limits.maxLeadMs}ms`)
    } else if (Math.abs(m.leadMs - known.leadMs) > WINDOW_MS) {
      problems.push(`${relPath}: documented long lead moved from ${known.leadMs}ms to ${m.leadMs}ms; re-review the exception`)
    }
  } else if (known?.leadMs !== undefined) {
    problems.push(`${relPath}: documented long-lead exception (${known.leadMs}ms) no longer applies (${m.leadMs}ms); remove it`)
  }
  if (leadMap) {
    const mapped = leadMap[relPath]
    if (mapped !== undefined && Math.abs(mapped - m.leadMs) > WINDOW_MS) {
      problems.push(`${relPath}: measured onset ${m.leadMs}ms disagrees with audio-lead map ${mapped}ms`)
    }
  }
  return problems
}
