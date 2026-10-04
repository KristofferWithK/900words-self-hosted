import type { SrsMap } from '../srs/types'
import { countMarks, type PhotoLedger, type WordKind } from './wordMarks'

/**
 * SLIPS ON THE TRAIN RUN (docs/roadmap/cafe-world.md, section 4; card CW-04).
 *
 * The train run forgives more wrong words than a walk: one to start, plus one
 * for every 20 words collected. Collected is the three-mark model's count
 * (`countMarks(cityWords(...))`, journey/wordMarks.ts), never the pre-café
 * two-mark reader. Sønderborg with all 147 collected: 1 + 7 = 8.
 *
 * A slip is a wrong word forgiven: the run engine's `forgiven` option.
 */

/** Slips every train run starts with. */
export const BASE_TRAIN_SLIPS = 1
/** Collected words that earn one more slip. */
export const WORDS_PER_TRAIN_SLIP = 20

/** Slips for a train run, from the number of words collected. */
export function trainSlips(collected: number): number {
  const n = Number.isFinite(collected) ? Math.max(0, Math.floor(collected)) : 0
  return BASE_TRAIN_SLIPS + Math.floor(n / WORDS_PER_TRAIN_SLIP)
}

/** Slips for a train run through `words` (a city's `cityWords`), read from the player's marks. */
export function trainSlipsFor(
  words: readonly { readonly id: string; readonly kind: WordKind }[],
  srs: SrsMap,
  photos: PhotoLedger,
): number {
  return trainSlips(countMarks(words, srs, photos).collected)
}
