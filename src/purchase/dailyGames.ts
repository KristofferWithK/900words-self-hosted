import { buildAudience } from '../build/audience'
import { SETTLEMENT_KEY, validatedLedger } from '../stores/settlementStorage'
import { usePass } from './passStore'
import { billingPlatform, passProducts, type PassOffer, type PassStatus } from './pass'
import { reviewAccessActive } from './reviewAccess'

/**
 * THE DAILY LIMIT FOR FREE PLAYERS (docs/roadmap/cafe-world.md section 8;
 * card CW-04): two runs and two puzzles a local day, counted apart. Unlimited
 * (or Google Play review access) lifts both. Only the store builds apply it
 * (`dailyGateApplies`).
 *
 * PUZZLES are the board game ("café puzzle"), counted exactly as before the
 * café world: durable completed-game receipts of today (`completedToday`).
 * `FREE_GAMES_PER_DAY`, `canStartDailyGame` and `dailyLimitReached` keep
 * their names and their behaviour; `FREE_PUZZLES_PER_DAY` is the same two.
 *
 * RUNS are Sightseeing walks and train runs. A run counts once its first word
 * is answered, right or wrong (owner O6); a run left before that costs
 * nothing. They are counted on this device under `RUNS_KEY`, by the local
 * day of that first answer (`localDay`, the same day key as the puzzles).
 */
export const FREE_GAMES_PER_DAY = 2
/** The board game's daily two: the same number and the same count as `FREE_GAMES_PER_DAY`. */
export const FREE_PUZZLES_PER_DAY = FREE_GAMES_PER_DAY
/** Free runs (Sightseeing or train) per local day. */
export const FREE_RUNS_PER_DAY = 2

/** Device-local calendar day. This is a play limit, not server-side anti-tampering. */
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Count durable completed-game receipts; the receipt ledger is the only authority. */
export function completedToday(storage: Pick<Storage, 'getItem'>, day = localDay()): number {
  // A corrupt/unavailable authority must never unlock another free deal.
  return readCompleted(storage, day) ?? FREE_GAMES_PER_DAY
}

/** `completedToday`, or null when the receipt ledger cannot be read. */
function readCompleted(storage: Pick<Storage, 'getItem'>, day: string): number | null {
  try {
    const raw = storage.getItem(SETTLEMENT_KEY)
    if (raw === null) return 0
    // Validated once per stored string (settlementStorage); read, never kept.
    const durable = validatedLedger(raw).ledger
    const attempts = new Set<string>()
    for (const { receipt } of Object.values(durable.settlements)) {
      if (receipt.localDate !== day || receipt.games.played !== 1) continue
      if (receipt.evidence.origin === 'tutorial' || receipt.evidence.origin === 'retired-wrapup') continue
      attempts.add(receipt.attemptId)
    }
    // Rounds already shortened into the history archive count the same way.
    for (const round of Object.values(durable.archived ?? {})) {
      if (round.localDate !== day || round.games.played !== 1) continue
      if (round.origin === 'tutorial' || round.origin === 'retired-wrapup') continue
      attempts.add(round.attemptId)
    }
    return attempts.size
  } catch {
    return null
  }
}

/**
 * The store builds (App Store and Google Play) use this gate. The web, the
 * separately configured self-hosted build and every other audience never do.
 */
export function dailyGateApplies(): boolean {
  return buildAudience === 'normal' && billingPlatform() !== null
}

/** Paid Unlimited from this device's store, or (Android only) Google Play review access. */
function unlimited(): boolean {
  return usePass.getState().status === 'entitled' || reviewAccessActive()
}

export function canStartDailyGame(): boolean {
  if (introPuzzleAdmitted) return true
  if (!dailyGateApplies()) return true
  if (unlimited()) return true
  try { return completedToday(localStorage) < FREE_GAMES_PER_DAY } catch { return false }
}

/**
 * THE INTRO'S CAFÉ PUZZLE (owner, 2026-10-04: "phase 2 of the intro is a full
 * game ... It's part of the intro"). The intro's full board, on a first
 * session and on a Settings replay alike, is never refused by the daily
 * limit, and it counts like any other puzzle once it is completed. The intro
 * admits it around the one deal call (src/ui/introRound.ts) and ends the
 * admission straight after, so nothing else is let through. Nothing is stored.
 */
let introPuzzleAdmitted = false

/** Deal the intro's café puzzle past the daily limit: `deal` runs admitted. */
export function withIntroPuzzleAdmitted<T>(deal: () => T): T {
  introPuzzleAdmitted = true
  try {
    return deal()
  } finally {
    introPuzzleAdmitted = false
  }
}

