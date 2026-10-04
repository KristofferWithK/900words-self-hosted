// Fresh-built evidence for the three-frame hand-drawn border redraw. Sample
// live wall-clock playback at DPR 3; never seek or pause animation timelines.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { dismissRoundGuidance } from './round-guidance.mjs'
import { mergeFirstCafe, seedArgs } from './_found-cafe.mjs'

const PORT = 4280
const OUT = resolve(process.env.SHOT_DIR ?? 'e2e-shots')
mkdirSync(OUT, { recursive: true })
const preview = await startPreview(PORT)
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
let failures = 0

// Playwright screenshots are PNGs. Decode Chromium's non-interlaced 8-bit RGB
// output locally so this drive checks painted pixels, not just animated style.
const decodePng = (image) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!image.subarray(0, 8).equals(signature)) throw new Error('motion screenshot is not PNG')
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const compressed = []
  for (let offset = 8; offset < image.length;) {
    const length = image.readUInt32BE(offset)
    const name = image.toString('ascii', offset + 4, offset + 8)
    const data = image.subarray(offset + 8, offset + 8 + length)
    if (name === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (name === 'IDAT') compressed.push(data)
    offset += length + 12
    if (name === 'IEND') break
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (bitDepth !== 8 || channels === 0 || interlace !== 0) {
    throw new Error(`unsupported motion screenshot PNG (${bitDepth}-bit, color type ${colorType}, interlace ${interlace})`)
  }
  const stride = width * channels
  const filtered = inflateSync(Buffer.concat(compressed))
  const pixels = Buffer.alloc(height * stride)
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft
    const leftDistance = Math.abs(estimate - left)
    const aboveDistance = Math.abs(estimate - above)
    const upperLeftDistance = Math.abs(estimate - upperLeft)
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
      ? left
      : aboveDistance <= upperLeftDistance ? above : upperLeft
  }
  let input = 0
  for (let y = 0; y < height; y++) {
    const filter = filtered[input++]
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = filtered[input++]
      const left = x >= channels ? pixels[row + x - channels] : 0
      const above = y > 0 ? pixels[row - stride + x] : 0
      const upperLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : (() => { throw new Error(`unsupported PNG row filter ${filter}`) })()
      pixels[row + x] = (raw + predictor) & 0xff
    }
  }
  return { width, height, channels, pixels }
}

const rasterDifference = (firstImage, secondImage) => {
  const first = decodePng(firstImage)
  const second = decodePng(secondImage)
  if (first.width !== second.width || first.height !== second.height || first.channels !== second.channels) {
    throw new Error(`motion frame dimensions differ: ${first.width}x${first.height} vs ${second.width}x${second.height}`)
  }
  let changedPixels = 0
  let totalChannelDelta = 0
  for (let pixel = 0; pixel < first.width * first.height; pixel++) {
    let strongest = 0
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(first.pixels[pixel * first.channels + channel] - second.pixels[pixel * second.channels + channel])
      strongest = Math.max(strongest, delta)
      totalChannelDelta += delta
    }
    if (strongest >= 24) changedPixels++
  }
  const area = first.width * first.height
  return {
    width: first.width,
    height: first.height,
    changedPixels,
    changedShare: changedPixels / area,
    meanChannelDelta: totalChannelDelta / (area * 3),
  }
}

const sampleLiveFrameStates = async (page, selector, durationMs = 1100) => page.evaluate(({ selector, durationMs }) => new Promise((resolve) => {
  const startedAt = performance.now()
  const states = new Set()
  let sampleCount = 0
  let invalidSamples = 0
  const tick = () => {
    const card = document.querySelector(selector)
    const frames = card ? [...card.querySelectorAll('.card-border-frame')] : []
    const visible = frames.flatMap((frame, index) => Number(getComputedStyle(frame).opacity) > 0.99 ? [index] : [])
    sampleCount++
    if (document.visibilityState === 'visible' && visible.length === 1) states.add(visible[0])
    else invalidSamples++

    const elapsedMs = performance.now() - startedAt
    if (elapsedMs >= durationMs) {
      resolve({
        frameStates: [...states].sort((a, b) => a - b),
        sampleCount,
        invalidSamples,
        elapsedMs,
        visibilityState: document.visibilityState,
      })
      return
    }
    window.setTimeout(() => requestAnimationFrame(tick), 16)
  }
  requestAnimationFrame(tick)
}), { selector, durationMs })

