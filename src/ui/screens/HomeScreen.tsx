import { DEFAULT_BASE_URL } from '../../ai/client'
import { playsOnDevice } from '../../ai/gemma/gate'
import { TrainNoticeDialog } from '../components/TrainNoticeDialog'
import { CITIES, FINAL_CITY_INDEX, cityAt } from '../../journey/cities'
import { MAP, routePath } from '../../journey/map'
import { cityMedal, hasHistoricalTravelEligibility } from '../../journey/progress'
import { cityWords as cityWordList } from '../../journey/cityWords'
import { countMarks, type PhotoLedger } from '../../journey/wordMarks'
import type { SrsMap } from '../../srs/types'
import { articleLanes, chooseWalk, walksForCourse } from '../../run/walks'
import { cafeNameForBoard } from '../../cafe/cafeName'
import { cafeLaunchRefused } from '../../journey/cafeAccess'
import { dealOrFallBack } from '../cafeDeal'
import { beginRunOrOffer } from '../runGate'
import { CafeStamp } from '../components/CafeStamp'
import { displayCityPercent } from '../components/finishStamp'
import { SightseeingChooser, TrainSheet, type HomeWalk } from '../components/HomeSheets'
import { Tag } from '../components/Tag'
import { journeyTravelGate } from '../../journey/trainService'
import { onPracticeCompanion, useGame } from '../../stores/gameStore'
import { reachedIndex, useJourney } from '../../stores/journeyStore'
import { useSettings } from '../../stores/settingsStore'
import { useUi } from '../../stores/uiStore'
import { Cluey } from '../components/Cluey'
import { ACTIVE } from '../../lang/active'
import { TrainProgress, TrainRunner } from '../components/TrainProgress'
import { useCityTrain } from '../components/TrainRunPanel'
import { usePass } from '../../purchase/passStore'
import { buildAudience } from '../../build/audience'
import { useSrs } from '../../stores/srsStore'
import { WORDS } from '../../data/words'
import { TravelGuideButton } from '../components/TravelGuideButton'
import { UI } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { createSettlementStore } from '../../stores/settlementStore'
import { emptyProgressFacts } from '../../progression/facts'
import type { BoardIdentity, CourseSessions, ProgressFacts, Tier } from '../../progression/types'
import { TravelGuideBook } from './TravelGuideBook'
import { useCallback, useMemo, useState } from 'react'

/**
 * Home in three bands, per the notebook sketch: the journey (map and
 * progress) on top, Casey in the middle with something to say, and the games
 * at the bottom. Nothing scrolls; anything deeper lives one tap away — the map,
 * the case, Settings behind the gear. The daily star and the rules button
 * that used to flank Play are gone (owner, 2026-09-15): the daily board and
 * the rules overlay remain reachable through their own screens.
 *
 * Café world (card CW-10, docs/design/cafe-world/design-home-settled.jpg and
 * contract section 6): two white tags, "Café puzzle" and "Sightseeing", in
 * place of Play; at the back of the train strip someone running after the
 * train, and a "Catch the train" tag that opens the train sheet (owner,
 * 2026-10-04, in place of the ticket at its left end); the city's stamp and percentage under the Guide where the
 * postcard count was; no "City medal" line. The first session shows this
 * same Home with its doors routed by onboarding (CW-13, `intro` below).
 *
 * Casey is the biggest thing on the screen and that is the point: she is the
 * app's face and its store screenshot. Everything above him is a strip. The
 * progress band in particular is *one line that cannot wrap* — the train to
 * the next city, and the two numbers that mean something. The four-part count
 * it replaced took three lines at 360px and pushed him down into a thumbnail;
 * the rest of the breakdown lives in the suitcase, which is where a breakdown
 * belongs.
 */

/** Local date key + seed: the same daily board for everyone on that date. */
function dailyChallenge() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    key: `${y}-${m}-${d}`,
    seed: y * 10000 + (now.getMonth() + 1) * 100 + now.getDate(),
  }
}

/**
 * The route overview is drawn small enough to live above the fold. `reachedTo`
 * is the furthest stop reached, which since Travel back can be past the one
 * the traveller stands at: the line is drawn to there, the dot is drawn here.
 * Future stops remain visible for orientation; train access is gated elsewhere.
 */
