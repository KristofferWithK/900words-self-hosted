import { describe, expect, it } from 'vitest'
import { danishChapterAudio, danishGrammarLessonAudio } from '../lang/da/chapter-audio'
import { danishGrammarCourse } from '../lang/da/curriculum-grammar'
import {
  chapterLineAt,
  createChapterPlaybackGeneration,
  startChapterPlayback,
  usableChapterTiming,
} from './chapterPerformance'

describe('chapter performances', () => {
  it('derives one Danish-only continuous source from every accepted destination chapter', () => {
    expect(danishChapterAudio).toHaveLength(9)
    expect(danishChapterAudio.map(({ id }) => id)).toEqual([
      'chapter-01', 'chapter-02', 'chapter-03', 'chapter-04', 'chapter-05',
      'chapter-06', 'chapter-07', 'chapter-08', 'chapter-09',
    ])
    for (const [index, source] of danishChapterAudio.entries()) {
      const chapter = danishGrammarCourse.chapters[index]!
      expect(source.cityId).toBe(chapter.cityId)
      expect(source.linesDa).toEqual(chapter.performanceDa)
      expect(source.textDa).toBe(chapter.performanceDa.join('\n\n'))
      expect(source.linesDa.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every fixed train lesson its own canonical audio contract', () => {
    expect(danishGrammarLessonAudio).toHaveLength(18)
    expect(danishGrammarLessonAudio.map(({ id }) => id)).toContain('lesson-aarhus-practical-recent-past')
    const practical = danishGrammarLessonAudio.find(({ lessonId }) => lessonId === 'aarhus-practical-recent-past')!
    expect(practical.linesDa).toEqual(danishGrammarCourse.lessons.find(({ id }) => id === practical.lessonId)!.examples.map(([da]) => da))
    expect(practical.id).not.toBe('chapter-04')
    expect(practical.linesDa).toEqual([
      'I dag arbejdede jeg fra otte til ti.',
      'I dag har jeg arbejdet hjemme, så nu er jeg træt.',
      'I dag købte jeg brød klokken otte.',
      'I dag har jeg købt brød, så vi har mad.',
      'I går lavede jeg mad.',
      'I dag har jeg læst bogen, så du kan få den nu.',
    ])
    expect(danishGrammarLessonAudio.find(({ lessonId }) => lessonId === 'sonderborg-articles')!.linesDa).toEqual([
      'Det er en ting.', 'Hvor er tingen?', 'Det er en stol.', 'Stolen er her.', 'Der er et hus her.', 'Hvor er huset?',
    ])
  })

  it('maps a playback time to its displayed line, including the final line', () => {
    expect(chapterLineAt([0, 2.5, 5.25], 0)).toBe(0)
    expect(chapterLineAt([0, 2.5, 5.25], 2.49)).toBe(0)
    expect(chapterLineAt([0, 2.5, 5.25], 2.5)).toBe(1)
    expect(chapterLineAt([0, 2.5, 5.25], 99)).toBe(2)
  })

  it('rejects a timing map that loses a line, source revision, or strict order', () => {
    const good = { id: 'chapter-01', sourceHash: 'a'.repeat(64), duration: 9, starts: [0, 3, 6] }
    expect(usableChapterTiming(good, good.id, good.sourceHash, 3)).toBe(true)
    expect(usableChapterTiming({ ...good, starts: [0, 6] }, good.id, good.sourceHash, 3)).toBe(false)
    expect(usableChapterTiming({ ...good, starts: [0, 3, 3] }, good.id, good.sourceHash, 3)).toBe(false)
    expect(usableChapterTiming({ ...good, sourceHash: 'b'.repeat(64) }, good.id, good.sourceHash, 3)).toBe(false)
  })

  it('cancels every pending generation before it can continue', () => {
    const generation = createChapterPlaybackGeneration()
    const first = generation.begin()
    generation.cancel()
    const second = generation.begin()
    expect(generation.isCurrent(first)).toBe(false)
    expect(generation.isCurrent(second)).toBe(true)
  })

  it('speaks the first line immediately when a frozen source no longer matches its chapter', () => {
    const calls: string[] = []
    startChapterPlayback({
      sourceMatches: false,
      line: 0,
      fallback: (line) => calls.push(`voice:${line}`),
      play: (line) => calls.push(`clip:${line}`),
    })
    expect(calls).toEqual(['voice:0'])
  })
})
