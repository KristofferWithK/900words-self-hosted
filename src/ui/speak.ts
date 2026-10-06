import { CITY1_CATALOG, recordingUrl, type BoardSentence, type SentenceRecording } from '../review/city1'
/**
 * Pronunciation: the baked clip, or a visible failure. Never another voice.
 *
 * Every word, example sentence, chapter, task line and Survival turn the app
 * can say is baked by `scripts/make-audio.mjs` in one voice (Aoede) and ships
 * inside the bundle, so there is exactly one thing a tap should play. This
 * file used to keep the Web Speech API as a fallback — `speakText`, from the
 * weeks before any clip existed — and once the bake landed that fallback
 * stopped being a feature and became a way for failures to hide: two builds in
 * a row read every sentence in the iPhone's own Danish voice while 34 MB of
 * Aoede sat unused in the bundle, and nothing on screen said so (owner,
 * 2026-09-05: "why do we even have the device voice as the fallback?").
 *
 * So a clip that cannot be loaded or played now plays NOTHING and reports it:
 * `attempt` answers 'failed', the screens that show a result say "recording
 * did not load", and `AudioNotice` says it for the taps that show nothing.
 * There is no route to `speechSynthesis` left in the app. Text outside the
 * bake — a word Casey translated from outside the 900 — simply has no
 * speaker.
 */
import { ACTIVE } from '../lang/active'
import { track } from '../analytics/stats'
import { spokenArticle } from '../data/gender'
import { wordById } from '../data/words'
import taskAudioSource from '../data/curriculum-audio.da.json'
import chapterAudioSource from '../data/chapter-audio.da.json'
import germanChapterAudioSource from '../data/chapter-audio.de.json'
import exampleAudioSource from '../data/example-audio.da.json'
import audioLead from '../data/audio-lead.da.json'
import germanAudioLead from '../data/audio-lead.de.json'
import articlePhrasesDa from '../data/article-phrases.da.json'
import city1LedaLeadSource from '../data/audio-lead.de.city1.json'
import { survivalAudioSourceFor } from '../lang/da/survival-audio'
import { LANGUAGES } from '../lang/index'
import type { LanguageCode } from '../lang/types'
import { useSettings } from '../stores/settingsStore'
import { Capacitor } from '@capacitor/core'
import { getAudioContext, resumeAudioContext } from './audioContext'
import { diagSwitch } from './diagnostics/switches'
import { setWordPoolProbe } from './diagnostics/recorder'
import { webWords } from './wordAudioWeb'
import { wake, watchMedia } from './mediaQuiet'

/**
 * Whether a baked clip can be played at all here. Gate the word buttons on
 * this: word and frozen-example clips both use the same player, and there is
 * no second route for a device that has no `Audio`.
 */
export function canPlayWords(): boolean {
  return typeof Audio !== 'undefined'
}

/* ------------------------------------------------------------------ *
 * Saying that a recording did not play
 * ------------------------------------------------------------------ */

/** What a failed request was for — the noun the notice names. */
export type AudioKind = 'word' | 'example' | 'chapter' | 'task' | 'survival'

/** Why a recording that should exist did not play. */
export type AudioFailure = {
  readonly kind: AudioKind
  /** `absent` is a clip the build has not got; `unreachable` and `play` are
   *  a clip it has and could not fetch or start. The notice reads the same
   *  either way — a player cannot fix any of them — but a test can tell. */
  readonly reason: 'absent' | 'unreachable' | 'play'
}

type FailureListener = (failure: AudioFailure) => void
const failureListeners = new Set<FailureListener>()

/**
 * Hear about every recording that failed to play, whichever screen asked for
 * it. `AudioNotice` is the one subscriber; it is how a tapped word that has
 * no result of its own to show still says something went wrong, instead of
 * being quietly silent — or, as it used to be, quietly a different voice.
 */
export function onAudioFailure(listener: FailureListener): () => void {
  failureListeners.add(listener)
  return () => void failureListeners.delete(listener)
}

function reportFailure(failure: AudioFailure): void {
  // Counted by kind and reason, never by clip: a launch wants to know whether
  // recordings fail on phones, not which word.
  track({ name: 'audio_failed', kind: failure.kind, outcome: failure.reason })
  for (const listener of failureListeners) listener(failure)
}

/* ------------------------------------------------------------------ *
 * Where a baked clip lives
 * ------------------------------------------------------------------ */

/**
 * The filename a word's clip is baked under.
 *
 * Word ids look like `da:mor`, and neither half of that survives contact with a
 * filesystem: a colon is illegal in a Windows filename outright, and `æøå` in a
 * URL means percent-encoding that has to agree with whatever normalisation the
 * filesystem chose — macOS stores NFD, the browser asks in NFC, and the
 * mismatch is a 404 that only appears once the iOS build copies the files. So
 * the name is folded down to plain ASCII: `da:købe` becomes `koebe.mp3`, which
 * is also how a Dane would write it without the keys.
 *
 * Verified collision-free across all 900 words by `speak.test.ts`, which is the
 * only thing standing between two words and one file. `make-audio.mjs` repeats
 * the rule and refuses to run if the two ever disagree.
 */
export function audioSlug(
  headword: string,
  fold: (s: string) => string = ACTIVE.orthography.fold,
): string {
  return (
    fold(headword.normalize('NFC').toLowerCase())
      // The fold has to happen before this decomposition, which would otherwise
      // split å into a + ring and strip the ring. Six pairs in the Danish 900
      // differ only by a Danish letter and its ASCII base — være/vare,
      // bare/bære, tænke/tanke, svær/svar, blød/blod, påstå/pasta — so the
      // naive strip gives each pair one file between them and teaches whichever
      // word baked second. Counted over the dataset by speak.test.ts, not
      // guessed at. German is worse: Mädchen/Madchen, and ß left as a hyphen.
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      // Windows keeps a handful of names for devices, and NUL is one \u2014 as is
      // NUL.mp3, since the reservation ignores the extension. The Danish for
      // zero is \u00abnul\u00bb, so baking on Windows opened the null device, wrote the
      // clip into it, and reported success: the word had no audio and git
      // could not index the file that was not there. A trailing underscore is
      // enough \u2014 only the exact base name is reserved \u2014 and it must be applied
      // in the bake script's copy of this too, or the app asks for a file
      // nobody wrote.
      .replace(RESERVED_ON_WINDOWS, '$&_')
  )
}

/**
 * CON, PRN, AUX, NUL and the numbered COM/LPT ports, matched whole and
 * case-insensitively. Anchored, because a slug merely CONTAINING "nul" \u2014
 * \u00abnullpunkt\u00bb would \u2014 is a perfectly ordinary filename.
 */
const RESERVED_ON_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

const WORD_ID = /^([a-z]{2}):(.+)$/

/**
 * The URL of a word's baked clip, or undefined for an id that is not shaped
 * like one. The language comes out of the id's own prefix, so a second language
 * needs no second code path — `de:Haus` reads its clips from `audio/de/`.
 *
 * Each word is baked TWICE, and the variant picks between the two directories:
 * `audio/da/hus.mp3` is the ordinary reading, `audio/da/slow/hus.mp3` the 0.6
 * one behind the dictionary's 🐢. Two files rather than one file played at
 * `playbackRate` 0.6, because a stretched clip is a processed clip and both of
 * these are real synthesis at the rate they claim. The slow set is the audio
 * that used to be the app's only audio (DECISIONS.md, «The voice is Aoede at
 * 0.6»), moved sideways rather than re-made.
 *
 * The FOLD comes out of the same prefix, via the registry. An id for a language
 * with no pack registered is not folded at all rather than folded by Danish's
 * rules: applying æ→ae to a German word would be a confidently wrong filename,
 * where no fold is an incomplete one that becomes right the moment the pack
 * lands.
 */
export function wordAudioUrl(wordId: string, variant: SpeechVariant = 'normal'): string | undefined {
  const parts = WORD_ID.exec(wordId)
  if (!parts) return undefined
  if (parts[1] === 'de' && isCity1GermanWord(wordId)) return city1LedaWordAudioUrl(wordId, variant)
  const pack = LANGUAGES[parts[1] as LanguageCode]
  const slug = audioSlug(parts[2], pack ? pack.orthography.fold : (s) => s)
  if (!slug) return undefined
  const dir = variant === 'slow' ? `${parts[1]}/slow` : parts[1]
  // BASE_URL is '/ClueCabulary/' on Pages and './' in the native shell, and
  // ends with a slash either way.
  return `${import.meta.env.BASE_URL}audio/${dir}/${slug}.mp3`
}

const CITY1_LEDA_AUDIO_VERSION = 'city1-leda-v1'
const CITY1_LEDA_MANIFEST_SHA256 = '6a13c0a1e6fe6df3a3c1d790f8d880360ff3c270657fa173e6f42e9545b89487'
const city1GermanWordIds = new Set(LANGUAGES.de?.rosters[0] ?? [])

interface GermanCity1LeadMap {
  status: string
  version: string
  manifestSha256: string
  prerollMs: number
  entries: Record<string, { leadMs: number; sha256: string } | undefined>
}

const city1LedaLead = city1LedaLeadSource as GermanCity1LeadMap

function isCity1GermanWord(wordId: string): boolean {
  return city1GermanWordIds.has(wordId)
}

/** Versioned Leda word clip for the frozen German City 1 roster. */
export function city1LedaWordAudioUrl(wordId: string, variant: SpeechVariant = 'normal'): string | undefined {
  const parts = WORD_ID.exec(wordId)
  if (!parts || parts[1] !== 'de' || !isCity1GermanWord(wordId)) return undefined
  const pack = LANGUAGES.de
  if (!pack) return undefined
  const slug = audioSlug(parts[2], pack.orthography.fold)
  if (!slug) return undefined
  const slow = variant === 'slow' ? '/slow' : ''
  return `${import.meta.env.BASE_URL}audio/de/${CITY1_LEDA_AUDIO_VERSION}/word${slow}/${slug}.mp3`
}

/**
 * Danish City 1 nouns said as ONE performance with their article («Et hus»),
 * rather than the article clip chained in front of the word (owner,
 * 2026-09-26: the chain sounds stitched). Only the nouns listed in
 * article-phrases.da.json have one; every other noun keeps the chain.
 * The file is named for the phrase through the headword fold, the same rule
 * scripts/make-audio.mjs --source phrases writes it under.
 */
