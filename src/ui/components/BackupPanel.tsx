import { useRef, useState } from 'react'
import type { RestoreMode } from '../../backup/apply'
import type { Backup, summarize } from '../../backup/backup'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../../i18n'
import { cityAt } from '../../journey/cities'

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'saved'; message: string }
  | { kind: 'restored'; message: string }

export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pending, setPending] = useState<Backup | null>(null)
  const [sum, setSum] = useState<ReturnType<typeof summarize> | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)

  const offer = async (text: string) => {
    const { parseBackup, summarize } = await import('../../backup/backup')
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setPending(null)
      setSum(null)
      setStatus({ kind: 'error', message: parsed.error })
      return
    }
    setPending(parsed.backup)
    setSum(summarize(parsed.backup))
    setStatus({ kind: 'idle' })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      await offer(await file.text())
    } catch {
      setStatus({ kind: 'error', message: UI.system.backupFileUnreadable })
    }
  }

  const apply = async (mode: RestoreMode) => {
    if (!pending || !sum || busy) return
    if (mode === 'replace' && !window.confirm(UI.settings.backupReplaceConfirm)) {
      return
    }
    setBusy(true)
    try {
      const { restore } = await import('../../backup/apply')
      await restore(pending, mode)
      setPending(null)
      setSum(null)
      setPasting(false)
      setPasted('')
      setStatus({
        kind: 'restored',
        message:
          mode === 'merge'
            ? UI.settings.backupMerged(sum.collected + sum.wrapped)
            : UI.settings.backupRestored(sum.collected, sum.wrapped),
      })
    } catch {
      setStatus({ kind: 'error', message: UI.system.saveChangeFailed })
    } finally { setBusy(false) }
  }

  return (
    <>
      <p className="settings-note">{UI.settings.backupIntro}</p>

      <div className="backup-actions">
        <button
          className="btn"
          onClick={async () => {
            try {
              const { downloadBackup } = await import('../../backup/apply')
              const how = await downloadBackup(Date.now())
              setStatus({
                kind: 'saved',
                message: how === 'shared' ? UI.settings.backupShared : UI.settings.backupDownloaded,
              })
            } catch {
              setStatus({ kind: 'error', message: UI.system.backupWriteFailed })
            }
          }}
        >
          {UI.settings.backupSaveButton}
        </button>

        <button className="btn" onClick={() => fileRef.current?.click()}>
          {UI.settings.backupRestoreButton}
        </button>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            // Let the same file be chosen twice in a row.
            e.target.value = ''
          }}
        />
      </div>

      <button
        className="backup-fallback"
        onClick={() => {
          setPasting((v) => !v)
          setStatus({ kind: 'idle' })
        }}
      >
        {pasting ? UI.settings.backupHideText : UI.settings.backupShowText}
      </button>

      {pasting && (
        <div className="backup-paste">
          <button
            className="btn btn-small"
            onClick={async () => {
              try {
                const { prepareBackupText } = await import('../../backup/apply')
                const text = await prepareBackupText(Date.now())
                try {
                  await navigator.clipboard.writeText(text)
                  setStatus({ kind: 'saved', message: UI.settings.backupCopied })
                } catch { setPasted(text); setStatus({ kind: 'error', message: UI.system.clipboardBlocked }) }
              } catch {
                setStatus({ kind: 'error', message: UI.system.saveChangeFailed })
              }
            }}
          >
            {UI.settings.backupCopyButton}
          </button>
          <label className="field">
            <span>{UI.settings.backupPasteLabel}</span>
            <textarea
              rows={4}
              value={pasted}
              spellCheck={false}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'{"app":"cluecabulary",…}'}
            />
          </label>
          <button className="btn btn-small" disabled={!pasted.trim() || busy} onClick={() => void offer(pasted).catch(() => setStatus({ kind: 'error', message: UI.system.saveChangeFailed }))}>
            {UI.settings.backupReadButton}
          </button>
        </div>
      )}

      {sum && (
        <div className="backup-preview">
          <h4>{UI.settings.backupHoldsHeading}</h4>
          <ul>
            <li>
              <strong>{sum.collected + sum.wrapped}</strong>{' '}
              {UI.settings.backupCollectedAfter(sum.words)}
            </li>
            <li>
              <strong>{sum.wrapped}</strong>{' '}
              {UI.settings.backupWrappedAfter(cityAt(sum.cityIndex).name)}
            </li>
            <li>
              {UI.settings.backupGamesLine(
                sum.games,
                new Date(sum.exportedAt).toLocaleDateString(UI_LANGUAGE_INFO[UI_LANGUAGE].tag),
              )}
            </li>
          </ul>
          <div className="backup-choice">
            <button className="btn btn-primary" disabled={busy} onClick={() => void apply('merge')}>
              {UI.settings.backupMergeButton}
            </button>
            <button className="btn" disabled={busy} onClick={() => void apply('replace')}>
              {UI.settings.backupReplaceButton}
            </button>
            <button
              className="backup-fallback"
              onClick={() => {
                setPending(null)
                setSum(null)
                setPasted('')
              }}
            >
              {UI.settings.backupCancelButton}
            </button>
          </div>
          <p className="settings-note">{UI.settings.backupChoiceNote}</p>
        </div>
      )}

      {/* Its own class as well as the shared style: Settings has other
          .test-fail messages, and "the error" has to mean this one. */}
      {status.kind === 'error' && <p role="alert" className="test-fail backup-error">{status.message}</p>}
      {(status.kind === 'saved' || status.kind === 'restored') && (
        <p className="test-ok">✓ {status.message}</p>
      )}
    </>
  )
}
