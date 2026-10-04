import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { testCatalog } from '../../review/city1.fixtures'
import { GERMAN_CITY1_CATALOG, selectQueue, type QueueState } from '../../review/city1'
import { City1SentenceReview, type FinishOutcome } from './City1SentenceReview'
const state: QueueState = { version: 1, roundId: 'TEST', cursor: 0, dismissed: false,
  queue: selectQueue([0, 1].map(() => ({ by: 'player', text: 'Animals', number: 2, guesses: [{ wordId: 'da:hund', result: 'green' }] })), testCatalog.review) }
const noop = () => {}
const won: FinishOutcome = { result: 'won', title: 'Congratulations!', sub: UI.game.outcomeWonSub, stats: <p className="outcome-stats">6 new words</p>, reward: <div className="outcome-reward"><span className="outcome-reward-text">{UI.game.outcomeWonSub}</span></div> }
const lost: FinishOutcome = {
  result: 'lost', title: 'Next time', sub: 'Round given up — the connection was there.',
  stats: <p className="outcome-stats">2 new words</p>,
}
type Overrides = Partial<Parameters<typeof City1SentenceReview>[0]>
const render = (overrides: Overrides = {}) => renderToStaticMarkup(
  <City1SentenceReview state={state} catalog={testCatalog} outcome={won} onNext={noop} onDismiss={noop} onHome={noop} onReplay={noop} {...overrides} />,
)
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to))
/** The replay as the footer's primary: a wide primary tag (CW-12) with the label. */
const primaryReplay = (label: string) =>
  new RegExp(`class="tag tag-wide tag-primary city1-review-replay"><span class="tag-hole" aria-hidden="true"></span><span class="tag-text"><span class="tag-label">${label}</span>`)
