import { describe, expect, it } from 'vitest'
import { boardKey, claimKey, validateRequiredSet } from './identity'
import { attemptFixture, bestsWorth, cafeSetFixture, FIXTURE_BOARD, FIXTURE_CONTENT, FIXTURE_SET, FIXTURE_TARGETS, MATRIX_FIXTURES, terminalFixture } from './fixtures'
import { cafeStamp, cityMedalFromStamps, cityStamps, cityTier, claimDelta, evaluateAttempt, gameDelta, matchesAuthoredContent, maxTier, medalForPoints, rewardEligibility, savedStamps, STAMP_POINTS, stampPoints, targetUnion, trainTravelStatus, travelStatus } from './rules'
import { emptyProgressFacts } from './facts'
import type { AttemptOrigin, BoardIdentity, ProgressFacts, RewardComponent, Tier } from './types'

describe('C1-PC-1 outcome matrix AC01-AC06', () => {
  it.each(MATRIX_FIXTURES)('$acceptance $id records $tier and +$postcards', ({ game, tier, components, postcards }) => {
    const actual = evaluateAttempt(attemptFixture(game))
    expect(actual).toMatchObject({ status: 'completed', tier, components })
    expect(claimDelta(components, []).postcards).toBe(postcards)
    expect(gameDelta('primary', game.outcome!.result)).toEqual({ played: 1, won: game.outcome!.result === 'won' ? 1 : 0, lost: game.outcome!.result === 'lost' ? 1 : 0, redeemed: 0 })
  })

  it('AC06 counts overlap once, ignores neutrals, and validates both full keys', () => {
    const game = MATRIX_FIXTURES[5].game
    expect(targetUnion(game.words.map((w) => w.wordId), game.playerKey, game.aiKey)).toEqual(FIXTURE_TARGETS)
    expect(targetUnion(['a', 'a'], game.playerKey, game.aiKey)).toBeNull()
    expect(targetUnion(['a'], { a: 'bystander' }, { a: 'bystander' })).toBeNull()
    expect(targetUnion(['a'], { a: 'green', unknown: 'green' }, { a: 'bystander' })).toBeNull()
    expect(targetUnion(['a'], {}, { a: 'green' })).toBeNull()
  })

  it('AC05 free retries and earlier wrong guesses do not demote Platinum', () => {
    const attempt = attemptFixture(MATRIX_FIXTURES[5].game)
    attempt.game.wheel!.attempts = 9
    attempt.game.clueHistory.push({ by: 'ai', text: 'fixture', number: 1, guesses: [{ wordId: 'n', result: 'bystander' }] })
    expect(evaluateAttempt(attempt)).toMatchObject({ status: 'completed', tier: 'platinum' })
  })

  it('F07/F09 empty-found terminal loss is Bronze; zero translation on solved board is Gold', () => {
    expect(evaluateAttempt(attemptFixture(terminalFixture([], [], false, false)))).toMatchObject({ status: 'completed', tier: 'bronze', components: [] })
    expect(evaluateAttempt(attemptFixture(terminalFixture(FIXTURE_TARGETS, [], false)))).toMatchObject({ status: 'completed', tier: 'gold', components: ['solved'] })
  })

  it('F10/F11 waits for actual spin, distinguishes cancellation, and keeps an accepted terminal result', () => {
    const attempt = attemptFixture(MATRIX_FIXTURES[5].game)
    attempt.game.phase = 'translateWheel'
    attempt.game.outcome = undefined
    attempt.game.wheel!.landed = null
    attempt.game.wheel!.result = null
    expect(evaluateAttempt(attempt)).toEqual({ status: 'pending' })
    expect(evaluateAttempt({ ...attempt, cancelled: true })).toEqual({ status: 'cancelled' })
    expect(evaluateAttempt(attemptFixture(MATRIX_FIXTURES[5].game, { cancelled: true }))).toMatchObject({ status: 'completed', tier: 'platinum' })
  })

  it.each(['full-miss', 'empty-win', 'duplicate-translation', 'foreign-translation', 'wrong-segment-order', 'duplicate-fill', 'unspun', 'neutral-green', 'empty-wheel', 'legacy-all-greens'])(
    'fails closed for malformed evidence: %s', (variant) => {
      const attempt = attemptFixture(MATRIX_FIXTURES[5].game)
      const game = attempt.game
      const wheel = game.wheel!
      if (variant === 'full-miss') { wheel.result = 'miss'; game.outcome = { result: 'lost', reason: 'wheel-miss' } }
      if (variant === 'empty-win') { wheel.translated = []; wheel.filled = [] }
      if (variant === 'duplicate-translation') wheel.translated[1] = wheel.translated[0]
      if (variant === 'foreign-translation') wheel.translated[1] = 'n'
      if (variant === 'wrong-segment-order') wheel.segments.reverse()
      if (variant === 'duplicate-fill') wheel.filled[1] = wheel.filled[0]
      if (variant === 'unspun') wheel.landed = null
      if (variant === 'neutral-green') game.reveals.n = { kind: 'green' }
      if (variant === 'empty-wheel') wheel.segments = []
      if (variant === 'legacy-all-greens') { game.wheel = undefined; game.outcome = { result: 'won', reason: 'all-greens' } }
      expect(evaluateAttempt(attempt).status).toBe('invalid')
    },
  )

  it('checks canonical layout/keys, independent of UI glosses or attempt seed', () => {
    const game = structuredClone(MATRIX_FIXTURES[5].game)
    game.seed = 9876
    game.words[0].en = ['another UI gloss']
    expect(matchesAuthoredContent(game, FIXTURE_CONTENT)).toBe(true)
    game.playerKey.a = 'bystander'
    expect(matchesAuthoredContent(game, FIXTURE_CONTENT)).toBe(false)
  })
})

