import {
  CaseyServiceError,
  MAX_REQUEST_BYTES,
  decide,
  parseDecisionRequest,
} from './casey/orchestrator.js'
import { DATA_SHARING_PATH, handleDataSharing } from './data-sharing.js'
import {
  DEAL_MAX_REQUEST_BYTES,
  DEAL_PATH,
  DealRequestError,
  certifyDeal,
  parseDealRequest,
} from './casey/deal-contract.js'

/**
 * ClueCabulary's AI proxy — a Cloudflare Worker between the app and ollama.com.
 *
 * This is not optional and never was. A browser cannot call ollama.com: the
 * cloud API answers a CORS preflight with a redirect, and the fetch spec
 * forbids redirects on preflight, so Chrome and Safari refuse before the real
 * request is ever sent —
 *
 *   Access to fetch at 'https://ollama.com/...' has been blocked by CORS
 *   policy: Response to preflight request doesn't pass access control check:
 *   Redirect is not allowed for a preflight request.
 *
 * No API key, model name or app setting changes that. This worker answers the
 * preflight itself — never forwarding it, so there is no redirect to trip over
 * — and adds the headers the browser needs to the real response.
 *
 * Set OLLAMA_API_KEY as a Worker SECRET and the key never touches the app, the
 * repository, or the phone: the worker adds it per request and nothing that
 * reaches the browser contains it. The SEC3 decision route rejects a key from
 * the app; only the legacy generic route accepts one for compatibility with
 * older installed clients.
 *
 * Whenever the key lives here, set ALLOWED_ORIGIN too. It is enforced on the
 * way in — see originAllowed — and without it this worker will attach your key
 * to a request from anyone who learns its URL. The daily caps below are the
 * second layer, for the case where the lock is not enough.
 *
 * See proxy/README.md. Deploy: `npx wrangler deploy` from this directory, then
 * `npx wrangler secret put OLLAMA_API_KEY`.
 */

/**
 * Where requests are forwarded. Set UPSTREAM as a Worker variable to front a
 * different OpenAI-compatible service without editing this file — e.g.
 * https://generativelanguage.googleapis.com for Gemini, whose compatibility
 * layer wants the same Bearer token this worker already sends. The app's Base
 * URL keeps the path (/v1, or /v1beta/openai), so only the host moves.
 */
const DEFAULT_UPSTREAM = 'https://ollama.com'

/**
 * The origins allowed to spend this worker's key. Set ALLOWED_ORIGIN as a
 * Worker var — one origin, or several separated by commas — e.g.
 * capacitor://localhost, http://localhost:5173. Unset means anyone, which is only safe
 * while the worker holds no key of its own.
 */
const allowList = (env) =>
  (env?.ALLOWED_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)

/**
 * Model aliases: server-owned names meaning "whatever Casey thinks with
 * today". The decision route starts from CASEY_MODEL; old clients may still
 * send an alias to the legacy generic route. See proxy/wrangler.toml.
 *
 *   {"cluey": {"model": "gpt-oss:120b"}}
 *
 * The point is that the current app never names a model. Without this, changing which
 * model answers is a code change, a release, and a wait while every installed
 * PWA notices — and a model id retired upstream (ollama.com has retired
 * several) breaks every install at once with no way to fix it from here. It is
 * also what makes a blind comparison possible: three aliases can point at three
 * models without the app, or the person playing, being able to tell which.
 *
 * Per alias: `model` is required. `upstream` and `path` move it to another
 * service (Ollama serves /v1, Gemini /v1beta/openai), and `key` names the
 * secret to send instead of OLLAMA_API_KEY. `escalate` names another entry in
 * this table and is the whole cascade — see below.
 *
 * A name that is not an alias is forwarded untouched, so a real model id
 * always still works.
 */
function aliasTable(env) {
  if (!env?.MODEL_ALIASES) return {}
  try {
    const parsed = JSON.parse(env.MODEL_ALIASES)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // A typo here must not take the proxy down with it: without aliases every
    // real model id still resolves, which is the behaviour before this existed.
    return {}
  }
}