const danishPhrases = new Map(
  (articlePhrasesDa as { words: Array<{ id: string; article: string; da: string }> }).words.map((row) => [row.id, row]),
)

export function articlePhraseAudioUrl(wordId: string, variant: SpeechVariant = 'normal'): string | undefined {
  const row = danishPhrases.get(wordId)
  const pack = LANGUAGES.da
  if (!row || !pack) return undefined
  const slug = audioSlug(`${row.article} ${row.da}`, pack.orthography.fold)
  if (!slug) return undefined
  const slow = variant === 'slow' ? '/slow' : ''
  return `${import.meta.env.BASE_URL}audio/da/phrase${slow}/${slug}.mp3`
}

/** Versioned, continuous article+noun Leda performance for City 1 nouns. */
export function city1LedaPhraseAudioUrl(
  wordId: string,
  article: string,
  variant: SpeechVariant = 'normal',
): string | undefined {
  const parts = WORD_ID.exec(wordId)
  if (!parts || parts[1] !== 'de' || !isCity1GermanWord(wordId) || !['der', 'die', 'das'].includes(article)) return undefined
  const pack = LANGUAGES.de
  if (!pack) return undefined
  const noun = pack.words.find((word) => word.id === wordId)
  if (!noun || noun.pos !== 'noun' || noun.article !== article) return undefined
  const slug = audioSlug(`${article} ${noun.da}`, pack.orthography.fold)
  if (!slug) return undefined
  const slow = variant === 'slow' ? '/slow' : ''
  return `${import.meta.env.BASE_URL}audio/de/${CITY1_LEDA_AUDIO_VERSION}/phrase${slow}/${slug}.mp3`
}

/**
 * The article a tapped word is said with, or undefined for a word said bare.
 *
 * Owner, 2026-09-07: "when you tap on the word and listen to the word, it
 * should also say the article so you get exposed to it more often." The
 * rule is `spokenArticle` in data/gender.ts — the article whenever the card
 * prints one — so the ear and the eye agree. Looked up in the active pack's
 * dataset; an id the pack does not know (another language, a word outside
 * the 900) has no article to say and is played as it always was.
 */
export function spokenArticleOf(wordId: string): string | undefined {
  const w = wordById(wordId)
  return w ? (spokenArticle(w) ?? undefined) : undefined
}

/**
 * The URL of an article's baked clip: `audio/da/article/et.mp3`. Two files
 * for Danish, baked once by `--source articles` and played in front of the
 * word rather than baked into nine hundred new word clips — the word clips
 * stay as they are, and a bake that pads its clips with silence again costs
 * two measurements rather than nine hundred (CLAUDE.md §6).
 */
export function articleAudioUrl(wordId: string, article: string): string | undefined {
  const parts = WORD_ID.exec(wordId)
  if (!parts) return undefined
  const pack = LANGUAGES[parts[1] as LanguageCode]
  const slug = audioSlug(article, pack ? pack.orthography.fold : (s) => s)
  if (!slug) return undefined
  return `${import.meta.env.BASE_URL}audio/${parts[1]}/article/${slug}.mp3`
}

/**
 * How long a tap will wait for the article to finish before the word. The
 * clips are a few hundred milliseconds; this is the guard for a device whose
 * element starts and never reports an end, so the word is never held hostage
 * by its article.
 */
export const ARTICLE_MAX_MS = 1200

/**
 * One frozen Danish example performance per dictionary word. The source hash
 * is part of the request key: an authorised correction followed by a re-bake
 * cannot be hidden behind an installed PWA's year-long runtime cache.
 */
/**
 * The manifests are arrays of ~900 rows; a screen readies a whole board's
 * worth of clips at once and re-asks per tap, so they are indexed once rather
 * than scanned per call.
 */
let exampleSourceById: Map<string, (typeof exampleAudioSource.entries)[number]> | undefined
let taskSourceById: Map<string, (typeof taskAudioSource.entries)[number]> | undefined

function city1AudioUrl(row: BoardSentence, recordings: readonly SentenceRecording[], slow = false): string | undefined {
  const url = recordingUrl(row, recordings, slow ? 'slow' : 'normal')
  return url ? `${import.meta.env.BASE_URL}${url.slice(1)}` : undefined
}

export function exampleAudioUrl(wordId: string, language: string = ACTIVE.code): string | undefined {
  if (language !== 'da' || !WORD_ID.test(wordId)) return undefined
  exampleSourceById ??= new Map(exampleAudioSource.entries.map((row) => [row.id, row]))
  const source = exampleSourceById.get(wordId)
  const slug = source ? wordAudioUrl(wordId)?.split('/').pop()?.replace('.mp3', '') : undefined
  if (!source || !slug || source.textDa !== wordById(wordId)?.exampleDa) return undefined
  return `${import.meta.env.BASE_URL}audio/${language}/example/${slug}.mp3?v=${source.sourceHash.slice(0, 16)}`
}

/**
 * Which of the two bakes a word is being asked for. Not a setting — nothing
 * persists it and nothing defaults to 'slow'; it is what one button passes.
 */
export type SpeechVariant = 'normal' | 'slow'

const EXAMPLE_SLOW_RATE = 0.8

/**
 * The URL of one travel-story sentence's baked clip.
 *
 * A sentence, unlike a word, is not addressed by a dataset id — there is
 * nothing to fold or to guard against Windows device names, because the name
 * is two numbers. It must agree with `storySlug` in journey/travelStory.ts and
 * with the story branch of make-audio.mjs; journey-drive asks the built app
 * for these files, so the three cannot drift apart quietly.
 *
 * Three bakes of one sentence, because the ride says each one four times:
 * `story/` is the Danish at its ordinary pace and is also the fourth pass,
 * `story/en/` is the English translation between them, and `story/slow/` is
 * the Danish at 0.6 — the clips that used to be the ride's only audio.
 */
export function storyAudioUrl(
  cityIndex: number,
  sentenceIndex: number,
  variant: StoryVariant = 'normal',
): string {
  const slug = `${cityIndex}-${String(sentenceIndex).padStart(3, '0')}`
  const dir = variant === 'normal' ? 'story' : `story/${variant}`
  return `${import.meta.env.BASE_URL}audio/${ACTIVE.code}/${dir}/${slug}.mp3`
}

/**
 * The URL of one accepted exchange or checkpoint utterance. S4 writes these
 * under `audio/<language>/task/`; Workbox's existing audio route caches the
 * first request, never the full task library at install time. The id is an
 * authored stable id rather than learner text, so changing text updates the
 * source hash and bake manifest without changing the cache address by chance.
 */
export function taskAudioUrl(audioLineId: string, language: string = ACTIVE.code): string | undefined {
  if (!/^[a-z0-9-]+$/.test(audioLineId) || !/^[a-z]{2}$/.test(language)) return undefined
  // S4 currently has an accepted Danish source only. A versioned request key
  // matters: the immutable id names the task, but its source hash names this
  // exact frozen performance, so an installed phone cannot replay an old
  // cached clip after an authorised wording correction and re-bake.
  if (language !== 'da') return undefined
  taskSourceById ??= new Map(taskAudioSource.entries.map((line) => [line.id, line]))
  const source = taskSourceById.get(audioLineId)
  if (!source) return undefined
  return `${import.meta.env.BASE_URL}audio/${language}/task/${audioLineId}.mp3?v=${source.sourceHash.slice(0, 16)}`
}

/** One versioned dialogue turn from Casey's Survival pages (Danish, or German City 1). */
export function survivalAudioUrl(audioLineId: string, language: string = ACTIVE.code): string | undefined {
  if (!/^[a-z0-9-]+$/.test(audioLineId) || !/^[a-z]{2}$/.test(language)) return undefined
  const source = survivalAudioSourceFor(audioLineId, language)
  if (!source) return undefined
  return `${import.meta.env.BASE_URL}audio/${language}/survival/${audioLineId}.mp3?v=${source.sourceHash.slice(0, 16)}`
}

/**
 * The frozen chapter performances per language: every Danish lesson in Aoede,
 * and German City 1's lessons in Leda (owner, 2026-09-26). A lesson with no
 * row here has no recording, and the train says so rather than speaking.
 */
const CHAPTER_AUDIO_SOURCES: Record<string, typeof chapterAudioSource> = {
  da: chapterAudioSource,
  de: germanChapterAudioSource,
}

/** The frozen text/hash row behind one destination chapter performance. */
export function chapterAudioSourceFor(cityIndex: number, language: string = ACTIVE.code) {
  return CHAPTER_AUDIO_SOURCES[language]?.entries.find((entry) => entry.cityIndex === cityIndex)
}

/** Look up a frozen performance by its explicit source id. */
export function chapterAudioSourceForId(id: string, language: string = ACTIVE.code) {
  return CHAPTER_AUDIO_SOURCES[language]?.entries.find((entry) => entry.id === id)
}

/** One continuous performance for a destination chapter, in the route's language. */
export function chapterAudioUrl(cityIndex: number, language: string = ACTIVE.code): string | undefined {
  return chapterAudioUrlForId(chapterAudioSourceFor(cityIndex, language)?.id, language)
}

export function chapterAudioUrlForId(id: string | undefined, language: string = ACTIVE.code): string | undefined {
  if (!id || !/^[a-z]{2}$/.test(language)) return undefined
  const source = chapterAudioSourceForId(id, language)
  if (!source) return undefined
  return `${import.meta.env.BASE_URL}audio/${language}/chapter/${source.id}.mp3?v=${source.sourceHash.slice(0, 16)}`
}

/** The timing map travels with the same source revision as its chapter clip. */
export function chapterTimingsUrl(cityIndex: number, language: string = ACTIVE.code): string | undefined {
  return chapterTimingsUrlForId(chapterAudioSourceFor(cityIndex, language)?.id, language)
}

export function chapterTimingsUrlForId(id: string | undefined, language: string = ACTIVE.code): string | undefined {
  if (!id || !/^[a-z]{2}$/.test(language)) return undefined
  const source = chapterAudioSourceForId(id, language)
  if (!source) return undefined
  return `${import.meta.env.BASE_URL}chapter-timings.${language}.json?v=${source.sourceHash.slice(0, 16)}`
}

