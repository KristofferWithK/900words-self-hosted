import type { AuthoredGroup } from '../data/city1ClueGroups'
import type { WordEntry } from '../data/types'
import { BOARD, SHIPPED_GREEN_OVERLAPS, distinctGreens, type GridConfig } from '../engine/config'
import type { AuthoredGreenIds } from '../engine/keygen'
import { shuffle, type Rng } from '../engine/rng'
import { fitsBoard } from '../srs/sampler'
import type { SrsMap } from '../srs/types'
import { isCollected, wordsForCity, type WrappedWords } from './progress'

/**
 * The wrap-up round: `BOARD`, dealt from the current city, with the collected
 * words on it starting English-side up. The player packs each of those by
 * typing its Danish word; the round then plays like any other, and every
 * packed word that ends the round green is wrapped — safe in the suitcase for
 * good.
 *
 * Since N2 this deals the SAME board every other round does — there is no
 * wrap-up-shaped config left to import. What is still specific to this deal:
 * `maxNewWordsPerBoard` is 0 for it, not because a config field says so but
 * because this function never reaches the sampler that field steers
 * (`dealBoard` in gameStore.ts).
 *
 * ── AVAILABILITY ────────────────────────────────────────────────────────────
 *
 * A wrap-up needs one collected word to pack. It is not earned by winning.
 * The city does not need a whole board's worth of collected words either. A
 * board needs eighteen words, not eighteen *collected* words — only collected
 * ones were ever wrappable (`finishRound` wraps packed ∧ green), and the five
 * cards a wrap-up board never greens were already collected words that could
 * not wrap that round. So the board is TOPPED UP: collected words first, then
 * the city's discovered words, then its undiscovered ones, and the rule is
 * that **only a word collected before the deal can be wrapped**. Filler plays
 * like any other card and counts toward the win; it just goes nowhere
 * afterwards.
 *
 * The suitcase states the current pool and refuses nothing beyond an empty
 * one.
 */

/**
 * The one thing a wrap-up board needs from the city: something to pack. A
 * wrap-up dealt with zero collected words would be an ordinary round with the
 * dictionary shut. Everything above one word is the player's call.
 */
export const WRAP_UP_FLOOR = 1

/** The game-store's round kinds; wrap-up availability is independent of it. */
export type RoundMode = 'normal' | 'wrapup' | 'tutorial'

/**
 * The most one wrap-up round can put in the suitcase: the board's distinct
 * greens, since a word is wrapped by being packed AND found green.
 *
 * Fifteen on the one-overlap key (the retired 4x5 gave sixteen). Derived
 * rather than written down, because the suitcase says this
 * number out loud to the player and a board change that left the sentence
 * behind would be a lie on the one screen the economy is explained on.
 */
export const MAX_WRAPPED_PER_ROUND = Math.max(
  ...SHIPPED_GREEN_OVERLAPS.map((greenOverlap) => distinctGreens({ ...BOARD, greenOverlap })),
)

/** The current city's collected-or-better words — all a wrap-up may WRAP. */
export function wrapUpPool(
  all: readonly WordEntry[],
  srs: SrsMap,
  wrapped: WrappedWords,
  cityIndex: number,
): WordEntry[] {
  return wordsForCity(all, cityIndex).filter((w) => isCollected(srs[w.id], w.id in wrapped))
}

/**
 * Evidence that some greens belong together: one of the bank's gated clue
 * groups (`src/data/city1ClueGroups.ts`), or a set of greens this player found
 * under one clue (`src/stores/associationStore.ts`). The composer never sees a
 * clue; membership, what was judged safe beside it, and what was seen to pull
 * toward it are the whole input.
 */
export interface GroupEvidence {
  /** Two to four word ids. */
  ids: readonly string[]
  /** Cards judged safe beside this group: an authored board's off-key cards. */
  safeBeside?: ReadonlySet<string>
  /** Cards known to pull toward this group's clue: wrong guesses under it. */
  traps?: ReadonlySet<string>
  /** Weight against other evidence that fits the same seat. */
  weight: number
}

/** A dealt wrap-up board, which of its cards this round may pack, and its keys. */
export interface WrapUpDeal {
  words: WordEntry[]
  /** Word ids collected BEFORE the deal — the only ones that can be wrapped. */
  wrappable: string[]
  /**
   * The two keys the composer chose, in `createGame`'s `authoredGreenIds`
   * shape. Complete only when `words` fills the board; a short deal carries
   * short keys, and the store refuses a short deal before they matter.
   */
  greens: AuthoredGreenIds
}

