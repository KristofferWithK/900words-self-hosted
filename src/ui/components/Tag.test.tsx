import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tag } from './Tag'

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
    expect(rule('.tag:focus-visible')).toMatch(/outline:\s*2px solid/)
    // The button itself is never clipped, so the focus ring is never cut off.
    expect(base).not.toMatch(/clip-path/)
  })
})
