import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { AiError, type DecisionFn } from '../client'
import { UI } from '../../i18n'
import { CaseyServiceError, type CaseyAskModel } from '../../../proxy/casey/orchestrator.js'
import { decideInApp } from '../inAppCasey'
import { browserRequestUrl, ownModelComplete, ownModelEndpoint, useOwnModel, type OwnModel } from './store'

/**
 * Casey with a player's own AI key, in the open-source build: Casey's own
 * logic (src/ai/inAppCasey.ts) with the player's OpenAI-compatible service as
 * its model. No Worker is involved; the key goes to that service and nowhere
 * else, and is never logged.
 *
 * Failures are kept honest. No answer at all (offline, unreachable) and a
 * refused key or request are real errors the player sees, never quietly
 * covered by the bank's moves; only a busy or failing service falls back to
 * them, as it does on the Worker when its model is down.
 */

const ARM = 'own-key'
/** Matches the Worker transport's limit (client.ts). */
const REQUEST_TIMEOUT_MS = 90_000

interface Reply {
  status: number
  body: unknown
}

async function post(url: string, apiKey: string, body: object): Promise<Reply> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  if (Capacitor.isNativePlatform()) {
    // Native HTTP: an AI service need not accept a browser's cross-origin
    // request, and the app's web view is one. The native request is not.
    const reply = await CapacitorHttp.request({
      url,
      method: 'POST',
      headers,
      data: body,
      connectTimeout: REQUEST_TIMEOUT_MS,
      readTimeout: REQUEST_TIMEOUT_MS,
    })
    return { status: reply.status, body: reply.data }
  }
  const reply = await fetch(typeof location === 'undefined' ? url : browserRequestUrl(url, location), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  let parsed: unknown = null
  try {
    parsed = await reply.json()
  } catch {
    parsed = null
  }
  return { status: reply.status, body: parsed }
}

/** The Worker's own guard on a model reply (proxy/worker.js, readModelContent). */
const MAX_MODEL_REPLY_BYTES = 128 * 1024

export function ownKeyModel(config: OwnModel): CaseyAskModel {
  const url = ownModelEndpoint(config.baseUrl)
  return async (messages, options) => {
    // Byte for byte the body the App Store's Worker sends its model
    // (proxy/worker.js, handleCasey), so the same model plays the same Casey;
    // proxy/own-key-parity.test.mjs compares the two.
    const body = {
      model: config.model.trim(),
      messages,
      temperature: options.temperature,
      response_format: { type: 'json_object' },
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
      ...(options.disableSearch ? { tools: [] } : {}),
    }
    const send = async (): Promise<Reply> => {
      try {
        return await post(url, config.apiKey.trim(), body)
      } catch {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        throw new AiError('network', offline ? UI.system.offline : UI.system.ownKeyUnreachable)
      }
    }
    let reply = await send()
    // The Worker's one retry on a transient 5xx, unless the call opts out.
    if (reply.status >= 500 && options.retryOn5xx !== false) reply = await send()
    if (reply.status === 401 || reply.status === 403) throw new AiError('auth', UI.system.ownKeyRefused)
    if (reply.status === 400 || reply.status === 404 || reply.status === 422) {
      throw new AiError('invalid-response', UI.system.ownKeyBadRequest)
    }
    if (reply.status === 429) {
      throw new CaseyServiceError('upstream_rate_limit', 'The AI service is busy.', 429)
    }
    if (reply.status < 200 || reply.status >= 300) {
      throw new CaseyServiceError('upstream_error', 'The AI service did not answer successfully.', 502)
    }
    const content = (reply.body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]
      ?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      // The orchestrator answers this with a correction, like any bad reply.
      throw new CaseyServiceError('invalid_model_reply', 'the reply had no message content', 502)
    }
    if (new TextEncoder().encode(content).byteLength > MAX_MODEL_REPLY_BYTES) {
      throw new CaseyServiceError('invalid_model_reply', 'the model reply was too large', 502)
    }
    return content
  }
}

export const requestOwnKeyDecision: DecisionFn = async (settings, request) => {
  const config = useOwnModel.getState()
  if (!ownModelComplete(config)) throw new AiError('auth', UI.system.selfHostedCaseyRequired)
  return decideInApp(settings, request, ownKeyModel(config), ARM)
}

/** A real round trip to the player's service; no fallback answers a ping. */
export async function testOwnKeyConnection(): Promise<void> {
  const response = await requestOwnKeyDecision({ baseUrl: '' }, { protocol: 1, operation: 'ping' })
  if ((response.decision as { ok?: boolean }).ok !== true) {
    throw new AiError('invalid-response', UI.system.caseyPingFailed)
  }
}
