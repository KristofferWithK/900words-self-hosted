import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../../engine/types'
import { ClueInput } from './ClueInput'

const clueState = vi.hoisted(() => ({ nextClue: undefined as string | undefined }))
const dictionaryState = vi.hoisted(() => ({ calls: [] as unknown[][], answered: true }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const state = actual.useState(initial)
      if (clueState.nextClue !== undefined && initial === '') {
        const clue = clueState.nextClue
        clueState.nextClue = undefined
        return [clue, state[1]]
      }
      return state
    },
  }
})

vi.mock('../../stores/gameStore', () => ({
  useGame: (selector: (state: { boardCityIndex: number }) => unknown) => selector({ boardCityIndex: 0 }),
}))

vi.mock('./TranslateBox', async () => {
  const { createElement } = await import('react')
  return {
    useDictionary: (...args: unknown[]) => {
      dictionaryState.calls.push(args)
      return {
        field: createElement('input', { id: 'dictionary-word', className: 'translate-input', defaultValue: '' }),
        line: dictionaryState.answered ? createElement('span', { className: 'dict-answer' }, 'tid — time') : null,
      }
    },
  }
})

const game = {
  words: [
    { wordId: 'da:tid', da: 'tid', en: ['time'], pos: 'noun' as const },
    { wordId: 'da:hund', da: 'hund', en: ['dog'], pos: 'noun' as const },
    { wordId: 'da:hus', da: 'hus', en: ['house'], pos: 'noun' as const },
  ],
  reveals: {
    'da:tid': { kind: 'bystander' as const, against: ['ai' as const] },
    'da:hund': { kind: 'bystander' as const, against: ['ai' as const] },
    'da:hus': { kind: 'bystander' as const, against: ['ai' as const] },
  },
} as unknown as GameState

function renderWithClue(clue: string, props: { tutorialTeaching?: boolean } = {}): string {
  clueState.nextClue = clue
  return renderToStaticMarkup(React.createElement(ClueInput, {
    game,
    onSubmit: () => {},
    firstTimeHint: false,
    ...props,
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  dictionaryState.calls = []
  dictionaryState.answered = true
})

describe('clue composer rendering', () => {
  it('does not repeat a legal clue below its field and keeps the independent dictionary and send control', () => {
    const html = renderWithClue('restaurant')

    expect(html).not.toContain('clue-lookup')
    expect(html).not.toContain('«restaurant»')
    expect(html).toContain('id="clue-word"')
    expect(html).toContain('id="dictionary-word"')
    expect(html).toContain('class="dict-answer"')
    expect(html).toContain('tid — time')
    expect(html).toContain('class="composer-line"')
    expect(html).not.toMatch(/class="btn btn-primary"[^>]*disabled/)
    expect(dictionaryState.calls.at(-1)?.[0]).toBeUndefined()
  })

  it('keeps the illegal-clue warning and disables sending', () => {
    const html = renderWithClue('huset')

    expect(html).toContain('class="clue-error"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-describedby="clue-error"')
    expect(html).toMatch(/class="btn btn-primary"[^>]*disabled/)
  })

  it('gives the whole line to the dictionary answer once there is one, so the answer is never cut', () => {
    const html = renderWithClue('', { tutorialTeaching: true })

    expect(html).not.toContain('first-hint')
    expect(html).toContain('class="dict-answer"')
  })

  it('keeps the teaching line in the reserved status row when the clue is empty', () => {
    dictionaryState.answered = false
    const html = renderWithClue('', { tutorialTeaching: true })

    expect(html).toContain('class="first-hint dim"')
    expect(html).toContain('class="composer-line"')
    expect(html).not.toContain('clue-lookup')
    expect(html).toMatch(/class="btn btn-primary"[^>]*disabled/)
  })
})
