import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CITY1_CATALOG, selectQueue } from '../review/city1'
const saved = new Map<string, string>()
const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v) }, removeItem: (k: string) => { saved.delete(k) } }
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const { useGame } = await import('./gameStore')
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

it('finishes with the accepted bank, preserves exact pins and evidence through reload, and queues no City2 review', async () => {
  await finish()
  const original = useGame.getState().sentenceReview!
  expect(original.queue).toEqual(selectQueue(useGame.getState().game!.clueHistory, CITY1_CATALOG.review))
  expect(original.queue[0]?.version).toBe(CITY1_CATALOG.review.find(r => r.wordId === 'da:hund')!.version)
  const evidence = () => JSON.stringify([useSrs.getState(), useCurriculum.getState(), useSurvival.getState(), useJourney.getState()])
  const before = evidence()
  useGame.getState().nextReviewSentence()
  await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
  expect(useGame.getState().sentenceReview).toEqual({ ...original, cursor: 1 })
  await useGame.getState().finishRound()
  useGame.getState().dismissSentenceReview()
  useGame.getState().dismissSentenceReview()
  expect(evidence()).toBe(before)
  useGame.getState().newGame({ cityIndex: 1 })
  await finish()
  expect(useGame.getState().sentenceReview?.queue).toEqual([])
})
