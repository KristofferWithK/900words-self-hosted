import { create } from 'zustand'
import { buildAudience } from '../build/audience'
import { UI } from '../i18n'
import {
  billingPlatform,
  buyPass,
  listPassOffers,
  onPassChanged,
  openManageSubscriptions,
  passProducts,
  planOf,
  readPassStatus,
  redeemPassCode,
  restorePass,
  type BillingPlatform,
  type PassOffer,
  type PassPlan,
  type PassProductKind,
  type PassStatus,
} from './pass'

/**
 * What the store said, in the store's own name. Apple's wording stays exactly
 * as it was on iOS (and on the web, where no purchase can start); Android
 * names Google Play and never Apple.
 */
export function purchaseMessages(platform: BillingPlatform | null = billingPlatform()) {
  const play = platform === 'android'
  return {
    pending: play ? UI.system.passPendingPlay : UI.system.passPending,
    error: play ? UI.system.passErrorPlay : UI.system.passError,
    notEntitled: play ? UI.system.passNotEntitledPlay : UI.system.passNotEntitled,
    restoreError: play ? UI.system.passRestoreErrorPlay : UI.system.passRestoreError,
  }
}

interface PassStore {
  status: PassStatus
  productId?: string
  /** Every pass product the store reported as owned; absent from older native builds. */
  ownedProductIds?: string[]
  offers: PassOffer[]
  message: string | null
  /** A purchase or a code just unlocked play; Casey says thank you. Never persisted. */
  thanked: boolean
  refresh: () => Promise<void>
  purchase: (kind: PassProductKind) => Promise<void>
  restore: () => Promise<void>
  redeemCode: () => Promise<void>
  /** "Manage or cancel subscription": Apple's sheet or page, then a fresh look at the plan. */
  manageSubscription: () => Promise<void>
  dismissThanks: () => void
}

/** The plan "Your plan" in Settings shows (pass.ts `planOf`). */
export function selectPlan(state: Pick<PassStore, 'status' | 'productId' | 'ownedProductIds'>, platform: BillingPlatform | null = billingPlatform()): PassPlan {
  return planOf(state, platform)
}

/**
 * A native build from before "Your plan" does not list what it owns. The one
 * moment the app still knows a lifetime buyer also has a monthly plan is the
 * switch itself: the subscription was there a second ago and the store does
 * not end it. Newer natives always send the list and win.
 */
function ownedAfterPurchase(
  previousProductId: string | undefined,
  result: { status: PassStatus; productId?: string; ownedProductIds?: string[] },
): string[] | undefined {
  if (result.ownedProductIds || result.status !== 'entitled') return result.ownedProductIds
  const products = passProducts()
  return previousProductId === products.monthly && result.productId === products.lifetime
    ? [products.monthly, products.lifetime]
    : undefined
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
 * This store intentionally does NOT persist. The store's verified current
 * entitlements (StoreKit on iOS, Google Play on Android) are the sole source
 * of truth; a cached Boolean could make a copied browser profile look paid.
 */
export const usePass = create<PassStore>((set, get) => ({
  status: 'checking',
  offers: [],
  message: null,
  thanked: false,
  refresh: async () => {
    if (playerActionsInFlight > 0 || buildAudience !== 'normal') return
    const mine = ++requestGeneration
    set({ status: 'checking', message: null })
    const [entitlement, offers] = await Promise.all([readPassStatus(), listPassOffers()])
    if (mine === requestGeneration) set({ status: entitlement.status, productId: entitlement.productId, ownedProductIds: entitlement.ownedProductIds, offers })
  },
  purchase: (kind) => asPlayerAction(async () => {
    const mine = ++requestGeneration
    const before = get()
    const previousProductId = before.status === 'entitled' ? before.productId : undefined
    set({ status: 'checking', message: null })
    const result = await buyPass(kind)
    if (mine !== requestGeneration) return
    const said = purchaseMessages()
    set({
      status: result.status,
      productId: result.productId,
      ownedProductIds: ownedAfterPurchase(previousProductId, result),
      thanked: result.status === 'entitled' || get().thanked,
      message: result.pending
        ? said.pending
        : result.cancelled
          ? UI.system.passCancelled
          : result.status === 'unavailable'
            ? UI.system.passUnavailable
            : result.status === 'not-entitled'
              ? said.notEntitled
              : result.status === 'error'
                ? said.error
                : null,
    })
  }),
  restore: () => asPlayerAction(async () => {
    const mine = ++requestGeneration
    set({ status: 'checking', message: null })
    const result = await restorePass()
    if (mine !== requestGeneration) return
    const said = purchaseMessages()
    set({
      status: result.status,
      productId: result.productId,
      ownedProductIds: result.ownedProductIds,
      message:
        result.status === 'not-entitled'
          ? said.notEntitled
          : result.status === 'unavailable'
            ? UI.system.passRestoreUnavailable
            : result.status === 'error'
              ? said.restoreError
              : null,
    })
  }),
  redeemCode: () => asPlayerAction(async () => {
    set({ message: null })
    const result = await redeemPassCode()
    if (result.status === 'entitled') {
      requestGeneration++
      set({ status: 'entitled', productId: result.productId, ownedProductIds: undefined, thanked: get().status !== 'entitled' || get().thanked })
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
  manageSubscription: async () => {
    set({ message: null })
    // Apple's sheet resolves when it closes; whatever the player changed there
    // is read back now. A page in the browser comes back through the app's
    // foreground refresh instead.
    const { sheet } = await openManageSubscriptions()
    if (sheet) await get().refresh()
  },
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
      ownedProductIds: change.ownedProductIds,
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
