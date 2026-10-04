/**
 * The four speeds of every run (contract, docs/roadmap/cafe-world.md §2):
 * seconds from one gate to the next. 3.2 from the start, 2.6 from word 8, 2.1
 * from word 18, 1.75 from word 28. 1.75 is the top speed everywhere; a faster
 * fifth level was tried in the prototype and dropped (owner, 2026-10-03).
 *
 * Not a creeping acceleration: the speed steps when a tier is reached and the
 * engine eases into the new one over about half a second.
 */
export const GATE_TIERS: readonly { readonly from: number; readonly seconds: number }[] = [
  { from: 0, seconds: 3.2 },
  { from: 8, seconds: 2.6 },
  { from: 18, seconds: 2.1 },
  { from: 28, seconds: 1.75 },
]

/** The tier index for a count of words. As in the prototype, the Words walk counts photos. */
export function tierOf(count: number): number {
  let tier = 0
  for (let i = 0; i < GATE_TIERS.length; i++) if (count >= GATE_TIERS[i].from) tier = i
  return tier
}

export function secondsPerGate(count: number): number {
  return GATE_TIERS[tierOf(count)].seconds
}
