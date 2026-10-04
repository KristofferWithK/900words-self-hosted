import { useEffect } from 'react'

/**
 * The keyboard, in the native shell only — where the platform gives us what
 * the web never could.
 *
 * Four attempts at this in the browser all failed on a real iPhone, each for a
 * different reason, and all of them traceable to two missing facts: the web is
 * told the keyboard's height only AFTER it has moved, and the visual-viewport
 * pan that reveals a focused field is the browser's to perform, not ours to
 * prevent. Guessing the height panned the page; measuring it arrived a frame
 * late and lagged. That code is gone, and the mobile web keeps the platform's
 * own imperfect behaviour.
 *
 * Here neither problem exists. Keyboard.resize 'body' (capacitor.config.ts)
 * means the OS never resizes, pans or scrolls the WEBVIEW — the board cannot
 * move, by construction rather than by defence — and keyboardWillShow reports
 * the exact height BEFORE the animation, so the composer can be placed rather
 * than chased.
 *
 * What is left is not arithmetic but timing: the document shrinks to the
 * keyboard's top edge, and the composer, being last in the layout, lands on it
 * with no height to learn and no gap to tune. See the ride below for when that
 * shrink actually happens, which is later than the config comment used to say.
 */

/**
 * How the dock LOOKS while it travels — never where it lands, which is the
 * layout's own, measured and handed back at the end of the ride.
 *
 * The duration is no longer a guess: the vendored plugin forwards the
 * keyboard animation's real duration in the willShow payload and the ride
 * animates over exactly that. RIDE_MS survives only as the fallback for a
 * payload without one (a zero from a keyboard re-reporting mid-layout, or
 * the kbsim path without a /duration suffix).
 *
 * The curve is still an approximation — UIKit animates its keyboard on a
 * private spring it does not publish as a bezier, and this is the bezier the
 * platform's animations are routinely matched with. The payload also carries
 * the raw curve constant (7 in practice), unused today, so RIDE_EASE can be
 * tuned per-curve from JS if filming ever shows a mid-flight gap — without
 * another native build.
 */
const RIDE_MS = 250
const RIDE_EASE = 'cubic-bezier(0.38, 0.7, 0.125, 1)'
/**
 * If the document never shrinks, stop waiting and hand the dock back anyway.
 * The plugin skips its resize entirely when the height it would set is the one
 * already set (Keyboard.m, setKeyboardHeight: returns early on an unchanged
 * paddingBottom), which happens when focus moves between two fields without
 * the keyboard going down. Without this the transform would simply stay on.
 */
const RIDE_GIVEUP_MS = 1200

function flagOn(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    /* private mode */
    return false
  }
}

/**
 * The numbers this places the composer with, on the screen it places it on.
 *
 * Two builds have now been spent on a gap I could not see, reasoning about
 * what iOS means by "keyboard height" from a thousand miles away. This puts
 * the arithmetic where the person holding the phone can read it, and it
 * costs one screenshot to settle instead of one build per guess.
 *
 * Merges rather than replaces, because the ride reports in three instalments
 * — measured, riding, handed back — and the point is to read them together.
 *
 * Shown only while the debug flag is on — Settings → the build stamp, or
 * localStorage cluecab-kbdebug — so it is not in anyone's way by default.
 */
const shown: Record<string, number> = {}
function report(n: Record<string, number>) {
  Object.assign(shown, n)
  if (!flagOn('cluecab-kbdebug')) return
  let box = document.getElementById('kbdebug')
  if (!box) {
    box = document.createElement('pre')
    box.id = 'kbdebug'
    box.style.cssText =
      'position:fixed;left:4px;top:4px;z-index:9999;margin:0;padding:4px 6px;' +
      'background:rgba(18,18,18,.85);color:#8f8;font:10px/1.3 ui-monospace,Menlo,monospace;' +
      'border-radius:5px;pointer-events:none;white-space:pre'
    document.body.appendChild(box)
  }
  box.textContent = Object.entries(shown)
    .map(([k, v]) => `${k.padEnd(8)}${v}`)
    .join('\n')
}

