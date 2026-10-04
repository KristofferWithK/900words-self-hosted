import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { WORDS } from '../../data/words'
import { cityAt } from '../../journey/cities'
import { connectingWordsForCity } from '../../journey/cityWords'
import { unlockedWords, wordsForCity } from '../../journey/progress'
import { useGame } from '../../stores/gameStore'
import { reachedIndex, useJourney } from '../../stores/journeyStore'
import { useSrs } from '../../stores/srsStore'
import { useUi } from '../../stores/uiStore'
import { playWord } from '../speak'
import { ACTIVE } from '../../lang/active'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../../i18n'
import { ConnectingWordNote, sayConnectingWord } from '../components/ConnectingWordNote'
import { MarkRing } from '../components/MarkRing'
import { connectingWordsThrough, markAria, suitcaseBands, suitcaseWords, type SuitcaseWord } from '../components/suitcaseWords'

const CaseyBoardCollection = lazy(() => import('../components/CaseyBoardCollection').then((module) => ({ default: module.CaseyBoardCollection })))

/** Word tiles retain their existing compact, paged reader. */
const LOOSE_PAGE = 8
const CASE_PAGE = 12

/** The "All" filter — one suitcase, everything reached in it. */
const ALL = -1

/** The hand-drawn lid floor and pencil edge from Casey's original open case. */
function CasePanel({ half }: { half: 'lid' | 'tray' }) {
  const lid = half === 'lid'
  return (
    <svg className={`case-art case-art-${half}`} viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {lid ? (
        <>
          <path className="case-floor" d="M8 22 Q8 8 22 7 L151 5 L278 7 Q292 8 292 22 L293 200 L7 200 Z" />
          <path className="case-edge" d="M7 200 L9 146 L7 90 L8 22 Q8 8 22 7 L96 6 L151 5 L214 6 L278 7 Q292 8 292 23 L291 94 L293 148 L292 200" />
          <path className="case-wall" d="M18 200 L19 148 L17 94 L18 26 Q18 16 29 15 L151 13 L272 15 Q283 16 283 26 L282 94 L284 148 L283 200" />
          <path className="case-wall" d="M8 22 L18 26 M292 22 L283 26" />
          <path className="case-edge" d="M285 7 L297 10 M22 7 L11 3" />
        </>
      ) : (
        <>
          <path className="case-floor" d="M7 0 L8 178 Q8 192 22 193 L151 195 L278 193 Q292 192 292 178 L293 0 Z" />
          <path className="case-edge" d="M8 0 L9 54 L7 110 L8 178 Q8 192 22 193 L96 194 L151 195 L214 194 L278 193 Q292 192 292 177 L291 106 L293 52 L292 0" />
          <path className="case-wall" d="M18 0 L19 52 L17 108 L18 174 Q18 184 29 185 L151 187 L272 185 Q283 184 283 174 L282 108 L284 52 L283 0" />
          <path className="case-wall" d="M8 178 L18 174 M292 178 L283 174" />
          <rect className="case-clasp" x="88" y="184" width="26" height="11" rx="4" />
          <rect className="case-clasp" x="186" y="184" width="26" height="11" rx="4" />
          <path className="case-edge" d="M285 193 L297 190 M22 193 L11 197" />
        </>
      )}
    </svg>
  )
}

function CaseHinge() {
  return (
    <svg className="case-hinge-art" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="case-edge" d="M10 4 L150 3 L290 5" />
      <path className="case-edge" d="M10 14 L150 15 L290 13" />
      <rect className="case-hinge-barrel" x="44" y="2" width="30" height="14" rx="5" />
      <rect className="case-hinge-barrel" x="135" y="2" width="30" height="14" rx="5" />
      <rect className="case-hinge-barrel" x="226" y="2" width="30" height="14" rx="5" />
    </svg>
  )
}

function CaseHandle() {
  return (
    <svg className="case-handle" viewBox="0 0 100 42" aria-hidden="true" focusable="false">
      <path className="case-edge" d="M9 42 L8 17 Q8 6 21 5 L79 6 Q92 7 92 18 L91 42" />
      <path className="case-wall" d="M23 42 L22 21 Q22 18 27 18 L73 19 Q78 19 78 22 L77 42" />
      <rect className="case-clasp" x="1" y="31" width="20" height="10" rx="3" />
      <rect className="case-clasp" x="79" y="31" width="20" height="10" rx="3" />
    </svg>
  )
}

function CaseCornerHatch() {
  return (
    <svg className="case-hatch" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g className="cluey-hatch">
        <line x1="5" y1="34" x2="17" y2="22" />
        <line x1="11" y1="36" x2="24" y2="23" />
        <line x1="18" y1="37" x2="30" y2="25" />
      </g>
    </svg>
  )
}

