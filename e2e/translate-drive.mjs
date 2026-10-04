// Looking a word up mid-round, which is what clueing in Danish requires.
//
// The dictionary sheet only ever answered "what is this board word?" — the
// question you have already been handed the answer to. Composing a Danish clue
// asks the opposite, about a word that is not on the board and may not be in
// the app at all. This drives that field where it is actually used, and checks
// the two rules that keep it from being a way to read the board for free.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { setTimeout as sleep } from 'node:timers/promises'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const PORT = 4197
const preview = await startPreview(PORT)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
await page.addInitScript(() => {
  try {
    const queued = sessionStorage.getItem('__translate-primary-fixture-v1')
    if (queued) {
      const fixture = JSON.parse(queued)
      localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
      localStorage.setItem('cluecab-game-v1', fixture.cache)
      sessionStorage.removeItem('__translate-primary-fixture-v1')
    }
  } catch { /* opaque origins cannot carry a fixture */ }
  window.__translateWritePrimary = (raw) => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
      throw new Error('translate fixture has no active durable primary slot')
    }
    sessions.primary.game = raw.state.game
    sessionStorage.setItem('__translate-primary-fixture-v1', JSON.stringify({
      sessions: JSON.stringify(saved), cache: JSON.stringify(raw),
    }))
  }
})
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const lookedUp = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.lookedUp ?? [])

