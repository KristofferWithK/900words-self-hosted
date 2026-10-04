import { unloadGemma } from './native'

/**
 * Whether anything may ask offline Casey for a move: an unfinished round she
 * plays is open on the game screen (GameScreen says so, in normal play and in
 * the intro).
 *
 * Her model holds about 3.4 GB of memory once loaded, and it used to stay
 * loaded until the app was killed. Now it is put away the moment she stops
 * being wanted: her round ends, the player leaves the round, or they go back
 * to normal Casey. Leaving the app puts her away too, natively
 * (GemmaPlugin.swift, GemmaPlugin.kt). A later move loads her again.
 */
let wanted = false

export function offlineCaseyWanted(): boolean {
  return wanted
}

export function setOfflineCaseyWanted(next: boolean): void {
  const was = wanted
  wanted = next
  if (was && !next) void unloadGemma().catch(() => {})
}