/**
 * Where the VOICE starts inside a baked clip, in seconds from the file's
 * start — so a tap starts there rather than at the silence in front of it.
 *
 * Build 63's owner note: "a few words play a tiny bit delayed and I wonder if
 * there is just silence before the word in the clip itself. Amerikansk is an
 * example." There was, in every clip: Chirp3 pads each utterance with a run
 * of silence, 365 ms at the median for the ordinary words and 720 in
 * «amerikansk», up to 1.3 s, and 555 at the median for the slow bake
 * (`scripts/measure-audio-lead.mjs`, DECISIONS.md 2026-09-06). Ten times
 * anything the tap path ever cost, and nothing about loading or pooling can
 * touch it — only starting the clip where the voice is.
 *
 * That silence has since been CUT off the files in place (#192,
 * `scripts/trim-audio-silence.mjs`: whole MP3 frames dropped, nothing
 * re-encoded, each cut verified against the original's samples; the median
 * word now carries about 70 ms). The offsets are still measured after the
 * trim and shipped as data (`audio-lead.da.json`), and this function still
 * parks a pooled element 60 ms before the voice — the safety net for the
 * sixteen clips the trim could not verify and for any future bake that pads
 * again. A pooled element is positioned at its offset as soon as it has
 * metadata and again when it ends, so the tap still only presses play. A
 * clip with no entry (a chapter, a story sentence, an unmeasured bake)
 * starts at 0. After ANY bake: measure, trim, measure again (CLAUDE.md §6).
 */
export const LEAD_PREROLL_MS = 60

export function clipStartAt(url: string | undefined): number {
  if (!url) return 0
  const m = /audio\/([a-z]{2})\/(.+?\.mp3)(?:\?|$)/.exec(url)
  if (!m) return 0
  if (m[1] === 'de' && m[2]!.startsWith(`${CITY1_LEDA_AUDIO_VERSION}/`)) {
    return clipStartAtFromGermanLeadMap(m[2]!, city1LedaLead, CITY1_LEDA_MANIFEST_SHA256)
  }
  // German review sentences and Survival turns (2026-09-26) are measured,
  // never trimmed, the way the accepted Danish sentence bake is.
  const leads = m[1] === 'da' ? audioLead : m[1] === 'de' ? germanAudioLead : null
  if (!leads) return 0
  const lead = (leads.entries as Record<string, number | undefined>)[m[2]!]
  if (!lead) return 0
  return Math.max(0, (lead - LEAD_PREROLL_MS) / 1000)
}

export function clipStartAtFromGermanLeadMap(key: string, leadMap: GermanCity1LeadMap, manifestSha256: string): number {
  if (leadMap.status !== 'complete' || leadMap.version !== CITY1_LEDA_AUDIO_VERSION || leadMap.manifestSha256 !== manifestSha256) return 0
  const entry = leadMap.entries[key]
  if (!entry || !Number.isFinite(entry.leadMs) || !/^[a-f0-9]{64}$/.test(entry.sha256)) return 0
  return Math.max(0, (entry.leadMs - leadMap.prerollMs) / 1000)
}

/** Which of a sentence's three clips: the Danish, its translation, the slow Danish. */
export type StoryVariant = 'normal' | 'en' | 'slow'

/* ------------------------------------------------------------------ *
 * The player
 * ------------------------------------------------------------------ */

/** What a fetch for a clip came back with. The three cases are not the same. */
export type ClipLoad =
  /** The bytes. */
  | { kind: 'clip'; clip: Blob }
  /** A 404: this build has no clip for that word, and never will. Remember it. */
  | { kind: 'absent' }
  /** Offline, or the server is unhappy. Try again on the next tap. */
  | { kind: 'unreachable' }

/**
 * What a learner actually heard after requesting a known recording.
 *
 * `failed` is a recording the app expected and could not play — the case that
 * used to be answered by the device voice, and is now answered by saying so.
 * `silent` is sound switched off, or a request for something that has no
 * recording to expect (an id that is not a word). The two are kept apart
 * because only the first is anyone's problem.
 */
export type PlaybackSource = 'baked' | 'failed' | 'silent'

/**
 * Everything `playWord` touches that is not pure. Split out so the decision
 * logic — what to fetch, what to remember, what to report — can be tested in
 * node, where there is no `Audio` and no `fetch` worth having.
 */
export interface WordAudioPorts {
  load(url: string): Promise<ClipLoad>
  /**
   * Rejects if the device refuses to play: autoplay policy, or a bad decode.
   * `key` names the clip for the port's own pool of ready elements, `url` is
   * where it came from, for a port that would rather hand an element the
   * file than the bytes (the native shell — see `clipSource`).
   */
  play(
    clip: Blob,
    options: {
      key: string
      url: string
      playbackRate?: number
      preservesPitch?: boolean
      /**
       * Called once when this clip stops — it ended, or something stopped it.
       * The article path waits on it before the word; a port that never calls
       * it costs that path a wait of `ARTICLE_MAX_MS`, not the word.
       */
      onEnded?: () => void
    },
  ): Promise<void>
  /**
   * The article a word is said with, or undefined. A port rather than a call
   * into the dataset so the player's own tests can hand it a word list of
   * their choosing — and so a caller with no dataset (nothing today) has a
   * player that simply says the word.
   */
  article?(wordId: string): string | undefined
  /**
   * Ready a clip ahead of its tap, so the tap only has to start it. This is
   * the whole of "instant": a word is loaded when the board is dealt, not
   * when it is touched (owner, 2026-09-05: "it should be instant").
   *
   * `ready` says which screen asked (`owner`, captured when the preload was
   * asked for, not when its bytes arrived) and where this clip stood in that
   * one request (`rank`, from 0): the browser port readies an element only
   * for a screen that is still there, and only for as many of one request's
   * clips as that screen's word pool holds, so a request never pushes its
   * own first clips out (see `claimWordPool`).
   */
  warm(key: string, url: string, clip: Blob, ready?: { owner?: unknown; rank: number }): void
  /** The screen readying clips now, handed back to `warm` (see there). */
  owner?(): unknown
  /** Silence everything, at once. */
  stop(): void
  /**
   * Called synchronously inside the tap that asked for sound, before the first
   * await. See `unlock` below for why.
   */
  prime(): void
  /** Whether the player wants sound at all. */
  wanted(): boolean
  /** A recording that should have played did not. */
  report(failure: AudioFailure): void
}

/**
 * How many clips to hold in memory, counted across both bakes — a word tapped
 * and then heard slowly holds two. Word clips are a few KB each, so this is
 * well under a megabyte — enough that re-tapping a word in a round is instant
 * (and, more importantly, plays *inside* the tap: see `prime`), and far short
 * of holding all 900. The service worker's cache is the real store; this is
 * only the near end of it.
 *
 * At least the largest word pool (WORD_POOL_LIMITS). At 40, one dealt board (articles,
 * phrases and words) plus a few dictionary sheets pushed the board's own
 * article clips out, so a noun tapped later in the round fetched again before
 * it played (Android closed-test report, 2026-10-03).
 */
export const MEMO_MAX = 128
/** How many clips `preload` fetches at once. See the note on it. */
export const PRELOAD_LANES = 4

