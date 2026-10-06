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
    // Both are tags (CW-12): each label sits in its tag's label span.
    expect(html).toContain('<span class="tag-label">Next</span>')
    expect(html).toContain('<span class="tag-label">Skip</span>')
  })

  it('has no Next on a tap-only beat: the lit control is the only way on, Skip stays', () => {
    const html = renderToStaticMarkup(<CoachMarkTour
      steps={[{ anchor: '.cluey-button', text: 'Now tap me to open the suitcase.', tapThrough: true, tapOnly: true }]}
      surfaceSelector=".owned-surface"
      onDone={vi.fn()}
      onSkip={vi.fn()}
      kind="home"
    />)
    expect(html).not.toContain('onboard-next')
    expect(html).not.toContain('<span class="tag-label">On we go</span>')
    expect(html).toContain('<span class="tag-label">Skip</span>')
    expect(html).toContain('role="dialog"')
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
