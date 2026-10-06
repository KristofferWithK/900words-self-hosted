import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Owner feedback after build 123: a walk chosen on Home starts at once, with
 * no ready panel to tap through; a lost walk's end panel counts down on its
 * "More sightseeing" tag and starts the next walk by itself. The countdown's rules
 * are in src/ui/runAutoplay.test.ts; this is the tag that shows it and Home's
 * door into a walk.
 */
const gate = vi.hoisted(() => ({ allow: true }))
vi.mock('../runGate', () => ({
  beginRunOrOffer: (begin: () => void) => {
    if (!gate.allow) return false
    begin()
    return true
  },
}))

const { CATALOGUES, UI, UI_LANGUAGES } = await import('../../i18n')
const { SightseeingAgainTag } = await import('./SightseeingScreen')
const { startHomeWalk } = await import('./HomeScreen')
const { chosenWalk, takeWalkStartNow, chooseWalk } = await import('../../run/walks')
const { useUi } = await import('../../stores/uiStore')

afterEach(() => {
  gate.allow = true
  chooseWalk('words')
  useUi.setState({ screen: 'home' })
})

describe('Home\'s choice of a walk starts it at once', () => {
  it('the screen opens with the one walk already chosen to start, no chooser and no ready panel', () => {
    chooseWalk('train')
    expect(startHomeWalk()).toBe(true)
    expect(useUi.getState().screen).toBe('sightseeing')
    expect(chosenWalk()).toBe('words')
    // Read once by the screen that opens it: a later visit opens on the ready panel.
    expect(takeWalkStartNow()).toBe(true)
    expect(takeWalkStartNow()).toBe(false)
  })

  it('past today\'s free walks it is refused as before: nothing opens and nothing is set to start', () => {
    gate.allow = false
    expect(startHomeWalk()).toBe(false)
    expect(useUi.getState().screen).toBe('home')
    expect(takeWalkStartNow()).toBe(false)
  })

  it('the dev switch and the train run still open on their ready panel', () => {
    chooseWalk('train')
    expect(takeWalkStartNow()).toBe(false)
    chooseWalk('words')
    expect(takeWalkStartNow()).toBe(false)
  })
})

describe('"More sightseeing" counting down to the next walk', () => {
  const tag = (counting: boolean, primary = true) => renderToStaticMarkup(<SightseeingAgainTag counting={counting} primary={primary} autoFocus onClick={() => {}} />)

  it('fills over the four seconds, with no number on it (option D)', () => {
    const html = tag(true)
    expect(html).toContain(UI.sightseeing.sightseeingAgain)
    expect(html).toContain('run-again-fill')
    expect(html).toContain('animation-duration:4s')
    expect(html).toContain('run-again-counting')
    expect(html.replace(/animation-duration:4s/, '')).not.toMatch(/\d/)
  })

  it('is the plain tag when nothing counts', () => {
    const plain = tag(false)
    expect(plain).toContain(UI.sightseeing.sightseeingAgain)
    expect(plain).not.toContain('run-again-fill')
    expect(tag(false, false)).not.toContain('run-tag-btn-primary')
  })

  it('says sightseeing, not walk, in every catalogue, and no em-dash', () => {
    for (const code of UI_LANGUAGES) {
      const label = CATALOGUES[code].sightseeing.sightseeingAgain
      expect(label, code).not.toMatch(/[—–]/)
      expect(label.length, code).toBeGreaterThan(0)
      if (code !== 'en') expect(label, code).not.toBe(CATALOGUES.en.sightseeing.sightseeingAgain)
    }
    expect(CATALOGUES.en.sightseeing.sightseeingAgain).toBe('More sightseeing')
  })
})
