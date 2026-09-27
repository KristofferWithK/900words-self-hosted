import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'
import { measureReviewGeometry } from './city1-review-geometry.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4182
const preview = await startPreview(PORT)

/**
 * Layout and journey-edge regressions that only show up in a real browser:
 * the end of the road, map labels near the viewBox edge, the primary action's
 * position on small phones, and the board's ⓘ overlapping words.
 */
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const BASE = preview.base
const PHONE = { width: 390, height: 844 }

const browser = await chromium.launch({ executablePath: EXE })
const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

// The ride ships OFF behind cluecab-ride (H9 has one city of nine written), so
// the no-scroll pass over it has to ask for it by name. It measures the
// tallest screen in the app — thirty-one sentences and their glosses — which
// is exactly the one worth keeping measured while it is hidden. Same init
// script as journey-drive; the default-off half is a unit test.
await page.addInitScript(() => localStorage.setItem('cluecab-ride', '1'))
// A device that has already answered the UI-language question, which every
// device here is meant to be: this drive measures what comes AFTER it. Phase
// 1g turned that question on for everyone, so without this the intro opens on
// the language act and each check below would be reading the wrong screen.
//
// ONLY when nothing is stored. An init script runs on every navigation,
// including the reload `openIn` uses to switch language — so the unconditional
// version of this line put 'en' back four times and the whole four-language
// loop below silently measured English. The `really is in <lang>` check there
// exists because that is exactly what happened.
await page.addInitScript(() => {
  if (localStorage.getItem('cluecab-ui-language') === null) {
    localStorage.setItem('cluecab-ui-language', 'en')
  }
})
// A forced terminal fixture has to update the current primary session as well
// as the old game cache. C1-PC-1 intentionally ignores a cache-only round on
// reload. Queue both values before hydration, mirroring endgame-drive's
// supported durable fixture rather than reviving the retired raw-cache seam.
await page.addInitScript(() => {
  try {
    const queued = sessionStorage.getItem('__layout-primary-fixture-v1')
    if (queued) {
      const fixture = JSON.parse(queued)
      localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
      localStorage.setItem('cluecab-game-v1', fixture.cache)
      sessionStorage.removeItem('__layout-primary-fixture-v1')
    }
  } catch { /* opaque origins have no session storage */ }
  window.__writeLayoutPrimaryFixture = (raw) => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
      throw new Error('layout fixture has no active durable primary slot')
    }
    sessions.primary.game = raw.state.game
    sessionStorage.setItem('__layout-primary-fixture-v1', JSON.stringify({
      sessions: JSON.stringify(saved), cache: JSON.stringify(raw),
    }))
  }
})

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

async function open(query) {
  await page.goto(BASE + query, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}

// The final city used to ask cityAt() for a stop past the end, which throws
// and blanks the app for good — cityIndex and the suitcase are both persisted.
// The release scope (DEVELOPED_CITY_COUNT = 1) ends that state for now: no one
// stands past Sønderborg, so the end-of-journey line cannot render and the
// honest checks are the crash class the old ones guarded — a jump past the
// scope lands clamped at stop 0 with a suitcase full of wrapped words and
// NOTHING crashes. (journeyStore.test.ts pins the store side; this pins Home.)
await open('?mock=1&howto=0&city=0&wrapped=100')
check('the scoped end of the road renders — traveller stands at the one developed stop', (await page.locator('.home-map').count()) === 1)
check('the journey-done line is beyond the release scope, so it does not render', (await page.locator('.journey-done').count()) === 0)
check('no page errors at the scoped end of the road', errors.length === 0, errors.join(' | '))

// The "you are here" label must stay inside the map — Skagen sits at the top
// edge, København at the right.
// Indices, not names, so they moved when Viborg came off the route: Skagen
// was 6 and is 5, København was 9 and is 8. Both cases still passed at the old
// numbers — they landed on Odense and on nothing at all — which is the quiet
// way an edge-case check stops being one.
// The release scope (DEVELOPED_CITY_COUNT = 1) leaves only stop 0 reachable —
// the ?city= jump refuses to seed past it, so the far-edge labels have nothing
// to stand on until City 2 opens the road. The inside-the-map invariant is
// still pinned at the one stop every player stands on.
for (const [city, name] of [
  [0, 'Sonderborg'],
]) {
  await open(`?mock=1&howto=0&city=${city}`)
  const map = await page.locator('.home-map').boundingBox()
  const label = await page.locator('.home-map-here').boundingBox()
  const inside =
    label.y >= map.y - 0.5 &&
    label.y + label.height <= map.y + map.height + 0.5 &&
    label.x >= map.x - 0.5 &&
    label.x + label.width <= map.x + map.width + 0.5
  check(`map label stays inside the map at ${name}`, inside)
}

// The primary action has to be reachable without scrolling, on the small
// phones people actually own.
for (const vp of [
  { width: 390, height: 844, name: 'iPhone 14' },
  { width: 375, height: 667, name: 'iPhone SE' },
  { width: 360, height: 640, name: 'small Android' },
  // One pixel beyond Home's former compact-layout boundary. This was the
  // invisible collision: the document fit, but Casey's hit target covered Play.
  { width: 360, height: 721, name: 'near-short Android' },
]) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await open('?mock=1&howto=0&city=0')
  const titleGeometry = await page.evaluate(() => {
    const title = document.querySelector('h1.home-title')
    const spans = title ? Array.from(title.querySelectorAll(':scope > span')) : []
    if (!title || spans.length !== 2) return null
    const [numeric, words] = spans.map((span) => {
      const rect = span.getBoundingClientRect()
      return {
        text: span.textContent?.trim(),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        height: rect.height,
      }
    })
    const rect = title.getBoundingClientRect()
    const insideViewport = (box) =>
      box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight
    return {
      text: [numeric.text, words.text],
      numericHeight: numeric.height,
      wordsHeight: words.height,
      wordsOffset: words.top > numeric.top && words.bottom > numeric.bottom + 1,
      insideViewport: insideViewport(rect) && insideViewport(numeric) && insideViewport(words),
    }
  })
  check(
    `900words title spans have the designed geometry inside the viewport on ${vp.name}`,
    titleGeometry?.text[0] === '900' &&
      titleGeometry.text[1] === 'words' &&
      titleGeometry.numericHeight > titleGeometry.wordsHeight &&
      titleGeometry.wordsOffset &&
      titleGeometry.insideViewport,
    titleGeometry ? JSON.stringify(titleGeometry) : 'title or its two spans are missing',
  )
  const primary = await page.locator('.btn-primary.btn-big').first().boundingBox()
  const homeMap = await page.locator('.home-map').boundingBox()
  const travelGuide = await page.locator('.home-guide-button').boundingBox()
  check(
    `primary action is above the fold on ${vp.name}`,
    primary.y + primary.height <= vp.height,
    `bottom ${(primary.y + primary.height).toFixed(0)} of ${vp.height}`,
  )
  check(
    `Travel Guide sits level with the Home map on ${vp.name}`,
    Math.abs(travelGuide.y - homeMap.y) <= 8,
    `guide y=${travelGuide.y.toFixed(1)}, map y=${homeMap.y.toFixed(1)}`,
  )

  /**
   * Home's earned-postcard readout must clear Casey and Play. City 1's next
   * stop is not released publicly, so this is deliberately an announced SVG
   * readout—not a pretend boarding button. The old wrapped query and
   * train-board assertion belonged to retired wrap-up travel.
   */
  await open('?mock=1&howto=0&city=0')
  const train = await page.locator('.train-progress').boundingBox()
  const nameCount = await page.locator('.home-screen .cluey-name').count()
  const svg = await page.locator('.cluey-svg').boundingBox()
  const caseyButton = await page.locator('.cluey-button').boundingBox()
  const actions = await page.locator('.home-actions').boundingBox()
  check(
    `Casey's band clears the postcard progress readout on ${vp.name}`,
    nameCount === 0 &&
      svg.y >= train.y + train.height - 0.5 &&
      caseyButton.y >= train.y + train.height - 0.5 &&
      svg.y + svg.height <= actions.y - 10 &&
      caseyButton.y + caseyButton.height <= actions.y - 10,
    `${nameCount} visible names, ` +
      `drawing ${(actions.y - svg.y - svg.height).toFixed(1)}px and hit target ` +
      `${(actions.y - caseyButton.y - caseyButton.height).toFixed(1)}px above the play row`,
  )
  const playGetsOwnTaps = await page.evaluate(() => {
    const action = document.querySelector('.home-play')?.getBoundingClientRect()
    if (!action) return false
    return [
      [action.left + 4, action.top + 4],
      [action.right - 4, action.top + 4],
      [action.left + action.width / 2, action.top + action.height / 2],
      [action.left + 4, action.bottom - 4],
      [action.right - 4, action.bottom - 4],
    ].every(([x, y]) => document.elementFromPoint(x, y)?.closest('.home-actions'))
  })
  check(`and Play receives its own taps on ${vp.name}`, playGetsOwnTaps)
  // Public City 1 must not offer a boarding control just because the readiness
  // count exists. It remains a named readout for assistive technology.
  const trainReadout = page.locator('.train-progress')
  const trainTag = await trainReadout.evaluate((el) => el.tagName)
  check(
    `and public City 1 exposes a named progress readout, not a boarding button, on ${vp.name}`,
    trainTag === 'svg' &&
      (await trainReadout.getAttribute('aria-label')) !== null &&
      (await page.locator('.train-board').count()) === 0,
    `<${trainTag.toLowerCase()}>, ${train.height.toFixed(0)}px tall, ${train.width.toFixed(0)}px wide`,
  )
  const bubble = await page.locator('.cluey-bubble')
  const band = await page.locator('.home-progress-band').boundingBox()
  if ((await bubble.count()) === 1) {
    // Silent days (silentDay, cluey-tips) render no bubble at all — the
    // figure stands alone and there is no clearance to keep. On the other
    // two days out of three the bubble must stay under the progress line.
    const box = await bubble.boundingBox()
    check(
      `and his bubble stays under the progress line on ${vp.name}`,
      box.y >= band.y + band.height - 0.5,
      `${(box.y - band.y - band.height).toFixed(1)}px clear`,
    )
  } else {
    check(
      `silent day: Casey stands alone but still renders on ${vp.name}`,
      (await page.locator('.cluey-button').count()) === 1 && (await page.locator('.cluey-band').count()) === 1,
    )
  }
}
await page.setViewportSize(PHONE)

// Home now keeps its named postcard total under the Travel Guide rather than
// squeezing it beside the rail. The old range measurement still queried the
// retired `.collect-count`, so it crashed before checking either packed state.
// Measure the visible rail, status and authoritative postcard total instead:
// each must fit at the narrow phone width, without document overflow or a
// rail squeezed beneath its meaningful 34px floor.
const progressLines = async () =>
  page.evaluate(() => {
    const row = document.querySelector('.home-progress-band')
    const train = document.querySelector('.train-progress')
    const status = document.querySelector('.home-progress-status')
    const postcards = document.querySelector('.home-postcard-total')
    if (!row || !train || !status || !postcards) throw new Error('Home progress fixtures are missing')
    return {
      text: `train ${train.getBoundingClientRect().width.toFixed(0)}px — ${postcards.textContent.replace(/\s+/g, ' ').trim()} — ${status.textContent.replace(/\s+/g, ' ').trim()}`,
      overflows: row.scrollWidth > row.clientWidth + 1,
      clipped: train.getBoundingClientRect().width < 34,
      postcardOverflow: postcards.scrollWidth > postcards.clientWidth + 1,
      statusOverflow: status.scrollWidth > status.clientWidth + 1,
      wide: document.scrollingElement.scrollWidth > window.innerWidth + 1,
    }
  })

for (const query of [
  '?mock=1&howto=0&city=0&collected=30',
  '?mock=1&howto=0&city=0&wrapped=50&collected=100',
]) {
  await page.setViewportSize({ width: 360, height: 640 })
  await open(query)
  const p = await progressLines()
  check('the progress rail and postcard total fit at 360px', !p.postcardOverflow && !p.statusOverflow, p.text)
  check('and nothing in the progress area overflows or is cut off', !p.overflows && !p.clipped && !p.wide)
}
// Wipe what that seeded. `?collected=100` gives every word in city 0 a full
// stats record, and `?almost=…` further down explicitly skips words that
// already have one — so leaving it stood there turned the round-greening
// section into a round that could not green anything, and the check under it
// failed a hundred lines away from the cause.
await page.evaluate(() => localStorage.clear())
await page.setViewportSize(PHONE)

// Settings is the one screen with more to say than a phone is tall. The
// DOCUMENT must not scroll — its internal container does, under a header
// that stays put.
await open('?mock=1&howto=0&city=0')
await page.locator('.icon-btn[aria-label="Settings"]').click()
await page.waitForSelector('.settings-screen')
const headerTop = async () => (await page.locator('.screen-header').boundingBox()).y
const atRest = await headerTop()
await page.evaluate(() => {
  document.querySelector('.screen-scroll').scrollTo(0, 600)
})
await page.waitForTimeout(250)
const scrolled = await headerTop()
check(
  'the settings header stays put when its scroller scrolls',
  scrolled <= atRest + 0.5 && scrolled >= -0.5,
  `${atRest.toFixed(0)}px at rest, ${scrolled.toFixed(0)}px scrolled`,
)
const settingsDoc = await page.evaluate(() => ({
  sh: document.scrollingElement.scrollHeight,
  ih: window.innerHeight,
  inner: document.querySelector('.screen-scroll').scrollTop,
}))
check(
  'and the scroll happened inside, never on the document',
  settingsDoc.sh <= settingsDoc.ih + 1 && settingsDoc.inner > 0,
  `document ${settingsDoc.sh} vs ${settingsDoc.ih}, scroller at ${settingsDoc.inner}`,
)
const opaque = await page
  .locator('.screen-header')
  .evaluate((el) => getComputedStyle(el).backgroundColor)
