import { isWebDemo } from '../build/audience'
import { createWordAudioScope } from '../ui/speak'
import { INSTRUCTIONAL_CONTEXT, type ExampleContext } from '../review/examplePresentation'
import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import {
  decideOnboarding,
  markOnboardDone,
  readOnboardLessons,
  writeOnboardLessons,
  writeOnboardStep,
  type OnboardLesson,
  type OnboardLessonStatus,
  type OnboardLessons,
  type OnboardStep,
} from '../onboarding/flow'
import { buildAudience, type BuildAudience } from '../build/audience'

export type Screen = 'home' | 'game' | 'settings' | 'suitcase' | 'map' | 'guide' | 'pass' | 'sightseeing'

/** A one-use handoff into the fixed Travel Guide, never saved as progress. */
export type GuideEntryIntent =
  | {
      readonly kind: 'grammar'
      readonly cityIndex: number
      /**
       * The wrap-up's "Both" (owner, 2026-09-11): read the grammar book, and
       * on its last page turn straight into this exchange instead of stopping.
       * The chain is the train ride's own (BookReader's onPastEnd); the back
       * arrow abandons it, so a reader left early never teleports anyone.
       */
      readonly thenExchange?: number
    }
  | { readonly kind: 'survival'; readonly cityIndex: number; readonly exchangeIndex: number }
  /** A settled receipt's authored curriculum activity, projected read-only. */
  | { readonly kind: 'curriculum-offer'; readonly cityIndex: number; readonly itemId: string }

/**
 * The intro being on screen, and whether walking it writes anything.
 * `persist: true` is the real first run — each act advances the stored step
 * marker and finishing writes the done flag. `persist: false` is a transient
 * run (Settings' "Replay the intro", or `?onboard=1` in a drive): the same
 * screens, no storage touched, so the done flag stays exactly as it was.
 */
export interface OnboardingRun {
  step: OnboardStep
  persist: boolean
  /** Contextual lessons already done or dismissed on this run (flow.ts). */
  lessons?: OnboardLessons
}

interface UiState {
  screen: Screen
  /** Word id shown in the dictionary bottom sheet, if open. */
  sheetWordId: string | null
  sheetAudio: ReturnType<typeof createWordAudioScope>
  sheetContext: ExampleContext
  /** Fixed board seed from the ?seed= URL param (dev/e2e). */
  pendingSeed: number | null
  /** Dev switch only: ?first=player starts the round with the player cluing. */
  pendingFirstGiver: 'player' | 'ai' | null
  /** Exit decision over an unfinished game: resume, pause, or discard. */
  leaveGameOpen: boolean
  dailyLimitOpen: boolean
  /** Retry the exact blocked start once, only when the developer action is tapped. */
  dailyLimitRetry: (() => boolean) | null
  /** The intro (the train in), when it is on screen. See App.tsx. */
  onboarding: OnboardingRun | null
  /**
   * The city being ENTERED, when Home's train has just been boarded — the ride is
   * MapScreen's to play (it owns TrainRide and the Arrival it hands over to),
   * and this is how Home asks for it without the map appearing on the way.
   * Read once, as MapScreen mounts, and cleared there.
   */
  pendingRide: number | null
  /** Set by the wrap-up summary and consumed when the Guide mounts. */
  guideEntry: GuideEntryIntent | null
  goTo: (screen: Screen) => void
  /** Open the Guide at a particular current-city page; intent is transient. */
  openGuide: (entry: GuideEntryIntent) => void
  /** Read exactly once when the Guide has accepted its entry route. */
  consumeGuideEntry: () => GuideEntryIntent | null
  /**
   * Board the train from Home: the map is the route this takes, not a screen
   * the player is made to visit. Call `journey.travel()` first — this only
   * says which destination city the ride is entering.
   */
  boardTrain: (destination: number) => void
  openSheet: (wordId: string, context?: ExampleContext) => void
  closeSheet: () => void
  /**
   * Open the round-exit decision. A system Back has already consumed the game
   * screen's history entry, so it asks for that entry to be restored first.
   */
  requestGameExit: (restoreScreenEntry?: boolean) => void
  closeGameExit: () => void
  openDailyLimit: (retry?: () => boolean) => void
  closeDailyLimit: () => void
  /** A transient re-run — replay from Settings, or ?onboard=1. */
  startOnboarding: () => void
  advanceOnboarding: (step: OnboardStep) => void
  /**
   * Record that a contextual lesson was read or dismissed. Never called for a
   * lesson whose controls failed to mount, so that one stays owed.
   */
  markOnboardingLesson: (lesson: OnboardLesson, status: OnboardLessonStatus) => void
  /** Done or skipped, either way: mark it (when real) and land Home. */
  finishOnboarding: () => void
}

