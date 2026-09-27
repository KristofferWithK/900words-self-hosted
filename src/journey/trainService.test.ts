import { describe, expect, it } from 'vitest'
import { emptyProgressFacts } from '../progression/facts'
import { closedLineLabel, journeyTravelGate, maintenanceNotice, OPEN_ROUTE_END, reopenedNotice, trainRunsFrom } from './trainService'

const CITY1 = { courseId: 'da', cityId: 'sonderborg' } as const
const READY = {
  ...emptyProgressFacts(),
  legacyCredit: { identity: 'danish-city1-legacy-v1' as const, amount: 100 },
}

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

  it('AC20 keeps readiness, route availability, and access independent in the normal audience', () => {
    const normal = journeyTravelGate({
      facts: READY,
      city: CITY1,
      cityIndex: 0,
      historicalEligibility: false,
      passStatus: 'entitled',
      audience: 'normal',
      developerTravel: true,
    })
    expect(normal).toMatchObject({
      earned: 100,
      thresholdReady: true,
      ready: true,
      destinationAvailable: false,
      accessAllowed: true,
      canBoard: false,
    })
  })

  it('AC20 restored historical eligibility cannot bypass the closed public route', () => {
    const restored = journeyTravelGate({
      facts: emptyProgressFacts(),
      city: CITY1,
      cityIndex: 0,
      historicalEligibility: true,
      passStatus: 'unavailable',
      audience: 'normal',
    })
    expect(restored).toMatchObject({
      earned: 0,
      historicalEligibility: true,
      ready: true,
      destinationAvailable: false,
      canBoard: false,
    })
  })

  it('AC19/20 hides a German learner-course preview from normal builds even when a route is configured open', () => {
    const german = { courseId: 'de', cityId: 'sonderborg' } as const
    const normal = journeyTravelGate({
      facts: emptyProgressFacts(), city: german, cityIndex: 0, threshold: 1,
      historicalEligibility: true, passStatus: 'entitled', audience: 'normal', openTo: 1,
    })
    expect(normal).toMatchObject({ ready: true, destinationAvailable: false, canBoard: false })

    const developer = journeyTravelGate({
      facts: emptyProgressFacts(), city: german, cityIndex: 0, threshold: 1,
      historicalEligibility: true, passStatus: 'unavailable', audience: 'developer', developerTravel: true,
    })
    expect(developer).toMatchObject({ ready: true, destinationAvailable: true, canBoard: true })
  })

  it('feedback route access remains a build capability, not a persisted normal-audience bypass', () => {
    const feedback = journeyTravelGate({
      facts: READY, city: CITY1, cityIndex: 0, historicalEligibility: false,
      passStatus: 'unavailable', audience: 'feedback',
    })
    expect(feedback).toMatchObject({ destinationAvailable: true, accessAllowed: true, canBoard: true })
    expect(journeyTravelGate({
      facts: READY, city: CITY1, cityIndex: 0, historicalEligibility: false,
      passStatus: 'unavailable', audience: 'normal',
    }).canBoard).toBe(false)
  })

  it('AC19 browsing or replaying another city cannot replace the current route identity', () => {
    const viewedRibe = journeyTravelGate({
      facts: READY,
      city: { courseId: 'da', cityId: 'ribe' },
      cityIndex: 0,
      historicalEligibility: true,
      passStatus: 'unavailable',
      audience: 'feedback',
    })
    expect(viewedRibe).toMatchObject({
      ready: true,
      identityMatchesPosition: false,
      destinationAvailable: false,
      canBoard: false,
    })
  })
})
