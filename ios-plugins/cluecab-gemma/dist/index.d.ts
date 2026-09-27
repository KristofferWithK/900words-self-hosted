import type { PluginListenerHandle } from '@capacitor/core'

export interface GemmaStatus {
  supported: boolean
  installed: boolean
  downloading: boolean
  progress: number
  expectedBytes: number
  freeBytes: number
  /** Bytes of RAM; absent from builds before 2026-09-27. */
  physicalMemory?: number
  error?: string
}

export interface GemmaGeneration {
  text: string
  loadMs: number
  firstTokenMs: number
  generationMs: number
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
  addListener(
    eventName: 'downloadProgress',
    listener: (status: GemmaStatus) => void,
  ): Promise<PluginListenerHandle>
}

export declare const Gemma: GemmaPlugin
