/**
 * The performance log's A/B switches (developer-only, hidden behind seven taps
 * on the build stamp in Settings).
 *
 * Each switch turns one suspect off so a phone can be played with and without
 * it: the owner's iPhone hitches on every word hit, more the longer the app
 * runs, and no desktop browser reproduces it. They are read where the work
 * happens (one line in each place, `diagSwitch('...')`), so a switch takes
 * effect on the next run or puzzle; nothing is re-rendered when one changes.
 *
 * All off unless someone turned one on in the hidden section. Reading one is
 * a property read on an object loaded once at start, so the lines that ask
 * cost nothing for a player.
 *
 * `elementWords` ("Old word-players") is the way back for the words: they
 * play through Web Audio by default (src/ui/wordAudioWeb.ts, owner's call for
 * TestFlight 126 after the simulator soak A/B), and with it on they use the
 * media-element pool of speak.ts as before. It takes effect on the next word
 * said. A device that stored the retired opt-in `webAudioWords` simply gets
 * the default: `load` reads only the names listed here.
 */

export const DIAG_SWITCHES = ['wordAudio', 'sfx', 'haptics', 'runPictures', 'deferWrites', 'cafeArt', 'elementWords'] as const
export type DiagSwitch = (typeof DIAG_SWITCHES)[number]

export const SWITCHES_KEY = 'cluecab-diag-switches'

let state: Partial<Record<DiagSwitch, boolean>> = load()

function load(): Partial<Record<DiagSwitch, boolean>> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = JSON.parse(localStorage.getItem(SWITCHES_KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object') return {}
    const out: Partial<Record<DiagSwitch, boolean>> = {}
    for (const name of DIAG_SWITCHES) if ((raw as Record<string, unknown>)[name] === true) out[name] = true
    return out
  } catch {
    return {}
  }
}

/** Whether switch `name` is on (for most, the switch that turns `name` OFF). False for every player. */
export function diagSwitch(name: DiagSwitch): boolean {
  return state[name] === true
}

/** Every switch that is on, for the log's header. */
export function diagSwitchesOn(): DiagSwitch[] {
  return DIAG_SWITCHES.filter((name) => state[name] === true)
}

export function setDiagSwitch(name: DiagSwitch, on: boolean): void {
  const next = { ...state }
  if (on) next[name] = true
  else delete next[name]
  state = next
  try {
    if (Object.keys(next).length) localStorage.setItem(SWITCHES_KEY, JSON.stringify(next))
    else localStorage.removeItem(SWITCHES_KEY)
  } catch {
    /* private mode: the switch holds for this launch */
  }
}

/** Tests: read the stored switches again. */
export function reloadDiagSwitches(): void {
  state = load()
}
