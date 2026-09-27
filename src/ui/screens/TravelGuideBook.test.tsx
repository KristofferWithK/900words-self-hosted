import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { danishGrammarBooks } from '../../lang/da/grammar-books'
import { danishSurvivalGuide } from '../../lang/da/survival'
import { UI, UI_LANGUAGE } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { GERMAN_FLENSBURG_GUIDE_SIDECARS } from '../../lang/de/guide-sidecars'
import { GrammarBook } from '../components/GrammarBook'
import { GuideIndex, guideRouteForEntry, SurvivalExchangeReader, TravelGuideBook } from './TravelGuideBook'

describe('Travel Guide book projection', () => {
  it('shows all nine Grammar cities on one contents page', () => {
    const html = renderToStaticMarkup(<GuideIndex section="grammar" entries={danishGrammarBooks} currentCityIndex={0} onBack={() => {}} onOpenCity={() => {}} />)
    expect(html.match(/guide-city-row/g)).toHaveLength(9)
    expect(html.match(/is-current-city/g)).toHaveLength(1)
    expect(html).not.toContain('All 9 cities')
    expect(html).toContain('guide-thumb-grammar guide-section-grammar is-active')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Sønderborg')
    expect(html).toContain('København')
    expect(html).not.toContain(`>${UI.guide.next}<`)
  })

  it('shows all nine Survival cities on the same kind of contents page', () => {
    const html = renderToStaticMarkup(<GuideIndex section="survival" entries={danishSurvivalGuide.cities} currentCityIndex={4} onBack={() => {}} onOpenCity={() => {}} />)
    expect(html.match(/guide-city-row/g)).toHaveLength(9)
    expect(html.match(/is-current-city/g)).toHaveLength(1)
    expect(html).toContain('Kolding')
    expect(html).not.toContain('All 9 cities')
    expect(html).toContain('guide-thumb-survival guide-section-survival is-active')
    expect(html).toContain(UI.guide.exchangeCount(4))
  })

  it('routes a city choice straight into content instead of a city gateway', () => {
    expect(guideRouteForEntry({ kind: 'grammar', cityIndex: 3 })).toEqual({ kind: 'grammar-book', cityIndex: 3 })
    expect(guideRouteForEntry({ kind: 'curriculum-offer', cityIndex: 0, itemId: 'sonderborg-notice' }))
      .toEqual({ kind: 'curriculum-offer', cityIndex: 0, itemId: 'sonderborg-notice' })
    expect(guideRouteForEntry({ kind: 'survival', cityIndex: 4, exchangeIndex: 2 })).toEqual({ kind: 'exchange', cityIndex: 4, exchangeIndex: 2 })
    // The wrap-up's Both: the book carries the exchange its last page turns
    // into — and only an exchange the city has; a stray index reads as plain
    // Grammar rather than a Next that leads nowhere.
    expect(guideRouteForEntry({ kind: 'grammar', cityIndex: 3, thenExchange: 1 })).toEqual({ kind: 'grammar-book', cityIndex: 3, thenExchange: 1 })
    expect(guideRouteForEntry({ kind: 'grammar', cityIndex: 3, thenExchange: 9 })).toEqual({ kind: 'grammar-book', cityIndex: 3 })
    const chained = renderToStaticMarkup(<TravelGuideBook initialEntry={{ kind: 'grammar', cityIndex: 3, thenExchange: 1 }} onExit={() => {}} />)
    expect(chained).toContain('guide-grammar-reader')
    // The pairing shows only on the last page; the first page turns as a page.
    expect(chained).toContain('Next →')
    expect(chained).not.toContain('Next: Survival')

    const grammar = renderToStaticMarkup(<GrammarBook cityId="aarhus" onClose={() => {}} />)
    expect(grammar).toContain('Time first, verb second')
    expect(grammar).toContain('1 / 4')
    expect(grammar).toMatch(/book-page[\s\S]*guide-inline-book-turns[\s\S]*<\/article>/)
    expect(grammar).not.toContain(UI.guide.openBook)
    expect(grammar).not.toContain('guide-city-overview')
  })

  it('opens a map Look ahead request inside the current city Guide chapter', () => {
    const html = renderToStaticMarkup(
      <TravelGuideBook initialEntry={{ kind: 'grammar', cityIndex: 8 }} onExit={() => {}} />,
    )
    expect(html).toContain('København grammar')
    expect(html).toContain('guide-grammar-reader')
    expect(html).toContain('guide-thumb-grammar guide-section-grammar is-active')
    expect(html).not.toContain('train-lesson-reader')
  })

  it('projects German Flensburg titles and support in the selected UI language', () => {
    if (ACTIVE.code !== 'de') return

    const grammar = renderToStaticMarkup(
      <TravelGuideBook initialEntry={{ kind: 'grammar', cityIndex: 0 }} onExit={() => {}} />,
    )
    const survival = renderToStaticMarkup(
      <TravelGuideBook initialEntry={{ kind: 'survival', cityIndex: 0, exchangeIndex: 0 }} onExit={() => {}} />,
    )
    const sidecar = GERMAN_FLENSBURG_GUIDE_SIDECARS[UI_LANGUAGE]

    expect(grammar).toContain(sidecar.grammar['flensburg-articles']['Der, die, das, and “a”'])
    expect(survival).toContain(sidecar.survival['flensburg-situation-1']['Hello! Welcome to Flensburg.'])
  })

  it('keeps every city lesson in the combined Grammar readers', () => {
    const pageCount = danishGrammarBooks.reduce((count, city) => count + city.lessons.reduce((pages, lesson) => pages + lesson.book.pages.length, 0), 0)
    expect(danishGrammarBooks).toHaveLength(9)
    expect(danishGrammarBooks.flatMap((city) => city.lessons)).toHaveLength(18)
    expect(pageCount).toBe(36)
  })

  it('makes every Survival resource a freely rereadable reference at its recommended city level', () => {
    const city = danishSurvivalGuide.cities[0]!
    const exchange = city.exchanges[0]!
    const html = renderToStaticMarkup(<SurvivalExchangeReader city={city} exchange={exchange} onClose={() => {}} />)
    expect(html).toContain(UI.guide.recommendedCity('Sønderborg'))
    expect(html).not.toContain('Mark read')
    expect(html).not.toContain('Read again')
    expect(html).toContain('1 / 4')
    expect(html).toMatch(/survival-exchange-page[\s\S]*guide-inline-book-turns[\s\S]*<\/article>/)
    expect(html.match(/survival-listen/g)).toHaveLength(4)
    expect(html.match(/survival-english/g)).toHaveLength(4)
    expect(html).not.toContain('Tap for English')
  })

  it('opens on Casey’s pocket-guide cover with only Grammar and Survival', () => {
    const html = renderToStaticMarkup(<TravelGuideBook />)
    expect(html).toContain(UI.guide.pocketGuideEyebrow)
    expect(html).toContain(UI.guide.pocketGuideTitle.da)
    expect(html).toContain(UI.guide.sectionGrammar)
    expect(html).toContain(UI.guide.sectionSurvival)
    expect(html).not.toContain('Practice')
    expect(html).toContain('travel-guide-book')
    expect(html.match(/class="guide-thumb-index /g)).toHaveLength(2)
    expect(html).not.toContain('guide-section-card')
    expect(html).toMatch(/guide-cover-tabs-row[\s\S]*guide-thumb-indexes[\s\S]*guide-cover-hero/)
    expect(html).not.toContain('<p>Travel Guide</p>')
    expect(html).toContain('guide-cover-route')
    expect(html).toContain(`aria-label="${UI.guide.openGrammarContentsAria}"`)
  })
})
