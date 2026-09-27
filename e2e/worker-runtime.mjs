import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const WORKER_PATH = join(HERE, '..', 'proxy', 'worker.js')
const CONFIG_PATH = join(HERE, '..', 'proxy', 'wrangler.toml')

/**
 * Bundle the Worker the way a deploy does, and run THAT.
 *
 * Until 2026-09-07 this handed workerd the source tree with a hand-written
 * copy of wrangler.toml's module rules, and the copy could not be right:
 * `casey/deal.js` imports the word list from `src/data/`, which is outside
 * proxy/ (workerd refuses a module name that starts with `..`, on Windows
 * and in the container alike — the "workerd refuses the filesystem" of the
 * launch-readiness notes), and once the root was widened the same list had
 * to be a parsed JSON module, a type miniflare does not have. Wrangler never
 * saw either problem because it bundles with esbuild first. So the harness
 * asks wrangler for that bundle (`deploy --dry-run` needs no account and
 * touches nothing) and runs the one file the account would receive.
 */
async function bundleWorker(bundler = 'wrangler') {
  const out = mkdtempSync(join(tmpdir(), 'cluecab-worker-'))
  if (bundler === 'rolldown') {
    // Focused offline drives can use the bundler already installed under Vite.
    // This keeps the fixture dependency-neutral when Wrangler is not present;
    // the resulting single ESM file still runs unmodified in workerd below.
    const { rolldown } = await import('rolldown')
    const built = await rolldown({ input: WORKER_PATH })
    await built.write({ file: join(out, 'worker.js'), format: 'esm', codeSplitting: false })
    await built.close()
  } else {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    execFileSync(npx, ['wrangler', 'deploy', '--dry-run', '--outdir', out, '--config', CONFIG_PATH], {
      stdio: 'pipe',
      shell: process.platform === 'win32',
    })
  }
  return { scriptPath: join(out, 'worker.js'), dispose: () => rmSync(out, { recursive: true, force: true }) }
}

/**
 * Run proxy/worker.js on the Cloudflare runtime it is written for.
 *
 * The proxy is the documented fix for the most likely failure this app has —
 * ollama.com refusing browser requests — and until this existed it had never
 * been executed at all. Miniflare runs the real workerd binary, so the full
 * Worker module graph is exercised unmodified and un-shimmed. That matters: workerd
 * accepts `body: request.body` on an outbound fetch, and Node's fetch does
 * not, so a hand-rolled Node stand-in would have had to alter the code it was
 * meant to be testing.
 *
 * `upstream` replaces ollama.com. The worker's own fetch to ollama.com is
 * intercepted by miniflare's outboundService — the worker still asks for
 * https://ollama.com/..., and we record what it asked for before forwarding.
 *
 * `apiKey`, `dictionaryKey`, and `allowedOrigin` are delivered as Cloudflare
 * bindings, so the recommended setup — both provider secrets living on the
 * worker rather than on the phone — is exercised the way it is actually
 * deployed.
 *
 * `kv: true` adds the QUOTA namespace the daily cap counts in. Miniflare
 * implements KV on workerd with the real binding API, so the cap is exercised
 * against the same `get`/`put` the deployed worker calls — including
 * `expirationTtl`, which it accepts. Leaving it false is the fail-open case:
 * the worker sees no binding at all, exactly as it would if the namespace were
 * never created, and must serve every request anyway.
 *
 * `vars` are any other Worker variables (DAILY_CAP, GLOBAL_DAILY_CAP). They
 * arrive as strings, which is what Cloudflare delivers for a [vars] entry.
 */
