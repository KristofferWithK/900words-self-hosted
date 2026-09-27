import audioManifest from '../data/city1-sentence-audio.da.json'
import runtimeAudio from '../data/city1-sentence-audio.da.runtime.json'
import upgradeAudio from '../data/city1-sentence-audio.da.upgrade.runtime.json'
import upgrade from '../data/city1-review-upgrade.da.json'
import extensionBoard from '../../prototypes/finish-review/implementation/roster-extension/board-sentences.json'
import extensionReview from '../../prototypes/finish-review/implementation/roster-extension/review-sentences.json'
import cycle from '../data/city1-board-cycle.da.json'
import roster from '../data/city1-replacement-corpus.da.json'
import { examplePresentation } from './examplePresentation'
import type { WordEntry } from '../data/types'
import { CITY1_CATALOG } from './city1'
import words from '../data/words.da.json'
import board from '../../prototypes/finish-review/implementation/board-sentences.json'
import review from '../../prototypes/finish-review/implementation/review-sentences.json'
import about from '../../prototypes/finish-review/implementation/about-targets.json'
import { describe, expect, it } from 'vitest'
import type { Clue } from '../engine/types'
import { MAX_CLUE_NUMBER } from '../engine/config'
import { currentReviewSentence, nextReviewSentenceAvailable, nextSentence, recordingUrl, restoreQueue, selectQueue, type QueueState } from './city1'
import { testRow } from './city1.fixtures'
const rows = [testRow(), testRow('da:kat', 'ledger:i')]
const clue = (ids = ['da:hund'], by: Clue['by'] = 'player'): Clue => ({ by, text: 'Animals', number: 2,
  guesses: ids.map(wordId => ({ wordId, result: 'green' })) })
const history = [clue(), clue(['da:hund', 'da:kat']), clue()]
const state = (): QueueState => ({ version: 1, roundId: 'TEST', queue: selectQueue(history, rows), cursor: 1, dismissed: false })
describe('City 1 pure queue', () => {
  it('chooses one per player clue chronologically with local unused-target preference and repeated words allowed', () => {
    expect(selectQueue(history, rows).map(p => [p.clueHistoryIndex, p.wordId])).toEqual([[0, 'da:hund'], [1, 'da:kat'], [2, 'da:hund']])
    expect(selectQueue([clue(['da:hund', 'da:kat'])], rows, ['ledger:hvor'])[0]?.wordId).toBe('da:kat')
  })
  it('omits wrong-side, wrong guesses, unknown words and empty clues without borrowing reveals or targets', () => {
    expect(selectQueue([clue(['da:hund'], 'ai'), { ...clue(), guesses: [{ wordId: 'da:hund', result: 'bystander' }] }, clue([]), clue(['unknown'])], rows)).toEqual([])
    expect(selectQueue(history, [])).toEqual([])
  })
  it('uses the engine number limit, never the guess count', () => {
    expect(selectQueue([{ ...clue(), number: MAX_CLUE_NUMBER }], rows)).toHaveLength(1)
    for (const number of [0, -1, 1.5, MAX_CLUE_NUMBER + 1]) expect(selectQueue([{ ...clue(), number }], rows)).toEqual([])
    for (const text of ['', ' ', ' Animals']) expect(selectQueue([{ ...clue(), text }], rows)).toEqual([])
  })
  it('restores exact pins and cursor without reselecting or retaining extra saved fields', () => {
    const saved = state()
    const snapshot = JSON.stringify(saved)
    expect(restoreQueue({ ...saved, junk: true }, 'TEST', rows, history)).toEqual(saved)
    expect(JSON.stringify(saved)).toBe(snapshot)
    const alternate = state(); alternate.queue[1] = { ...alternate.queue[0]!, clueHistoryIndex: 1 }
    expect(restoreQueue(alternate, 'TEST', rows, history).dismissed).toBe(false)
  })
  it('offers review and next only for resolvable current and following sentence pins', () => {
    const queue = selectQueue(history.slice(0, 2), rows)
    const live: QueueState = { version: 1, roundId: 'TEST', queue, cursor: 0, dismissed: false }
    expect(currentReviewSentence(live, rows)).toMatchObject({ row: rows[0] })
    expect(nextReviewSentenceAvailable(live, rows)).toBe(true)
    expect(nextReviewSentenceAvailable(live, rows.slice(0, 1))).toBe(false)

    const unresolvedCurrent = { ...live, queue: [{ ...queue[0]!, sentenceId: 'missing' }, queue[1]!] }
    expect(currentReviewSentence(unresolvedCurrent, rows)).toBeNull()
    expect(nextReviewSentenceAvailable(unresolvedCurrent, rows)).toBe(false)
    expect(currentReviewSentence({ ...live, cursor: 9 }, rows)).toBeNull()
    expect(currentReviewSentence({ ...live, dismissed: true }, rows)).toBeNull()
  })
  it.each(['clueHistoryIndex', 'clueText', 'clueNumber', 'wordId', 'targetId', 'sentenceId', 'audioId', 'version'] as const)('dismisses tampered %s', key => {
    const saved = state(); Object.assign(saved.queue[0]!, { [key]: key === 'clueHistoryIndex' ? -1 : 'tampered' })
    expect(restoreQueue(saved, 'TEST', rows, history).dismissed).toBe(true)
  })
  it('dismisses legacy, stale versions, invalid cursors, duplicate/reordered indices and changed source history', () => {
    for (const saved of [undefined, {}, { ...state(), cursor: -1 }, { ...state(), cursor: 3 }, { ...state(), cursor: .5 }, { ...state(), roundId: 'other' }, { ...state(), queue: [state().queue[0], state().queue[0]] }, { ...state(), queue: [...state().queue].reverse() }]) {
      expect(restoreQueue(saved, 'TEST', rows, history).dismissed).toBe(true)
    }
    expect(restoreQueue(state(), 'TEST', [], history).dismissed).toBe(true)
    expect(restoreQueue(state(), 'TEST', rows, [clue(['da:hund'], 'ai'), ...history.slice(1)]).dismissed).toBe(true)
    expect(nextSentence(nextSentence(state())).dismissed).toBe(true)
  })
  it('only resolves a recording with exact identity, text and bake/playback rates', () => {
    const row = rows[0]!
    const recording = { audioId: row.audioId, sentenceId: row.sentenceId, version: 1, textDa: row.text.da,
      url: '/audio/da/city1/TEST.mp3', variant: 'normal' as const, bakeRate: 1 as const, playbackRate: 1 as const }
    expect(recordingUrl(row, [])).toBeUndefined()
    expect(recordingUrl(row, [recording])).toBe(recording.url)
    for (const patch of [{ textDa: 'different' }, { version: 2 }, { audioId: 'old-board' }, { sentenceId: 'old-sentence' }, { bakeRate: 0.7 as const }, { playbackRate: 0.8 as 1 }, { variant: 'slow' as const }, { url: '/audio/da/example/hund.mp3' }]) {
      expect(recordingUrl(row, [{ ...recording, ...patch }])).toBeUndefined()
    }
  })
})

