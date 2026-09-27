import { danishStem } from '../lang/da/morphology'

/**
 * Where the word being looked up sits inside its own example sentences, so
 * the sheet can mark it in both the Danish and the English (owner,
 * 2026-09-05: "the word that it's about is highlighted in the Danish sentence
 * as well as the English sentence").
 *
 * Neither sentence carries the word in a form a string search would find.
 * The Danish uses whatever the sentence needs — «huset» for «hus», «arbejder»
 * for «arbejde» — so the match is by the same stemmer the game uses to judge
 * clues. The English uses one of the word's glosses, sometimes inflected —
 * "working" for "work" — so the match is any gloss with the endings a
 * beginner's sentence will use. A sentence that quotes the Danish word inside
 * the English ("What does købe mean?") marks the Danish word there, which is
 * the right thing.
 *
 * Where nothing matches, nothing is marked. A wrong mark teaches a wrong
 * pairing; no mark teaches nothing.
 */
export type Segment = { readonly text: string; readonly hit: boolean }

/** Letters of either language, so «hus.» tokenises as «hus» and «.». */
const WORD = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu

function segments(sentence: string, hits: (token: string) => boolean): Segment[] {
  const out: Segment[] = []
  let last = 0
  let prevHit = false
  for (const m of sentence.matchAll(WORD)) {
    const at = m.index ?? 0
    const hit = hits(m[0])
    if (at > last) {
      // The space inside a marked phrase («get up») is marked with it, so the
      // phrase reads as one mark rather than two.
      const gap = sentence.slice(last, at)
      out.push({ text: gap, hit: prevHit && hit && /^\s+$/.test(gap) })
    }
    out.push({ text: m[0], hit })
    last = at + m[0].length
    prevHit = hit
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), hit: false })
  return merge(out)
}

/** Adjacent runs with the same verdict become one segment. */
function merge(parts: readonly Segment[]): Segment[] {
  const out: Segment[] = []
  for (const part of parts) {
    const prev = out[out.length - 1]
    if (prev && prev.hit === part.hit) out[out.length - 1] = { text: prev.text + part.text, hit: prev.hit }
    else out.push(part)
  }
  return out
}

