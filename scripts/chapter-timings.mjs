/** Parse and validate ffmpeg's `silencedetect` output for one chapter clip. */

const number = /[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i

/**
 * One request must still carry deliberate, measurable line boundaries. Natural
 * pauses inside a long sentence can be just as quiet as a sentence break, so
 * newlines are not a dependable timing protocol for a neural voice.
 */
export function chapterPerformanceSsml(lines) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.some((line) => !String(line).trim())) {
    throw new Error('chapter performance needs one or more non-empty lines')
  }
  const escape = (line) => String(line).replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])
  return `<speak>${lines.map(escape).join('<break time="1s"/>')}</speak>`
}

/** @returns {{ start: number, end: number }[]} */
export function silenceIntervals(output) {
  const starts = [...output.matchAll(new RegExp(`silence_start:\\s*(${number.source})`, 'gi'))]
    .map((match) => Number(match[1]))
  const ends = [...output.matchAll(new RegExp(`silence_end:\\s*(${number.source})`, 'gi'))]
    .map((match) => Number(match[1]))
  if (starts.length !== ends.length) throw new Error(`ffmpeg reported ${starts.length} silence starts but ${ends.length} ends`)
  return starts.map((start, index) => ({ start, end: ends[index] }))
}

/**
 * Turn the interior sentence gaps into starts. Beginning/end padding is not a
 * line boundary; every other detected interval must be exactly one gap.
 */
export function chapterStarts(output, duration, sentenceCount) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`invalid chapter duration ${duration}`)
  if (!Number.isInteger(sentenceCount) || sentenceCount < 1) throw new Error(`invalid sentence count ${sentenceCount}`)
  const edge = 0.05
  const interior = silenceIntervals(output)
    .filter(({ start, end }) => start > edge && end < duration - edge)
  const expected = sentenceCount - 1
  if (interior.length < expected) {
    throw new Error(`expected at least ${expected} interior sentence gaps for ${sentenceCount} lines, found ${interior.length}`)
  }
  // Chirp3 can make a long rhetorical pause inside an authored line. The SSML
  // breaks inserted between lines are deliberately the longest silences, so
  // choose those rather than letting one natural pause shift every later
  // highlight. Sorting back into time order restores the chapter sequence.
  const boundaries = [...interior]
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, expected)
    .sort((a, b) => a.start - b.start)
  const starts = [0, ...boundaries.map(({ end }) => end)]
  if (starts.some((start, index) => !Number.isFinite(start) || start < 0 || start >= duration || (index > 0 && start <= starts[index - 1]))) {
    throw new Error('chapter timing starts are not strictly increasing inside the clip duration')
  }
  return starts
}
