import { describe, expect, it } from 'vitest'
import { TutorialCompanion } from '../ai/tutorialCompanion'
import { buildAiClueView, buildAiGuessView } from '../ai/projections'
import { WORDS, isHeadword, wordById } from '../data/words'
import { TUTORIAL_CONFIG } from '../engine/config'
import { applyEvent as applyEventIn, createGame, isGuessable } from '../engine/game'
import { checkClueLegality } from '../engine/legality'
import type { GameState } from '../engine/types'
import { danish } from '../lang/da'
import { german } from '../lang/de'
import { conflicts } from '../srs/sampler'
import { UI } from '../i18n'
import {
  TUTORIAL_AI_CLUES,
  TUTORIAL_CLUE_NUMBERS,
  TUTORIAL_ROLES,
  TUTORIAL_SEED,
  TUTORIAL_WORD_IDS,
  commentary,
  introGameTourDue,
  isCurrentTutorialGame,
  tutorialDirectionTaught,
  tutorialEvent,
  tutorialScriptFor,
} from './tutorial'

const applyEvent = (state: GameState, event: Parameters<typeof applyEventIn>[1]) =>
  applyEventIn(state, event, danish)

const deal = (): GameState =>
  createGame({
    config: TUTORIAL_CONFIG,
    words: TUTORIAL_WORD_IDS.map((id) => {
      const word = wordById(id)!
      return {
        wordId: word.id,
        da: word.da,
        en: word.en,
        pos: word.pos,
        article: word.article,
        gender: word.gender,
        countable: word.countable,
      }
    }),
    seed: TUTORIAL_SEED,
    firstGiver: 'ai',
  })

const dealGerman = (): GameState => {
  const script = tutorialScriptFor('de')
  const entries = script.wordIds.map((id) => german.words.find((word) => word.id === id)!)
  return createGame({
    config: TUTORIAL_CONFIG,
    words: entries.map((word) => ({
      wordId: word.id,
      da: word.da,
      en: word.en,
      pos: word.pos,
      article: word.article,
      gender: word.gender,
      countable: word.countable,
    })),
    seed: TUTORIAL_SEED,
    firstGiver: 'ai',
  })
}

const companion = new TutorialCompanion()

async function applyNextAiClue(state: GameState): Promise<GameState> {
  const response = await companion.getClue(buildAiClueView(state))
  return applyEvent(state, {
    type: 'SUBMIT_CLUE',
    by: 'ai',
    text: response.clue,
    number: response.number,
    targets: response.targetWordIds,
    rationale: response.rationale,
  })
}

function applyPlayerClue(
  state: GameState,
  wordIds: readonly string[],
  number = wordIds.length,
): GameState {
  let next = applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text: 'spise', number })
  for (const wordId of wordIds) {
    if (next.phase !== 'aiGuessing') break
    next = applyEvent(next, { type: 'GUESS', wordId })
  }
  return next
}