/**
 * ---------------------------------------------------------------------------
 * The legacy generic-route cascade. Kept for pre-SEC3 clients, where a cheap
 * model answers and a flagship answers again when it has to. The current
 * `/v1/casey/decision` route instead owns the full prompt/validation/correction
 * loop in `casey/orchestrator.js` and meters every actual attempt.
 * Nothing below happens until an alias carries `escalate`.
 * ---------------------------------------------------------------------------
 *
 *   MODEL_ALIASES = '{"cluey":       {"model":"<cheap>", "escalate":"cluey-hard"},
 *                     "cluey-hard":  {"model":"<flagship>"}}'
 *
 * WHERE THE DECISION LIVED FOR THE LEGACY ROUTE. The blueprint put
 * the whole cascade in this worker: one HTTP call from the app's point of view,
 * the escalation invisible. That is the wrong shape for THIS app, for a reason
 * that is structural rather than a matter of taste.
 *
 * To escalate on quality you have to be able to tell a bad answer from a good
 * one. Every check that could — the zod schemas, `checkClueLegality`, "is this
 * target actually an unrevealed green on Casey's key", "is this guessed id even
 * on the board" — needs the board and the key, and the generic handler receives
 * neither. It sees a prompt and a completion. src/ai/projections.ts is a firewall built
 * specifically so key data cannot reach a prompt, with tests asserting the
 * prompt is byte-identical under key permutation, so the information this
 * worker would need to judge a clue is information the app works hard to keep
 * out of the request. Judging here would mean re-implementing the engine in
 * this file, against a board scraped back out of prompt prose, and keeping that
 * copy in step with an app that deploys separately. It would be wrong the first
 * time the prompt is reworded, and wrong silently.
 *
 * Old app builds already had all of it. Their `askValidated` parsed,
 * runs the engine's legality check, refuses a clue naming a word that is not
 * Casey's, refuses an empty guess list — and then RETRIES, up to
 * MAX_CORRECTIONS = 3 times. So the escalation costs no extra round trip at
 * all: it is a retry that was already going to happen, sent to a better model.
 * That is the single most important property of this design, and the drive
 * measures it — the escalated call in a round is the second ATTEMPT of a call,
 * not a call of its own. A worker-side cascade would instead add a whole second
 * model call to the round, in series, on a phone, with the player watching
 * "Casey is thinking…" for twice as long.
 *
 * Whether the round also gets FASTER is a fair expectation and not a measured
 * one: a smaller model is normally quicker, and the attempt the player waits on
 * is now the smaller one. Nobody here has timed it against real models. What
 * IS certain is the direction of the round-trip count, which is unchanged.
 *
 * So that compatibility split is: THE OLD APP DECIDES, THE WORKER RESOLVES. It asks for the
 * harder tier with `?tier=escalate` and never learns what that is; the alias
 * table decides what answers, which is the same division of labour aliases
 * already have. The app needs no configuration for it, and sends the marker on
 * every corrective retry whether or not a cascade exists — with none
 * configured, the escalated request resolves to exactly the same model as the
 * first one, which is today's behaviour, unchanged, byte for byte.
 *
 * WHY A QUERY PARAMETER AND NOT A HEADER. A custom request header has to be
 * listed in Access-Control-Allow-Headers or the browser refuses the request at
 * the preflight, before it is ever sent — the X-Install-Id lesson, one section
 * down. The app and this worker deploy separately, so there is a window where a
 * new app is talking to an old worker, and in that window a header would take
 * every corrective retry down with a CORS failure mid-round. A query parameter
 * an old worker does not know about is forwarded and ignored, and the round
 * carries on with the cheap answer. Degrading is worth more here than tidiness.
 * It costs one extra CORS preflight the first time a phone escalates, because
 * the preflight cache is keyed by URL; that is one round trip a day, on a path
 * that is already the slow one.
 *
 * WHAT THIS WORKER *CAN* VERIFY, AND DOES. One fact needs no board at all: the
 * cheap tier did not answer. A 5xx, a 429, or a connection that failed is a
 * fact this worker owns, because it made the call. On any of those it re-asks
 * the escalation entry once. Note what is NOT in that list: a 404. A 404 means
 * the cheap model id is wrong or retired, and escalating past it would hide a
 * broken configuration behind a flagship bill on every single request — the
 * exact opposite of what this card is for. A 404 stays a 404 and shows up in
 * `wrangler tail`.
 *
 * The self-reported signal was considered and rejected. The blueprint escalates
 * on a `safety_margin` the model reports about itself; a model that is wrong
 * about the board is wrong about its confidence too, and the clue prompt does
 * not even return a number — the A2 lookahead names the riskiest neutral in
 * prose, inside `rationale`. Escalating on that would mean parsing English out
 * of a sentence written for a human to read, so the trigger would be a
 * regex against prose and the cost control would move to whatever the model
 * felt like claiming. Every trigger used here is a fact somebody checked.
 *
 * COST. Written out with the numbers in proxy/wrangler.toml, beside the table
 * you configure. The short version: because escalation replaces a retry rather
 * than adding a call, the cheap model would have to be REJECTED on about 95% of
 * first attempts before this costs more than one tier, at a 20:1 price ratio.
 */

/** The query parameter the app asks the harder tier with, and its one value. */
const TIER_PARAM = 'tier'
const ESCALATE = 'escalate'

/**
 * Where a failed or rejected `entry` escalates to, or null if nowhere.
 *
 * One hop, and never to itself. A cascade that could chain would turn one typo
 * in a Worker variable into an unbounded number of upstream calls per request,
 * which is the one failure mode a cost-control feature must not have.
 */
function escalationFor(table, entry) {
  const name = entry?.escalate
  if (typeof name !== 'string' || !name) return null
  const up = table[name]
  return up?.model && up !== entry ? up : null
}

/**
 * Did the cheap tier fail in a way a better model might survive?
 *
 * 5xx and 429 only. Both cost nothing — an error is not a generation — so the
 * escalation replaces a call that was never billed, and the daily cap's
 * worst-case BILL is unchanged even though one counted request made two
 * upstream calls.
 */
const upstreamFailed = (res) => res.status >= 500 || res.status === 429

/**
 * How long to wait for the cheap tier before giving up on it and asking the
 * flagship instead. CHEAP_TIMEOUT_MS; 0 (the default) means never.
 *
 * OFF BY DEFAULT ON PURPOSE, and it is the one setting here that can cost more
 * than it saves. A cheap model answering a 1,800-token clue prompt is not
 * instant, and a timeout set below what it actually takes turns EVERY request
 * into two — the abandoned one may still be billed, since it was generating
 * when it was dropped — so the cascade would double the bill and the latency at
 * once. Set it only after watching `wrangler tail` for what the cheap tier
 * really takes, and set it well above the slowest ordinary answer: it is for a
 * tier that has HUNG, not one that is thinking. The app gives up on the whole
 * request at 90 seconds (REQUEST_TIMEOUT_MS in src/ai/client.ts), so anything
 * at or above that never fires.
 *
 * It is armed only when there is an escalation to go to. A timeout with nowhere
 * to escalate would just be a slower way to fail.
 */
const DEFAULT_CHEAP_TIMEOUT_MS = 0

/**
 * Is this request allowed to use the worker's key?
 *
 * This has to be a real check on the way IN, and for a long time it was not:
 * ALLOWED_ORIGIN was only ever written into the Access-Control-Allow-Origin
 * response header, and that header is a rule the BROWSER applies to itself
 * when deciding whether a page may READ a reply. It stops nothing from being
 * sent. curl has no origin to lie about, a server-side script never asks
 * permission, and a third-party page can fire a no-cors POST it is not allowed
 * to read but which reaches the upstream all the same — with `Bearer
 * $OLLAMA_API_KEY` attached and billed to whoever deployed this. The
 * Content-Type rewrite below made that worse, laundering the text/plain body a
 * no-cors POST is limited to into the JSON the API accepts.
 *
 * A missing Origin is refused too, once a list is configured: the app is a
 * page on another host, so its requests always carry one, and the callers that
 * do not are exactly the ones this is for.
 */
