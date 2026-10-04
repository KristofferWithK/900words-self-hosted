import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saved = new Map<string, string>()
const storage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => void saved.set(key, value),
  removeItem: (key: string) => void saved.delete(key),
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
import type { RoundGuidance } from './gameStore'
const { useGame, migrateGame, roundOf } = await import('./gameStore')
const { useSettings } = await import('./settingsStore')
const { useUi } = await import('./uiStore')
const { OllamaCompanion } = await import('../ai/companion')

function clueReply() {
  const game = useGame.getState().game!
  const targets = game.words.filter((w) => game.aiKey[w.wordId] === 'green').slice(0, 2).map((w) => w.wordId)
  return { clue: 'connection', number: 2, targetWordIds: targets, rationale: 'Private target explanation' }
}
function announce() { useGame.getState().announceRoundGuidance() }
function dismiss(hide = false) { useGame.getState().dismissRoundGuidance(hide) }

async function nextPlayerClueTurn() {
  useGame.getState().submitPlayerClue('connection', 1)
  expect(useGame.getState().game!.phase).toBe('aiGuessing')
  const game = useGame.getState().game!
  const neutral = game.words.find((w) => game.playerKey[w.wordId] === 'bystander' && game.reveals[w.wordId]!.kind === 'hidden')!
  vi.spyOn(OllamaCompanion.prototype, 'getGuesses').mockResolvedValue({
    guesses: [{ wordId: neutral.wordId, confidence: 0.9, reasoning: 'Scripted neutral' }],
  })
  await useGame.getState().runAiGuesses()
  useGame.getState().stepAiGuess()
  expect(useGame.getState().game!.phase).toBe('aiClueInput')
  await reachFirstPlayerClueTurn()
}

async function reachFirstPlayerClueTurn() {
  vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(clueReply())
  await useGame.getState().runAiClue()
  const game = useGame.getState().game!
  const neutral = game.words.find((w) => game.aiKey[w.wordId] === 'bystander' && game.reveals[w.wordId]!.kind === 'hidden')!
  useGame.getState().playerGuess(neutral.wordId)
  expect(useGame.getState().game!.phase).toBe('playerClueInput')
}

