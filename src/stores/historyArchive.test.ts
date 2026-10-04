import { describe, expect, it } from 'vitest'
import { MATRIX_FIXTURES, settlementFixture, validatedReceiptFixture } from '../progression/fixtures'
import { receiptKey } from '../progression/identity'
import { acknowledgeEffect, archiveSettlements, archivedReceiptOf, prepareSettlement, receiptsToArchive } from '../progression/settlement'
import { parseLedger, sameValue } from '../progression/storageSchema'
import type { SettlementLedger } from '../progression/types'
import { completedToday } from '../purchase/dailyGames'
import { memoryHistoryArchive, type HistoryArchive } from './historyArchive'
import { SETTLEMENT_KEY } from './settlementStorage'
import { createSettlementStore, KEEP_FULL_RECEIPTS, type FinishInput } from './settlementStore'

class Disk {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

const BASE = 1_789_776_000_000

/** One settled round per attempt id, all on the fixture board, acceptedAt in the order given. */
function settledLedger(attemptIds: readonly string[], pending: readonly string[] = []): SettlementLedger {
  const parts = attemptIds.map((attemptId, index) => {
    const { receipt, ledger } = validatedReceiptFixture(undefined, { acceptedAt: BASE + index })
    const renamed = JSON.parse(JSON.stringify(ledger).replaceAll(receipt.attemptId, attemptId)) as SettlementLedger
    const key = Object.keys(renamed.settlements)[0]!
    return pending.includes(attemptId) ? renamed
      : renamed.settlements[key]!.receipt.effects.reduce((next, effect) => acknowledgeEffect(next, key, effect), renamed)
  })
  return { ...parts[0]!, settlements: Object.assign({}, ...parts.map((part) => part.settlements)) }
}

function optionalRound(index: number): FinishInput {
  const input = settlementFixture(MATRIX_FIXTURES[5].game)
  input.attempt.game.clueHistory = [{ by: 'player', text: 'example', number: 2,
    guesses: [{ wordId: 'a', result: 'green' }, { wordId: 'b', result: 'green' }] }]
  return { ...input, attempt: { ...input.attempt, attemptId: `history-${index}`, origin: 'optional' },
    acceptedAt: BASE + index * 60_000, lookedUp: [] }
}

describe('old rounds in the ledger shrink to a summary', () => {
  it('summarises a receipt with what the game still needs', () => {
    const ledger = settledLedger(['sum-a'])
    const entry = Object.values(ledger.settlements)[0]!
    expect(archivedReceiptOf(entry.receipt)).toEqual({
      attemptId: 'sum-a', acceptedAt: entry.receipt.acceptedAt, localDate: entry.receipt.localDate, origin: 'primary',
      board: entry.receipt.evidence.board, attemptTier: entry.receipt.attemptTier, completedLoss: false,
      games: entry.receipt.games, postcards: entry.receipt.rewards.postcards,
    })
  })

  it('archives all but the most recent, never a pending round or one in use', () => {
    const ledger = settledLedger(['r0', 'r1', 'r2', 'r3', 'r4'], ['r0'])
    const key = (id: string) => receiptKey(id)
    expect(receiptsToArchive(ledger, 2, new Set())).toEqual([key('r2'), key('r1')])
    expect(receiptsToArchive(ledger, 2, new Set([key('r1')]))).toEqual([key('r2')])
    expect(receiptsToArchive(ledger, 5, new Set())).toEqual([])
  })

  it('a summarised ledger validates, and its summaries are checked', () => {
    const ledger = settledLedger(['v0', 'v1', 'v2'])
    const archived = archiveSettlements(ledger, [receiptKey('v0'), receiptKey('v1')])
    expect(Object.keys(archived.settlements)).toEqual([receiptKey('v2')])
    expect(parseLedger(JSON.parse(JSON.stringify(archived)))).toEqual(JSON.parse(JSON.stringify(archived)))

    const wrongKey = JSON.parse(JSON.stringify(archived))
    wrongKey.archived[receiptKey('v0')].attemptId = 'someone-else'
    expect(() => parseLedger(wrongKey)).toThrow('Inconsistent archived receipt')

    const both = JSON.parse(JSON.stringify(archived))
    both.archived[receiptKey('v2')] = archivedReceiptOf(archived.settlements[receiptKey('v2')]!.receipt)
    expect(() => parseLedger(both)).toThrow('Inconsistent archived receipt')

    const noFacts = JSON.parse(JSON.stringify({ ...archived, settlements: {}, archived: archived.archived }))
    noFacts.facts.boards = {}
    expect(() => parseLedger(noFacts)).toThrow('Archived receipt facts missing')
  })

  it('never settles an archived attempt again', () => {
    const ledger = archiveSettlements(settledLedger(['again']), [receiptKey('again')])
    const input = settlementFixture(MATRIX_FIXTURES[5].game)
    const retry = prepareSettlement(ledger, { ...input, attempt: { ...input.attempt, attemptId: 'again' } })
    expect(retry).toEqual({ status: 'blocked', reason: 'attempt-archived' })
  })

  it('still counts an archived round towards today\'s free games', () => {
    const ledger = settledLedger(['daily-a', 'daily-b'])
    const day = Object.values(ledger.settlements)[0]!.receipt.localDate
    const disk = new Disk()
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(archiveSettlements(ledger, [receiptKey('daily-a')])))
    expect(completedToday(disk, day)).toBe(2)
  })
})