describe('AC07-AC08 replay claims are separate from saved best', () => {
  it.each<{ from: string; held: RewardComponent[]; delta: number }>([
    { from: 'Silver', held: ['spinWin'], delta: 3 },
    { from: 'Gold with win', held: ['spinWin', 'solved'], delta: 2 },
    { from: 'Gold after miss', held: ['solved'], delta: 3 },
    { from: 'Platinum', held: ['spinWin', 'solved', 'solvedAndTranslated'], delta: 0 },
  ])('$from to Platinum gives +$delta', ({ held, delta }) => {
    expect(claimDelta(MATRIX_FIXTURES[5].components, held).postcards).toBe(delta)
  })

  it('F17/F22 separate solve then full unsolved translation never makes Platinum', () => {
    const second = evaluateAttempt(attemptFixture(MATRIX_FIXTURES[2].game))
    expect(second).toMatchObject({ status: 'completed', tier: 'silver', components: ['spinWin'] })
    expect(claimDelta(['spinWin'], ['solved'])).toEqual({ eligible: ['spinWin'], alreadyHeld: [], newlyClaimed: ['spinWin'], postcards: 1 })
    expect(maxTier('gold', 'silver')).toBe('gold')
    expect(maxTier('platinum', 'bronze')).toBe('platinum')
  })

  it('deduplicates claim components and returns only eligible already-held lines', () => {
    expect(claimDelta(['spinWin', 'spinWin'], ['solved', 'spinWin', 'spinWin'])).toEqual({ eligible: ['spinWin'], alreadyHeld: ['spinWin'], newlyClaimed: [], postcards: 0 })
  })
})

