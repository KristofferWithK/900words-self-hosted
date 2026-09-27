import { lazy, Suspense, useEffect, useState } from 'react'
import { AiError, resolveEndpoint, testConnection } from '../../ai/client'
import { audienceEnablesDeveloperTools, buildAudience } from '../../build/audience'
import { onDeviceCaseyAvailable, testGemmaConnection } from '../../ai/gemma/gate'
import {
  cancelGemmaDownload,
  belowOfflineCaseyMemory,
  OFFLINE_CASEY_IPHONES,
  gemmaStatus,
  onGemmaDownloadProgress,
  removeGemmaModel,
  startGemmaDownload,
  type GemmaStatus,
} from '../../ai/gemma/native'
import {
  UI,
  UI_LANGUAGE,
  setUiLanguage,
  uiLanguageChoices,
  type UiLanguage,
} from '../../i18n'
import { ACTIVE, setActiveLanguage } from '../../lang/active'
import { availableLanguages, hasLanguageChoice } from '../../lang/index'
import type { LanguageCode } from '../../lang/types'
import { PROVIDERS, providerFor } from '../../ai/providers'
import { useSettings } from '../../stores/settingsStore'
import { devSwitchesAllowed, uiLanguageChoiceAllowed, useUi } from '../../stores/uiStore'
import { BackupPanel } from '../components/BackupPanel'
import { BuildFooter } from '../components/BuildFooter'
import { ClueLedgerPanel } from '../components/ClueLedgerPanel'
import {
  REMINDER_HOUR,
  dailyReminderCopy,
  disableDailyReminders,
  readReminderPermission,
  remindersAvailable,
  openReminderSettings,
  requestDailyReminders,
  type ReminderPermission,
} from '../../reminders/reminders'
import { useStreak } from '../../streak/streak'
import { DataSharingSettings } from '../components/DataSharingChoice'

const gigabytes = (bytes: number): string => `${(bytes / 1_000_000_000).toFixed(1)} GB`

/**
 * The hour Casey actually knocks, as one string for the copy to quote.
 *
 * Written from REMINDER_HOUR rather than into the sentence, because the
 * sentence said "6:00 PM" for weeks while the constant said 15 and
 * `ReminderPrompt` — on the same device — said 15:00. Reading the constant is
 * what makes the two screens agree and keeps them agreeing.
 */
const reminderTime = `${REMINDER_HOUR}:00`

/**
 * The language the app SPEAKS — above the picker for the language being
 * LEARNED, because it governs that picker's own labels.
 *
 * A select rather than cards: unlike the first-run act this sits in a list of
 * settings, and it shows the endonyms only, so a player who landed in a
 * language they cannot read can still find their own in the list.
 */
function UiLanguagePicker() {
  if (!uiLanguageChoiceAllowed()) return null
  return (
    <label className="field">
      <span>{UI.settings.uiLanguageLabel}</span>
      <select
        value={UI_LANGUAGE}
        onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
      >
        {uiLanguageChoices().map((info) => (
          <option key={info.code} value={info.code} lang={info.tag}>
            {info.endonym}
          </option>
        ))}
      </select>
      <small>{UI.settings.uiLanguageHelp}</small>
    </label>
  )
}

/**
 * Which language you are learning.
 *
 * Renders nothing while only one ships — see `hasLanguageChoice` for why that
 * is the choice rather than a one-entry list. Changing it reloads the app,
 * which is honest rather than lazy: the whole word list, every index, the route
 * and the map all change at once, and `src/lang/active.ts` explains why the
 * value cannot live in a store.
 *
 * Nothing is lost by switching. The collection is keyed by word id and holds
 * both languages side by side; the journey position on the language being left
 * is parked by journeyStore and comes back untouched.
 */
function LanguagePicker() {
  const languages = availableLanguages()
  if (!hasLanguageChoice()) return null
  return (
    <label className="field">
      <span>{UI.settings.learnerLanguageLabel}</span>
      <select
        value={ACTIVE.code}
        onChange={(e) => setActiveLanguage(e.target.value as LanguageCode)}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name} ({l.endonym})
            {l.readiness === 'preview' ? ` (${UI.settings.learnerLanguagePreviewTag})` : ''}
          </option>
        ))}
      </select>
      <small>
        {ACTIVE.readiness === 'preview'
          ? UI.settings.learnerLanguagePreviewHelp
          : UI.settings.learnerLanguageHelp}
      </small>
    </label>
  )
}

