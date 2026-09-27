import type {
  CurriculumExit,
  CurriculumManifest,
  EvidenceRecord,
  OptionalItemState,
  PostWrapItem,
} from '../lang/curriculum'

/**
 * T5's small, deterministic scheduler.  It deliberately knows nothing about
 * words, SRS, wrapping, or travel: a wrap-up merely gives it an opportunity
 * to offer one optional item.  Keeping that boundary pure is what stops a
 * deferred lesson becoming a second journey gate.
 */
export const REVIEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export interface ScheduledProgress {
  readonly routeLanguage: string
  readonly itemStates: Readonly<Record<string, OptionalItemState>>
  readonly evidence: Readonly<Record<string, readonly EvidenceRecord[]>>
  readonly dueAt: Readonly<Record<string, number>>
  readonly activeItemId: string | null
  /**
   * Evidence from P2's optional post-round sentence review.  Unlike the
   * optional-route records above this is keyed by the concrete example and
   * focus target, so a Danish sentence can be revisited without pretending a
   * later language route has already practised it.
   */
  readonly sentenceReviewEvidence: Readonly<Record<string, readonly SentenceReviewEvidence[]>>
}

/** One real response to one authored focus prompt — never a Continue tap. */
export interface SentenceReviewEvidence {
  readonly wordId: string
  readonly focusId: string
  readonly attemptedAt: number
  readonly correct: boolean
  /** Hearing the Danish prompt is meaningful exposure; the answer is retrieval. */
  readonly exposure: true
  readonly retrieval: true
}

export interface ScheduledItem {
  readonly id: string
  readonly cityIndex: number
  readonly kind: 'grammar' | 'situation' | 'exit' | 'review'
  readonly supportItemIds: readonly string[]
}

export const initialCurriculumProgress = (routeLanguage: string): ScheduledProgress => ({
  routeLanguage,
  itemStates: {},
  evidence: {},
  dueAt: {},
  activeItemId: null,
  sentenceReviewEvidence: {},
})

export function sentenceReviewKey(wordId: string, focusId: string): string {
  return `${wordId}\u0000${focusId}`
}

/** A week mirrors the route scheduler's spaced review interval. */
export function sentenceFocusIsDue(
  evidence: ScheduledProgress['sentenceReviewEvidence'],
  wordId: string,
  focusId: string,
  now: number,
): boolean {
  const attempts = evidence[sentenceReviewKey(wordId, focusId)]
  const last = attempts?.at(-1)
  return !last || last.attemptedAt + REVIEW_AFTER_MS <= now
}

export function recordSentenceReview(
  progress: ScheduledProgress,
  evidence: SentenceReviewEvidence,
): ScheduledProgress {
  const key = sentenceReviewKey(evidence.wordId, evidence.focusId)
  return {
    ...progress,
    sentenceReviewEvidence: {
      ...progress.sentenceReviewEvidence,
      [key]: [...(progress.sentenceReviewEvidence[key] ?? []), evidence],
    },
  }
}

function itemFor(manifest: CurriculumManifest, cityIndex: number, id: string): ScheduledItem | null {
  const city = manifest.cities[cityIndex]
  if (!city) return null
  const post = city.postWrapQueue.find((item) => item.id === id)
  if (post) return { ...post, cityIndex }
  if (city.exit.id === id) {
    return {
      id,
      cityIndex,
      kind: 'exit',
      supportItemIds: city.exit.evidence.flatMap((e) => e.supportItemIds),
    }
  }
  return null
}

export function scheduledItem(
  manifest: CurriculumManifest,
  cityIndex: number,
  id: string,
): ScheduledItem | null {
  return itemFor(manifest, cityIndex, id)
}

function nextUntouched(queue: readonly PostWrapItem[], states: Readonly<Record<string, OptionalItemState>>) {
  return queue.find((item) => !states[item.id] || states[item.id] === 'locked')
}

/** The current item, if any, must belong to the city the offer names. */
export function currentScheduledItem(
  manifest: CurriculumManifest,
  progress: ScheduledProgress,
  cityIndex: number,
): ScheduledItem | null {
  return progress.activeItemId ? itemFor(manifest, cityIndex, progress.activeItemId) : null
}

