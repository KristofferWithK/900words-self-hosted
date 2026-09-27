// The collection lives on one phone. This drives the whole way out and back:
// export, wipe, restore, and prove a merge cannot cost you a green word.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4176
const preview = await startPreview(PORT)

const BASE = preview.base
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept())
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

const openSettings = async (query) => {
  await page.goto(BASE + query)
  await page.waitForSelector('.city-card')
  await page.locator('.icon-btn[aria-label="Settings"]').click()
  await page.waitForSelector('.settings-screen')
}
const retainedWordsOnHome = async () => {
  await page.locator('.settings-screen .icon-btn').click()
  await page.waitForSelector('.city-card')
  // Home now names postcard readiness, not the old loose word total. Read the
  // same persisted SRS proof that the backup merge protects after verifying
  // the player has returned to Home.
  return retainedCollected()
}
const cityScopedWordsOnHome = async () => {
  await page.locator('.settings-screen .icon-btn').click()
  await page.waitForSelector('.city-card')
  await page.locator('.cluey-button').click()
  await page.waitForSelector('.suitcase-screen')
  const count = await page.locator('.case-word-collection .case-collected').count()
  await page.locator('.suitcase-screen .icon-btn[aria-label="Back"]').click()
  await page.waitForSelector('.city-card')
  return count
}
const postcardBalance = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-srs-v1') ?? '{}').state?.translationPostcards ?? 0,
  )
const retainedCollected = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('cluecab-srs-v1')).state.stats)
  .filter(record => record.greenByClue > 0 && record.greenByGuess > 0).length)

