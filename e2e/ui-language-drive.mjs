// The app in the player's own language: the first-run question, the Settings
// switch, and the promise that neither of them touches a device that has
// already been playing.
//
// What this drives, on the smallest phone we serve (360x640):
//   - a fresh device is asked which language it SPEAKS before the ticket asks
//     which language it wants to LEARN, and asked in the language of the phone
//   - the seven public launch languages are offered, each written in its own
//     name, the phone's own first, and the screen does not scroll with all
//     seven on it. The four retained, non-public catalogues are compiled by
//     catalogue.test.ts; they must not silently leak into the picker.
//   - choosing stores the choice, reloads, declares the language on the
//     document, and hands straight over to the ticket without asking twice
//   - Settings carries the same switch, in the chosen language, and switching
//     again lands in the new one
//   - and a device that has already been playing is never asked, never moved
//     to the phone's language, and lands on Home as it always did
//
// Built in Phase 1a of docs/ui-language-plan.md behind a dev switch, and on for
// everyone since 1g.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4185)
const EXE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const BASE = preview.base
const VP = { width: 360, height: 640 }

const browser = await chromium.launch({ executablePath: EXE })
const errors = []
const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

/** A phone that has never run this app, speaking `locale`. */
async function freshPhone(locale) {
  const ctx = await browser.newContext({ viewport: VP, locale })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${locale}: ${e}`))
  return page
}

// ── a German phone, opening the app for the first time ─────────────────────
const page = await freshPhone('de-DE')
await page.goto(`${BASE}?onboard=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

check(
  'the language question is the first screen on a fresh device',
  (await page.locator('[data-act="language"]').count()) === 1,
)

// It cannot be written in the player's language — it is the screen that finds
// out what that is — so it is written in the phone's, which costs nothing when
// the guess is wrong because every other language is on screen.
const heading = (await page.locator('[data-act="language"] h1').textContent())?.trim()
check(
  'and it is asked in the language of the phone, before any choice',
  heading === 'Welche Sprache sprichst du?',
  heading,
)

const cards = (await page.locator('.onboard-language .ticket-lang').allTextContents()).map((t) =>
  t.trim(),
)
check('every public launch language is offered', cards.length === 7, cards.join(' | '))
check(
  'each written in its own name, the phone’s own first',
  cards[0] === 'Deutsch' &&
    ['中文（简体）', 'Français', 'Português', 'Polski', 'Svenska', 'English'].every(
      (name) => cards.includes(name),
    ),
  cards.join(' | '),
)
check(
  'and not one of them is named in English instead of its own language',
  new Set(cards).size === cards.length && !cards.includes('German') && !cards.includes('Chinese'),
  cards.join(' | '),
)
check(
  'a screen reader is told what each card does',
  (await page.locator('.onboard-language').first().getAttribute('aria-label')) ===
    '900words auf Deutsch verwenden',
)

const actScroll = await page.evaluate(() => [
  document.documentElement.scrollHeight,
  window.innerHeight,
])
check(
  'the public picker and its heading do not scroll at 360x640',
  actScroll[0] <= actScroll[1] + 1,
  `${actScroll[0]}/${actScroll[1]}`,
)

/**
 * The endonym is the whole content of the card and the only thing a lost
 * player can navigate by, so a card that CLIPS it is worse than one that
 * wraps: the no-scroll check above cannot see clipping, exactly as the packing
 * dock's title could not be seen by it. Measured per card, in the grid.
 */
const clipped = await page.evaluate(() =>
  [...document.querySelectorAll('.onboard-language .ticket-lang')]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => `${el.textContent.trim()} (${el.scrollWidth}>${el.clientWidth})`),
)
check('and no language’s own name is cut off in the grid', clipped.length === 0, clipped.join(', '))

const overlap = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.onboard-language')].map((el) =>
    el.getBoundingClientRect(),
  )
  return boxes.filter((b) => b.right > window.innerWidth + 1 || b.left < -1).length
})
check('and no card hangs off the side of a 360px phone', overlap === 0, `${overlap} off-screen`)

// ── choosing ───────────────────────────────────────────────────────────────
await page.locator('.onboard-language').first().click()
await page.waitForTimeout(1200)

check(
  'the choice is stored under its own key',
  (await page.evaluate(() => localStorage.getItem('cluecab-ui-language'))) === 'de',
)
check(
  'the document declares the language it is now written in',
  (await page.evaluate(() => document.documentElement.lang)) === 'de',
)
check('the question is not asked twice', (await page.locator('[data-act="language"]').count()) === 0)
// The whole point of the ordering: the SECOND question, about the language to
// learn, is now readable by someone who answered the first one.
check(
  'and the ticket follows it, without the flow restarting',
  (await page.locator('[data-act="ticket"]').count()) === 1,
)

