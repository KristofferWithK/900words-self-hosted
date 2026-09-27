import { isWebDemo } from './build/audience'
import { DemoEndAct } from './webdemo/DemoEndAct'
import { CaseyRestingOverlay } from './webdemo/CaseyRestingOverlay'
import { useEffect, useRef, useState } from 'react'
import { boardablePrefix } from './srs/sampler'
import { UI } from './i18n'
import { WORDS } from './data/words'
import { FINAL_CITY_INDEX, cityAt } from './journey/cities'
import { LEARN_REPS, wordsForCity } from './journey/progress'
import { useGame } from './stores/gameStore'
import { rescueStrandedJourney, useJourney } from './stores/journeyStore'
import { useSettings } from './stores/settingsStore'
import { listenForPassChanges, usePass } from './purchase/passStore'
import { useSrs } from './stores/srsStore'
import { createSettlementStore } from './stores/settlementStore'
import { devTravelFacts } from './progression/devTravelFacts'
import { decideOnboarding, markOnboardDone } from './onboarding/flow'
import { consumeSelfPop, devSwitchesAllowed, useUi } from './stores/uiStore'
import { DEV_TRAIN_OPEN_KEY } from './journey/trainService'
import { installStatsFlush, track } from './analytics/stats'
import { useNativeKeyboard } from './ui/nativeKeyboard'
import { useTapHaptics } from './ui/useTapHaptics'
import { DictionarySheet } from './ui/components/DictionarySheet'
import { UpdateBanner } from './ui/components/UpdateBanner'
import { AudioNotice } from './ui/components/AudioNotice'
import { audioSelfTestRequested, runAudioSelfTest } from './audio/selftest'
import { GameScreen } from './ui/screens/GameScreen'

import { HomeScreen } from './ui/screens/HomeScreen'
import { MapScreen } from './ui/screens/MapScreen'
import { TravelGuideBook } from './ui/screens/TravelGuideBook'
import { OnboardingScreen } from './ui/screens/OnboardingScreen'
import { SuitcaseScreen } from './ui/screens/SuitcaseScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen'
import { PassScreen, PassThanks } from './ui/screens/PassScreen'
import { dailyLimitReached, showLimitOnHomeReturn } from './purchase/dailyGames'

/**
 * The paper the app is drawn on, and the two wobbles that draw it.
 *
 * One <svg> for the whole app rather than a filter per component: a filter is
 * referenced by id from CSS, so these only have to exist once in the document.
 * The grain is a single fixed rect — one filtered element for every screen —
 * because a texture repeated per card is the same picture rendered forty times.
 *
 * The wobbles are used on chrome only (docks, panels, buttons, Casey), never on
 * the board: twenty cards each running a displacement map is the kind of cost
 * no test here would catch, and the cards get their hand-drawn edge from plain
 * geometry instead. See index.css, "the pencil pass".
 */
function PencilDefs() {
  return (
    <>
      <svg className="pencil-grain" aria-hidden="true" focusable="false">
        <rect width="100%" height="100%" filter="url(#pencil-paper)" />
      </svg>
      <svg className="pencil-defs" aria-hidden="true" focusable="false">
        <defs>
        <filter id="pencil-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="12" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" />
        </filter>
        {/* For pills. A tight radius turns displacement into scribble — the
            same scale that reads as "drawn" on a panel reads as "scratched
            out" on a button — so this one is gentler, not looser. */}
        <filter id="pencil-edge-fine" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="23" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
        <filter id="pencil-paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.45  0 0 0 0 0.43  0 0 0 0 0.38  0 0 0 0.055 0"
          />
        </filter>
        </defs>
      </svg>
    </>
  )
}

