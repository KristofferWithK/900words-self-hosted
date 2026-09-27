/**
 * The v1 rescue regression (TestFlight 82/83) as a render test.
 *
 * A v1 rescue merged a full-route cityIndex back in after the rehydrate
 * clamp had removed one. The map then drew only the DEVELOPED stops (the
 * release scope, DEVELOPED_CITY_COUNT = 1) while the player's stored position
 * stood at, say, stop 3 — and `points[cityIndex]` came back undefined, so
 * `here.x` threw on the first paint and the app went white. The clamp in
 * rescueStrandedJourney is the fix; the guard in JourneyMap is the net under
 * it: an out-of-range position degrades to the last DRAWN stop instead of
 * crashing. Mutation-checked: reverting the guard's Math.min fails the
 * second test here with the original TypeError.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { UI } from '../../i18n'
import { emptyProgressFacts } from '../../progression/facts'
import { firstCompletionKey } from '../../progression/identity'
import { FIXTURE_BOARD, MATRIX_FIXTURES } from '../../progression/fixtures'
import { CITY1_REQUIRED_SET, initialCourseSessions } from '../../session/courseRuntime'
import type { CourseSessions } from '../../progression/types'
import { useGame } from '../../stores/gameStore'
import {
  actionableCourseSlot,
  HomeScreen,
  JourneyMap,
  nextHomeBoard,
  readCourseProgress,
  shouldShowReturnToPrimary,
  startHomePlay,
} from './HomeScreen'

function retainedSlot(
  attemptId: string,
  origin: 'primary' | 'replay',
  phase: 'finished' | 'playerGuessing' | 'aiClueInput',
) {
  return {
    attemptId,
    board: FIXTURE_BOARD,
    origin,
    promptLanguage: 'en' as const,
    game: { ...MATRIX_FIXTURES[0]!.game, phase },
    lookedUp: [],
    reviewRoundId: null,
    randomnessPolicy: 'engine-wheel-v1' as const,
  }
}

describe('JourneyMap route overview and rescue bounds', () => {
  it('renders the current stop while keeping future route stops visible', () => {
    const html = renderToStaticMarkup(<JourneyMap cityIndex={0} reachedTo={0} />)
    expect(html).toContain('home-map-here')
    expect(html).toContain('Sønderborg')
    expect(html.match(/class="home-dot/g)).toHaveLength(9)
  })

  it('labels current, reached and future stops for assistive technology', () => {
    const html = renderToStaticMarkup(<JourneyMap cityIndex={1} reachedTo={2} />)
    expect(html).toContain('aria-label="Sønderborg, stop 1, visited"')
    expect(html).toContain('aria-label="Ribe, stop 2, you are here"')
    expect(html).toContain('aria-label="Aarhus, stop 4, not reached yet"')
  })

  it('does not throw when a rescued position is outside the route', () => {
    const html = renderToStaticMarkup(<JourneyMap cityIndex={99} reachedTo={0} />)
    // The here-label names the last route stop, and aria agrees with it.
    expect(html).toContain('home-map-here')
    expect(html).toContain('København')
    expect(html).toContain(`aria-label="${UI.home.homeMapAria(9, 9, 'København')}"`)
  })
})

describe('Home navigation', () => {
  it('does not resume retained finished primary or replay slots even when result data is persisted', () => {
    const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const data = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key), clear: () => data.clear(), key: () => null, get length() { return data.size },
    } })
    try {
      const finishedSlot = (attemptId: string, origin: 'primary' | 'replay') => ({
        attemptId,
        board: FIXTURE_BOARD,
        origin,
        promptLanguage: 'en' as const,
        game: { ...MATRIX_FIXTURES[0]!.game, phase: 'finished' as const },
        lookedUp: [],
        reviewRoundId: null,
        randomnessPolicy: 'engine-wheel-v1' as const,
      })
      const sessions = {
        ...initialCourseSessions(emptyProgressFacts()),
        primary: finishedSlot('finished-primary', 'primary'),
        replay: finishedSlot('finished-replay', 'replay'),
      } as unknown as CourseSessions
      data.set('cluecab-progression-sessions-v1', JSON.stringify({ version: 1, state: {
        byCourse: { da: sessions },
        results: {
          'finished-primary': { receiptId: 'finished-primary', reviewRoundId: null },
          'finished-replay': { receiptId: 'finished-replay', reviewRoundId: null },
        },
        settlementEffects: {},
      } }))

      const durable = readCourseProgress()
      expect(durable.sessions?.primary?.attemptId).toBe('finished-primary')
      expect(durable.sessions?.replay?.attemptId).toBe('finished-replay')
      expect(actionableCourseSlot('primary', durable.sessions)).toBeNull()
      expect(actionableCourseSlot('replay', durable.sessions)).toBeNull()
    } finally {
      if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('uses the validated next-primary selector rather than a raw continuation key', () => {
    const facts = emptyProgressFacts()
    const sessions = initialCourseSessions(facts)
    expect(nextHomeBoard(facts, sessions)).toEqual(CITY1_REQUIRED_SET.boards[0])
  })

  it('has no new-board target after every City 1 primary completion', () => {
    const facts = emptyProgressFacts()
    const completed = Object.fromEntries(CITY1_REQUIRED_SET.boards.map((board) => [
      firstCompletionKey(board), { board, requiredSet: CITY1_REQUIRED_SET },
    ]))
    const completedFacts = { ...facts, firstPrimaryCompletions: completed }
    expect(nextHomeBoard(completedFacts, initialCourseSessions(completedFacts))).toBeNull()
  })

  it('continues paused primary and replay slots', () => {
    const sessions = {
      ...initialCourseSessions(emptyProgressFacts()),
      activeSlot: 'replay',
      primary: { attemptId: 'paused-primary', game: { phase: 'playerGuessing' } },
      replay: { attemptId: 'paused-replay', game: { phase: 'aiClueInput' } },
    } as unknown as CourseSessions
    expect(actionableCourseSlot('replay', sessions)).toBe('replay')
    expect(actionableCourseSlot('primary', sessions)).toBe('primary')
    expect(actionableCourseSlot(null, sessions)).toBe('replay')
  })

  it('falls back to the other unfinished retained slot when the active pointer is finished', () => {
    const sessions = {
      ...initialCourseSessions(emptyProgressFacts()),
      activeSlot: 'primary',
      primary: retainedSlot('finished-primary', 'primary', 'finished'),
      replay: retainedSlot('paused-replay', 'replay', 'aiClueInput'),
    } as unknown as CourseSessions

    expect(actionableCourseSlot('primary', sessions)).toBe('replay')
    expect(actionableCourseSlot(null, sessions)).toBe('replay')
  })

  it('fails closed for dangling runtime primary or replay pointers, so Home cannot call a resume that redeals', () => {
    const sessions = initialCourseSessions(emptyProgressFacts())
    expect(actionableCourseSlot('primary', sessions)).toBeNull()
    expect(actionableCourseSlot('replay', sessions)).toBeNull()
  })

  it('fails closed when a malformed or missing durable session cannot supply the requested slot', () => {
    expect(actionableCourseSlot('primary', null)).toBeNull()
    const malformed = { activeSlot: 'primary', primary: null, replay: null } as unknown as CourseSessions
    expect(actionableCourseSlot(null, malformed)).toBeNull()
  })

  it('hides View result when only a completion receipt remains and labels the postcard count accessibly', () => {
    const priorGameState = useGame.getState()
    useGame.setState({
      completionReceipt: {} as NonNullable<typeof priorGameState.completionReceipt>,
      activeSlot: null,
      sessions: initialCourseSessions(emptyProgressFacts()),
    })
    try {
      const html = renderToStaticMarkup(<HomeScreen />)
      expect(html).not.toContain(UI.home.viewResult)

      const postcard = html.match(/<p class="home-postcard-total" aria-label="([^"]+)">([\s\S]*?)<\/p>/)
      expect(postcard).not.toBeNull()
      const [, ariaLabel, visibleContent] = postcard!
      const count = visibleContent!.match(/<strong>(\d+)<\/strong>/)?.[1]
      expect(count).toBeDefined()
      expect(ariaLabel).toBe(`${count} ${UI.home.postcardsEarned}`)
      expect(visibleContent).toContain('<svg')
      expect(visibleContent).not.toContain(UI.home.postcardsEarned)
      expect(visibleContent!.replace(/<svg\b[\s\S]*?<\/svg>/, '').replace(/<\/?strong>/g, '').trim()).toBe(count)
    } finally {
      useGame.setState(priorGameState)
    }
  })

  it('does not offer Return to primary when replay is active and primary has finished', () => {
    const sessions = {
      ...initialCourseSessions(emptyProgressFacts()),
      activeSlot: 'replay',
      primary: retainedSlot('finished-primary', 'primary', 'finished'),
      replay: retainedSlot('paused-replay', 'replay', 'aiClueInput'),
    } as unknown as CourseSessions

    expect(actionableCourseSlot('replay', sessions)).toBe('replay')
    expect(shouldShowReturnToPrimary('replay', sessions)).toBe(false)
  })

  it('does not navigate to a result when Play leaves the current game finished', () => {
    let game: { phase: string } | null = { phase: 'finished' }
    const newGame = vi.fn(() => { game = { phase: 'finished' } })
    const goToGame = vi.fn()

    startHomePlay(newGame, () => game, goToGame)

    expect(newGame).toHaveBeenCalledOnce()
    expect(goToGame).not.toHaveBeenCalled()
  })
})
