import { describe, expect, it } from 'vitest'
import {
  ONBOARD_KEY,
  LEGACY_ONBOARD_KEY,
  decideOnboarding,
  isOnboardStep,
  markOnboardDone,
  ONBOARD_LESSONS_KEY,
  readOnboardLessons,
  writeOnboardLessons,
  writeOnboardStep,
} from './flow'
import { HOWTO_KEY } from '../stores/uiStore'

/** vitest runs under node — no localStorage — so every call injects one. */
function storage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  }
}

/** A persisted SRS record the shape zustand writes. */
const srsRecord = (stats: Record<string, unknown>) =>
  JSON.stringify({ state: { stats, games: { played: 1 } }, version: 3 })

describe('the onboarding gate', () => {
  it('runs on a genuinely fresh device: no marker, no howto, empty SRS', () => {
    expect(decideOnboarding(storage())).toEqual({ kind: 'fresh' })
  })

  it('never ambushes a device that has seen the rules', () => {
    expect(decideOnboarding(storage({ [HOWTO_KEY]: 'seen' }))).toEqual({
      kind: 'veteran',
    })
  })

  it('never ambushes a device with words in the SRS map', () => {
    const s = storage({ 'cluecab-srs-v1': srsRecord({ 'da:mor': { box: 2 } }) })
    expect(decideOnboarding(s)).toEqual({ kind: 'veteran' })
  })

  it('treats an SRS record with an EMPTY stats map as fresh', () => {
    // The store can be written with nothing in it (a settings change persists
    // sibling stores in some flows). No words means nothing was played.
    const s = storage({ 'cluecab-srs-v1': srsRecord({}) })
    expect(decideOnboarding(s)).toEqual({ kind: 'fresh' })
  })

  it('treats an unreadable SRS record as veteran — fresh must be proven', () => {
    const s = storage({ 'cluecab-srs-v1': 'not json {' })
    expect(decideOnboarding(s)).toEqual({ kind: 'veteran' })
  })

  it('resumes a flow that was started and not finished', () => {
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'ticket' }))).toEqual({
      kind: 'resume',
      step: 'ticket',
    })
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'home-intro' }))).toEqual({
      kind: 'resume',
      step: 'home-intro',
    })
  })

  it('restarts at the ticket on a step this build does not know', () => {
    // A newer build's step after a downgrade: the flow was begun, keep it.
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'tour-of-2027' }))).toEqual({
      kind: 'resume',
      step: 'ticket',
    })
  })

  it('is done once the marker says so, whatever else is stored', () => {
    const s = storage({
      [ONBOARD_KEY]: 'done',
      [HOWTO_KEY]: 'seen',
      'cluecab-srs-v1': srsRecord({ 'da:hus': {} }),
    })
    expect(decideOnboarding(s)).toEqual({ kind: 'done' })
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'done' }))).toEqual({
      kind: 'done',
    })
  })

  it('lands on done when storage throws — never ambush what cannot be read', () => {
    const throwing = {
      getItem: () => {
        throw new Error('private mode')
      },
    }
    expect(decideOnboarding(throwing)).toEqual({ kind: 'done' })
    expect(decideOnboarding(undefined)).toEqual({ kind: 'done' })
  })

  it('round-trips its own markers', () => {
    const s = storage()
    writeOnboardStep('ticket', s)
    expect(decideOnboarding(s)).toEqual({ kind: 'resume', step: 'ticket' })
    markOnboardDone(s)
    expect(decideOnboarding(s)).toEqual({ kind: 'done' })
    expect(s.dump()).toEqual({ [ONBOARD_KEY]: 'done' })
  })

  it('knows exactly the Home-first sequence', () => {
    expect(isOnboardStep('home-intro')).toBe(true)
    expect(isOnboardStep('ticket')).toBe(true)
    expect(isOnboardStep('tutorial')).toBe(true)
    expect(isOnboardStep('real-round')).toBe(true)
    expect(isOnboardStep('home-return')).toBe(true)
    expect(isOnboardStep('suitcase')).toBe(true)
    expect(isOnboardStep('suitcase-ready')).toBe(true)
    expect(isOnboardStep('train')).toBe(false)
    expect(isOnboardStep('home')).toBe(false)
    expect(isOnboardStep('station')).toBe(false)
    expect(isOnboardStep('grammar')).toBe(false)
    expect(isOnboardStep('map')).toBe(false)
    expect(isOnboardStep('done')).toBe(false)
    expect(isOnboardStep(null)).toBe(false)
  })

  it('resumes a reload at the post-game Home prompt', () => {
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'home-return' }))).toEqual({
      kind: 'resume',
      step: 'home-return',
    })
  })

  it('resumes every persisted hand-off after the practice round', () => {
    for (const step of ['real-round', 'suitcase', 'suitcase-ready'] as const) {
      expect(decideOnboarding(storage({ [ONBOARD_KEY]: step }))).toEqual({
        kind: 'resume',
        step,
      })
    }
  })

  it('resumes a device that reloaded mid-tutorial at the tutorial', () => {
    // The language-choice reload and any mid-round reload both land here —
    // the marker goes down BEFORE setActiveLanguage() reloads (see
    // OnboardingScreen's choose), so this is the step the way back up reads.
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'tutorial' }))).toEqual({
      kind: 'resume',
      step: 'tutorial',
    })
  })

  it('migrates v4 markers into the Home-first decisions', () => {
    expect(decideOnboarding(storage({ [LEGACY_ONBOARD_KEY]: 'train' }))).toEqual({
      kind: 'resume',
      step: 'home-intro',
    })
    expect(decideOnboarding(storage({ [LEGACY_ONBOARD_KEY]: 'home' }))).toEqual({
      kind: 'resume',
      step: 'home-return',
    })
    // An old marker under the new key is unknown (a downgrade/newer-build
    // case), so it restarts at the first safe decision.
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'arrival' }))).toEqual({
      kind: 'resume',
      step: 'ticket',
    })
    expect(decideOnboarding(storage({ [LEGACY_ONBOARD_KEY]: 'grammar' }))).toEqual({
      kind: 'resume', step: 'ticket',
    })
  })

  it('keeps the staged Home marker after a reload', () => {
    expect(decideOnboarding(storage({ [ONBOARD_KEY]: 'home-intro' }))).toEqual({
      kind: 'resume',
      step: 'home-intro',
    })
  })

  it('moves a completed v3 destination chapter to the Home hand-off', () => {
    expect(decideOnboarding(storage({ 'cluecab-onboard-v3': 'grammar' }))).toEqual({
      kind: 'resume',
      step: 'home-return',
    })
  })

  it('spells the howto key the way uiStore does', () => {
    // flow.ts carries its own literal to stay import-free; this is the pin
    // that keeps the two spellings from drifting when the overlay bumps to v5.
    const s = storage()
    // Only the howto key set: the gate must read it as veteran, which proves
    // the literal inside flow.ts is the SAME key uiStore writes.
    s.setItem(HOWTO_KEY, 'seen')
    expect(decideOnboarding(s)).toEqual({ kind: 'veteran' })
  })
})

