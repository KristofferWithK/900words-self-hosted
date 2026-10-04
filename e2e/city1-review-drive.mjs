import { readFileSync } from 'node:fs'
// Source harness: accepted production bank plus isolated controlled audio regressions.
import assert from 'node:assert/strict'
import { measureReviewGeometry } from './city1-review-geometry.mjs'
import { chromium } from 'playwright'
// Match CITY1_CATALOG: original accepted bank followed by its accepted
// extension, with the focus upgrade of 2026-09-26 in place of 29 rows.
const upgrade = JSON.parse(readFileSync(new URL('../src/data/city1-review-upgrade.da.json', import.meta.url)))
const upgraded = new Map(upgrade.review.map(row => [row.wordId, row]))
const rows = ['review-sentences.json', 'roster-extension/review-sentences.json'].flatMap(file =>
  JSON.parse(readFileSync(new URL('../prototypes/finish-review/implementation/' + file, import.meta.url))).rows)
  .map(row => upgraded.get(row.wordId) ?? row)
assert.equal(rows.length, 176)
assert.equal(new Set(rows.map(row => row.wordId)).size, rows.length)
assert.ok(rows.every(row => row.status === 'accepted'))
const byWordId = (a, b) => a.wordId < b.wordId ? -1 : a.wordId > b.wordId ? 1 : 0
const notes = [...JSON.parse(readFileSync(new URL('../prototypes/finish-review/implementation/about-targets.json', import.meta.url))).rows, ...upgrade.about]
const first = [...rows].sort((a, b) => b.text.da.length - a.text.da.length || byWordId(a, b))[0]
const noteLength = row => { const a = notes.find(a => a.targetId === row.targetId); return (a.meaningEn + a.usageEn + a.example.da + a.example.en).length }
const longestAbout = [...rows].sort((a, b) => noteLength(b) - noteLength(a) || byWordId(a, b))[0]
assert.notEqual(first.wordId, longestAbout.wordId)
assert.equal(first.status, 'accepted')
assert.equal(longestAbout.status, 'accepted')
const firstNote = notes.find(a => a.targetId === first.targetId)
// Whether a row HAS a recording is read off the shipped manifest, never
// assumed. It was assumed until the Aoede bake landed 704 clips and every
// "recordings unavailable" expectation here became a claim about a tree that
// no longer exists; derived, the same assertions cover both states.
const shippedRecordings = ['city1-sentence-audio.da.json', 'city1-sentence-audio.da.upgrade.runtime.json'].flatMap(file =>
  JSON.parse(readFileSync(new URL('../src/data/' + file, import.meta.url))).recordings)
const hasRecording = (row, variant = 'normal') => shippedRecordings.some(r => r.audioId === row.audioId &&
  r.sentenceId === row.sentenceId && r.version === row.version && r.textDa === row.text.da &&
  r.variant === variant && r.playbackRate === 1 && r.url.startsWith('/audio/da/city1/'))
