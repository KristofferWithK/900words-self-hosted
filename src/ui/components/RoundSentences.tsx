import { useEffect, useMemo, useRef, useState } from 'react'
import reviewSource from '../../data/sentence-review.da.json'
import { wordById } from '../../data/words'
import type { WordEntry } from '../../data/types'
import type { GameState } from '../../engine/types'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../../i18n'
import type { UiLanguage } from '../../i18n'
import { sentenceFocusIsDue } from '../../journey/curriculumScheduler'
import { ACTIVE } from '../../lang/active'
import { useCurriculum } from '../../stores/curriculumStore'
import { useGame } from '../../stores/gameStore'
import { useJourney } from '../../stores/journeyStore'
import { playExample, preloadExampleAudio, stopWordAudio } from '../speak'
import { flowWordsAtCity, markSentence, type FlowWord, type Segment } from './sentenceFlow'

/**
 * An overview, not a player (owner, 2026-09-05, second pass): three or four
 * of the round's greens in their sentences, all visible at once, nothing to
 * page through and nothing to answer. The first pass of the same day built a
 * one-at-a-time card with a pager and a cloze, and the owner's reaction was
 * that a finishing screen wants a glance, not an activity.
 *
 * `MAX_SENTENCES` is the most rows the band shows; `chooseSentenceRows` may
 * show fewer when the sentences are long, because the band has a measured
 * budget on the tight phone and nothing on this screen may scroll (P1).
 */
export const MAX_SENTENCES = 6
export const MIN_SENTENCES = 1

/**
 * What the band may spend on ROWS, per ending, at the 360x640 phone — and
 * every pixel the phone is taller than that goes to more rows, because the
 * owner's ask was "if we have so much space we can add more sentences so the
 * screen is filled". Measured, not chosen (2026-09-05, third pass): the
 * column is 549px at 640; the header lines, the hairline, the legend, the
 * actions and the log lid leave the number below for rows; a culprit line
 * costs 44 more. The characters a line holds were read off a real render,
 * and endgame-drive re-checks every row it sees against these numbers, so an
 * estimate that flatters the phone fails there rather than clipping a row.
 *
 * There was a second, smaller number here for a wrap-up, whose names line and
 * token paragraph each ran to two lines. A wrap-up shows no sentences at all
 * since 2026-09-11 — its reader region is the journey — so the band is a
 * normal round's only, and one number is the whole of it.
 */
export const ROWS_BUDGET_PX = { normal: 304 } as const
export const TIGHT_PHONE_HEIGHT = 640
/** The card that ended it, said beside Casey: two lines at the tight phone's column. */
export const CULPRIT_LINE_PX = 44
/** Past these lengths a row's text is set a size down (see the stylesheet). */
export const LONG_DA = 90
export const LONG_EN = 100
export const CHARS_PER_LINE = { da: 27, daLong: 31, en: 40, enLong: 44 } as const
export const LINE_PX = { da: 23.2, daLong: 20.6, en: 18.2, enLong: 16.4 } as const

/**
 * The layout constants for the ACTIVE UI language (UI_LANGUAGE_INFO records
 * the per-language numbers measured in the browser — see
 * `e2e/measure-sentence-layout.mjs`). The Danish side is the same text for
 * every player, so its numbers are shared; the English side holds the
 * player-language gloss line's numbers, which differ per language.
 */
export const sentenceLayoutFor = (lang: UiLanguage = UI_LANGUAGE) =>
  UI_LANGUAGE_INFO[lang].sentenceLayout
/** Card padding (20) and the gap to the next card (8); the English's top margin rides in its line height. */
export const ROW_EXTRA_PX = 28

/** The rows budget for a phone of this height: the tight phone's, plus whatever is taller. */
export function rowsBudgetFor(base: number, innerHeight: number): number {
  return base + Math.max(0, innerHeight - TIGHT_PHONE_HEIGHT)
}

/** The lines a row's Danish and English are charged for, under the given UI language's measured layout (default: the active one). */
export function chargedLines(
  row: Pick<WordEntry, 'exampleDa' | 'exampleEn'>,
  layout: ReturnType<typeof sentenceLayoutFor> = sentenceLayoutFor(),
): { da: number; en: number } {
  const daLong = row.exampleDa.length > LONG_DA
  const enLong = row.exampleEn.length > LONG_EN
  const cpl = layout.charsPerLine
  return {
    da: Math.max(1, Math.ceil(row.exampleDa.length / (daLong ? cpl.daLong : cpl.da))),
    en: Math.max(1, Math.ceil(row.exampleEn.length / (enLong ? cpl.enLong : cpl.en))),
  }
}