/**
 * Where the dock will end up once the document has shrunk — by shrinking it,
 * looking, and handing it straight back in the same tick, so nothing paints in
 * between.
 *
 * This is a measurement rather than a sum on purpose. The obvious arithmetic —
 * "move the dock up by the keyboard's height" — is the arithmetic that has
 * already cost this project three builds, once too high and once too low by
 * the height of the home indicator. The layout knows the answer; asking it is
 * cheaper than deriving it, and it stays right when the padding rules change.
 */
function probeFinalTop(dock: HTMLElement, px: number): number {
  const body = document.body
  const had = body.style.height
  body.style.height = `${window.innerHeight - px}px`
  const top = dock.getBoundingClientRect().top
  body.style.height = had
  return top
}

/**
 * ---- the ride (ON by default; localStorage cluecab-kbstill = '1' opts out) --
 *
 * The complaint this answers: the composer's resting place is exactly right,
 * but it arrives late — it appears at the keyboard's top edge some time after
 * the keyboard has finished arriving, instead of travelling up with it.
 *
 * That is not a mystery, it is a line in the plugin (the vendored fork,
 * ios-plugins/cluecab-keyboard — same line as upstream). onKeyboardWillShow:
 *
 *     double duration = [[... UIKeyboardAnimationDurationUserInfoKey ...]
 *                        doubleValue];
 *     [self setKeyboardHeight:(int)height delay:duration + 0.2];
 *
 * The document is not shrunk on keyboardWillShow at all. It is shrunk by a
 * delayed perform, one keyboard-animation duration PLUS 200ms later — about
 * 450ms after the event, roughly 200ms after the keyboard has stopped moving.
 * That schedule is kept on purpose: the delay is what lets this listener
 * freeze the board before anything reflows, and with the ride holding the
 * dock in place the late shrink has nothing visible left to be late FOR.
 * (Hiding is not affected: willHide schedules the same call with a 10ms
 * delay, and the departing keyboard occludes the dock's drop entirely — the
 * dock is uncovered in place, which is why only coming up ever looked wrong.)
 *
 * So the exact height AND the animation's duration are known at willShow.
 * The ride uses both: the dock is translated to the place the shrunk layout
 * will put it, over exactly the keyboard's own duration, and the transform is
 * dropped again the moment the shrink actually lands.
 *
 * The double-offset trap is the whole difficulty — when the document shrinks,
 * the layout moves the dock up too, and a transform still in force would move
 * it up twice. Two things keep the handover clean:
 *
 *   - it is triggered by the shrink ITSELF (a MutationObserver on the body's
 *     style attribute), not by a timer and not by keyboardDidShow. didShow is
 *     the tempting one and it is wrong: it fires when the keyboard stops, ~200ms
 *     BEFORE the plugin's resize, so releasing there would drop the dock back
 *     down and then jerk it up again.
 *   - the observer's callback is a microtask, so it runs after the plugin's
 *     script and before the frame is painted. The shrink and the release land
 *     in the same paint. There is no frame in which both are in force, and
 *     none in which neither is.
 *
 * The safety property, and the reason this cannot regress the resting position
 * that was expensive to get right: the transform is always released, and what
 * the dock rests on afterwards is the ordinary layout — the same one it rests
 * on today, reached by the same mechanism. A wrong probe could only show as a
 * visible correction at the handover, never as a wrong final position. The
 * debug overlay reports `drift` so that correction is a number rather than an
 * impression.
 *
 * Returns the release, or null when there is nothing to ride.
 */
/** The last keyboard height and animation duration a ride was given. */
let lastKbPx = 0
let lastDurMs = RIDE_MS

/**
 * A field the keyboard is for. A button, checkbox or slider can hold focus
 * without one, so focus moving to them is focus leaving the keyboard. A
 * <select> counts: iOS shows its picker through the keyboard system, with the
 * same notifications and the same resize (Settings has one).
 */