function Pager({
  label,
  note,
  words,
  page,
  perPage,
  onPage,
  render,
  empty,
  className = '',
  children,
}: {
  label: string
  /** A small line under the label: the lid's legend. */
  note?: string
  words: readonly SuitcaseWord[]
  page: number
  perPage: number
  onPage: (p: number) => void
  render: (w: SuitcaseWord) => React.ReactNode
  empty: string
  className?: string
  /** The drawn panel, if this band is one — it lies behind the words. */
  children?: React.ReactNode
}) {
  const pages = Math.max(1, Math.ceil(words.length / perPage))
  const clamped = Math.min(page, pages - 1)
  const slice = words.slice(clamped * perPage, (clamped + 1) * perPage)
  return (
    <div className={`case-band ${className}`}>
      {children}
      <div className="case-band-head">
        <span className="case-band-titles">
          <span className="case-band-label">{label}</span>
          {note && <span className="case-band-note">{note}</span>}
        </span>
        {pages > 1 && (
          <span className="case-pager">
            <button
              className="icon-btn icon-btn-small"
              aria-label={UI.home.pagerPreviousAria(label)}
              disabled={clamped === 0}
              onClick={() => onPage(clamped - 1)}
            >
              ‹
            </button>
            <span className="case-page-count" aria-live="polite">
              {clamped + 1}/{pages}
            </span>
            <button
              className="icon-btn icon-btn-small"
              aria-label={UI.home.pagerNextAria(label)}
              disabled={clamped >= pages - 1}
              onClick={() => onPage(clamped + 1)}
            >
              ›
            </button>
          </span>
        )}
      </div>
      {words.length === 0 ? (
        <p className="case-empty">{empty}</p>
      ) : (
        <ul className="case-tiles">{slice.map((w) => render(w))}</ul>
      )}
    </div>
  )
}

/** Above this many characters a word takes the smaller tile type: the ring costs a little width. */
const LONG_WORD = 9

const LOCALE = UI_LANGUAGE_INFO[UI_LANGUAGE].tag

