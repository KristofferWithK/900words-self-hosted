import { describe, expect, it } from 'vitest'
import { UI, UI_LANGUAGE } from '../i18n'
import type { UiLanguage } from '../i18n/types'
import { TARGET_TIPS, targetTipsFor } from '../i18n/target-tips'
import { ACTIVE } from '../lang/active'
import { danishCopy } from '../lang/da/copy'
import { germanCopy } from '../lang/de/copy'
import { CRITICAL_TIPS, clueyLines, homeLineIndex, introLineIndex, silentDay } from './cluey-tips'

const ALL_UI_LANGUAGES: readonly UiLanguage[] = [
  'en', 'de', 'es', 'zh', 'fr', 'pt', 'pl', 'hu', 'sv', 'nb', 'nl',
]

/**
 * The intro window (O4): the first sessions open Casey's bubble on the
 * critical tips in priority order, one per distinct day, before the rotation.
 * That gate stays day-based. The rotation AFTER the window is per-visit now
 * (owner, 2026-09-15): every Home visit opens on a fresh random line, so the
 * old "same all day, new tomorrow" determinism only holds inside the window.
 * Mutation-checked when written: with the day-advance branch removed, 'a new
 * day fronts the next tip' fails; with CRITICAL_TIPS no longer leading TIPS,
 * 'leafing onward walks them in order' fails.
 */

const fakeStorage = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

// Any fixed day number works; the code only compares and mods it.
const DAY = 753901
const lines = clueyLines(0)
const count = lines.length

describe('the intro window fronts the critical tips', () => {
  it('a fresh device opens on the first critical tip', () => {
    const idx = introLineIndex(count, fakeStorage(), DAY)
    expect(lines[idx!]).toBe(CRITICAL_TIPS[0])
  })

  it('and leafing onward walks them in priority order', () => {
    // Tapping the bubble is index+1 (Cluey.tsx), so the tips must LEAD the
    // list for the walk to follow the declared priority.
    const idx = introLineIndex(count, fakeStorage(), DAY)
    for (let i = 0; i < CRITICAL_TIPS.length; i++) {
      expect(lines[(idx! + i) % count]).toBe(CRITICAL_TIPS[i])
    }
  })

  it('the same day keeps the same tip, however often the app opens', () => {
    const s = fakeStorage()
    const first = introLineIndex(count, s, DAY)
    expect(introLineIndex(count, s, DAY)).toBe(first)
    expect(introLineIndex(count, s, DAY)).toBe(first)
  })

  it('a new day fronts the next tip', () => {
    const s = fakeStorage()
    introLineIndex(count, s, DAY)
    const idx = introLineIndex(count, s, DAY + 1)
    expect(lines[idx!]).toBe(CRITICAL_TIPS[1])
  })

  it('a skipped day skips no tip — days asked on, not dayKey arithmetic', () => {
    // dayKey is not day arithmetic across a month boundary (the +31/-27 seam),
    // so the cursor counts distinct days it was consulted on.
    const s = fakeStorage()
    introLineIndex(count, s, DAY)
    const idx = introLineIndex(count, s, DAY + 9)
    expect(lines[idx!]).toBe(CRITICAL_TIPS[1])
  })

  it('after the window the intro gate opens — silence becomes possible', () => {
    const s = fakeStorage()
    for (let d = 0; d <= CRITICAL_TIPS.length; d++) introLineIndex(count, s, DAY + d)
    const day = DAY + CRITICAL_TIPS.length
    expect(introLineIndex(count, s, day)).toBe(null)
  })

  it('a corrupt cursor falls back to the rotation — ties toward veteran', () => {
    const s = fakeStorage({ 'cluecab-tips-intro': 'not json' })
    expect(introLineIndex(count, s, DAY)).toBe(null)
    const wrongShape = fakeStorage({ 'cluecab-tips-intro': '{"steps":3}' })
    expect(introLineIndex(count, wrongShape, DAY)).toBe(null)
  })

  it('storage that throws or is absent falls back to the rotation', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('private mode')
      },
      setItem: (): void => {
        throw new Error('private mode')
      },
    }
    expect(introLineIndex(count, throwing, DAY)).toBe(null)
    expect(introLineIndex(count, undefined, DAY)).toBe(null)
  })
})

