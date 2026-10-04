import { CITY1_CATALOG, selectQueue } from '../../review/city1'
import { useGame } from '../../stores/gameStore'
import { useSrs } from '../../stores/srsStore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WORDS } from '../../data/words'
import { UI } from '../../i18n'
import { RECEIPT_UI } from '../../i18n/receipt'
import { EMPTY_LEARNING, MATRIX_FIXTURES, attemptFixture, settlementFixture } from '../../progression/fixtures'
import { emptySettlementLedger, prepareSettlement } from '../../progression/settlement'
import { boardNumber, entryForLessonOffer, finishPlace, ReceiptGuideOverlay, RoundSummary } from './RoundSummary'
import { cafeNameForBoard } from '../../cafe/cafeName'
import { requiredSetForCourse } from '../../session/courseRuntime'
import type { CompletionReceipt } from '../../progression/types'
import { CITY1_BOARD_CYCLE } from '../../data/city1BoardCycle'
import { CITY1_REQUIRED_BOARD_IDS } from '../../data/city1RequiredBoardManifest'

vi.mock('../../stores/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../stores/gameStore')>()
  return { ...actual, useGame: Object.assign((selector: (state: ReturnType<typeof actual.useGame.getState>) => unknown) => selector(actual.useGame.getState()), actual.useGame) }
})

vi.mock('../../stores/srsStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../stores/srsStore')>()
  return { ...actual, useSrs: Object.assign((selector: (state: ReturnType<typeof actual.useSrs.getState>) => unknown) => selector(actual.useSrs.getState()), actual.useSrs) }
})

vi.mock('./ReminderPrompt', () => ({ ReminderPrompt: () => <div className="reminder-prompt-probe" /> }))

const finished = {
  words: [],
  reveals: {},
  clueHistory: [],
  outcome: { result: 'lost', reason: 'timeout' },
} as never

const won = {
  words: [],
  reveals: {},
  clueHistory: [],
  outcome: { result: 'won', reason: 'all-greens' },
} as never

/** A finished round with one found green, so a later city has a sentence to show. */
const greenWord = WORDS[0]!
const wonWithGreen = {
  words: [{ wordId: greenWord.id, da: greenWord.da, en: greenWord.en, pos: greenWord.pos, article: greenWord.article, gender: greenWord.gender }],
  reveals: { [greenWord.id]: { kind: 'green' } },
  clueHistory: [],
  outcome: { result: 'won', reason: 'all-greens' },
} as never

const dialogOf = (html: string) => html.slice(html.indexOf('<dialog'), html.indexOf('</dialog>'))

function receiptForHeader(index: number) {
  const game = MATRIX_FIXTURES[index]!.game
  const attempt = attemptFixture(game, { attemptId: `finish-header-${index}` })
  const result = prepareSettlement(emptySettlementLedger(), settlementFixture(game, {
    attempt,
    learning: { ...EMPTY_LEARNING, newlyDiscovered: ['a', 'b'], newlyCollected: ['a'] },
  }))
  if (result.status === 'blocked') throw new Error(result.reason)
  return result.receipt
}

