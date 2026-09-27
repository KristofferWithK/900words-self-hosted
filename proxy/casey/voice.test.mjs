import { describe, expect, it, vi } from 'vitest'
import words from '../../src/data/words.da.json'
import bank from '../data/authored-clues.da.1.json'
import { PLAYER_VOICE_RULE as CLIENT_RULE } from '../../src/ai/prompts.ts'
import { decide, parseDecisionRequest } from './orchestrator.js'
import { buildCluePrompt, buildGuessPrompt } from './prompts.js'
import { DANISH_LANGUAGE } from './language.js'
import { PLAYER_VOICE_RULE, playerVoiceProblem, privateAdviceMentioned, withoutDashes } from './voice.js'

/**
 * Casey speaks as a player (owner, 2026-09-06: "Casey should talk as if he
 * was a player"). The rule is in both prompts; the guard rejects a rationale
 * or reasoning that leaks the private advice and asks for it again.
 */
const byId = new Map(words.map((word) => [word.id, word]))
const board1 = bank.boards[0]
const clueView = () => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 8,
  boardId: board1.id,
  history: [],
  flagged: [],
  words: board1.wordIds.map((id) => {
    const entry = byId.get(id)
    return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal: { kind: 'hidden' }, roleOnMyKey: board1.aiGreenIds.includes(id) ? 'green' : 'bystander' }
  }),
})
const guessView = (clue) => {
  const view = clueView()
  return { ...view, kind: 'ai-guess', words: view.words.map(({ roleOnMyKey, ...word }) => word), currentClue: { text: clue, number: 2 } }
}

describe('the guard', () => {
  it('catches the private vocabulary and decimals, and lets a player’s sentence through', () => {
    expect(privateAdviceMentioned('The index links uge and klokke strongly.')).toBe('index')
    expect(privateAdviceMentioned('uge scores 66.7 on the ruler')).toBe('66.7')
    expect(privateAdviceMentioned('a margin of four rungs over komme')).toMatch(/^(margin|rungs)$/)
    expect(privateAdviceMentioned('this clue was built for the board')).toBe('built for')
    expect(privateAdviceMentioned('LCSI says so')).toBe('LCSI')
    expect(privateAdviceMentioned('the authored group covers three')).toBe('authored')
    expect(privateAdviceMentioned('the target floor is 60')).toMatch(/target floor|60/)
    for (const clean of [
      'A week and an hour are both stretches of time; komme is about arriving, not about time, so it should not pull you.',
      'Dogs and cats are both household pets; hest is an animal too but not one you keep indoors.',
      'Two of the three fit: klasse and prøve are school things, time less so.',
      '«tid» points me straight at uge; nothing else on this board pulls that way.',
      'The strong link is to bread; the weak one to butter.',
    ]) {
      expect(privateAdviceMentioned(clean), clean).toBeNull()
    }
    expect(privateAdviceMentioned(undefined)).toBeNull()
    expect(playerVoiceProblem('rationale', 'index')).toContain('mentions "index"')
  })

  it('is one rule, in both prompts, byte-identical to the client’s copy', () => {
    expect(PLAYER_VOICE_RULE).toBe(CLIENT_RULE)
    expect(buildCluePrompt(clueView(), DANISH_LANGUAGE)[0].content).toContain(PLAYER_VOICE_RULE)
    expect(buildGuessPrompt(guessView('tid'), DANISH_LANGUAGE)[0].content).toContain(PLAYER_VOICE_RULE)
  })
})