function originAllowed(request, env) {
  const allowed = allowList(env)
  if (allowed.length === 0) return true
  const origin = (request.headers.get('Origin') ?? '').trim().replace(/\/+$/, '')
  return origin !== '' && allowed.includes(origin)
}

/**
 * ---------------------------------------------------------------------------
 * The daily caps: what stops one runaway client spending the whole budget.
 * ---------------------------------------------------------------------------
 *
 * The origin lock above is the first layer and it is not enough on its own. It
 * is a real check, but Origin is a header, and a header is whatever the caller
 * types — a browser refuses to lie about it, curl has no opinion at all. Anyone
 * who reads the deployed JS bundle learns this worker's address, and one line
 * of curl with `-H "Origin: <the app's origin>"` is then indistinguishable from
 * the app. So there has to be something that bounds the spend even when the
 * caller is pretending perfectly.
 *
 * THE COUNT. Two counters per UTC day, in KV: one for the install that asked,
 * one for everybody together. A request that would take either over its cap is
 * answered 429 and never reaches the upstream, so it costs nothing. Only
 * requests the worker attaches its OWN key to are counted — a player who brings
 * their own key spends their own money and is not metered.
 *
 * THE INSTALL ID IS FORGEABLE, AND THAT IS THE POINT OF THE SECOND COUNTER.
 * The id is a random string the app generates once and keeps in localStorage;
 * it arrives in a header, so a caller can send any id they like, and a new one
 * per request defeats the per-install cap entirely. That cap is honest about
 * what it is for: an accidental retry loop, a stuck client, one person hammering
 * the endpoint out of curiosity — the failure modes that actually happen. It is
 * not a defence against someone who wants to get through.
 *
 * The global counter is the cheap second signal that IS bounded whatever the
 * caller does, because there is nothing in the request that selects it. The
 * worst case for the bill is GLOBAL_DAILY_CAP calls a day, full stop. What it
 * costs is that abuse and real play share one number: a determined attacker
 * cannot spend more than the ceiling, but they can spend it, and while it is
 * spent nobody plays. That is the right way round — an outage is recoverable by
 * raising a variable in the dashboard, an unbounded bill is not — but it is a
 * real cost and not a free win.
 *
 * COUNTING IS APPROXIMATE, deliberately, and it is loosest exactly when it is
 * being attacked. KV is built for many reads and few writes, and a counter is
 * the opposite of that, so three things all point the same way:
 *
 *   - There is no atomic increment. This reads then writes, and two requests in
 *     flight together can both read the same number and both write one more.
 *   - A read can be stale. KV serves reads from a local cache and propagates
 *     writes between locations in the background, so the number this sees is
 *     not necessarily the number that has been written.
 *   - Writing one key over and over is the case KV asks you not to make, and
 *     the global counter is one key written on every metered request. Under a
 *     fast burst those writes are throttled or fail, and a failure here fails
 *     open like every other — served, uncounted.
 *
 * So the ceiling holds to an order of magnitude at ordinary rates and can be
 * overshot by a determined burst. Sharding the global key would soften the
 * third point at the cost of a read per shard on every request; Durable Objects
 * would fix all three exactly, and cost money and a paid plan, which is the
 * thing this whole feature exists to avoid. Nothing here has been measured
 * against production KV — miniflare implements the API, not the propagation —
 * so treat the ceiling as a fuse rather than an invoice, and watch the
 * Cloudflare dashboard on a launch day rather than trusting this to the digit.
 */

/**
 * How many requests one install may make in a UTC day. Override with the
 * DAILY_CAP variable; 0 means no per-install cap.
 *
 * THE ARITHMETIC, from src/engine/config.ts. Turn tokens are a shared pool and
 * each token is exactly one clue-giving, which is exactly one AI call: Casey's
 * clue is one `getClue`, and the player's clue is one `getGuesses`. There is
 * one board shape in the game since N1/N2 — 3x6, eighteen words, eight shared
 * clue tokens, for ordinary and wrap-up rounds alike — so the clue/guess calls
 * in a round are at most eight, and sudden death adds none, because there is
 * no clue-giver in it: the player just taps. Two things multiply that. A reply
 * that fails validation is asked again up to MAX_CORRECTIONS = 3 times
 * (casey/orchestrator.js — since SEC3 the corrections are model attempts
 * inside ONE app request, and each attempt is metered below), so one logical
 * call is at most 4 model attempts; and the translate box is one call per
 * word looked up, bounded in practice by the eighteen words on the board.
 *
 *   worst imaginable round    8 x 4 + 18  =  50 metered attempts
 *   ordinary round            8 to 12
 *
 * (The table this replaced listed the three retired board sizes and a 4x5
 * wrap-up; the cap below was chosen against those larger numbers and is
 * still generous.)
 *
 * An enthusiastic day is maybe ten rounds — each is five to ten minutes, so
 * that is already an hour or two of play. Ten worst-case rounds is 600. Fifteen
 * is 900. 1000 is the round number above that, which means a player who somehow
 * hits this cap has played fifteen full rounds in a day with every single reply
 * needing three corrections. Nobody does that by playing.
 *
 * Generous on purpose. Locking out the one person who loves this game is a much
 * worse outcome than serving a few hundred calls that were not strictly needed,
 * and the global ceiling below is what actually bounds the bill.
 */
const DEFAULT_DAILY_CAP = 1000

/**
 * How many requests EVERYONE may make in a UTC day, together. Override with
 * GLOBAL_DAILY_CAP; 0 means no ceiling.
 *
 * 25,000 is 25 installs at the full per-install cap, or — at the ordinary ten
 * calls a round, three rounds a sitting — around 800 people playing on the same
 * day. That is far more than this app is going to see in its first week, and it
 * is a hard bound on the worst day possible: whatever anyone does with a
 * forged install id, the upstream is asked at most this many times.
 *
 * Raise it from the Cloudflare dashboard (Settings → Variables) the moment real
 * players are anywhere near it. That is a thirty-second change with no deploy.
 */
