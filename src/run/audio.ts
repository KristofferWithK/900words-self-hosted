import { playClipAudio, playWord, preloadClipAudio, preloadWordAudio, primeWordAudio } from '../ui/speak'
import type { RunGate } from './engine'
import type { RunWord } from './words'

/**
 * The run's sound: the app's own word recordings through the app's own word
 * player (src/ui/speak.ts), and nothing else. The word is spoken as Casey
 * passes through the right answer. No camera flash and no shutter sound
 * (contract §2).
 *
 * A noun is said WITH its article («et hus», «en hund», «die Milch»), as the
 * rest of the app says a tapped noun (owner, 2026-10-04), in both walks: the
 * app's word player plays the noun's one-performance article phrase where the
 * course has one, and otherwise the article clip (audio/<lang>/article/) and
 * then the word (src/ui/speak.ts, `playWord`). A noun the app prints with its
 * gender instead of an article (a Danish mass noun) is said bare, as
 * everywhere else. The prototype played the bare recording only because it
 * had no others.
 */
export const RUN_SAYS_ARTICLE = true

/**
 * The connecting words' own recordings (audio/da/connecting/*.mp3). They are
 * not words of the course data, so the word player readies them by their
 * URL (`preloadClipAudio`) and says them from a warm element
 * (`playClipAudio`), with the measured silence before the voice skipped
 * (src/data/audio-lead.da.json, read by the player's `clipStartAt`), exactly
 * as it readies and says a board's words. They used to be handed to the
 * app's one shared element as a fresh blob at the moment of the answer: the
 * element loaded and decoded the clip inside the run's frame.
 */
export function runClipUrl(audio: { readonly language: string; readonly key: string }): string {
  return `${import.meta.env.BASE_URL}audio/${audio.language}/${audio.key}.mp3`
}

/** Say a run word, if it has a recording: a noun with its article (`RUN_SAYS_ARTICLE`). Never rejects. */
export function sayRunWord(word: RunWord): void {
  if (!word.audio) return
  if (word.audio.kind === 'dataset') void playWord(word.audio.wordId, { article: RUN_SAYS_ARTICLE })
  else void playClipAudio(runClipUrl(word.audio))
}

/**
 * Ready the recordings of the words about to be passed, when their gate is
 * placed far down the road: fetched and parked on warm elements, so the
 * answer only says them. Never rejects.
 */
export function readyRunWords(words: readonly RunWord[]): void {
  const ids = words.flatMap((w) => (w.audio?.kind === 'dataset' ? [w.audio.wordId] : []))
  if (ids.length) void preloadWordAudio(ids)
  const clips = words.flatMap((w) => (w.audio?.kind === 'clip' ? [runClipUrl(w.audio)] : []))
  if (clips.length) void preloadClipAudio(clips)
}

/**
 * How many gates have their word readied at once: the current gate and the
 * next two (owner, after build 124: "A player is not needed after the gate
 * has been cleared"). The road shows about three gates ahead (engine.ts
 * `FAR` / `SPACING`), each readied as it is placed far down the road, so a
 * gate's word is ready seconds before the gate reaches Casey. Each gate
 * readies one clip (an article gate's noun: its phrase, or article + word),
 * well inside the walk's word pool (speak.ts `WORD_POOL_LIMITS`).
 */
export const RUN_READY_GATES = 3

/**
 * The next gate whose words to ready, taken off `queue` (the gates in the
 * order they were placed), or undefined to wait. A gate already passed, or
 * gone from the road, is dropped unreadied; a gate beyond the current one and
 * the next two waits until it is among them.
 */
export function takeGateToReady<G extends Pick<RunGate, 'id' | 'resolved'>>(
  queue: G[],
  road: readonly Pick<RunGate, 'id' | 'resolved'>[],
): G | undefined {
  const ahead = road.filter((g) => !g.resolved).slice(0, RUN_READY_GATES).map((g) => g.id)
  while (queue.length) {
    const gate = queue[0]!
    if (gate.resolved || !road.some((g) => g.id === gate.id)) {
      queue.shift()
      continue
    }
    if (!ahead.includes(gate.id)) return undefined
    return queue.shift()
  }
  return undefined
}

/** Unlock the word player inside the tap that starts a run (iOS Safari needs the gesture). */
export function primeRunAudio(): void {
  primeWordAudio()
}