describe('the orchestrator applies it', () => {
  it('sends a leaking clue rationale back for correction and keeps the clean one', async () => {
    const [a, b, c] = board1.aiGreenIds
    const replies = [
      JSON.stringify({ clue: 'forrige', number: 3, targetWordIds: [a, b, c], rationale: 'The index gives uge 73.3 and the margin is wide.' }),
      JSON.stringify({ clue: 'forrige', number: 3, targetWordIds: [a, b, c], rationale: 'Last week, last month and the last one all share the sense of what came before.' }),
    ]
    const askModel = vi.fn(async () => replies.shift())
    // Mid-round: an authored OPENING is served from the bank before any model
    // call (owner, 2026-09-17), so the voice guard is exercised on clue two.
    const midRound = { ...clueView(), history: [{ by: 'player', text: 'huskeliste', number: 2, guesses: [] }] }
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'clue', view: midRound }), askModel, 'cluey')
    expect(askModel).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(askModel.mock.calls[1][0])).toContain('mentions \\"index\\"')
    expect(result.decision.rationale).not.toMatch(/index|73\.3|margin/)
    expect(result.report.refused).toBe(true)
  })

  /**
   * The guard reads what Casey WROTE, and since Phase 4 that is the player's
   * language. An English-only word list would have let every German, Spanish
   * and Chinese rationale say "Rang 3" straight to the player.
   */
  it.each([
    ['de', 'Der Rang dieser Gruppe ist hoch.', /Rang/],
    ['de', 'Aus dem Korpus: hund zieht stärker.', /Korpus/],
    ['es', 'El índice le da un margen amplio.', /índice/],
    ['zh', '索引显示这两个词关联最强。', /索引/],
  ])('catches the private vocabulary in %s too', (_code, leaking, pattern) => {
    expect(privateAdviceMentioned(leaking)).toMatch(pattern)
  })

  it.each([
    ['de', 'Hund und Katze sind beides Haustiere; hest passt nicht dazu.'],
    ['es', 'El perro y el gato son animales de compañía; hest no encaja.'],
    ['zh', '狗和猫都是宠物；hest 不属于这一类。'],
  ])('lets an ordinary %s sentence through', (_code, clean) => {
    expect(privateAdviceMentioned(clean)).toBeNull()
  })

  it('sends a leaking guess reasoning back for correction too', async () => {
    const target = board1.wordIds.find((id) => !board1.aiGreenIds.includes(id))
    const replies = [
      JSON.stringify({ guesses: [{ wordId: target, confidence: 0.9, reasoning: 'Ranked first by strength 66.7.' }] }),
      JSON.stringify({ guesses: [{ wordId: target, confidence: 0.9, reasoning: 'It is the word your clue most naturally names; the others are about other things.' }] }),
    ]
    const askModel = vi.fn(async () => replies.shift())
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'guess', view: guessView('zzzz-not-a-clue') }), askModel, 'cluey')
    expect(askModel).toHaveBeenCalledTimes(2)
    expect(result.decision.guesses[0].reasoning).not.toMatch(/rank|strength|66\.7/i)
  })

  // Owner, 2026-09-26: no em dashes anywhere in the app. The model writes the
  // way its prompt is written, so the dash is taken out, not asked about.
  it('takes the dashes out of what the player reads, and leaves a range alone', () => {
    expect(withoutDashes('hund — it barks')).toBe('hund, it barks')
    expect(withoutDashes('Hund und Katze – beide Haustiere')).toBe('Hund und Katze, beide Haustiere')
    expect(withoutDashes('«hav»——大海')).toBe('«hav»，大海')
    expect(withoutDashes('a word —.')).toBe('a word.')
    expect(withoutDashes('open 13–15')).toBe('open 13–15')
  })

  it('gives the player a guess reasoning with no em dash in it', async () => {
    const target = board1.wordIds.find((id) => !board1.aiGreenIds.includes(id))
    const askModel = vi.fn(async () =>
      JSON.stringify({ guesses: [{ wordId: target, confidence: 0.9, reasoning: 'It fits — your clue names it first.' }] }),
    )
    const result = await decide(parseDecisionRequest({ protocol: 1, operation: 'guess', view: guessView('zzzz-not-a-clue') }), askModel, 'cluey')
    expect(result.decision.guesses[0].reasoning).toBe('It fits, your clue names it first.')
  })
})
