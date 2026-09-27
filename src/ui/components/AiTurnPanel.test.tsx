import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGame } from '../../engine/game'
import { BOARD, TUTORIAL_CONFIG } from '../../engine/config'
import { WORDS } from '../../data/words'
import { UI } from '../../i18n'
import { useGame } from '../../stores/gameStore'
import { AiTurnPanel } from './AiTurnPanel'

const deal = (config: typeof BOARD) => createGame({
  config,
  words: WORDS.slice(0, config.rows * config.cols).map((word) => ({
    wordId: word.id,
    da: word.da,
    en: word.en,
    pos: word.pos,
  })),
  seed: 7,
  firstGiver: 'player',
})

describe('Casey\'s dock in the practice round', () => {
  beforeEach(() => {
    useGame.setState({ aiBusy: true, aiGuessQueue: [], planForClueIndex: null, lastAiGuess: null, authoredBoardId: null })
  })

  it('thinks with her face and the animated dots, exactly like a normal round', () => {
    const html = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(TUTORIAL_CONFIG), phase: 'aiClueInput' }} />)
    expect(html).toContain(UI.game.caseyIsThinking)
    expect(html).toContain('cluey-svg')
    expect(html).toContain('class="dots"')
    expect(html).not.toContain('tutorial-turn-panel')
  })

  it('renders the same dock markup for the practice board and a full board', () => {
    // The dock is a function of the turn, not of the round's mode or size: the
    // only input that could tell them apart is gone.
    const practice = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(TUTORIAL_CONFIG), phase: 'aiClueInput' }} />)
    const full = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(BOARD), phase: 'aiClueInput' }} />)
    expect(practice).toBe(full)
  })
})