describe('the finish screen', () => {
  it('renders Danish first, one Listen, independent collapsed disclosures and direct exits with normal/slow audio', () => {
    const html = render()
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-modal="true"')
    expect(html).not.toContain('city1-review-clue')
    expect(html.match(new RegExp(`>${UI.game.reviewListen}<`, 'g'))).toHaveLength(1)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(html).toContain(UI.game.reviewNextSentence)
    expect(html).toContain(UI.game.playNextGame)
    expect(html).toContain(UI.game.home)
    expect(html).not.toContain('Where is the dog?')
    expect(html).toContain(`aria-label="${UI.game.reviewListenSlowlyAria}"`)
    expect(html).toContain(UI.game.reviewNoRecordings)
  })
  it('says the outcome once, in its own header: a congratulation under confetti, or next time with the reason', () => {
    const wonHtml = render()
    const header = between(wonHtml, 'city1-review-context', 'city1-review-scroll')
    // The headline is the heading the dialog is labelled by and focus lands on.
    expect(header).toContain('id="city1-review-title"')
    expect(header).toContain('Congratulations!')
    expect(header).toContain('mood-happy')
    expect(header).toContain('6 new words')
    expect(header).toContain('You won a postcard!')
    expect(wonHtml.match(/Congratulations!/g)).toHaveLength(1)
    expect(wonHtml).toContain('class="confetti"')
    // There is no finish state underneath to skip to any more.
    expect(wonHtml).not.toContain('Skip review')
    expect(wonHtml).not.toContain('Finish review')

    const lostHtml = render({ outcome: lost })
    const lostHeader = between(lostHtml, 'city1-review-context', 'city1-review-scroll')
    expect(lostHeader).toContain('Next time')
    expect(lostHeader).toContain('Round given up — the connection was there.')
    // Owner, 2026-09-18: no culprit card line on a loss — the header stops.
    expect(lostHeader).not.toContain('You named')
    expect(lostHeader).toContain('mood-oops')
    expect(lostHtml).not.toContain('confetti')
  })
  it('orders settled receipt reasons and postcard summary before the word counts', () => {
    const outcome: FinishOutcome = {
      result: 'won', title: 'Great game!', stats: <p className="outcome-stats"><span className="stat-discovered">6 new words</span> · <span className="stat-collected">2 collected</span></p>,
      resultDetails: <section className="receipt-result">
        <ul className="receipt-reward-list"><li>1 × found every word</li></ul>
        <div className="receipt-result-summary">
          <div className="receipt-postcard-total">+2 new postcards</div>
          <div className="receipt-tier-summary">Attempt tier: Gold</div>
        </div>
      </section>,
    }
    const html = render({ outcome })
    const header = between(html, 'city1-review-context', 'city1-review-scroll')
    expect(header).toContain('city1-review-context-receipt')
    expect(header.indexOf('Great game!')).toBeLessThan(header.indexOf('receipt-reward-list'))
    expect(header.indexOf('receipt-reward-list')).toBeLessThan(header.indexOf('receipt-postcard-total'))
    expect(header.indexOf('receipt-postcard-total')).toBeLessThan(header.indexOf('receipt-tier-summary'))
    expect(header.indexOf('receipt-tier-summary')).toBeLessThan(header.indexOf('stat-discovered'))
    expect(header.indexOf('stat-discovered')).toBeLessThan(header.indexOf('stat-collected'))
  })
  it('stays the finish screen with nothing to read: the fallback, the notes, the footnote and the exits, no Next', () => {
    const fallback = <p className="city1-review-empty">Nothing to review this round.</p>
    const notes = <p className="earned-section">2 more wins for a wrap-up round</p>
    const footnote = <button className="log-toggle">Casey's calls</button>
    for (const empty of [null, { ...state, dismissed: true }, { ...state, queue: [], dismissed: true }]) {
      const html = render({ state: empty, fallback, notes, footnote })
      expect(html).toContain('<dialog')
      expect(html).toContain('Congratulations!')
      const reader = between(html, 'city1-review-scroll', 'city1-review-actions')
      expect(reader).toContain('2 more wins for a wrap-up round')
      expect(reader).toContain(UI.game.reviewTitle)
      expect(reader).toContain('Nothing to review this round.')
      expect(reader).toContain('log-toggle')
      expect(html).not.toContain('city1-review-clue')
      expect(html).not.toContain('city1-review-progress')
      expect(html).not.toContain(UI.game.reviewNextSentence)
      // Replay is the primary when there is no sentence to go on to.
      expect(html).toMatch(primaryReplay(UI.game.playNextGame))
      expect(html).toContain(`>${UI.game.home}</button>`)
    }
    // With a sentence to read, the fallback stays out and the footnote still closes the reader.
    const reading = render({ fallback, footnote })
    expect(reading).not.toContain('Nothing to review this round.')
    expect(reading.indexOf('city1-review-sentence')).toBeLessThan(reading.indexOf('log-toggle'))
  })
  it('makes replay primary on the last sentence, labels it as asked, and honours replay suppression', () => {
    const html = render({ state: { ...state, cursor: 1 } })
    expect(html).toMatch(primaryReplay(UI.game.playNextGame))
    expect(html).not.toContain(UI.game.reviewNextSentence)
    // No exit row on the last page: the primary owns its own line and Home
    // sits under it.
    expect(html).not.toContain('city1-review-exit-row')
    expect(render({ state: { ...state, cursor: 1 }, replayLabel: 'Play again' })).toMatch(primaryReplay('Play again'))
    const onboarding = render({ onReplay: undefined })
    expect(onboarding).not.toContain(UI.game.playNextGame)
    expect(onboarding).toContain(`>${UI.game.home}</button>`)
  })
  it('groups replay and Home into one row under Next sentence while there is a next one', () => {
    const html = render()
    const footer = html.slice(html.indexOf('city1-review-actions'))
    expect(footer.indexOf('city1-review-next')).toBeLessThan(footer.indexOf('city1-review-exit-row'))
    const row = footer.slice(footer.indexOf('city1-review-exit-row'))
    expect(row.indexOf(UI.game.playNextGame)).toBeLessThan(row.indexOf(`>${UI.game.home}</button>`))
    // Next sentence is the only primary while one is offered.
    expect(footer.match(/tag-primary/g)).toHaveLength(1)
  })
  it('underlines the high-frequency word inside the About note it is illustrated by', () => {
    const html = render()
    // Collapsed by default — the note is only built when the row is opened.
    expect(html).not.toContain('Hvor er katten?')
    expect(html).toContain('review-target')
  })
  it('keeps the overlays that ride it inside the dialog, where the top layer can show them', () => {
    const html = render({ children: <div className="data-sharing-scrim">a prompt</div> })
    const dialog = between(html, '<dialog', '</dialog>')
    expect(dialog).toContain('data-sharing-scrim')
    // After the footer, so they never take part in the three-region tiling.
    expect(dialog.indexOf('city1-review-actions')).toBeLessThan(dialog.indexOf('data-sharing-scrim'))
  })
})

describe('the finish screen in German (2026-09-26)', () => {
  it('reads a German sentence marked in German, with both recordings on offer', () => {
    const queue = selectQueue([{ by: 'player', text: 'Familie', number: 1, guesses: [{ wordId: 'de:Mutter', result: 'green' }] }], GERMAN_CITY1_CATALOG.review)
    const html = renderToStaticMarkup(<City1SentenceReview state={{ version: 1, roundId: 'DE', cursor: 0, dismissed: false, queue }}
      catalog={GERMAN_CITY1_CATALOG} outcome={won} onNext={noop} onDismiss={noop} onHome={noop} onReplay={noop} />)
    expect(queue.map(pin => pin.wordId)).toEqual(['de:Mutter'])
    const sentence = between(html, 'city1-review-sentence', 'city1-review-audio')
    expect(sentence).toContain('lang="de"')
    expect(sentence).toContain('<span class=" review-target">Hallo</span>')
    expect(sentence).toContain('<span class="review-headword ">Mutter</span>')
    expect(sentence.replace(/<[^>]+>/g, '').replace(/^[^>]*>/, '')).toContain('Hallo, ist deine Mutter da?')
    expect(html).not.toContain(UI.game.reviewNoRecordings)
    expect(html).not.toContain('lang="da"')
  })
})
