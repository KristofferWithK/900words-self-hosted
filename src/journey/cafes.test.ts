import { describe, expect, it } from 'vitest'
import manifest from '../data/city1-required-board-manifest.da.json'
import germanManifest from '../data/city1-required-board-manifest.de.json'
import { emptyProgressFacts } from '../progression/facts'
import { cafeSetFixture } from '../progression/fixtures'
import { boardKey, firstCompletionKey } from '../progression/identity'
import type { BoardIdentity, ProgressFacts } from '../progression/types'
import { requiredSetForCourse } from '../session/courseRuntime'
import {
  cafesOf,
  countCafePhoto,
  emptyCafeFinds,
  FIRST_CAFE_PHOTOS,
  isCafeLaunchable,
  mergeCafeFinds,
  NEXT_CAFE_PHOTOS,
  photosForNextCafe,
  summarizeCafes,
  type CafeFinds,
} from './cafes'

const T0 = 1_790_000_000_000
const city = cafeSetFixture(8)
const boards = city.boards

/** Facts in which these boards were played, by the given kind of evidence. */
function played(list: readonly BoardIdentity[], how: 'primary' | 'loss' | 'best' = 'primary'): ProgressFacts {
  const facts = emptyProgressFacts()
  return {
    ...facts,
    ...(how === 'primary' ? { firstPrimaryCompletions: Object.fromEntries(list.map((board) => [firstCompletionKey(board), { board, requiredSet: city }])) } : {}),
    ...(how === 'loss' ? { completedLosses: Object.fromEntries(list.map((board) => [boardKey(board), { board, firstPrimary: true }])) } : {}),
    ...(how === 'best' ? { boards: Object.fromEntries(list.map((board) => [boardKey(board), { board, best: 'gold' as const, claims: [] }])) } : {}),
  }
}

/** Walk `photos` photos, one per second, returning the finds and the order cafés were found in. */
function walk(photos: number, finds: CafeFinds = emptyCafeFinds(), facts: ProgressFacts | null = emptyProgressFacts(), from = T0) {
  const foundAt: { index: number; photo: number }[] = []
  for (let i = 1; i <= photos; i++) {
    const outcome = countCafePhoto(boards, finds, facts, from + i * 1000)
    finds = outcome.finds
    if (outcome.found) foundAt.push({ index: outcome.found.index, photo: i })
  }
  return { finds, foundAt }
}

