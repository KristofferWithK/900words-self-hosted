import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError } from '../client'
import type { AiClueView, AiGuessView } from '../projections'
import { CITY1_BOARD_CYCLE } from '../../data/city1BoardCycle'
import playtestBank from '../../data/city1-playtest-clues.da.json'
import { wordById } from '../../data/words'

const { generate, status, worker, cancel, unload } = vi.hoisted(() => ({
  generate: vi.fn(), status: vi.fn(), worker: vi.fn(), cancel: vi.fn(), unload: vi.fn(),
}))
vi.mock('./native', async (importOriginal) => ({
  // wasPutAway is the real one: it is the JavaScript half of the PUT_AWAY code.
  ...(await importOriginal<typeof import('./native')>()),
  generateWithGemma: generate,
  gemmaStatus: status,
  cancelGemmaGeneration: cancel,
  unloadGemma: unload,
}))
vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  requestDecision: worker,
}))

import { CONTEXT_TOKENS, fitsContext, requestGemmaDecision, testGemmaConnection } from './decision'
import { setOfflineCaseyWanted } from './residency'
import { wasPutAway } from './native'
import pluginSource from '../../../ios-plugins/cluecab-gemma/ios/Sources/GemmaPlugin/GemmaPlugin.swift?raw'
import androidModel from '../../../ios-plugins/cluecab-gemma/android/src/main/java/com/kristofferwithk/cluecabgemma/GemmaModel.kt?raw'
import androidRuntime from '../../../ios-plugins/cluecab-gemma/android/src/main/java/com/kristofferwithk/cluecabgemma/GemmaRuntime.kt?raw'
import androidPlugin from '../../../ios-plugins/cluecab-gemma/android/src/main/java/com/kristofferwithk/cluecabgemma/GemmaPlugin.kt?raw'

/**
 * On-device Casey runs the Worker's orchestrator with Gemma as its model.
 * These pin the two things that move with that: the orchestrator's own rules
 * now apply on the phone (an authored opening, a fallback that keeps Casey
 * playing), and Gemma is still what answers everything else.
 */

const settings = { baseUrl: '' }
const reply = (text: string) => ({ text, loadMs: 1, firstTokenMs: 2, generationMs: 3 })

// Three words from outside every authored city shard: no bank, no evaluator,
// so the model's reply stands or falls on the validator alone.
const smallClueView: AiClueView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [
    { id: 'da:kop', da: 'kop', en: ['cup'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'green' },
    { id: 'da:glas', da: 'glas', en: ['glass'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'green' },
    { id: 'da:sofa', da: 'sofa', en: ['sofa', 'couch'], pos: 'noun', reveal: { kind: 'hidden' }, roleOnMyKey: 'bystander' },
  ],
  history: [],
  flagged: [],
}

const smallGuessView: AiGuessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: smallClueView.words.map(({ roleOnMyKey: _role, ...word }) => word),
  currentClue: { text: 'opvask', number: 2 },
  history: [],
  flagged: [],
}

const board = CITY1_BOARD_CYCLE[0]!
const boardWords = board.wordIds.map((id) => {
  const entry = wordById(id)
  if (!entry) throw new Error(`authored board ${board.id} names an unknown word: ${id}`)
  return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal: { kind: 'hidden' } as const }
})

/** A fresh authored City 1 board, as the game sends it on Casey's first turn. */
const openingView: AiClueView = {
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: boardWords.map((word) => ({
    ...word,
    roleOnMyKey: board.aiGreenIds.includes(word.id) ? 'green' : 'bystander',
  })),
  history: [],
  flagged: [],
  boardId: board.id,
}

/**
 * A City 1 board under a clue the association index knows (the bank's first
 * group, borrowed as a player clue). No `boardId`, so the certain-answer
 * shortcut cannot answer first: the model is asked, and only its failure
 * sends Casey to the index.
 */