const silent = row => !hasRecording(row) && !hasRecording(row, 'slow')
const audioNote = row => silent(row) ? 'Normal and slow recordings unavailable.' : ''
const sheetSuffix = row => silent(row) ? ' · normal and slow recordings unavailable' : ''
const base = process.env.REVIEW_TEST_BASE ?? 'http://127.0.0.1:5184'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const checks = []
try {
  for (const fontScale of [1, 1.5]) for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' })
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const open = async (query = '') => {
      await page.goto(`${base}/ClueCabulary/e2e/city1-review-fixture.html${query}`)
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${16 * scale}px` }, fontScale)
      await page.locator('.city1-review-dialog[open]').waitFor()
    }
    const globalWords = JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url)))
    const boardRows = ['board-sentences.json', 'roster-extension/board-sentences.json'].flatMap(file => JSON.parse(readFileSync(new URL('../prototypes/finish-review/implementation/' + file, import.meta.url))).rows)
    for (const id of ['da:film', 'da:mor']) {
      const word = globalWords.find(w => w.id === id), row = boardRows.find(r => r.wordId === id)
      await page.goto(`${base}/ClueCabulary/e2e/city1-review-fixture.html?fresh&dictionary=${encodeURIComponent(id)}`)
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${16 * scale}px` }, fontScale)
      assert.deepEqual(JSON.parse(await page.locator('#global-pair').textContent()), [word.exampleDa, word.exampleEn])
      for (const label of ['Board dictionary', 'Instructional dictionary', 'Later board dictionary']) {
        await page.getByRole('button', { name: label, exact: true }).click()
        const board = label === 'Board dictionary'
        assert.equal(await page.locator('.sheet-example p[lang="da"]').innerText(), board ? row.text.da : word.exampleDa)
        assert.equal(await page.locator('.sheet-example-en').innerText(), board ? row.text.en + sheetSuffix(row) : word.exampleEn)
        if (board) assert.equal(await page.locator('.sheet-example p[lang="da"] mark').textContent(), row.wordSpan.text)
        assert.equal(await page.getByRole('button', { name: 'Say the example sentence slowly', exact: true }).count(), 1)
        await page.locator('.sheet').getByRole('button', { name: 'Close', exact: true }).click()
      }
    }
    await open('?fresh')
    const panel = page.locator('.city1-review-dialog')
    assert.equal(await page.locator('#city1-review-title').evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Home', 'Shift+Tab from heading wraps to last control')
    await page.keyboard.press('Tab')
    // Last wraps to first. Whatever the surface's first control is — a
    // collected word's speak button in the header, or Listen — it is inside
    // the surface and it is not the last one. (It was Skip review, which is
    // gone with the finish state it skipped to.)
    assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true, 'last wraps to first')
    assert.notEqual(await page.evaluate(() => document.activeElement?.textContent), 'Home', 'last wraps to first')
    await panel.evaluate(el => {
      for (const kind of ['hidden', 'disabled', 'inert', 'display', 'visibility', 'disconnected']) {
        const b = document.createElement('button'); b.textContent = `ineligible-${kind}`
        if (kind === 'hidden') b.hidden = true
        if (kind === 'disabled') b.disabled = true
        if (kind === 'inert') b.inert = true
        if (kind === 'display') b.style.display = 'none'
        if (kind === 'visibility') b.style.visibility = 'hidden'
        el.append(b)
        if (kind === 'disconnected') b.remove()
      }
    })
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(key)
        assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true, `${key} focus containment`)
        assert.ok(!(await page.evaluate(() => document.activeElement?.textContent)).startsWith('ineligible-'))
      }
    }
    await page.locator('#outside-focus').evaluate(el => el.focus())
    assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true)
    // Escape is the keyboard's Home: it leaves the round the way the footer's
    // Home does, since there is no finish state underneath to close onto.
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.city1-review-dialog'))
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.sentenceReview.dismissed), true)
    await page.waitForFunction(() => document.querySelector('#result')?.textContent.startsWith('home:'))
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'outside-focus', 'restores the initial previous focus')
    for (const kind of ['hidden', 'disconnected']) {
      await open('?fresh')
      await page.locator('#outside-focus').evaluate((el, kind) => { if (kind === 'hidden') el.hidden = true; else el.remove() }, kind)
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('.city1-review-dialog'))
      assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'outside-focus')
    }
    await open('?fresh')
    const identity = ({ wordId, targetId, sentenceId, audioId, version }) => ({ wordId, targetId, sentenceId, audioId, version })
    const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.sentenceReview.queue)
    assert.deepEqual(queue.map(identity), [first, longestAbout].map(identity))
    assert.equal(await panel.locator('.city1-review-sentence').textContent(), first.text.da)
    // There is no finish state to skip to any more: the reader IS the finish
    // screen, and its exits are the footer's.
    assert.equal(await panel.getByRole('button', { name: 'Skip review', exact: true }).count(), 0)
    await panel.getByRole('button', { name: 'Listen slowly', exact: true }).click()
    await panel.getByRole('button', { name: 'Listen', exact: true }).click()
    assert.equal((await panel.locator('.city1-review-audio-note').textContent()).trim(), audioNote(first),
      'the audio note says only what the shipped manifest supports')
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await panel.getByText(firstNote.usageEn, { exact: true }).waitFor()
    await panel.getByText(first.text.en, { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Hide translation' }).click()
    assert.equal(await panel.getByText(firstNote.usageEn, { exact: true }).count(), 1)
    const checkGeometry = async () => {
      await measureReviewGeometry(panel, `source ${page.url()}`)
      const geometry = await panel.evaluate(el => ({
      bounds: el.getBoundingClientRect().toJSON(),
      home: [...el.querySelectorAll('button')].find(b => b.textContent === 'Home').getBoundingClientRect().toJSON(),
      documentHeight: document.documentElement.scrollHeight, height: innerHeight,
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    }))
      assert.ok(geometry.bounds.top >= 0 && geometry.bounds.bottom <= viewport.height)
      assert.ok(geometry.home.height >= 44 && geometry.home.bottom <= viewport.height)
      assert.ok(geometry.documentHeight <= geometry.height)
      assert.ok(geometry.scrollWidth <= geometry.clientWidth)
      const scroll = await panel.locator('.city1-review-scroll').evaluate(el => {
        el.scrollTop = el.scrollHeight
        return { top: el.scrollTop, height: el.clientHeight, full: el.scrollHeight, pageTop: window.scrollY }
      })
      assert.ok(scroll.top + scroll.height >= scroll.full - 1, 'review content can scroll to its end')
      assert.equal(scroll.pageTop, 0, 'scroll stays inside the modal')
    }
    await checkGeometry()
    await panel.getByRole('button', { name: 'Next sentence' }).click()
    assert.equal(await page.locator('#city1-review-title').evaluate(el => el === document.activeElement), true, 'Next keeps focus when its control disappears')
    assert.equal(await panel.getByText(first.text.en, { exact: true }).count(), 0)
    assert.equal(await panel.getByText(firstNote.usageEn, { exact: true }).count(), 0)
    assert.equal((await panel.locator('.city1-review-audio-note').textContent()).trim(), audioNote(longestAbout))
    const saved = await page.evaluate(() => ({ game: JSON.parse(localStorage.getItem('cluecab-game-v1')), srs: localStorage.getItem('cluecab-srs-v1') }))
    // The fixture removes its one-shot fresh flag, so Reload must rehydrate.
    assert.equal(new URL(page.url()).searchParams.has('fresh'), false)
    await page.reload()
    await page.evaluate(scale => { document.documentElement.style.fontSize = `${16 * scale}px` }, fontScale)
    await page.locator('.city1-review-dialog[open]').waitFor()
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.sentenceReview), saved.game.state.sentenceReview)
    assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-srs-v1')), saved.srs)
    assert.equal(await panel.getByText('2 of 2', { exact: true }).count(), 1)
    assert.equal(await panel.locator('.city1-review-sentence').textContent(), longestAbout.text.da)
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await checkGeometry()
    await panel.getByText(longestAbout.text.en, { exact: true }).waitFor()
    await panel.getByText(notes.find(a => a.targetId === longestAbout.targetId).usageEn, { exact: true }).waitFor()
    assert.match(await panel.getByRole('button', { name: 'Play next game' }).getAttribute('class'), /tag-primary/)
    await panel.getByRole('button', { name: 'Play next game' }).click()
    assert.equal(await page.locator('.city1-review-dialog').count(), 0)
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.roundRecorded), false)
    await open('?fresh')
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#result')?.textContent.startsWith('home:'))
    // ---- the approved finish/inspect design, and the follow-up that made it
    // THE finish screen: one surface, one set of exits, the outcome in its
    // own header, confetti over a win, and nothing underneath.
    await open('?fresh&won')
    assert.equal(await panel.locator('.outcome-banner').count(), 1, 'the outcome rides the surface')
    assert.equal(await page.locator('.outcome-banner, .summary-actions, .log-toggle, .earned-section').count(),
      await panel.locator('.outcome-banner, .summary-actions, .log-toggle, .earned-section').count(),
      'and nothing of a finish screen is rendered outside it')
    assert.match(await panel.locator('.city1-review-outcome').textContent(), /^(Good game!|Great game!|Perfect game!)$/,
      'the receipt tier selects a win headline')
    assert.equal(await panel.locator('.confetti').count(), 1, 'under confetti')
    assert.equal(await panel.getByRole('button', { name: 'Skip review', exact: true }).count(), 0, 'with nothing to skip to')
    assert.equal(await panel.locator('.log-toggle').count(), 1, 'and the transcript link closing the reader')
    assert.equal(await panel.locator('.city1-review-exit-row').count(), 1,
      'Play next game and Home share the second line while there is a next sentence')
    assert.match(await panel.getByRole('button', { name: 'Next sentence' }).getAttribute('class'), /tag-primary/)
    assert.equal(await panel.locator('.btn-primary').count(), 1, 'exactly one primary at a time')
    await panel.getByRole('button', { name: 'Next sentence' }).click()
    assert.equal(await panel.locator('.city1-review-exit-row').count(), 0,
      'the last sentence promotes Play next game and stacks Home under it')
    await checkGeometry()
    await open('?fresh')
    assert.equal(await panel.locator('.city1-review-outcome').textContent(), 'Participation trophy', 'a lost round uses its participation headline')
    assert.equal(await panel.locator('.outcome-sub').count(), 1, 'with the reason under it')
    assert.equal(await panel.locator('.confetti').count(), 0, 'and no confetti')
    await open('?fresh&onboarding')
    assert.equal(await panel.getByRole('button', { name: 'Play next game' }).count(), 0)
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await page.getByText('ONBOARDING HOME', { exact: true }).waitFor()
    await open('?fresh&wrap')
    assert.equal(await panel.getByRole('button', { name: 'Play next game' }).count(), 0)
    await panel.getByRole('button', { name: 'Show translation' }).click()
    await panel.getByRole('button', { name: 'About this word' }).click()
    await checkGeometry()
    const unread = await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-survival-v1')).state.byLanguage.da.exchanges['sonderborg-situation-1'])
    assert.equal(unread.unlockedAt, 1)
    assert.equal(unread.firstCompletedAt, undefined)
    // Two choices and the surface's own exit since 2026-09-11: the wrap-up's
    // Continue pill went when the choices moved into the reader and gained
    // the lines that say what they open.
    for (const name of ['Grammar', 'Survival', 'Home']) assert.equal(await panel.getByRole('button', { name, exact: true }).count(), 1)
    assert.equal(await panel.getByRole('button', { name: 'Continue', exact: true }).count(), 0)
    assert.equal(await panel.locator('.wrap-choice-note').count(), 3, 'each choice says what it opens — Grammar, Survival and Both')
    for (const [name, expected] of [['Grammar', { kind: 'grammar', cityIndex: 0 }], ['Survival', { kind: 'survival', cityIndex: 0, exchangeIndex: 0 }]]) {
      const srs = await page.evaluate(() => localStorage.getItem('cluecab-srs-v1'))
      assert.equal(await panel.getByRole('button', { name, exact: true }).isEnabled(), true, `${name} has an eligible destination`)
      await panel.getByRole('button', { name, exact: true }).click()
      await page.waitForFunction(() => document.querySelector('#result')?.textContent.startsWith('guide:'))
      assert.deepEqual(JSON.parse(await page.locator('#guide-entry').textContent()), expected)
      assert.equal(await page.locator('.city1-review-dialog').count(), 0)
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1')).state.sentenceReview.dismissed), true)
      assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-srs-v1')), srs)
      await open('?fresh&wrap')
    }
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#result')?.textContent.startsWith('home:'))
    await open('?fresh&wrap&survival-locked')
    const lockedSurvival = panel.getByRole('button', { name: 'Survival', exact: true })
    assert.equal(await lockedSurvival.isDisabled(), true)
    assert.equal(await lockedSurvival.getAttribute('title'), 'Complete a wrap-up to unlock the next exchange.')
    await checkGeometry()
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await open('?fresh&wrap&survival-completed')
    const completedSurvival = panel.getByRole('button', { name: 'Survival', exact: true })
    assert.equal(await completedSurvival.isDisabled(), true)
    assert.equal(await completedSurvival.getAttribute('title'), 'All four exchanges are already read.')
    const completedEvidence = await page.evaluate(() => localStorage.getItem('cluecab-survival-v1'))
    assert.equal(Object.values(JSON.parse(completedEvidence).state.byLanguage.da.exchanges).filter(e => e.firstCompletedAt !== undefined).length, 4)
    await panel.getByRole('button', { name: 'Home', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#result')?.textContent.startsWith('home:'))
    assert.equal(await page.evaluate(() => localStorage.getItem('cluecab-survival-v1')), completedEvidence)
    // Controlled network/media ports, actual module/component lifecycle. No audio bake.
    await page.addInitScript(() => {
      window.reviewAudioStarts = []
      window.addEventListener('cluecab-audio', e => window.reviewAudioStarts.push(e.detail.url))
      HTMLMediaElement.prototype.play = () => Promise.resolve()
      HTMLMediaElement.prototype.pause = () => {}
    })
    // Every way OFF the surface, and the one way on to the next sentence: a
    // way off that forgot to stop a pending clip would speak a sentence over
    // the Home the player just asked for.
    for (const action of ['Home', 'Escape', 'Next sentence']) {
      const pending = []
      const hold = route => { pending.push(route) }
      await page.route('**/audio/da/city1/TEST-delay-hund.mp3', hold)
      await page.route('**/audio/da/city1/TEST-delay-kat.mp3', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'TEST' }))
      await open('?fresh&audio')
      await panel.getByRole('button', { name: 'Listen', exact: true }).click()
      // Both preload and the uncached Listen request must have reached the port.
      await page.waitForTimeout(100)
      assert.ok(pending.length >= 2)
      if (action === 'Escape') await page.keyboard.press('Escape')
      else await panel.getByRole('button', { name: action, exact: true }).click()
      if (action === 'Next sentence') {
        await panel.getByRole('button', { name: 'Listen', exact: true }).click()
        await page.waitForFunction(() => window.reviewAudioStarts.some(url => url.includes('kat')))
      }
      for (const route of pending) await route.fulfill({ status: action === 'Next sentence' ? 503 : 200, contentType: 'audio/mpeg', body: 'TEST' })
      await page.waitForTimeout(100)
      assert.deepEqual(await page.evaluate(() => window.reviewAudioStarts.filter(url => url.includes('hund'))), [])
      if (action === 'Next sentence') assert.equal(await panel.getByRole('status').textContent(), '')
      await page.unroute('**/audio/da/city1/TEST-delay-hund.mp3', hold)
      await page.unroute('**/audio/da/city1/TEST-delay-kat.mp3')
    }
    assert.deepEqual(errors, [])
    checks.push(`${viewport.width}x${viewport.height}, font ${fontScale}: keyboard, persisted reload, Guide destinations, disclosure resets, manifest-derived audio note, the one finish screen (outcome header, confetti, no skip), exits, special flows, geometry`)
    await context.close()
  }
  console.log(checks.join('\n'))
} finally { await browser.close() }
