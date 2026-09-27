import bank from '../data/authored-clues.da.1.json'
import words from '../../src/data/words.da.json'
import { describe, expect, it, vi } from 'vitest'
import { checkClueLegality as clientLegality } from '../../src/engine/legality.ts'
import {
  buildCluePrompt as clientCluePrompt,
  buildGuessPrompt as clientGuessPrompt,
  buildTranslatePrompt as clientTranslatePrompt,
} from '../../src/ai/prompts.ts'
import { danish } from '../../src/lang/da/index.ts'
import { loadEvaluator as loadResearchEvaluator } from '../../src/ai/local/evaluator.ts'
import { checkClueLegality, DANISH_LANGUAGE } from './language.js'
import { buildCluePrompt, buildGuessPrompt, buildTranslatePrompt } from './prompts.js'
import { engineTrapIds, evaluatorForBoard, loadEvaluator } from './evaluator.js'
import { CaseyServiceError, decide, parseDecisionRequest } from './orchestrator.js'
import { playerLanguageFor } from './player-language.js'

const byId = new Map(words.map((word) => [word.id, word]))
const word = (id, roleOnMyKey, reveal = { kind: 'hidden' }) => {
  const entry = byId.get(id)
  if (!entry) throw new Error(`missing fixture word ${id}`)
  return { id, da: entry.da, en: entry.en, pos: entry.pos, reveal, roleOnMyKey }
}

const clueView = (target, trap, trapReveal = { kind: 'hidden' }) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [word(target, 'green'), word(trap, 'bystander', trapReveal)],
  history: [],
  flagged: [],
})

const twoGreenView = (first, second, trap) => ({
  kind: 'ai-clue',
  clueLanguage: 'target',
  turnsLeft: 5,
  words: [word(first, 'green'), word(second, 'green'), word(trap, 'bystander')],
  history: [],
  flagged: [],
})

const requestFor = (view) =>
  parseDecisionRequest({ protocol: 1, operation: 'clue', view })

function correctionCase(city = 1) {
  const evaluator = loadEvaluator(city)
  for (const target of evaluator.ids) {
    for (const trap of evaluator.ids) {
      if (target === trap) continue
      const view = clueView(target, trap, { kind: 'bystander', against: ['player'] })
      const board = view.words.map(({ da, en, pos }) => ({ da, en, pos }))
      const candidates = evaluator
        .assocFor(target)
        .filter((entry) => checkClueLegality(entry.da, board).legal)
        .map((entry) => ({ entry, margin: evaluator.scoreClue(entry.da, [target], [trap]).margin }))
      const unsafe = candidates.find((candidate) => candidate.margin < 0.5)
      const safe = candidates.find((candidate) => candidate.margin >= 0.5)
      if (unsafe && safe) return { target, trap, view, unsafe, safe }
    }
  }
  throw new Error(`no city-${city} correction fixture found`)
}

const modelClue = (clue, targets) => {
  const targetWordIds = Array.isArray(targets) ? targets : [targets]
  return JSON.stringify({ clue, number: targetWordIds.length, targetWordIds, rationale: 'finished rationale' })
}

