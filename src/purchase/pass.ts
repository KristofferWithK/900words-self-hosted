import { Capacitor, registerPlugin } from '@capacitor/core'
import { buildAudience } from '../build/audience'

/**
 * The identifiers are deliberately product identifiers, not display copy. They
 * must match the two Store Connect records documented in docs/store/daily-games.md.
 * Do not change one after release: StoreKit restores by this identifier.
 */
export const PASS_PRODUCTS = {
  monthly: 'com.kristofferwithk.cluecabulary.pass.monthly',
  lifetime: 'com.kristofferwithk.cluecabulary.pass.lifetime',
} as const

/**
 * Google Play's pair. Play caps a product ID at 40 characters, which the App
 * Store IDs (45 and 46) exceed, and a Play ID can never be renamed or reused
 * once created, so Play sells the same two products under short IDs of its own
 * (owner, 2026-10-01). `pass.monthly` is a subscription with the base plan
 * `monthly`; `pass.lifetime` is a one-time product that is never consumed.
 */
export const PLAY_PASS_PRODUCTS = {
  monthly: 'pass.monthly',
  lifetime: 'pass.lifetime',
} as const

export type PassProductKind = keyof typeof PASS_PRODUCTS
export type PassStatus = 'checking' | 'not-entitled' | 'entitled' | 'unavailable' | 'error'
export type BillingPlatform = 'ios' | 'android'

export interface PassOffer {
  id: string
  /** The store's own localized price: StoreKit `Product.displayPrice` or Play `getFormattedPrice()`. */
  displayPrice: string
}

/**
 * The price the app shows for one product: the store's string, exactly as the
 * store formatted it for the player's storefront, currency included. That is
 * the currency the player is charged in, so the app never rewrites it.
 *
 * Null when this store has not returned the product (a browser, offline, a
 * request that failed or has not answered). Callers then show neutral copy and
 * no price at all: the device locale does not say which storefront currency a
 * player pays in, and the stores' regional prices are not conversions of one
 * another, so any number the app made up could name the wrong amount or the
 * wrong currency.
 */
export function storeDisplayPrice(offers: readonly PassOffer[], productId: string): string | null {
  const price = offers.find((offer) => offer.id === productId)?.displayPrice?.trim()
  return price ? price : null
}

/**
 * What the player has, in the words "Your plan" in Settings uses.
 *
 * `both` is the one-time purchase AND a monthly subscription that still
 * renews: the player no longer needs the subscription and should cancel it.
 * There is no `expired`: neither store plugin reports a lapsed subscription,
 * so a monthly plan that ended reads as `free`, which is what it now is.
 * `unavailable` is a browser or self-hosted build, where nothing is sold.
 */
export type PassPlan = 'checking' | 'free' | 'monthly' | 'lifetime' | 'both' | 'error' | 'unavailable'

/** Native answers carry this; older native builds leave `ownedProductIds` out. */
interface NativeEntitlement {
  entitled: boolean
  productId?: string
  /** Every pass product the store account holds now (iOS and Android since "Your plan"). */
  ownedProductIds?: string[]
}

