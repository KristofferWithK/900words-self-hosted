import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { CATALOGUES, type UiLanguage } from '../../i18n'

afterEach(() => { vi.doUnmock('../../i18n'); vi.resetModules() })

it.each(Object.keys(CATALOGUES) as UiLanguage[])('renders the translation takeover and wheel introduction in %s', async (language) => {
  vi.resetModules()
  const catalogue = CATALOGUES[language]
  vi.doMock('../../i18n', () => ({ UI: catalogue }))
  const { RoundGuidanceDialog } = await import('./RoundGuidanceDialog')
  const { TurnTakeover } = await import('./TurnTakeover')
  const escaped = (s: string) => renderToStaticMarkup(<span>{s}</span>).slice(6, -7)
  const dialog = renderToStaticMarkup(<RoundGuidanceDialog kind="translation" onDismiss={() => {}} />)
  const takeover = renderToStaticMarkup(<TurnTakeover side="translation" turn={4} />)
  expect(dialog).toContain(escaped(catalogue.game.phaseTranslateChallenge))
  expect(dialog).toContain(escaped(catalogue.game.guidanceTranslationBody(catalogue.onboarding.courseText('da').languageName)))
  expect(dialog).toContain(escaped(catalogue.game.guidanceStartTranslation))
  // The same opt-out box and copy as the Your turn panel, in every catalogue.
  expect(dialog).toContain('type="checkbox"')
  expect(dialog).toContain(escaped(catalogue.game.guidanceHideReminder))
  expect(takeover).toContain(escaped(catalogue.game.phaseTranslateChallenge))
  for (const html of [dialog, takeover]) {
    expect(html).not.toContain(escaped(catalogue.game.guidanceLastChanceTitle))
    expect(html).not.toContain(escaped(catalogue.game.phaseGiveClue))
  }
})