const captureLiveFrameRaster = async (page, { screenshotSelector, name }) => {
  const target = page.locator(screenshotSelector).first()
  const startedAt = Date.now()
  const captures = []
  const captureTimes = []
  for (let index = 0; index < 4; index++) {
    // Paced by one frame's hold (720ms / 3 frames = 240ms, plus margin). Taken
    // back to back, four screenshots can span less than one hold on a fast
    // machine (170-275ms measured on Windows) and all show the same frame, so
    // the check failed on a different subset every run while the rAF sampling
    // above saw every frame change. Paced, the four span more than a cycle.
    if (index > 0) await sleep(260)
    const captureStartedAt = Date.now()
    captures.push(await target.screenshot({ animations: 'allow', timeout: 5000 }))
    captureTimes.push(Date.now() - captureStartedAt)
  }

  let best = null
  let pairsCompared = 0
  for (let firstIndex = 0; firstIndex < captures.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < captures.length; secondIndex++) {
      const difference = rasterDifference(captures[firstIndex], captures[secondIndex])
      pairsCompared++
      if (!best || difference.changedShare > best.changedShare) {
        best = { ...difference, firstIndex, secondIndex }
      }
    }
  }
  if (!best) throw new Error('live border raster capture produced no image pairs')
  writeFileSync(resolve(OUT, `${name}-a.png`), captures[best.firstIndex])
  writeFileSync(resolve(OUT, `${name}-b.png`), captures[best.secondIndex])
  return {
    ...best,
    pair: [best.firstIndex + 1, best.secondIndex + 1],
    imageCount: captures.length,
    pairsCompared,
    captureTimes,
    elapsedMs: Date.now() - startedAt,
  }
}

const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const frameSequencePasses = (sample) =>
  sample.frameStates.length === 3 && sample.frameStates.every((frame, index) => frame === index) &&
  sample.sampleCount >= 12 && sample.invalidSamples === 0 && sample.visibilityState === 'visible'

