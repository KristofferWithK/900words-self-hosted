// SEC3's complete browser-to-Worker boundary on the Cloudflare runtime.
//
// The built app sends a constrained game view to the unmodified Worker in
// Miniflare. The Worker supplies its secret, constructs the model prompt and
// returns a final decision. The fake provider deliberately has no CORS support:
// direct browser access fails, while the Worker path succeeds.
import { chromium } from 'playwright'
import { setTimeout as sleep } from 'node:timers/promises'
import { startFakeOllama } from './fake-ollama.mjs'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { startWorker } from './worker-runtime.mjs'

const PORT = 4189
const OFFSET = Number(process.env.DRIVE_PORT_OFFSET ?? 0)
const port = (value) => value + OFFSET
const FAKE_PORT = 4191
const WORKER_PORT = 4192
const CAPPED_PORT = 4193
const WORKER_SECRET = 'secret-that-lives-only-on-the-worker'
const DICTIONARY_SECRET = 'dictionary-secret-that-lives-only-on-the-worker'
const PHONE_ID = 'proxy-drive-install'
const MODEL_ALIASES = JSON.stringify({
  cluey: { model: 'server-owned-model' },
  'casey-dictionary': {
    model: 'gemini-3.5-flash-lite',
    upstream: 'https://generativelanguage.googleapis.com',
    path: '/v1beta/openai',
    key: 'GEMINI_API_KEY',
  },
})

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const preview = await startPreview(PORT)
const pageOrigin = new URL(preview.base).origin
const fake = await startFakeOllama(port(FAKE_PORT), { auto: true, cors: false })
let worker = await startWorker(port(WORKER_PORT), {
  upstream: fake.baseUrl,
  allowedOrigin: pageOrigin,
  apiKey: WORKER_SECRET,
  dictionaryKey: DICTIONARY_SECRET,
  vars: { MODEL_ALIASES },
})

