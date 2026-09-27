import { Engine, loadLiteRtLm, type Conversation } from '@litert-lm/core'
import type { GemmaGeneration, GemmaStatus } from 'cluecab-gemma'
import { Sha256 } from './sha256'

/**
 * Gemma on a computer, in the open-source build's browser (owner,
 * 2026-09-27: the desktop self-build gets the Gemma download and offline
 * mode the iPhone has). Google's LiteRT-LM for the web runs the web build of
 * the same Gemma 4 E4B on the graphics card, through WebGPU (Chrome or Edge).
 *
 * These are the iPhone plugin's functions (native.ts sends the browser
 * here), so Settings, the download panel and Casey's logic in
 * inAppCasey.ts cannot tell the two apart. The model comes once from the
 * Hugging Face revision the iPhone pins, is checked against its SHA-256 as
 * it arrives, and is kept in this site's private storage (OPFS); playing
 * sends nothing anywhere.
 *
 * Measured on an RTX 4090 Laptop GPU in Chromium (see docs/DECISIONS.md).
 */

const REVISION = '2eee7ac325f20eb8c9ac1d0e972f7c84663062da'
const FILE = 'gemma-4-E4B-it-web.litertlm'
export const WEB_MODEL_URL = `https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/${REVISION}/${FILE}`
export const WEB_MODEL_BYTES = 2_969_059_328
export const WEB_MODEL_SHA256 = '3904d826d5dddd25ea173e85204caec09e68ba038116e9b992b69cbdc94f57a0'
/** Prompt and reply together: the iPhone's 8,192 (decision.ts CONTEXT_TOKENS). */
export const WEB_CONTEXT_TOKENS = 8_192

const DIRECTORY = 'gemma'
const MARKER = 'ready.json'
/**
 * The model is kept in 1 GiB parts. Chromium refuses to grow one private
 * file past 2 GiB (measured: every write failed at 2.08 GB with a
 * QuotaExceededError, on an origin with 6.29 GB free), and a Blob made of the
 * parts streams to the engine as one file without a copy.
 */
const PART_BYTES = 1 << 30
const PARTS = Math.ceil(WEB_MODEL_BYTES / PART_BYTES)
const partName = (index: number) => `${FILE}.part${index}`
const partSize = (index: number) => Math.min(PART_BYTES, WEB_MODEL_BYTES - index * PART_BYTES)

/**
 * A downloaded chunk cut where parts end, given how much of the current part
 * is already written: each piece, and whether it fills its part.
 */
export function* cutAtParts(
  chunk: Uint8Array<ArrayBuffer>,
  filled: number,
  partBytes = PART_BYTES,
): Generator<{ piece: Uint8Array<ArrayBuffer>; fillsPart: boolean }> {
  for (let offset = 0; offset < chunk.length; ) {
    const piece = chunk.subarray(offset, offset + (partBytes - filled))
    offset += piece.length
    filled = (filled + piece.length) % partBytes
    yield { piece, fillsPart: filled === 0 }
  }
}
/** Room to spare beyond the model before a download is started. */
const HEADROOM_BYTES = 200_000_000

/**
 * Where the model is fetched from. Development builds may point it at a
 * local copy (a drive, or a second test without a second 3 GB download);
 * a built app always fetches the pinned revision.
 */
const SOURCE_OVERRIDE_KEY = 'cluecab-gemma-web-source'
function modelSource(): string {
  if (import.meta.env.DEV) {
    try {
      const local = localStorage.getItem(SOURCE_OVERRIDE_KEY)
      if (local && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(local)) return local
    } catch {
      // No storage: the pinned source.
    }
  }
  return WEB_MODEL_URL
}

let supportCheck: Promise<boolean> | null = null
let downloading: AbortController | null = null
let progress = 0
let lastError: string | undefined
const listeners = new Set<(status: GemmaStatus) => void>()