check('and is opaque, so content passes behind it', !/rgba\(0, 0, 0, 0\)|transparent/.test(opaque), opaque)

// The scrim stays out of Settings. Its inputs live in no dock, so kb-up used
// to engage with nothing at z-index 5 above the fixed inset-0 scrim — and the
// first tap after focusing a field landed on the scrim instead of the thing
// tapped. Stood up the way a real keyboard stands it up (kb-up on the root),
// then a second field is clicked: with the scrim rendered app-wide this focus
// never happens.
await page.evaluate(() => document.documentElement.classList.add('kb-up'))
const scrimInSettings = await page.locator('.kb-scrim').count()
const inputs = page.locator('.settings-section input')
await inputs.nth(1).click()
const focusedSecond = await page.evaluate(
  () => document.activeElement instanceof HTMLInputElement,
)
await page.evaluate(() => document.documentElement.classList.remove('kb-up'))
check(
  'the keyboard scrim does not exist on settings, so a field tap lands',
  scrimInSettings === 0 && focusedSecond,
  `${scrimInSettings} scrims, second input focused: ${focusedSecond}`,
)
await page.goBack()
await page.waitForTimeout(250)

// The switch names the two real brains. ON must always restore the normal
// Ollama Worker, even after Gemma or a custom service was selected.
await open('?mock=1&howto=0&city=0')
await page.locator('.icon-btn[aria-label="Settings"]').click()
await page.waitForSelector('.settings-screen')
const brainSwitch = page.locator('.casey-brain-toggle')
check('the normal Ollama brain switch is there', (await brainSwitch.count()) === 1)
// The usage-stats switch (PR #204) shares the class; this row is the brain's.
const row = await page.locator('.casey-brain-switch:not(.usage-stats-switch)').boundingBox()
check(
  'and fits the phone',
  row.x >= -0.5 && row.x + row.width <= PHONE.width + 0.5,
  `${row.width.toFixed(0)}px on ${PHONE.width}px`,
)
await brainSwitch.check()
await page.waitForTimeout(200)
let brainStatus = await page.locator('.casey-brain-status').innerText()
check(
  'and ON explicitly selects Ollama and turns Gemma off',
  (await brainSwitch.isChecked()) && /Ollama is playing/.test(brainStatus) && /Gemma is off/.test(brainStatus),
  brainStatus,
)
await brainSwitch.uncheck()
await page.waitForTimeout(200)
brainStatus = await page.locator('.casey-brain-status').innerText()
// The sentence under the switch, not a paraphrase of it. #148 rewrote it to
// say what Gemma does and does NOT take over, and this went on asking for the
// old wording — a red line about copy that had already been decided.
check(
  'and OFF explicitly selects Gemma, dictionary misses aside',
  !(await brainSwitch.isChecked()) &&
    /Gemma 4 E4B handles clues and guesses/.test(brainStatus) &&
    /Dictionary misses still use Ollama/.test(brainStatus),
  brainStatus,
)
await brainSwitch.check()
await page.locator('input[type="url"]').fill('https://somewhere-else.example/v1')
await page.waitForTimeout(200)
check('a custom Worker is not mislabeled as normal Ollama', !(await brainSwitch.isChecked()))
await brainSwitch.check()
await page.waitForTimeout(200)
const storedSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-settings-v1')).state)
check(
  'and ON comes back to the normal proxy and Worker mode',
  storedSettings.baseUrl === 'https://cluecabulary-proxy.kristoffer-kai.workers.dev/v1' && storedSettings.caseyMode === 'worker',
  JSON.stringify({ baseUrl: storedSettings.baseUrl, caseyMode: storedSettings.caseyMode }),
)
check(
  'and exposes no client-side model field',
  (await page.locator('.settings-section input[type="text"]').count()) === 0,
)
await page.goBack()
await page.waitForTimeout(250)

// A screenshot of Settings has to say which build it is, or "have you got the
// update yet?" cannot be answered.
await open('?mock=1&howto=0&city=0')
await page.locator('.icon-btn[aria-label="Settings"]').click()
await page.waitForSelector('.settings-screen')
const stamp = (await page.locator('.build-footer').innerText()).trim()
check('Settings names the build', /Build \S+/.test(stamp), stamp.split('\n')[0])
check(
  'and offers a way to go and fetch a newer one',
  (await page.getByRole('button', { name: /check for updates/i }).count()) === 1,
)
await page.goBack()
await page.waitForTimeout(250)

// The ⓘ must not be drawn over the word it belongs to, or it steals taps meant
// for a guess.
await open('?mock=1&howto=0&seed=7&city=0')
await page.locator('.home-play').click()
await page.waitForTimeout(700)
const info = await page.locator('.card-info').first().boundingBox()
const word = await page.locator('.card-da').first().boundingBox()
check(
  'the lookup button does not overlap the word',
  !(info.y + info.height > word.y && info.x < word.x + word.width),
)

