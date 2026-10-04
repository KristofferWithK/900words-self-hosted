import { describe, expect, it } from 'vitest'
import { WORDS, curriculumRank, wordById } from '../data/words'
import { CITY1_BOARD_CYCLE } from '../data/city1BoardCycle'
import replacementCorpus from '../data/city1-replacement-corpus.da.json'
import type { WordEntry } from '../data/types'
import { emptyProgressFacts } from '../progression/facts'
import { boardKey, cityKey } from '../progression/identity'
import type { BoardIdentity, ProgressFacts, Tier } from '../progression/types'
import { CITY1_REQUIRED_SET } from '../session/courseRuntime'
import { applyRoundResults, newStats } from '../srs/scheduler'
import type { SrsMap, WordStats } from '../srs/types'
import { CITIES, WORDS_PER_CITY } from './cities'
import {
  WRAP_TO_TRAVEL,
  canTravel,
  cityMedal,
  cityPostcards,
  cityStampCard,
  cityTrainReadiness,
  cityTravelReadiness,
  hasPassedTrainRun,
  cityBand,
  countCollection,
  countWrapped,
  hasHistoricalTravelEligibility,
  isCollected,
  isJourneyComplete,
  journeyRank,
  postcardsToTravel,
  unlockedWords,
  wordState,
  wordsForCity,
} from './progress'

const NOW = 1_700_000_000_000
const stats = (over: Partial<WordStats> = {}): WordStats => ({ ...newStats(NOW), ...over })

const srsWith = (words: readonly WordEntry[], over: Partial<WordStats>): SrsMap =>
  Object.fromEntries(words.map((w) => [w.id, stats(over)]))

/** A word that has earned its green each way. */
const COLLECTED: Partial<WordStats> = { greenByClue: 1, greenByGuess: 1 }

const CITY1 = { courseId: 'da', cityId: 'sonderborg' } as const
const RIBE = { courseId: 'da', cityId: 'ribe' } as const

function factsWithBoards(
  entries: readonly { board: BoardIdentity; best: Tier; claims: ProgressFacts['boards'][string]['claims'] }[],
  legacyCredit = 0,
): ProgressFacts {
  return {
    ...emptyProgressFacts(),
    boards: Object.fromEntries(entries.map((entry) => [boardKey(entry.board), entry])),
    legacyCredit: { identity: 'danish-city1-legacy-v1', amount: legacyCredit },
  }
}

describe('city bands', () => {
  it('cover the dataset exactly once, 100 words per city', () => {
    const seen = new Set<string>()
    for (let c = 0; c < CITIES.length; c++) {
      const words = wordsForCity(WORDS, c)
      expect(words.length).toBe(WORDS_PER_CITY)
      for (const w of words) {
        expect(seen.has(w.id)).toBe(false)
        seen.add(w.id)
      }
    }
    expect(seen.size).toBe(WORDS.length)
  })

  it('band ranges are contiguous and ordered', () => {
    expect(cityBand(0)).toEqual([1, 100])
    // cityBand is pure arithmetic and will answer for a stop that does not
    // exist, so the last one is asked for by name — otherwise this line went
    // on cheerfully describing a tenth city after the tenth city was gone.
    expect(cityBand(CITIES.length - 1)).toEqual([801, 900])
    for (let c = 1; c < CITIES.length; c++) {
      expect(cityBand(c)[0]).toBe(cityBand(c - 1)[1] + 1)
    }
  })
})

/**
 * THE ROSTER (owner, 2026-09-11). City 1 is the hundred words the authored
 * boards were built on, not curriculumRank 1–100 — the two shared 24 words,
 * and a suitcase counting the rank band could hold 24 of the words the
 * boards taught. Pinned against the bank itself: whatever the cycle deals,
 * the suitcase must be able to pack.
 */
