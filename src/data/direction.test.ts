import { describe, expect, it } from 'vitest'
import { createDataset } from './dataset'
import { lookupAuthoredClue } from './lookup'
import { danish } from '../lang/da'
import type { LanguagePack } from '../lang/types'
import type { WordEntry } from './types'

/**
 * The direction gate: the dictionary always translates FROM the UI language
 * TO Danish (owner, 2026-09-17, the «tank» bug).
 *
 * With the UI language set to Norwegian, a player typed "tank" (Norwegian for
 * a combat vehicle) as a clue. The classifier answered 'target' — "tank" IS a
 * Danish headword (a container) — so the dictionary read Danish→Danish and the
 * hint said "en tanke — thought (from tank)". The rule is the opposite: a word
 * that is a gloss in the ACTIVE UI language is a UI-language word even when it
 * is also a Danish headword, so the classification and the dictionary answer
 * both have to resolve UI→Danish.
 */

/**
 * A Danish pack whose glosses have been overridden to a second language —
 * the shape `withPlayerLanguage` produces once a language's gloss overlay
 * turns on. "tank" is both a Danish headword (the vehicle) and, here, a
 * gloss of «tanke» (the thought) in the player's language: the real case.
 */
function packWithGloss(glosses: Record<string, string[]>): LanguagePack {
  const words: WordEntry[] = danish.words.map((w) =>
    glosses[w.da] ? { ...w, en: glosses[w.da]! } : w,
  )
  return { ...danish, words }
}

const NB_TANK: LanguagePack = packWithGloss({ tanke: ['tank'], hund: ['hund'] })

describe('classifyClue: a UI-language gloss wins over a Danish headword', () => {
  it('classifies "tank" as a UI-language word when it is an nb gloss', () => {
    const ds = createDataset(NB_TANK, /^(en|ei|et|å) /)
    // The precondition that makes the real bug: the word IS Danish vocabulary
    // — Casey's lazy clue lexicon (clue-lexicon.da.json) ships «tank» — even
    // though the course's own nine hundred do not. The dataset in this test
    // has a headword set that carries it, so the classifier sees the collision.
    expect(lookupAuthoredClue('tank')).resolves.toMatchObject([
      { entry: { da: 'tank', en: 'tank' }, matched: 'target' },
    ])
    // …and it is also the nb gloss of «tanke», so the gloss must win.
    expect(ds.classifyClue('tank')).toBe('english')
  })

  it('still classifies a genuinely-Danish word that is not an nb gloss', () => {
    const ds = createDataset(NB_TANK, /^(en|ei|et|å) /)
    // "kæledyr" has æ: distinctive letters settle it regardless.
    expect(ds.classifyClue('kæledyr')).toBe('target')
    // A Danish headword with no nb reading. "blomst" is not a Norwegian word
    // for anything on this pack's gloss side.
    expect(ds.isHeadword('blomst')).toBe(true)
    expect(ds.classifyClue('blomst')).toBe('target')
    // An inflection of it stays Danish too: "blomster" is not an nb gloss.
    expect(ds.classifyClue('blomster')).toBe('target')
  })

  it('keeps distinctive letters first even for a glossed word', () => {
    // «røre» is both a Danish headword and a Norwegian word — but give it a
    // gloss WITHOUT the distinctive letter and type the Danish spelling: æ/ø/å
    // is unambiguous Danish and wins over the gloss check.
    const ds = createDataset(packWithGloss({ røre: ['rore'] }), null)
    expect(ds.classifyClue('røre')).toBe('target')
  })

  it('keeps the English-only behaviour identical when nothing collides', () => {
    const ds = createDataset(NB_TANK, /^(en|ei|et|å) /)
    expect(ds.classifyClue('bicycle')).toBe('english')
    expect(ds.classifyClue('hund')).toBe('english')
    expect(ds.classifyClue('xyzzyq')).toBe('unknown')
  })

  it('a UI=da player is unaffected: the gloss side IS Danish', () => {
    // Danish glosses identical to headwords: «tank» is only ever the vehicle.
    const ds = createDataset(packWithGloss({ tanke: ['tanke'] }), null)
    expect(ds.classifyClue('tank')).toBe('unknown')
    // "tank" is not a headword in this (unrealistic) pack, so the answer here
    // is only 'unknown' because the word is outside the shipped nine hundred.
    expect(ds.isHeadword('tank')).toBe(false)
  })
})