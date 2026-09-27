import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { isTurnHandover, mustRetireRoundMode, takeoverSideOf, takeoverPhaseOf, showTranslationDock, showTurnTakeover } from './GameScreen'
import { TurnTakeover } from '../components/TurnTakeover'

// The takeover borrows catalogue lines that already existed (no new copy, no
// catalogue change), so the render test reads them from the same source the
// component does.

describe('takeoverSideOf', () => {
  it('maps each play phase to the side whose turn it is', () => {
    expect(takeoverSideOf('playerClueInput')).toBe('player')
    expect(takeoverSideOf('aiGuessing')).toBe('player')
    expect(takeoverSideOf('aiClueInput')).toBe('ai')
    expect(takeoverSideOf('playerGuessing')).toBe('ai')
  })

  it('gives no giver to sudden death and the round over', () => {
    expect(takeoverSideOf('suddenDeath')).toBeNull()
    expect(takeoverSideOf('finished')).toBeNull()
  })
})

describe('isTurnHandover', () => {
  it('fires when the giver flips between two phases that have one', () => {
    expect(isTurnHandover('aiGuessing', 'aiClueInput')).toBe(true)
    expect(isTurnHandover('playerGuessing', 'playerClueInput')).toBe(true)
  })

  it('does not fire on the same giver crossing a phase', () => {
    // SUBMIT_CLUE: the player's clue turns over to Casey guessing under it —
    // the giver (and the key the guesses are judged against) is still theirs.
    expect(isTurnHandover('playerClueInput', 'aiGuessing')).toBe(false)
    expect(isTurnHandover('aiClueInput', 'playerGuessing')).toBe(false)
  })

  it('does not fire on sudden death opening or the round ending', () => {
    expect(isTurnHandover('playerGuessing', 'suddenDeath')).toBe(false)
    expect(isTurnHandover('aiGuessing', 'suddenDeath')).toBe(false)
    expect(isTurnHandover('playerGuessing', 'finished')).toBe(false)
  })

  it('does not fire on the round starting', () => {
    // The engine's initial phase has a giver, but there was no previous turn
    // to take over from: the screen starts with no giver at all.
    expect(isTurnHandover('finished', 'aiClueInput')).toBe(false)
  })
})

describe('retired wrap-up guard', () => {
  it('fails closed instead of rendering a directly injected wrap-up as ordinary play', () => {
    expect(mustRetireRoundMode('wrapup')).toBe(true)
    expect(mustRetireRoundMode('normal')).toBe(false)
    expect(mustRetireRoundMode('tutorial')).toBe(false)
  })
})

describe('TurnTakeover', () => {
  it('replaces either clue giver with Translation time at both translation phases', () => {
    for (const phase of ['translateChallenge', 'translateWheel'] as const) {
      expect(takeoverPhaseOf(phase)).toBe('translation')
      expect(takeoverPhaseOf(phase)).not.toBe(takeoverPhaseOf('aiGuessing'))
      expect(takeoverPhaseOf(phase)).not.toBe(takeoverPhaseOf('playerGuessing'))
    }
    const html = renderToStaticMarkup(<TurnTakeover turn={3} side="translation" />)
    expect(html).toContain(UI.game.phaseTranslateChallenge)
    expect(html).not.toContain(UI.game.phaseGiveClue)
    expect(html).not.toContain(UI.game.guidanceLastChanceTitle)
  })

  it('keeps the same wheel dock through accepted spin and removes it only after its hold', () => {
    expect(showTranslationDock('translateChallenge', false)).toBe(true)
    expect(showTranslationDock('translateWheel', false)).toBe(true)
    expect(showTranslationDock('finished', true)).toBe(true)
    expect(showTranslationDock('finished', false)).toBe(false)
    expect(showTranslationDock('aiGuessing', false)).toBe(false)
  })

  it('shows every turn handoff by one rule, the practice round included', () => {
    // No mode input at all: the practice round cannot be special-cased again
    // without changing this signature.
    expect(showTurnTakeover({ phase: 'playerClueInput', side: 'player', packing: false, guidance: false })).toBe(true)
    expect(showTurnTakeover({ phase: 'aiClueInput', side: 'ai', packing: false, guidance: false })).toBe(true)
    expect(showTurnTakeover({ phase: 'translateChallenge', side: 'translation', packing: false, guidance: false })).toBe(true)
    expect(showTurnTakeover({ phase: 'translateWheel', side: 'translation', packing: false, guidance: false })).toBe(true)
    // A card for a giver the phase no longer has never shows.
    expect(showTurnTakeover({ phase: 'playerClueInput', side: 'ai', packing: false, guidance: false })).toBe(false)
    // Packing and an open guidance panel still hold every card back.
    expect(showTurnTakeover({ phase: 'translateChallenge', side: 'translation', packing: true, guidance: false })).toBe(false)
    expect(showTurnTakeover({ phase: 'translateChallenge', side: 'translation', packing: false, guidance: true })).toBe(false)
  })
  it('renders the player line for a player turn, once, big and green', () => {
    const html = renderToStaticMarkup(<TurnTakeover turn={1} side="player" />)
    expect(html).toContain('turn-takeover')
    expect(html).toContain(UI.game.phaseGiveClue)
    expect(html.match(/turn-takeover-line/g)).toHaveLength(1)
    expect(html).toContain('aria-hidden')
  })

  it('renders the Casey line for her turn', () => {
    const html = renderToStaticMarkup(<TurnTakeover turn={2} side="ai" />)
    expect(html).toContain(UI.game.phaseCaseyClue)
  })
})
