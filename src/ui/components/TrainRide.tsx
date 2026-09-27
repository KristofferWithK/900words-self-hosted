import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cityAt } from '../../journey/cities'
import { grammarLessonAudioFromCourse, type GrammarLessonAudioSource } from '../../lang/chapter-audio'
import type { GrammarChapter } from '../../lang/curriculum-grammar'
import { activeGrammarBooks, activeSurvivalGuide, grammarBookForActiveCity, grammarBooksForActiveCityIndex } from '../../lang/bookshelf'
import { Blocks, BookReader } from './BookReader'
import { SurvivalExchangeReader } from '../screens/TravelGuideBook'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import {
  chapterLineAt,
  createChapterPlaybackGeneration,
  startChapterPlayback,
  usableChapterTiming,
  type ChapterTimingManifest,
} from '../../journey/chapterPerformance'
import { useSettings } from '../../stores/settingsStore'
import {
  chapterAudioSourceForId,
  chapterAudioUrlForId,
  chapterTimingsUrlForId,
  loadBakedClip,
  playLoadedClip,
  primeWordAudio,
  reportAudioFailure,
  stopWordAudio,
} from '../speak'
import './GrammarRide.css'

/** The pencil train is shared with onboarding, so both journeys visibly match. */
export function PencilTrain({ className = 'ride-train' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 90" className={className} role="presentation">
      <g className="cluey-hatch">
        <rect x="18" y="22" width="150" height="46" rx="8" />
        <rect x="34" y="32" width="34" height="22" rx="3" />
        <rect x="82" y="32" width="34" height="22" rx="3" />
        <rect x="130" y="32" width="26" height="22" rx="3" />
        <circle cx="46" cy="74" r="9" />
        <circle cx="140" cy="74" r="9" />
        <path d="M168 30 h28 l10 22 v16 h-38 z" />
        <circle cx="188" cy="74" r="9" />
        <path d="M6 74 h228" className="ride-rail" />
      </g>
    </svg>
  )
}

/**
 * The ride into a city: that destination's chapter of the Travel Guide, read
 * on the Guide's own paper — the grammar lessons first (a rules page, then an
 * examples page with the chapter recording under the table), then the city's
 * four Survival exchanges — and then the arrival.
 *
 * It used to be its own reader, `TrainLessonSheets`: the same lesson text on
 * the parchment the Guide retired on 2026-08-26, framed as "Lesson 1 of 2"
 * with no Survival half. The owner's ask (2026-09-05) was one reader, and the
 * train showing "the appropriate content from the travel guide". So this is
 * `BookReader` and `SurvivalExchangeReader` exactly as the Guide mounts them,
 * with three things the Guide does not need: a top row of its own (the city,
 * which half, and Skip), a Next past the last grammar page into Survival and
 * past the last exchange into the arrival, and the recording on the examples
 * pages, which the Guide gains by the same `renderBlock`.
 *
 * `canTravel` opens the road only when a city's words are packed. Skip stays
 * deliberately simple: reaching a destination unlocks its chapter in the map
 * library even when the player skips this first reading.
 */
/** Which half of the chapter is open, and where in it. */
type RidePart =
  | { readonly kind: 'grammar'; readonly pageId?: string }
  | { readonly kind: 'survival'; readonly exchange: number }