/** Require no purchasable store offer before showing the developer-only retry. */
export function canDeveloperContinue(
  status: PassStatus = usePass.getState().status,
  offers: readonly PassOffer[] = usePass.getState().offers,
): boolean {
  const products: string[] = Object.values(passProducts())
  const hasPurchasablePass = offers.some(({ id, displayPrice }) => products.includes(id) && displayPrice.trim().length > 0)
  return !hasPurchasablePass && (status === 'not-entitled' || status === 'unavailable' || status === 'error')
}

export function dailyLimitReached(): boolean {
  if (!dailyGateApplies() || unlimited()) return false
  try { return completedToday(localStorage) >= FREE_GAMES_PER_DAY } catch { return true }
}

export function showLimitOnHomeReturn(previous: string, current: string, roundRecorded: boolean, limitReached: boolean): boolean {
  return previous === 'game' && current === 'home' && roundRecorded && limitReached
}

// ── Runs (Sightseeing walks and train runs) ─────────────────────────────────

/**
 * Runs counted on this device: `{ "days": { "YYYY-MM-DD": n } }`, the local
 * day of each run's first answer. Only the most recent `KEPT_RUN_DAYS` days
 * are kept; nothing reads further back than today.
 *
 * Device-local on purpose, like the limit itself ("clearing app data resets
 * it", reviewAccess.ts): not part of the backup file and not touched by a
 * restore, so a restore can never refund a run. It is a play counter, not
 * progress; the run's photos and café finds are the progress, and they live
 * in the journey store and the backup.
 */
export const RUNS_KEY = 'cluecab-daily-runs-v1'
export const KEPT_RUN_DAYS = 7

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The stored counts, or null when the value is there but is not ours. */
function readRunDays(raw: string | null): Record<string, number> | null {
  if (raw === null) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const days = (parsed as { days?: unknown }).days
  if (!days || typeof days !== 'object' || Array.isArray(days)) return null
  const out: Record<string, number> = {}
  for (const [day, n] of Object.entries(days)) {
    if (!DAY_KEY.test(day) || typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) return null
    out[day] = n
  }
  return out
}

/** Runs counted for `day`. A stored value that cannot be read never unlocks another free run. */
export function runsToday(storage: Pick<Storage, 'getItem'>, day = localDay()): number {
  try {
    const days = readRunDays(storage.getItem(RUNS_KEY))
    return days === null ? FREE_RUNS_PER_DAY : days[day] ?? 0
  } catch {
    return FREE_RUNS_PER_DAY
  }
}

/**
 * `runsToday` for the gate, which also heals the counter: a value that cannot
 * be read is rewritten as today's two runs used. That fails closed today, as
 * `runsToday` does, and tomorrow the counter reads again and the player has
 * their two runs back. Without it, only a counted run could repair the value,
 * and a free player who cannot start a run would be locked out for ever.
 */
export function runsTodayHealing(storage: Pick<Storage, 'getItem' | 'setItem'>, day = localDay()): number {
  let raw: string | null
  try { raw = storage.getItem(RUNS_KEY) } catch { return FREE_RUNS_PER_DAY }
  let days: Record<string, number> | null
  try { days = readRunDays(raw) } catch { days = null }
  if (days !== null) return days[day] ?? 0
  try { storage.setItem(RUNS_KEY, JSON.stringify({ days: { [day]: FREE_RUNS_PER_DAY } })) } catch { /* still fails closed */ }
  return FREE_RUNS_PER_DAY
}

/**
 * Count one run against the local day of `at`, the time of its first answer
 * (O6). Called once per run by the run's results sink (src/run/sinkSetup.ts),
 * whoever the player is: an Unlimited player's runs are counted too, so the
 * count stays true if the pass lapses. Never throws; a value that cannot be
 * read is replaced, since the count it held is unknowable anyway.
 */
export function countRun(at: number, storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
  try {
    const store = storage ?? localStorage
    // The first session's walk is admitted once, and counted like any other
    // (CW-15, below): its first answer uses the admission up.
    firstWalkAdmitted = false
    const day = localDay(new Date(at))
    let days: Record<string, number> | null
    try { days = readRunDays(store.getItem(RUNS_KEY)) } catch { days = null }
    const next: Record<string, number> = { ...(days ?? {}), [day]: (days?.[day] ?? 0) + 1 }
    const kept = Object.keys(next).sort().slice(-KEPT_RUN_DAYS)
    store.setItem(RUNS_KEY, JSON.stringify({ days: Object.fromEntries(kept.map((d) => [d, next[d]!])) }))
  } catch {
    // Storage unavailable: nothing can be counted, and nothing else may break.
  }
}

