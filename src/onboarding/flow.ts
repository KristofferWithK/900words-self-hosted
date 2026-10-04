/**
 * Onboarding flow state: which act of the intro a device is in, and whether it
 * should see the intro at all.
 *
 * ── WHY ITS OWN localStorage KEY, NOT A settingsStore FIELD ────────────────
 *
 * The HOWTO_KEY pattern (src/stores/uiStore.ts). `settingsStore` has no
 * `partialize`, so every save ever written carries every field — a default
 * added there reaches no device that has already stored a save without a
 * version bump and a migrate, which is the trap CLAUDE.md records three
 * times. A key of its own has no default to move and nothing to migrate:
 * unset IS the state "never onboarded", exactly like `cluecab-howto-v4`.
 *
 * ── THE GATE ────────────────────────────────────────────────────────────────
 *
 * Onboarding runs only on a genuinely fresh device: this key unset, AND the
 * rules overlay never seen (`cluecab-howto-v4` unset), AND the SRS map empty.
 * Any other device — the owner's phone above all — is marked done silently
 * and never ambushed by a tutorial for a game it has been playing for weeks.
 * `?howto=0`, already in dozens of drive URLs, suppresses the flow too, so
 * the sixteen existing drives did not have to change; `?onboard=1` behind
 * `devSwitchesAllowed()` forces a transient run (see uiStore).
 */

/**
 * v5 is the café world's first session (CW-13, contract section 7): ticket →
 * Casey's two lines → the first Sightseeing walk, which finds the first café →
 * Home, where that café is introduced → the café's practice table with the
 * spotlight tour → the café's own puzzle and its stamp → Home → the suitcase
 * and its three marks. The marker key stays v5: the café acts were added to
 * it, and a marker of the retired staged Home (`home-intro`) resumes at
 * Casey's lines. The v4 train and Home-tour markers still need an explicit
 * translation rather than being resumed blindly.
 */
import { track } from '../analytics/stats'

export const ONBOARD_KEY = 'cluecab-onboard-v5'
export const LEGACY_ONBOARD_KEY = 'cluecab-onboard-v4'
const V3_ONBOARD_KEY = 'cluecab-onboard-v3'
const V2_ONBOARD_KEY = 'cluecab-onboard-v2'
const OLDEST_ONBOARD_KEY = 'cluecab-onboard-v1'

/**
 * The walk-first path (CW-13). `intro` is Casey's two lines before the walk;
 * `walk` is the first Sightseeing walk, which finds the first café;
 * `home-cafe` is Home introducing the café found; `tutorial` is the café's
 * authored small practice table; `real-round` is the café's own puzzle, the
 * first ordinary 3×6 game; `home-return` points at the city's stamp and gates
 * the rest behind Casey; and the two suitcase markers distinguish a tour
 * still to be read from a completed tour whose Back button finishes
 * onboarding. A step is written as the flow advances so a reload — including
 * the language choice reload — resumes the right act rather than starting
 * over.
 */
export type OnboardStep =
  | 'ticket'
  | 'intro'
  | 'walk'
  | 'home-cafe'
  | 'tutorial'
  | 'real-round'
  | 'home-return'
  | 'suitcase'
  | 'suitcase-ready'

export const isOnboardStep = (v: unknown): v is OnboardStep =>
  v === 'ticket' ||
  v === 'intro' ||
  v === 'walk' ||
  v === 'home-cafe' ||
  v === 'tutorial' ||
  v === 'real-round' ||
  v === 'home-return' ||
  v === 'suitcase' ||
  v === 'suitcase-ready'

/**
 * The retired staged Home (`home-intro`, before CW-13) taught the map, the
 * Guide and Play. Its place in the flow is Casey's lines before the walk.
 */
const RETIRED_V5_STEPS: Readonly<Record<string, OnboardStep>> = { 'home-intro': 'intro' }

export type OnboardDecision =
  /** Nothing anywhere says this device has played: run the flow. */
  | { kind: 'fresh' }
  /** The flow was started and not finished — a reload mid-flow, or the
   *  language-choice reload. Pick up at the recorded step. */
  | { kind: 'resume'; step: OnboardStep }
  /** No onboarding record, but the device has clearly played (rules seen, or
   *  words in the SRS map). The caller marks it done silently. */
  | { kind: 'veteran' }
  | { kind: 'done' }

