// Actual production entry and stores. Seed an in-flight sudden-death save,
// the existing authored replay cursor and explicit Survival prerequisites;
// a real card-confirm action finishes it. No source imports in the browser,
// no model request, recording fixture, reward replay or debug runtime hook.
import assert from 'node:assert/strict'
import { measureReviewGeometry } from './city1-review-geometry.mjs'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const originalBoards = json('../prototypes/finish-review/implementation/board-sentences.json').rows
const originalReviews = json('../prototypes/finish-review/implementation/review-sentences.json').rows
const extensionBoards = json('../prototypes/finish-review/implementation/roster-extension/board-sentences.json').rows
const extensionReviews = json('../prototypes/finish-review/implementation/roster-extension/review-sentences.json').rows
// Same authoritative accepted roster as CITY1_CATALOG, including the extension.
const boards = [...originalBoards, ...extensionBoards]
// The focus upgrade of 2026-09-26 replaces 29 rows, as CITY1_CATALOG does.
const upgrade = json('../src/data/city1-review-upgrade.da.json')
const upgraded = new Map(upgrade.review.map(row => [row.wordId, row]))
const rows = [...originalReviews, ...extensionReviews].map(row => upgraded.get(row.wordId) ?? row)
for (const bank of [boards, rows]) {
  assert.equal(bank.length, 176)
  assert.equal(new Set(bank.map(row => row.wordId)).size, bank.length)
  assert.ok(bank.every(row => row.status === 'accepted'))
}
const byWordId = (a, b) => a.wordId < b.wordId ? -1 : a.wordId > b.wordId ? 1 : 0
const notes = [...json('../prototypes/finish-review/implementation/about-targets.json').rows, ...upgrade.about]
const words = json('../src/data/words.da.json')
const instructionalAudio = json('../src/data/example-audio.da.json').entries
const cycle = json('../src/data/city1-board-cycle.da.json').boards
// Pick the longest combined accepted board pair actually present in the authored cycle.
const dictionaryPair = [...boards].filter(row => cycle.some(board => board.wordIds.includes(row.wordId)))
  .sort((a, b) => b.text.da.length - a.text.da.length || byWordId(a, b))[0]
assert.ok(dictionaryPair, 'authored cycle must contain an accepted City1 dictionary word')
const dictionaryCursor = cycle.findIndex(board => board.wordIds.includes(dictionaryPair.wordId))
const dictionaryWord = words.find(word => word.id === dictionaryPair.wordId)
assert.ok(dictionaryWord, `dictionary word ${dictionaryPair.wordId} exists in the actual dataset`)
assert.equal(dictionaryPair.status, 'accepted')
assert.notEqual(dictionaryWord.exampleDa, dictionaryPair.text.da)
assert.notEqual(dictionaryWord.exampleEn, dictionaryPair.text.en)
assert.equal(createHash('sha256').update(readFileSync(new URL('../src/data/words.da.json', import.meta.url))).digest('hex'), json('../prototypes/finish-review/implementation/inventory.json').sources['src/data/words.da.json'])
// Whether a row HAS a recording is read off the shipped manifest, never
// assumed. It was assumed until the Aoede bake landed 704 clips, at which
// point every "recordings unavailable" expectation here described a tree that
// no longer exists. Derived, the same assertions cover both states — and the
// shipped state is checked the harder way round: a clip that exists must
// never be announced as missing.
const shippedRecordings = [...json('../src/data/city1-sentence-audio.da.json').recordings, ...json('../src/data/city1-sentence-audio.da.upgrade.runtime.json').recordings]
const hasRecording = (row, variant = 'normal') => shippedRecordings.some(r => r.audioId === row.audioId &&
  r.sentenceId === row.sentenceId && r.version === row.version && r.textDa === row.text.da &&
  r.variant === variant && r.playbackRate === 1 && r.url.startsWith('/audio/da/city1/'))