/**
 * "Casey's AI" for a self-built 900words: loaded only in the open-source build
 * (the constant folds to null everywhere else, and the chunk with it), so the
 * own-key store and its component never ship in a store or web build.
 */
// The build literal itself, not an imported constant: the bundler folds only
// this, and a folded condition is what drops the chunk.
const OwnCaseySettings = __BUILD_AUDIENCE__ === 'open-source' ? lazy(() => import('../components/OwnCaseySettings')) : null

export function SettingsScreen() {
  const goTo = useUi((s) => s.goTo)
  const settings = useSettings()
  const [resetError, setResetError] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | string>('idle')
  const [reminderPermission, setReminderPermission] = useState<ReminderPermission>(
    remindersAvailable() ? 'not-determined' : 'unavailable',
  )
  const [reminderBusy, setReminderBusy] = useState(false)
  const [gemma, setGemma] = useState<GemmaStatus | null>(null)
  const provider = providerFor(settings.baseUrl)
  const normalCasey =
    settings.caseyMode === 'worker' && provider?.id === 'cluecabulary' && !settings.useMock
  /**
   * Service diagnostics — a custom Casey address and the clue ledger: a local
   * preview, or Kristoffer's developer TestFlight build, the one installed
   * build that may show them, since its audience is fixed when the bundle is
   * made. Store, feedback, open-source and web builds never do.
   */
  const developerTools = devSwitchesAllowed() || audienceEnablesDeveloperTools(buildAudience)
  /**
   * The Casey switch and the Gemma download: wherever the diagnostics show,
   * and in every build that carries on-device Casey — the normal 1.0 line
   * included (owner, 2026-09-27).
   */
  const caseyChoice = developerTools || onDeviceCaseyAvailable
  /** A Casey server to send counters and shared data to; a self-built 900words may have none. */
  const hasCaseyServer = settings.baseUrl.trim() !== ''

  useEffect(() => {
    if (!remindersAvailable()) return
    void readReminderPermission().then(setReminderPermission)
  }, [])

  useEffect(() => {
    if (!caseyChoice) return
    let disposed = false
    let listener: Awaited<ReturnType<typeof onGemmaDownloadProgress>> = null
    void gemmaStatus().then((status) => {
      if (!disposed) setGemma(status)
    })
    void onGemmaDownloadProgress((status) => {
      if (!disposed) setGemma(status)
    }).then((handle) => {
      if (disposed) void handle?.remove()
      else listener = handle
    })
    return () => {
      disposed = true
      void listener?.remove()
    }
  }, [])

  // Say it while they are typing, before a game view is sent anywhere. A
  // relative Base URL would post it to whatever serves the app.
  const baseUrlProblem = (() => {
    if (!settings.baseUrl.trim()) return null
    try {
      resolveEndpoint(settings.baseUrl)
      return null
    } catch (e) {
      return e instanceof AiError ? e.message : UI.settings.baseUrlUnusable
    }
  })()

  // A Casey service owns its model, prompts, evaluator and credentials. The
  // app selects only which compatible service boundary to call: ON is the
  // normal Worker, and it is also how you get back to it after typing a Base
  // URL of your own; OFF is the on-device Gemma trial.
  const setNormalCasey = (enabled: boolean) => {
    if (enabled) {
      settings.set({ caseyMode: 'worker', baseUrl: PROVIDERS[0]!.baseUrl, useMock: false })
    } else {
      settings.set({ caseyMode: 'gemma4-e4b', useMock: false })
    }
    setTest('idle')
  }

  /**
   * Offline Casey's first-time explanation (download size, slower play, the
   * iPhones she needs, and a warning when this one has less memory than
   * those), then her download. False when the player says not now.
   */
  const downloadOfflineCasey = (): boolean => {
    if (!gemma) return false
    const explained = UI.settings.offlineModeExplain(
      gigabytes(gemma.expectedBytes),
      OFFLINE_CASEY_IPHONES.join(', '),
      belowOfflineCaseyMemory(gemma),
    )
    if (!window.confirm(explained)) return false
    void startGemmaDownload().catch((error) => {
      setGemma({ ...gemma, error: error instanceof Error ? error.message : UI.settings.gemmaDownloadFailed })
    })
    return true
  }

  /** Offline mode on: explain and download first, unless she is already here. */
  const setOfflineMode = (on: boolean) => {
    if (!on) {
      settings.set({ offlineMode: false })
      return
    }
    if (gemma?.installed || gemma?.downloading || downloadOfflineCasey()) settings.set({ offlineMode: true })
  }

  const runTest = async () => {
    setTest('testing')
    try {
      if (settings.caseyMode === 'gemma4-e4b') await testGemmaConnection()
      else await testConnection({
        baseUrl: settings.baseUrl,
        playerLanguage: UI_LANGUAGE,
        courseLanguage: ACTIVE.code,
      })
      settings.markClueyVerified(Date.now())
      setTest('ok')
    } catch (e) {
      setTest(e instanceof AiError ? e.message : UI.settings.connectionFailed)
    }
  }

  const enableReminders = async () => {
    setReminderBusy(true)
    const permission = await requestDailyReminders(
      dailyReminderCopy(useStreak.getState().completedDays, Date.now()),
    )
    setReminderPermission(permission)
    if (permission === 'authorized') settings.set({ dailyReminders: true })
    setReminderBusy(false)
  }

  const disableReminders = async () => {
    setReminderBusy(true)
    if (await disableDailyReminders()) settings.set({ dailyReminders: false })
    setReminderBusy(false)
  }

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.settings.backAria} onClick={() => goTo('home')}>
          ←
        </button>
        <h1>{UI.settings.title}</h1>
      </header>

      {/* Settings is the one screen with more to say than a phone is tall.
          The DOCUMENT still must not scroll — this container does, under a
          header that stays put by construction. */}
      <div className="screen-scroll">
      {OwnCaseySettings && (
        <Suspense fallback={null}>
          <OwnCaseySettings gemma={gemma} onGemmaChanged={setGemma} />
        </Suspense>
      )}

      {/* A self-build chooses Gemma under Casey's AI above; this switch is a
          fallback from 900words' own server, which a self-build does not use. */}
      {caseyChoice && __BUILD_AUDIENCE__ !== 'open-source' && (
      <section className="settings-section" data-testid="offline-mode-settings">
        {/* Experimental at launch (owner, 2026-09-27): it ships, and it is
            still being optimised; the first-time explanation says so too. */}
        <h3>
          {UI.settings.offlineModeHeading}{' '}
          <span className="experimental-tag">{UI.settings.offlineModeExperimentalTag}</span>
        </h3>
        <label className="casey-brain-switch">
          <span className="casey-brain-switch-copy">
            <strong>{UI.settings.offlineModeLabel}</strong>
            <small>{UI.settings.offlineModeHelp}</small>
          </span>
          <input
            className="offline-mode-toggle"
            type="checkbox"
            role="switch"
            checked={settings.offlineMode}
            disabled={!gemma?.supported}
            aria-label={UI.settings.offlineModeAria}
            onChange={(e) => setOfflineMode(e.target.checked)}
          />
        </label>
        {(settings.offlineMode || !gemma?.supported || gemma.installed || gemma.downloading) && (
          <div className="field" data-testid="gemma-model-settings">
            {!gemma || !gemma.supported ? (
              <small>{UI.settings.gemmaUnavailableNote}</small>
            ) : gemma.installed ? (
              <>
                <p className="test-ok">✓ {UI.settings.gemmaReady(gigabytes(gemma.expectedBytes))}</p>
                <button
                  className="btn btn-quiet"
                  onClick={() => {
                    if (!window.confirm(UI.settings.gemmaRemoveConfirm)) return
                    settings.set({ offlineMode: false, caseyMode: 'worker' })
                    void removeGemmaModel().then(() => gemmaStatus().then(setGemma))
                  }}
                >
                  {UI.settings.gemmaRemoveButton}
                </button>
              </>
            ) : gemma.downloading ? (
              <>
                <progress max={1} value={gemma.progress} aria-label={UI.settings.gemmaProgressAria} />
                <small>{UI.settings.gemmaDownloading(Math.round(gemma.progress * 100))}</small>
                <button className="btn btn-quiet" onClick={() => void cancelGemmaDownload()}>
                  {UI.settings.gemmaCancelDownloadButton}
                </button>
              </>
            ) : (
              <>
                <small>{UI.settings.gemmaDownloadNote(gigabytes(gemma.expectedBytes))}</small>
                <button
                  className="btn"
                  onClick={() => {
                    if (downloadOfflineCasey()) settings.set({ offlineMode: true })
                  }}
                >
                  {UI.settings.gemmaDownloadButton}
                </button>
              </>
            )}
            {gemma?.error && <p className="test-fail">{gemma.error}</p>}
          </div>
        )}
      </section>
      )}

      {/* A self-build's Casey is chosen under Casey's AI above, even on localhost. */}
      {developerTools && __BUILD_AUDIENCE__ !== 'open-source' && (
      <section className="settings-section">
        <h3>{UI.settings.caseyBrainHeading}</h3>
        <label className="casey-brain-switch">
          <span className="casey-brain-switch-copy">
            <strong>{UI.settings.normalOllamaCaseyLabel}</strong>
            <small>{UI.settings.normalOllamaCaseyDetail}</small>
          </span>
          <input
            className="casey-brain-toggle"
            type="checkbox"
            role="switch"
            checked={normalCasey}
            aria-label={UI.settings.normalOllamaCaseyAria}
            onChange={(e) => setNormalCasey(e.target.checked)}
          />
        </label>
        <p className={`casey-brain-status${normalCasey ? ' is-normal' : ''}`} role="status">
          <strong>
            {normalCasey
              ? UI.settings.normalCaseyOn
              : settings.caseyMode === 'gemma4-e4b'
                ? UI.settings.normalCaseyOff
                : settings.useMock
                  ? UI.settings.prototypeOn
                  : UI.settings.customCaseyOn}
          </strong>
          <span>
            {normalCasey
              ? UI.settings.normalCaseyDetail
              : settings.caseyMode === 'gemma4-e4b'
                ? UI.settings.gemmaModeDetail
                : settings.useMock
                  ? UI.settings.prototypeDetail
                  : UI.settings.customCaseyDetail}
          </span>
        </p>

        {settings.caseyMode === 'worker' && (
          /* API key and model fields stay absent. A custom Base URL is a
             Casey decision service, not a raw model endpoint. */
          <label className="field">
            <span>{UI.settings.baseUrlLabel}</span>
            <input
              type="url"
              value={settings.baseUrl}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => settings.set({ baseUrl: e.target.value })}
            />
            <small>
              {UI.settings.baseUrlHelpBefore}
              <code>/v1</code>
              {UI.settings.baseUrlHelpAfter}
            </small>
            {baseUrlProblem && <p className="test-fail">{baseUrlProblem}</p>}
          </label>
        )}
        <button
          className="btn"
          disabled={
            test === 'testing' ||
            (settings.caseyMode === 'worker' ? !!baseUrlProblem : !gemma?.installed)
          }
          onClick={runTest}
          data-action="test-casey"
        >
          {test === 'testing'
            ? UI.settings.testRunning
            : settings.caseyMode === 'gemma4-e4b'
              ? UI.settings.testGemmaButton
              : UI.settings.testConnectionButton}
        </button>
        {test === 'ok' && (
          <p className="test-ok">
            ✓ {settings.caseyMode === 'gemma4-e4b'
              ? UI.settings.gemmaAnswered
              : normalCasey
                ? UI.settings.normalCaseyAnswered
                : UI.settings.customCaseyAnswered}
          </p>
        )}
        {test !== 'idle' && test !== 'testing' && test !== 'ok' && (
          <p className="test-fail">{test}</p>
        )}
      </section>
      )}

      <section className="settings-section">
        <h3>{UI.settings.gameHeading}</h3>
        <UiLanguagePicker />

        <LanguagePicker />

        <div className="field">
          <label className="field field-row">
            <input
              type="checkbox"
              checked={settings.playExampleOnLookup}
              onChange={(e) => settings.set({ playExampleOnLookup: e.target.checked })}
            />
            <span>{UI.settings.lookupExampleLabel}</span>
          </label>
          <small>{UI.settings.lookupExampleHelp}</small>
        </div>

        <div className="field">
          <label className="field field-row">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => settings.set({ sound: e.target.checked })}
            />
            <span>{UI.settings.soundLabel}</span>
          </label>
          <small>{UI.settings.soundHelp}</small>
        </div>

        <div className="field">
          {/* A transient re-run of the first-run flow (O1): the same train,
              the same ticket, and the done flag is not touched — so this can
              be tapped freely without re-arming the intro for every load. */}
          <button className="btn replay-intro" onClick={() => useUi.getState().startOnboarding()}>
            {UI.settings.replayIntroButton}
          </button>
          <small>{UI.settings.replayIntroHelp}</small>
        </div>
      </section>

      <section className="settings-section reminders-section">
        <h3>{UI.settings.reminderHeading}</h3>
        {reminderPermission === 'unavailable' ? (
          <p className="settings-note">{UI.settings.reminderWebNote}</p>
        ) : reminderPermission === 'denied' ? (
          <>
            <p className="settings-note">{UI.settings.reminderDeniedNote}</p>
            <button className="btn" disabled={reminderBusy} onClick={() => void openReminderSettings()}>
              {UI.settings.reminderOpenSettingsButton}
            </button>
          </>
        ) : settings.dailyReminders && reminderPermission === 'authorized' ? (
          <>
            <p className="settings-note">{UI.settings.reminderOnNote(reminderTime)}</p>
            <button className="btn" disabled={reminderBusy} onClick={disableReminders}>
              {reminderBusy ? UI.settings.reminderTurningOff : UI.settings.reminderTurnOffButton}
            </button>
          </>
        ) : (
          <>
            <p className="settings-note">{UI.settings.reminderOffNote(reminderTime)}</p>
            <button className="btn daily-reminder-opt-in" disabled={reminderBusy} onClick={enableReminders}>
              {reminderBusy ? UI.settings.reminderAsking : UI.settings.reminderTurnOnButton}
            </button>
          </>
        )}
      </section>

      <section className="settings-section">
        <h3>{UI.settings.collectionHeading}</h3>
        <BackupPanel />
      </section>

      {/* The clue ledger is the owner's diagnostic for a proxy deploy
          (ClueLedgerPanel), not a screen a player has a use for. */}
      {developerTools && (
        <section className="settings-section">
          <h3>{UI.settings.clueLedgerHeading}</h3>
          <ClueLedgerPanel />
        </section>
      )}

      <section className="settings-section">
        <h3>{UI.settings.dataHeading}</h3>
        {/* `casey-brain-switch-copy` is what stacks the label above its help
            line: the switch row is a grid, and without it the <strong> and the
            <small> run together as one paragraph ("Anonymous usage
            statisticsCounts only — …"). The class was on the brain switch and
            never on this one. */}
        {/* A self-built 900words with no Casey server sends neither. */}
        {hasCaseyServer && (
          <>
            <label className="casey-brain-switch usage-stats-switch">
              <span className="casey-brain-switch-copy">
                <strong>{UI.settings.usageStatsLabel}</strong>
                <small>{UI.settings.usageStatsHelp}</small>
              </span>
              <input
                className="usage-stats-toggle"
                type="checkbox"
                role="switch"
                checked={settings.usageStats}
                aria-label={UI.settings.usageStatsAria}
                onChange={(e) => settings.set({ usageStats: e.target.checked })}
              />
            </label>
            <DataSharingSettings />
          </>
        )}
        <button
          className="btn btn-danger"
          disabled={resetBusy}
          onClick={async () => {
            // The journey must reset with the words: gates passed against zero
            // collected words would be a broken state.
            if (window.confirm(UI.settings.resetConfirm(ACTIVE.name))) {
              setResetBusy(true)
              setResetError(false)
              try { const { resetCollection } = await import('../../backup/apply'); await resetCollection() } catch { setResetError(true) }
              finally { setResetBusy(false) }
            }
          }}
        >
          {UI.settings.resetButton}
        </button>
        {resetError && <p role="alert" className="test-fail">{UI.system.saveChangeFailed}</p>}
        <BuildFooter />
      </section>
      </div>
    </div>
  )
}