/** Exported for the rescue-regression render test (HomeScreen.test.tsx). */
export function JourneyMap({ cityIndex, reachedTo = cityIndex }: { cityIndex: number; reachedTo?: number }) {
  // The overview shows the whole route; release/access gates are not map
  // visibility gates. Reached and future legs remain distinct below.
  const drawnCount = CITIES.length
  const points = CITIES.slice(0, drawnCount).map((c) => MAP.project(c.lon, c.lat))
  const done = routePath(points.slice(0, Math.min(reachedTo + 1, drawnCount)))
  // Future route legs stay visible even while their destinations are closed.
  const ahead = routePath(points.slice(Math.min(reachedTo, drawnCount - 1)))
  // Defense in depth against a position past the drawn stops — the rescue
  // regression (TestFlight 82/83) this file once crashed on: a v1 rescue
  // merged a full-route cityIndex back in after the rehydrate clamp, here
  // only 1 stop is drawn, and `points[cityIndex]` came back undefined. The
  // clamp in rescueStrandedJourney is the fix; this read degrades to the last
  // DRAWN stop instead of white-screening if an out-of-range position ever
  // reaches the map again. Dot, label and aria all read the clamped index, so
  // the degraded map is self-consistent — one city, named once.
  const hereIndex = Math.min(Math.max(cityIndex, 0), points.length - 1)
  const here = points[hereIndex]!
  // Past this the widest city name cannot be centred and stay in frame; see
  // the label comment below for the measurement.
  const atEastEdge = here.x > MAP.width - 160

  return (
    <svg
      className="home-map"
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      role="img"
      aria-label={UI.home.homeMapAria(hereIndex + 1, drawnCount, cityAt(hereIndex).name)}
    >
      <path className="map-land" d={MAP.path} />
      <path className="map-hatch" d={MAP.hatch} />
      <path className="map-sketch" d={MAP.sketch} />
      <path className="map-route-ahead" d={ahead} />
      <path className="map-route-done" d={done} />
      {points.map((p, i) => (
        <circle
          key={CITIES[i]!.id}
          className={`home-dot ${i === hereIndex ? 'dot-here' : i <= reachedTo ? 'dot-done' : 'dot-ahead'}`}
          cx={p.x}
          cy={p.y}
          r={i === hereIndex ? 26 : 14}
          role="img"
          aria-label={UI.home.stopAria(
            CITIES[i]!.name,
            i + 1,
            i === hereIndex ? UI.home.statusHere : i <= reachedTo ? UI.home.statusVisited : UI.home.statusNotReached,
          )}
        >
          <title>
            {UI.home.stopAria(
              CITIES[i]!.name,
              i + 1,
              i === hereIndex ? UI.home.statusHere : i <= reachedTo ? UI.home.statusVisited : UI.home.statusNotReached,
            )}
          </title>
        </circle>
      ))}
      {/* Skagen sits at the top of the map, where a label above the dot falls
          outside the viewBox — flip it below.

          The east coast needs more than a clamped centre since the Bornholm
          crop took the frame from 1000 to 680. København's dot is at x 625,
          and the name is 237 units wide at 40px — so clamping its ANCHOR to
          width-110 (570) still hung 118.5 units of name past a 680 edge, which
          layout-drive reads as 2.8px over at 390 wide. Anchor to the edge
          itself and let the name run inward instead. At width 1000 the clamp
          never engaged here, which is why this only appeared with the crop. */}
      <text
        className="home-map-here"
        x={atEastEdge ? MAP.width - 12 : Math.min(Math.max(here.x, 110), MAP.width - 110)}
        y={here.y < 90 ? here.y + 62 : here.y - 42}
        textAnchor={atEastEdge ? 'end' : 'middle'}
      >
        {cityAt(hereIndex).name}
      </text>
    </svg>
  )
}

