import { activeGrammarBooks, grammarBookForActiveCity } from '../../lang/bookshelf'
import type { ReactNode } from 'react'
import { UI, UI_LANGUAGE } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import {
  GERMAN_GUIDE_EXAMPLES_INTRO_SOURCE,
  GERMAN_FLENSBURG_LESSON_IDS,
  germanGuideEnglishOnlyForCity,
  germanGuideLessonIdForPage,
  germanGuideLineForUiLanguage,
  localizeGermanFlensburgGrammarBook,
  type GermanFlensburgLessonId,
} from '../../lang/de/guide-sidecars'
import { BookReader } from './BookReader'

/**
 * The reusable, fixed-page grammar reader. Route/index ownership remains with
 * BK2; IN1 can pass Sønderborg here rather than carrying a second summary.
 */
export function GrammarBook({ cityId, lessonId, onClose, initialPageId, topAccessory, onPastEnd, pastEndLabel }: {
  readonly cityId: string
  readonly lessonId?: string
  readonly onClose: () => void
  readonly initialPageId?: string
  readonly topAccessory?: ReactNode
  /** What the last page's Next does, and says, when the book is one half of a pair (BookReader). */
  readonly onPastEnd?: () => void
  readonly pastEndLabel?: string
}) {
  const lesson = grammarBookForActiveCity(cityId, lessonId)
  if (!lesson) return null
  const city = activeGrammarBooks.find((candidate) => candidate.cityId === cityId)
  const germanGuide = ACTIVE.code === 'de'
  const flensburg = germanGuide && city?.cityIndex === 0
  const sidecarBook = flensburg ? localizeGermanFlensburgGrammarBook(lesson.book, UI_LANGUAGE) : lesson.book
  const firstLesson = city?.lessons[0]
  const book = germanGuide && city
    ? {
        ...sidecarBook,
        title: UI.guide.grammarBookTitle(city.cityName),
        cover: {
          ...sidecarBook.cover,
          title: flensburg && firstLesson
            ? germanGuideLineForUiLanguage(
                UI_LANGUAGE,
                'grammar',
                firstLesson.id as GermanFlensburgLessonId,
                sidecarBook.cover.title,
              )
            : sidecarBook.cover.title,
          description: lessonId || GERMAN_FLENSBURG_LESSON_IDS.includes(lesson.id as GermanFlensburgLessonId)
            ? UI.guide.grammarLessonBookDescription
            : UI.guide.grammarBookDescription(city.lessons.length),
        },
        pages: sidecarBook.pages.map((page) => {
          const lessonPageId = germanGuideLessonIdForPage(page.id)
          return {
            ...page,
            context: page.id.endsWith('-examples') ? UI.guide.grammarExamplesContext : page.context,
            blocks: page.blocks.map((block) => {
              if (block.kind === 'paragraph' && block.text === GERMAN_GUIDE_EXAMPLES_INTRO_SOURCE) {
                return { ...block, text: UI.guide.grammarExamplesIntro }
              }
              if (block.kind !== 'table') return block
              return {
                ...block,
                headers: block.headers.map((header) =>
                  header === 'English' && flensburg ? UI.guide.translationToggle : header,
                ),
                rows: lessonPageId
                  ? block.rows.map((row) => row.map((cell) =>
                      cell === 'English' ? UI.guide.translationToggle : cell,
                    ))
                  : block.rows,
              }
            }),
          }
        }),
      }
    : lesson.book
  const readerNotice = germanGuide && city && germanGuideEnglishOnlyForCity(city.cityIndex, UI_LANGUAGE)
    ? UI.guide.englishOnlyNotice
    : undefined
  return <BookReader
    book={book}
    onClose={onClose}
    initialPageId={initialPageId}
    skipCover
    className="travel-guide-book guide-grammar guide-grammar-reader"
    readerBackLabel={UI.guide.backToGrammarIndexAria}
    topAccessory={topAccessory}
    integratedTop
    onPastEnd={onPastEnd}
    pastEndLabel={pastEndLabel}
    readerNotice={readerNotice}
  />
}
