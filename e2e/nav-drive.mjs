import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4181
const preview = await startPreview(PORT)

const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const ROOT = preview.base
const SENTINEL = ROOT + '?sentinel=1'
// The pause successor is a course-primary assertion. A later-city dev deal
// is optional by design and cannot honestly advertise the primary return.
const APP = ROOT + '?mock=1&howto=0&city=0&learned=34&first=player'

const browser = await chromium.launch({ executablePath: EXE })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text().slice(0, 300)))

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

/**
 * Land on a sentinel page, then the app. A system Back that reaches the
 * sentinel proves the app had no orphaned entry left to unwind; a system Back
 * that stays on the app URL proves the press was swallowed.
 */
async function fresh() {
  await page.goto(SENTINEL, { waitUntil: 'networkidle' })
  await page.goto(APP, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
}
const onSentinel = () => page.url().includes('sentinel')
const screen = () =>
  page.evaluate(() => {
    if (document.querySelector('.map-screen')) return 'map'
    if (document.querySelector('.suitcase-screen')) return 'stats'
    if (document.querySelector('.settings-screen')) return 'settings'
    if (document.querySelector('.game-screen')) return 'game'
    return 'home'
  })
const back = async () => {
  await page.goBack().catch(() => {})
  await page.waitForTimeout(450)
}

// 1. Baseline: with nothing opened, one system Back leaves the app.
await fresh()
await back()
check('baseline: back leaves the app', onSentinel(), page.url())

// 2. In-app Back must consume the entry that opening the screen pushed, so the
//    next system Back leaves the app instead of being swallowed.
await fresh()
await page.locator('.map-button').click()
await page.waitForTimeout(300)
check('map opens', (await screen()) === 'map')
await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
await page.waitForTimeout(400)
check('in-app back returns home', (await screen()) === 'home')
await back()
check('no orphaned entry after in-app back', onSentinel(), page.url())

// 3. System Back from a screen still returns home, and only then leaves.
await fresh()
await page.locator('.map-button').click()
await page.waitForTimeout(300)
await back()
check('system back returns home', !onSentinel() && (await screen()) === 'home')
await back()
check('a second back then leaves the app', onSentinel(), page.url())

// 4. A sheet dismissed in-app must not swallow the next system Back. The
//    sheet lives a screen deep now (a suitcase tile opens it), so the ladder
//    is one rung taller: close in-app, then back to home, then back out.
await fresh()
await page.locator('.cluey-button').click()
await page.waitForTimeout(300)
await page.locator('.case-tile.case-collected').first().click()
await page.waitForTimeout(300)
check('sheet opens', (await page.locator('.sheet').count()) === 1)
await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } })
await page.waitForTimeout(400)
check('sheet closes in-app', (await page.locator('.sheet').count()) === 0)
await back()
await page.waitForTimeout(300)
check('back then returns home, not a swallowed entry', (await screen()) === 'home')
await back()
check('no orphaned entry after closing a sheet', onSentinel(), page.url())

// 5. Two layers deep: system Back peels exactly one at a time.
await fresh()
await page.locator('.cluey-button').click()
await page.waitForTimeout(300)
check('collection opens', (await screen()) === 'stats')
// The current city's row is already expanded on arrival.
await page.waitForTimeout(250)
await page.locator('.case-tile.case-collected').first().click()
await page.waitForTimeout(350)
check('sheet opens over collection', (await page.locator('.sheet').count()) === 1)
await back()
check(
  'back closes only the sheet',
  (await page.locator('.sheet').count()) === 0 && (await screen()) === 'stats',
  await screen(),
)
await back()
check('back then returns home', !onSentinel() && (await screen()) === 'home')
await back()
check('back then leaves the app', onSentinel(), page.url())

// 6. Hopping screen to screen must not strand entries: going home used to pop
//    one while each hop had pushed another.
await fresh()
await page.locator('.map-button').click()
await page.waitForTimeout(250)
await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
await page.waitForTimeout(250)
check('map to home via the in-page Back', (await screen()) === 'home')
await page.locator('.cluey-button').click()
await page.waitForTimeout(250)
// aria-label, not bare .icon-btn: the screen is full of pager arrows that are
// icon buttons too, and a many-match locator fails strict mode. (The header's
// own city pager went when the city became a filter — E1 — but the band
// pagers inside the case are still .icon-btn.)
await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
await page.waitForTimeout(300)
check('collection to home', (await screen()) === 'home')
await back()
check('two screens visited, no entries stranded', onSentinel(), page.url())

