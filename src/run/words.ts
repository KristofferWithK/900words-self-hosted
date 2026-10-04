import type { WordEntry } from '../data/types'
import { spokenArticle } from '../data/gender'
import { connectingWordId as cityConnectingWordId } from '../journey/cityWords'
import type { LanguageCode } from '../lang/types'

/**
 * WHAT A RUN ASKS.
 *
 * A city's run words are its board words plus its connecting words (contract
 * §3). The board words come from the course data; the connecting words from
 * their own list (src/data/city1-connecting-words.da.json for Sønderborg),
 * plugged in as a second `RunWordSource` (src/run/sources.ts).
 *
 * Every word carries what the run needs and nothing it does not: the headword
 * to put on a suitcase, the prompt to put on the tag, the KIND of word (wrong
 * answers come from the same kind), the MEANINGS it has (two words that share
 * one are never offered against each other), and how to say it.
 */

/** Which list a word came from. A run reports this with every result. */
export type RunWordOrigin = 'board' | 'connecting'

/**
 * How a word is spoken. `dataset` is a word of the course data, said through
 * the app's word player (src/ui/speak.ts). `clip` is a recording of its own
 * under public/audio/<language>/ (the connecting words: `key` is
 * "connecting/hej" for audio/da/connecting/hej.mp3).
 */
export type RunWordAudio =
  | { readonly kind: 'dataset'; readonly wordId: string }
  | { readonly kind: 'clip'; readonly language: string; readonly key: string }
  | null

export interface RunWord {
  /** Stable id. For board words it is the dataset id ("da:hus"). */
  readonly id: string
  readonly origin: RunWordOrigin
  /** The word in the language being learned, as it stands on a suitcase. */
  readonly target: string
  /** The word in the player's language, as it stands on the tag. */
  readonly prompt: string
  /**
   * The kind of word. Wrong answers come from the same kind, so a verb is never
   * the odd one out among nouns. Board words use their part of speech;
   * connecting words bring their own groups.
   */
  readonly group: string
  /**
   * Every meaning of the word, normalised: the player-language glosses AND the
   * canonical English ones. Two words that share any key could both be right,
   * so they are never offered against each other.
   */
  readonly keys: readonly string[]
  /**
   * The article the app prints and says in front of this noun («et hus»,
   * «die Milch»), for nouns that have one: the Articles walk asks it. Absent
   * for a Danish mass noun, which the app shows with its gender instead
   * (src/data/gender.ts), and for every word that is not a noun.
   */
  readonly article?: string
  readonly audio: RunWordAudio
}

/** One list of run words for a city. */
export interface RunWordSource {
  readonly origin: RunWordOrigin
  words(cityIndex: number): readonly RunWord[]
}

/**
 * A meaning, normalised for comparison: lower case, single spaces, and without
 * a leading English "to/a/an/the" or a trailing bracketed note. The player's
 * own leading articles go too when the language has them. Normalising MORE
 * than needed only ever excludes more wrong answers, which is the safe side.
 */
export function meaningKeys(glosses: readonly string[], playerArticles: RegExp | null = null): string[] {
  const out = new Set<string>()
  for (const raw of glosses) {
    const base = raw.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!base) continue
    const forms = [base, base.replace(/\s*\([^)]*\)\s*/g, ' ').trim()]
    for (const form of forms) {
      let f = form.replace(/^(to|a|an|the) /, '')
      if (playerArticles) f = f.replace(playerArticles, '')
      f = f.trim()
      if (f) out.add(f)
    }
  }
  return [...out]
}

/** How the player's language writes a course word for the run. */
export interface RunWordFormat {
  /** The player's own leading articles, stripped from meanings before they are compared. */
  readonly playerArticles?: RegExp | null
  /** A verb's meaning as it stands on the tag ("to eat" in English). */
  readonly verbPrompt?: (gloss: string) => string
}

/**
 * The run word for one course word. `entry` carries the player-language gloss
 * in its `en` field (the gloss overlay, src/i18n/glosses); `canonical` is the
 * same word's canonical English row when the overlay replaced it.
 */
export function runWordFromEntry(entry: WordEntry, canonical: WordEntry | undefined, format: RunWordFormat = {}): RunWord {
  const glosses = canonical && canonical !== entry ? [...entry.en, ...canonical.en] : entry.en
  const gloss = entry.en[0] ?? entry.da
  return {
    id: entry.id,
    origin: 'board',
    target: entry.da,
    prompt: entry.pos === 'verb' && format.verbPrompt ? format.verbPrompt(gloss) : gloss,
    group: entry.pos,
    keys: meaningKeys(glosses, format.playerArticles ?? null),
    ...articleOf(entry),
    audio: { kind: 'dataset', wordId: entry.id },
  }
}