const NO_KEYBOARD_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color', 'image'])
export function takesKeyboard(el: EventTarget | null | undefined): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD_INPUTS.has(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * ---- the sink: the ride, downwards (2026-09-30) ----
 *
 * The complaint: when the keyboard goes away, the composer stays where it
 * was while the keyboard slides out from under it, then drops in one jump.
 * The owner's screen recording (KristoffersRoom/Marketing/video/
 * 900words-screen-recording.mp4, 12 dismissals) measured it: the keyboard
 * takes 250-300ms to leave, and the composer jumped 150-200ms after it
 * started. That is when the plugin's body reset got painted. When the same
 * tap also did heavy work, the jump came later: 300ms, 400ms, and 1.1s for a
 * wheel spin. Twice the composer never came down at all. It stayed halfway
 * up an empty screen for 4-5s, until the next tap.
 *
 * Leaving it to the plugin was the design ("the departing keyboard occludes
 * the dock's drop") and it does not hold. willHide reaches the page through
 * the bridge, the reset is a second trip scheduled 10ms after that, and
 * either one waits behind whatever the tap started.
 *
 * So the page puts itself back the moment the field loses focus, which is
 * before the keyboard has even started moving. It restores the full-height
 * layout in the same task and then plays the difference as a transform.
 * The dock and the white surface start where they were and ride down
 * together over the keyboard's own duration (FLIP). A transform transition
 * runs on the compositor, so once it starts, work on the main thread cannot
 * hold the composer up. The board is already full height underneath and is
 * uncovered as the surface slides away.
 *
 * willHide and didHide still arrive and put the page away too. Normally
 * there is nothing left to do (every step is idempotent). If there is, that
 * is the stuck case, and it is counted (cluecab-kbstale) and shown in the
 * debug readout.
 *
 * Returns whether there was anything to put away.
 */
let sinkEnd: (() => void) | null = null
let hideT0 = 0
function putAway(via: string, beforeRestore?: () => void): boolean {
  const root = document.documentElement
  if (!root.classList.contains('kb-up') && document.body.style.height === '') return false
  hideT0 = performance.now()
  const dock = document.querySelector<HTMLElement>('.dock.kb-lifted')
  const surface = document.querySelector<HTMLElement>('.game-screen .kb-surface')
  // Where the dock is on screen right now, a ride up still in flight
  // included: a blur mid-ride sinks from there rather than from where the
  // released ride would drop it.
  const from = dock?.getBoundingClientRect().top
  beforeRestore?.()
  sinkEnd?.()
  // The whole restore, in one task: what the plugin's height-null and the
  // willHide listener's class removals together used to do, later.
  document.body.style.height = ''
  root.classList.remove('kb-up')
  root.style.removeProperty('--board-h')
  for (const d of document.querySelectorAll('.dock.kb-lifted')) d.classList.remove('kb-lifted')
  if (!dock || from === undefined || flagOn('cluecab-kbstill') || reducedMotion()) {
    report({ via: viaCode(via), sink: 0 })
    return true
  }
  const to = dock.getBoundingClientRect().top
  const dy = Math.round(from - to)
  if (dy > -2) {
    report({ via: viaCode(via), sink: 0 })
    return true
  }
  const ms = lastDurMs
  dock.classList.add('kb-sinking')
  surface?.classList.add('kb-sinking')
  if (surface) {
    surface.style.top = `${Math.round(to)}px`
    surface.style.transition = 'none'
    surface.style.transform = `translateY(${dy}px)`
  }
  dock.style.transition = 'none'
  dock.style.transform = `translateY(${dy}px)`
  void dock.offsetHeight
  if (surface) void surface.offsetHeight
  dock.style.transition = `transform ${ms}ms ${RIDE_EASE}`
  dock.style.transform = 'translateY(0)'
  if (surface) {
    surface.style.transition = `transform ${ms}ms ${RIDE_EASE}`
    surface.style.transform = 'translateY(0)'
  }
  let done = false
  const end = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    dock.style.transition = ''
    dock.style.transform = ''
    dock.classList.remove('kb-sinking')
    if (surface) {
      surface.style.transition = ''
      surface.style.transform = ''
      surface.style.top = ''
      surface.classList.remove('kb-sinking')
    }
    if (sinkEnd === end) sinkEnd = null
  }
  const timer = setTimeout(end, ms + 80)
  sinkEnd = end
  report({ via: viaCode(via), sink: dy, sDur: ms })
  watchFrames()
  return true
}