describe('the authored practice deal', () => {
  it('is the nine-word board and passes every conflict rule', () => {
    expect(TUTORIAL_WORD_IDS).toEqual([
      'da:vand', 'da:mad', 'da:æble', 'da:hus', 'da:kaffe',
      'da:bord', 'da:ost', 'da:hund', 'da:mælk',
    ])
    const words = TUTORIAL_WORD_IDS.map((id) => wordById(id)!)
    for (let left = 0; left < words.length; left++) {
      for (let right = left + 1; right < words.length; right++) {
        expect(conflicts(words[left]!, words[right]!), `${words[left]!.id} vs ${words[right]!.id}`).toBe(false)
      }
    }
  })

  it('deals every authored role exactly once for its pinned seed', () => {
    const state = deal()
    const roleOf = (id: string) => `${state.playerKey[id]}/${state.aiKey[id]}`
    for (const id of TUTORIAL_ROLES.sharedGreens) expect(roleOf(id), id).toBe('green/green')
    for (const id of TUTORIAL_ROLES.playerOnlyGreens) expect(roleOf(id), id).toBe('green/bystander')
    for (const id of TUTORIAL_ROLES.aiOnlyGreens) expect(roleOf(id), id).toBe('bystander/green')
    for (const id of TUTORIAL_ROLES.bystanders) expect(roleOf(id), id).toBe('bystander/bystander')
    expect([...Object.values(TUTORIAL_ROLES).flat()].sort()).toEqual([...TUTORIAL_WORD_IDS].sort())
  })

  it('rejects stale persisted practice deals after the authored lesson changes', () => {
    const current = deal()
    expect(isCurrentTutorialGame(current)).toBe(true)
    expect(isCurrentTutorialGame({
      ...current,
      config: { ...current.config, turnTokens: 4 },
    })).toBe(false)
    expect(isCurrentTutorialGame({
      ...current,
      words: [...current.words].reverse(),
    })).toBe(false)
  })

  it('keeps Casey’s authored Danish clues legal, off-board and on Casey’s key', () => {
    const state = deal()
    const board = new Set(TUTORIAL_WORD_IDS)
    for (const clue of TUTORIAL_AI_CLUES) {
      expect(isHeadword(clue.text), clue.text).toBe(true)
      expect(board.has(WORDS.find((word) => word.da === clue.text)!.id), clue.text).toBe(false)
      expect(checkClueLegality(clue.text, state.words, danish).legal, clue.text).toBe(true)
      for (const wordId of clue.targetWordIds) {
        expect(state.aiKey[wordId], `${clue.text} → ${wordId}`).toBe('green')
      }
    }
    expect(TUTORIAL_AI_CLUES).toMatchObject([
      { text: 'drikke', number: 3, targetWordIds: ['da:vand', 'da:kaffe', 'da:mælk'] },
      { text: 'hjem', number: 1, targetWordIds: ['da:hus'] },
    ])
    expect(TUTORIAL_CLUE_NUMBERS).toEqual([2, 3])
  })
})

describe('the German authored practice deal', () => {
  it('uses real, conflict-free German words and legal clues for the pinned role layout', async () => {
    const script = tutorialScriptFor('de')
    const state = dealGerman()
    const entries = script.wordIds.map((id) => german.words.find((word) => word.id === id)!)
    const board = new Set(script.wordIds)

    expect(entries.every(Boolean)).toBe(true)
    for (let left = 0; left < entries.length; left++) {
      for (let right = left + 1; right < entries.length; right++) {
        expect(conflicts(entries[left]!, entries[right]!), `${entries[left]!.id} vs ${entries[right]!.id}`).toBe(false)
      }
    }

    const roleOf = (id: string) => `${state.playerKey[id]}/${state.aiKey[id]}`
    for (const id of script.roles.sharedGreens) expect(roleOf(id), id).toBe('green/green')
    for (const id of script.roles.playerOnlyGreens) expect(roleOf(id), id).toBe('green/bystander')
    for (const id of script.roles.aiOnlyGreens) expect(roleOf(id), id).toBe('bystander/green')
    for (const id of script.roles.bystanders) expect(roleOf(id), id).toBe('bystander/bystander')
    expect([...Object.values(script.roles).flat()].sort()).toEqual([...script.wordIds].sort())

    for (const clue of script.aiClues) {
      const entry = german.words.find((word) => word.da === clue.text)
      expect(entry, clue.text).toBeDefined()
      expect(board.has(entry!.id), clue.text).toBe(false)
      expect(checkClueLegality(clue.text, state.words, german).legal, clue.text).toBe(true)
      for (const id of clue.targetWordIds) expect(state.aiKey[id], `${clue.text} → ${id}`).toBe('green')
    }
    // Mensch is a valid shared association for Mutter, Vater, and Kind; the
    // clue is legal and all three cards are green on the player's key.
    const playerClue = german.words.find((word) => word.da === 'Mensch')
    expect(playerClue).toBeDefined()
    expect(board.has(playerClue!.id)).toBe(false)
    expect(checkClueLegality('Mensch', state.words, german).legal).toBe(true)
    expect(['de:Mutter', 'de:Vater', 'de:Kind'].every((id) => state.playerKey[id] === 'green')).toBe(true)
    // Familie is absent from the shipped inventory, but the rules permit it as
    // a player-entered clue because it neither names nor derives from a card.
    expect(german.words.some((word) => word.da === 'Familie')).toBe(false)
    expect(checkClueLegality('Familie', state.words, german).legal).toBe(true)
    expect(script.aiClues).toMatchObject([
      { text: 'Zeit', number: 3, targetWordIds: ['de:Uhr', 'de:Monat', 'de:Woche'] },
      { text: 'Zuhause', number: 1, targetWordIds: ['de:Haus'] },
    ])

    const companion = new TutorialCompanion(script)
    const opening = await companion.getClue(buildAiClueView(state))
    expect(opening).toMatchObject({ clue: 'Zeit', number: 3, targetWordIds: ['de:Uhr', 'de:Monat', 'de:Woche'] })
    let afterOpening = applyEventIn(state, {
      type: 'SUBMIT_CLUE',
      by: 'ai',
      text: opening.clue,
      number: opening.number,
      targets: opening.targetWordIds,
      rationale: opening.rationale,
    }, german)
    afterOpening = applyEventIn(afterOpening, { type: 'GUESS', wordId: 'de:Uhr' }, german)
    afterOpening = applyEventIn(afterOpening, { type: 'STOP_GUESSING' }, german)
    const recovery = await companion.getClue(buildAiClueView(afterOpening))
    expect(recovery).toMatchObject({ clue: 'Zeit', number: 2, targetWordIds: ['de:Monat', 'de:Woche'] })
  })
})