// ---- the end screen, as ONE FIXED SCREEN (P1) --------------------------------
//
// This section was VACUOUS. It played a mock round with a twelve-turn loop and
// wrapped every assertion in `if (summarised)`, so a seed that did not reach an
// ending printed one SKIP line and checked nothing — which is how the screen
// with the app's only unbounded content came to have no measurement at all
// (found by B1). It is driven to a WIN deterministically now, the way
// endgame-drive does it: force the last chance, then name every remaining
// green. No branch, no skip, and the round that gets measured is a full one.
//
// `almost=100` leaves every word one handling short of green. This layout
// fixture swaps which handling is missing before the board starts: forced
// last-chance greens can then complete at least one word regardless of the
// deliberately nonsensical MockCompanion's guesses.
//
// Driven from a FUNCTION, because the screen has two shapes since PR #216: the
// P1 sentence band renders only when `boardCityIndex !== 0`, so a City 1 round
// ends in the reader and its finish state carries no band, while a City 2
// round carries the band and is where its rows are measured. Both are driven
// the same way, one after the other, and `?city=` is zero-based.
async function driveToWinAt(city) {
  // Do not pass an explicit seed here: seeded development rounds are outside
  // the City 1 primary-session lifecycle, while the terminal fixture below
  // deliberately exercises that durable lifecycle.
  const query = `?mock=1&howto=0&city=${city}&almost=100`
  await open(query)
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await open(query)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-srs-v1') ?? '{}')
    for (const stat of Object.values(raw.state?.stats ?? {})) {
      stat.greenByClue = 1
      stat.greenByGuess = 0
    }
    localStorage.setItem('cluecab-srs-v1', JSON.stringify(raw))
  })
  await open(query)
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    return sessions?.activeSlot === 'primary' && !!sessions.primary
  })
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  for (let i = 0; i < 6 && (await page.locator('.round-summary').count()) === 0; i++) {
    // A guidance panel (the last chance's, mid-loop) withholds the guessable
    // cards while it is up; take its action before looking for one.
    await dismissRoundGuidance(page)
    const guessable = page.locator('.word-card.card-guessable').first()
    if (await guessable.isVisible().catch(() => false)) {
      await guessable.click()
      const confirm = page.locator('.guess-confirm .btn-primary')
      if (await confirm.isVisible().catch(() => false)) await confirm.click()
    } else {
      // '#clue-word', not '.clue-input input': the dock holds a second input (the
      // lookup box), so that locator matches two and fails strict mode INSIDE the
      // .catch, silently.
      const clue = page.locator('#clue-word')
      if (await clue.isVisible().catch(() => false)) {
        await clue.fill(`huskeliste${i}`)
        await page.click('.clue-input .btn-primary')
      }
    }
    await page.waitForTimeout(900)
  }
  if ((await page.locator('.round-summary').count()) === 0) {
    // Force the last chance and name every remaining green: a WIN, whatever the
    // mock companion did with the six turns above. This is what makes the
    // section unconditional — it used to be wrapped in `if (summarised)`.
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      raw.state.game.phase = 'suddenDeath'
      raw.state.game.turnsLeft = 0
      window.__writeLayoutPrimaryFixture(raw)
    })
    await page.reload()
    await page.getByRole('button', { name: 'Continue board' }).click()
    await page.waitForSelector('.sudden-death-bar', { timeout: 15000 })
    const sdBoard = await page.evaluate(
      () => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game,
    )
    // Green on EITHER key counts in the last chance — there is no clue-giver.
    const toName = sdBoard.words
      .filter(
        (w) =>
          (sdBoard.playerKey[w.wordId] === 'green' || sdBoard.aiKey[w.wordId] === 'green') &&
          sdBoard.reveals[w.wordId]?.kind !== 'green',
      )
      .map((w) => w.da)
    for (const da of toName) {
      if ((await page.locator('.sudden-death-bar').count()) === 0) break
      await page.locator(`.word-card:has(.card-word:text-is("${da}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
    }
    // Solving the board enters Translation Time; it is not a direct win.
    // Fill the actual solved segments, persist the matching primary slot, and
    // take the production spin action before measuring the receipt result.
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase === 'translateChallenge')
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const game = raw.state.game
      const solved = game.words.filter((word) => game.reveals[word.wordId]?.kind === 'green')
      if (solved.length === 0) throw new Error('layout wheel fixture needs a solved word')
      game.wheel = {
        segments: solved.map((word) => word.wordId),
        translated: solved.map((word) => word.wordId),
        filled: solved.map((_, index) => index),
        attempts: 0,
        landed: null,
        result: null,
        spent: null,
      }
      window.__writeLayoutPrimaryFixture(raw)
    })
    await page.reload()
    await page.getByRole('button', { name: 'Continue board' }).click()
    await page.locator('.wheel-disc').click()
  }
  await page.waitForSelector('.round-summary', { timeout: 15000 })
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.boardCityIndex,
  )
}
await driveToWinAt(0)
// A round finishes into the finish screen: the reader of the owner's approved
// finish/inspect design of 2026-09-11, which since the owner's follow-up of
// the same evening is the ONE finish surface — a full-bleed <dialog> in the
// top layer carrying everything the fixed band summary used to (the outcome
// and its counts, the token line, the transcript link, the exits). There is
// no finish state underneath it and nothing to skip to, so everything this
// section measures is read INSIDE it. (Before that follow-up the bands lived
// under the reader and were reached through Skip review; before the skip
// existed this drive stalled here for thirty seconds clicking a .log-toggle
// the dialog was intercepting.)
const finish = page.locator('.city1-review-dialog[open]')
await finish.waitFor()
await finish.locator('.receipt-postcard-total').waitFor()
check('the round reaches its finish screen', (await finish.count()) === 1 && (await page.locator('.round-summary').count()) === 1)

// What is being measured, said out loud before it is measured. A no-scroll
// reading on a finish screen that happened to render no collected words, or
// no token line, would be measuring a shorter header than the one a player
// gets and passing for the wrong reason — which is the shape of the bug this
// whole section had.
const summaryParts = await finish.evaluate((el) => ({
  review: el.querySelectorAll('.sentence-review').length,
  rows: el.querySelectorAll('.sentence-row').length,
  retiredPlayer: el.querySelectorAll('.sentence-listen, .sentence-continue, .sentence-choices, .round-sentence').length,
  discovered: el.querySelector('.stat-discovered .stat-n')?.textContent?.trim() ?? '',
  collected: el.querySelector('.stat-collected .stat-n')?.textContent?.trim() ?? '',
  tier: el.querySelector('.receipt-tier-summary .receipt-tier')?.textContent?.trim() ?? '',
  rewardReasons: el.querySelector('.receipt-reward-list')?.textContent?.trim() ?? '',
  newRewardCount: el.querySelectorAll('.receipt-reward-new').length,
  openDisclosures: el.querySelectorAll('.city1-review-toggle[aria-expanded="true"]').length,
  earned: el.querySelector('.earned-section')?.textContent?.trim() ?? '',
  retired: document.querySelectorAll('.summary-scroll, .stat-city, .stat-total, .collected-section')
    .length,
  headline: el.querySelector('.city1-review-outcome')?.textContent?.trim() ?? '',
  confetti: el.querySelectorAll('.confetti').length,
  skip: [...el.querySelectorAll('button')].filter((b) => /skip review/i.test(b.textContent ?? '')).length,
}))
check(
  'the City 1 finish screen being measured carries NO sentence band — 0 rows, the reader is its review',
  summaryParts.review === 0 && summaryParts.rows === 0 && summaryParts.retiredPlayer === 0,
  `${summaryParts.review} review / ${summaryParts.rows} rows / ${summaryParts.retiredPlayer} retired controls`,
)
check(
  'the compact result carries reward reasons, attempt tier and concrete word counts',
  /^\d+$/.test(summaryParts.discovered) &&
    /^\d+$/.test(summaryParts.collected) &&
    ['Silver', 'Gold', 'Platinum'].includes(summaryParts.tier) &&
    summaryParts.newRewardCount > 0,
  `${summaryParts.discovered} new / ${summaryParts.collected} collected / ${summaryParts.tier} / ${summaryParts.rewardReasons}`,
)
check('finish review disclosures are collapsed on arrival', summaryParts.openDisclosures === 0, `${summaryParts.openDisclosures} open`)
check(
  'and the result never resurrects retired packing copy',
  !/wrap-up packing/i.test(await finish.innerText()),
  await finish.innerText(),
)
// The four things P1 retired. Named rather than implied, so a revert that put
// the scroller back would fail here rather than only in the measurement.
check(
  'and nothing P1 retired: no scroller, no city or journey tile, no collected list',
  summaryParts.retired === 0,
  `${summaryParts.retired} still there`,
)
// The receipt tier owns the winning headline; Casey and confetti remain, and
// there is no Skip review because the receipt is the finish screen.
const headlineByTier = { Silver: 'Good game!', Gold: 'Great game!', Platinum: 'Perfect game!' }
check(
  'the receipt tier selects its win headline under confetti, with nothing to skip',
  summaryParts.headline === headlineByTier[summaryParts.tier] && summaryParts.confetti === 1 && summaryParts.skip === 0,
  `headline «${summaryParts.headline}», ${summaryParts.confetti} confetti, ${summaryParts.skip} skip`,
)
check('Casey is on it, wearing the outcome', (await finish.locator('.outcome-banner .cluey-svg.mood-happy').count()) === 1)
check('and the celebration emoji is gone', !/🎉/.test(await finish.locator('.outcome-banner').innerText()))

// The measurement itself, at both phone sizes: the finish screen fills the
// phone, its three regions tile it with no gap, only its reader scrolls, and
// the DOCUMENT never does. city1-review-geometry.mjs asserts all four (and
// throws), and hands back the regions so the numbers are on the record.
const fits = async (what, width, height) => {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(300)
  // The owner's 2026-09-24 override allows initial reader scrolling on short
  // phones while retaining #264's header and the anchored footer. Prove that
  // any overflow is actually reachable instead of dropping the old assertion.
  const readerReach = await finish.locator('.city1-review-scroll').evaluate(el => {
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    el.scrollTo({ top: max, behavior: 'instant' })
    const reached = el.scrollTop
    el.scrollTo({ top: 0, behavior: 'instant' })
    return { max, reached, reset: el.scrollTop, clientHeight: el.clientHeight }
  })
  check(
    `collapsed review remains reachable by reader scroll: ${what} @${width}x${height}`,
    readerReach.clientHeight > 0 && readerReach.reached >= readerReach.max - 1 && readerReach.reset <= 1,
    JSON.stringify(readerReach),
  )
  let m
  try {
    m = await measureReviewGeometry(finish, `${what} @${width}x${height}`)
  } catch (e) {
    // The helper asserts; this drive reports. One failed check, not a crash.
    check(`finish screen geometry: ${what} @${width}x${height}`, false, e.message)
    return null
  }
  check(
    `no-scroll: ${what} @${width}x${height}`,
    m.documentHeight <= m.viewport.height + 1,
    `${m.documentHeight} vs ${m.viewport.height}`,
  )
  if (process.env.SHOT_DIR) {
    await finish.screenshot({ path: `${process.env.SHOT_DIR}/finish-header-${width}x${height}.png` })
  }
  return m
}
const regionsOf = (m) => m
  ? `header ${m.surface.context.height.toFixed(1)} / reader ${m.surface.reader.height.toFixed(1)} / footer ${m.surface.footer.height.toFixed(1)}`
  : 'not measured'
check('the finish screen opens with its log shut', (await page.locator('.turn-log').count()) === 0)
const tight = await fits('finish screen, log shut', 360, 640)
const tall = await fits('finish screen, log shut', 390, 844)
console.log(`finish screen: ${regionsOf(tight)} at 360x640, ${regionsOf(tall)} at 390x844`)

// The transcript is the one thing here with no bound on its height, so it opens
// as a PANEL over the finish screen rather than as a section in it. The
// document must sit still with the lid off, exactly as with the lid on.
await page.setViewportSize({ width: 360, height: 640 })
await page.waitForTimeout(250)
await finish.locator('.log-toggle').click()
await page.waitForTimeout(300)
check('and one tap opens the log', (await page.locator('.turn-log').count()) === 1)
const withLog = await page.evaluate(() => ({
  sh: document.scrollingElement.scrollHeight,
  ih: window.innerHeight,
}))
check(
  'no-scroll: finish screen, log open @360x640',
  withLog.sh <= withLog.ih + 1,
  `${withLog.sh} vs ${withLog.ih}`,
)
// Every guess in the log carries a .visually-hidden span. The sheet is fixed,
// so offsetParent is intentionally not the assertion here; the meaningful
// check is that the labels are actually inside the sheet DOM and cannot be
// returned to the reader's flow by a markup mutation.
const hiddenHome = await page.evaluate(() => {
  const span = document.querySelector('.turn-log .visually-hidden')
  return {
    present: !!span,
    insideSheet: !!span?.closest('.turn-log-sheet'),
  }
})
check(
  "the log's hidden labels live inside the sheet, not the reader",
  hiddenHome.present && hiddenHome.insideSheet,
  JSON.stringify(hiddenHome),
)
await page.locator('.log-close').click()
await page.waitForTimeout(250)
check('and the sheet has its own way back', (await page.locator('.turn-log').count()) === 0)
// Replay is the way out of the round, and on the anchored footer it is the
// last thing that would be pushed off.
const playAgain = await finish.locator('.city1-review-actions .btn-primary').boundingBox()
check(
  'and Play next game is still on the phone',
  playAgain.y + playAgain.height <= 640.5,
  `bottom ${(playAgain.y + playAgain.height).toFixed(0)} of 640`,
)
await page.setViewportSize(PHONE)
await page.waitForTimeout(200)

// ---- the City 2 sentence band is beyond the release scope --------------------
// The band is a cities-2-9 surface (PR #216: RoundSummary renders
// RoundSentences only for boardCityIndex !== 0), and since the follow-up of
// 2026-09-11 it fills the reader's place on the same finish screen — the
// taller of the two shapes, and the one whose reader actually scrolls. So it
// was measured here, on the second stop. The release scope
// (DEVELOPED_CITY_COUNT = 1) ends that: no one reaches the second stop, the
// ?city=1 jump refuses to seed past it, and the band has nothing to measure
// on. What the drive can still pin is the SCOPE side of the same seam: a
// City 2 deal is not dealt, no City 2 band renders, and nothing crashes.
await open('?mock=1&howto=0&seed=5&city=0&almost=100')
check(
  'the City 2 finish screen is beyond the release scope — no band surface renders',
  (await page.locator('.round-summary .sentence-review').count()) === 0,
)
check('and no page errors in the scoped City 2 state', errors.length === 0, errors.join(' | '))
// The finished City 1 round the sections above drove to is still stored; the
// next section deals its own board and must not inherit its durable result.
await page.evaluate(() => {
  localStorage.removeItem('cluecab-game-v1')
  localStorage.removeItem('cluecab-progression-sessions-v1')
  localStorage.removeItem('cluecab-settlement-v1')
})
await page.setViewportSize(PHONE)
await page.waitForTimeout(200)

// Casey's whole turn used to happen in silence: no live region existed
// anywhere in the game loop.
await open('?mock=1&howto=0&seed=7&city=0')
await page.locator('.home-play').click()
await page.waitForSelector('.board-grid')
const studyBtn = page.locator('.study-dock .btn-primary')
if (await studyBtn.isVisible().catch(() => false)) await studyBtn.click()
const regions = await page.locator('[aria-live], [role="status"], [role="alert"]').count()
check('the game loop has a live region', regions > 0, `${regions} found`)
// Whole-board translations are retired, and hear the board and How to play
// left the game header too (owner, 2026-09-26).
const aa = page.locator('.game-header .icon-btn[aria-label*="translation"]')
check(
  'the retired translations toggle is absent',
  (await aa.count()) === 0,
  `${await aa.count()} found`,
)
for (const [what, sel] of [
  ['hear-the-board', '.game-header .hear-board'],
  ['how-to-play', `.game-header .icon-btn[aria-label="How to play"]`],
]) {
  check(`${what} is not in the game header`, (await page.locator(sel).count()) === 0)
}

// The clue count. It arrived because a rule turned on it — the last chance
// opened after a given number of clues — and it outlives that rule: it is how
// far into the round you are, and how close sudden death is. A header that
// overflows or a count only sighted players get would each undo the point of
// showing it.
const header = await page.evaluate(() => {
  const h = document.querySelector('.game-header')
  const t = document.querySelector('.turn-tokens')
  return {
    overflows: h.scrollWidth > h.clientWidth + 1,
    count: t.querySelector('.token-count')?.textContent ?? '',
    label: t.getAttribute('aria-label') ?? '',
    pipsHidden: t.querySelector('.token-row')?.getAttribute('aria-hidden') === 'true',
  }
})
check('the header fits with the clue count in it', !header.overflows)
check('the count is on screen', /clues given/.test(header.count), header.count)
check('and in the accessible name, not only the pips', /clues given/.test(header.label), header.label)
check('and the pips do not read out twice', header.pipsHidden)
// It used to end with a sentence about whether the last chance was open. That
// rule is gone, and the label must not still describe it.
check('and says how many are left, not a rule that no longer exists', /left/.test(header.label) && !/last chance/i.test(header.label), header.label)

// The explicit mock seam needs no service, so no connection nudge belongs on Home.
await open('?mock=1&howto=0&city=0')
check('no setup nudge with the practice companion', (await page.locator('.setup-nudge').count()) === 0)

// Nor on a fresh profile: the default Worker is already configured and keeps
// credentials/model selection on the server. This is a real first run, no
// mock and nothing stored.
await page.evaluate(() => localStorage.clear())
await open('?howto=0&city=0')
check(
  'and none at all on a fresh profile',
  (await page.locator('.setup-nudge').count()) === 0,
  (await page.locator('.cluey-bubble').first().innerText().catch(() => '(silent day — no bubble)')),
)

// A Base URL of your own is not the default: it is another compatible Casey
// Worker, and a player must hear when it has never answered.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}')
  raw.state = {
    ...raw.state,
    useMock: false,
    baseUrl: 'http://127.0.0.1:9/v1',
    klausVerifiedAt: null,
  }
  localStorage.setItem('cluecab-settings-v1', JSON.stringify(raw))
})
await open('?howto=0&city=0')
check(
  'a worker of your own that has never answered does prompt',
  (await page.locator('.cluey-bubble.setup-nudge').count()) === 1,
)
await page.evaluate(() => localStorage.clear())

// The prompt that survives is the one that means something — a custom service
// that has never answered — and it speaks through Casey rather than a banner.
// Tapping it lands in Settings, where the Base URL field holds the address and
// Test connection is the next step. That is the whole of the help: the panel
// that used to sit above the field (ConnectCluey, retired 2026-09-12) said
// nothing the switch, the field's own note and the button do not. Credentials
// and deployment instructions stay outside the package (SEC3), so the section
// carries no link anywhere.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}')
  raw.state = {
    ...raw.state,
    useMock: false,
    baseUrl: 'http://127.0.0.1:9/v1',
    klausVerifiedAt: null,
  }
  localStorage.setItem('cluecab-settings-v1', JSON.stringify(raw))
})
await open('?howto=0&city=0')
check(
  'the prompt that survives comes out of Casey mouth',
  (await page.locator('.cluey-bubble.setup-nudge').count()) === 1,
)
await page.locator('.setup-nudge').first().click()
await page.waitForSelector('.settings-screen')
const baseUrlField = page.locator('.settings-section input[type="url"]')
check(
  'and lands on the Base URL field holding that address',
  (await baseUrlField.count()) === 1 && (await baseUrlField.inputValue()) === 'http://127.0.0.1:9/v1',
)
check(
  'with Test connection one tap below it',
  (await page.getByRole('button', { name: 'Test connection' }).count()) === 1,
)
const links = await page.locator('.settings-section a').count()
check('and keeps deployment instructions outside the package', links === 0, `${links} links`)
await page.evaluate(() => localStorage.clear())

// ---- The no-scroll principle, measured. -----------------------------------
// Every core screen fits the phone: document.scrollingElement.scrollHeight
// must not exceed the viewport, on the smallest phone we serve, in every
// game phase a player can sit in. The shell deliberately never clips
// (overflow stays visible), so any screen that outgrows the phone becomes
// document scroll and fails here — inflate any dock to prove the check bites.
const noScroll = async (name) => {
  const r = await page.evaluate(() => ({
    sh: document.scrollingElement.scrollHeight,
    ih: window.innerHeight,
  }))
  check(`no-scroll: ${name}`, r.sh <= r.ih + 1, `${r.sh} vs ${r.ih}`)
}

for (const vp of [
  { width: 360, height: 640, name: '360x640' },
  { width: 375, height: 667, name: '375x667' },
  { width: 390, height: 844, name: '390x844' },
]) {
  await page.setViewportSize({ width: vp.width, height: vp.height })

  await open('?mock=1&howto=0&city=0&collected=30')
  await noScroll(`home @${vp.name}`)

  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  await noScroll(`suitcase @${vp.name}`)

  // C1-12 replaced the stretching packing compartment with Casey's finite
  // board collection. Its focused successor measures all card targets; here
  // we pin that the current collection mounts and never widens the document.
  const caseBox = await page.evaluate(() => {
    const c = document.querySelector('.casey-board-collection')
    return {
      h: c ? Math.round(c.getBoundingClientRect().height) : 0,
      ih: window.innerHeight,
      dw: document.scrollingElement.scrollWidth,
      iw: window.innerWidth,
    }
  })
  check(
    `Casey’s board collection is present @${vp.name}`,
    caseBox.h > 0,
    `${caseBox.h} of ${caseBox.ih}`,
  )
  check(
    `no sideways scroll on the suitcase @${vp.name}`,
    caseBox.dw <= caseBox.iw + 1,
    `${caseBox.dw} vs ${caseBox.iw}`,
  )

  await open('?mock=1&howto=0')
  await page.locator('.map-button').click()
  await page.waitForSelector('.denmark-map')
  await noScroll(`map @${vp.name}`)

  // City 1 has no released destination, so Map must not offer a fake boarding
  // action. TrainRide remains a Guide-owned future surface, not a public map
  // destination; C1-13's navigation drive exercises that policy in depth.
  check(
    `Map exposes no unusable public boarding action @${vp.name}`,
    (await page.locator('.map-screen .btn-primary.btn-big, .map-screen .train-board').count()) === 0,
  )

  await open('?mock=1&howto=0')
  await page.locator('.icon-btn[aria-label="Settings"]').click()
  await page.waitForSelector('.settings-screen')
  await noScroll(`settings @${vp.name}`)

  // The ticket → staged Home → first-game path, forced by its dev switch
  // so this sweep does not depend on the profile looking fresh. Clear learned
  // word state first as well: an authored City 1 board can legitimately use a
  // tutorial word earlier in this same long drive, but that must not turn the
  // later one-direction tutorial check into a test of cross-round collection.
  await page.evaluate(() => localStorage.removeItem('cluecab-srs-v1'))
  await open('?onboard=1&mock=1')
  await page.waitForSelector('.onboard-screen[data-act="ticket"]')
  await noScroll(`onboarding ticket @${vp.name}`)
  await page.locator('.onboard-ticket').filter({ hasText: 'Denmark' }).click()
  await page.waitForSelector('.home-intro-welcome')
  await noScroll(`onboarding Home welcome @${vp.name}`)
  check(`onboarding Casey-led Home has no floating Skip @${vp.name}`, (await page.locator('.home-intro-welcome .onboard-skip').count()) === 0)
  for (const stage of ['map', 'guide', 'play']) {
    await page.locator('.home-intro-bubble').click()
    await page.waitForSelector(`.home-intro-${stage}`)
    await noScroll(`onboarding Home ${stage} @${vp.name}`)
  }
  await page.locator('.home-intro-actions .home-play').click()
  await page.waitForSelector('.tutorial-game .board-grid')
  check(`the practice board is a 3×3 neutral grid @${vp.name}`, (await page.locator('.tutorial-game .word-card').count()) === 9 && (await page.locator('.tutorial-game .mykey-green').count()) === 0)
  await noScroll(`practice neutral board @${vp.name}`)
  await page.waitForSelector('.tutorial-game .guess-bar')
  await noScroll(`practice Casey clue @${vp.name}`)
  for (const word of ['vand', 'kaffe', 'mælk']) {
    await page.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
    await page.locator('.guess-confirm .btn-primary').click()
    await page.waitForTimeout(120)
  }
  await page.waitForSelector('.tutorial-game .clue-input')
  check(`player greens reveal after Casey's first turn @${vp.name}`, (await page.locator('.tutorial-game .mykey-green').count()) >= 3)
  // They used to. #130 turned it round — "all seven tokens are visible at the
  // top from the start; after the learner gives their first clue, Casey points
  // out that both sides spend from that one pool" (README) — and updated
  // onboarding-drive to match, but not the three copies of the old claim here.
  // So this asks for what ships: the row, and the seven.
  const practiceTokens = page.locator('.tutorial-game .turn-tokens')
  const practiceTokenLabel = (await practiceTokens.getAttribute('aria-label')) ?? 'no token row'
  check(
    `the practice round shows its seven shared tokens @${vp.name}`,
    (await practiceTokens.count()) === 1 && /of 7 clues given/.test(practiceTokenLabel),
    practiceTokenLabel,
  )
  await noScroll(`practice player-key reveal @${vp.name}`)

  // Resume directly at the return prompt so each viewport need not finish the
  // whole game just to measure the final act.
  await page.evaluate(() => localStorage.setItem('cluecab-onboard-v5', 'home-return'))
  await open('?mock=1')
  await page.waitForSelector('.home-intro-return')
  await noScroll(`onboarding Home return @${vp.name}`)
  check(`real-round Home keeps its disabled Tap Casey gate @${vp.name}`, await page.locator('.home-intro-return .home-play').isDisabled() && (await page.locator('.home-intro-return .home-play').innerText()) === 'Tap Casey')

  // The game, in the phase measured tallest (the opening clue dock), on the
  // widest board.
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const studyBtn2 = page.locator('.study-dock .btn-primary')
  if (await studyBtn2.isVisible().catch(() => false)) await studyBtn2.click()
  await page.waitForTimeout(300)
  await noScroll(`game clue dock 4x5 @${vp.name}`)

  // Wrap-up packing is retired. Its collection/result successors have their
  // own focused drives; this broad layout pass pins the important absence on a
  // live ordinary board instead of trying to enter an unreachable mode.
  check(
    `the retired packing dock cannot appear during ordinary play @${vp.name}`,
    (await page.locator('.packing-dock').count()) === 0,
  )
}
await page.setViewportSize(PHONE)

// ---- The keyboard, as the native shell actually delivers it. ---------------
// Keyboard.resize 'body' makes the plugin shrink document.body to end where
// the keyboard begins — a bridge eval writing el.style.height, which a browser
// can perform VERBATIM. This block used to shrink the viewport instead, which
// is the 'native' mode's mechanism, two config eras ago: same assertions, but
// they were exercising a code path the app no longer ships. The write below is
// character-for-character what Keyboard.m's resizeElement does.
{
  const KB = 336
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await open('?mock=1&howto=0&seed=7&first=player')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.waitForTimeout(250)

  const gridBefore = await page.locator('.board-grid').boundingBox()
  const cardBefore = await page.locator('.word-card').first().boundingBox()

  // What the native listener does on keyboardWillShow, then the plugin's
  // delayed body shrink.
  await page.evaluate(() => {
    const grid = document.querySelector('.board-grid')
    document.documentElement.style.setProperty(
      '--board-h',
      `${Math.round(grid.getBoundingClientRect().height)}px`,
    )
    document.documentElement.classList.add('kb-up')
    const dock = document.querySelector('.clue-input')
    const surface = document.querySelector('.kb-surface')
    dock?.classList.add('kb-lifted', 'kb-riding')
    surface?.classList.add('kb-riding')
    // The white keyboard surface is only present for the transformed leg.
    // This explicit stand-in is the shape startRide gives it before the
    // plugin's intentionally delayed resize catches up.
    if (dock instanceof HTMLElement && surface instanceof HTMLElement) {
      surface.style.top = `${Math.round(dock.getBoundingClientRect().top)}px`
      dock.style.transform = 'translateY(-336px)'
      surface.style.transform = 'translateY(-336px)'
    }
  })
  // The dock is deliberately transparent in normal play, so during the
  // pre-resize ride it must bring its own white sheet. Otherwise the inputs
  // travel while the page background and home-indicator gutter wait for the
  // plugin's delayed body resize. It is a fixed sibling rather than a wrapper,
  // so it cannot add a layout row or change the board's measured rectangle.
  // The geometry is the actual contract: its top must travel with the dock,
  // and its bottom must stay below the viewport. Removing the surface's
  // transform makes the first condition fail; shortening it makes the second
  // fail.
  const liftedSurface = await page.evaluate(() => {
    const dock = document.querySelector('.clue-input.kb-lifted.kb-riding')
    const surface = document.querySelector('.kb-surface.kb-riding')
    if (!dock || !surface) return null
    const style = getComputedStyle(surface)
    const dockRect = dock.getBoundingClientRect()
    const surfaceRect = surface.getBoundingClientRect()
    return {
      position: style.position,
      background: style.backgroundColor,
      width: parseFloat(style.width),
      dockTop: dockRect.top,
      surfaceTop: surfaceRect.top,
      surfaceBottom: surfaceRect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })
  check(
    'and the lifted composer carries its white keyboard surface and bottom gutter',
    liftedSurface !== null &&
      liftedSurface.position === 'fixed' &&
      liftedSurface.background === 'rgb(255, 255, 255)' &&
      liftedSurface.width >= liftedSurface.viewportWidth - 1 &&
      Math.abs(liftedSurface.surfaceTop - liftedSurface.dockTop) <= 1 &&
      liftedSurface.surfaceBottom >= liftedSurface.viewportHeight - 1,
    liftedSurface
      ? `surface ${Math.round(liftedSurface.surfaceTop)}–${Math.round(liftedSurface.surfaceBottom)}, ` +
        `dock top ${Math.round(liftedSurface.dockTop)}, viewport ${liftedSurface.viewportWidth}×${liftedSurface.viewportHeight}`
      : 'no lifted dock',
  )
  await page.evaluate((kb) => {
    document.body.style.height = `${window.innerHeight - kb}px`
    // Same handoff the MutationObserver performs in the native listener: the
    // body has shrunk, so ordinary layout owns the dock and the ride-only
    // fixed surface can leave before the next paint.
    const dock = document.querySelector('.clue-input')
    const surface = document.querySelector('.kb-surface')
    if (dock) {
      dock.style.transform = ''
      dock.classList.remove('kb-riding')
    }
    if (surface) {
      surface.style.transform = ''
      surface.style.top = ''
      surface.classList.remove('kb-riding')
    }
  }, KB)
  await page.waitForTimeout(300)

  const gridDuring = await page.locator('.board-grid').boundingBox()
  const cardDuring = await page.locator('.word-card').first().boundingBox()
  const same = (a, b) =>
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  check(
    'the board keeps its exact size when the keyboard takes the bottom third',
    same(gridBefore, gridDuring) && same(cardBefore, cardDuring),
    `grid ${Math.round(gridDuring.height)} vs ${Math.round(gridBefore.height)}, card ${Math.round(cardDuring.height)} vs ${Math.round(cardBefore.height)}`,
  )

  // The composer is the last thing in the layout, so it ends at the bottom of
  // what is left — which is the keyboard's top edge, with no arithmetic.
  const dock = await page.locator('.clue-input').boundingBox()
  const bottom = dock.y + dock.height
  check(
    'and the composer sits against the keyboard',
    bottom <= PHONE.height - KB + 1 && bottom >= PHONE.height - KB - 40,
    `composer ends at ${Math.round(bottom)}, screen ends at ${PHONE.height - KB}`,
  )
  // The scrim moved from the app shell into the game screen (Settings' inputs
  // live in no dock, and app-wide it ate their first tap) — this is the other
  // half of that pair: in the game, where the board needs protecting, it must
  // still be there and covering.
  const scrim = await page.evaluate(() => {
    const s = document.querySelector('.game-screen .kb-scrim')
    return s ? getComputedStyle(s).display : 'missing'
  })
  check('and the dismissal scrim still covers the game', scrim === 'block', scrim)
  await noScroll('game with the keyboard up')

  // The hide path: the plugin writes height null, which removes the inline
  // style — the same restore the willHide listener's class removals pair with.
  await page.evaluate(() => {
    document.body.style.height = ''
    document.documentElement.classList.remove('kb-up')
    document.documentElement.style.removeProperty('--board-h')
    const dock = document.querySelector('.clue-input')
    const surface = document.querySelector('.kb-surface')
    dock?.classList.remove('kb-lifted', 'kb-riding')
    if (dock) dock.style.transform = ''
    surface?.classList.remove('kb-riding')
    if (surface) {
      surface.style.transform = ''
      surface.style.top = ''
    }
  })
  await page.waitForTimeout(250)
  const gridAfter = await page.locator('.board-grid').boundingBox()
  check('and comes back untouched', same(gridBefore, gridAfter), `${Math.round(gridAfter.height)}`)
}

// ---- the ride (ON by default; cluecab-kbstill opts out) -------------------
//
// The ride makes the composer travel WITH the keyboard, and it ships on. It
// is allowed to change when the dock moves and nothing else — least of all
// where it stops, which cost three builds to get right.
//
// Three legs through the app's own keyboard path (cluecab-kbsim), not a
// hand-written imitation: the DEFAULT, which must ride with no flag set —
// this is the assertion that fails on the code that shipped the ride as an
// opt-in; the OPT-OUT (cluecab-kbstill), which must never transform the dock;
// and REDUCED MOTION, which must behave exactly like the opt-out — the
// accessibility promise, previously untested. What a browser cannot show is
// timing against a real keyboard; what it can show is that the ride happens,
// on the duration it was given, and that every leg rests at the same pixel.
{
  const KB = 336
  // Watch rather than sample. Reading the transform "while the ride is on" is a
  // race the drive loses on a busy machine — it did, and reported a working
  // ride as absent because it looked 300ms too late. This records every inline
  // style a dock is ever given, and where the document had got to at that
  // point, so the claim is checked against what happened rather than against
  // whatever a lucky poll caught. Registered once: addInitScript accumulates,
  // and two copies would record everything twice.
  await page.addInitScript(() => {
    window.__ride = []
    // Whether the document had been shrunk yet, carried along by hand rather
    // than read from the DOM inside the callback. Mutation records arrive in a
    // batch, after the fact, so reading document.body there answers "at the end
    // of the batch" and would call a transform written BEFORE the shrink one
    // written after it. The records themselves are in order, so walking them
    // keeps the sequence honest.
    let shrunk = false
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target
        if (!(el instanceof HTMLElement)) continue
        window.__ride.push({
          // Every style write, not only the docks', so that "no dock was ever
          // transformed" is visibly a count of something rather than a count
          // of nothing.
          what: el === document.body ? 'body' : el.classList.contains('dock') ? 'dock' : 'other',
          transform: el.style.transform,
          // The transition too: it carries the duration the ride was given,
          // which is the one CI-visible trace of the payload plumbing.
          transition: el.style.transition,
          shrunk,
        })
        if (el === document.body) shrunk = document.body.style.height !== ''
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['style'] })
  })

  // The pretend duration for the default leg — an ODD number no constant in
  // the app shares, so finding "421ms" in a transition can only mean the
  // value travelled from the kbsim payload through startRide.
  const DUR = 421
  const arm = async (mode) => {
    // A round to be in the middle of, saved, and then resumed by the reload —
    // cluecab-kbsim and the flag are both read once, at mount.
    await open('?mock=1&howto=0&seed=7&first=player')
    await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
    await open('?mock=1&howto=0&seed=7&first=player')
    await page.locator('.home-play').click()
    await page.waitForSelector('.board-grid')
    const study = page.locator('.study-dock .btn-primary')
    if (await study.isVisible().catch(() => false)) await study.click()
    await page.waitForTimeout(250)

    await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : null })
    await page.evaluate(
      ([kb, dur, still]) => {
        localStorage.setItem('cluecab-kbsim', `${kb}/${dur}`)
        if (still) localStorage.setItem('cluecab-kbstill', '1')
        else localStorage.removeItem('cluecab-kbstill')
      },
      [KB, DUR, mode === 'still'],
    )
    await open('?mock=1&howto=0')
    // A condition, not a duration: the keyboard is up, the document has
    // shrunk, and nothing is holding the dock but the layout.
    await page.waitForFunction(
      () =>
        document.documentElement.classList.contains('kb-up') &&
        document.body.style.height !== '' &&
        !document.querySelector('.dock.kb-lifted')?.style.transform,
      null,
      { timeout: 15000 },
    )
    const during = await page.evaluate(() => window.__ride ?? [])
    const rest = await page.evaluate(() => {
      const d = document.querySelector('.dock.kb-lifted')
      const b = d.getBoundingClientRect()
      return {
        top: Math.round(b.top),
        bottom: Math.round(b.bottom),
        transform: d.style.transform,
        transition: d.style.transition,
        body: document.body.style.height,
        board: Math.round(document.querySelector('.board-grid').getBoundingClientRect().height),
      }
    })
    await page.evaluate(() => {
      localStorage.removeItem('cluecab-kbsim')
      localStorage.removeItem('cluecab-kbstill')
    })
    await page.emulateMedia({ reducedMotion: null })
    return { during, rest }
  }

  const still = await arm('still')
  const dflt = await arm('default')
  const reduced = await arm('reduced')

  const moved = (log) => log.filter((e) => e.what === 'dock' && e.transform !== '')

  // The opt-out restores exactly the old behaviour: the dock is never given a
  // transform, and the document shrinks the moment the keyboard is declared.
  check(
    'with cluecab-kbstill the dock is never transformed',
    moved(still.during).length === 0 && still.rest.transform === '' && still.rest.transition === '',
    `${still.during.length} style writes, ${moved(still.during).length} of them a transform`,
  )
  // The accessibility promise, previously untested: reduced motion means the
  // dock arrives with the layout, never on its own.
  check(
    'and under reduced motion the dock is never transformed',
    moved(reduced.during).length === 0 && reduced.rest.transform === '',
    `${reduced.during.length} style writes, ${moved(reduced.during).length} of them a transform`,
  )

  // The default flip's own assertion — this is the one that fails on the code
  // that shipped the ride as an opt-in: no flag is set, and there really is a
  // ride, carrying the dock while the document is still at its full height,
  // which is the lateness being compensated for, caught in the act.
  const ahead = moved(dflt.during).filter((e) => /^translateY\(-\d/.test(e.transform) && !e.shrunk)
  check(
    'by default the dock rides ahead of the document',
    ahead.length > 0,
    ahead.length ? ahead[0].transform : `nothing rode: ${JSON.stringify(dflt.during)}`,
  )
  // The payload plumbing, witnessed: the ride animates over the duration the
  // keyboard event carried, not over a constant. 421 exists nowhere in the
  // app, so its appearance in a transition can only be the plumb working.
  check(
    'and carries the duration the keyboard reported',
    ahead.some((e) => e.transition.includes(`${DUR}ms`)),
    ahead.map((e) => e.transition).join(' | ') || '(no rides recorded)',
  )
  // And hands back: what holds the dock up afterwards is the layout, not us.
  check(
    'and hands the dock back to the layout when it lands',
    dflt.rest.transform === '' && dflt.rest.transition === '' && dflt.rest.body === still.rest.body,
    `transform ${JSON.stringify(dflt.rest.transform)}, body ${dflt.rest.body} vs ${still.rest.body}`,
  )

  // The measurement that matters: same resting place, to the pixel, ridden or
  // not.
  check(
    'and comes to rest in exactly the same place either way',
    dflt.rest.top === still.rest.top && dflt.rest.bottom === still.rest.bottom,
    `default ${dflt.rest.top}–${dflt.rest.bottom}, still ${still.rest.top}–${still.rest.bottom}`,
  )
  check(
    'and the board is the same height either way',
    dflt.rest.board === still.rest.board,
    `${dflt.rest.board} vs ${still.rest.board}`,
  )
}

