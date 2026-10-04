// Casey's sticker on Home counts the words collected (owner, 2026-09-30). It
// was the daily streak; players come back because the game is fun and the
// case is filling up, not for fear of losing a streak (docs/DECISIONS.md Q01).
// The streak ledger still exists for the reminder, so this drive seeds a
// streak too and checks the sticker does NOT show it.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'

const preview = await startPreview(4272)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
const failed = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed.push(name)
}

const localKey = (offset) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const stats = (greenByClue, greenByGuess) => ({
  box: 1, lastSeenAt: Date.now(), seen: 1, correctGuesses: 1, misses: 0, lookups: 0,
  redemptionRight: 0, redemptionWrong: 0, greenByClue, greenByGuess,
})

// A three-day streak, and a case holding two collected City 1 words (clued
// green and guessed green) beside one that is only discovered (clued, never
// guessed). The sticker must read 2: not 3 (the streak) and not 3 (every word
// met).
// Since CW-11 a word is collected at three marks: a photo, a guess and a
// clue. "by" and "land" have all three; "klokke" has a photo and a clue only.
await page.addInitScript(({ days, srs, photos }) => {
  localStorage.setItem('cluecab-streak-v1', JSON.stringify({ state: { completedDays: days }, version: 1 }))
  localStorage.setItem('cluecab-srs-v1', JSON.stringify({ state: srs, version: 7 }))
  if (!localStorage.getItem('cluecab-journey-v2')) {
    localStorage.setItem('cluecab-journey-v2', JSON.stringify({ state: { cityIndex: 0, wrapped: {}, photos }, version: 7 }))
  }
}, {
  days: { [localKey(0)]: 2, [localKey(1)]: 1, [localKey(2)]: 1 },
  photos: Object.fromEntries(['da:by', 'da:land', 'da:klokke'].map((id) => [id, { [localKey(1)]: Date.now() - 86_400_000 }])),
  srs: {
    stats: { 'da:by': stats(1, 1), 'da:land': stats(2, 1), 'da:klokke': stats(1, 0) },
    games: { played: 3, won: 2, redeemed: 0, lost: 1 },
    translationPostcards: 0,
    settlementEffects: {},
  },
})

try {
  await page.goto(`${preview.base}?mock=1&howto=0`)
  await page.waitForSelector('.home-screen')
  const sticker = (await page.locator('.cluey-collected-number').textContent())?.trim()
  check('Casey wears the words collected as a pencil number', sticker === '2', `sticker ${sticker}`)
  check('and no longer the daily streak', (await page.locator('.cluey-streak-number').count()) === 0)
  // A new profile is inside the intro window, which opens on the first
  // critical tip (CRITICAL_TIPS in src/ui/cluey-tips.ts), so that is the line
  // this Home must show beside the sticker.
  const bubble = (await page.locator('.cluey-bubble').innerText()).trim()
  check('and the bubble beside her opens on the first critical tip',
    /While you guess, it is Casey's greens that count\./.test(bubble), bubble)
  const layout = await page.evaluate(() => ({ document: document.documentElement.scrollHeight, viewport: innerHeight }))
  check('the sticker Home keeps the phone document fixed', layout.document <= layout.viewport + 1, `${layout.document}/${layout.viewport}`)
  // The suitcase says the same number inside: tap Casey, choose All.
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  await page.locator('.case-filter .chip').first().click()
  const lid = (await page.locator('.case-panel-lid .case-band-label').innerText()).trim()
  check('the suitcase lid counts the same words', /\b2\b/.test(lid), lid)
} catch (error) {
  console.log('CASEY STICKER DRIVE FAILED:', error.message)
  failed.push('casey sticker drive threw')
} finally {
  await browser.close()
  preview.stop()
}

console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nCASEY STICKER DRIVE OK')
if (failed.length) process.exitCode = 1
