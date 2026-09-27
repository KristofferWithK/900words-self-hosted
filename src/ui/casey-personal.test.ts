import { describe, expect, it } from 'vitest'
import { WORDS, wordById } from '../data/words'
import { UI } from '../i18n'
import { newStats } from '../srs/scheduler'
import type { SrsMap } from '../srs/types'
import { CLUE_TALLY_KEY, readClueTally, recordPlayerClue } from '../stores/clueTally'
import { PERSONAL_MIN, personalLines, type PersonalEvidence } from './casey-personal'
import { HOME_LINE_SHARE, homeLineIndex, weightedLineIndex, type HomeLineKind } from './cluey-tips'

const fakeStorage = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

const [a, b, c] = WORDS
const evidence = (over: Partial<PersonalEvidence> = {}): PersonalEvidence => ({
  stats: {},
  games: { played: 0, won: 0, redeemed: 0, lost: 0 },
  groups: {},
  clues: {},
  wordById,
  ...over,
})

describe('the weighted Home pick', () => {
  // Sixty ordinary lines, one momentum, two personal — the shape of a real
  // Danish pool for a player with some history.
  const kinds: HomeLineKind[] = [
    ...Array.from({ length: 60 }, (): HomeLineKind => 'ordinary'),
    'momentum',
    'personal',
    'personal',
  ]
  const shareOf = (kind: HomeLineKind) => {
    const n = 10000
    let hits = 0
    for (let i = 0; i < n; i++) if (kinds[weightedLineIndex(kinds, () => (i + 0.5) / n)] === kind) hits++
    return hits / n
  }

  it('gives the momentum line its share, far above any one fun fact', () => {
    expect(shareOf('momentum')).toBeCloseTo(HOME_LINE_SHARE.momentum, 2)
    // A single ordinary line gets about half of one percent.
    expect(HOME_LINE_SHARE.momentum).toBeGreaterThan(10 * ((1 - HOME_LINE_SHARE.momentum - HOME_LINE_SHARE.personal) / 60))
  })

  it('gives the personal lines theirs between them', () => {
    expect(shareOf('personal')).toBeCloseTo(HOME_LINE_SHARE.personal, 2)
  })

  it('hands an absent kind’s share back to the ordinary lines', () => {
    const plain: HomeLineKind[] = [...Array.from({ length: 10 }, (): HomeLineKind => 'ordinary'), 'momentum']
    const n = 1000
    let momentum = 0
    for (let i = 0; i < n; i++) if (plain[weightedLineIndex(plain, () => (i + 0.5) / n)] === 'momentum') momentum++
    expect(momentum / n).toBeCloseTo(HOME_LINE_SHARE.momentum, 1)
  })

  it('never repeats the line just read', () => {
    const momentum = kinds.indexOf('momentum')
    for (let i = 0; i < 100; i++) {
      expect(weightedLineIndex(kinds, () => i / 100, momentum)).not.toBe(momentum)
    }
  })

  it('past the intro window, a Home visit uses the weights', () => {
    const veteran = fakeStorage({ 'cluecab-tips-intro': '{"n":99,"d":1}' })
    // A roll inside the momentum slice lands on the momentum line.
    expect(kinds[homeLineIndex(kinds.length, veteran, 753901, () => 0.05, kinds)]).toBe('momentum')
  })
})

describe('Casey’s lines about the player', () => {
  it('says nothing about a new player', () => {
    expect(personalLines(evidence())).toEqual([])
  })

  it('names the weakest word with its meaning', () => {
    const stats: SrsMap = {
      [a!.id]: { ...newStats(0), misses: 4, seen: 5 },
      [b!.id]: { ...newStats(0), misses: 1, seen: 5 },
    }
    const lines = personalLines(evidence({ stats }))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain(a!.da)
    expect(lines[0]).toContain(a!.en[0]!)
    expect(lines[0]).toContain('4×')
  })

  it('names the best-known word, a pair clued together, the favourite clue and the games', () => {
    const stats: SrsMap = { [c!.id]: { ...newStats(0), greenByClue: 2, greenByGuess: 3 } }
    const groups = { k: { ids: [a!.id, b!.id], by: 'player' as const, count: 3, lastAt: 1 } }
    const lines = personalLines(
      evidence({
        stats,
        groups,
        clues: { hav: 5, sol: PERSONAL_MIN.clueUses - 1 },
        games: { played: 9, won: 6, redeemed: 0, lost: 3 },
      }),
    )
    expect(lines.some((l) => l.includes(c!.da) && l.includes('5×'))).toBe(true)
    expect(lines).toContain(UI.casey.personalCluedTogether(a!.da, b!.da, 3))
    expect(lines).toContain(UI.casey.personalFavouriteClue('hav', 5))
    expect(lines).toContain(UI.casey.personalGames(9, 6))
  })

  it('ignores a pair Casey clued, and words from another language', () => {
    const groups = { k: { ids: [a!.id, b!.id], by: 'ai' as const, count: 9, lastAt: 1 } }
    const stats: SrsMap = { 'xx:nope': { ...newStats(0), misses: 9 } }
    expect(personalLines(evidence({ groups, stats }))).toEqual([])
  })
})

describe('the favourite-clue tally', () => {
  it('counts clues per language, case-folded', () => {
    const s = fakeStorage()
    recordPlayerClue('da', 'Hav', s)
    recordPlayerClue('da', ' hav ', s)
    recordPlayerClue('de', 'Meer', s)
    expect(readClueTally('da', s)).toEqual({ hav: 2 })
    expect(readClueTally('de', s)).toEqual({ meer: 1 })
  })

  it('reads anything unreadable as empty, and never throws', () => {
    expect(readClueTally('da', fakeStorage({ [CLUE_TALLY_KEY]: '{not json' }))).toEqual({})
    const throwing = {
      getItem: (): string | null => {
        throw new Error('private mode')
      },
      setItem: (): void => {
        throw new Error('private mode')
      },
    }
    expect(() => recordPlayerClue('da', 'hav', throwing)).not.toThrow()
    expect(readClueTally('da', throwing)).toEqual({})
  })

  it('stays capped', () => {
    const s = fakeStorage()
    for (let i = 0; i < 200; i++) recordPlayerClue('da', `ord${i}`, s)
    expect(Object.keys(readClueTally('da', s)).length).toBeLessThanOrEqual(120)
  })
})
