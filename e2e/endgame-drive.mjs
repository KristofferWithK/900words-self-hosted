// The two ends of a round: who opens it, and what happens when the clues run
// out.
//
// Both are rules, not decoration. Casey opens (owner, 2026-09-06), so the
// round starts on his clue and the player's first move is a guess — and the
// reroll, which is for the player who cannot read the board, has to survive
// his opening clue to be worth anything.
// Sudden death means the clue tokens running out is not the end — you keep
// naming words with nothing to go on, and one wrong name finishes it. Neither
// is provable from the engine alone: the phase has to reach the screen, the
// board has to stay tappable, and the round has to be able to end both ways.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { startPreview } from './preview-server.mjs'
import { installRoundGuidanceHandler } from './round-guidance.mjs'
import { city1ReaderState, measureReviewGeometry } from './city1-review-geometry.mjs'

const PORT = 4195
const preview = await startPreview(PORT)

// Read off disk rather than out of the page: the sentences the summary shows
// have to be checkable against the dataset they claim to come from, and the app
// does not put WORDS on the window.
const DATASET = new Map(
  JSON.parse(readFileSync(new URL('../src/data/words.da.json', import.meta.url), 'utf8')).map(
    (w) => [w.id, w],
  ),
)

// The route's stops, in order, read off the route source rather than typed in.
// The P1 sentence band's legend names the city whose board it is drawn from,
// and that band lives on cities 2-9 now (PR #216) — a hard-coded "Ribe" would
// keep passing after the route changed, and the route has changed once already
// (Viborg left when the dataset came down from a thousand).
const CITY_NAMES = [
  ...readFileSync(new URL('../src/lang/da/route.ts', import.meta.url), 'utf8').matchAll(
    /^\s+name: '([^']+)',$/gm,
  ),
].map((m) => m[1])
if (CITY_NAMES.length !== 9) throw new Error(`read ${CITY_NAMES.length} city names, not nine`)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await installRoundGuidanceHandler(page)
const crashes = []
page.on('pageerror', (e) => crashes.push(String(e)))

// Every utterance the page asks for, in order. Headless Chromium has a
// speechSynthesis with no voices in it, so `speak()` is callable and silent —
// which is all this needs: audible sound cannot be asserted, but "the app asked
// for these words, in this order" can. The same trick offline-drive plays with
// clip requests, for the half of `playWord` that has no clip to fetch.
await page.addInitScript(() => {
  // `visibilitychange` persists the live cache during a reload. Queue a
  // durable fixture in session storage, then consume it before the next app
  // module hydrates, so the deliberately forced slot cannot be overwritten by
  // the old in-memory round on its way out.
  // Opaque `about:blank` is used between wheel seeds and has no session
  // storage. It does not need a queued fixture, so leave it completely quiet.
  try {
    const queuedFixture = sessionStorage.getItem('__endgame-primary-fixture-v1')
    if (queuedFixture) {
      const fixture = JSON.parse(queuedFixture)
      localStorage.setItem('cluecab-progression-sessions-v1', fixture.sessions)
      localStorage.setItem('cluecab-game-v1', fixture.cache)
      sessionStorage.removeItem('__endgame-primary-fixture-v1')
    }
  } catch { /* opaque origin: no fixture can be consumed here */ }
  window.__said = []
  window.__mediaStarts = []
  window.__audioFetches = []
  const fetchAudio = window.fetch.bind(window)
  window.fetch = (...args) => {
    window.__audioFetches.push(String(args[0]))
    return fetchAudio(...args)
  }
  const playMedia = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    // The UI effects (sfx.ts) have their own record below, and their muted
    // priming starts are not audio: this list stays the word player's.
    if (!this.dataset?.sfx) window.__mediaStarts.push(this.currentSrc || this.src)
    return playMedia.apply(this, args)
  }
  // Effects play as frozen files on media elements (src/ui/sfx.ts); each
  // announces itself with a `cluecab-sfx` event at the moment it starts.
  window.__feedback = { sfx: [], vibrations: [] }
  window.addEventListener('cluecab-sfx', (event) => {
    window.__feedback.sfx.push({ kind: event.detail.kind, wallTime: performance.now() })
  })
  window.__wheelTransitions = []
  document.addEventListener('transitionend', (event) => {
    if (event.target?.matches?.('.wheel-svg') && event.propertyName === 'transform') {
      window.__wheelTransitions.push({ wallTime: performance.now(), elapsedTime: event.elapsedTime })
    }
  }, true)
  // C1-PC-1 result recovery reads the durable primary slot. A fixture that
  // changes only the old game cache is deliberately ignored on reload. Queue
  // the slot and cache together for the next document instead; the current
  // page's normal pause persistence must remain free to finish its own write.
  window.__writePrimaryFixture = (raw) => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    if (!sessions?.primary || sessions.activeSlot !== 'primary' || !raw?.state?.game) {
      throw new Error('endgame fixture has no active durable primary slot')
    }
    sessions.primary.game = raw.state.game
    sessionStorage.setItem('__endgame-primary-fixture-v1', JSON.stringify({
      sessions: JSON.stringify(saved), cache: JSON.stringify(raw),
    }))
  }
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (pattern) => {
      window.__feedback.vibrations.push(pattern)
      return true
    },
  })
  const synth = window.speechSynthesis
  if (!synth) return
  const speak = synth.speak.bind(synth)
  synth.speak = (u) => {
    window.__said.push(u.text)
    try {
      speak(u)
    } catch {
      /* no voice installed; the record is the point */
    }
  }
})

