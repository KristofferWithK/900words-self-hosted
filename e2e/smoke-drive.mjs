// Manual-style smoke drive of the built app with the mock companion.
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'
import { createOnboardingFlow } from './_onboarding-flow.mjs'
import { city1ReaderState } from './city1-review-geometry.mjs'
import { audioSlug } from '../scripts/audio-slug.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * How many clips of each bake this build actually carries.
 *
 * The type assertion below can only be made about a bake that exists, and the
 * two are baked by separate CI runs — a tree can honestly be between them, as
 * this one was for nine minutes when the words were re-baked at 1.0 and the
 * 0.6 set moved to slow/. Counting first means the drive says "the ordinary
 * bake is missing" instead of "the app is silent", and stays strict about
 * whichever bake IS there.
 */
const clipCount = (...parts) => {
  try {
    return readdirSync(resolve(ROOT, 'dist', 'audio', ...parts)).filter((f) => f.endsWith('.mp3'))
      .length
  } catch {
    return 0
  }
}
const NORMAL_CLIPS = clipCount('da')
const SLOW_CLIPS = clipCount('da', 'slow')
const EXAMPLE_CLIPS = clipCount('da', 'example')
console.log(`clips in dist: ${NORMAL_CLIPS} ordinary, ${SLOW_CLIPS} slow, ${EXAMPLE_CLIPS} examples`)

const PORT = 4173
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
await page.addInitScript(() => {
  window.__smokeAudioStarts = []
  window.addEventListener('cluecab-audio', (event) => window.__smokeAudioStarts.push(event.detail))
})
page.on('console', (m) => m.type() === 'error' && console.log('PAGE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE CRASH:', e.message))

