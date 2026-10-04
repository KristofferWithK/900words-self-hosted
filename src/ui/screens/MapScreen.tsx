import { useEffect, useState } from 'react'
import { CITIES, WORDS_PER_CITY, cityAt } from '../../journey/cities'
import { MAP, nearestStop, routePath } from '../../journey/map'
import { cityMedal, hasHistoricalTravelEligibility } from '../../journey/progress'

import { Arrival } from '../components/Arrival'
import { Tag } from '../components/Tag'
import { TrainProgress } from '../components/TrainProgress'
import { useCityTrain } from '../components/TrainRunPanel'
import { TrainRide } from '../components/TrainRide'
import { TravelGuideButton } from '../components/TravelGuideButton'
import { TravelGuideBook } from './TravelGuideBook'
import { reachedIndex, useJourney } from '../../stores/journeyStore'
import { useUi } from '../../stores/uiStore'
import { ACTIVE } from '../../lang/active'
import { useGame } from '../../stores/gameStore'
import { dealOrFallBack } from '../cafeDeal'
import { usePass } from '../../purchase/passStore'
import { useSettings } from '../../stores/settingsStore'
import { playtestTravelAllowed } from '../../stores/uiStore'
import { buildAudience } from '../../build/audience'
import { journeyTravelGate } from '../../journey/trainService'
import { UI, UI_LANGUAGE, UI_LANGUAGE_INFO } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'
import { CITY1_REQUIRED_SET } from '../../session/courseRuntime'
import { readCourseProgress } from './HomeScreen'

type Placement = { anchor: 'start' | 'end'; dx: number; dy: number }

/** Labels lean away from the map edge; the Zealand pair is split vertically. */
const PLACEMENT: Record<string, Placement> = {
  roskilde: { anchor: 'end', dx: -26, dy: -18 },
  // København leaned RIGHT while Bornholm held the frame open 375 units past
  // it. With the Baltic cropped off, journey's end sits 55 units from the east
  // edge and a 145-unit name ran clean off the map, so it leans left now.
  //
  // Which puts both Zealand names on the same side of two dots 65 units apart,
  // so the vertical split is the only thing keeping them off each other. The
  // number is set by Roskilde's DOT, not by its name: at dy 26 and again at 40
  // København's own name ran straight through the circle 65 units to its west.
  // 56 puts its baseline at 577, and a 30-unit label stands about 22 above its
  // baseline — so the text starts 8 clear of the bottom of that dot (529 + 18).
  kobenhavn: { anchor: 'end', dx: -26, dy: 56 },
  skagen: { anchor: 'start', dx: 26, dy: 4 },
  odense: { anchor: 'start', dx: 26, dy: 26 },
}
const defaultPlacement = (x: number): Placement =>
  x > MAP.width * 0.62 ? { anchor: 'end', dx: -34, dy: 6 } : { anchor: 'start', dx: 34, dy: 6 }