// ── the switch in Settings ─────────────────────────────────────────────────
await page.goto(`${BASE}?howto=0`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
// The gear by position, not by label: the label is copy and becomes a
// catalogue string, so a selector reading "Settings" would break in exactly
// the languages this drive exists for.
await page.locator('.home-top .icon-btn').first().click()
await page.waitForSelector('.settings-screen', { timeout: 5000 })

// The row that holds the language select, found by what it CONTAINS rather
// than by where it sits: Settings gains and loses rows with the build
// audience, so an index would measure whichever row happened to be first.
const uiLanguageField = page
  .locator('.settings-screen label.field')
  .filter({ has: page.locator('option[value="zh"]') })
  .first()
check(
  'Settings carries the switch, in the language that was chosen',
  (await uiLanguageField.locator('span').first().textContent())?.trim() === 'Deine Sprache',
)
const options = (await uiLanguageField.locator('option').allTextContents()).map((t) => t.trim())
check(
  'and lists the endonyms only, so a player who landed wrong can find their own',
  options.join(',') ===
    'English,Deutsch,Svenska,Polski,Português,中文（简体）,Français',
  options.join(','),
)

await uiLanguageField.locator('select').selectOption('zh')
await page.waitForTimeout(1200)
check(
  'switching again lands in the new language',
  (await page.evaluate(() => localStorage.getItem('cluecab-ui-language'))) === 'zh',
)
check(
  'and the document tag says Simplified, not just Chinese',
  (await page.evaluate(() => document.documentElement.lang)) === 'zh-Hans',
)

// ── a phone we do not speak, and a phone we do ─────────────────────────────
const english = await freshPhone('en-GB')
await english.goto(`${BASE}?onboard=1`, { waitUntil: 'networkidle' })
await english.waitForTimeout(400)
check(
  'an English phone is asked in English',
  (await english.locator('[data-act="language"] h1').textContent())?.trim() ===
    'Which language do you speak?',
)

// This case used to be pt-BR, back when Portuguese was an example of a
// language the public app does not speak. It speaks it now, so the case moved
// to a language that is still unshipped rather than being deleted — and what
// pt-BR does instead is asserted just below, because it is UL13 in action.
const unshipped = await freshPhone('ja-JP')
await unshipped.goto(`${BASE}?onboard=1`, { waitUntil: 'networkidle' })
await unshipped.waitForTimeout(400)
check(
  'a phone speaking no public language is asked in English rather than guessed at',
  (await unshipped.locator('[data-act="language"] h1').textContent())?.trim() ===
    'Which language do you speak?',
)

// A Brazilian phone and a Portuguese phone share a primary subtag, so both
// match, and the pack they land on is the European one (UL13). The cost is
// real and deliberate: this reader will be told about a comboio. What makes
// it acceptable is that every other language is one tap away, which is the
// half worth pinning.
const brazilian = await freshPhone('pt-BR')
await brazilian.goto(`${BASE}?onboard=1`, { waitUntil: 'networkidle' })
await brazilian.waitForTimeout(400)
const brHeading = (await brazilian.locator('[data-act="language"] h1').textContent())?.trim()
check(
  'a Brazilian phone is asked in Portuguese rather than dropped to English',
  brHeading !== 'Which language do you speak?' && (brHeading?.length ?? 0) > 0,
  brHeading,
)
const brCards = (await brazilian.locator('.onboard-language .ticket-lang').allTextContents()).map(
  (t) => t.trim(),
)
check(
  'and Português leads its list, with every other public language one tap away',
  brCards[0] === 'Português' && brCards.length === 7,
  brCards.join(' | '),
)

// ── a device that has already been playing is never asked ──────────────────
//
// UL3, and the case that has to hold hardest now the question is on for
// everyone: an existing phone must not wake up in a new language, or be
// stopped by a screen it has no reason to see. The onboarding gate calls such
// a device a veteran — the rules overlay seen, or words in the SRS map — and a
// veteran goes straight Home. The switch is in Settings if they want it.
const veteran = await freshPhone('de-DE')
await veteran.addInitScript(() => localStorage.setItem('cluecab-howto-v4', '1'))
await veteran.goto(BASE, { waitUntil: 'networkidle' })
await veteran.waitForTimeout(400)
check(
  'a device that has played before is not asked',
  (await veteran.locator('[data-act="language"]').count()) === 0,
)
check(
  'and is left in English rather than moved to the phone’s language',
  (await veteran.evaluate(() => localStorage.getItem('cluecab-ui-language'))) === null &&
    (await veteran.evaluate(() => document.documentElement.lang)) === 'en',
)
check('it lands on Home, as it always did', (await veteran.locator('.home-screen').count()) === 1)

// Every public catalogue must boot and the selected language must cross the
// real browser transport. The four non-public retained catalogues are covered
// by catalogue.test.ts and intentionally cannot be activated through storage.
// Stub only the remote response: this spends no model calls.
for (const code of ['en', 'de', 'sv', 'pl', 'pt', 'zh', 'fr']) {
  const localized = await freshPhone('en-GB')
  await localized.addInitScript((language) => {
    localStorage.setItem('cluecab-ui-language', language)
    localStorage.setItem('cluecab-howto-v4', '1')
  }, code)
  let sent
  await localized.route('**/casey/decision', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ protocol: 1, decision: { ok: true }, report: { arm: 'cluey', refused: false } }),
    })
  })
  await localized.goto(`${BASE}?howto=0`, { waitUntil: 'networkidle' })
  check(`${code}: Home fits`, await localized.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1))
  await localized.locator('.home-top .icon-btn').first().click()
  await localized.locator('[data-action="test-casey"]').click()
  await localized.waitForSelector('.test-ok')
  check(`${code}: the connection request carries the selected language`, sent?.operation === 'ping' && sent?.playerLanguage === code, JSON.stringify(sent))
  check(`${code}: Settings fits`, await localized.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1))
  await localized.context().close()
}

check('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
preview.stop()
console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nUI LANGUAGE DRIVE OK')
if (fail.length) process.exitCode = 1