try {
  for (const viewport of [
    { tag: '360', width: 360, height: 640 },
    { tag: '390', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 3,
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    // The café gate is on (CW-13): this drive's board needs its first café found.
    await page.addInitScript(mergeFirstCafe, seedArgs('da'))
    const crashes = []
    page.on('pageerror', (error) => crashes.push(String(error)))
    await page.addInitScript(() => {
      const fixtureKey = '__word-border-motion-fixture-v1'
      try {
        const queued = sessionStorage.getItem(fixtureKey)
        if (queued) {
          const fixture = JSON.parse(queued)
          localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
          localStorage.setItem('cluecab-game-v1', fixture.cache)
          sessionStorage.removeItem(fixtureKey)
        }
      } catch { /* storage may be unavailable before the preview origin */ }
      window.__writeWordBorderFixture = (raw) => {
        const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
        const sessions = saved?.state?.byCourse?.da
        if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
          throw new Error('word-border fixture has no active durable primary slot')
        }
        sessions.primary.game = raw.state.game
        sessionStorage.setItem(fixtureKey, JSON.stringify({
          sessions: JSON.stringify(saved),
          cache: JSON.stringify(raw),
        }))
      }
    })

    const url = `${preview.base}?mock=1&howto=0&city=0&first=player`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('.home-play').click()
    await page.waitForSelector('.game-screen .board-grid')
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
      const sessions = saved?.state?.byCourse?.da
      return sessions?.activeSlot === 'primary' && !!sessions.primary
    })
    const study = page.locator('.study-dock .btn-primary')
    if (await study.isVisible().catch(() => false)) await study.click()
    await page.waitForSelector('.game-screen .board-grid')
    await dismissRoundGuidance(page)

    const ordinary = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.board-grid .word-card')]
      const ordinaryCards = cards.filter((card) => !card.classList.contains('card-green'))
      const key = document.querySelector('.board-grid .word-card.mykey-green')
      const resolveColor = (token) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      }
      const isTransparent = (color) => Number(color.match(/[\d.]+/g)?.[3]) === 0
      const palette = {
        line: resolveColor('--line'),
        beige: resolveColor('--beige-deep'),
        key: resolveColor('--green-tile'),
      }
      const frameState = (card) => {
        const frames = [...card.querySelectorAll('.card-border-frame')].map((frame) => {
          const style = getComputedStyle(frame)
          return {
            opacity: Number(style.opacity),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationDelay: style.animationDelay,
            pointerEvents: style.pointerEvents,
          }
        })
        const visible = frames.flatMap((frame, index) => frame.opacity > 0.99 ? [index] : [])
        const expectedStroke = card.classList.contains('mykey-green')
          ? palette.key
          : card.classList.contains('card-guessable') ? palette.beige : palette.line
        return {
          frames,
          visible,
          expectedStroke,
          borderColor: getComputedStyle(card).borderTopColor,
          borderWidth: getComputedStyle(card).borderTopWidth,
          borderTransparent: isTransparent(getComputedStyle(card).borderTopColor),
        }
      }
      const guessProbe = ordinaryCards.find((card) => !card.classList.contains('mykey-green'))
      let guessableStroke = ''
      if (guessProbe) {
        guessProbe.classList.add('card-guessable')
        guessableStroke = getComputedStyle(guessProbe.querySelector('.card-border-frame')).stroke
        guessProbe.classList.remove('card-guessable')
      }
      return {
        cards: ordinaryCards.map((card) => {
          const frames = frameState(card)
          const rect = card.getBoundingClientRect()
          const surface = card.closest('.word-card-surface').getBoundingClientRect()
          const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          return {
            frames,
            svgPosition: getComputedStyle(card.querySelector('.card-border-motion-frames')).position,
            boxMatchesSurface: Math.abs(rect.width - surface.width) < 0.5 && Math.abs(rect.height - surface.height) < 0.5,
            centerHitsCard: center?.closest('.word-card') === card,
            ariaLabel: card.getAttribute('aria-label'),
          }
        }),
        guessableStroke,
        palette,
        key: key
          ? {
              ...frameState(key),
              className: key.className,
            }
          : null,
        scrollHeight: document.scrollingElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }
    })
    const movingWords = ordinary.cards.filter((card) => card.frames.frames.length === 3)
    const delays = new Set(movingWords.map((card) => card.frames.frames[0].animationDelay))
    const ordinaryFramesValid = ordinary.cards.length > 0 && ordinary.cards.every((card) =>
      card.frames.frames.length === 3 && card.frames.visible.length === 1 &&
      card.frames.frames[card.frames.visible[0]].opacity === 1 &&
      card.frames.frames.every((frame) => frame.stroke === card.frames.expectedStroke) &&
      card.frames.frames.every((frame) => frame.strokeWidth === card.frames.borderWidth) &&
      card.frames.borderTransparent && card.frames.borderWidth !== '0px',
    )
    check(`${viewport.tag}: ordinary borders are three opaque semantic-color SVG frames`, ordinaryFramesValid, `${movingWords.length}/${ordinary.cards.length}; line ${ordinary.palette.line}; key ${ordinary.palette.key}`)
    check(`${viewport.tag}: guessable frame keeps the existing beige stroke`, ordinary.guessableStroke === ordinary.palette.beige, `${ordinary.guessableStroke} / ${ordinary.palette.beige}`)
    check(`${viewport.tag}: ordinary words are deterministically staggered`, delays.size > 1, `${delays.size} distinct delays`)
    check(
      `${viewport.tag}: ordinary border stays out of hit testing and layout`,
      ordinary.cards.length > 0 && ordinary.cards.every(
        (card) => card.frames.frames.every((frame) => frame.pointerEvents === 'none') && card.svgPosition === 'absolute' && card.boxMatchesSurface && card.centerHitsCard && card.ariaLabel,
      ),
      `${ordinary.cards.filter((card) => card.frames.frames.every((frame) => frame.pointerEvents === 'none') && card.boxMatchesSurface && card.centerHitsCard && card.ariaLabel).length}/${ordinary.cards.length} cards intact`,
    )
    check(
      `${viewport.tag}: green key is redrawn in opaque --green-tile at 3px`,
      Boolean(ordinary.key) && ordinary.key.className.includes('card-border-motion') && ordinary.key.visible.length === 1 && ordinary.key.frames[ordinary.key.visible[0]].opacity === 1 && ordinary.key.frames.every((frame) => frame.stroke === ordinary.palette.key && frame.strokeWidth === '3px') && ordinary.key.borderTransparent && ordinary.key.borderWidth === '3px',
      ordinary.key ? `${ordinary.key.visible.length}/1 visible; ${ordinary.key.frames[0].stroke}, ${ordinary.key.borderWidth}` : 'no visible key target',
    )
    const ordinarySelector = '.board-grid .word-card.card-border-motion:not(.card-green):not(.mykey-green)'
    const ordinaryFrameStates = await sampleLiveFrameStates(page, ordinarySelector)
    check(
      `${viewport.tag}: live rAF sampling sees all three single-opaque ordinary frames`,
      frameSequencePasses(ordinaryFrameStates),
      `${ordinaryFrameStates.frameStates.join(',')}; ${ordinaryFrameStates.sampleCount} samples, ${ordinaryFrameStates.invalidSamples} invalid over ${Math.round(ordinaryFrameStates.elapsedMs)}ms`,
    )
    const ordinaryRaster = await captureLiveFrameRaster(page, {
      screenshotSelector: '.board-grid .word-card.card-border-motion:not(.card-green):not(.mykey-green)',
      name: `word-border-raster-ordinary-${viewport.tag}`,
    })
    const keySelector = '.board-grid .word-card.card-border-motion.mykey-green'
    const keyFrameStates = await sampleLiveFrameStates(page, keySelector)
    check(
      `${viewport.tag}: live rAF sampling sees all three single-opaque key frames`,
      frameSequencePasses(keyFrameStates),
      `${keyFrameStates.frameStates.join(',')}; ${keyFrameStates.sampleCount} samples, ${keyFrameStates.invalidSamples} invalid over ${Math.round(keyFrameStates.elapsedMs)}ms`,
    )
    const keyRaster = await captureLiveFrameRaster(page, {
      screenshotSelector: '.board-grid .word-card.card-border-motion.mykey-green',
      name: `word-border-raster-key-${viewport.tag}`,
    })
    const rasterVisible = (diff) => diff !== null && diff.changedPixels >= 40 && diff.changedShare >= 0.01
    check(
      `${viewport.tag} DPR 3: ordinary border changes painted pixels during wall-clock playback`,
      rasterVisible(ordinaryRaster),
      `${ordinaryRaster.changedPixels} pixels / ${(ordinaryRaster.changedShare * 100).toFixed(2)}%; best pair ${ordinaryRaster.pair.join('→')} of ${ordinaryRaster.imageCount}; ${ordinaryRaster.pairsCompared} pairs, ${ordinaryRaster.elapsedMs}ms capture span`,
    )
    check(
      `${viewport.tag} DPR 3: key border changes painted pixels during wall-clock playback`,
      rasterVisible(keyRaster),
      `${keyRaster.changedPixels} pixels / ${(keyRaster.changedShare * 100).toFixed(2)}%; best pair ${keyRaster.pair.join('→')} of ${keyRaster.imageCount}; ${keyRaster.pairsCompared} pairs, ${keyRaster.elapsedMs}ms capture span`,
    )
    check(`${viewport.tag}: ordinary board stays within the viewport`, ordinary.scrollHeight <= ordinary.viewportHeight, `${ordinary.scrollHeight}px / ${ordinary.viewportHeight}px`)
    await page.screenshot({ path: resolve(OUT, `word-border-motion-ordinary-${viewport.tag}.png`) })

    const revealedMotion = await page.evaluate(() => {
      const card = document.querySelector('.board-grid .word-card.card-border-motion:not(.card-green):not(.mykey-green)')
      if (!card) return null
      card.classList.add('card-translation-revealed')
      const frames = [...card.querySelectorAll('.card-border-frame')].map((frame) => {
        const style = getComputedStyle(frame)
        return {
          stroke: style.stroke,
          strokeDasharray: style.strokeDasharray,
          animationName: style.animationName,
          animationDurationMs: Number.parseFloat(style.animationDuration) * (style.animationDuration.endsWith('ms') ? 1 : 1000),
        }
      })
      return { borderStyle: getComputedStyle(card).borderTopStyle, frames }
    })
    check(
      `${viewport.tag}: postcard-revealed motion keeps three dashed beige SVG frames`,
      revealedMotion?.borderStyle === 'dashed' && revealedMotion.frames.length === 3 && revealedMotion.frames.every((frame) =>
        frame.stroke === ordinary.palette.beige && frame.strokeDasharray !== 'none' && frame.animationName !== 'none' && frame.animationDurationMs === 720,
      ),
      revealedMotion ? `${revealedMotion.borderStyle}; ${revealedMotion.frames.map((frame) => `${frame.stroke} ${frame.strokeDasharray}`).join(' | ')}` : 'no eligible moving card',
    )

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedWords = await page.evaluate(() => [...document.querySelectorAll('.board-grid .word-card.card-border-motion:not(.card-green)')].map((card) => {
      const frames = [...card.querySelectorAll('.card-border-frame')].map((frame) => ({
        animationName: getComputedStyle(frame).animationName,
        opacity: Number(getComputedStyle(frame).opacity),
        stroke: getComputedStyle(frame).stroke,
        strokeWidth: getComputedStyle(frame).strokeWidth,
      }))
      const borderColor = getComputedStyle(card).borderTopColor
      const channels = borderColor.match(/[\d.]+/g)?.map(Number) ?? []
      return {
        frames,
        visible: frames.flatMap((frame, index) => frame.opacity === 1 ? [index] : []),
        borderTransparent: channels.length === 4 && channels[3] === 0,
        borderWidth: getComputedStyle(card).borderTopWidth,
      }
    }))
    const reducedReveal = await page.evaluate(() => {
      const card = document.querySelector('.board-grid .word-card.card-border-motion.card-translation-revealed:not(.mykey-green)')
      if (!card) return null
      const frames = [...card.querySelectorAll('.card-border-frame')].map((frame) => {
        const style = getComputedStyle(frame)
        return {
          animationName: style.animationName,
          opacity: Number(style.opacity),
          stroke: style.stroke,
          strokeDasharray: style.strokeDasharray,
        }
      })
      return {
        borderStyle: getComputedStyle(card).borderTopStyle,
        frames,
        visible: frames.flatMap((frame, index) => frame.opacity === 1 ? [index] : []),
      }
    })
    check(
      `${viewport.tag}: reduced motion holds one readable static frame`,
      reducedWords.length > 0 && reducedWords.every((card) => card.frames.length === 3 && card.frames.every((frame) => frame.animationName === 'none') && card.visible.length === 1 && card.visible[0] === 0 && card.borderTransparent && Number(card.borderWidth.replace('px', '')) >= 2),
      `${reducedWords.filter((card) => card.frames.length === 3 && card.frames.every((frame) => frame.animationName === 'none') && card.visible.length === 1 && card.visible[0] === 0).length}/${reducedWords.length} hold a frame`,
    )
    check(
      `${viewport.tag}: reduced motion holds the dashed beige postcard SVG frame`,
      reducedReveal?.borderStyle === 'dashed' && reducedReveal.frames.length === 3 && reducedReveal.visible.length === 1 && reducedReveal.visible[0] === 0 && reducedReveal.frames.every((frame) =>
        frame.animationName === 'none' && frame.stroke === ordinary.palette.beige && frame.strokeDasharray !== 'none',
      ),
      reducedReveal ? `${reducedReveal.visible.join(',')}; ${reducedReveal.frames.map((frame) => `${frame.stroke} ${frame.strokeDasharray}`).join(' | ')}` : 'no revealed motion card',
    )

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const game = raw.state.game
      const segments = game.words.slice(0, 3).map((word) => word.wordId)
      for (const wordId of segments) game.reveals[wordId] = { kind: 'green' }
      game.turnsLeft = 0
      game.phase = 'translateChallenge'
      game.wheel = {
        segments,
        translated: [],
        filled: [],
        attempts: 0,
        landed: null,
        result: null,
        spent: null,
      }
      window.__writeWordBorderFixture(raw)
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.home-play').click()
    await page.waitForSelector('.game-screen .board-grid')
    await page.waitForSelector('.translate-challenge-bar')
    await dismissRoundGuidance(page)

    const inspectChallenge = async () => page.evaluate(() => {
      const resolveColor = (token) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      }
      const storedGame = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      const groups = [...document.querySelectorAll('.card-suitcase-motion-frames')]
      const cases = groups.map((group) => {
        const frames = [...group.querySelectorAll('.card-border-frame')].map((frame) => {
          const style = getComputedStyle(frame)
          return {
            opacity: Number(style.opacity),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            path: frame.getAttribute('d'),
            vectorEffect: style.vectorEffect,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationDelay: style.animationDelay,
            pointerEvents: style.pointerEvents,
          }
        })
        const glyph = group.closest('.card-suitcase-glyph')
        const body = glyph.querySelector('.card-suitcase-body')
        const bodyStyle = getComputedStyle(body)
        const card = glyph.closest('.word-card')
        return {
          frames,
          visible: frames.flatMap((frame, index) => frame.opacity > 0.99 ? [index] : []),
          delay: frames[0]?.animationDelay,
          packed: card.classList.contains('card-wheel-packed'),
          packedCheck: Boolean(card.querySelector('.card-packed-check')),
          bodyStroke: bodyStyle.stroke,
          bodyFill: bodyStyle.fill,
          bodyMotion: body.classList.contains('card-suitcase-body-motion'),
        }
      })
      return {
        suitcaseCards: document.querySelectorAll('.card-suitcase-glyph').length,
        cases,
        colors: {
          textDim: resolveColor('--text-dim'),
          greenDeep: resolveColor('--green-deep'),
          greenSoft: resolveColor('--green-soft'),
        },
        ordinaryMotionCards: document.querySelectorAll('.word-card.card-border-motion').length,
        phase: storedGame.phase,
        translated: [...(storedGame.wheel?.translated ?? [])],
      }
    })
    const challenge = await inspectChallenge()
    const caseDelays = new Set(challenge.cases.map((item) => item.delay))
    const distinctPathsPerCase = (cases) => cases.length === 3 && cases.every((item) =>
      item.frames.length === 3 && new Set(item.frames.map((frame) => frame.path)).size === 3,
    )
    const casesValid = distinctPathsPerCase(challenge.cases) && challenge.cases.every((item) =>
      item.frames.length === 3 && item.visible.length === 1 && item.frames[item.visible[0]].opacity === 1 &&
      item.frames.every((frame) => frame.stroke === challenge.colors.textDim && frame.strokeWidth === '4px' && frame.vectorEffect === 'none' && frame.pointerEvents === 'none') &&
      item.bodyMotion && item.bodyStroke === 'rgba(0, 0, 0, 0)' && item.bodyFill === 'rgba(0, 0, 0, 0)',
    )
    check(
      `${viewport.tag}: unpacked challenge has three suitcases with three distinct paths each`,
      challenge.phase === 'translateChallenge' && challenge.translated.length === 0 && challenge.suitcaseCards === 3 && distinctPathsPerCase(challenge.cases),
      `${challenge.phase}, ${challenge.suitcaseCards} suitcases, ${challenge.cases.length} frame groups; ${challenge.cases.map((item) => new Set(item.frames.map((frame) => frame.path)).size).join('/')} unique paths`,
    )
    check(
      `${viewport.tag}: suitcase redraw replaces the body stroke with opaque text-dim contours`,
      challenge.phase === 'translateChallenge' && casesValid,
      `${challenge.cases.filter((item) => item.visible.length === 1 && item.frames[0].stroke === challenge.colors.textDim && item.bodyStroke === 'rgba(0, 0, 0, 0)').length}/${challenge.cases.length} bodies redrawn; ${JSON.stringify(challenge.cases[0])}`,
    )
    check(`${viewport.tag}: challenge suitcase motion is unsynchronized`, caseDelays.size > 1, `${caseDelays.size} distinct delays`)
    check(`${viewport.tag}: ordinary border motion stands down for translateChallenge`, challenge.ordinaryMotionCards === 0, `${challenge.ordinaryMotionCards} ordinary motion cards`)
    const suitcaseSelector = '.word-card:not(.card-wheel-packed) .card-suitcase-motion-frames'
    const suitcaseFrameStates = await sampleLiveFrameStates(page, suitcaseSelector)
    check(
      `${viewport.tag}: live rAF sampling sees all three single-opaque unpacked suitcase frames`,
      frameSequencePasses(suitcaseFrameStates),
      `${suitcaseFrameStates.frameStates.join(',')}; ${suitcaseFrameStates.sampleCount} samples, ${suitcaseFrameStates.invalidSamples} invalid over ${Math.round(suitcaseFrameStates.elapsedMs)}ms`,
    )
    const suitcaseRaster = await captureLiveFrameRaster(page, {
      screenshotSelector: '.card-suitcase-glyph',
      name: `word-border-raster-suitcase-${viewport.tag}`,
    })
    check(
      `${viewport.tag} DPR 3: suitcase redraw changes painted pixels at wall clock`,
      rasterVisible(suitcaseRaster),
      `${suitcaseRaster.changedPixels} pixels / ${(suitcaseRaster.changedShare * 100).toFixed(2)}%; best pair ${suitcaseRaster.pair.join('→')} of ${suitcaseRaster.imageCount}; ${suitcaseRaster.pairsCompared} pairs, ${suitcaseRaster.elapsedMs}ms capture span`,
    )
    await page.screenshot({ path: resolve(OUT, `word-border-motion-challenge-unpacked-${viewport.tag}.png`) })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedCases = await page.evaluate(() => [...document.querySelectorAll('.card-suitcase-motion-frames')].map((group) => {
      const frames = [...group.querySelectorAll('.card-border-frame')].map((frame) => ({
        animationName: getComputedStyle(frame).animationName,
        opacity: Number(getComputedStyle(frame).opacity),
        stroke: getComputedStyle(frame).stroke,
      }))
      const body = group.closest('.card-suitcase-glyph').querySelector('.card-suitcase-body')
      return {
        frames,
        visible: frames.flatMap((frame, index) => frame.opacity === 1 ? [index] : []),
        bodyStroke: getComputedStyle(body).stroke,
        bodyFill: getComputedStyle(body).fill,
      }
    }))
    check(
      `${viewport.tag}: reduced motion keeps one readable suitcase contour`,
      reducedCases.length === 3 && reducedCases.every((item) => item.frames.length === 3 && item.frames.every((frame) => frame.animationName === 'none') && item.visible.length === 1 && item.visible[0] === 0 && item.frames[0].stroke === challenge.colors.textDim && item.bodyStroke === 'rgba(0, 0, 0, 0)' && item.bodyFill === 'rgba(0, 0, 0, 0)'),
      `${reducedCases.filter((item) => item.frames.length === 3 && item.visible.length === 1 && item.visible[0] === 0 && item.bodyStroke === 'rgba(0, 0, 0, 0)').length}/${reducedCases.length} holding a static frame`,
    )
    await page.screenshot({ path: resolve(OUT, `word-border-motion-reduced-${viewport.tag}.png`) })

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const translation = await page.evaluate(() => {
      const game = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      const wordId = game.wheel.segments.find((id) => game.reveals[id]?.kind === 'green' && !game.wheel.translated.includes(id))
      const word = game.words.find((candidate) => candidate.wordId === wordId)
      return { wordId, answer: word.da }
    })
    await page.locator('.translate-challenge-bar .wheel-input').fill(translation.answer)
    await page.locator('.translate-challenge-bar .wheel-confirm').click()
    await page.waitForFunction((wordId) => {
      const game = JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game
      return game.phase === 'translateChallenge' && game.wheel.translated.includes(wordId)
    }, translation.wordId)
    await page.waitForFunction(() => document.querySelectorAll('.word-card.card-wheel-packed').length === 1)

    const packedChallenge = await inspectChallenge()
    const packedCount = packedChallenge.cases.filter((item) => item.packed).length
    const packedCasesValid = distinctPathsPerCase(packedChallenge.cases) && packedChallenge.cases.every((item) =>
      item.frames.length === 3 && item.visible.length === 1 && item.frames[item.visible[0]].opacity === 1 &&
      item.frames.every((frame) => frame.stroke === (item.packed ? packedChallenge.colors.greenDeep : packedChallenge.colors.textDim) && frame.strokeWidth === '4px' && frame.vectorEffect === 'none' && frame.pointerEvents === 'none') &&
      item.bodyMotion && item.bodyStroke === 'rgba(0, 0, 0, 0)' &&
      item.bodyFill === (item.packed ? packedChallenge.colors.greenSoft : 'rgba(0, 0, 0, 0)'),
    )
    check(
      `${viewport.tag}: real translation packs exactly one suitcase in translateChallenge`,
      packedChallenge.phase === 'translateChallenge' && packedChallenge.translated.length === 1 && packedChallenge.cases.length === 3 && packedCount === 1 && packedChallenge.cases.filter((item) => item.packedCheck).length === 1,
      `${packedChallenge.translated.length} translated, ${packedCount} packed cards, ${packedChallenge.cases.filter((item) => item.packedCheck).length} checks`,
    )
    check(
      `${viewport.tag}: packed and unpacked challenge states retain three distinct paths per suitcase`,
      distinctPathsPerCase(packedChallenge.cases) && JSON.stringify(packedChallenge.cases.map((item) => item.frames.map((frame) => frame.path))) === JSON.stringify(challenge.cases.map((item) => item.frames.map((frame) => frame.path))),
      `${packedChallenge.cases.map((item) => new Set(item.frames.map((frame) => frame.path)).size).join('/')} unique paths; paths unchanged across translation`,
    )
    check(
      `${viewport.tag}: packed green and unpacked text-dim suitcase redraw semantics remain intact`,
      packedCasesValid,
      `${packedChallenge.cases.filter((item) => item.packed && item.frames[0].stroke === packedChallenge.colors.greenDeep && item.bodyFill === packedChallenge.colors.greenSoft).length} packed green; ${packedChallenge.cases.filter((item) => !item.packed && item.frames[0].stroke === packedChallenge.colors.textDim && item.bodyFill === 'rgba(0, 0, 0, 0)').length} unpacked text-dim`,
    )
    const packedFrameStates = await sampleLiveFrameStates(page, '.card-wheel-packed .card-suitcase-motion-frames')
    check(
      `${viewport.tag}: live rAF sampling sees all three single-opaque packed suitcase frames`,
      frameSequencePasses(packedFrameStates),
      `${packedFrameStates.frameStates.join(',')}; ${packedFrameStates.sampleCount} samples, ${packedFrameStates.invalidSamples} invalid over ${Math.round(packedFrameStates.elapsedMs)}ms`,
    )
    const packedRaster = await captureLiveFrameRaster(page, {
      screenshotSelector: '.card-wheel-packed .card-suitcase-glyph',
      name: `word-border-raster-suitcase-packed-${viewport.tag}`,
    })
    check(
      `${viewport.tag} DPR 3: packed suitcase redraw changes painted pixels at wall clock`,
      rasterVisible(packedRaster),
      `${packedRaster.changedPixels} pixels / ${(packedRaster.changedShare * 100).toFixed(2)}%; best pair ${packedRaster.pair.join('→')} of ${packedRaster.imageCount}; ${packedRaster.pairsCompared} pairs, ${packedRaster.elapsedMs}ms capture span`,
    )
    await page.screenshot({ path: resolve(OUT, `word-border-motion-challenge-packed-${viewport.tag}.png`) })

    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      raw.state.game.phase = 'translateWheel'
      window.__writeWordBorderFixture(raw)
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.home-play').click()
    await page.waitForSelector('.game-screen .board-grid')
    const wheel = await page.evaluate(() => ({
      phase: JSON.parse(localStorage.getItem('cluecab-game-v1')).state.game.phase,
      ordinaryMotionCards: document.querySelectorAll('.word-card.card-border-motion').length,
      suitcaseMotionOutlines: document.querySelectorAll('.card-suitcase-motion-frames').length,
    }))
    check(
      `${viewport.tag}: all border motion stops in translateWheel`,
      wheel.phase === 'translateWheel' && wheel.ordinaryMotionCards === 0 && wheel.suitcaseMotionOutlines === 0,
      `${wheel.ordinaryMotionCards} word overlays, ${wheel.suitcaseMotionOutlines} suitcase outlines`,
    )
    await page.screenshot({ path: resolve(OUT, `word-border-motion-wheel-${viewport.tag}.png`) })

    check(`${viewport.tag}: no browser page errors`, crashes.length === 0, crashes.join(' | '))
    await context.close()
  }
} catch (error) {
  console.log(`DRIVE ERROR: ${error.stack?.split('\n').slice(0, 4).join(' | ') ?? error}`)
  failures++
} finally {
  await browser.close()
  preview.stop()
}

console.log(failures ? `\nWORD BORDER MOTION FAILED: ${failures} check(s)` : '\nWORD BORDER MOTION DRIVE OK')
if (failures) process.exitCode = 1
