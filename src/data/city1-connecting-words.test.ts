import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DANISH_LEDGER_FORMS } from '../lang/da/curriculum-support'
import upgrade from './city1-review-upgrade.da.json'
import audioLead from './audio-lead.da.json'
import list from './city1-connecting-words.da.json'
import { COMPLETE } from '../i18n/glosses'
import type { UiLanguage } from '../i18n/types'

/** The languages card CW-14c added meanings in (English and German were there before). */
const ADDED = ['fr', 'pl', 'pt', 'sv', 'zh'] as const
/** The clue-lexicon sidecar of a player language: Danish headword and its meaning. */
function lexiconOf(lang: string): Map<string, string> {
  const rows = JSON.parse(readFileSync(new URL(`../i18n/glosses/lexicon.da.${lang}.json`, import.meta.url), 'utf8')) as {
    da: string
    gloss: string
  }[]
  return new Map(rows.map((r) => [r.da, r.gloss]))
}

// Sønderborg's connecting words (docs/roadmap/cafe-world.md section 3) and
// their recordings under public/audio/da/connecting/.
const AUDIO_DIR = new URL('../../public/audio/da/connecting/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', AUDIO_DIR), 'utf8')) as {
  entries: Record<string, { id: string; text: string; bytes: number; sha256: string }>
}
const words = list.words
/** The build script's slug rule; speak.test.ts holds it equal to the app's. */
async function audioSlug(word: string): Promise<string> {
  // Not a literal specifier, so tsc leaves the untyped .mjs alone.
  const href = new URL('../../scripts/audio-slug.mjs', import.meta.url).href
  const mod = (await import(/* @vite-ignore */ href)) as { audioSlug: (s: string, lang: string) => string }
  return mod.audioSlug(word, 'da')
}

/** The ledger forms first staged at city 0 (Sønderborg), and how. */
const city0 = DANISH_LEDGER_FORMS.filter((form) => form.stages[0]!.city === 0)
const taught = city0.filter((form) => form.stages[0]!.use !== 'receptive-ambient').map((form) => form.term)
/** Staged at city 0 as receptive-ambient: heard, not taught. The owner added these on 2026-10-04. */
const heard = city0.filter((form) => form.stages[0]!.use === 'receptive-ambient').map((form) => form.term)
const reviewTargets = [...new Set(upgrade.review.map((row) => row.targetSpan.text.toLowerCase()))]
/** The literal rule: every city-0 ledger form, taught or heard, and every review target, without okay. */
const literal = new Set([...city0.map((form) => form.term).filter((term) => term !== 'okay'), ...reviewTargets])

