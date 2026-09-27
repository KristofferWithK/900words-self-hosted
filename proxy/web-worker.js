/**
 * The website Casey (casey.900words.app): Casey for the playable intro on
 * 900words.app, deployed apart from the app's Worker (proxy/worker.js) with its
 * own model key, its own budget and far narrower doors. It answers only the
 * two boards the website demo can show, so it cannot be used as a free,
 * general model endpoint, and it assumes every caller might be a bot.
 *
 * Checks, in order, before any model is asked:
 *   1. kill switch        DEMO_ENABLED must be "true", else Casey is resting;
 *   2. origin             exactly one of ALLOWED_ORIGINS (the site and its preview);
 *   3. per-IP rate limit  Workers Rate Limiting bindings, held at the edge only;
 *   4. session            POST /v1/casey/session trades a Turnstile token for a
 *                         20-minute HMAC session; decisions must carry it;
 *   5. request shape      the app Worker's exact decision schema, 64 KiB cap;
 *   6. operation          clue and guess; translate within a small per-session budget;
 *   7. board lock         the view's words must be exactly the practice board
 *                         or bank_001 (proxy/data/web-demo-boards.da.json), and
 *                         the view is then REBUILT from that file: server
 *                         forms, glosses and parts of speech, one-word clues,
 *                         board words as guesses, no flagged notes. No text
 *                         the caller writes reaches a prompt except single
 *                         clue words;
 *   8. budget             DemoBudget (a Durable Object per UTC day): 5,000
 *                         decisions a day, a per-session cap, and a per-network
 *                         cap keyed by a daily-rotating one-way code (never an
 *                         address); fails closed.
 * Then one model tier, a 20 s timeout, capped tokens and at most two model
 * calls per decision. Past that, Casey plays from her own data (the
 * orchestrator's fallback), never silently spending more.
 *
 * Logs: operation, outcome and milliseconds. Never an IP, token, sid or word.
 */
import { CaseyServiceError, decide, parseDecisionRequest } from './casey/orchestrator.js'
import boardsRaw from './data/web-demo-boards.da.json'
import { DemoBudget } from './casey/demo-budget.js'

export { DemoBudget }

const readAsset = (asset) => (typeof asset === 'string' ? JSON.parse(asset) : asset)
const BOARDS = readAsset(boardsRaw)

const SESSION_PATH = '/v1/casey/session'
const DECISION_PATH = '/v1/casey/decision'
const SESSION_HEADER = 'X-Casey-Session'
const INSTALL_HEADER = 'X-Install-Id'
const SESSION_TTL_MS = 20 * 60 * 1000
const MAX_SESSION_BODY = 2 * 1024
const DEFAULT_UPSTREAM = 'https://ollama.com'
const DEFAULT_MODEL = 'gpt-oss:120b'
const DEFAULT_TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const UPSTREAM_TIMEOUT_MS = 20_000
const MODEL_CALLS_PER_DECISION = 2
const DEFAULT_MAX_TOKENS = 1200
// A dictionary lookup is a word, at most two ("god morgen"): never a sentence
// that could turn the demo's dictionary into a free prompt.
const TRANSLATE_TERM = /^[\p{L}'-]{1,24}( [\p{L}'-]{1,24})?$/u
// A clue is one word, as the app's composer enforces.
const CLUE_WORD = /^[\p{L}'-]{1,24}$/u
// The demo's views are small: 18 words and a short history fit in a few KiB.
const MAX_REQUEST_BYTES = 16 * 1024
// Casey's reasoning comes back to the caller: short, as the app shows it.
const MAX_REPLY_TEXT = 240
const MIN_SECRET_LENGTH = 32

// The orchestrator's diagnostic warnings name board words. This Worker keeps
// its logs to operation, outcome and milliseconds, so it silences them.
console.warn = () => {}

const intFrom = (raw, fallback) => {
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = allowedOrigins(env).includes(origin)
  return {
    allowed,
    headers: allowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': `Content-Type, ${INSTALL_HEADER}, ${SESSION_HEADER}`,
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' },
  }
}

function json(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  })
}

const failure = (code, message, status, cors, extra) => json({ error: { code, message } }, status, cors, extra)

function secondsToUtcMidnight(now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000))
}

const resting = (cors, status = 503) =>
  failure('casey_resting', 'Casey is resting. Come back tomorrow, or play in the app.', status, cors, {
    'Retry-After': String(secondsToUtcMidnight()),
  })

// ---- sessions: base64url(payload).base64url(HMAC-SHA256) ---------------------
const encoder = new TextEncoder()
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function mintSession(secret, now = Date.now()) {
  const sid = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const payload = b64url(encoder.encode(JSON.stringify({ v: 1, sid, exp: now + SESSION_TTL_MS })))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))
  return { token: `${payload}.${b64url(signature)}`, sid, expiresAt: now + SESSION_TTL_MS }
}

