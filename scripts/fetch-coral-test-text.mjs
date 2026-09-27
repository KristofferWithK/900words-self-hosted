/**
 * Fetch only CoRal v3 conversational test text through Hugging Face's Dataset
 * Viewer rows API. It deliberately never follows or serializes the audio field.
 *
 * Usage:
 *   HF_TOKEN=... node scripts/fetch-coral-test-text.mjs --output /outside/repo/coral-test.jsonl --receipt /outside/repo/coral-test-receipt.json
 */
import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATASET = 'CoRal-project/coral-v3'
const CONFIG = 'conversation'
const SPLIT = 'test'
const EXPECTED_REVISION = '01f7c93c21fc9dec87fe9f7149c79569cc433f08'
const EXPECTED_RECORDS = 8438
const PAGE_SIZE = 100
const MAX_TRANSIENT_ATTEMPTS = 4
const PAGE_PACE_MS = 2_200
const RETRY_BASE_MS = 90_000
const RETRY_CAP_MS = 180_000

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? null : args[at + 1] ?? null
}
const output = option('--output')
const receipt = option('--receipt')

if (args.includes('--help') || !output || !receipt) {
  console.log('Usage: HF_TOKEN=... node scripts/fetch-coral-test-text.mjs --output <external.jsonl> --receipt <external.json>')
  process.exit(args.includes('--help') ? 0 : 1)
}

const token = process.env.HF_TOKEN
if (!token) throw new Error('HF_TOKEN is required but was not provided.')

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outsideRepo = (file) => {
  const target = resolve(file)
  const pathFromRoot = relative(root, target)
  if (!pathFromRoot || (!pathFromRoot.startsWith('..') && !pathFromRoot.includes(':'))) {
    throw new Error(`Refusing to write raw CoRal text inside the repository: ${target}`)
  }
  return target
}
const outputPath = outsideRepo(output)
const receiptPath = outsideRepo(receipt)
if (outputPath === receiptPath) throw new Error('--output and --receipt must be different files.')
const temporaryPath = `${outputPath}.partial`
const headers = { Authorization: `Bearer ${token}` }

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
const retryDelay = (response, attempt) => {
  const retryAfter = response?.headers?.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, RETRY_CAP_MS)
    const timestamp = Date.parse(retryAfter)
    if (Number.isFinite(timestamp)) return Math.min(Math.max(0, timestamp - Date.now()), RETRY_CAP_MS)
  }
  // A small random component avoids repeatedly colliding with the shared API limit.
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS) + Math.floor(Math.random() * 2_000)
}
const checkedJson = async (url) => {
  for (let attempt = 0; attempt < MAX_TRANSIENT_ATTEMPTS; attempt += 1) {
    let response
    try {
      response = await fetch(url, { headers })
    } catch (error) {
      if (attempt === MAX_TRANSIENT_ATTEMPTS - 1) throw error
      const delay = retryDelay(null, attempt)
      console.warn(`Hugging Face request failed before a response; retrying in ${delay}ms (${attempt + 1}/${MAX_TRANSIENT_ATTEMPTS - 1}).`)
      await sleep(delay)
      continue
    }
    if (response.ok) return response.json()
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === MAX_TRANSIENT_ATTEMPTS - 1) {
      throw new Error(`Hugging Face request failed: HTTP ${response.status}`)
    }
    const delay = retryDelay(response, attempt)
    console.warn(`Hugging Face request returned HTTP ${response.status}; retrying the same page in ${delay}ms (${attempt + 1}/${MAX_TRANSIENT_ATTEMPTS - 1}).`)
    await sleep(delay)
  }
  throw new Error('Hugging Face request exhausted its retry budget.')
}
const assertPinnedRevision = async () => {
  const revision = await checkedJson(`https://huggingface.co/api/datasets/${DATASET}/revision/main`)
  if (revision.sha !== EXPECTED_REVISION) {
    throw new Error(`Expected CoRal revision ${EXPECTED_REVISION}, received ${revision.sha ?? 'no SHA'}. Reconcile the source pin before measuring.`)
  }
}

await mkdir(dirname(outputPath), { recursive: true })
await rm(temporaryPath, { force: true })

try {
  await assertPinnedRevision()

  const lines = []
  for (let offset = 0; offset < EXPECTED_RECORDS; offset += PAGE_SIZE) {
    const length = Math.min(PAGE_SIZE, EXPECTED_RECORDS - offset)
    const params = new URLSearchParams({ dataset: DATASET, config: CONFIG, split: SPLIT, offset: String(offset), length: String(length) })
    const page = await checkedJson(`https://datasets-server.huggingface.co/rows?${params}`)
    if (page.partial === true) throw new Error(`Rows response at offset ${offset} is partial; refusing incomplete measurement.`)
    if (page.num_rows_total !== EXPECTED_RECORDS) {
      throw new Error(`Rows response at offset ${offset} reports ${page.num_rows_total ?? 'no'} total rows; expected ${EXPECTED_RECORDS}.`)
    }
    if (!Array.isArray(page.rows) || page.rows.length !== length) {
      throw new Error(`Rows response at offset ${offset} returned ${Array.isArray(page.rows) ? page.rows.length : 'no'} rows; expected ${length}.`)
    }
    for (const [index, entry] of page.rows.entries()) {
      if (entry?.row_idx !== offset + index) {
        throw new Error(`Rows response at offset ${offset} has row index ${entry?.row_idx ?? 'missing'} where ${offset + index} is required.`)
      }
      const text = entry?.row?.text
      if (typeof text !== 'string') throw new Error(`Rows response at offset ${offset} contains a missing or non-string text field.`)
      lines.push(JSON.stringify({ text }))
    }
    // Dataset Viewer rate limits this authenticated projection. Steady pacing is
    // deliberately cheaper and safer than hammering a page after a 429.
    if (offset + PAGE_SIZE < EXPECTED_RECORDS) await sleep(PAGE_PACE_MS)
  }
  if (lines.length !== EXPECTED_RECORDS) throw new Error(`Collected ${lines.length} records; expected ${EXPECTED_RECORDS}.`)
  await assertPinnedRevision()

  const contents = `${lines.join('\n')}\n`
  await writeFile(temporaryPath, contents, 'utf8')
  const sha256 = createHash('sha256').update(contents, 'utf8').digest('hex').toUpperCase()
  await rename(temporaryPath, outputPath)
  await writeFile(receiptPath, `${JSON.stringify({
    dataset: DATASET,
    revision: EXPECTED_REVISION,
    config: CONFIG,
    split: SPLIT,
    records: lines.length,
    textField: 'text',
    sha256,
    collection: 'Hugging Face Dataset Viewer /rows API; authenticated text projection only; audio fields never followed or written',
  }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ dataset: DATASET, revision: EXPECTED_REVISION, config: CONFIG, split: SPLIT, records: lines.length, sha256 }, null, 2))
} finally {
  await rm(temporaryPath, { force: true })
}
