import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { activeGrammarBooks, activeSurvivalAudioLineId, activeSurvivalGuide } from '../../lang/bookshelf'
import type { CitySurvivalGuide, SurvivalExchange } from '../../lang/survival'
import { cityAt } from '../../journey/cities'
import { UI, UI_LANGUAGE } from '../../i18n'
import { guideCopy } from '../../i18n/guide'
import { ACTIVE } from '../../lang/active'
import {
  germanGuideEnglishOnlyForCity,
  germanGuideGrammarTitle,
  germanGuideSurvivalTheme,
  localizeGermanFlensburgExchange,
  localizeGermanFlensburgSurvivalCity,
  type GermanFlensburgExchangeId,
  type GermanFlensburgLessonId,
} from '../../lang/de/guide-sidecars'
import { useJourney } from '../../stores/journeyStore'
import { type GuideEntryIntent, useUi } from '../../stores/uiStore'
import { ClueyFace } from '../components/Cluey'
import { GrammarBook } from '../components/GrammarBook'
import { GuideThumbIndexes } from '../components/GuideThumbIndexes'
import { playSurvivalLine } from '../speak'

// Curriculum authoring stays behind this route's lazy boundary: opening an
// ordinary Guide chapter must not pull the full assessment payload into the
// phone's main bundle.
const CurriculumOfferReader = lazy(() => import('../components/CurriculumOfferReader').then((module) => ({ default: module.CurriculumOfferReader })))

type GuideSection = 'grammar' | 'survival'
type GuideRoute =
  | { readonly kind: 'cover' }
  | { readonly kind: 'index'; readonly section: GuideSection }
  | { readonly kind: 'grammar-book'; readonly cityIndex: number; readonly thenExchange?: number }
  | { readonly kind: 'exchange'; readonly cityIndex: number; readonly exchangeIndex: number }
  | { readonly kind: 'curriculum-offer'; readonly cityIndex: number; readonly itemId: string }

/** Maps the summary's transient intent to a deliberate Guide page. */
export function guideRouteForEntry(entry: GuideEntryIntent | null): GuideRoute {
  if (!entry) return { kind: 'cover' }
  if (entry.kind === 'grammar') {
    const chapter = activeGrammarBooks[entry.cityIndex]
    if (!chapter) return { kind: 'cover' }
    // The chained exchange rides only if it exists: a "Both" that named an
    // exchange the city does not have reads as plain Grammar.
    const then = entry.thenExchange
    const chained = then !== undefined && !!activeSurvivalGuide.cities[entry.cityIndex]?.exchanges[then]
    return {
      kind: 'grammar-book', cityIndex: entry.cityIndex,
      ...(chained ? { thenExchange: then } : {}),
    }
  }
  if (entry.kind === 'curriculum-offer') {
    // Do not turn a curriculum id into a GrammarBook id: those are separate
    // authored catalogues. The reader validates this exact id against the
    // curriculum payload and fails closed if it is not present.
    return { kind: 'curriculum-offer', cityIndex: entry.cityIndex, itemId: entry.itemId }
  }
  const city = activeSurvivalGuide.cities[entry.cityIndex]
  return city?.exchanges[entry.exchangeIndex]
    ? { kind: 'exchange', cityIndex: entry.cityIndex, exchangeIndex: entry.exchangeIndex }
    : { kind: 'cover' }
}

interface TravelGuideBookProps {
  /** Optional local entry point, used by the journey map's Look ahead action. */
  readonly initialEntry?: GuideEntryIntent | null
  /** Keep an embedded Guide inside the surface that opened it. */
  readonly onExit?: () => void
}

