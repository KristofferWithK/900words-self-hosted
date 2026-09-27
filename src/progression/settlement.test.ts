import { describe, expect, it } from 'vitest'
import { createPrimaryContinuation, earnedPostcards, emptyProgressFacts } from './facts'
import { attemptFixture, EMPTY_LEARNING, FIXTURE_BOARD, FIXTURE_CONTENT, FIXTURE_SET, MATRIX_FIXTURES, settlementFixture, UNFINISHED_PRIMARY_BENEATH_REPLAY, validatedReceiptFixture } from './fixtures'
import { boardKey, effectKey, firstCompletionKey, milestoneKey } from './identity'
import { acceptsEvent, acknowledgeEffect, emptySettlementLedger, pendingEffects, pendingSettlement, prepareSettlement, recoverSettlement, settledReceiptFacts } from './settlement'
import { parseLedger, parseSessions } from './storageSchema'
import type { PrepareResult } from './settlement'
import type { SettlementEffect, SettlementLedger, SettlementPersistence } from './types'
import { tutorialAwardIdentity } from './tutorialAward'
import { prepareLearning } from '../srs/settlement'

function prepared(result: PrepareResult) {
  if (result.status === 'blocked') throw new Error(result.reason)
  return result
}

function acknowledgeAll(ledger: SettlementLedger): SettlementLedger {
  let next = ledger
  for (const entry of Object.values(ledger.settlements)) for (const effect of pendingEffects(entry)) next = acknowledgeEffect(next, entry.receipt.receiptId, effect)
  return next
}

