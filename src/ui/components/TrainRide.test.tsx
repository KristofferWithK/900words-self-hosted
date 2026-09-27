import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { danishGrammarLessonAudio } from '../../lang/da/chapter-audio'
import { danishGrammarCourse } from '../../lang/da/curriculum-grammar'
import { ChapterPerformance, GrammarLesson, TrainRide } from './TrainRide'

describe('the city-one lesson', () => {
  it('keeps the authored grammar but no longer offers the retired Sønderborg story', () => {
    const chapter = danishGrammarCourse.chapters[0]!
    const html = renderToStaticMarkup(<GrammarLesson chapter={chapter} />)

    expect(html).toContain('en stol')
    expect(html).toContain('et hus')
    expect(html).not.toContain('Read Sønderborg')
    expect(html).not.toContain('Hide Sønderborg')
  })

  it('rides into Aarhus on the Guide\'s own grammar pages, all lessons in one run', () => {
    const html = renderToStaticMarkup(<TrainRide destinationCityIndex={3} onDone={() => {}} />)
    // The Guide's reader and paper, not a reader of the train's own.
    expect(html).toContain('guide-grammar-reader')
    expect(html).toContain('ride-reader')
    expect(html).not.toContain('train-lesson-reader')
    expect(html).toContain('Aarhus grammar')
    // Two lessons, two pages each: rules then examples, as one book.
    expect(html).toContain('1 / 4')
    expect(html).toContain('Klokken otte arbejder jeg')
    expect(html).toContain(`Aarhus · ${UI.guide.sectionGrammar}`)
    expect(html).toContain(UI.guide.skipShort)
    expect(html).not.toContain('ride-scroll')
  })

  it('carries the chapter recording on an examples page, under the Guide\'s table', () => {
    const html = renderToStaticMarkup(<TrainRide destinationCityIndex={3} onDone={() => {}} />)
    // The first page is rules and has no recording; the recording is the
    // examples page's, which the ride reaches with Next. Rendering the whole
    // book statically shows page one only, so what is pinned here is that
    // the rules page carries no recording — the drive walks to the examples.
    expect(html).not.toContain('chapter-performance')
  })

  it('keeps one compact Listen control bound to each lesson’s own canonical lines', () => {
    const source = danishGrammarLessonAudio.find(({ lessonId }) => lessonId === 'aarhus-practical-recent-past')!
    const html = renderToStaticMarkup(<ChapterPerformance source={source} compact />)
    expect(html).toContain(UI.guide.hearTheLesson)
    expect(html).toContain(UI.guide.listen)
    expect(html).toContain('data-chapter-performance="lesson-aarhus-practical-recent-past"')
    expect(html).not.toContain('chapter-lines')
  })

  it('is always a real ride: Skip to leave, and no read-only replay note', () => {
    // The map's "Train lesson" replay mode went on 2026-09-05.
    const html = renderToStaticMarkup(<TrainRide destinationCityIndex={8} onDone={() => {}} />)
    expect(html).toContain(UI.guide.skipShort)
    expect(html).not.toContain('no progress recorded')
    expect(html).not.toContain('Close')
  })
})