describe('the contextual lesson markers', () => {
  it('reads an absent record as every lesson still owed', () => {
    expect(readOnboardLessons(storage())).toEqual({})
    expect(readOnboardLessons(undefined)).toEqual({})
  })

  it('keeps done and dismissed apart and round-trips them', () => {
    const s = storage()
    writeOnboardLessons({ translation: 'dismissed', result: 'done' }, s)
    expect(readOnboardLessons(s)).toEqual({ translation: 'dismissed', result: 'done' })
  })

  it('carries the full-wheel lesson beside the others', () => {
    const s = storage()
    writeOnboardLessons({ translation: 'done', wheel: 'dismissed' }, s)
    expect(readOnboardLessons(s)).toEqual({ translation: 'done', wheel: 'dismissed' })
    // A record written before the wheel lesson existed simply owes it.
    expect(readOnboardLessons(storage({ [ONBOARD_LESSONS_KEY]: JSON.stringify({ translation: 'done' }) }))).toEqual({ translation: 'done' })
  })

  it('drops unknown lessons and statuses, and survives corrupt JSON', () => {
    expect(readOnboardLessons(storage({
      [ONBOARD_LESSONS_KEY]: JSON.stringify({ translation: 'done', result: 'maybe', home: 7, future: 'done' }),
    }))).toEqual({ translation: 'done' })
    expect(readOnboardLessons(storage({ [ONBOARD_LESSONS_KEY]: '{not json' }))).toEqual({})
    expect(readOnboardLessons(storage({ [ONBOARD_LESSONS_KEY]: 'null' }))).toEqual({})
  })

  it('never changes the step marker, and is cleared when onboarding finishes', () => {
    const s = storage()
    writeOnboardStep('real-round', s)
    writeOnboardLessons({ translation: 'done' }, s)
    expect(decideOnboarding(s)).toEqual({ kind: 'resume', step: 'real-round' })
    markOnboardDone(s)
    expect(s.dump()).toEqual({ [ONBOARD_KEY]: 'done' })
  })
})