if (!worker) {
  console.log('PROXY DRIVE SKIPPED — miniflare is not installed (npm i)')
  await fake.stop()
  preview.stop()
  process.exit(0)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
await installRoundGuidanceHandler(page)
page.on('pageerror', (error) => console.log('PAGE CRASH:', error.message))

const decisionRequests = []
page.on('request', (request) => {
  if (new URL(request.url()).pathname.endsWith('/casey/decision')) {
    decisionRequests.push({
      body: request.postData() ?? '',
      headers: request.headers(),
    })
  }
})

const settingsFor = (baseUrl) => ({
  state: {
    baseUrl,
    clueLanguage: 'en',
    studyPhase: 'never',
    useMock: false,
    sound: false,
    klausVerifiedAt: null,
  },
  version: 11,
})

async function useService(baseUrl) {
  await page.goto(`${preview.base}?howto=0`)
  await page.evaluate(
    ({ settings, installId }) => {
      localStorage.setItem('cluecab-settings-v1', JSON.stringify(settings))
      localStorage.setItem('cluecab-install-id', installId)
      localStorage.removeItem('cluecab-game-v1')
    },
    { settings: settingsFor(baseUrl), installId: PHONE_ID },
  )
  await page.goto(`${preview.base}?howto=0`)
  await page.waitForSelector('.city-card')
}

async function testConnection() {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.waitForSelector('.settings-screen')
  await page.getByRole('button', { name: 'Test connection' }).click()
  await page.waitForSelector('.test-ok, .test-fail', { timeout: 20_000 })
  const ok = (await page.locator('.test-ok').count()) > 0
  const message = ok ? '' : ((await page.locator('.test-fail').first().textContent()) ?? '').trim()
  return { ok, message }
}

const caseyRequest = (base, payload, headers = {}) =>
  fetch(`${base}/v1/casey/decision`, {
    method: 'POST',
    headers: {
      Origin: pageOrigin,
      'Content-Type': 'application/json',
      'X-Install-Id': PHONE_ID,
      ...headers,
    },
    body: JSON.stringify(payload),
  })

let capped = null
try {
  // The reason the Worker boundary exists is still real.
  await useService(fake.baseUrl)
  const direct = await testConnection()
  check(
    'a model host without CORS cannot be used as a Casey service from the browser',
    !direct.ok && /CORS/i.test(direct.message),
    direct.message,
  )

  // Current setup: no credential or model exists on the device.
  fake.reset()
  decisionRequests.length = 0
  await useService(`${worker.base}/v1`)
  const connected = await testConnection()
  check('the same provider works through Casey’s Worker', connected.ok, connected.message)
  check(
    'the Worker supplied its own credential upstream',
    fake.received.at(-1)?.auth === `Bearer ${WORKER_SECRET}`,
    fake.received.at(-1)?.auth ? 'Bearer <worker secret>' : 'no Authorization',
  )
  const upstreamBody = JSON.parse(fake.received.at(-1)?.raw ?? '{}')
  check('the Worker selected the model', upstreamBody.model === 'server-owned-model', upstreamBody.model)
  check(
    'and built the prompt beyond the client boundary',
    JSON.stringify(upstreamBody.messages).includes('Reply with exactly this JSON object'),
  )
  const browserPing = JSON.parse(decisionRequests.at(-1)?.body ?? '{}')
  check(
    'the browser sent only the constrained operation',
      browserPing.operation === 'ping' &&
      !('messages' in browserPing) &&
      !('model' in browserPing) &&
      !('authorization' in (decisionRequests.at(-1)?.headers ?? {})),
    JSON.stringify(browserPing),
  )
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}').state ?? {},
  )
  check(
    'no credential or model is persisted on the phone',
    !('apiKey' in saved) && !('model' in saved),
    Object.keys(saved).join(', '),
  )

  // A normal turn crosses the same boundary, not a local authored companion.
  fake.reset()
  decisionRequests.length = 0
  await page.goto(`${preview.base}?howto=0&first=player&seed=5`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.fill('.clue-input input', 'huskeliste')
  await page.click('.clue-input .btn-primary')
  await page.waitForSelector('.ai-guess-line, .guess-bar', { timeout: 25_000 })
  await sleep(1000)
  check('normal model-backed play completes through the Worker', (await page.locator('.error-banner').count()) === 0)
  const browserGameBodies = decisionRequests.map((entry) => JSON.parse(entry.body))
  check(
    'game requests contain projections, never prompts or model selection',
    browserGameBodies.length > 0 &&
      browserGameBodies.every((body) => !('messages' in body) && !('model' in body)),
    `${browserGameBodies.length} decision request(s)`,
  )
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  )
  check(
    'no matrix or clue-book asset is requested by the production client',
    resources.every((url) => !/(?:matrix|book)\.da\.\d+\.json/i.test(url)),
  )

  // A true miss is the only client route allowed to reach the dictionary
  // alias. The fake records the two upstream requests so this drive proves the
  // cheap alias, its one schema-only escalation, and the opaque response
  // without contacting a real provider or needing a real key.
  fake.reset()
  fake.queue(
    { json: { da: '', en: 'helicopter' } },
    { json: { da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true } },
  )
  const dictionary = await caseyRequest(worker.base, {
    protocol: 1,
    operation: 'translate',
    term: 'helicopter',
  })
  const dictionaryAnswer = await dictionary.json()
  const cheapBody = JSON.parse(fake.received[0]?.raw ?? '{}')
  const normalBody = JSON.parse(fake.received[1]?.raw ?? '{}')
  check('a true miss first uses the cheap server-owned dictionary alias',
    worker.upstreamCalls.at(-2)?.url === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' &&
      fake.received[0]?.auth === `Bearer ${DICTIONARY_SECRET}` &&
      cheapBody.model === 'gemini-3.5-flash-lite' &&
      cheapBody.temperature === 0.1 &&
      cheapBody.max_tokens === 160 &&
      // gpt-oss's lowest level is 'low' (orchestrator.js, translationDecision).
      cheapBody.reasoning_effort === 'low' &&
      JSON.stringify(cheapBody.tools) === '[]',
  )
  check('invalid cheap output escalates exactly once to normal Casey',
    fake.received.length === 2 &&
      worker.upstreamCalls.at(-1)?.url === 'https://ollama.com/v1/chat/completions' &&
      fake.received[1]?.auth === `Bearer ${WORKER_SECRET}` &&
      normalBody.model === 'server-owned-model',
    `${fake.received.length} upstream calls`,
  )
  check('translation responses expose no provider choice or credential',
    dictionary.status === 200 &&
      dictionaryAnswer.decision?.da === 'helikopter' &&
      !/gemini|google|dictionary-secret|server-owned-model/i.test(JSON.stringify(dictionaryAnswer)),
  )
  check('the true-miss term is never retained by quota state or the browser',
    !JSON.stringify(await page.evaluate(() => ({ ...localStorage }))).includes('helicopter'),
  )

  // The raw route refuses authority the app is not allowed to possess.
  const beforeRefusals = fake.received.length
  const wrongOrigin = await fetch(`${worker.base}/v1/casey/decision`, {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json',
      'X-Install-Id': PHONE_ID,
    },
    body: JSON.stringify({ protocol: 1, operation: 'ping' }),
  })
  const noOrigin = await fetch(`${worker.base}/v1/casey/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': PHONE_ID },
    body: JSON.stringify({ protocol: 1, operation: 'ping' }),
  })
  const clientKey = await caseyRequest(
    worker.base,
    { protocol: 1, operation: 'ping' },
    { Authorization: 'Bearer client-secret' },
  )
  const arbitraryPrompt = await caseyRequest(worker.base, {
    protocol: 1,
    operation: 'ping',
    messages: [{ role: 'user', content: 'spend the owner’s model budget' }],
    model: 'attacker-choice',
  })
  check('a foreign Origin is rejected before model access', wrongOrigin.status === 403)
  check('a missing Origin is rejected when the Worker is locked', noOrigin.status === 403)
  check('a client credential is rejected', clientKey.status === 400)
  check('arbitrary prompts and model choice are rejected', arbitraryPrompt.status === 400)
  check(
    'all four refusals spend nothing upstream',
    fake.received.length === beforeRefusals,
    `${fake.received.length - beforeRefusals} unexpected calls`,
  )

  const oversized = await caseyRequest(worker.base, {
    protocol: 1,
    operation: 'translate',
    term: 'x'.repeat(70_000),
  })
  check('oversized requests are refused before orchestration', oversized.status === 413)

  const preflight = await fetch(`${worker.base}/v1/casey/decision`, {
    method: 'OPTIONS',
    headers: {
      Origin: pageOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-install-id',
    },
  })
  check(
    'the preflight permits the typed decision request',
    preflight.status === 204 &&
      /x-install-id/i.test(preflight.headers.get('access-control-allow-headers') ?? '') &&
      preflight.headers.get('access-control-allow-origin') === pageOrigin,
  )

  // The global/per-install fuse counts model attempts, not accepted browser
  // envelopes. A second ping is blocked before it reaches the provider.
  capped = await startWorker(port(CAPPED_PORT), {
    upstream: fake.baseUrl,
    allowedOrigin: pageOrigin,
    apiKey: WORKER_SECRET,
    dictionaryKey: DICTIONARY_SECRET,
    kv: true,
    vars: {
      DAILY_CAP: 1,
      GLOBAL_DAILY_CAP: 0,
      MODEL_ALIASES,
    },
  })
  if (!capped) throw new Error('Miniflare disappeared while starting the capped Worker')
  fake.reset()
  const first = await caseyRequest(capped.base, { protocol: 1, operation: 'ping' })
  const second = await caseyRequest(capped.base, { protocol: 1, operation: 'ping' })
  check('the first model attempt under the cap succeeds', first.status === 200, `HTTP ${first.status}`)
  check('the next attempt is refused with 429', second.status === 429, `HTTP ${second.status}`)
  check('the capped attempt never reaches the provider', fake.received.length === 1, `${fake.received.length} calls`)
  check('quota refusals are never cacheable', second.headers.get('cache-control') === 'no-store')

  // Deploying the Worker first must preserve already-installed clients.
  fake.reset()
  const legacy = await fetch(`${worker.base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Origin: pageOrigin,
      'Content-Type': 'application/json',
      'X-Install-Id': 'legacy-install-id',
    },
    body: JSON.stringify({
      model: 'legacy-model',
      messages: [{ role: 'user', content: 'Reply with JSON.' }],
    }),
  })
  check('the pre-SEC3 generic route remains available during rollout', legacy.status === 200)
  check(
    'legacy compatibility still uses the Worker secret',
    fake.received.at(-1)?.auth === `Bearer ${WORKER_SECRET}`,
  )
} catch (error) {
  console.log('PROXY DRIVE CRASH:', error?.stack ?? error)
  fail.push('uncaught exception')
} finally {
  await capped?.stop()
  await worker?.stop()
  await browser.close()
  await fake.stop()
  preview.stop()
}

if (fail.length) {
  console.log(`\nPROXY DRIVE FAILED: ${fail.join(', ')}`)
  process.exit(1)
}
console.log('\nPROXY DRIVE OK — Casey’s authored/model boundary is enforced end to end.')
