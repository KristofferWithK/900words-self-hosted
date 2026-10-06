/**
 * EVERY SOUND ELEMENT IS MUTED WHILE IT RESTS, once a long sound has played
 * (owner, TestFlight 125: "The freeze still builds up. Less, but it's still
 * noticeable"; iPhone simulator soak 2: a word's play() took 3 ms until the
 * first café puzzle's wheel spin and 8 to 13 ms ever after).
 *
 * WebKit on iOS offers the page's audio to the system's Now Playing (the lock
 * screen and Control Center player). An audio element qualifies only once it
 * is longer than 0.95 s ("You've got mail!", MediaElementSession.cpp
 * `isElementLongEnoughForMainContent`), so a word on its own never does. But
 * the first long sound that plays (the wheel's clack track, its fanfare at
 * 1.84 s, a chapter) registers the app as the Now Playing application, and
 * while it is registered that length test is skipped: every element with a
 * source that has played, which is every warm word and every effect,
 * qualifies. From then on each start, pause and new source makes WebKit
 * choose the best of them and send its Now Playing info to the system
 * (`MediaSessionManagerCocoa::updateNowPlayingInfo`: in soak 2 22 ms in the
 * first two minutes' profile, 179 ms in the last two). The registration only
 * ends at an update where no element qualifies, and with warm words around
 * there never is one.
 *
 * A muted element never qualifies (it is the first thing
 * `canShowControlsManager` checks). So when a long sound stops, every resting
 * element is muted, the next update finds none, and the registration ends;
 * short sounds cannot start it again. Every play path unmutes its element
 * just before `play()` (`wake`), so nothing sounds different. The run's
 * words, which are short, are never re-muted after they play: a muted/unmuted
 * pair per word would be two more updates per word for nothing.
 */

/**
 * A sound longer than this can put the app in Now Playing (WebKit's 0.95 s,
 * a hair less for rounding). 17 of the 900 Danish word clips are; the median
 * word is 0.65 s, the phrases at most 0.96 s, the café sound 0.8 s.
 */
export const NOW_PLAYING_MIN_SECONDS = 0.94

const watched = new Set<WeakRef<HTMLMediaElement>>()
const seen = new WeakSet<HTMLMediaElement>()

/** Whether this element's sound is long enough for Now Playing. */
function isLong(el: HTMLMediaElement): boolean {
  const d = el.duration
  return Number.isFinite(d) && d > NOW_PLAYING_MIN_SECONDS
}

/**
 * Mute every resting element we know that holds a sound: no element left for
 * Now Playing. An element without a source (a spare) never qualifies and is
 * left as it is: each change is one more update for WebKit.
 */
export function quietAll(): void {
  for (const ref of watched) {
    const el = ref.deref()
    if (!el) {
      watched.delete(ref)
      continue
    }
    try {
      if (el.paused && !el.muted && (el.getAttribute('src') || el.currentSrc)) el.muted = true
    } catch {
      // An element that will not mute is collected with the rest of it.
    }
  }
}

/**
 * Follow an app sound element: when a long sound on it stops (it ended, or
 * was paused after it had really played), every resting element is muted.
 * A prime (play and pause at once, at the very start) does not count.
 */
export function watchMedia(el: HTMLMediaElement): void {
  if (seen.has(el)) return
  seen.add(el)
  watched.add(new WeakRef(el))
  const stopped = () => {
    if (isLong(el) && (el.ended || el.currentTime > 0.05)) quietAll()
  }
  try {
    el.addEventListener('ended', stopped)
    el.addEventListener('pause', stopped)
  } catch {
    // A stand-in element without events: nothing to follow.
  }
}

/** Unmute an element just before it plays. Changes nothing (and costs no update) when it is not muted. */
export function wake(el: HTMLMediaElement): void {
  try {
    if (el.muted) el.muted = false
  } catch {
    // Plays as it is.
  }
}

/** Tests only: forget every element. */
export function resetMediaQuietForTests(): void {
  watched.clear()
}
