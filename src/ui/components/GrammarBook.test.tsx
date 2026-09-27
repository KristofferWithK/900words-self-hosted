import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { GrammarBook } from './GrammarBook'

describe('GrammarBook', () => {
  it('renders Sønderborg through the shared paper-page book shell', () => {
    const html = renderToStaticMarkup(<GrammarBook cityId="sonderborg" onClose={() => {}} initialPageId="articles" />)
    expect(html).toContain('class="book-reader travel-guide-book guide-grammar guide-grammar-reader"')
    expect(html).toContain('En, et, and “the”')
    expect(html).toContain('Sønderborg grammar')
    expect(html).toContain('en stol')
    expect(html).not.toContain('screen-scroll')
    expect(html).not.toContain(UI.guide.openBook)
  })
})