/** The pixels one row is charged for, from its text alone. */
export function estimateRowPx(
  row: Pick<WordEntry, 'exampleDa' | 'exampleEn'>,
  layout: ReturnType<typeof sentenceLayoutFor> = sentenceLayoutFor(),
): number {
  const lines = chargedLines(row, layout)
  const px = layout.linePx
  const daPx = row.exampleDa.length > LONG_DA ? px.daLong : px.da
  const enPx = row.exampleEn.length > LONG_EN ? px.enLong : px.en
  return lines.da * daPx + lines.en * enPx + ROW_EXTRA_PX
}

/**
 * As many rows as the budget allows, in the order given (which is the
 * priority order from `pickSentenceWords`): a row that does not fit is passed
 * over and the next one tried, so a long new word does not leave the band
 * half empty when two shorter greens would have filled it. Never more than
 * the cap, and never fewer than one while there is a row to show — one row
 * of the dataset's longest example fits the smallest budget.
 */
export function chooseSentenceRows<T extends Pick<WordEntry, 'exampleDa' | 'exampleEn'>>(
  rows: readonly T[],
  budgetPx: number,
): T[] {
  const out: T[] = []
  let spent = 0
  for (const row of rows) {
    if (out.length >= MAX_SENTENCES) break
    const cost = estimateRowPx(row)
    if (out.length >= MIN_SENTENCES && spent + cost > budgetPx) continue
    out.push(row)
    spent += cost
  }
  return out
}

/**
 * P2's one small Danish word per sentence. The curriculum index also carries
 * phrase/chunk identifiers (for example `da-chunk-name`), which are
 * implementation identifiers rather than Danish; they are filtered here.
 * Since the overview pass this is used only to ORDER the rows — a word whose
 * authored focus is due comes before a familiar one — and no longer to ask.
 */
export function promptableFocusCandidates(wordId: string): readonly string[] {
  const candidates = reviewSource.entries.find((entry) => entry.wordId === wordId)?.focusIds ?? []
  return [...new Set(candidates.filter((focus) => !focus.startsWith('da-')))]
}

/**
 * New and newly collected cards remain visible; a due authored retrieval
 * precedes familiar cards, so review cannot erase the learning event.
 */
export function pickSentenceWords(
  greenIds: readonly string[],
  newlyDiscovered: readonly string[],
  newlyLearned: readonly string[],
  dueOrMax: ReadonlySet<string> | number = new Set(),
  max: number = MAX_SENTENCES,
): string[] {
  // Keep the former fourth `max` argument working for the selection unit
  // tests and for any small diagnostic importing this helper.
  const due = typeof dueOrMax === 'number' ? new Set<string>() : dueOrMax
  const cap = typeof dueOrMax === 'number' ? dueOrMax : max
  const discovered = new Set(newlyDiscovered)
  const learned = new Set(newlyLearned)
  const rank = (id: string) => discovered.has(id) ? 0 : learned.has(id) ? 1 : due.has(id) ? 2 : 3
  return greenIds
    .map((id, i) => ({ id, rank: rank(id), i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, cap)
    .map((x) => x.id)
}

/** The sentence with its green word and its city's small words drawn in. */
function MarkedSentence({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === 'plain' ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <mark key={i} className={seg.kind === 'green' ? 'sentence-green' : 'sentence-flow-word'}>
            {seg.text}
          </mark>
        ),
      )}
    </>
  )
}

/** The small words the shown rows carry between them, each once, in order of first appearance. */
export function unionFlowWords(perRow: readonly (readonly FlowWord[])[]): FlowWord[] {
  const seen = new Set<string>()
  const out: FlowWord[] = []
  for (const list of perRow) {
    for (const f of list) {
      if (seen.has(f.term)) continue
      seen.add(f.term)
      out.push(f)
    }
  }
  return out
}

