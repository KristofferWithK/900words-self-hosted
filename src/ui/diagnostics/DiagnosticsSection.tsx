import { useEffect, useReducer, useState } from 'react'
import { Tag } from '../components/Tag'
import { DIAG_LABEL as L, SWITCH_LABEL } from './labels'
import { diagPanelRevealed, onDiagPanel } from './panel'
import { buildDiagLog, clearDiagLog, diagRecording, onDiagLog, setRecording, summarize, type CostStats, type DiagSummary } from './recorder'
import { DIAG_SWITCHES, diagSwitch, setDiagSwitch } from './switches'

/**
 * The hidden "Performance log" section of Settings (seven taps on the build
 * stamp). Developer-only: see recorder.ts for what it records and labels.ts
 * for why its labels are English.
 */
export function DiagnosticsSection() {
  const [shown, setShown] = useState(diagPanelRevealed)
  useEffect(() => onDiagPanel(() => setShown(diagPanelRevealed())), [])
  if (!shown) return null
  return <DiagnosticsPanel />
}

const fmt = (n: number | null) => (n === null ? L.none : String(Math.round(n)))

function part(label: string, s: CostStats): string {
  return `${label} ${s.n}: ${L.median} ${fmt(s.median)} / ${L.worst} ${fmt(s.worst)} ${L.ms}`
}

/** "120 hits · first 50: median 12 / worst 40 ms · last 50: median 30 / worst 200 ms". */
export function summaryLine(s: DiagSummary): string {
  return `${s.hits} ${L.hits} · ${part(L.first, s.first50)} · ${part(L.last, s.last50)}`
}

export function logFilename(at = new Date()): string {
  return `900words-perf-${at.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
}

function DiagnosticsPanel() {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    // Settings is not where hits happen; a throttled refresh is plenty.
    let queued = false
    return onDiagLog(() => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => {
        queued = false
        refresh()
      })
    })
  }, [])
  const recording = diagRecording()

  const send = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const text = JSON.stringify(buildDiagLog(__BUILD_STAMP__, __TF_BUILD__))
      const { shareOrDownload } = await import('../../backup/shareFile')
      const how = await shareOrDownload(text, logFilename(), L.logTitle)
      setStatus(how === 'shared' ? L.shared : L.downloaded)
    } catch {
      setStatus(L.failed)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <section className="settings-section diag-section" data-testid="diag-section">
      <h3>{L.heading}</h3>
      <p className="settings-note diag-summary">{summaryLine(summarize())}</p>
      <label className="casey-brain-switch diag-rec">
        <span className="casey-brain-switch-copy">
          <strong>{L.recording}</strong>
        </span>
        <input
          className="diag-rec-toggle"
          type="checkbox"
          role="switch"
          checked={recording}
          aria-label={L.recording}
          onChange={(e) => {
            setRecording(e.target.checked)
            refresh()
          }}
        />
      </label>
      <p className="settings-note">
        {L.switches} {L.nextRun}
      </p>
      {DIAG_SWITCHES.map((name) => (
        <label key={name} className="casey-brain-switch diag-switch" data-switch={name}>
          <span className="casey-brain-switch-copy">
            <strong>{SWITCH_LABEL[name]}</strong>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={diagSwitch(name)}
            aria-label={SWITCH_LABEL[name]}
            onChange={(e) => {
              setDiagSwitch(name, e.target.checked)
              refresh()
            }}
          />
        </label>
      ))}
      <Tag size="wide" className="diag-send" disabled={busy} label={L.send} onClick={() => void send()} />
      <Tag
        size="wide"
        className="diag-clear"
        label={L.clear}
        onClick={() => {
          clearDiagLog()
          setStatus(L.cleared)
        }}
      />
      {status && <p className="settings-note diag-status">{status}</p>}
    </section>
  )
}