describe('the practice rules and commentary', () => {
  it('begins with Casey’s concrete clue and points to the existing translation control', () => {
    expect(commentary(deal(), { type: 'intro' })).toEqual({
      kind: 'narration',
      mood: 'idle',
      text: 'My clue is «drikke» for 3. What words on this board connect with it? Tap ⓘ whenever a translation would help.',
    })
  })

  it('keeps the full first-turn instruction visible after the authored clue is submitted', async () => {
    const state = await applyNextAiClue(deal())
    expect(commentary(state, { type: 'state' }).text).toBe(
      'Hey, what words on this board can you connect with «drikke»? You can tap the ⓘ on words to see their translations. When you’re ready, tap a word and confirm it.',
    )
  })

  it('reports correct and wrong first guesses from Casey’s key, not the visible player key', async () => {
    const first = await applyNextAiClue(deal())
    const correct = applyEvent(first, { type: 'GUESS', wordId: 'da:vand' })
    expect(commentary(correct, tutorialEvent(correct))).toMatchObject({
      mood: 'happy',
      claim: { wordId: 'da:vand', result: 'green', roleOnPlayerKey: 'bystander' },
    })

    const wrong = applyEvent(first, { type: 'GUESS', wordId: 'da:ost' })
    expect(wrong.phase).toBe('playerClueInput')
    expect(wrong.reveals['da:ost']).toEqual({ kind: 'bystander', against: ['ai'] })
    expect(commentary(wrong, tutorialEvent(wrong))).toMatchObject({
      mood: 'oops',
      claim: { wordId: 'da:ost', result: 'bystander', roleOnPlayerKey: 'green', teachesDirection: true },
    })
    expect(isGuessable({ ...wrong, phase: 'aiGuessing' }, 'da:ost')).toBe(true)
    expect(tutorialDirectionTaught(wrong)).toBe(true)
  })

  it('reveals the private greens and 2–3 word task on the player’s turn', async () => {
    let state = await applyNextAiClue(deal())
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:ost' })
    expect(commentary(state, { type: 'state' }).text).toBe(
      'That’s the end of my turn. Now it’s your turn. Give me a Danish clue that connects 2 or 3 green cards on your side. I can’t see them, just as you can’t see my key.',
    )
  })

  it('introduces the seven shared round tokens after the player gives their first clue', async () => {
    let state = await applyNextAiClue(deal())
    for (const id of TUTORIAL_AI_CLUES[0]!.targetWordIds) state = applyEvent(state, { type: 'GUESS', wordId: id })
    state = applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text: 'spise', number: 3 })
    expect(state.phase).toBe('aiGuessing')
    expect(state.turnsLeft).toBe(6)
    expect(commentary(state, { type: 'state' }).text).toBe(
      'Your clue is «spise» for 3. The 7 dots at the top are our shared round tokens. Every clue, yours or mine, uses one. I’ll think out loud below.',
    )
  })
})