/**
 * Home inside the first session (CW-13). It is the REAL Home: the same tags,
 * stamp and train strip a player meets every day, never a staged copy (the
 * staged intro Home and its postcard total are gone). The first session only
 * routes its doors: while onboarding owns the screen, the Café puzzle tag,
 * Sightseeing and Casey go where the flow goes next, and the doors that would
 * leave the flow (the map, Settings) stand still. The Travel Guide opens in
 * place, as the staged Home's did.
 */
export interface HomeIntroPresentation {
  /** The Café puzzle tag's action in this act. */
  onCafePuzzle: () => void
  /** The Sightseeing tag's action in this act. */
  onSightseeing: () => void
  /** Tapping Casey (the suitcase door) in this act. */
  onCasey: () => void
  /**
   * The Café puzzle tag's small line, when the act sets it: a replayed intro
   * names the city's first café there, as a first session sees it, whatever
   * the player's own next board is. Omitted, Home says what the tag would do.
   */
  cafeNote?: string | null
}

export function HomeScreen({ intro }: { intro?: HomeIntroPresentation } = {}) {
  return <StandardHomeScreen intro={intro} />
}

/**
 * Home and Map read the durable readers, not a guessed win/cache flag. A bad
 * local record fails closed to a new, empty projection; recovery remains the
 * game store's responsibility.
 */
export function readCourseProgress(): { facts: ProgressFacts; sessions: CourseSessions | null } {
  if (typeof localStorage === 'undefined') return { facts: emptyProgressFacts(), sessions: null }
  try {
    const store = createSettlementStore({ storage: localStorage })
    const sessionState = store.readSessions()
    const ledger = store.readLedger()
    return { facts: ledger.facts, sessions: sessionState.byCourse[ACTIVE.code] ?? null }
  } catch {
    return { facts: emptyProgressFacts(), sessions: null }
  }
}

/**
 * The active runtime projection is cleared while Home is mounted, but the
 * validated course session keeps the paused slot. Only an unfinished slot is
 * resumable here.
 */
export function actionableCourseSlot(activeSlot: 'primary' | 'replay' | null, sessions: CourseSessions | null): 'primary' | 'replay' | null {
  const preferred = activeSlot ?? sessions?.activeSlot ?? null
  const isUnfinished = (slot: 'primary' | 'replay') => {
    const retained = sessions?.[slot]
    return retained !== null && retained !== undefined && retained.game.phase !== 'finished'
  }

  if (preferred && isUnfinished(preferred)) return preferred
  if (!preferred) return null

  const fallback = preferred === 'primary' ? 'replay' : 'primary'
  return isUnfinished(fallback) ? fallback : null
}

export function shouldShowReturnToPrimary(
  courseSlot: 'primary' | 'replay' | null,
  sessions: CourseSessions | null,
): boolean {
  return courseSlot === 'replay' && sessions?.primary != null && sessions.primary.game.phase !== 'finished'
}

export function startHomePlay(
  deal: () => void,
  currentGame: () => { phase: string } | null | undefined,
  goToGame: () => void,
): void {
  deal()
  const game = currentGame()
  if (game && game.phase !== 'finished') goToGame()
}

export function nextHomeBoard(facts: ProgressFacts, sessions: CourseSessions | null) {
  try { return nextRequiredBoard(sessions ?? initialCourseSessions(facts), facts) } catch { return null }
}

function tierLabel(tier: Tier | null) {
  if (tier === null) return UI.home.cityMedalInProgress
  return RECEIPT_UI[tier]
}

/**
 * What the Café puzzle tag does. THE SEAM FOR CW-08: one function decides
 * the tag's action, and Home only draws and runs what it returns. Card CW-08
 * (cafés on the board, which café is next) extends this with kinds of its
 * own without touching the tag.
 *
 * - `continue`: a paused round is waiting; the tag continues it.
 * - `next`: no round waiting; the tag starts the next café's board, as Play did.
 * - `find-first`: the next café has not been found in Sightseeing yet (CW-04's
 *   rule; `mayLaunch` asks it), so the board game would refuse to deal it. The
 *   tag opens Sightseeing with a line saying so.
 * - `improve`: every board of the city has been played; the tag opens the
 *   suitcase to improve them, as Play did.
 */
