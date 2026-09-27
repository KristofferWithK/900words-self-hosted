import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGame } from '../../engine/game'
import { BOARD } from '../../engine/config'
import { WORDS } from '../../data/words'
import { UI } from '../../i18n'
import { useGame } from '../../stores/gameStore'
import { AiTurnPanel } from './AiTurnPanel'

const game = {
  ...createGame({
    config: BOARD,
    words: WORDS.slice(0, BOARD.rows * BOARD.cols).map((word) => ({
      wordId: word.id,
      da: word.da,
      en: word.en,
      pos: word.pos,
    })),
    seed: 7,
    firstGiver: 'player',
  }),
  phase: 'aiClueInput' as const,
}

/**
 * Offline Casey is slower, so while she thinks the dock says it is her
 * (owner, 2026-09-27) — in the same bubble, so the dock keeps its height.
 */
describe('Casey’s dock when offline Casey is playing', () => {
  beforeEach(() => {
    useGame.setState({
      aiBusy: true,
      aiGuessQueue: [],
      planForClueIndex: null,
      lastAiGuess: null,
      authoredBoardId: null,
    })
  })

  it('says offline Casey is thinking, and that it takes longer, in a round played offline', () => {
    const html = renderToStaticMarkup(<AiTurnPanel game={game} offlineCasey />)
    expect(html).toContain(UI.game.offlineCaseyIsThinking)
    expect(html).toContain('ai-bubble thinking offline')
    expect(html).not.toContain(UI.game.caseyIsThinking)
  })

  it('thinks as normal Casey in an online round', () => {
    const html = renderToStaticMarkup(<AiTurnPanel game={game} />)
    expect(html).toContain(UI.game.caseyIsThinking)
    expect(html).not.toContain(UI.game.offlineCaseyIsThinking)
  })

  it('keeps the same two dock regions either way', () => {
    const online = renderToStaticMarkup(<AiTurnPanel game={game} />)
    const offline = renderToStaticMarkup(<AiTurnPanel game={game} offlineCasey />)
    expect(offline).toContain(UI.game.offlineCaseyIsThinking)
    const regions = (html: string) => html.replace(/>[^<]*</g, '><').replace(/ offline/g, '')
    expect(regions(offline)).toBe(regions(online))
  })
})