const indexedBoard = playtestBank.boards[0]!
const indexedGroup = indexedBoard.caseyClueGroups[0]!
const indexedGuessView: AiGuessView = {
  kind: 'ai-guess',
  clueLanguage: 'target',
  turnsLeft: 8,
  words: indexedBoard.wordIds.map((id) => {
    const entry = wordById(id)
    if (!entry) throw new Error(`bank board ${indexedBoard.id} names an unknown word: ${id}`)
    return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal: { kind: 'hidden' } as const }
  }),
  currentClue: { text: indexedGroup.clue, number: indexedGroup.targetWordIds.length },
  history: [],
  flagged: [],
}

const notInstalled = async () => {
  throw new Error('model not installed')
}

describe('on-device Casey runs the Worker orchestrator with Gemma as its model', () => {
  // A block body: an arrow returning mockReset()'s result would hand vitest
  // the mock itself as a teardown, and it would be called once after the test.
  beforeEach(() => {
    generate.mockReset()
    worker.mockReset()
    status.mockReset()
    status.mockResolvedValue({ installed: true })
    cancel.mockReset()
    cancel.mockResolvedValue(undefined)
    unload.mockReset()
    unload.mockResolvedValue(undefined)
    // A round she plays is open, as GameScreen reports it in play.
    setOfflineCaseyWanted(true)
    unload.mockClear()
  })

  it('opens an authored City 1 board with the bank clue and never wakes the model', async () => {
    const result = await requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: openingView })
    expect(result.report).toEqual({ arm: 'authored', refused: false })
    expect(result.decision).toMatchObject({ clue: expect.any(String), targetWordIds: expect.any(Array) })
    expect(generate).not.toHaveBeenCalled()
  })

  it('asks Gemma for an ordinary clue and returns the Worker-shaped envelope', async () => {
    generate.mockResolvedValue(
      reply(JSON.stringify({ clue: 'opvask', number: 2, targetWordIds: ['da:kop', 'da:glas'], rationale: 'Both go in the sink.' })),
    )
    const result = await requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: smallClueView })
    expect(result).toMatchObject({ protocol: 1, report: { refused: false }, decision: { clue: 'opvask', number: 2 } })
    expect(result.report.arm.startsWith('gemma4-e4b-mobile')).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]![0].system).toContain('You are Casey')
  })

  it('writes which processor answered into the device-gate log (Android reports it)', async () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    })
    try {
      generate.mockResolvedValue({
        ...reply(JSON.stringify({ clue: 'opvask', number: 2, targetWordIds: ['da:kop', 'da:glas'], rationale: 'Both go in the sink.' })),
        backend: 'cpu',
      })
      await requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: smallClueView })
      const ring = JSON.parse(stored.get('cluecab-gemma-device-gate-v1') ?? '[]') as { kind: string; backend?: string }[]
      expect(ring.find((entry) => entry.kind === 'generation')).toMatchObject({ backend: 'cpu', loadMs: 1 })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('corrects a malformed reply in order, with the rejected reply labelled as hers', async () => {
    generate
      .mockResolvedValueOnce(reply('not json'))
      .mockResolvedValueOnce(reply('{"guesses":[{"wordId":"da:kop","confidence":0.8,"reasoning":"You wash a cup, not a sofa."}]}'))
    const result = await requestGemmaDecision(settings, { protocol: 1, operation: 'guess', view: smallGuessView })
    expect(result.report.refused).toBe(true)
    const second = generate.mock.calls[1]![0].prompt as string
    expect(second).toContain('That response was invalid')
  })

  it('keeps Casey playing from the index when the on-device model does not answer', async () => {
    generate.mockImplementation(notInstalled)
    const result = await requestGemmaDecision(settings, { protocol: 1, operation: 'guess', view: indexedGuessView })
    expect(generate).toHaveBeenCalled()
    expect(result.report.arm).toBe('gemma4-e4b-mobile+fallback-index')
    const guesses = (result.decision as { guesses: { wordId: string }[] }).guesses
    expect(guesses.length).toBeGreaterThan(0)
    for (const guess of guesses) expect(indexedBoard.wordIds).toContain(guess.wordId)
  })

  it('never puts Casey key roles in a guess prompt', async () => {
    generate.mockResolvedValue(reply('{"guesses":[{"wordId":"da:kop","confidence":0.8,"reasoning":"You wash a cup, not a sofa."}]}'))
    await requestGemmaDecision(settings, { protocol: 1, operation: 'guess', view: smallGuessView })
    expect(JSON.stringify(generate.mock.calls[0]![0])).not.toContain('roleOnMyKey')
  })

  it('refuses on the phone what the Worker would refuse, without asking the model', async () => {
    const duplicated = { ...smallClueView, words: [...smallClueView.words, smallClueView.words[0]!] }
    const refusal = requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: duplicated })
    await expect(refusal).rejects.toBeInstanceOf(AiError)
    await expect(refusal).rejects.toMatchObject({ kind: 'invalid-response' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('keeps its context budget equal to the native engine’s, on both phones', () => {
    expect(pluginSource).toContain(`maxNumTokens: ${CONTEXT_TOKENS},`)
    expect(androidModel).toContain(`const val CONTEXT_TOKENS = ${CONTEXT_TOKENS}`)
    expect(androidRuntime).toContain('maxNumTokens = GemmaModel.CONTEXT_TOKENS,')
  })

  it('never sends a prompt that cannot fit, reply included', () => {
    const room = 3 * (CONTEXT_TOKENS - 400)
    expect(fitsContext('', 'x'.repeat(room), 400)).toBe(true)
    expect(fitsContext('', 'x'.repeat(room + 1), 400)).toBe(false)
  })

  it('sends Gemma a real City 1 clue prompt, the one that overflowed 4,096 tokens', async () => {
    generate.mockResolvedValue(reply('not json'))
    const second = { ...openingView, history: [{ by: 'ai' as const, text: 'forrige', number: 3, guesses: [] }] }
    await requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: second }).catch(() => {})
    expect(generate).toHaveBeenCalled()
    const first = generate.mock.calls[0]![0] as { system: string; prompt: string }
    // Measured at 13,199 characters on 2026-09-27; more than 3 × 4,096.
    expect(first.system.length + first.prompt.length).toBeGreaterThan(3 * 4_096)
  })

  it('stops a generation that never finishes, and Casey still plays', async () => {
    vi.useFakeTimers()
    try {
      generate.mockImplementation(() => new Promise(() => {}))
      const pending = requestGemmaDecision(settings, { protocol: 1, operation: 'guess', view: indexedGuessView })
      await vi.advanceTimersByTimeAsync(90_000)
      const result = await pending
      expect(cancel).toHaveBeenCalled()
      expect(result.report.arm).toBe('gemma4-e4b-mobile+fallback-index')
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets the Worker play until the model is on the phone, not a model-less fallback', async () => {
    status.mockResolvedValue({ installed: false })
    const envelope = { protocol: 1, decision: { clue: 'opvask' }, report: { arm: 'cluey+own', refused: false } }
    worker.mockResolvedValue(envelope)
    const request = { protocol: 1, operation: 'clue', view: smallClueView } as const
    await expect(requestGemmaDecision(settings, request)).resolves.toEqual(envelope)
    expect(worker).toHaveBeenCalledWith(settings, request)
    expect(generate).not.toHaveBeenCalled()
  })

  it('never lets the Worker answer the Gemma connection test', async () => {
    status.mockResolvedValue({ installed: false })
    worker.mockResolvedValue({ protocol: 1, decision: { ok: true }, report: { arm: 'cluey', refused: false } })
    generate.mockImplementation(notInstalled)
    await expect(testGemmaConnection()).rejects.toMatchObject({ kind: 'server' })
    expect(worker).not.toHaveBeenCalled()
  })

  describe('when the phone puts her away', () => {
    const putAway = () => Object.assign(new Error('Offline Casey was put away before she answered.'), { code: 'PUT_AWAY' })
    const clueReply = () =>
      reply(JSON.stringify({ clue: 'opvask', number: 2, targetWordIds: ['da:kop', 'da:glas'], rationale: 'Both go in the sink.' }))

    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })

    it('frees her natively when the app leaves the screen, with the code the retry waits on', () => {
      expect(pluginSource).toContain('UIApplication.didEnterBackgroundNotification')
      expect(pluginSource).toContain('CAPPluginMethod(name: "unloadModel"')
      expect(pluginSource).toContain('"PUT_AWAY"')
      // The Android half: leaving the screen (onStop) puts her away the same way.
      expect(androidPlugin).toContain('override fun handleOnStop()')
      expect(androidPlugin).toContain('fun unloadModel(call: PluginCall)')
      expect(androidPlugin).toContain('"PUT_AWAY"')
      expect(wasPutAway(putAway())).toBe(true)
      expect(wasPutAway(new Error('Gemma could not finish this Casey turn.'))).toBe(false)
    })

    it('asks Gemma again once the player is back, rather than playing a fallback move', async () => {
      generate.mockRejectedValueOnce(putAway()).mockResolvedValueOnce(clueReply())
      const pending = requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: smallClueView })
      await vi.advanceTimersByTimeAsync(1_000)
      const result = await pending
      expect(generate).toHaveBeenCalledTimes(2)
      expect(result.decision).toMatchObject({ clue: 'opvask', number: 2 })
      expect(result.report.arm.startsWith('gemma4-e4b-mobile')).toBe(true)
      expect(result.report.arm).not.toContain('fallback')
      // Her round is still open: she stays loaded between its moves.
      expect(unload).not.toHaveBeenCalled()
    })

    it('does not load her again for a round the player has left, and puts her away', async () => {
      generate.mockRejectedValue(putAway())
      // No bank or index knows these words, so with no model the turn fails.
      const pending = requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: smallClueView }).catch(
        (error: unknown) => error,
      )
      await vi.advanceTimersByTimeAsync(0)
      const asked = generate.mock.calls.length
      setOfflineCaseyWanted(false)
      unload.mockClear()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(await pending).toBeInstanceOf(AiError)
      // Every ask the orchestrator made was put away once and never repeated.
      expect(generate.mock.calls.length).toBe(asked)
      expect(unload).toHaveBeenCalled()
    })

    it('stops asking after the waits run out, and Casey still plays', async () => {
      generate.mockRejectedValue(putAway())
      const pending = requestGemmaDecision(settings, { protocol: 1, operation: 'guess', view: indexedGuessView })
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      const result = await pending
      expect(result.report.arm).toBe('gemma4-e4b-mobile+fallback-index')
    })

    it('reads a timeout that fired while the player was away as their absence, not Gemma', async () => {
      const page = Object.assign(new EventTarget(), { visibilityState: 'visible' as 'visible' | 'hidden' })
      vi.stubGlobal('document', page)
      vi.resetModules()
      const fresh = await import('./decision')
      ;(await import('./residency')).setOfflineCaseyWanted(true)
      generate.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(clueReply())
      const pending = fresh.requestGemmaDecision(settings, { protocol: 1, operation: 'clue', view: smallClueView })
      await vi.advanceTimersByTimeAsync(0)
      page.visibilityState = 'hidden'
      page.dispatchEvent(new Event('visibilitychange'))
      // Suspended past the generation timeout; the timer fires on the way back.
      await vi.advanceTimersByTimeAsync(60_000)
      page.visibilityState = 'visible'
      await vi.advanceTimersByTimeAsync(1_000)
      const result = await pending
      expect(generate).toHaveBeenCalledTimes(2)
      expect(result.report.arm).not.toContain('fallback')
      vi.resetModules()
    })
  })

  it('puts her away after a move nobody is waiting for, such as the Settings test', async () => {
    setOfflineCaseyWanted(false)
    unload.mockClear()
    generate.mockResolvedValue(reply('{"ok": true}'))
    await testGemmaConnection()
    expect(unload).toHaveBeenCalledTimes(1)
  })

  it('checks the model itself on the connection test: no fallback answers a ping', async () => {
    generate.mockResolvedValue(reply('{"ok": true}'))
    await expect(testGemmaConnection()).resolves.toBeUndefined()
    generate.mockReset()
    generate.mockImplementation(notInstalled)
    await expect(testGemmaConnection()).rejects.toMatchObject({ kind: 'server' })
  })
})
