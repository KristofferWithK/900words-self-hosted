import { ACTIVE } from '../lang/active'
import { normalize } from '../engine/text'
import { UI_LANGUAGE } from '../i18n/active'
import { lexiconFor } from '../i18n/glosses/index'

/** The active language's stemmer, so 'hunden' still finds 'hund'. */
const stem = ACTIVE.morphology.stem
import type { WordEntry } from './types'
import { WORDS } from './words'

/**
 * Two-way lookup over the shipped dataset.
 *
 * The dictionary sheet answers "what does this board word mean?". This answers
 * the other question, the one a player composing a Danish clue actually has:
 * "what is the Danish for X?" — and the reverse, when Casey clues in Danish and
 * the word is new.
 *
 * Local first, always: nine hundred words cover every board word and everything
 * the player is being taught, it is instant, it costs nothing, and it works on
 * a train. Anything outside it goes to Casey, but only when asked.
 */
export interface LocalMatch {
  entry: WordEntry
  /** Which side of the entry the term matched — decides how to read it back. */
  /**
   * 'target' rather than 'da': the side matched is the language being learned,
   * and it is not always Danish.
   */
  matched: 'target' | 'en'
  /** An inflection or a near form rather than the citation form. */
  approximate: boolean
}

/** A deliberately minimal entry derived from Casey's private clue books. */
export interface AuthoredClueEntry {
  da: string
  en: string
}

export interface AuthoredClueMatch {
  entry: AuthoredClueEntry
  matched: 'target' | 'en'
  approximate: boolean
}

const normalizeGloss = (g: string): string => normalize(g).replace(/^(to|a|an|the) /, '')

const byDa = new Map<string, WordEntry>()
const byStem = new Map<string, WordEntry[]>()
const byGloss = new Map<string, WordEntry[]>()

for (const w of WORDS) {
  byDa.set(normalize(w.da), w)
  const s = stem(w.da)
  const stems = byStem.get(s)
  if (stems) stems.push(w)
  else byStem.set(s, [w])
  for (const g of w.en) {
    const key = normalizeGloss(g)
    const list = byGloss.get(key)
    if (list) list.push(w)
    else byGloss.set(key, [w])
  }
}

/**
 * Everything the dataset knows about a term, best match first. Empty when the
 * word is outside the nine hundred — which is when Casey is worth asking.
 */
export function lookupLocal(term: string): LocalMatch[] {
  const t = normalizeGloss(term)
  if (!t) return []

  const exactDa = byDa.get(normalize(term))
  if (exactDa) return [{ entry: exactDa, matched: 'target', approximate: false }]

  const glossHits = byGloss.get(t)
  if (glossHits?.length) {
    return glossHits.map((entry) => ({ entry, matched: 'en' as const, approximate: false }))
  }

  // "hunden" should still find "hund"; the packing grader is strict, a
  // dictionary need not be.
  const stemHits = byStem.get(stem(term))
  if (stemHits?.length) {
    return stemHits.map((entry) => ({ entry, matched: 'target' as const, approximate: true }))
  }
  return []
}

/**
 * The L1 layer is deliberately separate from the course's synchronous lookup:
 * importing it creates a code-split chunk, and its `{da,en}` rows cannot open
 * the books, matrices, scores or explanations that produced them.
 */
let authoredIndex: Promise<{
  byDa: Map<string, AuthoredClueEntry>
  byStem: Map<string, AuthoredClueEntry[]>
  byGloss: Map<string, AuthoredClueEntry[]>
}> | null = null

/**
 * When the player's language has a clue-lexicon sidecar (plan §9.2), its rows
 * ride the SAME index shape: the Danish headword keys are shared, the gloss
 * keys become the player-language meaning. The player-language rows are
 * searched FIRST once loaded — a German player typing a German term should
 * find it in the German layer, not only through the English gloss — while
 * the Danish/English source stays underneath as the authoritative fallback.
 */
let playerIndex: Promise<{
  byDa: Map<string, AuthoredClueEntry>
  byStem: Map<string, AuthoredClueEntry[]>
  byGloss: Map<string, AuthoredClueEntry[]>
} | null> | null = null

function indexEntries(entries: readonly AuthoredClueEntry[]) {
  const byDa = new Map<string, AuthoredClueEntry>()
  const byStem = new Map<string, AuthoredClueEntry[]>()
  const byGloss = new Map<string, AuthoredClueEntry[]>()
  for (const entry of entries) {
    byDa.set(normalize(entry.da), entry)
    const stemKey = stem(entry.da)
    const stems = byStem.get(stemKey)
    if (stems) stems.push(entry)
    else byStem.set(stemKey, [entry])
    const glossKey = normalizeGloss(entry.en)
    const glosses = byGloss.get(glossKey)
    if (glosses) glosses.push(entry)
    else byGloss.set(glossKey, [entry])
  }
  return { byDa, byStem, byGloss }
}

async function authoredClueIndex() {
  if (!authoredIndex) {
    authoredIndex = import('./clue-lexicon.da.json').then(({ default: entries }) =>
      indexEntries(entries as AuthoredClueEntry[]),
    )
  }
  return authoredIndex
}

/**
 * The player-language clue index, or null when there is nothing to load
 * (English — whose source is the app's own Danish/English books — or an
 * incomplete language, which falls back rather than failing).
 */
async function playerClueIndex() {
  const lang = UI_LANGUAGE
  if (lang === 'en') return null
  if (!playerIndex) {
    playerIndex = lexiconFor(lang).then((rows) => {
      if (!rows || rows.length === 0) return null
      return indexEntries(rows.map((r) => ({ da: r.da, en: r.gloss })))
    })
  }
  const resolved = await playerIndex
  return resolved ?? null
}

/**
 * Search the lazily loaded clue lexicon with the course lookup's exact Danish,
 * stripped-English, and stemmed-Danish behaviour. Call this only after
 * `lookupLocal` misses: taught words always remain the authoritative result.
 * The player-language lexicon layer (§9.2) is searched first when present;
 * the Danish/English authored layer answers underneath it.
 */
export async function lookupAuthoredClue(term: string): Promise<AuthoredClueMatch[]> {
  const gloss = normalizeGloss(term)
  if (!gloss) return []

  const player = await playerClueIndex()
  if (player) {
    const hit =
      player.byDa.get(normalize(term)) ??
      player.byGloss.get(gloss)?.[0] ??
      player.byStem.get(stem(term))?.[0]
    if (hit) {
      const approximate = !player.byDa.has(normalize(term)) && !player.byGloss.get(gloss)?.includes(hit)
      return [{ entry: hit, matched: player.byDa.has(normalize(term)) ? 'target' : 'en', approximate }]
    }
  }

  const index = await authoredClueIndex()
  const exactDa = index.byDa.get(normalize(term))
  if (exactDa) return [{ entry: exactDa, matched: 'target', approximate: false }]
  const glossHits = index.byGloss.get(gloss)
  if (glossHits?.length) return glossHits.map((entry) => ({ entry, matched: 'en', approximate: false }))
  const stemHits = index.byStem.get(stem(term))
  if (stemHits?.length) return stemHits.map((entry) => ({ entry, matched: 'target', approximate: true }))
  return []
}

/** The board word this term names, if any — so a lookup can be charged for. */
export function boardWordFor(term: string, boardIds: readonly string[]): string | undefined {
  const ids = new Set(boardIds)
  return lookupLocal(term).find((m) => ids.has(m.entry.id))?.entry.id
}
