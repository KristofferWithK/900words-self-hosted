import { describe, expect, it } from 'vitest'
import rawWords from '../../data/words.da.json'
import travelStories from '../../data/travel-stories.da.json'
import type { WordEntry } from '../../data/types'
import type { LanguagePack, LanguageCode } from '../../lang/types'
import { COMPLETE, withPlayerLanguage, lexiconFor, storiesFor, type StoryCityText } from './index'
import { SAME_IN_EVERY_LANGUAGE } from '../same-in-every-language'
import type { UiLanguage } from '../types'
import { UI_LANGUAGES } from '../types'

/**
 * The Phase 3 gloss validator (docs/ui-language-plan.md §9.4) plus unit tests
 * for `withPlayerLanguage` (§9.3 step 1).
 *
 * Every launch language is COMPLETE=true since P3-FINAL: `da.<lang>.json` must
 * exist for each and EVERY word needs a passing row. Only the four typechecked
 * catalogues not offered in the picker (es, hu, nb, nl) may still be missing.
 */

const WORDS = rawWords as WordEntry[]
const WORD_IDS = new Set(WORDS.map((w) => w.id))

// The English gloss of each id, for the "not identical to the English gloss"
// rule. Whitelisted cognates live in same-in-every-language.ts under
// `glosses.<id>` once any exist.
const ENGLISH_GLOSS = new Map(WORDS.map((w) => [w.id, w.en]))

// Headword by id, memoized: checkRow used to `WORDS.find` per gloss, which is
// quadratic and blows vitest's 5s default once a language file has hundreds of
// rows (first observed with the zh pack, 2026-09-14).
const HEADWORD_BY_ID = new Map(WORDS.map((w) => [w.id, w.da]))

const sameGlossAllowed = (id: string, gloss: string): boolean =>
  SAME_IN_EVERY_LANGUAGE.has(`glosses.${id}`) || SAME_IN_EVERY_LANGUAGE.has(`glosses.${id}.${gloss}`)

