import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'

export type GuideThumbSection = 'grammar' | 'survival'

/** The Guide's two large, always-available section indexes. */
export function GuideThumbIndexes({ active, onOpen }: {
  readonly active: GuideThumbSection | null
  readonly onOpen: (section: GuideThumbSection) => void
}) {
  return <nav className="guide-thumb-indexes" aria-label={UI.guide.thumbIndexesAria}>
    <button
      className={`guide-thumb-index guide-thumb-grammar guide-section-grammar${active === 'grammar' ? ' is-active' : ''}`}
      aria-label={UI.guide.sectionGrammar}
      aria-current={active === 'grammar' ? 'page' : undefined}
      onClick={() => onOpen('grammar')}
    ><small>{UI.guide.sectionGrammar}</small><strong>{UI.guide.grammarThumbBlurb[ACTIVE.code]}</strong><span className="guide-thumb-connectors" aria-hidden="true" /></button>
    <button
      className={`guide-thumb-index guide-thumb-survival guide-section-survival${active === 'survival' ? ' is-active' : ''}`}
      aria-label={UI.guide.sectionSurvival}
      aria-current={active === 'survival' ? 'page' : undefined}
      onClick={() => onOpen('survival')}
    ><small>{UI.guide.sectionSurvival}</small><strong>{UI.guide.survivalThumbBlurb}</strong><span className="guide-thumb-connectors" aria-hidden="true" /></button>
  </nav>
}
