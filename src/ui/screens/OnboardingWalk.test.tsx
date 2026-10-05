import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * CW-15: the first session's walk act is never refused, even when today's
 * two walks are already counted (a reload, a resumed intro), and the walk it
 * starts counts like any other. A replayed intro's walk is a demo (owner,
 * 2026-10-04): never refused, and never counted. The admission is made while the act draws, which server rendering
 * runs, so the walk screen drawn under it already offers Start.
 */
const { capacitor } = vi.hoisted(() => ({
  capacitor: { isNativePlatform: vi.fn(() => true), getPlatform: vi.fn(() => 'ios') },
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: capacitor,
  registerPlugin: vi.fn(() => ({})),
}))

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  },
})

const { WalkAct } = await import('./OnboardingScreen')
const { useUi } = await import('../../stores/uiStore')
const { usePass } = await import('../../purchase/passStore')
const { canStartRun, countRun, endFirstWalkAdmission, RUNS_KEY } = await import('../../purchase/dailyGames')
const { runResultsSink } = await import('../../run/results')
const { replayWalkFoundCafe, uninstallReplayWalkSink } = await import('../../onboarding/replayWalk')
const { UI } = await import('../../i18n')

/** Server rendering reads a zustand store's INITIAL state, so the test writes there and puts it back. */
const uiInitial = useUi.getInitialState()
const savedUi = { ...uiInitial }

function walkActIn(persist: boolean) {
  Object.assign(uiInitial, { onboarding: { step: 'walk', persist } })
  return renderToStaticMarkup(<WalkAct skip={() => undefined} />)
}

beforeEach(() => {
  values.clear()
  usePass.setState({ status: 'not-entitled', offers: [] })
  // Today's two walks are already counted.
  countRun(Date.now())
  countRun(Date.now())
  expect(canStartRun()).toBe(false)
})
afterEach(() => {
  endFirstWalkAdmission()
  uninstallReplayWalkSink()
  Object.assign(uiInitial, savedUi)
})

describe('the first session\'s walk act', () => {
  it('offers Start past today\'s two walks: never refused', () => {
    const html = walkActIn(true)
    expect(html).toContain(UI.sightseeing.start)
    expect(canStartRun()).toBe(true)
  })

  it('counts the walk it lets through', () => {
    walkActIn(true)
    countRun(Date.now())
    expect(Object.values(JSON.parse(values.get(RUNS_KEY)!).days)).toEqual([3])
    expect(canStartRun()).toBe(false)
  })
})

describe("a replayed intro's walk act (a demo: owner, 2026-10-04)", () => {
  it("is never refused either: past today's two walks it still offers Start", () => {
    const html = walkActIn(false)
    expect(html).toContain(UI.sightseeing.start)
    expect(canStartRun()).toBe(true)
  })

  it('records nothing: no run counted, no photo, no café stored; the café is found for its screens only', () => {
    const before = new Map(values)
    walkActIn(false)
    const sink = runResultsSink()
    const at = Date.now()
    for (let i = 0; i < 6; i++) sink.photo({ walk: 'words', kind: 'meaning', wordId: 'da:hus', at: at + i } as never)
    sink.end({ walk: 'words', end: 'second-wrong', answered: 6, photos: 6, startedAt: at } as never)
    // Five photos find the city's first café, as on a first session's walk.
    expect(replayWalkFoundCafe()).toBe(true)
    // And not one storage key changed: the run count included.
    expect(new Map(values)).toEqual(before)
  })
})
