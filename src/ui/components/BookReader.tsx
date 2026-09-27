import { useEffect, useId, useState, type ReactNode } from 'react'
import { UI } from '../../i18n'

/**
 * The deliberately small contract shared by the Guide and grammar books.
 * Pages, rather than a stream of prose, are the unit of navigation: authors
 * should add a page when a concept changes. A single paper page may scroll as
 * a compact-phone fallback, while navigation and the surrounding shell stay fixed.
 */
export type BookBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string; readonly level?: 2 | 3 }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'table'; readonly headers: readonly string[]; readonly rows: readonly (readonly string[])[] }

export type BookPage = {
  readonly id: string
  readonly title: string
  readonly context?: string
  readonly language?: string
  readonly blocks: readonly BookBlock[]
}

export type Book = {
  readonly id: string
  readonly title: string
  readonly cover: { readonly eyebrow: string; readonly title: string; readonly description?: string; readonly mark?: string }
  readonly pages: readonly BookPage[]
}

export type BookPosition = { readonly bookId: string; readonly pageId: string }

export function pageAt(book: Book, pageId: string | null | undefined): number {
  const index = book.pages.findIndex((page) => page.id === pageId)
  return index >= 0 ? index : 0
}

export function turnPage(book: Book, pageId: string, direction: -1 | 1): BookPosition {
  const index = Math.max(0, Math.min(book.pages.length - 1, pageAt(book, pageId) + direction))
  return { bookId: book.id, pageId: book.pages[index]?.id ?? '' }
}

/** The page body as the Guide draws it. Exported for a `renderBlock` that
 *  wants to add to a page rather than replace it — the train ride puts the
 *  chapter recording under an examples table this way. */