describe('accepted production catalog', () => {
  it('uses the accepted rows directly, the focus upgrade in place of 29, and ports only the exact board pairs', () => {
    expect(CITY1_CATALOG.board).toEqual([...board.rows, ...extensionBoard.rows])
    // The upgrade of 2026-09-26 replaces a word's accepted row at the next
    // version and changes nothing else; every other row is the accepted one.
    const upgraded = new Map(upgrade.review.map(row => [row.wordId, row]))
    expect(upgraded.size).toBe(29)
    expect(CITY1_CATALOG.review).toEqual([...review.rows, ...extensionReview.rows].map(row => upgraded.get(row.wordId) ?? row))
    for (const row of [...review.rows, ...extensionReview.rows]) {
      const next = upgraded.get(row.wordId)
      if (next) expect([next.version, next.sourceSha256]).toEqual([row.version + 1, row.sourceSha256])
    }
    expect(CITY1_CATALOG.about).toEqual([...about.rows, ...upgrade.about])
    expect([board.rows.length, review.rows.length, about.rows.length, upgrade.about.length]).toEqual([100, 100, 39, 20])
    for (const row of CITY1_CATALOG.board) {
      const word = words.find(w => w.id === row.wordId)!
      const presentation = examplePresentation(word as WordEntry, { kind: 'board', cityIndex: 0 })
      expect([presentation.da, presentation.en, presentation.board?.wordSpan]).toEqual([row.text.da, row.text.en, row.wordSpan])
      expect(examplePresentation(word as WordEntry, { kind: 'instructional' }).da).toBe(word.exampleDa)
      const other = CITY1_CATALOG.review.find(r => r.wordId === row.wordId)!
      expect(other.text.da).not.toBe(row.text.da)
      expect(other.audioId).not.toBe(row.audioId)
    }
  })
  it('keeps all identities/spans and reports the pre-bake and focus limits honestly', () => {
    // The catalog ships the runtime projection; the canonical provenance
    // manifest stays script-side (checked as an exact projection below).
    // The frozen Aoede projection, then the upgrade's own 58 (29 sentences, normal and slow).
    expect(CITY1_CATALOG.recordings).toEqual([...runtimeAudio.recordings, ...upgradeAudio.recordings])
    expect([runtimeAudio.recordings.length, upgradeAudio.recordings.length]).toEqual([704, 58])
    // The app imports the runtime projection (scripts/emit-city1-runtime-audio.mjs),
    // not the canonical provenance manifest. The projection must stay an exact
    // per-row projection of the canonical recordings so drift fails closed.
    const RUNTIME_FIELDS = ['audioId', 'sentenceId', 'version', 'textDa', 'url', 'variant', 'bakeRate', 'playbackRate'] as const
    expect(runtimeAudio.status).toBe('complete')
    expect(runtimeAudio.recordings).toHaveLength(704)
    expect(runtimeAudio.recordings).toEqual(
      audioManifest.recordings.map((r: Record<string, unknown>) => Object.fromEntries(RUNTIME_FIELDS.map(k => [k, r[k]]))),
    )
    for (const row of [...CITY1_CATALOG.board, ...CITY1_CATALOG.review]) {
      expect(row.status).toBe('accepted')
      expect(row.text.da.slice(row.wordSpan.start, row.wordSpan.end)).toBe(row.wordSpan.text)
      for (const variant of ['normal', 'slow'] as const) {
        const recording = [...audioManifest.recordings, ...upgradeAudio.recordings].find((r: { audioId: string; variant: string }) => r.audioId === row.audioId && r.variant === variant) as { url: string } | undefined
        expect(recording, `${row.audioId} ${variant}`).toBeDefined()
        expect(recordingUrl(row, CITY1_CATALOG.recordings, variant)).toBe(recording?.url)
      }
    }
    for (const row of CITY1_CATALOG.review) {
      expect(row.text.da.slice(row.targetSpan.start, row.targetSpan.end)).toBe(row.targetSpan.text)
      expect(row.targetStage.use).not.toBe('receptive-ambient')
    }
    const targets = new Set(CITY1_CATALOG.review.map(r => r.targetId))
    expect(targets.size).toBe(54)
    for (const target of targets) expect(CITY1_CATALOG.about.some(a => a.targetId === target), target).toBe(true)
    expect(CITY1_CATALOG.about.filter(a => !targets.has(a.targetId))).toHaveLength(5)
  })
})

