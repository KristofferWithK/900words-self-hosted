import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_BASE_URL } from '../ai/client'

export type DataSharingChoice = 'private' | 'diagnostics' | 'learning'
/**
 * `own-key`: the open-source build's "your own AI key" (src/ai/ownKey/),
 * offered only there; a store build never shows or honours it.
 */
export type CaseyMode = 'worker' | 'gemma4-e4b' | 'own-key'

interface SettingsState {
  /** A new preference: older saves merge to false; existing choices stay intact. */
  hidePlayerClueReminder: boolean
  baseUrl: string
  /**
   * Which model-backed Casey boundary normal play uses. Worker stays the safe
   * default; `gemma4-e4b` is the developer build's "always offline Casey"
   * switch. Players use `offlineMode` instead.
   */
  caseyMode: CaseyMode
  /**
   * Offline mode: normal Casey plays whenever she can; when the internet is
   * gone, the game offers to play the round with offline Casey (on-device
   * Gemma), if her download is on this iPhone. Off by default.
   */
  offlineMode: boolean
  /** Run the explicitly labelled agentless prototype (local dev/e2e only). */
  useMock: boolean
  /**
   * Whether tapping a word says it out loud. On by default — hearing the word
   * is most of what a vocabulary app is for — but a phone that speaks Danish on
   * a quiet train without being asked is a phone that gets closed, so the off
   * switch has to be real and has to be found on the first look for it.
   *
   * It governs `playWord` at the source, which means it covers the baked clips
   * and the Web Speech fallback together. Nothing ever plays without a tap
   * either way; this is the switch for the taps themselves.
   */
  sound: boolean
  /** Lookup audio plays the example sentence; otherwise it follows `sound`. */
  playExampleOnLookup: boolean
  /** Explicit local preference; Apple remains the authority on permission. */
  dailyReminders: boolean
  /** TestFlight/local-only: permits city jumping and train-gate bypasses. */
  playtestTravel: boolean
  /** Null is an unmade choice and behaves exactly like private play. */
  dataSharing: DataSharingChoice | null
  /** The one-time post-wrap invitation is independent of making a choice. */
  dataSharingPromptShownAt: number | null
  /**
   * Anonymous usage counters (src/analytics/stats.ts): on by default, and
   * a real off switch in Settings. A default that every existing save
   * lacked, so v17's migrate writes it (CLAUDE.md, trap 3).
   */
  usageStats: boolean
  /**
   * When Casey asked about the daily reminder — once, after the third game
   * of a day (owner, 2026-09-07). Null until she has. A new field with no
   * bump: an old save reads null, which is the truth for a player never asked.
   */
  reminderPromptShownAt: number | null
  /**
   * When Casey last actually answered — a passed connection test, or a real
   * clue or guess in play. Null means the selected service has never been
   * shown to work, so a bad URL announces itself before the player commits to
   * a board.
   *
   * The field keeps the name it was persisted under when the companion was
   * Klaus; renaming a stored field buys a migration for a label nobody sees.
   */
  klausVerifiedAt: number | null
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void
  /** Record that Casey answered. Cheap enough to call on every reply. */
  markClueyVerified: (now: number) => void
}

/**
 * v1's default was 'auto' — the whole board translated for the first five
 * cities. Changing the default fixed nothing for anyone already playing:
 * settings persist, so every existing device kept 'auto' and kept opening every
 * round with twelve English glosses on screen. Measured on a v1 save: study
 * dock present, 12 of 12 translations shown.
 *
 * Only 'auto' is rewritten. 'always' was never a default, so a device holding
 * it chose it, and that choice survives.
 *
 * Exported so it can be tested directly: under vitest there is no localStorage,
 * persist quietly becomes a passthrough, and a test reaching through the
 * middleware would be testing nothing.
 */
