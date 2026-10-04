import { useSettings } from '../stores/settingsStore'
import {
  clipStartAt,
  loadBakedClip,
  playLoadedClip,
  playWord,
  preloadWordAudio,
  primeWordAudio,
  reportAudioFailure,
  type ClipLoad,
} from '../ui/speak'
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
 * The connecting words' own recordings (audio/da/connecting/*.mp3), kept once
 * fetched. They are not words of the course data, so they go through the
 * app's one gesture-primed audio element directly (`playLoadedClip`, as the
 * train's chapter does), with the measured silence before the voice skipped
 * (src/data/audio-lead.da.json, read by `clipStartAt`).
 */
const clips = new Map<string, Promise<ClipLoad>>()
/** At most this many connecting clips are kept: more than a city has. */
const CLIPS_MAX = 64

export function runClipUrl(audio: { readonly language: string; readonly key: string }): string {
  return `${import.meta.env.BASE_URL}audio/${audio.language}/${audio.key}.mp3`
}

function loadClip(url: string): Promise<ClipLoad> {
  let got = clips.get(url)
  if (!got) {
    got = loadBakedClip(url).catch((): ClipLoad => ({ kind: 'unreachable' }))
    clips.set(url, got)
    // Out of reach is asked for again next time: it may only be a bus ride's worth of offline.
    void got.then((r) => {
      if (r.kind === 'unreachable') clips.delete(url)
    })
    if (clips.size > CLIPS_MAX) clips.delete(clips.keys().next().value as string)
  }
  return got
}

async function sayClip(audio: { readonly language: string; readonly key: string }): Promise<void> {
  if (!useSettings.getState().sound) return
  const url = runClipUrl(audio)
  const got = await loadClip(url)
  if (got.kind !== 'clip') {
    reportAudioFailure({ kind: 'word', reason: got.kind })
    return
  }
  if (!useSettings.getState().sound) return
  try {
    await playLoadedClip(got.clip, { url, startAt: clipStartAt(url) })
  } catch {
    // Interrupted by the next word, or refused: the run goes on either way.
  }
}

/** Say a run word, if it has a recording: a noun with its article (`RUN_SAYS_ARTICLE`). Never rejects. */
export function sayRunWord(word: RunWord): void {
  if (!word.audio) return
  if (word.audio.kind === 'dataset') void playWord(word.audio.wordId, { article: RUN_SAYS_ARTICLE })
  else sayClip(word.audio).catch(() => {})
}

/** Ready the recordings of the words about to be passed. Never rejects. */
export function readyRunWords(words: readonly RunWord[]): void {
  const ids = words.flatMap((w) => (w.audio?.kind === 'dataset' ? [w.audio.wordId] : []))
  if (ids.length) void preloadWordAudio(ids)
  for (const w of words) if (w.audio?.kind === 'clip') void loadClip(runClipUrl(w.audio))
}

/** Unlock the word player inside the tap that starts a run (iOS Safari needs the gesture). */
export function primeRunAudio(): void {
  primeWordAudio()
}
