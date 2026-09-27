import { describe, expect, it } from 'vitest'
import cycle from '../data/city1-board-cycle.de.json'
import germanReview from '../data/city1-review.de.json'
import germanAudio from '../data/city1-sentence-audio.de.runtime.json'
import germanLead from '../data/audio-lead.de.json'
import survivalAudio from '../data/survival-audio.de.json'
import type { Clue } from '../engine/types'
import { GERMAN_CITY1_CATALOG as catalog, recordingUrl, restoreQueue, selectQueue } from './city1'

const clue = (wordId: string): Clue => ({ by: 'player', text: 'Hinweis', number: 1, guesses: [{ wordId, result: 'green' }] })

describe('German City 1 review (owner-approved 2026-09-26)', () => {
  it('offers exactly one sentence per Flensburg card, underlining the card and one support word', () => {
    const cards = new Set(cycle.boards.flatMap((board) => board.wordIds))
    expect(cards.size).toBe(100)
    expect(catalog.review.map((row) => row.wordId).sort()).toEqual([...cards].sort())
    expect(catalog.board).toEqual([])
    for (const row of catalog.review) {
      expect(row.status).toBe('accepted')
      expect(row.text.da.slice(row.wordSpan.start, row.wordSpan.end)).toBe(row.wordSpan.text)
      expect(row.text.da.slice(row.targetSpan.start, row.targetSpan.end)).toBe(row.targetSpan.text)
      expect(row.sentenceId).toMatch(/^city1:de:[a-z0-9-]+:review:sentence:v1$/)
    }
  })

  it('gives every support word an About note and no support word more than five cards', () => {
    const uses = new Map<string, number>()
    for (const row of catalog.review) uses.set(row.targetId, (uses.get(row.targetId) ?? 0) + 1)
    expect([...uses.values()].every((count) => count <= 5)).toBe(true)
    expect(catalog.about.map((about) => about.targetId).sort()).toEqual([...uses.keys()].sort())
    for (const about of catalog.about) {
      expect(about.example.da.slice(about.targetSpan.start, about.targetSpan.end)).toBe(about.targetSpan.text)
      expect(catalog.review.some((row) => row.text.da === about.example.da)).toBe(false)
    }
    // The owner asked for fewer article and «Sie» focuses: none is left.
    expect(catalog.review.filter((row) => /^(der|die|das|ein|eine|sie)$/i.test(row.targetSpan.text))).toEqual([])
    expect(germanReview.review).toHaveLength(100)
  })

  it('has a Leda recording at both speeds for every sentence, with a measured voice onset', () => {
    expect(catalog.recordings).toEqual(germanAudio.recordings)
    expect(catalog.recordings).toHaveLength(200)
    const leads = germanLead.entries as Record<string, number>
    for (const row of catalog.review) {
      for (const variant of ['normal', 'slow'] as const) {
        const url = recordingUrl(row, catalog.recordings, variant)
        expect(url, `${row.wordId} ${variant}`).toMatch(new RegExp(`^/audio/de/city1/review/[a-z0-9-]+/v1/${variant}\\.mp3$`))
        expect(typeof leads[url!.replace('/audio/de/', '')], url).toBe('number')
      }
    }
    for (const line of survivalAudio.entries) expect(typeof leads[`survival/${line.id}.mp3`], line.id).toBe('number')
  })

  it('never hands a German row a Danish recording, or the reverse', () => {
    const row = catalog.review[0]!
    const german = catalog.recordings.find((r) => r.audioId === row.audioId && r.variant === 'normal')!
    expect(recordingUrl(row, [{ ...german, url: german.url.replace('/audio/de/', '/audio/da/') }])).toBeUndefined()
  })

  it('queues the sentence of every player green on all 150 boards', () => {
    let selected = 0
    for (const board of cycle.boards) {
      for (const id of board.playerGreenIds) {
        const history = [clue(id)]
        const queue = selectQueue(history, catalog.review)
        expect(queue[0]?.wordId, `${board.id}/${id}`).toBe(id)
        expect(restoreQueue({ version: 1, roundId: board.id, queue, cursor: 0, dismissed: false }, board.id, catalog.review, history).queue).toEqual(queue)
        selected += queue.length
      }
    }
    expect(selected).toBe(1200)
  })
})
