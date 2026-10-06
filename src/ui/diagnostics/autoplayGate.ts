import { audienceEnablesDeveloperTools, buildAudience } from '../../build/audience'
import { devSwitchesAllowed } from '../../stores/uiStore'

/**
 * THE SOAK SWITCH (performance investigation, developer-only).
 *
 * localStorage `cluecab-diag-autoplay` = '1' makes the app play by itself
 * (autoplay.ts) with Casey scripted (MockCompanion, no network), so a
 * simulator can play for half an hour while the performance log records.
 * Nothing in the app sets the key: it is seeded by the ios-sim workflow's
 * `soak` mode, and it is honoured only in a developer-audience build or on a
 * local dev host (the drives), never in a store or TestFlight feedback build.
 */
export const AUTOPLAY_KEY = 'cluecab-diag-autoplay'

let cached: boolean | null = null

export function diagAutoplayOn(): boolean {
  if (cached !== null) return cached
  let flag = false
  try {
    flag = typeof localStorage !== 'undefined' && localStorage.getItem(AUTOPLAY_KEY) === '1'
  } catch {
    flag = false
  }
  cached = flag && (audienceEnablesDeveloperTools(buildAudience) || devSwitchesAllowed())
  return cached
}

/** The Sightseeing run on screen, for the autoplay's steering. Set only while autoplay is on. */
export interface SteerableRun {
  readonly state: { readonly lane: number; readonly phase: string; readonly held?: unknown }
  activeGate(): { readonly id: number; readonly correct: number; readonly options: readonly unknown[]; readonly reveal: number } | undefined
}
let run: SteerableRun | null = null

/** THE HOOK in SightseeingScreen: hands the autoplay the run it steers. Nothing when autoplay is off. */
export function exposeRunForDiag(engine: SteerableRun): void {
  if (diagAutoplayOn()) run = engine
}

export function diagRun(): SteerableRun | null {
  return run
}