// 6b. Repeated open/close must not accumulate entries.
await fresh()
for (let i = 0; i < 5; i++) {
  await page.locator('.map-button').click()
  await page.waitForTimeout(220)
  await page.locator('.map-screen .icon-btn[aria-label="Back"]').click()
  await page.waitForTimeout(260)
}
check('five round trips end on home', (await screen()) === 'home')
await back()
check('and leave no entries behind', onSentinel(), page.url())

// 7. An unfinished round is not ordinary navigation. The arrow and system
// Back both offer the same explicit choice: pause preserves this exact board;
// cancel removes it so Home's primary action starts a new round.
await fresh()
await page.locator('.home-play').click()
await page.waitForTimeout(250)
const pausedBoard = await page.locator('.card-word').allTextContents()
await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
await page.waitForTimeout(150)
check('game arrow asks how to leave', (await page.getByRole('dialog', { name: 'Leave this round?' }).count()) === 1)
await page.getByRole('button', { name: 'Pause game' }).click()
await page.waitForTimeout(250)
const pausedPrimary = page.getByRole('button', { name: 'Continue board' })
check('pause returns home with a resumable primary', (await pausedPrimary.count()) === 1)
if ((await pausedPrimary.count()) !== 1) throw new Error('paused primary has no Home return control')
await pausedPrimary.click()
await page.waitForTimeout(200)
check('pause resumes the exact board', JSON.stringify(await page.locator('.card-word').allTextContents()) === JSON.stringify(pausedBoard))

await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
await page.getByRole('button', { name: 'Cancel round' }).click()
await page.waitForTimeout(250)
check(
  'cancel leaves no resumable round',
  (await page.getByRole('button', { name: 'Play', exact: true }).count()) === 1 &&
    (await page.getByRole('button', { name: 'Continue board' }).count()) === 0,
)

await page.getByRole('button', { name: 'Play', exact: true }).click()
await page.waitForTimeout(200)
await back()
check('system back asks how to leave the game', (await page.getByRole('dialog', { name: 'Leave this round?' }).count()) === 1)
await page.getByRole('button', { name: 'Keep playing' }).click()
await page.waitForTimeout(250)
await back()
check('keeping play restores the game history entry', (await page.getByRole('dialog', { name: 'Leave this round?' }).count()) === 1)
await page.getByRole('button', { name: 'Pause game' }).click()
await page.waitForTimeout(250)
await back()
check('pausing unwinds the game and dialog entries', onSentinel(), page.url())

// 8. A short effective viewport used to compress the six grid rows below the
// card's hard 44px floor. Each card then painted about 2px into the next row.
await page.setViewportSize({ width: 360, height: 568 })
await fresh()
await page.getByRole('button', { name: 'Continue board' }).click()
await page.waitForTimeout(200)
const shortPhoneBoard = await page.locator('.word-card').evaluateAll((cards) => {
  const rects = cards.map((card) => card.getBoundingClientRect())
  const intersections = rects.flatMap((a, index) =>
    rects.slice(index + 1).filter((b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0,
    ),
  ).length
  const board = document.querySelector('.board-area')?.getBoundingClientRect()
  const dock = document.querySelector('.dock')?.getBoundingClientRect()
  const outsideBoard = board ? rects.filter((card) => card.top < board.top - .5 || card.bottom > board.bottom + .5 || card.left < board.left - .5 || card.right > board.right + .5).length : -1
  const intoDock = dock ? rects.filter((card) => card.bottom > dock.top + .5).length : -1
  // Named in the failure rather than counted: the useful form of an overlap
  // is the word, so the fix can be measured against it.
  const overlapping = [...document.querySelectorAll('.word-card-surface')].filter((surface) => {
    const info = surface.querySelector('.card-info')?.getBoundingClientRect()
    const word = surface.querySelector('.card-da')?.getBoundingClientRect()
    return !!info && !!word && Math.min(info.right, word.right) - Math.max(info.left, word.left) > 0 && Math.min(info.bottom, word.bottom) - Math.max(info.top, word.top) > 0
  }).map((surface) => surface.querySelector('.card-da')?.textContent?.trim() ?? '?')
  return { intersections, outsideBoard, intoDock, infoOverWords: overlapping.length, overlapping }
})
check('short-phone board cards never overlap', shortPhoneBoard.intersections === 0, `${shortPhoneBoard.intersections} intersections`)
check('short-phone cards stay inside the board and clear its dock', shortPhoneBoard.outsideBoard === 0 && shortPhoneBoard.intoDock === 0, JSON.stringify(shortPhoneBoard))
check('short-phone lookup controls clear their words', shortPhoneBoard.infoOverWords === 0, `${shortPhoneBoard.infoOverWords} overlaps: ${shortPhoneBoard.overlapping.join(', ')}`)
await page.setViewportSize({ width: 390, height: 844 })

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
preview.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nNAV DRIVE OK')
if (fail.length) process.exitCode = 1