describe('the finding curve (owner O1)', () => {
  it('the first café needs 5 photos; then 10, 20, 30, 40 by cafés waiting, 3 or more all 40', () => {
    expect(FIRST_CAFE_PHOTOS).toBe(5)
    expect(NEXT_CAFE_PHOTOS).toEqual([10, 20, 30, 40])
    expect(photosForNextCafe(0, 0)).toBe(5)
    expect(photosForNextCafe(1, 0)).toBe(10)
    expect(photosForNextCafe(1, 1)).toBe(20)
    expect(photosForNextCafe(2, 2)).toBe(30)
    expect(photosForNextCafe(3, 3)).toBe(40)
    expect(photosForNextCafe(4, 4)).toBe(40)
    expect(photosForNextCafe(50, 47)).toBe(40)
    // Played cafés count as found but never as waiting.
    expect(photosForNextCafe(30, 0)).toBe(10)
  })

  it('a fresh city finds its first café at the fifth photo, not the fourth', () => {
    expect(walk(4).foundAt).toEqual([])
    const { finds, foundAt } = walk(5)
    expect(foundAt).toEqual([{ index: 0, photo: 5 }])
    expect(finds.found).toEqual({ [boards[0]!.authoredBoardId]: T0 + 5000 })
    expect(finds.toward).toBe(0)
  })

  it('every step of a long walk with nothing played: 5, then +20, +30, +40, +40 (cafés keep waiting)', () => {
    const { foundAt } = walk(5 + 20 + 30 + 40 + 40)
    // After the first find one café waits: 20. Two wait: 30. Three: 40. Four or more: still 40.
    expect(foundAt).toEqual([
      { index: 0, photo: 5 },
      { index: 1, photo: 25 },
      { index: 2, photo: 55 },
      { index: 3, photo: 95 },
      { index: 4, photo: 135 },
    ])
  })

  it('with every found café played, each next one needs 10', () => {
    let finds = emptyCafeFinds()
    let facts = emptyProgressFacts()
    const at: number[] = []
    let photo = 0
    while (at.length < 4) {
      photo++
      const outcome = countCafePhoto(boards, finds, facts, T0 + photo)
      finds = outcome.finds
      if (outcome.found) {
        at.push(photo)
        facts = played(cafesOf(boards, finds, facts).filter((c) => c.state !== 'unfound').map((c) => c.board))
      }
    }
    expect(at).toEqual([5, 15, 25, 35])
  })

  it('reads the need at each photo: playing a waiting café brings the next find nearer at once', () => {
    // Two found and waiting: the next needs 30. At 25 toward, one is played: one waits, 20 is enough.
    let { finds } = walk(5 + 20)
    expect(summarizeCafes(cafesOf(boards, finds, emptyProgressFacts()), finds)).toMatchObject({ found: 2, waiting: 2, needed: 30, toward: 0 })
    ;({ finds } = walk(25, finds, emptyProgressFacts(), T0 + 100_000))
    expect(finds.toward).toBe(25)
    const outcome = countCafePhoto(boards, finds, played([boards[0]!]), T0 + 200_000)
    expect(outcome.found?.index).toBe(2)
    expect(outcome.finds.toward).toBe(0)
  })

  it('finds cafés in the fixed required order, skipping cafés already played', () => {
    // Boards 0 and 2 were played before the café world: both count as found,
    // the next find is board 1, then 3. With nothing waiting it needs 10.
    const facts = played([boards[0]!, boards[2]!])
    const { foundAt } = walk(10 + 20, emptyCafeFinds(), facts)
    expect(foundAt).toEqual([{ index: 1, photo: 10 }, { index: 3, photo: 30 }])
  })

  it('stores whole milliseconds, and refuses a time no schema would accept', () => {
    let finds = emptyCafeFinds()
    for (let i = 0; i < 5; i++) finds = countCafePhoto(boards, finds, emptyProgressFacts(), T0 + 0.75).finds
    expect(finds.found[boards[0]!.authoredBoardId]).toBe(T0)
    expect(() => countCafePhoto(boards, finds, emptyProgressFacts(), Number.NaN)).toThrow()
    expect(() => countCafePhoto(boards, finds, emptyProgressFacts(), -1)).toThrow()
  })

  it('one photo finds one café at most, and nothing once every café is found', () => {
    const two = cafeSetFixture(2).boards
    let finds = emptyCafeFinds()
    const found: number[] = []
    for (let i = 0; i < 200; i++) {
      const outcome = countCafePhoto(two, finds, emptyProgressFacts(), T0 + i)
      if (outcome.found) found.push(outcome.found.index)
      finds = outcome.finds
    }
    expect(found).toEqual([0, 1])
    const done = countCafePhoto(two, finds, emptyProgressFacts(), T0)
    expect(done.finds).toBe(finds)
    expect(done.found).toBeNull()
  })
})

describe('café states', () => {
  it('unfound, found (waiting) and played; played wins over found', () => {
    const finds: CafeFinds = { found: { [boards[0]!.authoredBoardId]: T0, [boards[1]!.authoredBoardId]: T0 + 1 }, toward: 3 }
    const cafes = cafesOf(boards, finds, played([boards[1]!, boards[5]!]))
    expect(cafes.map((c) => c.state)).toEqual(['found', 'played', 'unfound', 'unfound', 'unfound', 'played', 'unfound', 'unfound'])
    expect(cafes.map((c) => c.foundAt)).toEqual([T0, T0 + 1, null, null, null, null, null, null])
    expect(summarizeCafes(cafes, finds)).toMatchObject({ found: 3, waiting: 1, played: 2, total: 8, toward: 3, needed: 20 })
    expect(summarizeCafes(cafes, finds).next?.index).toBe(2)
  })

  it('every kind of played evidence counts: a first completion, a completed loss, a best', () => {
    for (const how of ['primary', 'loss', 'best'] as const) {
      expect(cafesOf(boards, emptyCafeFinds(), played([boards[3]!], how))[3]!.state, how).toBe('played')
    }
  })

  it('a board counted as found without a walk (an anchored queue head) is found and launchable, and finds go round it', () => {
    const also = new Set([boards[3]!.authoredBoardId])
    const cafes = cafesOf(boards, emptyCafeFinds(), emptyProgressFacts(), also)
    expect(cafes.map((c) => c.state).slice(0, 5)).toEqual(['unfound', 'unfound', 'unfound', 'found', 'unfound'])
    expect(cafes[3]!.foundAt).toBeNull()
    expect(isCafeLaunchable(boards[3]!, emptyCafeFinds(), emptyProgressFacts(), also)).toBe(true)
    // One café found already, one waiting: the next find (board 0) takes 20.
    let finds = emptyCafeFinds()
    let found = null
    for (let i = 1; i <= 20; i++) ({ finds, found } = countCafePhoto(boards, finds, emptyProgressFacts(), T0 + i, also))
    expect(found?.index).toBe(0)
  })

  it('unreadable facts read as nothing played, never as everything', () => {
    expect(cafesOf(boards, emptyCafeFinds(), null).every((c) => c.state === 'unfound')).toBe(true)
  })

  it('only a found or played café may be launched', () => {
    const finds: CafeFinds = { found: { [boards[0]!.authoredBoardId]: T0 }, toward: 0 }
    expect(isCafeLaunchable(boards[0]!, finds, emptyProgressFacts())).toBe(true)
    expect(isCafeLaunchable(boards[1]!, finds, emptyProgressFacts())).toBe(false)
    expect(isCafeLaunchable(boards[1]!, finds, played([boards[1]!]))).toBe(true)
    expect(isCafeLaunchable(boards[1]!, finds, null)).toBe(false)
  })
})

