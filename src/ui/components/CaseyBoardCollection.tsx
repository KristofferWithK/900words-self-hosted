import { useLayoutEffect, useRef, useState } from 'react'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { boardKey } from '../../progression/identity'
import { emptyProgressFacts } from '../../progression/facts'
import { cafesForCity } from '../../journey/cafeAccess'
import { cityAt } from '../../journey/cities'
import type { CourseSessions, ProgressFacts, RequiredBoardSet } from '../../progression/types'
import { ACTIVE } from '../../lang/active'
import { RECEIPT_UI } from '../../i18n/receipt'
import { UI } from '../../i18n'
import { COLLECTION_UI } from '../../i18n/collection'
import { createSettlementStore } from '../../stores/settlementStore'
import { useJourney } from '../../stores/journeyStore'
import { CafeStamp } from './CafeStamp'
import { Tag } from './Tag'
import { cellAria, cellName, stampCardSummary, stampCells, type StampCell } from './stampCard'

/**
 * THE CITY'S STAMP CARD (card CW-11; docs/roadmap/cafe-world.md section 6).
 * The board collection became it: one cell per café, with the café's name
 * and its stamp in tier ink (CW-09's `CafeStamp`), a dashed circle for a café
 * found but not played, and "?" for one not found. A café only ever lost
 * shows Bronze: a completed loss earns a Bronze stamp (owner, 4 October 2026).
 *
 * The class names the tour and the drives anchor on are kept:
 * `.casey-board-collection`, `.collection-summary`, `.collection-board-grid`,
 * `.collection-primary`, `.collection-board-slot`, `.collection-board-card`,
 * `.collection-pager` and `.collection-detail`.
 */

const PAGE_SIZE = 10

/** The route city whose cafés this card shows: only Sønderborg has a café set (cafeAccess.ts). */
const CARD_CITY = 0

/** Read through the durable schema parser; a corrupt ledger never earns a UI medal. */
export function readCollectionFacts(): ProgressFacts {
  if (typeof localStorage === 'undefined') return emptyProgressFacts()
  try { return createSettlementStore({ storage: localStorage }).readLedger().facts } catch { return emptyProgressFacts() }
}

/** The stamp card's cells for `facts`, with the café states the walks wrote. */
export function stampCardCells(facts: ProgressFacts, required: RequiredBoardSet = CITY1_REQUIRED_SET): StampCell[] {
  return stampCells(required, facts, cafesForCity(CARD_CITY, facts)?.cafes ?? null)
}

const cellCopy = {
  cafeNumber: UI.home.stampCafeNumber,
  cellStamped: UI.home.stampCellStamped,
  cellFound: UI.home.stampCellFound,
  cellNotFound: UI.home.stampCellNotFound,
}

/** A cell's accessible name in the active language. */
export const stampCellAria = (cell: StampCell): string => cellAria(cell, cellCopy, RECEIPT_UI.stamp)

/** The small word under a cell's stamp. */
function cellLabel(cell: StampCell): string {
  switch (cell.state) {
    case 'stamped': return RECEIPT_UI.stampRing[cell.tier!]
    case 'found': return UI.home.stampFound
    case 'unfound': return UI.home.stampNotFound
  }
}

/** The drawn mark in a cell: the stamp in its tier's ink, or CW-09's dashed circle for a café still to play. */
function CellMark({ cell, className, ring = false }: { readonly cell: StampCell; readonly className: string; readonly ring?: boolean }) {
  return <CafeStamp tier={cell.tier} ring={ring && cell.tier ? RECEIPT_UI.stampRing[cell.tier] : undefined} className={className} />
}

/** A cell's face. The cell's accessible name says all of it, so the face is hidden from assistive technology. */
function CellFace({ cell }: { readonly cell: StampCell }) {
  return <>
    <span className="stamp-cell-name" lang={ACTIVE.code} aria-hidden="true">{cell.state === 'unfound' ? '?' : cellName(cell, cellCopy)}</span>
    <CellMark cell={cell} className="stamp-cell-mark" />
    <small aria-hidden="true">{cellLabel(cell)}</small>
  </>
}