describe('the per-visit rotation (after the intro window)', () => {
  it('keeps the momentum line in the pool without shifting the intro sequence', () => {
    const momentum = UI.home.momentumLine
    const withMomentum = [...lines, momentum]
    const s = fakeStorage()
    const first = homeLineIndex(withMomentum.length, s, DAY, () => 0.999)
    expect(withMomentum[first]).toBe(CRITICAL_TIPS[0])
    for (let i = 0; i < CRITICAL_TIPS.length; i++) {
      expect(withMomentum[(first + i) % withMomentum.length]).toBe(CRITICAL_TIPS[i])
    }
    const veteran = fakeStorage({ 'cluecab-tips-intro': '{"n":99,"d":1}' })
    const visitOne = homeLineIndex(withMomentum.length, veteran, DAY, () => 0)
    const visitTwo = homeLineIndex(withMomentum.length, veteran, DAY, () => 0)
    expect(visitTwo).not.toBe(visitOne)
  })

  it('past the window, the caller’s random picks the line', () => {
    // homeLineIndex hands the pick to its random: a stubbed generator pins the
    // contract that the mount, not the day, chooses the line.
    const s = fakeStorage({ 'cluecab-tips-intro': '{"n":99,"d":1}' }) // past the window
    expect(homeLineIndex(count, s, DAY, () => 0)).toBe(0)
    expect(homeLineIndex(count, s, DAY, () => 0.999)).toBe(count - 1)
    expect(homeLineIndex(count, s, DAY, () => 0.5)).toBe(Math.floor(0.5 * count))
  })

  it('consecutive visits open on different lines, not one fixed index', () => {
    // A counter-random walks the pool: the point is that the SECOND mount does
    // not repeat the first, which is the owner's complaint about the daily lock.
    const s = fakeStorage({ 'cluecab-tips-intro': '{"n":99,"d":1}' })
    let n = 0
    const counter = () => (n += 1) / (count + 1) // stays under 1, increments
    const seen = new Set<number>()
    for (let i = 0; i < 6; i++) seen.add(homeLineIndex(count, s, DAY, counter))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('during the intro window the random never overrides the critical tip', () => {
    const s = fakeStorage()
    expect(homeLineIndex(count, s, DAY, () => 0.999)).toBe(introLineIndex(count, s, DAY))
    expect(lines[homeLineIndex(count, s, DAY, () => 0.99)]).toBe(CRITICAL_TIPS[0])
  })
})

describe('the silent day (Casey sometimes has nothing to say)', () => {
  it('is deterministic: the same seed says silent, a neighbouring seed says talk', () => {
    expect(silentDay(DAY - (DAY % 3))).toBe(true) // a multiple of 3
    expect(silentDay(DAY - (DAY % 3) + 1)).toBe(false)
    expect(silentDay(DAY - (DAY % 3) + 2)).toBe(false)
    expect(silentDay(DAY - (DAY % 3) + 3)).toBe(true) // and it recurs
  })

  it('is silent on roughly one day in three', () => {
    const span = 300
    const silent = Array.from({ length: span }, (_, i) => silentDay(DAY + i)).filter(Boolean).length
    expect(silent).toBe(Math.round(span / 3))
  })
})

describe('the tips list itself', () => {
  it('has Danish and German target tips in all eleven UI languages', () => {
    expect(Object.keys(TARGET_TIPS).sort()).toEqual([...ALL_UI_LANGUAGES].sort())
    expect(TARGET_TIPS.en.de).toEqual(germanCopy.tips)
    for (const language of ALL_UI_LANGUAGES) {
      expect(targetTipsFor(language, 'da')).toHaveLength(5)
      expect(targetTipsFor(language, 'de')).toHaveLength(10)
      expect([...targetTipsFor(language, 'da'), ...targetTipsFor(language, 'de')]
        .every((tip) => tip.trim().length > 0)).toBe(true)
    }
  })

  it('keeps English Danish pack copy or localized target tips and Danish supplemental facts', () => {
    const expectedTips = UI_LANGUAGE === 'en' && ACTIVE.code === 'da'
      ? ACTIVE.copy.tips
      : targetTipsFor(UI_LANGUAGE, ACTIVE.code)
    for (const tip of expectedTips) expect(lines).toContain(tip)
    if (ACTIVE.code === 'da' && UI_LANGUAGE !== 'en') {
      for (const tip of danishCopy.tips.slice(5)) expect(lines).toContain(tip)
    }
  })

  it('keeps Danish pack facts in English without unsupported percentages', () => {
    expect(danishCopy.tips).toContain('900 Danish words can go a long way in everyday conversation.')
    expect(danishCopy.tips.join('\n')).not.toMatch(/\d+\s*%/)
    expect(danishCopy.tips.join('\n')).toContain('“leg godt”')
    expect(danishCopy.tips.join('\n')).toContain('“København”')
  })

  it('adds the five German journey facts after the existing grammar tips', () => {
    expect(germanCopy.tips).toHaveLength(10)
    expect(germanCopy.tips.slice(5)).toEqual([
      'Flensburg, our first stop, is just a few kilometres from the Danish border.',
      'Germany has 16 federal states. Berlin, Hamburg and Bremen are states as well as cities!',
      'Germany borders nine countries, including Denmark, Poland and France.',
      'On their first day of school, many German children get a Schultüte: a cone full of treats.',
      'Germany’s highest mountain, the Zugspitze, rises in the Alps near the Austrian border.',
    ])
  })

  it('says each critical tip exactly once', () => {
    for (const tip of CRITICAL_TIPS) {
      expect(lines.filter((l) => l === tip)).toHaveLength(1)
    }
  })

  it('keeps retired wrap-up guidance out of Casey’s Home tips and intro', () => {
    const retiredWrapUpTips = [
      UI.casey.tipWrapToKeep,
      UI.casey.tipEarnWrapUp,
      UI.casey.tipWrapUpCardsStartInEnglish(ACTIVE.name),
      UI.casey.tipWrapUpSkipAllowed,
      UI.casey.tipWrapCityOpensRoad,
    ]
    for (const tip of retiredWrapUpTips) {
      expect(lines).not.toContain(tip)
      expect(CRITICAL_TIPS).not.toContain(tip)
    }
  })
})
