import { isWebDemo } from '../../build/audience'
import { DemoEndAct } from '../../webdemo/DemoEndAct'
import { useEffect, useMemo, useState } from 'react'
import {
  CATALOGUES,
  UI,
  UI_LANGUAGES,
  UI_LANGUAGE_INFO,
  detectDeviceLanguage,
  deviceLanguages,
  hasStoredUiLanguage,
  setUiLanguage,
  type UiLanguage,
} from '../../i18n'
import { ACTIVE, setActiveLanguage } from '../../lang/active'
import { playableLanguages } from '../../lang/index'
import type { LanguagePack, MapArt } from '../../lang/types'
import { UPCOMING_COURSES } from '../../lang/upcoming'
import { routePath } from '../../journey/map'
import { writeOnboardStep, type OnboardLessonStatus } from '../../onboarding/flow'
import { ensureFirstCafeFound, firstCafeName, firstFoundCafe } from '../../onboarding/firstCafe'
import { isCurrentTutorialGame, TUTORIAL_LANGUAGE } from '../../onboarding/tutorial'
import { admitFirstWalk, canStartRun, endFirstWalkAdmission } from '../../purchase/dailyGames'
import { primeRunAudio } from '../../run/audio'
import { useGame } from '../../stores/gameStore'
import { useUi, uiLanguageChoiceAllowed } from '../../stores/uiStore'
import { openIntroRound } from '../introRound'
import { ClueyFace } from '../components/Cluey'
import { CoachMarkTour, SuitcaseTour } from '../components/SuitcaseTour'
import { Tag } from '../components/Tag'
import { primeSfx } from '../sfx'
import { HOME_TOUR_STEPS, homeCafeTourSteps } from '../../onboarding/tour'
import { GameScreen } from './GameScreen'
import { HomeScreen } from './HomeScreen'
import { SightseeingScreen } from './SightseeingScreen'
import { SuitcaseScreen } from './SuitcaseScreen'

/**
 * The first session, walk first (CW-13; docs/roadmap/cafe-world.md section 7):
 *
 *   1. the language act and the ticket, as before;
 *   2. Casey: the 900-words line, then why there are two games;
 *   3. "Let's explore Sønderborg and see if we can find a café." Its tag
 *      starts the walk, so the walk is two taps after the ticket;
 *   4. the first Words walk; its fifth photo finds the first café and holds
 *      the run on "You found a café" (CW-08b, src/run/cafeHold.ts);
 *   5. at the run's end: walk again, or Home, where a short spotlight
 *      introduces Sightseeing and the café found;
 *   6. the Café puzzle tag opens the café's practice table with today's
 *      spotlight tour (dressed as that café), then the café's own puzzle and
 *      its stamp's lesson; Home's city stamp; the suitcase's three marks;
 *   7. the train is not introduced on day one.
 *
 * The café gate is on (journey/cafeAccess.ts), so nothing here may deal a
 * café no walk has found. Every path that reaches Home or the first puzzle
 * without the walk's find (any Skip, or a first walk that ended before its
 * fifth photo) finds the first café first (onboarding/firstCafe.ts): the
 * player lands on a Home whose Café puzzle tag plays.
 *
 * The ticket is a language picker, but collapses to a single confirm card when
 * only one playable course is available — never a one-entry select, which is
 * `hasLanguageChoice`'s own reasoning. Its display format matches Settings:
 * `name (endonym)`.
 *
 * Skip stays available on the ticket, Casey's lines, the walk's panels, the
 * Home spotlight and the practice/suitcase tutorials. The first café puzzle
 * and the post-round suitcase gate stay deliberately clean: their visible
 * affordances carry the continuation themselves.
 */

/**
 * Whether the walk act should start its run at once: set by Casey's "Let's
 * go" tap, read once by the walk. Module state, never stored, so a reload
 * mid-walk resumes on the walk's ready panel instead of spending a run.
 */
let startWalkNow = false