const fold = (s: string) => s.normalize('NFC').toLowerCase().replace(/[’']/g, "'")

/**
 * Mark the headword's forms in its Danish sentence. A multi-word headword
 * («at bo», «hinanden» is one word but «tage af sted» is three) matches by
 * its last word, which is the one that inflects.
 */
export function markDanish(sentence: string, headword: string): Segment[] {
  const head = fold(headword).split(/\s+/).pop() ?? ''
  if (!head) return [{ text: sentence, hit: false }]
  const stem = danishStem(head)
  const bases = danishBases(head)
  return segments(sentence, (token) => {
    const t = fold(token)
    if (t === head) return true
    // «bo» → «bor», «dø» → «dør», «se» → «ser»: the present of a one-syllable
    // verb, which is the one form a stem search cannot reach.
    if (/[aeiouyæøå]$/.test(head) && t === `${head}r`) return true
    // The stemmer strips one suffix. A stem shorter than three letters is
    // «se»-sized and would match half the sentence, so it must match whole.
    if (stem.length < 3) return false
    const ts = danishStem(t)
    if (ts === stem) return true
    // A form that grows from the headword, or from one of its shortened
    // bases, by at most four letters: «billetter», «æggene», «tomaterne».
    // Four is what the nine hundred's own sentences need; the sweep in the
    // test file is where a wider allowance would show its false pairs.
    return [head, stem, ...bases].some((b) => t.startsWith(b) && t.length - b.length <= 4)
  })
}

/**
 * The shortened bases a Danish headword's forms grow from. The imperative
 * drops the infinitive's «-e» and one of a doubled consonant («komme» →
 * «kom», «glemme» → «glem»), and an «-el/-en/-er» noun loses the «e» before a
 * suffix («cykel» → «cyklen», «møbel» → «møbler», «fængsel» → «fængslet»).
 */
function danishBases(head: string): string[] {
  const out: string[] = []
  if (head.length >= 4 && head.endsWith('e')) {
    const base = head.slice(0, -1)
    out.push(base)
    if (base.length >= 4 && base[base.length - 1] === base[base.length - 2]) out.push(base.slice(0, -1))
  }
  if (head.length >= 5 && /e[lnr]$/.test(head)) out.push(head.slice(0, -2) + head.slice(-1))
  return out.filter((b) => b.length >= 3)
}

/**
 * The endings a beginner's English sentence puts on a gloss, on both sides of
 * the Atlantic: the glosses are American and the sentences were written
 * British ("apologised", "cosy", "driving licence").
 */
function englishForms(gloss: string): string[] {
  const forms = new Set<string>()
  for (const g of spellings(fold(gloss))) {
    for (const f of [g, `${g}s`, `${g}es`, `${g}ed`, `${g}d`, `${g}ing`, `${g}er`, `${g}est`, `${g}ly`, `${g}'s`]) forms.add(f)
    if (g.endsWith('e')) forms.add(`${g.slice(0, -1)}ing`)
    if (g.endsWith('ie')) forms.add(`${g.slice(0, -2)}ying`)
    if (g.endsWith('y')) {
      forms.add(`${g.slice(0, -1)}ies`)
      forms.add(`${g.slice(0, -1)}ied`)
      forms.add(`${g.slice(0, -1)}ier`)
    }
    // A doubled final consonant: run/running, big/bigger, stop/stopped.
    if (/[bdglmnprt]$/.test(g)) {
      forms.add(`${g}${g.slice(-1)}ing`)
      forms.add(`${g}${g.slice(-1)}ed`)
      forms.add(`${g}${g.slice(-1)}er`)
    }
    // Derivations a sentence reaches for: hopeful, stomachache, ashamed.
    if (g.length >= 4) for (const s of ['ful', 'ache', 'ness', 'less', 'ish', 'ment', 'y']) forms.add(`${g}${s}`)
  }
  return [...forms]
}

/** The British spelling of an American gloss, where they differ. */
function spellings(g: string): string[] {
  const out = new Set([g])
  if (g.endsWith('ize')) out.add(`${g.slice(0, -3)}ise`)
  if (g.endsWith('yze')) out.add(`${g.slice(0, -3)}yse`)
  if (g.endsWith('ense')) out.add(`${g.slice(0, -4)}ence`)
  if (g.endsWith('zy')) out.add(`${g.slice(0, -2)}sy`)
  if (/[^aeiou]or$/.test(g) && g.length >= 5) out.add(`${g.slice(0, -2)}our`)
  if (/[^aeiou]er$/.test(g) && g.length >= 5) out.add(`${g.slice(0, -2)}re`)
  return [...out]
}

/**
 * The token as the sentence has it and as it reads with a short prefix
 * taken off, so "tonight" is found for "night" and "ashamed" for "shame".
 */
function tokenReadings(t: string): string[] {
  const out = [t]
  const m = /^(to|a|un|re)(.{4,})$/.exec(t)
  if (m) out.push(m[2]!)
  return out
}

/**
 * Mark a gloss's forms — or the Danish headword itself, when the English
 * quotes it — in the English sentence. Glosses are given as the dictionary
 * lists them, so "to buy" and "get up" are handled: a leading "to" is
 * dropped, and a multi-word gloss matches as a phrase.
 */
export function markEnglish(sentence: string, glosses: readonly string[], headword: string): Segment[] {
  const single = new Set<string>()
  const phrases: string[][] = []
  for (const raw of glosses) {
    const words = fold(raw).replace(/^to\s+/, '').split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    if (words.length === 1) for (const f of englishForms(words[0]!)) single.add(f)
    else phrases.push(words)
  }
  const head = fold(headword)
  const tokens = [...sentence.matchAll(WORD)].map((m) => fold(m[0]))
  // Phrase hits are positions; single-word hits are looked up per token.
  // Any word of the phrase may inflect: "pieces of furniture", "picked up".
  const phraseHit = new Set<number>()
  for (const phrase of phrases) {
    const forms = phrase.map((w) => new Set(englishForms(w)))
    for (let i = 0; i + phrase.length <= tokens.length; i++) {
      if (forms.every((f, j) => f.has(tokens[i + j]!))) for (let j = 0; j < phrase.length; j++) phraseHit.add(i + j)
    }
  }
  let index = -1
  return segments(sentence, (token) => {
    index++
    const t = fold(token)
    return t === head || phraseHit.has(index) || tokenReadings(t).some((r) => single.has(r))
  })
}
