import { describe, expect, it } from 'vitest'
import { emptyProgressFacts } from '../progression/facts'
import { cityKey } from '../progression/identity'
import type { CityIdentity } from '../progression/types'
import { useJourney } from '../stores/journeyStore'
import type { TrainRunFacts } from './progress'
import { closedLineLabel, journeyTravelGate, maintenanceNotice, OPEN_ROUTE_END, reopenedNotice, trainRunsFrom } from './trainService'

const CITY1 = { courseId: 'da', cityId: 'sonderborg' } as const
const READY = {
  ...emptyProgressFacts(),
  legacyCredit: { identity: 'danish-city1-legacy-v1' as const, amount: 100 },
}
/** A caught train for `city`: the ticket the train run stores (CW-07). */
const ticket = (city: CityIdentity): TrainRunFacts => ({
  [cityKey(city)]: { city, passed: true, at: 1_790_000_000_000, words: 147, photos: 140, slips: 7, allowed: 8 },
})
const CAUGHT = ticket(CITY1)

describe('the train service at launch', () => {
  it('serves no departure at all while the launch is City 1', () => {
    expect(OPEN_ROUTE_END).toBe(0)
    expect(trainRunsFrom(0)).toBe(false)
    expect(trainRunsFrom(3)).toBe(false)
    expect(trainRunsFrom(-1, { bypass: true })).toBe(false)
    expect(trainRunsFrom(8, { bypass: true })).toBe(false)
  })

  it('opens one stop at a time as the route end is raised', () => {
    expect(trainRunsFrom(0, { openTo: 1 })).toBe(true)
    expect(trainRunsFrom(1, { openTo: 1 })).toBe(false)
    expect(trainRunsFrom(7, { openTo: 8 })).toBe(true)
  })

  it('lets the audiences that are meant to see the route through', () => {
    expect(trainRunsFrom(0, { bypass: true })).toBe(true)
    expect(trainRunsFrom(5, { openTo: 0, bypass: true })).toBe(true)
  })

  it('names the next stop in every piece of copy, and says it is maintenance, not money', () => {
    for (const text of [closedLineLabel('Ribe'), maintenanceNotice('Ribe').body, reopenedNotice('Ribe').title]) {
      expect(text).toContain('Ribe')
      expect(text.toLowerCase()).not.toMatch(/pass|ticket|buy|pay/)
    }
    expect(maintenanceNotice('Ribe').title).toMatch(/maintenance/)
    expect(maintenanceNotice('Ribe').body).toMatch(/let you know/)
  })

  it('CW-07 the train run is the only way on: postcards, historical eligibility and a pass do not make a city ready', () => {
    const postcardsOnly = journeyTravelGate({
      facts: READY, city: CITY1, cityIndex: 0, historicalEligibility: true,
      passStatus: 'entitled', audience: 'feedback', trainRuns: {},
    })
    // The postcard numbers are still there for the screens that print them...
    expect(postcardsOnly).toMatchObject({ earned: 100, thresholdReady: true, historicalEligibility: true })
    // ...but they do not travel, even in the build that bypasses the closed line.
    expect(postcardsOnly).toMatchObject({ trainRunPassed: false, ready: false, destinationAvailable: true, canBoard: false })
  })

  it('CW-07 no unreleased city opens: a caught train in the public build is ready and still cannot board', () => {
    for (const passStatus of ['entitled', 'unavailable', 'not-entitled'] as const) {
      const normal = journeyTravelGate({
        facts: emptyProgressFacts(), city: CITY1, cityIndex: 0, historicalEligibility: false,
        passStatus, audience: 'normal', developerTravel: true, trainRuns: CAUGHT,
      })
      expect(normal, passStatus).toMatchObject({ trainRunPassed: true, ready: true, destinationAvailable: false, canBoard: false })
    }
  })

  it('CW-07 a ticket for another city, or a run that did not pass, opens nothing here', () => {
    const base = { facts: READY, city: CITY1, cityIndex: 0, historicalEligibility: false, passStatus: 'unavailable', audience: 'feedback' } as const
    expect(journeyTravelGate({ ...base, trainRuns: ticket({ courseId: 'da', cityId: 'ribe' }) }).ready).toBe(false)
    expect(journeyTravelGate({ ...base, trainRuns: ticket({ courseId: 'de', cityId: 'sonderborg' }) }).ready).toBe(false)
    const failed = { [cityKey(CITY1)]: { ...CAUGHT[cityKey(CITY1)]!, passed: false } }
    expect(journeyTravelGate({ ...base, trainRuns: failed }).ready).toBe(false)
  })

  it('CW-07 the feedback build boards once the train is caught, and only then', () => {
    const base = { facts: emptyProgressFacts(), city: CITY1, cityIndex: 0, historicalEligibility: false, passStatus: 'unavailable', audience: 'feedback' } as const
    expect(journeyTravelGate({ ...base, trainRuns: {} })).toMatchObject({ ready: false, destinationAvailable: true, accessAllowed: true, canBoard: false })
    expect(journeyTravelGate({ ...base, trainRuns: CAUGHT })).toMatchObject({ ready: true, destinationAvailable: true, accessAllowed: true, canBoard: true })
    // The normal build with the same ticket: still the closed line.
    expect(journeyTravelGate({ ...base, audience: 'normal', trainRuns: CAUGHT }).canBoard).toBe(false)
  })

  it('CW-07 the developer build boards with its explicit switch and a caught train, never without the train', () => {
    const base = { facts: READY, city: CITY1, cityIndex: 0, historicalEligibility: true, passStatus: 'unavailable', audience: 'developer' } as const
    expect(journeyTravelGate({ ...base, developerTravel: true, trainRuns: {} }).canBoard).toBe(false)
    expect(journeyTravelGate({ ...base, developerTravel: true, trainRuns: CAUGHT }).canBoard).toBe(true)
    expect(journeyTravelGate({ ...base, developerTravel: false, trainRuns: CAUGHT })).toMatchObject({ ready: true, canBoard: false })
  })

  it('CW-07 Home and the map, which pass no tickets, read the live journey store', () => {
    const before = useJourney.getState().trainRuns
    try {
      const base = { facts: emptyProgressFacts(), city: CITY1, cityIndex: 0, historicalEligibility: false, passStatus: 'unavailable', audience: 'feedback' } as const
      useJourney.setState({ trainRuns: {} })
      expect(journeyTravelGate(base).canBoard).toBe(false)
      useJourney.getState().recordTrainRun(CAUGHT[cityKey(CITY1)]!)
      expect(journeyTravelGate(base).canBoard).toBe(true)
      expect(journeyTravelGate({ ...base, audience: 'normal' }).canBoard).toBe(false)
    } finally {
      useJourney.setState({ trainRuns: before })
    }
  })

  it('AC19/20 hides a German learner-course preview from normal builds even when a route is configured open', () => {
    const german = { courseId: 'de', cityId: 'sonderborg' } as const
    const normal = journeyTravelGate({
      facts: emptyProgressFacts(), city: german, cityIndex: 0, threshold: 1, trainRuns: ticket(german),
      historicalEligibility: true, passStatus: 'entitled', audience: 'normal', openTo: 1,
    })
    expect(normal).toMatchObject({ ready: true, destinationAvailable: false, canBoard: false })

    const developer = journeyTravelGate({
      facts: emptyProgressFacts(), city: german, cityIndex: 0, threshold: 1, trainRuns: ticket(german),
      historicalEligibility: true, passStatus: 'unavailable', audience: 'developer', developerTravel: true,
    })
    expect(developer).toMatchObject({ ready: true, destinationAvailable: true, canBoard: true })
  })

  it('AC19 browsing or replaying another city cannot replace the current route identity', () => {
    const ribe = { courseId: 'da', cityId: 'ribe' } as const
    const viewedRibe = journeyTravelGate({
      facts: READY,
      city: ribe,
      cityIndex: 0,
      historicalEligibility: true,
      passStatus: 'unavailable',
      audience: 'feedback',
      trainRuns: ticket(ribe),
    })
    expect(viewedRibe).toMatchObject({
      ready: true,
      identityMatchesPosition: false,
      destinationAvailable: false,
      canBoard: false,
    })
  })
})
