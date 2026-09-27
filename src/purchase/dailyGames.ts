import { Capacitor } from '@capacitor/core'
import { buildAudience } from '../build/audience'
import { parseLedger } from '../progression/storageSchema'
import { SETTLEMENT_KEY } from '../stores/settlementStorage'
import { usePass } from './passStore'
import { PASS_PRODUCTS, type PassOffer, type PassStatus } from './pass'

export const FREE_GAMES_PER_DAY = 2

/** Device-local calendar day. This is a play limit, not server-side anti-tampering. */
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Count durable completed-game receipts; the receipt ledger is the only authority. */
export function completedToday(storage: Pick<Storage, 'getItem'>, day = localDay()): number {
  try {
    const raw = storage.getItem(SETTLEMENT_KEY)
    if (raw === null) return 0
    const durable = parseLedger(JSON.parse(raw))
    const attempts = new Set<string>()
    for (const { receipt } of Object.values(durable.settlements)) {
      if (receipt.localDate !== day || receipt.games.played !== 1) continue
      if (receipt.evidence.origin === 'tutorial' || receipt.evidence.origin === 'retired-wrapup') continue
      attempts.add(receipt.attemptId)
    }
    return attempts.size
  } catch {
    // A corrupt/unavailable authority must never unlock another free deal.
    return FREE_GAMES_PER_DAY
  }
}

/** The separately configured self-hosted build and non-iOS builds never use this gate. */
export function dailyGateApplies(): boolean {
  return buildAudience === 'normal' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export function canStartDailyGame(): boolean {
  if (!dailyGateApplies()) return true
  if (usePass.getState().status === 'entitled') return true
  try { return completedToday(localStorage) < FREE_GAMES_PER_DAY } catch { return false }
}

/** Require no purchasable App Store offer before showing the developer-only retry. */
export function canDeveloperContinue(
  status: PassStatus = usePass.getState().status,
  offers: readonly PassOffer[] = usePass.getState().offers,
): boolean {
  const hasPurchasablePass = offers.some(({ id, displayPrice }) =>
    Object.values(PASS_PRODUCTS).includes(id as typeof PASS_PRODUCTS[keyof typeof PASS_PRODUCTS]) && displayPrice.trim().length > 0)
  return !hasPurchasablePass && (status === 'not-entitled' || status === 'unavailable' || status === 'error')
}

export function dailyLimitReached(): boolean {
  if (!dailyGateApplies() || usePass.getState().status === 'entitled') return false
  try { return completedToday(localStorage) >= FREE_GAMES_PER_DAY } catch { return true }
}

export function showLimitOnHomeReturn(previous: string, current: string, roundRecorded: boolean, limitReached: boolean): boolean {
  return previous === 'game' && current === 'home' && roundRecorded && limitReached
}