describe('Casey orchestration is server-owned and remains model-backed', () => {
  it('uses the authored evaluator to reject a risky model clue, then asks the model again', async () => {
    const fixture = correctionCase()
    expect(engineTrapIds(fixture.view)).toEqual([fixture.trap])
    const replies = [
      modelClue(fixture.unsafe.entry.da, fixture.target),
      modelClue(fixture.safe.entry.da, fixture.target),
    ]
    const askModel = vi.fn(async () => replies.shift())

    const result = await decide(requestFor(fixture.view), askModel, 'cluey')

    expect(result.decision.clue).toBe(fixture.safe.entry.da)
    expect(result.report).toEqual({ arm: 'cluey+own', refused: true })
    expect(askModel).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(askModel.mock.calls[1][0])).toContain('evaluator check')
    expect(JSON.stringify(askModel.mock.calls[1][0])).toContain(byId.get(fixture.trap).da)
    expect(JSON.stringify(askModel.mock.calls[1][0])).not.toContain(fixture.unsafe.entry.why)
  })

  it('calls the model on every city-9 visit; E6/replay state is not in the protocol', async () => {
    const fixture = correctionCase(9)
    const askModel = vi.fn(async () => modelClue(fixture.safe.entry.da, fixture.target))
    const request = requestFor(fixture.view)

    await decide(request, askModel, 'cluey')
    await decide(request, askModel, 'cluey')

    expect(askModel).toHaveBeenCalledTimes(2)
    expect(request).not.toHaveProperty('cityState')
    expect(request).not.toHaveProperty('replay')
    expect(evaluatorForBoard(fixture.view).city).toBe(9)
  })

  it('keeps unauthored cities on ordinary model-backed play instead of gating them', async () => {
    const city3 = words.filter((entry) => entry.curriculumRank >= 201 && entry.curriculumRank <= 300)
    const view = clueView(city3[0].id, city3[1].id)
    expect(evaluatorForBoard(view)).toBeNull()
    const askModel = vi.fn(async () => modelClue('mokclue', city3[0].id))

    const result = await decide(requestFor(view), askModel, 'cluey')

    expect(result.decision.clue).toBe('mokclue')
    expect(askModel).toHaveBeenCalledOnce()
  })

  it('does not apply a shard to a synthetic board mixed across cities', () => {
    const fixture = correctionCase()
    const city3 = words.find((entry) => entry.curriculumRank >= 201 && entry.curriculumRank <= 300)
    expect(city3).toBeDefined()
    const mixed = {
      ...fixture.view,
      words: [fixture.view.words[0], word(city3.id, 'bystander')],
    }
    expect(evaluatorForBoard(mixed)).toBeNull()
  })
})

describe('the server-owned clue coverage contract', () => {
  const city3 = words.filter((entry) => entry.curriculumRank >= 201 && entry.curriculumRank <= 300)
  const view = twoGreenView(city3[0].id, city3[1].id, city3[2].id)

  it('rejects a valid-looking one-target reply while two greens remain, then accepts a pair', async () => {
    // Mutation guard: removing the single-target check in clueDecision makes
    // the first reply pass and this assertion fail. Prompt prose alone cannot
    // satisfy this test.
    const askModel = vi
      .fn()
      .mockResolvedValueOnce(modelClue('mokclue', city3[0].id))
      .mockResolvedValueOnce(modelClue('mokclue', [city3[0].id, city3[1].id]))

    const result = await decide(requestFor(view), askModel, 'cluey')

    expect(result.decision).toMatchObject({ number: 2, targetWordIds: [city3[0].id, city3[1].id] })
    expect(result.report).toEqual({ arm: 'cluey+own', refused: true })
    expect(askModel).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(askModel.mock.calls[1][0])).toContain('one-target clue is only allowed')
  })

  it('uses the existing finite correction cap rather than retrying one-target replies forever', async () => {
    const askModel = vi.fn(async () => modelClue('mokclue', city3[0].id))

    await expect(decide(requestFor(view), askModel, 'cluey')).rejects.toMatchObject({
      code: 'invalid_model_reply',
    })

    // MAX_CORRECTIONS is 3, so Casey receives the first try plus three
    // corrections. This test pins the cap at the coverage-specific path.
    expect(askModel).toHaveBeenCalledTimes(4)
  })

  it('allows the narrow exception when exactly one targetable green remains', async () => {
    const oneLeft = clueView(city3[0].id, city3[1].id)
    const askModel = vi.fn(async () => modelClue('mokclue', city3[0].id))

    const result = await decide(requestFor(oneLeft), askModel, 'cluey')

    expect(result.decision).toMatchObject({ number: 1, targetWordIds: [city3[0].id] })
    expect(result.report).toEqual({ arm: 'cluey+own', refused: false })
    expect(askModel).toHaveBeenCalledOnce()
  })
})