export function createWordPlayer(ports: WordAudioPorts) {
  /**
   * Both caches are keyed by variant AND id, never by id alone. Keyed by id,
   * the first tap on «hus» would answer every later tap — so 🐢 would replay
   * the ordinary clip and look like a dead button, and a word missing from one
   * bake would fall silent in the other. `slow:da:hus` and `normal:da:hus` are
   * two files and two separate questions.
   */
  const memo = new Map<string, Blob>()
  const absent = new Set<string>()
  /**
   * Rapid taps. Each call takes a ticket, and any call whose ticket is no
   * longer the newest gives up wherever it has got to — including inside the
   * `play()` rejection, because interrupting a clip rejects the promise of the
   * one being interrupted and that is a success, not a failure to fall back
   * from.
   */
  let ticket = 0

  async function attempt(
    id: string,
    options: {
      key: string
      kind: AudioKind
      missingIsFailure?: boolean
      url: string | undefined
      playbackRate?: number
      /**
       * A clip whose absence is nobody's problem: the article in front of a
       * word. A build without the article bake, or a phone whose cache
       * predates it, says the word bare and reports nothing — the word is
       * the recording the player asked for, and it is still reported.
       */
      quiet?: boolean
      onEnded?: () => void
    },
    /**
     * The tap this attempt belongs to. A word said after its article is the
     * SAME tap as the article, so the second attempt rides the first's
     * ticket rather than taking one of its own — a new tap in between
     * outranks both halves at once.
     */
    mine: number = ++ticket,
  ): Promise<PlaybackSource> {
    const current = () => mine === ticket
    // Before the `wanted` check, so turning sound off silences what is already
    // playing rather than only what comes next.
    ports.stop()
    if (!ports.wanted()) return 'silent'
    // No url is not a failure: it is an id that names no recording — a word
    // outside the dataset, a task the source does not know. Nothing to play
    // and nothing to report.
    const { url } = options
    if (!url) {
      if (options.missingIsFailure) {
        ports.report({ kind: options.kind, reason: 'absent' })
        return 'failed'
      }
      return 'silent'
    }
    ports.prime()

    const key = `${options.key}:${id}`
    const fail = (reason: AudioFailure['reason']): PlaybackSource => {
      if (!options.quiet) ports.report({ kind: options.kind, reason })
      return 'failed'
    }

    let clip = memo.get(key)
    if (clip) {
      // Move a played clip to the newest end, so eviction drops what has
      // gone unheard longest rather than whatever was dealt first.
      memo.delete(key)
      memo.set(key, clip)
    }
    if (!clip && !absent.has(key)) {
      const got = await ports.load(url).catch((): ClipLoad => ({ kind: 'unreachable' }))
      if (!current()) return 'silent'
      if (got.kind === 'clip') {
        clip = got.clip
        memo.set(key, clip)
        // Map iterates in insertion order, so the first key is the oldest.
        if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string)
      } else if (got.kind === 'absent') {
        // Remembered, so the app does not re-ask for the same missing file on
        // every tap. It is still reported on every tap: a missing recording
        // is wrong every time it is asked for.
        absent.add(key)
        return fail('absent')
      } else {
        // 'unreachable' is deliberately not remembered: the clip may exist and
        // simply be out of reach, and a player who goes offline for a bus ride
        // should not lose baked audio for the rest of the session.
        return fail('unreachable')
      }
    }
    if (!clip) return fail('absent')

    try {
      await ports.play(clip, {
        key,
        url,
        ...(options.playbackRate ? { playbackRate: options.playbackRate, preservesPitch: true } : {}),
        ...(options.onEnded ? { onEnded: options.onEnded } : {}),
      })
      return current() ? 'baked' : 'silent'
    } catch {
      // Interrupted by a newer tap: that tap's clip is what plays, and the
      // rejection is its success rather than this one's failure.
      if (!current()) return 'silent'
      // Autoplay refused, or the bytes would not decode. The clip stays
      // memoised — the next tap may be allowed where this one was not.
      return fail('play')
    }
  }

  /**
   * A word, with its article in front of it where it has one: «et hus»,
   * «en kat». Two clips and one tap — the article is played first and the
   * word follows when it ends (or after `ARTICLE_MAX_MS`, whichever comes
   * first), on the same ticket, so a second tap during the article silences
   * the whole thing rather than half of it.
   *
   * The article is best-effort and quiet: a build without the article bake,
   * a phone whose cache predates it, or an article that will not play all
   * fall through to the word alone with nothing reported. The WORD keeps the
   * ordinary rules — it is what the player asked to hear.
   */
  async function word(wordId: string, opts?: { slow?: boolean; article?: boolean }): Promise<PlaybackSource> {
    const mine = ++ticket
    const variant = opts?.slow ? 'slow' : 'normal'
    const article = opts?.article === false ? undefined : ports.article?.(wordId)
    if (article && isCity1GermanWord(wordId)) {
      const url = city1LedaPhraseAudioUrl(wordId, article, variant)
      return attempt(wordId, {
        key: `city1-leda-phrase:${variant}`,
        kind: 'word',
        missingIsFailure: true,
        url,
      }, mine)
    }
    // A Danish noun with its own one-performance recording plays that and
    // nothing else; the list's article is the one spokenArticle gives (pinned
    // by speak.test.ts), so the phrase says exactly what the card prints.
    const phraseUrl = article ? articlePhraseAudioUrl(wordId, variant) : undefined
    if (phraseUrl) {
      return attempt(wordId, { key: `da-phrase:${variant}`, kind: 'word', url: phraseUrl }, mine)
    }
    const articleUrl = article ? articleAudioUrl(wordId, article) : undefined
    if (article && articleUrl && ports.wanted()) {
      let ended = () => {}
      const finished = new Promise<void>((resolve) => {
        ended = resolve
      })
      const said = await attempt(
        `${wordId.slice(0, 2)}:${article}`,
        { key: 'article', kind: 'word', url: articleUrl, quiet: true, onEnded: () => ended() },
        mine,
      )
      if (said === 'baked') {
        await Promise.race([finished, new Promise<void>((r) => setTimeout(r, ARTICLE_MAX_MS))])
      }
      if (mine !== ticket) return 'silent'
    }
    return attempt(wordId, { key: variant, kind: 'word', url: wordAudioUrl(wordId, variant) }, mine)
  }

  const example = (wordId: string, opts?: { slow?: boolean }) =>
    attempt(wordId, {
      key: opts?.slow ? 'example-slow' : 'example',
      kind: 'example',
      url: exampleAudioUrl(wordId),
      missingIsFailure: !!wordById(wordId),
      playbackRate: opts?.slow ? EXAMPLE_SLOW_RATE : undefined,
    })

  /**
   * Never rejects, whatever the device or the ports do. Every call site is an
   * onClick that cannot await, so a rejection here is an unhandled promise on
   * an ordinary tap. A thrown port is a failure like any other and is reported
   * as one, so the notice still appears.
   */
  const settled = async (kind: AudioKind, run: () => Promise<PlaybackSource>): Promise<PlaybackSource> => {
    try {
      return await run()
    } catch {
      ports.report({ kind, reason: 'play' })
      return 'failed'
    }
  }

  /**
   * Load and ready a set of clips before anyone taps them. Quiet on purpose:
   * nothing here is a tap, so a clip the build has not got is remembered as
   * absent (and reported when it IS tapped) rather than announced now.
   *
   * A few at a time, in the order given. One at a time left the last card
   * of a deal unready for about two and a half seconds (eighteen clips at
   * the ~130 ms the shell's file handler takes each), so a quick first tap
   * was still a cold one; all eighteen at once is slower through that same
   * handler than a short queue. Four lanes keep the order — the first four
   * cards are asked for first — and clear a board in well under a second.
   */
  async function preload(entries: ReadonlyArray<{ key: string; url: string | undefined }>): Promise<void> {
    const owner = ports.owner?.()
    const queue = entries.map((entry, rank) => ({ ...entry, rank }))
    const lane = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { key, url, rank } = next
        if (!url || absent.has(key)) continue
        let clip = memo.get(key)
        if (!clip) {
          const got = await ports.load(url).catch((): ClipLoad => ({ kind: 'unreachable' }))
          if (got.kind === 'absent') {
            absent.add(key)
            continue
          }
          if (got.kind !== 'clip') continue
          clip = got.clip
          memo.set(key, clip)
          if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string)
        }
        ports.warm(key, url, clip, { owner, rank })
      }
    }
    await Promise.all(Array.from({ length: PRELOAD_LANES }, lane))
  }

  return {
    /** Capture this request, so later owner cleanup cannot stop a newer tap. */
    cancellation(): () => void {
      const mine = ticket
      return () => {
        if (mine !== ticket) return
        ticket++
        ports.stop()
      }
    },
    /** Invalidate pending loads before stopping media and its callbacks. */
    stop(): void {
      ticket++
      ports.stop()
    },
    /** Ready a board's words (or a sheet's word and its 🐢) before they are tapped. */
    preloadWords(wordIds: readonly string[], opts?: { slow?: boolean }): Promise<void> {
      const variant = opts?.slow ? 'slow' : 'normal'
      // A noun with a one-performance phrase (German City 1, Danish City 1)
      // warms the exact phrase URL its tap requests; other nouns warm the
      // shared article clip. Each bare word clip is warmed too, for
      // article:false playback, those of the phrase nouns LAST: no tap on a
      // card asks for them, so a screen whose word pool is smaller than the
      // whole request keeps the clips its taps do ask for (`claimWordPool`).
      const articles = new Map<string, string | undefined>()
      const phrases = new Map<string, string | undefined>()
      const phrased = new Set<string>()
      for (const id of wordIds) {
        const article = ports.article?.(id)
        if (article && isCity1GermanWord(id)) phrases.set(`city1-leda-phrase:${variant}:${id}`, city1LedaPhraseAudioUrl(id, article, variant))
        else if (article && articlePhraseAudioUrl(id, variant)) phrases.set(`da-phrase:${variant}:${id}`, articlePhraseAudioUrl(id, variant))
        else if (article) articles.set(`article:${id.slice(0, 2)}:${article}`, articleAudioUrl(id, article))
        if (article && (isCity1GermanWord(id) || articlePhraseAudioUrl(id, variant))) phrased.add(id)
      }
      const bare = (id: string) => ({ key: `${variant}:${id}`, url: wordAudioUrl(id, variant) })
      return preload([
        ...[...articles].map(([key, url]) => ({ key, url })),
        ...[...phrases].map(([key, url]) => ({ key, url })),
        ...wordIds.filter((id) => !phrased.has(id)).map(bare),
        ...wordIds.filter((id) => phrased.has(id)).map(bare),
      ])
    },
    /**
     * Ready recordings that are not words of the course data (the run's
     * connecting words, audio/da/connecting/*.mp3) the way a board's words
     * are readied: fetched, memoised and parked on a warm element, so saying
     * one is `play()` and nothing else (`playClip`).
     */
    preloadClips(urls: readonly string[]): Promise<void> {
      return preload(urls.map((url) => ({ key: `clip:${url}`, url })))
    },
    /** Say a recording readied by `preloadClips` (or fetched now if it was not). */
    playClip(url: string): Promise<PlaybackSource> {
      return settled('word', () => attempt(url, { key: 'clip', kind: 'word', url }))
    },
    /** Ready the example sentences a screen is about to offer. */
    preloadExamples(wordIds: readonly string[]): Promise<void> {
      return preload(wordIds.map((id) => ({ key: `example:${id}`, url: exampleAudioUrl(id) })))
    },
    playWord(wordId: string, opts?: { slow?: boolean; article?: boolean }): Promise<PlaybackSource> {
      return settled('word', () => word(wordId, opts))
    },
    playExample(wordId: string, opts?: { slow?: boolean }): Promise<PlaybackSource> {
      return settled('example', () => example(wordId, opts))
    },
    preloadCity1Sentences(rows: readonly BoardSentence[], recordings: readonly SentenceRecording[]): Promise<void> {
      return preload(rows.flatMap(row => [false, true].map(slow => ({ key: `city1-sentence:${slow ? 'slow' : 'normal'}:${row.audioId}`, url: city1AudioUrl(row, recordings, slow) }))))
    },
    playCity1Sentence(row: BoardSentence, recordings: readonly SentenceRecording[], opts?: { slow?: boolean }): Promise<PlaybackSource> {
      return settled('example', () => attempt(row.audioId, { key: opts?.slow ? 'city1-sentence:slow' : 'city1-sentence:normal', kind: 'example', missingIsFailure: true, url: city1AudioUrl(row, recordings, opts?.slow) }))
    },
    playTask(audioLineId: string): Promise<PlaybackSource> {
      return settled('task', () => attempt(audioLineId, { key: 'task', kind: 'task', url: taskAudioUrl(audioLineId) }))
    },
    playSurvival(audioLineId: string): Promise<PlaybackSource> {
      return settled('survival', () => attempt(audioLineId, { key: 'survival', kind: 'survival', url: survivalAudioUrl(audioLineId) }))
    },
    /** Tests only: drop everything learned so far. */
    reset() {
      memo.clear()
      absent.clear()
      ticket = 0
    },
  }
}