describe('receipt preparation and recovery contract', () => {
  it('settles a tutorial win as one durable city claim, then repeats as already-held', () => {
    const identity = tutorialAwardIdentity('profile-test', { courseId: 'da', cityId: 'sonderborg' }, 'A1')
    const firstInput = settlementFixture(MATRIX_FIXTURES[5].game, {
      attempt: attemptFixture(MATRIX_FIXTURES[5].game, { origin: 'tutorial', board: null, attemptId: 'tutorial-first' }),
      required: null, authoredContent: null, continuation: null, tutorialAward: identity,
      learning: prepareLearning(MATRIX_FIXTURES[5].game, [], {}, {}, 100),
    })
    const first = prepared(prepareSettlement(emptySettlementLedger(), firstInput))
    expect(first.receipt).toMatchObject({ tutorialAward: { status: 'new', postcards: 1 }, rewards: { postcards: 0 }, games: { played: 0, won: 0, lost: 0 } })
    expect(earnedPostcards(first.ledger.facts, { courseId: 'da', cityId: 'sonderborg' })).toBe(1)
    const stable = acknowledgeAll(first.ledger)
    const repeat = prepared(prepareSettlement(stable, { ...firstInput, attempt: { ...firstInput.attempt, attemptId: 'tutorial-repeat' } }))
    expect(repeat.receipt).toMatchObject({ tutorialAward: { status: 'already-held', postcards: 0 }, rewards: { postcards: 0 }, games: { played: 0 } })
    expect(earnedPostcards(repeat.ledger.facts, { courseId: 'da', cityId: 'sonderborg' })).toBe(1)
    expect(parseLedger(repeat.ledger).facts.tutorialAwards).toEqual(repeat.ledger.facts.tutorialAwards)
    const receipt = Object.values(repeat.ledger.settlements)[0]!.receipt
    const tampered = { ...repeat.ledger, settlements: { ...repeat.ledger.settlements, [receipt.receiptId]: { ...repeat.ledger.settlements[receipt.receiptId]!, receipt: {
      ...receipt, tutorialAward: { ...receipt.tutorialAward!, identity: { ...receipt.tutorialAward!.identity, profileKey: 'other-profile' } },
    } } } }
    expect(() => parseLedger(tampered)).toThrow('Inconsistent tutorial award')
  })

  it('does not claim a tutorial miss or skipped origin', () => {
    const identity = tutorialAwardIdentity('profile-test', { courseId: 'da', cityId: 'sonderborg' }, 'A1')
    for (const origin of ['tutorial', 'optional'] as const) {
      const input = settlementFixture(MATRIX_FIXTURES[0].game, { attempt: attemptFixture(MATRIX_FIXTURES[0].game, { origin, board: null }), required: null, authoredContent: null, continuation: null, tutorialAward: identity })
      const result = prepared(prepareSettlement(emptySettlementLedger(), input))
      expect(result.receipt.tutorialAward).toBeUndefined()
      expect(earnedPostcards(result.ledger.facts, identity)).toBe(0)
    }
  })
  it('G1 A1 records wheel-miss and zero-found terminal losses without ranked progress', () => {
    const miss = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(MATRIX_FIXTURES[3].game)))
    expect(miss.receipt).toMatchObject({ contractRevision: 'C1-G1-A1', completedLoss: true, attemptTier: 'gold', previousBest: null, newBest: null, rewards: { postcards: 0 }, games: { played: 1, lost: 1 } })
    expect(miss.ledger.facts.boards).toEqual({})
    expect(miss.ledger.facts.completedLosses[boardKey(FIXTURE_BOARD)]).toMatchObject({ firstPrimary: true })
    const zero = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(undefined, { attempt: { ...attemptFixture(MATRIX_FIXTURES[0].game), game: { ...MATRIX_FIXTURES[0].game, wheel: undefined, outcome: { result: 'lost', reason: 'sudden-death' } } } })))
    expect(zero.receipt.completedLoss).toBe(true)
    expect(zero.receipt.rewards.postcards).toBe(0)
  })

  it('persists primary-loss continuation metadata and reloads it without reselecting the loss', () => {
    const preparedLoss = validatedReceiptFixture(MATRIX_FIXTURES[3].game)
    expect(preparedLoss.receipt.primary).toMatchObject({
      completedBoardKey: boardKey(FIXTURE_BOARD), firstCompletionId: null,
      nextBoardKey: null,
    })
    const reloaded = parseLedger(preparedLoss.ledger)
    expect(reloaded.settlements[preparedLoss.receipt.receiptId].receipt.primary).toEqual(preparedLoss.receipt.primary)
    expect(reloaded.facts.completedLosses[boardKey(FIXTURE_BOARD)]).toBeDefined()
  })

  it('does not carry solve credit across a solved-then-missed loss, and retains old C1 receipts', () => {
    const loss = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(MATRIX_FIXTURES[3].game)))
    expect(loss.ledger.facts.boards).toEqual({})
    const oldPrepared = validatedReceiptFixture()
    const oldReceipt = oldPrepared.receipt
    const old = structuredClone(oldReceipt)
    const { completedLoss: _discardedLossMarker, ...oldPayload } = old
    const legacy = { ...oldPayload, contractRevision: 'C1-PC-1' as const }
    const oldLedger = { ...oldPrepared.ledger, settlements: { [oldReceipt.receiptId]: { receipt: legacy, acknowledgedEffects: [] } } }
    const roundTripped = parseLedger(oldLedger).settlements[oldReceipt.receiptId].receipt
    expect(roundTripped).toEqual(legacy)
  })

  it('keeps an unfinished active primary boundary intact while a replay is active', () => {
    expect(parseSessions(UNFINISHED_PRIMARY_BENEATH_REPLAY).primary?.game.phase).toBe('aiClueInput')
    expect(parseSessions(UNFINISHED_PRIMARY_BENEATH_REPLAY).activeSlot).toBe('replay')
  })

  it('creates immutable-by-contract evidence before all sinks and returns the same accepted receipt on repeated Finish', () => {
    const input = settlementFixture()
    const start = emptySettlementLedger()
    const first = prepared(prepareSettlement(start, input))
    expect(start).toEqual(emptySettlementLedger())
    expect(first.receipt).toMatchObject({ attemptTier: 'platinum', previousBest: null, newBest: 'platinum', rewards: { postcards: 4 }, games: { played: 1, won: 1, lost: 0 } })
    expect(pendingEffects(first.ledger.settlements[first.receipt.receiptId])).toEqual(['learning', 'games', 'streak', 'associations', 'session'])
    input.attempt.game.wheel!.translated.length = 0
    expect(first.receipt.evidence.game.wheel!.translated).toHaveLength(5)
    expect(prepareSettlement(first.ledger, input)).toMatchObject({ status: 'existing', receipt: first.receipt })
    expect(earnedPostcards(first.ledger.facts, FIXTURE_BOARD)).toBe(4)
    expect(() => settledReceiptFacts(first.ledger)).toThrow('Recover')
  })

  it('requires recovery before preparing another attempt or importing/exporting', () => {
    const first = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture()))
    const next = settlementFixture(undefined, { attempt: attemptFixture(MATRIX_FIXTURES[0].game, { attemptId: 'attempt-2', origin: 'replay' }) })
    expect(prepareSettlement(first.ledger, next)).toEqual({ status: 'blocked', reason: 'recover-pending-settlement' })
    const finished = acknowledgeAll(first.ledger)
    expect(pendingSettlement(finished)).toBeNull()
    const fact = settledReceiptFacts(finished)[0]
    expect(fact).not.toHaveProperty('effects')
    expect(fact).not.toHaveProperty('evidence')
    expect(fact).not.toHaveProperty('learning')
    expect(prepareSettlement(finished, next).status).toBe('prepared')
  })

  it('AC08 a lower replay preserves best and first-primary count, with a real loss tally', () => {
    const first = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture()))
    const replay = prepared(prepareSettlement(acknowledgeAll(first.ledger), settlementFixture(undefined, {
      attempt: attemptFixture(MATRIX_FIXTURES[0].game, { origin: 'replay', attemptId: 'replay-1' }),
    })))
    expect(replay.receipt).toMatchObject({ attemptTier: 'bronze', previousBest: 'platinum', newBest: 'platinum', rewards: { postcards: 0 }, primary: null, newMilestoneIds: [], games: { played: 1, won: 0, lost: 1 } })
    expect(replay.ledger.facts.firstPrimaryCompletions).toEqual(first.ledger.facts.firstPrimaryCompletions)
  })

  it('AC08 actual receipts cannot assemble Platinum across solve and translation attempts', () => {
    const solve = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(MATRIX_FIXTURES[3].game)))
    const translated = prepared(prepareSettlement(acknowledgeAll(solve.ledger), settlementFixture(undefined, {
      attempt: attemptFixture(MATRIX_FIXTURES[2].game, { origin: 'replay', attemptId: 'replay-1' }),
    })))
    expect(translated.receipt).toMatchObject({ attemptTier: 'silver', newBest: 'silver', rewards: { postcards: 1, newlyClaimed: ['spinWin'] } })
    expect(earnedPostcards(translated.ledger.facts, FIXTURE_BOARD)).toBe(1)
    expect(translated.ledger.facts.boards[boardKey(FIXTURE_BOARD)].claims).toEqual(['spinWin'])
  })

  it('tutorial and daily keep their separate learning/count policies and no city facts', () => {
    for (const origin of ['tutorial', 'daily', 'developer', 'optional'] as const) {
      const result = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(undefined, {
        attempt: attemptFixture(MATRIX_FIXTURES[5].game, { origin }), dailyKey: '2026-09-19',
      })))
      expect(result.receipt.rewards.postcards).toBe(0)
      expect(result.receipt.newBest).toBeNull()
      expect(result.ledger.facts).toEqual(emptyProgressFacts())
      expect(result.receipt.effects.includes('learning')).toBe(true)
      expect(result.receipt.effects.includes('games')).toBe(origin !== 'tutorial')
      expect(result.receipt.effects.includes('daily')).toBe(origin === 'daily')
    }
  })

  it('rejects unknown identity, content mismatch, invalid replay and a queue that skips an unproven board', () => {
    const input = settlementFixture()
    expect(prepareSettlement(emptySettlementLedger(), { ...input, attempt: { ...input.attempt, board: null } })).toEqual({ status: 'blocked', reason: 'unknown-board' })
    expect(prepareSettlement(emptySettlementLedger(), { ...input, authoredContent: { ...FIXTURE_CONTENT, playerGreenIds: ['b', 'c', 'd'] } })).toEqual({ status: 'blocked', reason: 'content-mismatch' })
    expect(prepareSettlement(emptySettlementLedger(), { ...input, attempt: { ...input.attempt, origin: 'replay' } })).toEqual({ status: 'blocked', reason: 'replay-needs-completed-board' })
    expect(prepareSettlement(emptySettlementLedger(), { ...input, required: { ...FIXTURE_SET, boards: [FIXTURE_BOARD, { ...FIXTURE_BOARD, authoredBoardId: 'B' }] } })).toEqual({ status: 'blocked', reason: 'invalid-primary-continuation' })
  })

  it('pins effect IDs and refuses event ownership from another slot, attempt or reload generation', () => {
    const current = { attemptId: 'a', slot: 'primary' as const, generation: 3 }
    expect(acceptsEvent(current, { ...current })).toBe(true)
    expect(acceptsEvent(current, { ...current, generation: 2 })).toBe(false)
    expect(acceptsEvent(current, { ...current, attemptId: 'b' })).toBe(false)
    expect(acceptsEvent(current, { ...current, slot: 'replay' })).toBe(false)
    expect(acceptsEvent(null, current)).toBe(false)
    expect(effectKey('a:b', 'c')).not.toBe(effectKey('a', 'b:c'))
  })

  it('F40 imported completion of active primary consumes no second milestone; continuation selects next missing board', () => {
    const nextBoard = { ...FIXTURE_BOARD, authoredBoardId: 'B' }
    const required = { ...FIXTURE_SET, boards: [FIXTURE_BOARD, nextBoard] }
    const input = settlementFixture(undefined, { required, continuation: createPrimaryContinuation(required, emptyProgressFacts()) })
    const ledger = emptySettlementLedger()
    const imported: SettlementLedger = { ...ledger, facts: { ...ledger.facts, firstPrimaryCompletions: { [firstCompletionKey(FIXTURE_BOARD)]: { board: FIXTURE_BOARD, requiredSet: required } } } }
    const finish = prepared(prepareSettlement(imported, input))
    expect(finish.receipt.primary).toEqual({ completedBoardKey: boardKey(FIXTURE_BOARD), firstCompletionId: null, nextBoardKey: boardKey(nextBoard) })
    expect(finish.receipt.newMilestoneIds).toEqual([])
    expect(input.continuation!.remainingBoardKeys[0]).toBe(boardKey(FIXTURE_BOARD))
  })

  it('AC19 persisted primary continuation survives required display reorder', () => {
    const second = { ...FIXTURE_BOARD, authoredBoardId: 'B' }
    const required = { ...FIXTURE_SET, boards: [FIXTURE_BOARD, second] }
    const continuation = createPrimaryContinuation(required, emptyProgressFacts())
    const finish = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(undefined, {
      required: { ...required, boards: [...required.boards].reverse() }, continuation,
    })))
    expect(finish.receipt.primary!.completedBoardKey).toBe(boardKey(FIXTURE_BOARD))
    expect(finish.receipt.primary!.nextBoardKey).toBe(boardKey(second))
    expect(continuation.remainingBoardKeys).toEqual([boardKey(FIXTURE_BOARD), boardKey(second)])
  })

  it('F28 ninth -> tenth primary creates a single tenth invitation; repeated finish does not', () => {
    const boards = Array.from({ length: 10 }, (_, i) => ({ ...FIXTURE_BOARD, authoredBoardId: `fixture-${i}` }))
    const required = { ...FIXTURE_SET, boards }
    const facts = { ...emptyProgressFacts(), firstPrimaryCompletions: Object.fromEntries(boards.slice(0, 9).map((board) => [firstCompletionKey(board), { board, requiredSet: required }])) }
    const input = settlementFixture(undefined, {
      attempt: attemptFixture(MATRIX_FIXTURES[5].game, { board: boards[9] }), required,
      continuation: createPrimaryContinuation(required, facts), authoredContent: { ...FIXTURE_CONTENT, board: boards[9] },
    })
    const finish = prepared(prepareSettlement({ ...emptySettlementLedger(), facts }, input))
    expect(finish.receipt.newMilestoneIds).toEqual([milestoneKey(required, 10)])
    expect(finish.receipt.effects).toContain('lessons')
    expect(finish.receipt.primary!.nextBoardKey).toBeNull()
    expect(prepareSettlement(finish.ledger, input)).toMatchObject({ status: 'existing' })
  })

  it('tier calculation does not invent word effects; supplied learning diffs survive unchanged', () => {
    const learning = { ...EMPTY_LEARNING, newlyCollected: ['actual-collected'], newlyDiscovered: ['actual-new'] }
    const receipt = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture(undefined, { learning }))).receipt
    expect(receipt.learning).toEqual(learning)
    expect(receipt.learning.results).toEqual([])
  })

  it('repeated deterministic runs serialize identically without changing the fixture', () => {
    const input = settlementFixture()
    const before = JSON.stringify(input)
    const results = Array.from({ length: 10 }, () => JSON.stringify(prepareSettlement(emptySettlementLedger(), input)))
    expect(new Set(results).size).toBe(1)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('fault injection of the minimal recovery protocol (fake atomic storage)', () => {
  // Actual adapter/storage fault coverage remains C1-05. This harness exercises
  // the shared recovery routine, including committed writes whose call throws.
  const preparedReceipt = prepared(prepareSettlement(emptySettlementLedger(), settlementFixture()))
  const effectCount = preparedReceipt.receipt.effects.length
  const boundaries = 1 + effectCount * 2 // receipt, then sink and acknowledgement

  it.each(Array.from({ length: boundaries * 2 }, (_, i) => ({ failAt: Math.floor(i / 2) + 1, afterWrite: i % 2 === 1 })))('recovers write $failAt, committed=$afterWrite, exactly once', async ({ failAt, afterWrite }) => {
    let disk = emptySettlementLedger()
    const sink = new Map<string, SettlementEffect>()
    const applications = new Map<SettlementEffect, number>()
    let writes = 0
    let failed = false
    const atomicWrite = (write: () => void) => {
      writes += 1
      if (!failed && writes === failAt && !afterWrite) { failed = true; throw new Error('crash-before') }
      write()
      if (!failed && writes === failAt && afterWrite) { failed = true; throw new Error('crash-after') }
    }
    const io: SettlementPersistence = {
      commitLedger: async (next) => { atomicWrite(() => { disk = structuredClone(next) }) },
      applyEffectOnce: async (id, effect) => {
        if (sink.has(id)) return 'already-applied'
        atomicWrite(() => { sink.set(id, effect); applications.set(effect, (applications.get(effect) ?? 0) + 1) })
        return 'applied'
      },
    }
    try {
      await io.commitLedger(preparedReceipt.ledger)
      await recoverSettlement(disk, io)
    } catch { /* simulated process died; recover from disk, not the proposal */ }
    expect(failed).toBe(true)
    if (!Object.keys(disk.settlements).length) {
      expect(sink.size).toBe(0)
      await io.commitLedger(prepared(prepareSettlement(disk, settlementFixture())).ledger)
    }
    await recoverSettlement(disk, io)
    await recoverSettlement(disk, io)
    expect(pendingSettlement(disk)).toBeNull()
    expect(sink.size).toBe(effectCount)
    expect([...applications.values()]).toEqual(Array(effectCount).fill(1))
    expect(earnedPostcards(disk.facts, FIXTURE_BOARD)).toBe(4)
    expect(Object.keys(disk.facts.firstPrimaryCompletions)).toHaveLength(1)
  })
})
