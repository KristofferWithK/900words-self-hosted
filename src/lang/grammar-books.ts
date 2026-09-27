import type { GrammarCourse, GrammarLesson } from './curriculum-grammar'
import { learningCopy } from '../i18n/learning'

/**
 * The reader-facing projection of a reviewed grammar course.
 *
 * These are intentionally small, page-sized cards rather than another copy of
 * the long course document. The accepted rewrite brief remains the source of
 * truth; this projection keeps its claims, boundaries and model sentences in a
 * form that fits the fixed BookReader paper area.
 *
 * The projection itself is language-neutral, which is the point: a second
 * language supplies a course, its city names and its cover marks, and gets the
 * same two-page lesson cards without a second copy of this logic. What it
 * cannot yet supply is the Travel Guide's import — `TravelGuideBook.tsx`,
 * `GrammarBook.tsx`, `TrainRide.tsx` and `RoundSummary.tsx` all import the
 * Danish books directly rather than reading `ACTIVE`. That seam hole is named
 * in `docs/curriculum/german-grammar-course.md`.
 */
export type GrammarBookBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string; readonly level?: 2 | 3 }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }

export interface GrammarBookPage {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly language?: string
  readonly blocks: readonly GrammarBookBlock[]
}

export interface GrammarBook {
  readonly id: string
  readonly title: string
  readonly cover: { readonly eyebrow: string; readonly title: string; readonly description: string; readonly mark: string }
  readonly pages: readonly GrammarBookPage[]
}

export interface GrammarBookLesson {
  readonly id: string
  readonly titleEn: string
  readonly book: GrammarBook
}

export interface GrammarBookCity {
  readonly cityId: string
  readonly cityIndex: number
  readonly cityName: string
  readonly topicEn: string
  readonly lessons: readonly GrammarBookLesson[]
}

export interface GrammarBookOptions {
  readonly course: GrammarCourse
  /** The route's nine city names, in route order. */
  readonly cityNames: readonly string[]
  /** Book-id prefix and the column head over the target-language examples. */
  readonly languageCode: string
  readonly targetLabel: string
  /** Cover marks: one for a single lesson, one for a city's collected lessons. */
  readonly lessonMark: string
  readonly cityMark: string
  /** Danish keeps two legacy page ids; other languages need no override. */
  readonly pageId?: (lesson: GrammarLesson, page: 'rules' | 'examples') => string | undefined
}

export interface GrammarBookshelf {
  readonly cities: readonly GrammarBookCity[]
  readonly forCity: (cityId: string, lessonId?: string) => GrammarBookLesson | undefined
  readonly forCityIndex: (cityIndex: number) => readonly GrammarBookLesson[]
}

export function buildGrammarBookshelf(options: GrammarBookOptions): GrammarBookshelf {
  const { course, cityNames, languageCode, targetLabel, lessonMark, cityMark } = options
  const pageId = (lesson: GrammarLesson, page: 'rules' | 'examples'): string =>
    options.pageId?.(lesson, page) ?? `${lesson.id}-${page}`

  const bookFor = (lesson: GrammarLesson): GrammarBook => {
    const cityName = cityNames[lesson.cityIndex]!
    return {
      id: `${languageCode}-grammar-${lesson.id}`,
      title: `${cityName} grammar`,
      cover: { eyebrow: `Chapter ${lesson.cityIndex + 1} · ${cityName}`, title: learningCopy(lesson.id, 'titleEn', lesson.titleEn), description: 'One rules page, then examples in context.', mark: lessonMark },
      pages: [
        { id: pageId(lesson, 'rules'), title: learningCopy(lesson.id, 'titleEn', lesson.titleEn), context: lesson.rulesContext, blocks: lesson.rules },
        {
          id: pageId(lesson, 'examples'), title: learningCopy(lesson.id, 'examplesTitleEn', lesson.examplesTitleEn), context: 'In context',
          blocks: [
            { kind: 'paragraph', text: 'Read these as whole, useful sentences. English is here for support.' },
            { kind: 'table', headers: [targetLabel, 'English'], rows: lesson.examples },
          ],
        },
      ],
    }
  }

  const cities: readonly GrammarBookCity[] = cityNames.map((cityName, cityIndex) => {
    const lessons = course.lessons
      .filter((lesson) => lesson.cityIndex === cityIndex)
      .map((lesson) => ({ id: lesson.id, titleEn: lesson.titleEn, book: bookFor(lesson) }))
    const primary = lessons[0]
    if (!primary) throw new Error(`No grammar lesson for ${cityName}`)
    return {
      cityId: course.chapters[cityIndex]!.cityId,
      cityIndex,
      cityName,
      topicEn: learningCopy(primary.id, 'titleEn', primary.titleEn),
      lessons,
    }
  })

  const forCity = (cityId: string, lessonId?: string): GrammarBookLesson | undefined => {
    const city = cities.find((chapter) => chapter.cityId === cityId)
    if (!city) return undefined
    if (lessonId) return city.lessons.find((lesson) => lesson.id === lessonId)
    return {
      id: `${city.cityId}-chapter`,
      titleEn: city.topicEn,
      book: {
        id: `${languageCode}-grammar-${city.cityId}`,
        title: `${city.cityName} grammar`,
        cover: {
          eyebrow: `Chapter ${city.cityIndex + 1} · ${city.cityName}`,
          title: city.topicEn,
          description: `${city.lessons.length} compact lesson${city.lessons.length === 1 ? '' : 's'}, kept together in the Travel Guide.`,
          mark: cityMark,
        },
        pages: city.lessons.flatMap((lesson) => lesson.book.pages),
      },
    }
  }

  return {
    cities,
    forCity,
    forCityIndex: (cityIndex: number) => cities[cityIndex]?.lessons ?? [],
  }
}