/** WebGPU with a real adapter, and private file storage to keep the model in. */
function supported(): Promise<boolean> {
  supportCheck ??= (async () => {
    try {
      if (!('gpu' in navigator) || typeof navigator.storage?.getDirectory !== 'function') return false
      const gpu = (navigator as Navigator & { gpu: { requestAdapter(o?: object): Promise<unknown> } }).gpu
      return (await gpu.requestAdapter({ powerPreference: 'high-performance' })) !== null
    } catch {
      return false
    }
  })()
  return supportCheck
}

async function directory(): Promise<FileSystemDirectoryHandle> {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true })
}

async function installed(): Promise<boolean> {
  try {
    const dir = await directory()
    const marker = JSON.parse(await (await (await dir.getFileHandle(MARKER)).getFile()).text()) as { sha256?: string }
    if (marker.sha256 !== WEB_MODEL_SHA256) return false
    for (let index = 0; index < PARTS; index++) {
      if ((await (await dir.getFileHandle(partName(index))).getFile()).size !== partSize(index)) return false
    }
    return true
  } catch {
    return false
  }
}

/** The stored model, as one Blob over its parts. */
async function storedModel(): Promise<Blob> {
  const dir = await directory()
  const parts: Blob[] = []
  for (let index = 0; index < PARTS; index++) parts.push(await (await dir.getFileHandle(partName(index))).getFile())
  return new Blob(parts)
}

async function freeBytes(): Promise<number> {
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate()
    return Math.max(0, quota - usage)
  } catch {
    return 0
  }
}

export async function status(): Promise<GemmaStatus> {
  if (!(await supported())) {
    return { supported: false, installed: false, downloading: false, progress: 0, expectedBytes: WEB_MODEL_BYTES, freeBytes: 0 }
  }
  return {
    supported: true,
    installed: downloading ? false : await installed(),
    downloading: downloading !== null,
    progress,
    expectedBytes: WEB_MODEL_BYTES,
    freeBytes: await freeBytes(),
    ...(lastError ? { error: lastError } : {}),
  }
}

async function notify(): Promise<void> {
  if (listeners.size === 0) return
  const now = await status()
  for (const listener of listeners) listener(now)
}

export function onProgress(listener: (status: GemmaStatus) => void): { remove: () => Promise<void> } {
  listeners.add(listener)
  return { remove: async () => void listeners.delete(listener) }
}

async function forget(dir: FileSystemDirectoryHandle): Promise<void> {
  const names = [MARKER, ...Array.from({ length: PARTS + 1 }, (_, index) => partName(index))]
  for (const name of names) await dir.removeEntry(name).catch(() => {})
}

/**
 * Fetch, hash and store the model. Resolves once it has started; progress
 * and the end arrive through onProgress, as the iPhone plugin's do.
 */
export async function download(): Promise<void> {
  if (downloading) return
  if (!(await supported())) throw new Error('Gemma needs a browser with WebGPU, such as Chrome or Edge.')
  if ((await freeBytes()) < WEB_MODEL_BYTES + HEADROOM_BYTES) {
    throw new Error('There is not enough free space in this browser for Gemma (3 GB).')
  }
  // Ask the browser not to evict a 3 GB file under storage pressure.
  await navigator.storage.persist?.().catch(() => false)
  const controller = new AbortController()
  downloading = controller
  progress = 0
  lastError = undefined
  void notify()
  void (async () => {
    const dir = await directory()
    await forget(dir)
    try {
      const response = await fetch(modelSource(), { signal: controller.signal })
      if (!response.ok || !response.body) throw new Error(`The download failed (${response.status}).`)
      const hash = new Sha256()
      const reader = response.body.getReader()
      let received = 0
      let reported = 0
      let part = 0
      let inPart = 0
      let writer = await (await dir.getFileHandle(partName(part), { create: true })).createWritable()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          hash.update(value)
          received += value.length
          progress = Math.min(1, received / WEB_MODEL_BYTES)
          if (progress - reported >= 0.005) {
            reported = progress
            void notify()
          }
          for (const { piece, fillsPart } of cutAtParts(value, inPart)) {
            await writer.write(piece)
            inPart = fillsPart ? 0 : inPart + piece.length
            if (fillsPart) {
              await writer.close()
              part += 1
              writer = await (await dir.getFileHandle(partName(part), { create: true })).createWritable()
            }
          }
        }
        await writer.close()
      } catch (error) {
        await writer.abort().catch(() => {})
        throw error
      }
      if (received !== WEB_MODEL_BYTES || hash.hex() !== WEB_MODEL_SHA256) {
        throw new Error('The download was damaged. Please try again.')
      }
      const marker = await (await dir.getFileHandle(MARKER, { create: true })).createWritable()
      await marker.write(JSON.stringify({ revision: REVISION, sha256: WEB_MODEL_SHA256, bytes: received }))
      await marker.close()
    } catch (error) {
      await forget(dir)
      if (!controller.signal.aborted) lastError = error instanceof Error ? error.message : String(error)
    } finally {
      downloading = null
      progress = 0
      void notify()
    }
  })()
}

