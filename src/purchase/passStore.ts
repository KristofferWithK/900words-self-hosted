import { create } from 'zustand'
import { UI } from '../i18n'
import {
  buyPass,
  listPassOffers,
  onPassChanged,
  readPassStatus,
  redeemPassCode,
  restorePass,
  type PassOffer,
  type PassProductKind,
  type PassStatus,
} from './pass'

interface PassStore {
  status: PassStatus
  productId?: string
  offers: PassOffer[]
  message: string | null
  /** A purchase or a code just unlocked play; Casey says thank you. Never persisted. */
  thanked: boolean
  refresh: () => Promise<void>
  purchase: (kind: PassProductKind) => Promise<void>
  restore: () => Promise<void>
  redeemCode: () => Promise<void>
  dismissThanks: () => void
}

// A foreground refresh may overlap Apple's purchase sheet. Only the newest
// StoreKit request may publish a result to the UI.
let requestGeneration = 0
// ...except that a refresh must never supersede a purchase, restore or code
// the player is in the middle of. Apple's sheet backgrounds the web view, the
// return fires `visibilitychange`, and a refresh started then used to win the
// generation race and publish "not entitled" from a current-entitlements
// stream that had not caught up yet: the paid player was shown the purchase
// dialog again (owner, 2026-09-26).
let playerActionsInFlight = 0

async function asPlayerAction<T>(run: () => Promise<T>): Promise<T> {
  playerActionsInFlight++
  try {
    return await run()
  } finally {
    playerActionsInFlight--
  }
}

/**
 * This store intentionally does NOT persist. StoreKit's verified current
 * entitlements are the sole source of truth; a cached Boolean could make a
 * copied browser profile look paid.
 */
export const usePass = create<PassStore>((set, get) => ({
  status: 'checking',
  offers: [],
  message: null,
  thanked: false,
  refresh: async () => {
    if (playerActionsInFlight > 0) return
    const mine = ++requestGeneration
    set({ status: 'checking', message: null })
    const [entitlement, offers] = await Promise.all([readPassStatus(), listPassOffers()])
    if (mine === requestGeneration) set({ status: entitlement.status, productId: entitlement.productId, offers })
  },
  purchase: (kind) => asPlayerAction(async () => {
    const mine = ++requestGeneration
    set({ status: 'checking', message: null })
    const result = await buyPass(kind)
    if (mine !== requestGeneration) return
    set({
      status: result.status,
      productId: result.productId,
      thanked: result.status === 'entitled' || get().thanked,
      message: result.pending
        ? UI.system.passPending
        : result.cancelled
          ? UI.system.passCancelled
          : result.status === 'unavailable'
            ? UI.system.passUnavailable
            : result.status === 'not-entitled'
              ? UI.system.passNotEntitled
              : result.status === 'error'
                ? UI.system.passError
                : null,
    })
  }),
  restore: () => asPlayerAction(async () => {
    const mine = ++requestGeneration
    set({ status: 'checking', message: null })
    const result = await restorePass()
    if (mine !== requestGeneration) return
    set({
      status: result.status,
      productId: result.productId,
      message:
        result.status === 'not-entitled'
          ? UI.system.passNotEntitled
          : result.status === 'unavailable'
            ? UI.system.passRestoreUnavailable
            : result.status === 'error'
              ? UI.system.passRestoreError
              : null,
    })
  }),
  redeemCode: () => asPlayerAction(async () => {
    set({ message: null })
    const result = await redeemPassCode()
    if (result.status === 'entitled') {
      requestGeneration++
      set({ status: 'entitled', productId: result.productId, thanked: get().status !== 'entitled' || get().thanked })
      return
    }
    set({
      message: !result.opened
        ? UI.system.passRedeemUnavailable
        // iOS 16+ waited for the sheet: closed without a ticket says nothing.
        : result.awaited
          ? null
          : UI.system.passRedeemOpened,
    })
  }),
  dismissThanks: () => set({ thanked: false }),
}))

/**
 * Listen to StoreKit's transaction stream for the life of the app. A ticket
 * that arrives while the player was known NOT to have one (a code redeemed on
 * iOS 15, an Ask to Buy approval) unlocks play and earns the thank-you; one
 * that arrives while status is still being checked is just the launch state.
 */
export function listenForPassChanges(): () => void {
  let stop: (() => void) | null = null
  let cancelled = false
  void onPassChanged((change) => {
    const previous = usePass.getState().status
    if (change.status !== 'entitled' || previous === 'entitled') return
    requestGeneration++
    usePass.setState({
      status: 'entitled',
      productId: change.productId,
      message: null,
      thanked: previous === 'not-entitled' || usePass.getState().thanked,
    })
  }).then((unsubscribe) => {
    if (cancelled) unsubscribe()
    else stop = unsubscribe
  })
  return () => {
    cancelled = true
    stop?.()
  }
}
