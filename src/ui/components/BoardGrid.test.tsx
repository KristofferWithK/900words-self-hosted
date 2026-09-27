import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BOARD } from '../../engine/config'
import { createGame } from '../../engine/game'
import { WORDS } from '../../data/words'
import type { GameState } from '../../engine/types'
import { BoardGrid, playerKeyHidden } from './BoardGrid'

const game = createGame({
  config: BOARD,
  words: WORDS.slice(0, BOARD.totalWords).map((word) => ({
    wordId: word.id,
    da: word.da,
    en: word.en,
    pos: word.pos,
    article: word.article,
    gender: word.gender,
  })),
  seed: 7,
})

const grid = (hidePlayerKey: boolean) =>
  renderToStaticMarkup(
    <BoardGrid
      game={game}
      canGuess={false}
      selectedWordId={null}
      onCardTap={() => undefined}
      onInfoTap={() => undefined}
      dictionaryLocked
      englishFace={() => false}
      packingSelectable
      hidePlayerKey={hidePlayerKey}
    />,
  )

describe('wrap-up packing key privacy', () => {
  it('hides player-key borders and accessible target labels during packing', () => {
    const html = grid(true)

    expect(html).not.toContain('mykey-green')
    expect(html).not.toContain('your target')
  })

  it('restores the player key immediately after packing', () => {
    const html = grid(false)

    expect(html).toContain('mykey-green')
    expect(html).toContain('your target')
  })
})

describe('solved cards pack into the suitcase glyph', () => {
  // A freshly dealt board has no reveals yet; plant one solved word and keep
  // the rest hidden, the way the board looks right after a correct guess.
  const solvedGame: GameState = {
    ...game,
    reveals: {
      ...game.reveals,
      [game.words[0].wordId]: { kind: 'green' },
    },
  }
  const solvedDa = game.words[0].da
  const solvedHtml = renderToStaticMarkup(
    <BoardGrid
      game={solvedGame}
      canGuess={false}
      selectedWordId={null}
      onCardTap={() => undefined}
      onInfoTap={() => undefined}
      dictionaryLocked={false}
      englishFace={() => false}
    />,
  )
  const solvedCard = solvedHtml.slice(
    solvedHtml.indexOf(`<div class="word-card-wrap wrap-green`),
    solvedHtml.indexOf('<div class="word-card-wrap', solvedHtml.indexOf(`<div class="word-card-wrap wrap-green`) + 10),
  )

  it('renders the paper card with the suitcase glyph, no word text', () => {
    expect(solvedCard).toContain('card-green')
    expect(solvedCard).toContain('card-suitcase-glyph')
    // The word, its article and its gloss are off the face entirely.
    expect(solvedCard).not.toContain('card-article')
    expect(solvedCard).not.toContain('card-word')
    expect(solvedCard).not.toContain(`>${solvedDa}<`)
    expect(solvedCard).not.toContain('card-en')
  })

  it('keeps the accessible name: the word and ", found"', () => {
    expect(solvedCard).toContain(`${solvedDa}, found`)
    expect(solvedCard).not.toContain('card-suitcase-glyph" aria-label')
    // Tap-to-hear is still offered on the card button itself.
    expect(solvedCard).not.toContain('aria-disabled')
  })

  it('does NOT render the ⓘ lookup button on a solved card', () => {
    expect(solvedCard).not.toContain('card-info')
    // …while an unsolved card on the same board still has it.
    const others = solvedHtml.slice(solvedHtml.indexOf('wrap-hidden'))
    expect(others).toContain('card-info')
  })

  it('keeps mykey-green untouched on an unsolved key target', () => {
    expect(solvedHtml).toContain('mykey-green')
  })
})

describe('when the player key is put away', () => {
  const at = (phase: Parameters<typeof playerKeyHidden>[0]['phase'], extra: Partial<Parameters<typeof playerKeyHidden>[0]> = {}) =>
    playerKeyHidden({ phase, packing: false, ...extra })

  it('hides it for the guessing half of the round and shows it for the cluing half', () => {
    // Casey's clue turn and the guess under it: no frames.
    expect(at('aiClueInput')).toBe(true)
    expect(at('playerGuessing')).toBe(true)
    // The player's clue turn and Casey's guesses against this key: frames.
    expect(at('playerClueInput')).toBe(false)
    expect(at('aiGuessing')).toBe(false)
    // The last chance keeps it: your own greens are among the words that win it.
    expect(at('suddenDeath')).toBe(false)
    expect(at('finished')).toBe(false)
  })

  it('hides it throughout packing, whatever the phase', () => {
    expect(at('playerClueInput', { packing: true })).toBe(true)
  })
})