const DEFAULT_GLOBAL_DAILY_CAP = 25_000

/**
 * The header the app puts its install id in. It must also be listed in
 * Access-Control-Allow-Headers below, or the browser refuses the request at
 * the preflight and the app cannot talk to this worker at all.
 */
const INSTALL_HEADER = 'X-Install-Id'

/** Two days: long enough that a day's counter outlives the day, short enough
 *  that nothing accumulates. KV expires these itself, so there is no cleanup. */
const COUNTER_TTL_SECONDS = 172_800

/** A marker the app can recognise, to tell this 429 from an upstream one.
 *  They mean opposite things: this one lasts until midnight, an upstream rate
 *  limit usually lasts seconds, and telling a player to come back tomorrow
 *  when they could retry now would cost them the session. */
const DAILY_CAP_CODE = 'cluecabulary_daily_cap'

/** Read a cap from a Worker variable. A typo must not silently remove the cap
 *  NOR lock everyone out, so anything unreadable falls back to the default;
 *  only a deliberate 0 disables. */
function capFrom(raw, fallback) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

/**
 * The KV key for whoever is asking.
 *
 * Sanitised rather than trusted: the id only has to be stable and unique per
 * phone, so everything outside [A-Za-z0-9_-] is dropped and the length capped.
 * That keeps a client from choosing an unbounded KV key, or one shaped like the
 * global counter's. A request with no id shares one bucket — an old build or a
 * script, and one shared cap is the right answer for both.
 */
function installBucket(request) {
  const clean = (request.headers.get(INSTALL_HEADER) ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64)
  return clean ? `i:${clean}` : 'i:no-install-id'
}

const utcDay = () => new Date().toISOString().slice(0, 10)

/**
 * Count this request, and say whether it may proceed.
 *
 * FAILS OPEN, on purpose, in every direction: no KV binding, a binding that
 * throws, a namespace that was never created. A proxy that refuses everyone
 * because a namespace id was pasted wrong is a worse outcome than an unmetered
 * one — the first breaks the app for the only player, the second costs money
 * the owner can see and stop. Every fail-open path logs, so `wrangler tail`
 * says which one happened.
 */
async function checkQuota(request, env) {
  const kv = env?.QUOTA
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    console.log('quota: no QUOTA KV binding — serving unmetered')
    return { ok: true }
  }
  const perInstall = capFrom(env?.DAILY_CAP, DEFAULT_DAILY_CAP)
  const ceiling = capFrom(env?.GLOBAL_DAILY_CAP, DEFAULT_GLOBAL_DAILY_CAP)
  if (perInstall === 0 && ceiling === 0) return { ok: true }

  const day = utcDay()
  const mine = `q:${day}:${installBucket(request)}`
  const all = `q:${day}:@all`
  try {
    const [rawMine, rawAll] = await Promise.all([kv.get(mine), kv.get(all)])
    const used = Number(rawMine) || 0
    const usedAll = Number(rawAll) || 0
    if (perInstall > 0 && used >= perInstall) return { ok: false, scope: 'install', cap: perInstall }
    if (ceiling > 0 && usedAll >= ceiling) return { ok: false, scope: 'global', cap: ceiling }
    // Only a request that is going through gets counted, so a refused one does
    // not push the number further past the cap or keep renewing its TTL.
    await Promise.all([
      kv.put(mine, String(used + 1), { expirationTtl: COUNTER_TTL_SECONDS }),
      kv.put(all, String(usedAll + 1), { expirationTtl: COUNTER_TTL_SECONDS }),
    ])
    return { ok: true }
  } catch (e) {
    console.log('quota: KV failed, serving anyway —', e?.message ?? e)
    return { ok: true }
  }
}

/** Seconds until the counters roll, for Retry-After. */
function secondsToUtcMidnight(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000))
}

/**
 * The 429 body. Shaped like an OpenAI error because that is what an
 * OpenAI-compatible endpoint should return, so a client that already reads
 * `error.message` gets a sentence rather than nothing; `code` is the marker the
 * app matches on.
 */
function capReached(scope, cap, cors) {
  const message =
    scope === 'global'
      ? `This proxy has served ${cap} requests today, which is its ceiling across every install. It resets at midnight UTC.`
      : `This install has made ${cap} requests today, which is its daily cap. It resets at midnight UTC.`
  return new Response(
    JSON.stringify({ error: { message, type: 'daily_cap_reached', code: DAILY_CAP_CODE, scope } }),
    {
      status: 429,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Retry-After': String(secondsToUtcMidnight()),
      },
    },
  )
}

function corsHeaders(request, env) {
  const allowed = allowList(env)
  const origin = (request?.headers.get('Origin') ?? '').trim().replace(/\/+$/, '')
  return {
    // A single value, never the list: this header takes one origin, and a
    // comma-joined string matches nothing. Echo whichever entry asked, so a
    // list of several works; fall back to the first so a refusal is still
    // legible in devtools rather than silently header-less.
    'Access-Control-Allow-Origin':
      allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
    // X-Install-Id belongs here or the quota never works from a browser: a
    // custom header makes the request non-simple, and a preflight that does not
    // list it is a hard refusal before the real request is ever sent.
    'Access-Control-Allow-Headers': `Authorization, Content-Type, ${INSTALL_HEADER}`,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const CASEY_PATH = '/v1/casey/decision'
const CASEY_MODEL_DEFAULT = 'cluey'

class CaseyResponse extends Error {
  constructor(response) {
    super('Casey response')
    this.response = response
  }
}

function caseyHeaders(cors) {
  return {
    ...cors,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
}

function caseyError(code, message, status, cors) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: caseyHeaders(cors),
  })
}

function serverCredentials(env, entry) {
  const secretName = entry?.key || 'OLLAMA_API_KEY'
  const secret = env?.[secretName]
  return { secretName, auth: secret ? `Bearer ${secret}` : '' }
}

