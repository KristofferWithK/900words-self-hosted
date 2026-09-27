import { useMemo, useState } from 'react'
import { ACTIVE } from '../../lang/active'
import { danishCurriculumContent } from '../../lang/da/curriculum-content'
import type { ScoredCurriculumActivity } from '../../lang/curriculum-content'
import { grammarChapters } from '../../journey/grammar'
import { initialCurriculumProgress } from '../../journey/curriculumScheduler'
import { cityAt } from '../../journey/cities'
import { UI } from '../../i18n'
import { guideCopy } from '../../i18n/guide'
import { learningCopy } from '../../i18n/learning'
import { useCurriculum } from '../../stores/curriculumStore'
import { useJourney } from '../../stores/journeyStore'
import { useUi } from '../../stores/uiStore'
import { GrammarLesson } from '../components/TrainRide'

type GuideTab = 'chapters' | 'practice' | 'situations'

type GuideActivity = ScoredCurriculumActivity & { cityIndex: number; kind: 'practice' | 'situation' | 'exit' }

/**
 * The state's own name. It is an IDENTIFIER — it spells the `guide-state-*`
 * class — so it stays English in every language (trap 5); `labelFor` is what
 * the player reads.
 */
const stateKeyFor = (state: string | undefined): 'done' | 'later' | 'new' | 'locked' => {
  if (state === 'completed') return 'done'
  if (state === 'deferred') return 'later'
  if (state === 'offered' || state === 'available' || state === 'skipped') return 'new'
  return 'locked'
}

const labelFor = (state: string | undefined) => {
  const key = stateKeyFor(state)
  if (key === 'done') return UI.guide.activityDone
  if (key === 'later') return UI.guide.activityLater
  if (key === 'new') return UI.guide.activityNew
  return UI.guide.activityLocked
}

// Zustand selectors must return the same missing-value object until the store
// changes. Constructing this inside the selector makes React see a new snapshot
// on every render of a fresh player's Guide.
const EMPTY_PROGRESS = initialCurriculumProgress(ACTIVE.code)

/**
 * The Guide is an index, not a second journey. It reads the curriculum ledger
 * but has no route-writing capability: opening a future chapter is therefore
 * structurally unable to unlock a city or create readiness evidence.
 */
