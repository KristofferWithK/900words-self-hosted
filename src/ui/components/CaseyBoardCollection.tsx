import { useLayoutEffect, useRef, useState } from 'react'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { boardKey } from '../../progression/identity'
import { emptyProgressFacts } from '../../progression/facts'
import { cityMedal } from '../../journey/progress'
import type { CourseSessions, ProgressFacts, Tier } from '../../progression/types'
import { RECEIPT_UI } from '../../i18n/receipt'
import { UI } from '../../i18n'
import { COLLECTION_UI } from '../../i18n/collection'
import { createSettlementStore } from '../../stores/settlementStore'

const PAGE_SIZE = 10

const tierSymbol = (tier: Tier | null) => tier === 'bronze' ? '●' : tier === 'silver' ? '◆' : tier === 'gold' ? '★' : tier === 'platinum' ? '✦' : '○'
const tierText = (tier: Tier | null) => tier === null ? COLLECTION_UI.unplayed : ({
  bronze: RECEIPT_UI.bronze, silver: RECEIPT_UI.silver, gold: RECEIPT_UI.gold, platinum: RECEIPT_UI.platinum,
})[tier]

/** Neutral cells show the authored portrait board shape without inventing play. */
function BoardFace() {
  return <span className="collection-board-face" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <i className="collection-board-cell" key={index} />)}
  </span>
}

export interface CollectionBoardEntry {
  readonly displayNumber: number
  readonly stableId: string
  readonly tier: Tier | null
}

/** The only board list the collection is permitted to show: frozen membership in display order. */
export function collectionBoards(facts: ProgressFacts = emptyProgressFacts()): readonly CollectionBoardEntry[] {
  return CITY1_REQUIRED_SET.boards.map((board, index) => ({
    displayNumber: index + 1,
    stableId: board.authoredBoardId,
    tier: facts.boards[boardKey(board)]?.best ?? null,
  }))
}

/** Read through the durable schema parser; a corrupt ledger never earns a UI medal. */
export function readCollectionFacts(): ProgressFacts {
  if (typeof localStorage === 'undefined') return emptyProgressFacts()
  try { return createSettlementStore({ storage: localStorage }).readLedger().facts } catch { return emptyProgressFacts() }
}

export function CaseyBoardCollection({ facts = readCollectionFacts(), sessions, onReplay }: {
  readonly facts?: ProgressFacts
  readonly sessions: CourseSessions | null
  /** Returns false when the store's replay guard refuses the request. */
  readonly onReplay: (stableId: string) => boolean
}) {
  const boards = collectionBoards(facts)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<CollectionBoardEntry | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const detail = useRef<HTMLDialogElement | null>(null)
  const pages = Math.ceil(boards.length / PAGE_SIZE)
  const shown = boards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const medal = cityMedal(facts, CITY1_REQUIRED_SET).tier
  // Use the same validated selector as a launch. A retained queue can still
  // contain a board that a later valid import completed, and its first raw
  // key is not necessarily the next board the runtime will actually open.
  const projection = sessions ?? initialCourseSessions(facts)
  let next = null
  try {
    const nextBoard = nextRequiredBoard(projection, facts)
    next = nextBoard ? boards.find((entry) => boardKey(CITY1_REQUIRED_SET.boards[entry.displayNumber - 1]!) === boardKey(nextBoard)) ?? null : null
  } catch {
    // A corrupt persisted session must not invent a board target on this
    // read-only surface. The game store owns recovery of such a session.
  }
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

  return <section className="casey-board-collection" aria-label={COLLECTION_UI.title}>
    <div className="collection-summary">
      <div className="collection-summary-copy">
        <h2>{COLLECTION_UI.title}</h2>
        <p>{COLLECTION_UI.cityBest(tierText(medal))}</p>
        <p className="collection-primary" aria-live="polite">{next ? COLLECTION_UI.nextPrimary(next.displayNumber) : COLLECTION_UI.primaryComplete}</p>
        {replaySuspendsPrimary && <p className="collection-suspended" role="status">{COLLECTION_UI.primaryWaiting}</p>}
      </div>
      <nav className="collection-pager" aria-label={COLLECTION_UI.pagerAria}>
        <button className="icon-btn" aria-label={UI.home.pagerPreviousAria(COLLECTION_UI.title)} disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
        <span aria-live="polite">{page + 1}/{pages}</span>
        <button className="icon-btn" aria-label={UI.home.pagerNextAria(COLLECTION_UI.title)} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</button>
      </nav>
    </div>
    <ol className="collection-board-grid" start={page * PAGE_SIZE + 1}>
      {shown.map((entry) => <li key={entry.stableId} className={`collection-board-slot tier-${entry.tier ?? 'unplayed'}`}>
        {entry.tier === null
          ? <span className="collection-board-card collection-board-unplayed" role="img" aria-label={COLLECTION_UI.boardAria(entry.displayNumber, tierText(null))}>
              <b>{String(entry.displayNumber).padStart(2, '0')}</b><BoardFace /><small>{tierText(null)}</small>
            </span>
          : <button className="collection-board-card" onClick={(event) => { opener.current = event.currentTarget; setSelected(entry) }} aria-label={COLLECTION_UI.boardAria(entry.displayNumber, tierText(entry.tier))}>
              <b>{String(entry.displayNumber).padStart(2, '0')}</b><BoardFace /><small>{tierText(entry.tier)}</small>
            </button>}
      </li>)}
    </ol>
    {selected && <dialog ref={detail} className="collection-detail" aria-modal="true" aria-label={COLLECTION_UI.details(selected.displayNumber)}
      onCancel={(event) => { event.preventDefault(); closeDetail() }}>
      <div className="collection-detail-card"><button className="icon-btn" aria-label={UI.home.back} onClick={closeDetail}>←</button>
        <p>{COLLECTION_UI.details(selected.displayNumber)}</p><h3>{tierSymbol(selected.tier)} {tierText(selected.tier)}</h3>
        <button className="btn btn-primary" onClick={() => { if (onReplay(selected.stableId)) closeDetail() }}>{COLLECTION_UI.replay}</button>
      </div>
    </dialog>}
  </section>
}
