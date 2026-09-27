// Selecting a stop on the journey map, the way a finger does it.
//
// The map used to be nine transparent circles, one per stop, and a drive could
// click one by name. It is one surface now, and the stop a tap picks is the
// nearest — see nearestStop in src/journey/map.ts for the measurements that
// moved it there (at 360x640 those circles were 20.8px across and most of a
// 44px tap landed on nothing at all).
//
// So a drive taps the surface at a stop's own dot, which is the gesture the
// player makes and the one worth exercising. The per-stop circles are still in
// the DOM for a keyboard and for assistive tech, and their aria-labels are
// still the way a drive asks what a stop is called.

/** Where each stop's dot sits, and which .map-city index it is. */
export const stopDots = (page) =>
  page.evaluate(() => {
    const surface = document.querySelector('.map-surface')?.getBoundingClientRect()
    if (!surface) return []
    return [...document.querySelectorAll('.map-city')].map((g, index) => {
      const dot = g.querySelector('.map-dot').getBoundingClientRect()
      return {
        index,
        className: g.getAttribute('class') ?? '',
        label: g.querySelector('.map-hit')?.getAttribute('aria-label') ?? '',
        x: dot.x + dot.width / 2 - surface.x,
        y: dot.y + dot.height / 2 - surface.y,
      }
    })
  })

/**
 * Tap the stop at `index`, or the first/last one whose group matches `matching`
 * (e.g. '.map-city-ahead'). Returns the dot that was tapped.
 */
export async function tapStop(page, { index, matching, pick = 'first' } = {}) {
  const dots = await stopDots(page)
  const wanted =
    index !== undefined
      ? dots[index]
      : (() => {
          const hits = dots.filter((d) => d.className.split(/\s+/).includes(matching.replace(/^\./, '')))
          return pick === 'last' ? hits.at(-1) : hits[0]
        })()
  if (!wanted) throw new Error(`no stop for ${JSON.stringify({ index, matching, pick })}`)
  await page.locator('.map-surface').click({ position: { x: wanted.x, y: wanted.y } })
  return wanted
}