export function TravelGuideScreen() {
  const goTo = useUi((s) => s.goTo)
  const cityIndex = useJourney((s) => s.cityIndex)
  const savedProgress = useCurriculum((s) => s.byLanguage[ACTIVE.code])
  const progress = savedProgress ?? EMPTY_PROGRESS
  const [tab, setTab] = useState<GuideTab>('chapters')
  const [chapterIndex, setChapterIndex] = useState<number | null>(null)
  const [activity, setActivity] = useState<GuideActivity | null>(null)

  const activities = useMemo(() => ({
    practice: danishCurriculumContent.cities.flatMap((city, index) =>
      city.capsules.map((item) => ({ ...item, cityIndex: index, kind: 'practice' as const }))),
    situations: danishCurriculumContent.cities.flatMap((city, index) => [
      ...city.exchanges.map((item) => ({ ...item, cityIndex: index, kind: 'situation' as const })),
      ...city.exitTask.steps.map((item) => ({ ...item, cityIndex: index, kind: 'exit' as const })),
    ]),
  }), [])

  if (chapterIndex !== null) {
    const chapter = grammarChapters()[chapterIndex]!
    return (
      <div className="screen grammar-library-screen travel-guide-reader">
        <header className="screen-header">
          <button className="icon-btn" aria-label={UI.guide.backToGuideAria} onClick={() => setChapterIndex(null)}>←</button>
          <h1>{chapterIndex > cityIndex ? UI.guide.lookAhead : cityAt(chapterIndex).name}</h1>
        </header>
        <div className="screen-scroll grammar-library-scroll">
          <p className="grammar-library-kicker">{UI.guide.chapterKicker(chapterIndex + 1, cityAt(chapterIndex).name)}</p>
          {chapterIndex > cityIndex && <p className="guide-note">{UI.guide.lookAheadNote}</p>}
          <h2 lang={ACTIVE.code}>{chapter.titleDa}</h2>
          <p className="ride-subtitle">{learningCopy(chapter.cityId, 'titleEn', chapter.titleEn)}</p>
          {/* GrammarLesson is deliberately a reader; it writes no lesson state. */}
          <GrammarLesson chapter={chapter} />
        </div>
      </div>
    )
  }

  if (activity) {
    return <GuideActivityReader activity={activity} onClose={() => setActivity(null)} />
  }

  return (
    <div className="screen travel-guide-screen">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.guide.backToHomeAria} onClick={() => goTo('home')}>←</button>
        <h1>{UI.guide.title}</h1>
      </header>
      <section className="travel-guide-cover" aria-label={UI.guide.coverAria}>
        <div className="guide-cover-stamp" aria-hidden="true">
          <span>DK</span><i /><b />
        </div>
        <div>
          <p className="guide-cover-kicker">{UI.guide.caseyFieldNotes}</p>
          <p className="guide-cover-title">{UI.guide.coverTitle[ACTIVE.code]}</p>
        </div>
      </section>
      <div className="travel-guide-tabs" role="tablist" aria-label={UI.guide.tabsAria}>
        {([['chapters', UI.guide.tabChapters], ['practice', UI.guide.tabPractice], ['situations', UI.guide.tabSituations]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="screen-scroll travel-guide-scroll" role="tabpanel">
        {tab === 'chapters' && grammarChapters().map((chapter, index) => {
          const reached = index <= cityIndex
          return (
            <button className="guide-row" key={chapter.cityId} onClick={() => setChapterIndex(index)}>
              <span className={`guide-state ${reached ? 'guide-state-new' : ''}`}>{reached ? UI.guide.chapterReached : UI.guide.lookAhead}</span>
              <span><strong>{UI.guide.chapterRowTitle(index + 1, cityAt(index).name)}</strong><small>{learningCopy(chapter.cityId, 'titleEn', chapter.titleEn)}</small></span>
              <span aria-hidden="true">›</span>
            </button>
          )
        })}
        {tab === 'practice' && <GuideRows activities={activities.practice} cityIndex={cityIndex} states={progress.itemStates} onOpen={setActivity} />}
        {tab === 'situations' && <GuideRows activities={activities.situations} cityIndex={cityIndex} states={progress.itemStates} onOpen={setActivity} />}
      </div>
    </div>
  )
}

function GuideRows({ activities, cityIndex, states, onOpen }: {
  activities: readonly GuideActivity[]
  cityIndex: number
  states: Readonly<Record<string, string>>
  onOpen: (activity: GuideActivity) => void
}) {
  const visible = activities.filter((activity) => activity.cityIndex <= cityIndex)
  if (visible.length === 0) return <p className="grammar-empty">{UI.guide.noActivitiesYet}</p>
  return <>
    <p className="guide-intro">{UI.guide.activityListIntro}</p>
    {visible.map((activity) => {
      const state = states[activity.id]
      const locked = !state || state === 'locked'
      return (
        <button className="guide-row" key={activity.id} disabled={locked} onClick={() => onOpen(activity)}>
          <span className={`guide-state guide-state-${stateKeyFor(state)}`}>{labelFor(state)}</span>
          <span><strong>{cityAt(activity.cityIndex).name} · {guideCopy(activity.id, 'titleEn', activity.titleEn)}</strong><small>{guideCopy(activity.id, 'travelGuideContextEn', activity.travelGuideContextEn)}</small></span>
          <span aria-hidden="true">{locked ? '•' : '›'}</span>
        </button>
      )
    })}
  </>
}

function GuideActivityReader({ activity, onClose }: { activity: GuideActivity; onClose: () => void }) {
  return (
    <div className="screen travel-guide-reader">
      <header className="screen-header">
        <button className="icon-btn" aria-label={UI.guide.backToGuideAria} onClick={onClose}>←</button>
        <h1>{cityAt(activity.cityIndex).name}</h1>
      </header>
      <div className="screen-scroll travel-guide-scroll">
        <p className="grammar-library-kicker">{activity.kind === 'practice' ? UI.guide.kindPractice : activity.kind === 'exit' ? UI.guide.kindReadinessTask : UI.guide.kindSituation}</p>
        <h2>{guideCopy(activity.id, 'titleEn', activity.titleEn)}</h2>
        <p className="guide-note">{guideCopy(activity.id, 'travelGuideContextEn', activity.travelGuideContextEn)}</p>
        {activity.visualDa && <p className="guide-target" lang={ACTIVE.code}>{activity.visualDa}</p>}
        {activity.visualSupportEn && <p className="dim">{guideCopy(activity.id, 'visualSupportEn', activity.visualSupportEn)}</p>}
        <p>{guideCopy(activity.id, 'promptEn', activity.promptEn)}</p>
        <p className="guide-note">{UI.guide.readerNote}</p>
      </div>
    </div>
  )
}
