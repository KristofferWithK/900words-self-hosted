import { assertCaseyBaseAllowed, installId } from '../ai/client'
import type { DataSharingChoice } from '../stores/settingsStore'
import { buildRoundDataEvent, type RoundDataSource } from './schema'

const endpoint = (baseUrl: string) => {
  assertCaseyBaseAllowed(baseUrl)
  return new URL('data-sharing/events', `${baseUrl.replace(/\/+$/, '')}/`).href
}

export const roundEventId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '')

/** Best-effort only: optional sharing must never delay or break a completed round. */
export async function shareCompletedRound(
  choice: DataSharingChoice | null,
  baseUrl: string,
  source: RoundDataSource,
): Promise<void> {
  if (choice !== 'diagnostics' && choice !== 'learning') return
  try {
    const event = buildRoundDataEvent(choice, source)
    await fetch(endpoint(baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId() },
      body: JSON.stringify(event),
      keepalive: true,
    })
  } catch {
    // Consent controls eligibility, not gameplay. A failed optional send is dropped.
  }
}

/** Stops no local progress; removes only this random installation's remote events. */
export async function deleteSharedData(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(endpoint(baseUrl), {
      method: 'DELETE',
      headers: { 'X-Install-Id': installId() },
      keepalive: true,
    })
    return response.status === 204
  } catch {
    return false
  }
}