/* ------------------------------------------------------------------ *
 * The browser wiring
 * ------------------------------------------------------------------ */

/**
 * 20 ms of PCM silence.
 *
 * iOS will only let an audio element start playing from inside a user gesture,
 * and it grants that permission to the *element*, once, for good. Fetching a
 * clip takes us out of the gesture — by the time the bytes arrive the tap is
 * over — so the very first word would be refused and fall back to speech for
 * ever after. Playing this inside the tap, before the fetch, spends the gesture
 * on unlocking the element while it is still ours to spend.
 *
 * STILL NOT VERIFIED ON A DEVICE — there was no iPhone in the session that
 * wrote it, and none in the session (S1) that gave it a second call site
 * (`primeWordAudio`, exported below `audioElement`) for Casey's guesses to
 * unlock ahead of. It remains a precaution with a known failure mode (the
 * fallback), not a measurement, until a TestFlight build is actually heard —
 * that listen is the owner's, not a session's. If baked audio turns out to
 * work on iPhone without it, delete `prime` and `primeWordAudio` together.
 */
const UNLOCK_WAV =
  'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'

let element: HTMLAudioElement | undefined
let objectUrl: string | undefined
let primed = false
// `playLoadedClip` can be waiting for metadata while the ride is stopped or
// unmounted. The shared element must reject that obsolete continuation before
// it reaches `play()`, not merely let the component ignore its later state.
let audioGeneration = 0

function audioElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio()
    element.preload = 'auto'
    // Chapters are long: when one stops, every resting element is muted (mediaQuiet.ts).
    watchMedia(element)
  }
  return element
}

/**
 * Unlock the audio element inside a real user gesture, ahead of the sound
 * that will need it. `playWord` already primes on its own first call (the
 * `prime` port below, idempotent on `primed`), which covers every sound that
 * follows directly from a tap. It does NOT cover Casey's guesses (S1):
 * `stepAiGuess` runs on a `setInterval`, so by the time it calls `playWord`
 * the gesture that started the AI turn is long over, and on iOS priming from
 * inside that callback is priming too late — the same failure `prime`'s own
 * comment describes, just reached from a different call site.
 *
 * So the composer's Give-clue tap — the gesture that starts the chain ending
 * in Casey's first guess — calls this directly, synchronously, before the
 * async `submit()` it also triggers. `docs/DECISIONS.md`'s amendment to "every
 * sound follows a tap" is this: a sound follows a tap, or follows FROM one.
 *
 * Exported standalone (rather than only reachable through `playWord`) so a
 * call site can prime without also asking for a word to be spoken — the
 * Give-clue button has no word in hand at all, only the gesture.
 */
export function primeWordAudio(): void {
  // Only the Web Audio path plays through a context, and it is off (WEB_AUDIO,
  // below). Resuming one anyway CREATED it, inside the first tap of every
  // session: an AudioContext built, and the audio hardware started, before
  // the word the finger asked for could begin (owner, 2026-09-30: "the first
  // tap on a board is always slow to react"). When WEB_AUDIO is on, every tap
  // resumes it, not just the first: a phone call or a lock screen suspends it,
  // and the next gesture is the only place it can be resumed.
  if (WEB_AUDIO) resumeAudioContext()
  if (webAudioWords()) webWords.prime() // inside the gesture: the context is made and resumed here
  if (primed || typeof Audio === 'undefined') return
  primed = true
  // The shell needs no unlock: Capacitor sets
  // mediaTypesRequiringUserActionForPlayback to none on iOS and
  // setMediaPlaybackRequiresUserGesture(false) on Android (selftest.ts).
  // Starting the silent clip anyway put a second media player in the same
  // tap as the word.
  if (Capacitor.isNativePlatform()) return
  const el = audioElement()
  el.src = UNLOCK_WAV
  // No matching pause: the clip is 20 ms long and ends by itself. Pausing it
  // later would risk pausing the real clip that replaced it. When `play`
  // below swaps the src, this promise rejects with an abort — expected.
  wake(el)
  void el.play().catch(() => {})
}

/**
 * Silence everything at once — the clip and any utterance behind it. Called at
 * the top of every `playWord`, so a second tap never lands on top of the first.
 */
export function stopWordAudio(): void {
  player.stop()
}

function stopMedia(): void {
  audioGeneration++
  webWords.stop() // the Web Audio words, if the performance log switch ever used them
  if (activeSource) {
    try {
      activeSource.stop()
    } catch {
      // Already ended, or never started: nothing to silence.
    }
    activeSource = undefined
  }
  if (active) {
    active.pause()
    active = undefined
  }
  if (element) {
    element.pause()
    // Chapter playback owns these callbacks; a later word tap and an
    // unmounted ride must never be able to call back into that old screen.
    element.ontimeupdate = null
    element.onended = null
  }
}

/**
 * There is no clip here — and get rid of whatever the cache thinks there is.
 *
 * Needed because "no clip" does not reliably arrive as a 404. A single-page
 * host answers an unknown path with index.html and a 200: `vite preview` does,
 * and so does the Capacitor shell the iOS build runs inside. offline-drive
 * measured it — a word with no baked file came back 200, and the service
 * worker filed the HTML under the clip's URL, where CacheFirst would have kept
 * it for a year. Deleting it costs one pass over the cache names, once per word
 * per session, since the answer is memoised after that.
 */
function noClipAt(url: string): ClipLoad {
  if (typeof caches !== 'undefined') {
    void caches
      .keys()
      .then((names) => Promise.all(names.map((n) => caches.open(n).then((c) => c.delete(url)))))
      .catch(() => {})
  }
  return { kind: 'absent' }
}

/**
 * Does this blob begin like an audio file?
 *
 * Only asked when the response gave no content-type of its own, which on a
 * phone is every clip (see `load`). Two openings cover the whole bake: `ID3`
 * for a tagged MP3, and an eleven-bit MPEG frame sync — 0xFF followed by three
 * set bits — for an untagged one. Both are impossible openings for the
 * index.html a single-page host answers an unknown path with, which is the
 * only thing this is guarding against.
 */
async function looksLikeAudio(clip: Blob): Promise<boolean> {
  if (clip.size < 3) return false
  const head = new Uint8Array(await clip.slice(0, 3).arrayBuffer())
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true
  return head[0] === 0xff && (head[1]! & 0xe0) === 0xe0
}

/**
 * What the audio element is given to play: the bytes as a blob URL on the
 * web, the file's own URL in the native shell.
 *
 * On the web the bytes are the point — they were fetched so the service
 * worker could cache a plain 200 (see `load`), and a blob URL plays them
 * without a second request. Inside the Capacitor shell there is no service
 * worker, and the simulator's audio self-test (ios-sim run 18) showed the
 * loader getting every clip's bytes while an audio element given the same
 * file's URL read it perfectly well; what nobody had ever tried on a WebKit
 * that lives at `capacitor://localhost` was playing a `blob:` URL minted
 * there, and build 58 reported "did not load" for every word and sentence.
 * The element loading the file itself goes through the handler's Range
 * branch — a real 206 with a real content-type — which is the path Capacitor
 * built that branch for. The bytes are still fetched first: that is how a
 * missing clip is told apart from one that will not play, and the memo is
 * what makes a re-tap instant.
 */
function clipSource(clip: Blob, url: string | undefined): string {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = undefined
  }
  if (url && Capacitor.isNativePlatform()) return url
  objectUrl = URL.createObjectURL(clip)
  return objectUrl
}

/* ------------------------------------------------------------------ *
 * The pool of ready elements
 * ------------------------------------------------------------------ */

/**
 * One audio element per clip that is likely to be tapped, loaded ahead of
 * the tap. This is what makes a word instant: on build 59 a tap fetched the
 * bytes, handed the file to the one shared element, and waited for that
 * element to load it, three trips through the shell's file handler before a
 * sound — audible as a delay on the phone. A warm element has already made
 * those trips; its tap is `play()` and nothing else.
 *
 * EACH SCREEN HOLDS ONLY WHAT ITS OWN TAPS NEED, AND NOTHING ONCE IT IS LEFT
 * (owner, after build 124: "Why 64? Wouldn't 8 be enough? A player is not
 * needed after the gate has been cleared."). On the iPhone every loaded
 * element is a media player, and each play or pause costs more the more of
 * them are alive; a pool of 64 shared by every screen kept a walk's passed
 * gates and the last board's cards loaded all session. So a screen claims
 * its own word pool as it mounts (`claimWordPool`, `useWordPool`) with the
 * smallest size that keeps its taps instant (`WORD_POOL_LIMITS`), readies
 * into it, oldest out first, and gives every element back as it unmounts.
 * Home claims nothing and holds no loaded element. Each element is ~10 KB of
 * decoded audio at most. The shared `element` below stays for chapter
 * performances, which seek and are never pre-warmed.
 */
export const WORD_POOL_LIMITS = {
  /** The current gate's word and the next two gates' (an article gate: its phrase, or article + word). */
  sightseeing: 8,
  /** The café board's eighteen words, plus two (owner, 2026-10-05: "your 20 for the board was good"). */
  cafe: 20,
  /** A dictionary sheet: the word, its slow twin, the sentence and its slow twin, and an article clip. */
  sheet: 6,
  /** Screens with nothing readied ahead (the suitcase, the guide's dialogue lines): the clip just tapped, with its article. */
  tap: 2,
} as const
/**
 * Where a clip played with no screen's pool claimed goes: kept for its own
 * re-tap, and given back the moment any screen comes or goes.
 */
const LOOSE_MAX = 2
/**
 * Elements given back by a screen, emptied (no source, no media player) and
 * kept for the next screen to load, so a session makes only as many elements
 * as its busiest screen holds: in WebKit every element made and not yet
 * collected costs each later play, released or not (the note below).
 */