/** Whether a run may start now. Ask before a run (or a train run) begins. */
export function canStartRun(): boolean {
  if (firstWalkAdmitted) return true
  if (!dailyGateApplies()) return true
  if (unlimited()) return true
  try { return runsTodayHealing(localStorage) < FREE_RUNS_PER_DAY } catch { return false }
}

/** Today's free runs are used up. */
export function runLimitReached(): boolean {
  if (firstWalkAdmitted || !dailyGateApplies() || unlimited()) return false
  try { return runsTodayHealing(localStorage) >= FREE_RUNS_PER_DAY } catch { return true }
}

/** Whether a café puzzle may start now: the board game's own gate, unchanged. */
export const canStartPuzzle = canStartDailyGame
/** Today's free puzzles are used up: the board game's own reading, unchanged. */
export const puzzleLimitReached = dailyLimitReached

export interface DailyAllowance {
  /** No limit applies: not a store build, Unlimited, or Play review access. */
  readonly unlimited: boolean
  readonly runs: { readonly used: number; readonly limit: number }
  readonly puzzles: { readonly used: number; readonly limit: number }
  /** A count could not be read: it reads as used up (the gate fails closed), and the paywall says nothing about today. */
  readonly unreadable?: true
}

/**
 * Today's two counts side by side, for the paywall (CW-15). Read only: it is
 * read while the dialog draws, so it writes nothing. A run counter that cannot
 * be read reads as used up, as the gate does; the gate (`canStartRun`, at the
 * tap) or the next counted run rewrites it.
 */
export function dailyAllowance(storage: Pick<Storage, 'getItem'> = localStorage, day = localDay()): DailyAllowance {
  let runs: number | null
  try {
    const days = readRunDays(storage.getItem(RUNS_KEY))
    runs = days === null ? null : days[day] ?? 0
  } catch {
    runs = null
  }
  const puzzles = readCompleted(storage, day)
  return {
    unlimited: !dailyGateApplies() || unlimited(),
    runs: { used: runs ?? FREE_RUNS_PER_DAY, limit: FREE_RUNS_PER_DAY },
    puzzles: { used: puzzles ?? FREE_PUZZLES_PER_DAY, limit: FREE_PUZZLES_PER_DAY },
    ...(runs === null || puzzles === null ? { unreadable: true as const } : {}),
  }
}

/** Which of today's free limits a refused start ran into, for the paywall's words (CW-15). */
export type DailyLimitKind = 'runs' | 'puzzles' | 'both' | 'unknown'

/**
 * Which limit the paywall speaks of. `unknown` when a count could not be read,
 * or when neither limit is reached (a new day began while the dialog stood
 * open): the dialog then claims nothing about today.
 */
export function dailyLimitKind(allowance: DailyAllowance): DailyLimitKind {
  if (allowance.unreadable) return 'unknown'
  const runs = allowance.runs.used >= allowance.runs.limit
  const puzzles = allowance.puzzles.used >= allowance.puzzles.limit
  if (runs && puzzles) return 'both'
  if (runs) return 'runs'
  if (puzzles) return 'puzzles'
  return 'unknown'
}

// ── The first session's walk (CW-15) ────────────────────────────────────────

/**
 * ONBOARDING DAY ONE. The first session's walk (the one Casey's "Let's go"
 * starts) is never refused, and it counts like any other walk: free means two
 * walks and two café puzzles a day (contract section 8). On a fresh device
 * the counts are 0 anyway; the admission is for the rare first session that
 * meets a count already used (a reload or a resumed intro), which would
 * otherwise stop the intro's walk with no dialog to say why (the dialog never
 * covers a first session).
 *
 * The intro's walk act admits it (`admitFirstWalk`) while it is on screen;
 * admitted, `canStartRun` says yes. The run's first answer (`countRun`, from
 * the results sink) counts the run and uses the admission up, so a "Walk
 * again" asks the count as usual. Leaving the act ends it
 * (`endFirstWalkAdmission`). Nothing is stored.
 */
let firstWalkAdmitted = false

/** Admit the first session's walk (`firstSession`: a real first run, started by "Let's go"). Returns whether it did. */
export function admitFirstWalk(firstSession: boolean): boolean {
  firstWalkAdmitted = firstSession
  return firstWalkAdmitted
}

/** The walk act has gone: whatever is left of the admission goes with it. */
export function endFirstWalkAdmission(): void {
  firstWalkAdmitted = false
}