describe('the Casey request firewall', () => {
  it('rejects prompts, model ids, and unknown key-shaped fields', () => {
    for (const extra of [
      { messages: [{ role: 'user', content: 'arbitrary prompt' }] },
      { model: 'expensive-model' },
      { playerKey: { secret: 'green' } },
    ]) {
      expect(() =>
        parseDecisionRequest({ protocol: 1, operation: 'ping', ...extra }),
      ).toThrow(/not part of the Casey protocol/)
    }
  })

  it('allows a translation term but no board alongside it', () => {
    expect(parseDecisionRequest({ protocol: 1, operation: 'translate', term: 'dog' })).toEqual({
      protocol: 1,
      operation: 'translate',
      playerLanguage: 'en',
      term: 'dog',
    })
    expect(() =>
      parseDecisionRequest({ protocol: 1, operation: 'translate', term: 'dog', view: {} }),
    ).toThrow(/view is not valid/)
  })

  it('keeps board certification off the model decision protocol', () => {
    expect(() => parseDecisionRequest({ protocol: 1, operation: 'deal' })).toThrow(
      /operation is invalid/,
    )
  })

  it('accepts only the bounded top-two mode on guess requests', () => {
    const fixture = correctionCase()
    const view = {
      kind: 'ai-guess',
      clueLanguage: 'target',
      turnsLeft: 4,
      words: fixture.view.words.map(({ roleOnMyKey: _role, ...entry }) => entry),
      currentClue: { text: 'dyr', number: 2 },
      history: [],
      flagged: [],
    }
    expect(parseDecisionRequest({ protocol: 1, operation: 'guess', view, candidateMode: 'top-two' }))
      .toMatchObject({ operation: 'guess', candidateMode: 'top-two' })
    expect(() => parseDecisionRequest({ protocol: 1, operation: 'guess', view, candidateMode: 'green-search' }))
      .toThrow(/candidateMode is invalid/)
    expect(() => parseDecisionRequest({ protocol: 1, operation: 'ping', candidateMode: 'top-two' }))
      .toThrow(/ping carries no game data/)
  })
})

describe('the L1 dictionary route', () => {
  const translation = () => parseDecisionRequest({ protocol: 1, operation: 'translate', term: 'helicopter' })

  it('uses the dictionary alias once, then normal Casey once only when its reply is invalid', async () => {
    const askModel = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ da: '', en: 'helicopter' }))
      .mockResolvedValueOnce(
        JSON.stringify({ da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true }),
      )

    const result = await decide(translation(), askModel, 'cluey')

    expect(result).toEqual({
      protocol: 1,
      decision: { da: 'helikopter', en: 'helicopter', article: 'en', gender: 'common', countable: true },
      report: { arm: 'cluey', refused: true },
    })
    expect(askModel).toHaveBeenCalledTimes(2)
    expect(askModel.mock.calls[0][1]).toMatchObject({
      alias: 'casey-dictionary',
      temperature: 0.1,
      maxTokens: 160,
      reasoningEffort: 'low',
      disableSearch: true,
      retryOn5xx: false,
    })
    expect(askModel.mock.calls[1][1]).toEqual({ temperature: 0.1, retryOn5xx: false })
  })

  it('does not turn a provider failure into a second paid attempt', async () => {
    const askModel = vi.fn(async () => {
      throw new CaseyServiceError('upstream_unavailable', 'Casey’s model could not be reached.', 502)
    })
    await expect(decide(translation(), askModel, 'cluey')).rejects.toMatchObject({ code: 'upstream_unavailable' })
    expect(askModel).toHaveBeenCalledOnce()
  })
})

/**
 * The bug the owner reported on 2026-09-12: "Casey's thoughts when picking
 * words from the players clues are still in English in another language." The
 * whole of Phase 4 is here — the wire field that carries the answer, the
 * prompt that asks for it, and the sentences the Worker writes itself when no
 * model answers at all.
 */