/** { sid } for a valid session, 'expired' or 'invalid' otherwise. */
export async function verifySession(secret, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512) return 'invalid'
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return 'invalid'
  let valid = false
  try {
    valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(signature), encoder.encode(payload))
  } catch {
    return 'invalid'
  }
  if (!valid) return 'invalid'
  let claims
  try {
    claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
  } catch {
    return 'invalid'
  }
  if (claims?.v !== 1 || typeof claims.sid !== 'string' || typeof claims.exp !== 'number') return 'invalid'
  if (claims.exp <= now) return 'expired'
  return { sid: claims.sid }
}

// ---- the board lock ------------------------------------------------------------
const signature = (ids, forms) => ids.map((id, i) => `${id}\u0000${forms[i]}`).sort().join('\u0001')
const PRACTICE = signature(BOARDS.practice.wordIds, BOARDS.practice.forms)
const FIRST_BOARD = signature(BOARDS.firstBoard.wordIds, BOARDS.firstBoard.forms)

/** The demo board this view plays, or null: exactly the practice board (no boardId) or bank_001. */
function boardOf(view) {
  if (!view || !Array.isArray(view.words)) return null
  const seen = signature(view.words.map((word) => word.id), view.words.map((word) => word.da))
  if (view.boardId === undefined || view.boardId === null) return seen === PRACTICE ? BOARDS.practice : null
  return view.boardId === BOARDS.firstBoard.boardId && seen === FIRST_BOARD ? BOARDS.firstBoard : null
}

export function boardAllowed(view) {
  return boardOf(view) !== null
}

/**
 * Rebuild a parsed view from the pinned board, so the only caller-written text
 * left is single clue words. Returns null when the view carries anything else.
 */
export function rebuildView(view) {
  const board = boardOf(view)
  if (!board) return null
  const index = new Map(board.wordIds.map((id, i) => [id, i]))
  const forms = new Set(board.forms)
  const words = view.words.map((word) => {
    const i = index.get(word.id)
    return {
      id: word.id,
      da: board.forms[i],
      en: board.en[i].slice(0, 6),
      pos: board.pos[i],
      reveal: word.reveal,
      ...(word.roleOnMyKey === undefined ? {} : { roleOnMyKey: word.roleOnMyKey }),
    }
  })
  const history = []
  for (const entry of view.history) {
    if (!CLUE_WORD.test(entry.text)) return null
    if (entry.guesses.some((guess) => !forms.has(guess.da))) return null
    history.push({ by: entry.by, text: entry.text, number: entry.number, guesses: entry.guesses.map((g) => ({ da: g.da, result: g.result })) })
  }
  const rebuilt = { ...view, words, history, flagged: [] }
  if (view.currentClue) {
    if (!CLUE_WORD.test(view.currentClue.text)) return null
    rebuilt.currentClue = { text: view.currentClue.text, number: view.currentClue.number }
  }
  return rebuilt
}

/** Shorten any long string in Casey's decision before it goes back out. */
function capText(value) {
  if (typeof value === 'string') return value.length > MAX_REPLY_TEXT ? `${value.slice(0, MAX_REPLY_TEXT - 1)}…` : value
  if (Array.isArray(value)) return value.map(capText)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, capText(v)]))
  return value
}

/**
 * The per-network key: an HMAC of the day and the caller's IPv4 address or
 * IPv6 /64 under the session secret. It changes every day and cannot be turned
 * back into an address; the Durable Object stores only this.
 */
async function networkKey(secret, request) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const prefix = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip
  const day = new Date().toISOString().slice(0, 10)
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`${day}|${prefix}`))
  return b64url(mac).slice(0, 22)
}

