// C1-17 successor for the retired post-wrap handoff. The former drive proved
// that a completed wrap-up offered Grammar/Survival/Both. Wrap-up no longer
// exists: prove the old fixture reaches ordinary Home, from which a primary
// can pause and Casey's collection remains a separate, finite destination.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'

const preview = await startPreview(4261)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
await installRoundGuidanceHandler(page)
const failures = []
const external = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith(preview.base) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
page.on('pageerror', (error) => failures.push(`page error: ${error.message}`))

try {
  // The old route parameters stand in for persisted historical wrap progress:
  // they are not allowed to resurrect its completion screen, packing phase or
  // its former language-stop choices.
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&collected=40&wraps=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.home-screen')
  const legacySurface = await page.locator('body').innerText()
  check('the retired wrap-up fixture opens ordinary Home, not a completion surface',
    await page.locator('.round-summary, .packing-dock, .summary-wrap-actions, .wrap-next-heading').count() === 0,
  )
  check('the retired Grammar, Survival and Both choices have no live entry point',
    !/What’s next\?|Continue wrap-up|Pack the board/i.test(legacySurface),
    legacySurface.replace(/\s+/g, ' ').slice(0, 240),
  )

  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.locator('.game-header .icon-btn[aria-label="Home"]').click()
  await page.getByRole('button', { name: 'Pause game', exact: true }).click()
  await page.waitForSelector('.home-screen')
  check('the successor primary pauses as a resumable ordinary attempt',
    await page.locator('.home-play').innerText() === 'Continue board',
  )

  await page.locator('.cluey-button').click()
  await page.waitForSelector('.casey-board-collection')
  await page.waitForSelector('.collection-board-slot')
  const collectionText = await page.locator('.casey-board-collection').innerText()
  check('Casey collection is the finite successor to the retired wrap compartment',
    await page.locator('.collection-board-slot').count() === 10,
  )
  check('the collection retains no retired packing action or wrap-only choice',
    !/pack the board|continue wrap-up|grammar|survival|both/i.test(collectionText),
    collectionText.replace(/\s+/g, ' ').slice(0, 240),
  )
  const geometry = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight, height: innerHeight }))
  check('the retired-route successor remains fixed on the 360x640 phone', geometry.scroll <= geometry.height + 1, `${geometry.scroll}/${geometry.height}`)

  // The positive half of the replacement contract: Grammar and Survival did
  // not disappear with the wrap-up choices. They remain optional, readable
  // Travel Guide sections, and visiting either may not settle a game, advance
  // the journey or disturb the parked primary.
  await page.locator('.suitcase-screen .screen-header .icon-btn').click()
  await page.waitForSelector('.home-screen')
  const beforeGuide = await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
    const ledger = JSON.parse(localStorage.getItem('cluecab-settlement-v1') ?? '{}')
    const journey = JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}')
    const srs = JSON.parse(localStorage.getItem('cluecab-srs-v1') ?? '{}').state
    return {
      primary: JSON.stringify(sessions?.primary ?? null),
      receipts: Object.keys(ledger.settlements ?? {}).length,
      journey: JSON.stringify(journey),
      gamesPlayed: srs?.games?.played ?? 0,
    }
  })
  await page.locator('.home-guide-button').click()
  await page.waitForSelector('.guide-cover-screen')

  await page.locator('.guide-section-grammar').click()
  check('Grammar remains an optional Guide section with all nine authored cities',
    (await page.locator('.guide-thumb-grammar[aria-current="page"]').count()) === 1 &&
      (await page.locator('.guide-city-row').count()) === 9,
  )
  await page.locator('.guide-city-row.is-current-city').click()
  await page.waitForSelector('.guide-grammar-reader .book-page-body')
  check('Grammar opens readable authored content rather than a wrap-up choice',
    (await page.locator('.guide-grammar-reader .book-page-body').count()) === 1 &&
      (await page.locator('.summary-wrap-actions, .packing-dock').count()) === 0,
  )
  await page.getByRole('button', { name: 'Back to Grammar index' }).click()
  check('Grammar returns to the complete Guide contents', await page.locator('.guide-city-row').count() === 9)

  await page.locator('.guide-section-survival').click()
  check('Survival remains an optional Guide section with all nine authored cities',
    (await page.locator('.guide-thumb-survival[aria-current="page"]').count()) === 1 &&
      (await page.locator('.guide-city-row').count()) === 9,
  )
  await page.locator('.guide-city-row.is-current-city').click()
  await page.waitForSelector('.survival-exchange-page')
  check('Survival opens a readable exchange without a wrap-up completion control',
    (await page.locator('.survival-exchange-page').count()) === 1 &&
      (await page.getByRole('button', { name: /Mark read|Read again/ }).count()) === 0 &&
      (await page.locator('.summary-wrap-actions, .packing-dock').count()) === 0,
  )
  await page.getByRole('button', { name: 'Back to Survival index' }).click()
  check('Survival returns to the complete Guide contents', await page.locator('.guide-city-row').count() === 9)

  const afterGuide = await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
    const ledger = JSON.parse(localStorage.getItem('cluecab-settlement-v1') ?? '{}')
    const journey = JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}')
    const srs = JSON.parse(localStorage.getItem('cluecab-srs-v1') ?? '{}').state
    return {
      primary: JSON.stringify(sessions?.primary ?? null),
      receipts: Object.keys(ledger.settlements ?? {}).length,
      journey: JSON.stringify(journey),
      gamesPlayed: srs?.games?.played ?? 0,
    }
  })
  check('reading either Guide section leaves progression, receipts and the parked primary unchanged',
    JSON.stringify(afterGuide) === JSON.stringify(beforeGuide),
    JSON.stringify({ before: beforeGuide, after: afterGuide }),
  )
  check('no external request occurs while reconciling the retired route', external.length === 0, external.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures.length ? `\nFAILED: ${failures.join(', ')}` : '\nRETIRED POST-WRAP SUCCESSOR DRIVE OK')
if (failures.length) process.exitCode = 1
