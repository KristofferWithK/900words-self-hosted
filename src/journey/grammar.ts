import { ACTIVE } from '../lang/active'
import type { GrammarChapter, GrammarLesson } from '../lang/curriculum-grammar'

/**
 * The journey only knows a city index. The language pack owns the chapter
 * content and its destination mapping, so another route never inherits Danish
 * headings or a departure-shaped final lesson.
 */
export const grammarChapters = (): readonly GrammarChapter[] => ACTIVE.grammarCourse.chapters
export const grammarLessons = (): readonly GrammarLesson[] => ACTIVE.grammarCourse.lessons

/** All named, fixed-page lessons prepared by a destination city. */
export function grammarLessonsForDestination(cityIndex: number): readonly GrammarLesson[] {
  return grammarLessons().filter((lesson) => lesson.cityIndex === cityIndex)
}

export function grammarLessonById(lessonId: string): GrammarLesson | undefined {
  return grammarLessons().find((lesson) => lesson.id === lessonId)
}

/** The lesson that prepares this destination city. */
export function grammarForDestination(cityIndex: number): GrammarChapter | undefined {
  return grammarChapters()[cityIndex]
}

/**
 * A chapter becomes readable as soon as its destination is reached. Chapter
 * one therefore exists at city zero before the first ordinary board, and a
 * skipped ride cannot lose its chapter. There is no post-København exception.
 */
export function unlockedGrammarCount(cityIndex: number): number {
  return Math.min(grammarChapters().length, Math.max(0, cityIndex + 1))
}
