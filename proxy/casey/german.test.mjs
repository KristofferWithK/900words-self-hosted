import { describe, expect, it, vi } from 'vitest'
import words from '../../src/data/words.de.json'
import cycle from '../../src/data/city1-board-cycle.de.json'
import bank from '../data/authored-clues.de.1.json'
import { german } from '../../src/lang/de/index.ts'
import { GERMAN_LANGUAGE } from './language.de.js'
import { authoredBoardFor, authoredClueCandidates, authoredFirstClue } from './authored-clues.js'
import { authoredPlayerGuesses } from './authored-player-clues.js'
import { evaluatorForBoard } from './evaluator.js'
import { clueAssociationCandidates, guessAssociationLookup } from './association-index.js'
import { decide, parseDecisionRequest } from './orchestrator.js'
import { PLAYER_LANGUAGES } from './player-language.js'
import { buildCluePrompt, buildGuessPrompt, buildTranslatePrompt } from './prompts.js'
import { buildTranslatePrompt as clientTranslatePrompt } from '../../src/ai/prompts.ts'

const byId = new Map(words.map(word => [word.id, word]))
const viewFor = board => ({
  kind: 'ai-clue', clueLanguage: 'target', turnsLeft: 8, boardId: board.id,
  words: board.wordIds.map(id => {
    const w = byId.get(id)
    return { id, da: w.da, en: w.en, pos: w.pos, reveal: { kind: 'hidden' },
      roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander' }
  }), history: [], flagged: [],
})
const guessFor = view => ({ ...view, kind: 'ai-guess',
  words: view.words.map(({ roleOnMyKey, ...word }) => word), currentClue: { text: 'Familie', number: 2 } })

describe('German City 1 through the server-owned decision boundary', () => {
  it('keeps German target examples and the selected player-language gloss in all eleven UI languages', () => {
    const view = viewFor(cycle.boards[0])
    for (const player of Object.values(PLAYER_LANGUAGES)) {
      const translation = buildTranslatePrompt('Fahrrad', GERMAN_LANGUAGE, player)
      expect(translation).toEqual(clientTranslatePrompt('Fahrrad', german, player))
      const text = translation.map(message => message.content).join('\n')
      expect(text).toContain(`between German and ${player.name}`)
      expect(text).not.toMatch(/"da":\s*"(?:cykel|eftermiddag|trafik|cykle|dreng)"|"gender":\s*"common"|"article":\s*"en"/)
      const originalGloss = JSON.parse(player.translateExamples.match(/\{[^\n]+\}/)[0]).en
      expect(text).toContain(JSON.stringify({ da: player.code === 'sv' ? 'Junge' : 'Fahrrad',
        article: 'ein', gender: player.code === 'sv' ? 'masculine' : 'neuter', countable: true, en: originalGloss }))
      for (const prompt of [buildCluePrompt(view, GERMAN_LANGUAGE, '', player),
        buildGuessPrompt(guessFor(view), GERMAN_LANGUAGE, '', 'top-two', player)]) {
        expect(prompt[0].content).not.toMatch(/\bhest\b|æble|pære|\bfrugt\b/)
        expect(prompt[0].content).toContain(player.name.toUpperCase())
      }
    }
  })

  it('routes French player explanations and German dictionary grammar independently', async () => {
    const ask = vi.fn(async messages => {
      expect(messages[0].content).toContain('between German and French')
      return JSON.stringify({ da: 'Lampe', en: 'lampe', article: 'eine', gender: 'feminine', countable: true })
    })
    const response = await decide(parseDecisionRequest({ protocol: 1, operation: 'translate',
      language: 'de', playerLanguage: 'fr', term: 'lampe' }), ask)
    expect(response.decision).toMatchObject({ da: 'Lampe', en: 'lampe', article: 'eine' })
    expect(ask).toHaveBeenCalledOnce()
  })
  it('resolves all 150 German boards, with legal own-key groups and no Danish index advice', () => {
    for (const board of cycle.boards) {
      const view = viewFor(board)
      expect(authoredBoardFor(view), board.id).not.toBeNull()
      const groups = authoredClueCandidates(view)
      expect(groups.length, board.id).toBeGreaterThan(0)
      for (const group of groups) {
        expect(group.targetWordIds.every(id => board.aiGreenIds.includes(id))).toBe(true)
        expect(GERMAN_LANGUAGE.checkClueLegality(group.clue, view.words).legal, `${board.id}: ${group.clue}`).toBe(true)
      }
      expect(evaluatorForBoard(view)).toBeNull()
      expect(clueAssociationCandidates(view)).toEqual([])
      expect(guessAssociationLookup(guessFor(view))).toBeNull()
      expect(authoredPlayerGuesses(guessFor(view))).toBeNull()
    }
  })

  it('filters any imported clue the Worker German rules reject', () => {
    for (const board of cycle.boards) {
      const view = viewFor(board)
      const offered = new Set(authoredClueCandidates(view).map(group => group.clue))
      for (const group of bank.boards.find(row => row.id === board.id).caseyClueGroups) {
        if (!GERMAN_LANGUAGE.checkClueLegality(group.clue, view.words).legal) {
          expect(offered.has(group.clue), `${board.id}: ${group.clue}`).toBe(false)
        }
      }
    }
  })

  it('asks the model in German with the German bank, and returns its legal clue', async () => {
    const view = viewFor(cycle.boards[0])
    const group = authoredClueCandidates(view)[0]
    // Preserve this checkout's instant authored opening: give the model a
    // mid-round clue decision while keeping the board's German bank context.
    view.history = [{ by: 'player', text: 'already-used-clue', number: 1, guesses: [] }]
    const ask = vi.fn(async messages => {
      const prompt = messages.map(m => m.content).join('\n')
      expect(prompt).toContain('German')
      expect(prompt).toContain(group.clue)
      expect(prompt).not.toContain('Write Danish')
      return JSON.stringify({ clue: group.clue, number: group.targetWordIds.length,
        targetWordIds: group.targetWordIds, rationale: 'These words share this idea.' })
    })
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'clue', language: 'de', view }), ask, 'test')
    expect(result.decision.clue).toBe(group.clue)
    expect(ask).toHaveBeenCalledOnce()
  })

  it('keeps the authored German opening immediate and model-free', async () => {
    const view = viewFor(cycle.boards[0])
    const opening = authoredFirstClue(view)
    expect(opening).not.toBeNull()
    const ask = vi.fn()

    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'clue', language: 'de', view }), ask)

    expect(result.decision).toMatchObject({
      clue: opening.clue,
      number: opening.targetWordIds.length,
      targetWordIds: opening.targetWordIds,
    })
    expect(result.report.arm).toBe('authored')
    expect(ask).not.toHaveBeenCalled()
  })

  it('guesses in German without receiving the player key', async () => {
    const view = guessFor(viewFor(cycle.boards[0]))
    const ask = vi.fn(async messages => {
      const prompt = messages.map(m => m.content).join('\n')
      expect(prompt).toContain('German')
      expect(prompt).not.toContain('my key:')
      return JSON.stringify({ guesses: view.words.slice(0, 2).map(w => ({ wordId: w.id, confidence: 0.8, reasoning: 'A possible link.' })) })
    })
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'guess', language: 'de', candidateMode: 'top-two', view }), ask, 'test')
    expect(result.decision.guesses).toHaveLength(2)
    expect(ask).toHaveBeenCalledOnce()
  })

  it('accepts German gender/articles and rejects crossed or unsupported request languages', async () => {
    const ask = vi.fn(async () => JSON.stringify({ da: 'Lampe', en: 'lamp', article: 'eine', gender: 'feminine', countable: true }))
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'translate', language: 'de', term: 'lamp' }), ask, 'test')
    expect(result.decision.article).toBe('eine')
    expect(ask).toHaveBeenCalledOnce()
    const view = viewFor(cycle.boards[0])
    for (const language of ['da', 'fr', null]) {
      expect(() => parseDecisionRequest({ protocol: 1, operation: 'clue', language, view })).toThrow()
    }
    expect(() => parseDecisionRequest({ protocol: 1, operation: 'guess', language: 'de', view: { ...guessFor(view), playerGreenIds: cycle.boards[0].playerGreenIds } })).toThrow()
  })
})
