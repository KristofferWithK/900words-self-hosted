// A long-played profile for the simulator soak (ios-sim.yml mode=soak).
//
//   node scripts/make-soak-seed.mjs [rounds] > soak-seed.json
//
// Prints one JSON object, localStorage key -> value, that the workflow writes
// into the app before it starts (the same injection the keyboard check uses
// for ios/sim-seed.json). The point is a save as big as the owner's after weeks
// of play, because the hitch on the phone grows with time and the stored state
// is one suspect: `rounds` settled café puzzles in the settlement ledger
// (default 40; the app keeps the last 20 in full), photos on three days for
// every word, every City 1 café found, City 1's words collected, a run count
// on recent days. Plus the three performance-log flags: record from launch,
// stream the log to the console, and play by itself (Casey scripted).
//
// Built from the app's own fixtures and writers (vite ssrLoadModule, as
// e2e/daily-limit-drive.mjs does), so the save is one the app accepts.
import { createServer } from 'vite'
import { firstCafeFinds } from '../e2e/_found-cafe.mjs'

const rounds = Number(process.argv[2] ?? 40)
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const dayKey = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const source = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const seed = {}
try {
  const load = (id) => source.ssrLoadModule(id)
  const [{ attemptFixture, MATRIX_FIXTURES, settlementFixture }, { acknowledgeEffect, emptySettlementLedger, prepareSettlement }, { prepareLearning }, { WORDS }, { wordsForCity }, { HOWTO_KEY }, { ONBOARD_KEY }, { RUNS_KEY }] = await Promise.all([
    load('/src/progression/fixtures.ts'),
    load('/src/progression/settlement.ts'),
    load('/src/srs/settlement.ts'),
    load('/src/data/words.ts'),
    load('/src/journey/progress.ts'),
    load('/src/stores/uiStore.ts'),
    load('/src/onboarding/flow.ts'),
    load('/src/purchase/dailyGames.ts'),
  ])

  // Settled café puzzles, one or two a day going back.
  const game = MATRIX_FIXTURES[5].game
  let ledger = emptySettlementLedger()
  for (let i = 0; i < rounds; i++) {
    const acceptedAt = now - (rounds - i) * (DAY / 2)
    const attemptId = `soak-${i}`
    const input = settlementFixture(game, {
      attempt: attemptFixture(game, { attemptId, origin: 'daily' }),
      acceptedAt,
      localDate: dayKey(acceptedAt),
      dailyKey: attemptId,
      continuation: null,
    })
    const prepared = prepareSettlement(ledger, { ...input, learning: prepareLearning(game, [], {}, {}, acceptedAt) })
    if (prepared.status === 'blocked') throw new Error(`round ${i}: ${prepared.reason}`)
    ledger = prepared.ledger
    for (const effect of prepared.receipt.effects) ledger = acknowledgeEffect(ledger, prepared.receipt.receiptId, effect)
  }
  seed['cluecab-settlement-v1'] = JSON.stringify(ledger)

  // Photos on three days for every word; City 1's words collected.
  const photos = {}
  for (const w of WORDS) photos[w.id] = Object.fromEntries([9, 6, 3].map((d) => [dayKey(now - d * DAY), now - d * DAY]))
  const stats = {}
  for (const w of wordsForCity(WORDS, 0)) {
    stats[w.id] = { box: 3, lastSeenAt: now - DAY, seen: 3, correctGuesses: 3, misses: 1, lookups: 1, redemptionRight: 0, redemptionWrong: 0, greenByClue: 1, greenByGuess: 1 }
  }
  seed['cluecab-srs-v1'] = JSON.stringify({ state: { stats, translationPostcards: 0 }, version: 7 })
  seed['cluecab-journey-v2'] = JSON.stringify({
    version: 7,
    state: {
      cityIndex: 0, furthest: 0, arrivedAt: {}, wrapped: {}, routeLanguage: 'da', parked: {}, historicalRoutes: {},
      waitingForTrain: false, historicalTravelEligibility: {}, photos,
      cafes: firstCafeFinds('da', now - 9 * DAY, 100),
    },
  })
  seed[RUNS_KEY] = JSON.stringify({ days: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [dayKey(now - d * DAY), 6])) })
  seed['cluecab-sightseeing-best'] = JSON.stringify({ words: 23 })
  seed[ONBOARD_KEY] = 'done'
  seed[HOWTO_KEY] = 'seen'
} finally {
  await source.close()
}

seed['cluecab-diag-rec'] = '1'
seed['cluecab-diag-stream'] = '1'
seed['cluecab-diag-autoplay'] = '1'
process.stdout.write(`${JSON.stringify(seed)}\n`)
const size = Object.values(seed).reduce((n, v) => n + v.length, 0)
console.error(`soak seed: ${Object.keys(seed).length} keys, ${size} chars, ${rounds} rounds`)