/**
 * Mirrors `HOWTO_KEY` in src/stores/uiStore.ts. A literal rather than an
 * import so this module has no dependencies and no cycle with the store that
 * will import it; flow.test.ts pins the two spellings to each other, so a v5
 * bump over there cannot silently strand this one.
 */
const HOWTO_SEEN_KEY = 'cluecab-howto-v4'

/** srsStore's persist key. Read raw, the `rescueStrandedJourney` precedent. */
const SRS_KEY = 'cluecab-srs-v1'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'removeItem'>>

const local = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

/** Translate a v4 marker into the walk-first v5 sequence. */
function legacyStep(marker: string): OnboardStep | null {
  if (marker === 'ticket') return 'ticket'
  if (marker === 'train') return 'intro'
  if (marker === 'tutorial') return 'tutorial'
  if (marker === 'home') return 'home-return'
  return null
}

/** Translate the longer v3 flow past the acts v4 had already retired. */
function v3Step(marker: string): OnboardStep | null {
  if (marker === 'station' || marker === 'ticket') return 'ticket'
  if (marker === 'train' || marker === 'practice-choice') return 'intro'
  if (marker === 'tutorial') return 'tutorial'
  if (
    marker === 'grammar-offer' ||
    marker === 'grammar' ||
    marker === 'silence' ||
    marker === 'arrival' ||
    marker === 'tour' ||
    marker === 'map'
  ) return 'home-return'
  return null
}

/**
 * Whether the SRS map holds no words. The key never written counts as empty;
 * a record that PARSES to an empty stats map counts as empty; anything else —
 * words in it, an unexpected shape, corrupt JSON — counts as not empty,
 * because the gate must only open when the device can be PROVEN fresh. A
 * wrong "veteran" costs a replayable intro; a wrong "fresh" ambushes a
 * player, so ties break toward veteran.
 */
function srsMapEmpty(storage: ReadableStorage): boolean {
  const raw = storage.getItem(SRS_KEY)
  if (raw === null) return true
  try {
    const stats = (JSON.parse(raw) as { state?: { stats?: unknown } })?.state?.stats
    return (
      typeof stats === 'object' && stats !== null && Object.keys(stats).length === 0
    )
  } catch {
    return false
  }
}

/**
 * The gate, as one total function. Storage that throws (private mode) lands
 * on `done` — never ambush a device we cannot read.
 */
export function decideOnboarding(storage: ReadableStorage | undefined = local()): OnboardDecision {
  if (!storage) return { kind: 'done' }
  try {
    const marker = storage.getItem(ONBOARD_KEY)
    if (marker === 'done') return { kind: 'done' }
    if (isOnboardStep(marker)) return { kind: 'resume', step: marker }
    const retired = marker === null ? undefined : RETIRED_V5_STEPS[marker]
    if (retired) return { kind: 'resume', step: retired }
    // Any other non-null marker is a step this build does not know — written
    // by a newer build, then downgraded. The flow was begun; restart it.
    if (marker !== null) return { kind: 'resume', step: 'ticket' }

    // v4's train and Home tour no longer exist as standalone acts.
    const legacyMarker = storage.getItem(LEGACY_ONBOARD_KEY)
    if (legacyMarker === 'done') return { kind: 'done' }
    const migrated = legacyMarker === null ? null : legacyStep(legacyMarker)
    if (migrated) return { kind: 'resume', step: migrated }
    if (legacyMarker !== null) return { kind: 'resume', step: 'ticket' }

    // v3 had several optional acts between the train and Home.
    const v3Marker = storage.getItem(V3_ONBOARD_KEY)
    if (v3Marker === 'done') return { kind: 'done' }
    const migratedV3 = v3Marker === null ? null : v3Step(v3Marker)
    if (migratedV3) return { kind: 'resume', step: migratedV3 }
    if (v3Marker !== null) return { kind: 'resume', step: 'ticket' }

    // v2 had station/ticket/train/tutorial/tour/map. Its tutorial can resume;
    // TutorialAct replaces the old 3×4 deal with the current 3×3 practice board.
    const v2Marker = storage.getItem(V2_ONBOARD_KEY)
    if (v2Marker === 'done') return { kind: 'done' }
    if (v2Marker === 'ticket') return { kind: 'resume', step: 'ticket' }
    if (v2Marker === 'train') return { kind: 'resume', step: 'intro' }
    if (v2Marker === 'tutorial') return { kind: 'resume', step: 'tutorial' }
    if (v2Marker === 'tour' || v2Marker === 'map' || v2Marker === 'arrival') {
      return { kind: 'resume', step: 'home-return' }
    }
    if (v2Marker !== null) return { kind: 'resume', step: 'ticket' }

    // v1's `train` was its first, exterior scene. It must not be confused
    // with a later flow's train marker if an older install returns after update.
    const oldestMarker = storage.getItem(OLDEST_ONBOARD_KEY)
    if (oldestMarker === 'done') return { kind: 'done' }
    if (oldestMarker === 'arrival') return { kind: 'resume', step: 'home-return' }
    if (oldestMarker !== null) return { kind: 'resume', step: 'ticket' }
    if (storage.getItem(HOWTO_SEEN_KEY) !== null) return { kind: 'veteran' }
    if (!srsMapEmpty(storage)) return { kind: 'veteran' }
    return { kind: 'fresh' }
  } catch {
    return { kind: 'done' }
  }
}

