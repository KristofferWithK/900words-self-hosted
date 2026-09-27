import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { BookReader, pageAt, turnPage, type Book } from './BookReader'

const book: Book = { id: 'guide', title: 'Travel Guide', cover: { eyebrow: 'Casey’s field notes', title: 'Danish journey' }, pages: [
  { id: 'contents', title: 'Contents', blocks: [{ kind: 'paragraph', text: 'Start here.' }] },
  { id: 'chapter-1', title: 'Sønderborg', language: 'da', blocks: [{ kind: 'list', items: ['Hej'] }] },
] }

describe('BookReader page contract', () => {
  it('uses stable page identity and clamps impossible turns', () => {
    expect(pageAt(book, 'chapter-1')).toBe(1)
    expect(pageAt(book, 'removed-page')).toBe(0)
    expect(turnPage(book, 'contents', -1)).toEqual({ bookId: 'guide', pageId: 'contents' })
    expect(turnPage(book, 'chapter-1', 1)).toEqual({ bookId: 'guide', pageId: 'chapter-1' })
  })

  it('renders a labelled cover with a 44px-target reader entry point', () => {
    const html = renderToStaticMarkup(<BookReader book={book} onClose={() => {}} />)
    expect(html).toContain('class="book-reader book-cover"')
    expect(html).toContain(UI.guide.openBook)
    expect(html).toContain(UI.guide.backFromAria(book.title))
  })

  it('restores a stable page id with announced context and impossible turns disabled', () => {
    const html = renderToStaticMarkup(<BookReader book={book} initialPageId="chapter-1" onClose={() => {}} />)
    expect(html).toContain(UI.guide.pageAnnouncement('Sønderborg', 2, 2))
    expect(html).toContain(UI.guide.backToCoverOfAria(book.title))
    expect(html).toContain(`${UI.guide.previous}</button>`)
    expect(html).toContain('disabled=""')
  })

  it('keeps tables in the fixed page instead of creating a scrolling wrapper', () => {
    const tableBook: Book = { ...book, pages: [{ id: 'table', title: 'Words', blocks: [{ kind: 'table', headers: ['Danish'], rows: [['megetlangtord']] }] }] }
    const html = renderToStaticMarkup(<BookReader book={tableBook} initialPageId="table" onClose={() => {}} />)
    expect(html).toContain('class="book-table"')
    expect(html).not.toContain('book-table-wrap')
  })
})