export async function cancelDownload(): Promise<void> {
  downloading?.abort()
}

let engine: Promise<Engine> | null = null
let queue: Promise<unknown> = Promise.resolve()
let current: Conversation | null = null

/** Where the app serves LiteRT-LM's WebAssembly (vite.config.ts, litertLmWasm). */
const wasmBase = () => `${import.meta.env.BASE_URL}litert-lm/wasm/`

function loadEngine(): Promise<Engine> {
  engine ??= (async () => {
    await loadLiteRtLm(wasmBase())
    const file = await storedModel()
    // The package's default backend, GPU_ARTISAN, is the one that streams the
    // model into the graphics card. Plain GPU first copies all 2.97 GB into
    // WebAssembly memory, and the browser refuses the allocation (measured).
    return Engine.create({ model: file, mainExecutorSettings: { maxNumTokens: WEB_CONTEXT_TOKENS } })
  })()
  engine.catch(() => {
    engine = null
  })
  return engine
}

export async function remove(): Promise<void> {
  await cancelDownload()
  const loaded = engine
  engine = null
  await loaded?.then((e) => e.delete()).catch(() => {})
  await forget(await directory())
  void notify()
}

/** A streamed piece of Gemma's reply: its text, whichever shape it came in. */
function textOf(message: { content?: string | readonly { type: string; text?: unknown }[] }): string {
  if (typeof message.content === 'string') return message.content
  return (message.content ?? []).map((part) => (part.type === 'text' && typeof part.text === 'string' ? part.text : '')).join('')
}

/** One generation at a time, as on the iPhone: each waits for the one before. */
export function generate(options: {
  system: string
  prompt: string
  temperature: number
  maxOutputTokens: number
}): Promise<GemmaGeneration> {
  const run = queue.then(async () => {
    if (!(await installed())) throw new Error('Gemma is not downloaded yet.')
    let start = performance.now()
    const loaded = await loadEngine()
    const loadMs = performance.now() - start
    const conversation = await loaded.createConversation({
      preface: { messages: [{ role: 'system', content: options.system }] },
      sessionConfig: { samplerParams: { temperature: options.temperature }, maxOutputTokens: options.maxOutputTokens },
    })
    current = conversation
    try {
      start = performance.now()
      let firstTokenMs = 0
      let text = ''
      const reader = conversation.sendMessageStreaming(options.prompt).getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!firstTokenMs) firstTokenMs = performance.now() - start
        text += textOf(value)
      }
      return { text, loadMs, firstTokenMs, generationMs: performance.now() - start }
    } finally {
      current = null
      await conversation.delete().catch(() => {})
    }
  })
  queue = run.catch(() => {})
  return run
}

/** Stops the generation in progress; its generate() then settles early. */
export async function cancelGeneration(): Promise<void> {
  current?.cancel()
}