export function migrateSettings(persisted: unknown, from: number): unknown {
  if (from >= 19) return persisted
  const s = {
    ...((persisted ?? {}) as {
      studyPhase?: unknown
      apiKey?: string
      baseUrl?: string
      caseyMode?: CaseyMode
      offlineMode?: boolean
      model?: string
      sound?: boolean
      playExampleOnLookup?: boolean
      useMock?: boolean
      dailyReminders?: boolean
      playtestTravel?: boolean
      dataSharing?: DataSharingChoice | null
      dataSharingPromptShownAt?: number | null
      usageStats?: boolean
      reminderPromptShownAt?: number | null
    }),
  }
  // v2 -> v3 WAS HERE and is gone with the field it moved: it rewrote a stored
  // `clueLanguage` of 'en' to 'da' so that Casey clued in the language being
  // learned. The setting itself is gone since 2026-09-11 (owner: Casey clues in
  // the language being learned, full stop; the dictionary is the help), and an
  // old save's value is an orphan nothing reads — see the v3 -> v4 note below
  // for why that needs no migration. v8 -> v9, which turned 'da' into
  // 'target', went the same way.
  // v3 -> v4 WAS HERE and is gone with the field it moved: it rewrote a stored
  // `gridSize` of 'beginner' to 'middle' when 3x5 became the board Play deals.
  // N1 deleted board sizes entirely — there is one board — and with them the
  // setting, so there is nothing left to rewrite.
  //
  // NO MIGRATION REPLACES IT, and that is deliberate rather than the trap
  // CLAUDE.md records three times. That trap is about CHANGING a default: this
  // store had no partialize before v11, so every older save carries every field,
  // and a moved default is invisible to a device that already stored the old
  // one. REMOVING a field is the opposite case. persist merges
  // `{...initial, ...persisted}`, so an orphaned `gridSize` in an old save is
  // spread into state, read by nothing, and written back out untouched. There
  // is no version bump here because there is no value to fix.
  // v4 -> v5: the proxy is the default, so Casey answers with no key at all.
  //
  // The fourth outing of the same trap, but the first one where the old value
  // can be told apart from a choice. A device sitting on the Gemini default
  // with an EMPTY key has never had a working Casey and could not have: no key
  // means no answers from Gemini direct, and the build bundles none. Moving
  // exactly that group costs them nothing and hands them a partner.
  //
  // Anyone who typed a key, or typed a Base URL of their own, made a decision —
  // possibly on a paid account — and is left alone. The model comes along only
  // where the URL does, because an Ollama id on a Gemini endpoint is a 404 that
  // reads as a broken server.
  const GEMINI_DIRECT = 'https://generativelanguage.googleapis.com/v1beta/openai'
  if (
    from < 5 &&
    !(s.apiKey ?? '').trim() &&
    [GEMINI_DIRECT, '', undefined].includes((s.baseUrl ?? '').trim().replace(/\/+$/, '') || '')
  ) {
    s.baseUrl = DEFAULT_BASE_URL
    s.model = 'cluey'
  }
  // v5 -> v6: the model name became an alias the proxy resolves.
  //
  // Narrow on purpose. Only the exact pair v5 itself shipped is moved — the
  // proxy as the Base URL AND the literal model it set — because that
  // combination was written by the migration above rather than chosen by
  // anyone. A model picked from the Settings list is a decision and stays,
  // even on the proxy: "cluey" is a name only this proxy knows, so overwriting
  // a deliberate choice with it would be taking the pick away.
  if (from < 6 && (s.baseUrl ?? '').trim().replace(/\/+$/, '') === DEFAULT_BASE_URL && s.model === 'gpt-oss:120b') {
    s.model = 'cluey'
  }
  // v6 -> v7: the API key is retired, and a stale one has to go with it.
  //
  // This is the migration that fixes a device rather than tidying it. A key
  // typed in an older build overrides the one the proxy holds — deliberately,
  // so another service could be used without a code change — and the v5
  // migration therefore left typed keys alone, treating them as a decision.
  // For a key that had since been revoked, "left alone" meant it kept being
  // sent, kept being forwarded ahead of the proxy's own, and kept coming back
  // rejected. Mid-round, pointing at a Settings field for a key the app does
  // not need.
  //
  // So it is cleared for everyone. There is no longer any field to type one
  // into, and the only service left brings its own.
  if (from < 7) s.apiKey = ''
  // v7 -> v8: a new field, and the fifth outing of the trap — with the sign
  // flipped, which is the only reason it is a one-liner.
  //
  // No save written before v8 carries `sound`, and the store then had no
  // partialize, so an old blob restores `sound: undefined` over the default and
  // every existing device would come up silent. The new field is written in
  // explicitly rather than left to the default it happens to agree with.
  if (from < 8) s.sound = true
  // v8 -> v9 WAS HERE: it rewrote a stored `clueLanguage` of 'da' to 'target'.
  // Gone with the field; see the v2 -> v3 note above.
  // v9 -> v10: agentless play is no longer a player mode. `useMock` remains
  // as a local dev/e2e seam, but a phone that ever selected the old Settings
  // checkbox must return to model-backed Casey on upgrade. Local `?mock=1`
  // runs after hydration and may still opt into the conspicuously labelled
  // prototype for tests.
  if (from < 10) s.useMock = false
  // v10 -> v11: SEC3 makes the browser a decision client, not an AI client.
  // Model selection and credentials are now Worker configuration. Delete both
  // fields from every persisted save, including v7-v10 saves whose stale key
  // the earlier one-time cleanup deliberately stopped touching.
  if (from < 11) {
    delete s.apiKey
    delete s.model
    s.useMock = false
  }
  // v11 -> v12: this is a newly opt-in capability. An old save must never
  // infer consent from a streak, a previous setting, or Apple's permission.
  // The explicit Settings action is the only thing that can turn it on.
  if (from < 12) s.dailyReminders = false
  // v12 -> v13: city jumping is an explicit TestFlight/local playtest choice.
  // A real player's old save must never wake up with progression bypassed.
  if (from < 13) s.playtestTravel = false
  // v13 -> v14: optional data use is opt-in. Even if an old or hand-edited
  // blob happens to contain similarly named fields, it is not consent and
  // cannot suppress the first honest invitation.
  if (from < 14) {
    s.dataSharing = null
    s.dataSharingPromptShownAt = null
  }
  // v14 -> v15: on-device Gemma is a large, explicitly downloaded playtest
  // option. Existing phones stay on the proven Worker unless their owner
  // deliberately selects and installs it.
  if (from < 15) s.caseyMode = 'worker'
  // v15 -> v16: Capacitor's installed origin is localhost, so TestFlight
  // accidentally exposed the local mock switch. Clear any value saved by
  // that build. The runtime has a native guard too, so stale state can never
  // win the companion selection while hydration or migration is in flight.
  if (from < 16) s.useMock = false
  // v16 -> v17: anonymous usage counters, on by default. Every save before
  // this lacks the field, and `persist` would spread the initial `true` in —
  // but this is exactly the trap CLAUDE.md's point 3 is about, so the
  // default is written here where the version says so, not left to the merge.
  if (from < 17) s.usageStats = true
  // v17 -> v18: a lookup can play the whole example sentence. It is on by
  // default; older saves must receive that default explicitly. The retired
  // study preference is removed rather than carried as a state nobody reads.
  if (from < 18) s.playExampleOnLookup = true
  // v18 -> v19: offline mode replaces choosing Gemma as Casey's brain. A
  // phone that had chosen Gemma keeps her as its offline fallback and goes
  // back to normal Casey whenever the internet is there. Every other save
  // gets the default explicitly (CLAUDE.md, trap 3).
  if (from < 19) {
    s.offlineMode = s.caseyMode === 'gemma4-e4b'
    s.caseyMode = 'worker'
  }
  delete s.studyPhase
  return s
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      baseUrl: DEFAULT_BASE_URL,
      // A self-built 900words has no Worker: out of the box it plays with
      // Gemma on an iPhone and asks for an AI key on the web (owner,
      // 2026-09-27). Only a fresh self-build install reads this default.
      caseyMode:
        __BUILD_AUDIENCE__ === 'open-source' ? (__ON_DEVICE_CASEY__ ? 'gemma4-e4b' : 'own-key') : 'worker',
      offlineMode: false,
      useMock: false,
      // On. Every sound in the app follows a tap, so the only thing this
      // protects against is a tap you meant as a lookup being louder than you
      // expected — and a learner who cannot hear the word is missing half of it.
      sound: true,
      playExampleOnLookup: true,
      dailyReminders: false,
      playtestTravel: false,
      dataSharing: null,
      dataSharingPromptShownAt: null,
      usageStats: true,
      reminderPromptShownAt: null,
      hidePlayerClueReminder: false,
      klausVerifiedAt: null,
      set: (patch) =>
        set((s) => {
          // A different Casey service has not yet proved it can answer.
          const touched =
            (patch.baseUrl !== undefined && patch.baseUrl !== s.baseUrl) ||
            (patch.caseyMode !== undefined && patch.caseyMode !== s.caseyMode)
          // Choosing either real Casey boundary also exits a local mock run.
          const next = patch.caseyMode !== undefined ? { ...patch, useMock: false } : patch
          return touched ? { ...next, klausVerifiedAt: null } : next
        }),
      markClueyVerified: (now) => set({ klausVerifiedAt: now }),
    }),
    {
      name: 'cluecab-settings-v1',
      version: 19,
      migrate: migrateSettings,
      // A narrow persisted shape is the second half of the v11 cleanup. Old
      // unknown fields can be merged into Zustand state during hydration; they
      // are never written back, so an old API key disappears on the next save.
      partialize: ({
        baseUrl,
        caseyMode,
        offlineMode,
        sound,
        playExampleOnLookup,
        dailyReminders,
        playtestTravel,
        dataSharing,
        dataSharingPromptShownAt,
        usageStats,
        reminderPromptShownAt,
        hidePlayerClueReminder,
        klausVerifiedAt,
      }) => ({
        baseUrl,
        caseyMode,
        offlineMode,
        sound,
        playExampleOnLookup,
        dailyReminders,
        playtestTravel,
        dataSharing,
        dataSharingPromptShownAt,
        usageStats,
        reminderPromptShownAt,
        hidePlayerClueReminder,
        klausVerifiedAt,
      }),
    },
  ),
)