export default function App() {
  const screen = useUi((s) => s.screen)
  const onboarding = useUi((s) => s.onboarding)
  const refreshPass = usePass((s) => s.refresh)
  const dailyLimitOpen = useUi((s) => s.dailyLimitOpen)
  const passThanked = usePass((s) => s.thanked)
  const previousScreen = useRef(screen)
  const [rescued, setRescued] = useState<{ cityIndex: number; banked: number } | null>(null)
  const [, setDevProgressRevision] = useState(0)

  // Native shell only. On the mobile web this does nothing at all — see
  // src/ui/nativeKeyboard.ts for why that is deliberate.
  useNativeKeyboard()
  useTapHaptics()

  // On iOS this reads StoreKit's locally verified current-entitlements ledger;
  // on web it deliberately settles at "unavailable", never at paid.
  useEffect(() => {
    void refreshPass()
  }, [refreshPass])

  // A code redeemed in Apple's sheet or an Ask to Buy approval arrives here.
  useEffect(() => listenForPassChanges(), [])

  useEffect(() => {
    const refreshIfVisible = () => { if (document.visibilityState === 'visible') void refreshPass() }
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => document.removeEventListener('visibilitychange', refreshIfVisible)
  }, [refreshPass])

  useEffect(() => {
    if (showLimitOnHomeReturn(previousScreen.current, screen, useGame.getState().roundRecorded, dailyLimitReached())) {
      useUi.getState().openDailyLimit()
    }
    previousScreen.current = screen
  }, [screen])

  // A self-built iPhone 900words works out of the box with Gemma: on its first
  // launch it offers her one-time download (src/ai/gemma/firstRun.ts). The
  // build literals fold this away, chunk and all, everywhere else.
  useEffect(() => {
    if (__BUILD_AUDIENCE__ === 'open-source' && __ON_DEVICE_CASEY__) {
      void import('./ai/gemma/firstRun').then((m) => m.offerGemmaOnFirstRun()).catch(() => undefined)
    }
  }, [])

  // Before anything reads the journey: give back what the v1 -> v2 key rename
  // took. Merges, never replaces, and runs once per device.
  useEffect(() => {
    const r = rescueStrandedJourney()
    if (r.outcome === 'rescued' && r.recovered) setRescued(r.recovered)
  }, [])

  // Anonymous usage counters: one open per app start, sent when the app goes
  // to the background (src/analytics/stats.ts). Nothing here identifies the
  // phone; the switch is in Settings.
  useEffect(() => {
    // The website demo sends no usage counters (stats.ts refuses them too).
    if (isWebDemo()) return
    installStatsFlush()
    track({ name: 'app_open' })
  }, [])

  // The simulator workflow's audio check (src/audio/selftest.ts): only when
  // its seeding step asked for it, never for a player.
  useEffect(() => {
    if (audioSelfTestRequested()) void runAudioSelfTest()
  }, [])

  // The rules overlay used to open itself here, exactly once per device.
  // Onboarding owns first-run now (I1): a fresh device starts at the language
  // ticket — decided in uiStore's initialOnboarding(), before first paint — and
  // the overlay stays reachable behind ? only. What is left for an effect is
  // the quiet half of the gate: a device that has clearly played (rules seen,
  // or words in the SRS map) but has no onboarding marker yet gets one
  // written, so the inference runs once rather than on every load. Its own
  // effect for the reason the old one was: it must run for every player, and
  // the dev-switch guard below returns early on any deployed origin.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('howto') === '0') return
    if (decideOnboarding().kind === 'veteran') markOnboardDone()
  }, [])

  // Dev/e2e switches: ?mock=1 selects the visibly labelled agentless prototype;
  // it is not Casey or a player mode. ?seed=N fixes the board.
  useEffect(() => {
    // These overwrite the collection — ?learned=100 rewrites a hundred word
    // records with no confirmation — so they must not exist on a deployed site
    // where a shared link could carry them. Local only; the Playwright drives
    // run against 127.0.0.1, so they keep working.
    if (!devSwitchesAllowed()) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('mock') === '1') useSettings.getState().set({ useMock: true })
    // ?train=open lets a drive ride the closed launch line from a page it has
    // since made native (journey-drive stubs Capacitor after seeding, and a
    // native page refuses every switch here). Session storage: nothing on a
    // phone writes it, and it dies with the tab. `?train=closed` is read live
    // by trainServiceBypass and needs no memory.
    if (params.get('train') === 'open') {
      try {
        sessionStorage.setItem(DEV_TRAIN_OPEN_KEY, '1')
      } catch {
        // No session storage: the switch simply does not take.
      }
    }
    const seed = params.get('seed')
    if (seed && /^\d+$/.test(seed)) {
      useUi.setState({ pendingSeed: Number(seed) })
    }
    // ?first= pins who opens the round. The engine's default is CASEY
    // (createGame's `firstGiver = 'ai'`, src/engine/game.ts, owner call of
    // 2026-09-06), so a drive that wants to start in the composer says
    // `first=player` — the default has moved twice, and a drive that spells
    // out its opener cannot have its turns silently reordered by the next move.
    const first = params.get('first')
    if (first === 'player' || first === 'ai') useUi.setState({ pendingFirstGiver: first })
    // ?grid= WAS HERE. It picked the board Play deals, because the size was a
    // stored setting and a drive cannot type into a select mid-run. There is
    // one board now (N1), so a drive that wants a big board or a short one is
    // asking for something the app cannot do; the twenty-seven URLs that
    // carried the parameter dropped it.
    // ?fresh=1 abandons any round in flight so Play deals anew — but keeps
    // recentBoards, which is the point: the carry-over drive deals board
    // after board and must not have its window wiped between them.
    if (params.get('fresh') === '1') useGame.getState().abandonGame()
    // Journey dev switches, so the travel screens can be driven in tests:
    // ?city=N jumps to a stop, ?collected=K collects K of its words,
    // ?wrapped=K packs K of them into the suitcase.
    // Clamped, because an out-of-range stop is not a failed assertion — it is
    // cityAt() throwing and the app going white, with cityIndex persisted so
    // it stays white. The route got shorter once (Viborg left) and every
    // ?city=9 in the drives outlived it; clamping means the last stop is
    // whatever the last stop now is, rather than a blank screen.
    const city = params.get('city')
    if (city && /^\d$/.test(city)) {
      useJourney.setState({ cityIndex: Math.min(Number(city), FINAL_CITY_INDEX) })
    }
    const cityIndex = useJourney.getState().cityIndex

    // ?collected=K marks the first K words of the city as collected — a green
    // earned each way. ?learned= is the same switch under its old name.
    //
    // "The first K" is `boardablePrefix` (srs/sampler.ts): K collected words
    // that can all be on one board, which is what every drive that uses this
    // switch means by it. ?wrapped= does not skip: the suitcase count is the
    // point there, and a wrapped word is on no board.
    const learned = params.get('learned') ?? params.get('collected')
    if (learned && /^\d{1,3}$/.test(learned)) {
      const now = Date.now()
      const stats = { ...useSrs.getState().stats }
      for (const w of boardablePrefix(wordsForCity(WORDS, cityIndex), Number(learned))) {
        stats[w.id] = {
          box: 3,
          lastSeenAt: now,
          seen: 3,
          correctGuesses: LEARN_REPS,
          misses: 0,
          lookups: 0,
          redemptionRight: 0,
          redemptionWrong: 0,
          greenByClue: 1,
          greenByGuess: 1,
        }
      }
      useSrs.setState({ stats })
    }

    // ?almost=K leaves the first K words one interaction short of collected,
    // so a single round can be driven over the line in a test. Words another
    // switch already seeded keep that record, so the switches compose:
    // ?collected=30&almost=35 is thirty collected and five almost.
    const almost = params.get('almost')
    if (almost && /^\d{1,3}$/.test(almost)) {
      const now = Date.now()
      const stats = { ...useSrs.getState().stats }
      for (const w of boardablePrefix(wordsForCity(WORDS, cityIndex), Number(almost))) {
        if (stats[w.id]) continue
        stats[w.id] = {
          box: 2,
          lastSeenAt: now - 3 * 24 * 60 * 60 * 1000,
          seen: LEARN_REPS - 1,
          correctGuesses: LEARN_REPS - 1,
          misses: 0,
          lookups: 0,
          redemptionRight: 0,
          redemptionWrong: 0,
          // One handling short *and* one interaction short of collected: the
          // guess is in hand, the clue is what the driven round must supply.
          greenByClue: 0,
          greenByGuess: 1,
        }
      }
      useSrs.setState({ stats })
    }

    // ?jokers=K seeds focused translation help for a wrap-up drive. Wrap-ups
    // themselves are free; only this help is earned by normal wins. The
    // param keeps its drive-era name: it is a dev/driver URL, not copy.
    const jokers = params.get('jokers')
    if (jokers && /^\d{1,3}$/.test(jokers)) useSrs.setState({ translationPostcards: Number(jokers) })

    // ?wrapped=K packs the first K city words: wrapped in the ledger, and
    // collected in the stats so the states stay consistent with real play.
    const wrappedParam = params.get('wrapped')
    if (wrappedParam && /^\d{1,3}$/.test(wrappedParam)) {
      const now = Date.now()
      const stats = { ...useSrs.getState().stats }
      const wrapped = { ...useJourney.getState().wrapped }
      for (const w of wordsForCity(WORDS, cityIndex).slice(0, Number(wrappedParam))) {
        wrapped[w.id] = now
        stats[w.id] = {
          box: 3,
          lastSeenAt: now,
          seen: 3,
          correctGuesses: LEARN_REPS,
          misses: 0,
          lookups: 0,
          redemptionRight: 0,
          redemptionWrong: 0,
          greenByClue: 1,
          greenByGuess: 1,
        }
      }
      useSrs.setState({ stats })
      useJourney.setState({ wrapped })

      // The journey screens deliberately read the durable progression ledger,
      // not the legacy word ledger above. Keep this URL fixture truthful to
      // that contract: a local drive asking for a packed city also gets the
      // corresponding earned travel facts. This is never reachable outside a
      // dev-switch host and never runs for an installed/normal player.
      const earned = Math.min(Number(wrappedParam), 100)
      if (earned > 0) {
        const cityId = cityAt(cityIndex).id
        const seed = devTravelFacts(cityId, cityIndex, earned)
        void createSettlementStore({ storage: localStorage }).mergeFacts(seed).then(() => {
          setDevProgressRevision((revision) => revision + 1)
        }).catch(() => {
          // Drives must fail closed if durable storage is unavailable.
        })
      }
    }
  }, [])

  // Android back gesture / browser back: close the top-most layer, then fall
  // back to home — never straight out of the installed PWA.
  useEffect(() => {
    const onPop = () => {
      // An in-app close already updated the state and asked for this pop;
      // handling it again would close a second layer.
      if (consumeSelfPop()) return
      const ui = useUi.getState()
      const round = useGame.getState()
      if (ui.dailyLimitOpen) {
        ui.closeDailyLimit()
      } else if (ui.leaveGameOpen) {
        // The Back gesture already consumed the dialog's history entry.
        // Closing through the store would pop the game entry too.
        useUi.setState({ leaveGameOpen: false })
      } else if (ui.sheetWordId) {
        useUi.setState({ sheetWordId: null })
      } else if (
        ui.screen === 'game' &&
        round.game &&
        round.game.phase === 'finished'
      ) {
        round.dismissResult()
        useUi.setState({ screen: 'home', sheetWordId: null })
      } else if (
        ui.screen === 'game' &&
        round.game &&
        round.game.phase !== 'finished' &&
        round.mode !== 'tutorial'
      ) {
        ui.requestGameExit(true)
      } else if (ui.screen !== 'home') {
        useUi.setState({ screen: 'home', sheetWordId: null })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <main className="app-shell">
      <PencilDefs />
      {/* The keyboard scrim lives in GameScreen now, not here: its job is to
          protect the BOARD from a dismissal tap, and only the game has a
          board. Rendered app-wide it was eating the first tap on Settings and
          the backup panel, whose inputs sit in no dock — kb-up engaged with
          nothing at z-index 5 to punch through the scrim at 4. */}
      {/* The intro REPLACES the ordinary screens, but its second act renders
          the real Home itself and progressively reveals its controls. */}
      {onboarding ? (
        <OnboardingScreen />
      ) : isWebDemo() ? (
        // The website demo never reaches the app's own screens: an intro that
        // ends early (Skip) lands on the demo's end card, not on Home.
        <DemoEndAct />
      ) : (
        <>
          {screen === 'home' && <HomeScreen />}
          {screen === 'game' && <GameScreen />}
          {screen === 'settings' && <SettingsScreen />}
          {screen === 'suitcase' && <SuitcaseScreen />}
          {screen === 'map' && <MapScreen />}
          {screen === 'guide' && <TravelGuideBook />}
          {screen === 'pass' && <PassScreen />}
        </>
      )}
      {!onboarding && dailyLimitOpen && screen !== 'pass' && <PassScreen />}
      {/* A ticket that arrived with no pass screen up still earns the thank-you. */}
      {!onboarding && passThanked && !dailyLimitOpen && screen !== 'pass' && <PassThanks />}
      {rescued && (
        <div className="update-banner" role="status">
          <span>{UI.system.rescuedProgress(cityAt(rescued.cityIndex).name, rescued.banked)}</span>
          <div className="update-actions">
            <button className="btn btn-small btn-primary" onClick={() => setRescued(null)}>
              {UI.system.rescuedAck}
            </button>
          </div>
        </div>
      )}
      <DictionarySheet />
      <UpdateBanner suppressOfflineReady={screen === 'guide' || !!onboarding} />
      <AudioNotice />
      <CaseyRestingOverlay />
    </main>
  )
}