/** The Guide projects existing content/state without writing route or evidence. */
export function TravelGuideBook({ initialEntry, onExit }: TravelGuideBookProps = {}) {
  const goTo = useUi((s) => s.goTo)
  const currentCityIndex = useJourney((s) => s.cityIndex)
  const guideEntry = useUi((s) => s.guideEntry)
  const consumeGuideEntry = useUi((s) => s.consumeGuideEntry)
  const [route, setRoute] = useState<GuideRoute>(() =>
    guideRouteForEntry(initialEntry ?? useUi.getState().guideEntry),
  )
  const openSection = (section: GuideSection) => setRoute({ kind: 'index', section })

  // The summary hands the Guide one page request, never a persisted route or
  // a second progression state. Once this mount has accepted it, later Guide
  // navigation is wholly local and the next ordinary Guide visit opens cover.
  useEffect(() => {
    if (guideEntry) consumeGuideEntry()
  }, [guideEntry, consumeGuideEntry])

  if (route.kind === 'grammar-book') {
    const chapter = activeGrammarBooks[route.cityIndex]
    // The wrap-up's "Both": the book's last page turns into the exchange it
    // was paired with, the way a ride chapter turns into its city's
    // exchanges. Without a pairing the last page ends, as a chapter does.
    const then = route.thenExchange
    const chain = then === undefined ? {} : {
      onPastEnd: () => setRoute({ kind: 'exchange', cityIndex: route.cityIndex, exchangeIndex: then }),
      pastEndLabel: UI.guide.nextSurvivalLabel,
    }
    return chapter ? <GrammarBook cityId={chapter.cityId} onClose={() => openSection('grammar')} topAccessory={<GuideThumbIndexes active="grammar" onOpen={openSection} />} {...chain} /> : null
  }
  if (route.kind === 'curriculum-offer') {
    return <Suspense fallback={<section className="book-reader travel-guide-book" aria-busy="true" />}>
      <CurriculumOfferReader cityIndex={route.cityIndex} itemId={route.itemId} onClose={() => openSection('grammar')} onOpenSection={openSection} />
    </Suspense>
  }
  if (route.kind === 'exchange') {
    const city = activeSurvivalGuide.cities[route.cityIndex]
    const exchange = city?.exchanges[route.exchangeIndex]
    return city && exchange ? <SurvivalExchangeReader key={exchange.targetActivityId} city={city} exchange={exchange} exchangeIndex={route.exchangeIndex} onClose={() => openSection('survival')} onOpenSection={openSection} onTurn={(exchangeIndex) => setRoute({ kind: 'exchange', cityIndex: route.cityIndex, exchangeIndex })} /> : null
  }
  if (route.kind === 'cover') return <GuideCover onClose={onExit ?? (() => goTo('home'))} onOpen={openSection} />
  if (route.kind === 'index') {
    const entries = route.section === 'grammar' ? activeGrammarBooks : activeSurvivalGuide.cities
    return <GuideIndex section={route.section} entries={entries} currentCityIndex={currentCityIndex} onBack={() => setRoute({ kind: 'cover' })} onOpenSection={openSection} onOpenCity={(cityIndex) => setRoute(route.section === 'grammar' ? { kind: 'grammar-book', cityIndex } : { kind: 'exchange', cityIndex, exchangeIndex: 0 })} />
  }
}

function GuideCover({ onClose, onOpen }: { readonly onClose: () => void; readonly onOpen: (section: GuideSection) => void }) {
  return <section className="book-reader travel-guide-book guide-cover-screen" aria-label={UI.guide.bookCoverAria}>
    <div className="guide-cover-tabs-row"><button className="book-back icon-btn" onClick={onClose} aria-label={UI.guide.backFromGuideAria}>←</button><GuideThumbIndexes active={null} onOpen={onOpen} /></div>
    <button className="guide-cover-hero" type="button" onClick={() => onOpen('grammar')} aria-label={UI.guide.openGrammarContentsAria}>
      <svg className="guide-cover-route" viewBox="0 0 320 490" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 24 380 C 35 310, 116 365, 148 304 S 224 266, 284 184" />
        <circle cx="24" cy="380" r="4" />
        <path className="guide-cover-route-arrow" d="M 274 185 L 285 182 L 283 194" />
      </svg>
      <div className="guide-cover-copy"><p className="book-eyebrow">{UI.guide.pocketGuideEyebrow}</p><h1>{UI.guide.pocketGuideTitle[ACTIVE.code]}</h1><p>{UI.guide.pocketGuideBlurb}</p></div>
      <ClueyFace mood="happy" className="guide-cover-casey" />
      <span className="guide-cover-sticker" aria-hidden="true">01–09</span>
    </button>
  </section>
}

