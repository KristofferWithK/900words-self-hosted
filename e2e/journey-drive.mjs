// Drives the first ordinary journey leg: a packed suitcase boards the train,
// the ride into Ribe teaches chapter two and plays its continuous Danish
// performance, Skip arrives, and both reached chapters remain in the library
// afterwards.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { silentMp3 } from '../scripts/silent-mp3.mjs'
import { startPreview } from './preview-server.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHAPTER_DIR = resolve(ROOT, 'dist', 'audio', 'da', 'chapter')
const CHAPTER_BACKUP = resolve(ROOT, 'dist', '.journey-drive-chapter-backup')
const TIMING_PATH = resolve(ROOT, 'dist', 'chapter-timings.da.json')
const TIMING_BACKUP = existsSync(TIMING_PATH) ? readFileSync(TIMING_PATH) : null
const chapterSource = JSON.parse(readFileSync(resolve(ROOT, 'src/data/chapter-audio.da.json'), 'utf8'))
const ribePerformance = chapterSource.entries.find((entry) => entry.cityIndex === 1)
if (!ribePerformance || ribePerformance.linesDa.length === 0) {
  throw new Error('the S3 Ribe fixture no longer matches the accepted chapter source')
}

// Never overwrite a real manual S3 bake while measuring the behaviour. The
// deterministic fixture is long enough to seek/highlight every current line, while
// its silent bytes make no claim about how the eventual voice will sound.
const hadChapterBake = existsSync(CHAPTER_DIR)
if (hadChapterBake) {
  rmSync(CHAPTER_BACKUP, { recursive: true, force: true })
  cpSync(CHAPTER_DIR, CHAPTER_BACKUP, { recursive: true })
}
rmSync(CHAPTER_DIR, { recursive: true, force: true })
mkdirSync(CHAPTER_DIR, { recursive: true })
writeFileSync(resolve(CHAPTER_DIR, `${ribePerformance.id}.mp3`), silentMp3(7500))
writeFileSync(TIMING_PATH, `${JSON.stringify({
  language: 'da',
  entries: [{
    id: ribePerformance.id,
    sourceHash: ribePerformance.sourceHash,
    duration: 7.5,
    starts: ribePerformance.linesDa.map((_, index) => index * (7.5 / ribePerformance.linesDa.length)),
  }],
})}\n`)

const PORT = 4177
const preview = await startPreview(PORT)
const SHOT_DIR = process.env.SHOT_DIR ?? '.'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
page.on('pageerror', (error) => console.log('PAGE CRASH:', error.message))
// A silent fixture cannot prove that an obsolete continuation did not reach
// Audio. Count calls to `play()` instead: a Stop or Skip while the timing map
// is held must leave this empty after the request is released.
await page.addInitScript(() => {
  window.__chapterAudioStarts = []
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__chapterAudioStarts.push(this.currentSrc || this.src)
    return play.apply(this, args)
  }
})
const chapterResponses = []
const timingResponses = []
page.on('response', (response) => {
  if (response.url().includes('/audio/da/chapter/')) chapterResponses.push(response.url())
  if (response.url().includes('/chapter-timings.da.json')) timingResponses.push(response.url())
})

const journeyState = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-journey-v2') ?? '{}').state)

/** Hold exactly one timing fetch so Stop/Skip can race the async player. */
async function holdNextTimingFetch() {
  let release
  let held
  let settled
  const released = new Promise((resolve) => { release = resolve })
  const seen = new Promise((resolve) => { held = resolve })
  const continued = new Promise((resolve, reject) => { settled = { resolve, reject } })
  const handler = async (route) => {
    held()
    await released
    try {
      await route.continue()
      settled.resolve()
    } catch (error) {
      settled.reject(error)
    }
  }
  await page.route('**/chapter-timings.da.json**', handler)
  return {
    seen,
    release: async () => {
      release()
      await continued
    },
    remove: () => page.unroute('**/chapter-timings.da.json**', handler),
  }
}