const SPARE_MAX = WORD_POOL_LIMITS.cafe + WORD_POOL_LIMITS.sheet
/** One screen's word pool. */
interface PoolScope {
  readonly name: string
  limit: number
  released: boolean
}
/** A ready element, the blob URL it plays (the web only), its parking listener and the screen it was readied for. */
interface Pooled {
  readonly el: HTMLAudioElement
  readonly objectUrl?: string
  readonly startAt: number
  readonly park?: () => void
  readonly scope: PoolScope
}
const pool = new Map<string, Pooled>()
const LOOSE: PoolScope = { name: 'loose', limit: LOOSE_MAX, released: false }
/** The screens that hold a word pool now, the newest (a sheet over the board) last. */
const scopes: PoolScope[] = []
const spare: HTMLAudioElement[] = []
const currentScope = (): PoolScope => scopes[scopes.length - 1] ?? LOOSE

/**
 * A SCREEN'S POOL NEVER MAKES MORE THAN ITS LIMIT OF ELEMENTS (owner, build 124: "the
 * progressive freezing ... happens whenever I hit a word. It resets when I
 * close the app"). A clip readied into a full pool takes over the element of
 * the clip unused longest (`retirePooledElement`, then a new `src` and
 * `load()`), rather than a new element being made and the old one released.
 *
 * In WebKit every media element the page has made and the garbage collector
 * has not yet taken counts in each media call: starting, pausing and loading
 * any element cost more the more elements there are, released or not
 * (measured in Playwright's WebKit: `play()` + `pause()` 0.005 ms with 50
 * elements, 0.35 ms with 2,250, back to 0.01 ms once a collection ran). A
 * released element is only taken at a full collection, which a page that
 * allocates as little as this one rarely needs, so on the phone they piled
 * up: a new element for every gate of a walk and every word of a dealt
 * board, and every word said (a run's answer, a tapped card) paid for all of
 * them. With the elements reused there are never more than the pool holds.
 */

/**
 * Take an element out of the pool's service: stopped, its parking listeners
 * off, its blob URL given back. The caller either loads it with another clip
 * (`readyElement`) or lets it go (`releasePooledElement`).
 */
function retirePooledElement(entry: Pooled): void {
  const { el } = entry
  try {
    el.pause()
    if (entry.park) {
      el.removeEventListener('loadedmetadata', entry.park)
      el.removeEventListener('ended', entry.park)
    }
  } catch {
    // An element that will not stop is loaded over or let go all the same.
  }
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
}

/**
 * Let an element that left the pool go NOW (the tests' `clear`). Pausing and
 * removing `src` is not enough: an element keeps the media resource it loaded
 * (in WebKit, a whole media player in the GPU process) until a new load is
 * started or the element is collected. `load()` with no source is the
 * documented way to drop the resource at once (HTML: "the media element load
 * algorithm" with no src empties the element). Nothing plays from an element
 * that left the pool.
 */
export function releasePooledElement(entry: Pooled): void {
  retirePooledElement(entry)
  const { el } = entry
  try {
    el.removeAttribute('src')
    el.load()
  } catch {
    // An element that will not let go is collected with the rest of it.
  }
}
/** The pooled element last asked to play, so `stop` can pause it. */
let active: HTMLAudioElement | undefined

/** Give one pooled clip's element back: released, and kept empty for the next screen. */
function dropPooled(key: string, entry: Pooled): void {
  pool.delete(key)
  if (active === entry.el) active = undefined
  releasePooledElement(entry)
  if (spare.length < SPARE_MAX && !spare.includes(entry.el)) spare.push(entry.el)
}

/** The clips readied for `scope`, oldest first. */
function entriesOf(scope: PoolScope): [string, Pooled][] {
  return [...pool].filter(([, entry]) => entry.scope === scope)
}

/**
 * The clip of `scope` to give up for a new one: the one unused longest, but
 * not the one playing while another can go (a run's answer is said as the
 * next gate is readied).
 */
function oldestOf(scope: PoolScope): [string, Pooled] | undefined {
  const mine = entriesOf(scope)
  return mine.find(([, entry]) => entry.el !== active) ?? mine[0]
}

/** Release every clip of `scope` past `limit`, oldest first. */
function trimScope(scope: PoolScope, limit: number): void {
  for (let mine = entriesOf(scope); mine.length > limit; mine = entriesOf(scope)) {
    const [key, entry] = oldestOf(scope)!
    dropPooled(key, entry)
  }
}

/** A word pool a screen holds while it is mounted. */
export interface WordPoolHandle {
  /** Resize it; a smaller size releases the clips unused longest at once. */
  setLimit(limit: number): void
  /** Give every element back: the screen is gone. Idempotent. */
  release(): void
}

/**
 * Claim a word pool of `limit` elements for a screen. Everything the word
 * player readies while it is the newest claim — a dealt board, a gate on the
 * road, a tapped word — is held in it, oldest out first once it is full, and
 * all of it is released by `release()` (the screen's unmount). A preload
 * keeps the pool it was asked from: bytes that arrive after their screen has
 * gone are memoised, not readied. Any claim or release also gives back the
 * loose clips played with no pool claimed. See `useWordPool` for screens.
 */
export function claimWordPool(name: string, limit: number): WordPoolHandle {
  trimScope(LOOSE, 0)
  const scope: PoolScope = { name, limit: Math.max(0, Math.floor(limit)), released: false }
  scopes.push(scope)
  webWords.poolsChanged() // the Web Audio words keep the same pools (performance log switch)
  return {
    setLimit(next: number) {
      if (scope.released) return
      scope.limit = Math.max(0, Math.floor(next))
      trimScope(scope, scope.limit)
    },
    release() {
      if (scope.released) return
      scope.released = true
      const at = scopes.indexOf(scope)
      if (at >= 0) scopes.splice(at, 1)
      trimScope(scope, 0)
      trimScope(LOOSE, 0)
      webWords.poolsChanged() // the Web Audio words keep the same pools (performance log switch)
    },
  }
}

/** The word pool readying now, for the Web Audio words (wordAudioWeb.ts), which keep the same pools. */
export const currentWordPool = (): { readonly name: string; readonly limit: number; readonly released: boolean } => currentScope()

/** Resize the newest claimed word pool (no-op when none is claimed). */
export function setWordPoolLimit(limit: number): void {
  const scope = scopes[scopes.length - 1]
  if (!scope) return
  scope.limit = Math.max(0, Math.floor(limit))
  trimScope(scope, scope.limit)
}

/** What the word pool holds now: for the performance log and the tests. */
export function wordPoolStats(): { loaded: number; spare: number; limit: number; scope: string } {
  const scope = currentScope()
  return { loaded: pool.size, spare: spare.length, limit: scope.limit, scope: scope.name }
}
setWordPoolProbe(wordPoolStats)

/* ------------------------------------------------------------------ *
 * The decoded buffers — the path a tap takes now
 * ------------------------------------------------------------------ */

/**
 * A short clip plays as a DECODED BUFFER on the app's AudioContext rather
 * than through an element. A ready element still took 20–91 ms from
 * `play()` to `playing` in the shell (ios-sim run 21), because an element
 * is a media player — it seeks, buffers, and negotiates an audio session
 * before a sound — where a buffer source starts on the audio clock the
 * moment it is asked to. The bytes are decoded when a clip is readied (the
 * deal, the sheet, the summary), so the tap does none of that work.
 *
 * The element pool stays for three cases, each real: a clip that has not
 * been decoded yet (the first tap on a card the deal has not reached), a
 * context that is not running (the very first tap of a session, before the
 * gesture's `resume` lands, or a phone in a call), and any clip played at a
 * rate — the sheet's slow sentence is the ordinary clip at 0.8 with pitch
 * kept, which a buffer source cannot do. Long chapter performances never
 * come here at all; they seek, and keep the shared element.
 *
 * `WEB_AUDIO` is the one switch, and it is OFF: build 61 shipped it on and
 * the owner's phone answered the question the simulator could not — "it
 * plays when I launch the app but then it stops." The first tap of a session
 * takes the element path (the context is still resuming inside that first
 * gesture) and was heard; every tap after it took the buffer path and was
 * not. That is WebKit's audio session on iOS: Web Audio runs under the
 * ambient category, which the ring/silent switch mutes, and the session is
 * dropped when a media element ends, after which a running context produces
 * nothing until something reactivates it — and neither shows in a simulator,
 * which has no switch and whose muted output still looks like playback to
 * the code (run 22 read "via buffer, 8 ms" and was blind to the speaker).
 * The path stays here, gated, for a build that can pair it with a native
 * audio-session hook and a device to hear it on; until then the pooled
 * element is the whole of playback, as in build 60, and the pointer-down
 * card (the larger saving) stands on its own.
 */
const WEB_AUDIO = false
const DECODED_MAX = 64
const decoded = new Map<string, AudioBuffer>()
/** Keys being decoded right now, so a warm and a tap do not decode twice. */
const decoding = new Set<string>()
/** The buffer source last started, so `stop` can silence it. */
let activeSource: AudioBufferSourceNode | undefined

/** Decode a clip into the buffer cache. Quiet: a clip that will not decode plays through its element. */
function decodeInto(key: string, clip: Blob): void {
  const ctx = WEB_AUDIO ? getAudioContext() : undefined
  if (!ctx || decoded.has(key) || decoding.has(key)) return
  decoding.add(key)
  void clip
    .arrayBuffer()
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      decoded.delete(key)
      decoded.set(key, buffer)
      if (decoded.size > DECODED_MAX) decoded.delete(decoded.keys().next().value as string)
    })
    .catch(() => undefined)
    .finally(() => decoding.delete(key))
}

/** Which way a clip was started. What the self-test and the drives read. */
export type PlayedVia = 'buffer' | 'element'

/**
 * Say, on the window, that a clip just started and how. This is the
 * observable a drive watches now that a tap fetches nothing and may not
 * touch a media element either; it carries the clip's own path because a
 * buffer has no `src` and an element's is a blob: URL on the web.
 */
function announcePlay(url: string, via: PlayedVia): void {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  window.dispatchEvent(new CustomEvent<{ url: string; via: PlayedVia }>('cluecab-audio', { detail: { url, via } }))
}