export function Blocks({ blocks }: { blocks: readonly BookBlock[] }) {
  return <>{blocks.map((block, index) => {
    const key = `${block.kind}-${index}`
    if (block.kind === 'paragraph') return <p key={key}>{block.text}</p>
    if (block.kind === 'quote') return <blockquote key={key}>{block.text}</blockquote>
    if (block.kind === 'list') return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
    if (block.kind === 'heading') {
      const Heading = block.level === 3 ? 'h3' : 'h2'
      return <Heading key={key}>{block.text}</Heading>
    }
    return <table className="book-table" key={key}><thead><tr>{block.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
  })}</>
}

/** A fixed-screen cover and reader with page-local overflow as a last resort. */
export function BookReader({ book, onClose, renderBlock, initialPageId, skipCover = false, className = '', readerBackLabel, topAccessory, integratedTop = false, onPastEnd, pastEndLabel, readerNotice }: {
  readonly book: Book
  readonly onClose: () => void
  readonly renderBlock?: (page: BookPage) => ReactNode
  /** Lets a consumer restore a known page after its own route reload. */
  readonly initialPageId?: string
  /** Embeds the pages in the Travel Guide without inserting another cover. */
  readonly skipCover?: boolean
  readonly className?: string
  readonly readerBackLabel?: string
  readonly topAccessory?: ReactNode
  /** Places the back button beside the Guide's thumb indexes, with page data on the paper. */
  readonly integratedTop?: boolean
  /**
   * What Next does on the last page. Without it the last page's Next is
   * disabled, which is right for the Guide — a chapter ends. The train ride
   * passes it so a chapter's last page turns into the city's Survival
   * exchanges, and the last of those into the arrival.
   */
  readonly onPastEnd?: () => void
  /** The last page's Next label when `onPastEnd` is set (e.g. "Continue"). */
  readonly pastEndLabel?: string
  /** A visible status for content whose language is not the active UI language. */
  readonly readerNotice?: string
}) {
  const [pageId, setPageId] = useState<string | null>(() => {
    if (initialPageId && book.pages.some((page) => page.id === initialPageId)) return initialPageId
    return skipCover ? book.pages[0]?.id ?? null : null
  })
  const announcementId = useId()
  const index = pageAt(book, pageId)
  const page = pageId === null ? null : book.pages[index]

  // A new book (or a removed page in edited content) always opens safely at its cover.
  useEffect(() => { if (pageId !== null && !book.pages.some((item) => item.id === pageId)) setPageId(null) }, [book, pageId])

  const open = () => setPageId(book.pages[0]?.id ?? null)
  const turn = (direction: -1 | 1) => page && setPageId(turnPage(book, page.id, direction).pageId)
  const last = index === book.pages.length - 1
  const next = () => (last && onPastEnd ? onPastEnd() : turn(1))
  const nextLabel = (arrow: boolean) => (last && onPastEnd && pastEndLabel ? pastEndLabel : arrow ? UI.guide.nextLabel : UI.guide.next)

  if (!page) return <section className={`book-reader book-cover${className ? ` ${className}` : ''}`} aria-labelledby={`${announcementId}-title`}>
    <header className="book-reader-top"><button className="book-back" onClick={onClose} aria-label={UI.guide.backFromAria(book.title)}>←</button><p>{book.title}</p></header>
    {topAccessory}
    <div className="book-cover-paper"><span className="book-cover-mark" aria-hidden="true">{book.cover.mark ?? '✦'}</span><p className="book-eyebrow">{book.cover.eyebrow}</p><h1 id={`${announcementId}-title`}>{book.cover.title}</h1>{book.cover.description && <p>{book.cover.description}</p>}</div>
    <div className="book-cover-actions"><button className="btn btn-primary" onClick={open} disabled={book.pages.length === 0}>{UI.guide.openBook}</button></div>
  </section>

  return <section className={`book-reader${className ? ` ${className}` : ''}`} aria-labelledby={`${announcementId}-title`}>
    {integratedTop
      ? <div className="guide-cover-tabs-row"><button className="book-back icon-btn" onClick={skipCover ? onClose : () => setPageId(null)} aria-label={readerBackLabel ?? (skipCover ? UI.guide.backFromAria(book.title) : UI.guide.backToCoverOfAria(book.title))}>←</button>{topAccessory}</div>
      : <><header className="book-reader-top"><button className="book-back" onClick={skipCover ? onClose : () => setPageId(null)} aria-label={readerBackLabel ?? (skipCover ? UI.guide.backFromAria(book.title) : UI.guide.backToCoverOfAria(book.title))}>←</button><p>{book.title}</p><span>{index + 1} / {book.pages.length}</span></header>{topAccessory}</>}
    <article className="book-page" lang={page.language} aria-describedby={announcementId}>
      {integratedTop
        ? <div className="guide-page-meta"><p className="book-page-context">{book.title}</p><span className="guide-page-count guide-page-count-inline">{index + 1} / {book.pages.length}</span></div>
        : <p className="book-page-context">{page.context ?? UI.guide.pageOf(index + 1, book.pages.length)}</p>}
      {readerNotice && <p className="book-reader-notice" role="note">{readerNotice}</p>}
      <h1 id={`${announcementId}-title`}>{page.title}</h1>
      <div className="book-page-body">{renderBlock?.(page) ?? <Blocks blocks={page.blocks} />}</div>
      {integratedTop && <nav className="book-turns guide-inline-book-turns" aria-label={UI.guide.bookNavAria}><button className="btn btn-ghost" aria-label={UI.guide.previous} onClick={() => turn(-1)} disabled={index === 0}>{UI.guide.previousLabel}</button><button className="btn btn-primary" aria-label={UI.guide.next} onClick={next} disabled={last && !onPastEnd}>{nextLabel(true)}</button></nav>}
    </article>
    <p id={announcementId} className="visually-hidden" aria-live="polite" aria-atomic="true">{UI.guide.pageAnnouncement(page.title, index + 1, book.pages.length)}</p>
    {!integratedTop && <nav className="book-turns" aria-label={UI.guide.bookNavAria}><button className="btn btn-ghost" onClick={() => turn(-1)} disabled={index === 0}>{UI.guide.previous}</button><button className="btn btn-primary" onClick={next} disabled={last && !onPastEnd}>{nextLabel(false)}</button></nav>}
  </section>
}