beforeEach(async () => {
  await useGame.getState().finishRound()
  saved.clear()
  useGame.setState(useGame.getInitialState())
  useUi.setState({ pendingFirstGiver: 'ai', onboarding: null })
  useSettings.setState({ useMock: false, hidePlayerClueReminder: false, hideTranslationReminder: false })
  useGame.setState({ recentBoards: [], city1BoardCursor: 0 })
  // Any accidental transport call fails locally, never reaching a paid service.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request') }))
})
afterEach(async () => { await useGame.getState().finishRound(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('round guidance lifecycle', () => {
  it('announces the ready opening once, preserves its dock clue, and resets on a new deal', async () => {
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(clueReply())
    await useGame.getState().runAiClue()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('casey')
    const game = useGame.getState().game
    expect(useGame.getState().roundGuidance?.opening).toBe('announced')
    dismiss()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().game).toBe(game)
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    expect(useGame.getState().roundGuidance?.opening).toBe('pending')
  })

  it('persists announcement before dismissal so reload never reopens an announced clue', async () => {
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(clueReply())
    await useGame.getState().runAiClue()
    announce()
    const persisted = JSON.parse(saved.get('cluecab-game-v1')!)
    expect(persisted.state.roundGuidance.opening).toBe('announced')
    expect(persisted.state).not.toHaveProperty('activeRoundGuidance')
    useGame.setState({ activeRoundGuidance: null })
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })

  it.each(['ai', 'player'] as const)('teaches only the first player clue turn per round when %s opens', async (first) => {
    useUi.setState({ pendingFirstGiver: first })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    if (first === 'ai') await reachFirstPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss()
    for (let turn = 0; turn < 2; turn++) {
      await nextPlayerClueTurn()
      const before = roundOf(useGame.getState())
      announce()
      expect(useGame.getState().activeRoundGuidance).toBeNull()
      expect(roundOf(useGame.getState())).toEqual(before)
    }
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    if (first === 'ai') await reachFirstPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
  })

  it.each(['reload', 'parked'] as const)('does not repeat the first player announcement on later turns after %s', async (resume) => {
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    await reachFirstPlayerClueTurn()
    announce()
    const round = roundOf(useGame.getState())!
    expect(round.roundGuidance?.playerClueTurn).toBe(1)
    expect(JSON.parse(saved.get('cluecab-game-v1')!).state.roundGuidance.playerClueTurn).toBe(1)
    // Resume while still open: presentation, not dismissal, consumes the lesson.
    if (resume === 'parked') {
      useGame.getState().abandonGame()
      useGame.setState({ parked: round })
      await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
      useGame.getState().resumeParked()
    } else {
      useGame.setState({ activeRoundGuidance: null })
      await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    }
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(roundOf(useGame.getState())).toEqual(round)
    await nextPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })

  it('persists the opt-out across deals and reload without silencing guessing instructions', async () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss(true)
    expect(JSON.parse(saved.get('cluecab-settings-v1')!).state.hidePlayerClueReminder).toBe(true)
    await useSettings.persist.rehydrate()
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    await nextPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    // This preference only silences the player lesson, never Casey's opening.
    useUi.setState({ pendingFirstGiver: 'ai' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(clueReply())
    await useGame.getState().runAiClue()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('casey')
  })

  it('shows Translation time by default, hides it after the box is ticked, and keeps that across reload', async () => {
    const toTranslation = () => {
      useGame.setState({ game: { ...useGame.getState().game!, phase: 'translateChallenge' } })
      announce()
    }
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    dismiss()
    // Shown by default; dismissing without the box keeps the next round's.
    expect(useSettings.getState().hideTranslationReminder).toBe(false)
    toTranslation()
    expect(useGame.getState().activeRoundGuidance).toBe('translation')
    dismiss()
    expect(useSettings.getState().hideTranslationReminder).toBe(false)
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    dismiss()
    toTranslation()
    expect(useGame.getState().activeRoundGuidance).toBe('translation')
    // Ticking the box saves the preference in the settings store.
    dismiss(true)
    expect(useGame.getState().roundGuidance?.translation).toBe('dismissed')
    expect(JSON.parse(saved.get('cluecab-settings-v1')!).state.hideTranslationReminder).toBe(true)
    // It survives a reload and silences every later round's panel: forget
    // the in-memory value, put the stored save back, and read it again.
    const stored = saved.get('cluecab-settings-v1')!
    useSettings.setState({ hideTranslationReminder: false })
    saved.set('cluecab-settings-v1', stored)
    await useSettings.persist.rehydrate()
    expect(useSettings.getState().hideTranslationReminder).toBe(true)
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    toTranslation()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.setState({ game: { ...useGame.getState().game!, phase: 'translateWheel' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    // The Your turn box and this one are separate preferences.
    expect(useSettings.getState().hidePlayerClueReminder).toBe(false)
    // Ticking the Your turn box does not silence Translation time either.
    useSettings.setState({ hideTranslationReminder: false })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss(true)
    expect(useSettings.getState().hidePlayerClueReminder).toBe(true)
    expect(useSettings.getState().hideTranslationReminder).toBe(false)
    toTranslation()
    expect(useGame.getState().activeRoundGuidance).toBe('translation')
  })

  it('keeps special modes clear', () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    for (const mode of ['wrapup', 'tutorial'] as const) {
      useGame.setState({ mode, activeRoundGuidance: null })
      announce()
      expect(useGame.getState().activeRoundGuidance).toBeNull()
    }
  })

  it('leaves practice teaching alone and teaches once in the first real round after onboarding', async () => {
    useGame.getState().newTutorialGame()
    await useGame.getState().runAiClue()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.getState().playerGuess('da:bord')
    expect(useGame.getState().game!.phase).toBe('playerClueInput')
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    await reachFirstPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss()
    await nextPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })

  it('announces translation time independently of sudden death and never revives the clue guidance', async () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    expect(useGame.getState().roundGuidance?.translation).toBe('pending')
    announce()
    dismiss()
    // Not before the phase turns.
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    const game = useGame.getState().game!
    // The WHEEL challenge's opening is the first arrival (owner, 2026-09-17):
    // entering translateChallenge gets the pop-up with the spin sentence.
    useGame.setState({ game: { ...game, phase: 'translateChallenge' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('translation')
    expect(useGame.getState().roundGuidance?.translation).toBe('announced')
    // Persisted at announcement, so a reload mid-panel stays quiet.
    expect(JSON.parse(saved.get('cluecab-game-v1')!).state.roundGuidance.translation).toBe('announced')
    useGame.setState({ activeRoundGuidance: null })
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    expect(useGame.getState().game!.phase).toBe('translateChallenge')
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    // Dismissal records itself and the round is unchanged by the panel.
    useGame.setState({ activeRoundGuidance: 'translation' })
    dismiss()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().roundGuidance?.translation).toBe('dismissed')
    expect(useGame.getState().game!.phase).toBe('translateChallenge')
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    // Translation and sudden death are distinct lessons; neither reuses the clue prompt.
    useGame.setState({ roundGuidance: { ...useGame.getState().roundGuidance!, lastChance: 'pending' } })
    useGame.setState({ game: { ...useGame.getState().game!, phase: 'suddenDeath', turnsLeft: 0 } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('last-chance')
    expect(useGame.getState().roundGuidance?.lastChance).toBe('announced')
    dismiss()
    useGame.setState({ activeRoundGuidance: 'last-chance' })
    dismiss()
    // A wrap-up runs out of clues the same way and is told the same once;
    // the practice round keeps its own teaching.
    const guidance = useGame.getState().roundGuidance!
    useGame.setState({ mode: 'wrapup', roundGuidance: { ...guidance, lastChance: 'pending' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('last-chance')
    dismiss()
    useGame.setState({ mode: 'tutorial', roundGuidance: { ...guidance, lastChance: 'pending' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.setState({ mode: 'normal' })
    // A save from before the field existed reads as not yet told.
    useGame.setState({ roundGuidance: { opening: 'dismissed', playerClueTurn: 0 } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('last-chance')
    dismiss()
    // And a new deal starts the record over.
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    expect(useGame.getState().roundGuidance?.lastChance).toBe('pending')
  })

  it('announces the packing lesson once while a wrap-up is packing, and nothing else until it is done', async () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    // An ordinary round is never told about packing: there is none.
    expect(useGame.getState().roundGuidance?.packing).toBe('dismissed')
    const guidance = useGame.getState().roundGuidance!
    useGame.setState({ mode: 'wrapup', packingDone: false, roundGuidance: { ...guidance, packing: 'pending' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('packing')
    expect(useGame.getState().roundGuidance?.packing).toBe('announced')
    // Persisted at announcement, so a reload mid-panel stays quiet.
    expect(JSON.parse(saved.get('cluecab-game-v1')!).state.roundGuidance.packing).toBe('announced')
    useGame.setState({ activeRoundGuidance: null })
    await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
    useGame.setState({ mode: 'wrapup', packingDone: false })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.setState({ activeRoundGuidance: 'packing' })
    dismiss()
    expect(useGame.getState().roundGuidance?.packing).toBe('dismissed')
    // Packing owns the screen: no other panel may open over it, however the
    // round's own phase reads underneath.
    const game = useGame.getState().game!
    useGame.setState({
      game: { ...game, phase: 'suddenDeath', turnsLeft: 0 },
      roundGuidance: { ...guidance, packing: 'dismissed', lastChance: 'pending' },
    })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    // The round proper begins and the panels that belong to it can speak.
    useGame.setState({ packingDone: true })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('last-chance')
    dismiss()
    // A finished packing phase can never reopen the lesson.
    useGame.setState({ roundGuidance: { ...guidance, packing: 'pending' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).not.toBe('packing')
  })

  it('carries announcement state with parked rounds and clears the transient modal', () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    announce()
    const parked = roundOf(useGame.getState())!
    expect(parked.roundGuidance?.playerClueTurn).toBe(0)
    useGame.getState().abandonGame()
    useGame.setState({ parked })
    useGame.getState().resumeParked()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().roundGuidance).toEqual(parked.roundGuidance)
    useGame.getState().rerollBoard()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
  })

  it('migrates current and parked old saves quietly without rewinding the current bank or losing keys', () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    const { roundGuidance: _old, reviewRoundId: _reviewId, ...round } = roundOf(useGame.getState())!
    const old = { ...round, parked: round, city1BoardCursor: 17, recentBoards: [['da:hus']] }
    const migrated = migrateGame(old, 9) as typeof old & { roundGuidance: RoundGuidance | null }
    expect(migrated).toMatchObject({ ...old, roundGuidance: { opening: 'dismissed', playerClueTurn: 0 } })
    expect(migrated.parked).toMatchObject({ roundGuidance: { opening: 'dismissed', playerClueTurn: 0 } })
    useGame.setState(migrated)
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.getState().resumeParked()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().game).toEqual(round.game)
  })

  it.each(['active', 'parked'] as const)('announces the first new player clue turn after migrating a legacy %s guessing save', async (slot) => {
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    const response = clueReply()
    vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(response)
    await useGame.getState().runAiClue()
    // Preserve real progress as well as the board and both keys through v9 migration.
    useGame.getState().playerGuess(response.targetWordIds[0]!)
    const { roundGuidance: _old, reviewRoundId: _reviewId, ...round } = roundOf(useGame.getState())!
    expect(round.game.phase).toBe('playerGuessing')
    const legacy = { ...round, parked: round, city1BoardCursor: 17, recentBoards: [['da:hus']] }
    const migrated = migrateGame(legacy, 9) as typeof legacy & { roundGuidance: RoundGuidance | null }
    expect(migrated).toMatchObject(legacy)
    useGame.setState(migrated)
    if (slot === 'parked') useGame.getState().resumeParked()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().game).toEqual(round.game)
    const neutral = round.game.words.find((w) => round.game.aiKey[w.wordId] === 'bystander' && round.game.reveals[w.wordId]!.kind === 'hidden')!
    useGame.getState().playerGuess(neutral.wordId)
    expect(useGame.getState().game!.phase).toBe('playerClueInput')
    expect(useGame.getState().game!.clueHistory).toHaveLength(round.game.clueHistory.length)
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(migrated.roundGuidance?.playerClueTurn).toBeNull()
    expect(migrated.parked).toMatchObject({ roundGuidance: { playerClueTurn: null } })
    expect(useGame.getState().city1BoardCursor).toBe(17)
    expect(useGame.getState().recentBoards).toEqual(legacy.recentBoards)
    await nextPlayerClueTurn()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })
})

describe('opening clue timing', () => {
  // Every test here deals a SEEDED round: an explicit seed keeps the
  // authored cycle out of the deal (opts.seed is set), so `authoredBoardId`
  // is null and Casey's opening goes over the network as it does on every
  // non-authored board. Authored boards do not run this path at all any more
  // — their opening is baked and synchronous (gameStore's baked OPENING) —
  // and the gameStore suite owns those tests.
  it('applies an available clue without any artificial timer or extra request', async () => {
    useGame.getState().newGame({ cityIndex: 0, seed: 101 })
    const reply = vi.spyOn(OllamaCompanion.prototype, 'getClue').mockResolvedValue(clueReply())
    vi.useFakeTimers()
    await useGame.getState().runAiClue()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('casey')
    expect(useGame.getState().aiBusy).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it('waits honestly for the provider and does not announce later Casey clues', async () => {
    useGame.getState().newGame({ cityIndex: 0, seed: 102 })
    const response = clueReply()
    let resolve!: (value: typeof response) => void
    vi.spyOn(OllamaCompanion.prototype, 'getClue').mockImplementation(() => new Promise((done) => { resolve = done }))
    const run = useGame.getState().runAiClue()
    announce()
    expect(useGame.getState().aiBusy).toBe(true)
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    resolve(response)
    await run
    announce()
    dismiss()
    useGame.getState().playerGuess(response.targetWordIds[0]!)
    useGame.getState().playerStop()
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('player')
    dismiss()
    useGame.getState().submitPlayerClue('connection', 2)
    const game = useGame.getState().game!
    useGame.setState({ game: { ...game, phase: 'aiClueInput' } })
    const later = useGame.getState().runAiClue()
    resolve(response)
    await later
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })
})


// Seeded deals again: the parking/rejection machinery below is about the
// network path, which authored boards no longer take for the OPENING.
it('drops a clue reply from before parking even when that same round is resumed', async () => {
  useGame.getState().newGame({ cityIndex: 0, seed: 103 })
  const response = clueReply()
  const replies: ((value: typeof response) => void)[] = []
  vi.spyOn(OllamaCompanion.prototype, 'getClue').mockImplementation(() => new Promise((resolve) => replies.push(resolve)))
  const oldRequest = useGame.getState().runAiClue()
  const parked = roundOf(useGame.getState())!
  useGame.getState().abandonGame()
  useGame.setState({ parked })
  useGame.getState().resumeParked()
  const currentRequest = useGame.getState().runAiClue()
  replies[0]!(response)
  await oldRequest
  expect(useGame.getState().game!.phase).toBe('aiClueInput')
  expect(useGame.getState().aiBusy).toBe(true)
  replies[1]!(response)
  await currentRequest
  announce()
  expect(useGame.getState().activeRoundGuidance).toBe('casey')
})

it('ignores an obsolete clue rejection without clearing the resumed request busy state or showing its error', async () => {
  useGame.getState().newGame({ cityIndex: 0, seed: 104 })
  const response = clueReply()
  let rejectOld!: (reason: Error) => void
  let resolveCurrent!: (value: typeof response) => void
  vi.spyOn(OllamaCompanion.prototype, 'getClue')
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveCurrent = resolve }))
  const oldRequest = useGame.getState().runAiClue()
  const parked = roundOf(useGame.getState())!
  useGame.getState().abandonGame()
  useGame.setState({ parked })
  useGame.getState().resumeParked()
  const currentRequest = useGame.getState().runAiClue()
  const currentRequestId = useGame.getState().aiClueRequestId
  expect(useGame.getState().game).toBe(parked.game)
  rejectOld(new Error('Obsolete provider failure'))
  await oldRequest
  expect(useGame.getState().aiBusy).toBe(true)
  expect(useGame.getState().aiClueRequestId).toBe(currentRequestId)
  expect(useGame.getState().error).toBeNull()
  expect(useGame.getState().game!.phase).toBe('aiClueInput')
  resolveCurrent(response)
  await currentRequest
  expect(useGame.getState().aiBusy).toBe(false)
  expect(useGame.getState().error).toBeNull()
  announce()
  expect(useGame.getState().activeRoundGuidance).toBe('casey')
})


it.each(['authored', 'model+bank'])('keeps a ready %s transport reply immediate', async (arm) => {
  useGame.getState().newGame({ cityIndex: 0, seed: 105 })
  const decision = clueReply()
  const fetch = vi.fn(async () => new Response(JSON.stringify({ protocol: 1, decision, report: { arm, refused: false } }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetch)
  vi.useFakeTimers()
  await useGame.getState().runAiClue()
  announce()
  expect(useGame.getState().activeRoundGuidance).toBe('casey')
  expect(useGame.getState().pendingClueArm?.arm).toBe(arm)
  expect(vi.getTimerCount()).toBe(0)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('preserves an unannounced new opening across reload, and a failed clue stays retryable', async () => {
  useGame.getState().newGame({ cityIndex: 0, seed: 106 })
  await useGame.persist.rehydrate()
    await useGame.getState().recoverSession()
  expect(useGame.getState().roundGuidance?.opening).toBe('pending')
  const reply = vi.spyOn(OllamaCompanion.prototype, 'getClue').mockRejectedValueOnce(new Error('Unavailable'))
  await useGame.getState().runAiClue()
  announce()
  expect(useGame.getState().activeRoundGuidance).toBeNull()
  expect(useGame.getState().error).toBeTruthy()
  useGame.getState().clearError()
  reply.mockResolvedValueOnce(clueReply())
  await useGame.getState().runAiClue()
  announce()
  expect(useGame.getState().activeRoundGuidance).toBe('casey')
})

describe('the onboarding translation lesson retiring the ordinary panel', () => {
  it('marks translation guidance dismissed without touching the game, and persists it', () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    const game = useGame.getState().game!
    useGame.setState({ game: { ...game, phase: 'translateChallenge' } })
    const before = useGame.getState().game
    useGame.getState().retireTranslationGuidance()
    expect(useGame.getState().roundGuidance?.translation).toBe('dismissed')
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    expect(useGame.getState().game).toBe(before)
    expect(JSON.parse(saved.get('cluecab-game-v1')!).state.roundGuidance.translation).toBe('dismissed')
    announce()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
  })

  it('closes a panel that was already up and is a no-op with no round', () => {
    useUi.setState({ pendingFirstGiver: 'player' })
    useGame.getState().newGame({ cityIndex: 0, seed: 710 })
    useGame.setState({ game: { ...useGame.getState().game!, phase: 'translateChallenge' } })
    announce()
    expect(useGame.getState().activeRoundGuidance).toBe('translation')
    useGame.getState().retireTranslationGuidance()
    expect(useGame.getState().activeRoundGuidance).toBeNull()
    useGame.setState({ roundGuidance: null })
    expect(() => useGame.getState().retireTranslationGuidance()).not.toThrow()
    expect(useGame.getState().roundGuidance).toBeNull()
  })
})
