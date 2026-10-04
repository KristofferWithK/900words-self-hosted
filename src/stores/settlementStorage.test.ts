import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { validatedReceiptFixture } from '../progression/fixtures'
import { parseLedger } from '../progression/storageSchema'
import { acknowledgeEffect } from '../progression/settlement'
import type { SettlementLedger } from '../progression/types'
import { SAVE_MIGRATION_KEY, SAVE_TRANSFER_KEY, readSaveMigration } from './saveTransfer'
import { assertSettlementIdle, SESSION_KEY, SETTLEMENT_KEY, validatedLedger, validatedLedgerJson, withSettlementWriter } from './settlementStorage'
import { createSettlementStore } from './settlementStore'

class Disk {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

function settledLedger(attemptId: string): SettlementLedger {
  const { receipt, ledger } = validatedReceiptFixture(undefined, {})
  const renamed = JSON.parse(JSON.stringify(ledger).replaceAll(receipt.attemptId, attemptId)) as SettlementLedger
  const id = Object.keys(renamed.settlements)[0]!
  return renamed.settlements[id]!.receipt.effects.reduce((next, effect) => acknowledgeEffect(next, id, effect), renamed)
}

const pendingLedger = () => validatedReceiptFixture().ledger

describe('the settlement guard validates each stored string once', () => {
  it('reuses the validated result while the stored string is unchanged', () => {
    const raw = JSON.stringify(settledLedger('cache-same'))
    const first = validatedLedger(raw)
    expect(validatedLedger(`${raw}`)).toBe(first)
    expect(first.pending).toBe(false)
    expect(Object.isFrozen(first.ledger)).toBe(true)
    expect(Object.isFrozen(Object.values(first.ledger.settlements)[0]!.receipt.evidence.game.words)).toBe(true)
  })

  it('validates a changed string again', () => {
    const before = validatedLedger(JSON.stringify(settledLedger('cache-before')))
    const after = validatedLedger(JSON.stringify(settledLedger('cache-after')))
    expect(after).not.toBe(before)
    expect(Object.keys(after.ledger.settlements)).not.toEqual(Object.keys(before.ledger.settlements))
  })

  it('still throws on a corrupt ledger, every time, even right after a valid one was cached', () => {
    const disk = new Disk()
    const valid = settledLedger('cache-corrupt')
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(valid))
    expect(() => assertSettlementIdle(disk)).not.toThrow()
    const corrupt = structuredClone(valid)
    ;(Object.values(corrupt.settlements)[0]!.receipt as { attemptTier: string }).attemptTier = 'bronze'
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(corrupt))
    expect(() => assertSettlementIdle(disk)).toThrow('Inconsistent settlement receipt')
    expect(() => assertSettlementIdle(disk)).toThrow('Inconsistent settlement receipt')
    disk.setItem(SETTLEMENT_KEY, '{"schemaVersion":1,')
    expect(() => assertSettlementIdle(disk)).toThrow(SyntaxError)
    expect(() => assertSettlementIdle(disk)).toThrow(SyntaxError)
  })

  it('a pending settlement still blocks mutations, on the first read and the cached one', () => {
    const disk = new Disk()
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(pendingLedger()))
    expect(() => assertSettlementIdle(disk)).toThrow('Recover pending settlement before changing player state')
    expect(() => assertSettlementIdle(disk)).toThrow('Recover pending settlement before changing player state')
  })

  it('a pending save transfer and a busy writer still block mutations over a cached idle ledger', async () => {
    const disk = new Disk()
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(settledLedger('cache-transfer')))
    expect(() => assertSettlementIdle(disk)).not.toThrow()
    disk.setItem(SAVE_TRANSFER_KEY, JSON.stringify({ version: 1, writes: [], fingerprint: '00000000' }))
    expect(() => assertSettlementIdle(disk)).toThrow('Recover pending save transfer before changing player state')
    disk.setItem(SAVE_TRANSFER_KEY, 'null')
    await withSettlementWriter(disk, async () => {
      expect(() => assertSettlementIdle(disk)).toThrow('Settlement writer is busy')
    })
    expect(() => assertSettlementIdle(disk)).not.toThrow()
  })

  it('a corrupt migration record still throws after a valid one was cached', () => {
    const disk = new Disk()
    disk.setItem(SAVE_MIGRATION_KEY, JSON.stringify({ version: 1, migratedAt: 5, retired: true }))
    expect(readSaveMigration(disk)).toEqual({ version: 1, migratedAt: 5, retired: true })
    disk.setItem(SAVE_MIGRATION_KEY, JSON.stringify({ version: 1, migratedAt: 5, unexpected: true }))
    expect(() => readSaveMigration(disk)).toThrow()
    expect(() => assertSettlementIdle(disk)).toThrow()
  })

  it('hands every reader its own copy, so no caller can change the cached value', () => {
    const disk = new Disk()
    const valid = settledLedger('cache-copy')
    disk.setItem(SETTLEMENT_KEY, JSON.stringify(valid))
    disk.setItem(SAVE_MIGRATION_KEY, JSON.stringify({ version: 1, migratedAt: 7 }))
    disk.setItem(SESSION_KEY, JSON.stringify({ version: 1, state: { byCourse: {}, results: { a: { receiptId: 'r', reviewRoundId: null } }, settlementEffects: {} } }))
    const adapter = createSettlementStore({ storage: disk })

    const ledger = adapter.readLedger()
    expect(Object.isFrozen(ledger.facts)).toBe(false)
    expect(JSON.parse(JSON.stringify(ledger))).toEqual(validatedLedger(JSON.stringify(valid)).ledger)
    expect(structuredClone(ledger)).toEqual({ ...ledger })
    const receipt = Object.values(ledger.settlements)[0]!.receipt as { attemptTier: string }
    expect(Object.isFrozen(receipt)).toBe(false)
    receipt.attemptTier = 'bronze'
    ;(ledger.facts as { boards: unknown }).boards = {}
    ;(ledger as { settlements: unknown }).settlements = {}
    expect(ledger.settlements).toEqual({})
    const again = adapter.readLedger()
    expect(Object.keys(again.settlements)).toEqual(Object.keys(valid.settlements))
    expect(Object.values(again.settlements)[0]!.receipt.attemptTier).toBe('platinum')
    expect(Object.keys(again.facts.boards)).toEqual(Object.keys(valid.facts.boards))

    const sessions = adapter.readSessions() as { results: Record<string, unknown> }
    delete sessions.results.a
    expect(Object.keys(adapter.readSessions().results)).toEqual(['a'])

    const migration = readSaveMigration(disk)
    migration.migratedAt = 99
    expect(readSaveMigration(disk).migratedAt).toBe(7)
  })
})

