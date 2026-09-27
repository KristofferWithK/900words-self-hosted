// Offline bundled Worker compatibility check. Default: Node with fetch stubbed
// (project-guide bundle procedure). WORKERD=1 uses workerd + loopback provider.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import { startFakeOllama } from './fake-ollama.mjs'
import { startWorker } from './worker-runtime.mjs'

const offset = Number(process.env.DRIVE_PORT_OFFSET ?? 8000)
let fake
let worker
let bundleDir
const originalFetch = globalThis.fetch
const env = { OLLAMA_API_KEY: 'fixture-only', MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fixture-only' } }) }
let send
try {
  if (process.env.WORKERD === '1') {
    fake = await startFakeOllama(4290 + offset)
    worker = await startWorker(4291 + offset, {
      upstream: fake.baseUrl, apiKey: 'fixture-only', bundler: 'rolldown',
      vars: { MODEL_ALIASES: JSON.stringify({ cluey: { model: 'fixture-only' } }) },
    })
    assert.ok(worker, 'Miniflare is required')
    send = (request) => originalFetch(request)
  } else {
    bundleDir = mkdtempSync(join(tmpdir(), 'casey-justification-bundle-'))
    const file = join(bundleDir, 'worker.mjs')
    const bundle = await rolldown({ input: 'proxy/worker.js' })
    await bundle.write({ file, format: 'esm', codeSplitting: false })
    await bundle.close()
    const loaded = await import(pathToFileURL(file).href)
    const replies = []
    fake = { received: [], queue: (reply) => replies.push(reply) }
    globalThis.fetch = async (_url, init) => {
      fake.received.push({ raw: String(init.body) })
      assert.ok(replies.length, 'no unexpected model call')
      return Response.json({ choices: [{ message: { content: JSON.stringify(replies.shift().json) } }] })
    }
    worker = { base: 'https://fixture.invalid' }
    send = (request) => loaded.default.fetch(request, env)
  }
  const view = {
    kind: 'ai-guess', clueLanguage: 'en', turnsLeft: 5,
    words: [
      { id: 'da:æble', da: 'æble', en: ['apple'], pos: 'noun', reveal: { kind: 'hidden' } },
      { id: 'da:pære', da: 'pære', en: ['pear'], pos: 'noun', reveal: { kind: 'hidden' } },
      { id: 'da:træ', da: 'træ', en: ['tree'], pos: 'noun', reveal: { kind: 'green' } },
    ],
    currentClue: { text: 'frugt', number: 1 }, history: [], flagged: [],
  }
  const rows = [
    { wordId: 'da:æble', confidence: 0.2, reasoning: 'æble (apple) is a fruit, matching frugt.' },
    { wordId: 'da:pære', confidence: 0.9, reasoning: 'pære (pear) is a fruit, matching frugt.' },
  ]
  for (const candidateMode of ['top-two', undefined]) {
    fake.queue({ json: { guesses: [
      { ...rows[0], wordId: 'unknown' }, rows[0],
      ...(candidateMode ? [rows[0]] : []),
      { ...rows[0], wordId: 'da:træ' }, rows[1],
    ] } })
    const response = await send(new Request(`${worker.base}/v1/casey/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Install-Id': 'casey-justification-fixture' },
      body: JSON.stringify({ protocol: 1, operation: 'guess', view, ...(candidateMode ? { candidateMode } : {}) }),
    }))
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify(body))
    assert.equal(body.protocol, 1)
    assert.deepEqual(body.decision.guesses, rows)
    const prompt = fake.received.at(-1).raw
    assert.ok(prompt.includes('one short sentence IN ENGLISH explaining this candidate’s own connection'))
    assert.ok(!prompt.includes('one short English sentence explaining this candidate’s own connection'))
    assert.ok(!prompt.includes('the nearest decoy is'))
    for (const field of ['playerKey', 'aiKey', 'roleOnMyKey', 'secondChoiceWordId']) assert.ok(!prompt.includes(field))
  }
  assert.equal(fake.received.length, 2, 'one provider call per request, no selector calls')
  console.log('PASS bundled Worker: top-two and legacy schema/rank/reasoning, legal filtering, concise prompt, key firewall, exactly two fixture calls')
} finally {
  globalThis.fetch = originalFetch
  await worker?.stop?.()
  await fake?.stop?.()
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true })
}