try {
  // Start through Home's normal primary path. The old first=player shortcut
  // creates a transient debug game rather than the durable session that
  // Continue board owns.
  await page.goto(`${preview.base}?mock=1&howto=0`)
  await page.waitForSelector('.city-card')
  // Home's primary is the Café puzzle tag since CW-10 (Play's successor).
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  // Casey normally opens. Move this durable attempt to the player composer
  // through its session authority, then resume it the same way a real player
  // does; this preserves the dictionary coverage without relying on the
  // transient first=player developer fixture.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    raw.state.game.turn = 'player'
    raw.state.game.phase = 'playerClueInput'
    window.__translateWritePrimary(raw)
  })
  await page.reload()
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click() // the Café puzzle tag continues the board (CW-10)
  await page.waitForSelector('.board-grid')
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()

  const board = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    return g.words.map((w) => ({ id: w.wordId, da: w.da, en: w.en }))
  })
  console.log(`board: ${board.map((w) => w.da).join(', ')}`)

  // It lives where the clue is written, not behind a menu. In the composer it
  // is no longer a BOX — K1 took the field and its one answer apart and put
  // them in two different rows of the composer, so what is asserted here is
  // the field itself and the shared line it answers on.
  const box = page.locator('.clue-input')
  const line = page.locator('.clue-input .composer-line')
  check('the lookup is in the clue dock', (await box.locator('.translate-input').count()) === 1)
  check(
    'and it has no box of its own to make the composer taller',
    (await page.locator('.clue-input .translate-box').count()) === 0,
  )

  // And it is a field, not a drawer: typeable with no tap of its own first.
  // It was a <details>, which cost a tap every turn — the component remounts
  // with the phase and a <details> keeps its open state on the element, so it
  // shut itself again each time. This fill would time out against that.
  check(
    'and it is a field you can just type into',
    await box
      .locator('.translate-input')
      .fill('dog', { timeout: 3000 })
      .then(() => true, () => false),
  )
  // Named by its placeholder rather than a label above it: the label was a
  // whole line of a composer that has to fit above a keyboard, spent saying a
  // word the field could say itself. What matters is that it is still named —
  // on screen for everyone, and to a screen reader.
  const field = box.locator('.translate-input')
  check(
    'named on screen without spending a line on a label',
    (await field.getAttribute('placeholder')) === 'Dictionary',
    await field.getAttribute('placeholder'),
  )
  check(
    'and named for a screen reader too',
    /translate/i.test((await field.getAttribute('aria-label')) ?? ''),
    await field.getAttribute('aria-label'),
  )
  check('and no disclosure to open first', (await box.locator('summary').count()) === 0)

  // English in, Danish out — the direction a Danish clue actually needs. ONE
  // answer now (K1), not a four-row scroller: the best hit, its first gloss
  // and a speaker, on the line the verdict shares. The rest of the entry — the
  // other glosses, the example, the slow clip — is behind the tap, which is
  // where it lived anyway; a scrolling list of it was being carried in the one
  // box on the screen whose height is the board's height.
  await sleep(250)
  const answer = await line.innerText()
  check('an English word gives the Danish', answer.includes('hund'), JSON.stringify(answer))
  check('and it is one answer, not a list', (await box.locator('.dict-hit').count()) === 1)

  // And no request was needed: the nine hundred words answer offline. There is
  // no "Ask Casey" button left to press for anything either, which is the
  // other half of the fold — the ask already happens once typing settles.
  check(
    'with no Ask Casey needed, and no button for it anywhere',
    !/Asking Casey/.test(answer) && (await page.locator('.translate-ask').count()) === 0,
  )

  // The whole entry is still reachable: the line is the tap that opens the
  // sheet, and the sheet is where the rest of a long gloss list lives.
  const titled = (await box.locator('.dict-hit').getAttribute('title')) ?? ''
  await box.locator('.dict-hit').click()
  await page.waitForSelector('.sheet', { timeout: 4000 }).catch(() => undefined)
  const sheetGlosses = await page
    .locator('.sheet-glosses')
    .innerText()
    .catch(() => '')
  check(
    'and tapping it opens the sheet for the rest of the entry',
    sheetGlosses.length > 0 && titled.includes(sheetGlosses.split(',')[0].trim()),
    `title ${JSON.stringify(titled)} / sheet ${JSON.stringify(sheetGlosses)}`,
  )
  await page.locator('.sheet .sheet-close').last().click()
  await sleep(300)

  // Looking up an English word whose Danish is ON the board. This is the case
  // that read as a broken dictionary from a phone: "wood" answers "et træ",
  // which is both the correct translation and an illegal clue, with nothing
  // saying so. The board is already on screen, so naming it reveals nothing.
  const boardEn = board[2].en[0]
  await box.locator('.translate-input').fill(boardEn)
  await sleep(400)
  const onBoardLine = await line.innerText()
  check(
    'a hit that is on the board says so, instead of inviting an illegal clue',
    /on the board/.test(onBoardLine),
    `${boardEn} → ${JSON.stringify(onBoardLine)}`,
  )

  // A word outside the set goes to Casey with no second tap, and says so on
  // the same line the answer lands on. The "Ask Casey" button it used to print
  // was a row of its own for a request that was about to happen anyway.
  await box.locator('.translate-input').fill('helicopter')
  await sleep(1400)
  const asking = await line.innerText()
  check(
    'a word outside the set asks Casey with no second tap',
    /Asking Casey|helicopter/.test(asking),
    JSON.stringify(asking),
  )

  // Looking up a BOARD word costs what tapping ⓘ costs. Otherwise this field
  // is a way to read the whole board for nothing. Charged by noteLookup on
  // settled input, which K1 left exactly as it was.
  const before = await lookedUp()
  await box.locator('.translate-input').fill(board[0].en[0])
  await sleep(900)
  const after = await lookedUp()
  check(
    'looking up a board word is charged as a lookup',
    after.includes(board[0].id) && after.length > before.length,
    `${before.length} → ${after.length}`,
  )

  // The other half of the rule: the translation challenge's answer field must
  // not also expose the clue-composer dictionary. Persist the exact primary
  // fixture in both authorities before reload; changing only the old cache is
  // deliberately ignored by the current resume path.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const target = g.words.find((word) =>
      g.reveals[word.wordId].kind === 'hidden' &&
      (g.playerKey[word.wordId] === 'green' || g.aiKey[word.wordId] === 'green'),
    )
    if (!target) throw new Error('translation fixture needs a target')
    g.reveals[target.wordId] = { kind: 'green' }
    g.turnsLeft = 0
    g.phase = 'translateChallenge'
    g.wheel = {
      segments: [target.wordId], translated: [], filled: [], attempts: 0,
      landed: null, result: null, spent: null,
    }
    window.__translateWritePrimary(raw)
  })
  await page.reload()
  await page.locator('.home-play').click() // the Café puzzle tag continues the board (CW-10)
  await page.waitForSelector('.translate-challenge-bar', { timeout: 15000 })
  check(
    'the clue-composer dictionary is gone while a translation answer is due',
    (await page.locator('.translate-input').count()) === 0,
  )
  check('as is the card dictionary while translation is the answer key', (await page.locator('.card-info').count()) === 0)


  check('no page errors', crashes.length === 0, crashes.join(' | '))
  console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nTRANSLATE DRIVE OK')
  if (fail.length) process.exitCode = 1
} catch (e) {
  console.log('TRANSLATE DRIVE FAILED:', e.stack ?? e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
  process.exit(process.exitCode ?? 0)
}
