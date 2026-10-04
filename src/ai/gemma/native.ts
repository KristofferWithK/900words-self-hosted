import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Gemma, type GemmaGeneration, type GemmaStatus } from 'cluecab-gemma'

export type { GemmaGeneration, GemmaStatus }

export const GEMMA_MODEL_LABEL = 'Gemma 4 E4B Mobile Text'
/**
 * The iPhone's download. Android downloads a larger file of the same model
 * (3.66 GB, GemmaModel.kt); what Settings shows is always the plugin's own
 * `expectedBytes`.
 */
export const GEMMA_DOWNLOAD_BYTES = 2_969_059_328

const unavailable = (): GemmaStatus => ({
  supported: false,
  installed: false,
  downloading: false,
  progress: 0,
  expectedBytes: GEMMA_DOWNLOAD_BYTES,
  freeBytes: 0,
})

/*
 * The desktop self-build (`__WEB_GEMMA__`, vite.config.ts) runs Gemma in the
 * browser instead (web.ts), behind these same functions. Every web branch
 * tests the literal at its use site, so rolldown folds the lazy chunk (and
 * LiteRT-LM with it) out of every other build.
 */

export type GemmaPlatform = 'ios' | 'android'

/** The native app offline Casey's plugin is built into, or null (the web). */
export function gemmaPlatform(): GemmaPlatform | null {
  if (!Capacitor.isNativePlatform()) return null
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : null
}

/**
 * Whether this app carries the plugin at all: the iPhone and Android apps.
 * Whether THIS phone can run her is the plugin's own answer, in
 * `gemmaStatus().supported`: every iPhone may try, while an Android phone
 * without Android 12, a 64-bit processor or an 8 GB-class memory is refused
 * before the download (GemmaCapability.kt).
*/
export function gemmaSupported(): boolean {
  return gemmaPlatform() !== null
}

export async function gemmaStatus(): Promise<GemmaStatus> {
  if (__WEB_GEMMA__) return (await import('./web')).status()
  if (!gemmaSupported()) return unavailable()
  return Gemma.status()
}

export async function startGemmaDownload(): Promise<void> {
  if (__WEB_GEMMA__) return (await import('./web')).download()
  if (!gemmaSupported()) throw new Error('Gemma is available only in the 900words iPhone and Android apps.')
  await Gemma.download()
}

export async function cancelGemmaDownload(): Promise<void> {
  if (__WEB_GEMMA__) return (await import('./web')).cancelDownload()
  if (gemmaSupported()) await Gemma.cancelDownload()
}

export async function removeGemmaModel(): Promise<void> {
  if (__WEB_GEMMA__) return (await import('./web')).remove()
  if (gemmaSupported()) await Gemma.remove()
}

export async function onGemmaDownloadProgress(
  listener: (status: GemmaStatus) => void,
): Promise<PluginListenerHandle | null> {
  if (__WEB_GEMMA__) return (await import('./web')).onProgress(listener)
  if (!gemmaSupported()) return null
  return Gemma.addListener('downloadProgress', listener)
}

export async function generateWithGemma(options: {
  system: string
  prompt: string
  temperature: number
  maxOutputTokens: number
}): Promise<GemmaGeneration> {
  if (__WEB_GEMMA__) return (await import('./web')).generate(options)
  if (!gemmaSupported()) throw new Error('Gemma is available only in the 900words iPhone and Android apps.')
  return Gemma.generate(options)
}

/** Stops the generation in progress, if any; its generateWithGemma() then rejects. */
export async function cancelGemmaGeneration(): Promise<void> {
  if (__WEB_GEMMA__) return (await import('./web')).cancelGeneration()
  if (gemmaSupported()) await Gemma.cancelGeneration()
}

/**
 * Frees offline Casey's memory (about 3.4 GB) once nothing needs her. The
 * next generation loads her again. Harmless when she is not loaded.
 */
export async function unloadGemma(): Promise<void> {
  if (gemmaSupported()) await Gemma.unloadModel()
}

/**
 * Whether a generation failed because the phone put the model away: the
 * player left the app mid-turn (iOS runs no GPU work in the background, and
 * Android kills a background app holding gigabytes first), so the turn is
 * asked again once they are back rather than given up on.
 */
export function wasPutAway(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'PUT_AWAY'
}

/**
 * The iPhones offline Casey is meant for: 8 GB of memory or more, which is
 * the same set as Apple Intelligence (owner, 2026-09-27: say it needs a newer
 * phone, and list them). Model names are the same in every language. An
 * estimate until the device gate measures real phones; the app warns rather
 * than refuses below it.
 */
export const OFFLINE_CASEY_IPHONES: readonly string[] = [
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',
  'iPhone 16',
  'iPhone 16 Plus',
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
  'iPhone 16e',
  'iPhone 17',
  'iPhone Air',
  'iPhone 17 Pro',
  'iPhone 17 Pro Max',
]

/**
 * Android phones offline Casey is meant for, shown as examples: there are too
 * many models to list them all, so the explanation names the memory (12 GB,
 * what Google's own Gallery app asks for Gemma 4 E4B) and these. All have
 * 12 GB or more and a GPU driver LiteRT-LM can use (Google measured the S26
 * Ultra). An estimate until the device gate measures real phones; a phone
 * below 12 GB is warned, not refused, down to the 8 GB class
 * (GemmaCapability.kt refuses below that).
 */
export const OFFLINE_CASEY_ANDROID_EXAMPLES: readonly string[] = [
  'Samsung Galaxy S24 Ultra',
  'Galaxy S25',
  'Galaxy S25+',
  'Galaxy S25 Ultra',
  'Galaxy S26 Ultra',
]

/** An "8 GB" iPhone reports about 7.5 GB; a 6 GB one about 5.7. */
const EIGHT_GB_CLASS_BYTES = 7_000_000_000
/** A "12 GB" Android phone reports about 11 to 11.6 GB; a 10 GB one under 10. */
const TWELVE_GB_CLASS_BYTES = 10_500_000_000

/**
 * True when this phone reports less memory than the ones offline Casey is
 * meant for: the listed iPhones (8 GB), or on Android the 12 GB phones.
 */
export function belowOfflineCaseyMemory(
  status: GemmaStatus,
  platform: GemmaPlatform | null = gemmaPlatform(),
): boolean {
  const floor = platform === 'android' ? TWELVE_GB_CLASS_BYTES : EIGHT_GB_CLASS_BYTES
  return status.physicalMemory !== undefined && status.physicalMemory < floor
}

/** "3.0 GB": the download's size as Settings and the first-run offer say it. */
export const gigabytes = (bytes: number): string => `${(bytes / 1_000_000_000).toFixed(1)} GB`