export type CafePuzzleAction =
  | { readonly kind: 'continue'; readonly slot: 'primary' | 'replay' }
  | { readonly kind: 'next'; readonly board: BoardIdentity }
  | { readonly kind: 'find-first'; readonly board: BoardIdentity }
  | { readonly kind: 'improve' }

export function cafePuzzleAction(
  courseSlot: 'primary' | 'replay' | null,
  nextBoard: BoardIdentity | null,
  mayLaunch: (board: BoardIdentity) => boolean = () => true,
): CafePuzzleAction {
  if (courseSlot) return { kind: 'continue', slot: courseSlot }
  if (!nextBoard) return { kind: 'improve' }
  if (!mayLaunch(nextBoard)) return { kind: 'find-first', board: nextBoard }
  return { kind: 'next', board: nextBoard }
}

/** The small line under "Café puzzle": the café it opens, or what it continues. */
export function cafePuzzleNote(action: CafePuzzleAction): string | null {
  switch (action.kind) {
    case 'continue':
      return action.slot === 'primary' ? UI.home.continuePrimary : UI.home.continueReplay
    case 'improve':
      return UI.home.improveBoards
    case 'find-first':
      return UI.home.cafeNotFoundNote
    case 'next':
      return cafeNameForBoard(action.board)
  }
}

/**
 * Sightseeing's walks for the active course: Words always, Articles where the
 * course's nouns have articles to choose between (src/run/walks.ts).
 */
export function homeWalks() {
  const lanes = articleLanes(ACTIVE)
  return { walks: walksForCourse(ACTIVE), lanes }
}

/**
 * The city's stamp under the Guide, where the postcard count was: the stamp in
 * the city medal's ink (an empty dashed place below Bronze) and the city's
 * percentage under it. Not a control. The screen-reader line says the same in
 * words, and keeps the medal the removed "City medal" line used to name.
 */
function HomeCityStamp({ cityName, medal, percent }: { cityName: string; medal: Tier | null; percent: number }) {
  return (
    <p className="home-city-stamp" data-medal={medal ?? 'none'}>
      <CafeStamp
        tier={medal}
        ring={medal ? RECEIPT_UI.stampRing[medal] : undefined}
        emptyLabel={medal ? undefined : UI.home.stampNone}
        className="home-city-stamp-glyph"
      />
      <strong className="home-city-stamp-percent" aria-hidden="true">{RECEIPT_UI.cityPercent(percent)}</strong>
      <span className="visually-hidden">
        {UI.home.cityStampAria(cityName, RECEIPT_UI.cityPercent(percent))} {UI.home.cityMedal(tierLabel(medal))}
      </span>
    </p>
  )
}

/** The train sheet for the city the player stands in; see HomeSheets.tsx. */
function HomeTrainSheet({ cityIndex, nextCity, srs, photos, onClose }: {
  cityIndex: number
  nextCity: string | null
  srs: SrsMap
  photos: PhotoLedger
  onClose: () => void
}) {
  const words = useMemo(() => cityWordList(WORDS, cityIndex), [cityIndex])
  const marks = useMemo(() => countMarks(words, srs, photos), [words, srs, photos])
  const connecting = words.filter((w) => w.kind === 'connecting').length
  const here = cityAt(cityIndex).name
  return (
    <TrainSheet
      title={nextCity ? UI.home.trainSheetTitle(nextCity) : UI.home.trainJourneyOver}
      cityWords={UI.home.trainSheetWords(here, words.length, words.length - connecting, connecting)}
      collected={marks.collected}
      total={marks.total}
      onClose={onClose}
    />
  )
}