function caseyEntry(env, table, options = {}) {
  const requested = options.alias ?? env?.CASEY_MODEL ?? CASEY_MODEL_DEFAULT
  const arm = String(requested).trim() || CASEY_MODEL_DEFAULT
  const base = table[arm]?.model ? table[arm] : { model: arm }
  // A named operation alias must exist in the server-owned table. Falling back
  // to a raw id here would turn a missing dictionary deployment into a model
  // selection path the browser could indirectly influence.
  if (options.alias && !table[arm]?.model) return { arm, entry: null, fallback: null }
  // The dictionary operation owns its one schema-triggered escalation in the
  // orchestrator. It never inherits the generic model cascade.
  const harder = options.alias ? null : escalationFor(table, base)
  return {
    arm,
    entry: options.escalate && harder ? harder : base,
    fallback: options.escalate ? null : harder,
  }
}

function caseyReportArm(env) {
  const arm = String(env?.CASEY_REPORT_ARM || 'cluey').trim()
  // Reporting is deliberately independent of CASEY_MODEL so a raw upstream
  // model id can never cross the decision boundary by configuration accident.
  return /^[A-Za-z0-9_-]{1,32}$/.test(arm) ? arm : 'cluey'
}

function caseyUpstreamUrl(env, entry) {
  const base = (entry?.upstream || env?.UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, '')
  const prefix = (entry?.path || '/v1').replace(/\/+$/, '')
  return `${base}${prefix}/chat/completions`
}

async function readModelContent(response) {
  const announced = Number(response.headers.get('content-length'))
  if (Number.isFinite(announced) && announced > 128 * 1024) {
    throw new CaseyServiceError('invalid_model_reply', 'the model reply was too large', 502)
  }
  const body = await response.text()
  if (new TextEncoder().encode(body).byteLength > 128 * 1024) {
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

/**
 * The new trust boundary. The browser can ask for a clue, guesses, or one
 * translation; it cannot supply a prompt, model id, upstream, or credential.
 */
async function handleCasey(request, env, cors) {
  if (request.method !== 'POST') {
    return caseyError('method_not_allowed', 'Casey decisions require POST.', 405, cors)
  }
  if (request.headers.has('Authorization')) {
    return caseyError(
      'client_credentials_forbidden',
      'Credentials belong on Casey’s server, never in the app request.',
      400,
      cors,
    )
  }
  const install = (request.headers.get(INSTALL_HEADER) ?? '').trim()
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(install)) {
    return caseyError('install_id_required', 'A valid install id is required.', 400, cors)
  }
  const contentType = (request.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return caseyError('content_type', 'Casey decisions require application/json.', 415, cors)
  }
  const announced = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(announced) && announced > MAX_REQUEST_BYTES) {
    return caseyError('request_too_large', 'The Casey request is too large.', 413, cors)
  }

  let requestText
  try {
    requestText = await request.text()
  } catch {
    return caseyError('invalid_request', 'The Casey request body could not be read.', 400, cors)
  }
  if (new TextEncoder().encode(requestText).byteLength > MAX_REQUEST_BYTES) {
    return caseyError('request_too_large', 'The Casey request is too large.', 413, cors)
  }

  let parsed
  try {
    parsed = parseDecisionRequest(JSON.parse(requestText))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return caseyError('invalid_request', 'The Casey request is not valid JSON.', 400, cors)
    }
    if (error instanceof CaseyServiceError) {
      return caseyError(error.code, error.message, error.status, cors)
    }
    return caseyError('invalid_request', 'The Casey request is invalid.', 400, cors)
  }

  const table = aliasTable(env)
  const askModel = async (messages, options) => {
    const resolved = caseyEntry(env, table, options)
    if (!resolved.entry) {
      throw new CaseyServiceError('server_not_configured', 'Casey’s dictionary service is not configured.', 503)
    }
    const credentials = serverCredentials(env, resolved.entry)
    if (!credentials.auth) {
      throw new CaseyServiceError(
        'server_not_configured',
        `Casey’s server is missing its ${credentials.secretName} secret.`,
        503,
      )
    }
    const call = async (entry) => {
      const auth = serverCredentials(env, entry)
      if (!auth.auth) {
        throw new CaseyServiceError(
          'server_not_configured',
          `Casey’s server is missing its ${auth.secretName} secret.`,
          503,
        )
      }
      // Charge every actual model attempt, including an upstream fallback or
      // transient-5xx retry. Before SEC3 those were separate browser requests;
      // moving orchestration here must not turn one accepted request into four
      // unmetered generations.
      const quota = await checkQuota(request, env)
      if (!quota.ok) throw new CaseyResponse(capReached(quota.scope, quota.cap, cors))
      return fetch(caseyUpstreamUrl(env, entry), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth.auth },
        body: JSON.stringify({
          model: entry.model,
          messages,
          temperature: options.temperature,
          response_format: { type: 'json_object' },
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
          ...(options.disableSearch ? { tools: [] } : {}),
        }),
      })
    }

    let response = null
    try {
      response = await call(resolved.entry)
    } catch (error) {
      if (error instanceof CaseyResponse || error instanceof CaseyServiceError) throw error
      console.log('casey upstream: the first tier did not answer —', error?.message ?? error)
    }
    if (resolved.fallback && (!response || upstreamFailed(response))) {
      try {
        response = await call(resolved.fallback)
      } catch (error) {
        if (error instanceof CaseyResponse || error instanceof CaseyServiceError) throw error
        console.log('casey upstream: the fallback did not answer —', error?.message ?? error)
      }
    } else if (options.retryOn5xx !== false && !resolved.fallback && response?.status >= 500) {
      // Preserve the old client's one retry on a transient 5xx. It lives here
      // now because the browser receives decisions, not upstream responses.
      try {
        response = await call(resolved.entry)
      } catch (error) {
        if (error instanceof CaseyResponse || error instanceof CaseyServiceError) throw error
        console.log('casey upstream: the 5xx retry did not answer —', error?.message ?? error)
      }
    }
    if (!response) {
      throw new CaseyServiceError('upstream_unavailable', 'Casey’s model could not be reached.', 502)
    }
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 502 : 502
      const code = response.status === 429 ? 'upstream_rate_limit' : 'upstream_error'
      throw new CaseyServiceError(code, 'Casey’s model did not answer successfully.', status)
    }
    return readModelContent(response)
  }

  // One line per decision in Workers Logs (wrangler.toml [observability]):
  // what was asked, how long it took, which arm answered. No board word,
  // clue or key ever appears here.
  const started = Date.now()
  const elapsed = () => `${Date.now() - started} ms`
  try {
    const result = await decide(parsed, askModel, caseyReportArm(env))
    console.log(`casey: ${parsed.operation} answered in ${elapsed()} — arm ${result.report.arm}${result.report.refused ? ', after a correction' : ''}`)
    return new Response(JSON.stringify(result), { status: 200, headers: caseyHeaders(cors) })
  } catch (error) {
    if (error instanceof CaseyResponse) {
      console.log(`casey: ${parsed.operation} refused in ${elapsed()} — quota`)
      return error.response
    }
    if (error instanceof CaseyServiceError) {
      console.log(`casey: ${parsed.operation} failed in ${elapsed()} — ${error.code}`)
      return caseyError(error.code, error.message, error.status, cors)
    }
    console.log(`casey: ${parsed.operation} failed in ${elapsed()} — unhandled decision error:`, error?.message ?? error)
    return caseyError('server_error', 'Casey’s server could not complete the decision.', 500, cors)
  }
}