export function MapScreen() {
  const goTo = useUi((s) => s.goTo)
  // Only the developer build's Travel ahead deals a board from here now.
  const newGame = useGame((s) => s.newGame)
  const journey = useJourney()
  const passStatus = usePass((s) => s.status)
  // Two halves, kept apart because the switch below needs them apart: whether
  // this BUILD may offer the jumper at all, and whether it is currently on.
  const playtestAllowed = playtestTravelAllowed()
  const playtestOn = useSettings((s) => s.playtestTravel)
  const setSettings = useSettings((s) => s.set)
  const playtestTravel = playtestOn && playtestAllowed
  const [selected, setSelected] = useState<number>(journey.cityIndex)
  const [arrivedIndex, setArrivedIndex] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  /**
   * The city being ENTERED while the ride plays. Held separately from
   * `arrivedIndex` because the ride comes first
   * and the arrival is what it hands over to.
   *
   * Seeded from `pendingRide` so Home's train can board straight into the ride
   * (T1): the travelling itself already happened there, and this screen opens
   * on the ride rather than showing a frame of map on the way to it. Read in
   * the initialiser rather than an effect for exactly that reason — an effect
   * runs after the first paint, and the frame it would let through is the map
   * the tap was meant to skip.
   */
  const [ridingTo, setRidingTo] = useState<number | null>(() => useUi.getState().pendingRide)
  // Whether the ride in progress is a RETURN to a city already reached, so the
  // arrival can say so rather than promise a hundred new words.
  const [returning, setReturning] = useState(false)
  // Cleared after mount, not during it: consuming the flag inside the
  // initialiser would make StrictMode's second call read null and lose the
  // ride. Nothing else reads it, so one frame's delay costs nothing.
  useEffect(() => {
    if (useUi.getState().pendingRide !== null) useUi.setState({ pendingRide: null })
  }, [])

  const points = CITIES.map((c) => MAP.project(c.lon, c.lat))
  /**
   * A stop is VISITED if the traveller has ever stood there, not merely if it
   * is behind them. The two were the same thing until Travel back: standing in
   * Ribe again after Aarhus, Aarhus is ahead on the route and still a city
   * whose hundred words are packed — it keeps its travel-log date, and the
   * road back to it is open. The one thing that stays index-
   * based is the drawn route: done up to the furthest stop reached, since
   * that is the line the train has actually run.
   */
  const reachedTo = reachedIndex(journey)
  const statusOf = (i: number) =>
    i === journey.cityIndex ? 'current' : i <= reachedTo ? 'visited' : 'ahead'
  // The map is an overview, not a release gate: show every route stop and
  // leg. Boarding remains independently guarded by journeyTravelGate and the
  // explicit developer-only playtest switch.
  const drawnCount = CITIES.length
  const drawnPoints = points.slice(0, drawnCount)
  const travelledPath = routePath(drawnPoints.slice(0, Math.min(reachedTo + 1, drawnCount)))
  const aheadPath = routePath(drawnPoints.slice(Math.min(reachedTo, drawnCount - 1)))

  const city = cityAt(selected)
  const durable = readCourseProgress()

  const state = statusOf(selected)
  const nextCity = journey.cityIndex + 1 < CITIES.length ? cityAt(journey.cityIndex + 1) : null
  const currentCity = { courseId: ACTIVE.code, cityId: cityAt(journey.cityIndex).id }
  const travel = journeyTravelGate({
    facts: durable.facts,
    city: currentCity,
    cityIndex: journey.cityIndex,
    historicalEligibility: hasHistoricalTravelEligibility(journey.historicalTravelEligibility, currentCity),
    passStatus,
    audience: buildAudience,
    developerTravel: playtestTravel,
  })
  // The train strip loads with the city's collected words (CW-07), as on Home.
  const cityTrain = useCityTrain(journey.cityIndex)
  const medal = cityMedal(durable.facts, CITY1_REQUIRED_SET).tier
  // The stop AFTER the one being looked at — the map lets you tap ahead, and
  // "the train to Ribe" has to mean the train out of the city on screen, not
  // the train out of wherever you happen to be standing.
  // Onward stays ROUTE-based, not drawnCount-based (owner scope, 2026-09-15):
  // the drawn map stops at the developed stops, but the train under the card
  // still names the next real stop on the line — Aarhus exists even while the
  // map draws nothing past Sønderborg, and `onward!.name` below would crash on
  // a null the moment the suitcase filled at the one developed stop.
  const onward = selected + 1 < CITIES.length ? cityAt(selected + 1) : null

  /**
   * Leave: the ride, then the arrival. One function because two things start
   * it here — the button below, and (since T1) the train itself, which is the
   * same door Home now offers.
   */
  const board = () => {
    if (!travel.canBoard) return
    const destination = journey.cityIndex + 1
    journey.travel(Date.now())
    setSelected(destination)
    setReturning(false)
    setRidingTo(destination)
  }
  /**
   * Travel back — or on again — to a stop already reached. The same ride and
   * the same arrival as first time, because it IS the train; what differs is
   * that no gate stands in the way. Neither the packing gate nor the ticket
   * applies: both guard the road into NEW ground, and `travelTo` refuses any
   * stop past the furthest one reached, so nothing here can unlock a city.
   */
  const returnTo = () => {
    journey.travelTo(selected)
    setReturning(true)
    setRidingTo(selected)
  }
  // Only the stop you are STANDING at can be left, so tapping ahead down the
  // route shows a train that is a readout again.
  const boardable = travel.canBoard && nextCity !== null && selected === journey.cityIndex

  // Look ahead: a stop not yet reached opens its chapter in the Travel Guide.
  // A stop already reached has no "Train lesson" any more (owner, 2026-09-05):
  // the chapter plays itself on the ride in, and the Guide holds it after.
  if (previewIndex !== null) {
    return (
      <TravelGuideBook
        initialEntry={{ kind: 'grammar', cityIndex: previewIndex }}
        onExit={() => setPreviewIndex(null)}
      />
    )
  }

  // The lesson ride, then the arrival. TrainRide retains a graceful
  // straight-through hand-off if a future route has no matching chapter.
  if (ridingTo !== null) {
    return (
      <TrainRide
        destinationCityIndex={ridingTo}
        onDone={() => {
          setArrivedIndex(ridingTo)
          setRidingTo(null)
        }}
      />
    )
  }

  if (arrivedIndex !== null) {
    return <Arrival cityIndex={arrivedIndex} returning={returning} onSeeMap={() => setArrivedIndex(null)} />
  }

  return (
    <div className="screen map-screen">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.home.back} onClick={() => goTo('home')}>
          ←
        </button>
        <h1>{UI.home.journeyTitle}</h1>
        <TravelGuideButton home={false} className="map-lessons" onClick={() => goTo('guide')} />
      </header>

      <svg
        className="denmark-map"
        viewBox={`0 0 ${MAP.width} ${MAP.height}`}
        role="img"
        aria-label={UI.home.mapAria(
          ACTIVE.route.country,
          journey.cityIndex + 1,
          drawnCount,
          cityAt(journey.cityIndex).name,
        )}
      >
        {/* Three passes, under the route: the land, its shading, and the
            second time round the coastline. */}
        <path className="map-land" d={MAP.path} />
        <path className="map-hatch" d={MAP.hatch} />
        <path className="map-sketch" d={MAP.sketch} />
        <path className="map-route-ahead" d={aheadPath} />
        <path className="map-route-done" d={travelledPath} />

        {CITIES.slice(0, drawnCount).map((c, i) => {
          const p = points[i]!
          const place = PLACEMENT[c.id] ?? defaultPlacement(p.x)
          const status = statusOf(i)
          // The word for the status, resolved out here: `status` is an
          // identifier and the name for it is copy.
          const statusWord =
            status === 'visited'
              ? UI.home.statusVisited
              : status === 'current'
                ? UI.home.statusHere
                : UI.home.statusNotReached
          return (
            <g key={c.id} className={`map-city map-city-${status} ${selected === i ? 'map-city-selected' : ''}`}>
              <circle className="map-dot" cx={p.x} cy={p.y} r={status === 'current' ? 24 : 18} />
              <text
                className="map-label"
                x={p.x + place.dx}
                y={p.y + place.dy}
                textAnchor={place.anchor}
              >
                {c.name}
              </text>
              {/* The stop, for a keyboard and for assistive tech. It is NOT
                  the touch target any more: it used to be a transparent r=58
                  circle described as "44px-equivalent", and view units are not
                  pixels — see nearestStop, which has the measurements. The
                  pointer belongs to the one surface below, so this is
                  pointer-events: none and keeps only the keys. */}
              <circle
                className="map-hit"
                cx={p.x}
                cy={p.y}
                r={58}
                role="button"
                tabIndex={0}
                aria-label={UI.home.stopAria(c.name, i + 1, statusWord)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(i)
                  }
                }}
              />
            </g>
          )
        })}

        {/* ONE target for the whole map, and the stop it picks is the nearest.
            Last, so it is over everything above it. Its own rectangle IS the
            viewBox, so a click reads back into map units by proportion and the
            letterboxing a short phone adds cannot skew it. aria-hidden and not
            focusable: the nine circles above are what a keyboard and a screen
            reader walk, and this would be a tenth stop with no name. */}
        <rect
          className="map-surface"
          x={0}
          y={0}
          width={MAP.width}
          height={MAP.height}
          aria-hidden="true"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect()
            if (!box.width || !box.height) return
            setSelected(
              // Every visible stop is selectable; selection is read-only until
              // the appropriate access and destination gates allow boarding.
              nearestStop(drawnPoints, {
                x: ((e.clientX - box.left) / box.width) * MAP.width,
                y: ((e.clientY - box.top) / box.height) * MAP.height,
              }),
            )
          }}
        />
      </svg>

      <section className="map-detail">
        {/* The arrival date lives up here, with the stop's other facts, rather
            than on the counts line below: there it pushed "wrapped ·
            collected · discovered" onto a second line, and every line in this
            card is a strip of the map above it. */}
        <p className="city-eyebrow">
          {UI.home.stopOf(selected + 1, drawnCount)} ·{' '}
          {state === 'visited'
            ? UI.home.statusVisited
            : state === 'current'
              ? UI.home.statusHere
              : UI.home.statusAhead}
          {journey.arrivedAt[selected] && (
            // UL11: the date reads in the language the app is speaking.
            <>
              {' '}
              ·{' '}
              {UI.home.arrivedOn(
                new Date(journey.arrivedAt[selected]!).toLocaleDateString(
                  UI_LANGUAGE_INFO[UI_LANGUAGE].tag,
                ),
              )}
            </>
          )}
        </p>
        {/* The stop, steppable, on the row the name already pays for.
            The map above is the nice way to choose a stop and it is not the
            reliable way on a short phone: at 360x640 the whole drawing is
            328x134, which puts Roskilde and København 10.7px apart, and no
            hit testing makes two dots that close separately tappable with a
            finger. These are ordinary 42px buttons and they reach every stop
            at every size, which is what the panel below them needs — "Look
            ahead" and "Travel ahead" only exist for a stop AHEAD of you, so
            a stop you cannot select is a stop those buttons are not on. */}
        <div className="city-heading">
          <button
            className="icon-btn stop-step"
            aria-label={UI.home.previousStopAria}
            disabled={selected === 0}
            onClick={() => setSelected((i) => Math.max(0, i - 1))}
          >
            ‹
          </button>
          <h2 className="city-name" lang={ACTIVE.code}>
            {city.name}
          </h2>
          <button
            className="icon-btn stop-step"
            aria-label={UI.home.nextStopAria}
            disabled={selected === drawnCount - 1}
            onClick={() => setSelected((i) => Math.min(drawnCount - 1, i + 1))}
          >
            ›
          </button>
        </div>
        {/* The card's one give-way region. Everything else in it is a control
            or a number; these two are the flavour, so when a phone is short
            enough that the map would otherwise vanish they are what yields —
            they scroll inside their own box, and the document never does.
            See .denmark-map and .city-blurbs in src/styles/12-map-exam-arrival.css for the budget. */}
        <div className="city-blurbs">
          <p className="city-blurb" lang={ACTIVE.code}>
            {city.blurbTarget}
          </p>
          <p className="city-blurb-en">{city.blurbEn}</p>
        </div>

        {state === 'ahead' ? (
          <>
            <p className="map-locked">{UI.home.wordsWaiting(WORDS_PER_CITY, city.name)}</p>
            <div className="map-city-actions">
              <Tag className="map-look-ahead" label={UI.home.lookAhead} onClick={() => setPreviewIndex(selected)} />
              {playtestTravel && (
                <Tag
                  tone="primary"
                  className="map-travel-ahead"
                  label={UI.home.travelAhead}
                  onClick={() => {
                    journey.playtestTravelTo(selected, Date.now())
                    // A café the walks have not found cannot be opened (CW-04's
                    // gate, inside newGame). A refusal goes Home, whose Café
                    // puzzle tag says to find it first, rather than leaving
                    // this button doing nothing (CW-08).
                    if (dealOrFallBack(() => newGame({ cityIndex: selected }), () => goTo('home'))) goTo('game')
                  }}
                />
              )}
              {/* The switch, standing exactly where the button it reveals
                  will stand. It lives in Settings too and always did — and
                  Settings is three screens away from the stop you are looking
                  at, so the one control that makes Travel ahead exist was
                  invisible from the one place it matters. Looking at a stop
                  ahead of you IS the moment you want the jumper.

                  Shown only while it is OFF, which is what keeps this row at
                  two controls and one line. Three of them wrap at 360px, and
                  the wrap comes out of the map: measured, Denmark went from
                  192px to 87 — a smudge — with the drawing being the flexible
                  child of this column. Turning the jumper back OFF stays in
                  Settings, where it has always been: it is a rare, deliberate
                  act, while turning it on is the one you want in your hand at
                  the stop.

                  Developer builds only. `playtestAllowed` compiles to false in
                  a normal or feedback bundle, so nothing here renders in one —
                  the same gate the Settings section is behind. */}
              {playtestAllowed && !playtestOn && (
                <button
                  type="button"
                  className="btn btn-small map-playtest"
                  onClick={() => setSettings({ playtestTravel: true })}
                >
                  {UI.home.enableTravelAhead}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {state === 'visited' ? (
              <p className="map-case-note">{UI.home.cityMedal(medal === null ? UI.home.cityMedalInProgress : RECEIPT_UI[medal])}</p>
            ) : (
              <>
                <TrainProgress
                  className="map-train"
                  earned={cityTrain.collected}
                  goal={cityTrain.total}
                  label={boardable && onward ? UI.home.boardTrain(onward.name) : UI.sightseeing.trainStripLabel(cityTrain.collected, cityTrain.total, cityTrain.slips)}
                  {...(boardable ? { onBoard: board } : {})}
                />
                <p className="map-case-note">
                  {travel.ready
                    ? travel.destinationAvailable ? UI.home.readyToTravel : UI.home.nextStopNotReleased(nextCity?.name ?? '')
                    : UI.home.cityMedal(medal === null ? UI.home.cityMedalInProgress : RECEIPT_UI[medal])}
                </p>
              </>
            )}
          </>
        )}
      </section>

      {state === 'visited' ? (
        <Tag
          size="wide"
          tone="primary"
          className="map-return"
          onClick={returnTo}
          label={selected < journey.cityIndex
            ? UI.home.travelBackTo(city.name)
            : UI.home.travelOnTo(city.name)}
        />
      ) : boardable && nextCity ? (
        <Tag size="wide" tone="primary" className="map-board" label={UI.home.travelOnTo(nextCity.name)} onClick={board} />
      ) : null}

      <p className="map-credit">{UI.home.mapCredit}</p>
    </div>
  )
}