describe('City 1 is the authored roster', () => {
  const roster = replacementCorpus.wordIds as string[]
  const city1 = wordsForCity(WORDS, 0)

  it('holds exactly the roster, in roster order', () => {
    expect(city1.map((w) => w.id)).toEqual(roster)
  })

  it('every word on every authored board is a City 1 word', () => {
    const ids = new Set(city1.map((w) => w.id))
    for (const board of CITY1_BOARD_CYCLE) {
      for (const id of board.wordIds) expect(ids.has(id)).toBe(true)
    }
  })

  it('the words the roster displaced keep their teaching order in the next bands', () => {
    // bord, seng and æble were ranks 7, 8 and 10 and are not on the roster;
    // they lead Ribe now, still in that order, and nothing is lost.
    const ribe = wordsForCity(WORDS, 1).map((w) => w.id)
    expect(ribe.slice(0, 3)).toEqual(['da:bord', 'da:seng', 'da:æble'])
    const rest = WORDS.filter((w) => !roster.includes(w.id)).sort(
      (a, b) => curriculumRank(a) - curriculumRank(b),
    )
    expect(rest.map((w) => journeyRank(WORDS, w))).toEqual(rest.map((_, i) => 101 + i))
  })

  it('a word list without the roster in it slices by curriculumRank alone', () => {
    // Fake and partial datasets — the seam's, a test's — must not be
    // rearranged by a roster written for the real one.
    const fake = WORDS.filter((w) => !roster.includes(w.id)).slice(0, 20)
    expect(wordsForCity(fake, 0).map((w) => w.id)).toEqual(
      [...fake].sort((a, b) => curriculumRank(a) - curriculumRank(b)).map((w) => w.id),
    )
    expect(journeyRank(fake, fake[0]!)).toBeLessThanOrEqual(20)
  })

  it('the historical rank band is the data, not the city', () => {
    // The field survives untouched — the curriculum projection is frozen
    // against it — while the journey reads the roster.
    expect(curriculumRank(wordById('da:bord')!)).toBe(7)
    expect(curriculumRank(wordById('da:land')!)).toBe(153)
    expect(journeyRank(WORDS, wordById('da:land')!)).toBeLessThanOrEqual(100)
  })
})

describe('unlockedWords', () => {
  it('grows by exactly one band per city and never leaks locked words', () => {
    for (let c = 0; c < CITIES.length; c++) {
      const pool = unlockedWords(WORDS, c)
      expect(pool.length).toBe((c + 1) * WORDS_PER_CITY)
      // Cities slice the JOURNEY order, which is the teaching order with
      // City 1's authored roster pulled out in front.
      expect(Math.max(...pool.map((w) => journeyRank(WORDS, w)))).toBe((c + 1) * WORDS_PER_CITY)
    }
  })
})

describe('the four collection states', () => {
  const cases: [WordStats | undefined, boolean, string, string][] = [
    [undefined, false, 'undiscovered', 'never met'],
    [stats(), false, 'discovered', 'seen but never green'],
    [stats({ greenByClue: 2 }), false, 'discovered', 'clued twice, never guessed'],
    [stats({ greenByGuess: 2 }), false, 'discovered', 'guessed twice, never clued'],
    [stats({ correctGuesses: 9 }), false, 'discovered', 'greens alone do not collect'],
    [stats(COLLECTED), false, 'collected', 'one green each way'],
    [stats({ ...COLLECTED, misses: 9 }), false, 'collected', 'misses cannot uncollect'],
    [stats(), true, 'wrapped', 'the ledger outranks the counters'],
    [undefined, true, 'wrapped', 'wrapped even with no stats'],
  ]
  it.each(cases)('%#: %s', (s, wrapped, expected) => {
    expect(wordState(s, wrapped)).toBe(expected)
  })

  it('isCollected is collected-or-better', () => {
    expect(isCollected(stats(COLLECTED), false)).toBe(true)
    expect(isCollected(stats(), true)).toBe(true)
    expect(isCollected(stats({ greenByClue: 3 }), false)).toBe(false)
    expect(isCollected(undefined, false)).toBe(false)
  })

  it('never regresses across many rounds of real SRS updates', () => {
    const order = ['undiscovered', 'discovered', 'collected', 'wrapped']
    let srs: SrsMap = {}
    let best = 0
    for (let round = 0; round < 50; round++) {
      srs = applyRoundResults(
        srs,
        [
          {
            wordId: 'w',
            guessedGreen: round % 3 !== 0,
            guessedWrong: round % 3 === 0,
            greenByOwnClue: round % 2 === 0 && round % 3 !== 0,
            greenByOwnGuess: round % 2 !== 0 && round % 3 !== 0,
            lookedUp: false,
          },
        ],
        NOW + round * 1000,
      )
      const now = order.indexOf(wordState(srs.w, false))
      expect(now).toBeGreaterThanOrEqual(best)
      best = now
    }
    expect(best).toBe(order.indexOf('collected'))
  })

  it('counts split cleanly and always sum to the whole', () => {
    const city = wordsForCity(WORDS, 0)
    const srs = {
      ...srsWith(city.slice(0, 10), COLLECTED),
      ...srsWith(city.slice(10, 35), { greenByGuess: 1 }),
    }
    const wrapped = Object.fromEntries(city.slice(90, 95).map((w) => [w.id, NOW]))
    const counts = countCollection(city, srs, wrapped)
    expect(counts.collected).toBe(10)
    expect(counts.wrapped).toBe(5)
    expect(counts.discovered).toBe(25)
    expect(counts.undiscovered).toBe(60)
    expect(
      counts.collected + counts.wrapped + counts.discovered + counts.undiscovered,
    ).toBe(counts.total)
  })

  it('a collected word that gets wrapped counts once, as wrapped', () => {
    const city = wordsForCity(WORDS, 0)
    const srs = srsWith(city.slice(0, 3), COLLECTED)
    const wrapped = { [city[0]!.id]: NOW }
    const counts = countCollection(city.slice(0, 3), srs, wrapped)
    expect(counts).toMatchObject({ wrapped: 1, collected: 2, total: 3 })
  })
})

