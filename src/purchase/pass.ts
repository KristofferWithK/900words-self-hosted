import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * The identifiers are deliberately product identifiers, not display copy. They
 * must match the two Store Connect records documented in docs/store/900-pass.md.
 * Do not change one after release: StoreKit restores by this identifier.
 */
export const PASS_PRODUCTS = {
  monthly: 'com.kristofferwithk.cluecabulary.pass.monthly',
  lifetime: 'com.kristofferwithk.cluecabulary.pass.lifetime',
} as const

export type PassProductKind = keyof typeof PASS_PRODUCTS
export type PassStatus = 'checking' | 'not-entitled' | 'entitled' | 'unavailable' | 'error'

export interface PassOffer {
  id: string
  displayPrice: string
}

interface NativePassPlugin {
  status(): Promise<{ entitled: boolean; productId?: string }>
  offers(): Promise<{ offers: PassOffer[] }>
  purchase(options: { productId: string }): Promise<{
    entitled: boolean
    productId?: string
    cancelled?: boolean
    pending?: boolean
  }>
  restore(): Promise<{ entitled: boolean; productId?: string }>
  /**
   * iOS 16+ resolves when Apple's sheet closes, with the entitlement it left
   * (`awaited: true`). iOS 15 can only open the sheet; the redeemed ticket then
   * arrives through `passChanged`.
   */
  redeemCode(): Promise<{ entitled?: boolean; productId?: string; awaited?: boolean } | undefined>
  addListener(
    event: 'passChanged',
    listener: (change: { entitled: boolean; productId?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const NativePass = registerPlugin<NativePassPlugin>('Pass')

type PassOfferDiagnosticOutcome =
  | 'not-ios'
  | 'native-plugin-missing'
  | 'storekit-request-failed'
  | 'storekit-empty'
  | 'storekit-products'

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
  const knownProductIds = Object.values(PASS_PRODUCTS)
  const diagnostic = {
    event: 'pass-offers',
    outcome,
    platform: Capacitor.getPlatform(),
    requestedProductIds: knownProductIds,
    returnedProducts: returnedProducts.map(({ id, displayPrice }) => ({
      id: knownProductIds.includes(id as typeof knownProductIds[number]) ? id.slice(0, 160) : 'unknown',
      displayPrice: displayPrice.slice(0, 40),
    })),
    ...(errorCode ? { errorCode } : {}),
  }

  if (outcome === 'native-plugin-missing' || outcome === 'storekit-request-failed') {
    console.warn('900words.pass-offers', diagnostic)
  } else if (outcome === 'not-ios') {
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

/** StoreKit is the authority. A browser must never acquire an entitlement. */
export function storeKitAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
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

export async function readPassStatus(): Promise<{ status: PassStatus; productId?: string }> {
  if (!storeKitAvailable()) return { status: 'unavailable' }
  try {
    const result = await NativePass.status()
    return result.entitled
      ? { status: 'entitled', productId: result.productId }
      : { status: 'not-entitled' }
  } catch {
    // No cached localStorage flag is permitted as a fallback: if StoreKit
    // cannot verify, a paid journey stays closed until it can.
    return { status: 'error' }
  }
}

export async function listPassOffers(): Promise<PassOffer[]> {
  if (!storeKitAvailable()) {
    logPassOfferDiagnostic('not-ios')
    return []
  }
  try {
    const offers = (await NativePass.offers()).offers
    logPassOfferDiagnostic(offers.length === 0 ? 'storekit-empty' : 'storekit-products', offers)
    return offers
  } catch (error) {
    const errorCode = passErrorCode(error)
    logPassOfferDiagnostic(
      errorCode?.toUpperCase() === 'UNIMPLEMENTED' ? 'native-plugin-missing' : 'storekit-request-failed',
      [],
      errorCode,
    )
    return []
  }
}

export async function buyPass(kind: PassProductKind): Promise<{
  status: PassStatus
  productId?: string
  cancelled?: boolean
  pending?: boolean
}> {
  if (!storeKitAvailable()) return { status: 'unavailable' }
  try {
    const result = await NativePass.purchase({ productId: PASS_PRODUCTS[kind] })
    return result.entitled
      ? { status: 'entitled', productId: result.productId }
      : { status: 'not-entitled', cancelled: result.cancelled, pending: result.pending }
  } catch {
    return { status: 'error' }
  }
}

export async function restorePass(): Promise<{ status: PassStatus; productId?: string }> {
  if (!storeKitAvailable()) return { status: 'unavailable' }
  try {
    const result = await NativePass.restore()
    return result.entitled
      ? { status: 'entitled', productId: result.productId }
      : { status: 'not-entitled' }
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
    if (result?.entitled) return { opened: true, status: 'entitled', productId: result.productId, awaited: result.awaited }
    return { opened: true, awaited: result?.awaited === true }
  } catch {
    return { opened: false }
  }
}

/**
 * StoreKit's transaction stream, surfaced: a redeemed code, an Ask to Buy
 * approval, or a purchase made outside the app. Resolves to an unsubscribe.
 */
export async function onPassChanged(
  listener: (change: { status: PassStatus; productId?: string }) => void,
): Promise<() => void> {
  if (!storeKitAvailable()) return () => {}
  try {
    const handle = await NativePass.addListener('passChanged', (change) =>
      listener(change.entitled ? { status: 'entitled', productId: change.productId } : { status: 'not-entitled' }))
    return () => void handle.remove()
  } catch {
    return () => {}
  }
}