export function SuitcaseScreen({ onBack }: { onBack?: () => void } = {}) {
  const goTo = useUi((s) => s.goTo)
  const openSheet = useUi((s) => s.openSheet)
  const srs = useSrs((s) => s.stats)
  const journey = useJourney()
  // The game store publishes every durable-slot handoff with this counter.
  // Reading it keeps the screen's ledger projection fresh without giving this
  // surface any settlement writer or alternate progress cache.
  const eventGeneration = useGame((s) => s.eventGeneration)
  const sessions = useGame((s) => s.sessions)
  // Opens on the stop you are standing in — see the note at the top of the
  // file. Safe as a plain initial value because the screen UNMOUNTS when you
  // leave it (App.tsx renders one screen at a time), so travelling and coming
  // back re-reads the new city rather than holding the old one.
  const [filter, setFilter] = useState<number>(journey.cityIndex)
  const [loosePage, setLoosePage] = useState(0)
  const [collectedPage, setCollectedPage] = useState(0)
  const [note, setNote] = useState<SuitcaseWord | null>(null)

  useEffect(() => {
    setLoosePage(0)
    setCollectedPage(0)
  }, [filter])

  // One case: All is everything the journey has reached, and a chip narrows
  // the view without moving the player anywhere.
  // A display pool, not a board pool: E0 kept "everything reached" as ALL's
  // meaning on purpose (docs/clue-engine.md §5), even though ordinary boards
  // went city-only.
  //
  // "Reached", not "standing in": since Travel back the two differ. Standing
  // in Sønderborg again after Aalborg, the case still holds Aalborg's words —
  // they were packed, and travelling never touches the ledger — so All shows
  // them and Aalborg keeps its chip. What follows the traveller is the chip
  // that starts lit and the wrap-up button, which are about where you stand.
  const reachedTo = reachedIndex(journey)
  // A city's words are its board words and its connecting words (CW-11,
  // contract section 3), each read with the three-mark model
  // (components/suitcaseWords.ts): three marks put a word in the lid, any
  // fewer leave it above the case with the marks it has. Old wrapped words
  // follow their marks too (see suitcaseWords.ts).
  const photos = journey.photos
  const wrapped = journey.wrapped
  const { loose, lid, total } = useMemo(() => {
    const board = filter === ALL ? unlockedWords(WORDS, reachedTo) : wordsForCity(WORDS, filter)
    const connecting = filter === ALL ? connectingWordsThrough(reachedTo) : connectingWordsForCity(filter)
    return suitcaseBands(suitcaseWords(board, connecting, srs, photos ?? {}, wrapped))
  }, [filter, reachedTo, srs, photos, wrapped])

  /**
   * A tile is a slot with the word button in it, never a bare button: the
   * slot is the positioned parent a per-tile control hangs off. The audio card
   * (F1) adds its speak button here as a second child with class
   * `case-tile-speak` — the stylesheet already places it, so that merge is one
   * element and no layout change.
   */
  const wordTile = (w: SuitcaseWord, cls: string) => (
    <li key={w.id} className="case-slot">
      <button
        // A compartment tile never wraps: the rows are short at 360×640 and a
        // second line is what would clip. The longest words get a smaller
        // type instead — «international» whole beats «internatio-» cut.
        className={`case-tile ${cls}${w.connecting ? ' case-connecting' : ''}${w.text.length > LONG_WORD ? ' case-tile-long' : ''}`}
        data-marks={w.marks.earned}
        aria-label={markAria(w, UI.home, LOCALE)}
        onClick={() => {
          // The tile says the word and opens its page — the sheet has its own
          // 🔊 for a second listen, but wanting to hear a word you are looking
          // at should not cost two taps. A connecting word has no card and no
          // sheet: it opens its own small note (ConnectingWordNote).
          if (w.connecting) {
            void sayConnectingWord(w.connecting)
            setNote(w)
            return
          }
          void playWord(w.id)
          openSheet(w.id)
        }}
      >
        <MarkRing earned={w.marks.earned} />
        <span className="case-tile-word" lang={ACTIVE.code}>{w.text}</span>
      </button>
    </li>
  )

  return (
    <div className="screen suitcase-screen">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.home.back} onClick={onBack ?? (() => goTo('home'))}>
          ←
        </button>
        <h1>{UI.home.suitcaseTitle}</h1>
      </header>

      {/* The city filter. Only cities reached are offered — the road ahead is
          the map's job, and a chip for a place you have never been would be a
          door into an empty half of the case. Reached, not behind you: a city
          you travelled back from keeps its chip (see `reachedTo`). It scrolls
          sideways INSIDE itself: nine Danish city names do not fit across
          360px, and the document is not allowed to scroll. */}
      <div className="case-filter" role="group" aria-label={UI.home.filterAria}>
        <button
          className={`chip ${filter === ALL ? 'chip-on' : ''}`}
          aria-pressed={filter === ALL}
          onClick={() => setFilter(ALL)}
        >
          {UI.home.filterAll}
        </button>
        {Array.from({ length: reachedTo + 1 }, (_, i) => (
          <button
            key={i}
            // The city you are standing in wears a dot. Nine chips and no
            // marker leaves the one that the wrap-up button is actually about
            // looking like any other place you have been.
            className={`chip ${filter === i ? 'chip-on' : ''}${
              i === journey.cityIndex ? ' chip-home' : ''
            }`}
            aria-pressed={filter === i}
            aria-current={i === journey.cityIndex ? 'location' : undefined}
            lang={ACTIVE.code}
            onClick={() => setFilter(i)}
          >
            {cityAt(i).name}
          </button>
        ))}
      </div>

      {/* Words not collected yet sit above the case, with their rings. */}
      <Pager
        label={UI.home.looseLabel(loose.length)}
        words={loose}
        page={loosePage}
        perPage={LOOSE_PAGE}
        onPage={setLoosePage}
        className="case-loose"
        empty={UI.home.looseEmpty}
        render={(w) => w.place === 'unknown' ? (
          <li key={w.id} className="case-slot">
            <span className="case-tile case-unknown" aria-label={UI.home.undiscoveredAria}>
              <span aria-hidden="true">?</span>
            </span>
          </li>
        ) : wordTile(w, 'case-discovered')}
      />

      <div className="case-open">
        <CaseHandle />
        <Pager
          label={UI.home.trainSheetCollected(lid.length, total)}
          note={UI.home.lidLegend}
          words={lid}
          page={collectedPage}
          perPage={CASE_PAGE}
          onPage={setCollectedPage}
          className="case-panel case-panel-lid"
          empty={UI.home.lidEmpty}
          render={(w) => wordTile(w, 'case-collected')}
        >
          <CasePanel half="lid" />
          <CaseCornerHatch />
        </Pager>
        <CaseHinge />
        <section className="case-panel case-panel-tray" aria-label={UI.home.suitcaseTitle}>
          <CasePanel half="tray" />
          <CaseCornerHatch />
          <Suspense fallback={<div className="casey-board-collection" aria-busy="true" />}>
            <CaseyBoardCollection key={eventGeneration} sessions={sessions} onReplay={(stableId) => {
              if (!useGame.getState().startReplay(stableId)) return false
              goTo('game')
              return true
            }} />
          </Suspense>
        </section>
      </div>
      {note?.connecting && (
        <ConnectingWordNote word={note.connecting} marks={note.marks} marksText={markAria(note, UI.home, LOCALE)} onClose={() => setNote(null)} />
      )}
    </div>
  )
}