export function TrainRide({ destinationCityIndex, onDone }: { destinationCityIndex: number; onDone: () => void }) {
  const city = cityAt(destinationCityIndex)
  const chapter = activeGrammarBooks[destinationCityIndex]
  const grammar = chapter ? grammarBookForActiveCity(chapter.cityId) : undefined
  const survival = activeSurvivalGuide.cities[destinationCityIndex]
  const [part, setPart] = useState<RidePart>(() => (grammar ? { kind: 'grammar' } : { kind: 'survival', exchange: 0 }))

  // A route and its course have the same nine legs. Keep the old graceful
  // hand-off should a future language ship a shorter course by mistake.
  const empty = !grammar && !survival
  useEffect(() => {
    if (empty) onDone()
  }, [empty, onDone])

  // The recording that belongs under each examples page. Keyed by the page's
  // id rather than the lesson's, because a page is what `renderBlock` sees.
  const audioByPage = useMemo(() => {
    const byLesson = new Map(grammarLessonAudioFromCourse(ACTIVE.grammarCourse).map((source) => [source.lessonId, source]))
    const byPage = new Map<string, GrammarLessonAudioSource>()
    for (const lesson of grammarBooksForActiveCityIndex(destinationCityIndex)) {
      const source = byLesson.get(lesson.id)
      const examples = lesson.book.pages[1]
      if (source && examples) byPage.set(examples.id, source)
    }
    return byPage
  }, [destinationCityIndex])

  if (empty) return null

  const leaveLabel = UI.guide.skipLessonAria
  const doneLabel = UI.guide.continueLabel
  const bar = <RideBar cityName={city.name} part={part.kind} onLeave={onDone} />
  const lastGrammarPage = grammar?.book.pages.at(-1)?.id

  return (
    <div className="screen ride-screen">
      <div className="ride-window" aria-hidden="true"><PencilTrain /></div>
      {part.kind === 'grammar' && grammar ? (
        <BookReader
          key="grammar"
          book={grammar.book}
          skipCover
          integratedTop
          className="travel-guide-book guide-grammar guide-grammar-reader ride-reader"
          onClose={onDone}
          readerBackLabel={leaveLabel}
          initialPageId={part.pageId}
          topAccessory={bar}
          renderBlock={(page) => {
            const source = audioByPage.get(page.id)
            return <><Blocks blocks={page.blocks} />{source && <ChapterPerformance source={source} compact />}</>
          }}
          onPastEnd={survival ? () => setPart({ kind: 'survival', exchange: 0 }) : onDone}
          pastEndLabel={survival ? UI.guide.toSurvivalLabel : doneLabel}
        />
      ) : survival ? (
        <SurvivalExchangeReader
          key={`survival-${part.kind === 'survival' ? part.exchange : 0}`}
          city={survival}
          exchange={survival.exchanges[part.kind === 'survival' ? part.exchange : 0]!}
          exchangeIndex={part.kind === 'survival' ? part.exchange : 0}
          className="ride-reader"
          onClose={onDone}
          backLabel={leaveLabel}
          topAccessory={bar}
          onTurn={(exchange) => setPart({ kind: 'survival', exchange })}
          onBeforeStart={grammar ? () => setPart({ kind: 'grammar', pageId: lastGrammarPage }) : undefined}
          onPastEnd={onDone}
          pastEndLabel={doneLabel}
        />
      ) : null}
    </div>
  )
}

/**
 * The ride's own top row, where the Guide keeps its thumb indexes: the city,
 * which half of its chapter is open, and the one control that leaves the
 * ride: Skip. (There used to be a replay mode with Close and a "no progress
 * recorded" note, for the map's "Train lesson"; that button went on
 * 2026-09-05 and the mode with it — the ride is always a real ride now.)
 */
function RideBar({ cityName, part, onLeave }: { cityName: string; part: RidePart['kind']; onLeave: () => void }) {
  return (
    <div className="ride-bar">
      <span className="ride-bar-label">
        {cityName} · {part === 'grammar' ? UI.guide.sectionGrammar : UI.guide.sectionSurvival}
      </span>
      <button type="button" className="btn btn-small ride-skip" onClick={onLeave}>
        {UI.guide.skipShort}
      </button>
    </div>
  )
}

/**
 * A chapter has two complementary ways in: one continuous Danish performance
 * with a moving line, or an individual line for a learner who wants to stop
 * and work through it. The chapter clip is intentionally optional: no bake,
 * a stale timing map, or offline-before-first-listen falls back to the device
 * voice one line at a time and never holds the train.
 */
