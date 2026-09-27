import { isWebDemo } from '../../build/audience'
import { DemoEndAct } from '../../webdemo/DemoEndAct'
import { useEffect, useState } from 'react'
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
import type { LanguagePack } from '../../lang/types'
import { routePath } from '../../journey/map'
import { writeOnboardStep, type OnboardLessonStatus } from '../../onboarding/flow'
import { isCurrentTutorialGame, TUTORIAL_LANGUAGE } from '../../onboarding/tutorial'
import { useGame } from '../../stores/gameStore'
import { useUi, uiLanguageChoiceAllowed } from '../../stores/uiStore'
import { CoachMarkTour, SuitcaseTour } from '../components/SuitcaseTour'
import { HOME_TOUR_STEPS } from '../../onboarding/tour'
import { GameScreen } from './GameScreen'
import { HomeScreen, type HomeIntroStage } from './HomeScreen'
import { SuitcaseScreen } from './SuitcaseScreen'

/**
 * The ticket is the first decision. It leads to Home, where Casey introduces
 * the journey by revealing the map, Travel Guide and Play in place.
 *
 * The ticket is a language picker, but collapses to a single confirm card when
 * only one playable course is available — never a one-entry select, which is
 * `hasLanguageChoice`'s own reasoning. Its display format matches Settings:
 * `name (endonym)`.
 *
 * Skip stays available on the ticket and practice/suitcase tutorials. Casey's
 * staged Home introduction and post-round suitcase gate stay deliberately
 * clean: their visible affordances carry the continuation themselves.
 */

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

export function OnboardingScreen() {
  const onboarding = useUi((s) => s.onboarding)
  const advance = useUi((s) => s.advanceOnboarding)
  const finish = useUi((s) => s.finishOnboarding)
  const markLesson = useUi((s) => s.markOnboardingLesson)
  if (!onboarding) return null
  const lessons = onboarding.lessons ?? {}

  const finishRun = () => {
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
    <button className="btn onboard-skip" onClick={finishRun}>
      {UI.onboarding.skip}
    </button>
  )

  // The website demo ends after the first full board's finish screen: its
  // Home and suitcase belong to the app, and the end card offers the app.
  if (isWebDemo() && (onboarding.step === 'home-return' || onboarding.step === 'suitcase' || onboarding.step === 'suitcase-ready')) {
    return <DemoEndAct />
  }
  if (onboarding.step === 'home-intro') return <HomeIntroAct />
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
      // starting over — on the staged Home introduction.
      if (onboarding.persist) writeOnboardStep('home-intro')
      setActiveLanguage(pack.code)
      return
    }
    advance('home-intro')
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
      </div>
      <p className="onboard-hint">
        {languages.length > 1 ? UI.onboarding.ticketHintMany : UI.onboarding.ticketHintOne}
      </p>
      <div className="onboard-spacer" />
      <div className="onboard-controls">{skip}</div>
    </div>
  )
}

const homeIntroLines = (): Record<Exclude<HomeIntroStage, 'return'>, string> => {
  const copy = UI.onboarding.courseText(ACTIVE.code)
  const destination = ACTIVE.route.cities.at(-1)?.name ?? copy.countryName
  return {
    welcome: copy.welcome,
    map: ACTIVE.code === 'da' ? UI.onboarding.introMap : copy.map(destination),
    guide: copy.guide,
    play: UI.onboarding.introPlay,
  }
}

function HomeIntroAct() {
  const advanceOnboarding = useUi((s) => s.advanceOnboarding)
  const [stage, setStage] = useState<Exclude<HomeIntroStage, 'return'>>('welcome')
  const lines = homeIntroLines()
  const next = () => setStage((current) => (
    current === 'welcome' ? 'map' : current === 'map' ? 'guide' : current === 'guide' ? 'play' : 'play'
  ))
  return (
    <div className="onboard-home-act">
      <HomeScreen intro={{
        stage,
        line: lines[stage],
        onAdvance: next,
        onPlay: () => advanceOnboarding('tutorial'),
        onCasey: next,
      }} />
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
  useEffect(() => {
    const s = useGame.getState()
    if (!s.game || s.mode !== 'normal') {
      s.abandonGame()
      // A replayed intro's full board is the player's own next one, the
      // board Home's Play would give them, not City 1's first.
      if (!persist) s.resumePrimary()
      // The first full board opens the way every normal board does: with
      // Casey's clue (owner, 2026-09-26). The practice round already taught
      // the player's own clue turn.
      else s.newGame({ cityIndex: 0, firstGiver: 'ai' })
    }
  }, [persist])
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
 * After the real round, Home is visible but Play is deliberately inert. A
 * short spotlight points at the city's real postcard total, then at Casey;
 * the button carries the instruction and tapping Casey opens the suitcase,
 * whose own tour teaches the collection. The spotlight never taps for the
 * player: done, skipped or unavailable, it simply releases the real Home.
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
        stage: 'return',
        line: '',
        onAdvance: openCasey,
        onPlay: openCasey,
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