// ---- A grid row may never be shorter than the card's 44px floor. -----------
//
// N1 put a sixth row on the board, and this is the check that says the row fits
// rather than the card being squeezed out of it.
//
// The mechanism is worth stating because the failure is INVISIBLE. `.word-card`
// declares `min-height: 44px` (one 16px line inside its padding box with a 3px
// key border on both edges still clears) and a grid row shorter than that does
// not shrink the card: the card refuses, overflows its track, and a flex column
// overflows by PAINTING OVER what is below it rather than lengthening the
// document. So `scrollHeight <= innerHeight` stays perfectly honest while cards
// are drawn through the dock. Every other check in this file would pass.
//
// Measured on the shipped board, seed 7, in the opening clue phase:
//
//   360x640   6 rows of 46.42px, cards 46.42-47.34   (2.42 over the floor)
//   390x844   6 rows of 80.42px, cards 80.42-81.43
//
// Read off `.word-card-wrap`, which IS the grid item. Reading the card would
// measure the thing that refuses to shrink and report 44 whatever the row did.
{
  const FLOOR = 44
  for (const VP of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(VP)
    await open('?mock=1&howto=0&seed=7&city=0&first=player')
    await page.locator('.home-play').click()
    await page.waitForSelector('.board-grid')
    const studyNow = page.locator('.study-dock .btn-primary')
    if (await studyNow.isVisible().catch(() => false)) await studyNow.click()
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const wraps = [...document.querySelectorAll('.word-card-wrap')]
      const cards = [...document.querySelectorAll('.word-card')]
      const surfaces = [...document.querySelectorAll('.word-card-surface')]
      const grid = document.querySelector('.board-grid')
      const rows = new Set(wraps.map((w) => Math.round(w.getBoundingClientRect().y)))
      const h = (e) => +e.getBoundingClientRect().height.toFixed(2)
      return {
        rows: rows.size,
        cards: cards.length,
        minRow: Math.min(...wraps.map(h)),
        maxRow: Math.max(...wraps.map(h)),
        minCard: Math.min(...cards.map(h)),
        maxSurfaceOverflow: Math.max(
          ...surfaces.map((surface, i) => {
            const sr = surface.getBoundingClientRect()
            const wr = wraps[i].getBoundingClientRect()
            return +(Math.max(0, wr.top - sr.top, sr.bottom - wr.bottom)).toFixed(2)
          }),
        ),
        // The bottom of the lowest card against the top of the dock: a row that
        // overflowed its track shows up here as a negative number, and nothing
        // else in this file would notice.
        clearance: +(
          document.querySelector('.game-screen .dock').getBoundingClientRect().y -
          Math.max(...cards.map((c) => c.getBoundingClientRect().bottom))
        ).toFixed(2),
        board: h(grid),
      }
    })
    const at = `${VP.width}x${VP.height}`
    check(
      `the board is six rows of three at ${at}`,
      m.rows === 6 && m.cards === 18,
      JSON.stringify(m),
    )
    check(
      `no grid row is under the card 44px floor at ${at}`,
      m.minRow >= FLOOR,
      `shortest row ${m.minRow} (floor ${FLOOR}, board ${m.board})`,
    )
    check(
      `and no card is overflowing its row or the board at ${at}`,
      m.minCard >= FLOOR && m.maxSurfaceOverflow <= 0.5 && m.clearance >= 0,
      `shortest card ${m.minCard}, row overflow ${m.maxSurfaceOverflow}, clearance ${m.clearance}`,
    )
  }
}

