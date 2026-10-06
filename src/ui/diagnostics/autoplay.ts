import { diagMark } from './recorder'
import { diagRun } from './autoplayGate'

/**
 * THE SOAK PLAYER (developer-only; see autoplayGate.ts for how it is reached).
 *
 * Plays the way a person does, through the same doors, so a simulator can run
 * for half an hour while the performance log records whether a word hit gets
 * slower:
 *
 *  - Sightseeing walks back to back, Home between them (meaning and article
 *    gates in the one walk since #403). Steering is a tap on the road's left or right half (real
 *    pointer events on the stage, the path a thumb takes), decided once per
 *    gate after a human reaction time, right about 85% of the time.
 *  - Every fifth outing a café puzzle instead: Casey is the scripted mock, and
 *    the player side taps cards, confirms guesses, writes a clue, fills the
 *    wheel and spins it, through to the results. A puzzle that stops making
 *    progress is left after a while; the log marks it.
 *
 * Everything it does is marked in the log (`auto ...`), so a slow hit can be
 * matched to what was happening.
 */

const TICK_MS = 250
const RIGHT_RATE = 0.85
const CAFE_EVERY = 5
const PUZZLE_GIVE_UP_MS = 4 * 60_000
const STUCK_MS = 45_000
const CLUES = ['togetherness', 'weather', 'journey', 'kitchen', 'animal', 'family', 'morning', 'travel', 'colour', 'music']

let started = false
let outings = 0

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function q<T extends Element = HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel)
}

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false
  const r = (el as HTMLElement).getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function enabled(el: Element | null): el is HTMLElement {
  return visible(el) && !(el as HTMLButtonElement).disabled
}

/** A tap: pointerdown, pointerup, click, the order a finger produces them in. */
function tap(el: HTMLElement, x?: number, y?: number): void {
  const r = el.getBoundingClientRect()
  const clientX = x ?? r.left + r.width / 2
  const clientY = y ?? r.top + r.height / 2
  const init = { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true }
  el.dispatchEvent(new PointerEvent('pointerdown', init))
  el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0 }))
}