try {
  await page.goto(`${preview.base}?mock=1&howto=0&city=0&wrapped=100`)
  await page.waitForSelector('.train-board')
  const boardName = await page.locator('.train-board').getAttribute('aria-label')
  if (!boardName?.includes('Ribe')) throw new Error(`the train's name does not say where: ${boardName}`)

  // T1 still boards immediately; T2 changes what that frame teaches.
  await page.click('.train-board')
  await page.waitForSelector('.ride-screen')
  if (await page.locator('.denmark-map').count())
    throw new Error('boarding the train stopped at the map instead of riding')
  const rideLayout = await page.evaluate(() => {
    const reader = document.querySelector('.ride-reader')
    const sheet = reader?.querySelector('.book-page')
    return {
      document: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      reader: reader?.getBoundingClientRect().height ?? 0,
      sheetOverflow: sheet ? sheet.scrollHeight > sheet.clientHeight + 1 : true,
      internalScrollers: reader ? [...reader.querySelectorAll('*')].filter((node) => {
        const overflow = getComputedStyle(node).overflowY
        return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1
      }).length : -1,
    }
  })
  if (rideLayout.document > rideLayout.viewport + 1)
    throw new Error(`the grammar ride grew the document: ${JSON.stringify(rideLayout)}`)
  // The same rule the guide's reader is held to (owner, 2026-09-03): grammar
  // may scroll when it has to, the document may not, and an overflowing sheet
  // must have exactly one scroller to reach the rest with. Ribe's chapter fits
  // today; three others do not, and this leg would ride one of them the moment
  // the fixture city changed — see readableSheet in train-grammar-drive.
  if (rideLayout.reader <= 0 || rideLayout.internalScrollers !== (rideLayout.sheetOverflow ? 1 : 0))
    throw new Error(`the grammar lesson could not be read on the ride: ${JSON.stringify(rideLayout)}`)
  const eyebrow = await page.locator('.ride-bar-label').textContent()
  if (!eyebrow?.includes('Ribe')) throw new Error(`wrong destination: ${eyebrow}`)
  if (!(await page.locator('.ride-reader.guide-grammar-reader').count()))
    throw new Error('the ride is not on the Guide\'s grammar paper')
  const pageNo = async () => (await page.locator('.guide-page-count').textContent())?.trim() ?? ''
  if (!/^1 \/ \d+$/.test(await pageNo()))
    throw new Error(`the Ribe train lesson did not start on its rules page: ${await pageNo()}`)
  const title = await page.locator('.book-page h1').textContent()
  if (title?.trim() !== 'Present-tense clauses') throw new Error(`Ribe’s chapter did not render: ${title}`)
  if (!(await page.getByText('One verb form for every person').count()))
    throw new Error('the ride did not render Ribe’s accepted rule sheet')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  if (!/^2 \/ \d+$/.test(await pageNo()))
    throw new Error(`the Ribe train lesson did not reach its examples page: ${await pageNo()}`)

  const performanceLayout = await page.locator('.chapter-performance').evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  console.log(
    `S3 Ribe fixture: 7.50 s / ${ribePerformance.linesDa.length} lines; performance ${performanceLayout.width.toFixed(1)}×${performanceLayout.height.toFixed(1)} px; ` +
    `ride document ${rideLayout.document}/${rideLayout.viewport}`,
  )
  if (performanceLayout.width <= 0 || performanceLayout.height <= 0)
    throw new Error(`the chapter-performance block has no measured rectangle: ${JSON.stringify(performanceLayout)}`)

  // Check the two runtime assets before asking Audio to decode them. That way a
  // failed fixture, a server MIME regression, and an autoplay/decode fallback
  // are three different failures rather than one vague "Listen did not work".
  const chapterAssets = await page.evaluate(async ({ clip, timings }) => {
    const inspect = async (url) => {
      const response = await fetch(url)
      return {
        url,
        status: response.status,
        type: response.headers.get('content-type') ?? '',
        body: await response.text(),
      }
    }
    return { clip: await inspect(clip), timings: await inspect(timings) }
  }, {
    clip: `audio/da/chapter/${ribePerformance.id}.mp3?v=${ribePerformance.sourceHash.slice(0, 16)}`,
    timings: `chapter-timings.da.json?v=${ribePerformance.sourceHash.slice(0, 16)}`,
  })
  if (chapterAssets.clip.status !== 200 || !chapterAssets.clip.type.startsWith('audio/')) {
    throw new Error(`S3 fixture clip is not playable: ${JSON.stringify(chapterAssets.clip)}`)
  }
  if (chapterAssets.timings.status !== 200 || !chapterAssets.timings.type.startsWith('application/json')) {
    throw new Error(`S3 timing map is not JSON: ${JSON.stringify(chapterAssets.timings)}`)
  }
  if (!chapterAssets.timings.body.includes(ribePerformance.sourceHash)) {
    throw new Error('S3 timing map does not contain Ribe’s accepted source revision')
  }

  await page.click('.chapter-listen')
  await page.waitForSelector('.chapter-stop')
  if (!chapterResponses.some((url) => url.includes(`${ribePerformance.id}.mp3`)))
    throw new Error(`Listen never fetched the continuous chapter clip: ${JSON.stringify(chapterResponses)}`)
  if (!timingResponses.length)
    throw new Error('Listen never fetched the chapter timing map')
  const shownExamples = await page.locator('.book-table tbody tr td:first-child').allTextContents()
  if (JSON.stringify(shownExamples) !== JSON.stringify(ribePerformance.linesDa))
    throw new Error(`the examples page diverged from its audio source: ${JSON.stringify(shownExamples)}`)
  if (await page.locator('.chapter-line').count())
    throw new Error('the compact train recording unexpectedly added a second line-by-line reader')
  await page.click('.chapter-stop')

  // The compact train page exposes one continuous recording control, not the
  // larger line-by-line replay surface retained for non-compact uses.
  await page.click('.chapter-listen')
  await page.waitForSelector('.chapter-stop')
  await page.click('.chapter-stop')
  await page.screenshot({ path: `${SHOT_DIR}/j4-grammar-ride.png` })

  // A Stop is meaningful while timing/decode is still pending. Once it wins,
  // releasing that old fetch may neither start the shared Audio element nor
  // resurrect the old component state. This is deliberately a delayed fetch,
  // rather than a synthetic state test: it has caught both missing UI Stop and
  // a continuation that only checked after `play()` had already started.
  const stoppedFetch = await holdNextTimingFetch()
  await page.evaluate(() => { window.__chapterAudioStarts = [] })
  await page.click('.chapter-listen')
  await stoppedFetch.seen
  await page.waitForFunction(() => document.querySelector('[data-chapter-status="loading"]'))
  if (!(await page.locator('.chapter-stop').count())) {
    throw new Error('a pending chapter performance cannot be stopped')
  }
  await page.click('.chapter-stop')
  await stoppedFetch.release()
  await stoppedFetch.remove()
  await page.waitForTimeout(400)
  const afterStop = await page.evaluate(() => ({
    starts: window.__chapterAudioStarts,
    status: document.querySelector('[data-chapter-status]')?.getAttribute('data-chapter-status'),
  }))
  if (afterStop.starts.length || afterStop.status !== 'ready') {
    throw new Error(`stopped chapter work resumed after its fetch: ${JSON.stringify(afterStop)}`)
  }

  // Skippable, always — and navigation is the same cancellation boundary as
  // Stop. The instance is gone before this held request returns, so neither a
  // late clip nor a late fallback may start talking in the arrival screen.
  const skippedFetch = await holdNextTimingFetch()
  await page.evaluate(() => { window.__chapterAudioStarts = [] })
  await page.click('.chapter-listen')
  await skippedFetch.seen
  await page.waitForFunction(() => document.querySelector('[data-chapter-status="loading"]'))
  await page.click('.ride-skip')
  await page.waitForSelector('.arrival-city')
  await skippedFetch.release()
  await skippedFetch.remove()
  await page.waitForTimeout(400)
  const afterSkip = await page.evaluate(() => window.__chapterAudioStarts)
  if (afterSkip.length) {
    throw new Error(`unmounted chapter work started audio after Skip: ${JSON.stringify(afterSkip)}`)
  }
  const arrived = await page.locator('.arrival-city').textContent()
  if (arrived?.trim() !== 'Ribe') throw new Error(`expected Ribe, got ${arrived}`)
  const state = await journeyState()
  if (state.cityIndex !== 1 || !state.arrivedAt?.['1'])
    throw new Error(`skipping did not arrive in Ribe: ${JSON.stringify(state)}`)

  await page.click('.arrival-screen .btn:not(.btn-primary)')
  await page.waitForSelector('.denmark-map')
  const lessons = page.locator('.map-lessons')
  await lessons.click()
  await page.waitForSelector('.travel-guide-book')
  await page.locator('.guide-section-grammar').click()
  // The Guide's one contents page exposes the whole route. Reached styling is
  // informative only; every future chapter remains readable without credit.
  const chapters = page.locator('.guide-city-row')
  if ((await chapters.count()) !== 9) throw new Error('the Guide contents did not expose all nine destinations')
  // `is-reached` survives in the stylesheet and in nothing else: the Guide's
  // redesign made every chapter readable ahead, which is the line above this
  // one, so counting reached chapters was counting a class the markup stopped
  // carrying. What the contents page does still say is where you are standing.
  const here = await page.locator('.guide-city-row.is-current-city').count()
  if (here !== 1) throw new Error(`the Guide does not mark the city just arrived in: ${here} marked`)
  // A chapter still opens; it just names itself differently since the Guide
  // became a book. The reader's context line is the city and the section
  // ("Ribe grammar"), and the page's own heading is the chapter's topic — so
  // both are asked for, which is more than the one concatenated string these
  // used to compare against.
  const openChapter = async (nth, city, topic) => {
    await chapters.nth(nth).click()
    await page.waitForSelector('.book-page-context')
    const opened = {
      context: (await page.locator('.book-page-context').textContent())?.trim(),
      topic: (await page.locator('.guide-grammar-reader h1').first().textContent())?.trim(),
    }
    if (!opened.context?.includes(city) || !opened.topic?.includes(topic))
      throw new Error(`${city}'s chapter cannot be opened later: ${JSON.stringify(opened)}`)
  }
  await openChapter(0, 'Sønderborg', 'En, et')
  await page.getByRole('button', { name: 'Back to Grammar index' }).click()
  await openChapter(1, 'Ribe', 'Present-tense clauses')

  // Mutation evidence: city three has a genuine source row but no matching
  // timing entry in this controlled fixture. Going offline here also proves
  // the train never treats an unavailable timing/clip fetch as a second gate:
  // it must say the recording did not load rather than assigning its line
  // highlights from Ribe's map — and it must not read the lines in any
  // other voice; there is none.
  const fallbackContext = await browser.newContext({ viewport: { width: 360, height: 640 } })
  const fallbackPage = await fallbackContext.newPage()
  try {
    // Seeded on an ORDINARY web load first, and only then made native. The
    // dev switches are refused on a native platform (`devSwitchesAllowedFor`,
    // since #131: Capacitor serves the installed app from localhost too, so
    // hostname cannot tell a preview from a TestFlight app), and the stub
    // below makes this page native. One load with the switches honoured
    // writes the journey, the stats and the mock setting to the profile; the
    // native load then finds Ribe packed in storage, the way a phone would.
    // The train button is waited for rather than Home alone because the
    // switches run in an effect after the first paint — it is the control
    // that exists only once city two is packed. `train=open`: the launch
    // line is closed past Sønderborg (src/journey/trainService.ts) and a
    // native page cannot ask for it by URL, so the ordinary load remembers
    // the request in session storage — this scenario is about the ride and
    // its chapter, not the closed line, which train-closed-drive covers.
    await fallbackPage.goto(`${preview.base}?mock=1&howto=0&city=1&wrapped=100&train=open`)
    await fallbackPage.waitForSelector('.train-board')
    // A native-entitlement fixture: an iOS StoreKit result boards the same
    // train. With the travel pass off for launch (PASS_GATE_ENABLED) the web
    // load boards too, so what this now proves is that the native platform
    // path — real on a phone — reaches the ride and its chapter.
    await fallbackPage.addInitScript(() => {
      window.webkit = { messageHandlers: { bridge: { postMessage() {} } } }
      window.Capacitor = {
        PluginHeaders: [
          {
            name: 'Pass',
            methods: [
              { name: 'status', rtype: 'promise' },
              { name: 'offers', rtype: 'promise' },
            ],
          },
          // The keyboard hook subscribes on any native platform; without a
          // header it rejects as "not implemented on ios" and prints a page
          // crash that has nothing to do with the train.
          { name: 'Keyboard', methods: [{ name: 'addListener', rtype: 'promise' }] },
        ],
        nativePromise(plugin, method) {
          if (plugin === 'Keyboard') return Promise.resolve({ remove: async () => {} })
          if (method === 'status') return Promise.resolve({ entitled: true, productId: 'com.kristofferwithk.cluecabulary.pass.lifetime' })
          if (method === 'offers') return Promise.resolve({ offers: [] })
          return Promise.reject(new Error(`unexpected mocked Pass method: ${method}`))
        },
      }
    })
    await fallbackPage.goto(`${preview.base}?howto=0`)
    await fallbackPage.waitForSelector('.train-board')
    await fallbackPage.click('.train-board')
    await fallbackPage.waitForSelector('.ride-screen')
    if ((await fallbackPage.locator('.book-page h1').textContent())?.trim() !== 'One noun, more than one') {
      throw new Error('the timing mutation did not enter Kolding’s destination chapter')
    }
    await fallbackPage.getByRole('button', { name: 'Next', exact: true }).click()
    await fallbackContext.setOffline(true)
    await fallbackPage.click('.chapter-listen')
    await fallbackPage.waitForFunction(() =>
      document.querySelector('.chapter-audio-status')?.textContent?.includes('did not load'),
    )
    await fallbackPage.click('.ride-skip')
    await fallbackPage.waitForSelector('.arrival-city')
  } finally {
    await fallbackContext.close()
  }

  console.log('JOURNEY DRIVE OK')
} catch (error) {
  await page.screenshot({ path: `${SHOT_DIR}/j9-failure.png` }).catch(() => {})
  console.log('JOURNEY DRIVE FAILED:', error.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
  rmSync(CHAPTER_DIR, { recursive: true, force: true })
  if (hadChapterBake) {
    cpSync(CHAPTER_BACKUP, CHAPTER_DIR, { recursive: true })
    rmSync(CHAPTER_BACKUP, { recursive: true, force: true })
  }
  if (TIMING_BACKUP) writeFileSync(TIMING_PATH, TIMING_BACKUP)
  else rmSync(TIMING_PATH, { force: true })
}