// ---- Painted card edges keep one visible, even gap. ------------------------
//
// Grid tracks can be perfectly separated while transformed card paint reaches
// outside those tracks. That was the source of the short-phone board looking
// overlapped and uneven even with `gap: 8px` in computed CSS. Measure the
// painted card rectangles themselves at the tight phone and normal baseline.
{
  for (const VP of [
    { width: 360, height: 568 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(VP)
    await open('?mock=1&howto=0&seed=7&city=0&first=player')
    await page.locator('.home-play').click()
    await page.waitForSelector('.board-grid')
    const studyNow = page.locator('.study-dock .btn-primary')
    if (await studyNow.isVisible().catch(() => false)) await studyNow.click()
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.word-card')].map((card) => {
        const r = card.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      })
      const horizontal = []
      const vertical = []
      const intersections = []
      for (let row = 0; row < 6; row += 1) {
        for (let column = 0; column < 2; column += 1) {
          const left = cards[row * 3 + column]
          const right = cards[row * 3 + column + 1]
          horizontal.push(right.left - left.right)
        }
      }
      for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const above = cards[row * 3 + column]
          const below = cards[(row + 1) * 3 + column]
          vertical.push(below.top - above.bottom)
        }
      }
      for (let a = 0; a < cards.length; a += 1) {
        for (let b = a + 1; b < cards.length; b += 1) {
          const x = Math.min(cards[a].right, cards[b].right) - Math.max(cards[a].left, cards[b].left)
          const y = Math.min(cards[a].bottom, cards[b].bottom) - Math.max(cards[a].top, cards[b].top)
          if (x > 0 && y > 0) intersections.push([a, b])
        }
      }
      const gaps = [...horizontal, ...vertical]
      return {
        intersections,
        minGap: +Math.min(...gaps).toFixed(2),
        maxGap: +Math.max(...gaps).toFixed(2),
      }
    })
    const at = `${VP.width}x${VP.height}`
    check(
      `painted board cards never intersect at ${at}`,
      m.intersections.length === 0,
      JSON.stringify(m.intersections),
    )
    check(
      `painted board-card gaps are even at ${at}`,
      m.minGap >= 7.9 && m.maxGap - m.minGap <= 0.1,
      `${m.minGap}px to ${m.maxGap}px`,
    )
  }
}

