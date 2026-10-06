import { readdirSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tag } from './Tag'
import { FOCUS_MODALITY_ATTRIBUTE, installFocusModality } from '../focusModality'

const css = readFileSync(new URL('../../styles/99-tag.css', import.meta.url), 'utf8')

/** The declarations of one rule, by its exact selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`no rule for ${selector}`)
  return match[1]!
}

describe('Tag: a luggage tag in place of a button', () => {
  it('is a real button with a hole, a label and a note', () => {
    const html = renderToStaticMarkup(<Tag label="Café puzzle" note="Café Solen" className="home-play" />)
    expect(html).toBe(
      '<button type="button" class="tag tag-row home-play">' +
        '<span class="tag-hole" aria-hidden="true"></span>' +
        '<span class="tag-text"><span class="tag-label">Café puzzle</span><span class="tag-note">Café Solen</span></span>' +
        '</button>',
    )
  })

  it('leaves the note out when there is none, and keeps the native disabled state', () => {
    const html = renderToStaticMarkup(<Tag label="Sightseeing" note={null} disabled size="wide" tone="primary" />)
    expect(html).toContain('<button disabled="" type="button" class="tag tag-wide tag-primary">')
    expect(html).not.toContain('tag-note')
  })

  it('cannot be turned into a submit button', () => {
    // `type` is not one of its props, and even a forced one is written over.
    const forced = { type: 'submit' } as unknown as Record<string, never>
    const html = renderToStaticMarkup(<Tag label="x" {...forced} />)
    expect(html).toBe('<button type="button" class="tag tag-row"><span class="tag-hole" aria-hidden="true"></span><span class="tag-text"><span class="tag-label">x</span></span></button>')
  })

  it('has at least a 44 x 44 CSS px target, a pressed, a disabled and a focus-visible state', () => {
    const base = rule('.tag')
    expect(base).toMatch(/min-width:\s*44px/)
    expect(base).toMatch(/min-height:\s*44px/)
    // Pressed: the fill changes and nothing moves.
    const pressed = rule('.tag:active:not(:disabled)')
    expect(pressed).toMatch(/--tag-fill:/)
    expect(pressed).not.toMatch(/transform/)
    // Disabled: pencil ink, grey label, no pointer.
    const disabled = rule('.tag:disabled')
    expect(disabled).toMatch(/--tag-ink:/)
    expect(disabled).toMatch(/--tag-label:/)
    expect(disabled).toMatch(/cursor:\s*default/)
    // The button itself is never clipped.
    expect(base).not.toMatch(/clip-path/)
  })

  it('never draws a focus rectangle; keyboard focus redraws its own outline', () => {
    // Build 123: a green rectangle over "Start translating". No outline or
    // shadow on the square box for any focus, script and touch included.
    const focus = rule(`.tag:focus,\n.tag:focus-visible`)
    expect(focus).toMatch(/outline:\s*none/)
    expect(focus).toMatch(/box-shadow:\s*none/)
    // Keyboard only (iOS matches :focus-visible for script focus): the tag's
    // own ink, greener and heavier.
    const keyboard = rule(":root[data-focus-modality='keyboard'] .tag:focus-visible")
    expect(keyboard).toMatch(/--tag-ink:\s*var\(--green-deep\)/)
    expect(keyboard).toMatch(/--tag-line:/)
    expect(keyboard).not.toMatch(/outline|box-shadow/)
    // No other stylesheet may frame a tag's focus with a rectangle again.
    const dir = new URL('../../styles/', import.meta.url)
    const framed: string[] = []
    for (const file of readdirSync(dir)) {
      if (file === '99-tag.css') continue
      const text = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selectors, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const onTag = selectors!.replace(/:not\([^)]*\)/g, '').split(',')
          .some((selector) => /\.tag(?![\w-])\S*:focus/.test(selector))
        if (onTag && /(?:^|[;\s])(?:outline|box-shadow)\s*:\s*(?!none)/.test(body!)) framed.push(`${file}: ${selectors!.trim()}`)
      }
    }
    expect(framed).toEqual([])
  })
})

describe('focus modality: keyboard focus is Tab, never a tap or a script', () => {
  function fakeDocument() {
    const listeners = new Map<string, (event: { key?: string }) => void>()
    const attributes = new Map<string, string>()
    const doc = {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        removeAttribute: (name: string) => attributes.delete(name),
      },
      addEventListener: (type: string, listener: (event: { key?: string }) => void) => listeners.set(type, listener),
    }
    return { doc: doc as unknown as Document, fire: (type: string, event: { key?: string } = {}) => listeners.get(type)!(event), attributes }
  }

  it('marks <html> on Tab and clears it on any pointer or touch', () => {
    const { doc, fire, attributes } = fakeDocument()
    installFocusModality(doc)
    expect(attributes.get(FOCUS_MODALITY_ATTRIBUTE)).toBeUndefined()
    fire('keydown', { key: 'a' })
    expect(attributes.get(FOCUS_MODALITY_ATTRIBUTE)).toBeUndefined()
    fire('keydown', { key: 'Tab' })
    expect(attributes.get(FOCUS_MODALITY_ATTRIBUTE)).toBe('keyboard')
    fire('pointerdown')
    expect(attributes.get(FOCUS_MODALITY_ATTRIBUTE)).toBeUndefined()
    fire('keydown', { key: 'Tab' })
    fire('touchstart')
    expect(attributes.get(FOCUS_MODALITY_ATTRIBUTE)).toBeUndefined()
  })
})