/** The debug readout holds numbers, so the path that put the page away is one. */
function viaCode(via: string): number {
  return ({ blur: 1, willHide: 2, didHide: 3, guard: 4 } as Record<string, number>)[via] ?? 0
}

/**
 * The longest gap between frames in the half second after a put-away, for
 * the readout: a long one means the tap's own work held the page, whatever
 * the compositor was doing with the dock meanwhile. Only while the readout is on.
 */
function watchFrames() {
  if (!flagOn('cluecab-kbdebug')) return
  const t0 = performance.now()
  let last = t0
  let worst = 0
  const tick = (now: number) => {
    worst = Math.max(worst, now - last)
    last = now
    if (now - t0 < 500) requestAnimationFrame(tick)
    else report({ gap: Math.round(worst) })
  }
  requestAnimationFrame(tick)
}

/** The stuck case, counted across launches so one readout can say whether it ever happened. */
function countStale(via: string) {
  try {
    const n = Number(localStorage.getItem('cluecab-kbstale') ?? '0') + 1
    localStorage.setItem('cluecab-kbstale', String(n))
    report({ stale: n, staleVia: viaCode(via) })
  } catch {
    /* private mode */
  }
}

/**
 * For a control that puts the keyboard away AND starts real work (Give clue,
 * the wheel's spin). The field loses focus first, so the composer starts its
 * ride down (above) on the next frame, and the work runs after that frame
 * has been painted. Run in the same task, the work held the whole put-away
 * behind it: 1.1s for a spin in the owner's recording.
 *
 * Only while the keyboard is actually up. Everywhere else (the web build, a
 * tap with no field focused, the unit tests) `action` runs at once, exactly
 * as before. Anything that needs the tap's user activation (audio priming)
 * must be done by the caller before this, not inside `action`.
 */
export function afterKeyboardAway(action: () => void): void {
  const active = document.activeElement
  if (!document.documentElement.classList.contains('kb-up') || !takesKeyboard(active)) {
    action()
    return
  }
  active.blur()
  requestAnimationFrame(() => setTimeout(action, 0))
}

