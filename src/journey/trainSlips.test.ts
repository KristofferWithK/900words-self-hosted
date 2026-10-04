import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { newStats } from '../srs/scheduler'
import type { SrsMap } from '../srs/types'
import { cityWords } from './cityWords'
import { trainSlips, trainSlipsFor } from './trainSlips'
import { recordPhoto, type PhotoLedger } from './wordMarks'

const NOW = 1_790_000_000_000
const CPH = 'Europe/Copenhagen'

describe('slips on the train run: 1 + floor(collected / 20)', () => {
  it('0, 19, 20 and 147 collected', () => {
    expect(trainSlips(0)).toBe(1)
    expect(trainSlips(19)).toBe(1)
    expect(trainSlips(20)).toBe(2)
    expect(trainSlips(39)).toBe(2)
    expect(trainSlips(40)).toBe(3)
    expect(trainSlips(147)).toBe(8)
  })

  it('never fewer than one, whatever it is handed', () => {
    expect(trainSlips(-3)).toBe(1)
    expect(trainSlips(Number.NaN)).toBe(1)
    expect(trainSlips(19.9)).toBe(1)
  })

  it("reads collected from the three-mark model over Sønderborg's 147 words", () => {
    const words = cityWords(WORDS, 0, 'da')
    expect(words).toHaveLength(147)
    expect(trainSlipsFor(words, {}, {})).toBe(1)

    // Every word collected: board words by photo + guess + clue, connecting
    // words by photos on three different local days.
    const srs: SrsMap = {}
    let photos: PhotoLedger = {}
    for (const w of words) {
      photos = recordPhoto(photos, w.id, NOW, CPH)
      if (w.kind === 'board') srs[w.id] = { ...newStats(NOW), greenByGuess: 1, greenByClue: 1 }
      else for (const day of [1, 2]) photos = recordPhoto(photos, w.id, NOW + day * 86_400_000, CPH)
    }
    expect(trainSlipsFor(words, srs, photos)).toBe(8)

    // Twenty board words collected and nothing else: two slips. Nineteen: one.
    const board = words.filter((w) => w.kind === 'board')
    const some = (n: number) => Object.fromEntries(board.slice(0, n).map((w) => [w.id, srs[w.id]!]))
    expect(trainSlipsFor(words, some(20), photos)).toBe(1 + Math.floor((20 + 47) / 20))
    const onlyBoard = (n: number) => trainSlipsFor(words, some(n), Object.fromEntries(Object.entries(photos).filter(([id]) => !id.startsWith('connecting:'))))
    expect(onlyBoard(19)).toBe(1)
    expect(onlyBoard(20)).toBe(2)
  })
})