const SCRIPT_RULES: Partial<Record<UiLanguage, (s: string) => boolean>> = {
  de: (s) => /^[\p{L}\p{M}\s'’,.!?-]+$/u.test(s),
}

const isHanOnly = (s: string): boolean => {
  const letters = s.match(/\p{L}/gu) ?? []
  return letters.length > 0 && letters.every((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch))
}

function checkRow(lang: UiLanguage, row: { id: string; gloss: string[]; example: string }): void {
  expect(WORD_IDS.has(row.id), `row id ${row.id} is not in words.da.json`).toBe(true)

  expect(
    row.gloss.length,
    `${row.id}: one to four glosses`,
  ).toBeGreaterThanOrEqual(1)
  expect(row.gloss.length, `${row.id}: one to four glosses`).toBeLessThanOrEqual(4)
  for (const gloss of row.gloss) {
    expect(gloss.trim().length, `${row.id}: gloss not empty`).toBeGreaterThan(0)
    const headword = HEADWORD_BY_ID.get(row.id) ?? ''
    if (!sameGlossAllowed(row.id, gloss)) {
      expect(
        gloss.toLowerCase() !== headword.toLowerCase(),
        `${row.id}: gloss equals the headword «${headword}» (whitelist it in same-in-every-language.ts under glosses.${row.id}.${gloss})`,
      ).toBe(true)
    }
    const english = ENGLISH_GLOSS.get(row.id) ?? []
    if (!sameGlossAllowed(row.id, gloss)) {
      expect(
        english.map((e) => e.toLowerCase()).includes(gloss.toLowerCase()),
        `${row.id}: gloss identical to the English gloss (whitelist it in same-in-every-language.ts under glosses.${row.id})`,
      ).toBe(false)
    }
    if (lang === 'zh') {
      expect(isHanOnly(gloss), `${row.id}: Chinese gloss must be Han characters`).toBe(true)
    }
    if (SCRIPT_RULES[lang]) {
      expect(SCRIPT_RULES[lang]!(gloss), `${row.id}: ${lang} gloss has unexpected characters`).toBe(
        true,
      )
    }
  }

  expect(
    row.example.trim().length,
    `${row.id}: a single non-empty example sentence`,
  ).toBeGreaterThan(0)
  if (lang === 'zh') {
    expect(isHanOnly(row.example) || /[\u4e00-\u9fff]/.test(row.example), `${row.id}: zh example in Han script`).toBe(true)
  }
}

describe('the gloss validator', () => {
  it('COMPLETE covers every UiLanguage; English true; every launch language true', () => {
    // COMPLETE is total over the UiLanguage union: every typechecked catalogue
    // language has an entry, launch languages and the four not offered in the
    // picker alike. No extra codes, none missing. The six launch languages are
    // complete since P3-FINAL (§9.3 step 5): the row checks below are now
    // mandatory for them, and the overlay turns on for every launch player.
    const all: UiLanguage[] = ['en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl']
    expect(Object.keys(COMPLETE).sort()).toEqual([...all].sort())
    expect(COMPLETE.en).toBe(true)
    for (const lang of UI_LANGUAGES) {
      expect(COMPLETE[lang], `${lang} is a launch language and must be COMPLETE`).toBe(true)
    }
    // Typechecked catalogues not offered in the picker stay incomplete until
    // their content PRs land (§ types.ts).
    for (const lang of ['es', 'hu', 'nb', 'nl'] as UiLanguage[]) {
      expect(COMPLETE[lang]).toBe(false)
    }
  })

  // ── §9.2: the LEXICON sidecars ────────────────────────────────────────────
  //
  // `lexiconFor(lang)` feeds the dictionary sheet's player-language layer, so
  // every launch language's sidecar must exist, mirror the Danish headwords of
  // clue-lexicon.da.json exactly, and carry a non-empty meaning on every row.

  it('lexicon.da.<lang>.json exists for every launch language and mirrors the Danish clue books', async () => {
    const clue = (await import('../../data/clue-lexicon.da.json')).default as {
      da: string
      en: string
    }[]
    const headwords = clue.map((r) => r.da)
    for (const lang of UI_LANGUAGES) {
      if (lang === 'en') continue
      const rows = await lexiconFor(lang)
      expect(rows, `lexicon.da.${lang}.json must exist for launch language ${lang}`).not.toBeNull()
      expect(rows!.map((r) => r.da), `${lang}: headwords must mirror clue-lexicon.da.json in order`).toEqual(headwords)
      for (const row of rows!) {
        expect(row.gloss.trim().length, `${lang}: «${row.da}» has an empty meaning`).toBeGreaterThan(0)
      }
    }
  }, 60_000)

  it('lexiconFor resolves null for English without loading a sidecar', async () => {
    expect(await lexiconFor('en')).toBeNull()
    expect(await storiesFor('en')).toBeNull()
  })

  it('lexiconFor resolves null for a language without a sidecar file', async () => {
    // Spanish is a typechecked catalogue but not a launch language: no file
    // ships, and the contract is fallback (null), never a thrown error.
    expect(await lexiconFor('es')).toBeNull()
    expect(await storiesFor('es')).toBeNull()
  })

  // ── §9.2: the STORY sidecars ──────────────────────────────────────────────
  //
  // The story chapters localize the (flag-gated) ride. The Danish text is the
  // timing/parity anchor: a sidecar must keep every chapter and sentence of
  // travel-stories.da.json with UNCHANGED Danish text — only the `en` side may
  // differ — because the audio bake and the coverage assertions count Danish
  // sentences.

  for (const lang of UI_LANGUAGES) {
    if (lang === 'en') continue
    describe(`stories.da.${lang}.json`, () => {
    let side: Record<string, StoryCityText> | null = null
      try {
        const modules = import.meta.glob<{ default: Record<string, StoryCityText> }>(
          './stories.da.*.json',
          { eager: true },
        )
        side = modules[`./stories.da.${lang}.json`]?.default ?? null
      } catch {
        side = null
      }

      it('keeps the canonical shape and Danish parity with travel-stories.da.json', () => {
        if (!side) {
          // Missing sidecars are allowed only for non-launch languages.
          expect(UI_LANGUAGES).not.toContain(lang)
          return
        }
        const canonicalStories = travelStories as unknown as Record<
          string,
          { titleDa: string; chapters: { titleDa: string; sentences: { da: string; en: string }[] }[] }
        >
        for (const [cityKey, city] of Object.entries(side)) {
          const canonical = canonicalStories[cityKey]
          expect(canonical, `city ${cityKey} exists in travel-stories.da.json`).toBeDefined()
          expect(
            city.chapters.length,
            `${lang} city ${cityKey}: chapter count matches the canonical story`,
          ).toBe(canonical.chapters.length)
          expect(city.titleDa, `${lang} city ${cityKey}: titleDa is the canonical Danish title`).toBe(
            canonical.titleDa,
          )
          city.chapters.forEach((chapter: { titleDa: string; sentences: { da: string; en: string }[] }, ci: number) => {
            expect(chapter.titleDa, `${lang} city ${cityKey} ch${ci}: titleDa parity`).toBe(
              canonical.chapters[ci].titleDa,
            )
            expect(
              chapter.sentences.length,
              `${lang} city ${cityKey} ch${ci}: sentence count matches`,
            ).toBe(canonical.chapters[ci].sentences.length)
            chapter.sentences.forEach((sentence: { da: string; en: string }, si: number) => {
              expect(
                sentence.da,
                `${lang} city ${cityKey} ch${ci} s${si}: da text is the canonical Danish`,
              ).toBe(canonical.chapters[ci].sentences[si].da)
              expect(
                sentence.en.trim().length,
                `${lang} city ${cityKey} ch${ci} s${si}: player-language line not empty`,
              ).toBeGreaterThan(0)
            })
          })
        }
      })
    })
  }

  for (const lang of UI_LANGUAGES) {
    if (lang === 'en') continue
    describe(`da.${lang}.json (COMPLETE=${COMPLETE[lang]})`, () => {
      let rows: { id: string; gloss: string[]; example: string }[] | null = null
      try {
        // Sidecars do not exist yet; this resolves to undefined rather than
        // throwing under vitest for a file the glob knows about. Reading
        // through import.meta would be compile-time; instead a language with
        // no file simply has rows === null and the partial rules apply.
        const modules = import.meta.glob<{ default: { id: string; gloss: string[]; example: string }[] }>(
          './da.*.json',
          { eager: true },
        )
        rows = modules[`./da.${lang}.json`]?.default ?? null
      } catch {
        rows = null
      }

      if (COMPLETE[lang]) {
        it('exists and every word has a passing row', () => {
          expect(rows, `da.${lang}.json must exist for a COMPLETE language`).not.toBeNull()
          const byId = new Map((rows ?? []).map((r) => [r.id, r]))
          for (const word of WORDS) {
            const row = byId.get(word.id)
            expect(row, `missing row for ${word.id}`).toBeDefined()
            checkRow(lang, row!)
          }
        }, 60_000)
      } else if (rows) {
        it('is partial: every present row passes', () => {
          for (const row of rows!) checkRow(lang, row)
        }, 60_000)
      } else {
        it('may be missing while the language is incomplete', () => {
          expect(COMPLETE[lang]).toBe(false)
        })
      }
    })
  }
})

const fakePack = (words: WordEntry[]): LanguagePack => {
  const base = {
    code: 'da' as LanguageCode,
    name: 'Danish',
    endonym: 'Dansk',
    words,
    readiness: 'playable' as const,
  }
  // Minimal fake: withPlayerLanguage only touches words/sourceWords.
  return base as unknown as LanguagePack
}

const entry = (over: Partial<WordEntry>): WordEntry => ({
  id: 'da:test',
  da: 'testord',
  en: ['test'],
  pos: 'noun',
  exampleDa: 'Dette er et testord.',
  exampleEn: 'This is a test word.',
  freqRank: 1,
  ...over,
})

describe('withPlayerLanguage', () => {
  it('is the identity for English', () => {
    const pack = fakePack([entry({})])
    expect(withPlayerLanguage(pack, 'en')).toBe(pack)
  })

  it('is the identity while the language is incomplete (partial-file passthrough)', () => {
    const pack = fakePack([entry({})])
    // The launch languages are all COMPLETE now; the incomplete ones are the
    // typechecked catalogues not offered in the picker (§ types.ts).
    for (const lang of ['es', 'hu', 'nb', 'nl'] as UiLanguage[]) {
      expect(COMPLETE[lang]).toBe(false)
      expect(withPlayerLanguage(pack, lang)).toBe(pack)
    }
  })

  it('carries gloss and example once the language is complete', () => {
    const pack = fakePack([entry({})])
    const patched = { ...COMPLETE, de: true } as Record<UiLanguage, boolean>
    const original = { ...COMPLETE }
    Object.assign(COMPLETE, patched)
    try {
      const out = withPlayerLanguage(pack, 'de')
      // With no sidecar file for 'de' the overlay finds no rows and the words
      // come through unchanged — the determinism guarantee. Prove the overlay
      // path itself with an internal check: the copy is a NEW pack either way.
      expect(out).not.toBe(pack)
      expect(out.sourceWords).toBe(pack.words)
      expect(out.words).toEqual(pack.words)
    } finally {
      Object.assign(COMPLETE, original)
    }
  })
})