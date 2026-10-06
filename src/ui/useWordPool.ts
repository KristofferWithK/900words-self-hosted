import { useLayoutEffect } from 'react'
import { claimWordPool } from './speak'

/**
 * Hold a word pool of `limit` elements while this screen is mounted (and
 * `active`), and give every element back when it unmounts (speak.ts,
 * `claimWordPool`). A layout effect, not a passive one: React runs a
 * child's passive effects before its parent's, so a board dealt by a child
 * component would otherwise ready its words before the screen's pool was
 * claimed. Every layout effect of a commit runs before any passive one.
 * Every screen passes a constant limit; a pool that must shrink while its
 * screen stays uses the handle's `setLimit` (or `setWordPoolLimit`).
 */
export function useWordPool(name: string, limit: number, active = true): void {
  useLayoutEffect(() => {
    if (!active) return
    const claimed = claimWordPool(name, limit)
    return () => claimed.release()
  }, [name, limit, active])
}