interface NativePassPlugin {
  status(): Promise<NativeEntitlement>
  offers(): Promise<{ offers: PassOffer[] }>
  purchase(options: { productId: string }): Promise<NativeEntitlement & {
    cancelled?: boolean
    pending?: boolean
  }>
  restore(): Promise<NativeEntitlement>
  /**
   * iOS only: Apple's own subscription sheet (`AppStore.showManageSubscriptions`),
   * falling back natively to Apple's subscriptions page. Resolves when the sheet
   * closes. A native build from before "Your plan" rejects UNIMPLEMENTED.
   */
  manageSubscriptions(): Promise<{ opened: boolean; sheet?: boolean }>
  /**
   * iOS 16+ resolves when Apple's sheet closes, with the entitlement it left
   * (`awaited: true`). iOS 15 can only open the sheet; the redeemed ticket then
   * arrives through `passChanged`.
   */
  redeemCode(): Promise<{ entitled?: boolean; productId?: string; awaited?: boolean } | undefined>
  addListener(
    event: 'passChanged',
    listener: (change: NativeEntitlement) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const NativePass = registerPlugin<NativePassPlugin>('Pass')

type PassOfferDiagnosticOutcome =
  | 'no-store'
  | 'native-plugin-missing'
  | 'store-request-failed'
  | 'store-empty'
  | 'store-products'

function passErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  if (typeof code !== 'string' && typeof code !== 'number') return undefined
  const safeCode = String(code)
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(safeCode) ? safeCode : undefined
}

function logPassOfferDiagnostic(
  outcome: PassOfferDiagnosticOutcome,
  returnedProducts: readonly PassOffer[] = [],
  errorCode?: string,
): void {
  const knownProductIds: string[] = Object.values(passProducts())
  const diagnostic = {
    event: 'pass-offers',
    outcome,
    platform: Capacitor.getPlatform(),
    requestedProductIds: knownProductIds,
    returnedProducts: returnedProducts.map(({ id, displayPrice }) => ({
      id: knownProductIds.includes(id) ? id.slice(0, 160) : 'unknown',
      displayPrice: displayPrice.slice(0, 40),
    })),
    ...(errorCode ? { errorCode } : {}),
  }

  if (outcome === 'native-plugin-missing' || outcome === 'store-request-failed') {
    console.warn('900words.pass-offers', diagnostic)
  } else if (outcome === 'no-store') {
    console.debug('900words.pass-offers', diagnostic)
  } else {
    console.info('900words.pass-offers', diagnostic)
  }
}

/**
 * The travel pass is OFF for launch (owner, 2026-09-05): every city is free
 * for the first while, and the pass — StoreKit, the pass screen, the two
 * products below — stays in the tree, dormant, for when it comes. Flip this
 * one value to bring the gate back; nothing else needs to change, and
 * pass.test.ts pins the dormant model behind it so it cannot rot unnoticed.
 */
export const PASS_GATE_ENABLED = false

/** The dormant model: Sønderborg and Ribe are the complete free course. */
export const FREE_CITIES = 2

/**
 * Only the normal native store audience offers Unlimited: StoreKit on iOS,
 * Google Play Billing on Android. Other audiences never expose store billing,
 * even if their native shell has a Pass implementation.
 */
export function billingPlatform(): BillingPlatform | null {
  if (buildAudience !== 'normal' || !Capacitor.isNativePlatform()) return null
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : null
}

/** This device's store is the authority; there is no other. */
export function storeBillingAvailable(): boolean {
  return billingPlatform() !== null
}

/** Apple-only features (the offer-code sheet) ask this, not storeBillingAvailable. */
export function storeKitAvailable(): boolean {
  return billingPlatform() === 'ios'
}

/** The two product IDs this device's store sells; a browser sells none and gets Apple's pair as inert labels. */
export function passProducts(platform: BillingPlatform | null = billingPlatform()): Readonly<Record<PassProductKind, string>> {
  return platform === 'android' ? PLAY_PASS_PRODUCTS : PASS_PRODUCTS
}

/** Only this store's own two products are Unlimited. Anything else a native side reports is not. */
export function isPassProduct(productId: string | undefined, platform: BillingPlatform | null = billingPlatform()): boolean {
  return productId !== undefined && Object.values(passProducts(platform)).includes(productId)
}

/** What a store answer says the player owns, reduced to this store's own two products. */
export interface PassEntitlement {
  status: PassStatus
  productId?: string
  /** Absent when the native build predates "Your plan" and did not say. */
  ownedProductIds?: string[]
}

function entitlementFrom(result: NativeEntitlement): PassEntitlement {
  if (!result.entitled || !isPassProduct(result.productId)) return { status: 'not-entitled' }
  const owned = Array.isArray(result.ownedProductIds)
    ? result.ownedProductIds.filter((id) => isPassProduct(id))
    : undefined
  return owned
    ? { status: 'entitled', productId: result.productId, ownedProductIds: owned }
    : { status: 'entitled', productId: result.productId }
}

/** Which of the two products an ID is, on this store; null for anything else. */
export function passKind(productId: string | undefined, platform: BillingPlatform | null = billingPlatform()): PassProductKind | null {
  const products = passProducts(platform)
  if (productId === products.lifetime) return 'lifetime'
  if (productId === products.monthly) return 'monthly'
  return null
}

/**
 * The plan "Your plan" shows. Lifetime wins over monthly (both natives report
 * lifetime first); a lifetime owner whose monthly subscription still renews is
 * `both`, so the app can tell them to cancel it.
 */
export function planOf(
  entitlement: PassEntitlement,
  platform: BillingPlatform | null = billingPlatform(),
): PassPlan {
  switch (entitlement.status) {
    case 'checking': return 'checking'
    case 'error': return 'error'
    case 'unavailable': return 'unavailable'
    case 'not-entitled': return 'free'
    case 'entitled': break
  }
  const products = passProducts(platform)
  const owned = new Set(entitlement.ownedProductIds ?? [])
  if (entitlement.productId) owned.add(entitlement.productId)
  const lifetime = owned.has(products.lifetime)
  const monthly = owned.has(products.monthly)
  if (lifetime && monthly) return 'both'
  if (lifetime) return 'lifetime'
  if (monthly) return 'monthly'
  return 'free'
}

/**
 * Apple's subscription page, for when the StoreKit sheet cannot open. Apple's
 * support pages also give account.apple.com/account/manage/section/subscriptions;
 * this is the App Store's own link and opens the App Store app on an iPhone.
 */
export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'

/** The Android application ID (android/app/build.gradle `applicationId`). */
export const PLAY_PACKAGE = 'com.kristofferwithk.cluecabulary'

/**
 * Google Play's page for this one subscription, the deep link Google
 * recommends (developer.android.com/google/play/billing/subscriptions). Play's
 * subscriptions policy wants exactly this, a link to manage and cancel, in
 * Settings. There the player can cancel, change the payment method or resubscribe.
 */
export const PLAY_SUBSCRIPTION_URL =
  `https://play.google.com/store/account/subscriptions?sku=${PLAY_PASS_PRODUCTS.monthly}&package=${PLAY_PACKAGE}`

/** Where "Manage or cancel subscription" goes on this store, as a link. */
export function manageSubscriptionUrl(platform: BillingPlatform | null = billingPlatform()): string | null {
  if (platform === 'android') return PLAY_SUBSCRIPTION_URL
  if (platform === 'ios') return APPLE_SUBSCRIPTIONS_URL
  return null
}

/**
 * iOS: Apple's own sheet, where the player can see, change or cancel the
 * subscription. If the native side cannot open it (an older native build, or
 * StoreKit refused), Apple's subscriptions page opens in the system browser
 * instead. Android shows a plain link to Google Play and does not come here.
 */
export async function openManageSubscriptions(
  open: (url: string) => void = (url) => { window.open(url, '_blank', 'noopener') },
): Promise<{ opened: boolean; sheet: boolean }> {
  const platform = billingPlatform()
  if (platform === 'ios') {
    try {
      const result = await NativePass.manageSubscriptions()
      if (result?.opened) return { opened: true, sheet: result.sheet === true }
    } catch {
      // Fall through to the page.
    }
  }
  const url = manageSubscriptionUrl(platform)
  if (!url) return { opened: false, sheet: false }
  try {
    open(url)
    return { opened: true, sheet: false }
  } catch {
    return { opened: false, sheet: false }
  }
}

export function needsPassForDeparture(
  cityIndex: number,
  freeCities = FREE_CITIES,
  gateEnabled = PASS_GATE_ENABLED,
): boolean {
  return gateEnabled && cityIndex >= freeCities - 1
}

export function canBoardWithPass(
  cityIndex: number,
  status: PassStatus,
  gateEnabled = PASS_GATE_ENABLED,
): boolean {
  return !needsPassForDeparture(cityIndex, FREE_CITIES, gateEnabled) || status === 'entitled'
}

export async function readPassStatus(): Promise<PassEntitlement> {
  if (!storeBillingAvailable()) return { status: 'unavailable' }
  try {
    return entitlementFrom(await NativePass.status())
  } catch {
    // No cached localStorage flag is permitted as a fallback: if the store
    // cannot verify, a paid journey stays closed until it can.
    return { status: 'error' }
  }
}

export async function listPassOffers(): Promise<PassOffer[]> {
  if (!storeBillingAvailable()) {
    logPassOfferDiagnostic('no-store')
    return []
  }
  try {
    const offers = (await NativePass.offers()).offers
    logPassOfferDiagnostic(offers.length === 0 ? 'store-empty' : 'store-products', offers)
    return offers
  } catch (error) {
    const errorCode = passErrorCode(error)
    logPassOfferDiagnostic(
      errorCode?.toUpperCase() === 'UNIMPLEMENTED' ? 'native-plugin-missing' : 'store-request-failed',
      [],
      errorCode,
    )
    return []
  }
}

export async function buyPass(kind: PassProductKind): Promise<PassEntitlement & {
  cancelled?: boolean
  pending?: boolean
}> {
  if (!storeBillingAvailable()) return { status: 'unavailable' }
  try {
    const result = await NativePass.purchase({ productId: passProducts()[kind] })
    return result.entitled
      ? entitlementFrom(result)
      : { status: 'not-entitled', cancelled: result.cancelled, pending: result.pending }
  } catch {
    return { status: 'error' }
  }
}

export async function restorePass(): Promise<PassEntitlement> {
  if (!storeBillingAvailable()) return { status: 'unavailable' }
  try {
    return entitlementFrom(await NativePass.restore())
  } catch {
    return { status: 'error' }
  }
}

/** Opens Apple's own redemption sheet. Codes never pass through this app. */
export async function redeemPassCode(): Promise<{
  opened: boolean
  status?: PassStatus
  productId?: string
  awaited?: boolean
}> {
  if (!storeKitAvailable()) return { opened: false }
  try {
    const result = await NativePass.redeemCode()
    if (result?.entitled && isPassProduct(result.productId)) return { opened: true, status: 'entitled', productId: result.productId, awaited: result.awaited }
    return { opened: true, awaited: result?.awaited === true }
  } catch {
    return { opened: false }
  }
}

/**
 * The store's own purchase stream, surfaced: on iOS a redeemed code, an Ask to
 * Buy approval or a purchase on another device; on Android a pending purchase
 * that completed or one made in the Play Store app. Resolves to an unsubscribe.
 */
export async function onPassChanged(
  listener: (change: PassEntitlement) => void,
): Promise<() => void> {
  if (!storeBillingAvailable()) return () => {}
  try {
    const handle = await NativePass.addListener('passChanged', (change) => listener(entitlementFrom(change)))
    return () => void handle.remove()
  } catch {
    return () => {}
  }
}