export function CaseyBoardCollection({ facts = readCollectionFacts(), sessions, onReplay }: {
  readonly facts?: ProgressFacts
  readonly sessions: CourseSessions | null
  /** Returns false when the store's replay guard refuses the request. */
  readonly onReplay: (stableId: string) => boolean
}) {
  // Café finds live in the journey store: subscribing re-reads the card when a walk finds one.
  useJourney((s) => s.cafes)
  const cells = stampCardCells(facts)
  const summary = stampCardSummary(facts, CITY1_REQUIRED_SET)
  const title = UI.home.stampCardTitle(cityAt(CARD_CITY).name)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<StampCell | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const detail = useRef<HTMLDialogElement | null>(null)
  const pages = Math.ceil(cells.length / PAGE_SIZE)
  const shown = cells.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const goal = summary.next ? UI.home.stampCardGoal(RECEIPT_UI.stampRing[summary.next.tier], RECEIPT_UI.cityPercent(summary.next.percent)) : ''
  // Use the same validated selector as a launch. A retained queue can still
  // contain a board that a later valid import completed, and its first raw
  // key is not necessarily the next board the runtime will actually open.
  const projection = sessions ?? initialCourseSessions(facts)
  let next: StampCell | null = null
  try {
    const nextBoard = nextRequiredBoard(projection, facts)
    next = nextBoard ? cells.find((cell) => boardKey(cell.board) === boardKey(nextBoard)) ?? null : null
  } catch {
    // A corrupt persisted session must not invent a board target on this
    // read-only surface. The game store owns recovery of such a session.
  }
  const nextLine = !next ? UI.home.stampAllPlayed
    : next.state === 'unfound' ? UI.home.stampNextCafeUnfound
      : UI.home.stampNextCafe(cellName(next, cellCopy))
  const replaySuspendsPrimary = !!sessions?.primary && !!sessions.replay
  const closeDetail = () => {
    setSelected(null)
    requestAnimationFrame(() => opener.current?.focus())
  }

  useLayoutEffect(() => {
    if (!selected) return
    const panel = detail.current!
    panel.showModal()
    panel.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (panel.open) panel.close() }
  }, [selected])

  return <section className="casey-board-collection stamp-card" aria-label={title}>
    <div className="collection-summary">
      <div className="collection-summary-copy">
        <h2>{title}</h2>
        <p className="stamp-card-line">{UI.home.stampCardLine(RECEIPT_UI.cityPercent(summary.percent), goal, summary.stamped, summary.cafes)}</p>
        <p className="collection-primary" aria-live="polite">{nextLine}</p>
        {replaySuspendsPrimary && <p className="collection-suspended" role="status">{COLLECTION_UI.primaryWaiting}</p>}
      </div>
      <nav className="collection-pager" aria-label={COLLECTION_UI.pagerAria}>
        <button className="icon-btn" aria-label={UI.home.pagerPreviousAria(title)} disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
        <span aria-live="polite">{page + 1}/{pages}</span>
        <button className="icon-btn" aria-label={UI.home.pagerNextAria(title)} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
      </nav>
    </div>
    <ol className="collection-board-grid" start={page * PAGE_SIZE + 1}>
      {shown.map((cell) => <li key={cell.stableId} className={`collection-board-slot stamp-cell-${cell.state}${cell.tier ? ` tier-${cell.tier}` : ''}`}>
        {cell.replayable
          ? <button className="collection-board-card" onClick={(event) => { opener.current = event.currentTarget; setSelected(cell) }} aria-label={stampCellAria(cell)}>
              <CellFace cell={cell} />
            </button>
          : <span className="collection-board-card collection-board-unplayed" role="img" aria-label={stampCellAria(cell)}>
              <CellFace cell={cell} />
            </span>}
      </li>)}
    </ol>
    {selected && <dialog ref={detail} className="collection-detail" aria-modal="true" aria-label={cellName(selected, cellCopy)}
      onCancel={(event) => { event.preventDefault(); closeDetail() }}>
      <div className="collection-detail-card"><button className="icon-btn" aria-label={UI.home.back} onClick={closeDetail}>←</button>
        <CellMark cell={selected} className="collection-detail-stamp" ring />
        <p className="collection-detail-name" lang={ACTIVE.code}>{cellName(selected, cellCopy)}</p>
        {selected.tier && <h3>{RECEIPT_UI.stamp(selected.tier)}</h3>}
        <Tag size="wide" tone="primary" label={COLLECTION_UI.replay} onClick={() => { if (onReplay(selected.stableId)) closeDetail() }} />
      </div>
    </dialog>}
  </section>
}
