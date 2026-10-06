import type { DiagSwitch } from './switches'

/**
 * The hidden performance log's labels: English only, on purpose.
 *
 * The section is a developer's instrument reached by seven taps on the build
 * stamp, never something a player is shown, so it follows the keyboard
 * readout's pattern (nativeKeyboard.ts `report`): terse labels and numbers,
 * not catalogue copy. Kept to a word or two each, like the readout's keys, so
 * nothing here reads as a sentence to `validate:literals`; if one ever has to
 * be a sentence, that is the sign it has become player copy and belongs in
 * src/i18n instead.
 */
export const DIAG_LABEL = {
  heading: 'Performance log',
  recording: 'Recording',
  switches: 'A/B switches',
  send: 'Send log',
  clear: 'Clear log',
  shared: 'Shared.',
  downloaded: 'Downloaded.',
  failed: 'Export failed.',
  cleared: 'Cleared.',
  nextRun: '(next run/puzzle)',
  hits: 'hits',
  first: 'first',
  last: 'last',
  median: 'median',
  worst: 'worst',
  ms: 'ms',
  none: '–',
  logTitle: 'Performance log',
} as const

export const SWITCH_LABEL: Record<DiagSwitch, string> = {
  wordAudio: 'Mute words',
  sfx: 'Mute effects',
  haptics: 'No haptics',
  runPictures: 'No word-pictures',
  deferWrites: 'Defer writes',
  cafeArt: 'No café-art',
  elementWords: 'Old word-players',
}
