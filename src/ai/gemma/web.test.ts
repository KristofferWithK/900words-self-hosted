import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Desktop Gemma (web.ts): the iPhone plugin's functions, in a browser, over
 * WebGPU and the site's private storage. The engine itself only runs in a
 * real browser on a real graphics card; these pin everything around it.
 */

const engineCreate = vi.fn()
const loadLiteRtLm = vi.fn(async (_path: string) => ({}))
vi.mock('@litert-lm/core', () => ({
  Backend: { GPU: 4 },
  loadLiteRtLm: (path: string) => loadLiteRtLm(path),
  Engine: { create: (settings: unknown) => engineCreate(settings) },
}))

/** A fake origin-private file system: names to bytes, or a stand-in size. */
function fakeStorage() {
  const files = new Map<string, { bytes: Uint8Array; size?: number }>()
  const fileHandle = (name: string) => ({
    async getFile() {
      const entry = files.get(name)
      if (!entry) throw new DOMException('missing', 'NotFoundError')
      const blob = new Blob([entry.bytes as BlobPart])
      // A 2.97 GB model is stood in for by its size alone.
      return { size: entry.size ?? blob.size, text: () => blob.text() }
    },
    async createWritable() {
      const chunks: Uint8Array[] = []
      return {
        write: async (data: Uint8Array | string) =>
          void chunks.push(typeof data === 'string' ? new TextEncoder().encode(data) : data.slice()),
        close: async () => {
          const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
          let at = 0
          for (const c of chunks) {
            bytes.set(c, at)
            at += c.length
          }
          files.set(name, { bytes })
        },
        abort: async () => {},
      }
    },
  })
  const directory = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError')
      return fileHandle(name)
    },
    async removeEntry(name: string) {
      if (!files.delete(name)) throw new DOMException('missing', 'NotFoundError')
    },
  }
  return { files, root: { getDirectoryHandle: async () => directory } }
}

let storage: ReturnType<typeof fakeStorage>

const GIB = 1 << 30
/** The model as web.ts stores it: three parts and a marker, sizes only. */
function installModel(web: { WEB_MODEL_BYTES: number; WEB_MODEL_SHA256: string }, sizes = [GIB, GIB, web.WEB_MODEL_BYTES - 2 * GIB]) {
  sizes.forEach((size, index) => storage.files.set(`gemma-4-E4B-it-web.litertlm.part${index}`, { bytes: new Uint8Array(1), size }))
  storage.files.set('ready.json', { bytes: new TextEncoder().encode(JSON.stringify({ sha256: web.WEB_MODEL_SHA256 })) })
}
const withGpu = (adapter: unknown) => ({
  gpu: { requestAdapter: async () => adapter },
  storage: {
    getDirectory: async () => storage.root,
    estimate: async () => ({ quota: 20e9, usage: 1e9 }),
    persist: async () => true,
  },
})

