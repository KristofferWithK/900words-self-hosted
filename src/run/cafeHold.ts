import type { Cafe } from '../journey/cafes'
import type { RunEngine, RunShopfront } from './engine'
import { onCafeFound, walkFindsCafes } from './sinkSetup'

/**
 * A CAFÉ FOUND ON A WALK, ON THE ROAD (contract §5 and §7). The results sink
 * tells listeners when a photo finds a café (sinkSetup.ts `onCafeFound`); this
 * wires that to the run: one café with its name on the road ahead, which Casey
 * walks through.
 *
 * Only the first session's walk holds the run on a find ("You found a café.
 * You can play it later from home.", contract §7 step 4). Every other walk
 * keeps walking (owner, 2026-10-04: "Hitting a café should only pause the
 * game in the onboarding, otherwise you just keep walking"): the café stands
 * on the road, Casey walks through it, and the run-end panel says which cafés
 * the walk found. The find itself is stored by the sink either way; only the
 * hold differs. The train run finds no café, so nothing is wired for it.
 */
export interface CafeHold {
  /** The café's own name (a Danish proper name), or null for a café without one. */
  readonly name: string | null
  readonly shop: RunShopfront
  /** Whether the run holds on this find until the player carries on. */
  readonly held: boolean
}

/**
 * Listen for cafés found by `engine`'s walk. `nameOf` names a café (the screen
 * passes `cafeNameForBoard`); a café without a name gets `sign` on its shop.
 * `hold` says whether a find holds the run: true only on the first session's
 * walk. `onFind` hears each find once the café is placed (and the run held,
 * with `hold`). Returns the function that stops listening.
 *
 * The sink writes a run's answers a moment after they are given, and at the
 * latest when the run ends (sinkSetup.ts, deferred writes): a café found by
 * one of the last answers can be heard after the run is over, when there is
 * no road to place it on. `onLate` hears that find, so the run-end panel can
 * still name it; the café itself is stored by the sink like any other.
 */
export function holdRunForCafes(
  engine: Pick<RunEngine, 'walk' | 'findCafe'>,
  nameOf: (cafe: Cafe) => string | null,
  sign: string,
  hold: boolean,
  onFind: (find: CafeHold) => void,
  onLate?: (name: string | null) => void,
): () => void {
  if (!walkFindsCafes(engine.walk)) return () => {}
  return onCafeFound((cafe, photo) => {
    if (photo.walk !== engine.walk) return
    const name = nameOf(cafe)
    const shop = engine.findCafe(name ?? sign, hold)
    if (shop) onFind({ name, shop, held: hold })
    else onLate?.(name)
  })
}