let rideT0 = 0
function startRide(px: number, durMs?: number): (() => void) | null {
  rideT0 = performance.now()
  // The keyboard's own duration, from the fork's payload. Zero can genuinely
  // arrive — a keyboard already on screen re-reporting during a layout change
  // — and so can nothing at all (the kbsim path without a /duration suffix),
  // so the old guess survives as the fallback rather than as the answer.
  const ms = durMs && durMs > 0 ? Math.round(durMs) : RIDE_MS
  // Kept for the way back down (the sink, below) and for standing the shrink
  // up again if focus hops between fields in two steps.
  lastKbPx = px
  lastDurMs = ms
  const dock = document.querySelector<HTMLElement>('.dock.kb-lifted')
  const surface = document.querySelector<HTMLElement>('.game-screen .kb-surface')
  if (!dock || !px) {
    report({ lift: 0 })
    return null
  }
  // The one thing on this screen that moves for its own sake rather than
  // because the layout changed, so it is also the one thing here that has to
  // ask. Off means today's behaviour: the dock arrives when the layout says.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    report({ lift: 0 })
    return null
  }

  const from = dock.getBoundingClientRect().top
  const to = probeFinalTop(dock, px)
  const dy = Math.round(to - from)
  // Nothing to do: the document is already shrunk, which is what focus moving
  // from one field to another with the keyboard already up looks like.
  if (dy > -2) {
    report({ lift: 0 })
    return null
  }

  // From an explicit zero rather than from `none`, so there is no question
  // about what the transition starts at. The white surface is a sibling fixed
  // layer, not an oversized child of the dock: transformed descendants still
  // extend the document's scroll range in WebKit. Giving the layer the exact
  // same start, transition and transform lets it ride with the fields while a
  // fixed element stays out of layout altogether.
  dock.classList.add('kb-riding')
  surface?.classList.add('kb-riding')
  if (surface) {
    surface.style.top = `${Math.round(from)}px`
    surface.style.transition = 'none'
    surface.style.transform = 'translateY(0)'
  }
  dock.style.transition = 'none'
  dock.style.transform = 'translateY(0)'
  void dock.offsetHeight
  if (surface) void surface.offsetHeight
  dock.style.transition = `transform ${ms}ms ${RIDE_EASE}`
  dock.style.transform = `translateY(${dy}px)`
  if (surface) {
    surface.style.transition = `transform ${ms}ms ${RIDE_EASE}`
    surface.style.transform = `translateY(${dy}px)`
  }
  report({ lift: dy, land: Math.round(to), dur: ms, ride: Math.round(performance.now() - rideT0) })

  let done = false
  return () => {
    if (done) return
    done = true
    const at = Math.round(performance.now() - rideT0)
    // Transition off BEFORE the transform comes off, or removing it would be
    // animated too — a 250ms slide back down to where we started.
    dock.style.transition = 'none'
    if (surface) surface.style.transition = 'none'
    dock.style.transform = ''
    if (surface) surface.style.transform = ''
    void dock.offsetHeight
    if (surface) void surface.offsetHeight
    const rest = Math.round(dock.getBoundingClientRect().top)
    dock.style.transition = ''
    if (surface) {
      surface.style.transition = ''
      surface.style.top = ''
      surface.classList.remove('kb-riding')
    }
    dock.classList.remove('kb-riding')
    // drift 0 means the probe predicted the shrunk layout exactly and the
    // handover was invisible. Anything else is the size of the correction the
    // eye would see, in pixels, on the device it happened on.
    report({ hand: at, rest, drift: rest - Math.round(to) })
  }
}

/**
 * Stand a keyboard up on demand, so a screenshot can be taken of the thing
 * itself rather than of a description of it.
 *
 * localStorage cluecab-kbsim = the height to pretend a keyboard has. The app
 * then does exactly what it does for a real one — freeze the board, mark the
 * composer, shrink the document the way the plugin's 'body' mode would — with
 * no keyboard, no tapping and no device. It is what lets iOS-simulator CI
 * photograph this state without automating a touch, and it works in a browser
 * too.
 *
 * What it cannot show is timing. There is no keyboard animating alongside it,
 * so it stands the finished state up rather than arriving at it, and a film of
 * it says nothing about whether the dock rides or trails. It is a check on
 * where things end up, in both modes, and that is all it is.
 *
 * Off unless the key is set, so it cannot affect anyone playing.
 */
