import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOARD } from '../../engine/config'
import { createGame } from '../../engine/game'
import { WORDS } from '../../data/words'
import type { GameState } from '../../engine/types'
import { TranslateChallengeBar } from './TranslateChallengeBar'
import { useGame } from '../../stores/gameStore'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'

// Under vitest (node environment) the hook cannot run: React's hook dispatcher
// is empty outside a renderer. RoundSummary.test.tsx established the fix — mock
// the store as a plain selector over the live getState(), so the component's
// `useGame((s) => …)` reads still resolve in renderToStaticMarkup.
vi.mock('../../stores/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../stores/gameStore')>()
  return { ...actual, useGame: Object.assign((selector: (state: ReturnType<typeof actual.useGame.getState>) => unknown) => selector(actual.useGame.getState()), actual.useGame) }
})

/**
 * The board the docks render against, built the way BoardGrid.test builds
 * its: the shipped words, a fixed seed. The wheel state is planted rather
 * than played to, because these tests are about what the docks RENDER.
 */
const base = createGame({
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

/** A challenge mid-flight: three solved suitcases, one translated. */
const challengeGame = (): GameState => {
  const solved = base.words.slice(0, 3).map((w) => w.wordId)
  return {
    ...base,
    phase: 'translateChallenge',
    turnsLeft: 0,
    wheel: {
      segments: solved,
      translated: [solved[0]!],
      filled: [2],
      attempts: 2,
      landed: null,
      result: null,
      spent: null,
    },
  }
}

beforeEach(() => {
  // The docks read selectedWordId from the store; a clean slate per test.
  useGame.setState({ selectedWordId: null })
})

describe('the translate-challenge dock (free-type grading)', () => {
  it('carries exactly ONE line — the lede — and no title, prompt or count', () => {
    const html = renderToStaticMarkup(<TranslateChallengeBar game={challengeGame()} />)
    expect(html).toContain('The wheel decides the round')
    // The removed surfaces are gone: no dock title, no per-word prompt, no
    // packed count, no wheel-spun prompt.
    expect(html).not.toContain('Pack the suitcases')
    expect(html).not.toContain('Translate:')
    expect(html).not.toContain('of 3 packed')
    expect(html).not.toContain('Every suitcase packed!')
  })

  it('shows the field and the confirm tick, with the wheel beside them', () => {
    const html = renderToStaticMarkup(<TranslateChallengeBar game={challengeGame()} />)
    expect(html).toContain('wheel-input')
    expect(html).toContain('wheel-confirm')
    // The wheel is ALWAYS on the dock — no all-packed gate.
    expect(html).toContain('wheel-disc')
    // The owner's amendment: no word labels on segments.
    for (const id of challengeGame().wheel!.segments) {
      const word = base.words.find((w) => w.wordId === id)!
      expect(html).not.toContain(`>${word.da}<`)
    }
  })

  it('names every remaining suitcase by its visible gloss without exposing the Danish answer', () => {
    const game = challengeGame()
    const remaining = game.wheel!.segments
      .filter((id) => !game.wheel!.translated.includes(id))
      .map((id) => game.words.find((word) => word.wordId === id)!)
    const language = UI.onboarding.courseText(ACTIVE.code).languageName
    const html = renderToStaticMarkup(<TranslateChallengeBar game={game} />)
    const accessibleName = /<input[^>]*aria-label="([^"]+)"/.exec(html)?.[1] ?? ''
    const placeholder = /<input[^>]*placeholder="([^"]+)"/.exec(html)?.[1] ?? ''

    expect(placeholder).toBe(UI.game.wheelAnswerPlaceholder(language))
    expect(accessibleName).toBe(
      UI.game.wheelAnswerAria(language, remaining.map((word) => word.en[0])),
    )
    expect(accessibleName).toContain(remaining[0]!.en[0])
    expect(accessibleName).toContain(remaining[1]!.en[0])
    for (const word of remaining) expect(accessibleName).not.toContain(word.da)
  })

  it('arms the confirm tick on a non-empty field alone — no selection needed', () => {
    // Free-type grading (owner, 2026-09-17): submit grades the typed answer
    // against every untranslated wheel word, so the tick's disabled state
    // reads only the text. The markup shows the enabled button with no
    // `disabled` attribute the moment the field would be non-empty; the
    // static render has an empty field, so the tick is disabled here.
    const html = renderToStaticMarkup(<TranslateChallengeBar game={challengeGame()} />)
    expect(html).toMatch(/wheel-confirm[^>]*disabled/)
    // No selection machinery anywhere in the dock's markup.
    expect(html).not.toContain('card-suitcase-selected')
  })

  it('carries the free-retry promise line as the standing spacer', () => {
    const html = renderToStaticMarkup(<TranslateChallengeBar game={challengeGame()} />)
    expect(html).toContain('packing-note dim') // the standing spacer, height kept
  })

  it('keeps the wheel after the phase moves, still spinnable, verdict line only once decided', () => {
    const game = challengeGame()
    const segments = game.wheel!.segments
    const done: GameState = {
      ...game,
      phase: 'translateWheel',
      wheel: { ...game.wheel!, translated: [...segments], filled: [0, 1, 2] },
    }
    const html = renderToStaticMarkup(<TranslateChallengeBar game={done} />)
    expect(html).toContain('wheel-disc')
    expect(html).toContain('Spin the wheel')
    // One filled path per segment.
    expect((html.match(/fill="var\(--green/g) ?? []).length).toBe(segments.length)
    // No verdict line while nothing has spun.
    expect(html).not.toContain('You won a clue!')
  })

  it('shows the miss verdict line after a lost spin', () => {
    const game = challengeGame()
    const done: GameState = {
      ...game,
      phase: 'finished',
      wheel: { ...game.wheel!, landed: 1, result: 'miss' },
    }
    const html = renderToStaticMarkup(<TranslateChallengeBar game={done} />)
    expect(html).toContain('The wheel landed on an unpacked suitcase.')
  })

  it('shows the win verdict line after a spin that landed green — the ending, not a chooser', () => {
    // The ending change (owner, 2026-09-18): a won spin is the round's END,
    // rendered by this same dock's verdict line — the old chooser (two doors,
    // a token to spend) no longer exists anywhere in the UI to render.
    const game = challengeGame()
    const done: GameState = {
      ...game,
      phase: 'finished',
      wheel: { ...game.wheel!, landed: 2, result: 'win' },
    }
    const html = renderToStaticMarkup(<TranslateChallengeBar game={done} />)
    expect(html).toContain('Green! The round is won.')
  })
})
