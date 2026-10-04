import { UI, UI_LANGUAGE } from '../i18n'
import type { UiLanguage } from '../i18n'
import type { AiClueView, AiGuessView } from './projections'
import type { LanguageCode } from '../lang/types'
import { buildAudience } from '../build/audience'

export interface AiSettings {
  /** A Casey Worker base ending in /v1. Credentials and model choice live there. */
  baseUrl: string
  /** Captured by the owning attempt; a UI-language switch only affects new rounds. */
  playerLanguage?: UiLanguage
  /** Language being learned, independent of the player's UI language. */
  courseLanguage?: LanguageCode
}

export type AiErrorKind =
  | 'cors'
  | 'network'
  | 'auth'
  | 'not-found'
  | 'rate-limit'
  | 'server'
  | 'invalid-response'

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

// The app's own Casey. A web-demo build must not even name it: the website
// talks only to its own hardened Casey, and scripts/validate-web-demo-build.mjs
// fails a demo bundle that contains this host. `__BUILD_AUDIENCE__` is a
// compile-time literal, so the minifier drops the string from demo builds.
export const OWNER_CASEY_URL =
  typeof __BUILD_AUDIENCE__ !== 'undefined' && __BUILD_AUDIENCE__ === 'web-demo'
    ? ''
    : 'https://cluecabulary-proxy.kristoffer-kai.workers.dev/v1'
export const DEFAULT_BASE_URL =
  buildAudience === 'open-source' ? __SELF_HOSTED_CASEY_URL__
    : buildAudience === 'web-demo' ? __WEB_CASEY_URL__
      : OWNER_CASEY_URL
export function assertCaseyBaseAllowed(baseUrl: string): void {
  if (buildAudience !== 'open-source') return
  // A self-built 900words has no Casey server unless its builder deployed
  // one: then Casey is not set up yet, which is not a network failure (that
  // would offer offline Casey for a round that simply has no Casey at all).
  if (!baseUrl.trim()) throw new AiError('auth', UI.system.selfHostedCaseyRequired)
  try {
    if (new URL(baseUrl).hostname.toLowerCase() !== new URL(OWNER_CASEY_URL).hostname) return
  } catch { return } // The caller rejects malformed URLs separately.
  throw new AiError('auth', UI.system.selfHostedCaseyRequired)
}
export const CASEY_PROTOCOL = 1

const AUTH_REFUSED = UI.system.caseyRefused
const DAILY_CAP_SPENT = UI.system.caseyDailyCap
const DAILY_CAP_CODE = 'cluecabulary_daily_cap'
/** The website Casey's budget is spent or the demo is switched off. */
const RESTING_CODE = 'casey_resting'
/**
 * The website Casey's per-visit and per-network shares. They rest Casey for
 * this visitor the way the day's budget does: "busy, retry" would send them
 * retrying a door that stays shut until tomorrow.
 */
const SHARE_SPENT_CODES = new Set(['session_budget', 'network_budget'])
/** The website Casey's per-visit dictionary allowance. */
const LOOKUPS_SPENT_CODE = 'translate_budget'
const SESSION_EXPIRED_CODE = 'session_expired'

/**
 * Extra request headers for a Casey that needs a session (the website demo's).
 * The app never installs one: its requests carry only the install id.
 */
export interface DecisionAuth {
  headers(): Promise<Record<string, string>>
  /** The server ended this session; the next headers() starts a new one. */
  invalidate(): void
}
let decisionAuth: DecisionAuth | null = null
export function setDecisionAuth(auth: DecisionAuth | null): void {
  decisionAuth = auth
}
let restingHandler: (() => void) | null = null
/** Told when Casey answers that she is resting (the website demo's budget). */
export function setRestingHandler(handler: (() => void) | null): void {
  restingHandler = handler
}
const REQUEST_TIMEOUT_MS = 90_000
/**
 * A request that never got an answer — the connection dropped, the isolate
 * was killed, the phone changed networks — is retried ONCE, silently, after
 * this pause, before the player is told. A timeout and being offline are not
 * retried: one already waited the full budget, the other cannot succeed.
 */
