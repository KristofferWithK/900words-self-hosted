import { describe, expect, it } from 'vitest'
import { boardKey, claimKey, validateRequiredSet } from './identity'
import { attemptFixture, FIXTURE_BOARD, FIXTURE_CONTENT, FIXTURE_SET, FIXTURE_TARGETS, MATRIX_FIXTURES, terminalFixture } from './fixtures'
import { cityTier, claimDelta, evaluateAttempt, gameDelta, matchesAuthoredContent, maxTier, rewardEligibility, targetUnion, travelStatus } from './rules'
import type { AttemptOrigin, RewardComponent, Tier } from './types'

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
