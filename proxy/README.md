# Casey's server boundary

The Cloudflare Worker is Casey's production brain boundary. A current app sends
one constrained game view to `POST /v1/casey/decision` and receives one finished
decision. The Worker—not the browser—owns:

- the prompts and corrective conversation;
- model selection, credentials, fallback and escalation;
- response parsing, clue legality and target validation;
- the authored city matrices, clue books and deal indexes (cities 1, 2 and 9),
  the City 1 association index and its per-board legal-clue precompute, the
  City 1 authored clue bank (`authored-clues.da.1.json`, Casey's groups for
  her key per authored board), the City 1 player keys per authored board
  (`authored-player-keys.da.1.json`) and the compact LCSI-v4 strengths
  (`lcsi.da.1.json`), all in `proxy/data/` and never bundled;
- the evaluator that may reject a risky model clue.

The Worker serves five routes and nothing else: `/v1/casey/decision`,
`/v1/casey/deal`, `/v1/data-sharing/events`, `/v1/stats` and
`/v1/review-access` (Google Play review access, `review-access.js`; fails
closed without the `PLAY_REVIEW_ACCESS_CODE` secret and the `QUOTA`
namespace, see docs/store/daily-games.md). The pre-SEC3
generic route — any path forwarded to the upstream with this Worker's key —
answers 404 unless the `LEGACY_ROUTE` variable is `1` (owner, 2026-09-07); no
shipped app calls it, and the miniflare drives set the variable to test its
passthrough contract. `/v1/stats` takes the app's anonymous usage counters
(`src/analytics/stats.ts`): a batch of named events with no identifier of any
kind, refused whole if it carries an install id or a credential, written one
indexless data point per event to the `STATS` Analytics Engine dataset
(`wrangler.toml`, `cluecab_stats`) and never logged. Query it from the
Cloudflare dashboard's Analytics Engine SQL: blobs are
`name, build, platform, lang, mode, outcome, kind, city`, the double is the
count.

The evaluator is advice to a model-backed agent. It never answers instead of a
model, with one deliberate exception (owner, 2026-09-06): a player clue that
the index links to two or more of the player's greens on an authored City 1
board and to nothing else on it is answered from that key with certainty and
no model call, and the ledger arm says `authored` so no round credits the
model with it (`casey/authored-player-clues.js`). Whether a city is new,
complete or revisited is not part of the protocol. An authored city uses the evaluator on every eligible board; an
unauthored or mixed-city board gets ordinary model-backed play.

On a board made entirely from the replacement City 1 first-100 roster, Casey
also gets a compact board-specific association packet before reasoning. While
clue-giving it contains legal multi-target starts plus every other live board
word the same clue indexes; while guessing it contains only exact normalized
clue hits among currently guessable words. These are positive, unscored leads,
not certified strengths: Casey still judges the semantic fit and full board,
and a missing link is explicitly unknown. Mixed and other-city boards receive
no packet and stay on the existing model path. The guess packet is built from
the key-free projection and contains no roles.

## The boundary

The model decision endpoint may request exactly four operations:

| Operation | Browser sends | Worker returns |
| --- | --- | --- |
| `clue` | Casey's public clue projection, including Casey's own key roles | a legal clue, count, target IDs and model rationale |
| `guess` | the key-free public guess projection and current clue | ranked guesses |
| `translate` | one word | one translation |
| `ping` | no game data | a model-backed health result |

Every request uses protocol version `1`. Unknown fields are rejected, including
`messages`, `model`, credentials and arbitrary key-shaped fields. The decision
route never accepts an `Authorization` header from the app. Requests are capped
at 64 KiB, nested strings and arrays have their own bounds, model replies are
capped at 128 KiB, and a logical decision gets at most three corrective model
replies after the first attempt.

The response contains the final decision and a tiny report (`arm`, `refused`).
It never contains prompts, model IDs, evaluator scores, books, matrices or association indexes, and
all decision responses—including errors and quota refusals—are `no-store`.

BQ1 has a separate necessary-gameplay endpoint at `POST /v1/casey/deal`.
It accepts exactly 48 candidate word-ID arrays with aligned anonymous need
weights and up to four recent board-ID arrays, only for complete city 1, 2 or 9
batches. It rejects installation IDs, authorization headers, keys, clues, word
text, raw SRS history, analytics and every unknown field. The route derives the
same weighted key seed in memory on both sides and returns only up to eight
opaque candidate indices; no key, seed, score, route or evaluator evidence
leaves the Worker. It does not call a model, quota/KV, analytics or logging path,
sets `Cache-Control: no-store`, and retains nothing. This processing still runs
under Private play because it is required to enforce the board-quality floor,
not an optional data-sharing event. A timeout, invalid response or empty viable
set leaves the client on a labelled local fallback, never a false hard result.

