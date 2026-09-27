import type { GrammarCourse, GrammarLesson } from './curriculum-grammar'

/**
 * One chapter-level performance is a continuous Danish reading of the model
 * lines an accepted destination chapter already owns. It deliberately does
 * not narrate the English teaching notes: they remain visible support, while
 * Danish is the curriculum's sole spoken language.
 */
export interface ChapterAudioSource {
  /** Stable file name and manifest key, independent of a city name's spelling. */
  readonly id: string
  readonly cityId: string
  readonly cityIndex: number
  readonly linesDa: readonly string[]
  /** The single request sent to the voice provider. Newlines invite a natural pause. */
  readonly textDa: string
}

/**
 * A fixed train sheet owns the lines its compact Listen control reads. Primary
 * lessons retain their established chapter ids; an added lesson receives its
 * own explicit bake id rather than borrowing another city's recording.
 */
export interface GrammarLessonAudioSource extends ChapterAudioSource {
  readonly lessonId: string
}

export function chapterAudioFromCourse(course: GrammarCourse): readonly ChapterAudioSource[] {
  return course.chapters.map((chapter, cityIndex) => {
    const linesDa = chapter.performanceDa.map((line) => line.trim()).filter(Boolean)
    if (linesDa.length === 0) throw new Error(`${chapter.cityId} has no Danish chapter-performance lines`)
    return {
      id: `chapter-${String(cityIndex + 1).padStart(2, '0')}`,
      cityId: chapter.cityId,
      cityIndex,
      linesDa,
      textDa: linesDa.join('\n\n'),
    }
  })
}

export function grammarLessonAudioFromCourse(course: GrammarCourse): readonly GrammarLessonAudioSource[] {
  const primaryLessonIds = new Set(course.chapters.map((chapter) =>
    course.lessons.find((lesson) => lesson.cityId === chapter.cityId)?.id,
  ))

  return course.lessons.map((lesson) => lessonAudioSource(lesson, primaryLessonIds.has(lesson.id)))
}

function lessonAudioSource(lesson: GrammarLesson, isPrimary: boolean): GrammarLessonAudioSource {
  const linesDa = lesson.examples.map(([danish]) => danish.trim()).filter(Boolean)
  if (linesDa.length === 0) throw new Error(`${lesson.id} has no Danish lesson-example lines`)
  return {
    id: isPrimary ? `chapter-${String(lesson.cityIndex + 1).padStart(2, '0')}` : `lesson-${lesson.id}`,
    lessonId: lesson.id,
    cityId: lesson.cityId,
    cityIndex: lesson.cityIndex,
    linesDa,
    textDa: linesDa.join('\n\n'),
  }
}
