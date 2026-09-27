import { danishCurriculumContent } from '../../lang/da/curriculum-content'
import type { CityExitTask, ScoredCurriculumActivity } from '../../lang/curriculum-content'
import { ACTIVE } from '../../lang/active'
import { UI } from '../../i18n'
import { guideCopy } from '../../i18n/guide'
import { GuideThumbIndexes } from './GuideThumbIndexes'

type CurriculumOffer =
  | { readonly kind: 'activity'; readonly activity: ScoredCurriculumActivity }
  | { readonly kind: 'exit'; readonly exit: CityExitTask }

/**
 * Resolves only the curriculum item named by a C1-09 receipt invitation.
 * GrammarBook and curriculum have intentionally different stable ids, so an
 * absent item returns null instead of choosing a nearby chapter or activity.
 */
export function curriculumOfferFor(cityIndex: number, itemId: string): CurriculumOffer | null {
  const city = danishCurriculumContent.cities[cityIndex]
  if (!city) return null
  const activity = [...city.capsules, ...city.exchanges].find((candidate) => candidate.id === itemId)
  if (activity) return { kind: 'activity', activity }
  return city.exitTask.id === itemId ? { kind: 'exit', exit: city.exitTask } : null
}

interface CurriculumOfferReaderProps {
  readonly cityIndex: number
  readonly itemId: string
  /** Return to the Guide contents; this reader never writes course progress. */
  readonly onClose: () => void
  readonly onOpenSection: (section: 'grammar' | 'survival') => void
}

/** A read-only projection of authored C1-09 curriculum content in the Guide. */
export function CurriculumOfferReader({ cityIndex, itemId, onClose, onOpenSection }: CurriculumOfferReaderProps) {
  const offer = curriculumOfferFor(cityIndex, itemId)
  if (!offer) return null
  const title = offer.kind === 'activity'
    ? guideCopy(offer.activity.id, 'titleEn', offer.activity.titleEn)
    : guideCopy(offer.exit.id, 'titleEn', offer.exit.titleEn)
  return <section className="book-reader travel-guide-book curriculum-offer-reader" aria-label={title}>
    <div className="guide-cover-tabs-row"><button className="book-back icon-btn" onClick={onClose} aria-label={UI.guide.backToGuideAria}>←</button><GuideThumbIndexes active="grammar" onOpen={onOpenSection} /></div>
    {offer.kind === 'activity'
      ? <CurriculumActivityPage activity={offer.activity} />
      : <CurriculumExitPage exit={offer.exit} />}
  </section>
}

function CurriculumActivityPage({ activity }: { readonly activity: ScoredCurriculumActivity }) {
  return <article className="book-page curriculum-offer-page">
    <p className="book-page-context">{guideCopy(activity.id, 'travelGuideContextEn', activity.travelGuideContextEn)}</p>
    <h1>{guideCopy(activity.id, 'titleEn', activity.titleEn)}</h1>
    {activity.visualDa && <p className="guide-target" lang={ACTIVE.code}>{activity.visualDa}</p>}
    {activity.visualSupportEn && <p className="dim">{guideCopy(activity.id, 'visualSupportEn', activity.visualSupportEn)}</p>}
    <p>{guideCopy(activity.id, 'promptEn', activity.promptEn)}</p>
    <p className="guide-target" lang={ACTIVE.code}>{activity.answer.modelDa}</p>
    <p className="guide-note">{guideCopy(activity.id, 'feedbackEn', activity.feedbackEn)}</p>
    <p className="guide-note">{UI.guide.readerNote}</p>
  </article>
}

function CurriculumExitPage({ exit }: { readonly exit: CityExitTask }) {
  return <article className="book-page curriculum-offer-page curriculum-exit-page">
    <p className="book-page-context">{guideCopy(exit.id, 'travelGuideContextEn', exit.travelGuideContextEn)}</p>
    <h1>{guideCopy(exit.id, 'titleEn', exit.titleEn)}</h1>
    <p>{guideCopy(exit.id, 'novelDetailEn', exit.novelDetailEn)}</p>
    {exit.steps.map((step) => <section className="curriculum-exit-step" key={step.id}>
      <h2>{guideCopy(step.id, 'titleEn', step.titleEn)}</h2>
      {step.visualDa && <p className="guide-target" lang={ACTIVE.code}>{step.visualDa}</p>}
      {step.visualSupportEn && <p className="dim">{guideCopy(step.id, 'visualSupportEn', step.visualSupportEn)}</p>}
      <p>{guideCopy(step.id, 'promptEn', step.promptEn)}</p>
      <p className="guide-target" lang={ACTIVE.code}>{step.answer.modelDa}</p>
      <p className="guide-note">{guideCopy(step.id, 'feedbackEn', step.feedbackEn)}</p>
    </section>)}
    <p className="guide-note">{UI.guide.readerNote}</p>
  </article>
}
