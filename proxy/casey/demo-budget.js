/**
 * The website Casey's spending meter: one Durable Object per UTC day, so the
 * daily cap is counted exactly (a Durable Object handles one request at a
 * time) rather than approximately, as a KV counter would under a burst.
 *
 * It holds only counts: the day's total, and per session its decisions and
 * dictionary lookups. No IP, token, word or clue. An alarm clears the day two
 * days later.
 *
 * Protocol (internal, called only by web-worker.js through the binding):
 *   POST /spend  { sid, kind: 'decision'|'translate'|'peek', caps, net }
 *     -> { ok: true } | { ok: false, reason: 'global'|'session'|'translate'|'network' }
 *
 * `net` is a daily-rotating HMAC of the caller's network, never an address.
 */
const DAY_MS = 24 * 60 * 60 * 1000

export class DemoBudget {
  constructor(state) {
    this.state = state
  }

  async fetch(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 })
    }
    const { sid, kind, caps, net } = body ?? {}
    if (typeof sid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(sid)) {
      return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 })
    }
    const storage = this.state.storage
    if (!(await storage.getAlarm?.())) await storage.setAlarm?.(Date.now() + 2 * DAY_MS)
    const global = (await storage.get('global')) ?? 0
    if (global >= caps.global) return Response.json({ ok: false, reason: 'global' })
    if (kind === 'peek') return Response.json({ ok: true })
    if (typeof net !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(net)) {
      return Response.json({ ok: false, reason: 'bad_request' }, { status: 400 })
    }
    const netKey = `n:${net}`
    const network = (await storage.get(netKey)) ?? 0
    if (network >= caps.net) return Response.json({ ok: false, reason: 'network' })
    const sessionKey = `s:${sid}`
    const session = (await storage.get(sessionKey)) ?? 0
    if (session >= caps.session) return Response.json({ ok: false, reason: 'session' })
    if (kind === 'translate') {
      const lookupKey = `t:${sid}`
      const lookups = (await storage.get(lookupKey)) ?? 0
      if (lookups >= caps.translate) return Response.json({ ok: false, reason: 'translate' })
      await storage.put(lookupKey, lookups + 1)
    }
    await storage.put(sessionKey, session + 1)
    await storage.put(netKey, network + 1)
    await storage.put('global', global + 1)
    return Response.json({ ok: true })
  }

  async alarm() {
    await this.state.storage.deleteAll()
  }
}
