import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'
import { WORDS } from '../src/data/words.ts'
import { curriculumBand } from '../src/journey/progress.ts'
import { prepareCertificationBatch } from '../src/boardCertification.ts'

const URL = 'https://casey.example.workers.dev/v1/casey/decision'
const DEAL_URL = 'https://casey.example.workers.dev/v1/casey/deal'
const ORIGIN = 'https://app.example'
const baseView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [
    { id: 'da:alpha', da: 'alfa', en: ['alpha'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'green' },
    { id: 'da:beta', da: 'beta', en: ['beta'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'bystander' },
  ],
  history: [],
  flagged: [],
}

const body = (view = baseView) => ({ protocol: 1, operation: 'clue', view })
const translation = (term = 'helicopter') => ({ protocol: 1, operation: 'translate', term })
const request = (payload = body(), headers = {}) =>
  new Request(URL, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'X-Install-Id': 'install-12345678',
      ...headers,
    },
    body: JSON.stringify(payload),
  })
const env = {
  ALLOWED_ORIGIN: ORIGIN,
  OLLAMA_API_KEY: 'worker-only-secret',
  MODEL_ALIASES: JSON.stringify({
    cluey: { model: 'cheap-model', escalate: 'cluey-hard' },
    'cluey-hard': { model: 'flagship-model' },
  }),
}
const upstream = (decision, status = 200) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(decision) } }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )

