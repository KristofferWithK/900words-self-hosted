/**
 * The Casey decision service this app talks to.
 *
 * One entry, on purpose: it is the address the brain switch's ON restores after
 * a Base URL of your own has been typed, and the address `providerFor` checks
 * to decide whether the switch reads as ON. A custom URL is still free text, so
 * a self-hosted compatible Casey Worker remains one field away. The chip row
 * that used to list this entry is gone (2026-09-12): with one entry it only
 * repeated what the switch does.
 *
 * A raw OpenAI-compatible endpoint is intentionally not a provider here: SEC3
 * requires the server to own model selection, prompts, validation and authored
 * evaluator data. A custom value therefore means another compatible Casey
 * Worker, not a model host.
 */
export interface Provider {
  id: string
  /** Base URL; the client appends /casey/decision. */
  baseUrl: string
}

import { DEFAULT_BASE_URL } from './client'

export const PROVIDERS: readonly Provider[] = [
  {
    id: 'cluecabulary',
    baseUrl: DEFAULT_BASE_URL,
  },
]

/** Which preset a base URL corresponds to, for showing the switch as ON. */
export function providerFor(baseUrl: string): Provider | undefined {
  const normalized = baseUrl.trim().replace(/\/+$/, '').toLowerCase()
  return PROVIDERS.find((p) => p.baseUrl.toLowerCase() === normalized)
}