describe('the intro-game tour pacing (2026-09-18)', () => {
  it('opens on the player first clue turn, with the authored opening clue in the history', async () => {
    // The scripted opening holds (1100ms each) leave the phase at aiClueInput
    // with an empty history: the tour must not open while Casey still has the
    // floor, and the key is not on the board then either.
    const opening = deal()
    expect(introGameTourDue(opening)).toBe(false)

    const first = await applyNextAiClue(deal())
    expect(first.phase).toBe('playerGuessing')
    expect(introGameTourDue(first)).toBe(false)

    const turn = applyEvent(first, { type: 'GUESS', wordId: 'da:ost' })
    expect(turn.phase).toBe('playerClueInput')
    expect(turn.clueHistory.some((clue) => clue.by === 'ai')).toBe(true)
    expect(introGameTourDue(turn)).toBe(true)
  })

  it('never re-opens once the player has clued, at any later clue turn', async () => {
    let state = await applyNextAiClue(deal())
    for (const id of TUTORIAL_AI_CLUES[0]!.targetWordIds) state = applyEvent(state, { type: 'GUESS', wordId: id })
    state = applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text: 'spise', number: 3 })
    // The AI guessing under the player's clue has the key on the board too,
    // but the tour is spent — the player has already given one.
    expect(state.phase).toBe('aiGuessing')
    expect(introGameTourDue(state)).toBe(false)
    // Play the player's clue honestly (two greens, then stop) and let Casey
    // recover, so the round reaches a SECOND player clue turn. Mad and æble
    // land; ost stays hidden and keeps the turn from ending on a full board.
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:mad' })
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:æble' })
    state = applyEvent(state, { type: 'STOP_GUESSING' })
    state = await applyNextAiClue(state)
    // The recovery clue is still being guessed against — the turn it opens is
    // the second clue turn, which the key is visible on and the tour is not.
    expect(state.phase).toBe('playerGuessing')
    expect(state.clueHistory.some((clue) => clue.by === 'player')).toBe(true)
    expect(introGameTourDue(state)).toBe(false)
  })
})