/** Start a decoded buffer, or answer undefined when this tap cannot take that path. */
function startBuffer(key: string, startAt: number): AudioBufferSourceNode | undefined {
  const buffer = decoded.get(key)
  const ctx = buffer ? getAudioContext() : undefined
  if (!buffer || !ctx || ctx.state !== 'running') return undefined
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.onended = () => {
    if (activeSource === source) activeSource = undefined
    source.disconnect()
  }
  source.start(0, startAt)
  // Most recently played goes to the back of the line for eviction.
  decoded.delete(key)
  decoded.set(key, buffer)
  return source
}

/*
 * Starting a pooled element without losing its first milliseconds (owner,
 * build 123: "a few words that were cut off, that started too late, where I
 * only heard half the word").
 *
 * The voice sits only ~60 ms into a clip once the player has skipped to its
 * lead (`clipStartAt`), so anything that eats the start of playback eats the
 * word's first sound. Two things here could, both on an element the tap
 * reached before it had finished loading — the first tap on a card the deal
 * has not readied yet, or one tapped while its warm was still in flight:
 *
 * - The park on `loadedmetadata` moved `currentTime` whenever metadata
 *   arrived, even when the tap had already started the element: a seek on a
 *   playing (WebKit: an AVPlayer mid-start) element, which drops the audio
 *   around the jump. A playing element is now left where it is; it simply
 *   plays its few ms of lead-in silence.
 * - `play()` went straight to an element that was still loading, with a
 *   seek in the same breath. An element still loading now waits for
 *   `canplay` (bounded, so a stack that never says so still plays) and is
 *   seeked and started together once it can play, and not at all if a newer
 *   tap has come in meanwhile. A ready element, which is every warmed card,
 *   starts at once, exactly as before.
 */

/** `HTMLMediaElement.HAVE_FUTURE_DATA` and `NETWORK_LOADING`, for node where the constants do not exist. */
const HAVE_FUTURE_DATA = 3
const NETWORK_LOADING = 2
/** The longest a tap waits for a still-loading element before it plays it anyway. */
export const READY_WAIT_MS = 300

/** Put a resting element where its voice starts. Never moves one that is playing. */
export function parkAtVoice(el: HTMLMediaElement, startAt: number): void {
  if (!el.paused) return
  el.currentTime = startAt
}

/**
 * Play `el` from `startAt` once it can play: at once when it is ready (or
 * stopped at metadata, where waiting would only add delay), else on `canplay`,
 * `error` or after `waitMs`, whichever comes first. Rejects with an
 * AbortError, without touching the element, when `isCurrent` says a newer
 * tap has taken over meanwhile.
 */
export function startWhenReady(
  el: HTMLMediaElement,
  startAt: number,
  isCurrent: () => boolean = () => true,
  waitMs: number = READY_WAIT_MS,
): Promise<void> {
  const start = () => {
    if (el.readyState > 0 && Math.abs(el.currentTime - startAt) > 0.02) el.currentTime = startAt
    // A resting element may be muted (mediaQuiet.ts): unmuted as it starts.
    wake(el)
    return el.play()
  }
  // Wait for an element still loading, and for one with no metadata at all
  // yet (just handed its source: until metadata it cannot even be seeked to
  // its voice). One that has metadata and is not loading will not get further
  // without play() (a WebKit that stops at metadata), so it plays now.
  const loading = el.networkState === NETWORK_LOADING || el.readyState === 0
  if (el.readyState >= HAVE_FUTURE_DATA || !loading) return start()
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const go = () => {
      clearTimeout(timer)
      el.removeEventListener('canplay', go)
      el.removeEventListener('error', go)
      if (!isCurrent()) {
        reject(Object.assign(new Error('superseded by a newer tap'), { name: 'AbortError' }))
        return
      }
      // On `error` the play below rejects with the element's own error.
      start().then(resolve, reject)
    }
    el.addEventListener('canplay', go)
    el.addEventListener('error', go)
    timer = setTimeout(go, waitMs)
  })
}

function readyElement(key: string, url: string, clip: Blob, scope: PoolScope = currentScope()): HTMLAudioElement {
  const have = pool.get(key)
  if (have) {
    // Most recently used goes to the back of the line for eviction.
    pool.delete(key)
    pool.set(key, have)
    return have.el
  }
  // A full pool hands the element of its clip unused longest over to this
  // one: the new `src` and `load()` below drop the old clip's media at once.
  // Otherwise an element a screen gave back, else a new one.
  let el: HTMLAudioElement
  const oldest = entriesOf(scope).length >= scope.limit ? oldestOf(scope) : undefined
  if (oldest) {
    const [oldestKey, entry] = oldest
    pool.delete(oldestKey)
    if (active === entry.el) active = undefined
    retirePooledElement(entry)
    el = entry.el
  } else {
    el = spare.pop() ?? new Audio()
    el.preload = 'auto'
    watchMedia(el)
  }
  // The clip's own path, kept on the element: on the web its `src` is a
  // blob: URL that names nothing, and this is how a drive can tell WHICH clip
  // an element played now that the fetch happens long before the tap.
  el.dataset.clip = url
  // Parked where the voice starts (see `clipStartAt`) as soon as the element
  // knows its duration — WebKit ignores a seek before metadata — and parked
  // there again when it ends, so the next tap does not seek either.
  const startAt = clipStartAt(url)
  let park: (() => void) | undefined
  if (startAt > 0) {
    park = () => parkAtVoice(el, startAt)
    el.addEventListener('loadedmetadata', park, { once: true })
    el.addEventListener('ended', park)
  }
  let objectUrl: string | undefined
  // The native shell is handed the file (see `clipSource`); the web the bytes.
  if (Capacitor.isNativePlatform()) {
    el.src = url
  } else {
    objectUrl = URL.createObjectURL(clip)
    el.src = objectUrl
  }
  el.load()
  pool.set(key, { el, objectUrl, startAt, park, scope })
  return el
}

/**
 * Ready a clip ahead of its tap, into the pool of the screen that asked for
 * it — unless that screen has gone, or the clip stands past what its pool
 * holds in the request that readied it (its bytes stay memoised either way).
 */
function warmElement(key: string, url: string, clip: Blob, ready?: { owner?: unknown; rank: number }): void {
  const scope = (ready?.owner as PoolScope | undefined) ?? currentScope()
  if (scope.released) return
  if (ready && ready.rank >= scope.limit && !pool.has(key)) return
  readyElement(key, url, clip, scope)
}

/** The element pool, for tests: ready an element for a clip, and how many the pool holds. */
export const elementPoolForTests = {
  ready: (key: string, url: string, clip: Blob): HTMLAudioElement => readyElement(key, url, clip),
  warm: (key: string, url: string, clip: Blob, ready?: { owner?: unknown; rank: number }): void => warmElement(key, url, clip, ready),
  /** The pool `warm` would capture now (the player's `owner` port). */
  owner: (): unknown => currentScope(),
  /** Mark a ready element as the one playing (what `play` does). */
  playing(el: HTMLAudioElement | undefined): void {
    active = el
  },
  get size(): number {
    return pool.size
  },
  get spare(): number {
    return spare.length
  },
  sizeOf(name: string): number {
    return [...pool.values()].filter((entry) => entry.scope.name === name).length
  },
  loose: LOOSE_MAX,
  clear(): void {
    for (const entry of pool.values()) releasePooledElement(entry)
    pool.clear()
    for (const scope of scopes) scope.released = true
    scopes.length = 0
    spare.length = 0
    active = undefined
  },
}

