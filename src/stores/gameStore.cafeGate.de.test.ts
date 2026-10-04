import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The café gate on the German course (CW-04): German City 1 plays its own
 * required set (the Danish board ids, course 'de'), and its cafés are found
 * under the German city key, apart from the Danish ones.
 */
vi.mock('../ui/speak', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/speak')>()
  return { ...actual, playWord: vi.fn(async () => 'baked' as const) }
})

const written = new Map<string, string>([['cluecab-language', 'de']])
const storage = {
  getItem: (k: string) => written.get(k) ?? null,
  setItem: (k: string, v: string) => void written.set(k, v),
  removeItem: (k: string) => void written.delete(k),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

const { ACTIVE } = await import('../lang/active')
const { useGame } = await import('./gameStore')
const { useUi } = await import('./uiStore')
const { useJourney } = await import('./journeyStore')
const { useSettings } = await import('./settingsStore')
const { requiredSetForCourse } = await import('../session/courseRuntime')
const { cafesForCity, overrideCafeGateForTests } = await import('../journey/cafeAccess')

const german = requiredSetForCourse('de')
const DE = JSON.stringify(['de', german.cityId])
const DA = JSON.stringify(['da', requiredSetForCourse('da').cityId])

beforeEach(async () => {
  overrideCafeGateForTests(true)
  await useGame.getState().finishRound()
  written.clear()
  written.set('cluecab-language', 'de')
  useGame.setState(useGame.getInitialState())
  useJourney.setState(useJourney.getInitialState())
  useSettings.setState({ ...useSettings.getInitialState(), useMock: true })
  useUi.setState({ pendingFirstGiver: 'ai', screen: 'home', onboarding: null, dailyLimitOpen: false, dailyLimitRetry: null })
})
afterAll(() => overrideCafeGateForTests(null))

describe('the German course reaches the café gate', () => {
  it('plays German and refuses its first board until the German café is found', () => {
    expect(ACTIVE.code).toBe('de')
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
    expect(useGame.getState().lastDealRefusal).toBe('cafeNotFound')
    expect(cafesForCity(0)!.set.courseId).toBe('de')
  })

  it('a Danish find does not open a German café', () => {
    useJourney.setState({ cafes: { [DA]: { found: { [german.boards[0]!.authoredBoardId]: 1 }, toward: 0 } } })
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(false)
  })

  it('the German find does', () => {
    useJourney.setState({ cafes: { [DE]: { found: { [german.boards[0]!.authoredBoardId]: 1 }, toward: 0 } } })
    expect(useGame.getState().newGame({ cityIndex: 0 })).toBe(true)
    expect(useGame.getState().authoredBoardId).toBe(german.boards[0]!.authoredBoardId)
    expect(useGame.getState().gameLanguage).toBe('de')
  })
})