it('covers every authored and rank-100 ID and selects every actual player-green slot', () => {
  const ids = new Set(CITY1_CATALOG.review.map(r => r.wordId))
  expect(ids.size).toBe(176)
  expect(roster.wordIds).toHaveLength(100)
  const ranked = words.filter(w => w.curriculumRank <= 100)
  expect(ranked).toHaveLength(100)
  for (const id of [...roster.wordIds, ...ranked.map(w => w.id)]) expect(ids.has(id), id).toBe(true)
  expect(cycle.boards).toHaveLength(150)
  let selected = 0, omitted = 0, priorSelected = 0
  for (const b of cycle.boards) {
    expect(b.playerGreenIds).toHaveLength(8)
    for (const id of b.wordIds) expect(ids.has(id), `${b.id}/${id}`).toBe(true)
    for (const id of b.playerGreenIds) {
      const history = [clue([id])]
      const queue = selectQueue(history, CITY1_CATALOG.review)
      selected += queue.length; omitted += Number(queue.length === 0)
      priorSelected += selectQueue(history, CITY1_CATALOG.review.slice(0, 100)).length
      expect(queue[0]?.wordId, `${b.id}/${id}`).toBe(id)
      expect(restoreQueue({ version: 1, roundId: b.id, queue, cursor: 0, dismissed: false }, b.id, CITY1_CATALOG.review, history).queue).toEqual(queue)
    }
  }
  expect({ selected, omitted, priorSelected, priorOmitted: 1200-priorSelected }).toEqual({ selected: 1200, omitted: 0, priorSelected: 333, priorOmitted: 867 })
  expect(CITY1_CATALOG.review.find(r => r.wordId === 'da:finde')).toMatchObject({ version: 3, text: { da: 'Jeg kan ikke finde banegården.', en: "I can't find the station." } })
})

it('separates normal and slow recording identity and rejects historical 0.8 plans', () => {
  const row = testRow()
  const normal = { audioId: row.audioId, sentenceId: row.sentenceId, version: row.version,
    textDa: row.text.da, variant: 'normal' as const, bakeRate: 1 as const, playbackRate: 1 as const,
    url: '/audio/da/city1/TEST-normal.mp3' }
  const slow = { ...normal, variant: 'slow' as const, bakeRate: 0.7 as const, url: '/audio/da/city1/TEST-slow.mp3' }
  expect(recordingUrl(row, [normal, slow])).toBe(normal.url)
  expect(recordingUrl(row, [normal, slow], 'slow')).toBe(slow.url)
  expect(recordingUrl(row, [normal], 'slow')).toBeUndefined()
  expect(recordingUrl(row, [slow])).toBeUndefined()
  expect(recordingUrl(row, [], 'slow')).toBeUndefined()
  expect(recordingUrl(row, [{ ...normal, bakeRate: 0.8 as 1 }])).toBeUndefined()
})
