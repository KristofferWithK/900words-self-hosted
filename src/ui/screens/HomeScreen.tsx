import { DEFAULT_BASE_URL } from '../../ai/client'
import { playsOnDevice } from '../../ai/gemma/gate'
import { TrainNoticeDialog } from '../components/TrainNoticeDialog'
import { CITIES, FINAL_CITY_INDEX, cityAt } from '../../journey/cities'
import { MAP, routePath } from '../../journey/map'
import { cityMedal, cityPostcards, hasHistoricalTravelEligibility } from '../../journey/progress'
import { journeyTravelGate } from '../../journey/trainService'
import { onPracticeCompanion, useGame } from '../../stores/gameStore'
import { reachedIndex, useJourney } from '../../stores/journeyStore'
import { useSettings } from '../../stores/settingsStore'
import { useUi } from '../../stores/uiStore'
import { Cluey, ClueyFace } from '../components/Cluey'
import { ACTIVE } from '../../lang/active'
import { TrainProgress } from '../components/TrainProgress'
import { usePass } from '../../purchase/passStore'
import { buildAudience } from '../../build/audience'
import { currentStreak, useStreak } from '../../streak/streak'
import { TravelGuideButton } from '../components/TravelGuideButton'
import { UI } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'
import { CITY1_REQUIRED_SET, initialCourseSessions, nextRequiredBoard } from '../../session/courseRuntime'
import { createSettlementStore } from '../../stores/settlementStore'
import { emptyProgressFacts } from '../../progression/facts'
import type { CourseSessions, ProgressFacts, Tier } from '../../progression/types'
import { PROVISIONAL_TRAVEL_THRESHOLD } from '../../progression/rules'
import { TravelGuideBook } from './TravelGuideBook'
import { useState } from 'react'
import { PostcardGlyph } from '../components/PostcardGlyph'

/**
 * Home in three bands, per the notebook sketch: the journey (map and
 * progress) on top, Casey in the middle with something to say, and Play at
 * the bottom. Nothing scrolls; anything deeper lives one tap away — the map,
 * the case, Settings behind the gear. The daily star and the rules button
 * that used to flank Play are gone (owner, 2026-09-15): the daily board and
 * the rules overlay remain reachable through their own screens, and Play now
 * fills the row it once shared.
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

export type HomeIntroStage = 'welcome' | 'map' | 'guide' | 'play' | 'return'

export interface HomeIntroPresentation {
  stage: HomeIntroStage
  line: string
  onAdvance: () => void
  onPlay: () => void
  onCasey: () => void
}

/**
 * The first-run version of Home. The real map, guide and Play affordances
 * occupy their final positions, but begin invisible so the first frame truly
 * contains only Casey and her bubble. Each acknowledgement reveals one more
 * piece; CSS moves Casey down as the map arrives instead of cutting to a
 * separate explanatory screen.
 */
function IntroHome({ intro }: { intro: HomeIntroPresentation }) {
  const [guideOpen, setGuideOpen] = useState(false)
  const mapVisible = intro.stage !== 'welcome'
  const guideVisible = intro.stage === 'guide' || intro.stage === 'play' || intro.stage === 'return'
  const playVisible = intro.stage === 'play' || intro.stage === 'return'
  const returning = intro.stage === 'return'

  if (guideOpen) return <TravelGuideBook onExit={() => setGuideOpen(false)} />
  return (
    <div className={`screen home-screen home-intro home-intro-${intro.stage}`} data-intro-stage={intro.stage}>
      <div className={`home-map-controls home-intro-map-controls${mapVisible ? ' is-visible' : ''}`}>
        <div className="map-button home-intro-map" aria-hidden={!mapVisible}>
          <JourneyMap cityIndex={0} />
        </div>
        {returning ? (
          // Back from the first full board: the same Guide corner as ordinary
          // Home, with the city's real postcard total beneath it.
          <div className="home-guide-stack home-intro-guide is-visible">
            <TravelGuideButton onClick={() => setGuideOpen(true)} />
            <HomePostcardTotal cityIndex={0} />
          </div>
        ) : (
          <TravelGuideButton className={`home-intro-guide${guideVisible ? ' is-visible' : ''}`} onClick={() => setGuideOpen(true)} disabled={!guideVisible} />
        )}
      </div>

      <div className="cluey-band home-intro-casey">
        {!returning && (
          <button
            type="button"
            className="cluey-bubble home-intro-bubble"
            aria-label={UI.onboarding.introBubbleAria(intro.line)}
            onClick={intro.onAdvance}
          >
            {intro.line}
          </button>
        )}
        <button
          type="button"
          className="cluey-button"
          aria-label={
            returning ? UI.onboarding.introCaseyOpen : UI.onboarding.introCaseyContinue
          }
          onClick={returning ? intro.onCasey : intro.onAdvance}
        >
          <div className="cluey-live"><ClueyFace mood={returning ? 'happy' : 'idle'} /></div>
        </button>
      </div>

      <div className={`home-actions home-intro-actions${playVisible ? ' is-visible' : ''}`}>
        <button
          type="button"
          className="btn btn-primary btn-big home-play"
          onClick={intro.onPlay}
          disabled={!playVisible || returning}
          tabIndex={playVisible && !returning ? 0 : -1}
          aria-hidden={!playVisible}
        >
          {returning ? UI.onboarding.introTapCasey : UI.onboarding.introPlayFirst}
        </button>
      </div>
    </div>
  )
}

