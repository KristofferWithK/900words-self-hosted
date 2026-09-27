/**
 * The app's one AudioContext.
 *
 * Nothing that ships plays through it today. The UI sound effects left it
 * for frozen files on media elements (`sfx.ts`) after the context went
 * silent mid-session on an iPhone, and the word path below is behind
 * `WEB_AUDIO = false` in speak.ts for the same reason; the audio self-test
 * still measures it. What follows is why it was built.
 *
 * Two things played through it: the UI sound effects and, since
 * the owner could still feel a tap's delay after the element pool (build 60:
 * "the delay is much shorter, but I still can feel it"), every short clip —
 * a word, its slow twin, a sentence, a Survival turn, a task line. A decoded
 * buffer starts on the audio clock the moment `start()` is called, where a
 * media element, even one loaded and waiting, took 20–90 ms to get going in
 * the shell (ios-sim run 21). One context rather than one per caller: iOS
 * caps how many a page may hold, and a context is unlocked by a gesture once.
 *
 * `resume` is called inside every tap that asks for sound (`primeWordAudio`)
 * and on the Give-clue gesture, because a context created outside a gesture
 * starts suspended on iOS and Chromium alike, and a phone call or a lock
 * screen can suspend it again later.
 */
let context: AudioContext | undefined

export function getAudioContext(): AudioContext | undefined {
  if (context) return context
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return undefined
  try {
    context = new window.AudioContext()
  } catch {
    return undefined
  }
  return context
}

/** Inside a user gesture: let the context run. Idempotent; never rejects. */
export function resumeAudioContext(): void {
  const ctx = getAudioContext()
  if (!ctx || ctx.state === 'running') return
  try {
    void ctx.resume().catch(() => undefined)
  } catch {
    // Not a failure anyone can act on: the element path plays instead.
  }
}