export async function startWorker(port, { upstream, allowedOrigin, apiKey, dictionaryKey, kv, vars, bundler } = {}) {
  let Miniflare
  try {
    ;({ Miniflare } = await import('miniflare'))
  } catch {
    return null
  }

  const bundle = await bundleWorker(bundler)
  const scriptPath = bundle.scriptPath

  /** @type {Array<{url: string, method: string, auth: string}>} */
  const upstreamCalls = []

  const mf = new Miniflare({
    port,
    workers: [
      {
        name: 'cluecabulary-proxy',
        modules: true,
        scriptPath,
        modulesRoot: dirname(scriptPath),
        // One bundled module; wrangler has already inlined the corpus.
        modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
        compatibilityDate: '2026-01-01',
        // Secrets and vars reach the worker as `env`, exactly as Cloudflare
        // delivers them — which is how the key-in-the-worker setup is tested.
        bindings: {
          // The pre-SEC3 generic route is off in production (worker.js);
          // proxy-drive still exercises its passthrough contract here.
          LEGACY_ROUTE: '1',
          ...(apiKey ? { OLLAMA_API_KEY: apiKey } : {}),
          ...(dictionaryKey ? { GEMINI_API_KEY: dictionaryKey } : {}),
          ...(allowedOrigin ? { ALLOWED_ORIGIN: allowedOrigin } : {}),
          ...Object.fromEntries(Object.entries(vars ?? {}).map(([k, v]) => [k, String(v)])),
        },
        // The counters the daily cap keeps. Omitted entirely when kv is falsy,
        // which is how the fail-open path gets tested for real.
        ...(kv ? { kvNamespaces: { QUOTA: 'cluecabulary-proxy-QUOTA' } } : {}),
        outboundService: async (request) => {
          upstreamCalls.push({
            at: Date.now(),
            url: request.url,
            method: request.method,
            auth: request.headers.get('authorization') ?? '',
          })
          const target = new URL(request.url)
          const to = new URL(upstream)
          to.pathname = target.pathname
          to.search = target.search
          // The worker streamed its body; buffer it here only because this
          // hop runs on Node, which refuses a stream without duplex: 'half'.
          const headers = new Headers(request.headers)
          for (const drop of ['host', 'connection', 'content-length']) headers.delete(drop)
          try {
            return await fetch(to, {
              method: request.method,
              headers,
              body:
                request.method === 'GET' || request.method === 'HEAD'
                  ? undefined
                  : await request.arrayBuffer(),
            })
          } catch (e) {
            // Without this the harness's own failure comes back as a plain 500
            // and reads exactly like an upstream error, which is a trap.
            console.log('WORKER HARNESS: forwarding to the fake failed —', to.toString(), e.message, e.cause?.message ?? '', e.cause?.code ?? '')
            throw e
          }
        },
      },
    ],
  })

  await mf.ready
  return {
    base: `http://127.0.0.1:${port}`,
    /** What the worker asked ollama.com for, before we redirected it. */
    upstreamCalls,
    stop: async () => {
      await mf.dispose()
      bundle.dispose()
    },
  }
}

/**
 * Run the WEBSITE Casey (proxy/web-worker.js, wrangler.web.toml) on workerd,
 * with its real DemoBudget Durable Object and rate-limit bindings. Outbound
 * traffic is intercepted: Turnstile's siteverify gets `turnstile(form)`
 * (default: a pass for action "demo" on 900words.app), everything else goes to
 * the fake model at `upstream`. `vars` override wrangler.web.toml's.
 */
export async function startWebCasey(port, { upstream, vars = {}, turnstile } = {}) {
  let Miniflare
  try {
    ;({ Miniflare } = await import('miniflare'))
  } catch {
    return null
  }
  const out = mkdtempSync(join(tmpdir(), 'web-casey-'))
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  execFileSync(npx, ['wrangler', 'deploy', '--dry-run', '--outdir', out, '--config', join(HERE, '..', 'proxy', 'wrangler.web.toml')], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  const scriptPath = join(out, 'web-worker.js')
  const upstreamCalls = []
  const verifyCalls = []
  const mf = new Miniflare({
    port,
    workers: [
      {
        name: '900words-web-casey',
        modules: true,
        scriptPath,
        modulesRoot: dirname(scriptPath),
        modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
        compatibilityDate: '2026-01-01',
        bindings: {
          DEMO_ENABLED: 'true',
          ALLOWED_ORIGINS: 'http://127.0.0.1',
          GLOBAL_DAILY_CAP: '5000',
          SESSION_DECISION_CAP: '60',
          SESSION_TRANSLATE_CAP: '5',
          MAX_TOKENS: '1200',
          CASEY_REPORT_ARM: 'web',
          WEB_OLLAMA_API_KEY: 'web-casey-drive-key',
          TURNSTILE_SECRET: 'turnstile-drive-secret',
          SESSION_SECRET: 'web-casey-drive-session-secret-0123456789',
          TURNSTILE_VERIFY_URL: 'https://turnstile.drive/siteverify',
          ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])),
        },
        durableObjects: { DEMO_BUDGET: { className: 'DemoBudget', useSQLite: true } },
        ratelimits: {
          SESSION_RATE_LIMITER: { namespace_id: '9001', simple: { limit: 30, period: 60 } },
          DECISION_RATE_LIMITER: { namespace_id: '9002', simple: { limit: 200, period: 60 } },
        },
        outboundService: async (request) => {
          if (request.url.startsWith('https://turnstile.drive/')) {
            const form = await request.formData()
            verifyCalls.push({ response: form.get('response') })
            const verdict = turnstile ? await turnstile(form) : { success: true, action: 'demo', hostname: '127.0.0.1' }
            return new Response(JSON.stringify(verdict), { headers: { 'Content-Type': 'application/json' } })
          }
          upstreamCalls.push({ at: Date.now(), url: request.url, auth: request.headers.get('authorization') ?? '', body: await request.clone().text() })
          const target = new URL(request.url)
          const to = new URL(upstream)
          to.pathname = target.pathname
          const headers = new Headers(request.headers)
          for (const drop of ['host', 'connection', 'content-length']) headers.delete(drop)
          return fetch(to, { method: request.method, headers, body: await request.arrayBuffer() })
        },
      },
    ],
  })
  await mf.ready
  return {
    base: `http://127.0.0.1:${port}`,
    upstreamCalls,
    verifyCalls,
    stop: async () => {
      await mf.dispose()
      rmSync(out, { recursive: true, force: true })
    },
  }
}