describe("Sønderborg's connecting words", () => {
  it('are as many unique words as the sources give, and the count says so (47)', () => {
    expect(words).toHaveLength(literal.size)
    expect(list.count).toBe(words.length)
    expect(new Set(words.map((w) => w.da)).size).toBe(words.length)
    // The one pinned number: docs/roadmap/cafe-world.md section 3 says 47 (and 147 with the 100 cards).
    expect(literal.size).toBe(47)
  })

  it('are exactly the city-0 ledger forms (taught or heard) and the review targets, without okay', () => {
    expect([...literal].sort()).toEqual(words.map((w) => w.da).sort())
    for (const w of words) {
      expect(w.from.includes('ledger-city0'), w.da).toBe(taught.includes(w.da))
      expect(w.from.includes('ledger-city0-heard'), w.da).toBe(heard.includes(w.da))
      expect(w.from.includes('review-target'), w.da).toBe(reviewTargets.includes(w.da))
    }
  })

  it('include the forms the ledger stages at city 0 as heard, not taught, as the owner added them on 2026-10-04', () => {
    expect([...heard].sort()).toEqual(['hen', 'om', 'skål'])
    for (const da of heard) {
      const w = words.find((x) => x.da === da)!
      expect(w.ledger, da).toEqual({ firstCity: 0, use: 'receptive-ambient', functionIds: city0.find((f) => f.term === da)!.stages[0]!.functionIds })
      expect(w.addedBy?.by, da).toBe('owner')
      expect(w.addedBy?.date, da).toBe('2026-10-04')
      expect(w.meaning.needsDanishReview, da).toBe(true)
      expect(w.de.needsOwnerReview, da).toBe(true)
    }
    // The first 44 carry neither field: they were in the list from the start.
    expect(words.filter((w) => 'addedBy' in w).map((w) => w.da).sort()).toEqual(['hen', 'om', 'skål'])
  })

  it('carry the accepted review meaning wherever the review file has one', () => {
    const about = new Map(upgrade.about.map((a) => [a.targetId, a.meaningEn]))
    const targetOf = new Map(upgrade.review.map((row) => [row.targetSpan.text.toLowerCase(), row.targetId]))
    for (const w of words) {
      const meaning = about.get(targetOf.get(w.da) ?? '')
      if (meaning) {
        expect(w.meaning.source, w.da).toBe('city1-review-upgrade')
        expect(w.meaning.sourceText, w.da).toBe(meaning)
        expect(w.meaning.needsDanishReview, w.da).toBe(false)
      } else {
        expect(w.meaning.source, w.da).toBe('cafe-world-prototype')
        expect(w.meaning.needsDanishReview, w.da).toBe(true)
      }
    }
    expect(words.filter((w) => w.meaning.source === 'city1-review-upgrade')).toHaveLength(20)
  })

  it('show one English and one German meaning that are among their keys', () => {
    for (const w of words) {
      expect(w.en.shown, w.da).toMatch(/\S/)
      expect(w.en.keys, w.da).toContain(w.en.shown.toLowerCase())
      expect(w.de.shown, w.da).toMatch(/\S/)
      expect(w.de.keys, w.da).toContain(w.de.shown)
      expect(['greeting', 'question', 'little-word'], w.da).toContain(w.kind)
    }
  })

  it("have a meaning in every language a player's tags are written in, each marked for a reader", () => {
    // English, and every UI language whose gloss overlay is complete (its board tags are in it).
    const tagLanguages = (Object.keys(COMPLETE) as UiLanguage[]).filter((lang) => COMPLETE[lang]).sort()
    expect(tagLanguages).toEqual(['de', 'en', 'fr', 'pl', 'pt', 'sv', 'zh'])
    expect([...ADDED, 'en', 'de'].sort()).toEqual(tagLanguages)
    const rows = words as unknown as Record<string, unknown>[]
    for (const lang of ADDED) {
      const lexicon = lexiconOf(lang)
      for (const row of rows) {
        const at = `${row.da as string} ${lang}`
        const m = row[lang] as { shown: string; keys: string[]; source: string; lexicon?: string; needsOwnerReview: boolean }
        expect(m, at).toBeDefined()
        expect(m.shown, at).toMatch(/\S/)
        expect(m.keys, at).toContain(m.shown)
        expect(new Set(m.keys).size, at).toBe(m.keys.length)
        expect(m.needsOwnerReview, at).toBe(true)
        // Taken from the lexicon only where the lexicon says exactly that; otherwise written for this list.
        if (m.source === `lexicon.da.${lang}.json`) expect(lexicon.get(row.da as string), at).toBe(m.shown)
        else expect(m.source, at).toBe('cw-14c')
        if (m.lexicon !== undefined) expect(lexicon.get(row.da as string), at).toBe(m.lexicon)
      }
    }
    // No other language has meanings: its board tags, and so its connecting tags, are English.
    for (const lang of ['es', 'hu', 'nb', 'nl']) expect(rows.some((row) => lang in row), lang).toBe(false)
  })

  it('never offer two words that share a meaning unless their keys say so', () => {
    // en/et show "a" and den/det show "it": the shared key is what keeps them apart.
    const shown = new Map<string, string[]>()
    for (const w of words) shown.set(w.en.shown, [...(shown.get(w.en.shown) ?? []), w.da])
    for (const [, same] of shown) {
      if (same.length < 2) continue
      const [a, b] = same.map((da) => words.find((w) => w.da === da)!)
      expect(a!.en.keys.some((k) => b!.en.keys.includes(k)), same.join('/')).toBe(true)
    }
    // The same in every other language: two words that show the same tag share a key in it
    // (French en/et both "un", Chinese nej/ikke both "不", Swedish hvor/var both "var").
    const rows = words as unknown as Record<string, { shown: string; keys: string[] }>[]
    for (const lang of ['de', ...ADDED]) {
      const byShown = new Map<string, Record<string, { shown: string; keys: string[] }>[]>()
      for (const row of rows) byShown.set(row[lang]!.shown, [...(byShown.get(row[lang]!.shown) ?? []), row])
      for (const [tag, same] of byShown) {
        for (const a of same) for (const b of same) {
          expect(a[lang]!.keys.some((k) => b[lang]!.keys.includes(k)), `${lang} ${tag}`).toBe(true)
        }
      }
    }
  })

  it('every word has its recording, under the app slug rule, with a manifest row and an onset', async () => {
    const keys = new Set<string>()
    for (const w of words) {
      const slug = await audioSlug(w.da)
      expect(w.audio.key, w.da).toBe(`connecting/${slug}`)
      keys.add(w.audio.key)
      const file = new URL(`${slug}.mp3`, AUDIO_DIR)
      expect(existsSync(file), `${w.da}: ${slug}.mp3`).toBe(true)
      const bytes = readFileSync(file)
      const row = manifest.entries[slug]!
      expect(row.id, w.da).toBe(`connecting:da:${w.da}`)
      expect(row.text, w.da).toBe(w.audio.spoken)
      expect(row.bytes, w.da).toBe(bytes.length)
      expect(row.sha256, w.da).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect((audioLead.entries as Record<string, number>)[`${w.audio.key}.mp3`], w.da).toBeGreaterThan(0)
    }
    expect(keys.size).toBe(words.length)
    expect(Object.keys(manifest.entries)).toHaveLength(words.length)
  })
})
