import type { UiLanguage } from '../types'
import type { LanguagePack } from '../../lang/types'
import type { WordEntry } from '../../data/types'

/**
 * The compiled runtime overlay for WORD MEANINGS and EXAMPLE TRANSLATIONS
 * (docs/ui-language-plan.md §9.2/§9.3). Phase 2 proved the pattern for the
 * Guide's teaching copy (`src/i18n/learning/index.ts`); this is the same idea
 * applied at the point where the dataset is built.
 *
 * A language whose sidecar files under `src/i18n/glosses/` are complete plays
 * with glosses in its own language; a language that is still being translated
 * keeps the English source. Field names never move (UL5): a `WordEntry` keeps
 * its `en`/`exampleEn` names and the CONTENT becomes the player's language.
 *
 * ── IMPORT-CYCLE GUARD ─────────────────────────────────────────────────────
 *
 * `src/lang/active.ts` runs at MODULE SCOPE (see the warning there) and the
 * dataset is indexed at module scope too. This module must therefore never
 * import anything that reaches `src/data/words.ts` — or any module that
 * imports the dataset — or the graph closes back on itself. It imports types
 * only.
 */

/**
 * Whether `src/i18n/glosses/da.<lang>.json` is complete for this language and
 * the overlay may turn on. English is the source of truth and is always
 * complete. Every launch language is false until its content PRs land (§9.5):
 * while false, the file may be missing or partial and `withPlayerLanguage`
 * leaves the pack alone, so the app today is byte-identical to English.
 */
export const COMPLETE: Record<UiLanguage, boolean> = {
  en: true,
  de: true,
  sv: true,
  pl: true,
  pt: true,
  zh: true,
  fr: true,
  // Typechecked catalogues not offered in the picker at launch (§ types.ts):
  // not launch languages, so they are incomplete too until their content lands.
  es: false,
  hu: false,
  nb: false,
  nl: false,
}

type GlossRow = { id: string; gloss: string[]; example: string }

/**
 * Read a sidecar file for a language. Returns null when it does not exist.
 * This glob MUST stay `eager`: `withPlayerLanguage` runs at module scope in
 * `src/lang/active.ts` (see the import-cycle guard above), so the gloss rows
 * cannot become async without restructuring the whole dataset bootstrap. The
 * main bundle's size is governed by what ELSE rides in it — see
 * scripts/validate-release-package.mjs and the workbox gate in
 * vite.config.ts. Missing file is a missing entry, not a build error — the
 * content PRs add the files.
 */
function rowsFor(lang: UiLanguage): readonly GlossRow[] {
  const modules = import.meta.glob<{ default: GlossRow[] }>('./da.*.json', {
    eager: true,
  })
  const hit = modules[`./da.${lang}.json`]
  return hit ? hit.default : []
}

/**
 * THE ACTIVE PACK, OVERLAID.
 *
 * Returns the pack unchanged when the player's language is English or not yet
 * complete — the identity is load-bearing, because with COMPLETE all-false
 * every consumer sees exactly the canonical list it saw before this module
 * existed. Otherwise a copy whose `words` carry the player-language gloss in
 * the `en` field and the player-language example translation in `exampleEn`
 * (UL5: names never move), with the canonical English list still reachable as
 * `sourceWords` for the callers named in §9.3 step 2.
 */
export function withPlayerLanguage(pack: LanguagePack, lang: UiLanguage): LanguagePack {
  if (lang === 'en' || !COMPLETE[lang]) return pack

  const byId = new Map(rowsFor(lang).map((row) => [row.id, row]))
  const words: WordEntry[] = pack.words.map((word) => {
    const row = byId.get(word.id)
    if (!row) return word
    const gloss = row.gloss.filter((g) => g.trim() !== '')
    const example = row.example.trim()
    if (gloss.length === 0 && example === '') return word
    return {
      ...word,
      ...(gloss.length > 0 ? { en: gloss } : {}),
      ...(example !== '' ? { exampleEn: example } : {}),
    }
  })
  return { ...pack, words, sourceWords: pack.words }
}

// ── §9.2: THE OTHER TWO EXPORTS — LEXICON AND STORIES ───────────────────────
//
// `src/data/lookup.ts` and `src/journey/travelStory.ts` read their Danish
// sources directly; these two resolvers hand them the PLAYER-language
// sidecars instead, so a German player's dictionary sheet and (flag-gated)
// ride speak German. Both are LAZY: each sidecar becomes its own async chunk
// (~125-140 KB), loaded only when the player's language is not English and
// the surface is first used. English resolves to null without importing
// anything — English IS the source the consumers already read.

/** One lexicon row: the Danish headword and its player-language meaning. */
export interface LexiconEntry {
  da: string
  gloss: string
}

export type LexiconEntries = readonly LexiconEntry[]

/**
 * The clue-lexicon sidecar for one player language, or null when the player
 * language is English (the consumers' built-in Danish/English source is the
 * right answer) or the sidecar is missing (incomplete language: fall back,
 * never fail). Resolves through Vite's lazy glob — `src/data/clue-lexicon.da
 * .json` keeps its own code-split chunk exactly as before.
 */
export async function lexiconFor(lang: UiLanguage): Promise<LexiconEntries | null> {
  if (lang === 'en') return null
  const modules = import.meta.glob<{ default: LexiconEntry[] }>('./lexicon.da.*.json')
  const hit = modules[`./lexicon.da.${lang}.json`]
  if (!hit) return null
  try {
    return (await hit()).default
  } catch {
    return null
  }
}

/** One localized story chapter, in the §9.2 canonical shape. */
export interface StoryChapterText {
  titleDa: string
  titleEn: string
  sentences: { da: string; en: string }[]
}

/** One localized story city: the canonical TravelStory minus its cityIndex. */
export interface StoryCityText {
  titleDa: string
  titleEn: string
  chapters: StoryChapterText[]
}

/**
 * The travel-story sidecar for one player language, or null under the same
 * rules as `lexiconFor`. The sidecars carry the canonical shape
 * (`titleDa`/`titleEn`, `da`/`en` sentences) — the fr and zh sidecars were
 * normalized into it when they landed, so the runtime type never lies and
 * the shape debate stays out of the consumers.
 */
export async function storiesFor(lang: UiLanguage): Promise<Record<string, StoryCityText> | null> {
  if (lang === 'en') return null
  const modules = import.meta.glob<{ default: Record<string, StoryCityText> }>('./stories.da.*.json')
  const hit = modules[`./stories.da.${lang}.json`]
  if (!hit) return null
  try {
    return (await hit()).default
  } catch {
    return null
  }
}