import { useState } from 'react'
import { AiError, resolveEndpoint, testConnection } from '../../ai/client'
import { onDeviceCaseyAvailable, testGemmaConnection } from '../../ai/gemma/gate'
import {
  belowOfflineCaseyMemory,
  cancelGemmaDownload,
  gemmaStatus,
  gemmaPlatform,
  gigabytes,
  OFFLINE_CASEY_ANDROID_EXAMPLES,
  OFFLINE_CASEY_IPHONES,
  removeGemmaModel,
  startGemmaDownload,
  type GemmaStatus,
} from '../../ai/gemma/native'
import { testOwnKeyConnection } from '../../ai/ownKey/gate'
import { ownModelComplete, ownModelEndpoint, useOwnModel } from '../../ai/ownKey/store'
import { UI, UI_LANGUAGE } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { useSettings } from '../../stores/settingsStore'

type TestState = 'idle' | 'testing' | 'ok' | string

/**
 * Gemma's lines where she runs: on iPhone or Android (the native plugin), or
 * in the desktop self-build's browser (src/ai/gemma/web.ts, `__WEB_GEMMA__`).
 */
const onComputer = __WEB_GEMMA__
const onAndroid = !onComputer && gemmaPlatform() === 'android'
const GEMMA = {
  caseyHelp: onComputer
    ? UI.settings.pcCaseyHelp
    : onAndroid ? UI.settings.ossCaseyHelpAndroid : UI.settings.ossCaseyHelp,
  option: onComputer
    ? UI.settings.pcGemmaOption
    : onAndroid ? UI.settings.gemmaOptionAndroid : UI.settings.gemmaOption,
  optionHelp: onComputer
    ? UI.settings.pcGemmaOptionHelp
    : onAndroid ? UI.settings.gemmaOptionHelpAndroid : UI.settings.gemmaOptionHelp,
  unavailable: onComputer
    ? UI.settings.pcGemmaNeeds
    : onAndroid ? UI.settings.gemmaUnsupportedAndroidNote : UI.settings.gemmaUnavailableNote,
  ready: onComputer
    ? UI.settings.pcGemmaReady
    : onAndroid ? UI.settings.gemmaReadyAndroid : UI.settings.gemmaReady,
  removeConfirm: onComputer
    ? UI.settings.pcGemmaRemoveConfirm
    : onAndroid ? UI.settings.gemmaRemoveConfirmAndroid : UI.settings.gemmaRemoveConfirm,
  downloading: onComputer ? UI.settings.pcGemmaDownloading : UI.settings.gemmaDownloading,
  downloadNote: onComputer ? UI.settings.pcGemmaDownloadNote : UI.settings.gemmaDownloadNote,
  answered: onComputer
    ? UI.settings.pcGemmaAnswered
    : onAndroid ? UI.settings.gemmaAnsweredAndroid : UI.settings.gemmaAnswered,
}

/**
 * "Casey's AI" in a self-built (open-source) 900words (owner, 2026-09-27:
 * self-builders use local Gemma or add their own API key in Settings).
 *
 * Three sources: the player's own OpenAI-compatible service (address, model,
 * key; src/ai/ownKey/), Gemma on this iPhone where the build carries her, or
 * a Casey Worker the builder deployed. SettingsScreen loads this lazily and
 * only in the open-source build, so neither it nor the own-key store ships in
 * a store or web build.
 */