/**
 * Bumped when a rule in the dialog changes, because this dialog opens itself
 * exactly once ever and there is no other moment the app states the rules.
 *
 * v2: a forbidden word ended the round outright until four clues had been
 * given. Without the bump, everyone who had already played kept "hit a
 * forbidden word and one chance remains" as the last thing the app told them,
 * and then lost a round to a rule no screen ever showed them.
 *
 * v3: the whole meta-game changed — collect by cluing AND guessing, wrap in
 * wrap-up rounds, travel on a packed suitcase. Everyone gets the rules once
 * more.
 *
 * v4: forbidden words and the last chance are gone entirely — the two rules v2
 * existed for. A player still on v3 has been told about a mechanic that is no
 * longer in the game, which is the same failure v2 was bumped to avoid, in the
 * other direction. One bump per release: the overlay's copy is being rewritten
 * properly on top of this, and that rewrite ships with this key, not another.
 *
 * Since O1 the overlay never opens ITSELF — onboarding owns first-run and the
 * ? button is the only door — so the bump-on-rule-change duty has passed to
 * the intro. The key still matters twice over: closing the overlay writes it,
 * and the onboarding gate reads it as proof a device predates the intro.
 */
export const HOWTO_KEY = 'cluecab-howto-v4'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ''])

/** Pure half of the native/dev guard, exported so the TestFlight case is pinned. */
export function devSwitchesAllowedFor(
  native: boolean,
  development: boolean,
  hostname: string,
): boolean {
  // Capacitor serves the installed app from localhost too. Hostname alone
  // therefore cannot distinguish a Playwright preview from a TestFlight app.
  if (native) return false
  if (development) return true
  return LOCAL_HOSTS.has(hostname)
}

/**
 * Whether the ?city / ?learned / ?seed switches are honoured. They rewrite the
 * collection without asking, which is right for a test and wrong for a link
 * someone was sent. Dev server, Playwright drives and a local preview qualify;
 * a deployed origin never does.
 *
 * Defined ABOVE the store on purpose: `initialOnboarding` calls this while
 * `create()` is evaluating, and `LOCAL_HOSTS` as a `const` below that point
 * is a temporal-dead-zone crash — in the PRODUCTION bundle only, because dev
 * returns early on `import.meta.env.DEV`. onboarding-drive caught it live:
 * every `?onboard=1` load went white while every other URL worked.
 */
export function devSwitchesAllowed(): boolean {
  if (typeof window === 'undefined') return false
  return devSwitchesAllowedFor(
    Capacitor.isNativePlatform(),
    import.meta.env.DEV,
    window.location?.hostname ?? '',
  )
}

/**
 * Whether the UI-language question is asked at all — the first-run act and the
 * Settings row.
 *
 * On, since Phase 1g (2026-09-11). It was behind `?uilang=1` on a dev origin
 * while the catalogue filled, because a player who picked German and then read
 * an English everything-else would have been worse off than one who never
 * chose. The catalogue is full — `npm run validate:literals` says so — so the
 * question is asked for real.
 *
 * Kept as a function rather than inlined as `true`: it is the one place that
 * decides, and a future reason to hide the question again belongs here.
 */
export function uiLanguageChoiceAllowed(): boolean {
  return true
}

/** Internal route tooling stays in a browser development session. */
export function playtestTravelAllowedFor(
  native: boolean,
  development: boolean,
  audience: BuildAudience,
): boolean {
  return !native && (development || audience === 'developer')
}

/** TestFlight is a native build, so it never exposes the city jumper. */
export function playtestTravelAllowed(): boolean {
  return playtestTravelAllowedFor(Capacitor.isNativePlatform(), import.meta.env.DEV, buildAudience)
}