/** Record the act the flow has reached, so a reload resumes there. */
export function writeOnboardStep(step: OnboardStep, storage: WritableStorage | undefined = local()): void {
  // Counted: how far the intro gets is the first thing a launch wants to know.
  track({ name: 'onboarding_step', kind: step })
  try {
    storage?.setItem(ONBOARD_KEY, step)
  } catch {
    // Private mode or full quota: the flow still runs, it just cannot resume.
  }
}

/** Finished, skipped, or inferred from a device that has clearly played. */
export function markOnboardDone(storage: WritableStorage | undefined = local()): void {
  track({ name: 'onboarding_step', kind: 'done' })
  try {
    storage?.setItem(ONBOARD_KEY, 'done')
    storage?.removeItem?.(ONBOARD_LESSONS_KEY)
  } catch {
    // Same bargain as above: worst case the intro offers itself again.
  }
}

/**
 * The contextual lessons that ride on real screens rather than owning an
 * act: the translation controls, the full wheel before its spin, the first
 * full board's result, and Home's city stamp. Each is `done` (read to the end) or `dismissed` (the
 * learner chose Skip or Escape); absent means still owed. A lesson whose
 * controls never mounted records nothing, so it is offered again later.
 *
 * Its own key for the same reason as ONBOARD_KEY: unset IS "nothing seen",
 * so there is no default to move and nothing to migrate. Only a persisted run
 * writes it; a Settings replay keeps its lessons in memory.
 */
export const ONBOARD_LESSONS_KEY = 'cluecab-onboard-lessons-v1'

export type OnboardLesson = 'translation' | 'wheel' | 'result' | 'home'
export type OnboardLessonStatus = 'done' | 'dismissed'
export type OnboardLessons = Partial<Record<OnboardLesson, OnboardLessonStatus>>

const isLessonStatus = (v: unknown): v is OnboardLessonStatus => v === 'done' || v === 'dismissed'

/** A corrupt or foreign record reads as nothing seen: a lesson repeats, play never resets. */
export function readOnboardLessons(storage: ReadableStorage | undefined = local()): OnboardLessons {
  try {
    const raw = storage?.getItem(ONBOARD_LESSONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    const lessons: OnboardLessons = {}
    for (const lesson of ['translation', 'wheel', 'result', 'home'] as const) {
      const status = parsed?.[lesson]
      if (isLessonStatus(status)) lessons[lesson] = status
    }
    return lessons
  } catch {
    return {}
  }
}

export function writeOnboardLessons(
  lessons: OnboardLessons,
  storage: WritableStorage | undefined = local(),
): void {
  try {
    storage?.setItem(ONBOARD_LESSONS_KEY, JSON.stringify(lessons))
  } catch {
    // Private mode: the lesson may be offered once more after a reload.
  }
}