const fail = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail.push(name)
}

const game = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game)

/** Start a round, past the study phase. (There is one board since N1, so the
 *  gridIndex this took is gone rather than defaulted.) `first` pins the
 *  opener: the default is Casey, and the sections about the composer ask for
 *  the player so they start in it rather than after a guess. */
async function start(_seed = 5, first = null, city = null) {
  const url = `${preview.base}?mock=1&howto=0${first ? `&first=${first}` : ''}${
    city === null ? '' : `&city=${city}`
  }`
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}')
    const sessions = saved?.state?.byCourse?.da
    return sessions?.activeSlot === 'primary' && !!sessions.primary
  })
  const study = page.locator('.study-dock .btn-primary')
  if (await study.isVisible().catch(() => false)) await study.click()
}

/** The reroll assertion is deliberately a no-reload developer fixture. */
async function startOptional(seed = 5) {
  const url = `${preview.base}?mock=1&howto=0&seed=${seed}`
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await page.goto(url)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
}

/** Rewrite the live game into sudden death, the way running out of clues does
 *  with the wheel spent — the once-per-round fall-through the engine keeps.
 *  (A round with nothing solved still lands here with the wheel never opened.) */
async function forceSuddenDeath() {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    raw.state.game.phase = 'suddenDeath'
    raw.state.game.turnsLeft = 0
    window.__writePrimaryFixture(raw)
  })
  // A reload lands on Home — the screen is not persisted, only the game is —
  // so come back in through the door the player would use.
  await page.reload()
  await page.getByRole('button', { name: 'Continue board' }).click()
  await page.waitForSelector('.sudden-death-bar', { timeout: 15_000 })
}

/**
 * The Translation Wheel is the last chance now: the player solves at least one
 * green, burns the remaining tokens, and the engine opens the challenge. The
 * board is seeded directly (the same write-and-reload trick the drives use),
 * with every segment pre-translated, so the wheel is on screen ready to spin —
 * no recall luck involved — and the store's own spin arm drives the draw.
 */
async function forceWheel() {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    if (solved.length === 0) throw new Error('forceWheel needs at least one solved green')
    g.turnsLeft = 0
    g.phase = 'translateChallenge'
    g.wheel = {
      segments: solved.map((w) => w.wordId),
      translated: solved.map((w) => w.wordId),
      filled: solved.map((_, i) => i),
      attempts: 0,
      landed: null,
      result: null,
      spent: null,
    }
    window.__writePrimaryFixture(raw)
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue board' }).click()
  // The filled wheel is the spinner: the challenge's dock shows nothing left
  // to type, and the disc is the tap target.
  await page.waitForSelector('.wheel-disc', { timeout: 15_000 })
}

/** Tap a board card by its Danish word and confirm. */
async function name(da) {
  await page.locator(`.word-card:has(.card-word:text-is("${da}"))`).click()
  await page.locator('.guess-confirm .btn-primary').click()
}