const silent = row => !hasRecording(row) && !hasRecording(row, 'slow')
const audioNote = row => silent(row) ? 'Normal and slow recordings unavailable.' : ''
const sheetSuffix = row => silent(row) ? ' · normal and slow recordings unavailable' : ''
const survivalIds = [1, 2, 3, 4].map(n => `sonderborg-situation-${n}`)
const longest = [...rows].sort((a, b) => b.text.da.length - a.text.da.length || byWordId(a, b))[0]
const noteLength = row => { const a = notes.find(a => a.targetId === row.targetId); return (a.meaningEn + a.usageEn + a.example.da + a.example.en).length }
const longestNote = [...rows].sort((a, b) => noteLength(b) - noteLength(a) || byWordId(a, b))[0]
assert.notEqual(longest.wordId, longestNote.wordId)
assert.equal(longest.status, 'accepted')
assert.equal(longestNote.status, 'accepted')
const preview = await startPreview(4199) // never uses the parent's live source listener 5184
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) for (const scale of [1, 1.5]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
    const origin = new URL(preview.base).origin
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await context.addInitScript(scale => {
      if (!localStorage.getItem('cluecab-settings-v1')) localStorage.setItem('cluecab-settings-v1', JSON.stringify({ version: 17, state: {
        sound: true, studyPhase: 'never', useMock: false, usageStats: false, dataSharing: 'private', hidePlayerClueReminder: true,
      } }))
      if (!localStorage.getItem('cluecab-onboard-v5')) localStorage.setItem('cluecab-onboard-v5', 'done')
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${16 * scale}px` })
    }, scale)
    const page = await context.newPage()
    // Every finish below is reached through the last chance, which announces
    // itself in a modal since 2026-09-11; the card-confirm taps need it gone.
    await installRoundGuidanceHandler(page)
    const errors = [], sourceRequests = [], oldSentenceRequests = [], city1Requests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', request => {
      if (/\/(src|@vite)\//.test(request.url())) sourceRequests.push(request.url())
      if (/\/audio\/da\/example\//.test(request.url())) oldSentenceRequests.push(request.url())
      if (/\/audio\/da\/city1\//.test(request.url())) city1Requests.push(request.url())
    })
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state)
    const evidence = () => page.evaluate(() => Object.fromEntries(['cluecab-srs-v1', 'cluecab-journey-v2', 'cluecab-curriculum-v1', 'cluecab-survival-v1'].map(k => [k, localStorage.getItem(k)])))
    const panel = page.locator('.city1-review-dialog[open]')
    const home = () => page.locator('.city-card').waitFor()
    async function finish({ mode = 'normal', city = 0, onboarding = false, survivalCompleted = false } = {}) {
      await page.goto(`${preview.base}?first=player&train=closed`)
      await home()
      await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
      await page.reload()
      await page.locator('.home-play').click()
      await page.locator('.board-grid').waitFor()
      await page.evaluate(({ words, ids, mode, city, onboarding, dictionaryCursor, survivalCompleted, survivalIds, acceptedIds }) => {
        const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
        const s = raw.state, g = s.game
        const candidates = city === 0 ? words.filter(w => acceptedIds.includes(w.id)) : words.filter(w => w.curriculumRank > 100 && w.curriculumRank <= 200)
        const chosen = city === 0 ? ids.map(id => candidates.find(w => w.id === id)) : candidates.slice(0, 2)
        const list = [...chosen, ...candidates.filter(w => !chosen.includes(w))].slice(0, g.config.totalWords)
        g.words = list.map(w => ({ wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article, gender: w.gender, countable: w.countable }))
        g.playerKey = Object.fromEntries(list.map((w, i) => [w.id, i < 8 ? 'green' : 'bystander']))
        g.aiKey = Object.fromEntries(list.map((w, i) => [w.id, i < g.config.greenOverlap || (i >= 8 && i < 16 - g.config.greenOverlap) ? 'green' : 'bystander']))
        g.reveals = Object.fromEntries(list.map((w, i) => [w.id, { kind: i < 2 ? 'green' : 'hidden' }]))
        g.clueHistory = [
          { by: 'player', text: 'Food', number: 1, guesses: [{ wordId: list[0].id, result: 'green' }] },
          { by: 'ai', text: 'Things', number: 1, guesses: [{ wordId: list[0].id, result: 'green' }] },
          { by: 'player', text: 'Here', number: 1, guesses: [{ wordId: list[1].id, result: 'green' }] },
        ]
        g.phase = 'suddenDeath'; g.turnsLeft = 0; delete g.outcome
        s.city1BoardCursor = dictionaryCursor
        s.mode = mode; s.boardCityIndex = city; s.roundRecorded = false; s.sentenceReview = null
        s.authoredBoardId = null; s.boardCertification = null; s.packingDone = true; s.studying = false
        // This save is AFTER packing. Undefined wrappable means every card;
        // an empty packed list would correctly leave those cards English-up.
        s.wrappable = mode === 'wrapup' ? list.map(w => w.id) : []
        s.packed = mode === 'wrapup' ? list.map(w => w.id) : []
        s.packingMissed = []
        localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
        localStorage.setItem('cluecab-onboard-v5', onboarding ? 'real-round' : 'done')
        if (mode === 'wrapup') {
          // Pin an unlocked, unread first exchange independently of previous
          // scenarios. The real finish may unlock another; completed-state
          // coverage gets its own explicit ledger.
          localStorage.setItem('cluecab-survival-v1', JSON.stringify({ version: 1, state: { byLanguage: {
            da: { routeLanguage: 'da', exchanges: survivalCompleted
              ? Object.fromEntries(survivalIds.map(id => [id, { unlockedAt: 1, firstCompletedAt: 2, replayedAt: [] }]))
              : { [survivalIds[0]]: { unlockedAt: 1, replayedAt: [] } } },
          } } }))
        }
      }, { words, ids: [longest.wordId, longestNote.wordId], mode, city, onboarding, dictionaryCursor, survivalCompleted, survivalIds, acceptedIds: rows.map(row => row.wordId) })
      await page.reload()
      if (!onboarding) await page.getByRole('button', { name: mode === 'wrapup' ? 'Continue wrap-up' : 'Continue game', exact: true }).click()
      await page.locator('.sudden-death-bar').waitFor()
      const s = await saved()
      assert.equal(s.mode, mode, 'hydrated mode must survive navigation')
      assert.equal(s.game.phase, 'suddenDeath')
      assert.deepEqual(s.game.words.slice(0, 2).map(w => w.wordId), city === 0
        ? [longest.wordId, longestNote.wordId]
        : words.filter(w => w.curriculumRank > 100 && w.curriculumRank <= 200).slice(0, 2).map(w => w.id))
      // The two seeded greens are SOLVED, and solved cards have carried the
      // suitcase drawing since the build-82 glyph (366a4740) — no `.card-word`
      // on them. The board is verified against every card, revealed ones
      // included: `.word-card` holds all 18, `.card-word` the 16 unsolved.
      const cardCount = await page.locator('.board-grid .word-card').count()
      assert.equal(cardCount, s.game.words.length, JSON.stringify({ mode, onboarding, packed: s.packed, wrappable: s.wrappable, cardCount }))
      const visibleWords = await page.locator('.board-grid .card-word').allTextContents()
      const solved = s.game.words.filter(w => s.game.reveals[w.wordId]?.kind === 'green').map(w => w.da)
      assert.deepEqual(visibleWords, s.game.words.filter(w => !solved.includes(w.da)).map(w => w.da), JSON.stringify({ mode, onboarding, packed: s.packed, wrappable: s.wrappable, visibleWords, solved }))
      const dud = s.game.words.find(w => s.game.playerKey[w.wordId] === 'bystander' && s.game.aiKey[w.wordId] === 'bystander')
      await page.locator(`.word-card:has(.card-word:text-is("${dud.da}"))`).click()
      await page.locator('.guess-confirm .btn-primary').click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.roundRecorded)
      // Every city ends on the finish screen since the owner's follow-up of
      // 2026-09-11; only City 1 has a sentence to put in it.
      await panel.waitFor()
      return saved()
    }
    // The dictionary sheet's own source note. A row with no clip says so; a
    // row that HAS one must not — the stronger half, and the one that would
    // have caught the note being left behind after the bake landed.
    const sheetSourceNote = async row => {
      const note = page.locator('.sheet-example-source').getByText('· normal and slow recordings unavailable', { exact: true })
      if (silent(row)) await note.waitFor()
      else assert.equal(await note.count(), 0, `${row.wordId}: a shipped recording is never announced as missing`)
    }
    async function geometry() {
      await measureReviewGeometry(panel, `built ${JSON.stringify(await saved().then(s => ({ mode: s.mode, cursor: s.sentenceReview.cursor })))}`)
      const g = await panel.evaluate(el => {
        const box = el.getBoundingClientRect(), home = [...el.querySelectorAll('button')].find(b => b.textContent === 'Home').getBoundingClientRect()
        const scroll = el.querySelector('.city1-review-scroll'); scroll.scrollTop = scroll.scrollHeight
        return { top: box.top, bottom: box.bottom, right: box.right, left: box.left, height: innerHeight, width: innerWidth,
          homeHeight: home.height, homeBottom: home.bottom, overflow: el.scrollWidth > el.clientWidth,
          scrolled: scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1, pageTop: scrollY }
      })
      assert.ok(g.top >= 0 && g.bottom <= g.height && g.left >= 0 && g.right <= g.width)
      assert.ok(g.homeHeight >= 44 && g.homeBottom <= g.height && !g.overflow && g.scrolled && g.pageTop === 0)
    }
    console.log(`dictionary case: ${dictionaryPair.wordId}, ${cycle[dictionaryCursor].id}, ${dictionaryPair.sentenceId}`)
    const initial = await finish()
    assert.deepEqual(initial.sentenceReview.queue.map(p => [p.clueHistoryIndex, p.wordId]), [[0, longest.wordId], [2, longestNote.wordId]])
    const identity = ({ wordId, targetId, sentenceId, audioId, version }) => ({ wordId, targetId, sentenceId, audioId, version })
    assert.deepEqual(initial.sentenceReview.queue.map(identity), [longest, longestNote].map(identity))
    assert.equal(await panel.locator('.city1-review-sentence').textContent(), longest.text.da)
    for (const key of ['Shift+Tab', 'Tab']) for (let i = 0; i < 14; i++) {
      await page.keyboard.press(key)
      assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true, `${key} focus containment`)
    }
    const baseline = await evidence()
    await page.evaluate(() => { window.__audioStarts = []; addEventListener('cluecab-audio', e => window.__audioStarts.push(e.detail && e.detail.url)) })
    await panel.getByRole('button', { name: 'Listen slowly', exact: true }).click()
    await panel.getByRole('button', { name: 'Listen', exact: true }).click()
    assert.equal((await panel.locator('.city1-review-audio-note').textContent()).trim(), audioNote(longest),
      'the audio note says only what the shipped manifest supports')
    // Post-bake (2026-09-11): a City 1 clip must also START or be requested.
    const started = await page.evaluate(() => window.__audioStarts || [])
    assert.ok(started.some(u => /\/audio\/da\/city1\//.test(u)) || city1Requests.some(u => /\/audio\/da\/city1\//.test(u)),
      `a City 1 recording started or was requested: ${JSON.stringify({ started, city1Requests: city1Requests.slice(0, 3) })}`)
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByText(longest.text.en, { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await geometry()
    await panel.getByRole('button', { name: 'Next sentence' }).click()
    assert.equal(await page.locator('#city1-review-title').evaluate(el => el === document.activeElement), true, 'Next keeps focus when its control disappears')
    assert.equal(await panel.locator('.city1-review-sentence').textContent(), longestNote.text.da)
    assert.equal(await panel.locator('[aria-expanded="true"]').count(), 0)
    const pins = (await saved()).sentenceReview
    await page.reload()
    await page.getByRole('button', { name: 'Continue review', exact: true }).click()
    await panel.waitFor()
    assert.deepEqual((await saved()).sentenceReview, pins)
    assert.deepEqual(await evidence(), baseline)
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await panel.getByText(notes.find(a => a.targetId === longestNote.targetId).usageEn, { exact: true }).waitFor()
    await geometry()
    assert.deepEqual(oldSentenceRequests, [], 'City1 must not fetch old sentence clips')
    await panel.getByRole('button', { name: 'Play next game', exact: true }).click()
    await page.locator('.board-grid').waitFor()
    assert.equal((await saved()).roundRecorded, false)
    assert.notEqual((await saved()).reviewRoundId, initial.reviewRoundId)
    const replay = await saved()
    assert.equal(replay.authoredBoardId, cycle[dictionaryCursor].id)
    assert.deepEqual(replay.game.words.map(w => w.wordId), cycle[dictionaryCursor].wordIds)
    const cardIndex = replay.game.words.findIndex(w => w.wordId === dictionaryPair.wordId)
    assert.ok(cardIndex >= 0, `replay must deal ${dictionaryPair.wordId}`)
    assert.equal(replay.game.words[cardIndex].da, dictionaryWord.da)
    const card = page.locator('.word-card-wrap').nth(cardIndex)
    assert.equal(await card.locator('.card-word').textContent(), dictionaryWord.da)
    await card.locator('.card-info').click()
    await page.locator('.sheet').waitFor()
    await page.getByRole('button', { name: `Say ${dictionaryWord.da} again`, exact: true }).waitFor()
    assert.equal(await page.locator('.sheet-example p[lang="da"]').innerText(), dictionaryPair.text.da)
    assert.equal(await page.locator('.sheet-example-en').innerText(), dictionaryPair.text.en + sheetSuffix(dictionaryPair))
    assert.equal(await page.locator('.sheet-example p[lang="da"] mark').textContent(), dictionaryPair.wordSpan.text)
    assert.equal(await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).count(), 1)
    assert.equal(await page.locator('.sheet-head .speak-btn[aria-label*="slowly"]').count(), 1)
    await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).click()
    await page.getByRole('button', { name: 'Say the example sentence again', exact: true }).click()
    await sheetSourceNote(dictionaryPair)
    assert.deepEqual(oldSentenceRequests, [])
    await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click()
    // Two ways off the surface, and what is underneath it: nothing. Since
    // the owner's follow-up of 2026-09-11 the reader IS the finish screen —
    // the outcome, the transcript link and the exits ride it, and the band
    // summary it used to replace is gone — so Home and Escape both leave the
    // round for Home, and Skip review is gone with the state it skipped to.
    for (const action of ['Home', 'Escape']) {
      await finish()
      const before = await evidence()
      assert.equal(await panel.locator('.outcome-banner').count(), 1, 'the outcome rides the surface')
      assert.equal(await panel.locator('.log-toggle').count(), 1, 'and so does the transcript link')
      assert.equal(await panel.locator('.city1-review-outcome').textContent(), 'Participation trophy', 'a lost round uses its participation headline')
      assert.equal(await page.locator('.outcome-banner, .summary-actions, .log-toggle, .earned-section').count(),
        await panel.locator('.outcome-banner, .summary-actions, .log-toggle, .earned-section').count(),
        'nothing of a finish screen is rendered outside the surface')
      assert.equal(await panel.getByRole('button', { name: 'Skip review', exact: true }).count(), 0, 'nothing to skip to')
      if (action === 'Escape') await page.keyboard.press('Escape')
      else await panel.getByRole('button', { name: action, exact: true }).click()
      await panel.waitFor({ state: 'detached' })
      assert.equal((await saved()).sentenceReview.dismissed, true)
      assert.deepEqual(await evidence(), before)
      await home()
    }
    await finish({ onboarding: true })
    assert.equal(await panel.getByRole('button', { name: 'Play next game' }).count(), 0)
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await page.waitForFunction(() => localStorage.getItem('cluecab-onboard-v5') === 'home-return')
    await page.getByRole('button', { name: 'Tap Casey', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Open Casey and see the words we collected', exact: true }).click()
    await page.waitForFunction(() => localStorage.getItem('cluecab-onboard-v5') === 'suitcase')
    for (let step = 0; step < 3; step++) await page.locator('.onboard-next').click()
    await page.getByRole('button', { name: 'On we go', exact: true }).click()
    await page.waitForFunction(() => localStorage.getItem('cluecab-onboard-v5') === 'suitcase-ready')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.waitForFunction(() => localStorage.getItem('cluecab-onboard-v5') === 'done')
    await home()
    // Finish each wrap-up through the engine; then verify the actual Guide reader.
    // 'Home' stands where 'Continue' did: the wrap-up's third pill went when
    // the two choices moved into the reader and gained their own lines — the
    // surface's own exit is the way out now, and it always went to the same
    // place.
    for (const action of ['Grammar', 'Survival', 'Home']) {
      await finish({ mode: 'wrapup' })
      const before = await evidence()
      assert.equal(await panel.getByRole('button', { name: 'Play next game' }).count(), 0)
      // No reader on a wrap-up since 2026-09-11: it ends on the city's train,
      // not on a sentence. So there are no disclosures to open here — what the
      // region holds instead is asserted, and the geometry still measured, on
      // a surface whose middle region is the journey.
      assert.equal(await panel.locator('.city1-review-sentence').count(), 0, 'a wrap-up offers no sentence')
      assert.equal(await panel.getByRole('button', { name: 'Show translation' }).count(), 0)
      assert.equal(await panel.locator('.city1-review-empty').count(), 0, 'and does not say there was nothing to review')
      assert.equal(await panel.locator('.city1-review-head h3').textContent(), 'The journey')
      assert.equal(await panel.locator('.wrapup-journey .train-progress').count(), 1, 'the train is drawn on it')
      assert.match(await panel.locator('.stat-to-travel').innerText(), /to go before the train|is ready|journey is over/)
      await geometry()
      const survival = JSON.parse(before['cluecab-survival-v1']).state.byLanguage.da.exchanges
      assert.equal(survival[survivalIds[0]].firstCompletedAt, undefined)
      assert.ok(survival[survivalIds[0]].unlockedAt > 0)
      assert.equal(await panel.getByRole('button', { name: 'Survival', exact: true }).isEnabled(), true)
      await panel.getByRole('button', { name: action, exact: true }).click()
      if (action === 'Home') await home()
      else await page.locator(action === 'Grammar' ? '.guide-grammar-reader' : '.survival-exchange-page').waitFor()
      assert.equal((await saved()).sentenceReview.dismissed, true)
      if (action === 'Grammar') {
        await page.locator('.guide-grammar-reader').getByText('Sønderborg grammar', { exact: true }).waitFor()
        await page.locator('.guide-grammar-reader').getByRole('heading', { name: 'En, et, and “the”', exact: true }).waitFor()
      }
      if (action === 'Survival') await page.locator('.survival-exchange-page').getByRole('heading', { name: 'Say your name', exact: true }).waitFor()
      // Opening a Guide may record its own reading exposure; it must not add games.
      assert.equal(JSON.parse((await evidence())['cluecab-srs-v1']).state.games.played, JSON.parse(before['cluecab-srs-v1']).state.games.played)
    }
    await finish({ mode: 'wrapup', survivalCompleted: true })
    const completedBefore = await evidence()
    const completed = JSON.parse(completedBefore['cluecab-survival-v1']).state.byLanguage.da.exchanges
    assert.deepEqual(Object.keys(completed).sort(), survivalIds)
    assert.ok(Object.values(completed).every(e => e.firstCompletedAt === 2))
    const survivalButton = panel.getByRole('button', { name: 'Survival', exact: true })
    assert.equal(await survivalButton.isDisabled(), true)
    assert.equal(await survivalButton.getAttribute('title'), 'All four exchanges are already read.')
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await home()
    assert.equal((await saved()).sentenceReview.dismissed, true)
    assert.deepEqual(await evidence(), completedBefore)
    // Additional real authored-board case: retain the dealt words, keys and
    // certification. Only seed an in-flight history/phase, then use the real
    // card-confirm finish, as in the retained rank-bank scenarios above.
    const filmCursor = cycle.findIndex(b => b.firstGiver === 'player' && b.playerGreenIds.includes('da:film'))
    assert.ok(filmCursor >= 0)
    const filmBoard = extensionBoards.find(r => r.wordId === 'da:film')
    const filmReview = extensionReviews.find(r => r.wordId === 'da:film')
    assert.ok(filmBoard && filmReview)
    await page.evaluate(cursor => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      Object.assign(raw.state, { game: null, parked: null, mode: 'normal', sentenceReview: null, city1BoardCursor: cursor })
      localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    }, filmCursor)
    await page.reload(); await home()
    await page.locator('.home-play').click(); await page.locator('.board-grid').waitFor()
    const authored = await saved()
    assert.equal(authored.authoredBoardId, cycle[filmCursor].id)
    assert.deepEqual(authored.game.words.map(w => w.wordId), cycle[filmCursor].wordIds)
    assert.deepEqual(Object.keys(authored.game.playerKey).filter(id => authored.game.playerKey[id] === 'green').sort(), [...cycle[filmCursor].playerGreenIds].sort())
    const filmIndex = authored.game.words.findIndex(w => w.wordId === 'da:film')
    await page.locator('.word-card-wrap').nth(filmIndex).locator('.card-info').click()
    await page.locator('.sheet').waitFor()
    assert.equal(await page.locator('.sheet-example p[lang="da"]').innerText(), filmBoard.text.da)
    assert.equal(await page.locator('.sheet-example-en').innerText(), filmBoard.text.en + sheetSuffix(filmBoard))
    assert.equal(await page.locator('.sheet-example p[lang="da"] mark').textContent(), filmBoard.wordSpan.text)
    assert.equal(await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).count(), 1)
    await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).click()
    await page.getByRole('button', { name: 'Say the example sentence again', exact: true }).click()
    await sheetSourceNote(filmBoard)
    await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click()
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1')), g = raw.state.game
      g.clueHistory = [{ by: 'player', text: 'Cinema', number: 1, guesses: [{ wordId: 'da:film', result: 'green' }] }]
      g.reveals['da:film'] = { kind: 'green' }
      g.phase = 'suddenDeath'; g.turnsLeft = 0; delete g.outcome
      raw.state.roundRecorded = false; raw.state.sentenceReview = null
      localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Continue game', exact: true }).click()
    await page.locator('.sudden-death-bar').waitFor()
    const hydratedAuthored = await saved()
    assert.equal(hydratedAuthored.authoredBoardId, authored.authoredBoardId)
    assert.deepEqual(hydratedAuthored.game.words, authored.game.words)
    assert.deepEqual(hydratedAuthored.game.playerKey, authored.game.playerKey)
    assert.deepEqual(hydratedAuthored.game.aiKey, authored.game.aiKey)
    const filmDud = authored.game.words.find(w => authored.game.playerKey[w.wordId] === 'bystander' && authored.game.aiKey[w.wordId] === 'bystander')
    assert.ok(filmDud)
    await page.locator(`.word-card:has(.card-word:text-is("${filmDud.da}"))`).click()
    await page.locator('.guess-confirm .btn-primary').click()
    await panel.waitFor()
    assert.equal(await panel.locator('.city1-review-sentence').textContent(), filmReview.text.da)
    const filmPins = (await saved()).sentenceReview
    assert.deepEqual(filmPins.queue.map(p => [p.wordId,p.sentenceId,p.audioId,p.version]), [['da:film',filmReview.sentenceId,filmReview.audioId,filmReview.version]])
    const filmEvidence = await evidence()
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByText(filmReview.text.en, { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await geometry()
    await panel.getByRole('button', { name: 'Listen slowly', exact: true }).click()
    await panel.getByRole('button', { name: 'Listen', exact: true }).click()
    assert.equal((await panel.locator('.city1-review-audio-note').textContent()).trim(), audioNote(filmReview))
    await page.reload()
    await page.getByRole('button', { name: 'Continue review', exact: true }).click()
    await panel.waitFor()
    assert.deepEqual((await saved()).sentenceReview, filmPins)
    assert.deepEqual(await evidence(), filmEvidence)
    await panel.getByRole('button', { name: 'Home', exact: true }).click(); await home()
    assert.deepEqual(await evidence(), filmEvidence)
    assert.deepEqual(oldSentenceRequests, [])
    console.log(`authored extension finish: ${authored.authoredBoardId}, film, exact saved pins and unchanged post-finish evidence`)
    await finish({ city: 1 })
    // A later city ends on the same finish screen. It has no review
    // catalogue, so the P1 sentence band fills the reader's place, and replay
    // is the same deal again rather than the authored next game.
    assert.equal(await panel.locator('.city1-review-sentence').count(), 0, 'no accepted sentence outside City 1')
    assert.ok((await panel.locator('.sentence-row').count()) >= 1, 'the City 2 finish screen carries the sentence band')
    assert.equal(await panel.getByRole('button', { name: 'Play next game' }).count(), 0)
    await panel.getByRole('button', { name: 'Play again', exact: true }).waitFor()
    await measureReviewGeometry(panel, `built City 2 ${JSON.stringify({ viewport, scale })}`)
    assert.deepEqual((await saved()).sentenceReview.queue, [])
    // Context is the actual round city even for a shared word from another rank.
    await page.goto(`${preview.base}?first=player&train=closed`); await home()
    await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
    await page.reload(); await page.locator('.home-play').click(); await page.locator('.board-grid').waitFor()
    await page.evaluate(({ ids, words }) => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const s = raw.state, g = s.game
      const chosen = ids.map(id => words.find(w => w.id === id))
      const list = [...chosen, ...words.filter(w => !ids.includes(w.id))].slice(0, g.config.totalWords)
      g.words = list.map(w => ({ wordId: w.id, da: w.da, en: w.en, pos: w.pos, article: w.article, gender: w.gender, countable: w.countable }))
      g.playerKey = Object.fromEntries(list.map((w, i) => [w.id, i < 8 ? 'green' : 'bystander']))
      g.aiKey = Object.fromEntries(list.map((w, i) => [w.id, i < g.config.greenOverlap || (i >= 8 && i < 16 - g.config.greenOverlap) ? 'green' : 'bystander']))
      g.reveals = Object.fromEntries(list.map(w => [w.id, { kind: 'hidden' }]))
      g.phase = 'playerClueInput'; g.clueHistory = []; delete g.outcome
      s.boardCityIndex = 4; s.authoredBoardId = null; s.boardCertification = null; s.roundRecorded = false; s.sentenceReview = null; s.studying = false
      localStorage.setItem('cluecab-game-v1', JSON.stringify(raw))
    }, { ids: ['da:film', dictionaryPair.wordId], words })
    await page.reload(); await page.getByRole('button', { name: 'Continue game', exact: true }).click()
    assert.equal((await saved()).boardCityIndex, 4)
    for (const id of ['da:film', dictionaryPair.wordId]) {
      const word = words.find(w => w.id === id)
      await page.getByRole('button', { name: `Look up ${word.da}`, exact: true }).click()
      assert.equal(await page.locator('.sheet-example p[lang="da"]').innerText(), word.exampleDa)
      assert.equal(await page.locator('.sheet-example-en').innerText(), word.exampleEn)
      assert.equal(await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).count(), 1)
      await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).click()
    await page.getByRole('button', { name: 'Say the example sentence again', exact: true }).click()
      const source = instructionalAudio.find(row => row.id === id)
      assert.equal(source.textDa, word.exampleDa)
      const version = source.sourceHash.slice(0, 16)
      await page.waitForFunction(version => performance.getEntriesByType('resource').some(r => r.name.includes('/audio/da/example/') && new URL(r.name).searchParams.get('v') === version), version)
      assert.ok(oldSentenceRequests.some(url => new URL(url).searchParams.get('v') === version), `${id}: historical context requests its exact original audio`)
      await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click()
    }
    console.log('later-city dictionary: original film and original100 pairs, original sentence audio requested')
    await page.goto(`${preview.base}?train=closed`); await home()
    await page.getByRole('button', { name: 'Open the suitcase: your collection', exact: true }).click()
    await page.locator('button.case-tile').first().waitFor()
    const visibleTiles = await page.locator('button.case-tile').allTextContents()
    const homeWord = words.find(w => visibleTiles.includes(w.da) && originalBoards.some(row => row.wordId === w.id))
    assert.ok(homeWord, `Home suitcase exposes an original100 instructional word (tiles: ${JSON.stringify(visibleTiles)})`)
    await page.locator('button.case-tile').filter({ hasText: new RegExp(`^${homeWord.da}$`) }).click()
    assert.equal(await page.locator('.sheet-example p[lang="da"]').innerText(), homeWord.exampleDa)
    assert.equal(await page.locator('.sheet-example-en').innerText(), homeWord.exampleEn)
    assert.equal(await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).count(), 1)
    await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click()
    console.log(`Home suitcase dictionary retains original instruction: ${homeWord.id}`)
    await page.goto(`${preview.base}?city=0&wrapped=100&train=closed`)
    await home()
    await page.getByRole('button', { name: 'The train to Ribe is not running yet. The line is closed for maintenance', exact: true }).click()
    await page.getByRole('heading', { name: 'The line is closed for maintenance', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-journey-v2')).state.cityIndex), 0)
    assert.equal(await page.locator('.ride-screen').count(), 0)
    assert.deepEqual(sourceRequests, [], 'drive must serve the build, not source modules')
    assert.deepEqual(errors, [])
    console.log(`${viewport.width}x${viewport.height} font ${scale}: actual finish, accepted banks, keyboard, reload, rewards, replay/Home/Escape, onboarding, Guide, City2/closed train`)
    await context.close()
  }
} finally { await browser?.close(); preview.stop() }