beforeEach(() => {
  vi.resetModules()
  storage = fakeStorage()
  engineCreate.mockReset()
  loadLiteRtLm.mockClear()
})
afterEach(() => vi.unstubAllGlobals())

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('Gemma in the browser', () => {
  it('is not offered without WebGPU', async () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => storage.root } })
    const web = await import('./web')
    expect(await web.status()).toMatchObject({ supported: false, installed: false })
    await expect(web.download()).rejects.toThrow('WebGPU')
  })

  it('counts as downloaded only with its marker and its exact size', async () => {
    vi.stubGlobal('navigator', withGpu({}))
    const web = await import('./web')
    expect((await web.status()).installed).toBe(false)
    installModel(web)
    expect(await web.status()).toMatchObject({ supported: true, installed: true, downloading: false })
    // A short last part, a missing part or no marker: not downloaded.
    installModel(web, [GIB, GIB, 12])
    expect((await web.status()).installed).toBe(false)
    installModel(web)
    storage.files.delete('gemma-4-E4B-it-web.litertlm.part1')
    expect((await web.status()).installed).toBe(false)
    installModel(web)
    storage.files.delete('ready.json')
    expect((await web.status()).installed).toBe(false)
  })

  it('refuses and removes a download that is not the pinned file', async () => {
    vi.stubGlobal('navigator', withGpu({}))
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url)
      return new Response(new Uint8Array(1024))
    })
    const web = await import('./web')
    await web.download()
    await settle()
    const after = await web.status()
    expect(fetched).toEqual([web.WEB_MODEL_URL])
    expect(after).toMatchObject({ installed: false, downloading: false, error: 'The download was damaged. Please try again.' })
    expect(storage.files.size).toBe(0)
  })

  it('cuts what arrives exactly where each part ends', async () => {
    const { cutAtParts } = await import('./web')
    const cut = (length: number, filled: number) =>
      [...cutAtParts(new Uint8Array(length), filled, 8)].map(({ piece, fillsPart }) => [piece.length, fillsPart])
    expect(cut(10, 5)).toEqual([[3, true], [7, false]])
    expect(cut(20, 0)).toEqual([[8, true], [8, true], [4, false]])
    expect(cut(3, 5)).toEqual([[3, true]])
    expect(cut(2, 0)).toEqual([[2, false]])
  })

  it('says so when the browser has no room for her, before fetching anything', async () => {
    const navigator = withGpu({})
    navigator.storage.estimate = async () => ({ quota: 2e9, usage: 0 })
    vi.stubGlobal('navigator', navigator)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const web = await import('./web')
    await expect(web.download()).rejects.toThrow('not enough free space')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('plays one generation at a time, with the iPhone’s context and the turn’s own settings', async () => {
    vi.stubGlobal('navigator', withGpu({}))
    const web = await import('./web')
    installModel(web)
    const conversations: { config: unknown; order: number[] }[] = []
    const order: number[] = []
    engineCreate.mockImplementation(async () => ({
      createConversation: async (config: unknown) => {
        const n = conversations.length
        conversations.push({ config, order })
        return {
          sendMessageStreaming: () =>
            new ReadableStream({
              async start(controller) {
                order.push(n)
                await new Promise((resolve) => setTimeout(resolve, 5))
                controller.enqueue({ role: 'model', content: [{ type: 'text', text: '{"clue":' }] })
                controller.enqueue({ role: 'model', content: `"kaffe"}` })
                order.push(n)
                controller.close()
              },
            }),
          delete: async () => {},
          cancel: () => {},
        }
      },
    }))
    const ask = { system: 'You are Casey.', prompt: 'Give a clue.', temperature: 0.4, maxOutputTokens: 400 }
    const [first, second] = await Promise.all([web.generate(ask), web.generate({ ...ask, maxOutputTokens: 480 })])
    expect(first.text).toBe('{"clue":"kaffe"}')
    expect(second.text).toBe('{"clue":"kaffe"}')
    expect(order).toEqual([0, 0, 1, 1])
    expect(engineCreate).toHaveBeenCalledOnce()
    expect(engineCreate.mock.calls[0]![0]).toMatchObject({ mainExecutorSettings: { maxNumTokens: 8192 } })
    // GPU_ARTISAN, the package default, is the backend that streams the model.
    expect(engineCreate.mock.calls[0]![0]).not.toHaveProperty('backend')
    expect(loadLiteRtLm).toHaveBeenCalledWith('/litert-lm/wasm/')
    expect(conversations[0]!.config).toEqual({
      preface: { messages: [{ role: 'system', content: 'You are Casey.' }] },
      sessionConfig: { samplerParams: { temperature: 0.4 }, maxOutputTokens: 400 },
    })
    expect(conversations[1]!.config).toMatchObject({ sessionConfig: { maxOutputTokens: 480 } })
  })

  it('will not play before she is downloaded', async () => {
    vi.stubGlobal('navigator', withGpu({}))
    const web = await import('./web')
    await expect(web.generate({ system: '', prompt: '', temperature: 0, maxOutputTokens: 1 })).rejects.toThrow('not downloaded')
    expect(engineCreate).not.toHaveBeenCalled()
  })
})