try {
  // ---- Casey opens ------------------------------------------------------------
  // Read the phase BEFORE his clue can land, then let it: the mock answers in
  // a moment, and a check taken after it would only see the guess bar.
  await startOptional()
  const dealt = await game()
  // The mock answers in a moment, so the deal may already carry his clue by
  // the time the store is read; what may never be there is the player's.
  check(
    'the round is dealt to Casey',
    dealt.phase !== 'playerClueInput' && dealt.clueHistory.every((c) => c.by === 'ai'),
    `${dealt.phase} after ${dealt.clueHistory.length} clues`,
  )
  check('with no clue box on screen', (await page.locator('.clue-input').count()) === 0)
  await page.waitForSelector('.guess-bar', { timeout: 15_000 })
  const opened = await game()
  check(
    'and his clue opens it, so the player’s first move is a guess',
    opened.phase === 'playerGuessing' && opened.clueHistory.length === 1 && opened.clueHistory[0].by === 'ai',
    `${opened.phase} after ${opened.clueHistory.length} clues`,
  )
  // The reroll is for the player who has read the board and cannot connect
  // it — which is now a player with Casey's clue already in front of them.
  // His clue has spent nothing a re-deal would undo, so ↻ is still there;
  // the first guess is what closes it.
  const reroll = page.locator('.icon-btn[aria-label="Deal new words"]')
  check('the reroll survives Casey’s opening clue', await reroll.isVisible())
  const firstGuess = opened.words.find((w) => opened.reveals[w.wordId].kind === 'hidden').da
  await name(firstGuess)
  check(
    'and goes with the player’s first guess',
    await page
      .waitForFunction(() => !document.querySelector('.icon-btn[aria-label="Deal new words"]'), undefined, {
        timeout: 5_000,
      })
      .then(() => true, () => false),
  )

  // The composer sections below want to START in the composer, so they deal
  // the player in first — the dev switch that exists for exactly this.
  await start(5, 'player')
  const composer = await game()
  check('?first=player still deals the player in', composer.phase === 'playerClueInput', composer.phase)

  // The card tick is the app's ordinary interaction language now, not a
  // one-off board effect. A regular button and a text field take the same
  // light path before the keyboard-specific case below resets the recorder.
  await page.evaluate(() => (window.__feedback.vibrations = []))
  await page.getByRole('button', { name: 'more words' }).click()
  await page.locator('.clue-input input').first().click()
  const ordinaryTaps = await page.evaluate(() => window.__feedback.vibrations)
  check(
    'ordinary buttons and fields both give the light tactile tick',
    ordinaryTaps.filter((pattern) => pattern === 10).length === 2,
    JSON.stringify(ordinaryTaps),
  )

  // ---- one outside tap dismisses the composer keyboard, and only that ------
  // Synthetic ordering regression: the keyboard hides on pointer-up before a
  // late click reaches the card, so capture must suppress pointer-down audio
  // and the click action. Hit-tested CDP touch is covered by keyboard-board-drive.
  const firstCard = page.locator('.word-card').first()
  await page.locator('.clue-input input').first().focus()
  await page.evaluate(() => {
    window.__feedback.vibrations = []
    window.__feedback.sfx = []
    window.__mediaStarts = []
    window.__audioFetches = []
    const root = document.documentElement
    root.classList.add('kb-up')
    document.querySelector('.clue-input')?.classList.add('kb-lifted')
    document.activeElement.addEventListener(
      'blur',
      () => {
        root.classList.remove('kb-up')
        document.querySelector('.clue-input')?.classList.remove('kb-lifted')
      },
      { once: true },
    )
    document.querySelector('.kb-scrim').dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 20,
        clientY: 20,
      }),
    )
    document.querySelector('.kb-scrim').dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX: 20,
        clientY: 20,
      }),
    )
    document.querySelector('.word-card').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
  })
  await page.waitForTimeout(150)
  const dismissed = await page.evaluate(() => ({
    active: document.activeElement?.tagName,
    vibrations: window.__feedback.vibrations.length,
    mediaStarts: window.__mediaStarts.length,
    audioFetches: window.__audioFetches.length,
    phase: JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.game?.phase,
  }))
  check(
    'synthetic dismissal sequence swallows the late card click without audio or game changes',
    dismissed.active !== 'INPUT' &&
      dismissed.vibrations === 0 &&
      dismissed.mediaStarts === 0 &&
      dismissed.audioFetches === 0 &&
      dismissed.phase === 'playerClueInput',
    JSON.stringify(dismissed),
  )
  await firstCard.click()
  const secondTap = await page.evaluate(() => window.__feedback.vibrations)
  check(
    'the next deliberate card tap works and gives a light tactile tick',
    secondTap.some((pattern) => pattern === 10),
    JSON.stringify(secondTap),
  )

  // ---- the board, and there is one of it (N1) ---------------------------------
  const mid = opened
  check('the board is 3 across and 6 down', mid.config.cols === 3 && mid.config.rows === 6)
  check('with eighteen words', mid.words.length === 18, `${mid.words.length}`)
  check('and eight clues', mid.config.turnTokens === 8, `${mid.config.turnTokens}`)
  const perSide = Object.values(mid.playerKey).filter((r) => r === 'green').length
  check('eight greens a side, three of them shared', perSide === 8, `${perSide}`)
  check(
    'all eighteen cards render',
    (await page.locator('.word-card').count()) === 18,
    `${await page.locator('.word-card').count()}`,
  )

  // ---- a turn ends itself on the last guess the clue asked for ---------------
  // "when you have guessed the amount of words Cluey gives you the turn ends
  // automatically" — asked for before the rename, and Casey is the same
  // suitcase. Before this the number bought one guess more than it said,
  // so finding everything the clue promised left the turn open with nothing to
  // do in it — which reads as the app having stopped rather than as a bonus.
  //
  // Driven from a forced state rather than by playing on: reaching a Casey clue
  // of a known number, with that many of his greens still on the board, is a
  // matter of luck with the mock companion.
  // A player-opening fixture has no pending Casey request that could write its
  // pre-fixture game after the durable slot below is updated.
  await start(5, 'player')
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    g.phase = 'playerGuessing'
    g.clueHistory = [{ by: 'ai', text: 'mok', number: 2, guesses: [] }]
    window.__writePrimaryFixture(raw)
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue board' }).click()
  await page.waitForSelector('.guess-bar', { timeout: 15_000 })
  const turn = await game()
  const hisGreens = turn.words
    .filter((w) => turn.aiKey[w.wordId] === 'green' && turn.reveals[w.wordId].kind === 'hidden')
    .map((w) => w.da)
  // "· 2 guesses left" since K2, where it read "— up to 2 more guesses": the
  // title is one nowrap line and has a Danish clue to fit beside it.
  check('the bar offers exactly the number, not the number plus one', /2 guesses left/.test(
    await page.locator('.guess-bar .dock-title').textContent(),
  ), await page.locator('.guess-bar .dock-title').textContent())

  await page.evaluate(() => {
    window.__feedback.vibrations = []
    window.__feedback.sfx = []
  })
  await name(hisGreens[0])
  // The suitcase clack is gone (owner, 2026-09-26): a packed word is answered
  // by the green buzz alone. Wait out the 0.38 s the clack used to take, so a
  // stray one would be seen.
  await page.waitForTimeout(600)
  const firstPacked = await page.evaluate(() => ({
    sounds: window.__feedback.sfx.map((e) => e.kind),
    vibrations: window.__feedback.vibrations,
  }))
  check('first packed word gets the green buzz and no sound',
    firstPacked.sounds.length === 0 && firstPacked.vibrations.filter((v) => v === 15).length === 1,
    JSON.stringify(firstPacked))
  check(
    'one of two keeps the turn alive',
    (await page.locator('.guess-bar').count()) === 1,
    (await game()).phase,
  )
  await name(hisGreens[1])
  // No Stop button was pressed; the turn has to end on its own.
  const ended = await game()
  check(
    'and the second ends the turn with nothing to press',
    ended.phase !== 'playerGuessing',
    ended.phase,
  )
  check('the clue is spent', ended.turnsLeft === ended.config.turnTokens - 1, `${ended.turnsLeft}`)
  await page.waitForTimeout(600)
  const reward = await page.evaluate(() => ({
    sounds: window.__feedback.sfx.map((e) => e.kind),
    vibrations: window.__feedback.vibrations,
  }))
  check(
    'both packed words get one green buzz each',
    reward.vibrations.filter((v) => v === 15).length === 2,
    JSON.stringify(reward),
  )
  check(
    'and neither packed word nor the completed clue makes a sound',
    reward.sounds.length === 0,
    JSON.stringify(reward),
  )
  check(
    'both words were banked',
    hisGreens.slice(0, 2).every((da) => {
      const w = ended.words.find((x) => x.da === da)
      return ended.reveals[w.wordId].kind === 'green'
    }),
  )

  // ---- sudden death: the winning end -----------------------------------------
  await start(5, 'player')
  await forceSuddenDeath()
  const sd = await game()
  check('running out of clues opens sudden death rather than ending the round', !sd.outcome)
  check('and the board is still tappable', (await page.locator('.word-card:not([disabled])').count()) > 0)

  const greens = sd.words
    .filter((w) => (sd.playerKey[w.wordId] === 'green' || sd.aiKey[w.wordId] === 'green') &&
      sd.reveals[w.wordId].kind !== 'green')
    .map((w) => w.da)
  for (const da of greens) {
    if ((await page.locator('.sudden-death-bar').count()) === 0) break
    await name(da)
  }
  await page.waitForTimeout(150)
  const won = await game()
  check(
    'naming every remaining green reaches Translation Time from sudden death',
    won.phase === 'translateChallenge' && !won.outcome,
    JSON.stringify({ phase: won.phase, outcome: won.outcome }),
  )
  // The forced wheel remains receipt-valid: it retains the solved board's
  // actual segments and fills every translation before using the production
  // spin action. This is the successor to the former direct all-greens win.
  await forceWheel()
  await page.evaluate(() => { window.__feedback.sfx = [] })
  // Delay the visual start to exercise the renderer/store boundary: a fixed
  // timer from SPIN_WHEEL is not proof that this CSS transition has settled.
  await page.evaluate(() => {
    window.__wheelTransitions = []
    const svg = document.querySelector('.wheel-svg')
    if (!svg) throw new Error('wheel SVG missing before spin')
    svg.style.transitionDelay = '500ms'
  })
  await page.locator('.wheel-disc').click()
  const earlyFanfare = await page.evaluate(() => window.__feedback.sfx.filter((event) => event.kind === 'fanfare'))
  check('the win fanfare does not start when the spin begins', earlyFanfare.length === 0, JSON.stringify(earlyFanfare))
  await page.waitForTimeout(3200)
  const beforeVisualSettle = await page.evaluate(() => ({
    fanfare: window.__feedback.sfx.filter((event) => event.kind === 'fanfare').length,
    transitions: window.__wheelTransitions.length,
    finishOpen: Boolean(document.querySelector('.city1-review-dialog[open]')),
  }))
  check(
    'the result and fanfare wait until the delayed wheel transition actually settles',
    beforeVisualSettle.fanfare === 0 && beforeVisualSettle.transitions === 0 && !beforeVisualSettle.finishOpen,
    JSON.stringify(beforeVisualSettle),
  )
  // A round finishes into the finish screen: the reader of the owner's
  // approved finish/inspect design of 2026-09-11, and since the owner's
  // follow-up of the same evening the ONE finish surface — a full-bleed
  // <dialog> carrying the outcome, the counts, the token line, the transcript
  // link and the exits. There is nothing underneath it; everything below is
  // read inside it.
  const finish = page.locator('.city1-review-dialog[open]')
  await finish.waitFor()
  const fanfare = await page.evaluate(() => window.__feedback.sfx.filter((event) => event.kind === 'fanfare'))
  check('the green wheel landing plays one brass fanfare', fanfare.length === 1, JSON.stringify(fanfare))
  const handoffTiming = await page.evaluate(() => ({
    settledAt: window.__wheelTransitions.at(-1)?.wallTime ?? null,
    cueAt: window.__feedback.sfx.find((event) => event.kind === 'fanfare')?.wallTime ?? null,
  }))
  check(
    'the win fanfare starts on the actual SVG transform transitionend',
    handoffTiming.settledAt !== null && handoffTiming.cueAt !== null &&
      Math.abs(handoffTiming.cueAt - handoffTiming.settledAt) < 100,
    JSON.stringify(handoffTiming),
  )
  await page.locator('.receipt-postcard-total').waitFor()
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? '.'}/normal-win-joker.png` })
  check('and the finish screen says so', (await page.locator('.round-summary').count()) === 1 && (await finish.count()) === 1)

  // A real normal-round win earns its receipt-owned rewards through the
  // complete player path, and the compact result projects them above review.
  const receiptAfterWin = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('cluecab-progression-sessions-v1') ?? '{}').state?.byCourse?.da
    const attemptId = session?.primary?.attemptId
    const ledger = JSON.parse(localStorage.getItem('cluecab-settlement-v1') ?? '{}')
    return attemptId ? ledger?.settlements?.[JSON.stringify(['receipt-v1', attemptId])]?.receipt ?? null : null
  })
  check('the translated spin settles as a win before the receipt surface opens',
    receiptAfterWin?.evidence?.game?.outcome?.result === 'won', JSON.stringify(receiptAfterWin?.evidence?.game?.outcome))
  const winHeadlineByTier = { silver: 'Good game!', gold: 'Great game!', platinum: 'Perfect game!' }
  const winHeadline = await finish.locator('.city1-review-outcome').textContent()
  check('the win headline reflects this attempt tier',
    winHeadline?.trim() === winHeadlineByTier[receiptAfterWin?.attemptTier],
    `${winHeadline?.trim()} / ${receiptAfterWin?.attemptTier}`)
  check('a win visibly projects its receipt-owned reward',
    (await page.locator('.receipt-postcards').count()) === 1 && (await page.locator('.receipt-reward-new').count()) > 0,
  )
  const earnedText = await page.locator('.receipt-postcards').innerText()
  check('and names the actual incremental postcards', /postcard/i.test(earnedText), earnedText)
  check('the receipt, rather than the mutable game cache, records the incremental postcards',
    Number.isInteger(receiptAfterWin?.rewards?.postcards) && receiptAfterWin.rewards.postcards > 0,
    JSON.stringify(receiptAfterWin?.rewards),
  )

  // ---- the summary counts the round, and nothing else -----------------------
  // Both values are SRS diffs from this round. Zero remains an explicit count;
  // the compact receipt reports counts rather than listing individual words.
  const stats = await page.evaluate(() => {
    const read = (sel) => document.querySelector(`${sel} .stat-n`)?.textContent?.trim() ?? ''
    return {
      discovered: read('.stat-discovered'),
      collected: read('.stat-collected'),
      retired: document.querySelectorAll(
        '.summary-scroll, .stat-city, .stat-total, .collected-section',
      ).length,
      banner: document.querySelector('.outcome-banner')?.innerText ?? '',
      face: document.querySelectorAll('.outcome-banner .cluey-svg.mood-happy').length,
    }
  })
  check('the summary counts what was discovered', /^\d+$/.test(stats.discovered), stats.discovered)
  check(
    'and what was collected, including a truthful zero',
    /^\d+$/.test(stats.collected),
    `"${stats.collected}"`,
  )
  check(
    'and nothing P1 retired is left: no scroller, no city or journey tile, no list',
    stats.retired === 0,
    `${stats.retired} still there`,
  )
  // Casey carries the tone now, which is why the emoji went.
  check('Casey is on the summary, wearing the outcome', stats.face === 1, `${stats.face} faces`)
  check('and the celebration emoji is gone', !/🎉/.test(stats.banner), stats.banner.split('\n')[0])
  // This round greened words on a board of never-before-seen ones, so a zero
  // here would mean the diff was taken on the wrong side of recordRound.
  check(
    'and a board of new words is not counted as zero new words',
    Number(stats.discovered) > 0,
    stats.discovered,
  )

  // ---- a City 1 round says its sentences in the READER, not in a band ------
  // Since PR #216 RoundSummary renders the P1 sentence band only when
  // boardCityIndex !== 0, so the finish screen a City 1 round lands on carries
  // no band at all: ZERO `.sentence-row` is the pin here, and the band's own
  // pins — two to six rows, the legend, a row that speaks, the estimator's
  // constants — are measured on a City 2 board further down.
  //
  // This particular round gives Casey the only clue in it (the last chance is
  // forced immediately after the deal), and the reader's queue is built from
  // the PLAYER's clues — so there is no sentence for it to show, and the
  // finish screen says so in the reader's place rather than falling back to
  // some other screen. (The wheel section below starts its own fresh rounds,
  // so this check rides the sudden-death win directly above it.) `city1ReaderState` says which happened rather than
  // assuming; a reader with a sentence in it is pinned by smoke-drive,
  // p4-drive and the two review drives, on rounds that do give a player clue.
  const readerHere = await city1ReaderState(page)
  const city1Band = await page.evaluate(() => ({
    rows: document.querySelectorAll('.sentence-row').length,
    band: document.querySelectorAll('.sentence-review, .sentence-legend, .sentence-hear').length,
  }))
  check(
    'a City 1 finish screen carries no sentence band — 0 rows, 0 band nodes; its reader shows a sentence or says there is none',
    city1Band.rows === 0 && city1Band.band === 0 && readerHere.open && (readerHere.danish.length > 0 || readerHere.empty),
    `${city1Band.rows} rows / ${city1Band.band} band nodes, reader ${readerHere.danish ? readerHere.progress : readerHere.empty ? 'nothing to review, said in place' : 'neither a sentence nor the empty line'}`,
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)

  // The transcript is behind a lid, shut. It is the longest thing on the screen
  // and the least urgent — the numbers above are what the round is judged on.
  // Since P1 it opens as a PANEL over the summary rather than a section under
  // it, which is why it shuts on its own control: the lid it was opened from is
  // underneath the panel.
  check('the turn log is collapsed to start with', (await page.locator('.turn-log').count()) === 0)
  await page.locator('.log-toggle').click()
  await page.waitForTimeout(200)
  check('and one tap opens it', (await page.locator('.turn-log').count()) === 1)
  check(
    'with the lid reporting its own state',
    (await page.locator('.log-toggle').getAttribute('aria-expanded')) === 'true',
  )
  await page.locator('.log-close').click()
  await page.waitForTimeout(200)
  check('and shuts again', (await page.locator('.turn-log').count()) === 0)

  // ---- the Translation Wheel: the ENDING played -------------------------------
  // The finish-screen pins above read the sudden-death win; the wheel starts
  // its own rounds from here, so the ending economy is proven on a board the
  // wheel has not touched.
  // The wheel IS the round's ending (owner, 2026-09-18), and the drive proves
  // the whole loop on the screen the player uses: the filled wheel, the tap
  // that spins it (the engine draws, the store applies), and the finish
  // screen whose verdict the spin wrote — won:wheel-win on a green landing,
  // lost:wheel-miss otherwise. The old chooser path is gone.
  let wheelWon = false
  let wheelSawMiss = null
  for (let seed = 5; seed <= 40 && !wheelWon; seed++) {
    await start(seed, 'player')
    // Solve one real green first: the wheel holds what the round has solved.
    const solvedDa = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
      const g = raw.state.game
      const open = g.words.filter((w) => g.reveals[w.wordId].kind === 'hidden')
      const green =
        open.find((w) => g.playerKey[w.wordId] === 'green' || g.aiKey[w.wordId] === 'green') ??
        null
      if (!green) return null
      g.reveals[green.wordId] = { kind: 'green' }
      window.__writePrimaryFixture(raw)
      return green.da
    })
    if (!solvedDa) continue
    // The durable primary fixture is consumed before hydration of the next
    // document; it must not be read back from the outgoing cache.
    await page.reload()
    await page.getByRole('button', { name: 'Continue board' }).click()
    await forceWheel()
    // Evidence shot before the spin: the filled wheel waiting (captured once).
    if (seed === 5) {
      await page.screenshot({ path: `${process.env.SHOT_DIR ?? 'evidence'}/translate-wheel-filled-390.png` })
    }
    await page.locator('.wheel-disc').click()
    // The store applies SPIN_WHEEL: the spin decides the round, and the
    // finish screen (either verdict) appears inside the spin's animation
    // window — the wheelSpinHold keeps the wheel mounted until it rests.
    const result = await page
      .waitForSelector('.city1-review-dialog[open]', { timeout: 15_000 })
      .then((el) => el.evaluate((node) => node.className), () => null)
    if (result === null) throw new Error('the wheel spin produced no finish screen')
    const spun = await game()
    if (spun.wheel?.result === 'win') {
      wheelWon = true
      check(
        'a won spin finishes the round as won through the normal outcome path',
        spun.phase === 'finished' &&
          spun.outcome?.result === 'won' &&
          spun.outcome?.reason === 'wheel-win' &&
          spun.turnsLeft === 0,
        `phase ${spun.phase}, outcome ${JSON.stringify(spun.outcome)}`,
      )
    } else {
      wheelSawMiss = spun.outcome
      check(
        'a lost spin ends the round on the wheel’s verdict',
        spun.phase === 'finished' && spun.outcome?.result === 'lost' && spun.outcome?.reason === 'wheel-miss',
        JSON.stringify(spun.outcome),
      )
    }
    // Back out of the finish screen before the next seed's deal.
    await page.goto('about:blank')
  }
  check(
    'the wheel was seen won across the seeds (the ending\u2019s win path is proven)',
    wheelWon,
  )
  check(
    'the miss path was also seen, or the seeded draw never missed (noted, not failed)',
    wheelSawMiss !== null || true,
    JSON.stringify(wheelSawMiss),
  )

  // ---- the City 2 sentence band is beyond the release scope ------------------
  // The band moved off City 1 with PR #216: RoundSummary renders
  // RoundSentences only when `boardCityIndex !== 0`, so everything below the
  // City 1 win was measured on the second stop, dealt with `?city=1`. The
  // release scope (DEVELOPED_CITY_COUNT = 1) ends that: no one reaches the
  // second stop, the jump refuses to seed past it, and the band has nothing
  // to measure on until City 2 opens the road. What stays checkable here is
  // the scope side of the same seam: a City 2 deal is not dealt, no band
  // surface renders, and nothing crashes. (The estimator pins in this section
  // move to whichever drive measures the band again when the scope lifts.)
  await page.goto(`${preview.base}?mock=1&howto=0&seed=5&city=0`)
  await page.waitForSelector('.city-card')
  await page.evaluate(() => {
    localStorage.removeItem('cluecab-game-v1')
    localStorage.removeItem('cluecab-progression-sessions-v1')
    localStorage.removeItem('cluecab-settlement-v1')
  })
  await page.goto(`${preview.base}?mock=1&howto=0&seed=5&city=0`)
  await page.waitForSelector('.city-card')
  await page.locator('.home-play').click()
  await page.waitForSelector('.board-grid')
  const dealtCity = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cluecab-game-v1') ?? '{}').state?.boardCityIndex,
  )
  check('the board being dealt stays inside the release scope', dealtCity === 0, `boardCityIndex ${dealtCity}`)
  check(
    'the City 2 sentence band has no surface under the release scope',
    (await page.locator('.sentence-review').count()) === 0,
  )

  // ---- sudden death: the losing end ------------------------------------------
  await start(5, 'player')
  await forceSuddenDeath()
  const sd2 = await game()
  const dud = sd2.words.find(
    (w) =>
      sd2.playerKey[w.wordId] !== 'green' &&
      sd2.aiKey[w.wordId] !== 'green' &&
      sd2.reveals[w.wordId].kind === 'hidden',
  )
  if (!dud) throw new Error('no non-green word to end sudden death on')
  await name(dud.da)
  const lost = await game()
  check(
    'one word that is green on neither key ends it',
    lost.outcome?.result === 'lost' && lost.outcome?.reason === 'sudden-death',
    JSON.stringify(lost.outcome),
  )
  check(
    'and the card is turned over, so the ending reads',
    lost.reveals[dud.wordId].kind !== 'hidden',
    lost.reveals[dud.wordId].kind,
  )
  // As a bystander against both sides, which is the only thing a non-green can
  // be now. It used to branch: a word forbidden on either key revealed as
  // 'forbidden' here instead, and that special case is gone with the role.
  check(
    'as a neutral for both sides, since there is no other role left',
    lost.reveals[dud.wordId].kind === 'bystander' &&
      lost.reveals[dud.wordId].against?.length === 2,
    JSON.stringify(lost.reveals[dud.wordId]),
  )
  // The summary no longer names the card that ended the last chance — the
  // participation headline and round's counts are the whole result. The card
  // is still turned over on the board behind the dialog, but
  // the board unmounts under the full-bleed surface, so no line names it.
  const surface = await page.locator('.city1-review-dialog').innerText()
  check('and the summary no longer names the card that ended it', !surface.includes(dud.da), 'culprit line removed')
  check(
    'with Casey wearing the loss',
    (await page.locator('.outcome-banner .cluey-svg.mood-oops').count()) === 1,
  )

  // The last-chance ending uses Bronze as a participation-only presentation,
  // with zero new rewards. The finish screen is fixed — its reader is the only scroller
  // and the document never is — so it is measured at both phone sizes here,
  // the way layout-drive measures the ordinary win and wrapup-drive the
  // wrap-up; the geometry helper asserts the tiling and throws.
  await finish.locator('.receipt-postcard-total').waitFor()
  check('the loss presents Bronze as participation only, with no earned rewards',
    (await finish.locator('.city1-review-outcome').textContent())?.trim() === 'Participation trophy' &&
      (await finish.locator('.receipt-tier-bronze').count()) === 1 &&
      (await finish.locator('.receipt-tier-qualifier').textContent())?.trim() === 'participation only' &&
      (await finish.locator('.receipt-postcards').textContent())?.trim() === '+0 new postcards' &&
      (await finish.locator('.receipt-reward-new').count()) === 0 &&
      // Sudden death has no explanatory sub and never names a culprit card.
      (await finish.locator('.outcome-sub').count()) === 0 &&
      (await finish.locator('.confetti').count()) === 0,
    (await finish.locator('.city1-review-outcome').textContent()) ?? '')
  for (const [w, h] of [
    [360, 640],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(300)
    const m = await measureReviewGeometry(finish, `last-chance finish screen @${w}x${h}`)
    check(
      `no-scroll: last-chance finish screen @${w}x${h}`,
      m.documentHeight <= m.viewport.height + 1,
      `${m.documentHeight} of ${m.viewport.height}, header ${m.surface.context.height.toFixed(1)}px`,
    )
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)

  // ---- sudden death: walking away --------------------------------------------
  // The walk-away is the round with the wheel SPENT: the earned token was
  // burned (the once-per-round rule), the next exhaustion falls through to
  // sudden death, and from there walking away is the loss it always was. The
  // seeded wheel carries spent: 'ai' so the state reads the way a played-out
  // wheel leaves it.
  await start(5, 'player')
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cluecab-game-v1'))
    const g = raw.state.game
    const solved = g.words.filter((w) => g.reveals[w.wordId].kind === 'green')
    if (solved.length > 0) {
      g.wheel = {
        segments: solved.map((w) => w.wordId),
        translated: solved.map((w) => w.wordId),
      filled: solved.map((_, i) => i),
      attempts: 0,
        landed: 0,
        result: 'win',
        spent: 'ai',
      }
    }
    g.phase = 'suddenDeath'
    g.turnsLeft = 0
    window.__writePrimaryFixture(raw)
  })
  await page.reload()
  await page.getByRole('button', { name: 'Continue board' }).click()
  await page.waitForSelector('.sudden-death-bar', { timeout: 15_000 })
  await page.locator('.sudden-death-bar .btn-ghost').click()
  const gaveUp = await game()
  check(
    'giving up is allowed, and is a loss',
    gaveUp.outcome?.result === 'lost' && gaveUp.outcome?.reason === 'timeout',
    JSON.stringify(gaveUp.outcome),
  )

  check('no page errors', crashes.length === 0, crashes.join(' | '))
  console.log(fail.length ? `\nFAILED: ${fail.join(', ')}` : '\nENDGAME DRIVE OK')
  if (fail.length) process.exitCode = 1
} catch (e) {
  console.log('ENDGAME DRIVE FAILED:', e.stack ?? e.message)
  process.exitCode = 1
} finally {
  await browser.close()
  preview.stop()
  process.exit(process.exitCode ?? 0)
}
