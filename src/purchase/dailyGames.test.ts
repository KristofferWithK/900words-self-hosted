import { describe, expect, it } from 'vitest'
import { canDeveloperContinue, completedToday, FREE_GAMES_PER_DAY, localDay, showLimitOnHomeReturn } from './dailyGames'
import { attemptFixture, MATRIX_FIXTURES, settlementFixture } from '../progression/fixtures'
import { acknowledgeEffect, emptySettlementLedger, prepareSettlement } from '../progression/settlement'
import { SETTLEMENT_KEY } from '../stores/settlementStorage'
import { prepareLearning } from '../srs/settlement'
import { PASS_PRODUCTS } from './pass'

function receiptLedger() {
  let ledger = emptySettlementLedger()
  const game = MATRIX_FIXTURES[5].game
  const add = (attemptId: string, localDate: string, origin: 'primary' | 'replay' | 'daily' | 'tutorial') => {
    const acceptedAt = 1_790_000_000_000
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId, origin }),
      acceptedAt,
      localDate,
      ...(origin !== 'primary' ? { continuation: null } : {}),
      ...(origin === 'daily' ? { dailyKey: `daily-${attemptId}` } : {}),
    })
    const result = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (result.status === 'blocked') throw new Error(`Invalid receipt test fixture: ${result.reason}`)
    ledger = result.ledger
    for (const effect of result.receipt.effects) ledger = acknowledgeEffect(ledger, result.receipt.receiptId, effect)
  }
  add('primary-1', '2026-09-24', 'primary')
  add('primary-1', '2026-09-24', 'primary')
  add('daily-1', '2026-09-24', 'daily')
  add('replay-1', '2026-09-24', 'replay')
  add('yesterday', '2026-09-23', 'daily')
  add('tutorial', '2026-09-24', 'tutorial')
  return ledger
}

function storage(ledger = emptySettlementLedger()) {
  const values = new Map<string, string>([[SETTLEMENT_KEY, JSON.stringify(ledger)]])
  return {
    getItem: (key: string) => values.get(key) ?? null,
    values,
  }
}

describe('two completed games per local day', () => {
  it('counts accepted receipt attempts by their localDate, including daily games', () => {
    const s = storage(receiptLedger())
    expect(completedToday(s, '2026-09-24')).toBe(3)
    expect(completedToday(s, '2026-09-23')).toBe(1)
    expect(completedToday(s, '2026-09-25')).toBe(0)
  })
  it('fails closed on malformed or inaccessible storage', () => {
    const s = storage()
    s.values.set(SETTLEMENT_KEY, '{broken')
    expect(completedToday({ getItem: () => { throw new Error('blocked') } })).toBe(FREE_GAMES_PER_DAY)
    expect(completedToday(s)).toBe(FREE_GAMES_PER_DAY)
  })
  it('uses the device local calendar day', () => {
    expect(localDay(new Date(2026, 8, 24, 23, 59))).toBe('2026-09-24')
    expect(localDay(new Date(2026, 8, 25, 0, 0))).toBe('2026-09-25')
  })
  it('offers developer continuation only when StoreKit has no purchasable offer', () => {
    expect(canDeveloperContinue('not-entitled', [])).toBe(true)
    expect(canDeveloperContinue('unavailable', [])).toBe(true)
    expect(canDeveloperContinue('error', [])).toBe(true)
    expect(canDeveloperContinue('checking', [])).toBe(false)
    expect(canDeveloperContinue('entitled', [])).toBe(false)
    expect(canDeveloperContinue('not-entitled', [{ id: PASS_PRODUCTS.monthly, displayPrice: '$0.99' }])).toBe(false)
    expect(canDeveloperContinue('not-entitled', [{ id: PASS_PRODUCTS.monthly, displayPrice: ' ' }])).toBe(true)
  })
  it('offers once the player returns Home after a recorded round, not during play or on reload', () => {
    expect(showLimitOnHomeReturn('game', 'home', true, true)).toBe(true)
    expect(showLimitOnHomeReturn('game', 'home', false, true)).toBe(false)
    expect(showLimitOnHomeReturn('settings', 'home', true, true)).toBe(false)
    expect(showLimitOnHomeReturn('game', 'game', true, true)).toBe(false)
    expect(showLimitOnHomeReturn('game', 'home', true, false)).toBe(false)
  })
})