function useSimulatedKeyboard() {
  useEffect(() => {
    let px = 0
    let simDur = 0
    try {
      // "336" pretends a keyboard of that height; "336/421" also pretends the
      // animation took 421ms, which is how a drive proves the duration from
      // the payload actually reaches the transition — the only part of the
      // plumb a browser can witness.
      const raw = localStorage.getItem('cluecab-kbsim') ?? '0'
      const [h, d] = raw.split('/')
      px = Number(h)
      simDur = Number(d ?? 0)
    } catch {
      /* private mode */
    }
    if (!px) return
    const root = document.documentElement
    // Which screen is showing is not persisted, so a seeded save still opens
    // on Home. The round is there — it says "Continue game" — it just has to
    // be resumed, and there is nothing here that can tap the button.
    void import('../stores/uiStore').then(({ useUi }) => useUi.getState().goTo('game'))
    let ride: ReturnType<typeof setTimeout> | undefined
    let t: ReturnType<typeof setTimeout>
    let tries = 0
    /**
     * Wait for the board and a dock to exist, rather than for a length of time
     * that looked like enough.
     *
     * It used to be a flat 1200ms, and on an idle machine that is plenty. On a
     * busy one it is not: the screen had not rendered, so there was no grid to
     * freeze and no dock to lift, and the keyboard state was applied to a page
     * that was not ready for it. That produced a screenshot of the wrong thing
     * on CI and, once the ride existed, a drive that reported a working ride
     * as absent roughly one run in three. The delay stays as a settle; what
     * follows it is a condition.
     */
    const arm = () => {
      const grid = document.querySelector<HTMLElement>('.board-grid')
      const dock = document.querySelector<HTMLElement>('.dock')
      if ((!grid || !dock) && tries++ < 80) {
        t = setTimeout(arm, 100)
        return
      }
      if (grid) root.style.setProperty('--board-h', `${Math.round(grid.getBoundingClientRect().height)}px`)
      dock?.classList.add('kb-lifted')
      root.classList.add('kb-up')
      // What Keyboard.resize 'body' does: the document ends where the keyboard
      // begins, and the page lays itself out inside what is left.
      const shrink = () => {
        document.body.style.height = `${window.innerHeight - px}px`
      }
      if (!flagOn('cluecab-kbstill')) {
        const release = startRide(px, simDur)
        if (release) {
          // The plugin's late shrink, stood up the same way the keyboard is:
          // the dock travels first and the document catches up underneath it.
          // The two land together, which is the part worth checking here.
          ride = setTimeout(
            () => {
              shrink()
              release()
            },
            simDur > 0 ? simDur : RIDE_MS,
          )
          return
        }
      }
      shrink()
    }
    t = setTimeout(arm, 1200)
    return () => {
      clearTimeout(t)
      clearTimeout(ride)
    }
  }, [])
}

