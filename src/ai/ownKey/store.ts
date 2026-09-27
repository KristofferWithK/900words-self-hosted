import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AiError } from '../client'
import { UI } from '../../i18n'

/**
 * A player's own AI service, for the open-source build (owner, 2026-09-27:
 * self-builders use local Gemma or add their own API key in Settings).
 *
 * Any OpenAI-compatible chat-completions service: its address, a model name,
 * and the player's key. Kept in its own storage slot rather than in
 * `cluecab-settings-v1`, so it is never part of a settings blob or a backup
 * file (backup/ names the stores it carries), and the key is only ever sent to
 * this address (src/ai/ownKey/decision.ts).
 */
export interface OwnModel {
  baseUrl: string
  model: string
  apiKey: string
}

export const OWN_MODEL_STORAGE_KEY = 'cluecab-own-ai-v1'
/**
 * The App Store build's own configuration (proxy/wrangler.toml: Ollama's
 * gpt-oss 120B at ollama.com), so a self-builder who pastes an Ollama key
 * plays the same Casey (owner, 2026-09-27). proxy/own-key-parity.test.mjs
 * pins the request against the Worker's.
 */
export const DEFAULT_OWN_MODEL_BASE_URL = 'https://ollama.com/v1'
export const DEFAULT_OWN_MODEL = 'gpt-oss:120b'

interface OwnModelStore extends OwnModel {
  set: (patch: Partial<OwnModel>) => void
}

export const useOwnModel = create<OwnModelStore>()(
  persist(
    (set) => ({
      baseUrl: DEFAULT_OWN_MODEL_BASE_URL,
      model: DEFAULT_OWN_MODEL,
      apiKey: '',
      set: (patch) => set(patch),
    }),
    {
      name: OWN_MODEL_STORAGE_KEY,
      version: 1,
      partialize: ({ baseUrl, model, apiKey }) => ({ baseUrl, model, apiKey }),
    },
  ),
)

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The chat-completions address for a service's base URL (…/v1). https only,
 * or plain http to this machine (a local Ollama or LM Studio); never a user
 * name, query or fragment, which is where a key could leak into a log.
 */
export function ownModelEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  let base: URL
  try {
    base = new URL(trimmed)
  } catch {
    throw new AiError('invalid-response', UI.system.baseUrlNotAbsolute)
  }
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && LOCAL_HOSTS.has(base.hostname))) {
    throw new AiError('invalid-response', UI.system.baseUrlNotHttps)
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new AiError('invalid-response', UI.system.baseUrlHasExtras)
  }
  return `${trimmed}/chat/completions`
}

/** Where vite.config.ts's dev and preview servers pass ollama.com through. */
export const OLLAMA_CLOUD_PASS_THROUGH = '/ollama-cloud'

/**
 * Where a browser actually sends a request for this endpoint. Ollama Cloud
 * refuses a browser's cross-origin preflight, so a page on this machine (the
 * self-build's `npm run dev` or `npm run preview`) sends ollama.com requests
 * through its own server, which forwards them to ollama.com and nowhere else.
 * Every other address, and every page on another host, is left alone. The
 * iPhone app never asks: its requests are native, not cross-origin.
 */
export function browserRequestUrl(endpoint: string, page: { hostname: string; origin: string }): string {
  const target = new URL(endpoint)
  if (target.origin !== 'https://ollama.com' || !LOCAL_HOSTS.has(page.hostname)) return endpoint
  return `${page.origin}${OLLAMA_CLOUD_PASS_THROUGH}${target.pathname}`
}

/** Whether all three fields are filled in; the service still has to answer. */
export function ownModelComplete(config: OwnModel): boolean {
  return config.baseUrl.trim() !== '' && config.model.trim() !== '' && config.apiKey.trim() !== ''
}