describe('settling moves old rounds to the history archive', () => {
  const settleRounds = async (archive: HistoryArchive | null, rounds: number) => {
    const disk = new Disk()
    const store = createSettlementStore({ storage: disk, archive })
    const full: Record<string, unknown> = {}
    for (let i = 0; i < rounds; i++) {
      await store.finish(optionalRound(i))
      Object.assign(full, JSON.parse(disk.getItem(SETTLEMENT_KEY)!).settlements)
    }
    return { disk, store, full }
  }

  it('keeps the most recent rounds in full and archives the rest, archive first', async () => {
    const archive = memoryHistoryArchive()
    const { disk, full } = await settleRounds(archive, KEEP_FULL_RECEIPTS + 3)
    const stored = parseLedger(JSON.parse(disk.getItem(SETTLEMENT_KEY)!))
    expect(Object.keys(stored.settlements)).toHaveLength(KEEP_FULL_RECEIPTS)
    expect(Object.keys(stored.archived ?? {})).toEqual([0, 1, 2].map((i) => receiptKey(`history-${i}`)))
    expect([...archive.entries.keys()].sort()).toEqual([0, 1, 2].map((i) => receiptKey(`history-${i}`)).sort())
    for (const [key, entry] of archive.entries) expect(sameValue(entry, full[key])).toBe(true)
    expect(Object.keys(stored.settlements)).toContain(receiptKey(`history-${KEEP_FULL_RECEIPTS + 2}`))
  })

  it('keeps every round in full when there is no archive, or the archive fails', async () => {
    const none = await settleRounds(null, KEEP_FULL_RECEIPTS + 2)
    expect(Object.keys(JSON.parse(none.disk.getItem(SETTLEMENT_KEY)!).settlements)).toHaveLength(KEEP_FULL_RECEIPTS + 2)

    const failing: HistoryArchive = { put: async () => { throw new Error('quota') }, all: async () => [] }
    const failed = await settleRounds(failing, KEEP_FULL_RECEIPTS + 2)
    const ledger = JSON.parse(failed.disk.getItem(SETTLEMENT_KEY)!)
    expect(Object.keys(ledger.settlements)).toHaveLength(KEEP_FULL_RECEIPTS + 2)
    expect(ledger.archived).toBeUndefined()
  })

  it('hands readers a copy of the summaries too', async () => {
    const { store } = await settleRounds(memoryHistoryArchive(), KEEP_FULL_RECEIPTS + 1)
    const read = store.readLedger()
    expect(Object.keys(read.archived ?? {})).toEqual([receiptKey('history-0')])
    ;(read.archived as Record<string, unknown>)[receiptKey('history-0')] = undefined
    expect(store.readLedger().archived?.[receiptKey('history-0')]?.attemptId).toBe('history-0')
  })
})
