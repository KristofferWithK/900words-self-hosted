export const DATA_SHARING_PATH = '/v1/data-sharing/events'
export const DIAGNOSTIC_TTL_SECONDS = 30 * 24 * 60 * 60
export const LEARNING_TTL_SECONDS = 90 * 24 * 60 * 60
const MAX_EVENT_BYTES = 16 * 1024

const exactKeys = (value, keys) => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, i) => key === expected[i])
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const int = (value, max = 10_000) => Number.isInteger(value) && value >= 0 && value <= max
const short = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max

const BASE_KEYS = [
  'protocol', 'eventId', 'kind', 'sharing', 'at', 'language', 'cityIndex', 'mode',
  'result', 'reason', 'boardSize', 'turns', 'lookedUpCount', 'packedCount',
  'wrappedCount', 'newlyLearnedCount', 'newlyDiscoveredCount',
]

const baseValid = (event) =>
  event.protocol === 1 &&
  /^[A-Za-z0-9_-]{8,64}$/.test(event.eventId) &&
  event.kind === 'round' &&
  Number.isInteger(event.at) && event.at > 0 &&
  ['da', 'de'].includes(event.language) &&
  int(event.cityIndex, 99) &&
  ['normal', 'wrapup'].includes(event.mode) &&
  ['won', 'lost'].includes(event.result) &&
  short(event.reason, 64) &&
  ['boardSize', 'turns', 'lookedUpCount', 'packedCount', 'wrappedCount', 'newlyLearnedCount', 'newlyDiscoveredCount']
    .every((key) => int(event[key]))

const exampleValid = (example) =>
  record(example) &&
  exactKeys(example, ['by', 'clue', 'number', 'guesses']) &&
  ['player', 'ai'].includes(example.by) &&
  short(example.clue, 160) &&
  Number.isInteger(example.number) && example.number >= 1 && example.number <= 18 &&
  Array.isArray(example.guesses) && example.guesses.length <= 18 &&
  example.guesses.every((guess) =>
    record(guess) &&
    exactKeys(guess, ['wordId', 'result']) &&
    short(guess.wordId, 80) &&
    ['green', 'bystander'].includes(guess.result),
  )

export function parseDataSharingEvent(value) {
  if (!record(value) || !baseValid(value)) return null
  if (value.sharing === 'diagnostics' && exactKeys(value, BASE_KEYS)) return value
  if (
    value.sharing === 'learning' &&
    exactKeys(value, [...BASE_KEYS, 'examples']) &&
    Array.isArray(value.examples) &&
    value.examples.length <= 16 &&
    value.examples.every(exampleValid)
  ) return value
  return null
}

const headers = (cors) => ({
  ...cors,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
})
const error = (code, message, status, cors) => new Response(
  JSON.stringify({ error: { code, message } }),
  { status, headers: headers(cors) },
)
const installId = (request) => {
  const id = (request.headers.get('X-Install-Id') ?? '').trim()
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null
}
const prefixFor = (id) => `h10:${id}:`

async function deleteInstallEvents(kv, id) {
  let cursor
  do {
    const page = await kv.list({ prefix: prefixFor(id), ...(cursor ? { cursor } : {}) })
    await Promise.all(page.keys.map((key) => kv.delete(key.name)))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
}

/** Dedicated receiver; missing storage fails closed and never borrows quota KV. */
export async function handleDataSharing(request, env, cors) {
  const id = installId(request)
  if (!id) return error('install_id_required', 'A valid random installation ID is required.', 400, cors)
  const kv = env?.DATA_SHARING
  if (!kv || typeof kv.put !== 'function' || typeof kv.list !== 'function' || typeof kv.delete !== 'function') {
    return error('data_sharing_unavailable', 'Optional data sharing is not configured.', 503, cors)
  }
  if (request.method === 'DELETE') {
    try {
      await deleteInstallEvents(kv, id)
      return new Response(null, { status: 204, headers: { ...cors, 'Cache-Control': 'no-store' } })
    } catch {
      return error('delete_failed', 'Shared data could not be deleted.', 503, cors)
    }
  }
  if (request.method !== 'POST') return error('method_not_allowed', 'Use POST or DELETE.', 405, cors)
  if ((request.headers.get('Content-Type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return error('content_type', 'Events require application/json.', 415, cors)
  }
  const announced = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(announced) && announced > MAX_EVENT_BYTES) {
    return error('event_too_large', 'The event is too large.', 413, cors)
  }
  const text = await request.text().catch(() => '')
  if (new TextEncoder().encode(text).byteLength > MAX_EVENT_BYTES) {
    return error('event_too_large', 'The event is too large.', 413, cors)
  }
  let event
  try { event = parseDataSharingEvent(JSON.parse(text)) } catch { event = null }
  if (!event) return error('invalid_event', 'The event does not match its sharing mode.', 400, cors)
  const ttl = event.sharing === 'learning' ? LEARNING_TTL_SECONDS : DIAGNOSTIC_TTL_SECONDS
  try {
    await kv.put(`${prefixFor(id)}${event.eventId}`, JSON.stringify(event), { expirationTtl: ttl })
    return new Response(null, { status: 202, headers: { ...cors, 'Cache-Control': 'no-store' } })
  } catch {
    return error('store_failed', 'The optional event was not stored.', 503, cors)
  }
}