export function ChapterPerformance({ source: performance, compact = false }: { source: GrammarLessonAudioSource; compact?: boolean }) {
  const sound = useSettings((state) => state.sound)
  const [current, setCurrent] = useState<number | null>(null)
  /**
   * `failed` is a recording this lesson has that did not load or play;
   * `missing` is a lesson the bake does not cover. Both used to be one state,
   * 'fallback', in which the device voice read the lines instead — and that
   * is gone: a recording that will not play is said to have not played.
   */
  const [status, setStatus] = useState<'ready' | 'loading' | 'playing' | 'failed' | 'missing'>('ready')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const generationRef = useRef(createChapterPlaybackGeneration())

  const source = chapterAudioSourceForId(performance.id)
  const sourceMatchesPerformance = !!source && source.cityId === performance.cityId &&
    source.cityIndex === performance.cityIndex &&
    source.linesDa.length === performance.linesDa.length &&
    source.linesDa.every((line, index) => line === performance.linesDa[index])

  const stop = () => {
    generationRef.current.cancel()
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    audioRef.current = null
    stopWordAudio()
    setStatus('ready')
  }

  useEffect(() => () => {
    generationRef.current.cancel()
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    stopWordAudio()
  }, [])

  /** The recording exists and did not play. Nothing is spoken instead. */
  const useFallback = (line: number, reason: 'absent' | 'unreachable' | 'play' = 'unreachable') => {
    stop()
    setCurrent(line)
    setStatus('failed')
    reportAudioFailure({ kind: 'chapter', reason })
  }
  /** No recording was ever baked for this lesson. */
  const missing = (line: number) => {
    stop()
    setCurrent(line)
    setStatus('missing')
  }

  const playFrom = async (line: number, stopAtNext: boolean) => {
    if (!sound) return
    if (!source || !sourceMatchesPerformance) {
      missing(line)
      return
    }

    // This must happen before the first await. The actual clip arrives later,
    // and iOS grants autoplay permission to this element inside the tap.
    primeWordAudio()
    stop()
    const generation = generationRef.current.begin()
    const current = () => generationRef.current.isCurrent(generation)
    setCurrent(line)
    setStatus('loading')
    const timingUrl = chapterTimingsUrlForId(performance.id)
    const audioUrl = chapterAudioUrlForId(performance.id)
    if (!timingUrl || !audioUrl) {
      missing(line)
      return
    }

    try {
      const timingResponse = await fetch(timingUrl)
      if (!current()) return
      if (!timingResponse.ok || !/^application\/json/i.test(timingResponse.headers.get('content-type') ?? '')) {
        useFallback(line)
        return
      }
      const manifest = await timingResponse.json() as ChapterTimingManifest
      if (!current()) return
      const timing = manifest.entries?.find((entry) => entry.id === source.id)
      if (!usableChapterTiming(timing, source.id, source.sourceHash, performance.linesDa.length)) {
        useFallback(line)
        return
      }

      const loaded = await loadBakedClip(audioUrl)
      if (!current()) return
      if (loaded.kind !== 'clip') {
        useFallback(line, loaded.kind)
        return
      }

      const starts = timing.starts
      const stopAt = stopAtNext ? starts[line + 1] : undefined
      const element = await playLoadedClip(loaded.clip, {
        url: audioUrl,
        startAt: starts[line],
        onTime: (seconds) => {
          if (current()) setCurrent(chapterLineAt(starts, seconds))
        },
        onEnded: () => {
          if (!current()) return
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
          frameRef.current = null
          audioRef.current = null
          setStatus('ready')
        },
      })
      if (!current()) return
      audioRef.current = element
      setStatus('playing')

      if (stopAt !== undefined) {
        const watch = () => {
          if (!current() || audioRef.current !== element) return
          if (element.currentTime >= stopAt) {
            element.pause()
            element.currentTime = stopAt
            audioRef.current = null
            frameRef.current = null
            setStatus('ready')
            return
          }
          frameRef.current = requestAnimationFrame(watch)
        }
        frameRef.current = requestAnimationFrame(watch)
      }
    } catch {
      // A failed fetch/decode must never strand a player in the train. The
      // visual lesson remains, and the failure is said rather than voiced.
      if (current()) useFallback(line, 'play')
    }
  }

  const start = (line: number, stopAtNext: boolean) => {
    if (!sound) return
    startChapterPlayback({
      sourceMatches: sourceMatchesPerformance,
      line,
      fallback: useFallback,
      play: (nextLine) => { void playFrom(nextLine, stopAtNext) },
    })
  }

  const listen = () => {
    if (!sound) return
    // A lesson not yet baked says so. It never borrows a neighbouring chapter
    // clip, and it no longer reads the lines in the device voice.
    if (!source || !sourceMatchesPerformance) {
      missing(0)
      return
    }
    start(0, false)
  }

  return (
    <section
      className="chapter-performance"
      aria-label={UI.guide.recordingSectionAria}
      data-chapter-performance={performance.id}
      data-chapter-status={status}
    >
      <div className="chapter-performance-head">
        <div>
          <h2>{UI.guide.hearTheLesson}</h2>
          {!compact && <p>{UI.guide.hearTheLessonHelp}</p>}
        </div>
        {status === 'loading' || status === 'playing' ? (
          <button className="btn btn-quiet chapter-stop" onClick={stop}>{UI.guide.stop}</button>
        ) : (
          <button className="btn btn-quiet chapter-listen" disabled={!sound} onClick={listen}>
            {UI.guide.listen}
          </button>
        )}
      </div>
      <p className="chapter-audio-status" role="status">
        {status === 'loading' && UI.guide.recordingLoading}
        {status === 'failed' && UI.guide.recordingFailed}
        {status === 'missing' && UI.guide.recordingMissing}
      </p>
      {!compact && <ol className="chapter-lines">
        {performance.linesDa.map((line, index) => (
          <li key={line}>
            <button
              type="button"
              className={`chapter-line${current === index ? ' is-playing' : ''}`}
              data-active={current === index ? 'true' : 'false'}
              aria-current={current === index ? 'true' : undefined}
              disabled={!sound}
              onClick={() => start(index, true)}
            >
              <span lang={ACTIVE.code}>{line}</span>
            </button>
          </li>
        ))}
      </ol>}
    </section>
  )
}