/**
 * The city's postcard total, read from the durable ledger on every render.
 * Ordinary Home and the returning intro Home share it, so the number the
 * onboarding points at is the number Home will keep showing.
 */
function HomePostcardTotal({ cityIndex, facts }: { cityIndex: number; facts?: ProgressFacts }) {
  const postcardsEarned = cityPostcards(facts ?? readCourseProgress().facts, { courseId: ACTIVE.code, cityId: cityAt(cityIndex).id })
  return (
    <p className="home-postcard-total" aria-label={`${postcardsEarned} ${UI.home.postcardsEarned}`}>
      <PostcardGlyph /> <strong>{postcardsEarned}</strong>
    </p>
  )
}

export function HomeScreen({ intro }: { intro?: HomeIntroPresentation } = {}) {
  return intro ? <IntroHome intro={intro} /> : <StandardHomeScreen />
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

function StandardHomeScreen() {
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
  const completedDays = useStreak((s) => s.completedDays)
  const durable = readCourseProgress()
  const sessions = runtimeSessions ?? durable.sessions
  const courseSlot = actionableCourseSlot(activeSlot, sessions)
  const nextBoard = nextHomeBoard(durable.facts, sessions)
  const now = Date.now()
  const streak = currentStreak(completedDays, now)
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
  const medal = cityMedal(durable.facts, CITY1_REQUIRED_SET).tier
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

  const play = () => startHomePlay(
    () => newGame({ seed: pendingSeed ?? undefined, cityIndex: journey.cityIndex }),
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

  return (
    <div className="screen home-screen">
      <header className="home-top">
        <h1 className="home-title" aria-label={UI.home.brandName}><span aria-hidden="true">{UI.home.brandName.slice(0, 3)}</span><span aria-hidden="true">{UI.home.brandName.slice(3)}</span></h1>
        <button className="icon-btn" aria-label={UI.home.settingsAria} onClick={() => goTo('settings')}>
          ⚙
        </button>
      </header>

      <div className="home-map-controls">
        <button className="map-button" onClick={() => goTo('map')} aria-label={UI.home.openMapAria}>
          <JourneyMap cityIndex={journey.cityIndex} reachedTo={reachedIndex(journey)} />
        </button>
        <div className="home-guide-stack">
          <TravelGuideButton onClick={() => goTo('guide')} />
          <HomePostcardTotal cityIndex={journey.cityIndex} facts={durable.facts} />
        </div>
      </div>

      <section className="city-card home-progress-band">
        <TrainProgress
          earned={travel.earned}
          goal={PROVISIONAL_TRAVEL_THRESHOLD}
          label={travel.canBoard && nextCity ? UI.home.boardTrain(nextCity.name) : UI.home.postcardReadiness(travel.earned, travel.remaining)}
          onBoard={travel.canBoard ? board : undefined}
        />
        <p className="home-progress-status" role="status">
          {travel.ready
            ? travel.destinationAvailable ? UI.home.readyToTravel : UI.home.nextStopNotReleased(nextCity?.name ?? '')
            : UI.home.cityMedal(tierLabel(medal))}
        </p>
      </section>

      <Cluey needsConnection={unverifiedCluey} streak={streak} momentumLine={momentumLine} />

      {/* A preview pack has a route, a map and a Travel Guide, and no boards.
          Every way into a round is replaced by one panel that says so and
          points at the thing that IS there — rather than by a disabled Play
          that gives the player nothing to do. See `LanguagePack.readiness`. */}
      {ACTIVE.readiness === 'preview' ? (
        <div className="home-actions home-preview" role="status">
          <h2 className="home-preview-heading">{UI.home.previewHeading}</h2>
          <p className="home-preview-note">{UI.home.previewNote}</p>
          <button className="btn btn-primary btn-big" onClick={() => goTo('guide')}>
            {UI.home.previewGuideCta}
          </button>
        </div>
      ) : (
      <div className="home-actions">
        <div className="home-play-stack">
          {courseSlot === 'replay' ? (
            <button className="btn btn-primary btn-big home-play" onClick={() => continueSlot('replay')}>{UI.home.continueReplay}</button>
          ) : courseSlot === 'primary' ? (
            <button className="btn btn-primary btn-big home-play" onClick={() => continueSlot('primary')}>{UI.home.continuePrimary}</button>
          ) : !nextBoard ? (
            <button className="btn btn-primary btn-big home-play" onClick={() => goTo('suitcase')}>{UI.home.improveBoards}</button>
          ) : (
            <button className="btn btn-primary btn-big home-play" onClick={play}>
              {UI.home.play}
            </button>
          )}
          {shouldShowReturnToPrimary(courseSlot, sessions) && (
            <button className="btn home-play-second" onClick={() => continueSlot('primary')}>{UI.home.returnToPrimary}</button>
          )}
        </div>
      </div>
      )}
      {migrationNotice && <TrainNoticeDialog title={UI.game.legacyRetiredTitle} body={UI.game.legacyRetiredBody}
        action={UI.game.close} onAction={dismissMigrationNotice} onClose={dismissMigrationNotice} />}
    </div>
  )
}