describe('wrapping and travel', () => {
  const city = wordsForCity(WORDS, 0)
  const wrappedOf = (n: number) => Object.fromEntries(city.slice(0, n).map((w) => [w.id, NOW]))

  it('the road opens at exactly WRAP_TO_TRAVEL wrapped words, not one sooner', () => {
    expect(canTravel(WORDS, wrappedOf(WRAP_TO_TRAVEL - 1), 0)).toBe(false)
    expect(canTravel(WORDS, wrappedOf(WRAP_TO_TRAVEL), 0)).toBe(true)
  })

  it('counts only the city in question', () => {
    // A packed Sønderborg says nothing about Ribe.
    expect(canTravel(WORDS, wrappedOf(WRAP_TO_TRAVEL), 1)).toBe(false)
    expect(countWrapped(wordsForCity(WORDS, 1), wrappedOf(WRAP_TO_TRAVEL))).toBe(0)
  })

  it('the journey completes only after the final city packs its suitcase', () => {
    const last = CITIES.length - 1
    const lastCity = wordsForCity(WORDS, last)
    const wrapped = Object.fromEntries(lastCity.map((w) => [w.id, NOW]))
    expect(isJourneyComplete(WORDS, {}, last)).toBe(false)
    expect(isJourneyComplete(WORDS, wrapped, last)).toBe(true)
    expect(isJourneyComplete(WORDS, wrapped, last - 1)).toBe(false)
  })
})

