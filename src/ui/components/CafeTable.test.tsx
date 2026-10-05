import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import cafes from '../../data/city1-cafe-names.da.json'
import { cafeArrangement, DRAWINGS } from '../../cafe/cafeTable'
import { BOARD } from '../../engine/config'
import { createGame } from '../../engine/game'
import { WORDS } from '../../data/words'
import { UI } from '../../i18n'
import { useGame } from '../../stores/gameStore'
import { AiTurnPanel } from './AiTurnPanel'
import { CafeDrawing, CafeNameTag, CafeTable } from './CafeTable'
import { TurnTokens } from './TurnTokens'

// CW-08: the café puzzle's header, table and Casey (docs/roadmap/cafe-world.md section 5).
const solen = cafeArrangement(cafes.names[0]!)
const deal = () => createGame({
  config: BOARD,
  words: WORDS.slice(0, BOARD.rows * BOARD.cols).map((word) => ({ wordId: word.id, da: word.da, en: word.en, pos: word.pos })),
  seed: 7,
  firstGiver: 'player',
})

describe('the café puzzle header', () => {
  it('draws coffee cups for the turn dots: full for clues to give, empty for clues given', () => {
    const html = renderToStaticMarkup(<TurnTokens total={8} left={6} given={2} cups />)
    expect(html.match(/token-cup token-full/g)).toHaveLength(6)
    expect(html.match(/token-cup token-spent/g)).toHaveLength(2)
    expect(html).toContain(UI.game.cluesGivenCount(2, 8))
  })

  it('keeps the dots outside a café', () => {
    const html = renderToStaticMarkup(<TurnTokens total={8} left={6} given={2} />)
    expect(html).not.toContain('token-cup')
    expect(html.match(/class="token token-full"/g)).toHaveLength(6)
  })

  it('puts the name on a tag, in Danish, untranslated', () => {
    const html = renderToStaticMarkup(<CafeNameTag name="Café Solen" />)
    expect(html).toContain('class="cafe-name-tag" lang="da"')
    expect(html).toContain('>Café Solen<')
  })
})

describe('the café table', () => {
  it('lays all six items in its two regions, decorative and without a pointer target', () => {
    const html = renderToStaticMarkup(<CafeTable table={solen} />)
    expect(html).toContain('class="cafe-table" aria-hidden="true" data-cafe="cafe-solen"')
    expect(html.match(/class="cafe-item/g)).toHaveLength(6)
    expect(html).toContain('cafe-table-board')
    expect(html).toContain('cafe-table-bottom')
    for (const item of solen.items) {
      expect(html).toContain(`data-spot="${item.spot}"`)
      expect(html).toContain(`--x:${item.x}%;--y:${item.y}%;--size:${item.size}`)
    }
    expect(html).not.toMatch(/<button|tabindex/)
  })

  it('takes nothing but the café: the same markup whatever the round is doing', () => {
    // The table is a memoised layer with one prop, so no game state can reach it.
    expect(renderToStaticMarkup(<CafeTable table={solen} />)).toBe(renderToStaticMarkup(<CafeTable table={cafeArrangement(cafes.names[0]!)} />))
  })

  it('has a drawing for every drawing id', () => {
    for (const drawing of DRAWINGS) {
      const html = renderToStaticMarkup(<CafeDrawing drawing={drawing} />)
      expect(html).toMatch(/<(path|circle|ellipse|rect)\b/)
      expect(html).toContain('viewBox="0 0 48 48"')
    }
  })
})

describe('Casey in a café', () => {
  beforeEach(() => {
    useGame.setState({ aiBusy: true, aiGuessQueue: [], planForClueIndex: null, lastAiGuess: null, authoredBoardId: null })
  })

  it('is large while she thinks; the dock draws no table of its own', () => {
    const html = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(), phase: 'aiClueInput' }} cafe />)
    expect(html).toContain(UI.game.caseyIsThinking)
    expect(html).toContain('cluey-mini cluey-thinking-large')
    expect(html).not.toContain('cafe-table')
  })

  it('is the ordinary dock outside a café', () => {
    const html = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(), phase: 'aiClueInput' }} />)
    expect(html).not.toContain('cluey-thinking-large')
    expect(html).not.toContain('cafe-table')
  })

  it('is her ordinary size again once she is guessing', () => {
    useGame.setState({ aiBusy: false, planForClueIndex: 0, aiGuessQueue: [{ wordId: deal().words[0]!.wordId, confidence: 0.9, reasoning: 'A reason.' }] as never })
    const html = renderToStaticMarkup(<AiTurnPanel game={{ ...deal(), phase: 'aiGuessing' }} cafe />)
    expect(html).not.toContain('cafe-table')
    expect(html).not.toContain('cluey-thinking-large')
  })
})