// ---- budget (DemoBudget Durable Object) ------------------------------------
async function spend(env, sid, kind, net = null) {
  if (!env.DEMO_BUDGET) return { ok: false, reason: 'unavailable' }
  const day = new Date().toISOString().slice(0, 10)
  const caps = {
    global: intFrom(env.GLOBAL_DAILY_CAP, 5000),
    session: intFrom(env.SESSION_DECISION_CAP, 40),
    translate: intFrom(env.SESSION_TRANSLATE_CAP, 5),
    net: intFrom(env.NETWORK_DAILY_CAP, 150),
  }
  try {
    const stub = env.DEMO_BUDGET.get(env.DEMO_BUDGET.idFromName(day))
    const response = await stub.fetch('https://budget/spend', {
      method: 'POST',
      body: JSON.stringify({ sid, kind, caps, net }),
    })
    return await response.json()
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

async function rateLimited(binding, request) {
  // Missing binding means a misconfigured deploy: fail closed.
  if (!binding?.limit) return true
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  try {
    const { success } = await binding.limit({ key })
    return !success
  } catch {
    return true
  }
}

// ---- the model: one tier, timed out, token-capped, two calls at most ---------
function modelFor(env) {
  const base = String(env.UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, '')
  return { url: `${base}/v1/chat/completions`, model: String(env.WEB_CASEY_MODEL ?? DEFAULT_MODEL) }
}

async function readModelContent(response) {
  const body = await response.text()
  if (encoder.encode(body).byteLength > 128 * 1024) {
    throw new CaseyServiceError('invalid_model_reply', 'the model reply was too large', 502)
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new CaseyServiceError('invalid_model_reply', 'the model returned a non-JSON envelope', 502)
  }
  const content = parsed?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0) {
    throw new CaseyServiceError('invalid_model_reply', 'the model reply was empty', 502)
  }
  return content
}

function askModelFor(env) {
  const secret = env.WEB_OLLAMA_API_KEY
  const { url, model } = modelFor(env)
  const maxTokens = intFrom(env.MAX_TOKENS, DEFAULT_MAX_TOKENS)
  const timeoutMs = Math.min(intFrom(env.UPSTREAM_TIMEOUT_MS, UPSTREAM_TIMEOUT_MS), UPSTREAM_TIMEOUT_MS) || UPSTREAM_TIMEOUT_MS
  let calls = 0
  return async (messages, options) => {
    if (!secret) throw new CaseyServiceError('server_not_configured', 'Casey’s server is missing its model key.', 503)
    // Past the per-decision allowance the orchestrator falls back to Casey's
    // own data, exactly as when the model is unreachable.
    if (calls >= MODEL_CALLS_PER_DECISION) {
      throw new CaseyServiceError('upstream_unavailable', 'the per-decision model allowance is spent', 502)
    }
    calls += 1
    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature,
          response_format: { type: 'json_object' },
          max_tokens: Math.min(maxTokens, options.maxTokens ?? maxTokens),
          reasoning_effort: 'low',
          ...(options.disableSearch ? { tools: [] } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new CaseyServiceError('upstream_unavailable', 'Casey’s model could not be reached.', 502)
    }
    if (!response.ok) {
      throw new CaseyServiceError(response.status === 429 ? 'upstream_rate_limit' : 'upstream_error', 'Casey’s model did not answer successfully.', 502)
    }
    return readModelContent(response)
  }
}

// ---- routes ------------------------------------------------------------------
const secretOk = (secret) => typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH

async function readLimited(request, limit) {
  const announced = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(announced) && announced > limit) return null
  const text = await request.text().catch(() => null)
  if (text === null || encoder.encode(text).byteLength > limit) return null
  return text
}

async function handleSession(request, env, cors) {
  if (await rateLimited(env.SESSION_RATE_LIMITER, request)) {
    return failure('rate_limited', 'Too many new sessions from here; wait a minute.', 429, cors, { 'Retry-After': '60' })
  }
  if (!secretOk(env.SESSION_SECRET) || !env.TURNSTILE_SECRET) return resting(cors)
  const text = await readLimited(request, MAX_SESSION_BODY)
  if (text === null) return failure('request_too_large', 'The session request is too large.', 413, cors)
  let token
  try {
    token = JSON.parse(text)?.turnstileToken
  } catch {
    token = undefined
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return failure('turnstile_required', 'A Turnstile token is required.', 400, cors)
  }
  const form = new FormData()
  form.set('secret', env.TURNSTILE_SECRET)
  form.set('response', token)
  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) form.set('remoteip', ip)
  let verdict
  try {
    const verify = await fetch(env.TURNSTILE_VERIFY_URL || DEFAULT_TURNSTILE_VERIFY, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10_000),
    })
    verdict = await verify.json()
  } catch {
    return failure('turnstile_unavailable', 'The bot check could not be completed.', 503, cors)
  }
  const hostnames = allowedOrigins(env).flatMap((origin) => {
    try {
      return [new URL(origin).hostname]
    } catch {
      return []
    }
  })
  if (verdict?.success !== true || verdict.action !== 'demo' || !hostnames.includes(verdict.hostname)) {
    return failure('turnstile_failed', 'The bot check did not pass.', 403, cors)
  }
  const minted = await mintSession(env.SESSION_SECRET)
  const peek = await spend(env, minted.sid, 'peek')
  if (!peek.ok) return resting(cors, peek.reason === 'global' ? 429 : 503)
  return json({ token: minted.token, expiresAt: minted.expiresAt, ttlMs: SESSION_TTL_MS }, 200, cors)
}