/**
 * The act BEFORE the ticket: which language do you already speak?
 *
 * Two different questions sit next to each other here and the order matters.
 * This one asks what you SPEAK, so the app can talk to you; the ticket asks
 * what you want to LEARN. Asking the second one in a language you cannot read
 * would be a poor joke, so this comes first — and it is the one screen in the
 * app that cannot be written in the player's language, because that is exactly
 * what it is for. So it is written in the DEVICE's language, a guess that
 * costs nothing when wrong: every other language is on screen, one tap away,
 * each in its own name (a player hunting for "Deutsch" is not helped by
 * "German").
 *
 * It runs only where a choice has never been stored, which is only ever a
 * fresh device: an existing phone stays English and finds the switch in
 * Settings (UL3). Choosing writes the key and reloads — the flow's marker goes
 * down first, so the way back up resumes on the ticket instead of starting
 * over, the same bargain the ticket itself makes when it changes the language
 * being learned.
 */
function LanguageAct({ persist }: { persist: boolean }) {
  const detected = detectDeviceLanguage(deviceLanguages())
  const copy = CATALOGUES[detected].onboarding
  // The device's guess first, then the rest in their shipped order. Built by
  // concatenation rather than by sorting: a comparator that answers "equal"
  // for every pair but one is not a total order, and its result is whatever
  // the engine's sort happens to do with it.
  const ordered = [detected, ...UI_LANGUAGES.filter((code) => code !== detected)]

  const choose = (code: UiLanguage) => {
    // Down BEFORE the reload, exactly as the ticket does it.
    if (persist) writeOnboardStep('ticket')
    setUiLanguage(code)
  }

  return (
    <div className="screen onboard-screen" data-act="language">
      <div className="onboard-ticket-heading">
        <p className="ticket-eyebrow">{copy.languageEyebrow}</p>
        <h1>{copy.languageHeading}</h1>
      </div>
      <div className="onboard-tickets onboard-tickets-languages">
        {ordered.map((code) => {
          const info = UI_LANGUAGE_INFO[code]
          return (
            <button
              key={code}
              className="onboard-language"
              lang={info.tag}
              onClick={() => choose(code)}
              aria-label={copy.languageAria(info.endonym)}
            >
              <span className="ticket-copy">
                <span className="ticket-lang">{info.endonym}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="onboard-hint">{copy.languageHint}</p>
      <div className="onboard-spacer" />
    </div>
  )
}

/** The active ticket's route map: country first, language second. */
function TicketCountryMap({ pack }: { pack: LanguagePack }) {
  const map = pack.route.map
  const points = pack.route.cities.map((city) => map.project(city.lon, city.lat))
  return (
    <svg className="ticket-country-map" viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true">
      <path className="map-land" d={map.path} />
      <path className="map-hatch" d={map.hatch} />
      <path className="map-route-ahead" d={routePath(points)} />
      {points.map((point, index) => <circle key={index} className="home-dot dot-ahead" cx={point.x} cy={point.y} r="15" />)}
    </svg>
  )
}

/** A coming-soon ticket's country: the drawing alone, with no route on it yet. */
function ComingSoonMap({ map }: { map: MapArt }) {
  return (
    <svg className="ticket-soon-map" viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true">
      <path className="map-land" d={map.path} />
      <path className="map-hatch" d={map.hatch} />
    </svg>
  )
}

export function OnboardingScreen() {
  const onboarding = useUi((s) => s.onboarding)
  const advance = useUi((s) => s.advanceOnboarding)
  const finish = useUi((s) => s.finishOnboarding)
  const markLesson = useUi((s) => s.markOnboardingLesson)
  if (!onboarding) return null
  const lessons = onboarding.lessons ?? {}

  const finishRun = () => {
    // Skip lands on a Home whose Café puzzle tag plays (see the file comment).
    ensureFirstCafeFound()
    const game = useGame.getState()
    // A transient Settings replay may have put a real primary or replay slot
    // down before showing the nine-word practice. Bring that exact session
    // back before Home replaces the onboarding surface; a first-run practice
    // has no parked slot and is simply retired.
    if (game.mode === 'tutorial') {
      if (game.restoreTutorialSuspension()) {
        finish()
        return
      }
      game.abandonGame()
      // A real first-run skip abandons only the lesson; it still owes the
      // first required authored board. Transient intro replays have no such
      // obligation and return to Home above.
      if (onboarding.persist) {
        advance('real-round')
        return
      }
    }
    if (onboarding.step === 'tutorial' && onboarding.persist) {
      advance('real-round')
      return
    }
    finish()
  }

  const skip = (
    <Tag className="onboard-skip" onClick={finishRun} label={UI.onboarding.skip} />
  )

  // The website demo ends after the first full board's finish screen: its
  // Home and suitcase belong to the app, and the end card offers the app.
  if (isWebDemo() && (onboarding.step === 'home-return' || onboarding.step === 'suitcase' || onboarding.step === 'suitcase-ready')) {
    return <DemoEndAct />
  }
  if (onboarding.step === 'intro') return <IntroAct skip={finishRun} />
  if (onboarding.step === 'walk') return <WalkAct skip={finishRun} />
  if (onboarding.step === 'home-cafe') return <HomeCafeAct skip={finishRun} />
  // A lesson already done or dismissed (flow.ts) is never shown twice. A
  // practice skipped before its translation step leaves that lesson owed, so
  // the first full board teaches it instead.
  const onTranslationLessonComplete = (status: OnboardLessonStatus) => markLesson('translation', status)
  const onWheelLessonComplete = (status: OnboardLessonStatus) => markLesson('wheel', status)
  if (onboarding.step === 'tutorial') return <TutorialAct
    showTranslationLesson={!lessons.translation}
    onTranslationLessonComplete={onTranslationLessonComplete}
    showWheelLesson={!lessons.wheel}
    onWheelLessonComplete={onWheelLessonComplete}
  />
  if (onboarding.step === 'real-round') return <RealRoundAct
    showTranslationLesson={!lessons.translation}
    onTranslationLessonComplete={onTranslationLessonComplete}
    showWheelLesson={!lessons.wheel}
    onWheelLessonComplete={onWheelLessonComplete}
    showResultLesson={!lessons.result}
    onResultLessonComplete={(status) => markLesson('result', status)}
  />
  if (onboarding.step === 'home-return') return <HomeReturnAct
    showLesson={!lessons.home}
    onLessonComplete={(status) => markLesson('home', status)}
  />
  if (onboarding.step === 'suitcase' || onboarding.step === 'suitcase-ready') {
    return <SuitcaseAct tourDone={onboarding.step === 'suitcase-ready'} />
  }

  // Which language do you SPEAK, before the ticket asks which you want to
  // learn. Only on a device that has never answered, and only where the
  // question is switched on at all (uiStore; 1g turns it on for everyone).
  if (uiLanguageChoiceAllowed() && !hasStoredUiLanguage()) {
    return <LanguageAct persist={onboarding.persist} />
  }

  // The ticket. Tapping one is the confirmation — a card, not a control row —
  // and with one playable pack it is the single card the owner settled on.
  //
  // PLAYABLE ones only, unlike Settings. This act exists to get a new player
  // to their first round, and a preview pack has no round to reach: offering
  // it here would end onboarding on a screen that says the game is not built.
  // Settings lists every pack, which is where switching to a preview belongs.
  const languages = playableLanguages()
  const choose = (pack: LanguagePack) => {
    if (pack.code !== ACTIVE.code) {
      // A real choice reloads the app (src/lang/active.ts): every index, the
      // route and the word list change at once. The flow's marker must be
      // down BEFORE that reload so the way back up resumes instead of
      // starting over — on Casey's lines.
      if (onboarding.persist) writeOnboardStep('intro')
      setActiveLanguage(pack.code)
      return
    }
    advance('intro')
  }

  return (
    <div className="screen onboard-screen" data-act="ticket">
      <div className="onboard-ticket-heading">
        <p className="ticket-eyebrow">{UI.onboarding.ticketEyebrow}</p>
        <h1>{UI.onboarding.ticketHeading}</h1>
      </div>
      <div className="onboard-tickets">
        {languages.map((pack) => (
          <button
            key={pack.code}
            className="onboard-ticket"
            onClick={() => choose(pack)}
            aria-label={UI.onboarding.ticketAria(pack.route.country, pack.name)}
          >
            <TicketCountryMap pack={pack} />
            <span className="ticket-copy">
              <span className="ticket-eyebrow">{UI.onboarding.ticketLearnIn}</span>
              <span className="ticket-dest">{pack.route.country}</span>
              <span className="ticket-lang">{pack.name} ({pack.endonym})</span>
              <span className="ticket-meta">
                {UI.onboarding.ticketMeta(pack.words.length, pack.route.cities.length)}
              </span>
            </span>
          </button>
        ))}
        {/* Where the journey goes next. Not buttons and not `.onboard-ticket`:
            nothing here can be chosen, and the drives that tap a ticket select
            it by that class. */}
        <div className="onboard-tickets-soon">
          {UPCOMING_COURSES.map((course) => (
            <div key={course.code} className="onboard-ticket-soon">
              <ComingSoonMap map={course.map} />
              <span className="ticket-copy">
                <span className="ticket-eyebrow">{UI.onboarding.ticketComingSoon}</span>
                <span className="ticket-dest">{course.country}</span>
                <span className="ticket-lang">{course.name}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="onboard-hint">
        {languages.length > 1 ? UI.onboarding.ticketHintMany : UI.onboarding.ticketHintOne}
      </p>
      <div className="onboard-spacer" />
      <div className="onboard-controls">{skip}</div>
    </div>
  )
}

/**
 * Casey's lines before the walk (contract section 7 steps 2 and 3), on the
 * onboarding screen's own paper: Casey large with her bubble, as on the
 * staged Home this replaces, and one tag under her. Two beats, so the walk is
 * two taps after the ticket: Next, then "Let's go", which primes the run's
 * sounds inside the tap and starts the walk at once.
 */
function IntroAct({ skip }: { skip: () => void }) {
  const advance = useUi((s) => s.advanceOnboarding)
  const [beat, setBeat] = useState<'games' | 'explore'>('games')
  const course = UI.onboarding.courseText(ACTIVE.code)
  const city = ACTIVE.route.cities[0]?.name ?? course.countryName
  const go = () => {
    primeRunAudio()
    primeSfx()
    startWalkNow = true
    advance('walk')
  }
  return (
    <div className="screen onboard-screen onboard-intro" data-act="intro" data-beat={beat}>
      <div className="cluey-band onboard-intro-casey">
        <div className="cluey-bubble onboard-intro-bubble" role="status">
          {beat === 'games' ? (
            <>
              <p>{course.welcome}</p>
              <p>{UI.onboarding.introTwoGames}</p>
            </>
          ) : (
            <p>{UI.onboarding.introExplore(city)}</p>
          )}
        </div>
        <div className="onboard-intro-mascot" aria-hidden="true">
          <div className="cluey-live"><ClueyFace mood={beat === 'explore' ? 'happy' : 'idle'} /></div>
        </div>
      </div>
      <div className="onboard-spacer" />
      <div className="onboard-controls onboard-intro-controls">
        {beat === 'games' ? (
          <Tag size="wide" tone="primary" className="onboard-intro-next" label={UI.onboarding.tourNext} onClick={() => setBeat('explore')} autoFocus />
        ) : (
          <Tag size="wide" tone="primary" className="onboard-intro-go" label={UI.onboarding.introGo} onClick={go} autoFocus />
        )}
        <Tag className="onboard-skip" onClick={skip} label={UI.onboarding.skip} />
      </div>
    </div>
  )
}

/**
 * The first walk (contract section 7 step 4): the real Sightseeing screen, its
 * Words walk. Home from it goes to Home's café introduction; a first walk that
 * ended before its find still lands there with the first café found.
 */
export function WalkAct({ skip }: { skip: () => void }) {
  const advance = useUi((s) => s.advanceOnboarding)
  const persist = useUi((s) => s.onboarding?.persist ?? false)
  const [startNow] = useState(() => {
    const now = startWalkNow
    startWalkNow = false
    return now
  })
  // Day one (CW-15): a first session's walk is never refused, and it counts
  // like any other (purchase/dailyGames.ts admitFirstWalk). The admission is
  // made while this act DRAWS, not in an effect, on purpose: React runs the
  // child's effects before the parent's, and SightseeingScreen's own effect
  // starts the walk at once (`startNow`) after asking `canStartRun`, so an
  // admission made in this act's effect would come too late. The effect
  // admits again on mount (StrictMode's remount) and ends the admission when
  // the act goes. A replayed intro is not a first session: its walk asks the
  // count, and with today's two used the upgrade dialog says why the walk
  // does not start (App draws the dialog over a replayed intro, never over a
  // first session).
  useState(() => admitFirstWalk(persist))
  useEffect(() => {
    admitFirstWalk(persist)
    if (!persist && !canStartRun()) useUi.getState().openDailyLimit()
    return () => endFirstWalkAdmission()
  }, [persist])
  return (
    <SightseeingScreen firstWalk={{
      startNow,
      cafeFound: () => firstFoundCafe() !== null,
      onHome: () => {
        ensureFirstCafeFound()
        advance('home-cafe')
      },
      onSkip: skip,
    }} />
  )
}

/**
 * Home after the walk (contract section 7 step 5): the real Home, with a
 * short spotlight on Sightseeing and then on the café found. The last beat is
 * the Café puzzle tag itself: tapping it sits down at the café's practice
 * table. Skip ends the first session on this Home, the café still waiting.
 */
function HomeCafeAct({ skip }: { skip: () => void }) {
  const advance = useUi((s) => s.advanceOnboarding)
  // A reload here, or a resume from an older marker, may arrive without the
  // walk's find: the first café is found before Home is drawn.
  const [cafeName] = useState(() => {
    ensureFirstCafeFound()
    return firstCafeName()
  })
  const [tourClosed, setTourClosed] = useState(false)
  const steps = useMemo(() => homeCafeTourSteps(cafeName), [cafeName])
  return (
    <div className="onboard-home-act">
      <HomeScreen intro={{
        onCafePuzzle: () => advance('tutorial'),
        onSightseeing: () => advance('walk'),
        onCasey: () => undefined,
      }} />
      {!tourClosed && (
        <CoachMarkTour
          steps={steps}
          surfaceSelector=".onboard-home-act .home-screen"
          onDone={() => setTourClosed(true)}
          onSkip={skip}
          onUnavailable={() => setTourClosed(true)}
          kind="home"
        />
      )}
    </div>
  )
}

/**
 * The tutorial act is a complete, authored small-board practice round. Casey's
 * clues are deterministic; the player's taps and clue are not. All this
 * component owns is making sure the correct deal exists after a fresh start
 * or reload. The finished screen owns the deliberate hand-off to real play.
 */
function TutorialAct({
  showTranslationLesson,
  onTranslationLessonComplete,
  showWheelLesson,
  onWheelLessonComplete,
}: {
  showTranslationLesson: boolean
  onTranslationLessonComplete: (status: OnboardLessonStatus) => void
  showWheelLesson: boolean
  onWheelLessonComplete: (status: OnboardLessonStatus) => void
}) {
  const mode = useGame((s) => s.mode)
  const game = useGame((s) => s.game)
  const advance = useUi((s) => s.advanceOnboarding)
  // Do not run a different course's script if a future playable pack is added
  // before its own practice round has been authored.
  const scripted = ACTIVE.code === TUTORIAL_LANGUAGE
  useEffect(() => {
    if (!scripted) {
      advance('real-round')
      return
    }
    const s = useGame.getState()
    if (s.mode === 'tutorial' && s.game && !isCurrentTutorialGame(s.game)) s.abandonGame()
    if (!s.game || s.mode !== 'tutorial' || !isCurrentTutorialGame(s.game)) s.newTutorialGame()
  }, [scripted, advance])
  if (!scripted || !game || mode !== 'tutorial') return null
  return <GameScreen
    showTranslationLesson={showTranslationLesson}
    onTranslationLessonComplete={onTranslationLessonComplete}
    showWheelLesson={showWheelLesson}
    onWheelLessonComplete={onWheelLessonComplete}
  />
}

/**
 * The practice round is followed by one ordinary, model-backed board. A
 * persisted normal round is kept exactly where it was; any stale tutorial or
 * wrap-up state is replaced once, on entry.
 */
function RealRoundAct({
  showTranslationLesson,
  onTranslationLessonComplete,
  showWheelLesson,
  onWheelLessonComplete,
  showResultLesson,
  onResultLessonComplete,
}: {
  showTranslationLesson: boolean
  onTranslationLessonComplete: (status: OnboardLessonStatus) => void
  showWheelLesson: boolean
  onWheelLessonComplete: (status: OnboardLessonStatus) => void
  showResultLesson: boolean
  onResultLessonComplete: (status: OnboardLessonStatus) => void
}) {
  const mode = useGame((s) => s.mode)
  const game = useGame((s) => s.game)
  const persist = useUi((s) => s.onboarding?.persist ?? false)
  // The board: the first session's found café, or a replayed intro's own
  // next board. No round (any refusal) ends the intro on Home rather than a
  // blank act (src/ui/introRound.ts).
  useEffect(() => openIntroRound(persist), [persist])
  if (!game || mode !== 'normal') return null
  return <GameScreen
    showTranslationLesson={showTranslationLesson}
    onTranslationLessonComplete={onTranslationLessonComplete}
    showWheelLesson={showWheelLesson}
    onWheelLessonComplete={onWheelLessonComplete}
    showResultLesson={showResultLesson}
    onResultLessonComplete={onResultLessonComplete}
  />
}

/**
 * After the café's puzzle, the real Home with its doors held: a short
 * spotlight points at the city's stamp (where the postcard total used to be),
 * then at Casey, and tapping Casey opens the suitcase, whose own tour teaches
 * the three marks. The tags lead there too, so no tap is dead. The spotlight
 * never taps for the player: done, skipped or unavailable, it releases Home.
 */
function HomeReturnAct({
  showLesson,
  onLessonComplete,
}: {
  showLesson: boolean
  onLessonComplete: (status: OnboardLessonStatus) => void
}) {
  const [lessonClosed, setLessonClosed] = useState(false)
  const openCasey = () => {
    useUi.getState().advanceOnboarding('suitcase')
  }
  const close = (status: OnboardLessonStatus | null) => {
    setLessonClosed(true)
    if (status) onLessonComplete(status)
  }
  return (
    <div className="onboard-home-act">
      <HomeScreen intro={{
        onCafePuzzle: openCasey,
        onSightseeing: openCasey,
        onCasey: openCasey,
      }} />
      {showLesson && !lessonClosed && (
        <CoachMarkTour
          steps={HOME_TOUR_STEPS}
          surfaceSelector=".onboard-home-act .home-screen"
          onDone={() => close('done')}
          onSkip={() => close('dismissed')}
          onUnavailable={() => close(null)}
          kind="home"
        />
      )}
    </div>
  )
}

/** The existing coach marks walk the real suitcase, never a copied mock. */
function SuitcaseAct({ tourDone }: { tourDone: boolean }) {
  const advance = useUi((s) => s.advanceOnboarding)
  const finish = useUi((s) => s.finishOnboarding)
  return (
    <div className="onboard-home-act">
      <SuitcaseScreen onBack={finish} />
      {!tourDone && (
        <SuitcaseTour
          onDone={() => advance('suitcase-ready')}
          onSkip={finish}
        />
      )}
    </div>
  )
}
