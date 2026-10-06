import { diagMark, installReactCommitCounter, onDiagEvent, recordingWanted, snapshot, startRecording, summarize, whileRecording } from './recorder'

/**
 * Imported by main.tsx before React, so that a recording left on at the last
 * launch starts with the app (and can count React's commits from the first).
 * For everyone else this is one localStorage read and nothing else.
 */

// Screen changes and Home visits, while recording. The store is loaded lazily:
// this module runs before the stores (main.tsx's web-demo storage swap first).
whileRecording(() => {
  let stop = () => {}
  let gone = false
  void import('../../stores/uiStore').then(({ useUi }) => {
    if (gone) return
    let prev = useUi.getState().screen
    stop = useUi.subscribe((s) => {
      if (s.screen === prev) return
      prev = s.screen
      diagMark(`screen ${s.screen}`)
      if (s.screen === 'home') snapshot('home')
    })
  })
  return () => {
    gone = true
    stop()
  }
})

/**
 * The soak's way out (ios-sim.yml `soak`): with `cluecab-diag-stream` seeded,
 * every event is also printed as one `PERFLOG {json}` console line, and a
 * `PERFLOG-SUMMARY` line every minute. The iOS shell's Debug build forwards
 * the console to `simctl launch --console-pty`, which the workflow keeps in a
 * file: no plugin, no file system, and nothing written to the storage that is
 * itself being measured.
 */
function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
if (typeof window !== 'undefined' && flag('cluecab-diag-stream')) {
  whileRecording(() => {
    const stop = onDiagEvent((ev) => console.log(`PERFLOG ${JSON.stringify(ev)}`))
    const id = window.setInterval(() => console.log(`PERFLOG-SUMMARY ${JSON.stringify({ up: Math.round(performance.now()), ...summarize() })}`), 60_000)
    return () => {
      stop()
      window.clearInterval(id)
    }
  })
}

if (typeof window !== 'undefined' && recordingWanted()) {
  installReactCommitCounter()
  startRecording()
}

// The soak player (autoplay.ts), only where its seeded key is set; the gate
// itself (developer build or local host) is checked in autoplayGate.ts.
if (typeof window !== 'undefined' && flag('cluecab-diag-autoplay')) {
  window.setTimeout(() => {
    void import('./autoplayGate').then(({ diagAutoplayOn }) => {
      if (diagAutoplayOn()) void import('./autoplay').then((m) => m.startAutoplay())
    })
  }, 3000)
}
