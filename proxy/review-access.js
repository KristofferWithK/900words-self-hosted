/**
 * Google Play review access: the one door a Play reviewer needs and nobody
 * else does (docs/store/daily-games.md, "Google Play review access").
 *
 * The reviewer types a code into Settings in the Android store build; this
 * route compares it with the Worker secret PLAY_REVIEW_ACCESS_CODE and answers
 * with a grant that ends REVIEW_GRANT_MS from now. The app then lifts its
 * device-local daily limit until then. Nothing here touches a purchase: no
 * product, no receipt, no Google Play state.
 *
 * FAILS CLOSED, unlike the daily caps in worker.js. Those fail open on purpose
 * (a broken quota namespace must not stop the only player); here the worst
 * case of failing open is unlimited guessing at the code, so a Worker without
 * the secret, without the QUOTA namespace, or with a KV that throws refuses
 * every request. The code is never logged, and neither is the request body.
 */
export const REVIEW_ACCESS_PATH = '/v1/review-access'
export const REVIEW_GRANT_MS = 30 * 24 * 60 * 60 * 1000
/** Attempts per client address per UTC day. A reviewer needs one. */
export const REVIEW_ATTEMPTS_PER_ADDRESS = 10
/** Attempts across everyone per UTC day: bounds the KV writes whatever the caller does. */
export const REVIEW_ATTEMPTS_PER_DAY = 1000
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60
const MAX_BODY_CHARS = 1024
const MAX_CODE_LENGTH = 200

function reply(body, status, cors, extra = {}) {
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

const refuse = (code, status, cors, extra) => reply({ error: { code } }, status, cors, extra)

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/**
 * Compare the digests, not the strings: equal-length inputs and a loop that
 * never exits early, so neither the code's length nor its first wrong
 * character shows in the response time.
 */
export async function codesMatch(given, expected) {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)])
  let difference = 0
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i]
  return difference === 0
}

/** Cloudflare sets CF-Connecting-IP; sanitised so a caller cannot shape the KV key. */
function addressBucket(request) {
  const address = (request.headers.get('CF-Connecting-IP') ?? '')
    .trim()
    .replace(/[^0-9A-Fa-f:.]/g, '')
    .slice(0, 64)
  return address || 'no-address'
}

/** Count one attempt, or say the day's allowance is spent. Throws when KV does. */
async function takeAttempt(kv, request) {
  const day = new Date().toISOString().slice(0, 10)
  const mine = `ra:${day}:${addressBucket(request)}`
  const all = `ra:${day}:@all`
  const [rawMine, rawAll] = await Promise.all([kv.get(mine), kv.get(all)])
  const used = Number(rawMine) || 0
  const usedAll = Number(rawAll) || 0
  if (used >= REVIEW_ATTEMPTS_PER_ADDRESS || usedAll >= REVIEW_ATTEMPTS_PER_DAY) return false
  await Promise.all([
    kv.put(mine, String(used + 1), { expirationTtl: COUNTER_TTL_SECONDS }),
    kv.put(all, String(usedAll + 1), { expirationTtl: COUNTER_TTL_SECONDS }),
  ])
  return true
}

export async function handleReviewAccess(request, env, cors, now = () => Date.now()) {
  if (request.method !== 'POST') return refuse('method_not_allowed', 405, cors, { Allow: 'POST, OPTIONS' })

  const secret = typeof env?.PLAY_REVIEW_ACCESS_CODE === 'string' ? env.PLAY_REVIEW_ACCESS_CODE.trim() : ''
  if (!secret) {
    console.log('review-access: refused, PLAY_REVIEW_ACCESS_CODE is not set')
    return refuse('not_configured', 503, cors)
  }
  const kv = env?.QUOTA
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    console.log('review-access: refused, no QUOTA KV binding to count attempts')
    return refuse('not_configured', 503, cors)
  }

  let code
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_CHARS) return refuse('invalid_request', 413, cors)
    code = JSON.parse(raw)?.code
  } catch {
    return refuse('invalid_request', 400, cors)
  }
  if (typeof code !== 'string' || code.trim() === '' || code.trim().length > MAX_CODE_LENGTH) {
    return refuse('invalid_request', 400, cors)
  }

  try {
    if (!(await takeAttempt(kv, request))) {
      console.log('review-access: outcome=rate-limited')
      return refuse('rate_limited', 429, cors, { 'Retry-After': '86400' })
    }
  } catch (e) {
    console.log('review-access: refused, KV failed —', e?.message ?? e)
    return refuse('unavailable', 503, cors)
  }

  if (!(await codesMatch(code.trim(), secret))) {
    console.log('review-access: outcome=invalid')
    return refuse('invalid_code', 401, cors)
  }
  console.log('review-access: outcome=granted')
  return reply({ granted: true, expiresAt: now() + REVIEW_GRANT_MS }, 200, cors)
}