/** The article the app prints and says in front of a course noun, as a field to spread. */
function articleOf(entry: WordEntry): { article?: string } {
  const article = spokenArticle(entry)
  return article ? { article } : {}
}

/** The board words of a list of course entries, in order. */
export function boardRunWords(
  entries: readonly WordEntry[],
  canonicalById: (id: string) => WordEntry | undefined = () => undefined,
  format: RunWordFormat = {},
): RunWord[] {
  return entries.map((e) => runWordFromEntry(e, canonicalById(e.id), format))
}

/**
 * All the words of a city from every source. A word id that two sources both
 * offer is kept once, from the first source.
 */
export function cityRunWords(sources: readonly RunWordSource[], cityIndex: number): RunWord[] {
  const seen = new Set<string>()
  const out: RunWord[] = []
  for (const source of sources) {
    for (const w of source.words(cityIndex)) {
      if (seen.has(w.id)) continue
      seen.add(w.id)
      out.push(w)
    }
  }
  return out
}

// ── connecting words ────────────────────────────────────────────────────────

/** One meaning of a connecting word: the short form on the tag and every meaning. */
export interface ConnectingMeaning {
  readonly shown: string
  readonly keys: readonly string[]
}

/** One row of a connecting-words list (src/data/city1-connecting-words.da.json). */
export interface ConnectingWordRow {
  readonly da: string
  /** The pool for "same kind of word" wrong answers: greeting, question, little-word. */
  readonly kind: string
  /** English, always there. */
  readonly en: ConnectingMeaning
  /**
   * Other player languages with a meaning, by UI language code: every language
   * with a complete gloss overlay, whose board tags are written in it. A
   * language whose board tags are still English uses `en`.
   */
  readonly de?: ConnectingMeaning
  readonly fr?: ConnectingMeaning
  readonly pl?: ConnectingMeaning
  readonly pt?: ConnectingMeaning
  readonly sv?: ConnectingMeaning
  readonly zh?: ConnectingMeaning
  readonly audio: { readonly key: string }
}

/** A connecting-words list: one language, one city. */
export interface ConnectingWordList {
  readonly language: string
  readonly city: number
  readonly words: readonly ConnectingWordRow[]
}

/** The meaning of a connecting word in `meaningLanguage`, or undefined when the list has none. */
export function connectingMeaning(row: ConnectingWordRow, meaningLanguage: string): ConnectingMeaning | undefined {
  const m = (row as unknown as Record<string, unknown>)[meaningLanguage] as ConnectingMeaning | undefined
  return m && typeof m.shown === 'string' && Array.isArray(m.keys) ? m : undefined
}

/**
 * The stable id of a connecting word, never the id of a course word:
 * "connecting:da:hej", "connecting:da:må". It is the journey's id for the
 * word (journey/cityWords.ts), the one the photo ledger, the marks and the
 * train run name it by: built from the word as written, not from its
 * recording's file name (which spells "må" as "maa"). One source of truth.
 */
export function connectingWordId(language: string, row: Pick<ConnectingWordRow, 'da'>): string {
  return cityConnectingWordId(language as LanguageCode, row.da)
}

/**
 * The run words of a connecting-words list, with their meanings in
 * `meaningLanguage` (the language the player's tags are written in: "en", or
 * "de" for a German player, "zh" for a Chinese one). A list with no meaning
 * in that language for every word gives no words at all: the run never puts
 * a meaning in another language on a player's tag. Sønderborg's list has a
 * meaning in every language a player's tags can be written in (run.test.ts
 * holds it), so this only guards a future list. The English meanings are
 * kept as extra keys, as the board words keep their canonical English, so a
 * wrong answer can never share a meaning in either language.
 */
export function connectingRunWords(
  list: ConnectingWordList,
  meaningLanguage: string,
  format: Pick<RunWordFormat, 'playerArticles'> = {},
): RunWord[] {
  const out: RunWord[] = []
  for (const row of list.words) {
    const meaning = connectingMeaning(row, meaningLanguage)
    if (!meaning) return []
    const glosses = [meaning.shown, ...meaning.keys, row.en.shown, ...row.en.keys]
    out.push({
      id: connectingWordId(list.language, row),
      origin: 'connecting',
      target: row.da,
      prompt: meaning.shown,
      // Connecting words bring their own kinds (greeting, question, little-word),
      // which no board word has: the two lists never stand in for each other.
      group: `connecting:${row.kind}`,
      keys: meaningKeys(glosses, format.playerArticles ?? null),
      audio: { kind: 'clip', language: list.language, key: row.audio.key },
    })
  }
  return out
}