/**
 * What the intro should be doing when the page opens, resolved before the
 * first paint rather than in an effect — the one frame of Home a fresh device
 * would otherwise see is exactly the "starts with a ticket" promise broken.
 *
 * Precedence, and why each rung sits where it does:
 *  1. `?onboard=1` (dev/e2e only) forces a TRANSIENT run, beating everything —
 *     it exists so drives can put the train on screen against any profile.
 *  2. `?howto=0` suppresses the flow, writing nothing. It has suppressed the
 *     rules overlay in dozens of drive URLs since v1; onboarding inherits the
 *     switch so those drives keep meaning "no first-run chrome".
 *  3. The gate (src/onboarding/flow.ts): fresh runs, mid-flow resumes,
 *     anything else stays null — App marks veterans done silently.
 */
function initialOnboarding(): OnboardingRun | null {
  // The website demo is always a fresh device (its storage is memory) and
  // always Danish with English chrome: it opens on the practice board itself,
  // skipping the language question, the ticket and the staged Home. No URL
  // switch applies to it.
  if (isWebDemo()) return { step: 'tutorial', persist: true }
  // Not just `typeof window`: the store tests stub a window that is ONLY
  // { localStorage } — zustand needs no more — and this runs at module load,
  // inside create(), where reaching for a location that is not there took
  // two whole suites down rather than one test.
  if (typeof window === 'undefined' || !window.location) return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('onboard') === '1' && devSwitchesAllowed()) {
    return { step: 'ticket', persist: false }
  }
  if (params.get('howto') === '0') return null
  const decision = decideOnboarding()
  if (decision.kind === 'fresh') return { step: 'ticket', persist: true }
  if (decision.kind === 'resume') return { step: decision.step, persist: true, lessons: readOnboardLessons() }
  return null
}

/**
 * Each screen/overlay pushes a history entry so the Android back gesture (and
 * browser back) closes the sheet or returns home instead of quitting the
 * installed PWA. App.tsx handles popstate.
 */
/** Entries this app has pushed and not yet consumed. */
let depth = 0
/** Set while unwinding an entry ourselves, so App's popstate handler stands down. */
let selfPop = false

const pushHistory = () => {
  try {
    history.pushState({ cluecab: true }, '')
    depth++
  } catch {
    // History can be unavailable in exotic embeds — navigation still works.
  }
}

/**
 * Closing a layer from inside the app must consume the entry that opening it
 * pushed. Without this the entry is orphaned and the next system Back press is
 * swallowed unwinding it — the user taps Back and nothing happens.
 */
const popHistory = () => {
  if (depth === 0) return
  depth--
  selfPop = true
  try {
    history.back()
  } catch {
    selfPop = false
  }
}

/** Returning home consumes every entry the screens above it pushed. */
const unwindToFloor = () => {
  if (depth === 0) return
  const steps = depth
  depth = 0
  selfPop = true
  try {
    history.go(-steps)
  } catch {
    selfPop = false
  }
}

/** True when the popstate now firing is one we asked for; clears on read. */
export function consumeSelfPop(): boolean {
  const was = selfPop
  selfPop = false
  if (!was) depth = Math.max(0, depth - 1)
  return was
}

