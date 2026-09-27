import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testCatalog } from '../review/city1.fixtures'
vi.mock('../review/city1', async importOriginal => ({ ...await importOriginal<typeof import('../review/city1')>(), CITY1_CATALOG: testCatalog }))
const saved = new Map<string, string>()
const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v) }, removeItem: (k: string) => { saved.delete(k) } }
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const { useGame, migrateGame } = await import('./gameStore')
const { useSettings } = await import('./settingsStore')
const { useUi } = await import('./uiStore')
const { useSrs } = await import('./srsStore')
const { useCurriculum } = await import('./curriculumStore')
const { useSurvival } = await import('./survivalStore')
const { useJourney } = await import('./journeyStore')
beforeEach(async () => {
  await useGame.getState().finishRound()
  saved.clear()
  useGame.setState(useGame.getInitialState())
  useSrs.setState(useSrs.getInitialState())
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network') }))
  useUi.setState({ pendingFirstGiver: 'player', onboarding: null })
  useSettings.setState({ useMock: false, dataSharing: 'private' })
  useGame.getState().newGame({ cityIndex: 0, seed: 23 })
})
afterEach(async () => { await useGame.getState().finishRound(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function finish() {
  const game = useGame.getState().game!
  // A developer-only reader fixture, not a required-board claim: every green
  // history entry has an on-board word, a matching clue key and a green reveal.
  // Two catalogue pins deliberately reuse the dog to test independent positions.
  const words = [{ wordId: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun' as const },
    ...game.words.filter(word => word.wordId !== 'da:hund').slice(0, game.words.length - 1)]
  const greens = game.config.greensPerSide, overlap = game.config.greenOverlap
  const playerKey = Object.fromEntries(words.map((word, i) => [word.wordId, i < greens ? 'green' as const : 'bystander' as const]))
  const aiKey = Object.fromEntries(words.map((word, i) => [word.wordId, i >= greens - overlap && i < greens * 2 - overlap ? 'green' as const : 'bystander' as const]))
  useGame.setState({ game: { ...game, words, playerKey, aiKey, phase: 'suddenDeath', turnsLeft: 0,
    reveals: Object.fromEntries(words.map(word => [word.wordId, { kind: word.wordId === 'da:hund' ? 'green' as const : 'hidden' as const }])),
    clueHistory: [0, 1].map(() => ({ by: 'player', text: 'Animals', number: 2, guesses: [{ wordId: 'da:hund', result: 'green' }] })) } })
  useGame.getState().playerStop()
  await useGame.getState().finishRound()
  expect(useGame.getState().error, useGame.getState().settlementFailure ?? undefined).toBeNull()
}
// Every accepted fixture must pass the same terminal validation as production.
describe('City 1 review store lifecycle', () => {
  it('queues once, persists exact pins/cursor, dismisses without reward or evidence writes, resets on new deal', async () => {
    await finish()
    const queue = useGame.getState().sentenceReview!
    expect(queue.queue).toHaveLength(2)
    const games = structuredClone(useSrs.getState().games)
    const stats = structuredClone(useSrs.getState().stats)
    const curriculum = useCurriculum.getState()
    const survival = useSurvival.getState()
    const journey = useJourney.getState()
    useGame.getState().nextReviewSentence()
    await useGame.getState().finishRound()
    expect(useGame.getState().sentenceReview?.cursor).toBe(1)
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().sentenceReview).toEqual({ ...queue, cursor: 1 })
    useGame.getState().dismissSentenceReview()
    useGame.getState().dismissSentenceReview()
    useGame.getState().nextReviewSentence()
    await useGame.getState().finishRound()
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().sentenceReview?.dismissed).toBe(true)
    expect(useSrs.getState().games).toEqual(games)
    expect(useSrs.getState().stats).toEqual(stats)
    expect(useCurriculum.getState()).toBe(curriculum)
    expect(useSurvival.getState()).toBe(survival)
    expect(useJourney.getState()).toBe(journey)
    useGame.getState().newGame({ cityIndex: 0, seed: 23 })
    expect(useGame.getState().sentenceReview).toBeNull()
    expect(useGame.getState().reviewRoundId).not.toBe(queue.roundId)
  })
  it('migration keeps legacy rewards/boards and dismisses finished review even if finish was not recorded', async () => {
    await finish()
    const current = useGame.getState()
    const legacy = migrateGame({ ...current, roundRecorded: false }, 10) as typeof current
    expect(legacy.game).toBe(current.game)
    expect(legacy.roundRecorded).toBe(false)
    expect(legacy.reviewRoundId).toBeNull()
    expect(legacy.sentenceReview).toBeNull()
    useGame.setState(legacy)
    await useGame.getState().finishRound()
    expect(useGame.getState().sentenceReview).toBeNull()
    const recorded = migrateGame(current, 10) as typeof current
    expect(recorded.roundRecorded).toBe(true)
  })
  it('dismisses tampered persisted pins on real hydration without requeueing', async () => {
    await finish()
    const persisted = JSON.parse(saved.get('cluecab-game-v1')!)
    persisted.state.sentenceReview.queue[0].audioId = 'old recording'
    saved.set('cluecab-game-v1', JSON.stringify(persisted))
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().sentenceReview?.dismissed).toBe(true)
    await useGame.getState().finishRound()
    expect(useGame.getState().sentenceReview?.queue).toEqual([])
  })
  it('keeps City 2, the tutorial and the retired wrap-up out of the new review', async () => {
    useGame.setState({ boardCityIndex: 1 }); await finish()
    expect(useGame.getState().sentenceReview?.queue).toEqual([])
    useGame.getState().newTutorialGame(); await finish()
    expect(useGame.getState().sentenceReview?.queue).toEqual([])
    // C1-PC-1 successor: legacy wrap-up cannot mint a receipt or reader.
    useGame.getState().newGame({ cityIndex: 0, seed: 24 })
    useGame.setState({ mode: 'wrapup', attemptId: null, attemptOrigin: null }); await finish()
    expect(useGame.getState().sentenceReview).toBeNull()
    expect(useGame.getState().completionReceipt).toBeNull()
  })
})


it.each(['inflight', 'parked'] as const)('C1-06 successor: archives incompatible legacy %s evidence once without receipt authority or skip', async slot => {
  if (slot === 'parked') {
    const { roundOf } = await import('./gameStore')
    useGame.setState({ parked: roundOf(useGame.getState()) })
  }
  const persisted = JSON.parse(saved.get('cluecab-game-v1')!)
  persisted.version = 10
  delete persisted.state.reviewRoundId
  delete persisted.state.sentenceReview
  if (persisted.state.parked) {
    delete persisted.state.parked.reviewRoundId
    delete persisted.state.parked.sentenceReview
  }
  const originalGame = slot === 'parked' ? persisted.state.parked.game : persisted.state.game
  saved.set('cluecab-game-v1', JSON.stringify(persisted))
  await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
  expect(useGame.getState().game).toBeNull()
  const migration = JSON.parse(saved.get('cluecab-save-migration-v1')!)
  expect(slot === 'parked' ? migration.evidence.parked.game : migration.evidence.game).toEqual(originalGame)
  expect(migration.retired).toBe(true)
  expect(useGame.getState().migrationNotice).toBe(true)
  const { CITY1_REQUIRED_SET } = await import('../session/courseRuntime')
  expect(useGame.getState().sessions?.continuation.remainingBoardKeys).toHaveLength(CITY1_REQUIRED_SET.boards.length)
  expect(useGame.getState().sentenceReview).toBeNull()
  const played = useSrs.getState().games.played
  await useGame.getState().finishRound()
  // Incompatible old developer deals have no required-board authority.
  expect(useGame.getState().sentenceReview).toBeNull()
  expect(useGame.getState().attemptId).toBeNull()
  expect(useSrs.getState().games.played).toBe(played)
  const rewards = structuredClone({ games: useSrs.getState().games, stats: useSrs.getState().stats })
  await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
  await useGame.getState().finishRound()
  useGame.getState().dismissSentenceReview()
  await useGame.getState().finishRound()
  expect({ games: useSrs.getState().games, stats: useSrs.getState().stats }).toEqual(rewards)
  expect(JSON.parse(saved.get('cluecab-save-migration-v1')!)).toEqual(migration)
})

it('restores retained old pins from storage alongside a newer selectable version', async () => {
  await finish()
  useGame.getState().nextReviewSentence()
  const pinned = structuredClone(useGame.getState().sentenceReview)
  const old = testCatalog.review[0]!
  const newer = { ...old, version: 2, sentenceId: old.sentenceId.replace('v1', 'v2'),
    audioId: old.audioId.replace('v1', 'v2'), text: { ...old.text, en: 'TEST newer translation' } }
  const original = testCatalog.review
  testCatalog.review = [...original, newer]
  try {
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().sentenceReview).toEqual(pinned)
    useGame.getState().newGame({ cityIndex: 0, seed: 23 })
    await finish()
    expect(useGame.getState().sentenceReview?.queue[0]?.version).toBe(2)
  } finally { testCatalog.review = original }
})