/**
 * The evidence a wrap-up in a city composes from: the bank's groups first
 * (weight 1, with the bystanders its boards judged safe beside them), and
 * what this player has found together on top (heavier, and heavier still the
 * more often it was found — evidence about THIS player outranks a judge's).
 * Owner, 2026-09-11: "authored groups layered with the player's data".
 */
export function wrapUpEvidence(
  authored: readonly AuthoredGroup[],
  ledger: {
    groups: Readonly<Record<string, { ids: readonly string[]; count: number }>>
    traps: Readonly<Record<string, readonly string[]>>
  },
): GroupEvidence[] {
  const evidence: GroupEvidence[] = authored.map((g) => ({ ids: g.ids, safeBeside: g.safeBeside, weight: 1 }))
  for (const [key, found] of Object.entries(ledger.groups)) {
    evidence.push({
      ids: found.ids,
      traps: new Set(ledger.traps[key] ?? []),
      weight: 1.5 + Math.min(found.count, 4) * 0.25,
    })
  }
  return evidence
}

/**
 * Compose a wrap-up board.
 *
 * THE DRAW is W1's, unchanged: eight queues in strict order, and the order is
 * the rule. Collected words come first because they are the only ones the
 * round can bank, and within them unwrapped before wrapped — the unwrapped
 * are what the round is FOR, and already-wrapped ones only pad when the city
 * runs short of fresh candidates. Then the top-up: the city's discovered
 * words, then its undiscovered ones. Filler is playable and counts toward the
 * win; it is simply not in `wrappable`. `avoid` is the previous board, pushed
 * to the back of its own queue rather than dropped (the old exam draw learned
 * this the hard way): near the end of a city the pool IS the avoid set, and a
 * short board would be a worse answer than a repeat. It never lets a filler
 * word overtake a collected one — a repeat that can be wrapped beats a fresh
 * word that cannot.
 *
 * THE COMPOSITION is new (owner, 2026-09-11). The old deal shuffled each
 * queue and let `generateKeys` hand out roles, so a wrap-up key was a random
 * eight of the collected words: measured with the bank's own gate-1 ruler,
 * one key in twelve had all its greens in some clueable group, against every
 * key of every authored board (`wrapup-composition.test.ts`). Now the greens
 * are packed from `evidence` — groups the bank found a gated clue for, or
 * groups this player found under one clue — walking the same queues, so the
 * structural half of W1 still holds by construction: every collected word
 * that can seat is seated and green before any filler is, and only a
 * collected word is ever wrappable. Then the greens are split into two keys
 * with the config's overlap, each group kept whole on one side (a split group
 * would make its own members traps for each other's clue), the shared greens
 * chosen where a word bridges the two sides; and the bystanders walk the
 * same queues, the cards the bank judged safe beside the groups in use
 * first within each and a card seen to pull toward one last — so a
 * collected word is never displaced by filler, and a deep pool's board is
 * still all packable.
 *
 * With no evidence at all this is the old draw with the lean made a rule:
 * unwrapped collected words are the first greens, wrapped ones next, filler
 * last — which is what `wrapUpBias` used to steer toward with a probability.
 */
