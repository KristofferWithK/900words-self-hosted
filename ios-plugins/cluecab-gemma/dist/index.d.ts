import type { PluginListenerHandle } from '@capacitor/core'

export interface GemmaStatus {
  /**
   * Whether this phone can run offline Casey. Always true on an iPhone; on
   * Android, false on a phone that cannot load the model at all (see
   * `unsupportedReason`).
   */
  supported: boolean
  installed: boolean
  downloading: boolean
  progress: number
  expectedBytes: number
  freeBytes: number
  /** Bytes of RAM; absent from builds before 2026-09-27. */
  physicalMemory?: number
  /** Android only, when `supported` is false: the first thing this phone lacks. */
  unsupportedReason?: 'android-version' | 'abi' | 'memory'
  /** Android only, once the model has loaded: the processor she runs on. */
  backend?: 'gpu' | 'cpu'
  error?: string
}

export interface GemmaGeneration {
  text: string
  loadMs: number
  firstTokenMs: number
  generationMs: number
  /** Android only: 'gpu' or 'cpu', for the device-gate log. */
  backend?: string
}

export interface GemmaPlugin {
  status(): Promise<GemmaStatus>
  download(): Promise<{ started: boolean }>
  cancelDownload(): Promise<void>
  remove(): Promise<void>
  generate(options: {
    system: string
    prompt: string
    temperature: number
    maxOutputTokens: number
  }): Promise<GemmaGeneration>
  /** Stops the generation in progress, if any; its generate() call then rejects. */
  cancelGeneration(): Promise<void>
  /**
   * Frees the loaded model; the next generate() loads it again. Leaving the
   * app does the same on its own. A generate() it interrupts rejects with
   * code 'PUT_AWAY'.
   */
  unloadModel(): Promise<void>
  addListener(
    eventName: 'downloadProgress',
    listener: (status: GemmaStatus) => void,
  ): Promise<PluginListenerHandle>
}

export declare const Gemma: GemmaPlugin