// ---- The board never moves. ------------------------------------------------
//
// "When guessing it's a giant text block that adjusts the sizing of the grid.
// The grid should stay locked. and the text can be cut."
//
// The board is a flex:1 area sharing the game screen's column with the dock,
// so every line the dock gained came off the grid, and the grid resized every
// card with it. Measured before the reserve, over one seeded round at 360x640:
// 200px of board height and 18px of board position, phase to phase.
//
// This is the assertion that keeps it fixed, and it is the point of the whole
// change — the reserve without it regresses the first time a dock grows a line.
//
// Sampled on every animation frame rather than polled between phases, because
// the drift is a WITHIN-phase event: a lookup answer arriving, a card being
// selected, Casey's guess line changing every 1100ms. A poll placed at the
// phase boundaries would have caught none of the seven states below, and would
// have passed just as happily before the fix.
{
  const VP = { width: 360, height: 640 }
  await page.setViewportSize(VP)
  // The board — there is one since N1, 3x6 with eight clue tokens. This block
  // used to ask for `grid=standard` by name, "the widest board, so the tightest
  // layout", and for its eight tokens: long enough for the round to reach both
  // the last chance and the fullest the guess dock ever gets (a card selected,
  // the stop button showing and a lookup answer up, all at once), which the
  // five-token beginner board finished before it could produce. The one board
  // has the eight tokens, so the round still gets there; it is three across
  // rather than four, so the tightest CARD is no longer the tightest thing on
  // screen — the sixth ROW is, which is what the grid-row floor check below
  // measures.
  const Q = '?mock=1&howto=0&seed=7&city=0&first=player'
  await open(Q)
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    // The study phase ships OFF (settingsStore's default is 'never'), so this
    // comparison never saw its dock — and the study dock is one of the docks
    // K2 sized. Asked for by name rather than left out of "every phase of a
    // round". `version: 9` is settingsStore's; persist merges the rest.
    localStorage.setItem(
      'cluecab-settings-v1',
      JSON.stringify({ state: { studyPhase: 'always' }, version: 9 }),
    )
  })
  await open(Q)
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')

  // Installed with evaluate rather than addInitScript on purpose: the round is
  // played without a navigation, and addInitScript accumulates across the ones
  // the ride section above already registered.
  await page.evaluate(() => {
    window.__board = {}
    // U3 paces Casey's turn in two beats — the reasoning, then the guess it
    // explains — inside the ONE phase the sampler above knows as "Casey is
    // guessing". Both beats are the same two regions and must therefore be the
    // same rectangle, but a phase-keyed reading cannot say which of them broke
    // if they are not, so they are also accumulated under their own names off
    // the panel's `data-beat`.
    window.__caseyBeats = {}
    const tick = () => {
      const grid = document.querySelector('.board-grid')
      const cap = document.querySelector('.phase-caption')
      // __where lets a state that is not a phase — a lookup answer on screen —
      // be recorded under its own name instead of smearing into the phase it
      // happens inside.
      const key = window.__where ?? (cap?.firstChild?.textContent ?? '').trim()
      if (grid && key) {
        const b = grid.getBoundingClientRect()
        const at = (window.__board[key] ??= { n: 0 })
        for (const f of ['x', 'y', 'width', 'height']) {
          const v = Math.round(b[f] * 100) / 100
          at[`${f}lo`] = at.n ? Math.min(at[`${f}lo`], v) : v
          at[`${f}hi`] = at.n ? Math.max(at[`${f}hi`], v) : v
        }
        // The PANEL's whole rectangle, which is the mechanism: the board is
        // what is left over once the dock has taken --dock-h, so a dock that
        // is the same rectangle in every phase IS a board that does not move.
        // Recorded beside the effect so a failure says which of the two broke.
        //
        // The panel, and no longer the `.dock-slot` that used to hold it (K2).
        // Between #90 and K1 the docks were different heights, so the reserve
        // was held by an invisible slot and each panel hugged its own content
        // inside it — measuring the panel then would have reported a drift
        // that was the fix working. Every dock is --dock-h now, the slot is
        // gone, and the panel's rect is the stronger of the two claims: x and
        // width as well as height, so a dock that changed its padding or its
        // paint would be caught too.
        const dock = document.querySelector('.game-screen .dock')
        if (dock) {
          const d = dock.getBoundingClientRect()
          for (const f of ['x', 'y', 'width', 'height']) {
            const v = Math.round(d[f] * 100) / 100
            at[`dock${f}lo`] = at.dockn ? Math.min(at[`dock${f}lo`], v) : v
            at[`dock${f}hi`] = at.dockn ? Math.max(at[`dock${f}hi`], v) : v
          }
          at.dockn = (at.dockn ?? 0) + 1
        }
        at.n++
      }
      const casey = document.querySelector('.game-screen .dock.ai-panel[data-beat]')
      if (casey) {
        const r = casey.getBoundingClientRect()
        const at = (window.__caseyBeats[casey.dataset.beat] ??= { n: 0 })
        for (const f of ['x', 'y', 'width', 'height']) {
          const v = Math.round(r[f] * 100) / 100
          at[`${f}lo`] = at.n ? Math.min(at[`${f}lo`], v) : v
          at[`${f}hi`] = at.n ? Math.max(at[`${f}hi`], v) : v
        }
        at.n++
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const where = (w) => page.evaluate((w) => (window.__where = w), w)

  const studied = await page.locator('.study-dock').count() === 0
  await page.waitForTimeout(300)
  check('the retired study phase is absent', studied)

  // "nice" has seven Danish glosses in the shipped set, cut to four by the UI —
  // the longest answer the offline half of the dictionary can produce, and the
  // single worst offender measured (188px of board on the clue dock).
  let lookedUp = 0
  // `while` runs with the answers ON SCREEN. The first version of this took its
  // reading after clearing the field, which made the one check that was meant
  // to catch an overflowing dock a check on an empty one — it passed on a
  // reserve that really did push the document to 657px on a 640px screen.
  const longLookup = async (label, while_) => {
    const field = page.locator('.game-screen .translate-input').first()
    if (!(await field.isVisible().catch(() => false))) return
    await where(label)
    await field.fill('nice')
    await page.waitForTimeout(900)
    // One answer, not four rows (K1). "nice" still has seven Danish glosses
    // behind it — that is what makes it the worst case — but they are in the
    // sheet the line opens rather than in a scroller inside the dock.
    const hits = await page.locator('.dict-hit').count()
    if (hits >= 1) lookedUp++
    await page.waitForTimeout(200)
    // Measure the guess bar with the keyboard DISMISSED, the way the phone
    // screenshots that found both of this dock's regressions were taken. It is
    // also the state the row splits differently in: the field gives its share
    // to the answer once the typing is done. Clue-dock lookups keep their
    // existing focused measurement.
    const inGuessBar = await field.evaluate((el) => Boolean(el.closest('.guess-bar')))
    if (inGuessBar && hits >= 1) {
      await field.evaluate((el) => el.blur())
      await page.waitForTimeout(100)
    }
    if (while_) await while_()
    await field.fill('')
    await page.waitForTimeout(300)
    await where(null)
    return hits
  }

  let clueLookupHits = 0
  let guessLookupHits = 0
  let worst = null
  // Set false the moment the stop button and the confirm row are seen on
  // screen together; the check that reads it is beside the reserve's own.
  let sharedRow = true
  // The guess bar's dictionary answer: beside the field, on the dock's last
  // row, with the action row above it still on screen. It was stacked UNDER
  // the field for two PRs, and the row that stacking took the space from was
  // the one holding the Guess button — see .dock-dictionary in index.css.
  let answerFits = true
  let sawAnswer = false
  let answerBeside = true
  let sawBesideAnswer = false
  // The regression that cost the guess turn its button: a lookup must not
  // take the control away, in either state of the row that holds it.
  let actionLives = true
  let sawActionWithAnswer = false
  // .round-summary, not .debrief — the round-end screen was renamed while this
  // was being written, and a loop that waits for a class nobody renders any
  // more just runs its full count. This file already carries one scar of that
  // shape (see the `.redemption-form` note above, dead for its whole life).
  for (let i = 0; i < 26 && (await page.locator('.round-summary').count()) === 0; i++) {
    const clue = page.locator('.clue-input #clue-word')
    if (await clue.isVisible().catch(() => false)) {
      if (!clueLookupHits) clueLookupHits = (await longLookup('clue dock + lookup')) ?? 0
      await clue.fill(`kluex${i}`)
      await page.waitForTimeout(200)
      const send = page.locator('.clue-input .btn-primary')
      if (await send.isEnabled().catch(() => false)) {
        await send.click()
        await page.waitForTimeout(850)
        continue
      }
    }

    // A guidance panel (the last chance's, mid-loop) withholds the guessable
    // cards while it is up; take its action before looking for one.
    await dismissRoundGuidance(page)
    const guessable = page.locator('.word-card.card-guessable').first()
    if (await guessable.isVisible().catch(() => false)) {
      if (!guessLookupHits) guessLookupHits = (await longLookup('guess bar + lookup')) ?? 0
      // The fullest the dock ever is, and the state the reserve is sized
      // against. It used to be "the stop button AND a card selected AND a
      // four-hit lookup, all at once"; those first two now share a row, so
      // that combination is unreachable and a check asking for it waits for
      // ever. Both halves of the swap are measured instead — the stop button
      // with four answers up, then the confirm row with four answers up — and
      // the fullest is whichever of them is taller.
      const measure = async (label, when) => {
        if (!when) return
        await longLookup(label, async () => {
          const r = await page.evaluate(() => {
            const dock = document.querySelector('.game-screen .dock')
            const bottom = dock.getBoundingClientRect().bottom
            // How far past the dock's own bottom edge anything inside it
            // reaches. The reserve is only honest if this is zero: a dock
            // whose content hangs out of it has not reserved anything.
            //
            // Anything inside a box that CLIPS its own overflow is skipped,
            // and that is the point rather than a loophole: the answers list
            // is designed to give way by scrolling, so its off-screen rows are
            // painted nowhere and their rectangles say nothing about the dock.
            // Without this the reading is luck — at the old 260px reserve the
            // list happened to sit high enough that its fourth row's rect
            // stopped short of the dock's edge, and at 200px the second row's
            // 🔊 button reaches 9.4px past it while being drawn inside the
            // list all the same. The clipping box itself is still measured,
            // and so is every control that does not have one.
            const out = [...dock.querySelectorAll('*')]
              .filter((el) => {
                for (let p = el.parentElement; p && p !== dock; p = p.parentElement) {
                  if (getComputedStyle(p).overflowY !== 'visible') return false
                }
                return true
              })
              .map((el) => Math.round((el.getBoundingClientRect().bottom - bottom) * 10) / 10)
            // And the answer is really ON SCREEN, inside the one line the
            // guess bar reserves for it (K2). A line that gives way by
            // clipping can be honest about the dock and still be hiding the
            // whole answer inside itself, which is a control wearing a
            // scrollbar — so the answer's own rectangle is compared with the
            // line's rather than with the dock's.
            const line = dock.querySelector('.dict-line')
            const ans = dock.querySelector('.dict-answer')
            const field = dock.querySelector('.dock-dictionary .translate-input')
            const lr = line?.getBoundingClientRect()
            const ar = ans?.getBoundingClientRect()
            const fr = field?.getBoundingClientRect()
            // And the button this phase exists for is still there to press.
            // Both states this is measured in hold a real control (the stop
            // button, then the confirm row), so a missing .btn is the bug
            // rather than a state without one. elementFromPoint rather than a
            // rectangle: a control can have a size and still be covered, and
            // a control that cannot be tapped is not a control.
            const btn = dock.querySelector('.dock-actions .btn')
            const br = btn?.getBoundingClientRect()
            const at = br && document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2)
            return {
              sh: document.scrollingElement.scrollHeight,
              ih: window.innerHeight,
              spill: Math.max(0, ...out),
              hits: dock.querySelectorAll('.dict-hit').length,
              answer:
                lr && ar
                  ? {
                      w: Math.round(ar.width),
                      inside:
                        ar.width > 20 &&
                        ar.right <= lr.right + 0.5 &&
                        ar.bottom <= lr.bottom + 0.5,
                      beside:
                        fr &&
                        ar.left >= fr.right - 0.5 &&
                        ar.top < fr.bottom - 0.5 &&
                        ar.bottom > fr.top + 0.5,
                    }
                  : null,
              action: br
                ? {
                    label: btn.textContent.trim().slice(0, 24),
                    w: Math.round(br.width),
                    h: Math.round(br.height),
                    live: br.width > 40 && br.height >= 24 && btn.contains(at),
                  }
                : null,
            }
          })
          if (r.answer) answerFits = answerFits && r.answer.inside
          if (r.answer) sawAnswer = true
          if (r.answer) answerBeside = answerBeside && r.answer.beside
          if (r.answer?.beside) sawBesideAnswer = true
          if (r.answer) {
            actionLives = actionLives && !!r.action?.live
            if (r.action?.live) sawActionWithAnswer = true
          }
          if (!worst || r.spill > worst.spill) worst = { ...r, label }
        })
      }
      await measure(
        'guess bar, stop button and four answers',
        (await page.locator('.guess-bar .btn-ghost').count()) > 0 &&
          (await page.locator('.guess-bar .translate-input').count()) > 0,
      )
      await guessable.click()
      await page.waitForTimeout(200)
      // The reserve's arithmetic rests on the stop button and the confirm row
      // being ALTERNATIVES — one row between them, not two — so that claim is
      // asserted rather than left implied by the total below, which would go
      // on passing if the reserve were simply raised to cover both. Sampled
      // HERE, with a card selected: at the top of the loop nothing is, so the
      // confirm row does not exist and the reading is vacuous — which it was,
      // and a mutation that put the stop button back in a row of its own
      // sailed through it.
      if (
        (await page.locator('.guess-bar .guess-confirm').count()) > 0 &&
        (await page.locator('.guess-bar .btn-ghost').count()) > 0
      ) {
        sharedRow = false
      }
      await measure(
        'guess bar, a card selected and four answers',
        (await page.locator('.guess-bar .guess-confirm').count()) > 0 &&
          (await page.locator('.guess-bar .translate-input').count()) > 0,
      )
      const confirm = page.locator('.guess-confirm .btn-primary')
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click()
        await page.waitForTimeout(650)
        continue
      }
    }
    // U3 made Casey's turn two beats per guess instead of one interval, which
    // is about four seconds longer per turn. This loop has 26 iterations to
    // reach a summary in and would spend a dozen of them watching. A tap on
    // her panel skips to the next beat — the same gesture the tutorial's
    // "Watch Casey guess" button is — so the loop pays one iteration per beat
    // and both beats are still painted for the sampler above.
    const casey = page.locator('.game-screen .dock.ai-panel[data-hurry]')
    if (await casey.isVisible().catch(() => false)) await casey.click().catch(() => {})
    await page.waitForTimeout(550)
  }

  const board = await page.evaluate(() => window.__board)
  const states = Object.entries(board).filter(([k]) => k !== 'Round over')
  const rects = states.map(([k, v]) => [k, v])

  // Not vacuous: the round has to have BEEN in the phases being compared, or
  // "they all match" is a statement about one of them.
  const seen = new Set(states.map(([k]) => k))
  const required = [
    'Give Casey a clue',
    'Casey is guessing',
    'Your turn to guess',
    'Translation time',
    'clue dock + lookup',
    'guess bar + lookup',
  ]
  const missing = required.filter((r) => !seen.has(r))
  check(
    'the seeded round passed through every phase this compares',
    missing.length === 0,
    missing.length ? `missing ${missing.join(', ')}` : [...seen].join(' | '),
  )
  // aiClueInput ("Casey prepares a clue") is deliberately not in that list,
  // and its absence is a measurement rather than an oversight: against the
  // offline companion it does not survive a paint — the mock's clue resolves
  // in a microtask, so React has committed playerGuessing before the next
  // frame, and ~4800 sampled frames over two full rounds caught it zero times.
  // It renders the same .ai-panel dock as "Casey is guessing", which IS
  // measured, and the reserve below is declared on the dock's class rather
  // than on the phase — so the two cannot come out different.
  // The mechanism, as one rectangle rather than one number (K2): x, y, width
  // and height of the panel itself, over every frame of every phase.
  const withDock = rects.filter(([, v]) => v.dockn)
  const dockSpan = (f) => {
    const lo = Math.min(...withDock.map(([, v]) => v[`dock${f}lo`]))
    const hi = Math.max(...withDock.map(([, v]) => v[`dock${f}hi`]))
    return { lo, hi, drift: Math.round((hi - lo) * 100) / 100 }
  }
  const dockDrift = ['x', 'y', 'width', 'height'].map((f) => [f, dockSpan(f)])
  check(
    'and the dock is the same rectangle in every phase it rendered',
    withDock.length === rects.length && dockDrift.every(([, s]) => s.drift === 0),
    withDock.length !== rects.length
      ? `${rects.length - withDock.length} states had no dock at all`
      : dockDrift.every(([, s]) => s.drift === 0)
        ? `${withDock.length} states at ${dockSpan('width').lo}x${dockSpan('height').lo} from ` +
          `(${dockSpan('x').lo}, ${dockSpan('y').lo})`
        : withDock
            .map(([k, v]) => `${k} y${v.dockylo}..${v.dockyhi} h${v.dockheightlo}..${v.dockheighthi}`)
            .join(' | '),
  )
  check(
    'and the lookups really put an answer on screen',
    clueLookupHits >= 1 && guessLookupHits >= 1,
    `clue dock ${clueLookupHits}, guess bar ${guessLookupHits}`,
  )

  // ---- U3: the two beats of Casey's turn are one rectangle ------------------
  // The check above compares PHASES, and both beats live inside one phase, so
  // it already catches a panel that changes height between them — but only as
  // drift inside "Casey is guessing", which does not say which beat did it.
  // This says it. Both beats are required to have rendered: a reading taken
  // over one of them is a statement about one of them.
  const caseyBeats = await page.evaluate(() => window.__caseyBeats)
  const beatNames = Object.keys(caseyBeats).sort()
  const beatSpan = (f) => {
    const lo = Math.min(...beatNames.map((k) => caseyBeats[k][`${f}lo`]))
    const hi = Math.max(...beatNames.map((k) => caseyBeats[k][`${f}hi`]))
    return { lo, hi, drift: Math.round((hi - lo) * 100) / 100 }
  }
  const beatFields = ['x', 'y', 'width', 'height']
  const bothBeats = beatNames.length === 2 && beatNames.join(',') === 'reveal,think'
  check(
    "Casey's panel is K2's rectangle in the think beat and in the reveal beat",
    bothBeats && beatFields.every((f) => beatSpan(f).drift === 0),
    !bothBeats
      ? `beats seen: ${beatNames.join(', ') || 'none'}`
      : beatFields.every((f) => beatSpan(f).drift === 0)
        ? `${beatNames
            .map((k) => `${k} x${caseyBeats[k].n}`)
            .join(' + ')} frames at ${beatSpan('width').lo}x${beatSpan('height').lo} from ` +
          `(${beatSpan('x').lo}, ${beatSpan('y').lo})`
        : beatNames
            .map(
              (k) =>
                `${k} y${caseyBeats[k].ylo}..${caseyBeats[k].yhi} ` +
                `h${caseyBeats[k].heightlo}..${caseyBeats[k].heighthi}`,
            )
            .join(' | '),
  )

  // The measurement. Every frame of every phase, one rectangle.
  const span = (f) => {
    const lo = Math.min(...rects.map(([, v]) => v[`${f}lo`]))
    const hi = Math.max(...rects.map(([, v]) => v[`${f}hi`]))
    return { lo, hi, drift: Math.round((hi - lo) * 100) / 100 }
  }
  const y = span('y')
  const h = span('height')
  const x = span('x')
  const w = span('width')
  const frames = rects.reduce((n, [, v]) => n + v.n, 0)
  const worstOf = (f) =>
    rects
      .map(([k, v]) => `${k} ${v[`${f}lo`]}..${v[`${f}hi`]}`)
      .join(' | ')

  check(
    'the board is the same rectangle in every phase of a round',
    y.drift === 0 && h.drift === 0 && x.drift === 0 && w.drift === 0,
    `${rects.length} states, ${frames} frames — top drift ${y.drift}px, height drift ${h.drift}px` +
      (y.drift || h.drift ? `\n     ${worstOf(y.drift ? 'y' : 'height')}` : ` (top ${y.lo}, height ${h.lo})`),
  )

  // The fullest state the guess dock reaches — its action row at its tallest,
  // with a lookup answer up. The dock is a fixed height, so a rect comparison
  // alone would pass one whose content hangs over the board: nothing may reach
  // past the panel's bottom edge, and the document must not lengthen.
  check(
    'the fullest the guess dock gets stays inside its height',
    worst ? worst.spill <= 0.5 && worst.sh <= worst.ih + 1 && worst.hits >= 1 : false,
    worst
      ? `${worst.label}: ${worst.hits} answers up, ${worst.spill}px past the dock, document ${worst.sh} vs ${worst.ih}`
      : 'never reached the guess bar with an answer up',
  )
  // And the answer stays on screen beside the field, in the one row the dock
  // has for it, rather than taking a second row out of the row above.
  check(
    'the guess dictionary answers beside its field, on one row',
    sawAnswer && sawBesideAnswer && answerFits && answerBeside,
    sawAnswer
      ? `${worst?.answer?.w}px wide, beside ${String(worst?.answer?.beside)}`
      : 'no answer was ever measured',
  )
  // The one this file did not have, and the one the bug walked through: a
  // lookup answer on screen must not cost the turn its button. Two PRs hid
  // .dock-actions to make room for a stacked translation, so looking Casey's
  // clue up — the tap the dock's own title invites — left a guessing turn
  // with nothing to guess with.
  check(
    'a lookup answer never takes away the guess bar button',
    sawActionWithAnswer && actionLives,
    sawActionWithAnswer
      ? `${worst?.action?.label} ${worst?.action?.w}x${worst?.action?.h}`
      : 'never saw a guess-bar control while an answer was up',
  )
  // And the swap really is a swap. Without this the reserve could be bought
  // back the expensive way — two rows and a taller dock — and every check
  // above would go on passing while the board quietly shrank again.
  check(
    'stopping and confirming a guess share one row, never two',
    sharedRow,
    'the stop button and the confirm row were on screen together',
  )
  await page.setViewportSize(PHONE)
}

// ---- Retired wrap-up contract ------------------------------------------------
//
// The former packing geometry was removed with the live wrap-up mode. The
// successor collection, result reader, and ordinary dock geometry are driven
// by suitcase-drive, endgame-drive, and the ordinary-round checks above. Keep
// one direct layout guard here: no supported query may resurrect its surface.
{
  await page.setViewportSize({ width: 360, height: 640 })
  await open('?mock=1&howto=0&city=0&collected=40&seed=9&wraps=1&first=player')
  check(
    'a retired wrap-up query never renders a packing dock',
    (await page.locator('.packing-dock').count()) === 0,
  )
  await page.setViewportSize(PHONE)
}

// ---- The guided game uses the normal board and the real docks ---------------
// The tutorial samples a normal game dock across its own states. This helper
// is intentionally mode-neutral: the retired wrap-up sampler was removed,
// while tutorial geometry still needs the same board/dock rectangles.
const dockSampler = () => {
  window.__d = {}
  const tick = () => {
    const dock = document.querySelector('.game-screen .dock')
    const grid = document.querySelector('.board-grid')
    const key = window.__dwhere
    if (dock && grid && key) {
      const r = dock.getBoundingClientRect()
      const g = grid.getBoundingClientRect()
      const at = (window.__d[key] ??= { n: 0 })
      for (const [prefix, box] of [['', r], ['g', g]]) {
        for (const field of ['x', 'y', 'width', 'height']) {
          const value = Math.round(box[field] * 100) / 100
          at[`${prefix}${field}lo`] = at.n ? Math.min(at[`${prefix}${field}lo`], value) : value
          at[`${prefix}${field}hi`] = at.n ? Math.max(at[`${prefix}${field}hi`], value) : value
        }
      }
      at.sh = Math.max(at.sh ?? 0, document.scrollingElement.scrollHeight)
      at.ih = window.innerHeight
      at.n++
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
/** Compare the sampled dock or board rectangle across named tutorial states. */
const oneRect = (states, prefix) => {
  const span = (field) => {
    const lo = Math.min(...states.map(([, value]) => value[`${prefix}${field}lo`]))
    const hi = Math.max(...states.map(([, value]) => value[`${prefix}${field}hi`]))
    return { lo, hi, drift: Math.round((hi - lo) * 100) / 100 }
  }
  const parts = ['x', 'y', 'width', 'height'].map((field) => [field, span(field)])
  return {
    ok: parts.every(([, value]) => value.drift === 0),
    where: `${span('width').lo}x${span('height').lo} at (${span('x').lo}, ${span('y').lo})`,
    drift: parts.map(([field, value]) => `${field} ${value.drift}`).join(', '),
  }
}
{
  const VP = { width: 360, height: 640 }
  await page.setViewportSize(VP)
  await open('?mock=1')
  await page.evaluate(() => localStorage.clear())
  await open('?mock=1')
  await page.waitForSelector('.onboard-ticket')
  await page.locator('.onboard-ticket').filter({ hasText: 'Denmark' }).click()
  await page.waitForSelector('.home-intro-welcome')
  for (let i = 0; i < 3; i++) await page.locator('.home-intro-bubble').click()
  await page.locator('.home-intro-actions .home-play').click()
  await page.waitForSelector('.tutorial-game .board-grid')
  check('the layout tutorial starts on the compact 3×3 board', (await page.locator('.tutorial-game .word-card').count()) === 9)
  await page.waitForSelector('.guess-bar')
  await page.evaluate(dockSampler)
  const dwhere = (w) => page.evaluate((w) => (window.__dwhere = w), w)

  await dwhere('practice Casey guess bar, no selection')
  await page.waitForTimeout(300)
  await page.locator('.word-card:has(.card-word:text-is("vand"))').click()
  await dwhere('practice guess bar, confirm')
  await page.waitForTimeout(300)
  await page.locator('.guess-confirm .btn-primary').click()
  for (const word of ['kaffe', 'mælk']) {
    await page.locator(`.word-card:has(.card-word:text-is("${word}"))`).click()
    await page.locator('.guess-confirm .btn-primary').click()
    await page.waitForTimeout(120)
  }
  await page.waitForSelector('.clue-input')
  check('the tutorial composer has no suggestion controls', (await page.locator('[class*="tutorial-suggestion"]').count()) === 0)
  await dwhere('real composer, no suggestion controls')
  await page.waitForTimeout(300)
  await dwhere(null)

  const states = Object.entries(await page.evaluate(() => window.__d))
  check('the guided round crossed the real guess and clue controls', states.length >= 3, `${states.length} states`)
  const td = oneRect(states, '')
  check(
    'the guided round uses the same dock rectangle as controls change',
    states.length >= 3 && td.ok,
    td.ok ? td.where : `${td.drift} — ${states.map(([k, v]) => `${k} h${v.heightlo}..${v.heighthi}`).join(' | ')}`,
  )
  const tg = oneRect(states, 'g')
  check('and the guided board never moves either', states.length >= 3 && tg.ok, tg.ok ? tg.where : tg.drift)
  check(
    'and no guided-game state scrolls at 360×640',
    states.every(([, value]) => value.sh <= value.ih + 1),
    states.map(([key, value]) => `${key} ${value.sh}/${value.ih}`).join(' | '),
  )
  await page.setViewportSize(PHONE)
}

// ---- The composer never changes size (K1). ---------------------------------
//
// "I don't want the size of the composer to change ever. Below clue and
// dictionary should be enough space for one small line of text where the
// translation, or the clue warning can be."
//
// The block above pins the BOARD across phases, which the reserve buys by
// holding a slot the docks sit inside. This pins the composer itself, which is
// a different claim and a stronger one: the panel is a fixed height and every
// state a clue turn can reach has to fit in it, so nothing can grow the panel
// and nothing may hang out of the bottom of it either.
//
// Six states, sampled per frame the way the board is — a poll between them
// would miss the ones that only exist for a moment ("Asking Casey…" is gone in
// under a second against the mock). Each is asserted to have really happened,
// because "they were all the same rectangle" is a statement about one state if
// only one of them was ever on screen.
//
// The check that has teeth is the SPILL one. A fixed-height panel keeps its
// rectangle no matter what you put in it, so a rect comparison alone would
// pass a composer with a fourth row hanging over the board. Mutation checked:
// adding a fourth row to ClueInput (a bare <p> beside .composer-line) fails
// 'nothing hangs out of the composer' at 28.4px past the panel and takes the
// document to 656px on a 640px screen, while the rectangle check goes on
// passing — which is the whole reason both are here.
{
  const VP = { width: 360, height: 640 }
  await page.setViewportSize(VP)
  // A fresh profile, so the first-clue-ever line (O4) is one of the states.
  // ?howto=0 keeps the intro out of the way — a fresh device otherwise opens
  // in the train, not on Home.
  // An explicit seed is a development round without a durable primary slot;
  // the reload below intentionally exercises the supported Continue board
  // path, so use the authored primary deal instead.
  const Q = '?mock=1&howto=0&city=0&first=player'
  await open(Q)
  await page.evaluate(() => localStorage.clear())
  await open(Q)
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    return sessions?.activeSlot === 'primary' && !!sessions.primary
  })
  const study2 = page.locator('.study-dock .btn-primary')
  if (await study2.isVisible().catch(() => false)) await study2.click()
  await page.waitForTimeout(400)

  // Installed with evaluate rather than addInitScript, and therefore again
  // after the reload below. A reload wipes `window`, so what it collected is
  // read out into node first and the two halves are merged there — the states
  // before and after the reload are compared as one set.
  const sampler = () => {
    window.__cx = {}
    window.__saw = {}
    const tick = () => {
      const d = document.querySelector('.game-screen .dock.clue-input')
      const key = window.__cwhere
      if (d && key) {
        const r = d.getBoundingClientRect()
        const at = (window.__cx[key] ??= { n: 0 })
        for (const f of ['x', 'y', 'width', 'height']) {
          const v = Math.round(r[f] * 100) / 100
          at[`${f}lo`] = at.n ? Math.min(at[`${f}lo`], v) : v
          at[`${f}hi`] = at.n ? Math.max(at[`${f}hi`], v) : v
        }
        // How far past the panel's own bottom edge anything inside it reaches.
        // A box that clips its own overflow is skipped — the shared line is
        // designed to cut its text rather than wrap it, so what it hides is
        // painted nowhere and says nothing about the panel.
        const out = [...d.querySelectorAll('*')]
          .filter((el) => {
            for (let p = el.parentElement; p && p !== d; p = p.parentElement) {
              const cs = getComputedStyle(p)
              if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') return false
            }
            return true
          })
          .map((el) => Math.round((el.getBoundingClientRect().bottom - r.bottom) * 10) / 10)
        const sp = Math.max(0, ...out)
        if (!at.n || sp > at.spill) {
          // Name the worst offender, so a failure says WHAT hangs out.
          const worst = [...d.querySelectorAll('*')][out.indexOf(sp)]
          at.spillEl = worst ? `${worst.tagName.toLowerCase()}.${[...worst.classList].join('.')}` : ''
        }
        at.spill = at.n ? Math.max(at.spill, sp) : sp
        at.sh = Math.max(at.sh ?? 0, document.scrollingElement.scrollHeight)
        at.ih = window.innerHeight
        at.n++
        // What was actually on screen, so none of the six is vacuous.
        const line = document.querySelector('.clue-input .composer-line')
        const txt = line?.innerText ?? ''
        if (document.querySelector('.clue-input .first-hint')) window.__saw.hint = true
        if (/looks like/.test(txt)) window.__saw.english = true
        if (document.querySelector('.clue-input .clue-error') && !/looks like/.test(txt))
          window.__saw.illegal = true
        if (document.querySelector('.clue-input .dict-hit')) window.__saw.answer = true
        if (/Asking Casey/.test(txt)) window.__saw.asking = true
        if (document.querySelector('.clue-input .composer-line .test-fail')) window.__saw.failed = true
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  await page.evaluate(sampler)
  const cwhere = (w) => page.evaluate((w) => (window.__cwhere = w), w)

  const clueField = page.locator('.clue-input #clue-word')
  const dictField = page.locator('.clue-input .translate-input')
  const boardDa = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game.words[0].da,
  )

  await cwhere('empty, the first-clue line')
  await page.waitForTimeout(500)
  await cwhere('typing a legal clue')
  await clueField.fill('kat')
  await page.waitForTimeout(400)
  await cwhere('an illegal clue')
  await clueField.fill(boardDa)
  await page.waitForTimeout(400)
  await cwhere('an English-looking clue')
  await clueField.fill('nice')
  await page.waitForTimeout(400)
  // "nice" has seven Danish glosses in the shipped set — the longest answer the
  // offline half can produce, and the state this height is measured against.
  await cwhere('the longest verdict and the longest answer together')
  await dictField.fill('nice')
  await page.waitForTimeout(1000)
  const squeezed = await page.evaluate(() => {
    const a = document.querySelector('.clue-input .dict-hit')
    const v = document.querySelector('.clue-input .clue-error')
    return {
      answer: a ? [a.scrollWidth, a.clientWidth] : null,
      verdict: v ? [v.scrollWidth, v.clientWidth] : null,
    }
  })
  await cwhere(null)

  // ---- the two states that only exist while a request is in flight ----
  //
  // "Asking Casey…" and the error that can follow it cannot be PAINTED against
  // the mock: MockCompanion.translate resolves in a microtask, so React has
  // committed the answer before the next frame and ~970 sampled frames caught
  // it zero times — the same measurement the aiClueInput note above records.
  // So Casey is made slow rather than fake for these two: the real client, a
  // request held for 1.4s and then refused. Both land in the same
  // .composer-line as everything above, and the panel is compared across the
  // reload as one set of states, which makes this the strictest sample here.
  const cxA = await page.evaluate(() => window.__cx)
  const sawA = await page.evaluate(() => window.__saw)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-settings-v1') ?? '{}')
    raw.state = {
      ...raw.state,
      useMock: false,
      baseUrl: 'https://casey.invalid/v1',
    }
    localStorage.setItem('cluecab-settings-v1', JSON.stringify(raw))
  })
  // The client retries a dropped request ONCE, 1.5s later (PR #203), so the
  // first attempt is held long enough to paint "Asking Casey…" and the retry
  // is refused at once: the failure lands about 2.9s after the fill. Before
  // #203 it landed at 1.4s, and the 1.6s window below never saw it after.
  let decisionCalls = 0
  await page.route('**/casey/decision', async (route) => {
    if (decisionCalls++ === 0) await sleep(1400)
    await route.abort()
  })
  // Back in WITHOUT ?mock=1 — a reload would carry it, and App.tsx writes
  // useMock:true from that param on every load, which is what quietly kept the
  // fake companion the first time this was written.
  await open('?howto=0')
  await page.getByRole('button', { name: 'Continue board' }).click()
  await page.waitForSelector('.clue-input')
  await page.waitForTimeout(300)
  await page.evaluate(sampler)
  await cwhere('Asking Casey')
  await page.locator('.clue-input .translate-input').fill('helicopter')
  await page.waitForTimeout(1000)
  await cwhere('Casey could not answer')
  await page.waitForTimeout(3200)
  await cwhere(null)
  await page.unroute('**/casey/decision')

  const cx = { ...cxA, ...(await page.evaluate(() => window.__cx)) }
  const saw = { ...sawA, ...(await page.evaluate(() => window.__saw)) }
  const states = Object.entries(cx)
  const missing = ['hint', 'illegal', 'english', 'answer', 'asking', 'failed'].filter(
    (k) => !saw[k],
  )
  check(
    'the composer really passed through every state this compares',
    missing.length === 0,
    missing.length ? `never saw ${missing.join(', ')}` : Object.keys(saw).join(' | '),
  )
  const span = (f) => {
    const lo = Math.min(...states.map(([, v]) => v[`${f}lo`]))
    const hi = Math.max(...states.map(([, v]) => v[`${f}hi`]))
    return { lo, hi, drift: Math.round((hi - lo) * 100) / 100 }
  }
  const cy = span('y')
  const ch = span('height')
  const cxx = span('x')
  const cw = span('width')
  const cframes = states.reduce((n, [, v]) => n + v.n, 0)
  check(
    'the composer is the same rectangle in every state of a clue turn',
    cy.drift === 0 && ch.drift === 0 && cxx.drift === 0 && cw.drift === 0,
    `${states.length} states, ${cframes} frames — top drift ${cy.drift}px, height drift ${ch.drift}px` +
      (cy.drift || ch.drift
        ? `\n     ${states.map(([k, v]) => `${k} ${v.ylo}..${v.yhi} h${v.heightlo}..${v.heighthi}`).join(' | ')}`
        : ` (top ${cy.lo}, height ${ch.lo})`),
  )
  // And it holds its content rather than merely holding its shape. This is the
  // half a fourth row fails.
  const spill = Math.max(...states.map(([, v]) => v.spill))
  const longest = states.reduce((a, [k, v]) => (v.spill > (a?.[1] ?? -1) ? [k, v.spill] : a), null)
  check(
    'and nothing hangs out of the composer in any of them',
    spill <= 0.5,
    `worst ${longest?.[0]} at ${spill}px past the panel${spill > 0 ? ` (${cx[longest?.[0]]?.spillEl})` : ''}`,
  )
  check(
    'and the document never scrolled at 360x640',
    states.every(([, v]) => v.sh <= v.ih + 1),
    states.map(([k, v]) => `${k} ${v.sh}/${v.ih}`).join(' | '),
  )
  // The shared line is doing its job rather than getting away with it: with
  // the longest verdict and the longest answer up together, both are cut
  // inside the one line instead of one of them pushing a second one.
  check(
    'the verdict and the answer share the line, both ellipsized',
    !!squeezed.verdict &&
      !!squeezed.answer &&
      squeezed.verdict[0] > squeezed.verdict[1] &&
      squeezed.answer[0] > squeezed.answer[1],
    JSON.stringify(squeezed),
  )
  await page.setViewportSize(PHONE)
}

/**
 * ── THE SAME SCREENS, IN EVERY LANGUAGE THE APP SPEAKS ─────────────────────
 *
 * The no-scroll rule at 360x640 was written against English, and English is
 * the SHORTEST of the four. German compounds run about a third longer, Spanish
 * runs longer still in verb phrases, and Chinese is shorter but taller per
 * line. A screen that fits in English and overflows in German is a screen that
 * is broken for the players this work exists for, and nothing else in the
 * suite would say so.
 *
 * It runs from Phase 1a, before there is much to see, ON PURPOSE: the loop is
 * the thing being proven here, so that the group PRs that fill the catalogue
 * inherit a measurement instead of having to invent one. Until the catalogue
 * is full most of these screens are still English in every pass, and the
 * numbers will only start to move as 1b-1f land.
 *
 * The key is written before the app's first line runs, because the catalogue
 * is resolved at module load (src/i18n/active.ts) — an init script, not a
 * click, is the only thing early enough.
 */
const documentFits = () =>
  page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight])