/**
 * BQ1's separate, transient certification boundary. It neither identifies a
 * device nor reaches a model, quota store, analytics sink, or log path.
 */
async function handleDealCertification(request, cors) {
  if (request.method !== 'POST') {
    return caseyError('method_not_allowed', 'Board certification requires POST.', 405, cors)
  }
  if (request.headers.has('Authorization') || request.headers.has(INSTALL_HEADER)) {
    return caseyError(
      'identifiers_forbidden',
      'Board certification accepts neither credentials nor installation identifiers.',
      400,
      cors,
    )
  }
  const contentType = (request.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return caseyError('content_type', 'Board certification requires application/json.', 415, cors)
  }
  const announced = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(announced) && announced > DEAL_MAX_REQUEST_BYTES) {
    return caseyError('request_too_large', 'The board certification request is too large.', 413, cors)
  }
  let text
  try {
    text = await request.text()
  } catch {
    return caseyError('invalid_request', 'The board certification request could not be read.', 400, cors)
  }
  if (new TextEncoder().encode(text).byteLength > DEAL_MAX_REQUEST_BYTES) {
    return caseyError('request_too_large', 'The board certification request is too large.', 413, cors)
  }
  try {
    const answer = certifyDeal(parseDealRequest(JSON.parse(text)))
    if (!answer) {
      return caseyError('no_viable_deal', 'No certified board was available in this batch.', 409, cors)
    }
    return new Response(JSON.stringify(answer), { status: 200, headers: caseyHeaders(cors) })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DealRequestError) {
      return caseyError('invalid_request', 'The board certification request is invalid.', 400, cors)
    }
    return caseyError('certification_unavailable', 'Board certification is temporarily unavailable.', 503, cors)
  }
}

/**
 * ---------------------------------------------------------------------------
 * Anonymous usage counters (owner, 2026-09-07: analytics at launch, on by
 * default). See src/analytics/stats.ts for what the phone sends and why it
 * may be on by default: a batch is counts and nothing that names a person.
 * This route holds that line from its side — it refuses a batch that carries
 * an install id or a credential, keeps every field to a short whitelist,
 * never logs a body, and writes each event as one Analytics Engine data
 * point with NO index, so there is no per-user cardinality to query even by
 * accident. A missing STATS binding is a lost count, not a failed request.
 * ---------------------------------------------------------------------------
 */
const STATS_PATH = '/v1/stats'
const STATS_MAX_BYTES = 16 * 1024
const STATS_MAX_EVENTS = 25
const STAT_NAMES = new Set([
  'app_open',
  'onboarding_step',
  'round_start',
  'round_end',
  'train_closed',
  'casey_error',
  'audio_failed',
  'reminder_prompt',
])
const STAT_SHORT = /^[a-z0-9-]{1,32}$/
// The build stamp is a 7-char SHA on CI and "YYYY-MM-DD HH:MM" on a local
// build (vite.config.ts): the space and the colon are part of it. Measured
// 2026-09-07 with the first round played against this route from a local
// build — every batch answered 400 and nothing was counted.
const STAT_BUILD = /^[A-Za-z0-9._: -]{1,40}$/

/** The batch, checked field by field; null for anything off the shape. */
export function parseStatsBatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const allowed = new Set(['protocol', 'build', 'platform', 'lang', 'events'])
  for (const key of Object.keys(value)) if (!allowed.has(key)) return null
  if (value.protocol !== 1) return null
  if (typeof value.build !== 'string' || !STAT_BUILD.test(value.build)) return null
  if (value.platform !== 'ios' && value.platform !== 'android' && value.platform !== 'web') return null
  if (typeof value.lang !== 'string' || !/^[a-z]{2}$/.test(value.lang)) return null
  if (!Array.isArray(value.events) || value.events.length === 0 || value.events.length > STATS_MAX_EVENTS) return null
  const events = []
  for (const event of value.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null
    const keys = new Set(['name', 'city', 'mode', 'outcome', 'kind', 'n'])
    for (const key of Object.keys(event)) if (!keys.has(key)) return null
    if (!STAT_NAMES.has(event.name)) return null
    const out = { name: event.name }
    if (event.city !== undefined) {
      if (!Number.isInteger(event.city) || event.city < 0 || event.city >= 20) return null
      out.city = event.city
    }
    for (const key of ['mode', 'outcome', 'kind']) {
      if (event[key] === undefined) continue
      if (typeof event[key] !== 'string' || !STAT_SHORT.test(event[key])) return null
      out[key] = event[key]
    }
    if (event.n !== undefined) {
      if (!Number.isInteger(event.n) || event.n < 0 || event.n >= 1000) return null
      out.n = event.n
    }
    events.push(out)
  }
  return { build: value.build, platform: value.platform, lang: value.lang, events }
}

