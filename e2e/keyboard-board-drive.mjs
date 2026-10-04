// Focused keyboard-time board scroll regression. Unlike layout-drive, this
// boots directly into one round so unrelated screens cannot gate this check.
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'
import { dismissRoundGuidance, installRoundGuidanceHandler } from './round-guidance.mjs'

const PORT = Number(process.env.DRIVE_PORT ?? 4305)
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
})
const page = await context.newPage()
// The café gate is on (CW-13): this drive's board needs its first café found.
await page.addInitScript(mergeFirstCafe, seedArgs('da'))
await installRoundGuidanceHandler(page)
const failures = []
const errors = []
const check = (label, pass, detail = '') => {
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures.push(label)
}
page.on('pageerror', (error) => errors.push(String(error)))

await page.addInitScript(() => {
  window.__keyboardBoard = {
    mediaStarts: [],
    audioFetches: [],
    speech: [],
    vibrations: [],
    oscillatorStarts: [],
    bufferStarts: [],
    touchPointers: [],
  }
  const originalFetch = window.fetch.bind(window)
  window.fetch = (...args) => {
    window.__keyboardBoard.audioFetches.push(String(args[0]))
    return originalFetch(...args)
  }
  const originalPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    window.__keyboardBoard.mediaStarts.push(this.currentSrc || this.src)
    return originalPlay.apply(this, args)
  }
  const synth = window.speechSynthesis
  if (synth) {
    const originalSpeak = synth.speak.bind(synth)
    synth.speak = (utterance) => {
      window.__keyboardBoard.speech.push(utterance.text)
      try { originalSpeak(utterance) } catch { /* record only */ }
    }
  }
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (pattern) => {
      window.__keyboardBoard.vibrations.push(pattern)
      return true
    },
  })
  document.addEventListener('pointerdown', (event) => {
    window.__keyboardBoard.touchPointers.push({
      pointerType: event.pointerType,
      target: event.target instanceof Element ? event.target.className?.toString() : '',
    })
  }, true)
  class FakeAudioParam {
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeOscillator {
    frequency = new FakeAudioParam()
    type = 'sine'
    connect() {}
    start(at = 0) { window.__keyboardBoard.oscillatorStarts.push(at) }
    stop() {}
  }
  class FakeBufferSource {
    connect() {}
    start(at = 0) { window.__keyboardBoard.bufferStarts.push(at) }
    stop() {}
  }
  class FakeFilter {
    frequency = new FakeAudioParam()
    Q = { value: 0 }
    connect() {}
  }
  class FakeGain {
    gain = new FakeAudioParam()
    connect() {}
  }
  window.AudioContext = class {
    currentTime = 0
    state = 'running'
    destination = {}
    sampleRate = 48000
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) } }
    createBufferSource() { return new FakeBufferSource() }
    createBiquadFilter() { return new FakeFilter() }
    createOscillator() { return new FakeOscillator() }
    createGain() { return new FakeGain() }
    resume() { this.state = 'running'; return Promise.resolve() }
  }
})

const clearSideEffects = () => page.evaluate(() => {
  for (const key of [
    'mediaStarts', 'audioFetches', 'speech', 'vibrations',
    'oscillatorStarts', 'bufferStarts', 'touchPointers',
  ]) window.__keyboardBoard[key] = []
})

const sideEffects = () => page.evaluate(() => ({
  mediaStarts: window.__keyboardBoard.mediaStarts.length,
  audioFetches: window.__keyboardBoard.audioFetches.length,
  speech: window.__keyboardBoard.speech.length,
  vibrations: window.__keyboardBoard.vibrations.length,
  oscillatorStarts: window.__keyboardBoard.oscillatorStarts.length,
  bufferStarts: window.__keyboardBoard.bufferStarts.length,
}))

