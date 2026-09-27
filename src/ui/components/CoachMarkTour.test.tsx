import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CoachMarkTour } from './SuitcaseTour'

describe('CoachMarkTour safe blocking surface', () => {
  it('renders explicit Next and Skip controls in a modal dialog, not a tap-through scrim', () => {
    const html = renderToStaticMarkup(<CoachMarkTour
      steps={[{ anchor: '.target', text: 'Read this first.' }, { anchor: '.next-target', text: 'Continue.' }]}
      surfaceSelector=".owned-surface"
      onDone={vi.fn()}
      onSkip={vi.fn()}
      kind="translation"
    />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('data-tour-kind="translation"')
    expect(html).toContain('>Next</button>')
    expect(html).toContain('>Skip</button>')
  })

  it('renders an empty step list as a safe no-step surface', () => {
    const html = renderToStaticMarkup(<CoachMarkTour
      steps={[]}
      onDone={vi.fn()}
      onSkip={vi.fn()}
      kind="translation"
    />)
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('data-tour-anchor="undefined"')
  })

  it('keeps result guidance inside the existing modal instead of nesting another modal', () => {
    const html = renderToStaticMarkup(<CoachMarkTour
      steps={[{ anchor: '.receipt-result-summary', text: 'Your result is saved.' }]}
      surfaceSelector=".city1-review-dialog"
      onDone={vi.fn()}
      onSkip={vi.fn()}
      kind="result"
    />)
    expect(html).toContain('role="group"')
    expect(html).not.toContain('aria-modal="true"')
  })
})