/**
 * Set the language and come back up in it. NOT an init script: those stack on
 * a context rather than replace, so four of them in a loop would leave every
 * pass in whichever language was added last. Writing the key and reloading is
 * the same thing the app itself does when the player switches.
 */
async function openIn(lang, query) {
  await page.goto(BASE + query, { waitUntil: 'networkidle' })
  await page.evaluate((code) => localStorage.setItem('cluecab-ui-language', code), lang)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}

/**
 * Every shipped UI language, read from the app's own picker rather than listed
 * here. Two reasons it is not a literal array: a language added to
 * `src/i18n/types.ts` is measured without anyone remembering to edit this
 * file, and the list being read out of the built page is itself the check that
 * the picker offers them.
 */
await page.setViewportSize({ width: 360, height: 640 })
await page.goto(BASE + '?mock=1&howto=0&city=0', { waitUntil: 'networkidle' })
await page.locator('.home-top .icon-btn').first().click()
await page.waitForSelector('.settings-screen', { timeout: 5000 })
const OFFERED = await page.evaluate(() => {
  const select = [...document.querySelectorAll('.settings-screen select')].find((s) =>
    [...s.options].some((o) => o.value === 'en'),
  )
  return [...select.options].map((o) => ({ code: o.value, tag: o.lang, endonym: o.textContent.trim() }))
})
const UI_LANGS = OFFERED.map((o) => o.code)
const LANG_TAGS = Object.fromEntries(OFFERED.map((o) => [o.code, o.tag]))
check(
  // 918ddab0 trimmed the picker to the seven launch languages; the es, nl, nb
  // and hu catalogues stay compiled but unlisted.
  'the picker offers every shipped language',
  UI_LANGS.length === 7,
  UI_LANGS.join(' '),
)
check(
  'every language in the picker names itself, and none is blank',
  OFFERED.every((o) => o.endonym.length > 0 && o.tag.length > 0),
  OFFERED.map((o) => o.endonym).join(' · '),
)