const browserPorts: WordAudioPorts = {
  async load(url) {
    try {
      // The bytes are fetched rather than handed to the element as a `src`
      // because WebKit asks media elements' sources for byte ranges, and a 206
      // Partial Content is a response the Cache API refuses to store — the
      // service worker's runtime cache for /audio/ would fill with nothing and
      // offline playback would quietly never work. A plain GET returns a plain
      // 200, which caches. See the workbox block in vite.config.ts.
      // No `cache: 'force-cache'`. It reads like the right thing for a file
      // that never changes, and it buys nothing — the service worker's
      // CacheFirst already keeps the network out of a repeat play, and the
      // native shell reads the clip off local storage. What it would cost is
      // the miss path: a word with no clip answers 200 text/html with a
      // max-age, and force-cache would keep serving that HTML from the HTTP
      // cache after the bake had put a real clip there.
      const res = await fetch(url)
      if (res.status === 404) return noClipAt(url)
      // A status of ZERO is not a failure here, and this line is where the
      // native shell was still losing every clip after the type check below
      // was taught to trust the bytes. Capacitor's iOS handler answers a
      // media extension with a plain `URLResponse` (see the block below), and
      // WebKit gives a response with no HTTP message a status code of 0
      // (ResourceResponseCocoa.mm: `messageRef ? ... : 0`). `Response.ok` is
      // defined as 200–299, so `!res.ok` was true for every mp3 in the app,
      // `unreachable` came back before the bytes were ever looked at, and —
      // because `unreachable` is deliberately not remembered — every tap
      // re-fetched and re-fell-back to the phone's own voice. 0 is therefore
      // "no verdict", the same as an empty content-type: let the bytes decide.
      if (!res.ok && res.status !== 0) return { kind: 'unreachable' }
      // Trust the type, not the status. See `noClipAt`: a 200 here is as likely
      // to be the app's own index.html as it is to be a clip.
      //
      // ---- and when there is no type at all, trust the BYTES ---------------
      //
      // This used to be `if (!/^audio\//) return noClipAt(url)`, and on the
      // phone that rejected every clip the app has. Capacitor's iOS scheme
      // handler answers a MEDIA extension with a plain `URLResponse` rather
      // than an `HTTPURLResponse` — mp3 is on its list beside mp4 and wav —
      // and a non-HTTP response carries no headers, so `content-type` comes
      // back empty in `fetch`. Every baked word, sentence, chapter and
      // survival line therefore read as absent, and `attempt` fell through to
      // the device's own Danish voice: the whole Aoede bake was silent inside
      // the native shell while being perfectly present in the bundle, and the
      // web drives went on passing because `vite preview` sends a real
      // Content-Type.
      //
      // So an empty type is no longer a verdict. What the check exists for is
      // the SPA fallback — a single-page host answering an unknown path with
      // index.html and a 200 — and that is still caught, twice: by its own
      // text/html type, and by a positive test on the first bytes. An MP3
      // starts with an ID3 tag or an MPEG frame sync; `<!doctype html>` starts
      // with neither, so a miss can never be mistaken for a clip.
      const type = res.headers.get('content-type') ?? ''
      if (/^audio\//i.test(type)) return { kind: 'clip', clip: await res.blob() }
      if (type && !/^application\/octet-stream/i.test(type)) return noClipAt(url)
      const clip = await res.blob()
      if (!(await looksLikeAudio(clip))) return noClipAt(url)
      return { kind: 'clip', clip }
    } catch {
      return { kind: 'unreachable' }
    }
  },
  play(clip, options) {
    // The buffer path, whenever this tap can take it; see `decodeInto`.
    if (!options.playbackRate) {
      const source = startBuffer(options.key, clipStartAt(options.url))
      if (source) {
        activeSource = source
        if (options.onEnded) {
          const parked = source.onended
          source.onended = (ev) => {
            parked?.call(source, ev)
            options.onEnded?.()
          }
        }
        announcePlay(options.url, 'buffer')
        return Promise.resolve()
      }
      // Not decoded yet: decode for the next tap while this one plays the
      // element. (A clip at a rate is never decoded; it has no buffer path.)
      decodeInto(options.key, clip)
    }
    const el = readyElement(options.key, options.url, clip)
    active = el
    el.playbackRate = options.playbackRate ?? 1
    el.preservesPitch = options.preservesPitch ?? true
    // A warm element is parked where the voice starts (`clipSource` parks it
    // on metadata and on `ended`); `startWhenReady` is the guard for one that
    // is not — interrupted mid-clip, or a browser that dropped the parked
    // position — and the wait for one that is still loading.
    const startAt = clipStartAt(options.url)
    // This tap's place in line: a newer tap (or a stop) moves it on.
    const generation = audioGeneration
    if (options.onEnded) {
      // Once, on whichever comes first. A clip that runs out fires `pause`
      // and then `ended`; one cut short by `stop` fires `pause` alone — and
      // either way the article is over and the word may follow.
      let told = false
      const done = () => {
        if (told) return
        told = true
        el.removeEventListener('ended', done)
        el.removeEventListener('pause', done)
        options.onEnded?.()
      }
      el.addEventListener('ended', done)
      el.addEventListener('pause', done)
    }
    announcePlay(options.url, 'element')
    return startWhenReady(el, startAt, () => generation === audioGeneration)
  },
  article: spokenArticleOf,
  warm(key, url, clip, ready) {
    // Decoded first; an element as well only where there is no context to
    // decode into. Eighteen media players readying at once is its own cost
    // on a phone, and a decoded board does not need them.
    if (WEB_AUDIO && getAudioContext()) decodeInto(key, clip)
    else warmElement(key, url, clip, ready)
  },
  owner: currentScope,
  stop: stopMedia,
  // `primeWordAudio` above — a standalone export so S1's Give-clue call site
  // can reach it without going through a word at all.
  prime: primeWordAudio,
  wanted: () => useSettings.getState().sound,
  report: reportFailure,
}

/**
 * The chapter player has its own load-and-play path (below), so it reports
 * its own failures through the same door the word player uses.
 */
export function reportAudioFailure(failure: AudioFailure): void {
  reportFailure(failure)
}

const player = createWordPlayer(browserPorts)

/**
 * The train's chapter performance uses the same primed element as a word.
 * Keeping one element matters on iOS: a user gesture unlocks an element, not
 * "audio" in general, and a chapter fetch finishes after that gesture ends.
 */
export async function loadBakedClip(url: string): Promise<ClipLoad> {
  return browserPorts.load(url)
}

export interface LoadedClipOptions {
  /** Where the clip was loaded from; the native shell plays the file itself. */
  readonly url?: string
  readonly startAt?: number
  readonly onTime?: (seconds: number) => void
  readonly onEnded?: () => void
}

/**
 * Start an already-fetched clip on the app's single, gesture-primed element.
 * Chapter playback supplies its own time/ended callbacks; words keep their
 * existing player abstraction above. The caller primes synchronously before
 * awaiting `loadBakedClip`.
 */
export async function playLoadedClip(clip: Blob, options: LoadedClipOptions = {}): Promise<HTMLAudioElement> {
  stopWordAudio()
  const generation = ++audioGeneration
  const current = () => generation === audioGeneration
  const el = audioElement()
  el.ontimeupdate = () => { if (current()) options.onTime?.(el.currentTime) }
  el.onended = () => { if (current()) options.onEnded?.() }
  el.src = clipSource(clip, options.url)
  // Seeking before metadata exists is accepted by Chromium but ignored by
  // WebKit. Wait for the blob's duration once, then seek inside the same
  // user-primed chain.
  if (options.startAt && options.startAt > 0) {
    await new Promise<void>((resolve, reject) => {
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve()
        return
      }
      const timeout = window.setTimeout(() => {
        cleanup()
        reject(new Error('chapter audio metadata timed out'))
      }, 4_000)
      const ready = () => {
        cleanup()
        resolve()
      }
      const failed = () => {
        cleanup()
        reject(new Error('chapter audio metadata did not load'))
      }
      const cleanup = () => {
        window.clearTimeout(timeout)
        el.removeEventListener('loadedmetadata', ready)
        el.removeEventListener('error', failed)
      }
      el.addEventListener('loadedmetadata', ready, { once: true })
      el.addEventListener('error', failed, { once: true })
    })
    if (!current()) throw new Error('chapter audio playback cancelled')
    el.currentTime = options.startAt
  }
  if (!current()) throw new Error('chapter audio playback cancelled')
  wake(el)
  await el.play()
  if (!current()) throw new Error('chapter audio playback cancelled')
  return el
}

/**
 * Words play through Web Audio (wordAudioWeb.ts): each clip decoded once and
 * started on the app's one AudioContext, no media element per word. The
 * default since TestFlight 126 (owner, after the simulator soak A/B: handler
 * per hit 1-2 ms against 8-11, play start 0-1 ms against 3-9, flat over 30
 * minutes). The element pool below is used only with the performance log's
 * "Old word-players" switch on, or where the page has no Web Audio at all.
 */
function webAudioWords(): boolean {
  return !diagSwitch('elementWords') && webWords.available()
}

/**
 * Say a word of the dataset out loud: its baked clip, or a reported failure,
 * or nothing at all if the player has turned sound off. Never rejects.
 * `{ slow: true }` asks for the 0.6 bake instead of the ordinary one; only
 * the dictionary sheet passes it. A noun is said with its article in front
 * («et hus») — `{ article: false }` opts a call site out, and none does.
 */
export function playWord(wordId: string, opts?: { slow?: boolean; article?: boolean }): Promise<PlaybackSource> {
  if (diagSwitch('wordAudio')) return Promise.resolve('silent') // performance log switch
  if (webAudioWords()) return (player.stop(), webWords.playWord(wordId, opts))
  return player.playWord(wordId, opts)
}

/**
 * Ready a set of words before they are tapped — the board when it is dealt,
 * the sheet's word when it opens. Never rejects and never reports; a word
 * that cannot be readied is reported when it is tapped.
 */
export function preloadWordAudio(wordIds: readonly string[], opts?: { slow?: boolean }): Promise<void> {
  if (diagSwitch('wordAudio')) return Promise.resolve() // performance log switch
  if (webAudioWords()) return webWords.preloadWords(wordIds, opts)
  return player.preloadWords(wordIds, opts).catch(() => {})
}

/**
 * Ready recordings that are not words of the course data (the run's
 * connecting words) on warm elements, before they are said. Never rejects.
 * Added for the Sightseeing run: its connecting words used to be handed to the
 * one shared element as a new blob at the moment of the answer, which loaded
 * and decoded the clip inside the run's frame.
 */
export function preloadClipAudio(urls: readonly string[]): Promise<void> {
  if (diagSwitch('wordAudio')) return Promise.resolve() // performance log switch
  if (webAudioWords()) return webWords.preloadClips(urls)
  return player.preloadClips(urls).catch(() => {})
}

/** Say a recording readied by `preloadClipAudio`. Never rejects. */
export function playClipAudio(url: string): Promise<PlaybackSource> {
  if (diagSwitch('wordAudio')) return Promise.resolve('silent') // performance log switch
  if (webAudioWords()) return (player.stop(), webWords.playClip(url))
  return player.playClip(url)
}

/** Ready the example sentences a screen is about to offer. */
export function preloadExampleAudio(wordIds: readonly string[]): Promise<void> {
  return player.preloadExamples(wordIds).catch(() => {})
}

/** Play a word's reviewed Danish example sentence (its one Aoede performance). */
export function playExample(wordId: string, opts?: { slow?: boolean }): Promise<PlaybackSource> {
  return player.playExample(wordId, opts)
}

/** Play an accepted curriculum task line through its versioned Aoede request. */
export function playTask(audioLineId: string): Promise<PlaybackSource> {
  return player.playTask(audioLineId)
}

/** Play a Survival dialogue turn from its versioned Aoede bake. */
export function playSurvivalLine(audioLineId: string): Promise<PlaybackSource> {
  return player.playSurvival(audioLineId)
}

/** Versioned City 1 sentence only; absent bake never borrows an old example. */
export function playCity1Sentence(row: BoardSentence, recordings = CITY1_CATALOG.recordings, opts?: { slow?: boolean }): Promise<PlaybackSource> {
  return player.playCity1Sentence(row, recordings, opts)
}

export function preloadCity1Sentences(rows: readonly BoardSentence[], recordings = CITY1_CATALOG.recordings): Promise<void> {
  return player.preloadCity1Sentences(rows, recordings).catch(() => {})
}

/** One dictionary view owns its requests and their feedback, including pending loads. */
export function createWordAudioScope() {
  let request = 0
  let cancelPlayback = () => {}
  return {
    cancel() {
      request++
      cancelPlayback()
      cancelPlayback = () => {}
    },
    run(start: () => Promise<PlaybackSource>, feedback?: (result: PlaybackSource) => void) {
      const mine = ++request
      const pending = start()
      cancelPlayback = player.cancellation()
      void pending.then(
        result => { if (mine === request) feedback?.(result) },
        () => { if (mine === request) feedback?.('failed') },
      )
    },
  }
}