H10 adds a separate, explicitly consented boundary at
`POST /v1/data-sharing/events` and `DELETE /v1/data-sharing/events`. It is not
an AI operation and never reaches a model provider. Diagnostics contain only
round counts/outcomes and expire after 30 days; Casey-learning events may also
contain clues, guessed word IDs and outcomes and expire after 90 days. Both
schemas reject unknown fields. Records use a dedicated `DATA_SHARING` KV
binding; a missing binding fails closed with 503. DELETE removes every record
for the request's random installation ID.

`proxy/data/*.json` are Worker text modules. They deploy with the Worker and are
not client-package files. `npm run build` finishes by scanning every production
client asset for corpus filenames, packed matrix samples, authored book
rationales, private association fingerprints and server prompt/correction sentinels. The mutation tests in
`proxy/client-boundary.test.mjs` prove the gate fails if any of those are
injected into a client chunk.

## Abuse and spend safeguards

`ALLOWED_ORIGIN` is an exact comma-separated allowlist. The shipping caller and
the two private browser-development callers must be present:

| Caller | Origin |
| --- | --- |
| Private Vite development | `http://localhost:5173` |
| Private Vite preview | `http://localhost:4173` |
| Capacitor iOS app | `capacitor://localhost` |

An Origin never includes a path. When an allowlist is configured, a foreign or
missing Origin is rejected before parsing or model access. Origin is only a
browser boundary—a script can forge that header—so the Worker also requires a
bounded random `X-Install-Id` and meters model calls in Cloudflare KV.

| Variable | Default | Limit |
| --- | ---: | --- |
| `DAILY_CAP` | 1000 | model attempts per installation per UTC day |
| `GLOBAL_DAILY_CAP` | 25000 | model attempts across everyone per UTC day |

Every actual upstream attempt is charged: initial calls, corrective retries,
transient-5xx retries and model fallbacks. The per-install ID is deliberately
not identity and is forgeable; the global cap is the hard cost ceiling a caller
cannot select. KV counters are a best-effort fuse rather than exact billing
because KV increments are not atomic. If KV is absent or unavailable the Worker
fails open and logs it, so the app remains playable but the deployment is
unmetered. The workflow summary makes that state visible.

## Model configuration

The app never chooses a model. `CASEY_MODEL` selects a server-side alias and
defaults to `cluey`. `MODEL_ALIASES` resolves it. `CASEY_REPORT_ARM` is the
separate opaque label allowed into the response/ledger, so even accidentally
putting a raw provider id in `CASEY_MODEL` does not expose it:

```toml
MODEL_ALIASES = '{"cluey":{"model":"gpt-oss:120b"}}'
```

L1 adds a second server-only alias for the dictionary's genuine offline misses.
It is deliberately not `CASEY_MODEL`: normal clue/guess work remains on Casey;
the translate operation tries `casey-dictionary` once and only malformed output
gets one normal-Casey attempt. The browser still names no model or provider.

```toml
MODEL_ALIASES = '''{"cluey":{"model":"gpt-oss:120b"},
  "casey-dictionary":{"model":"gpt-oss:120b"}}'''
```

The request is JSON-only, `temperature: 0.1`, capped at 160 output tokens, and
uses low reasoning and disables tooling. Both aliases currently use Ollama and
the same Worker-only `OLLAMA_API_KEY`; the dictionary alias remains separate so
its provider can change later without an app release.

A corrective reply can escalate without revealing either model:

```toml
MODEL_ALIASES = '''{"cluey":{"model":"SMALL","escalate":"cluey-hard"},
  "cluey-hard":{"model":"FLAGSHIP"}}'''
```

An alias may also set `upstream`, `path` and `key` to use another
OpenAI-compatible provider. The named secret must be uploaded to Cloudflare.
With no per-alias override, the Worker uses `UPSTREAM` (default
`https://ollama.com`), `/v1`, and `OLLAMA_API_KEY`.

## Deploy

The safe release order for SEC3 is load-bearing:

1. Deploy this Worker first. It supports both the new decision route and the
   legacy generic proxy route.
2. Test `POST /v1/casey/decision` through the app's **Test connection** button.
3. Only then deploy the client that requires the decision route.

The old `/v1/chat/completions` and `/v1/models` forwarding behavior remains for
already-installed pre-SEC3 clients. It is compatibility code, not the current
trust boundary, and should be removed only after those clients no longer need
it. A new Worker can therefore be deployed before the app without breaking
normal play; deploying the app first would break Casey until the Worker catches
up.

### From GitHub Actions