for (const lang of UI_LANGS) {
  for (const vp of [
    { width: 360, height: 640, name: 'small Android' },
    { width: 375, height: 667, name: 'iPhone SE' },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await openIn(lang, '?mock=1&howto=0&city=0')

    // Prove the language is actually ON before measuring anything in it.
    // Without this the loop could run four times over an English page and
    // report four passes, which is the one way a measurement lies.
    const tag = LANG_TAGS[lang]
    check(
      `the page really is in ${lang} on ${vp.name}`,
      (await page.evaluate(() => document.documentElement.lang)) === tag,
    )

    const primary = await page.locator('.btn-primary.btn-big').first().boundingBox()
    check(
      `Home's primary action is above the fold in ${lang} on ${vp.name}`,
      primary.y + primary.height <= vp.height,
      `bottom ${(primary.y + primary.height).toFixed(0)} of ${vp.height}`,
    )
    const home = await documentFits()
    check(`Home does not scroll in ${lang} on ${vp.name}`, home[0] <= home[1] + 1, `${home[0]}/${home[1]}`)

    // The gear, by POSITION rather than by its label: the label is copy and
    // becomes a catalogue string, so a selector reading "Settings" would break
    // in exactly the languages this loop exists to measure.
    await page.locator('.home-top .icon-btn').first().click()
    await page.waitForSelector('.settings-screen', { timeout: 5000 })
    const settings = await documentFits()
    check(
      `Settings does not scroll in ${lang} on ${vp.name}`,
      settings[0] <= settings[1] + 1,
      `${settings[0]}/${settings[1]}`,
    )

    // The live surface has no packing title after C1-15. Pin its absence in
    // every public locale; suitcase-drive measures the Casey collection title.
    check(
      `no retired packing dock leaks into ${lang} on ${vp.name}`,
      (await page.locator('.packing-dock').count()) === 0,
    )
  }
  await page.setViewportSize(PHONE)
}
await page.evaluate(() => localStorage.removeItem('cluecab-ui-language'))

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
preview.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nLAYOUT DRIVE OK')
if (fail.length) process.exitCode = 1