/** The one invitation visible after a city wrap-up, newest/due item first. */
export function offeredScheduledItem(
  manifest: CurriculumManifest,
  progress: ScheduledProgress,
  cityIndex: number,
): ScheduledItem | null {
  const city = manifest.cities[cityIndex]
  if (!city) return null
  const post = city.postWrapQueue.find((item) => progress.itemStates[item.id] === 'offered')
  return post
    ? { ...post, cityIndex, kind: progress.dueAt[post.id] ? 'review' : post.kind }
    : progress.itemStates[city.exit.id] === 'offered'
    ? itemFor(manifest, cityIndex, city.exit.id)
    : null
}

/**
 * Offer exactly one thing after a wrap-up. Existing invitations age into
 * `available` rather than blocking the queue; deferred work remains in the
 * guide and is never silently marked complete. Due reviews outrank new work.
 */
export function offerAfterWrap(
  manifest: CurriculumManifest,
  progress: ScheduledProgress,
  cityIndex: number,
  now: number,
): ScheduledProgress {
  const city = manifest.cities[cityIndex]
  if (!city || progress.activeItemId) return progress

  const states = { ...progress.itemStates }
  for (const item of city.postWrapQueue) {
    if (states[item.id] === 'offered') states[item.id] = 'available'
  }
  if (states[city.exit.id] === 'offered') states[city.exit.id] = 'available'

  const due = city.postWrapQueue.find(
    (item) => states[item.id] === 'completed' && (progress.dueAt[item.id] ?? Infinity) <= now,
  )
  if (due) return { ...progress, itemStates: { ...states, [due.id]: 'offered' } }

  const next = nextUntouched(city.postWrapQueue, states)
  if (next) return { ...progress, itemStates: { ...states, [next.id]: 'offered' } }

  if (!states[city.exit.id] || states[city.exit.id] === 'locked') {
    return { ...progress, itemStates: { ...states, [city.exit.id]: 'offered' } }
  }
  return { ...progress, itemStates: states }
}

export function beginItem(
  manifest: CurriculumManifest,
  progress: ScheduledProgress,
  cityIndex: number,
  id: string,
): ScheduledProgress {
  const item = itemFor(manifest, cityIndex, id)
  if (!item || progress.activeItemId) return progress
  const state = progress.itemStates[id]
  if (!['offered', 'available', 'deferred', 'skipped'].includes(state ?? 'locked')) return progress
  return { ...progress, activeItemId: id, itemStates: { ...progress.itemStates, [id]: 'available' } }
}

export function deferItem(progress: ScheduledProgress): ScheduledProgress {
  const id = progress.activeItemId
  if (!id) return progress
  return { ...progress, activeItemId: null, itemStates: { ...progress.itemStates, [id]: 'deferred' } }
}

export function skipItem(progress: ScheduledProgress): ScheduledProgress {
  const id = progress.activeItemId
  if (!id) return progress
  return { ...progress, activeItemId: null, itemStates: { ...progress.itemStates, [id]: 'skipped' } }
}

/**
 * T6 calls this only after an authored activity has been attempted. T5 does
 * not invent an attempt from its neutral placeholder UI. A completion creates
 * one evidence record per mode and schedules a later review.
 */
export function completeItem(
  progress: ScheduledProgress,
  record: EvidenceRecord,
): ScheduledProgress {
  const id = progress.activeItemId
  if (!id) return progress
  const prior = progress.evidence[id] ?? []
  return {
    ...progress,
    activeItemId: null,
    itemStates: { ...progress.itemStates, [id]: 'completed' },
    evidence: { ...progress.evidence, [id]: [...prior, record] },
    dueAt: { ...progress.dueAt, [id]: record.attemptedAt + REVIEW_AFTER_MS },
  }
}

export function exitFor(manifest: CurriculumManifest, cityIndex: number): CurriculumExit | null {
  return manifest.cities[cityIndex]?.exit ?? null
}
