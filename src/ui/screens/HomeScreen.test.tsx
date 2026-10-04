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
import { RECEIPT_UI } from '../../i18n/receipt'
import { cafeNameForBoard } from '../../cafe/cafeName'
import { emptyProgressFacts } from '../../progression/facts'
import { firstCompletionKey } from '../../progression/identity'
import { FIXTURE_BOARD, MATRIX_FIXTURES } from '../../progression/fixtures'
import { CITY1_REQUIRED_SET, initialCourseSessions } from '../../session/courseRuntime'
import type { CourseSessions } from '../../progression/types'
import { useGame } from '../../stores/gameStore'
import { useJourney } from '../../stores/journeyStore'
import {
  actionableCourseSlot,
  cafePuzzleAction,
  cafePuzzleNote,
  HomeScreen,
  homeWalks,
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

  it('hides View result when only a completion receipt remains, and shows the city stamp where the postcard count was', () => {
    const priorGameState = useGame.getState()
    useGame.setState({
      completionReceipt: {} as NonNullable<typeof priorGameState.completionReceipt>,
      activeSlot: null,
      sessions: initialCourseSessions(emptyProgressFacts()),
    })
    try {
      const html = renderToStaticMarkup(<HomeScreen />)
      expect(html).not.toContain(UI.home.viewResult)

      // Café world (CW-10): the stamp and the city percentage replace the
      // postcard counter, and the "City medal" line is gone from the strip.
      expect(html).not.toContain('home-postcard-total')
      const stamp = html.match(/<p class="home-city-stamp" data-medal="none">([\s\S]*?)<\/p>/)
      expect(stamp).not.toBeNull()
      expect(stamp![1]).toContain('cafe-stamp-empty')
      expect(stamp![1]).toContain(`<strong class="home-city-stamp-percent" aria-hidden="true">${RECEIPT_UI.cityPercent(0)}</strong>`)
      // The medal is still said, to a screen reader, inside the stamp.
      expect(stamp![1]).toContain(UI.home.cityMedal(UI.home.cityMedalInProgress))
      expect(html).not.toContain('home-progress-status')
    } finally {
      useGame.setState(priorGameState)
    }
  })

  it('draws two tags in place of Play, and a ticket that opens the train sheet', () => {
    const priorGameState = useGame.getState()
    const priorJourney = useJourney.getState()
    useGame.setState({ activeSlot: null, sessions: initialCourseSessions(emptyProgressFacts()) })
    // The café gate is on (CW-13): the first café has been found by a walk.
    const first = CITY1_REQUIRED_SET.boards[0]!
    useJourney.setState({ cafes: { [JSON.stringify(['da', 'sonderborg'])]: { found: { [first.authoredBoardId]: 1759600000000 }, toward: 0 } } })
    try {
      const html = renderToStaticMarkup(<HomeScreen />)
      expect(html).not.toContain(`>${UI.home.play}<`)
      const tags = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
        .map((tag) => [tag[1]!.match(/class="([^"]*)"/)?.[1], tag[2], tag[1]] as const)
        .filter(([classes]) => classes?.startsWith('tag '))
      expect(tags.map((tag) => tag[0])).toEqual(['tag tag-row home-play home-tag-cafe', 'tag tag-row home-tag-sightseeing'])
      expect(tags[0]![2]).toContain('data-cafe-action="next"')
      // Danish has Words and Articles, so Sightseeing opens the chooser sheet.
      expect(tags[1]![2]).toContain('aria-haspopup="dialog"')
      expect(tags[0]![1]).toContain(`<span class="tag-label">${UI.home.cafePuzzle}</span>`)
      expect(tags[0]![1]).toContain(`<span class="tag-note">${cafeNameForBoard(CITY1_REQUIRED_SET.boards[0])}</span>`)
      expect(tags[1]![1]).toContain(`<span class="tag-label">${UI.sightseeing.title}</span>`)
      expect(tags[1]![1]).toContain(`<span class="tag-note">${UI.home.sightseeingNote}</span>`)
      expect(html).toContain(`class="home-ticket" aria-label="${UI.home.trainSheetTitle('Ribe')}" aria-haspopup="dialog"`)
    } finally {
      useGame.setState(priorGameState)
      useJourney.setState(priorJourney)
    }
  })

  it('before any walk the Café puzzle tag points the way to Sightseeing (gate on)', () => {
    const priorGameState = useGame.getState()
    useGame.setState({ activeSlot: null, sessions: initialCourseSessions(emptyProgressFacts()) })
    try {
      const html = renderToStaticMarkup(<HomeScreen />)
      expect(html).toContain('data-cafe-action="find-first"')
      expect(html).toContain(`<span class="tag-note">${UI.home.cafeNotFoundNote}</span>`)
    } finally {
      useGame.setState(priorGameState)
    }
  })

  it('in the first session it is the real Home with the doors out of the flow held (CW-13)', () => {
    const html = renderToStaticMarkup(<HomeScreen intro={{ onCafePuzzle: () => {}, onSightseeing: () => {}, onCasey: () => {} }} />)
    expect(html).toContain('home-first-session')
    expect(html).toContain('home-play home-tag-cafe')
    expect(html).toContain('home-tag-sightseeing')
    expect(html).toContain('home-city-stamp')
    // No Settings gear and no map button: neither can leave the onboarding shell.
    expect(html).not.toContain(`aria-label="${UI.home.settingsAria}"`)
    expect(html).not.toContain(`aria-label="${UI.home.openMapAria}"`)
    // Casey's bubble stays quiet: the spotlight speaks for her.
    expect(html).not.toContain('cluey-bubble')
    expect(html).not.toContain('home-postcard-total')
  })

  it('a paused round still offers to continue: the Café puzzle tag continues it', () => {
    // Pure, because a server render reads the stores' initial state: the slot
    // Home finds and the action the tag takes for it. The drives press it.
    const sessions = {
      ...initialCourseSessions(emptyProgressFacts()),
      activeSlot: 'primary',
      primary: retainedSlot('paused-primary', 'primary', 'playerGuessing'),
    } as unknown as CourseSessions
    const slot = actionableCourseSlot(null, sessions)
    const action = cafePuzzleAction(slot, nextHomeBoard(emptyProgressFacts(), null))
    expect(action).toEqual({ kind: 'continue', slot: 'primary' })
    expect(cafePuzzleNote(action)).toBe(UI.home.continuePrimary)

    const replaying = { ...sessions, activeSlot: 'replay', replay: retainedSlot('paused-replay', 'replay', 'aiClueInput') } as unknown as CourseSessions
    const replayAction = cafePuzzleAction(actionableCourseSlot('replay', replaying), null)
    expect(replayAction).toEqual({ kind: 'continue', slot: 'replay' })
    expect(cafePuzzleNote(replayAction)).toBe(UI.home.continueReplay)
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

  it('decides the Café puzzle tag in one place (the seam CW-08 extends)', () => {
    const board = CITY1_REQUIRED_SET.boards[0]!
    expect(cafePuzzleAction('primary', board)).toEqual({ kind: 'continue', slot: 'primary' })
    expect(cafePuzzleAction('replay', null)).toEqual({ kind: 'continue', slot: 'replay' })
    expect(cafePuzzleAction(null, board)).toEqual({ kind: 'next', board })
    expect(cafePuzzleAction(null, null)).toEqual({ kind: 'improve' })
    // CW-04: a café that is not found yet cannot be dealt, so the tag points at Sightseeing.
    expect(cafePuzzleAction(null, board, () => false)).toEqual({ kind: 'find-first', board })
    expect(cafePuzzleAction('primary', board, () => false)).toEqual({ kind: 'continue', slot: 'primary' })
    expect(cafePuzzleNote({ kind: 'find-first', board })).toBe(UI.home.cafeNotFoundNote)
    expect(cafePuzzleNote({ kind: 'continue', slot: 'replay' })).toBe(UI.home.continueReplay)
    expect(cafePuzzleNote({ kind: 'improve' })).toBe(UI.home.improveBoards)
    expect(cafePuzzleNote({ kind: 'next', board })).toBe(cafeNameForBoard(board))
  })

  it('offers the Articles walk only where the course has articles to choose between', () => {
    // The Danish course: en and et, so Sightseeing asks Words or Articles.
    expect(homeWalks()).toEqual({ walks: ['words', 'articles'], lanes: ['en', 'et'] })
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