describe('eligibility and stable identities AC19', () => {
  it.each<AttemptOrigin>(['daily', 'developer', 'optional', 'tutorial', 'retired-wrapup'])('excludes %s even on a required authored board', (origin) => {
    expect(rewardEligibility(origin, FIXTURE_BOARD, FIXTURE_SET)).toEqual({ eligible: false, reason: 'excluded-origin' })
    expect(gameDelta(origin, 'won').played).toBe(origin === 'tutorial' || origin === 'retired-wrapup' ? 0 : 1)
  })

  it('fails closed for unknown board/course/city/revision and missing/empty manifests', () => {
    expect(rewardEligibility('primary', null, FIXTURE_SET)).toMatchObject({ eligible: false, reason: 'unknown-board' })
    for (const board of [
      { ...FIXTURE_BOARD, authoredBoardId: 'unknown' }, { ...FIXTURE_BOARD, contentRevision: 'new' },
      { ...FIXTURE_BOARD, cityId: 'ribe' }, { ...FIXTURE_BOARD, courseId: 'de' as const },
    ]) expect(rewardEligibility('primary', board, FIXTURE_SET).eligible).toBe(false)
    expect(rewardEligibility('primary', FIXTURE_BOARD, null)).toMatchObject({ eligible: false, reason: 'missing-manifest' })
    expect(rewardEligibility('primary', FIXTURE_BOARD, { ...FIXTURE_SET, boards: [] })).toMatchObject({ eligible: false, reason: 'empty-manifest' })
    expect(validateRequiredSet({ ...FIXTURE_SET, boards: [FIXTURE_BOARD, FIXTURE_BOARD] })).toBe('invalid-manifest')
  })

  it('has collision-safe keys with no UI language, display index, seed or set version', () => {
    const decorated = { ...FIXTURE_BOARD, uiLanguage: 'de', displayNumber: 99, seed: 6789, setVersion: 'display-v2' }
    expect(boardKey(decorated)).toBe(boardKey(FIXTURE_BOARD))
    expect(claimKey(decorated, 'spinWin')).toBe(claimKey(FIXTURE_BOARD, 'spinWin'))
    expect(boardKey({ ...FIXTURE_BOARD, cityId: 'x,y', authoredBoardId: 'z' })).not.toBe(boardKey({ ...FIXTURE_BOARD, cityId: 'x', authoredBoardId: 'y,z' }))
    expect(() => boardKey({ ...FIXTURE_BOARD, contentRevision: '' })).toThrow()
  })
})

describe('city and travel AC17-AC20', () => {
  it('AC17 99 Platinum/grey -> none, final Bronze -> Bronze, all Platinum -> Platinum', () => {
    const required = { ...FIXTURE_SET, boards: Array.from({ length: 100 }, (_, i) => ({ ...FIXTURE_BOARD, authoredBoardId: `fixture-${i}` })) }
    const bests: Record<string, Tier> = Object.fromEntries(required.boards.slice(0, 99).map((board) => [boardKey(board), 'platinum']))
    expect(cityTier(required, bests)).toEqual({ tier: null, error: null })
    bests[boardKey(required.boards[99])] = 'bronze'
    expect(cityTier(required, bests).tier).toBe('bronze')
    bests[boardKey(required.boards[99])] = 'platinum'
    expect(cityTier(required, bests).tier).toBe('platinum')
    expect(cityTier({ ...required, boards: [] }, bests)).toEqual({ tier: null, error: 'empty-manifest' })
    expect(cityTier(null, bests)).toEqual({ tier: null, error: 'missing-manifest' })
  })

  it.each([99, 100, 101])('AC18 readiness at %s never spends; AC20 availability and access still gate', (earned) => {
    const ready = earned >= 100
    expect(travelStatus(earned, 100, false, true, true)).toMatchObject({ earned, thresholdReady: ready, canBoard: ready })
    expect(travelStatus(earned, 100, false, false, true).canBoard).toBe(false)
    expect(travelStatus(earned, 100, false, true, false).canBoard).toBe(false)
    expect(travelStatus(earned, 100, true, false, true)).toMatchObject({ earned, historicalEligibility: true, ready: true, canBoard: false })
  })

  it('rejects malformed amounts instead of manufacturing readiness', () => {
    expect(() => travelStatus(-1, 100, false, true, true)).toThrow()
    expect(() => travelStatus(100, 0, false, true, true)).toThrow()
  })
})