describe('RoundSummary receipt result successors', () => {
  afterEach(() => { useGame.setState({ boardCityIndex: 0, mode: 'normal', sentenceReview: null, completionReceipt: null, earnedPostcard: false }); useSrs.setState({ translationPostcards: 0 }); vi.restoreAllMocks() })
  it('does not expose a post-wrap offer from a retired mode', () => {
    const row = CITY1_CATALOG.review[0]!
    useGame.setState({ mode: 'wrapup', boardCityIndex: 0, sentenceReview: {
      version: 1, roundId: 'locked-modal', cursor: 0, dismissed: false,
      queue: selectQueue([{ by: 'player', text: 'Here', number: 1,
        guesses: [{ wordId: row.wordId, result: 'green' }] }], CITY1_CATALOG.review),
    } })
    const html = renderToStaticMarkup(<RoundSummary game={finished} />)
    const modal = dialogOf(html)
    expect(modal).toContain('city1-review-dialog')
    expect(modal).toContain('city1-review-dialog')
    expect(modal).not.toContain('summary-wrap-actions')
    expect(modal).not.toContain(UI.game.postWrapHeading)
  })

  /**
   * The owner's follow-up of 2026-09-11: the reader IS the finish screen.
   * There is no band summary underneath it any more, so a review queue that
   * is empty or dismissed still renders the same surface — outcome, note,
   * transcript link, exits — with a line where the sentence would be.
   */
  it('is the one finish screen, with or without a sentence to review', () => {
    const row = CITY1_CATALOG.review[0]!
    const queue = selectQueue([{ by: 'player', text: 'Here', number: 1,
      guesses: [{ wordId: row.wordId, result: 'green' }] }], CITY1_CATALOG.review)
    useGame.setState({ boardCityIndex: 0, mode: 'normal',
      sentenceReview: { version: 1, roundId: 'replace', cursor: 0, dismissed: false, queue } })
    const reviewing = renderToStaticMarkup(<RoundSummary game={finished} />)
    const reader = dialogOf(reviewing)
    expect(reader).toContain('city1-review-dialog')
    expect(reader).not.toContain('city1-review-clue')
    expect(reader).toContain('city1-review-sentence')
    // The outcome is said once, in the surface's own header, the owner's way.
    expect(reader).toContain('city1-review-outcome')
    expect(reader).toContain(UI.game.outcomeLostTitle)
    expect(reader).toContain(UI.game.outcomeGivenUpSub)
    expect(reviewing).not.toContain('You won!')
    expect(reviewing).not.toContain('Skip review')
    for (const kept of ['outcome-banner', 'stat-discovered', 'log-toggle', UI.game.playNextGame, `>${UI.game.home}</button>`]) {
      expect(reader).toContain(kept)
    }

    useGame.setState({ sentenceReview: { version: 1, roundId: 'replace', cursor: 0, dismissed: true, queue } })
    const dismissed = renderToStaticMarkup(<RoundSummary game={finished} />)
    const still = dialogOf(dismissed)
    expect(still).toContain('city1-review-dialog')
    expect(still).not.toContain('city1-review-clue')
    expect(still).toContain(UI.game.reviewNothingThisRound)
    for (const kept of ['outcome-banner', UI.game.outcomeLostTitle, 'log-toggle', UI.game.playNextGame, `>${UI.game.home}</button>`]) {
      expect(still).toContain(kept)
    }
    // Nothing of the round's end is rendered outside the surface.
    expect(dismissed.slice(0, dismissed.indexOf('<dialog'))).not.toContain('outcome-banner')
    expect(dismissed.slice(dismissed.indexOf('</dialog>'))).not.toContain('summary-actions')
  })

  it('uses receipt-owned win headlines and places rewards and totals before actual word counts', () => {
    for (const [index, headline] of [
      [1, RECEIPT_UI.goodGame],
      [4, RECEIPT_UI.greatGame],
      [5, RECEIPT_UI.perfectGame],
      [0, RECEIPT_UI.participationTrophy],
    ] as const) {
      const receipt = receiptForHeader(index)
      useGame.setState({ completionReceipt: receipt })
      const surface = dialogOf(renderToStaticMarkup(<RoundSummary game={finished} />))
      const header = surface.slice(surface.indexOf('city1-review-context'), surface.indexOf('city1-review-scroll'))
      expect(header).toContain(`class="city1-review-outcome">${headline}</h2>`)
      expect(header).toContain('receipt-result')
      expect(header.indexOf('receipt-result')).toBeLessThan(header.indexOf('outcome-stats'))
      expect(header.indexOf('outcome-stats')).toBeLessThan(header.indexOf('stat-discovered'))
      expect(header).toContain(`class="stat-n">2</span>`)
      expect(header).toContain(`class="stat-n">1</span>`)
      expect(receipt.attemptTier).toBe(MATRIX_FIXTURES[index]!.tier)
      if (index === 0) expect(receipt).toMatchObject({ completedLoss: true, newBest: null, rewards: { postcards: 0 } })
    }
  })

  it('uses the durable receipt and current resolvable sentence, pausing optional prompts until the lesson closes', () => {
    const receipt = {
      ...receiptForHeader(4),
      lessons: {
        courseId: 'da',
        curriculum: { before: null, after: { itemStates: { 'sonderborg-notice': 'offered' } } },
        survival: { before: null, after: { exchanges: { 'sonderborg-situation-1': { unlockedAt: 1, replayedAt: [] } } } },
      } as never,
    }
    const reviewRows = [CITY1_CATALOG.review[0]!, CITY1_CATALOG.review[1]!]
    const queue = selectQueue(reviewRows.map(row => ({ by: 'player', text: 'Here', number: 1,
      guesses: [{ wordId: row.wordId, result: 'green' }] })), CITY1_CATALOG.review)
    useGame.setState({ completionReceipt: receipt, sentenceReview: {
      version: 1, roundId: 'tour-live-row', cursor: 0, dismissed: false, queue,
    } })
    const guided = renderToStaticMarkup(<RoundSummary game={finished} showResultLesson />)
    expect(guided).toContain('data-tour-kind="result"')
    expect(guided).toContain('data-tour-anchor=".receipt-reward-list"')
    expect(guided).not.toContain('receipt-lesson-offer')
    expect(guided).not.toContain('reminder-prompt-probe')

    useGame.setState({ sentenceReview: {
      version: 1, roundId: 'tour-unresolvable-row', cursor: 0, dismissed: false,
      queue: [{ ...queue[0]!, sentenceId: 'missing-from-review-catalog' }, queue[1]!],
    } })
    const unavailable = renderToStaticMarkup(<RoundSummary game={finished} showResultLesson />)
    expect(unavailable).toContain('data-tour-anchor=".receipt-reward-list"')

    const ordinary = renderToStaticMarkup(<RoundSummary game={finished} />)
    expect(ordinary).not.toContain('data-tour-kind="result"')
    expect(ordinary).toContain('receipt-lesson-offer')
    expect(ordinary).toContain('reminder-prompt-probe')
  })

  it('replaces the retired wrap-up journey with the ordinary receipt reader', () => {
    const row = CITY1_CATALOG.review[0]!
    useGame.setState({ mode: 'wrapup', boardCityIndex: 0, sentenceReview: {
      version: 1, roundId: 'legacy-wrapup', cursor: 0, dismissed: false,
      queue: selectQueue([{ by: 'player', text: 'Here', number: 1,
        guesses: [{ wordId: row.wordId, result: 'green' }] }], CITY1_CATALOG.review),
    } })
    const surface = dialogOf(renderToStaticMarkup(<RoundSummary game={finished} />))
    expect(surface).toContain('city1-review-sentence')
    expect(surface).toContain(UI.game.reviewTitle)
    expect(surface).toContain('log-toggle')
    expect(surface).not.toContain('wrapup-journey')
    expect(surface).not.toContain('summary-wrap-actions')
    expect(surface).not.toContain(UI.game.wrapJourneyHeading)
  })

  it('congratulates a won round under confetti without guessing a reward from transient state', () => {
    useGame.setState({ boardCityIndex: 0, mode: 'normal', sentenceReview: null, earnedPostcard: true })
    useSrs.setState({ translationPostcards: 1 })
    const html = renderToStaticMarkup(<RoundSummary game={won} />)
    const surface = dialogOf(html)
    expect(surface).toContain(UI.game.outcomeWonTitle)
    expect(surface).toContain('class="confetti"')
    expect(surface).toContain('mood-happy')
    // C1-11 only presents settled receipt facts. An old transient marker is
    // not receipt evidence and must never invent a reward on the finish UI.
    expect(surface).not.toContain('outcome-reward')
    expect(surface).not.toContain(UI.game.outcomeWonSub)
    expect(surface).not.toContain('Round given up')
    expect(html).not.toContain('🎉')
  })

  it('fails closed for a legacy normal terminal cache without a completion receipt', () => {
    useGame.setState({ boardCityIndex: 0, mode: 'normal', sentenceReview: null, completionReceipt: null, earnedPostcard: true })
    const legacyTerminal = {
      words: [], reveals: {}, clueHistory: [], phase: 'finished', outcome: { result: 'won', reason: 'all-greens' },
    } as never
    const html = renderToStaticMarkup(<RoundSummary game={legacyTerminal} />)
    expect(html).not.toContain('round-summary')
    expect(html).not.toContain(UI.game.outcomeWonTitle)
    expect(html).not.toContain('outcome-reward')
    expect(html).not.toContain('receipt-result')
  })

  it('keeps a receipt curriculum item as its own authored Guide intent', () => {
    expect(entryForLessonOffer({ kind: 'curriculum', cityIndex: 0, itemId: 'sonderborg-notice' }))
      .toEqual({ kind: 'curriculum-offer', cityIndex: 0, itemId: 'sonderborg-notice' })
  })

  it('keeps the embedded curriculum Guide over the result with an explicit return', () => {
    const html = renderToStaticMarkup(<ReceiptGuideOverlay entry={{ kind: 'curriculum-offer', cityIndex: 0, itemId: 'sonderborg-notice' }} onReturn={() => {}} />)
    expect(html).toContain('receipt-guide-overlay')
    expect(html).toContain('receipt-guide-return')
    expect(html).toContain(UI.game.resultBackToResult)
  })

  it('renders no reward slot on a won round that earned nothing', () => {
    useGame.setState({ boardCityIndex: 0, mode: 'normal', sentenceReview: null, earnedPostcard: false })
    const surface = dialogOf(renderToStaticMarkup(<RoundSummary game={won} />))
    expect(surface).not.toContain('outcome-reward')
    expect(surface).not.toContain(UI.game.outcomeWonSub)
  })

  it('offers Play again (not the authored next game) and the P1 sentence band at a later city', () => {
    useGame.setState({ boardCityIndex: 1, sentenceReview: null })
    const html = renderToStaticMarkup(<RoundSummary game={wonWithGreen} />)
    const surface = dialogOf(html)
    // The replay is a tag (CW-12); Home stays a text route.
    expect(surface).toContain(`<span class="tag-label">${UI.game.playAgain}</span>`)
    expect(surface).toContain(`>${UI.game.home}</button>`)
    expect(surface).not.toContain('summary-wrap-actions')
    expect(surface).not.toContain(UI.game.playNextGame)
    // Cities 2–9 have no review catalogue: the band of 2026-09-05 fills the
    // reader's place, inside the same surface.
    expect(surface).toContain('sentence-review')
    expect(surface).toContain('sentence-row')
    expect(surface).not.toContain(UI.game.reviewNothingThisRound)
    // A later-city round with no green has no sentence to show, and says so.
    const empty = dialogOf(renderToStaticMarkup(<RoundSummary game={won} />))
    expect(empty).not.toContain('sentence-row')
    expect(empty).toContain(UI.game.sentenceBandNoGreens)
  })

  it('turns the first real round into a single Home hand-off', () => {
    const html = renderToStaticMarkup(<RoundSummary game={finished} hideReplay onHome={() => {}} />)
    expect(html).not.toContain(UI.game.playAgain)
    expect(html).not.toContain(UI.game.playNextGame)
    expect(html).toContain(`>${UI.game.home}</button>`)
  })

})

