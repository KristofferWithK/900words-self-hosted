import { playClipAudio, playWord, preloadClipAudio, preloadWordAudio, primeWordAudio } from '../ui/speak'
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

/** Unlock the word player inside the tap that starts a run (iOS Safari needs the gesture). */
export function primeRunAudio(): void {
  primeWordAudio()
}
