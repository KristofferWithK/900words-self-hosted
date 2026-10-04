// Guards the bug that made the game unplayable: your own key card must be
// drawn on the board, or you cannot tell which words to clue.
//
// The key used to carry two markings and this drive checked both: a solid
// green border for a target and a dashed black one for a word forbidden on
// your key. Forbidden words are gone from every board, so there is one marking
// left and it is the one the game cannot be played without — hence the extra
// checks below that it is drawn on EVERY green and on nothing else. A count
// that matched by accident would have been caught by the dashed cards before;
// now nothing else is in the picture, so this asks per card.
//
// Since the owner's call of 2026-09-11 the key is drawn on the half of the
// round it is FOR — the player's clue turn and Casey's guesses under that
// clue — and put away for the other half: while Casey prepares a clue and
// while the player guesses under it, the frames are gone (border and
// accessible name both), so the board reads as her puzzle rather than your
// key. The second half of this drive pins that, both ways round.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = 4178
const preview = await startPreview(PORT)
import { setTimeout as sleep } from 'node:timers/promises'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const SHOT_DIR = process.env.SHOT_DIR ?? '.'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

const targetsDrawn = () => page.locator('.word-card.mykey-green').count()
const targetsAnnounced = () =>
  page.locator('.word-card').evaluateAll((cards) =>
    cards.filter((card) => (card.getAttribute('aria-label') ?? '').includes('your target')).length,
  )

try {
  // `first=player`: the round opens on the player's clue turn, which is the
  // turn the key exists for. (Casey opens by default, and her opening clue
  // is a turn the key is deliberately absent from — see below.)
  await page.goto(preview.base + '?mock=1&seed=5&howto=0&first=player')
  await page.waitForSelector('.city-card')
  // Home's primary is the Café puzzle tag since CW-10 (Play's successor).
  await page.click('.home-play')
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
  await page.waitForSelector('.clue-input')

  const game = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game,
  )
  if (!game) throw new Error('no game state')
  if (game.phase !== 'playerClueInput') throw new Error(`expected the player's clue turn, got ${game.phase}`)

  const myGreens = Object.keys(game.playerKey).filter((id) => game.playerKey[id] === 'green')
  const shownGreens = await targetsDrawn()
  console.log(`key on board: ${shownGreens}/${myGreens.length} targets`)
  if (myGreens.length === 0) throw new Error('the deal put nothing on the player key')
  if (shownGreens !== myGreens.length) {
    throw new Error(`your targets are not shown (${shownGreens} of ${myGreens.length})`)
  }

  // Card by card, not just by count: the marking has to be on the RIGHT cards.
  // With only one marking left, a count can agree while every mark sits on the
  // wrong word — which is the same unplayable board this drive exists for.
  const marked = new Set(
    await page.locator('.word-card.mykey-green .card-word').allTextContents(),
  )
  const expectedDa = new Set(
    myGreens.map((id) => game.words.find((w) => w.wordId === id).da),
  )
  for (const da of expectedDa) {
    if (!marked.has(da)) throw new Error(`«${da}» is your target and is not drawn as one`)
  }
  for (const da of marked) {
    if (!expectedDa.has(da)) throw new Error(`«${da}» is drawn as your target and is not one`)
  }
  console.log(`and on the right cards: ${[...marked].slice(0, 4).join(', ')}…`)

  // Each marked card must actually say so to a screen reader too — the border
  // is now the only visual carrier, so the accessible name is the only other
  // route to the same information.
  const label = await page.locator('.word-card.mykey-green').first().getAttribute('aria-label')
  if (!label?.includes('your target')) throw new Error(`target not announced: ${label}`)

  // And a card that is NOT yours must not claim to be.
  const plain = await page
    .locator('.word-card:not(.mykey-green)')
    .first()
    .getAttribute('aria-label')
  if (plain?.includes('your target')) throw new Error(`unmarked card announced as a target: ${plain}`)

  // The legend that explained the marker is GONE (K2), and its absence is
  // asserted rather than merely no longer checked: the border IS the legend
  // (README's rule), the aria-label above is the other half of it, and a
  // paragraph restating both cost 17.3px of board in every phase of every
  // round. If it comes back, it comes back on purpose.
  if ((await page.locator('.key-legend').count()) !== 0) {
    throw new Error('the key legend is back between the board and the dock')
  }

  // The dictionary is reachable through ⓘ only now — a plain card tap says
  // the word and does not open the sheet (U1). key-visible-drive used to tap
  // the card itself for this; that stopped being the dictionary's door the
  // moment U1 landed, so it now goes through card-info like every other drive.
  await page.locator('.word-card-wrap').first().locator('.card-info').click()
  await page.waitForSelector('.sheet', { timeout: 5000 })
  console.log('tap-to-look-up opened:', (await page.locator('.sheet h2').textContent())?.trim())
  await page.screenshot({ path: `${SHOT_DIR}/k1-key-visible.png` })
  await page.click('.sheet .sheet-close')

  // ---- the guessing half: the key is put away, and comes back -------------
  // Give a clue. Casey guesses under it — her guesses are judged against THIS
  // key, so the frames stay while she works — then prepares her own clue, and
  // from that moment until the player's guessing turn is over there is no
  // frame on the board and no card announces itself as a target.
  await page.fill('#clue-word', 'huskeliste')
  await page.click('.clue-input .btn-primary')
  let sawCaseyGuessing = false
  for (let i = 0; i < 60 && (await page.locator('.guess-bar').count()) === 0; i++) {
    const casey = page.locator('.dock.ai-panel[data-hurry]')
    if (await casey.isVisible().catch(() => false)) {
      // While she is guessing under the player's clue the key is still up.
      if (!sawCaseyGuessing && (await targetsDrawn()) === myGreens.length) sawCaseyGuessing = true
      await casey.click().catch(() => {})
    }
    await sleep(250)
  }
  if ((await page.locator('.guess-bar').count()) === 0) {
    throw new Error("the round never reached the player's guessing turn")
  }
  console.log(`key stayed up while Casey guessed under the clue: ${sawCaseyGuessing ? 'yes' : 'not observed'}`)
  const drawnWhileGuessing = await targetsDrawn()
  const announcedWhileGuessing = await targetsAnnounced()
  if (drawnWhileGuessing !== 0 || announcedWhileGuessing !== 0) {
    throw new Error(
      `the key is on the board during the guessing turn (${drawnWhileGuessing} frames, ${announcedWhileGuessing} announced)`,
    )
  }
  console.log('and put away for the guess under her clue: 0 frames, 0 announced')
  await page.screenshot({ path: `${SHOT_DIR}/k2-key-put-away.png` })

  // End the guessing turn — one guess, then stop if the turn is still open —
  // and the clue turn brings the frames back with it.
  await page.locator('.word-card.card-guessable').first().click()
  await page.locator('.guess-confirm .btn-primary').click()
  await sleep(300)
  const stop = page.locator('.guess-bar .btn-ghost')
  if (await stop.isVisible().catch(() => false)) await stop.click()
  await page.waitForSelector('.clue-input', { timeout: 10000 })
  const backGreens = await targetsDrawn()
  if (backGreens === 0) throw new Error('the key did not come back for the clue turn')
  console.log(`back for the clue turn: ${backGreens} frames`)

  console.log('KEY VISIBLE DRIVE OK')
} catch (e) {
  await page.screenshot({ path: `${SHOT_DIR}/k9-failure.png` }).catch(() => {})
  console.log('KEY VISIBLE DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}