Add these repository secrets once:

- `CLOUDFLARE_API_TOKEN` from the **Edit Cloudflare Workers** template;
- `CLOUDFLARE_ACCOUNT_ID`;
- `OLLAMA_API_KEY`.

Then run **Actions → Deploy the AI proxy → Run workflow**. The workflow creates
or reuses the `QUOTA` KV namespace, binds it, deploys every Worker module and
uploads the model key as an encrypted Worker secret. The app already points at
this repository's Worker. A self-hosted deployment can use the reported URL
plus `/v1` in **Settings → Base URL**; there is no device key or model step.

### From a computer

```bash
cd proxy
npx wrangler login
npx wrangler kv namespace create QUOTA
npx wrangler kv namespace create DATA_SHARING
# add the printed namespace id to [[kv_namespaces]] in wrangler.toml
npx wrangler deploy
npx wrangler secret put OLLAMA_API_KEY
```

Use Wrangler or the workflow rather than pasting only `worker.js` into the
dashboard editor: Casey now consists of multiple modules and the private data
shards.

## Verification

The boundary is exercised at three levels:

```bash
npm test
npm run build
node scripts/run-drives.mjs ai proxy
```

- `proxy/casey/orchestrator.test.mjs` pins prompt/legality/evaluator parity,
  authored-city correction, model-backed replay and unauthored-city behavior.
- `proxy/casey-boundary.test.mjs` pins the strict route, server credentials and
  model choice, origin/install/size rejection, per-attempt quota, final-only
  decisions, and BQ1's no-ID/no-model certification route.
- `proxy/casey/deal-contract.test.mjs` pins BQ1's exact request allowlist and
  opaque-index-only response.
- `proxy/worker.test.mjs` keeps the legacy compatibility route and all existing
  origin, alias, fallback and KV branches covered.
- the browser drives run the real built app through the unmodified Worker in
  Miniflare and a credential-checking fake model provider.

Nothing local can prove the deployed KV binding or secret exists. After an
owner deploy, confirm the workflow reports the cap as active and run **Test
connection** from private local development and the iOS shell.

## The website Casey (casey.900words.app)

`web-worker.js` is a second, separate Worker: Casey for the playable intro on
900words.app (`BUILD_AUDIENCE=web-demo`, served at `/play/`). It shares the
orchestrator and the private City 1 data with `worker.js` and nothing else:
its own name (`900words-web-casey`), domain, model key and budget, deployed by
`wrangler.web.toml` through `.github/workflows/deploy-web-casey.yml` (manual,
behind the protected `web-casey` environment).

It assumes every caller may be a bot. Before any model is asked:

- `DEMO_ENABLED` must be `true` (the kill switch; anything else: resting);
- the Origin must be exactly one of `ALLOWED_ORIGINS`;
- per-IP Workers Rate Limiting bindings (sessions 3/min, decisions 20/min),
  failing closed when missing;
- `POST /v1/casey/session` trades a Cloudflare Turnstile token (action
  `demo`, our hostnames) for a 20-minute HMAC session; decisions carry it as
  `X-Casey-Session`;
- the app Worker's exact decision schema (16 KiB), then `clue`/`guess` only
  on the two demo boards (the practice board, or `bank_001`), matched word for
  word against `data/web-demo-boards.da.json`, and the view REBUILT from that
  file: server forms, glosses and parts of speech, one-word clues, board
  words as guesses, no flagged notes. `translate` for one or two words, 5 per
  session; everything else is refused;
- `DemoBudget`, a Durable Object per UTC day: `GLOBAL_DAILY_CAP` (5,000)
  decisions a day, 40 per session (a whole demo takes about 15), and
  `NETWORK_DAILY_CAP` (150) per network, keyed by a daily-rotating HMAC of
  the IPv4 address or IPv6 /64 so no address is stored; exact, failing closed.

Then one model tier with a 20 s timeout, `max_tokens` and `reasoning_effort:
low`, at most two model calls per decision; past that the orchestrator plays
from Casey's own data, and any long text in the reply is shortened to 240
characters. Logs carry operation, outcome and milliseconds only; the
orchestrator's word-bearing warnings are silenced and Cloudflare's invocation
logs are off. The kill switch and caps can be changed in the dashboard for
the day; the next deploy restores `wrangler.web.toml`'s values.

Tests: `proxy/web-worker.test.mjs` (abuse cases) and `e2e/web-demo-drive.mjs`
(the demo end to end on workerd). `data/web-demo-boards.da.json` is pinned to
the app's own board sources by `src/webdemo/demoBoards.test.ts`
(`WRITE_WEB_DEMO_BOARDS=1` regenerates it).
