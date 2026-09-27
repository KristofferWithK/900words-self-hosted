import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Gemma, type GemmaGeneration, type GemmaStatus } from 'cluecab-gemma'

export type { GemmaGeneration, GemmaStatus }

export const GEMMA_MODEL_LABEL = 'Gemma 4 E4B Mobile Text'
export const GEMMA_DOWNLOAD_BYTES = 2_969_059_328

const unavailable = (): GemmaStatus => ({
  supported: false,
  installed: false,
  downloading: false,
  progress: 0,
  expectedBytes: GEMMA_DOWNLOAD_BYTES,
  freeBytes: 0,
})

export function gemmaSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function gemmaStatus(): Promise<GemmaStatus> {
  if (!gemmaSupported()) return unavailable()
  return Gemma.status()
}

export async function startGemmaDownload(): Promise<void> {
  if (!gemmaSupported()) throw new Error('Gemma is available only in the 900words iPhone app.')
  await Gemma.download()
}

export async function cancelGemmaDownload(): Promise<void> {
  if (gemmaSupported()) await Gemma.cancelDownload()
}

export async function removeGemmaModel(): Promise<void> {
  if (gemmaSupported()) await Gemma.remove()
}

export async function onGemmaDownloadProgress(
  listener: (status: GemmaStatus) => void,
): Promise<PluginListenerHandle | null> {
  if (!gemmaSupported()) return null
  return Gemma.addListener('downloadProgress', listener)
}

export async function generateWithGemma(options: {
  system: string
  prompt: string
  temperature: number
  maxOutputTokens: number
}): Promise<GemmaGeneration> {
  if (!gemmaSupported()) throw new Error('Gemma is available only in the 900words iPhone app.')
  return Gemma.generate(options)
}

/** Stops the generation in progress, if any; its generateWithGemma() then rejects. */
export async function cancelGemmaGeneration(): Promise<void> {
  if (gemmaSupported()) await Gemma.cancelGeneration()
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

/** An "8 GB" iPhone reports about 7.5 GB; a 6 GB one about 5.7. */
const EIGHT_GB_CLASS_BYTES = 7_000_000_000

/** True when this iPhone reports less memory than the listed ones have. */
export function belowOfflineCaseyMemory(status: GemmaStatus): boolean {
  return status.physicalMemory !== undefined && status.physicalMemory < EIGHT_GB_CLASS_BYTES
}

/** "3.0 GB": the download's size as Settings and the first-run offer say it. */
export const gigabytes = (bytes: number): string => `${(bytes / 1_000_000_000).toFixed(1)} GB`
