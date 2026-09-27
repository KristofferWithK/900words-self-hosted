import { describe, expect, it } from 'vitest'
import { scanFile, staticText } from './literal-scan.mjs'

/**
 * The scanner's own fixtures. Gate 2 is only as good as this file: every rule
 * is pinned with the case it exists for AND with the case it must not fire on,
 * because a scanner that quietly stops counting is a gate that quietly stops
 * gating.
 */

const scan = (source, allow = []) =>
  scanFile('fixture.tsx', source, new Set(allow))

const texts = (source, allow = []) =>
  scan(source, allow).map((l) => l.text)

const kinds = (source) => scan(source).map((l) => l.kind)

describe('what a player reads', () => {
  it('counts the text between tags', () => {
    expect(texts('const a = <p>Tap a card to hear it</p>')).toEqual(['Tap a card to hear it'])
    expect(kinds('const a = <p>Tap a card to hear it</p>')).toEqual(['jsx-text'])
  })

  it('counts a single word between tags — a button label is one word', () => {
    expect(texts('const a = <button>Skip</button>')).toEqual(['Skip'])
  })

  it('counts the attributes a player reads or hears', () => {
    const src =
      'const a = <input placeholder="Type the Danish" aria-label="Your answer" title="A hint" />'
    expect(texts(src).sort()).toEqual(['A hint', 'Type the Danish', 'Your answer'])
    expect(new Set(kinds(src))).toEqual(new Set(['jsx-attr']))
  })

  it('counts BOTH sides of a conditional inside one of those attributes', () => {
    const src = 'const a = <b aria-label={packed ? "Already packed" : "Tap to pack"} />'
    expect(texts(src).sort()).toEqual(['Already packed', 'Tap to pack'])
  })

  it('counts a template in an attribute, with its holes closed up', () => {
    const src = 'const a = <b title={`The Danish for ${word}`} />'
    expect(texts(src)).toEqual(['The Danish for'])
  })

  it('keeps a template’s later spans, so text after a hole is not lost', () => {
    const src = 'const a = <p>{`Pack «${word}» to keep it`}</p>'
    expect(texts(src)).toEqual(['Pack « » to keep it'])
  })

  it('counts a string expression used as a child', () => {
    expect(kinds('const a = <p>{"Nothing packed yet"}</p>')).toEqual(['jsx-child'])
  })

  it('counts a template used as a child', () => {
    const src = 'const a = <p>{`Word of the day: ${w.da}`}</p>'
    expect(texts(src)).toEqual(['Word of the day:'])
    expect(kinds(src)).toEqual(['jsx-child'])
  })

  it('counts a sentence built outside JSX — this is how Casey speaks', () => {
    const src = "export const TIPS = ['Collect a word by cluing it and guessing it']"
    expect(kinds(src)).toEqual(['sentence'])
  })

  it('counts a sentence inside a handler on a non-copy attribute', () => {
    const src = 'const a = <button onClick={() => setError("that word is on the board")} />'
    expect(texts(src)).toEqual(['that word is on the board'])
    expect(kinds(src)).toEqual(['sentence'])
  })
})

describe('what is not copy', () => {
  it('leaves class names alone, however much they read like a sentence', () => {
    expect(texts('const a = <p className="sheet glosses card">x</p>')).toEqual(['x'])
  })

  it('leaves every other non-copy attribute alone', () => {
    const src = 'const a = <p data-act="a b c" id="one two three" lang="da" />'
    expect(texts(src)).toEqual([])
  })

  it('leaves the JSX space expression alone', () => {
    expect(texts("const a = <p>{' '}</p>")).toEqual([])
  })

  it('leaves import and export paths alone', () => {
    const src = "import { a } from '../lang/active'\nexport { b } from './one/two/three'"
    expect(texts(src)).toEqual([])
  })

  it('leaves a one- or two-word string alone outside JSX — it is an identifier', () => {
    expect(texts("const mode = 'study phase'")).toEqual([])
    expect(texts("const key = 'cluecab-settings-v1'")).toEqual([])
  })

  it('leaves developer output alone', () => {
    expect(texts('console.warn("the audio context could not start")')).toEqual([])
    expect(texts('console.log(`the audio context could not start`)')).toEqual([])
  })

  it('leaves quoted object keys alone but not their values', () => {
    const src = 'const m = { "one two three": "four five six" }'
    expect(texts(src)).toEqual(['four five six'])
  })

  it('leaves a string literal type alone', () => {
    expect(texts("type M = 'one two three'")).toEqual([])
  })

  it('leaves anything on the allowlist alone, and only an exact match', () => {
    expect(texts('const a = <p>Casey</p>', ['Casey'])).toEqual([])
    expect(texts('const a = <p>Casey is packing</p>', ['Casey'])).toEqual(['Casey is packing'])
  })
})

describe('the report', () => {
  it('gives the line each literal is on, in source order', () => {
    const src = ['const a = (', '  <p>', '    First line', '    <b>Second</b>', '  </p>', ')'].join(
      '\n',
    )
    expect(scan(src).map((l) => [l.line, l.text])).toEqual([
      [3, 'First line'],
      [4, 'Second'],
    ])
  })

  it('counts one literal once, even when two rules could claim it', () => {
    // An interesting attribute holding a three-word string is jsx-attr, and
    // must not be counted a second time by the sentence rule.
    const src = 'const a = <b title="one two three" />'
    expect(scan(src)).toHaveLength(1)
    expect(kinds(src)).toEqual(['jsx-attr'])
  })

  it('reads a real component the way the inventory will', () => {
    const src = [
      "import { useState } from 'react'",
      'export function Panel({ word }: { word: string }) {',
      "  const [error, setError] = useState('')",
      '  return (',
      '    <div className="panel packing dock">',
      '      <h2>Your suitcase</h2>',
      '      <button title="Pack this word" onClick={() => setError("that word is already packed")}>',
      '        {`Pack «${word}»`}',
      '      </button>',
      '      <small>{error}</small>',
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    expect(texts(src).sort()).toEqual([
      'Pack this word',
      'Pack « »',
      'Your suitcase',
      'that word is already packed',
    ])
  })
})

describe('staticText', () => {
  it('joins a template’s spans with a space and drops its holes', () => {
    const literal = { type: 'TemplateLiteral', quasis: [
      { value: { cooked: 'Pack «', raw: 'Pack «' } },
      { value: { cooked: '»', raw: '»' } },
    ] }
    expect(staticText(literal)).toBe('Pack « »')
  })

  it('is null for anything that is not a literal', () => {
    expect(staticText({ type: 'Identifier', name: 'x' })).toBeNull()
  })
})

describe('the developer’s own strings', () => {
  it('leaves a built-in Error’s message alone — it unwinds, it is never rendered', () => {
    expect(texts("throw new Error('chapter audio playback cancelled')")).toEqual([])
    expect(texts("reject(new Error('chapter audio metadata timed out'))")).toEqual([])
  })

  it('but still counts a custom error class, which is how a player-facing one is written', () => {
    // AiError exists so `e instanceof AiError ? e.message : …` can show it.
    expect(texts("throw new AiError('You appear to be offline.')")).toEqual([
      'You appear to be offline.',
    ])
  })
})
