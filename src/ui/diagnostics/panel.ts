/**
 * Whether the hidden "Performance log" section is shown in Settings: seven
 * taps on the build stamp (BuildFooter) turn it on and off. Remembered, so it
 * stays found once found.
 */
export const PANEL_KEY = 'cluecab-diag-panel'

let revealed = read()
const subscribers = new Set<() => void>()

function read(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PANEL_KEY) === '1'
  } catch {
    return false
  }
}

export function diagPanelRevealed(): boolean {
  return revealed
}

export function toggleDiagPanel(): void {
  revealed = !revealed
  try {
    if (revealed) localStorage.setItem(PANEL_KEY, '1')
    else localStorage.removeItem(PANEL_KEY)
  } catch {
    /* private mode: this launch only */
  }
  for (const s of [...subscribers]) s()
}

export function onDiagPanel(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

/**
 * Taps on the build stamp: five toggle the keyboard readout (as before),
 * seven toggle this section. Five is only acted on once the taps pause, so
 * reaching seven does not toggle the readout on the way.
 */
export const READOUT_TAPS = 5
export const PANEL_TAPS = 7
export const TAP_PAUSE_MS = 700

export function createStampTaps(onReadout: () => void, onPanel: () => void, schedule: (fn: () => void, ms: number) => () => void) {
  let taps = 0
  let cancel: () => void = () => {}
  return () => {
    cancel()
    taps++
    if (taps >= PANEL_TAPS) {
      taps = 0
      onPanel()
      return
    }
    if (taps < READOUT_TAPS) return
    cancel = schedule(() => {
      if (taps === READOUT_TAPS) onReadout()
      taps = 0
    }, TAP_PAUSE_MS)
  }
}
