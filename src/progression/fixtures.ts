/** Synthetic C1-PC-1 fixtures shared by engine, store, UI and QA tests. */
import type { GameState } from '../engine/types'
import type { AttemptEvidence, AuthoredBoardContent, BoardIdentity, LearningEffect, RequiredBoardSet, RewardComponent, Tier } from './types'
import type { SettlementInput } from './settlement'
import { createPrimaryContinuation, emptyProgressFacts } from './facts'
import { emptySettlementLedger, prepareSettlement } from './settlement'
import { prepareLearning } from '../srs/settlement'
import type { CompletionReceipt, CourseSessions, SettlementLedger } from './types'

export const FIXTURE_BOARD: BoardIdentity = { courseId: 'da', cityId: 'sonderborg', authoredBoardId: 'fixture-a', contentRevision: 'fixture-v1' }
export const FIXTURE_WORDS = ['a', 'b', 'c', 'd', 'e', 'n']
export const FIXTURE_TARGETS = FIXTURE_WORDS.slice(0, 5)
export const FIXTURE_CONTENT: AuthoredBoardContent = { board: FIXTURE_BOARD, wordIds: FIXTURE_WORDS, playerGreenIds: ['a', 'b', 'c'], aiGreenIds: ['c', 'd', 'e'] }
export const FIXTURE_SET: RequiredBoardSet = { courseId: 'da', cityId: 'sonderborg', setVersion: 'fixture-set-v1', boards: [FIXTURE_BOARD] }
export const EMPTY_LEARNING: LearningEffect = { results: [], changes: [], newlyCollected: [], newlyDiscovered: [] }

export function terminalFixture(found: readonly string[], translated: readonly string[], won: boolean, spin = true): GameState {
  const segments = FIXTURE_TARGETS.filter((id) => found.includes(id))
  const filled = translated.map((_, i) => i)
  return {
    config: { rows: 2, cols: 3, totalWords: 6, greensPerSide: 3, greenOverlap: 1, turnTokens: 3, maxNewWordsPerBoard: 6 },
    seed: 1234,
    words: FIXTURE_WORDS.map((wordId) => ({ wordId, da: wordId, en: [wordId], pos: 'noun' })),
    playerKey: Object.fromEntries(FIXTURE_WORDS.map((id) => [id, ['a', 'b', 'c'].includes(id) ? 'green' : 'bystander'])),
    aiKey: Object.fromEntries(FIXTURE_WORDS.map((id) => [id, ['c', 'd', 'e'].includes(id) ? 'green' : 'bystander'])),
    reveals: Object.fromEntries(FIXTURE_WORDS.map((id) => [id, { kind: found.includes(id) ? 'green' : 'hidden' }])),
    phase: 'finished', turnsLeft: 0, clueHistory: [],
    outcome: won ? { result: 'won', reason: 'wheel-win' } : { result: 'lost', reason: spin ? 'wheel-miss' : 'sudden-death' },
    ...(spin ? { wheel: { segments, translated: [...translated], filled, attempts: 0, landed: won ? 0 : translated.length, result: won ? 'win' as const : 'miss' as const, spent: null } } : {}),
  }
}

export const MATRIX_FIXTURES: readonly { id: string; acceptance: string; game: GameState; tier: Tier; components: readonly RewardComponent[]; postcards: number }[] = [
  { id: 'F01/R1', acceptance: 'AC01', game: terminalFixture(['a', 'b'], ['a'], false), tier: 'bronze', components: [], postcards: 0 },
  { id: 'F02/R2', acceptance: 'AC02', game: terminalFixture(['a', 'b'], ['a'], true), tier: 'silver', components: ['spinWin'], postcards: 1 },
  { id: 'F03/R3', acceptance: 'AC02', game: terminalFixture(['a', 'b'], ['a', 'b'], true), tier: 'silver', components: ['spinWin'], postcards: 1 },
  { id: 'F04/R4', acceptance: 'AC03', game: terminalFixture(FIXTURE_TARGETS, ['a', 'b'], false), tier: 'gold', components: ['solved'], postcards: 1 },
  { id: 'F05/R5', acceptance: 'AC04', game: terminalFixture(FIXTURE_TARGETS, ['a', 'b'], true), tier: 'gold', components: ['spinWin', 'solved'], postcards: 2 },
  { id: 'F06/R6', acceptance: 'AC05', game: terminalFixture(FIXTURE_TARGETS, FIXTURE_TARGETS, true), tier: 'platinum', components: ['spinWin', 'solved', 'solvedAndTranslated'], postcards: 4 },
]

export function attemptFixture(game: GameState, changes: Partial<AttemptEvidence> = {}): AttemptEvidence {
  return { attemptId: 'fixture-attempt-1', board: FIXTURE_BOARD, origin: 'primary', game: structuredClone(game), ...changes }
}