/** Type into a React-controlled field the way the keyboard would. */
function typeInto(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

type Stores = {
  ui: typeof import('../../stores/uiStore')
  game: typeof import('../../stores/gameStore')
  settings: typeof import('../../stores/settingsStore')
  walks: typeof import('../../run/walks')
}
let stores: Stores | null = null

// ── Sightseeing ────────────────────────────────────────────────────────────

let decidedGate = -1
let target: number | null = null
let nextSteerAt = 0
let panelSince = 0
let lastPanel = ''

function steerTick(now: number): void {
  const run = diagRun()
  const stage = q('.run-stage')
  if (!run || !stage || q('.run-scrim')) return
  const gate = run.activeGate()
  if (!gate || gate.reveal <= 0) return
  if (gate.id !== decidedGate) {
    decidedGate = gate.id
    const lanes = gate.options.length
    const right = Math.random() < RIGHT_RATE
    target = right ? gate.correct : (gate.correct + 1 + Math.floor(Math.random() * Math.max(1, lanes - 1))) % lanes
    // A human reaction: the word is read before the thumb moves.
    nextSteerAt = now + rand(300, 650)
    return
  }
  if (target === null || now < nextSteerAt) return
  const lane = run.state.lane
  if (lane === target) {
    target = null
    return
  }
  const r = stage.getBoundingClientRect()
  const x = lane < target ? r.left + r.width * 0.78 : r.left + r.width * 0.22
  tap(stage, x, r.top + r.height * 0.6)
  nextSteerAt = now + rand(120, 200)
}

function sightseeingTick(now: number): void {
  const panel = q('.run-panel')
  const name = !panel
    ? 'play'
    : q('.run-cafe-go')
      ? 'cafe'
      : q('.run-title-wrong, .run-title-caught') || q('.run-total')
        ? 'over'
        : 'other'
  if (name !== lastPanel) {
    lastPanel = name
    panelSince = now
  }
  if (name === 'play') return steerTick(now)
  // A panel is read for a moment, as a person would.
  if (now - panelSince < 1800) return
  if (name === 'cafe') return void tap(q('.run-cafe-go')!)
  if (name === 'over') {
    const home = q('.run-home')
    if (enabled(home)) {
      diagMark('auto-run-over')
      tap(home)
    }
    return
  }
  // Ready or paused: start or resume.
  const primary = q('.run-panel .run-tag-btn-primary')
  if (enabled(primary)) tap(primary)
}

// ── café puzzle ────────────────────────────────────────────────────────────

let puzzleSince = 0
let progressAt = 0
let lastSignature = ''
let clueIndex = 0
let nextActAt = 0
let triedWheel = new Set<string>()

function puzzleSignature(): string {
  const g = stores?.game.useGame.getState().game
  if (!g) return 'none'
  return `${g.phase}|${Object.keys(g.reveals ?? {}).length}|${g.clueHistory?.length ?? 0}|${g.wheel?.translated.length ?? 0}|${g.wheel?.landed ?? ''}|${g.outcome ? 'done' : ''}`
}

function leavePuzzle(why: string): void {
  diagMark(`auto-puzzle-left:${why}`)
  const back = q('.game-header button')
  if (enabled(back)) tap(back)
  window.setTimeout(() => {
    const pause = q('.leave-pause')
    if (enabled(pause)) tap(pause)
  }, 600)
}

function puzzleTick(now: number): void {
  if (!puzzleSince) {
    puzzleSince = now
    progressAt = now
    triedWheel = new Set()
  }
  const sig = puzzleSignature()
  if (sig !== lastSignature) {
    lastSignature = sig
    progressAt = now
  }
  if (now < nextActAt) return
  nextActAt = now + rand(900, 1600)
  if (now - puzzleSince > PUZZLE_GIVE_UP_MS) return leavePuzzle('too-long')
  if (now - progressAt > STUCK_MS) return leavePuzzle('stuck')

  const guidance = q('.round-guidance-dialog button')
  if (enabled(guidance)) return tap(guidance)
  const keep = q('.leave-keep-playing')
  if (enabled(keep)) return tap(keep)

  const game = stores?.game.useGame.getState().game
  // Finished: the results, then Home by the header's arrow.
  if (game?.outcome || game?.phase === 'finished') {
    const results = q('.wheel-results')
    if (enabled(results)) return tap(results)
    if (now - progressAt < 4000) return
    const back = q('.game-header button')
    if (enabled(back)) {
      diagMark('auto-puzzle-done')
      tap(back)
    }
    return
  }

  // The wheel: write one suitcase word's Danish at a time, then spin.
  const wheelInput = q<HTMLInputElement>('.wheel-input')
  if (game?.wheel && wheelInput && enabled(wheelInput)) {
    const todo = game.wheel.segments.filter((id) => !game.wheel!.translated.includes(id) && !triedWheel.has(id))
    const id = todo[0]
    if (id) {
      triedWheel.add(id)
      const word = game.words.find((w) => w.wordId === id)
      typeInto(wheelInput, word?.da ?? 'hus')
      const confirm = q('.wheel-confirm')
      if (enabled(confirm)) window.setTimeout(() => tap(confirm), 300)
      return
    }
  }
  const disc = q('.wheel-disc')
  if (enabled(disc)) return tap(disc)

  // Guessing: a card, then confirm it.
  const confirm = q('.guess-confirm .btn-primary')
  if (enabled(confirm)) return tap(confirm)
  const cards = [...document.querySelectorAll<HTMLElement>('.word-card.card-guessable')].filter(enabled)
  if (cards.length) return tap(cards[Math.floor(Math.random() * cards.length)]!)

  // The player's clue.
  const clue = q<HTMLInputElement>('.clue-input input')
  const send = q('.clue-input .btn-primary')
  if (clue && enabled(clue) && send) {
    typeInto(clue, CLUES[clueIndex++ % CLUES.length]!)
    window.setTimeout(() => enabled(send) && tap(send), 400)
    return
  }
  // A dock button that moves the round on (stop guessing, continue).
  const other = q('.guess-bar .dock-actions > .btn, .dock .tag-primary')
  if (enabled(other)) return tap(other)
}

// ── Home and the loop ──────────────────────────────────────────────────────

let homeSince = 0

function homeTick(now: number): void {
  if (!homeSince) homeSince = now
  if (now - homeSince < 2500) return
  homeSince = 0
  outings++
  const s = stores!
  if (outings % CAFE_EVERY === 0) {
    const play = q('.home-play')
    if (enabled(play)) {
      diagMark(`auto-outing:${outings}:cafe:${play.dataset.cafeAction ?? ""}`)
      puzzleSince = 0
      tap(play)
      return
    }
  }
  diagMark(`auto-outing:${outings}:sightseeing`)
  decidedGate = -1
  lastPanel = ''
  s.walks.chooseWalk('words', { startNow: true })
  s.ui.useUi.getState().goTo('sightseeing')
}

function tick(): void {
  if (!stores) return
  const now = performance.now()
  const screen = stores.ui.useUi.getState().screen
  try {
    if (screen === 'sightseeing') return sightseeingTick(now)
    if (screen === 'game') return puzzleTick(now)
    puzzleSince = 0
    if (screen === 'home') return homeTick(now)
    // Anywhere else (a dialog's screen, Settings): back to Home.
    if (now - homeSince > 5000) {
      homeSince = now
      stores.ui.useUi.getState().goTo('home')
    }
  } catch (e) {
    diagMark(`auto-error:${(e as Error)?.message ?? String(e)}`)
  }
}

export async function startAutoplay(): Promise<void> {
  if (started) return
  started = true
  const [ui, game, settings, walks] = await Promise.all([
    import('../../stores/uiStore'),
    import('../../stores/gameStore'),
    import('../../stores/settingsStore'),
    import('../../run/walks'),
  ])
  stores = { ui, game, settings, walks }
  // Casey scripted: no network, no model calls (gameStore honours this only while autoplay is on).
  settings.useSettings.setState({ useMock: true })
  diagMark('auto-start')
  window.setInterval(tick, TICK_MS)
}