export function GuideIndex({ section, entries, currentCityIndex, onBack, onOpenSection, onOpenCity }: {
  readonly section: GuideSection
  readonly entries: readonly (typeof activeGrammarBooks[number] | CitySurvivalGuide)[]
  readonly currentCityIndex: number; readonly onBack: () => void; readonly onOpenSection?: (section: GuideSection) => void; readonly onOpenCity: (cityIndex: number) => void
}) {
  const title = section === 'grammar' ? UI.guide.sectionGrammar : UI.guide.sectionSurvival
  return <section className={`book-reader travel-guide-book guide-${section}`} aria-label={UI.guide.cityIndexAria(title)}>
    <div className="guide-cover-tabs-row"><button className="book-back icon-btn" onClick={onBack} aria-label={UI.guide.backToCoverAria}>←</button><GuideThumbIndexes active={section} onOpen={onOpenSection ?? (() => {})} /></div>
    <article className="book-page guide-index-page"><div className="guide-page-intro"><div className="guide-page-meta"><p className="book-page-context">{UI.guide.caseyFieldNotes}</p></div><h1>{UI.guide.cityIndexHeading}</h1><p className="guide-page-lede">{entries.length === 0 ? UI.guide.sectionEmpty : UI.guide.cityIndexLede}</p></div><div className="guide-city-list">
      {entries.map((entry) => { const cityIndex = entry.cityIndex; const survivalCity = section === 'survival' ? entry as CitySurvivalGuide : null; const topic = section === 'grammar' ? (entry as typeof activeGrammarBooks[number]).topicEn : guideCopy(`survival-theme.${survivalCity!.cityId}`, 'themeEn', survivalCity!.themeEn)
        const germanGuide = ACTIVE.code === 'de'
        const visibleTopic = germanGuide && cityIndex === 0
          ? section === 'grammar'
            ? germanGuideGrammarTitle(UI_LANGUAGE, (entry as typeof activeGrammarBooks[number]).lessons[0]!.id as GermanFlensburgLessonId)
            : germanGuideSurvivalTheme(UI_LANGUAGE, survivalCity!.exchanges[0]!.targetActivityId as GermanFlensburgExchangeId)
          : topic
        const englishOnly = germanGuide && germanGuideEnglishOnlyForCity(cityIndex, UI_LANGUAGE)
        const lessonCount = section === 'grammar' ? (entry as typeof activeGrammarBooks[number]).lessons.length : 4
        const current = cityIndex === currentCityIndex
        return <button key={entry.cityId} className={`guide-city-row${current ? ' is-current-city' : ''}`} aria-label={UI.guide.cityRowAria(cityAt(cityIndex).name, visibleTopic, current)} onClick={() => onOpenCity(cityIndex)}><span className="guide-city-number is-available">{cityIndex + 1}</span><span><small className="guide-city-tag">{cityAt(cityIndex).name}</small><strong>{visibleTopic}</strong>{englishOnly && <small className="guide-english-only-notice">{UI.guide.englishOnlyNotice}</small>}</span><em>{section === 'grammar' ? UI.guide.lessonCount(lessonCount) : UI.guide.exchangeCount(lessonCount)}</em><b aria-hidden="true">›</b></button> })}
    </div></article>
  </section>
}

/**
 * One Survival exchange on Guide paper. The train ride reuses it for the
 * second half of a chapter, which is what the optional props are for: its own
 * top row instead of the Guide's thumb indexes, a Previous that can step back
 * into the grammar pages, and a Next past the last exchange (the arrival).
 * Without them it is exactly the Guide's page.
 */