describe('Casey writes in the language the player speaks', () => {
  const guessRequest = (playerLanguage) =>
    parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      ...(playerLanguage ? { playerLanguage } : {}),
      view: {
        kind: 'ai-guess',
        turnsLeft: 4,
        words: [word('da:hund'), word('da:bil')].map(({ roleOnMyKey: _r, ...rest }) => rest),
        currentClue: { text: 'dyr', number: 1 },
        history: [],
        flagged: [],
      },
    })

  it('carries the player language on every operation, and defaults to English', () => {
    expect(guessRequest('de').playerLanguage).toBe('de')
    expect(guessRequest().playerLanguage).toBe('en')
    for (const operation of ['ping', 'translate']) {
      const request = parseDecisionRequest({
        protocol: 1,
        operation,
        playerLanguage: 'zh',
        ...(operation === 'translate' ? { term: 'dog' } : {}),
      })
      expect(request.playerLanguage).toBe('zh')
    }
  })

  it('refuses a language it has no pack for rather than guessing one', () => {
    expect(() => guessRequest('klingon')).toThrow(/playerLanguage is invalid/)
    expect(() => guessRequest(7)).toThrow(/playerLanguage is invalid/)
  })

  it('still answers a client built before Phase 4, which sends clueLanguage and no player language', () => {
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'clue',
      view: { ...clueView('da:hund', 'da:bil'), clueLanguage: 'target' },
    })
    expect(request.playerLanguage).toBe('en')
    // Accepted on the wire and dropped on the way in: nothing downstream reads it.
    expect(request.view).not.toHaveProperty('clueLanguage')
  })

  it.each([
    ['de', 'GERMAN', 'Apfel'],
    ['es', 'SPANISH', 'manzana'],
    ['zh', 'CHINESE', '苹果'],
  ])('asks for the reasoning in %s and leaves no English instruction behind', (code, shouted, gloss) => {
    const request = guessRequest(code)
    const prompt = buildGuessPrompt(
      request.view,
      DANISH_LANGUAGE,
      '',
      undefined,
      playerLanguageFor(request.playerLanguage),
    ).map((message) => message.content).join('\n')
    expect(prompt).toContain(`one short sentence IN ${shouted}`)
    expect(prompt).toContain(gloss)
    expect(prompt).not.toContain('one short English sentence')
    expect(prompt).not.toContain('<short sentence in English>')
    expect(prompt).not.toContain('"æble (apple) is a fruit')
    // The board and the clue stay Danish: this changes what Casey WRITES, not
    // what she plays in.
    expect(prompt).toContain('one Danish word')
  })

  it('asks for the clue rationale in the player language too', () => {
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'clue',
      playerLanguage: 'de',
      view: clueView('da:hund', 'da:bil'),
    })
    const prompt = buildCluePrompt(
      request.view,
      DANISH_LANGUAGE,
      '',
      playerLanguageFor(request.playerLanguage),
    )[0].content
    expect(prompt).toContain('one or two sentences IN GERMAN')
    expect(prompt).toContain('Hund und Katze sind beides Haustiere')
    expect(prompt).not.toContain('one or two sentences in English')
  })

  it('translates from the player language into Danish, not Danish and English', () => {
    const prompt = buildTranslatePrompt('Fahrrad', DANISH_LANGUAGE, playerLanguageFor('de'))[0].content
    expect(prompt).toContain('from German into Danish')
    expect(prompt).toContain('"en": "Fahrrad"')
    expect(prompt).not.toContain('English')
    expect(prompt).not.toContain('bicycle')
  })

  it('writes its OWN fallback sentences in the player language, where no prompt can reach', async () => {
    // The model refuses every time, so the clue and its rationale come from the
    // Worker's own data. A prompt cannot translate this one.
    const askModel = vi.fn().mockRejectedValue(
      new CaseyServiceError('upstream_unavailable', 'no model', 502),
    )
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'clue',
      playerLanguage: 'de',
      view: { ...correctionCase().view, boardId: undefined },
    })
    const answer = await decide(request, askModel, 'cluey')
    expect(answer.report.arm).toMatch(/fallback-/)
    expect(answer.decision.rationale).toMatch(/^Ich sehe /)
    expect(answer.decision.rationale).not.toContain('I see ')
  })

  it('tells the player it could not answer, in their language', async () => {
    const askModel = vi.fn().mockResolvedValue('not json at all')
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'translate',
      playerLanguage: 'es',
      term: 'perro',
    })
    await expect(decide(request, askModel, 'cluey')).rejects.toMatchObject({
      code: 'invalid_model_reply',
      message: 'La traducción ha llegado en un formato que la aplicación no ha podido leer.',
    })
  })
})