async function handleDecision(request, env, cors) {
  if (await rateLimited(env.DECISION_RATE_LIMITER, request)) {
    return failure('rate_limited', 'Too many requests from here; wait a minute.', 429, cors, { 'Retry-After': '60' })
  }
  if (!secretOk(env.SESSION_SECRET)) return resting(cors)
  const session = await verifySession(env.SESSION_SECRET, request.headers.get(SESSION_HEADER))
  if (session === 'expired') return failure('session_expired', 'The session has ended; start a new one.', 401, cors)
  if (session === 'invalid') return failure('session_required', 'A valid session is required.', 401, cors)
  if (request.headers.has('Authorization')) {
    return failure('client_credentials_forbidden', 'Credentials belong on Casey’s server.', 400, cors)
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test((request.headers.get(INSTALL_HEADER) ?? '').trim())) {
    return failure('install_id_required', 'A valid install id is required.', 400, cors)
  }
  const contentType = (request.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') return failure('content_type', 'Casey decisions require application/json.', 415, cors)
  const text = await readLimited(request, MAX_REQUEST_BYTES)
  if (text === null) return failure('request_too_large', 'The Casey request is too large.', 413, cors)

  let parsed
  try {
    parsed = parseDecisionRequest(JSON.parse(text))
  } catch (error) {
    if (error instanceof CaseyServiceError) return failure(error.code, error.message, error.status, cors)
    return failure('invalid_request', 'The Casey request is invalid.', 400, cors)
  }
  if (parsed.language && parsed.language !== 'da') return failure('course_not_offered', 'The website demo plays the Danish course.', 400, cors)
  let kind
  if (parsed.operation === 'clue' || parsed.operation === 'guess') {
    if (!boardAllowed(parsed.view)) return failure('board_not_offered', 'The website demo plays only its own boards.', 403, cors)
    const rebuilt = rebuildView(parsed.view)
    if (!rebuilt) return failure('view_not_offered', 'The website demo takes one-word clues on its own boards.', 400, cors)
    parsed.view = rebuilt
    kind = 'decision'
  } else if (parsed.operation === 'translate') {
    if (!TRANSLATE_TERM.test(parsed.term ?? '')) return failure('term_not_offered', 'The dictionary looks up single words.', 400, cors)
    kind = 'translate'
  } else {
    return failure('operation_not_offered', 'The website demo does not offer that.', 403, cors)
  }

  const budget = await spend(env, session.sid, kind, await networkKey(env.SESSION_SECRET, request))
  if (!budget.ok) {
    if (budget.reason === 'global') return resting(cors, 429)
    if (budget.reason === 'session') return failure('session_budget', 'This visit has used its share of Casey.', 429, cors)
    if (budget.reason === 'translate') return failure('translate_budget', 'This visit has used its dictionary lookups.', 429, cors)
    if (budget.reason === 'network') return failure('network_budget', 'This network has used its share of Casey today.', 429, cors)
    return resting(cors)
  }

  const started = Date.now()
  try {
    const result = await decide(parsed, askModelFor(env), String(env.CASEY_REPORT_ARM ?? 'web'))
    console.log(`web-casey: ${parsed.operation} answered in ${Date.now() - started} ms (${result.report.arm})`)
    return json({ ...result, decision: capText(result.decision) }, 200, cors)
  } catch (error) {
    const code = error instanceof CaseyServiceError ? error.code : 'server_error'
    console.log(`web-casey: ${parsed.operation} failed in ${Date.now() - started} ms (${code})`)
    if (error instanceof CaseyServiceError) return failure(error.code, error.message, error.status, cors)
    return failure('server_error', 'Casey’s server could not complete the decision.', 500, cors)
  }
}

export default {
  async fetch(request, env) {
    let cors = { Vary: 'Origin' }
    try {
      const result = corsFor(request, env)
      cors = result.headers
      return await route(request, env, result.allowed, cors)
    } catch {
      console.log('web-casey: unhandled error')
      return failure('server_error', 'Casey’s server could not complete the request.', 500, cors)
    }
  },
}

async function route(request, env, allowed, cors) {
  if (env.DEMO_ENABLED !== 'true') return resting(cors)
  if (!allowed) return new Response('This Casey serves only 900words.app.', { status: 403, headers: cors })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)
  if (url.search) return failure('invalid_request', 'Casey requests carry no query.', 400, cors)
  if (request.method !== 'POST') return failure('method_not_allowed', 'Use POST.', 405, cors)
  if (url.pathname === SESSION_PATH) return handleSession(request, env, cors)
  if (url.pathname === DECISION_PATH) return handleDecision(request, env, cors)
  return failure('not_found', 'Not found.', 404, cors)
}
