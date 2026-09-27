import { beforeEach, describe, expect, it } from 'vitest'
import { devSwitchesAllowedFor, playtestTravelAllowedFor, useUi } from './uiStore'

describe('uiStore development switches', () => {
  it('never treats an installed Capacitor app as local development', () => {
    expect(devSwitchesAllowedFor(true, true, 'localhost')).toBe(false)
    expect(devSwitchesAllowedFor(true, false, 'localhost')).toBe(false)
  })

  it('keeps browser development and local preview available', () => {
    expect(devSwitchesAllowedFor(false, true, 'example.com')).toBe(true)
    expect(devSwitchesAllowedFor(false, false, 'localhost')).toBe(true)
    expect(devSwitchesAllowedFor(false, false, '900words.app')).toBe(false)
  })

  it('never exposes playtest travel in an installed app', () => {
    expect(playtestTravelAllowedFor(true, true, 'developer')).toBe(false)
    expect(playtestTravelAllowedFor(false, true, 'developer')).toBe(true)
  })
})

describe('uiStore Guide entry intent', () => {
  beforeEach(() => {
    useUi.setState({
      screen: 'home',
      sheetWordId: null,
      pendingRide: null,
      guideEntry: null,
      onboarding: null,
      leaveGameOpen: false,
    })
  })

  it('opens the requested Guide page once without persisting a second route state', () => {
    const entry = { kind: 'survival' as const, cityIndex: 2, exchangeIndex: 1 }
    useUi.getState().openGuide(entry)

    expect(useUi.getState().screen).toBe('guide')
    expect(useUi.getState().guideEntry).toEqual(entry)
    expect(useUi.getState().consumeGuideEntry()).toEqual(entry)
    expect(useUi.getState().guideEntry).toBeNull()
    expect(useUi.getState().consumeGuideEntry()).toBeNull()
  })

  it('clears an unconsumed Guide handoff when ordinary navigation takes over', () => {
    useUi.getState().openGuide({ kind: 'grammar', cityIndex: 0 })
    useUi.getState().goTo('home')
    expect(useUi.getState().guideEntry).toBeNull()
    expect(useUi.getState().screen).toBe('home')
  })

  it('keeps the round-exit decision transient and clears it on navigation', () => {
    useUi.getState().requestGameExit()
    expect(useUi.getState().leaveGameOpen).toBe(true)
    useUi.getState().goTo('home')
    expect(useUi.getState().leaveGameOpen).toBe(false)
  })
})

describe('uiStore onboarding lesson markers', () => {
  beforeEach(() => {
    const map = new Map<string, string>()
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      get length() { return map.size },
    } as Storage
  })

  it('records a persisted lesson once, keeping its first status', () => {
    useUi.setState({ onboarding: { step: 'tutorial', persist: true } })
    useUi.getState().markOnboardingLesson('translation', 'dismissed')
    useUi.getState().markOnboardingLesson('translation', 'done')
    expect(useUi.getState().onboarding).toEqual({ step: 'tutorial', persist: true, lessons: { translation: 'dismissed' } })
    expect(JSON.parse(localStorage.getItem('cluecab-onboard-lessons-v1')!)).toEqual({ translation: 'dismissed' })
  })

  it('records the full-wheel lesson like the others', () => {
    useUi.setState({ onboarding: { step: 'tutorial', persist: true, lessons: { translation: 'done' } } })
    useUi.getState().markOnboardingLesson('wheel', 'done')
    expect(useUi.getState().onboarding?.lessons).toEqual({ translation: 'done', wheel: 'done' })
    expect(JSON.parse(localStorage.getItem('cluecab-onboard-lessons-v1')!)).toEqual({ translation: 'done', wheel: 'done' })
  })

  it('keeps the lessons of a transient replay in memory only', () => {
    useUi.setState({ onboarding: { step: 'real-round', persist: false } })
    useUi.getState().markOnboardingLesson('result', 'done')
    expect(useUi.getState().onboarding?.lessons).toEqual({ result: 'done' })
    expect(localStorage.getItem('cluecab-onboard-lessons-v1')).toBeNull()
  })

  it('does nothing with no intro on screen, and keeps the step when a lesson is marked', () => {
    useUi.setState({ onboarding: null })
    useUi.getState().markOnboardingLesson('home', 'done')
    expect(useUi.getState().onboarding).toBeNull()
    useUi.setState({ onboarding: { step: 'home-return', persist: true, lessons: { translation: 'done' } } })
    useUi.getState().markOnboardingLesson('home', 'done')
    expect(useUi.getState().onboarding).toEqual({ step: 'home-return', persist: true, lessons: { translation: 'done', home: 'done' } })
  })
})

describe('uiStore intro replay', () => {
  it('starts a replay from Home, so Settings does not stay over the intro', () => {
    // App.tsx shows Settings over the intro when the intro itself sends a
    // player there (set up Casey, then Retry). The replay button is on
    // Settings, so a replay that left the screen there would show Settings
    // instead of the intro.
    useUi.setState({ onboarding: null, screen: 'settings' })
    useUi.getState().startOnboarding()
    expect(useUi.getState().screen).toBe('home')
    expect(useUi.getState().onboarding).toEqual({ step: 'ticket', persist: false })
  })
})
