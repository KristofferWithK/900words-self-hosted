import { describe, expect, it } from 'vitest'
import { chapterPerformanceSsml, chapterStarts, silenceIntervals } from './chapter-timings.mjs'

const report = `
[silencedetect @ 000] silence_start: 0
[silencedetect @ 000] silence_end: 0.20 | silence_duration: 0.20
[silencedetect @ 000] silence_start: 1.10
[silencedetect @ 000] silence_end: 1.42 | silence_duration: 0.32
[silencedetect @ 000] silence_start: 2.60
[silencedetect @ 000] silence_end: 2.94 | silence_duration: 0.34
[silencedetect @ 000] silence_start: 4.80
[silencedetect @ 000] silence_end: 5.00 | silence_duration: 0.20
`

describe('chapter silence timing', () => {
  it('turns a chapter into one escaped SSML performance with a measured gap per line', () => {
    expect(chapterPerformanceSsml(['Jeg <går>', 'Du & jeg.'])).toBe(
      '<speak>Jeg &lt;går&gt;<break time="1s"/>Du &amp; jeg.</speak>',
    )
  })

  it('uses only interior gaps as the starts of later chapter lines', () => {
    expect(silenceIntervals(report)).toEqual([
      { start: 0, end: 0.2 },
      { start: 1.1, end: 1.42 },
      { start: 2.6, end: 2.94 },
      { start: 4.8, end: 5 },
    ])
    expect(chapterStarts(report, 5, 3)).toEqual([0, 1.42, 2.94])
  })

  it('fails loudly rather than assigning a wrong line when a gap is missing', () => {
    expect(() => chapterStarts(report, 5, 4)).toThrow('expected at least 3 interior sentence gaps for 4 lines, found 2')
  })

  it('uses the deliberate longest boundaries when a narrator pauses inside a line', () => {
    const withRhetoricalPause = `${report}\n[silencedetect @ 000] silence_start: 3.20\n[silencedetect @ 000] silence_end: 4.10 | silence_duration: 0.90\n`
    expect(chapterStarts(withRhetoricalPause, 5, 3)).toEqual([0, 2.94, 4.1])
  })

  it('fails a malformed ffmpeg transcript instead of inventing a boundary', () => {
    expect(() => silenceIntervals('silence_start: 2.1')).toThrow('1 silence starts but 0 ends')
  })
})
