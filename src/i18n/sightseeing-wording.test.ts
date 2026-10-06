import { describe, expect, it } from 'vitest'
import { CATALOGUES, UI_LANGUAGES } from '.'
import type { UiLanguage } from './types'

/**
 * SIGHTSEEING, NOT WALKING (owner, 2026-10-04: "yes, rename all walk wording
 * to sightseeing"). The running game is Sightseeing in every player-facing
 * line: the run's own panels, the daily limit, Your plan, Casey's lines and
 * the onboarding. This reads every line of the player-pickable catalogues for
 * the walking words each one used before, so none creeps back.
 *
 * The game's name is "Sightseeing" in every language, untranslated: a brand
 * (owner, 2026-10-04: "Sightseeing is a very universal word, and since it's
 * a brand thing it should stay consistent"). The names the catalogues used
 * before (Stadtbummel, Stadsvandring, Visite de la ville, ...) must not come
 * back. The allowlist names every line that keeps a walking word for another
 * meaning, and says why.
 * Code identifiers (wordsWalk, walkEndFound, ...) are not player-facing.
 */
const WALK_WORDS: Partial<Record<UiLanguage, RegExp>> = {
  en: /\bwalk(s|ed|ing)?\b/i,
  de: /\b(Spaziergang\w*|spazieren\w*|Lauf|Läufe|laufen|läufst|Loslaufen|Weiterlaufen)\b/i,
  fr: /\b(balades?|promenades?|marcher|marches)\b/i,
  pl: /(?<!\p{L})(spacer\p{L}*|przejdź się|przejść się|chodzisz|chodzić|idź dalej)(?!\p{L})/iu,
  pt: /\b(andar|anda|andas|caminhar|caminhada\w*)\b/i,
  sv: /(promenad|promenera|\bbörja gå\b|\bfortsätt gå\b|\bgå igen\b)/i,
  zh: /(散步|再走|开始走|继续走|边走)/,
}

/** Lines that keep a matching word for another meaning. */
const ALLOWED: Record<string, string> = {
  // German "Lauf" / "laufen" is a RUN (English "run"): the train run, and the end of a run.
  'de:home.trainSheetRule': 'the train run ("Der Lauf ist der einzige Weg in den Zug")',
  'de:sightseeing.rules': 'the run ends ("beendet den Lauf"), English "ends the run"',
  'de:sightseeing.trainRule': 'the train run ends, English "ends the run"',
  'de:sightseeing.trainStart': 'run for the train',
  'de:sightseeing.trainAgain': 'run (for the train) again',
  'de:sightseeing.sheetCatchLine': 'words to run on the train run',
}

type Tree = Record<string, unknown>

/** Every line of a catalogue: strings as they are, functions called with a few plain values. */
function lines(tree: Tree, prefix = ''): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.push({ path, text: value })
    else if (typeof value === 'function') {
      for (const arg of [1, 2, 'x']) {
        try {
          const said = (value as (...a: unknown[]) => unknown)(...Array.from({ length: Math.max(1, value.length) }, () => arg))
          if (typeof said === 'string') out.push({ path, text: said })
        } catch {
          // A line that needs other values says nothing here.
        }
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...lines(value as Tree, path))
    else if (Array.isArray(value)) value.forEach((v, i) => typeof v === 'string' && out.push({ path: `${path}.${i}`, text: v }))
  }
  return out
}

describe('the running game says sightseeing, not walking', () => {
  it.each(Object.keys(WALK_WORDS) as UiLanguage[])('%s: no walking words left outside the allowlist', (code) => {
    const words = WALK_WORDS[code]!
    const found = lines(CATALOGUES[code] as unknown as Tree)
      .filter(({ path, text }) => words.test(text) && !ALLOWED[`${code}:${path}`])
      .map(({ path, text }) => `${path}: ${text}`)
    expect([...new Set(found)]).toEqual([])
  })

  it('every allowlisted line still exists and still has its word: a stale entry is removed, not kept', () => {
    for (const key of Object.keys(ALLOWED)) {
      const [code, path] = key.split(':') as [UiLanguage, string]
      const hits = lines(CATALOGUES[code] as unknown as Tree).filter((l) => l.path === path && WALK_WORDS[code]!.test(l.text))
      expect(hits.length, key).toBeGreaterThan(0)
    }
  })

  it('the check can fail: the old English lines are caught', () => {
    expect(WALK_WORDS.en!.test('You’ve walked twice today.')).toBe(true)
    expect(WALK_WORDS.en!.test('Keep walking')).toBe(true)
    expect(WALK_WORDS.sv!.test('Två promenader')).toBe(true)
    expect(WALK_WORDS.zh!.test('你今天已经散步两次了。')).toBe(true)
  })
})

/** The names each catalogue gave the game before it became "Sightseeing" everywhere. */
const OLD_NAMES: Partial<Record<UiLanguage, RegExp>> = {
  de: /stadtbummel|bummel/i,
  fr: /visite de la ville|visites?|balades?/i,
  pl: /zwiedza/i,
  pt: /passeio/i,
  sv: /stadsvandring/i,
  zh: /观光/,
  es: /turismo|visitas? turísticas?/i,
  hu: /városnéz|nézelőd/i,
  nb: /byvandring/i,
  nl: /stadswandeling/i,
}

describe('"Sightseeing" is the game’s name in every language', () => {
  const codes = Object.keys(CATALOGUES) as UiLanguage[]

  it.each(codes)('%s: Home’s tag, the chooser and the run screen say "Sightseeing"; its buttons name it', (code) => {
    const t = CATALOGUES[code].sightseeing
    // Home's tag, the chooser sheet's title and the run screen's name all read `title`.
    expect(t.title).toBe('Sightseeing')
    for (const key of ['start', 'sightseeingAgain', 'resume'] as const) expect(t[key], `${code} ${key}`).toMatch(/sightseeing/i)
  })

  it.each(codes.filter((c) => OLD_NAMES[c]))('%s: the old localized name is gone from every line', (code) => {
    const old = OLD_NAMES[code]!
    const found = lines(CATALOGUES[code] as unknown as Tree)
      .filter(({ text }) => old.test(text))
      .map(({ path, text }) => `${path}: ${text}`)
    expect([...new Set(found)]).toEqual([])
  })

  it('every player-pickable language is checked', () => {
    for (const code of UI_LANGUAGES) if (code !== 'en') expect(OLD_NAMES[code], code).toBeDefined()
    // And the check can fail: the old names are caught.
    expect(OLD_NAMES.de!.test('Du warst heute schon zweimal auf Stadtbummel.')).toBe(true)
    expect(OLD_NAMES.sv!.test('Stadsvandring')).toBe(true)
  })
})