/** The viewport's height, live: the drives resize the window after the summary is up, and a phone can too. */
function useInnerHeight(): number {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? TIGHT_PHONE_HEIGHT : window.innerHeight))
  useEffect(() => {
    const read = () => setH(window.innerHeight)
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return h
}

export function RoundSentences({ game, budgetPx, cityName }: { game: GameState; budgetPx: number; cityName: string }) {
  const innerHeight = useInnerHeight()
  const newlyDiscovered = useGame((s) => s.newlyDiscovered)
  const newlyLearned = useGame((s) => s.newlyLearned)
  const progress = useCurriculum((s) => s.byLanguage.da)
  const cityIndex = useJourney((s) => s.cityIndex)
  const items = ACTIVE.curriculum.supportItems
  const [now] = useState(() => Date.now())
  // The one row whose recording did not load, if any: it says so in place,
  // the way every other speaker in the app does since the fallback voice went.
  const [failed, setFailed] = useState<string | undefined>(undefined)
  const mounted = useRef(true)

  // Leaving the summary must silence whatever the shared player is saying.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stopWordAudio()
    }
  }, [])

  const greenIds = game.words.filter((w) => game.reveals[w.wordId]?.kind === 'green').map((w) => w.wordId)
  const evidence = progress?.sentenceReviewEvidence ?? {}
  const due = useMemo(() => {
    const out = new Set<string>()
    for (const wordId of greenIds) {
      if (promptableFocusCandidates(wordId).some((focus) => sentenceFocusIsDue(evidence, wordId, focus, now))) out.add(wordId)
    }
    return out
  }, [greenIds.join(','), progress, now])
  // Ranked over EVERY green, then cut to what the band can hold.
  const ranked = pickSentenceWords(greenIds, newlyDiscovered, newlyLearned, due, greenIds.length)
    .map((id) => wordById(id))
    .filter((w): w is NonNullable<typeof w> => !!w?.exampleDa && !!w.exampleEn)
  const rows = chooseSentenceRows(ranked, rowsBudgetFor(budgetPx, innerHeight))

  // Ready every row's sentence as the overview appears, in the order shown,
  // so a tap on a row starts it rather than loading it.
  const rowIds = rows.map((w) => w.id).join(',')
  useEffect(() => {
    if (rowIds) void preloadExampleAudio(rowIds.split(','))
  }, [rowIds])

  if (rows.length === 0) return null
  const flowPerRow = rows.map((row) => flowWordsAtCity(row.exampleDa, cityIndex, items))
  const flow = unionFlowWords(flowPerRow)
  const hear = async (wordId: string) => {
    setFailed(undefined)
    const source = await playExample(wordId)
    if (!mounted.current) return
    if (source === 'failed') setFailed(wordId)
  }

  return (
    <section className="sentences-section sentence-review" aria-label={UI.game.sentenceReviewAria}>
      <ol className="sentence-rows">
        {rows.map((row, i) => (
          <li key={row.id} className="sentence-row">
            {/* The card is the speaker: no 🔊 beside it, no height spent on
                a control. The legend under the rows says so once. */}
            <button
              type="button"
              className="sentence-hear"
              title={UI.game.hearItInDanish}
              onClick={() => { void hear(row.id) }}
            >
              <span lang={ACTIVE.code} className="sentence-da" data-long={row.exampleDa.length > LONG_DA ? '' : undefined}>
                <MarkedSentence segments={markSentence(row.exampleDa, row, flowPerRow[i]!.map((f) => f.term))} />
              </span>
              <span className="sentence-en" data-long={row.exampleEn.length > LONG_EN ? '' : undefined}>
                {row.exampleEn}
                {failed === row.id && <span className="sentence-note">{UI.game.recordingFailedNote}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {/* One legend for the band, in the marks' own ink. The small words are
          still listed — in the underlines — so the chip row went with the
          third pass; `flow` is kept for the drives, which check the
          underlines against it. */}
      <p className="sentence-legend" data-flow={flow.map((f) => f.term).join(' ')}>
        <mark className="sentence-green">{UI.game.legendGreenLabel}</mark>
        {UI.game.legendGreenMeaning}{' '}
        {flow.length > 0 && (
          <>
            <mark className="sentence-flow-word">{UI.game.legendUnderlinedLabel}</mark>
            {UI.game.legendUnderlinedMeaning(cityName)}{' '}
          </>
        )}
        {UI.game.legendTapToHear}
      </p>
    </section>
  )
}