export function SurvivalExchangeReader({ city: sourceCity, exchange: sourceExchange, exchangeIndex = sourceCity.exchanges.indexOf(sourceExchange), onClose, onOpenSection, onTurn, className, topAccessory, backLabel, onBeforeStart, onPastEnd, pastEndLabel }: {
  readonly city: CitySurvivalGuide; readonly exchange: SurvivalExchange; readonly exchangeIndex?: number; readonly onClose: () => void; readonly onOpenSection?: (section: GuideSection) => void; readonly onTurn?: (index: number) => void
  readonly className?: string; readonly topAccessory?: ReactNode; readonly backLabel?: string
  readonly onBeforeStart?: () => void; readonly onPastEnd?: () => void; readonly pastEndLabel?: string
}) {
  const germanGuide = ACTIVE.code === 'de'
  const city = germanGuide ? localizeGermanFlensburgSurvivalCity(sourceCity, UI_LANGUAGE) : sourceCity
  const englishOnly = germanGuide && germanGuideEnglishOnlyForCity(sourceCity.cityIndex, UI_LANGUAGE)
  const exchange = germanGuide ? localizeGermanFlensburgExchange(sourceExchange, UI_LANGUAGE) : sourceExchange
  const theme = germanGuide && sourceCity.cityIndex === 0
    ? city.themeEn
    : guideCopy(`survival-theme.${city.cityId}`, 'themeEn', city.themeEn)
  const title = germanGuide && sourceCity.cityIndex === 0
    ? exchange.titleEn
    : guideCopy(`survival.${exchange.targetActivityId}`, 'titleEn', exchange.titleEn)
  const first = exchangeIndex === 0
  const last = exchangeIndex === city.exchanges.length - 1
  const [translations, setTranslations] = useState<ReadonlySet<number>>(() => new Set())
  const toggleTranslation = (index: number) => setTranslations((previous) => {
    const next = new Set(previous)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    return next
  })
  // Lines whose recording did not play. Said under the line, because the
  // app has no other voice to say it in — see speak.ts.
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set())
  const markFailed = (index: number, isFailed: boolean) => setFailed((previous) => {
    if (previous.has(index) === isFailed) return previous
    const next = new Set(previous)
    if (isFailed) next.add(index)
    else next.delete(index)
    return next
  })
  return <section className={`book-reader travel-guide-book guide-survival${className ? ` ${className}` : ''}`} aria-label={UI.guide.exchangeAria(title)}><div className="guide-cover-tabs-row"><button className="book-back icon-btn" onClick={onClose} aria-label={backLabel ?? UI.guide.backToSurvivalIndexAria}>←</button>{topAccessory ?? <GuideThumbIndexes active="survival" onOpen={onOpenSection ?? (() => {})} />}</div><article className="book-page survival-exchange-page"><div className="guide-page-meta"><p className="book-page-context">{UI.guide.recommendedCity(cityAt(city.cityIndex).name)}</p><span className="guide-page-count guide-page-count-inline">{exchangeIndex + 1} / {city.exchanges.length}</span></div>{englishOnly && <p className="guide-english-only-notice" role="note">{UI.guide.englishOnlyNotice}</p>}{exchange.register
      ? <div className="survival-tag-row"><span className="guide-city-tag">{theme}</span><span className="survival-register" aria-label={UI.guide.addressFormAria(exchange.register)}>{exchange.register}</span></div>
      : <span className="guide-city-tag">{theme}</span>}<h1>{title}</h1><div className="survival-phrases">{exchange.phrases.map((phrase) => <p key={phrase.da}><strong lang={ACTIVE.code}>{phrase.da}</strong><span>{phrase.en}</span></p>)}</div><div className="survival-dialogue">{exchange.dialogue.map((line, index) => { const translated = translations.has(index); const audioId = activeSurvivalAudioLineId?.(exchange.targetActivityId, index); return <div key={`${line.speaker}-${line.da}`} className="survival-line"><span>{line.speaker === 'traveller' ? UI.guide.speakerYou : UI.guide.speakerLocal}</span><strong lang={ACTIVE.code}>{line.da}</strong><div className="survival-line-tabs"><button type="button" className="survival-line-tab survival-listen" disabled={!audioId} title={audioId ? undefined : UI.guide.listenNotRecordedYet} aria-label={audioId ? UI.guide.listenToAria(line.da) : UI.guide.listenNotRecordedYet} onClick={() => { if (audioId) void playSurvivalLine(audioId).then((source) => markFailed(index, source === 'failed')) }}><span aria-hidden="true">▶</span> {UI.guide.listen}</button><button type="button" className={`survival-line-tab survival-english${translated ? ' is-active' : ''}`} aria-expanded={translated} onClick={() => toggleTranslation(index)}>{UI.guide.translationToggle}</button></div>{translated && <em className="survival-translation">{line.en}</em>}{failed.has(index) && <em className="survival-audio-note" role="status">{UI.guide.recordingDidNotLoad}</em>}</div> })}</div><nav className="book-turns guide-inline-book-turns survival-book-turns" aria-label={UI.guide.exchangeNavAria}><button className="btn btn-ghost" aria-label={UI.guide.previous} disabled={first && !onBeforeStart} onClick={() => (first && onBeforeStart ? onBeforeStart() : onTurn?.(exchangeIndex - 1))}>{UI.guide.previousLabel}</button><button className={`btn ${last && onPastEnd ? 'btn-primary' : 'btn-ghost'}`} aria-label={UI.guide.next} disabled={last && !onPastEnd} onClick={() => (last && onPastEnd ? onPastEnd() : onTurn?.(exchangeIndex + 1))}>{last && onPastEnd && pastEndLabel ? pastEndLabel : UI.guide.nextLabel}</button></nav></article></section>
}