/** The same lesson reader is used by the later, accumulated map library. */
export function GrammarLesson({ chapter }: { chapter: GrammarChapter }) {
  return (
    <section className="grammar-lesson" aria-label={UI.guide.grammarChapterAria(chapter.cityIndex + 1)}>
      <MarkdownBlocks body={chapter.body} />
    </section>
  )
}

/** The authored Markdown uses only paragraphs, bullets, quotes and tables. */
function MarkdownBlocks({ body }: { body: string }) {
  const lines = body.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    if (line.trim() === '---') {
      i++
      continue
    }
    if (line.startsWith('|') && lines[i + 1]?.startsWith('|---')) {
      const cells = (value: string) => value.split('|').slice(1, -1).map((cell) => cell.trim())
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (lines[i]?.startsWith('|')) rows.push(cells(lines[i++]!))
      blocks.push(
        <table className="grammar-table" key={blocks.length}>
          <thead><tr>{head.map((cell, n) => <th key={n}>{inline(cell)}</th>)}</tr></thead>
          <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, n) => <td key={n}>{inline(cell)}</td>)}</tr>)}</tbody>
        </table>,
      )
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (lines[i]?.startsWith('- ')) items.push(lines[i++]!.slice(2))
      blocks.push(<ul className="grammar-list" key={blocks.length}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</ul>)
      continue
    }
    const quote = line.startsWith('> ')
    const paragraph: string[] = []
    while (i < lines.length && lines[i]!.trim() && !lines[i]!.startsWith('|') && !lines[i]!.startsWith('- ')) {
      paragraph.push(quote ? lines[i++]!.replace(/^>\s?/, '') : lines[i++]!)
    }
    const content = paragraph.map((part, n) => <Fragment key={n}>{n > 0 && ' '}{inline(part)}</Fragment>)
    blocks.push(quote ? <blockquote key={blocks.length}>{content}</blockquote> : <p key={blocks.length}>{content}</p>)
  }
  return <>{blocks}</>
}

function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    return part
  })
}