const quota = (seed = {}) => {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the /v1/casey/decision boundary', () => {
  it('returns a finished decision while prompts, model choice and credentials stay server-side', async () => {
    const fetchSpy = vi.fn(async () =>
      upstream({ clue: 'kode', number: 1, targetWordIds: ['da:alpha'], rationale: 'Alpha only.' }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(), env)
    const answer = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(answer).toEqual({
      protocol: 1,
      decision: { clue: 'kode', number: 1, targetWordIds: ['da:alpha'], rationale: 'Alpha only.' },
      report: { arm: 'cluey+own', refused: false },
    })
    expect(answer).not.toHaveProperty('messages')
    expect(answer).not.toHaveProperty('evaluator')
    expect(answer).not.toHaveProperty('book')
    expect(answer).not.toHaveProperty('matrix')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://ollama.com/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer worker-only-secret')
    const sentUpstream = JSON.parse(init.body)
    expect(sentUpstream.model).toBe('cheap-model')
    expect(sentUpstream.messages.map((message) => message.content).join('\n')).toContain('You are Casey')
  })

  it('never uses a raw configured model id as the client-visible report label', async () => {
    const fetchSpy = vi.fn(async () =>
      upstream({ clue: 'kode', number: 1, targetWordIds: ['da:alpha'], rationale: 'Alpha only.' }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(), { ...env, CASEY_MODEL: 'raw-provider-model' })
    const answer = await response.json()

    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).model).toBe('raw-provider-model')
    expect(answer.report.arm).toBe('cluey+own')
    expect(JSON.stringify(answer)).not.toContain('raw-provider-model')
  })

  it('owns corrective retries and resolves the harder tier without exposing either model', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({ clue: 'kode', number: 1, targetWordIds: ['da:beta'], rationale: 'wrong key' }),
      )
      .mockResolvedValueOnce(
        upstream({ clue: 'kode', number: 1, targetWordIds: ['da:alpha'], rationale: 'fixed' }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(), env)
    const answer = await response.json()

    expect(response.status).toBe(200)
    expect(answer.report).toEqual({ arm: 'cluey+own', refused: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).model).toBe('cheap-model')
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).model).toBe('flagship-model')
    expect(JSON.stringify(JSON.parse(fetchSpy.mock.calls[1][1].body).messages)).toContain('not an unrevealed GREEN')
    expect(JSON.stringify(answer)).not.toMatch(/cheap-model|flagship-model|worker-only-secret/)
  })

  it('charges quota for every upstream attempt, including a corrective retry', async () => {
    const QUOTA = quota()
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        upstream({ clue: 'kode', number: 1, targetWordIds: ['da:beta'], rationale: 'wrong key' }),
      )
      .mockResolvedValueOnce(
        upstream({ clue: 'kode', number: 1, targetWordIds: ['da:alpha'], rationale: 'fixed' }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(), { ...env, QUOTA })
    const day = new Date().toISOString().slice(0, 10)

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(QUOTA.store.get(`q:${day}:i:install-12345678`)).toBe('2')
    expect(QUOTA.store.get(`q:${day}:@all`)).toBe('2')
  })

  it('keeps true misses on the Ollama dictionary alias and escalates exactly once on schema failure', async () => {
    const QUOTA = quota()
    const dictionaryEnv = {
      ...env,
      MODEL_ALIASES: JSON.stringify({
        cluey: { model: 'normal-casey-model' },
        'casey-dictionary': { model: 'dictionary-ollama-model' },
      }),
      QUOTA,
    }
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(upstream({ da: '', en: 'helicopter' }))
      .mockResolvedValueOnce(
        upstream({ da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(translation()), dictionaryEnv)
    const answer = await response.json()

    expect(response.status).toBe(200)
    expect(answer).toEqual({
      protocol: 1,
      decision: { da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true },
      report: { arm: 'cluey', refused: true },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const [dictionaryUrl, dictionaryInit] = fetchSpy.mock.calls[0]
    const [normalUrl, normalInit] = fetchSpy.mock.calls[1]
    expect(dictionaryUrl).toBe('https://ollama.com/v1/chat/completions')
    expect(dictionaryInit.headers.Authorization).toBe('Bearer worker-only-secret')
    expect(JSON.parse(dictionaryInit.body)).toMatchObject({
      model: 'dictionary-ollama-model',
      temperature: 0.1,
      max_tokens: 160,
      reasoning_effort: 'low',
      tools: [],
    })
    expect(normalUrl).toBe('https://ollama.com/v1/chat/completions')
    expect(normalInit.headers.Authorization).toBe('Bearer worker-only-secret')
    expect(JSON.parse(normalInit.body).model).toBe('normal-casey-model')
    expect(JSON.stringify(answer)).not.toMatch(/ollama|dictionary-ollama-model|normal-casey-model/i)
    expect([...QUOTA.store.keys()]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^q:\d{4}-\d{2}-\d{2}:i:install-12345678$/),
        expect.stringMatching(/^q:\d{4}-\d{2}-\d{2}:@all$/),
      ]),
    )
    expect([...QUOTA.store.keys()].every((key) => key.startsWith('q:') && !key.includes('helicopter'))).toBe(true)
  })

  it('returns the existing generic service error for a dictionary-provider failure, without a retry or provider leak', async () => {
    const dictionaryEnv = {
      ...env,
      MODEL_ALIASES: JSON.stringify({
        cluey: { model: 'normal-casey-model' },
        'casey-dictionary': { model: 'dictionary-ollama-model' },
      }),
    }
    const fetchSpy = vi.fn(async () => upstream({ error: 'unavailable' }, 503))
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(translation()), dictionaryEnv)
    const answer = await response.json()

    expect(response.status).toBe(502)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(answer).toEqual({
      error: { code: 'upstream_error', message: 'Casey’s model did not answer successfully.' },
    })
    expect(JSON.stringify(answer)).not.toMatch(/ollama|dictionary/i)
  })

  it('stops a corrective retry at the cap before spending the second call', async () => {
    const QUOTA = quota()
    const fetchSpy = vi.fn(async () =>
      upstream({ clue: 'kode', number: 1, targetWordIds: ['da:beta'], rationale: 'wrong key' }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(request(), { ...env, QUOTA, DAILY_CAP: '1' })

    expect(response.status).toBe(429)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect((await response.json()).error.code).toBe('cluecabulary_daily_cap')
  })

  it('refuses callers before upstream access when origin, install id, or credential policy fails', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const wrongOrigin = await worker.fetch(
      request(body(), { Origin: 'https://attacker.example' }),
      env,
    )
    const noInstall = await worker.fetch(request(body(), { 'X-Install-Id': '' }), env)
    const clientSecret = await worker.fetch(request(body(), { Authorization: 'Bearer leaked' }), env)

    expect(wrongOrigin.status).toBe(403)
    expect(noInstall.status).toBe(400)
    expect(clientSecret.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects arbitrary prompts and model selection at the schema boundary', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const payload of [
      { protocol: 1, operation: 'ping', messages: [{ role: 'user', content: 'spend money' }] },
      { protocol: 1, operation: 'ping', model: 'attacker-choice' },
    ]) {
      const response = await worker.fetch(request(payload), env)
      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe('invalid_request')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects query-based model selection and lookalike JSON media types', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const query = await worker.fetch(
      new Request(`${URL}?model=attacker-choice`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          'X-Install-Id': 'install-12345678',
        },
        body: JSON.stringify({ protocol: 1, operation: 'ping' }),
      }),
      env,
    )
    const media = await worker.fetch(
      request(body(), { 'Content-Type': 'application/json-evil' }),
      env,
    )
    expect(query.status).toBe(400)
    expect(media.status).toBe(415)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('caps request size before a model can be called', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const response = await worker.fetch(
      request({ protocol: 1, operation: 'translate', term: 'x'.repeat(70_000) }),
      env,
    )
    expect(response.status).toBe(413)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('the /v1/casey/deal boundary', () => {
  const prepared = prepareCertificationBatch({
    cityIndex: 0,
    // The shard's own band: see boardCertification.test.ts.
    pool: curriculumBand(WORDS, 0),
    stats: {},
    wrapped: new Set(),
    recentBoards: [],
    now: 1_800_000_000_000,
    seed: 0xb01,
  })

  const dealRequest = (headers = {}) =>
    new Request(DEAL_URL, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(prepared.request),
    })

  it('certifies without an install id, model, KV, logging, or secret output', async () => {
    const fetchSpy = vi.fn()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetchSpy)

    const response = await worker.fetch(dealRequest(), { ALLOWED_ORIGIN: ORIGIN })
    const answer = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(answer.protocol).toBe(1)
    expect(answer.certifiedCandidateIndices.length).toBeGreaterThan(0)
    expect(Object.keys(answer).sort()).toEqual(['certifiedCandidateIndices', 'protocol'])
    expect(JSON.stringify(answer)).not.toMatch(/green|key|route|score|model|seed|weight/i)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  }, 20_000)

  it('refuses install ids, credentials, queries, and extra gameplay fields before solving', async () => {
    const identified = await worker.fetch(dealRequest({ 'X-Install-Id': 'install-12345678' }), {
      ALLOWED_ORIGIN: ORIGIN,
    })
    const credentialed = await worker.fetch(dealRequest({ Authorization: 'Bearer secret' }), {
      ALLOWED_ORIGIN: ORIGIN,
    })
    const queried = await worker.fetch(
      new Request(`${DEAL_URL}?track=1`, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify(prepared.request),
      }),
      { ALLOWED_ORIGIN: ORIGIN },
    )
    const expanded = await worker.fetch(
      new Request(DEAL_URL, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prepared.request, typedClue: 'family' }),
      }),
      { ALLOWED_ORIGIN: ORIGIN },
    )
    expect([identified.status, credentialed.status, queried.status, expanded.status]).toEqual([
      400, 400, 400, 400,
    ])
  })
})