describe('C1-10 postcard readiness (kept) and the café-world medal (CW-03)', () => {
  // Successor of AC17 (2026-10-04, docs/roadmap/cafe-world.md section 4): the
  // city medal is the percentage of stamp points, no longer the lowest best.
  // 99 Platinum cafés of 100 used to be no medal; they are 99% and Gold.
  it('CW-03 uses the real frozen manifest: 99 Platinum is 99% Gold, a Bronze hundredth stays Gold, all Platinum is 100% Platinum', () => {
    const first99 = CITY1_REQUIRED_SET.boards.slice(0, 99).map((board) => ({
      board,
      best: 'platinum' as const,
      claims: [] as const,
    }))
    expect(CITY1_REQUIRED_SET.boards).toHaveLength(100)
    const grey = factsWithBoards(first99)
    expect(cityMedal(grey, CITY1_REQUIRED_SET)).toMatchObject({ tier: 'gold', stamped: 99, cafes: 100, points: 396, maximum: 400, percent: 99, error: null })
    expect(cityStampCard(grey, CITY1_REQUIRED_SET).stamps[boardKey(CITY1_REQUIRED_SET.boards[99]!)]).toBeNull()

    const bronze = factsWithBoards([
      ...first99,
      { board: CITY1_REQUIRED_SET.boards[99]!, best: 'bronze', claims: [] },
    ])
    expect(cityMedal(bronze, CITY1_REQUIRED_SET)).toMatchObject({ tier: 'gold', stamped: 100, points: 397, percent: 99.25, error: null })

    const platinum = factsWithBoards([
      ...first99,
      { board: CITY1_REQUIRED_SET.boards[99]!, best: 'platinum', claims: [] },
    ])
    expect(cityMedal(platinum, CITY1_REQUIRED_SET)).toMatchObject({ tier: 'platinum', points: 400, maximum: 400, percent: 100, error: null })
    // The medal does not travel: a 100% Platinum city with no train run is not
    // ready, because the run (not built) is the only way onto the train.
    expect(cityTrainReadiness({}, CITY1, { destinationAvailable: true, accessAllowed: true })).toEqual({ trainRunPassed: false, ready: false, canBoard: false })
    expect(cityMedal(platinum, { ...CITY1_REQUIRED_SET, boards: [] })).toMatchObject({ tier: null, maximum: 0, percent: 0, error: 'empty-manifest' })
    expect(cityMedal(emptyProgressFacts(), CITY1_REQUIRED_SET)).toMatchObject({ tier: null, stamped: 0, points: 0, percent: 0, error: null })
  })

  it("CW-03 a train run is city-specific: only this city's passed run opens the train, and never destination or access", () => {
    const open = { destinationAvailable: true, accessAllowed: true }
    const run = { at: 1, words: 147, photos: 147, slips: 0, allowed: 1 }
    const passedHere = { [cityKey(CITY1)]: { city: CITY1, passed: true, ...run } }
    const failedHere = { [cityKey(CITY1)]: { city: CITY1, passed: false, ...run } }
    const passedRibe = { [cityKey(RIBE)]: { city: RIBE, passed: true, ...run } }
    // Keyed for Sønderborg but naming Ribe: a mismatched entry proves nothing.
    const misfiled = { [cityKey(CITY1)]: { city: RIBE, passed: true, ...run } }
    expect(hasPassedTrainRun(passedHere, CITY1)).toBe(true)
    expect(hasPassedTrainRun(passedHere, RIBE)).toBe(false)
    expect(hasPassedTrainRun(failedHere, CITY1)).toBe(false)
    expect(hasPassedTrainRun(passedRibe, CITY1)).toBe(false)
    expect(hasPassedTrainRun(misfiled, CITY1)).toBe(false)
    expect(cityTrainReadiness(passedHere, CITY1, open)).toEqual({ trainRunPassed: true, ready: true, canBoard: true })
    expect(cityTrainReadiness(passedRibe, CITY1, open).ready).toBe(false)
    expect(cityTrainReadiness({ ...passedHere, ...passedRibe }, RIBE, open).ready).toBe(true)
    expect(cityTrainReadiness(passedHere, CITY1, { destinationAvailable: false, accessAllowed: true }).canBoard).toBe(false)
    expect(cityTrainReadiness(passedHere, CITY1, { destinationAvailable: true, accessAllowed: false }).canBoard).toBe(false)
  })

  it('CW-03 the first stamps: one Platinum café of 100 is 1%, 25 are Bronze, and a café only ever lost is Bronze (CW-03b)', () => {
    const cafes = CITY1_REQUIRED_SET.boards
    const one = factsWithBoards([{ board: cafes[0]!, best: 'platinum', claims: [] }])
    expect(cityMedal(one, CITY1_REQUIRED_SET)).toMatchObject({ tier: null, stamped: 1, points: 4, percent: 1 })
    const twentyFive = factsWithBoards(cafes.slice(0, 25).map((board) => ({ board, best: 'platinum' as const, claims: [] as const })))
    expect(cityMedal(twentyFive, CITY1_REQUIRED_SET)).toMatchObject({ tier: 'bronze', stamped: 25, points: 100, percent: 25 })
    // An old save's completed loss shows Bronze, as it is: nothing is migrated.
    const lostOnly: ProgressFacts = { ...emptyProgressFacts(), completedLosses: { [boardKey(cafes[0]!)]: { board: cafes[0]!, firstPrimary: true } } }
    expect(cityStampCard(lostOnly, CITY1_REQUIRED_SET)).toMatchObject({ stamped: 1, points: 1 })
    expect(cityStampCard(lostOnly, CITY1_REQUIRED_SET).stamps[boardKey(cafes[0]!)]).toBe('bronze')
    // 100 cafés only ever lost is 25%: the Bronze medal, as Home, the map and the card read it.
    const allLost: ProgressFacts = { ...emptyProgressFacts(), completedLosses: Object.fromEntries(cafes.map((board) => [boardKey(board), { board, firstPrimary: true }])) }
    expect(cityMedal(allLost, CITY1_REQUIRED_SET)).toMatchObject({ tier: 'bronze', stamped: 100, points: 100, percent: 25 })
    // A loss on a Platinum café keeps Platinum.
    const lostOnPlatinum: ProgressFacts = { ...one, completedLosses: { [boardKey(cafes[0]!)]: { board: cafes[0]!, firstPrimary: false } } }
    expect(cityMedal(lostOnPlatinum, CITY1_REQUIRED_SET)).toMatchObject({ stamped: 1, points: 4 })
  })

  it('AC18 synthetic threshold-1 / exact / +1 fixtures are cumulative and never mutate earned facts', () => {
    const threshold = 100
    for (const earned of [threshold - 1, threshold, threshold + 1]) {
      const facts = factsWithBoards([], earned)
      const before = structuredClone(facts)
      const status = cityTravelReadiness(facts, CITY1, {
        threshold,
        historicalEligibility: false,
        destinationAvailable: true,
        accessAllowed: true,
      })
      expect(status).toMatchObject({
        earned,
        remaining: Math.max(0, threshold - earned),
        thresholdReady: earned >= threshold,
        canBoard: earned >= threshold,
      })
      expect(postcardsToTravel(facts, CITY1, threshold)).toBe(Math.max(0, threshold - earned))
      expect(facts).toEqual(before)
    }
  })

  it('AC19 keeps component claims and legacy high-water credit in their own course/city', () => {
    const city1Board = CITY1_REQUIRED_SET.boards[0]!
    const ribeBoard: BoardIdentity = {
      courseId: 'da', cityId: 'ribe', authoredBoardId: 'ribe-fixture', contentRevision: '1',
    }
    const germanBoard: BoardIdentity = {
      courseId: 'de', cityId: 'sonderborg', authoredBoardId: 'de-fixture', contentRevision: '1',
    }
    const facts = factsWithBoards([
      { board: city1Board, best: 'platinum', claims: ['spinWin', 'solved', 'solvedAndTranslated'] },
      { board: ribeBoard, best: 'silver', claims: ['spinWin'] },
      { board: germanBoard, best: 'platinum', claims: ['spinWin', 'solved', 'solvedAndTranslated'] },
    ], 7)

    expect(cityPostcards(facts, CITY1)).toBe(11)
    expect(cityPostcards(facts, RIBE)).toBe(1)
    expect(cityPostcards(facts, { courseId: 'de', cityId: 'sonderborg' })).toBe(4)
    expect(cityTravelReadiness(facts, RIBE, {
      threshold: 2, historicalEligibility: false, destinationAvailable: true, accessAllowed: true,
    }).canBoard).toBe(false)
  })

  it('AC20 preserves a named historical fact as readiness without turning it into postcards or access', () => {
    const facts = emptyProgressFacts()
    const history = { '["da","sonderborg"]': true } as const
    expect(hasHistoricalTravelEligibility(history, CITY1)).toBe(true)
    expect(hasHistoricalTravelEligibility(history, RIBE)).toBe(false)
    expect(cityTravelReadiness(facts, CITY1, {
      historicalEligibility: true,
      destinationAvailable: false,
      accessAllowed: true,
    })).toMatchObject({ earned: 0, historicalEligibility: true, ready: true, canBoard: false })
    expect(cityPostcards(facts, CITY1)).toBe(0)
  })
})

describe('cities data', () => {
  it('has unique ids and plausible coordinates', () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length)
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(54.5)
      expect(c.lat).toBeLessThan(58)
      expect(c.lon).toBeGreaterThan(8)
      expect(c.lon).toBeLessThan(13)
      expect(c.blurbTarget.length).toBeGreaterThan(10)
    }
  })

  it('starts in the far south and ends in the capital', () => {
    expect(CITIES[0]!.name).toBe('Sønderborg')
    expect(CITIES[CITIES.length - 1]!.name).toBe('København')
    expect(Math.min(...CITIES.map((c) => c.lat))).toBe(CITIES[0]!.lat)
  })
})