describe('merging finds (backup)', () => {
  const k = '["da","sonderborg"]'
  it('unions found cafés with the earlier time; toward from the side that found more', () => {
    const a = { [k]: { found: { x: 5, y: 9 }, toward: 2 } }
    const b = { [k]: { found: { y: 7, z: 8, w: 1 }, toward: 6 } }
    expect(mergeCafeFinds(a, b)).toEqual({ [k]: { found: { x: 5, y: 7, z: 8, w: 1 }, toward: 6 } })
    expect(mergeCafeFinds(b, a)).toEqual(mergeCafeFinds(a, b))
    // As many finds on each side: the larger count.
    expect(mergeCafeFinds({ [k]: { found: { x: 1 }, toward: 2 } }, { [k]: { found: { y: 1 }, toward: 4 } })[k]!.toward).toBe(4)
    // Twice over changes nothing.
    const once = mergeCafeFinds(a, b)
    expect(mergeCafeFinds(once, b)).toEqual(once)
  })

  it('keeps a city only one side knows', () => {
    const de = '["de","sonderborg"]'
    expect(mergeCafeFinds({ [k]: { found: {}, toward: 1 } }, { [de]: { found: { q: 2 }, toward: 0 } }))
      .toEqual({ [de]: { found: { q: 2 }, toward: 0 }, [k]: { found: {}, toward: 1 } })
  })
})

describe('the cafés are the required board set, untouched', () => {
  it('Danish City 1: the 100 required boards of the frozen manifest, in its order and with its identities', () => {
    const set = requiredSetForCourse('da')
    const cafes = cafesOf(set.boards, emptyCafeFinds(), emptyProgressFacts())
    expect(cafes).toHaveLength(100)
    expect(set.setVersion).toBe(manifest.boardSetVersion)
    expect(cafes.map((c) => ({ authoredBoardId: c.board.authoredBoardId, contentRevision: c.board.contentRevision }))).toEqual(manifest.requiredBoards)
    expect(cafes.map((c) => c.board.authoredBoardId)).toEqual(manifest.displayOrder)
    expect(cafes.every((c) => c.board.courseId === 'da' && c.board.cityId === manifest.stableCityId)).toBe(true)
    expect(cafes.map((c) => c.index)).toEqual([...Array(100).keys()])
  })

  it('German City 1: its own manifest, in its order', () => {
    const set = requiredSetForCourse('de')
    expect(set.boards.map((b) => ({ authoredBoardId: b.authoredBoardId, contentRevision: b.contentRevision }))).toEqual(germanManifest.requiredBoards)
  })

  it('the first find of a fresh Danish City 1 is the first required board', () => {
    const set = requiredSetForCourse('da')
    let finds = emptyCafeFinds()
    let found = null
    for (let i = 0; i < 5; i++) ({ finds, found } = countCafePhoto(set.boards, finds, emptyProgressFacts(), T0 + i))
    expect(found?.board).toEqual(set.boards[0])
    expect(isCafeLaunchable(set.boards[0]!, finds, emptyProgressFacts())).toBe(true)
    expect(isCafeLaunchable(set.boards[1]!, finds, emptyProgressFacts())).toBe(false)
  })
})