export function wrapUpWords(
  all: readonly WordEntry[],
  srs: SrsMap,
  wrapped: WrappedWords,
  cityIndex: number,
  rng: Rng,
  avoid: ReadonlySet<string> = new Set(),
  evidence: readonly GroupEvidence[] = [],
  config: GridConfig = BOARD,
): WrapUpDeal {
  const city = wordsForCity(all, cityIndex)
  const cityById = new Map(city.map((w) => [w.id, w]))
  const collected = city.filter((w) => isCollected(srs[w.id], w.id in wrapped))
  const collectedIds = new Set(collected.map((w) => w.id))
  const filler = city.filter((w) => !collectedIds.has(w.id))

  const unwrapped = collected.filter((w) => !(w.id in wrapped))
  const packed = collected.filter((w) => w.id in wrapped)
  const discovered = filler.filter((w) => w.id in srs)
  const unseen = filler.filter((w) => !(w.id in srs))
  const fresh = (ws: WordEntry[]) => ws.filter((w) => !avoid.has(w.id))
  const stale = (ws: WordEntry[]) => ws.filter((w) => avoid.has(w.id))

  const queues = [
    fresh(unwrapped),
    fresh(packed),
    stale(unwrapped),
    stale(packed),
    fresh(discovered),
    fresh(unseen),
    stale(discovered),
    stale(unseen),
  ]

  const distinct = distinctGreens(config)
  const overlap = config.greenOverlap
  const perSideMax = config.greensPerSide
  const perSideMin = config.greensPerSide - overlap

  // Evidence this city can use, indexed by member, and the pairs it links.
  const groups = evidence.filter((g) => g.ids.length >= 2 && g.ids.every((id) => cityById.has(id)))
  const groupsByMember = new Map<string, GroupEvidence[]>()
  const linked = new Map<string, Set<string>>()
  for (const g of groups) {
    for (const a of g.ids) {
      if (!groupsByMember.has(a)) groupsByMember.set(a, [])
      groupsByMember.get(a)!.push(g)
      if (!linked.has(a)) linked.set(a, new Set())
      for (const b of g.ids) if (b !== a) linked.get(a)!.add(b)
    }
  }
  const linksTo = (id: string, ids: readonly string[]) => {
    const to = linked.get(id)
    return to ? ids.filter((other) => to.has(other)).length : 0
  }

  // ---- greens: fragments packed from evidence, queue by queue ----------------
  interface Fragment {
    ids: string[]
    group: GroupEvidence | null
  }
  const chosen: WordEntry[] = []
  const chosenIds: string[] = []
  const chosenSet = new Set<string>()
  const fragments: Fragment[] = []
  const used = new Set<GroupEvidence>()
  const trapsOfUsed = new Set<string>()
  const fits = (w: WordEntry) => !chosenSet.has(w.id) && fitsBoard(w, chosen)
  const seat = (w: WordEntry, fragment: Fragment) => {
    chosen.push(w)
    chosenIds.push(w.id)
    chosenSet.add(w.id)
    fragment.ids.push(w.id)
  }
  const useGroup = (g: GroupEvidence) => {
    used.add(g)
    for (const id of g.traps ?? []) trapsOfUsed.add(id)
  }

  for (const queue of queues) {
    while (chosen.length < distinct) {
      const usable = new Map(queue.filter(fits).map((w) => [w.id, w]))
      if (usable.size === 0) break
      const room = distinct - chosen.length
      // The group with the most seatable members in this queue; whole groups
      // first, this player's evidence over the bank's, a known trap counted
      // against it. The jitter keeps two equal candidates from always
      // resolving the same way.
      let best: { ids: string[]; group: GroupEvidence; score: number } | null = null
      const candidates = new Set<GroupEvidence>()
      for (const id of usable.keys()) for (const g of groupsByMember.get(id) ?? []) candidates.add(g)
      for (const g of candidates) {
        if (used.has(g)) continue
        // The members that can seat, checked against each other as well as
        // the board: the bank's groups were composed under a looser rule than
        // the board's (151 of the shipped 2,967 hold a pair like by/bo or
        // synes/tænke), and two cards reading the same English on a packing
        // screen would be two identical cards.
        const ids: string[] = []
        for (const id of g.ids) {
          const w = usable.get(id)
          if (w && fitsBoard(w, ids.map((other) => usable.get(other)!))) ids.push(id)
        }
        if (ids.length < 2) continue
        let score = ids.length + (ids.length === g.ids.length ? 1 : 0) + g.weight + rng() * 0.5
        if (ids.some((id) => trapsOfUsed.has(id))) score -= 20
        if (!best || score > best.score) best = { ids: ids.slice(0, room), group: g, score }
      }
      if (best) {
        const fragment: Fragment = { ids: [], group: best.group }
        for (const id of best.ids) seat(usable.get(id)!, fragment)
        // A group cut short by the room left is still one fragment; the
        // members that did not fit will not be dealt, so nothing is split.
        fragments.push(fragment)
        useGroup(best.group)
        continue
      }
      // No pair left in this queue: a single, preferring one linked to what
      // is already seated, and joining the fragment whose group names it so
      // it stays on that fragment's side.
      let single: WordEntry | null = null
      let singleScore = -Infinity
      for (const w of usable.values()) {
        // Linked to a seated green: a good single. Judged safe beside a group
        // in use: the bank's word for "a good bystander", so it waits.
        const safeBesideUsed = [...used].filter((g) => g.safeBeside?.has(w.id)).length
        const score =
          linksTo(w.id, chosenIds) - safeBesideUsed * 0.75 - (trapsOfUsed.has(w.id) ? 20 : 0) + rng() * 0.5
        if (score > singleScore) {
          singleScore = score
          single = w
        }
      }
      if (!single) break
      const home = fragments.find((f) => f.group?.ids.includes(single!.id) && f.ids.length < 3)
      if (home) seat(single, home)
      else {
        const fragment: Fragment = { ids: [], group: null }
        seat(single, fragment)
        fragments.push(fragment)
      }
    }
    if (chosen.length >= distinct) break
  }

  const wrappableOf = (board: readonly WordEntry[]) =>
    board.filter((w) => collectedIds.has(w.id)).map((w) => w.id)

  // A city that cannot seat the greens cannot deal: hand back what seated,
  // short, and let the store refuse it (it checks `words.length`).
  if (chosen.length < distinct) {
    return { words: chosen, wrappable: wrappableOf(chosen), greens: { player: [], ai: [] } }
  }

  // ---- two keys: fragments to piles, whole; the overlap where sides bridge ---
  const piles: [string[], string[]] = [[], []]
  for (const f of [...fragments].sort((a, b) => b.ids.length - a.ids.length)) {
    const first = piles[0].length <= piles[1].length ? 0 : 1
    const second = first === 0 ? 1 : 0
    if (piles[first].length + f.ids.length <= perSideMax) piles[first].push(...f.ids)
    else if (piles[second].length + f.ids.length <= perSideMax) piles[second].push(...f.ids)
    else {
      // Neither side has room for the whole fragment: the cost of a split is
      // taken here rather than a short key, and it is rare (it needs both
      // sides within two of full and a triple still to place).
      const roomFirst = perSideMax - piles[first].length
      piles[first].push(...f.ids.slice(0, roomFirst))
      piles[second].push(...f.ids.slice(roomFirst))
    }
  }
  // Each pile is between greensPerSide - overlap and greensPerSide: the pile
  // above the minimum lends the difference to the other side as shared greens.
  const shareFrom = (pile: string[], other: string[], n: number): string[] => {
    const singles = new Set(fragments.filter((f) => f.ids.length === 1).map((f) => f.ids[0]!))
    return [...pile]
      .map((id) => ({ id, score: linksTo(id, other) * 2 + (singles.has(id) ? 1 : 0) + rng() * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(({ id }) => id)
  }
  const sharedFromPlayer = shareFrom(piles[0], piles[1], piles[0].length - perSideMin)
  const sharedFromAi = shareFrom(piles[1], piles[0], piles[1].length - perSideMin)
  const greens: AuthoredGreenIds = {
    player: [...piles[0], ...sharedFromAi],
    ai: [...piles[1], ...sharedFromPlayer],
  }

  // ---- bystanders: down the same queues, the safest first within each -------
  // The queues still rule — a collected word is never displaced by filler,
  // which also keeps a deep pool's board all packable, so packing tells the
  // player nothing about the key. Within a queue: the cards the bank judged
  // safe beside the groups in use first, a card seen to pull toward one of
  // them last, and a card linked to a green by any evidence behind the rest.
  const usedGroups = [...used]
  const need = config.totalWords - distinct
  const bystanders: WordEntry[] = []
  for (const queue of queues) {
    if (bystanders.length >= need) break
    const ranked = queue
      .filter(fits)
      .map((w) => ({
        w,
        score:
          usedGroups.filter((g) => g.safeBeside?.has(w.id)).length -
          (trapsOfUsed.has(w.id) ? 100 : 0) -
          linksTo(w.id, chosenIds) * 3 +
          rng() * 0.5,
      }))
      .sort((a, b) => b.score - a.score)
    for (const { w } of ranked) {
      if (bystanders.length >= need) break
      if (fitsBoard(w, bystanders)) bystanders.push(w)
    }
  }

  const words = shuffle([...chosen, ...bystanders], rng)
  return { words, wrappable: wrappableOf(words), greens }
}

/**
 * Whether the city can offer a wrap-up round at all.
 *
 * One condition now, and it is the floor: something to pack. The old check
 * dealt a board and asked whether it came out full, because the board could
 * only be built from collected words and a pool of eighteen that could not
 * SEAT eighteen was not enough. The board tops up from the whole city now, so
 * seating is no longer in question and the collected pool is the only thing
 * this can be about. `newWrapUpGame` still refuses a short board, which is
 * belt to this brace.
 */
export function wrapUpUnlocked(
  all: readonly WordEntry[],
  srs: SrsMap,
  wrapped: WrappedWords,
  cityIndex: number,
): boolean {
  return wrapUpPool(all, srs, wrapped, cityIndex).length >= WRAP_UP_FLOOR
}
