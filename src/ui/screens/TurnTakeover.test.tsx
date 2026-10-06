import { readdirSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { isTurnHandover, mustRetireRoundMode, takeoverSideOf, takeoverPhaseOf, showTranslationDock, showTurnTakeover } from './GameScreen'
import { TurnTakeover, takeoverLayers } from '../components/TurnTakeover'

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

// Owner, build 123: during the Your turn / Casey's turn card the bottom must be
// solid white, with no café table art showing through the card's fades.
describe('the takeover keeps the bottom opaque for its whole duration', () => {
  const stylesDir = new URL('../../styles/', import.meta.url)
  const sheets = readdirSync(stylesDir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(new URL(name, stylesDir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
  /** Every declaration block, in every sheet, whose selector list names the class. */
  const blocksFor = (cls: string) => {
    const names = new RegExp(`\\.${cls}(?![\\w-])`)
    return sheets.flatMap((css) =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1]!.split(',').some((part) => names.test(part)))
        .map((match) => match[2]!),
    )
  }

  it('renders a backdrop beside the card, not inside it, for every side', () => {
    for (const side of ['player', 'ai', 'translation'] as const) {
      const html = renderToStaticMarkup(<TurnTakeover turn={1} side={side} />)
      // A sibling that comes first: inside the card it would fade with it.
      expect(html).toMatch(/^<div class="turn-takeover-backdrop" aria-hidden="true"><\/div><div class="turn-takeover /)
    }
  })

  it('keeps the same backdrop through the in-beat, the hold and the out-beat', () => {
    expect(takeoverLayers('in').backdrop).toBe('turn-takeover-backdrop')
    expect(takeoverLayers('out').backdrop).toBe('turn-takeover-backdrop')
    expect(takeoverLayers('out').card).toContain('turn-takeover-out')
    expect(takeoverLayers('in').card).not.toContain('turn-takeover-out')
  })

  it('styles it as the page background over the table and under the dock, never animated or faded', () => {
    const blocks = blocksFor('turn-takeover-backdrop')
    expect(blocks.length).toBeGreaterThan(0)
    const all = blocks.join(';')
    expect(all).toMatch(/background:\s*var\(--bg\)/)
    expect(all).toMatch(/z-index:\s*-1/)
    // The card's rectangle and the screen padding above it, from the dock's top rule down.
    // And on down through the home indicator's strip to the phone's edge.
    expect(all).toMatch(/height:\s*calc\(var\(--dock-h\) \+ 12px \+ env\(safe-area-inset-bottom\)\)/)
    expect(all).toMatch(/bottom:\s*calc\(-1 \* env\(safe-area-inset-bottom\)\)/)
    for (const property of ['animation', 'transition', 'opacity', 'visibility', 'display']) {
      expect(all, property).not.toMatch(new RegExp(`(^|[;\\s])${property}(-[a-z-]+)?\\s*:`))
    }
  })
})