describe('ordinary word border motion', () => {
  const renderPhase = (phase: GameState['phase']) =>
    renderToStaticMarkup(
      <BoardGrid
        game={{ ...game, phase }}
        canGuess={false}
        selectedWordId={null}
        onCardTap={() => undefined}
        onInfoTap={() => undefined}
        dictionaryLocked={false}
      />,
    )

  it('animates eligible ordinary cards, including the visible green key', () => {
    const cards = renderPhase('playerClueInput').match(/<button class="[^"]*word-card[^"]*"[^>]*>/g) ?? []
    const moving = cards.filter((card) => card.includes('card-border-motion'))
    const keyCards = cards.filter((card) => card.includes('mykey-green'))

    expect(moving.length).toBeGreaterThan(0)
    expect(keyCards.length).toBeGreaterThan(0)
    expect(keyCards.every((card) => card.includes('card-border-motion'))).toBe(true)
  })

  it('renders exactly three distinct SVG outlines as the discrete motion frames', () => {
    const html = renderPhase('playerClueInput')
    const firstMovingCard = /<button class="[^"]*card-border-motion[^"]*"[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? ''
    const framePaths = [...firstMovingCard.matchAll(/<path class="[^"]*card-border-frame[^"]*"[^>]*d="([^"]+)"/g)]
      .map(([, path]) => path)

    expect(framePaths).toHaveLength(3)
    expect(new Set(framePaths).size).toBe(3)
  })
})

describe('the wheel phase board treatments (owner, 2026-09-17)', () => {
  // The wheel challenge's board: two solved suitcases, one neutral revealed
  // against both sides, the rest still hidden — a mid-challenge last chance.
  const wheelGame = (phase: GameState['phase'] = 'translateChallenge'): GameState => {
    const reveals = { ...game.reveals }
    reveals[game.words[0].wordId] = { kind: 'green' }
    reveals[game.words[1].wordId] = { kind: 'green' }
    reveals[game.words[2].wordId] = { kind: 'bystander', against: ['player', 'ai'] }
    return {
      ...game,
      phase,
      reveals,
      wheel:
        phase === 'translateChallenge' || phase === 'translateWheel'
          ? {
              segments: [game.words[0].wordId, game.words[1].wordId],
              translated: phase === 'translateWheel' ? [game.words[0].wordId, game.words[1].wordId] : [],
              filled: phase === 'translateWheel' ? [0, 1] : [],
              attempts: phase === 'translateWheel' ? 2 : 0,
              landed: null,
              result: null,
              spent: null,
            }
          : undefined,
    }
  }
  const render = (state: GameState, canGuess = false) =>
    renderToStaticMarkup(
      <BoardGrid
        game={state}
        canGuess={canGuess}
        selectedWordId={null}
        onCardTap={() => undefined}
        onInfoTap={() => undefined}
        dictionaryLocked={state.phase === 'translateChallenge' || state.phase === 'translateWheel'}
        englishFace={() => false}
        // GameScreen's split predicate (owner, build 90): the lid words and
        // the dimming are the CHALLENGE's; the won-spin board is empty.
        wheelActive={state.phase === 'translateChallenge'}
        wheelSolved={(wordId) => state.wheel?.translated.includes(wordId) ?? false}
      />,
    )

  it('dims the non-suitcase cards while the wheel phase is on, and the suitcases never', () => {
    const html = render(wheelGame())
    expect(html).toContain('card-dimmed')
    const dimmed = html.split('card-dimmed').length - 1
    // Every non-suitcase card carries it; the solved suitcase cards do not.
    expect(dimmed).toBe(game.words.length - 2)
    expect(html.split('wrap-green').length - 1).toBe(2)
    const greenCards = html.slice(html.indexOf('wrap-green'), html.indexOf('wrap-bystander'))
    expect(greenCards).not.toContain('card-dimmed')
  })

  it('does not dim anything outside the wheel phase', () => {
    expect(render(wheelGame('playerGuessing'))).not.toContain('card-dimmed')
  })

  it('won-spin board (translateWheel): empty suitcases, full-strength cards, key visible', () => {
    const html = render(wheelGame('translateWheel'))
    // No dimming at all — the non-suitcase cards are full strength.
    expect(html).not.toContain('card-dimmed')
    // And the suitcases are EMPTY: no lid word renders in translateWheel.
    const lidWord = game.words[0].en[0]
    expect(html).not.toContain(`card-lid-word`)
    expect(html).not.toContain(lidWord)
    expect(html).not.toContain('card-wheel-packed')
    expect(html).not.toContain('card-packed-check')
    // The key is shown (translateWheel reads like playerClueInput), so the
    // solved suitcases still carry their mykey mark.
    expect(html).toContain('mykey-green')
  })

  it('challenge board (translateChallenge): lid words and dimming on', () => {
    const html = render(wheelGame('translateChallenge'))
    expect(html).toContain('card-lid-word')
    expect(html).toContain('card-dimmed')
    expect(html.match(/data-translation-pending="true"/g)).toHaveLength(2)
    expect(render(wheelGame('translateWheel'))).not.toContain('data-translation-pending')
  })

  it('uses the visible gloss, not the Danish answer, in a recalled suitcase name', () => {
    const state = wheelGame('translateChallenge')
    const answer = state.words.find((word) => word.wordId === state.wheel!.segments[0])!
    const html = render(state)
    const suitcase = [...html.matchAll(/<button class="[^"]*word-card[^"]*"[^>]*>[\s\S]*?<\/button>/g)]
      .map((match) => match[0])
      .find((markup) => markup.includes('card-suitcase-glyph'))!
    const accessibleName = /aria-label="([^"]+)"/.exec(suitcase)?.[1] ?? ''

    expect(suitcase).toContain(answer.en[0])
    expect(accessibleName).toContain(answer.en[0])
    expect(accessibleName).not.toContain(answer.da)
    expect(accessibleName).toContain('translation needed')
    expect(suitcase).not.toContain('card-info')
    expect(suitcase).toContain('disabled')
  })

  it('announces a translated suitcase by its gloss and packed state, without its Danish answer', () => {
    const state = wheelGame('translateChallenge')
    const answer = state.words.find((word) => word.wordId === state.wheel!.segments[0])!
    state.wheel = { ...state.wheel!, translated: [answer.wordId], filled: [1] }
    const html = render(state)
    expect(html.match(/data-translation-pending="true"/g)).toHaveLength(1)
    const suitcase = [...html.matchAll(/<button class="[^\"]*word-card[^\"]*"[^>]*>[\s\S]*?<\/button>/g)]
      .map((match) => match[0])
      .find((markup) => markup.includes('card-suitcase-glyph') && markup.includes(answer.en[0]))!
    const accessibleName = /aria-label="([^\"]+)"/.exec(suitcase)?.[1] ?? ''

    expect(suitcase).toContain('card-wheel-packed')
    expect(suitcase).toContain('card-packed-check')
    expect(accessibleName).toContain(answer.en[0])
    expect(accessibleName).toContain('translation entered')
    expect(accessibleName).not.toContain(answer.da)
  })

  it('adds the moving suitcase outline only during translateChallenge', () => {
    const challenge = render(wheelGame('translateChallenge'))
    expect(challenge.split('card-suitcase-motion-frames').length - 1).toBe(2)
    expect(challenge.match(/class="card-border-frame card-border-frame-\d"/g)).toHaveLength(6)
    expect(render(wheelGame('translateWheel'))).not.toContain('card-suitcase-motion-frames')
    expect(render(wheelGame('playerGuessing'))).not.toContain('card-suitcase-motion-frames')
  })

  it('keeps three distinct suitcase redraw paths in unpacked and packed challenge states', () => {
    const challenge = wheelGame()
    const suitcaseIds = game.words.slice(0, 3).map((word) => word.wordId)
    challenge.reveals[suitcaseIds[2]] = { kind: 'green' }
    challenge.wheel = { ...challenge.wheel!, segments: suitcaseIds }
    const packedChallenge: GameState = {
      ...challenge,
      wheel: { ...challenge.wheel!, translated: [suitcaseIds[0]], filled: [1] },
    }

    for (const [state, expectedPacked] of [[challenge, 0], [packedChallenge, 1]] as const) {
      const html = render(state)
      const suitcaseCards = [...html.matchAll(/<button class="([^"]*word-card[^"]*)"[^>]*>([\s\S]*?)<\/button>/g)]
        .filter(([, , body]) => body.includes('card-suitcase-glyph'))

      expect(suitcaseCards).toHaveLength(3)
      expect(suitcaseCards.filter(([className]) => className.includes('card-wheel-packed'))).toHaveLength(expectedPacked)
      for (const [, , body] of suitcaseCards) {
        const paths = [...body.matchAll(/<path class="card-border-frame card-border-frame-\d" d="([^"]+)"/g)]
          .map(([, path]) => path)
        expect(paths).toHaveLength(3)
        expect(new Set(paths).size).toBe(3)
      }
    }
  })

  it('keeps ordinary-card motion off during both wheel phases', () => {
    expect(render(wheelGame('translateChallenge'))).not.toContain('card-border-motion')
    expect(render(wheelGame('translateWheel'))).not.toContain('card-border-motion')
  })
})