const TRANSIENT_RETRY_DELAY_MS = 1_500
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const INSTALL_ID_KEY = 'cluecab-install-id'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

let installIdCache: string | null = null

/** An opaque per-install quota bucket: random, local, and unrelated to identity. */
export function installId(): string {
  if (installIdCache) return installIdCache
  const mint = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  try {
    const stored = localStorage.getItem(INSTALL_ID_KEY)
    if (stored) return (installIdCache = stored)
    const made = mint()
    localStorage.setItem(INSTALL_ID_KEY, made)
    return (installIdCache = made)
  } catch {
    return (installIdCache = mint())
  }
}

/** Resolve the constrained decision endpoint without ever constructing an auth header. */
export function resolveEndpoint(baseUrl: string): URL {
  assertCaseyBaseAllowed(baseUrl)
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  let base: URL
  try {
    base = new URL(trimmed)
  } catch {
    throw new AiError('network', UI.system.baseUrlNotAbsolute)
  }
  const local = LOCAL_HOSTS.has(base.hostname)
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) {
    throw new AiError('network', UI.system.baseUrlNotHttps)
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new AiError('invalid-response', UI.system.baseUrlHasExtras)
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/casey/decision`
  return base
}

/** How long a reachability check waits before calling Casey unreachable. */
const REACHABLE_TIMEOUT_MS = 8_000

/**
 * Whether Casey's server answers at all: one bare OPTIONS request to the
 * decision route, which the Worker answers before any route, model call, quota
 * or counter (proxy/worker.js). Carries no install id and no game. An offline
 * round asks it to notice the internet coming back (src/ui/caseyBackOnline.ts).
 */
export async function caseyReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(resolveEndpoint(baseUrl), {
      method: 'OPTIONS',
      cache: 'no-store',
      signal: AbortSignal.timeout(REACHABLE_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

export type CaseyRequest =
  | { protocol: 1; operation: 'clue'; view: AiClueView }
  | {
      protocol: 1
      operation: 'guess'
      view: AiGuessView
      /** Optional compatibility mode: one response supplies the next guess's ranked alternatives. */
      candidateMode?: 'top-two'
    }
  | { protocol: 1; operation: 'translate'; term: string }
  | { protocol: 1; operation: 'ping' }

export interface CaseyEnvelope {
  protocol: 1
  decision: unknown
  report: { arm: string; refused: boolean }
}

export type DecisionFn = (settings: AiSettings, request: CaseyRequest) => Promise<CaseyEnvelope>

async function responseError(response: Response): Promise<never> {
  const body = await response.text().catch(() => '')
  let serverMessage = ''
  let serverCode = ''
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; message?: string } }
    serverMessage = parsed.error?.message ?? ''
    serverCode = parsed.error?.code ?? ''
  } catch {
    // An older Worker may answer in its legacy text shape. Status still tells
    // the client what category this is; its body is never echoed to a player.
  }
  if (serverCode === RESTING_CODE || SHARE_SPENT_CODES.has(serverCode)) {
    restingHandler?.()
    throw new AiError('rate-limit', UI.onboarding.demoRestingBody)
  }
  if (serverCode === LOOKUPS_SPENT_CODE) throw new AiError('rate-limit', UI.game.lookupsUsed)
  if (response.status === 401 || response.status === 403) throw new AiError('auth', AUTH_REFUSED)
  if (response.status === 404) {
    throw new AiError('not-found', UI.system.caseyNoEndpoint)
  }
  if (response.status === 429) {
    throw new AiError(
      'rate-limit',
      body.includes(DAILY_CAP_CODE) ? DAILY_CAP_SPENT : UI.system.caseyBusy,
    )
  }
  if (response.status >= 400 && response.status < 500) {
    throw new AiError('invalid-response', serverMessage || UI.system.caseyRefusedView)
  }
  if (serverCode === 'invalid_model_reply' && serverMessage) {
    // This message is authored by the operation-specific server fallback, not
    // copied from the model or its validator diagnostics.
    throw new AiError('invalid-response', serverMessage)
  }
  throw new AiError('server', UI.system.caseyServerError)
}

/**
 * The one decision body. The Worker transport below posts it, and the
 * on-device orchestrator (src/ai/gemma/decision.ts) parses the same object, so
 * a phone decision starts from exactly the request a Worker decision does.
 * Course language and player language are separate: only non-Danish courses
 * need an explicit code because the Worker defaults old clients to da.
 */
export function decisionBody(settings: AiSettings, request: CaseyRequest) {
  return {
    ...request,
    ...(settings.courseLanguage && settings.courseLanguage !== 'da'
      ? { language: settings.courseLanguage }
      : {}),
    playerLanguage: settings.playerLanguage ?? UI_LANGUAGE,
  }
}

/**
 * The browser's whole AI transport after SEC3: one typed public view in, one
 * final decision out. No prompt, model id, evaluator data, or credential is
 * present in this module or its request.
 */
export const requestDecision: DecisionFn = async (settings, request) => {
  const endpoint = resolveEndpoint(settings.baseUrl)
  const attempt = async () =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Install-Id': installId(),
        ...(decisionAuth ? await decisionAuth.headers() : {}),
      },
      // The accepting Worker must be deployed before this client.
      body: JSON.stringify(decisionBody(settings, request)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  // The failures that are final on the first try.
  const rethrowIfFinal = (error: unknown) => {
    // Already a player-facing verdict (from a session Casey's check): final.
    if (error instanceof AiError) throw error
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AiError('network', UI.system.offline)
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AiError(
        'network',
        UI.system.caseyTimeout(Math.round(REQUEST_TIMEOUT_MS / 1000)),
      )
    }
  }
  let response: Response
  try {
    response = await attempt()
  } catch (error) {
    rethrowIfFinal(error)
    await wait(TRANSIENT_RETRY_DELAY_MS)
    try {
      response = await attempt()
    } catch (again) {
      rethrowIfFinal(again)
      throw new AiError('cors', UI.system.caseyUnreachable)
    }
  }
  // A session Casey may end a session early (expiry, restart): start a new
  // one and ask once more before telling the player anything.
  if (response.status === 401 && decisionAuth && (await response.clone().text().catch(() => '')).includes(SESSION_EXPIRED_CODE)) {
    decisionAuth.invalidate()
    try {
      response = await attempt()
    } catch (again) {
      rethrowIfFinal(again)
      throw new AiError('cors', UI.system.caseyUnreachable)
    }
  }
  if (!response.ok) return responseError(response)

  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    throw new AiError('invalid-response', UI.system.caseyNonJson)
  }
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    (envelope as Partial<CaseyEnvelope>).protocol !== CASEY_PROTOCOL ||
    !('decision' in envelope) ||
    !(envelope as Partial<CaseyEnvelope>).report ||
    typeof (envelope as CaseyEnvelope).report.arm !== 'string' ||
    typeof (envelope as CaseyEnvelope).report.refused !== 'boolean'
  ) {
    throw new AiError('invalid-response', UI.system.caseyBadShape)
  }
  return envelope as CaseyEnvelope
}

/** A real model-backed probe; a healthy HTTP boundary alone is not enough. */
export async function testConnection(settings: AiSettings): Promise<void> {
  const response = await requestDecision(settings, { protocol: CASEY_PROTOCOL, operation: 'ping' })
  const decision = response.decision as { ok?: unknown }
  if (decision?.ok !== true) throw new AiError('invalid-response', UI.system.caseyPingFailed)
}
