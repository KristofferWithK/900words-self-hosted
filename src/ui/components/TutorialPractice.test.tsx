import { describe, expect, it } from 'vitest'
import { TUTORIAL_FINISH_LINE, TutorialFinish, tutorialAwardCopy, tutorialFinishCopy, tutorialFinishCtaCopy, tutorialOpeningGuess } from './TutorialPractice'
import { UI } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'
import { renderToStaticMarkup } from 'react-dom/server'

const finishedGame = (result: 'won' | 'lost') => ({ outcome: { result, reason: result === 'won' ? 'wheel-win' : 'wheel-miss' }, words: [], reveals: {}, clueHistory: [] } as never)

describe('tutorial post-match copy', () => {
  it('pins Casey’s finish speech for either completed practice outcome', () => {
    expect(tutorialFinishCopy('won')).toBe(UI.onboarding.practiceWon)
    expect(tutorialFinishCopy('lost')).toBe(UI.onboarding.practiceLost)
    expect(TUTORIAL_FINISH_LINE).toContain('does not earn postcards')
    expect(TUTORIAL_FINISH_LINE).toMatch(/replay a completed board/i)
  })

  it('renders each durable practice award outcome without minting copy', () => {
    expect(tutorialAwardCopy('new')).toBe(RECEIPT_UI.newPostcards(1))
    expect(tutorialAwardCopy('already-held')).toBe(RECEIPT_UI.alreadyEarned(RECEIPT_UI.newPostcards(1)))
    expect(tutorialAwardCopy('not-eligible')).toBeNull()
  })

  it.each([
    ['new', RECEIPT_UI.newPostcards(1)],
    ['already-held', RECEIPT_UI.alreadyEarned(RECEIPT_UI.newPostcards(1))],
  ] as const)('renders the settled %s award state in TutorialFinish', (status, expected) => {
    const html = renderToStaticMarkup(<TutorialFinish game={finishedGame('won')} awardStatus={status} />)
    expect(html).toContain('data-tutorial-award="' + status + '"')
    expect(html).toContain(expected)
  })

  it('renders a truthful practice miss without an award claim', () => {
    const html = renderToStaticMarkup(<TutorialFinish game={finishedGame('lost')} awardStatus="not-eligible" />)
    expect(html).toContain('data-tutorial-award="not-eligible"')
    expect(html).toContain(UI.onboarding.practiceLost)
    expect(html).not.toContain(RECEIPT_UI.newPostcards(1))
  })

  it.each(['primary', 'replay'] as const)('offers a return label when a %s slot is parked', slot => {
    expect(tutorialFinishCtaCopy(slot)).toBe(UI.onboarding.returnToParkedGame)
  })

  it('introduces the first full board after fresh practice', () => {
    expect(tutorialFinishCtaCopy(null)).toBe(UI.onboarding.playFullRound)
  })

  it('knows the opening Casey turn of the practice round, and only that', () => {
    expect(tutorialOpeningGuess({ tutorial: true, phase: 'aiClueInput', clueGivers: [] })).toBe(true)
    expect(tutorialOpeningGuess({ tutorial: true, phase: 'playerGuessing', clueGivers: ['ai'] })).toBe(true)
    expect(tutorialOpeningGuess({ tutorial: true, phase: 'playerClueInput', clueGivers: ['ai'] })).toBe(false)
    expect(tutorialOpeningGuess({ tutorial: true, phase: 'aiClueInput', clueGivers: ['ai', 'player'] })).toBe(false)
    expect(tutorialOpeningGuess({ tutorial: false, phase: 'playerGuessing', clueGivers: ['ai'] })).toBe(false)
  })
})
