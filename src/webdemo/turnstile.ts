/**
 * Cloudflare Turnstile, the website demo's bot check. Loaded only inside the
 * demo, and the demo loads only after a visitor presses Play on 900words.app.
 * The widget is "interaction-only": most visitors never see it, and a visitor
 * Cloudflare is unsure about gets one tap to prove they are human.
 *
 * Its token is spent once, at the website Casey's session route; the demo
 * keeps nothing else from it.
 */
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile unavailable')))
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile unavailable'))
    }
    document.head.appendChild(script)
  })
  return loading
}

function container(): HTMLElement {
  let element = document.getElementById('turnstile-slot')
  if (!element) {
    element = document.createElement('div')
    element.id = 'turnstile-slot'
    element.className = 'turnstile-slot'
    document.body.appendChild(element)
  }
  return element
}

/** Give up on a check (script or challenge) that has not answered by then. */
const CHECK_TIMEOUT_MS = 60_000

/** A fresh Turnstile token for the action "demo". */
export async function turnstileToken(siteKey: string): Promise<string> {
  let timer = 0
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('turnstile timed out')), CHECK_TIMEOUT_MS)
  })
  try {
    return await Promise.race([solve(siteKey), timeout])
  } finally {
    window.clearTimeout(timer)
  }
}

async function solve(siteKey: string): Promise<string> {
  const api = await loadTurnstile()
  return new Promise<string>((resolve, reject) => {
    let widgetId = ''
    const done = (fn: () => void) => {
      fn()
      try {
        api.remove(widgetId)
      } catch {
        /* already gone */
      }
    }
    widgetId = api.render(container(), {
      sitekey: siteKey,
      action: 'demo',
      appearance: 'interaction-only',
      callback: (token: string) => done(() => resolve(token)),
      'error-callback': () => done(() => reject(new Error('turnstile failed'))),
      'expired-callback': () => done(() => reject(new Error('turnstile expired'))),
      'timeout-callback': () => done(() => reject(new Error('turnstile challenge timed out'))),
    })
  })
}
