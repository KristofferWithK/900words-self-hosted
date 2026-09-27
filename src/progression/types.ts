import type { GameState } from '../engine/types'
import type { UiLanguage } from '../i18n/types'
import type { LanguageCode } from '../lang/types'
import type { RoundWordResult, WordStats } from '../srs/types'
import type { ScheduledProgress } from '../journey/curriculumScheduler'
import type { SurvivalProgress } from '../journey/survival'

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'
/** G1 A1 is prospective; C1-PC-1 remains the historical receipt revision. */
export type ContractRevision = 'C1-PC-1' | 'C1-G1-A1'
export type RewardComponent = 'spinWin' | 'solved' | 'solvedAndTranslated'
export type AttemptOrigin = 'primary' | 'replay' | 'daily' | 'developer' | 'optional' | 'tutorial' | 'retired-wrapup'
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T

export interface CityIdentity {
  readonly courseId: LanguageCode
  readonly cityId: string
}

/** A one-time practice award is scoped to this local profile and route. */
export interface TutorialAwardIdentity extends CityIdentity {
  readonly profileKey: string
  readonly policyRevision: string
}

export interface TutorialAwardFact {
  readonly identity: TutorialAwardIdentity
  readonly sourceAttemptId: string
  readonly acceptedAt: number
}
export interface TutorialAwardReceipt {
  readonly identity: TutorialAwardIdentity
  readonly sourceAttemptId: string
  readonly status: 'new' | 'already-held'
  readonly postcards: 0 | 1
}

export interface BoardIdentity extends CityIdentity {
  readonly authoredBoardId: string
  readonly contentRevision: string
}

export interface RequiredSetIdentity extends CityIdentity {
  readonly setVersion: string
}

/** Frozen membership. Optional inventory and display ordering live elsewhere. */
export interface RequiredBoardSet extends RequiredSetIdentity {
  readonly boards: readonly BoardIdentity[]
}

export interface AuthoredBoardContent {
  readonly board: BoardIdentity
  readonly wordIds: readonly string[]
  readonly playerGreenIds: readonly string[]
  readonly aiGreenIds: readonly string[]
}

export interface AttemptEvidence {
  readonly attemptId: string
  readonly board: BoardIdentity | null
  readonly origin: AttemptOrigin
  readonly game: GameState
  readonly cancelled?: boolean
}

export interface PrimaryContinuation {
  readonly requiredSet: RequiredSetIdentity
  /** Persisted stable keys, current first; never a modulo cursor. */
  readonly remainingBoardKeys: readonly string[]
  readonly source: 'canonical' | 'legacy-anchor'
}

/** Only serializable round state; no requests, callbacks, timers or promises. */
export interface AttemptSlot {
  readonly attemptId: string
  readonly board: BoardIdentity
  readonly origin: 'primary' | 'replay'
  readonly promptLanguage: UiLanguage
  readonly game: GameState
  readonly lookedUp: readonly string[]
  readonly reviewRoundId: string | null
  /** Pins existing seed/fill/attempt-counter policy, not a new random draw. */
  readonly randomnessPolicy: 'engine-wheel-v1'
}

export interface CourseSessions {
  readonly continuation: PrimaryContinuation
  readonly primary: AttemptSlot | null
  readonly replay: AttemptSlot | null
  readonly activeSlot: 'primary' | 'replay' | null
}

/** Generation is volatile: increment on reload/switch/cancel/import. */
export interface AttemptEventOwner {
  readonly attemptId: string
  readonly slot: 'primary' | 'replay'
  readonly generation: number
}

export interface BoardProgress {
  readonly board: BoardIdentity
  /** Recorded completed-attempt evidence; never derive this from claims. */
  readonly best: Tier
  readonly claims: readonly RewardComponent[]
}

export interface FirstPrimaryCompletion {
  readonly board: BoardIdentity
  readonly requiredSet: RequiredSetIdentity
}

export interface MilestoneFact {
  readonly requiredSet: RequiredSetIdentity
  readonly completedCount: number
  readonly notificationHandled: boolean
}

/** Portable settled facts. No executable receipts, effects, slots or balance. */
export interface ProgressFacts {
  readonly boards: Readonly<Record<string, BoardProgress>>
  /** Terminal losses consume a board attempt without creating a ranked best. */
  readonly completedLosses: Readonly<Record<string, CompletedLoss>>
  readonly firstPrimaryCompletions: Readonly<Record<string, FirstPrimaryCompletion>>
  readonly milestones: Readonly<Record<string, MilestoneFact>>
  readonly cityAchievements: Readonly<Record<string, { readonly requiredSet: RequiredSetIdentity; readonly tier: Tier }>>
  readonly legacyCredit: { readonly identity: 'danish-city1-legacy-v1'; readonly amount: number }
  /** Durable proof of the one-time qualifying tutorial postcard. */
  readonly tutorialAwards: Readonly<Record<string, TutorialAwardFact>>
}

