import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { RoundGuidanceDialog } from './RoundGuidanceDialog'

describe('RoundGuidanceDialog public content', () => {
  it('labels a modal and prominently states the actual clue and number, without targets or rationale', () => {
    const html = renderToStaticMarkup(<RoundGuidanceDialog kind="casey" clue={{ text: 'journey', number: 3 }} onDismiss={() => {}} />)
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-labelledby="round-guidance-title"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-describedby="round-guidance-clue round-guidance-number round-guidance-description"')
    expect(html).toContain('journey')
    expect(html).toContain(UI.game.guidanceWordCount(3))
    expect(html).toContain(UI.game.guidanceStartGuessing)
    expect(html).not.toContain('targetWordIds')
    expect(html).not.toContain('rationale')
    expect(html).not.toContain(UI.game.guidanceHideReminder)
  })
  it('teaches a player clue turn with an explicit action and labeled opt-out', () => {
    const html = renderToStaticMarkup(<RoundGuidanceDialog kind="player" onDismiss={() => {}} />)
    expect(html).toContain(UI.game.guidancePlayerTitle)
    // React escapes the apostrophe when rendering static HTML; assert the
    // exact approved copy without confusing HTML encoding for a text change.
    expect(html).toContain(UI.game.guidancePlayerBody.replaceAll("'", '&#x27;'))
    expect(html).toContain(UI.game.guidanceWriteClue)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain(UI.game.guidanceHideReminder)
  })
  it('gives Translation time the same labeled opt-out as the player turn', () => {
    const html = renderToStaticMarkup(<RoundGuidanceDialog kind="translation" onDismiss={() => {}} />)
    expect(html).toContain(`>${UI.game.phaseTranslateChallenge}</h2>`)
    expect(html).toContain(UI.game.guidanceStartTranslation)
    expect(html).toContain('round-guidance-preference')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain(UI.game.guidanceHideReminder)
  })
  it('announces the last chance with its rule and one action, and no opt-out', () => {
    const html = renderToStaticMarkup(<RoundGuidanceDialog kind="last-chance" onDismiss={() => {}} />)
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-describedby="round-guidance-description"')
    expect(html).toContain(`>${UI.game.guidanceLastChanceTitle}</h2>`)
    expect(html).toContain(UI.game.guidanceLastChanceBody)
    expect(html).toContain(UI.game.guidanceKeepNaming)
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('round-guidance-clue')
  })
  it('legacy wheel guidance also introduces translation and spinning, never Last Chance', () => {
    const html = renderToStaticMarkup(<RoundGuidanceDialog kind="last-chance" wheel onDismiss={() => {}} />)
    expect(html).toContain(`>${UI.game.phaseTranslateChallenge}</h2>`)
    expect(html).toContain(UI.game.guidanceTranslationBody(UI.onboarding.courseText('da').languageName))
    expect(html).not.toContain(UI.game.guidanceLastChanceTitle)
    // The wheel arrival does not tell the player to keep naming — that rule
    // is the no-wheel sudden-death path's copy, kept intact above. Its action
    // names the spin instead (owner, 2026-09-17): the pop-up announces the
    // wheel, so the button says "Spin the wheel".
    expect(html).not.toContain(UI.game.guidanceLastChanceBody)
    expect(html).not.toContain(UI.game.guidanceKeepNaming)
    expect(html).toContain(UI.game.guidanceStartTranslation)
  })
})