export function useNativeKeyboard() {
  useSimulatedKeyboard()

  useEffect(() => {
    const root = document.documentElement
    let keyboardWasUp = root.classList.contains('kb-up')
    const resetBoardScroll = () => {
      const board = document.querySelector<HTMLElement>('.game-screen .board-area')
      if (board) board.scrollTop = 0
    }
    // Keep the reset tied to the keyboard state transition as well as the
    // native callback, so simulated keyboard runs exercise the same behavior.
    const keyboardState = new MutationObserver(() => {
      const keyboardIsUp = root.classList.contains('kb-up')
      if (keyboardWasUp && !keyboardIsUp) resetBoardScroll()
      keyboardWasUp = keyboardIsUp
    })
    keyboardState.observe(root, { attributes: true, attributeFilter: ['class'] })

    // Which dock to lift: the one holding what is focused. Read at focus time
    // rather than assumed, because the clue dock, the lookup and the packing
    // dock are all docks with fields in them.
    //
    // OUTSIDE the native guard below, on purpose: without .kb-up nothing
    // styles .kb-lifted, so on the web the class is inert — but it being set
    // is what lets layout-drive assert the packing dock's self-focus path
    // (a board-card tap focuses the input programmatically, PackingDock.tsx)
    // in a browser, instead of that path being testable only on a phone.
    const markDock = (e: FocusEvent) => {
      const dock = e.target instanceof HTMLElement ? e.target.closest('.dock') : null
      for (const d of document.querySelectorAll('.dock.kb-lifted')) {
        if (d !== dock) d.classList.remove('kb-lifted')
      }
      if (dock) dock.classList.add('kb-lifted')
    }
    window.addEventListener('focusin', markDock)

    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    const native = Boolean(cap?.isNativePlatform?.())
    let simulated = false
    try {
      simulated = Number((localStorage.getItem('cluecab-kbsim') ?? '0').split('/')[0]) > 0
    } catch {
      /* private mode */
    }

    // The show ride's release, once the native listener below exists. The
    // put-away ends any ride still in flight before it measures.
    let landShow: (() => void) | undefined
    // The put-away from the page's side (see putAway): a field losing focus to
    // anything that is not another field. Synchronous, so the composer starts
    // down on the next frame, before the keyboard does. Also under kbsim, the
    // stand-in for the native keyboard, so a browser drive can walk the path.
    // Nowhere else: the web never sets kb-up.
    const onFocusOut = (e: FocusEvent) => {
      if (!takesKeyboard(e.target) || takesKeyboard(e.relatedTarget)) return
      putAway('blur', landShow)
    }
    if (native || simulated) window.addEventListener('focusout', onFocusOut)

    const unmark = () => {
      window.removeEventListener('focusin', markDock)
      window.removeEventListener('focusout', onFocusOut)
      for (const d of document.querySelectorAll('.dock.kb-lifted')) d.classList.remove('kb-lifted')
      keyboardState.disconnect()
      sinkEnd?.()
    }

    if (!native) return unmark

    let removers: Array<() => void> = []
    let cancelled = false
    let endRide: (() => void) | null = null
    let watcher: MutationObserver | null = null
    let giveUp: ReturnType<typeof setTimeout> | undefined
    // The keyboard is up by the platform's account: from willShow to willHide.
    let kbShown = false

    // Every way the ride can end goes through here, so the transform is never
    // left on: the document shrank, nothing shrank in time, the keyboard went
    // away again, a second field was focused, or the app unmounted.
    const land = () => {
      clearTimeout(giveUp)
      watcher?.disconnect()
      watcher = null
      endRide?.()
      endRide = null
    }
    landShow = land

    // Focus that hops between fields in two steps (a blur with no
    // relatedTarget, then the new field's focus) looks like leaving to the
    // put-away, which restores the full page. The keyboard never went, so the
    // page is shrunk again here, to the height the plugin believes it already
    // set. It will not set it again: its setKeyboardHeight returns early on an
    // unchanged height.
    const onRefocus = (e: FocusEvent) => {
      if (!kbShown || !lastKbPx || !takesKeyboard(e.target) || root.classList.contains('kb-up')) return
      sinkEnd?.()
      const grid = document.querySelector<HTMLElement>('.board-grid')
      const h = grid ? Math.round(grid.getBoundingClientRect().height) : 0
      if (h) root.style.setProperty('--board-h', `${h}px`)
      root.classList.add('kb-up')
      document.body.style.height = `${window.innerHeight - lastKbPx}px`
      report({ refocus: Math.round(performance.now() - hideT0) })
    }
    window.addEventListener('focusin', onRefocus)

    // The invariant the stuck composer broke: the page is shorter than the
    // screen only while the keyboard is up AND a field has focus. Anything
    // else that shrinks it, or leaves it shrunk, is stale, and is put away and
    // counted. The plugin writes the height through the bridge as a style
    // attribute, so every write it makes passes through here.
    const guard = new MutationObserver(() => {
      if (document.body.style.height === '') return
      if (kbShown && takesKeyboard(document.activeElement)) return
      if (putAway('guard', land)) countStale('guard')
    })
    guard.observe(document.body, { attributes: true, attributeFilter: ['style'] })

    // The vendored fork (ios-plugins/cluecab-keyboard) — same plugin, same
    // 'Keyboard' name, plus the animation's real duration in the payload.
    void import('cluecab-keyboard').then(({ Keyboard }) => {
      if (cancelled) return
      const show = Keyboard.addListener('keyboardWillShow', (info) => {
        // A keyboard is only ever for a focused field, and the field is
        // focused before the platform is told to show one. A willShow with
        // nothing focused is stray: acting on it would lift a composer, and
        // shrink a page, for a keyboard nobody is typing into.
        if (!takesKeyboard(document.activeElement)) {
          report({ stray: Math.round(info.keyboardHeight) })
          return
        }
        kbShown = true
        sinkEnd?.()
        if (info.keyboardHeight > 0) lastKbPx = Math.round(info.keyboardHeight)
        if (info.durationMs && info.durationMs > 0) lastDurMs = Math.round(info.durationMs)
        // The only measurement left, and it is of OUR OWN board rather than of
        // the keyboard: how tall the grid is right now, so it can be held at
        // exactly that while the screen shrinks around it.
        //
        // Everything else went away with Keyboard.resize 'body'. The OS ends
        // the document where the keyboard begins, so the composer is simply the
        // last thing in the layout — touching the keyboard on every device,
        // with no height to learn and no gap to tune. Three builds were spent
        // on that sum, once too high and once too low by the height of the
        // home indicator, because iOS measures its keyboard to the bottom of
        // the SCREEN while the page is padded away from that inset.
        //
        // Taken on willShow, before the resize, or it would measure the board
        // already squeezed.
        const grid = document.querySelector<HTMLElement>('.board-grid')
        const h = grid ? Math.round(grid.getBoundingClientRect().height) : 0
        if (h) root.style.setProperty('--board-h', `${h}px`)
        root.classList.add('kb-up')
        // `said` is the fork's payload verbatim, before any fallback is
        // applied, and it is in the readout for one reason: iOS's own keyboard
        // duration is 250ms, which is also RIDE_MS — so `dur 250` on a film
        // cannot tell a forwarded duration from the guess it replaced. `said`
        // can: 0 means the payload arrived without one (upstream plugin, or a
        // keyboard re-reporting mid-layout) and the fallback is what ran.
        report({
          kb: Math.round(info.keyboardHeight),
          said: Math.round(info.durationMs ?? 0),
          inner: window.innerHeight,
          board: h,
        })

        // The ride is the product now — the composer travels with the keyboard
        // unless someone has asked it not to. The opt-out exists because the
        // A/B that judges this can only be filmed on a phone, and a TestFlight
        // build has no console: the toggle in BuildFooter is the one way to
        // stand yesterday's behaviour up next to today's without a rebuild.
        if (flagOn('cluecab-kbstill')) return
        land()
        endRide = startRide(Math.round(info.keyboardHeight), info.durationMs)
        if (!endRide) return
        // The handover, triggered by the shrink itself. The plugin performs it
        // as `el.style.height = ...` through the bridge, so it arrives here as
        // an attribute mutation on the body — and a MutationObserver callback
        // is a microtask, which puts the release in the same paint.
        watcher = new MutationObserver(land)
        watcher.observe(document.body, { attributes: true, attributeFilter: ['style'] })
        const px = Math.round(info.keyboardHeight)
        giveUp = setTimeout(() => {
          // No shrink came. That is right when the page was already shrunk,
          // but then there is no ride and no timer. With the dock in the air,
          // it means the plugin thinks it already set this height and it did
          // not (a stale state from an earlier keyboard). Set it here, in the
          // same task as the release, so the dock lands where it is held.
          if (document.body.style.height === '' && kbShown && takesKeyboard(document.activeElement)) {
            document.body.style.height = `${window.innerHeight - px}px`
            countStale('show')
          }
          land()
        }, RIDE_GIVEUP_MS)
      })
      const hide = Keyboard.addListener('keyboardWillHide', () => {
        kbShown = false
        // Normally the blur got here first and there is nothing left to do;
        // wHide is how long after it the platform's notice arrived.
        const t = performance.now()
        if (!putAway('willHide', land)) report({ wHide: Math.round(t - hideT0) })
        land()
        resetBoardScroll()
      })
      // After the keyboard has gone, the page must be whole. If it is not, the
      // composer is stuck: put it away and count it.
      const didHide = Keyboard.addListener('keyboardDidHide', () => {
        kbShown = false
        report({ dHide: Math.round(performance.now() - hideT0) })
        if (putAway('didHide', land)) countStale('didHide')
      })
      removers = [
        () => void show.then((h) => h.remove()),
        () => void hide.then((h) => h.remove()),
        () => void didHide.then((h) => h.remove()),
      ]
    })

    return () => {
      cancelled = true
      land()
      unmark()
      window.removeEventListener('focusin', onRefocus)
      guard.disconnect()
      for (const off of removers) off()
      root.classList.remove('kb-up')
    }
  }, [])
}
