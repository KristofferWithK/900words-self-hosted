import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CATALOGUES, UI, UI_LANGUAGES } from '../../i18n'
import { RunCafesFound } from './SightseeingScreen'

// CW-08c: a walk that is not the first session's keeps walking through the
// cafés it finds, and its run-end panel says which (owner, 2026-10-04).
describe('the run-end panel lists the cafés the walk found', () => {
  it('names the one café found, by its own name', () => {
    const html = renderToStaticMarkup(<RunCafesFound cafes={['Café Solen']} />)
    expect(html).toContain('run-cafes-found')
    expect(html).toContain(UI.sightseeing.cafesFound(1, 'Café Solen'))
    expect(html).toContain('Café Solen')
  })

  it('counts several, or one without a name of its own', () => {
    expect(renderToStaticMarkup(<RunCafesFound cafes={['Café Solen', 'Café Havnen']} />)).toContain(UI.sightseeing.cafesFound(2, null))
    expect(renderToStaticMarkup(<RunCafesFound cafes={[null]} />)).toContain(UI.sightseeing.cafesFound(1, null))
  })

  it('says nothing when the walk found no café', () => {
    expect(renderToStaticMarkup(<RunCafesFound cafes={[]} />)).toBe('')
  })

  it('reads in every catalogue: the name as it is, the count as a number, no em-dash', () => {
    for (const code of UI_LANGUAGES) {
      const say = CATALOGUES[code].sightseeing.cafesFound
      const one = say(1, 'Café Solen')
      const two = say(2, null)
      expect(one, code).toContain('Café Solen')
      expect(two, code).toContain('2')
      for (const line of [one, two]) expect(line, code).not.toMatch(/[—–]/)
      if (code !== 'en') expect([one, two], code).not.toEqual([CATALOGUES.en.sightseeing.cafesFound(1, 'Café Solen'), CATALOGUES.en.sightseeing.cafesFound(2, null)])
    }
  })
})
