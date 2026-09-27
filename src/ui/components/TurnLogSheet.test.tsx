import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BOARD } from '../../engine/config'
import { applyEvent, createGame } from '../../engine/game'
import type { BoardWord } from '../../engine/types'
import { UI } from '../../i18n'
import { danish } from '../../lang/da'
import { TurnLogSheet } from './TurnLogSheet'

const words = (): BoardWord[] =>
  Array.from({ length: BOARD.totalWords }, (_, i) => ({
    wordId: `w${i}`,
    da: `dansk${i}`,
    en: [`gloss${i}`],
    pos: 'noun',
  }))

describe('TurnLogSheet', () => {
  it('renders real turns and flags inside the sheet, not an empty shell', () => {
    const board = words()
    const started = createGame({ config: BOARD, words: board, seed: 7, firstGiver: 'player' })
    const clued = applyEvent(
      started,
      { type: 'SUBMIT_CLUE', by: 'player', text: 'huskeliste', number: 1 },
      danish,
    )
    const game = applyEvent(
      clued,
      {
        type: 'GUESS',
        wordId: board[0]!.wordId,
        reasoning: 'It was the closest word on the board.',
        confidence: 0.8,
      },
      danish,
    )

    expect(game.clueHistory).toHaveLength(1)
    const html = renderToStaticMarkup(<TurnLogSheet game={game} onClose={() => {}} />)

    expect(html).toContain('class="sheet-backdrop turn-log-backdrop"')
    expect(html).toContain('class="sheet turn-log-sheet"')
    // React escapes an apostrophe on the way into the markup, so the heading is
    // compared in its escaped form rather than by writing the English out again.
    expect(html).toContain(UI.game.caseysCalls.replace(/'/g, '&#x27;'))
    expect(html).toContain('dansk0')
    expect(html).toContain('It was the closest word on the board.')
    expect(html).toContain('class="flag-btn')
    expect(html).not.toContain('log-body')
    expect((html.match(/class="turn-log/g) ?? []).length).toBe(1)
  })
})
