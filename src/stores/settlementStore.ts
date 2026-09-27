import { z } from 'zod'
import type { GameState } from '../engine/types'
import type { ScheduledProgress } from '../journey/curriculumScheduler'
import type { SurvivalProgress } from '../journey/survival'
import { emptyProgressFacts, factsForImport, mergeProgressFacts, withLegacyCredit } from '../progression/facts'
import { effectKey, receiptKey } from '../progression/identity'
import { emptySettlementLedger, pendingSettlement, prepareSettlement, recoverSettlement, type SettlementInput } from '../progression/settlement'
import { curriculumSchema, markersSchema, parseLedger, parseSessions, receiptFingerprint, sameValue, survivalSchema, tallySchema, wordStatsSchema } from '../progression/storageSchema'
import type { CompletionReceipt, CourseSessions, LessonEffect, ProgressFacts, SettlementEffect, SettlementLedger } from '../progression/types'
import { prepareLearning } from '../srs/settlement'
import type { SrsMap } from '../srs/types'
import { useStreak } from '../streak/streak'
import { groupKey, roundGroups, useAssociations } from './associationStore'
import { migrateCurriculum, useCurriculum } from './curriculumStore'
import { migrateSrs, useSrs } from './srsStore'
import { migrateSurvival, useSurvival } from './survivalStore'
import { assertSettlementIdle, SESSION_KEY, SETTLEMENT_KEY, withEffectMarkers, withSettlementWriter, type AtomicStorage, type EffectMarkers } from './settlementStorage'

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const dictionary = <T extends z.ZodType>(schema: T) => z.record(z.string(), schema)
const srsSchema = z.object({ stats: dictionary(wordStatsSchema), games: tallySchema, translationPostcards: count, settlementEffects: markersSchema }).passthrough()
const streakSchema = z.object({ completedDays: dictionary(count), settlementEffects: markersSchema }).passthrough()
const associationsSchema = z.object({
  groups: dictionary(z.object({ ids: z.array(z.string()), by: z.enum(['player', 'ai']), count, lastAt: count })),
  traps: dictionary(z.array(z.string())), settlementEffects: markersSchema,
}).passthrough()
const curriculumStoreSchema = z.object({ byLanguage: dictionary(curriculumSchema), settlementEffects: markersSchema, settlementMilestones: dictionary(count) }).passthrough()
const survivalStoreSchema = z.object({ byLanguage: dictionary(survivalSchema), settlementEffects: markersSchema, settlementMilestones: dictionary(count) }).passthrough()
const envelope = z.object({ version: count, state: z.record(z.string(), z.unknown()) }).passthrough()
type DurableState = Record<string, unknown> & { settlementEffects: EffectMarkers }

export interface SettlementSessions {
  readonly byCourse: Readonly<Record<string, CourseSessions>>
  /** Result screens read the immutable receipt; they never execute this entry. */
  readonly results: Readonly<Record<string, { readonly receiptId: string; readonly reviewRoundId: string | null }>>
  readonly settlementEffects: EffectMarkers
}

export type FinishInput = Omit<SettlementInput, 'learning' | 'continuation'> & {
  readonly lookedUp: readonly string[]
}

export interface LessonPlanningInput {
  readonly receipt: CompletionReceipt
  readonly curriculum: ScheduledProgress | null
  readonly survival: SurvivalProgress | null
}

export interface SettlementOptions {
  readonly storage: AtomicStorage
  /** Pure, synchronous C1-09 mapping. Missing mapping blocks before receipt. */
  readonly planLessons?: (input: LessonPlanningInput) => LessonEffect
  /** Optional projection after a successful durable read, never before a write. */
  readonly published?: (key: string, state: unknown) => void
}

/**
 * Concrete localStorage transaction journal. Every mutation reads current
 * durable data, writes once, rereads, then publishes. No Zustand set() precedes
 * a storage write, and no legacy recordGame reward method is called.
 */