export default function OwnCaseySettings({
  gemma,
  onGemmaChanged,
}: {
  /** Gemma's download status, kept current by SettingsScreen. */
  gemma: GemmaStatus | null
  onGemmaChanged: (status: GemmaStatus) => void
}) {
  const settings = useSettings()
  const ownModel = useOwnModel()
  const [test, setTest] = useState<TestState>('idle')
  const [gemmaError, setGemmaError] = useState<string | null>(null)
  const gemmaInstalled = !!gemma?.installed

  /**
   * What she needs and what she costs, then the download. False when the
   * player says not now.
   */
  const downloadGemma = (): boolean => {
    if (!gemma) return false
    const explained = onComputer
      ? UI.settings.pcGemmaExplain(gigabytes(gemma.expectedBytes))
      : onAndroid
        ? UI.settings.ossGemmaFirstRunAndroid(
            gigabytes(gemma.expectedBytes),
            OFFLINE_CASEY_ANDROID_EXAMPLES.join(', '),
            belowOfflineCaseyMemory(gemma, 'android'),
          )
        : UI.settings.ossGemmaFirstRun(
            gigabytes(gemma.expectedBytes),
            OFFLINE_CASEY_IPHONES.join(', '),
            belowOfflineCaseyMemory(gemma, 'ios'),
          )
    if (!window.confirm(explained)) return false
    setGemmaError(null)
    void startGemmaDownload().catch((error) => {
      setGemmaError(error instanceof Error ? error.message : UI.settings.gemmaDownloadFailed)
    })
    return true
  }

  /** Offline mode for a key or server player: Gemma finishes a round the internet left. */
  const setOffline = (on: boolean) => {
    if (!on) return settings.set({ offlineMode: false })
    if (gemma?.installed || gemma?.downloading || downloadGemma()) settings.set({ offlineMode: true })
  }

  const addressProblem = (() => {
    if (!ownModel.baseUrl.trim()) return null
    try {
      ownModelEndpoint(ownModel.baseUrl)
      return null
    } catch (e) {
      return e instanceof AiError ? e.message : UI.settings.baseUrlUnusable
    }
  })()
  const serverProblem = (() => {
    if (!settings.baseUrl.trim()) return null
    try {
      resolveEndpoint(settings.baseUrl)
      return null
    } catch (e) {
      return e instanceof AiError ? e.message : UI.settings.baseUrlUnusable
    }
  })()

  const sources = [
    { mode: 'own-key' as const, label: UI.settings.ownKeyOption },
    ...(onDeviceCaseyAvailable ? [{ mode: 'gemma4-e4b' as const, label: GEMMA.option }] : []),
    { mode: 'worker' as const, label: UI.settings.serverOption },
  ]
  const canTest =
    settings.caseyMode === 'own-key'
      ? ownModelComplete(ownModel) && !addressProblem
      : settings.caseyMode === 'gemma4-e4b'
        ? gemmaInstalled
        : settings.baseUrl.trim() !== '' && !serverProblem

  const runTest = async () => {
    setTest('testing')
    try {
      if (settings.caseyMode === 'own-key') await testOwnKeyConnection()
      else if (settings.caseyMode === 'gemma4-e4b') await testGemmaConnection()
      else await testConnection({ baseUrl: settings.baseUrl, playerLanguage: UI_LANGUAGE, courseLanguage: ACTIVE.code })
      settings.markClueyVerified(Date.now())
      setTest('ok')
    } catch (e) {
      setTest(e instanceof AiError ? e.message : UI.settings.connectionFailed)
    }
  }

  return (
    <section className="settings-section" data-testid="own-casey-settings">
      <h3>{UI.settings.ossCaseyHeading}</h3>
      <p className="settings-note">{GEMMA.caseyHelp}</p>
      <div className="field" role="radiogroup" aria-label={UI.settings.ossCaseyHeading}>
        {sources.map((source) => (
          <label key={source.mode} className="field field-row">
            <input
              type="radio"
              name="casey-source"
              value={source.mode}
              checked={settings.caseyMode === source.mode}
              onChange={() => {
                settings.set({ caseyMode: source.mode })
                setTest('idle')
              }}
            />
            <span>{source.label}</span>
          </label>
        ))}
      </div>
      {settings.caseyMode === 'own-key' && (
        <div className="field" data-testid="own-key-fields">
          <small>{UI.settings.ownKeyHelp}</small>
          <label className="field">
            <span>{UI.settings.ownKeyAddressLabel}</span>
            <input
              type="url"
              value={ownModel.baseUrl}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => ownModel.set({ baseUrl: e.target.value })}
            />
          </label>
          {addressProblem && <p className="test-fail">{addressProblem}</p>}
          <label className="field">
            <span>{UI.settings.ownKeyModelLabel}</span>
            <input
              type="text"
              value={ownModel.model}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => ownModel.set({ model: e.target.value })}
            />
          </label>
          <label className="field">
            <span>{UI.settings.ownKeyKeyLabel}</span>
            <input
              type="password"
              value={ownModel.apiKey}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => ownModel.set({ apiKey: e.target.value })}
            />
          </label>
        </div>
      )}
      {settings.caseyMode === 'gemma4-e4b' && (
        <div className="field" data-testid="own-gemma-fields">
          <small>{GEMMA.optionHelp}</small>
          {!gemma || !gemma.supported ? (
            <small data-testid="gemma-unavailable">{GEMMA.unavailable}</small>
          ) : gemma.installed ? (
            <>
              <p className="test-ok">✓ {GEMMA.ready(gigabytes(gemma.expectedBytes))}</p>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  if (!window.confirm(GEMMA.removeConfirm)) return
                  settings.set({ offlineMode: false })
                  void removeGemmaModel().then(() => gemmaStatus().then(onGemmaChanged))
                }}
              >
                {UI.settings.gemmaRemoveButton}
              </button>
            </>
          ) : gemma.downloading ? (
            <>
              <progress max={1} value={gemma.progress} aria-label={UI.settings.gemmaProgressAria} />
              <small>{GEMMA.downloading(Math.round(gemma.progress * 100))}</small>
              <button className="btn btn-quiet" onClick={() => void cancelGemmaDownload()}>
                {UI.settings.gemmaCancelDownloadButton}
              </button>
            </>
          ) : (
            <>
              <small>{GEMMA.downloadNote(gigabytes(gemma.expectedBytes))}</small>
              <button className="btn" onClick={() => void downloadGemma()}>
                {UI.settings.gemmaDownloadButton}
              </button>
            </>
          )}
          {(gemmaError ?? gemma?.error) && <p className="test-fail">{gemmaError ?? gemma?.error}</p>}
        </div>
      )}
      {settings.caseyMode !== 'gemma4-e4b' && onDeviceCaseyAvailable && (
        <div className="field" data-testid="oss-offline-mode">
          <label className="casey-brain-switch">
            <span className="casey-brain-switch-copy">
              <strong>
                {UI.settings.ossOfflineLabel}{' '}
                <span className="experimental-tag">{UI.settings.offlineModeExperimentalTag}</span>
              </strong>
              <small>{UI.settings.ossOfflineHelp}</small>
            </span>
            <input
              className="offline-mode-toggle"
              type="checkbox"
              role="switch"
              checked={settings.offlineMode}
              disabled={!gemma?.supported}
              aria-label={UI.settings.ossOfflineLabel}
              onChange={(e) => setOffline(e.target.checked)}
            />
          </label>
          {!gemma?.supported && <small>{GEMMA.unavailable}</small>}
          {settings.offlineMode && gemma?.downloading && (
            <>
              <progress max={1} value={gemma.progress} aria-label={UI.settings.gemmaProgressAria} />
              <small>{GEMMA.downloading(Math.round(gemma.progress * 100))}</small>
            </>
          )}
          {settings.offlineMode && gemma?.installed && (
            <p className="test-ok">✓ {GEMMA.ready(gigabytes(gemma.expectedBytes))}</p>
          )}
          {(gemmaError ?? gemma?.error) && <p className="test-fail">{gemmaError ?? gemma?.error}</p>}
        </div>
      )}
      {settings.caseyMode === 'worker' && (
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
          <small>{UI.settings.serverOptionHelp}</small>
          {serverProblem && <p className="test-fail">{serverProblem}</p>}
        </label>
      )}
      <button
        className="btn"
        disabled={test === 'testing' || !canTest}
        onClick={runTest}
        data-action="test-own-casey"
      >
        {test === 'testing' ? UI.settings.testRunning : UI.settings.testConnectionButton}
      </button>
      {test === 'ok' && (
        <p className="test-ok">
          ✓ {settings.caseyMode === 'own-key'
            ? UI.settings.ownKeyAnswered
            : settings.caseyMode === 'gemma4-e4b'
              ? GEMMA.answered
              : UI.settings.customCaseyAnswered}
        </p>
      )}
      {test !== 'idle' && test !== 'testing' && test !== 'ok' && <p className="test-fail">{test}</p>}
    </section>
  )
}