try {
  // A collection worth losing: 34 green words in Kolding.
  await openSettings('?mock=1&howto=0&city=2&learned=34&jokers=3')
  await page.locator('.backup-fallback').first().click()
  await page.locator('.backup-paste .btn-small').first().click()
  await sleep(300)
  const saved = await page.evaluate(() => navigator.clipboard.readText())
  const parsed = JSON.parse(saved)
  if (parsed.app !== 'cluecabulary') throw new Error('clipboard did not hold a backup')
  console.log(`exported: ${Object.keys(parsed.srs.stats).length} word records, city ${parsed.journey.cityIndex}`)
  if (parsed.srs.translationPostcards !== 3) throw new Error(`backup lost postcard balance: ${parsed.srs.translationPostcards}`)
  console.log('exported: 3 translation postcards')

  // The one thing a backup exists for: the file must not carry the API key.
  if (/apiKey|sk-|Bearer/i.test(saved)) throw new Error('backup leaked a credential')
  console.log('no credential in the file')

  // Wipe it the way a player would, then confirm it is really gone.
  await page.locator('.btn-danger').click()
  await sleep(400)
  const afterReset = await retainedWordsOnHome()
  if (afterReset !== 0) throw new Error(`reset left ${afterReset} learned words`)
  const resetAuthorities = await page.evaluate(() => ({
    ledger: JSON.parse(localStorage.getItem('cluecab-settlement-v1')),
    curriculum: JSON.parse(localStorage.getItem('cluecab-curriculum-v1')).state,
    survival: JSON.parse(localStorage.getItem('cluecab-survival-v1')).state,
  }))
  for (const records of [resetAuthorities.ledger.settlements, resetAuthorities.ledger.facts.boards,
    resetAuthorities.curriculum.settlementMilestones, resetAuthorities.survival.settlementMilestones,
    resetAuthorities.curriculum.settlementEffects, resetAuthorities.survival.settlementEffects]) {
    if (Object.keys(records).length) throw new Error('reset retained receipt or lesson authority')
  }
  if (resetAuthorities.ledger.facts.legacyCredit.amount !== 0) throw new Error('reset retained legacy credit')
  console.log('after reset: 0 learned')

  // Restore, and check every part came back.
  await page.locator('.icon-btn[aria-label="Settings"]').click()
  await page.waitForSelector('.settings-screen')
  await page.locator('.backup-fallback').first().click()
  await page.locator('.backup-paste textarea').fill(saved)
  await page.locator('.backup-paste .btn-small').nth(1).click()
  await page.waitForSelector('.backup-preview')
  const preview34 = await page.locator('.backup-preview li').first().textContent()
  console.log('preview says:', preview34.replace(/\s+/g, ' ').trim())
  await page.locator('.backup-choice .btn-primary').click()
  await page.waitForSelector('.test-ok')
  const scopedRestored = await cityScopedWordsOnHome()
  if (scopedRestored !== 0) throw new Error(`City 2 records leaked into City 1 Home: ${scopedRestored}`)
  const restored = await retainedCollected()
  if (restored !== 34) throw new Error(`restore gave ${restored} learned words, expected 34`)
  console.log(`restored: ${restored} learned`)

  const city = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}').state?.cityIndex,
  )
  // C1-06/v7 compatibility successor: route history survives without granting
  // access beyond the only developed normal-audience destination.
  if (city !== 0) throw new Error(`restore bypassed launch scope: live city ${city}`)
  const historicalCity = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-journey-v2')).state.historicalRoutes.da.cityIndex)
  if (historicalCity !== 2) throw new Error(`restore lost city-2 history: ${historicalCity}`)
  console.log('journey restored: live city 0, preserved city-2 history')
  if ((await postcardBalance()) !== 3) throw new Error(`restore gave ${await postcardBalance()} postcards, expected 3`)
  console.log('restored: 3 translation postcards')

  // Merging must never cost a green. Knock the device back to ten green words,
  // fold the thirty-four-word backup in, and all thirty-four must survive.
  await page.goto(`${BASE}?mock=1&howto=0`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-srs-v1')
    localStorage.removeItem('cluecab-journey-v2')
  })
  await openSettings('?mock=1&howto=0&city=2&learned=10')
  await page.locator('.backup-fallback').first().click()
  await page.locator('.backup-paste textarea').fill(saved)
  await page.locator('.backup-paste .btn-small').nth(1).click()
  await page.waitForSelector('.backup-preview')
  await page.locator('.backup-choice .btn-primary').click()
  await page.waitForSelector('.test-ok')
  const scopedMerged = await cityScopedWordsOnHome()
  if (scopedMerged !== 0) throw new Error(`Merged City 2 records leaked into City 1 Home: ${scopedMerged}`)
  const merged = await retainedCollected()
  if (merged !== 34) throw new Error(`merge gave ${merged} learned words, expected 34`)
  console.log(`merged 10 + 34 → ${merged} learned, nothing lost`)
  if ((await postcardBalance()) !== 3) throw new Error(`merge gave ${await postcardBalance()} postcards, expected 3`)
  const readAuthority = () => page.evaluate(() => Object.fromEntries(['cluecab-settlement-v1', 'cluecab-curriculum-v1', 'cluecab-survival-v1']
    .map(key => [key, localStorage.getItem(key)])))
  const beforeRepeatedMerge = await readAuthority()
  // Replaying the same merge must preserve the maximum balance, never add it.
  await page.locator('.icon-btn[aria-label="Settings"]').click()
  await page.waitForSelector('.settings-screen')
  await page.locator('.backup-fallback').first().click()
  await page.locator('.backup-paste textarea').fill(saved)
  await page.locator('.backup-paste .btn-small').nth(1).click()
  await page.waitForSelector('.backup-preview')
  await page.locator('.backup-choice .btn-primary').click()
  await page.waitForSelector('.test-ok')
  if ((await postcardBalance()) !== 3) throw new Error(`repeated merge doubled postcards to ${await postcardBalance()}`)
  if (JSON.stringify(await readAuthority()) !== JSON.stringify(beforeRepeatedMerge)) throw new Error('repeated merge changed receipt or lesson authority')
  console.log('repeated merge kept 3 translation postcards')
  await retainedWordsOnHome()
  const repeatedMerged = await retainedCollected()
  if (repeatedMerged !== 34) throw new Error(`repeated merge disturbed the collection: ${repeatedMerged}`)

  // A file from somewhere else must be refused, not half-eaten.
  await page.locator('.icon-btn[aria-label="Settings"]').click()
  await page.waitForSelector('.settings-screen')
  await page.locator('.backup-fallback').first().click()
  await page.locator('.backup-paste textarea').fill('{"some":"other app"}')
  await page.locator('.backup-paste .btn-small').nth(1).click()
  await page.waitForSelector('.backup-error')
  console.log('rejected junk:', (await page.locator('.backup-error').textContent()).trim())
  if (await page.locator('.backup-preview').count()) throw new Error('junk reached the restore step')
  await retainedWordsOnHome()
  const survived = await retainedCollected()
  if (survived !== 34) throw new Error(`a rejected file disturbed the collection: ${survived}`)

  console.log('BACKUP DRIVE OK')
} catch (e) {
  console.log('BACKUP DRIVE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}