describe('server brain parity with the measured research contracts', () => {
  const fixture = correctionCase()
  const guessView = {
    kind: 'ai-guess',
    clueLanguage: 'target',
    turnsLeft: 4,
    words: fixture.view.words.map(({ roleOnMyKey: _role, ...entry }) => entry),
    currentClue: { text: 'dyr', number: 1 },
    history: [],
    flagged: [],
  }

  it('keeps all three server prompt builders byte-equal to their source specifications', () => {
    expect(buildCluePrompt(fixture.view, DANISH_LANGUAGE)).toEqual(clientCluePrompt(fixture.view, danish))
    expect(buildGuessPrompt(guessView, DANISH_LANGUAGE)).toEqual(clientGuessPrompt(guessView, danish))
    expect(buildTranslatePrompt('dog', DANISH_LANGUAGE)).toEqual(clientTranslatePrompt('dog', danish))
  })

  it('keeps the optional top-two prompt byte-equal and explicit about model rank', () => {
    const server = buildGuessPrompt(guessView, DANISH_LANGUAGE, '', 'top-two')
    expect(server).toEqual(clientGuessPrompt(guessView, danish, 'top-two'))
    expect(server[0].content).toContain('first and second ranked DISTINCT legal candidates')
    expect(server[0].content).toContain('do not sort them by confidence')
    expect(server[0].content).toContain('one short sentence IN ENGLISH explaining this candidate’s own connection')
    expect(server[0].content).toContain('Use at most 12 words')
    expect(server[0].content).not.toContain('name the board word you weighed it against')
    expect(server[0].content).not.toContain('the nearest decoy is')
  })

  it.each([
    [3, 0, 3],
    [3, 1, 2],
    [4, 2, 2],
  ])('separates original clue %i, %i public guesses, and %i remaining', (number, already, remaining) => {
    const continued = {
      ...guessView,
      currentClue: { text: 'dyr', number },
      history: [{
        by: 'player', text: 'dyr', number,
        guesses: Array.from({ length: already }, (_, i) => ({ da: `ord${i}`, result: 'green' })),
      }],
    }
    const server = buildGuessPrompt(continued, DANISH_LANGUAGE, '', 'top-two')
    expect(server).toEqual(clientGuessPrompt(continued, danish, 'top-two'))
    const text = server.map((message) => message.content).join('\n')
    expect(text).toContain(`ORIGINAL number is ${number}`)
    expect(text).toContain(`${already} guess(es) already made`)
    expect(text).toContain(`${remaining} guess(es) in its allowance`)
    expect(text).toContain('NEXT ONE actual guess')
    expect(text).not.toContain(`exactly ${number} unrevealed word(s) fit`)
  })

  it('leaves the legacy number instructions unchanged', () => {
    const text = buildGuessPrompt(guessView, DANISH_LANGUAGE).map((message) => message.content).join('\n')
    expect(text).toContain('The number is evidence, not decoration: your partner is asserting that exactly 1 unrevealed word(s) fit.')
    expect(text).not.toContain('ORIGINAL number')
  })

  it('returns at most two distinct legal alternatives without confidence reordering', async () => {
    const openGuessView = {
      ...guessView,
      words: guessView.words.map((entry) => ({ ...entry, reveal: { kind: 'hidden' } })),
    }
    const first = openGuessView.words[0].id
    const second = openGuessView.words[1].id
    const askModel = vi.fn(async () => JSON.stringify({ guesses: [
      { wordId: 'unknown', confidence: 1, reasoning: 'unknown row' },
      { wordId: first, confidence: 0.1, reasoning: 'first legal row' },
      { wordId: first, confidence: 0.99, reasoning: 'duplicate row' },
      { wordId: second, confidence: 0.9, reasoning: 'second legal row' },
    ] }))
    const request = parseDecisionRequest({
      protocol: 1,
      operation: 'guess',
      view: openGuessView,
      candidateMode: 'top-two',
    })

    const result = await decide(request, askModel, 'cluey')
    expect(result.decision.guesses).toEqual([
      { wordId: first, confidence: 0.1, reasoning: 'first legal row' },
      { wordId: second, confidence: 0.9, reasoning: 'second legal row' },
    ])
    expect(askModel).toHaveBeenCalledOnce()
  })

  it('keeps server clue legality equal across inflections, compounds and safe clues', () => {
    const board = [word('da:hus', 'green'), word('da:køre', 'bystander')].map(
      ({ id, da, en, pos }) => ({ wordId: id, da, en, pos }),
    )
    // The parity being guaranteed is the DECISION and the reason given for it.
    // The client's verdict carries one more field, `why` — the same refusal as
    // data, so the clue dock can write the sentence in the player's language
    // instead of printing the engine's English. The Worker has no screen and
    // no player language, so it has nothing to put there, and comparing whole
    // objects would make this test fail for a difference that is the point.
    const decision = ({ legal, reason, conflictWord }) => ({ legal, reason, conflictWord })
    for (const clue of ['huset', 'sommerhus', 'koerte', 'transport', 'glæde']) {
      expect(decision(checkClueLegality(clue, board))).toEqual(
        decision(clientLegality(clue, board, danish)),
      )
    }
  })

  it('checks Danish forms only and ignores English gloss morphology', () => {
    const board = [{ wordId: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' }]

    expect(checkClueLegality('time', board).legal).toBe(true)
    expect(checkClueLegality('times', board).legal).toBe(true)
    expect(checkClueLegality('tiden', board).legal).toBe(false)
  })

  it('blocks clear Danish typos without rejecting minimal pairs or unrelated unknown words', () => {
    const one = (da) => [{ wordId: `da:${da}`, da, en: ['unused'], pos: 'noun' }]

    expect(checkClueLegality('hnd', one('hund')).legal).toBe(false)
    expect(checkClueLegality('hudnen', one('hund')).legal).toBe(false)
    expect(checkClueLegality('vandfadl', one('vand')).legal).toBe(false)
    expect(checkClueLegality('hhus', one('hus')).legal).toBe(false)
    expect(checkClueLegality('ttid', one('tid')).legal).toBe(false)
    expect(checkClueLegality('hånd', one('hund')).legal).toBe(true)
    expect(checkClueLegality('frisk', one('fisk')).legal).toBe(true)
    expect(checkClueLegality('lige', one('pige')).legal).toBe(true)
    expect(checkClueLegality('xyzzy', one('hund')).legal).toBe(true)
  })

  it('keeps the server evaluator equal to the E4/E6 research adapter', async () => {
    const server = loadEvaluator(1)
    const research = await loadResearchEvaluator(1)
    expect(research).not.toBeNull()
    for (const target of server.ids.slice(0, 12)) {
      for (const clue of ['familie', 'hjem', 'arbejde', target.slice(3)]) {
        expect(server.sim(clue, target)).toBe(research.sim(clue, target))
      }
    }
  })
})

describe('the bank-first OPENING clue', () => {
  // A fresh clue view of board 1, built the way the browser sends it.
  const authoredView = (() => {
    const board = bank.boards[0]
    return {
      kind: 'ai-clue',
      clueLanguage: 'target',
      turnsLeft: 8,
      words: board.wordIds.map((id) => {
        const entry = byId.get(id)
        return {
          id,
          da: entry.da,
          en: entry.en,
          pos: entry.pos,
          reveal: { kind: 'hidden' },
          roleOnMyKey: board.aiGreenIds.includes(id) ? 'green' : 'bystander',
        }
      }),
      history: [],
      flagged: [],
      boardId: board.id,
    }
  })()

  it('opens an authored round from the bank with zero model calls', async () => {
    const askModel = vi.fn()
    const result = await decide(requestFor(authoredView), askModel, 'cluey')
    // The bank's first path group for board 1: «forrige» → uge, sidste, måned.
    expect(result.decision.clue).toBe('forrige')
    expect(result.decision.number).toBe(3)
    expect(result.decision.targetWordIds).toEqual(['da:uge', 'da:sidste', 'da:måned'])
    // No model was credited with a call it did not make.
    expect(askModel).not.toHaveBeenCalled()
    expect(result.report).toEqual({ arm: 'authored', refused: false })
    // The rationale is Casey's voice, never the mechanism.
    expect(result.decision.rationale).not.toMatch(/bank|board was built|precomputed|authored/i)
  })

  it('returns to ordinary model play the moment the round has history', async () => {
    const withHistory = {
      ...authoredView,
      history: [{ by: 'player', text: 'huskeliste', number: 2, guesses: [] }],
    }
    const askModel = vi.fn(async () => modelClue('egen', authoredView.words.filter((word) => word.roleOnMyKey === 'green').slice(0, 2).map((word) => word.id)))
    const result = await decide(requestFor(withHistory), askModel, 'cluey')
    expect(askModel).toHaveBeenCalled()
    expect(result.report.arm).not.toBe('authored')
  })

  it('keeps every later clue and every non-authored board on the model path', async () => {
    const later = {
      ...authoredView,
      history: [{ by: 'ai', text: 'forrige', number: 3, guesses: [] }],
    }
    const askModel = vi.fn(async () => modelClue('egen', authoredView.words.filter((word) => word.roleOnMyKey === 'green').slice(0, 2).map((word) => word.id)))
    await decide(requestFor(later), askModel, 'cluey')
    expect(askModel).toHaveBeenCalledOnce()
  })
})