export function settlementFixture(game = MATRIX_FIXTURES[5].game, changes: Partial<SettlementInput> = {}): SettlementInput {
  return {
    attempt: attemptFixture(game), required: FIXTURE_SET, acceptedAt: 1_789_776_000_000, localDate: '2026-09-19', learning: EMPTY_LEARNING,
    continuation: createPrimaryContinuation(FIXTURE_SET, emptyProgressFacts()), authoredContent: FIXTURE_CONTENT, ...changes,
  }
}

/** Named playtest scenarios. Losses retain Bronze as the presentation tier;
 * settlement applies G1 A1's separate completed-loss fact. */
export const PLAYTEST_FIXTURES = {
  firstPlatinum: attemptFixture(MATRIX_FIXTURES[5].game, { attemptId: 'playtest-first-platinum' }),
  firstGold: attemptFixture(MATRIX_FIXTURES[4].game, { attemptId: 'playtest-first-gold' }),
  firstSilver: attemptFixture(MATRIX_FIXTURES[2].game, { attemptId: 'playtest-first-silver' }),
  /** G1 A1: solved board, spin miss is an unranked completed loss. */
  solvedMiss: attemptFixture(MATRIX_FIXTURES[3].game, { attemptId: 'playtest-solved-miss' }),
  /** G1 A1: no target found and no wheel is an unranked completed loss. */
  zeroFoundLoss: attemptFixture(terminalFixture([], [], false, false), { attemptId: 'playtest-zero-found-loss' }),
  goldToPlatinum: [
    attemptFixture(MATRIX_FIXTURES[4].game, { attemptId: 'playtest-gold' }),
    attemptFixture(MATRIX_FIXTURES[5].game, { attemptId: 'playtest-gold-to-platinum', origin: 'replay' }),
  ] as const,
  repeatedPlatinum: attemptFixture(MATRIX_FIXTURES[5].game, { attemptId: 'playtest-repeated-platinum', origin: 'replay' }),
  losingReplay: attemptFixture(terminalFixture([], [], false, false), { attemptId: 'playtest-losing-replay', origin: 'replay' }),
  emptyReview: EMPTY_LEARNING,
  oneTimePracticeReward: attemptFixture(MATRIX_FIXTURES[5].game, { attemptId: 'playtest-practice-reward', origin: 'tutorial' }),
} as const

/** An unfinished primary is intentionally retained underneath a replay slot. */
export const UNFINISHED_PRIMARY_BENEATH_REPLAY: CourseSessions = {
  continuation: createPrimaryContinuation(FIXTURE_SET, emptyProgressFacts()),
  primary: {
    attemptId: 'playtest-unfinished-primary', board: FIXTURE_BOARD, origin: 'primary', promptLanguage: 'en',
    game: structuredClone({ ...MATRIX_FIXTURES[5].game, phase: 'aiClueInput', outcome: undefined, wheel: undefined }),
    lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1',
  },
  replay: {
    attemptId: 'playtest-replay-slot', board: FIXTURE_BOARD, origin: 'replay', promptLanguage: 'en',
    game: structuredClone(MATRIX_FIXTURES[0].game), lookedUp: [], reviewRoundId: null, randomnessPolicy: 'engine-wheel-v1',
  },
  activeSlot: 'replay',
}

/** A legacy-shaped, empty session is used to exercise restore without
 * pretending that a historical save has a modern completion receipt. */
export const RESTORED_OLD_SAVE: CourseSessions = {
  continuation: { requiredSet: { courseId: 'da', cityId: 'sonderborg', setVersion: 'legacy-v1' }, remainingBoardKeys: [], source: 'legacy-anchor' },
  primary: null, replay: null, activeSlot: null,
}

/** Prepare a receipt with real learning evidence so storage validation can be
 * used by fixture tests. This intentionally leaves effects pending: callers
 * can acknowledge them when testing the recovered form. */
export function validatedReceiptFixture(game = MATRIX_FIXTURES[5].game, changes: Partial<SettlementInput> = {}): { receipt: CompletionReceipt; ledger: SettlementLedger } {
  const learning = prepareLearning(game, [], {}, {}, 1_789_776_000_000)
  const result = prepareSettlement(emptySettlementLedger(), settlementFixture(game, { learning, ...changes }))
  if (result.status === 'blocked') throw new Error(result.reason)
  return { receipt: result.receipt, ledger: result.ledger }
}

/** Known baseline limits for this source-only worker. Browser/native layout,
 * Home dismissal, live lookup and cross-out evidence require their leased
 * UI/engine drives and are not claimed by these fixtures. */
export const BASELINE_REPRODUCTION_LIMITS = {
  layout: 'not captured in source-only worktree; requires actual app build and short-phone drive',
  homeDismissal: 'not captured here; requires Home/session runtime drive',
  lookup: 'not captured here; requires live dictionary/Worker path',
  crossOuts: 'not captured here; requires BoardGrid human-guess interaction drive',
} as const
