import type { Orthography } from '../types'

/**
 * German written on a keyboard without umlauts: ä→ae, ö→oe, ü→ue, ß→ss.
 *
 * Byte-identical to the folds in `scripts/audio-slug.mjs`, and that is the one
 * that fails silently: without ä→ae, Mädchen and Madchen become one clip file.
 * `speak.test.ts` compares the two over the whole dataset.
 */
const fold = (s: string): string =>
  s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

/**
 * The reverse, tried as a second reading of a player's ANSWER only. Ordered
 * longest-first so `ss` is considered before a bare vowel pair, and applied to
 * the typed answer alone: the dataset word is spelled properly.
 */
const unfold = (s: string): string =>
  s.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')

export const germanOrthography: Orthography = {
  distinctive: /[äöüß]/,
  fold,
  unfold,
  // TRUE, and this is the case the flag exists for. "ss" for "ß" is correct
  // Swiss orthography and "ue" for "ü" is an accepted transcription, so a
  // folded match here may be the word spelled correctly rather than a typo to
  // forgive. The packing grader asks this rather than assuming; Danish answers
  // false, because nobody writes "oel" for "øl".
  foldsAreSpellings: true,
}
