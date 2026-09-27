/**
 * Anonymous usage counters — on by default, off in Settings (owner,
 * 2026-09-07: "I want analytics at launch").
 *
 * What leaves the phone is a count and nothing that names it: an event's
 * name, the build stamp, the platform, the language, and for a round its
 * city, mode, outcome and clue count. There is NO identifier of any kind in
 * a batch — not the install id the quota uses, not a device id, not a
 * session id — and the Worker refuses a batch that carries one
 * (`proxy/worker.js`, the stats route). That is the whole reason this can be
 * on by default: with nothing to link the events to, they are not personal
 * data, and Apple's tracking prompt does not apply because nothing links
 * across apps or to a third party. It is declared on the App Privacy label
 * as usage and diagnostics data not linked to you, and described in
 * `public/privacy.html`. The opt-in data-sharing choice (H10) is a different
 * thing: it carries the player's own clue text and stays opt-in.
 *
 * Batches go out when the app goes to the background (`visibilitychange` →
 * hidden, `pagehide`) through `sendBeacon`, which the browser finishes after
 * the page is gone, and as a plain-text body so no CORS preflight stands in
 * the way of an unload-time request. A batch that fills up is sent at once.
 */
import { isWebDemo } from '../build/audience'
import { Capacitor } from '@capacitor/core'
import { assertCaseyBaseAllowed } from '../ai/client'
import { ACTIVE } from '../lang/active'
import { useSettings } from '../stores/settingsStore'

export const STATS_PROTOCOL = 1
/** A batch is sent when it reaches this many events, or when the app hides. */
export const STATS_BATCH = 20

/** The names the Worker accepts; anything else is dropped there and here. */
export const STAT_NAMES = [
  'app_open',
  'onboarding_step',
  'round_start',
  'round_end',
  'train_closed',
  'casey_error',
  'audio_failed',
  'reminder_prompt',
] as const
export type StatName = (typeof STAT_NAMES)[number]

export interface StatEvent {
  name: StatName
  /** Route city index, for round events. */
  city?: number
  /** 'normal' | 'wrapup' | 'tutorial' | 'daily' for rounds. */
  mode?: string
  /** 'won' | 'lost' for rounds; 'yes' | 'no' for a prompt. */
  outcome?: string
  /** A short reason or step: the round's ending, an error kind, an onboarding step. */
  kind?: string
  /** A small count, e.g. the clues a round took. */
  n?: number
}

/** The Worker's parseStatsBatch accepts exactly these; anything else is dropped unseen. */
export type StatsPlatform = 'ios' | 'android' | 'web'

export interface StatBatch {
  protocol: typeof STATS_PROTOCOL
  build: string
  platform: StatsPlatform
  lang: string
  events: StatEvent[]
}

const SHORT = /^[a-z0-9-]{1,32}$/

/** Keep an event to the shape the Worker will take; drop anything else. */
function shaped(event: StatEvent): StatEvent | null {
  if (!STAT_NAMES.includes(event.name)) return null
  const out: StatEvent = { name: event.name }
  if (event.city !== undefined && Number.isInteger(event.city) && event.city >= 0 && event.city < 20) out.city = event.city
  for (const key of ['mode', 'outcome', 'kind'] as const) {
    const value = event[key]
    if (typeof value === 'string' && SHORT.test(value)) out[key] = value
  }
  if (event.n !== undefined && Number.isInteger(event.n) && event.n >= 0 && event.n < 1000) out.n = event.n
  return out
}

const queue: StatEvent[] = []

export const statsEndpoint = (baseUrl: string) => {
  assertCaseyBaseAllowed(baseUrl)
  return new URL('stats', `${baseUrl.replace(/\/+$/, '')}/`).href
}

/** Ports for the test seam; the browser wiring below is the default. */
export interface StatsPorts {
  enabled(): boolean
  baseUrl(): string
  send(url: string, body: string): void
  build(): string
  platform(): StatsPlatform
}

const browserPorts: StatsPorts = {
  // The website demo sends no usage counters at all (its privacy promise).
  // Nor does a self-built one with no Casey server: there is nowhere to send them.
  enabled: () => !isWebDemo() && useSettings.getState().usageStats && useSettings.getState().baseUrl.trim() !== '',
  baseUrl: () => useSettings.getState().baseUrl,
  send: (url, body) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        if (navigator.sendBeacon(url, body)) return
      }
      if (typeof fetch === 'function') {
        void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(
          () => {},
        )
      }
    } catch {
      // A counter that cannot be sent is a counter that is lost. Nothing else.
    }
  },
  build: () => (typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'dev'),
  // Asked of Capacitor rather than inferred from isNativePlatform(), which
  // would have filed an Android shell under 'ios' the day one exists.
  platform: () => {
    const platform = Capacitor.getPlatform()
    return platform === 'ios' || platform === 'android' ? platform : 'web'
  },
}

let ports: StatsPorts = browserPorts

/** Tests only. */
export function useStatsPorts(next: StatsPorts | null): void {
  ports = next ?? browserPorts
  queue.length = 0
}

/** Send what is queued. Called on hide, on a full batch, and by tests. */
export function flushStats(): void {
  if (queue.length === 0) return
  const events = queue.splice(0, queue.length)
  if (!ports.enabled()) return
  const batch: StatBatch = {
    protocol: STATS_PROTOCOL,
    build: ports.build(),
    platform: ports.platform(),
    lang: ACTIVE.code,
    events,
  }
  ports.send(statsEndpoint(ports.baseUrl()), JSON.stringify(batch))
}

/** Count one thing. Cheap, synchronous, never throws, silent when the switch is off. */
export function track(event: StatEvent): void {
  try {
    if (!ports.enabled()) return
    const ok = shaped(event)
    if (!ok) return
    queue.push(ok)
    if (queue.length >= STATS_BATCH) flushStats()
  } catch {
    // Never let a counter reach the game.
  }
}

/** What is waiting to go; tests read it. */
export const pendingStats = (): readonly StatEvent[] => queue

/** Wire the flush to the moments the page goes away. Once, from App. */
export function installStatsFlush(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStats()
  })
  window.addEventListener('pagehide', () => flushStats())
}