function StandardHomeScreen({ intro }: { intro?: HomeIntroPresentation }) {
  const goTo = useUi((s) => s.goTo)
  const pendingSeed = useUi((s) => s.pendingSeed)
  const newGame = useGame((s) => s.newGame)
  const migrationNotice = useGame((s) => s.migrationNotice)
  const dismissMigrationNotice = useGame((s) => s.dismissMigrationNotice)
  const resumePrimary = useGame((s) => s.resumePrimary)
  const resumeReplay = useGame((s) => s.resumeReplay)
  const activeSlot = useGame((s) => s.activeSlot)
  const runtimeSessions = useGame((s) => s.sessions)
  const settings = useSettings()
  const journey = useJourney()
  const passStatus = usePass((s) => s.status)
  const srsStats = useSrs((s) => s.stats)
  const durable = readCourseProgress()
  const sessions = runtimeSessions ?? durable.sessions
  // Inside the intro no round is "waiting": its doors go where the flow goes,
  // so the Café puzzle tag never offers to continue a game there (a replayed
  // intro over a paused round used to say "Continue board"). The paused round
  // itself is untouched and is offered again on the ordinary Home after.
  const courseSlot = intro ? null : actionableCourseSlot(activeSlot, sessions)
  const nextBoard = nextHomeBoard(durable.facts, sessions)
  // Casey's sticker: the words in the case, counted the way the suitcase's
  // "All" view counts its lid — words with all three marks (CW-02's model,
  // board and connecting words alike), over every city reached — so the
  // number on the outside is the number inside. It replaced the daily streak
  // (owner, 2026-09-30); it counts marks since CW-11.
  const reachedTo = reachedIndex(journey)
  const photos = journey.photos
  const collected = useMemo(() => {
    const words = Array.from({ length: reachedTo + 1 }, (_, i) => cityWordList(WORDS, i)).flat()
    return countMarks(words, srsStats, photos ?? {}).collected
  }, [reachedTo, srsStats, photos])
  // A preview pack has no nine hundred words to promise, so it makes no
  // promise: the momentum line is a claim about a word list that is empty.
  const momentumLine = ACTIVE.readiness === 'preview' ? undefined : UI.home.momentumLine
  const atRoadsEnd = journey.cityIndex >= FINAL_CITY_INDEX
  const nextCity = atRoadsEnd ? null : cityAt(journey.cityIndex + 1)
  const city = { courseId: ACTIVE.code, cityId: cityAt(journey.cityIndex).id }
  const travel = journeyTravelGate({
    facts: durable.facts,
    city,
    cityIndex: journey.cityIndex,
    historicalEligibility: hasHistoricalTravelEligibility(journey.historicalTravelEligibility, city),
    passStatus,
    audience: buildAudience,
    developerTravel: settings.playtestTravel,
  })
  // The strip loads with the city's collected words (CW-07): the train run is
  // the way on, and its slips come from them. Not postcards any more.
  const cityTrain = useCityTrain(journey.cityIndex)
  // The city's stamp (CW-03's percentage medal), floored for display the way
  // the finish screen floors it, so 100% shows only at Platinum.
  const stampCard = cityMedal(durable.facts, CITY1_REQUIRED_SET)
  const medal = stampCard.tier
  const cityPercent = stampCard.error ? 0 : displayCityPercent(stampCard.points, stampCard.maximum)
  const [sheet, setSheet] = useState<'none' | 'sightseeing' | 'find-cafe' | 'train'>('none')
  // The first session's Home opens the Guide in place: `goTo` cannot leave
  // the onboarding shell (CW-13).
  const [introGuide, setIntroGuide] = useState(false)
  const closeSheet = useCallback(() => setSheet('none'), [])
  const walks = useMemo(homeWalks, [])
  const board = () => {
    if (!travel.canBoard) return
    const destination = journey.cityIndex + 1
    journey.travel(Date.now())
    useUi.getState().boardTrain(destination)
  }

  /**
   * The daily star is gone from Home (owner, 2026-09-15). The mechanism is
   * deliberately kept: `dailyChallenge` names today's shared board and
   * `playDaily` deals it, and both are expected to return as a control
   * elsewhere — the dailyKey store machinery (gameStore) and the
   * `cluecab-daily:` outcome ledger below it still depend on nothing here.
   */
  const daily = dailyChallenge()
  void daily
  // The banner is for any Casey path that needs device setup and has never
  // answered: either a custom service or the explicit on-device Gemma trial.
  // The default Worker needs no device setup.
  //
  // `klausVerifiedAt` is stamped the moment Casey replies in ordinary play, so
  // this clears itself on the first round that works — and the store resets it
  // whenever the Base URL changes, so it re-arms if you point the
  // app somewhere new. The local practice companion suppresses it as before:
  // that dev-only path needs nothing, and the round itself says so.
  const ownConnection =
    playsOnDevice(settings.caseyMode) ||
    settings.baseUrl.trim().replace(/\/+$/, '') !== DEFAULT_BASE_URL
  const unverifiedCluey =
    !onPracticeCompanion() && ownConnection && settings.klausVerifiedAt === null

  // A deal the gate refuses (the café is not found yet: the tag's own check
  // can be a frame stale) opens Sightseeing with the line that says why.
  const play = () => startHomePlay(
    () => dealOrFallBack(() => newGame({ seed: pendingSeed ?? undefined, cityIndex: journey.cityIndex }), () => setSheet('find-cafe')),
    () => useGame.getState().game,
    () => goTo('game'),
  )

  const playDaily = () => {
    if (newGame({ seed: daily.seed, dailyKey: daily.key, cityIndex: journey.cityIndex })) goTo('game')
  }
  // playDaily is kept with dailyChallenge (above) for the daily feature's
  // return; no Home control calls it since the star came off (owner, 2026-09-15).
  void playDaily

  const continueSlot = (slot: 'primary' | 'replay') => {
    if (slot === 'primary') resumePrimary()
    else resumeReplay()
    goTo('game')
  }

  // Asks the launch gate itself (CW-04), so with the gate off it never refuses.
  const cafe = cafePuzzleAction(courseSlot, nextBoard, (board) => !cafeLaunchRefused(board, durable.facts, sessions?.continuation))
  const runCafePuzzle = () => {
    if (intro) return intro.onCafePuzzle()
    if (cafe.kind === 'continue') continueSlot(cafe.slot)
    else if (cafe.kind === 'improve') goTo('suitcase')
    else if (cafe.kind === 'find-first') setSheet('find-cafe')
    else play()
  }

  // Sightseeing asks "Words or Articles?" only where the course has both;
  // otherwise it goes straight to the Words walk. Both doors ask the daily
  // limit first (CW-15): with today's two runs used, the upgrade dialog opens
  // instead of the chooser or the walk.
  const walk = (choice: HomeWalk) => {
    setSheet('none')
    beginRunOrOffer(() => {
      chooseWalk(choice)
      useUi.getState().goTo('sightseeing')
    })
  }
  const sightseeing = () => {
    if (intro) return intro.onSightseeing()
    if (walks.walks.length > 1) beginRunOrOffer(() => setSheet('sightseeing'))
    else walk('words')
  }

  if (introGuide) return <TravelGuideBook onExit={() => setIntroGuide(false)} />
  return (
    <div className={`screen home-screen${intro ? ' home-first-session' : ''}`}>
      <header className="home-top">
        <h1 className="home-title" aria-label={UI.home.brandName}><span aria-hidden="true">{UI.home.brandName.slice(0, 3)}</span><span aria-hidden="true">{UI.home.brandName.slice(3)}</span></h1>
        {/* Settings is a door out of the first session: it waits until after. */}
        {intro ? <span className="game-header-placeholder" aria-hidden="true" /> : (
          <button className="icon-btn" aria-label={UI.home.settingsAria} onClick={() => goTo('settings')}>
            ⚙
          </button>
        )}
      </header>

      <div className="home-map-controls">
        {intro ? (
          <div className="map-button" aria-hidden="true">
            <JourneyMap cityIndex={journey.cityIndex} reachedTo={reachedTo} />
          </div>
        ) : (
          <button className="map-button" onClick={() => goTo('map')} aria-label={UI.home.openMapAria}>
            <JourneyMap cityIndex={journey.cityIndex} reachedTo={reachedTo} />
          </button>
        )}
        <div className="home-guide-stack">
          <TravelGuideButton onClick={() => (intro ? setIntroGuide(true) : goTo('guide'))} />
          <HomeCityStamp cityName={cityAt(journey.cityIndex).name} medal={medal} percent={cityPercent} />
        </div>
      </div>

      <section className="city-card home-progress-band">
        {/* The train, and someone running after it at its back end (owner,
            2026-10-04): one line, the runner on the train's own rail. */}
        <div className="home-train-line">
          <TrainProgress
            earned={cityTrain.collected}
            goal={cityTrain.total}
            label={travel.canBoard && nextCity ? UI.home.boardTrain(nextCity.name) : UI.sightseeing.trainStripLabel(cityTrain.collected, cityTrain.total, cityTrain.slips)}
            onBoard={travel.canBoard ? board : undefined}
          />
          <TrainRunner />
        </div>
        {/* The door to the train sheet, where the ticket at the strip's left
            end was. One small line, named for what it does; the slips are in
            the train's own sentence. */}
        <Tag
          className="home-catch-train"
          label={UI.sightseeing.trainTitle}
          aria-label={UI.sightseeing.trainTitle}
          aria-haspopup="dialog"
          onClick={() => setSheet('train')}
        />
        {/* The "City medal" line is gone (the stamp above says it). The travel
            gate's own line stays until CW-07 moves the gate to the train run:
            it shows only once the gate is ready, so the strip is one line. */}
        {travel.ready && (
          <p className="home-progress-status" role="status">
            {travel.destinationAvailable ? UI.home.readyToTravel : UI.home.nextStopNotReleased(nextCity?.name ?? '')}
          </p>
        )}
      </section>

      <Cluey needsConnection={unverifiedCluey} collected={collected} momentumLine={momentumLine} onOpenSuitcase={intro?.onCasey} />

      {/* A preview pack has a route, a map and a Travel Guide, and no boards.
          Every way into a round is replaced by one panel that says so and
          points at the thing that IS there — rather than by a disabled Play
          that gives the player nothing to do. See `LanguagePack.readiness`. */}
      {ACTIVE.readiness === 'preview' ? (
        <div className="home-actions home-preview" role="status">
          <h2 className="home-preview-heading">{UI.home.previewHeading}</h2>
          <p className="home-preview-note">{UI.home.previewNote}</p>
          <Tag size="wide" tone="primary" className="home-preview-guide" label={UI.home.previewGuideCta} onClick={() => goTo('guide')} />
        </div>
      ) : (
      <div className="home-actions home-tag-actions">
        {shouldShowReturnToPrimary(courseSlot, sessions) && (
          <Tag size="wide" className="home-play-second" label={UI.home.returnToPrimary} onClick={() => continueSlot('primary')} />
        )}
        <div className="home-tags">
          {/* `home-play` stays on the Café puzzle tag: it is the board game's
              door, as Play was, and the drives find it by that name. */}
          <Tag
            className="home-play home-tag-cafe"
            label={UI.home.cafePuzzle}
            note={intro?.cafeNote !== undefined ? intro.cafeNote : cafePuzzleNote(cafe)}
            data-cafe-action={cafe.kind}
            aria-haspopup={cafe.kind === 'find-first' ? 'dialog' : undefined}
            onClick={runCafePuzzle}
          />
          <Tag
            className="home-tag-sightseeing"
            label={UI.sightseeing.title}
            note={UI.home.sightseeingNote}
            aria-haspopup={walks.walks.length > 1 ? 'dialog' : undefined}
            onClick={sightseeing}
          />
        </div>
      </div>
      )}
      {(sheet === 'sightseeing' || sheet === 'find-cafe') && (
        <SightseeingChooser
          walks={walks.walks}
          lead={sheet === 'find-cafe' ? UI.home.cafeNotFoundLine : undefined}
          articleAsk={UI.sightseeing.articleAsk(walks.lanes.slice(0, -1).join(', '), walks.lanes[walks.lanes.length - 1] ?? '')}
          lanes={walks.lanes.length}
          onChoose={walk}
          onClose={closeSheet}
        />
      )}
      {sheet === 'train' && (
        <HomeTrainSheet cityIndex={journey.cityIndex} nextCity={nextCity?.name ?? null} srs={srsStats} photos={journey.photos} onClose={closeSheet} />
      )}
      {migrationNotice && <TrainNoticeDialog title={UI.game.legacyRetiredTitle} body={UI.game.legacyRetiredBody}
        action={UI.game.close} onAction={dismissMigrationNotice} onClose={dismissMigrationNotice} />}
    </div>
  )
}