const setKeyboard = (height) => page.evaluate((keyboardHeight) => {
  const root = document.documentElement
  const grid = document.querySelector('.board-grid')
  const dock = document.querySelector('.clue-input')
  root.style.setProperty('--board-h', `${Math.round(grid.getBoundingClientRect().height)}px`)
  root.classList.add('kb-up')
  dock?.classList.add('kb-lifted')
  document.body.style.height = `${window.innerHeight - keyboardHeight}px`
}, height)

const hideKeyboard = () => page.evaluate(() => {
  document.body.style.height = ''
  document.documentElement.classList.remove('kb-up')
  document.documentElement.style.removeProperty('--board-h')
  document.querySelector('.clue-input')?.classList.remove('kb-lifted')
})

const touchEvent = async (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
})

try {
  await page.goto(`${preview.base}?mock=1&howto=0&seed=7&first=player`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('cluecab-game-v1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await dismissRoundGuidance(page)
  const studyStart = page.locator('.study-dock .btn-primary')
  if (await studyStart.isVisible().catch(() => false)) await studyStart.click()
  await dismissRoundGuidance(page)
  await page.locator('.clue-input input').first().waitFor({ state: 'visible' })

  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, configuration: 'mobile' })

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    const keyboardHeight = 336
    await page.setViewportSize(viewport)
    await page.waitForTimeout(80)
    await page.locator('.clue-input input').first().focus()
    const ready = await page.evaluate(() => ({
      dialogOpen: !!document.querySelector('dialog.round-guidance-dialog[open]'),
      focused: document.activeElement?.tagName,
      phase: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase,
    }))
    check(
      `guidance is closed and composer input focused before touch @${viewport.width}x${viewport.height}`,
      !ready.dialogOpen && ready.focused === 'INPUT' && ready.phase === 'playerClueInput',
      JSON.stringify(ready),
    )
    const before = await page.evaluate(() => ({
      grid: document.querySelector('.board-grid').getBoundingClientRect().toJSON(),
      card: document.querySelector('.word-card').getBoundingClientRect().toJSON(),
      dock: document.querySelector('.clue-input').getBoundingClientRect().toJSON(),
    }))
    await setKeyboard(keyboardHeight)
    await page.waitForTimeout(60)

    const geometry = await page.evaluate((height) => {
      const area = document.querySelector('.board-area')
      const grid = document.querySelector('.board-grid')
      const card = document.querySelector('.word-card')
      const dock = document.querySelector('.clue-input')
      const note = document.querySelector('.practice-note')
      const box = (element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom }
      }
      const areaBox = box(area)
      const firstCard = box(card)
      const doc = document.scrollingElement
      return {
        area: areaBox,
        scrollHeight: area.scrollHeight,
        clientHeight: area.clientHeight,
        grid: box(grid),
        card: firstCard,
        dock: box(dock),
        keyboardEdge: innerHeight - height,
        noteDisplay: getComputedStyle(note).display,
        document: { height: doc.scrollHeight, viewport: doc.clientHeight, top: doc.scrollTop },
      }
    }, keyboardHeight)
    const noteShouldHide = viewport.height <= 667
    const boardTopVisible = geometry.card.top >= geometry.area.top - 1 &&
      geometry.card.bottom <= geometry.area.bottom + 1
    const cardUnresized = Math.abs(geometry.grid.height - before.grid.height) < 0.5 &&
      Math.abs(geometry.card.width - before.card.width) < 0.5 &&
      Math.abs(geometry.card.height - before.card.height) < 0.5
    console.log(`336px keyboard geometry @${viewport.width}x${viewport.height}: ${JSON.stringify(geometry)}`)
    check(
      `keyboard keeps the top board row visible @${viewport.width}x${viewport.height}`,
      geometry.clientHeight >= 44 && boardTopVisible,
      `board-area ${geometry.clientHeight}px; card ${geometry.card.height}px; note ${geometry.noteDisplay}`,
    )
    check(
      `keyboard creates a meaningful inner scrollport @${viewport.width}x${viewport.height}`,
      geometry.scrollHeight > geometry.clientHeight + 44,
      `${geometry.scrollHeight} content / ${geometry.clientHeight} visible`,
    )
    check(
      `short-phone practice note is hidden only during keyboard @${viewport.width}x${viewport.height}`,
      (geometry.noteDisplay === 'none') === noteShouldHide,
      `practice-note display ${geometry.noteDisplay}`,
    )
    check(
      `board/card dimensions stay fixed @${viewport.width}x${viewport.height}`,
      cardUnresized,
      `grid ${before.grid.height}→${geometry.grid.height}; card ${before.card.height}→${geometry.card.height}`,
    )
    check(
      `composer dock dimensions stay fixed @${viewport.width}x${viewport.height}`,
      Math.abs(geometry.dock.height - before.dock.height) < 0.5,
      `dock ${before.dock.height}→${geometry.dock.height}px`,
    )
    check(
      `composer stays at the simulated keyboard edge @${viewport.width}x${viewport.height}`,
      Math.abs(geometry.dock.bottom - geometry.keyboardEdge) <= 4,
      `dock bottom ${geometry.dock.bottom.toFixed(1)} / keyboard edge ${geometry.keyboardEdge}`,
    )
    check(
      `document remains non-scrollable @${viewport.width}x${viewport.height}`,
      geometry.document.top === 0 && geometry.document.height <= geometry.document.viewport + 1,
      JSON.stringify(geometry.document),
    )

    const touchOrigin = await page.locator('.board-area').evaluate((area) => {
      const card = document.querySelector('.word-card')
      const cardRect = card.getBoundingClientRect()
      const x = Math.round(cardRect.left + cardRect.width / 2)
      const y = Math.round(cardRect.top + cardRect.height / 2)
      const hit = document.elementFromPoint(x, y)
      return {
        x, y,
        hit: hit?.closest('.board-area') === area,
        hitElement: hit?.tagName,
        hitClass: hit instanceof Element ? hit.className?.toString() : '',
        scrimPointerEvents: getComputedStyle(document.querySelector('.kb-scrim')).pointerEvents,
      }
    })
    await clearSideEffects()
    await touchEvent(cdp, 'touchStart', touchOrigin.x, touchOrigin.y)
    for (let step = 1; step <= 6; step += 1) {
      await touchEvent(cdp, 'touchMove', touchOrigin.x, Math.round(touchOrigin.y - (36 * step) / 6))
      await page.waitForTimeout(18)
    }
    await touchEvent(cdp, 'touchEnd', 0, 0)
    await page.waitForTimeout(120)
    const swipe = await page.evaluate(() => ({
      scrollTop: document.querySelector('.board-area').scrollTop,
      documentTop: document.scrollingElement.scrollTop,
      keyboardUp: document.documentElement.classList.contains('kb-up'),
      focused: document.activeElement?.tagName,
      phase: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase,
      pointerTypes: window.__keyboardBoard.touchPointers.map((event) => event.pointerType),
    }))
    const swipeEffects = await sideEffects()
    check(
      `real touch swipe scrolls only board and preserves composer focus @${viewport.width}x${viewport.height}`,
      touchOrigin.hit && touchOrigin.scrimPointerEvents === 'none' && swipe.scrollTop > 0 &&
        swipe.documentTop === 0 && swipe.keyboardUp && swipe.focused === 'INPUT' &&
        swipe.phase === 'playerClueInput' && swipe.pointerTypes.includes('touch'),
      `${JSON.stringify(swipe)}; origin ${JSON.stringify(touchOrigin)}`,
    )
    check(
      `swipe starts no card audio or action @${viewport.width}x${viewport.height}`,
      Object.values(swipeEffects).every((count) => count === 0),
      JSON.stringify(swipeEffects),
    )

    const tapPoint = await page.locator('.board-area').evaluate((area) => {
      const areaRect = area.getBoundingClientRect()
      for (const card of document.querySelectorAll('.word-card')) {
        const rect = card.getBoundingClientRect()
        const top = Math.max(rect.top, areaRect.top + 1)
        const bottom = Math.min(rect.bottom, areaRect.bottom - 1)
        if (bottom - top < 4) continue
        const x = Math.round(rect.left + rect.width / 2)
        const y = Math.round((top + bottom) / 2)
        const hit = document.elementFromPoint(x, y)
        if (hit?.closest('.word-card') === card) return { x, y, hit: true }
      }
      return { x: 0, y: 0, hit: false }
    })
    const gameBeforeTap = await page.evaluate(() => JSON.stringify(
      JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game ?? null,
    ))
    await clearSideEffects()
    if (tapPoint.hit) {
      await touchEvent(cdp, 'touchStart', tapPoint.x, tapPoint.y)
      await touchEvent(cdp, 'touchEnd', 0, 0)
      await page.waitForTimeout(160)
    }
    const tap = await page.evaluate(() => ({
      focused: document.activeElement?.tagName,
      keyboardUp: document.documentElement.classList.contains('kb-up'),
      scrollTop: document.querySelector('.board-area').scrollTop,
      phase: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase,
      pointerTypes: window.__keyboardBoard.touchPointers.map((event) => event.pointerType),
    }))
    const gameUnchanged = await page.evaluate((beforeTap) => JSON.stringify(
      JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game ?? null,
    ) === beforeTap, gameBeforeTap)
    const tapEffects = await sideEffects()
    check(
      `real board-card touch dismisses focus without activating the card @${viewport.width}x${viewport.height}`,
      tapPoint.hit && tap.focused !== 'INPUT' && tap.phase === 'playerClueInput' &&
        tap.pointerTypes.includes('touch') && gameUnchanged,
      `${JSON.stringify(tap)}; game unchanged ${gameUnchanged}; hit ${JSON.stringify(tapPoint)}`,
    )
    check(
      `outside touch tap starts no audio, speech, or haptics @${viewport.width}x${viewport.height}`,
      Object.values(tapEffects).every((count) => count === 0),
      JSON.stringify(tapEffects),
    )

    await hideKeyboard()
    await page.waitForTimeout(60)
    const restored = await page.evaluate(() => ({
      scrollTop: document.querySelector('.board-area').scrollTop,
      noteDisplay: getComputedStyle(document.querySelector('.practice-note')).display,
      keyboardUp: document.documentElement.classList.contains('kb-up'),
    }))
    check(
      `keyboard hide resets board scroll and restores practice note @${viewport.width}x${viewport.height}`,
      restored.scrollTop === 0 && restored.noteDisplay !== 'none' && !restored.keyboardUp,
      JSON.stringify(restored),
    )

    await page.locator('.clue-input input').first().focus()
    await setKeyboard(keyboardHeight)
    await page.waitForTimeout(60)
    const reopened = await page.locator('.board-area').evaluate((area) => ({
      scrollTop: area.scrollTop,
      area: area.getBoundingClientRect().toJSON(),
      card: document.querySelector('.word-card').getBoundingClientRect().toJSON(),
      focused: document.activeElement?.tagName,
    }))
    check(
      `reopening keyboard starts at the top row @${viewport.width}x${viewport.height}`,
      reopened.scrollTop === 0 && reopened.focused === 'INPUT' &&
        reopened.card.top >= reopened.area.top - 1 && reopened.card.bottom <= reopened.area.bottom + 1,
      JSON.stringify(reopened),
    )
    await hideKeyboard()
  }

  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp.detach()
  check('no app runtime errors during focused keyboard drive', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
  preview.stop()
}

if (failures.length) {
  console.error(`\n${failures.length} keyboard-board regression(s) failed.`)
  process.exitCode = 1
} else {
  console.log('\nAll focused keyboard-board regressions passed.')
}