export function createSettlementStore(options: SettlementOptions) {
  const { storage } = options
  const publish = (key: string, state: unknown) => {
    options.published?.(key, structuredClone(state))
    if (typeof localStorage === 'undefined' || storage !== localStorage) return
    // Rehydrate only the value just validated/written. Current versions avoid
    // migration writes, preserving the effect+marker atomic boundary.
    const store = { 'cluecab-srs-v1': useSrs, 'cluecab-streak-v1': useStreak,
      'cluecab-associations-v1': useAssociations, 'cluecab-curriculum-v1': useCurriculum,
      'cluecab-survival-v1': useSurvival }[key]
    void store?.persist?.rehydrate()
  }
  const readLedger = (): SettlementLedger => {
    const raw = storage.getItem(SETTLEMENT_KEY)
    return raw === null ? emptySettlementLedger() : parseLedger(JSON.parse(raw))
  }
  const commitLedger = async (next: SettlementLedger) => {
    parseLedger(next)
    storage.setItem(SETTLEMENT_KEY, JSON.stringify(next))
    const durable = readLedger()
    if (!sameValue(durable, next)) throw new Error('Settlement write was not durable')
    publish(SETTLEMENT_KEY, durable)
  }
  const readState = <T extends Record<string, unknown>>(key: string, version: number, initial: T,
    schema: z.ZodType, migrate: (state: unknown, from: number) => unknown = withEffectMarkers): T & DurableState => {
    const raw = storage.getItem(key)
    if (raw === null) return schema.parse(structuredClone(initial)) as T & DurableState
    const saved = envelope.parse(JSON.parse(raw))
    if (saved.version > version) throw new Error(`Unsupported destination version: ${key}`)
    if (saved.version === version) return schema.parse(saved.state) as T & DurableState
    const state = migrate(saved.state, saved.version)
    // Defaults support old partial values; malformed present values fail closed.
    return schema.parse({ ...initial, ...(state as object) }) as T & DurableState
  }
  const readSrs = () => readState('cluecab-srs-v1', 7, {
    stats: {} as SrsMap, games: { played: 0, won: 0, redeemed: 0, lost: 0 }, translationPostcards: 0, settlementEffects: {},
  }, srsSchema, migrateSrs)
  const readCurriculum = () => readState('cluecab-curriculum-v1', 3, {
    byLanguage: {} as Record<string, ScheduledProgress>, settlementEffects: {}, settlementMilestones: {} as Record<string, number>,
  }, curriculumStoreSchema, migrateCurriculum)
  const readSurvival = () => readState('cluecab-survival-v1', 2, {
    byLanguage: {} as Record<string, SurvivalProgress>, settlementEffects: {}, settlementMilestones: {} as Record<string, number>,
  }, survivalStoreSchema, migrateSurvival)
  const readSessions = (): SettlementSessions => {
    const raw = storage.getItem(SESSION_KEY)
    if (raw === null) return { byCourse: {}, results: {}, settlementEffects: {} }
    const saved = envelope.parse(JSON.parse(raw))
    if (saved.version !== 1) throw new Error('Unsupported session version')
    const state = z.object({ byCourse: dictionary(z.unknown()), results: dictionary(z.object({ receiptId: z.string(), reviewRoundId: z.string().nullable() })), settlementEffects: markersSchema }).parse(saved.state)
    return { ...state, byCourse: Object.fromEntries(Object.entries(state.byCourse).map(([course, sessions]) => [course, parseSessions(sessions)])) }
  }
  const writeState = (key: string, version: number, state: unknown) => {
    const raw = JSON.stringify({ version, state })
    try { storage.setItem(key, raw) } catch (error) {
      storage.getItem(key) // An uncertain write is observed, never assumed absent.
      throw error
    }
    if (storage.getItem(key) !== raw) throw new Error(`Destination write was not durable: ${key}`)
    publish(key, state)
  }
  const once = <T extends DurableState>(key: string, version: number, state: T, effectId: string,
    r: CompletionReceipt, mutate: (state: T) => T) => {
    const fingerprint = receiptFingerprint(r)
    const marker = state.settlementEffects[effectId]
    if (marker !== undefined) {
      if (marker !== fingerprint) throw new Error('Effect marker payload conflict')
      publish(key, state) // Repair a stale in-memory projection after uncertain I/O.
      return 'already-applied' as const
    }
    const next = mutate(structuredClone(state))
    writeState(key, version, { ...next, settlementEffects: { ...next.settlementEffects, [effectId]: fingerprint } })
    return 'applied' as const
  }

  const applyEffectOnce = async (effectId: string, effect: SettlementEffect, r: CompletionReceipt): Promise<'applied' | 'already-applied'> => {
    // Even direct/mistaken calls cannot execute an uncommitted proposal.
    const durable = readLedger().settlements[r.receiptId]?.receipt
    if (!durable || !sameValue(durable, r) || effectId !== effectKey(r.receiptId, effect) || !r.effects.includes(effect)) throw new Error('Effect needs its durable receipt')
    switch (effect) {
      case 'learning':
        return once('cluecab-srs-v1', 7, readSrs(), effectId, r, (state) => {
          const stats = { ...state.stats }
          for (const patch of r.learning.changes) {
            if (!sameValue(stats[patch.wordId] ?? null, patch.before)) throw new Error('Learning before-state conflict')
            stats[patch.wordId] = { ...patch.after }
          }
          return { ...state, stats }
        })
      case 'games':
        return once('cluecab-srs-v1', 7, readSrs(), effectId, r, (state) => ({ ...state, games: tallySchema.parse({
          played: state.games.played + r.games.played, won: state.games.won + r.games.won,
          lost: state.games.lost + r.games.lost, redeemed: state.games.redeemed,
        }) }))
      case 'streak': {
        const state = readState('cluecab-streak-v1', 2, { completedDays: {} as Record<string, number>, settlementEffects: {} }, streakSchema)
        return once('cluecab-streak-v1', 2, state, effectId, r, (s) => ({ ...s, completedDays: {
          ...s.completedDays, [r.localDate]: count.parse((s.completedDays[r.localDate] ?? 0) + r.games.played),
        } }))
      }
      case 'associations': {
        const state = readState('cluecab-associations-v1', 2, {
          groups: {} as ReturnType<typeof useAssociations.getState>['groups'], traps: {} as Record<string, string[]>, settlementEffects: {},
        }, associationsSchema)
        return once('cluecab-associations-v1', 2, state, effectId, r, (s) => {
          for (const found of roundGroups(r.evidence.game as GameState)) {
            const key = groupKey(found.ids)
            s.groups[key] = { ids: found.ids, by: found.by, count: count.parse((s.groups[key]?.count ?? 0) + 1), lastAt: r.acceptedAt }
            if (found.traps.length) s.traps[key] = [...new Set([...(s.traps[key] ?? []), ...found.traps])]
          }
          return s
        })
      }
      case 'daily': {
        // Same namespace. Reader seam below accepts old bare values. Do not
        // write a separate bare projection: that would create a crash gap.
        const key = `cluecab-daily:${r.dailyKey}`
        const raw = storage.getItem(key)
        let state: unknown = { outcome: raw, settlementEffects: {} }
        if (raw !== null && !['won', 'lost', 'redeemed'].includes(raw)) {
          const saved = envelope.parse(JSON.parse(raw))
          if (saved.version !== 1) throw new Error('Unsupported daily version')
          state = saved.state
        }
        const parsed = z.object({ outcome: z.enum(['won', 'lost', 'redeemed']).nullable(), settlementEffects: markersSchema }).parse(state)
        return once(key, 1, parsed, effectId, r, (s) => ({ ...s, outcome: r.evidence.game.outcome!.result }))
      }
      case 'session': {
        const state = readSessions()
        return once(SESSION_KEY, 1, { ...state }, effectId, r, (s) => {
          const origin = r.evidence.origin
          const course = r.evidence.board?.courseId
          let reviewRoundId: string | null = null
          if (origin === 'primary' || origin === 'replay') {
            const sessions = course && s.byCourse[course]
            const slot = sessions && sessions[origin]
            if (!sessions || !slot || slot.attemptId !== r.attemptId || !sameValue(slot.board, r.evidence.board) ||
              !sameValue(slot.game, r.evidence.game)) throw new Error('Session attempt conflict')
            reviewRoundId = slot.reviewRoundId
            if (origin === 'primary') {
              const keys = sessions.continuation.remainingBoardKeys
              if (keys[0] !== r.primary?.completedBoardKey) throw new Error('Primary continuation conflict')
              const nextIndex = r.primary.nextBoardKey === null ? keys.length : keys.indexOf(r.primary.nextBoardKey)
              if (nextIndex < 1) throw new Error('Primary continuation conflict')
              s.byCourse = { ...s.byCourse, [course!]: { ...sessions,
                continuation: { ...sessions.continuation, remainingBoardKeys: keys.slice(nextIndex) },
              } }
            } else {
              // Keep the completed replay as the durable result owner until
              // the reader is explicitly dismissed. The primary remains
              // suspended and is resumed only after that reader is left.
              s.byCourse = { ...s.byCourse, [course!]: { ...sessions, activeSlot: null } }
            }
          }
          return { ...s, results: { ...s.results, [r.attemptId]: { receiptId: r.receiptId, reviewRoundId } } }
        })
      }
      case 'lessons': {
        const plan = r.lessons
        if (!plan) throw new Error('Missing captured lesson plan')
        const apply = <T extends { byLanguage: Record<string, unknown>; settlementMilestones: Record<string, number> } & DurableState>(
          state: T, patch: { before: unknown; after: unknown }): T => {
          if (!sameValue(state.byLanguage[plan.courseId] ?? null, patch.before)) throw new Error('Lesson before-state conflict')
          return { ...state, byLanguage: { ...state.byLanguage, [plan.courseId]: patch.after },
            settlementMilestones: { ...state.settlementMilestones, ...Object.fromEntries(r.newMilestoneIds.map((id) => [id, r.acceptedAt])) } }
        }
        const grammar = once('cluecab-curriculum-v1', 3, readCurriculum(), effectId, r, (s) => apply(s, plan.curriculum))
        const survival = once('cluecab-survival-v1', 2, readSurvival(), effectId, r, (s) => apply(s, plan.survival))
        return grammar === 'already-applied' && survival === 'already-applied' ? 'already-applied' : 'applied'
      }
    }
  }
  const recover = async () => {
    try {
      return await recoverSettlement(readLedger(), { commitLedger, applyEffectOnce })
    } catch (error) {
      // A write can succeed and then report failure. Reread immediately, but
      // still reject this call: Next must wait for a successful recovery.
      readLedger()
      throw error
    }
  }
  return {
    readLedger, readSessions,
    recover: () => withSettlementWriter(storage, recover),
    finish: (input: FinishInput) => withSettlementWriter(storage, async () => {
      let ledger = await recover()
      const existing = ledger.settlements[receiptKey(input.attempt.attemptId)]
      if (existing) {
        const prepared = prepareSettlement(ledger, { ...input, learning: existing.receipt.learning, continuation: null })
        if (prepared.status === 'blocked') throw new Error(prepared.reason)
        return prepared.receipt
      }
      const course = input.attempt.board?.courseId
      const sessions = course && readSessions().byCourse[course]
      if (input.attempt.origin === 'primary' || input.attempt.origin === 'replay') {
        const slot = sessions && sessions[input.attempt.origin]
        if (!slot || slot.attemptId !== input.attempt.attemptId || !sameValue(slot.game, input.attempt.game) ||
          !sameValue(slot.board, input.attempt.board) || !sameValue(slot.lookedUp, input.lookedUp)) throw new Error('Finish requires its persisted terminal slot')
      }
      const rawJourney = storage.getItem('cluecab-journey-v2')
      const wrapped = rawJourney === null ? {} : dictionary(count).parse(envelope.parse(JSON.parse(rawJourney)).state.wrapped ?? {})
      const learning = prepareLearning(input.attempt.game, input.lookedUp, readSrs().stats, wrapped, input.acceptedAt)
      const prepared = prepareSettlement(ledger, { ...input, learning, continuation: sessions ? sessions.continuation : null })
      if (prepared.status === 'blocked') throw new Error(prepared.reason)
      let receipt = prepared.receipt
      if (receipt.newMilestoneIds.length) {
        if (!options.planLessons || !course) throw new Error('A deterministic lesson planner is required before settlement')
        const curriculum = readCurriculum().byLanguage[course] ?? null
        const survival = readSurvival().byLanguage[course] ?? null
        const lessons = options.planLessons({ receipt: structuredClone(receipt), curriculum: structuredClone(curriculum), survival: structuredClone(survival) })
        if (lessons.courseId !== course || !sameValue(lessons.curriculum.before, curriculum) || !sameValue(lessons.survival.before, survival)) throw new Error('Lesson plan before-state conflict')
        receipt = { ...receipt, lessons }
      }
      ledger = { ...prepared.ledger, settlements: { ...prepared.ledger.settlements, [receipt.receiptId]: { receipt, acknowledgedEffects: [] } } }
      try { await commitLedger(ledger) } catch (error) { readLedger(); throw error }
      await recover()
      return readLedger().settlements[receipt.receiptId]!.receipt
    }),
    /** C1-08 persists both exact slots before it dispatches callbacks/events. */
    saveSessions: (course: string, sessions: CourseSessions) => {
      assertSettlementIdle(storage)
      const validated = parseSessions(sessions)
      if (validated.continuation.requiredSet.courseId !== course ||
        [validated.primary, validated.replay].some((slot) => slot && slot.board.courseId !== course)) throw new Error('Session course mismatch')
      const ledger = readLedger()
      for (const slot of [validated.primary, validated.replay]) {
        if (!slot) continue
        const accepted = ledger.settlements[receiptKey(slot.attemptId)]?.receipt.evidence
        if (accepted && (!sameValue(slot.board, accepted.board) || slot.origin !== accepted.origin || !sameValue(slot.game, accepted.game))) {
          throw new Error('Cannot reuse a settled attempt ID')
        }
      }
      const state = readSessions()
      writeState(SESSION_KEY, 1, { ...state, byCourse: { ...state.byCourse, [course]: validated } })
    },
    /**
     * Dismiss a settled result reader without touching its receipt, facts, or
     * effect markers. A terminal slot is the durable resume pointer; once the
     * reader is explicitly left, only that pointer and its result index entry
     * are retired. Pending or mismatched attempts fail closed so recovery can
     * still finish them on the next load.
     */
    dismissResult: (course: string, slotName: 'primary' | 'replay', attemptId: string): boolean => {
      assertSettlementIdle(storage)
      const sessions = readSessions().byCourse[course]
      const slot = sessions?.[slotName]
      const state = readSessions()
      const pointer = state.results[attemptId]
      const receipt = readLedger().settlements[receiptKey(attemptId)]?.receipt
      if (!sessions || !slot || slot.attemptId !== attemptId || slot.origin !== slotName ||
        slot.game.phase !== 'finished' || !pointer || !receipt || pointer.receiptId !== receipt.receiptId ||
        pointer.reviewRoundId !== slot.reviewRoundId || receipt.attemptId !== attemptId ||
        receipt.evidence.origin !== slotName || receipt.evidence.game.phase !== 'finished' ||
        !sameValue(receipt.evidence.game, slot.game)) return false
      const nextSessions: CourseSessions = {
        ...sessions,
        [slotName]: null,
        activeSlot: slotName === 'replay' && sessions.primary
          ? 'primary'
          : sessions.activeSlot === slotName ? null : sessions.activeSlot,
      }
      const { [attemptId]: _dismissed, ...results } = state.results
      writeState(SESSION_KEY, 1, { ...state, byCourse: { ...state.byCourse, [course]: nextSessions }, results })
      return true
    },
    /** Validated C1-06 facts only; incoming receipts are never executable jobs. */
    mergeFacts: (incoming: ProgressFacts) => withSettlementWriter(storage, async () => {
      const accepted = factsForImport(incoming)
      const ledger = await recover()
      const next = { ...ledger, facts: mergeProgressFacts(ledger.facts, accepted) }
      try { await commitLedger(next) } catch (error) { readLedger(); throw error }
      return readLedger()
    }),
    /** Caller normalizes the source version; one credit identity takes a max. */
    preserveLegacyCredit: (amount: number) => withSettlementWriter(storage, async () => {
      const credit = withLegacyCredit(emptyProgressFacts(), amount)
      const ledger = await recover()
      try { await commitLedger({ ...ledger, facts: mergeProgressFacts(ledger.facts, credit) }) } catch (error) { readLedger(); throw error }
      return readLedger()
    }),
    isFullyRecorded: () => pendingSettlement(readLedger()) === null,
  }
}

/** C1-08/Home must use this reader when it adopts the versioned daily value. */
export function readDailyOutcome(storage: AtomicStorage, dailyKey: string): 'won' | 'lost' | 'redeemed' | null {
  const raw = storage.getItem(`cluecab-daily:${dailyKey}`)
  if (raw === null) return null
  if (raw === 'won' || raw === 'lost' || raw === 'redeemed') return raw
  const saved = envelope.parse(JSON.parse(raw))
  if (saved.version !== 1) throw new Error('Unsupported daily version')
  markersSchema.parse(saved.state.settlementEffects)
  return z.enum(['won', 'lost', 'redeemed']).nullable().parse(saved.state.outcome)
}
