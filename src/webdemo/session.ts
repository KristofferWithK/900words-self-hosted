/**
 * The website Casey hands out short sessions, one per Turnstile check. The
 * session token lives in memory for this page only; the demo writes nothing.
 * Every decision request carries it as X-Casey-Session, and the Worker counts
 * each session's decisions against its own small budget.
 */
import { AiError, type DecisionAuth } from '../ai/client'
import { UI } from '../i18n'
import { turnstileToken } from './turnstile'
import { useWebDemo } from './webDemoStore'

interface Session {
  token: string
  expiresAt: number
}

/** Mint a new session this long before the old one runs out. */
const EXPIRY_MARGIN_MS = 30_000

let current: Session | null = null
let pending: Promise<Session> | null = null

async function mintSession(): Promise<Session> {
  let token: string
  try {
    token = await turnstileToken(__TURNSTILE_SITE_KEY__)
  } catch {
    throw new AiError('auth', UI.onboarding.demoCheckFailed)
  }
  const response = await fetch(`${__WEB_CASEY_URL__}/casey/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken: token }),
  }).catch(() => {
    throw new AiError('cors', UI.system.caseyUnreachable)
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (body.includes('casey_resting')) {
      useWebDemo.getState().setResting()
      throw new AiError('rate-limit', UI.onboarding.demoRestingBody)
    }
    throw new AiError('auth', UI.onboarding.demoCheckFailed)
  }
  const session = (await response.json()) as { token?: unknown; ttlMs?: unknown }
  if (typeof session.token !== 'string' || typeof session.ttlMs !== 'number' || session.ttlMs <= 0) {
    throw new AiError('invalid-response', UI.system.caseyBadShape)
  }
  // Counted from arrival on this device, so a visitor whose clock is off
  // does not mint a new session (and a new bot check) on every request.
  return { token: session.token, expiresAt: Date.now() + session.ttlMs }
}

export const webDemoAuth: DecisionAuth = {
  async headers() {
    if (!current || current.expiresAt - EXPIRY_MARGIN_MS < Date.now()) {
      pending ??= mintSession().finally(() => {
        pending = null
      })
      current = await pending
    }
    return { 'X-Casey-Session': current.token }
  },
  invalidate() {
    current = null
  },
}

/** Start the check as the demo opens, so Casey's first guess does not wait on it. */
export function prefetchSession(): void {
  void webDemoAuth.headers().catch(() => {
    /* the first decision request asks again and reports the failure */
  })
}