export interface CompletedLoss {
  readonly board: BoardIdentity
  readonly firstPrimary: boolean
}

export interface LearningEffect {
  /** Computed from real clues/guesses/lookups, never from tier or translation. */
  readonly results: readonly Readonly<RoundWordResult>[]
  /** Exact scheduler output at acceptedAt; recovery never recomputes time. */
  readonly changes: readonly { readonly wordId: string; readonly before: Readonly<WordStats> | null; readonly after: Readonly<WordStats> }[]
  readonly newlyCollected: readonly string[]
  readonly newlyDiscovered: readonly string[]
}

export interface GameDelta {
  readonly played: 0 | 1
  readonly won: 0 | 1
  readonly lost: 0 | 1
  readonly redeemed: 0
}

/** C1-09 supplies the pure mapping; C1-05 commits its exact output before I/O. */
export interface LessonEffect {
  readonly courseId: LanguageCode
  readonly curriculum: { readonly before: ScheduledProgress | null; readonly after: ScheduledProgress }
  readonly survival: { readonly before: SurvivalProgress | null; readonly after: SurvivalProgress }
}

export interface RewardDelta {
  readonly eligible: readonly RewardComponent[]
  readonly alreadyHeld: readonly RewardComponent[]
  readonly newlyClaimed: readonly RewardComponent[]
  readonly postcards: number
}

/** Fixed local sinks, not a general event bus. Progress facts commit with receipt. */
export type SettlementEffect = 'learning' | 'games' | 'streak' | 'associations' | 'daily' | 'session' | 'lessons'

export interface CompletionReceipt {
  readonly schemaVersion: 1
  readonly contractRevision: ContractRevision
  readonly receiptId: string
  readonly attemptId: string
  readonly acceptedAt: number
  /** Captured local date; a later timezone change cannot move the streak day. */
  readonly localDate: string
  readonly evidence: DeepReadonly<AttemptEvidence>
  readonly attemptTier: Tier
  /** A1 losses retain Bronze as presentation only; no best or claims are earned. */
  /** Present on G1 receipts; omitted from historical C1-PC-1 payloads. */
  readonly completedLoss?: boolean
  readonly previousBest: Tier | null
  readonly newBest: Tier | null
  readonly cityEligible: boolean
  readonly rewards: RewardDelta
  readonly tutorialAward?: TutorialAwardReceipt
  readonly learning: LearningEffect
  readonly games: GameDelta
  readonly dailyKey: string | null
  readonly primary: {
    readonly completedBoardKey: string
    readonly firstCompletionId: string | null
    readonly nextBoardKey: string | null
  } | null
  readonly newMilestoneIds: readonly string[]
  readonly lessons?: LessonEffect
  readonly effects: readonly SettlementEffect[]
}

export interface LocalSettlement {
  readonly receipt: CompletionReceipt
  readonly acknowledgedEffects: readonly SettlementEffect[]
}

/** Sole local progression authority, atomically persisted as one value. */
export interface SettlementLedger {
  readonly schemaVersion: 1
  readonly facts: ProgressFacts
  readonly settlements: Readonly<Record<string, LocalSettlement>>
}

/** Backup evidence has no effect list or scheduler input to execute. */
export type SettledReceiptFact = Pick<CompletionReceipt,
  'schemaVersion' | 'contractRevision' | 'receiptId' | 'attemptId' | 'acceptedAt' | 'localDate' |
  'attemptTier' | 'completedLoss' | 'previousBest' | 'newBest' | 'cityEligible' | 'rewards' | 'games'> & {
  readonly board: BoardIdentity | null
  readonly origin: AttemptOrigin
  readonly newlyCollected: readonly string[]
  readonly newlyDiscovered: readonly string[]
}

/** Adapter contract only; C1-05 supplies actual durable I/O and fault tests. */
export interface SettlementPersistence {
  /** Resolve only after a durable atomic replacement; rejection is not success. */
  commitLedger(next: SettlementLedger): Promise<void>
  /** Destination atomically stores its mutation AND this effect ID together. */
  applyEffectOnce(effectId: string, effect: SettlementEffect, receipt: CompletionReceipt): Promise<'applied' | 'already-applied'>
}