describe('the finish header board number', () => {
  it("is the board's place in the course, not its bank number", () => {
    expect(boardNumber('bank_001')).toBe('01')
    const second = CITY1_REQUIRED_BOARD_IDS[1]!
    expect(second).not.toBe('bank_002')
    expect(boardNumber(second)).toBe('02')
    expect(boardNumber(CITY1_REQUIRED_BOARD_IDS[99]!)).toBe('100')
    const outside = CITY1_BOARD_CYCLE.find((board) => !CITY1_REQUIRED_BOARD_IDS.includes(board.id))!.id
    expect(boardNumber(outside)).toBe(String(Number(outside.slice(5))).padStart(2, '0'))
    expect(boardNumber(null)).toBeNull()
  })
})

describe('the finish header place line', () => {
  it('names the city and the café (the frozen CW-08 names), else the board number (German course)', () => {
    const danish = requiredSetForCourse('da')
    const first = danish.boards.find((board) => board.authoredBoardId === CITY1_REQUIRED_BOARD_IDS[0])!
    const onCafe = { ...receiptForHeader(5), evidence: { ...receiptForHeader(5).evidence, board: first } } as CompletionReceipt
    expect(finishPlace('Sønderborg', onCafe)).toBe(`Sønderborg · ${cafeNameForBoard(first)}`)
    expect(finishPlace('Sønderborg', onCafe)).toBe('Sønderborg · Café Solen')
    // A board with no café name keeps its number; no receipt, just the city.
    const outside = { ...onCafe, evidence: { ...onCafe.evidence, board: { ...first, courseId: 'de' } } } as CompletionReceipt
    expect(finishPlace('Sønderborg', outside)).toBe(`Sønderborg · ${RECEIPT_UI.boardLabel('01')}`)
    expect(finishPlace('Sønderborg', null)).toBe('Sønderborg')
  })
})