describe('café world CW-03: stamps and the medal percentage', () => {
  it('a stamp is worth 1, 2, 3, 4; no stamp is worth nothing', () => {
    expect(STAMP_POINTS).toEqual({ bronze: 1, silver: 2, gold: 3, platinum: 4 })
    expect(['bronze', 'silver', 'gold', 'platinum'].map((tier) => stampPoints(tier as Tier))).toEqual([1, 2, 3, 4])
    expect(stampPoints(null)).toBe(0)
  })

  it('the stamp card holds one stamp per required café, read from saved bests, out of 4 points each', () => {
    const cafes = cafeSetFixture(3)
    const [first, second, third] = cafes.boards
    const bests: Record<string, Tier> = { [boardKey(first!)]: 'gold', [boardKey(third!)]: 'bronze', [boardKey({ ...first!, authoredBoardId: 'not-a-cafe' })]: 'platinum' }
    const card = cityStamps(cafes, bests)
    expect(card).toMatchObject({ cafes: 3, stamped: 2, points: 4, maximum: 12, error: null })
    expect(card.stamps).toEqual({ [boardKey(first!)]: 'gold', [boardKey(second!)]: null, [boardKey(third!)]: 'bronze' })
    expect(card.percent).toBeCloseTo(100 / 3, 10)
    // Display order and optional inventory do not change the card.
    const reordered = { ...cafes, boards: [...cafes.boards].reverse(), optionalBoards: [{ ...first!, authoredBoardId: 'optional' }] }
    expect(cityStamps(reordered, bests)).toMatchObject({ points: 4, maximum: 12, stamped: 2 })
  })

  it.each<{ points: number; maximum: number; percent: number; tier: Tier | null }>([
    { points: 0, maximum: 1000, percent: 0, tier: null },
    { points: 249, maximum: 1000, percent: 24.9, tier: null },
    { points: 250, maximum: 1000, percent: 25, tier: 'bronze' },
    { points: 499, maximum: 1000, percent: 49.9, tier: 'bronze' },
    { points: 500, maximum: 1000, percent: 50, tier: 'silver' },
    { points: 749, maximum: 1000, percent: 74.9, tier: 'silver' },
    { points: 750, maximum: 1000, percent: 75, tier: 'gold' },
    { points: 999, maximum: 1000, percent: 99.9, tier: 'gold' },
    { points: 1000, maximum: 1000, percent: 100, tier: 'platinum' },
    { points: 1, maximum: 4, percent: 25, tier: 'bronze' },
    { points: 3, maximum: 4, percent: 75, tier: 'gold' },
    { points: 396, maximum: 400, percent: 99, tier: 'gold' },
  ])('$points of $maximum points ($percent%) is $tier', ({ points, maximum, percent, tier }) => {
    expect(medalForPoints(points, maximum)).toBe(tier)
    // The same edge through a real stamp card: a city of maximum/4 cafés.
    const cafes = cafeSetFixture(maximum / 4)
    const medal = cityMedalFromStamps(cafes, bestsWorth(cafes, points))
    expect(medal).toMatchObject({ tier, points, maximum, error: null })
    expect(medal.percent).toBeCloseTo(percent, 10)
  })

  it('zero stamps is 0% and no medal; a city without required cafés has no card', () => {
    const cafes = cafeSetFixture(100)
    expect(cityMedalFromStamps(cafes, {})).toMatchObject({ tier: null, stamped: 0, points: 0, maximum: 400, percent: 0, error: null })
    expect(cityMedalFromStamps({ ...cafes, boards: [] }, {})).toMatchObject({ tier: null, cafes: 0, points: 0, maximum: 0, percent: 0, error: 'empty-manifest' })
    expect(cityMedalFromStamps(null, {})).toMatchObject({ tier: null, maximum: 0, percent: 0, error: 'missing-manifest' })
    expect(() => medalForPoints(0, 0)).toThrow()
    expect(() => medalForPoints(5, 4)).toThrow()
    expect(() => medalForPoints(-1, 4)).toThrow()
    expect(() => medalForPoints(1.5, 4)).toThrow()
  })

  it('the medal is the percentage, not the lowest stamp: 99 Platinum cafés of 100 is Gold', () => {
    const cafes = cafeSetFixture(100)
    const bests = bestsWorth(cafes, 99 * 4)
    expect(cityTier(cafes, bests).tier).toBeNull()
    expect(cityMedalFromStamps(cafes, bests)).toMatchObject({ tier: 'gold', stamped: 99, percent: 99 })
    bests[boardKey(cafes.boards[99]!)] = 'bronze'
    expect(cityTier(cafes, bests).tier).toBe('bronze')
    expect(cityMedalFromStamps(cafes, bests)).toMatchObject({ tier: 'gold', stamped: 100, points: 397 })
  })

  it('CW-03b a completed loss earns Bronze; a loss never lowers a better stamp; a win raises Bronze', () => {
    // A lost round, whatever tier the attempt reached, is a Bronze stamp.
    expect(cafeStamp(null, true)).toBe('bronze')
    expect(cafeStamp(undefined, true)).toBe('bronze')
    expect(cafeStamp(null, false)).toBeNull()
    // A loss after Silver (or better) keeps the better stamp.
    for (const won of ['silver', 'gold', 'platinum'] as const) {
      expect(cafeStamp(won, true)).toBe(won)
      expect(cafeStamp(won, false)).toBe(won)
    }
    // A win after Bronze raises it: a won best is always Silver or above.
    expect(cafeStamp('silver', true)).toBe('silver')
    // Old (C1-PC-1) saves may hold a Bronze best; it stays Bronze.
    expect(cafeStamp('bronze', false)).toBe('bronze')
    // Evaluation still says a solved-but-lost round reached Gold; that tier
    // never becomes the stamp (settlement writes no best for a loss).
    expect(evaluateAttempt(attemptFixture(MATRIX_FIXTURES[3].game))).toMatchObject({ status: 'completed', tier: 'gold', completedLoss: true, outcome: 'lost' })
  })

  it('CW-03b old facts with only completed losses show Bronze, and the percentage counts them (1 point each)', () => {
    const cafes = cafeSetFixture(4)
    const [a, b, c, d] = [0, 1, 2, 3].map((i) => cafes.boards[i]!) as [BoardIdentity, BoardIdentity, BoardIdentity, BoardIdentity]
    const loss = (board: BoardIdentity, firstPrimary = true) => ({ [boardKey(board)]: { board, firstPrimary } })
    // A save written before the rule: no bests at all, two cafés only ever lost.
    const old: ProgressFacts = { ...emptyProgressFacts(), completedLosses: { ...loss(a), ...loss(b, false) } }
    expect(savedStamps(old)).toEqual({ [boardKey(a)]: 'bronze', [boardKey(b)]: 'bronze' })
    expect(cityMedalFromStamps(cafes, savedStamps(old))).toMatchObject({ tier: null, stamped: 2, points: 2, maximum: 16, percent: 12.5 })
    // Add a Silver café that was also lost later (keeps Silver) and a fourth only lost.
    const mixed: ProgressFacts = { ...old,
      boards: { [boardKey(c)]: { board: c, best: 'silver', claims: ['spinWin'] } },
      completedLosses: { ...old.completedLosses, ...loss(c, false), ...loss(d) } }
    expect(savedStamps(mixed)).toEqual({ [boardKey(a)]: 'bronze', [boardKey(b)]: 'bronze', [boardKey(c)]: 'silver', [boardKey(d)]: 'bronze' })
    // 1 + 1 + 2 + 1 = 5 of 16 points is 31.25%: Bronze. Without the lost cafés it would be 12.5%, no medal.
    expect(cityMedalFromStamps(cafes, savedStamps(mixed))).toMatchObject({ tier: 'bronze', stamped: 4, points: 5, maximum: 16, percent: 31.25 })
    expect(cityMedalFromStamps(cafes, { [boardKey(c)]: 'silver' })).toMatchObject({ tier: null, points: 2 })
    // The stored city achievement's rule (lowest saved best) does not read losses.
    const bests = Object.fromEntries(Object.entries(mixed.boards).map(([key, progress]) => [key, progress.best]))
    expect(cityTier(cafes, bests).tier).toBeNull()
  })

  it('the train run is the only way onto the train; it grants neither destination nor access', () => {
    expect(trainTravelStatus(false, true, true)).toEqual({ trainRunPassed: false, ready: false, canBoard: false })
    expect(trainTravelStatus(true, true, true)).toEqual({ trainRunPassed: true, ready: true, canBoard: true })
    expect(trainTravelStatus(true, false, true).canBoard).toBe(false)
    expect(trainTravelStatus(true, true, false).canBoard).toBe(false)
  })
})