try {
  // No ?first= pin: nothing this onboarding deals reads one. The practice
  // board and the first full board both name Casey as the opener (owner,
  // 2026-09-26; #298), so the first full board is played from her clue, and
  // the composer is walked on the player's own clue turn after it.
  await page.goto(preview.base + '?mock=1&seed=5')

  // The intro begins by asking which language you SPEAK, then hands over to
  // the country ticket — which language you want to LEARN — and then reveals
  // the real Home in place. Skipping the compact neutral practice board now
  // enters the pinned first normal round directly; onboarding-drive owns the
  // complete practice/real-round/suitcase hand-off and the language act's own
  // behaviour.
  //
  // Answering reloads the app, which is how the choice takes effect, so the
  // ticket is waited for after that rather than before it. The ticket act
  // offers every shipped course (Danish and German since #320/#322), so the
  // smoke takes the Danish one by name, as the onboarding drives do.
  await page.waitForSelector('[data-act="language"]')
  await page.locator('.onboard-language').first().click()
  await page.waitForSelector('.onboard-ticket')
  const onboardingFlow = createOnboardingFlow(page)
  await onboardingFlow.ticketToHome('Denmark')
  await page.screenshot({ path: `${SHOT_DIR}/00-home-intro.png` })
  await onboardingFlow.homeToTutorial()
  if ((await page.locator('.tutorial-game .word-card').count()) !== 9) throw new Error('practice board is not the 3×3 tutorial grid')
  if ((await page.locator('.tutorial-game .mykey-green').count()) !== 0) throw new Error('practice board revealed the player key too early')
  await page.screenshot({ path: `${SHOT_DIR}/00b-tutorial.png` })
  await page.locator('.tutorial-game .onboard-skip').click()
  await page.waitForSelector('.board-grid')
  const firstNormalCards = await page.locator('.word-card .card-word').count()
  if (firstNormalCards !== 18) throw new Error(`tutorial skip did not open the pinned 3×6 board: ${firstNormalCards} cards`)
  const onboardStep = await page.evaluate(() => localStorage.getItem('cluecab-onboard-v5'))
  if (onboardStep !== 'real-round') throw new Error(`tutorial skip left onboarding at ${onboardStep ?? '(missing)'}`)
  await page.screenshot({ path: `${SHOT_DIR}/01-real-round.png` })

  // Listening BEFORE the deal: the board's clips are fetched the moment it is
  // dealt, four at a time, and all eighteen have arrived before a drive that
  // starts listening after the screenshot below gets there. Every audio
  // request from here on is in this list; each check slices from its own mark.
  const audioHits = []
  page.on('response', (r) => {
    if (r.url().includes('/audio/')) {
      audioHits.push({
        url: r.url(),
        status: r.status(),
        type: r.headers()['content-type'] ?? '',
      })
    }
  })
  // Skip already dealt the first normal board; keep the smoke on that board so
  // its audio and dictionary checks exercise the accepted onboarding hand-off.
  await page.screenshot({ path: `${SHOT_DIR}/02-board.png` })
  const cards = await page.locator('.word-card .card-word').allTextContents()
  console.log('BOARD:', cards.join(', '))

  // ---- tapping a word says it ----------------------------------------------
  // The board was the one surface where a word could be touched without being
  // heard: the guess-confirm button spoke and the packing hit spoke, so the
  // word arrived only at the moment of committing to it, never while it was
  // being read.
  //
  // Asserted from the player's audio-start event. The board readies clips on
  // deal, and nouns say their article before the final word, so a fixed short
  // network wait can observe only «et» and falsely call the requested word
  // silent. The event is emitted at playback start and carries the clip URL.
  //
  // On the CONTENT TYPE, not the status, and that distinction is the whole
  // assertion. `vite preview` answers an unknown path with index.html and a
  // 200, so a status check here passes with the clips deleted — this check was
  // written that way first and was demonstrated to pass against an empty
  // dist/audio, which is the vacuous-drive trap this repo has been caught by
  // twice. 854 bytes of text/html is not a word being spoken. (speak.ts checks
  // the type for the same reason at runtime: caching HTML under a clip's URL
  // would keep it for a year.)
  // Use an actual noun: one tap must start the visible article and then its
  // final word clip. The last card was only accidentally a noun on one seed.
  const tapCard = page.locator('.word-card').filter({ has: page.locator('.card-article') }).last()
  const tapWord = (await tapCard.locator('.card-word').textContent()).trim()
  const tapArticle = (await tapCard.locator('.card-article').textContent()).trim()
  const wantSlug = `${audioSlug(tapWord)}.mp3`
  const articleSlug = `${audioSlug(tapArticle)}.mp3`
  const audioMark = await page.evaluate(() => window.__smokeAudioStarts.length)
  await tapCard.click()
  // A City 1 noun is ONE performance with its article since 2026-09-26
  // («et hus» → phrase/et-hus.mp3); any other noun still chains the article
  // clip and the word. Either way the tap must start what the card prints.
  const phraseSlug = `${audioSlug(`${tapArticle} ${tapWord}`)}.mp3`
  await page.waitForFunction(({ mark, article, word, phrase }) => {
    const starts = window.__smokeAudioStarts.slice(mark).map((entry) =>
      new URL(String(entry?.url ?? ''), location.href).pathname,
    )
    if (starts.some((path) => path.endsWith(`/phrase/${phrase}`))) {
      return !starts.some((path) => path.includes('/article/'))
    }
    const articleAt = starts.findIndex((path) => path.endsWith(`/article/${article}`))
    const wordAt = starts.findIndex((path) => !path.includes('/article/') && path.endsWith(`/${word}`))
    return articleAt >= 0 && wordAt > articleAt
  }, { mark: audioMark, article: articleSlug, word: wantSlug, phrase: phraseSlug }, { timeout: 4_000 })
  const starts = await page.evaluate((mark) => window.__smokeAudioStarts.slice(mark), audioMark)
  let hit = audioHits.find((h) => new URL(h.url).pathname.endsWith(`/${wantSlug}`))
  // The tutorial can warm the same decoded word before this listener is
  // installed. In that case the start event above is still the exact playback
  // proof; probe the packaged URL once so the content-type assertion remains
  // strict without requiring a duplicate network request from the player.
  if (!hit) {
    const response = await page.request.get(new URL(`audio/da/${wantSlug}`, preview.base).href)
    hit = {
      url: response.url(),
      status: response.status(),
      type: response.headers()['content-type'] ?? '',
    }
  }
  if (NORMAL_CLIPS === 0) {
    console.log(
      `NOTE: no ordinary bake in dist (${SLOW_CLIPS} slow clips present), so the tap could only ` +
        `be checked for asking. Run bake-audio.yml.`,
    )
  } else if (!hit.type.startsWith('audio/')) {
    throw new Error(
      `${wantSlug} came back ${hit.status} ${hit.type || '(no type)'} — that is the ` +
        `preview server's index.html fallback, not a clip. The build has no word audio.`,
    )
  } else {
    console.log(`tap spoke: ${tapArticle} ${tapWord} -> ${wantSlug} ${hit.status} ${hit.type}`)
  }

  // The tap must NOT have opened the dictionary (U1): "the translation and
  // definition of the word should only appear if you click on the i symbol
  // and not just the word. The audio should still play though." ⓘ alone opens
  // the sheet now, and this used to be a tolerance ("the tap may have opened
  // it") rather than an assertion — that tolerance is the bug U1 closes.
  const opened = await page.locator('.sheet').isVisible().catch(() => false)
  if (opened) throw new Error('tapping the card opened the dictionary — that is ⓘ\'s job now (U1)')

  // ---- ⓘ says the word's short sentence, then 🐢 says the word -------------
  // Looking up a card is a learning moment, so the board's translation door
  // brings its Danish example sentence audibly alongside the English meaning.
  // This belongs here, rather than in DictionarySheet, because the standalone
  // dictionary intentionally stays an explicit-audio surface.
  const beforeInfo = audioHits.length
  await tapCard.locator('..').locator('.card-info').click()
  await page.waitForSelector('.sheet')
  await sleep(600)
  // Since the City 1 sentence bake (2026-09-11) a City 1 word's sheet plays its
  // board sentence recording (audio/da/city1/board/<slug>/v1/normal.mp3) and
  // only a word without one falls back to the example clip.
  const lookupExampleWant = `/audio/da/example/${wantSlug}`
  const lookupBoardWant = `/audio/da/city1/board/${wantSlug.replace(/\.mp3$/, '')}/v1/normal.mp3`
  const lookupExampleHit = audioHits
    .slice(beforeInfo)
    .find((h) => h.url.includes(lookupExampleWant) || h.url.includes(lookupBoardWant))
  if (!lookupExampleHit) {
    throw new Error(
      `ⓘ on «${tapWord}» requested no sentence audio (wanted ${lookupExampleWant} or ${lookupBoardWant}; saw ${
        audioHits
          .slice(beforeInfo)
          .map((h) => h.url)
          .join(', ') || 'nothing'
      })`,
    )
  }
  if (EXAMPLE_CLIPS > 0 && !lookupExampleHit.type.startsWith('audio/')) {
    throw new Error(
      `${lookupExampleWant} came back ${lookupExampleHit.status} ${lookupExampleHit.type || '(no type)'} — the example bake is ` +
        'on disk but the build is not serving it.',
    )
  }
  console.log(`ⓘ spoke example: ${tapWord} -> ${lookupExampleWant} ${lookupExampleHit.status} ${lookupExampleHit.type}`)

  // Two assertions in one gesture. That the button is wired at all, and that
  // it reaches audio/da/slow/ rather than replaying what the card tap above
  // already put in memory — which is the failure the variant-keyed cache in
  // speak.ts exists to prevent, and the one that would look exactly like a
  // working button from the outside.
  //
  // The type check here is unconditional: the slow set is the audio this repo
  // has shipped since the first bake, so an index.html answering for it is a
  // broken build and not a state to be tolerant of.
  //
  // The sheet readies its slow clip the moment it OPENS, so the request is
  // looked for from the ⓘ tap rather than from the slow button's: the button
  // plays what is already there, and a tap that had to fetch first would be
  // the delay the readying exists to remove. What the tap itself is checked
  // for is that nothing said "did not load".
  const slowBtn = page.locator('.sheet-head .speak-btn[aria-label*="slowly"]')
  if (!(await slowBtn.count())) throw new Error('the dictionary sheet has no slow button')
  await slowBtn.click()
  await sleep(600)
  const slowWant = `/audio/da/slow/${wantSlug}`
  const slowHit = audioHits.slice(beforeInfo).find((h) => h.url.includes(slowWant))
  if (!slowHit) {
    throw new Error(
      `opening the sheet on «${tapWord}» readied no slow clip (wanted ${slowWant}; saw ${
        audioHits
          .slice(beforeInfo)
          .map((h) => h.url)
          .join(', ') || 'nothing'
      })`,
    )
  }
  if (await page.locator('.audio-notice[data-audio-failure="word"]').count()) {
    throw new Error(`the slow button on «${tapWord}» reported a failure: ${await page.locator('.audio-notice').textContent()}`)
  }
  if (SLOW_CLIPS > 0 && !slowHit.type.startsWith('audio/')) {
    throw new Error(
      `${slowWant} came back ${slowHit.status} ${slowHit.type || '(no type)'} — the slow bake is ` +
        `on disk but the build is not serving it.`,
    )
  }
  console.log(`🐢 spoke: ${tapWord} -> ${slowWant} ${slowHit.status} ${slowHit.type}`)

  // S2's single Danish example performance is used here as well as on the
  // summary. It has a source-hash query string so an installed PWA cannot keep
  // a pre-correction sentence in its CacheFirst store forever.
  // ⓘ just primed the ordinary example variant, so use the sheet's slow
  // control here: it is the same frozen sentence recording at a learner-paced
  // rate, held under its own player-cache key. That keeps this an assertion
  // that the explicit dictionary control still works rather than asking the
  // browser to fetch an already memoised clip twice.
  const exampleBefore = audioHits.length
  // A City 1 word has a real slow recording since the sentence bake (2026-09-11):
  // audio/da/city1/board/<slug>/v1/slow.mp3, readied when the sheet opens, so the
  // click itself may fetch nothing. The player's own start event is the one
  // observable that sees every start (project guide §6), so watch that too.
  await page.evaluate(() => {
    window.__slowStarts = []
    window.addEventListener('cluecab-audio', (e) => window.__slowStarts.push(String(e.detail?.url ?? '')))
  })
  await page.locator('.sheet-example .speak-btn').last().click()
  await sleep(600)
  const exampleWant = `/audio/da/example/${audioSlug(tapWord)}.mp3?v=`
  const slowBoardWant = `/audio/da/city1/board/${audioSlug(tapWord)}/v1/slow.mp3`
  const exampleHit = audioHits
    .slice(exampleBefore)
    .find((h) => h.url.includes(exampleWant) || h.url.includes(slowBoardWant))
  const slowStarts = await page.evaluate(() => window.__slowStarts)
  const startedSlow = slowStarts.find((u) => u.includes(slowBoardWant) || u.includes(exampleWant))
  if (!exampleHit && !startedSlow) {
    throw new Error(`slow dictionary example neither requested nor started a clip (wanted ${exampleWant} or ${slowBoardWant}; starts: ${JSON.stringify(slowStarts)})`)
  }
  if (EXAMPLE_CLIPS === 0) {
    console.log('NOTE: no example bake in dist; dictionary correctly requested its frozen clip and fell back.')
  } else if (exampleHit && !exampleHit.type.startsWith('audio/')) {
    throw new Error(`slow dictionary example came back ${exampleHit.status} ${exampleHit.type || '(no type)'}, not audio`)
  }
  console.log(`slow dictionary example: ${(exampleHit?.url ?? startedSlow).split('/audio/')[1]}`)
  await page.click('.sheet .sheet-close')

  // A round opens on Danish words and nothing else. No study dock, no glosses.
  // Asserted rather than tolerated: this drive used to accept the study phase if
  // it appeared, so it would have kept passing while every round opened with
  // twelve English translations on screen — which is exactly what a stale
  // persisted setting was still doing.
  if (await page.locator('.study-dock').count()) {
    throw new Error('the round opened with the study phase')
  }
  const openingGlosses = await page.locator('.word-card .card-en').count()
  if (openingGlosses !== 0) {
    throw new Error(`the round opened with ${openingGlosses} translations on the board`)
  }
  console.log(`opened on ${cards.length} Danish words, 0 translations`)

  // One guess on Casey's clue, then stop. The card says the word on
  // selection. Confirmation must only submit that selected guess: replaying it
  // here was audible twice on a real phone even though cache-backed network
  // checks could see just one request. Used twice (the first full board opens
  // on her clue, and she clues again after the player's), so the listener is
  // installed once and only the count is reset per guess.
  async function guessOnceThenStop(shot) {
    console.log('AI clue:', await page.locator('.guess-bar .dock-title').textContent())
    await page.evaluate(() => {
      window.__guessAudioPlays = []
      if (window.__guessAudioListening) return
      window.__guessAudioListening = true
      window.addEventListener('cluecab-audio', (e) => {
        // A noun is said with its article in front («et hus»): two clips,
        // one tap. Counted as one play of the word, which is what the
        // confirm check below is about.
        if (!/\/article\//.test(String(e.detail?.url ?? ''))) window.__guessAudioPlays.push(e.detail?.url)
      })
    })
    await page.locator('.word-card.card-guessable').first().click()
    // Nouns announce their article first; wait for the word event rather than
    // assuming a fixed delay shorter than the player's article guard.
    await page.waitForFunction(
      () => window.__guessAudioPlays.length === 1,
      undefined,
      { timeout: 2_500 },
    )
    const playsAfterTap = await page.evaluate(() => window.__guessAudioPlays.length)
    if (playsAfterTap !== 1) throw new Error(`selecting a guess played it ${playsAfterTap} times, expected 1`)
    await page.locator('.guess-confirm .btn-primary').click()
    await sleep(400)
    const playsAfterConfirm = await page.evaluate(() => window.__guessAudioPlays.length)
    if (playsAfterConfirm !== playsAfterTap) {
      throw new Error(`confirming a selected guess replayed its audio: ${playsAfterTap} then ${playsAfterConfirm}`)
    }
    await page.screenshot({ path: `${SHOT_DIR}/${shot}` })
    console.log('after player guess phase:', await page.locator('.phase-caption').textContent())
    const stop = page.locator('.guess-bar .btn-ghost')
    if (await stop.isVisible().catch(() => false)) await stop.click()
  }

  // The first full board opens on Casey's clue (owner, 2026-09-26; #298), and
  // the composer below is the player's clue turn, which follows hers. So her
  // turn is played first: one guess, then stop, the same as later in the round.
  // A wrong guess spends the turn, so either outcome hands the clue over.
  const openingCaption = await page.locator('.phase-caption').textContent()
  if (!openingCaption?.includes('Your turn')) {
    throw new Error(`the first full board did not open on Casey's clue: ${openingCaption}`)
  }
  await guessOnceThenStop('02b-opening-guess.png')
  await page.waitForSelector('.clue-input input', { timeout: 10_000 })

  // The clue box asks for a Danish word, and it was the only free-text field in
  // the app leaving the phone keyboard's English autocorrect on. What comes
  // back from that is an English word the player never typed — a plausible
  // source of the clue «foster», which is legal, unguessable, and a
  // Danish/English homograph besides.
  const clueAttrs = await page.evaluate(() => {
    const el = document.querySelector('.clue-input input')
    return { correct: el.getAttribute('autocorrect'), spell: el.getAttribute('spellcheck') }
  })
  if (clueAttrs.correct !== 'off' || clueAttrs.spell !== 'false') {
    throw new Error(`clue box still autocorrects: ${JSON.stringify(clueAttrs)}`)
  }

  // A submitted clue is read as intended Danish (#276, 2026-09-25): an English
  // gloss is not a language veto, so the composer neither refuses nor warns
  // about an English-looking word, and the send stays a plain "Give clue".
  // What it still refuses is the board itself, which is the positive control
  // here: a word left on the board must draw a verdict and disable the send,
  // or "no verdict" below would pass on a line that renders nothing. The
  // verdict line no longer echoes a legal clue back as a lookup button either
  // (#284); the Dictionary field beside the clue is where a word is looked up.
  const composer = () => page.evaluate(() => {
    const send = document.querySelector('.clue-input .btn-primary')
    return {
      error: document.querySelector('.clue-input .clue-error')?.textContent ?? '',
      label: send?.textContent ?? '',
      disabled: send ? send.disabled : true,
      echoed: document.querySelectorAll('.clue-input .composer-line .clue-lookup').length,
    }
  })
  const stillOnBoard = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
    return game.words.find((word) => game.reveals[word.wordId]?.kind !== 'green').da
  })
  await page.fill('.clue-input input', stillOnBoard)
  const refused = await composer()
  if (!refused.error || !refused.disabled) {
    throw new Error(`the board word «${stillOnBoard}» was not refused: ${JSON.stringify(refused)}`)
  }
  // «water» is English only; «salt» is both a Danish headword and an English
  // gloss, the word the old warning flagged; the rest are ordinary Danish
  // clues (a compound, an inflection, a word outside the nine hundred). The
  // last one is left unsubmitted: the clue below replaces it on the same turn.
  for (const clue of ['water', 'salt', 'dyreliv', 'trafik', 'kæledyr', 'hunden']) {
    await page.fill('.clue-input input', clue)
    const state = await composer()
    if (state.error || state.disabled || /anyway/.test(state.label)) {
      throw new Error(`«${clue}» was not sendable as intended Danish: ${JSON.stringify(state)}`)
    }
    if (state.echoed) throw new Error(`the verdict line echoed «${clue}» as a lookup button`)
  }
  console.log(`the board word «${stillOnBoard}» is refused; English-looking and Danish clues are sendable, unechoed`)

  // Player clue round
  await page.fill('.clue-input input', 'huskeliste')
  await page.click('.clue-input .btn-primary')
  console.log('clue submitted; waiting for AI guesses…')
  // Wait until phase leaves aiGuessing (AI finishes its guesses)
  await page.waitForFunction(
    () => !document.querySelector('.phase-caption')?.textContent?.includes('Casey is guessing'),
    undefined,
    { timeout: 20000 },
  )
  await page.screenshot({ path: `${SHOT_DIR}/03-after-ai-guess.png` })
  console.log('phase now:', await page.locator('.phase-caption').textContent())

  // If it's now the player's guessing turn (AI gave a clue), make one guess then stop.
  const caption = await page.locator('.phase-caption').textContent()
  if (caption?.includes('Your turn')) await guessOnceThenStop('04-player-guessed.png')

  // Dictionary sheet
  const info = page.locator('.card-info').first()
  if (await info.isVisible().catch(() => false)) {
    await info.click()
    await page.waitForSelector('.sheet')
    await page.screenshot({ path: `${SHOT_DIR}/05-dictionary.png` })
    console.log('dictionary shows:', await page.locator('.sheet h2').textContent())
    await page.click('.sheet .sheet-close')
  }

  if (await page.locator('.game-header .icon-btn[aria-label*="translation"]').count()) {
    throw new Error('the retired whole-board translation control is still visible')
  }

  // ---- an older save must not resurrect a retired setting -----------------
  const V1_SETTINGS = JSON.stringify({
    version: 1,
    state: {
      apiKey: '',
      baseUrl: 'https://example.invalid/v1',
      model: 'm',
      clueLanguage: 'en',
      studyPhase: 'auto',
      useMock: false,
      klausVerifiedAt: null,
    },
  })
  await page.evaluate((blob) => {
    localStorage.clear()
    localStorage.setItem('cluecab-settings-v1', blob)
  }, V1_SETTINGS)
  await page.goto(preview.base + '?mock=1&seed=5&howto=0')
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  if (await page.locator('.study-dock').count()) {
    throw new Error('an upgraded save still opens with the study phase')
  }
  const staleGlosses = await page.locator('.word-card .card-en').count()
  if (staleGlosses !== 0) {
    throw new Error(`an upgraded save opened with ${staleGlosses} translations`)
  }
  const migrated = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-settings-v1')).state.studyPhase,
  )
  if (migrated !== undefined) throw new Error(`studyPhase survived migration: ${migrated}`)
  console.log('a v1 save upgrades to a clean opening board')

  // ---- the local harness says plainly that it is not Casey -------------------
  // `?mock=1` exists only on a dev origin. It must remain conspicuously labelled
  // so an experimental matrix/book harness can never be mistaken for normal
  // model-backed play.
  const note = await page.locator('.practice-note').textContent()
  if (!/Experimental agentless prototype/.test(note ?? '')) {
    throw new Error(`no practice note while on the practice companion: ${note}`)
  }
  if (!/not Casey or normal play/.test(note)) throw new Error(`note is too coy: ${note}`)
  console.log('practice companion says so:', note.replace(/\s+/g, ' ').trim().slice(0, 60) + '…')

  // ---- the round summary: numbers first, the transcript behind a lid -------
  // The turn log used to be a one-line score strip: «mad ✓  hus ·». The model
  // had always written a reason for each guess and the engine dropped it on
  // the floor, so "why that word?" was the one question the app had thrown
  // away. Played out here rather than asserted on a fixture, because the value
  // only exists if the reasoning survives the engine and the store.
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.goto(preview.base + '?mock=1&seed=11&howto=0')
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  // The reader readies its clip as it appears, so its request is looked for
  // from here — before the round has ended — rather than from the Listen tap,
  // which plays what is ready.
  const summaryMark = audioHits.length
  let spunWheel = false
  for (let i = 0; i < 60 && (await page.locator('.round-summary').count()) === 0; i++) {
    // A guidance panel withholds the guessable cards while it is up, so the
    // card check below would find nothing and the blocked-action handler
    // would never run: take the panel's action first. The last chance's
    // panel (2026-09-11) is the one that opens in the middle of this loop.
    await dismissRoundGuidance(page)
    // After the spin the board stays until See results (owner, 2026-09-27).
    const seeResults = page.locator('.wheel-results:not([disabled])')
    if (await seeResults.isVisible().catch(() => false)) await seeResults.click()
    const wheelState = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? 'null')
      const game = raw?.state?.game
      if (!game || (game.phase !== 'translateChallenge' && game.phase !== 'translateWheel')) return null
      const untranslated = (game.wheel?.segments ?? []).filter((id) => game.reveals[id]?.kind === 'green' && !(game.wheel?.translated ?? []).includes(id))
      const answer = untranslated.length
        ? game.words.find((word) => word.wordId === untranslated[0])?.da ?? null
        : null
      return { phase: game.phase, translated: game.wheel?.translated?.length ?? 0, untranslated: untranslated.length, answer }
    })
    if (wheelState?.phase === 'translateChallenge' && wheelState.untranslated > 0) {
      // The wheel challenge is free-type: answer one visible suitcase with its
      // Danish headword, then let the production grader advance the wheel.
      const input = page.locator('.translate-challenge-bar .wheel-input')
      await input.fill(wheelState.answer)
      await page.locator('.translate-challenge-bar .wheel-confirm').click()
      await page.waitForFunction(
        (before) => {
          const raw = JSON.parse(localStorage.getItem('cluecab-game-v1') ?? 'null')
          const translated = raw?.state?.game?.wheel?.translated ?? []
          return translated.length > before
        },
        wheelState.translated,
        { timeout: 5_000 },
      )
    } else if (wheelState && !spunWheel && wheelState.untranslated === 0) {
      await page.locator('.translate-challenge-bar .wheel-disc').click()
      spunWheel = true
    } else {
      const cap = await page.locator('.phase-caption').textContent().catch(() => '')
      if (cap === 'Give Casey a clue') {
        await page.fill('.clue-input input', `huskeliste${i}`)
        await page.click('.clue-input .btn-primary')
        // Anything that is not the clue turn is a turn where the player taps
        // cards, so ask the board rather than the caption. This used to match
        // cap.includes('Sudden'), which the last-chance rename (D5) silently
        // broke: the loop stopped clicking, the round never reached a summary,
        // and the drive failed ten seconds later on .outcome-stats with nothing
        // to say why. The card's own rule is that copy moves and identifiers do
        // not — so a drive should key on neither, and just look for the card.
      } else {
        const card = page.locator('.word-card.card-guessable').first()
        if (await card.isVisible().catch(() => false)) {
          await card.click()
          const confirm = page.locator('.guess-confirm .btn-primary')
          if (await confirm.isVisible().catch(() => false)) await confirm.click()
        }
      }
    }
    // This loop used to have to answer the last chance here — a forbidden word
    // could interrupt it with a twenty-word translation form. The current
    // ending wheel is handled above; everything else plays to a summary or
    // sudden death.
    //
    // It does have to hurry Casey, though (U3): her turn is two beats per
    // guess now — the reasoning, then the guess it explains — and the bounded
    // loop leaves enough time for a summary if a
    // multi-turn round watches every one of them out. A tap on her panel skips
    // to the next beat, which is the gesture a player has too.
    const casey = page.locator('.dock.ai-panel[data-hurry]')
    if (await casey.isVisible().catch(() => false)) await casey.click().catch(() => {})
    await sleep(700)
  }
  // A round finishes into the finish screen: the reader of the owner's
  // approved finish/inspect design of 2026-09-11, and since the owner's
  // follow-up of the same evening the ONE finish surface, carrying the
  // outcome and its counts, the transcript link and the exits along with the
  // sentences. Smoke rides City 1 on purpose, so the reader — not the P1
  // sentence band — is where this round's sentences are (RoundSummary
  // renders RoundSentences only for boardCityIndex !== 0 since PR #216). The
  // tiles below are read inside the same surface.
  const reader = await city1ReaderState(page)
  if (!reader.open) throw new Error('a City 1 round must finish into the finish screen')
  if (!reader.danish) throw new Error('the reader is open with no Danish sentence in it')
  await page.locator('.city1-review-listen').click()
  await sleep(600)
  const readerHit = audioHits.slice(summaryMark).find((h) => h.url.includes('/audio/da/city1/'))
  if (!readerHit) throw new Error("the reader’s Listen requested no City 1 sentence clip")
  if (!readerHit.type.startsWith('audio/')) {
    throw new Error(`reader clip came back ${readerHit.status} ${readerHit.type || '(no type)'}, not audio`)
  }
  console.log(`reader: ${reader.progress} — «${reader.danish.slice(0, 40)}…» ${readerHit.url.split('/audio/')[1]}`)
  if (await page.getByRole('button', { name: 'Skip review', exact: true }).count()) {
    throw new Error('Skip review is back on the finish screen, and there is nothing to skip to')
  }
  await page.waitForSelector('.city1-review-dialog .outcome-stats', { timeout: 10000 })

  // What the round actually did, in the two tiles that replaced Casey's
  // paragraph about it. There were four until P1; the city and the journey
  // went, because both are the collection rather than the round and both are
  // drawn bigger one tap away. Read as text and checked as shapes: a tile
  // saying "undefined" still looks like a stat.
  const tiles = await page.evaluate(() => {
    const read = (sel) => document.querySelector(`${sel} .stat-n`)?.textContent?.trim() ?? ''
    return {
      discovered: read('.stat-discovered'),
      collected: read('.stat-collected'),
      face: document.querySelectorAll('.outcome-banner .cluey-svg').length,
      banner: document.querySelector('.outcome-banner')?.innerText ?? '',
      retired: document.querySelectorAll(
        '.summary-scroll, .stat-city, .stat-total, .collected-section',
      ).length,
    }
  })
  if (!/^\d+$/.test(tiles.discovered)) throw new Error(`discovered tile: "${tiles.discovered}"`)
  // Zero remains a real collected-word count in the result header.
  if (!/^\d+$/.test(tiles.collected)) {
    throw new Error(`collected tile: "${tiles.collected}"`)
  }
  if (tiles.retired > 0) throw new Error(`${tiles.retired} things P1 retired are still on the screen`)
  if (tiles.face !== 1) throw new Error(`${tiles.face} Caseys on the summary`)
  if (/🎉/.test(tiles.banner)) throw new Error('the celebration emoji is back on the summary')
  // This profile has never finished a round before, so every word on this board
  // was met for the first time. A zero here is the signature of the discovered
  // diff being taken AFTER recordRound, where it is uniformly empty.
  if (Number(tiles.discovered) === 0) {
    throw new Error('a board of first-ever words counted as 0 discovered')
  }
  console.log(
    `stats: ${tiles.discovered} new, ${tiles.collected} collected`,
  )

  // What this used to pin — two to six P1 rows, a tap on a row that speaks —
  // is a CITIES 2-9 claim now, and endgame-drive measures it on a City 2
  // board. What it pins here is the other half of the same rule: City 1's
  // finish state carries NO sentence band at all, because its sentences were
  // in the reader that was read and skipped above. Zero rows is the pin.
  if (await page.locator('.sentence-row').count()) {
    throw new Error("City 1's finish state must show 0 sentence rows — the reader is its review")
  }
  if (await page.locator('.sentence-review, .sentence-legend, .sentence-hear').count()) {
    throw new Error("City 1's finish state must carry no sentence band at all")
  }
  if (await page.locator('.audio-notice[data-audio-failure="example"]').count()) {
    throw new Error(`the finish screen reported an audio failure: ${await page.locator('.audio-notice').textContent()}`)
  }

  // The transcript starts shut. Everything below it is about what is inside,
  // so the lid has to come off first — which is itself the assertion that it
  // was on.
  if ((await page.locator('.turn-log').count()) !== 0) {
    throw new Error('the turn log was already open')
  }
  await page.locator('.log-toggle').click()
  await page.waitForSelector('.turn-log', { timeout: 10000 })
  const log = await page.evaluate(() => ({
    turns: document.querySelectorAll('.turn-log > li').length,
    guesses: document.querySelectorAll('.turn-guesses li').length,
    whys: document.querySelectorAll('.turn-why').length,
    confidences: document.querySelectorAll('.guess-confidence').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  if (log.turns === 0) throw new Error('turn log is empty')
  if (log.whys === 0) throw new Error('the turn log shows no reasoning at all')
  // Every AI guess carries both; the player's own taps carry neither, so the
  // count is bounded by the guesses rather than equal to them.
  if (log.confidences === 0) throw new Error('no confidence shown for any AI guess')
  if (log.confidences > log.guesses) throw new Error('more confidences than guesses')
  if (log.overflow > 0) throw new Error(`the summary overflows by ${log.overflow}px`)
  console.log(
    `turn log: ${log.turns} turns, ${log.guesses} guesses, ${log.whys} reasons, ${log.confidences} confidences`,
  )

  // ---- flagging a bad call, on the one screen that shows the reasoning ------
  // The flag is only worth tapping because Casey is shown it next round, so
  // this checks it reaches storage rather than just toggling a glyph.
  const flags = page.locator('.flag-btn')
  const flagCount = await flags.count()
  if (flagCount === 0) throw new Error('nothing in the review page can be flagged')
  await flags.first().click()
  await sleep(150)
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-feedback-v1') ?? '{}').state?.flags ?? [],
  )
  if (stored.length !== 1) throw new Error(`flag not stored: ${JSON.stringify(stored)}`)
  if (!stored[0].what) throw new Error(`flag carries no word: ${JSON.stringify(stored[0])}`)
  if ((await flags.first().getAttribute('aria-pressed')) !== 'true') {
    throw new Error('flag does not report its state')
  }
  // A mis-tap must be undoable.
  await flags.first().click()
  await sleep(150)
  const cleared = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-feedback-v1') ?? '{}').state?.flags ?? [],
  )
  if (cleared.length !== 0) throw new Error(`flag would not come back off: ${cleared.length}`)
  console.log(`flagged and unflagged one of ${flagCount} calls`)

  console.log('SMOKE OK')
} catch (e) {
  await page.screenshot({ path: `${SHOT_DIR}/99-failure.png` }).catch(() => {})
  console.log('SMOKE FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
}