export const useUi = create<UiState>((set, get) => ({
  screen: 'home',
  sheetAudio: createWordAudioScope(),
  sheetContext: INSTRUCTIONAL_CONTEXT,
  sheetWordId: null,
  pendingSeed: null,
  pendingFirstGiver: null,
  leaveGameOpen: false,
  dailyLimitOpen: false,
  dailyLimitRetry: null,
  onboarding: initialOnboarding(),
  pendingRide: null,
  guideEntry: null,
  goTo: (screen) => {
    const from = get().screen
    // Home is the floor. Hopping screen to screen used to push a second entry
    // and returning home popped only one, so the strays piled up and a system
    // Back press went to unwinding them instead of leaving the app.
    if (screen === 'home') unwindToFloor()
    else if (from === 'home') pushHistory()
    set({ screen, sheetWordId: null, pendingRide: null, guideEntry: null, leaveGameOpen: false })
  },
  openGuide: (entry) => {
    if (get().screen === 'home') pushHistory()
    set({ screen: 'guide', sheetWordId: null, pendingRide: null, guideEntry: entry })
  },
  consumeGuideEntry: () => {
    const entry = get().guideEntry
    if (entry) set({ guideEntry: null })
    return entry
  },
  boardTrain: (destination) => {
    if (get().screen === 'home') pushHistory()
    set({ screen: 'map', sheetWordId: null, pendingRide: destination, guideEntry: null })
  },
  openSheet: (wordId, context = INSTRUCTIONAL_CONTEXT) => {
    if (!get().sheetWordId) pushHistory()
    set({ sheetWordId: wordId, sheetContext: context })
  },
  closeSheet: () => {
    if (get().sheetWordId) popHistory()
    set({ sheetWordId: null })
  },
  requestGameExit: (restoreScreenEntry = false) => {
    if (get().leaveGameOpen) return
    // An arrow click still has the game entry underneath it. A system Back
    // already popped that entry, so put it back before adding the dialog's.
    if (restoreScreenEntry) pushHistory()
    pushHistory()
    set({ leaveGameOpen: true })
  },
  closeGameExit: () => {
    if (get().leaveGameOpen) popHistory()
    set({ leaveGameOpen: false })
  },
  openDailyLimit: (retry) => set({ dailyLimitOpen: true, dailyLimitRetry: retry ?? null }),
  closeDailyLimit: () => set({ dailyLimitOpen: false, dailyLimitRetry: null }),
  startOnboarding: () => {
    // Only replay/force paths come through here — a REAL first run arrives via
    // initialOnboarding() so the ticket is there before the first paint. Hence
    // always transient: the done flag on a device replaying the intro stays.
    // It starts from Home, as a first run does: Settings, where the replay
    // button is, would otherwise stay on screen over it (App.tsx shows
    // Settings over the intro when the intro itself sends a player there).
    unwindToFloor()
    set({ onboarding: { step: 'ticket', persist: false }, screen: 'home', sheetWordId: null })
  },
  advanceOnboarding: (step) => {
    const run = get().onboarding
    if (!run) return
    // The marker goes down as the flow moves so a reload resumes mid-flow —
    // including the reload setActiveLanguage() performs on a real language
    // choice at the ticket (src/lang/active.ts).
    if (run.persist) writeOnboardStep(step)
    set({ onboarding: { ...run, step } })
  },
  markOnboardingLesson: (lesson, status) => {
    const run = get().onboarding
    if (!run || run.lessons?.[lesson]) return
    const lessons = { ...run.lessons, [lesson]: status }
    if (run.persist) writeOnboardLessons(lessons)
    set({ onboarding: { ...run, lessons } })
  },
  finishOnboarding: () => {
    const run = get().onboarding
    if (!run) return
    if (run.persist) markOnboardDone()
    // Home is the floor (see goTo): consume any history entries screens above
    // it pushed, so the system Back press after the intro leaves the app
    // rather than unwinding strays.
    unwindToFloor()
    set({ onboarding: null, screen: 'home', sheetWordId: null, guideEntry: null, leaveGameOpen: false })
  },
}))

/*
 * There was a rules overlay behind ? here (openHowTo / closeHowTo). Its last
 * door, the round header's ?, came off on 2026-09-26 and the card went with
 * it. HOWTO_KEY stays: devices that closed it once carry the key, and the
 * onboarding gate reads it as evidence that a device predates the intro
 * (src/onboarding/flow.ts). Nothing writes it any more.
 */

// Store actions and App's system-back setState both close views. Invalidate
// synchronously, before a pending fetch settles; each view gets a separate scope
// so its later layout cleanup cannot cancel the next view's automatic playback.
useUi.subscribe((next, previous) => {
  const a = next.sheetContext, b = previous.sheetContext
  if (next.sheetWordId === previous.sheetWordId && next.screen === previous.screen &&
    a.kind === b.kind && !(a.kind === 'board' && b.kind === 'board' && a.cityIndex !== b.cityIndex)) return
  previous.sheetAudio.cancel()
  useUi.setState({ sheetAudio: createWordAudioScope() })
})