describe('bystander strike-through shows only on the player’s guessing turn (owner, 2026-09-17)', () => {
  const neutralBoard = (phase: GameState['phase']): GameState => {
    const reveals = { ...game.reveals }
    reveals[game.words[0].wordId] = { kind: 'bystander', against: ['player'] }
    reveals[game.words[1].wordId] = { kind: 'bystander', against: ['ai'] }
    reveals[game.words[2].wordId] = { kind: 'bystander', against: ['player', 'ai'] }
    return {
      ...game,
      phase,
      reveals,
      clueHistory: [{
        by: 'ai',
        text: 'animals',
        number: 2,
        guesses: [{ wordId: game.words[0].wordId, result: 'bystander' }],
      }, {
        by: 'player',
        text: 'reise',
        number: 2,
        guesses: [{ wordId: game.words[1].wordId, result: 'bystander' }],
      }],
    }
  }
  const render = (state: GameState, canGuess: boolean) =>
    renderToStaticMarkup(
      <BoardGrid
        game={state}
        canGuess={canGuess}
        selectedWordId={null}
        onCardTap={() => undefined}
        onInfoTap={() => undefined}
        dictionaryLocked={false}
        englishFace={() => false}
      />,
    )

  it('strikes only the bystander the human actually selected', () => {
    const html = render(neutralBoard('playerGuessing'), true)
    // The first card was guessed under Casey's clue, so it is the human's
    // mistake. The second was guessed under the player's clue, so it is
    // Casey's mistake. The third has no guess history at all. `against` is
    // deliberately different on all three cards and must not affect this.
    expect(html.split('card-bystander-struck').length - 1).toBe(1)
    expect(html).not.toContain('card-bystander-player')
    expect(html).not.toContain('card-bystander-ai')
    expect(html).not.toContain('card-bystander-both')
    expect(html).not.toContain('card-still-live')
    expect(html).not.toContain('card-spent')
  })

  it('does not infer a human mistake from a directional reveal alone', () => {
    const state = neutralBoard('playerGuessing')
    state.clueHistory = [{
      by: 'player',
      text: 'reise',
      number: 2,
      guesses: [{ wordId: game.words[0].wordId, result: 'bystander' }],
    }]
    expect(render(state, true)).not.toContain('card-bystander-struck')
  })

  it('renders a neutral as a plain revealed card on a clue turn — and every other phase', () => {
    // The player's CLUE turn: the strike says nothing useful there.
    expect(render(neutralBoard('playerClueInput'), false)).not.toContain('card-bystander-struck')
    // Casey's guessing turn, the study board, the wheel challenge.
    expect(render(neutralBoard('aiGuessing'), false)).not.toContain('card-bystander-struck')
    expect(render(neutralBoard('aiClueInput'), false)).not.toContain('card-bystander-struck')
    expect(render(neutralBoard('translateChallenge'), false)).not.toContain('card-bystander-struck')
  })

  it('keeps the accessible ", neutral …" state text in every phase — only the paint is scoped', () => {
    const neutralDa = game.words[0].da
    const clueTurn = render(neutralBoard('playerClueInput'), false)
    expect(clueTurn).toContain(`${neutralDa}, neutral`)
    const guessTurn = render(neutralBoard('playerGuessing'), true)
    expect(guessTurn).toContain(`${neutralDa}, neutral`)
  })
})