/** One Analytics Engine point per event: blobs are the dimensions, the double is the count. */
export function statsDataPoint(batch, event) {
  return {
    blobs: [
      event.name,
      batch.build,
      batch.platform,
      batch.lang,
      event.mode ?? '',
      event.outcome ?? '',
      event.kind ?? '',
      event.city === undefined ? '' : String(event.city),
    ],
    doubles: [event.n ?? 1],
    // No `indexes`: an index is the one field Analytics Engine samples and
    // groups by, and the only thing it could hold here would be a person.
  }
}

async function handleStats(request, env, cors) {
  if (request.method !== 'POST') {
    return caseyError('method_not_allowed', 'Usage statistics require POST.', 405, cors)
  }
  // The firewall from this side: a batch that could name a phone is refused
  // whole. The app never sends either header here.
  if (request.headers.has('Authorization') || request.headers.has(INSTALL_HEADER)) {
    return caseyError('identifiers_forbidden', 'Usage statistics carry no identifier.', 400, cors)
  }
  const announced = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(announced) && announced > STATS_MAX_BYTES) {
    return caseyError('request_too_large', 'The statistics batch is too large.', 413, cors)
  }
  let text
  try {
    text = await request.text()
  } catch {
    return caseyError('invalid_request', 'The statistics batch could not be read.', 400, cors)
  }
  if (new TextEncoder().encode(text).byteLength > STATS_MAX_BYTES) {
    return caseyError('request_too_large', 'The statistics batch is too large.', 413, cors)
  }
  let batch = null
  try {
    batch = parseStatsBatch(JSON.parse(text))
  } catch {
    batch = null
  }
  if (!batch) return caseyError('invalid_request', 'The statistics batch is not in the expected shape.', 400, cors)
  const stats = env?.STATS
  if (!stats || typeof stats.writeDataPoint !== 'function') {
    // Counted nowhere. Said once per isolate so the dashboard shows why the
    // numbers are missing, and never with the batch itself.
    console.log('stats: no STATS binding — a batch was dropped')
  } else {
    try {
      for (const event of batch.events) stats.writeDataPoint(statsDataPoint(batch, event))
    } catch (e) {
      console.log('stats: writeDataPoint failed —', e?.message ?? e)
    }
  }
  return new Response(null, { status: 204, headers: { ...cors, 'Cache-Control': 'no-store' } })
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    // Before anything else, and above all before the key is attached below.
    if (!originAllowed(request, env)) {
      return new Response('This proxy does not serve that origin.', { status: 403, headers: cors })
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    const url = new URL(request.url)
    if (url.pathname === DEAL_PATH) {
      if (url.search) {
        return caseyError('invalid_request', 'The board certification endpoint accepts no query parameters.', 400, cors)
      }
      return handleDealCertification(request, cors)
    }
    if (url.pathname === CASEY_PATH) {
      if (url.search) {
        return caseyError('invalid_request', 'The Casey decision endpoint accepts no query parameters.', 400, cors)
      }
      return handleCasey(request, env, cors)
    }
    if (url.pathname === DATA_SHARING_PATH) {
      if (url.search) {
        return caseyError('invalid_request', 'The data-sharing endpoint accepts no query parameters.', 400, cors)
      }
      return handleDataSharing(request, env, cors)
    }
    if (url.pathname === STATS_PATH) {
      if (url.search) {
        return caseyError('invalid_request', 'The statistics endpoint accepts no query parameters.', 400, cors)
      }
      return handleStats(request, env, cors)
    }

    // Everything below is the pre-SEC3 generic route: any path forwarded to
    // the upstream with this Worker's key attached. No shipped app has called
    // it since the decision route, and a launch hands this Worker's address to
    // every install, so it is OFF unless the LEGACY_ROUTE variable says
    // otherwise (owner, 2026-09-07). The four routes above are the whole
    // service.
    if (env?.LEGACY_ROUTE !== '1') {
      return caseyError('not_found', 'This server serves Casey decisions only.', 404, cors)
    }

    // GET is allowed for /v1/models, which is how older app builds offer a list of
    // model names rather than making you guess one.
    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Only GET and POST are supported', { status: 405, headers: cors })
    }

    const table = aliasTable(env)
    const named = Object.keys(table)

    // Is the app asking for the harder tier? It sends this on a corrective
    // retry — a reply its own validator refused — and it sends it whether or
    // not a cascade exists here, so with none configured this resolves to the
    // same model and nothing changes.
    const wantsEscalation = url.searchParams.get(TIER_PARAM) === ESCALATE

    // Resolving an alias means reading the body to see which model was asked
    // for, and a read body can no longer be streamed. So this happens only when
    // aliases are configured AND the name matches one: every other request
    // still forwards request.body untouched, which is what the app's large
    // prompts want and what the passthrough test pins.
    let alias = null
    /** Where to go if `alias` fails to answer at all; null when it is already
     *  the top tier, so an escalation can never chain into another. */
    let escalation = null
    /** The parsed body, kept only so the escalation can be re-serialised with
     *  the other model's name in it. Null whenever the body was never read. */
    let asked = null
    let body = request.method === 'POST' ? request.body : undefined
    if (request.method === 'POST' && named.length) {
      const text = await request.text()
      try {
        const parsed = JSON.parse(text)
        const found = parsed?.model ? table[parsed.model] : null
        if (found?.model) {
          const harder = escalationFor(table, found)
          if (wantsEscalation && harder) {
            alias = harder
          } else {
            alias = found
            escalation = harder
          }
          asked = parsed
          body = JSON.stringify({ ...parsed, model: alias.model })
        } else {
          body = text
        }
      } catch {
        // Not JSON, or no model in it. Forward exactly what arrived.
        body = text
      }
    }

    // The app's key wins when it sends one; otherwise the worker's own secret —
    // the alias picks WHICH secret, so an alias pointing at another service
    // brings its own credentials.
    // A bare "Bearer " counts as no key: older builds of the app sent that
    // when the field was blank, and it must not shadow the secret here.
    const fromApp = (request.headers.get('Authorization') ?? '').trim()
    const usable = fromApp && fromApp.toLowerCase() !== 'bearer' ? fromApp : ''
    /** Per entry, because the escalation may live on another service with
     *  another secret — and may be missing one the cheap tier does not need. */
    const credentials = (entry) => {
      const secretName = entry?.key || 'OLLAMA_API_KEY'
      return { secretName, auth: usable || (env?.[secretName] ? `Bearer ${env[secretName]}` : '') }
    }
    const { secretName, auth } = credentials(alias)
    if (!auth) {
      return new Response(
        `No API key: send one from the app, or set ${secretName} as a secret on this worker.`,
        { status: 401, headers: cors },
      )
    }

    // Metered only when the worker is the one paying. A request carrying the
    // player's own key spends the player's own budget, so counting it would
    // just be an arbitrary limit on somebody else's money — and it is also the
    // bring-your-own-key path in proxy/README.md, which must keep working
    // whatever the caps say. Nothing has been sent upstream yet, so a refusal
    // here costs nothing at all.
    if (!usable) {
      const quota = await checkQuota(request, env)
      if (!quota.ok) return capReached(quota.scope, quota.cap, cors)
    }

    // `tier` is this worker's own word and means nothing upstream, so it is
    // dropped. Rewritten only when it is actually there, so every other query
    // string is forwarded as the exact bytes that arrived.
    let search = url.search
    if (url.searchParams.has(TIER_PARAM)) {
      const kept = new URLSearchParams(url.search)
      kept.delete(TIER_PARAM)
      search = kept.toString() ? `?${kept}` : ''
    }

    const send = (entry, entryAuth, signal) => {
      const base = (entry?.upstream || env?.UPSTREAM || DEFAULT_UPSTREAM).replace(/\/+$/, '')
      // The app's Base URL supplies /v1; an alias on a service that serves a
      // different prefix swaps it, so host and path always move together.
      const path = entry?.path
        ? url.pathname.replace(/^\/v1/, entry.path.replace(/\/+$/, ''))
        : url.pathname
      return fetch(`${base}${path}${search}`, {
        method: request.method,
        headers: { 'Content-Type': 'application/json', Authorization: entryAuth },
        // The first attempt sends the body already built above — which may
        // still be the untouched request stream. Only an escalation re-writes
        // it, and an escalation only exists where the body was parsed.
        body: entry === alias ? body : JSON.stringify({ ...asked, model: entry.model }),
        ...(signal ? { signal } : {}),
      })
    }

    // Armed only when there is somewhere to escalate to; see the note above for
    // why this is off unless the owner deliberately sets it.
    const cheapTimeout = escalation ? capFrom(env?.CHEAP_TIMEOUT_MS, DEFAULT_CHEAP_TIMEOUT_MS) : 0

    let upstream = null
    try {
      if (cheapTimeout > 0) {
        // An AbortController cancelled the moment the headers arrive, rather
        // than AbortSignal.timeout, which would keep running and could cut the
        // response body off mid-transfer on a slow connection — a corrupted
        // reply where a slow one was the whole problem.
        const stop = new AbortController()
        const timer = setTimeout(() => stop.abort(), cheapTimeout)
        try {
          upstream = await send(alias, auth, stop.signal)
        } finally {
          clearTimeout(timer)
        }
      } else {
        upstream = await send(alias, auth)
      }
    } catch (e) {
      // Held rather than answered, because a cascade may still rescue it.
      console.log('upstream: the first attempt did not answer —', e?.message ?? e)
    }

    if (escalation && (!upstream || upstreamFailed(upstream))) {
      const alt = credentials(escalation)
      if (!alt.auth) {
        // Better a cheap failure the app can read than a 401 invented here.
        console.log(`cascade: ${escalation.model} needs ${alt.secretName}, which is not set — not escalating`)
      } else {
        console.log(
          `cascade: ${alias.model} gave ${upstream ? `HTTP ${upstream.status}` : 'nothing'} — asking ${escalation.model}`,
        )
        try {
          upstream = await send(escalation, alt.auth)
        } catch (e) {
          // Keep whatever the cheap tier said, if it said anything. Losing a
          // readable 503 to an unreachable flagship would make the round worse
          // than it was before the cascade existed.
          console.log('cascade: the escalation did not answer either —', e?.message ?? e)
        }
      }
    }

    if (!upstream) {
      // An uncaught throw here becomes Cloudflare's error page, which carries
      // no CORS headers — so the browser reports a CORS failure and the app
      // tells you to deploy the proxy you are already using. Answer ourselves.
      return new Response('Could not reach the upstream AI server.', { status: 502, headers: cors })
    }

    const headers = new Headers(upstream.headers)
    for (const [k, v] of Object.entries(cors)) headers.set(k, v)

    // Settings offers whatever /models lists, so an alias that is not in that
    // list is a name you can type but never see. Put them at the front, where
    // the one to pick is the first thing offered.
    if (request.method === 'GET' && named.length && url.pathname.endsWith('/models') && upstream.ok) {
      // Read once, then decide: upstream.body cannot be replayed after a failed
      // .json(), so parsing first and falling through would send an empty list.
      const text = await upstream.text()
      let listed = null
      try {
        listed = JSON.parse(text)
      } catch {
        // An unreadable list is still a list: send exactly what arrived.
      }
      const body = listed
        ? JSON.stringify({
            ...listed,
            data: [...named.map((id) => ({ id, object: 'model' })), ...(listed.data ?? [])],
          })
        : text
      return new Response(body, { status: upstream.status, headers })
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  },
}