function ledgerOf(attemptIds: readonly string[], settled = true): SettlementLedger {
  const parts = attemptIds.map((id) => {
    if (settled) return settledLedger(id)
    const { receipt, ledger } = validatedReceiptFixture(undefined, {})
    return JSON.parse(JSON.stringify(ledger).replaceAll(receipt.attemptId, id)) as SettlementLedger
  })
  return { ...parts[0]!, settlements: Object.assign({}, ...parts.map((part) => part.settlements)) }
}
const keyOf = (ledger: SettlementLedger, attemptId: string) => Object.keys(ledger.settlements).find((key) => key.includes(attemptId))!

describe('a ledger write re-checks only what changed', () => {
  it('gives exactly what validating the stored string would, sharing the unchanged receipts', () => {
    const cached = validatedLedger(JSON.stringify(ledgerOf(['write-a', 'write-b']))).ledger
    const added = ledgerOf(['write-c'])
    const next = { ...cached, settlements: { ...cached.settlements, ...added.settlements } }
    const raw = validatedLedgerJson(next)
    expect(raw).toBe(JSON.stringify(next))
    const written = validatedLedger(raw).ledger
    expect(written).toEqual(parseLedger(JSON.parse(raw)))
    expect(Object.keys(written.settlements)).toEqual(Object.keys(JSON.parse(raw).settlements))
    expect(written.settlements[keyOf(next, 'write-a')]).toBe(cached.settlements[keyOf(next, 'write-a')])
    expect(written.settlements[keyOf(next, 'write-c')]).not.toBe(next.settlements[keyOf(next, 'write-c')])
    expect(Object.isFrozen(written.settlements[keyOf(next, 'write-c')]!.receipt)).toBe(true)
  })

  it('checks a new receipt in full, with the same errors and error paths', () => {
    const cached = validatedLedger(JSON.stringify(ledgerOf(['full-a']))).ledger
    const bad = ledgerOf(['full-b'])
    const key = keyOf(bad, 'full-b')
    ;(bad.settlements[key]!.receipt as { attemptTier: string }).attemptTier = 'bronze'
    expect(() => validatedLedgerJson({ ...cached, settlements: { ...cached.settlements, ...bad.settlements } }))
      .toThrow('Inconsistent settlement receipt')
    const malformed = ledgerOf(['full-c'])
    ;(malformed.settlements[keyOf(malformed, 'full-c')] as { acknowledgedEffects: unknown }).acknowledgedEffects = ['bogus']
    let issue: unknown
    try { validatedLedgerJson({ ...cached, settlements: { ...cached.settlements, ...malformed.settlements } }) } catch (error) { issue = error }
    expect((issue as z.ZodError).issues[0]!.path.slice(0, 3)).toEqual(['settlements', keyOf(malformed, 'full-c'), 'acknowledgedEffects'])
  })

  it('still checks the unchanged receipts against changed facts', () => {
    const cached = validatedLedger(JSON.stringify(ledgerOf(['facts-a']))).ledger
    expect(() => validatedLedgerJson({ ...cached, facts: { ...cached.facts, boards: {} } })).toThrow('Receipt facts missing')
  })

  it('counts pending settlements across unchanged and new receipts', () => {
    const cached = validatedLedger(JSON.stringify(ledgerOf(['pending-a'], false))).ledger
    const added = ledgerOf(['pending-b'], false)
    expect(() => validatedLedgerJson({ ...cached, settlements: { ...cached.settlements, ...added.settlements } }))
      .toThrow('Multiple pending settlements')
  })

  it('trusts only the very same frozen objects, never an unfrozen lookalike', () => {
    const lookalike = ledgerOf(['lookalike-a'])
    const key = keyOf(lookalike, 'lookalike-a')
    ;(lookalike.settlements[key]!.receipt as { attemptTier: string }).attemptTier = 'bronze'
    expect(() => parseLedger(lookalike, lookalike)).toThrow('Inconsistent settlement receipt')
    const frozenCopy = validatedLedger(JSON.stringify(ledgerOf(['lookalike-b']))).ledger
    const equalButNotSame = JSON.parse(JSON.stringify(frozenCopy)) as SettlementLedger
    ;(Object.values(equalButNotSame.settlements)[0]!.receipt as { attemptTier: string }).attemptTier = 'bronze'
    expect(() => parseLedger(equalButNotSame, frozenCopy)).toThrow('Inconsistent settlement receipt')
  })
})