describe('the complete practice round', () => {
  it('has a reachable three-clue win through real engine events', async () => {
    let state = await applyNextAiClue(deal())
    for (const id of TUTORIAL_AI_CLUES[0]!.targetWordIds) state = applyEvent(state, { type: 'GUESS', wordId: id })
    state = applyPlayerClue(state, TUTORIAL_ROLES.playerOnlyGreens)
    state = await applyNextAiClue(state)
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:hus' })
    // C1-PC-1: practice teaches the same translation and actual wheel ending.
    expect(state.phase).toBe('translateChallenge')
    expect(state.outcome).toBeUndefined()
    expect(tutorialEvent(state)).toEqual({ type: 'state' })
    expect(commentary(state, tutorialEvent(state)).text).toBe(UI.game.guidanceTranslationBody(UI.onboarding.courseText('da').languageName))
    expect(commentary(state, { type: 'state' }).text).toContain('back in Danish')
    expect(commentary(state, { type: 'state' }).text).not.toContain('Platinum')
    for (const id of state.wheel!.segments) {
      state = applyEvent(state, { type: 'SUBMIT_TRANSLATION', wordId: id, answer: state.words.find((w) => w.wordId === id)!.da })
    }
    expect(state.phase).toBe('translateWheel')
    expect(tutorialEvent(state)).toEqual({ type: 'state' })
    expect(commentary(state, tutorialEvent(state)).text).toBe(UI.game.wheelLede(UI.onboarding.courseText('da').languageName))
    expect(commentary(state, { type: 'state' }).text).toContain('wheel')
    expect(commentary(state, { type: 'state' }).text).not.toContain('Platinum')
    state = applyEvent(state, { type: 'SPIN_WHEEL' })
    expect(state.outcome).toEqual({ result: 'won', reason: 'wheel-win' })
    expect(tutorialEvent(state)).toEqual({ type: 'state' })
    expect(commentary(state, tutorialEvent(state)).text).toBe(UI.onboarding.practiceWon)
    expect(state.clueHistory.map((clue) => clue.text)).toEqual(['drikke', 'spise', 'hjem'])
    expect(state.turnsLeft).toBe(5)
  })

  it('keeps an early miss honest and can finish as a real loss', async () => {
    let state = await applyNextAiClue(deal())
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:bord' })
    state = applyPlayerClue(state, ['da:mad'], 2)
    state = applyEvent(state, { type: 'STOP_GUESSING' })
    state = await applyNextAiClue(state)
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:hund' })
    state = applyPlayerClue(state, ['da:æble'], 2)
    state = applyEvent(state, { type: 'STOP_GUESSING' })
    // Seven tokens make a loss deliberately remote, but it remains a real
    // engine path: two directional misses and one stopped green spend the
    // three extra clues before a genuinely neutral last-chance guess.
    state = await applyNextAiClue(state)
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:ost' })
    state = applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text: 'spise', number: 1 })
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:vand' })
    state = await applyNextAiClue(state)
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:kaffe' })
    state = applyEvent(state, { type: 'STOP_GUESSING' })
    // C1-PC-1 replaces the old manual sudden-death fixture override with the
    // real practice wheel. Zero translated targets necessarily miss.
    expect(state.phase).toBe('translateChallenge')
    expect(state.wheel!.segments).toEqual(['da:mad', 'da:æble', 'da:kaffe'])
    state = applyEvent(state, { type: 'SPIN_WHEEL' })
    expect(state.outcome).toEqual({ result: 'lost', reason: 'wheel-miss' })
  })

  it('recovers from an opening miss with a final one-card player clue', async () => {
    let state = await applyNextAiClue(deal())
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:bord' })
    state = applyPlayerClue(state, TUTORIAL_ROLES.playerOnlyGreens)

    state = await applyNextAiClue(state)
    expect(state.clueHistory.at(-1)).toMatchObject({
      text: 'drikke',
      number: 3,
      targets: TUTORIAL_ROLES.aiOnlyGreens,
    })
    for (const id of TUTORIAL_ROLES.aiOnlyGreens) state = applyEvent(state, { type: 'GUESS', wordId: id })

    expect(state.phase).toBe('playerClueInput')
    expect(commentary(state, { type: 'state' }).text).toContain('one Danish clue for that final card')
    state = applyPlayerClue(state, ['da:hus'], 1)
    expect(state.phase).toBe('translateChallenge')
    expect(state.outcome).toBeUndefined()
    expect(state.wheel!.segments).toHaveLength(7)
    expect(state.turnsLeft).toBe(4)
  })

  it('keeps the player clue real: TutorialCompanion never supplies its guesses', async () => {
    let state = await applyNextAiClue(deal())
    state = applyEvent(state, { type: 'GUESS', wordId: 'da:bord' })
    state = applyEvent(state, { type: 'SUBMIT_CLUE', by: 'player', text: 'spise', number: 3 })
    await expect(companion.getGuesses(buildAiGuessView(state))).rejects.toThrow('must reach Casey')
  })
})
