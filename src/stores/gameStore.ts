import { UI, UI_LANGUAGE } from '../i18n'
import type { UiLanguage } from '../i18n'
import { CITY1_CATALOG, selectQueue, restoreQueue, nextSentence, type QueueState } from '../review/city1'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { track } from '../analytics/stats'
import { AiError, type DecisionFn } from '../ai/client'
import {
  OllamaCompanion,
  isAuthoredResponse,
  planGuessExecution,
  type CallReport,
  type Companion,
} from '../ai/companion'
import { MockCompanion } from '../ai/mock/mockCompanion'
import { onDeviceCaseyAvailable, playsOnDevice, requestGemmaDecision } from '../ai/gemma/gate'
import { ownKeyAvailable, requestOwnKeyDecision } from '../ai/ownKey/gate'
import { TutorialCompanion } from '../ai/tutorialCompanion'
import { buildAiClueView, buildAiGuessView } from '../ai/projections'
import type { GuessResponse, TranslationResponse } from '../ai/schemas'
import { playerLanguageFor } from '../ai/playerLanguage'
import rawOpeningClues from '../data/city1-opening-clues.da.json'
import {
  BOARD,
  caseyTopTwoAssistanceEnabled,
  TUTORIAL_CONFIG,
  shippedBoardConfig,
  type GridConfig,
} from '../engine/config'
import { chooseCaseyGuess } from '../engine/caseyAssist'
import {
  applyEvent as applyEventIn,
  createGame,
  currentClue,
  targetableGreenIds,
  wheelFoundIds,
} from '../engine/game'
import { matchesAnswer } from '../engine/packing'
import { mulberry32 } from '../engine/rng'
import type { GameState } from '../engine/types'
import { selectBoardWords, selectDailyWords } from '../srs/sampler'
import { boardWordFor } from '../data/lookup'
import { WORDS, isHeadword, wordById } from '../data/words'
import { CITY1_BOARD_CYCLE, city1BoardAt } from '../data/city1BoardCycle'
import { boardKey, receiptKey } from '../progression/identity'
import { sameValue } from '../progression/storageSchema'
import type { AttemptOrigin, AttemptSlot, BoardIdentity, CompletionReceipt, CourseSessions, SettlementLedger } from '../progression/types'
import { initialCourseSessions, nextRequiredBoard, requiredContent, requiredSetForCourse, sameEventOwner, validateCourseSessions, type RuntimeEventOwner } from '../session/courseRuntime'
import { createSettlementStore, readDailyOutcome, type SettlementOptions } from './settlementStore'
import { historyArchive } from './historyArchive'
import { profileKey, tutorialAwardIdentity } from '../progression/tutorialAward'
import { assertSettlementIdle, transferAwareStorage, type AtomicStorage } from './settlementStorage'
import { planRuntimeLessons } from '../journey/lessonMilestones'
import { legacyRoundEvidence, migrateLegacyProfile, rebaseSavedQueues, retireUnstampedSessions } from './saveMigration'
import { recoverSaveTransfer, readSaveMigration, saveTransferRevision, SAVE_MIGRATION_KEY } from './saveTransfer'
import {
  TUTORIAL_CLUE_NUMBERS,
  TUTORIAL_SEED,
  TUTORIAL_WORD_IDS,
} from '../onboarding/tutorial'
import { ACTIVE } from '../lang/active'
import { recordPlayerClue } from './clueTally'
import { DEFAULT_LANGUAGE } from '../lang/index'
import type { LanguageCode } from '../lang/types'
import { isCollected, journeyRank, wordsForCity } from '../journey/progress'
import type { RoundMode } from '../journey/wrapup'
import { cafeLaunchRefused } from '../journey/cafeAccess'
import { flagsFor, useFeedback } from './feedbackStore'
import { useLedger } from './ledgerStore'
import { useJourney } from './journeyStore'
import { practiceNeed } from '../srs/scheduler'
import { useSettings } from './settingsStore'
import { useSrs } from './srsStore'
import { refreshDailyReminder } from '../reminders/reminders'
import { canDeveloperContinue, canStartDailyGame } from '../purchase/dailyGames'
import { devSwitchesAllowed, useUi } from './uiStore'
import { roundEventId, shareCompletedRound } from '../dataSharing/client'
import {
  canCertifyCity,
  takeCertifiedBoard,
} from '../boardCertification'
import { completedClue, guessErrorBlip, guessResultHaptic, rewardHaptic, wheelWinFanfare } from '../ui/feedback'
import { playWord } from '../ui/speak'

/**
 * The engine takes the language pack as a parameter (H1) so it can stay free of
 * data; the app has exactly one active language, so it is bound once here
 * rather than at each of the six call sites.
 */
const applyEvent = (
  s: Parameters<typeof applyEventIn>[0],
  e: Parameters<typeof applyEventIn>[1],
) => applyEventIn(s, e, ACTIVE)

/**
 * The spin's CSS ease-out duration. WheelSpinner normally clears the verdict
 * hold on the SVG's actual transitionend; the store's bounded failsafe runs
 * one second after the 3s transition window in case that renderer is lost.
 */
const SPIN_MS = 3000
const SPIN_FALLBACK_GRACE_MS = 1000

// UI-only decision metadata: neither persisted nor sent back to the Worker.
type PlannedGuess = GuessResponse['guesses'][number] & { secondChoiceWordId?: string }

export interface NewGameOptions {
  seed?: number
  // There was a `gridSize` here, so a caller could deal a board other than the
  // stored one. There is one board (N1), so seed and dailyKey are all that is
  // left to say about a deal.
  /** Set for the shared daily challenge (local date, e.g. "2026-08-12"). */
  dailyKey?: string
  /**
   * The route-relative city whose hundred-word pool supplies this ordinary
   * round. This is deliberately round context, not journey position: replaying
   * Ribe must never teleport the traveller back from Aarhus.
   */
  cityIndex?: number
  /** Onboarding may honour an authored board's declared opening seat. */
  firstGiver?: 'player' | 'ai'
  /** One-action developer escape while StoreKit cannot verify; never persisted. */
  developerContinue?: boolean
}

export interface RoundGuidance {
  opening: 'pending' | 'announced' | 'dismissed'
  /** History length at the round's first player lesson; non-null means already announced. */
  playerClueTurn: number | null
  /**
   * The last chance, announced once when the clues run out (owner,
   * 2026-09-11: "going into last chance should have a pop-up banner as
   * well"). Optional because saves written before it exist: absent reads as
   * pending, so a round found in its last chance is told so once.
   */
  lastChance?: 'pending' | 'announced' | 'dismissed'
  translation?: 'pending' | 'announced' | 'dismissed'
  /**
   * The wrap-up's opening lesson: what the packing phase is, and that the
   * round can be started before it is finished. Only a wrap-up deal sets it
   * pending — every other round reads 'dismissed' and never meets the panel.
   *
   * Optional because saves written before it exists have no field, and absent
   * reads as DISMISSED rather than pending — the opposite of lastChance,
   * deliberately. A round found mid-packing on an old save is one the player
   * is already partway through; a panel explaining what they are doing would
   * arrive after they had worked it out. The last chance is the other way:
   * its rule is one you need before your next tap, whenever you meet it.
   */
  packing?: 'pending' | 'announced' | 'dismissed'
}

/**
 * `packing: true` for the two wrap-up deals, which are also the two deals
 * that own a packing phase; everywhere else the field is dismissed from the
 * start, so nothing but a wrap-up can announce that panel.
 */
const newRoundGuidance = (game: GameState, packing = false): RoundGuidance => ({
  opening: game.phase === 'aiClueInput' ? 'pending' : 'dismissed',
  playerClueTurn: null,
  lastChance: 'pending',
  translation: 'pending',
  packing: packing ? 'pending' : 'dismissed',
})

type DurableResultPointers = Readonly<Record<string, { readonly receiptId: string; readonly reviewRoundId: string | null }>>

/** One reader for Home's affordance and its in-memory result projection. */
export function retainedResultReceipt(
  slotName: 'primary' | 'replay',
  sessions: CourseSessions | null,
  results: DurableResultPointers,
  settlements: SettlementLedger['settlements'],
): CompletionReceipt | null {
  const slot = sessions?.[slotName]
  const result = slot && results[slot.attemptId]
  const receipt = slot && settlements[receiptKey(slot.attemptId)]?.receipt
  if (!slot || slot.origin !== slotName || slot.game.phase !== 'finished' || !result || !receipt ||
    result.receiptId !== receipt.receiptId || result.reviewRoundId !== slot.reviewRoundId ||
    receipt.attemptId !== slot.attemptId || receipt.evidence.origin !== slotName ||
    receipt.evidence.game.phase !== 'finished' || !sameValue(receipt.evidence.game, slot.game)) return null
  return receipt
}

// A receipt reader is deliberately transient. The game cache is a display
// cache, and re-opening a settled result must not rewrite it or any authority.
let suppressGameCachePersistence = false
function gameCacheStorage() {
  const storage = transferAwareStorage(localStorage)
  return {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => {
      if (!suppressGameCachePersistence) return storage.setItem(key, value)
    },
    removeItem: (key: string) => {
      if (!suppressGameCachePersistence) return storage.removeItem(key)
    },
  }
}

/** Which guidance panel is up. Transient: an announced panel never reopens on reload or resume. */
export type ActiveRoundGuidance = 'casey' | 'player' | 'translation' | 'last-chance' | 'packing' | null
/** Why a deal was refused; see `GameStore.lastDealRefusal`. */
export type DealRefusal = 'cafeNotFound' | 'dailyLimit'

interface GameStore {
  /** One-time legacy snapshot; moved to the recovery archive before play. */
  legacySave: Record<string, unknown> | null
  migrationNotice: boolean
  dismissMigrationNotice: () => void
  /** The session value is authoritative; these fields project the active slot. */
  attemptId: string | null
  attemptOrigin: AttemptOrigin | null
  activeSlot: 'primary' | 'replay' | null
  /**
   * A transient-intro tutorial parks a real course slot, then returns exactly
   * to it when the player skips or completes the replayed intro. It is kept
   * only in the tutorial cache; ordinary course sessions remain the authority.
   */
  tutorialResumeSlot: 'primary' | 'replay' | null
  sessions: CourseSessions | null
  completionReceipt: CompletionReceipt | null
  settlementBusy: boolean
  /** Diagnostic detail; the existing error surface uses localized copy. */
  settlementFailure: string | null
  eventGeneration: number
  courseExhausted: boolean
  /**
   * Why the last `newGame` or `startReplay` call dealt nothing, for the screen
   * to say so (CW-10, CW-15); null when it dealt, resumed, or has not been
   * asked. `'cafeNotFound'`: the next required board is a café no walk has
   * found yet (journey/cafeAccess.ts, only while `CAFE_GATE_ENABLED`).
   * `'dailyLimit'`: today's free puzzles are used up (the upgrade dialog is
   * also opened, as before). Other refusals (a settlement in progress, the
   * course finished, which `courseExhausted` says) leave it null. Transient:
   * not in `partialize`, so never saved. The boolean results are unchanged.
   */
  lastDealRefusal: DealRefusal | null
  startReplay: (authoredBoardId: string, developerContinue?: boolean) => boolean
  resumePrimary: () => void
  resumeReplay: () => void
  /** Restore the course slot parked by a transient tutorial, never settle it. */
  restoreTutorialSuspension: () => boolean
  /** Receipt-only recovery for Home after a no-queue restart. Never settles. */
  resumeResult: (slot: 'primary' | 'replay') => boolean
  /** Explicitly leave a settled result; preserves the receipt and all claims. */
  dismissResult: () => boolean
  pauseGame: () => void
  recoverSession: () => Promise<void>
  eventOwner: () => RuntimeEventOwner
  ownsEvent: (owner: RuntimeEventOwner) => boolean
  dailyOutcome: (dailyKey: string) => ReturnType<typeof readDailyOutcome>
  reviewRoundId: string | null
  sentenceReview: QueueState | null
  nextReviewSentence: () => void
  dismissSentenceReview: () => void
  /** Persisted with the round; absence on an older save never means a new deal. */
  roundGuidance: RoundGuidance | null
  /** Transient: an announced panel never reopens on reload or resume. */
  activeRoundGuidance: ActiveRoundGuidance
  announceRoundGuidance: () => void
  /** `hideReminder`: the panel's "Don't remind me again" box (Your turn and Translation time). */
  dismissRoundGuidance: (hideReminder?: boolean) => void
  /**
   * The onboarding translation lesson taught this round's translation step on
   * the live controls, so the ordinary translation panel is not announced
   * after it. Guidance state only; no game, grading or reward state changes.
   */
  retireTranslationGuidance: () => void
  /**
   * While a decided spin's ease-out is still on screen the store holds the
   * verdict's UI handoff back — the chooser after a win, the summary after a
   * miss — so the wheel stays mounted long enough to be SEEN spinning
   * (owner, 2026-09-17: "it's just an instant result that is not satisfying
   * to watch"). The engine's synchronous result is fine; the renderer owns
   * the presentation timing. Transient on purpose: a reload mid-hold simply
   * shows the chooser or summary, and this is not in the persisted round.
   */
  wheelSpinHold: boolean
  clearWheelSpinHold: (owner?: RuntimeEventOwner) => void
  /**
   * The board stays up after the spin, with every suitcase showing its Danish,
   * until the player taps "See results" (owner, 2026-09-27): the answers they
   * did not type are the last thing the round teaches, and the finish screen
   * used to replace the board the moment the disc stopped. Set with the hold,
   * outlasts it, and is transient in the same way: a reload shows the summary.
   */
  wheelReview: boolean
  closeWheelReview: () => void
  game: GameState | null
  /**
   * The language the persisted round is in. Checked on rehydrate; a round in
   * another language is dropped rather than resumed. See `dropForeignGame`.
   */
  gameLanguage: LanguageCode
  /**
   * The UI language the round was played in, stamped beside `gameLanguage` and
   * checked the same way on rehydrate (§9.3 step 6): the cards' glosses change
   * with the player's language, so a round paused in one reads differently
   * after a switch. A NEW OPTIONAL persisted field — saves written before it
   * simply lack it, and the rehydrate check treats an absent stamp as a
   * mismatch and drops the round, so no version bump or migration is needed.
   */
  gameUiLanguage: UiLanguage
  /**
   * The city that supplied the in-flight/most recently finished ordinary
   * board. It is stamped alongside gameLanguage because city indices belong to
   * a route, while the SRS keys on the cards already carry their language.
   */
  boardCityIndex: number
  /** Word ids looked up in the dictionary this round (SRS signal). */
  lookedUp: string[]
  /**
   * The last four remembered boards dealt, newest first. The sampler reads the
   * newest two so the next deal can put exactly
   * three words of the newest back and keep the rest off both.
   *
   * Four rather than two: three carried words that may carry again chain
   * forward, and the sampler needs to see the board before last to know which
   * three have already had their turn, while BQ1's server-only semantic-pair
   * guard needs four boards. Only word ids are retained or sent.
   *
   * Persisted: a board dealt before the app was closed is still the last one
   * the player saw, and coming back to a near-identical board is exactly the
   * thing this prevents.
   */
  recentBoards: string[][]
  /** The next authored City 1 board. Missing old saves correctly start at board one. */
  city1BoardCursor: number
  /**
   * Which authored board the round on the table IS (`bank_001`), or null for
   * every other deal. Sent with Casey's clue view so his server can hand him
   * the bank's clue groups for his key (proxy/casey/authored-clues.js).
   * Persisted beside the game: a round resumed after a reload is still that
   * board. Missing on an old save reads as null, which is only the advice
   * going quiet for one resumed round.
   */
  authoredBoardId: string | null
  /** Internal truth label; an authored board is not a Worker certification. */
  boardCertification: 'authored-cycle' | 'hard-certified' | 'local-fallback' | 'not-applicable'
  roundRecorded: boolean
  /** Non-null while playing (or having finished) a daily challenge. */
  dailyKey: string | null
  /**
   * Wrap-up rounds deal from the city's collected words with every card
   * English-side up; the packing phase below is how they turn over. All
   * persisted: a wrap-up put down mid-packing resumes as itself.
   */
  mode: RoundMode
  /** Word ids translated to Danish during packing — face-up, wrappable. */
  packed: string[]
  /** Wrappable words whose answer a translation postcard revealed this round. */
  packingTranslated: string[]
  /**
   * Which of this board's cards may be packed and wrapped at all: the words
   * that were COLLECTED when the board was dealt (W1). A wrap-up board is
   * topped up from the rest of the city when the collected pool is thin, and
   * those top-up cards are ordinary playable cards that go nowhere — they
   * start Danish-side up, take no packing, and `finishRound` cannot wrap them.
   *
   * An absent field remains meaningful for legacy rounds. CLAUDE.md's point 3 is about
   * CHANGING a default every save already carries. Here no save carries this
   * one, zustand merges `{...initial, ...persisted}`, and the initial value is
   * `undefined` — deliberately, because `undefined` has to MEAN something:
   * "every word on the board", which is exactly the rule a wrap-up dealt
   * before this build was played under. A `[]` initial would have rehydrated
   * an in-flight wrap-up as a board with nothing to pack. Read it through
   * `wrappableIds` below, never directly.
   */
  wrappable?: string[]
  /** Words whose FIRST packing attempt missed (an SRS demotion each). */
  packingMissed: string[]
  /** Set when every card is packed, or the player starts early regardless. */
  packingDone: boolean
  /** Words this round pushed over the line into the collection's green. */
  newlyLearned: string[]
  /**
   * Words this round was the player's FIRST sight of — never on a board
   * before. The test is the absence of an SRS record when the round started:
   * `finishRound` writes one for every word on a finished board, and
   * `wordState` reads the same absence as `undiscovered`, so the two agree by
   * construction rather than by a second rule kept in step by hand.
   */
  newlyDiscovered: string[]
  /**
   * Whether this normal win actually earned a translation postcard, read
   * across `recordGame` so a reopened summary cannot claim a new reward.
   *
   * A new persisted field rather than a version bump: every save ever written
   * lacks it, and zustand's merge is `{...initial, ...persisted}`, so a save
   * without it rehydrates to `false` — which is the true answer for a round
   * that finished before wins earned anything. The trap CLAUDE.md warns about
   * is the other one: CHANGING a default that every save already carries.
   */
  earnedPostcard: boolean
  /**
   * Whether this win ALSO earned the perfect-round postcard (owner,
   * 2026-09-18). Same persistence shape as `earnedTranslationJoker`: a new
   * field every save lacks, whose absent-default `false` is the true answer
   * for rounds finished before perfect rounds existed.
   */
  earnedPerfectRound: boolean
  /**
   * A round put down to make room for one of the other kind — the wrap-up
   * you were packing when you tapped Play, or the ordinary round you were
   * in when you opened the suitcase and started a wrap-up. Owner,
   * 2026-09-07: an interrupted wrap-up and ordinary play are "two separate
   * paths", so Home offers both — Continue game AND Continue wrap-up — and
   * neither costs the other. One slot: the table holds one kind, this holds
   * the other, and `resumeParked` swaps them. Persisted like the table, so a
   * reload keeps both; a new field with no version bump, since an old save
   * reads null, which is the truth for a save that never parked anything.
   */
  parked: ParkedRound | null
  // Transient (not persisted):
  aiBusy: boolean
  aiGuessQueue: PlannedGuess[]
  /** clueHistory.length the current guess plan was made for — distinguishes "plan consumed" from "no plan yet". */
  planForClueIndex: number | null
  /** Pins how the current transient queue was planned, including across UI beats. */
  aiGuessPlanMode: 'assisted' | 'legacy' | null
  /** Owns the in-flight guess request; transient and invalidated with the turn machinery. */
  aiGuessRequestId: number | null
  /** Separate ownership for a clue request that may outlive parking and resume. */
  aiClueRequestId: number | null
  /**
   * Who gave the clue the player is guessing under, held from `runAiClue`
   * until that turn ends and the ledger can be written with its hits.
   *
   * Transient on purpose — this store has a `partialize` and this is not in it.
   * A round put down mid-turn and resumed loses one ledger row rather than
   * resuming with a stale arm attached to a clue somebody else may now be
   * answering; one row is nothing against a rate, and a wrong row is a lie.
   */
  pendingClueArm: CallReport | null
  /** The guess currently being dramatized in the UI, just applied. */
  lastAiGuess: PlannedGuess | null
  error: string | null
  /**
   * The Casey error on screen is one where she could not be reached: no
   * internet. With offline mode on and her download on this iPhone, the
   * banner then offers to play the round with offline Casey. Transient.
   */
  errorNoInternet: boolean
  /**
   * The attempt the player chose to finish with offline Casey ("Play
   * offline"), or null. Compared with `attemptId`, so the choice ends with its
   * round, and a relaunch asks again. Transient, like the error it answers.
   */
  offlineRoundFor: string | null
  /**
   * The offline round whose player, told the internet was back, chose to
   * stay offline: they are not asked again in that round. Transient.
   */
  stayOfflineFor: string | null
  selectedWordId: string | null
  newGame: (opts?: NewGameOptions) => boolean
  /**
   * A wrap-up round: BOARD (the same shape a normal round deals, since N2),
   * every word collected, nothing carried over or remembered by the normal
   * deal (recentBoards is untouched in both directions — a carry-over quota
   * could force uncollected words onto this board, and remembering it would
   * distort the next normal one).
   */
  newWrapUpGame: (opts?: { seed?: number }) => boolean
  /**
   * The guided practice round: a fixed 3×3 deal and seed, with Casey giving
   * the first clue — guessing is the low-friction act, so the player learns
   * it before cluing on the first real 3×6 board.
   */
  newTutorialGame: () => void
  /**
   * Grade one packing attempt. A hit flips the card; the first miss on a word
   * is recorded (SRS demotion at round end); retries are free — the gate
   * teaches, the round tests. Returns whether the answer packed the word.
   */
  submitPacking: (wordId: string, text: string) => boolean
  /** Reveal one wrappable packing answer, charging only on the first reveal. */
  usePostcard: (wordId: string) => boolean
  /** Start the clues with cards still unpacked — they stay English-side up
   *  all round and cannot wrap this round, even revealed green. */
  startRoundEarly: () => void
  /**
   * Throw this board away and deal another of the same size.
   *
   * "I want a reroll button at the beginning to reroll the board if I have no
   * idea on how to connect the words." Only before the first clue, and never on
   * the daily challenge, which is one shared board per date — a rerolled daily
   * would be nobody's board.
   */
  rerollBoard: () => void
  /**
   * Throw away the round on the table. The parked round stays where it is —
   * Cancelling an ordinary round must not cost the wrap-up waiting behind it
   * — unless `{ parked: true }` says to clear that too (Reset progress, the
   * playtest city jump).
   */
  abandonGame: (opts?: { parked?: boolean }) => void
  /**
   * Bring the parked round back to the table, parking whatever unfinished
   * round is there now in its place. Nothing to do with no parked round.
   */
  resumeParked: () => void
  submitPlayerClue: (text: string, number: number) => void
  selectWord: (wordId: string | null) => void
  playerGuess: (wordId: string) => void
  playerStop: () => void
  /**
   * The Translation Wheel's two actions. Submit takes the TYPED ANSWER and
   * resolves it to a wheel word itself (free-type grading, owner 2026-09-17:
   * no tap-to-select) — it answers whether anything packed (the dock clears
   * or shakes on the answer); spin draws the wheel AND decides the round
   * (owner, 2026-09-18): the engine maps the verdict to the round's outcome,
   * the hold lets the spinner's animation land first, then the finish screen
   * takes over with the win or loss. Both refuse outside the wheel phases,
   * and both refuse in the tutorial, which keeps the old sudden death.
   */
  submitWheelTranslation: (answer: string) => boolean
  spinWheel: () => void
  recordLookup: (wordId: string) => void
  /**
   * Translate one word for the player, so a Danish clue can be composed
   * without leaving the round. Charges a lookup when the word turns out to be
   * on the board, and refuses outright while the dictionary is locked.
   */
  translate: (term: string) => Promise<TranslationResponse>
  /**
   * Charge a lookup if this term names a board word — for the answers that
   * come from the shipped dictionary rather than from Casey. Without it the
   * offline half of the lookup field reads the board for free.
   */
  noteLookup: (term: string) => void
  /**
   * Is this word Danish? Asked of Casey when the shipped nine hundred cannot say.
   *
   * No new endpoint: translate() already tidies a Danish word to its citation
   * form and returns it as `da`, so a word that comes back as itself was
   * Danish and one that comes back as something else was not. «trafik» returns
   * trafik; «water» returns vand.
   */
  judgeTargetWord: (term: string) => Promise<boolean>
  runAiGuesses: () => Promise<void>
  stepAiGuess: (owner?: RuntimeEventOwner) => void
  runAiClue: () => Promise<void>
  finishRound: () => Promise<void>
  clearError: () => void
  /** "Play offline": the rest of this round is played by offline Casey. */
  playRoundOffline: () => void
  /**
   * "Play online", once the internet is back: the rest of this round is
   * normal Casey's again, and offline Casey is put away (GameScreen stops
   * wanting her). A later drop offers "Play offline" again.
   */
  playRoundOnline: () => void
  /** "Stay offline": keep offline Casey for this round and stop asking. */
  keepRoundOffline: () => void
}

/** Whether the player chose offline Casey for the round now in play. */
export function roundPlaysOffline(): boolean {
  const s = useGame.getState()
  return s.offlineRoundFor !== null && s.offlineRoundFor === s.attemptId
}

/**
 * Casey's model call for this round: on the phone when the developer build
 * forces it, or when the player chose offline Casey for this round; the
 * Worker otherwise (undefined keeps OllamaCompanion's default).
 */
function roundDecision(): DecisionFn | undefined {
  const s = useSettings.getState()
  if (playsOnDevice(s.caseyMode) || (onDeviceCaseyAvailable && roundPlaysOffline())) return requestGemmaDecision
  // The open-source build's "your own AI key": Casey's logic in the app,
  // with the player's service as its model.
  if (ownKeyAvailable && s.caseyMode === 'own-key') return requestOwnKeyDecision
  return undefined
}

/**
 * Where dictionary misses go. An offline round looks words up offline; a
 * self-built 900words looks them up with the Casey it plays with, since it may
 * have no Worker; the developer's forced offline Casey leaves them on the
 * Worker, as before.
 */
function dictionaryDecision(): DecisionFn | undefined {
  const s = useSettings.getState()
  if (onDeviceCaseyAvailable && roundPlaysOffline()) return requestGemmaDecision
  if (ownKeyAvailable && s.caseyMode === 'own-key') return requestOwnKeyDecision
  if (ownKeyAvailable && playsOnDevice(s.caseyMode)) return requestGemmaDecision
  return undefined
}

function companion(mode: RoundMode = 'normal'): Companion {
  // Casey's tutorial clues are scripted. The player still writes a real clue,
  // so the guessing half deliberately takes the live path below.
  if (mode === 'tutorial') return new TutorialCompanion()
  const s = useSettings.getState()
  // Explicit local dev/e2e seam only. Normal play always reaches model-backed
  // Casey. The authored evaluator now exists only behind Casey's Worker; this
  // mock is intentionally nonsensical and cannot be mistaken for a companion.
  if (s.useMock && devSwitchesAllowed()) return new MockCompanion()
  return new OllamaCompanion(
    {
      baseUrl: s.baseUrl,
      playerLanguage: useGame.getState().gameUiLanguage,
      courseLanguage: useGame.getState().gameLanguage,
    },
    roundDecision(),
  )
}

/**
 * Online dictionary misses stay on the Casey Worker for now. The brain switch
 * controls clues and guesses only: choosing the experimental on-device Gemma
 * must not silently move translation away from the Ollama-backed dictionary.
 */
function dictionaryCompanion(mode: RoundMode = 'normal'): Companion {
  if (mode === 'tutorial') return new TutorialCompanion()
  const s = useSettings.getState()
  if (s.useMock && devSwitchesAllowed()) return new MockCompanion()
  return new OllamaCompanion(
    {
      baseUrl: s.baseUrl,
      playerLanguage: useGame.getState().gameUiLanguage,
      courseLanguage: useGame.getState().gameLanguage,
    },
    dictionaryDecision(),
  )
}

/** Tutorial player clues are Casey proper, even when a dev/practice setting is on. */
function liveCompanion(): Companion {
  const s = useSettings.getState()
  return new OllamaCompanion(
    {
      baseUrl: s.baseUrl,
      playerLanguage: useGame.getState().gameUiLanguage,
      courseLanguage: useGame.getState().gameLanguage,
    },
    roundDecision(),
  )
}

/** Is the explicit local dev/e2e agentless prototype active? */
export function onPracticeCompanion(): boolean {
  return devSwitchesAllowed() && useSettings.getState().useMock
}

/**
 * The baked OPENING clue per authored board (owner decision 2026-09-18: the
 * first clue is IN the app — zero delay from Play). Generated from the Worker
 * bank by `scripts/bake-opening-clues.mjs` with the real `authoredPath`, and
 * pinned bank-to-bank by `src/data/city1OpeningClues.test.ts`, which fails the
 * moment the bank changes without a re-bake. Nothing else from the bank
 * crosses here: four fields per board, one clue.
 */
interface BakedOpening {
  id: string
  clue: string
  clueEnglish: string
  targetWordIds: string[]
}
const bakedOpening = new Map(
  (ACTIVE.code === 'da' ? (rawOpeningClues as { boards: BakedOpening[] }).boards : []).map((entry) => [entry.id, entry]),
)

/**
 * The baked opening for a board id, or null — exported for the fallback test,
 * which needs to name a board the table has never carried.
 */
export const bakedOpeningFor = (boardId: string): BakedOpening | null =>
  bakedOpening.get(boardId) ?? null

/**
 * The rationale the player reads under the baked opening, in Casey's voice:
 * the SAME template the Worker's firstClueRationale uses for the server-side
 * path, fed from the pack the client bundle already ships — no string is
 * copied here. Bare Danish board words in; the language's own quoting and
 * joining out.
 */
function firstClueRationale(clue: string, targetWordIds: readonly string[], words: GameState['words']): string {
  const player = playerLanguageFor(useGame.getState().gameUiLanguage)
  const names = player.joinNames(
    targetWordIds.map((id) => words.find((word) => word.wordId === id)?.da ?? id),
  )
  return player.firstClue(clue, names)
}

/**
 * Write the clue ledger's row for a turn under CASEY's clue that has just
 * ended, and say whether one was written.
 *
 * Here rather than in the engine because the engine has no opinion about who
 * was asked: `arm` and `refused` are facts about the call, and the call happens
 * in `runAiClue`. A row is one clue's worth of evidence — the number announced,
 * the greens the player actually found under it on Casey's key, and which arm
 * gave it — and `readLedger` turns a few hundred of them into the hit rate and
 * the refusal rate `docs/clue-engine.md` §6 Stage 4 asks for.
 *
 * Only Casey's clues, and only the ones whose turn is over. The player's own
 * clues are not a measurement of anything the ledger can act on, and sudden
 * death has no clue-giver at all.
 */
function closeClueLedger(before: GameState, after: GameState, arm: CallReport | null): boolean {
  if (!arm) return false
  if (before.phase !== 'playerGuessing' || after.phase === 'playerGuessing') return false
  const clue = after.clueHistory[after.clueHistory.length - 1]
  if (!clue || clue.by !== 'ai') return false
  useLedger.getState().record({
    number: clue.number,
    hits: clue.guesses.filter((g) => g.result === 'green').length,
    arm: arm.arm,
    refused: arm.refused,
  })
  return true
}

const aiMessage = (e: unknown): string =>
  e instanceof AiError ? e.message : UI.system.companionFailed

/** The phone is offline, or Casey's server could not be reached at all. */
const noInternet = (e: unknown): boolean =>
  e instanceof AiError && (e.kind === 'network' || e.kind === 'cors')

/**
 * Deal a board.
 *
 * `priorBoards` is what the carry-over rule reads: the boards that came BEFORE
 * this one, newest first. Split out of newGame so a reroll can hand it a
 * different answer to that question — see rerollBoard, where the board being
 * thrown away must not count as one the player has played.
 */
function dealBoard(
  config: GridConfig,
  seed: number,
  dailyKey: string | null,
  priorBoards: string[][],
  boardCityIndex: number,
  avoid?: ReadonlySet<string>,
): { game: GameState; wordIds: string[] } {
  // The daily challenge is the same board for everyone on that date: a seeded
  // uniform draw over the whole dataset, ignoring personal SRS. Journey rounds
  // (and free play) draw only from the current city's words — earlier cities
  // are reviewed by travelling back, not by them bleeding onto later boards
  // (owner decision, docs/clue-engine.md §3.4); the daily challenge stays
  // global so everyone gets the same board.
  const pool = wordsForCity(WORDS, boardCityIndex)
  const entries = dailyKey
    ? selectDailyWords(WORDS, config.totalWords, mulberry32(seed ^ 0x9e3779b9))
    : selectBoardWords(
        pool,
        useSrs.getState().stats,
        {
          totalWords: config.totalWords,
          maxNewWordsPerBoard: config.maxNewWordsPerBoard,
          collected: new Set(Object.keys(useJourney.getState().wrapped)),
          // Whatever the SRS weights want, exactly three words of the last
          // board come back and the rest of this one avoids both — a board that
          // repeats the last one does not feel like a new board, and one that
          // repeats nothing forgets too fast.
          recentBoards: priorBoards.map((b) => new Set(b)),
          // A rejected board is the opposite of a played one: the player said
          // they could not read those words, so they stay off this deal.
          ...(avoid ? { avoid } : {}),
        },
        mulberry32(seed ^ 0x9e3779b9),
        Date.now(),
      )
  // Steer the deal: words the player still struggles with become Casey's
  // greens, so the player has to recall them. (Well-known ones used to become
  // the forbidden hazards; with those gone they simply drift off both keys.)
  // The daily challenge stays an unbiased shared board.
  const srsStats = useSrs.getState().stats
  const wrapped = useJourney.getState().wrapped
  const bias = dailyKey
    ? undefined
    : {
        need: Object.fromEntries(
          entries.map((w) => [
            w.id,
            practiceNeed(srsStats[w.id], isCollected(srsStats[w.id], w.id in wrapped), Date.now()),
          ]),
        ),
      }

  const game = createGame({
    config,
    words: entries.map((w) => ({
      wordId: w.id,
      da: w.da,
      en: w.en,
      pos: w.pos,
      article: w.article,
      gender: w.gender,
      countable: w.countable,
    })),
    seed,
    bias,
    ...(useUi.getState().pendingFirstGiver
      ? { firstGiver: useUi.getState().pendingFirstGiver! }
      : {}),
  })
  return { game, wordIds: entries.map((w) => w.id) }
}


export function dealCity1AuthoredBoard(
  cursor: number,
  firstGiverOverride?: 'player' | 'ai',
): { game: GameState; wordIds: string[] } {
  const board = city1BoardAt(cursor)
  const entries = board.wordIds.map((id) => {
    const entry = wordById(id)
    if (!entry) throw new Error(`authored board ${board.id} names an unknown word: ${id}`)
    return entry
  })
  const seed = Number.parseInt(board.seedHex, 16) >>> 0
  return {
    game: createGame({
      config: { ...BOARD, greenOverlap: board.greenOverlap },
      words: entries.map((w) => ({
        wordId: w.id,
        da: w.da,
        en: w.en,
        pos: w.pos,
        article: w.article,
        gender: w.gender,
        countable: w.countable,
      })),
      seed,
      // Casey opens ordinary rounds by default; the onboarding hand-off passes
      // the required board's declared firstGiver explicitly.
      firstGiver: firstGiverOverride ?? 'ai',
      authoredGreenIds: { player: board.playerGreenIds, ai: board.aiGreenIds },
    }),
    wordIds: [...board.wordIds],
  }
}

/**
 * Whether the board may still be re-dealt: only at the beginning, and never
 * on the daily challenge or in the scripted practice round.
 *
 * "The beginning" is before the PLAYER's first move, not before the first
 * clue. Casey opens every round now, so "no clue on the table" would close the
 * window the moment his opening clue landed — a few seconds after the deal,
 * before the player had read the board, which is exactly when the reroll was
 * asked for ("if I have no idea how to connect the words"). His opening clue
 * costs nothing that a re-deal would undo: no token is spent until a turn
 * ends, nothing is revealed until a guess, no SRS result is owed. The
 * player's first guess is what gives the round a history, and so is the
 * player's own clue under `?first=player` — the two cases the old rule was
 * about, kept.
 */
export function rerollOpen(
  game: GameState | null,
  opts: { dailyKey: string | null; mode: RoundMode },
): boolean {
  if (!game) return false
  if (opts.dailyKey || opts.mode === 'tutorial') return false
  return game.clueHistory.every((clue) => clue.by === 'ai' && clue.guesses.length === 0)
}

/**
 * Everything a new board resets, whether it arrives from newGame or a reroll.
 *
 * A function rather than a constant: the empty array and object literals in
 * here would otherwise be one shared instance handed to every round.
 */
const freshRound = () => ({
  attemptId: roundEventId(),
  attemptOrigin: null as AttemptOrigin | null,
  activeSlot: null as 'primary' | 'replay' | null,
  tutorialResumeSlot: null as 'primary' | 'replay' | null,
  completionReceipt: null as CompletionReceipt | null,
  gameLanguage: ACTIVE.code,
  gameUiLanguage: UI_LANGUAGE,
  reviewRoundId: roundEventId(),
  sentenceReview: null as QueueState | null,
  roundGuidance: null as RoundGuidance | null,
  activeRoundGuidance: null as ActiveRoundGuidance,
  lookedUp: [] as string[],
  roundRecorded: false,
  newlyLearned: [] as string[],
  newlyDiscovered: [] as string[],
  earnedPostcard: false,
  earnedPerfectRound: false,
  aiGuessQueue: [] as PlannedGuess[],
  planForClueIndex: null,
  aiGuessPlanMode: null as 'assisted' | 'legacy' | null,
  aiGuessRequestId: null as number | null,
  aiClueRequestId: null as number | null,
  pendingClueArm: null as CallReport | null,
  lastAiGuess: null,
  error: null,
  errorNoInternet: false,
  offlineRoundFor: null as string | null,
  stayOfflineFor: null as string | null,
  settlementFailure: null as string | null,
  selectedWordId: null,
  wheelSpinHold: false as boolean,
  wheelReview: false as boolean,
  aiBusy: false,
  // Not an authored board unless the two authored-cycle deals say so AFTER
  // spreading this — they are the only deals that know a board id.
  authoredBoardId: null as string | null,
  // A normal round has nothing to pack; newWrapUpGame overrides all five.
  mode: 'normal' as const,
  packed: [] as string[],
  packingTranslated: [] as string[],
  packingMissed: [] as string[],
  packingDone: true,
  wrappable: undefined as string[] | undefined,
})

/**
 * A different board from the same starting point. An LCG step rather than the
 * clock, so a round dealt from ?seed= still rerolls reproducibly — and so a
 * reroll can never land on the seed it came from.
 */
const nextSeed = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0

/**
 * v1 remembered one board under `lastBoard`. Without this the upgrade would
 * silently lose it — harmless (one board deals without a carry-over quota) but
 * avoidable, and an installed PWA updates under the player rather than at a
 * moment they chose.
 *
 * v2 -> v3: the wrap-up fields. An in-flight round from the old build is by
 * definition a normal one with nothing to pack, and resumes as such.
 *
 * v3 -> v4: forbidden words and the redemption phase are gone, and this is the
 * one migration that cannot preserve the round. A save written by the old build
 * may hold a key with `forbidden` on it, a `{kind: 'forbidden'}` reveal, a
 * `phase: 'redemption'` with typed answers beside it, or an outcome of
 * 'redeemed' — none of which the new types can represent, and all of which
 * would be read straight back onto the board. So the game is thrown away and
 * the player lands on Home with Play. One abandoned mid-round on the update is
 * the accepted cost; the alternative is a screen rendering roles that no longer
 * exist.
 *
 * recentBoards survives on purpose: it is only word ids, it carries no key
 * data, and keeping it means the board dealt after the update still honours the
 * carry-over rule.
 *
 * v4 -> v5: the debrief is gone. The round summary is written from the board
 * and the stores rather than asked of the model, so `debrief` and
 * `debriefFailed` are dropped and `newlyDiscovered` joins `newlyLearned`. The
 * round in flight is KEPT — nothing in it changed shape, and this is the first
 * of these migrations that costs the player nothing. The two dead keys are
 * deleted rather than left to rot: this store has a `partialize`, which writes
 * the blob back key for key, so a `debrief` object stored once would ride along
 * in every save a device ever wrote afterwards.
 *
 * Exported so it can be tested directly, like migrateSrs: under vitest there is
 * no localStorage, persist quietly becomes a passthrough, and a test reaching
 * through the middleware would be testing nothing.
 */
/**
 * Everything that IS a round in this store: the fields that follow the board
 * when it is parked and come back with it. Exactly the persisted round-slot
 * fields and nothing cross-round — `recentBoards` and `city1BoardCursor`
 * belong to the deal history, not to a board, and stay put.
 */
export interface ParkedRound {
  reviewRoundId?: string | null
  roundGuidance?: RoundGuidance | null
  game: GameState
  gameLanguage: LanguageCode
  gameUiLanguage: UiLanguage
  boardCityIndex: number
  lookedUp: string[]
  authoredBoardId: string | null
  boardCertification: GameStore['boardCertification']
  roundRecorded: boolean
  dailyKey: string | null
  mode: RoundMode
  packed: string[]
  packingTranslated: string[]
  packingMissed: string[]
  packingDone: boolean
  wrappable?: string[] | undefined
  newlyLearned: string[]
  newlyDiscovered: string[]
  earnedPostcard: boolean
  /**
   * Whether this normal win ALSO earned the perfect-round postcard (owner,
   * 2026-09-18): the engine's isPerfectRound judged the round at finish. The
   * same persistence shape as `earnedPostcard` — a new field every save ever
   * written lacks, whose absent-default `false` is the true answer for any
   * round finished before perfect rounds existed.
   */
  earnedPerfectRound: boolean
}

/**
 * The round on the table as something that can be parked, or null when there
 * is nothing worth keeping: no board, a finished one (its summary is a screen
 * you leave, not a round you resume), or the scripted practice round, which
 * only makes sense inside the intro.
 */
export function roundOf(s: Omit<ParkedRound, 'game'> & { game: GameState | null }): ParkedRound | null {
  if (!s.game || s.game.phase === 'finished' || s.mode === 'tutorial') return null
  return {
    reviewRoundId: s.reviewRoundId ?? null,
    game: s.game,
    roundGuidance: s.roundGuidance ?? null,
    gameLanguage: s.gameLanguage,
    gameUiLanguage: s.gameUiLanguage,
    boardCityIndex: s.boardCityIndex,
    lookedUp: s.lookedUp,
    authoredBoardId: s.authoredBoardId,
    boardCertification: s.boardCertification,
    roundRecorded: s.roundRecorded,
    dailyKey: s.dailyKey,
    mode: s.mode,
    packed: s.packed,
    packingTranslated: s.packingTranslated,
    packingMissed: s.packingMissed,
    packingDone: s.packingDone,
    wrappable: s.wrappable,
    newlyLearned: s.newlyLearned,
    newlyDiscovered: s.newlyDiscovered,
  earnedPostcard: false,
  earnedPerfectRound: false,
  }
}

/** Whether a wrap-up round is under way — on the table or parked behind it. */
export function wrapUpWaiting(s: Pick<GameStore, 'game' | 'mode' | 'parked'> & Parameters<typeof roundOf>[0]): boolean {
  return roundOf(s)?.mode === 'wrapup' || s.parked?.mode === 'wrapup'
}

/**
 * The turn machinery at rest, for a round that comes back from the parking
 * slot: the same state a reload hands a resumed round. Its request id is
 * cleared even though parking preserves the game object itself, so an
 * in-flight Casey call is dropped and the resumed round re-asks.
 */
const restingTurn = () => ({
  activeRoundGuidance: null as ActiveRoundGuidance,
  aiBusy: false,
  aiGuessQueue: [] as PlannedGuess[],
  planForClueIndex: null,
  aiGuessPlanMode: null as 'assisted' | 'legacy' | null,
  aiGuessRequestId: null as number | null,
  aiClueRequestId: null as number | null,
  pendingClueArm: null as CallReport | null,
  lastAiGuess: null,
  error: null,
  errorNoInternet: false,
  offlineRoundFor: null as string | null,
  stayOfflineFor: null as string | null,
  selectedWordId: null,
})

/**
 * A blank round, used by every path that has to throw one away. Named rather
 * than repeated so a field added to the store cannot be forgotten in one of
 * them.
 */
const noRound = {
  attemptId: null,
  attemptOrigin: null,
  activeSlot: null,
  tutorialResumeSlot: null as 'primary' | 'replay' | null,
  completionReceipt: null,
  reviewRoundId: null as string | null,
  sentenceReview: null as QueueState | null,
  roundGuidance: null as RoundGuidance | null,
  activeRoundGuidance: null as ActiveRoundGuidance,
  // A round in another language cannot be resumed, parked or not.
  parked: null as ParkedRound | null,
  game: null,
  lookedUp: [],
  roundRecorded: false,
  dailyKey: null,
  mode: 'normal' as const,
  packed: [],
  packingTranslated: [],
  packingMissed: [],
  packingDone: true,
  wrappable: undefined,
  newlyLearned: [],
  newlyDiscovered: [],
  earnedPostcard: false,
  earnedPerfectRound: false,
}

// Monotonic only for this loaded app. It is request ownership, not game data,
// and deliberately never enters the persisted store or a Worker request.
let nextAiGuessRequestId = 0
let nextAiClueRequestId = 0

type RuntimeSlot = AttemptSlot & { round?: Omit<ParkedRound, 'game' | 'lookedUp'> & { sentenceReview: QueueState | null } }
// SSR/tests without persistence use the same receipt protocol in memory.
const volatileValues = new Map<string, string>()
const volatileStorage: AtomicStorage = { getItem: (key) => volatileValues.get(key) ?? null, setItem: (key, value) => { volatileValues.set(key, value) } }
const runtimeStorage = () => typeof localStorage === 'undefined' ? volatileStorage : localStorage
let lessonPlanner: SettlementOptions['planLessons'] = planRuntimeLessons
/** C1-09's pure map is the runtime default; tests/integrators may replace it deliberately. */
export function configureRuntimeLessons(planner?: SettlementOptions['planLessons']): void { lessonPlanner = planner ?? planRuntimeLessons }
// Old rounds' full receipts go to the device's history archive (historyArchive.ts).
const settlement = () => createSettlementStore({ storage: runtimeStorage(), planLessons: lessonPlanner,
  archive: runtimeStorage() === volatileStorage ? null : historyArchive() })
let finishing: Promise<void> | null = null
let recovering: Promise<void> | null = null
let publishedTransferRevision = saveTransferRevision

function runtimeSlot(s: GameStore, board: BoardIdentity, origin: 'primary' | 'replay'): RuntimeSlot {
  if (!s.game || !s.attemptId) throw new Error('Attempt needs its persisted identity')
  return JSON.parse(JSON.stringify({
    attemptId: s.attemptId, board, origin, promptLanguage: s.gameUiLanguage, game: s.game,
    lookedUp: s.lookedUp, reviewRoundId: s.reviewRoundId, randomnessPolicy: 'engine-wheel-v1',
    round: {
      reviewRoundId: s.reviewRoundId, sentenceReview: s.sentenceReview, roundGuidance: s.roundGuidance,
      gameLanguage: s.gameLanguage, gameUiLanguage: s.gameUiLanguage, boardCityIndex: s.boardCityIndex,
      authoredBoardId: s.authoredBoardId, boardCertification: s.boardCertification, roundRecorded: s.roundRecorded,
      dailyKey: s.dailyKey, mode: s.mode, packed: s.packed, packingTranslated: s.packingTranslated,
      packingMissed: s.packingMissed, packingDone: s.packingDone, wrappable: s.wrappable,
      newlyLearned: s.newlyLearned, newlyDiscovered: s.newlyDiscovered,
      earnedPostcard: s.earnedPostcard, earnedPerfectRound: s.earnedPerfectRound,
    },
  })) as RuntimeSlot
}

function projectSlot(slot: AttemptSlot): Partial<GameStore> {
  const round = (slot as RuntimeSlot).round
  return {
    ...freshRound(), ...round, ...restingTurn(), wheelSpinHold: false, wheelReview: false,
    attemptId: slot.attemptId, attemptOrigin: slot.origin, activeSlot: slot.origin,
    game: slot.game, lookedUp: [...slot.lookedUp], gameLanguage: slot.board.courseId,
    gameUiLanguage: slot.promptLanguage, authoredBoardId: slot.board.authoredBoardId,
    boardCertification: 'authored-cycle', boardCityIndex: 0, reviewRoundId: slot.reviewRoundId,
    roundGuidance: round?.roundGuidance ?? newRoundGuidance(slot.game),
  }
}

const resultProjection = (receipt: CompletionReceipt): Partial<GameStore> => ({
  error: null, settlementFailure: null,
  completionReceipt: receipt, roundRecorded: true,
  newlyLearned: [...receipt.learning.newlyCollected], newlyDiscovered: [...receipt.learning.newlyDiscovered],
  earnedPostcard: receipt.rewards.postcards > 0,
  earnedPerfectRound: receipt.rewards.newlyClaimed.includes('solvedAndTranslated'),
})

/** Review pins are presentation, not settlement evidence. Preserve exact saved
 * pins/cursor; reconstruct only when a crash predated their first projection. */
function completedReview(state: GameStore, game: GameState): QueueState | null {
  if (!state.reviewRoundId) return null
  if (state.sentenceReview) return restoreQueue(state.sentenceReview, state.reviewRoundId, CITY1_CATALOG.review, game.clueHistory)
  const queue = state.boardCityIndex === 0 && state.gameLanguage === ACTIVE.code && state.mode === 'normal'
    ? selectQueue(game.clueHistory, CITY1_CATALOG.review) : []
  return { version: 1, roundId: state.reviewRoundId, queue, cursor: 0, dismissed: queue.length === 0 }
}

/**
 * Which cards of the board in hand may be packed and wrapped.
 *
 * The one reader of `wrappable`, so the `undefined` → "every word" rule lives
 * in exactly one place. See the field for why that is the right reading of an
 * absent value rather than a defensive fallback.
 */
export function wrappableIds(
  game: Pick<GameState, 'words'> | null,
  wrappable: readonly string[] | undefined,
): string[] {
  if (!game) return []
  if (!wrappable) return game.words.map((w) => w.wordId)
  return game.words.filter((w) => wrappable.includes(w.wordId)).map((w) => w.wordId)
}

/**
 * A board of one language's words cannot be resumed in another: the cards are
 * in a language the player is no longer playing and the SRS would record the
 * round against the wrong collection. So the save is stamped, and a stamp that
 * disagrees with the active language throws the round away.
 *
 * Losing one mid-round on a language change is the same cost A1 accepted for
 * losing one on an update, and a language change is a far more deliberate act
 * than an update is.
 */
export function dropForeignGame<T extends { gameLanguage: LanguageCode }>(
  state: T,
  active: LanguageCode,
): T {
  if (state.gameLanguage === active) return state
  return { ...state, ...noRound, gameLanguage: active }
}

/**
 * v15 — the wheel spin decides the round (owner, 2026-09-18), and the round's
 * earned-reward marker is renamed to the postcard (owner, 2026-09-18/19): the
 * persisted `earnedTranslationJoker` becomes `earnedPostcard`, 1:1, on both
 * round slots. The value is a marker, not a balance — the marker's meaning
 * does not move, so every save simply carries the same boolean under the new
 * name.
 *
 * No persisted FIELD changes shape otherwise, but the MEANING of one state
 * does. Old saves can hold two shapes no new round can produce, and both have
 * to be brought somewhere the new rules can finish honestly:
 *
 * 1. A won, UNSPENT spin (the old chooser was waiting): under the new rules
 *    the spin decides the round, so this one is rewound — the verdict and
 *    landing clear, the phase returns to translateWheel, and the player spins
 *    again for the round itself. Their fills are kept; nothing is taken away.
 * 2. A wheel with `spent` set (the token was spent under build 87–90 rules):
 *    the flag is cleared so endTurn's old spent-wheel refusal can never fire —
 *    the NEXT exhaustion now routes into a fresh ending wheel like any other.
 *
 * Applied to the live round and the parked round alike, and idempotent: a
 * v15+ save passes through untouched.
 */
export function migrateGame(persisted: unknown, from: number): unknown {
  if (from >= 17) return persisted
  if (from === 16) {
    const state = (persisted ?? {}) as Record<string, unknown>
    return { ...state, legacySave: !state.attemptId && (state.game || state.parked) ? legacyRoundEvidence(state) : null }
  }
  const prior = migrateLegacyGame(persisted, from) as Record<string, unknown>
  // C1-06 owns identity validation/anchoring of old active and parked rounds.
  // Until that conversion, absence of an attempt stamp cannot mint a receipt.
  return { ...prior, attemptId: null, attemptOrigin: null, activeSlot: null, completionReceipt: null,
    legacySave: legacyRoundEvidence(persisted) }
}

function migrateLegacyGame(persisted: unknown, from: number): unknown {
  if (from >= 15) return persisted
  const prior = (from >= 12 ? persisted : migrateGameStudy(persisted, from)) as Record<string, unknown> | null
  const round = (slot: Record<string, unknown>) => {
    const game = slot.game as GameState | null | undefined
    const wheel = game?.wheel as (GameState['wheel'] & { filled?: number[] }) | null | undefined
    // The postcard rename runs first: the old `earnedTranslationJoker` marker
    // becomes `earnedPostcard`, 1:1, on this round slot.
    const { earnedTranslationJoker: _retired, ...renamed } = slot as Record<string, unknown> & {
      earnedTranslationJoker?: boolean
    }
    // The v14 shape-repair runs first (old saves may lack `filled`), then the
    // v15 verdict-rewind reads the repaired list.
    const wheelV14 =
      wheel && !Array.isArray(wheel.filled)
        ? { ...wheel, filled: wheel.translated.map((id) => wheel.segments.indexOf(id)) }
        : wheel
    // The v15 verdict-rewind must see the REPAIRED wheel even when no repair
    // was needed, so the repaired (or original) wheel is written back here —
    // the old code only carried the repair forward when it had happened.
    let gameV15 = game && wheelV14 && game.wheel !== wheelV14 ? { ...game, wheel: wheelV14 } : game
    if (game && wheelV14) {
      if (wheelV14.result === 'win' && !wheelV14.spent) {
        // A won spin still waiting on the old chooser: rewind to translateWheel
        // so the new ending resolves it — the player spins again, and the
        // spin decides the round.
        gameV15 = {
          ...game,
          phase: 'translateWheel',
          wheel: { ...wheelV14, landed: null, result: null, spent: null },
        }
      } else if (wheelV14.spent) {
        // A spent wheel: clear the flag. A FINISHED round keeps its recorded
        // outcome (nothing rewrites history); an in-flight one had its chance
        // and the next exhaustion routes into the ending like any other.
        gameV15 = { ...game, wheel: { ...wheelV14, spent: null } }
      }
    }
    return {
      ...renamed,
      earnedPostcard: slot.earnedTranslationJoker === true,
      earnedPerfectRound: false,
      packingTranslated: Array.isArray(slot.packingTranslated) ? slot.packingTranslated : [],
      ...(gameV15 && gameV15 !== game ? { game: gameV15 } : {}),
    }
  }
  const current = prior ?? {}
  return {
    ...round(current),
    parked: current.parked ? round(current.parked as Record<string, unknown>) : null,
  }
}
/** v12 retires the old board-wide study state without reopening legacy rounds. */
function migrateGameStudy(persisted: unknown, from: number): unknown {
  if (from >= 12) return persisted
  const prior = (migrateGameGuidance(persisted, from) ?? {}) as Record<string, unknown>
  const withoutStudy = (slot: Record<string, unknown>) => {
    const { studying: _studying, ...rest } = slot
    return rest
  }
  // Never reopen a legacy finished save. Stamp in-flight legacy rounds now
  // so they can queue once when they subsequently finish.
  const stamp = (slot: Record<string, unknown>) => ({ ...slot,
    reviewRoundId: (slot.game as GameState | null)?.phase !== 'finished' ? roundEventId() : null,
    sentenceReview: null,
  })
  return {
    ...withoutStudy(stamp(prior)),
    parked: prior.parked ? withoutStudy(stamp(prior.parked as Record<string, unknown>)) : null,
  }
}

/** v10 records the current legacy turn as already announced, on BOTH round slots. */
function migrateGameGuidance(persisted: unknown, from: number): unknown {
  if (from >= 10) return persisted
  const prior = (migrateGameBeforeGuidance(persisted, from) ?? {}) as Record<string, unknown>
  const quiet = (slot: Record<string, unknown>) => {
    const game = slot.game as GameState | null | undefined
    return {
      ...slot,
      roundGuidance: game ? {
        opening: 'dismissed',
        playerClueTurn: game.phase === 'playerClueInput' ? game.clueHistory?.length ?? 0 : null,
      } : null,
    }
  }
  return { ...quiet(prior), parked: prior.parked ? quiet(prior.parked as Record<string, unknown>) : null }
}

function migrateGameBeforeGuidance(persisted: unknown, from: number): unknown {
  if (from >= 9) return persisted
  // v8 -> v9: City 1's bank was regenerated again — a longer, deliberately
  // ORDERED bank (easy boards first) rather than the first generated one.
  // v7 -> v8 was the same event: the bank grew from the 18 playtest boards to
  // the generated bank.
  //
  // Either way `city1BoardCursor` is an INDEX INTO THAT BANK, walked modulo
  // its length, so the same stored number names a different board than it did
  // when it was written — a phone paused mid-bank would resume on a board it
  // has never seen the start of, and on an ordered bank it would also skip the
  // gentle opening the order exists for. Resetting to zero is the only reading
  // that stays true: the bank is new, so the walk through it starts again. An
  // in-flight round is untouched; it carries its own board.
  //
  // Applied to EVERY older version rather than only to the one below, because
  // zustand's migrate is called once with the stored version and does not
  // chain: a v6 save falls into the branch below and would otherwise skip this.
  const rebanked: unknown = {
    ...((persisted ?? {}) as Record<string, unknown>),
    city1BoardCursor: 0,
  }
  // v8 and v7 need nothing else — the rewind IS the whole migration for both.
  if (from >= 7) return rebanked
  // v6 -> v7: normal journey boards were already city-only, but their city
  // was implicit in journeyStore. Recover it from any card on the saved board
  // rather than assuming city zero: that preserves a paused city-eight round
  // across the update, and a board cannot legitimately mix city pools.
  if (from === 6) {
    const p = (rebanked ?? {}) as Record<string, unknown>
    // The daily is the exception: its board is deliberately global, so its
    // first word says nothing about a route city. Leave this new field absent
    // and Zustand's initial current-route context supplies the next ordinary
    // board after a migrated daily summary instead of an arbitrary word's
    // city. (The daily itself ignores boardCityIndex altogether.)
    if (p.dailyKey) return p
    const firstId = (p.game as { words?: { wordId?: unknown }[] } | null)?.words?.[0]?.wordId
    const first = typeof firstId === 'string' ? wordById(firstId) : undefined
    // The journey's order, not the raw rank: since City 1 became the authored
    // roster a word's city is where the journey puts it today, which is where
    // the resumed round's summary and next board will look for it.
    const rank = first ? journeyRank(WORDS, first) : 1
    return { ...p, boardCityIndex: Math.max(0, Math.floor((rank - 1) / 100)) }
  }
  // v5 -> v6: the in-flight round learns which language it is in. Every save
  // written before the seam is Danish; stamping it as such keeps the round the
  // player is in the middle of, which is the whole reason to say it explicitly
  // rather than leaving the field undefined and dropping the board.
  if (from === 5) {
    return { ...((rebanked ?? {}) as Record<string, unknown>), gameLanguage: DEFAULT_LANGUAGE }
  }
  if (from === 4) {
    const kept = { ...((rebanked ?? {}) as Record<string, unknown>) }
    delete kept.debrief
    delete kept.debriefFailed
    return { ...kept, newlyDiscovered: [], gameLanguage: DEFAULT_LANGUAGE }
  }
  let p = rebanked
  if (from < 2) {
    const { lastBoard, ...rest } = (p ?? {}) as { lastBoard?: string[] }
    p = { ...rest, recentBoards: lastBoard?.length ? [lastBoard] : [] }
  }
  const { recentBoards } = (p ?? {}) as { recentBoards?: string[][] }
  return {
    recentBoards: recentBoards ?? [],
    gameLanguage: DEFAULT_LANGUAGE,
    ...noRound,
  }
}

export const useGame = create<GameStore>()(
  persist(
    (rawSet, get) => {
      // An ambiguous session write cannot be followed by another mutation until
      // recovery can read its authority. Keep this outside the display cache:
      // rehydration must not reset it while the current process is quarantined.
      let sessionRecoveryRequired = false
      const recoverBeforeEvent = () => {
        if (!sessionRecoveryRequired) return false
        void get().recoverSession().catch(() => undefined) // Recovery publishes its retryable error.
        return true
      }
      // Save the complete two-slot value before publishing any changed round.
      // cluecab-game-v1 remains a compatibility/display cache, not queue authority.
      const set: typeof rawSet = (partial, replace) => {
        if (recoverBeforeEvent()) return
        const previous = get()
        const patch = typeof partial === 'function' ? partial(previous) : partial
        const next = { ...previous, ...patch }
        if (next.game !== previous.game || next.attemptId !== previous.attemptId || next.lookedUp !== previous.lookedUp) {
          assertSettlementIdle(runtimeStorage())
          if (next.game?.phase === 'translateChallenge' && previous.game?.phase !== 'translateChallenge') {
            next.activeRoundGuidance = null
          }
        }
        if (next.activeSlot && next.game && next.attemptId) {
          const adapter = settlement()
          const sessions = adapter.readSessions().byCourse[ACTIVE.code]
          const slot = sessions?.[next.activeSlot]
          if (slot?.attemptId === next.attemptId) {
            const updated = runtimeSlot(next, slot.board, next.activeSlot)
            if (JSON.stringify(updated) !== JSON.stringify(slot)) {
              const saved = { ...sessions, [next.activeSlot]: updated }
              try {
                adapter.saveSessions(ACTIVE.code, saved)
              } catch (error) {
                // Atomic storage can commit and then report failure. Reconcile
                // that exact value before another event can use the old cache:
                // in particular, a persisted wheel verdict is already accepted.
                // An uncommitted write still leaves the prior round untouched.
                let committed: CourseSessions | undefined
                try {
                  committed = adapter.readSessions().byCourse[ACTIVE.code]
                } catch (readError) {
                  sessionRecoveryRequired = true
                  rawSet({ settlementBusy: true, error: UI.game.settlementFailed, settlementFailure: String(readError) })
                  return
                }
                if (!sameValue(committed, saved)) throw error
                next.error = UI.game.settlementFailed
                next.settlementFailure = String(error)
              }
              next.sessions = saved
            }
          }
        }
        rawSet(next, replace as false)
      }
      const loadSessions = () => {
        const adapter = settlement()
        assertSettlementIdle(runtimeStorage())
        const facts = adapter.readLedger().facts
        return validateCourseSessions(adapter.readSessions().byCourse[ACTIVE.code] ?? initialCourseSessions(facts), facts)
      }
      const showSessions = (sessions: CourseSessions, patch: Partial<GameStore> = {}) => {
        settlement().saveSessions(ACTIVE.code, sessions)
        const slot = sessions.activeSlot ? sessions[sessions.activeSlot] : null
        const receipt = slot && settlement().readLedger().settlements[receiptKey(slot.attemptId)]?.receipt
        rawSet({
          ...(slot ? projectSlot(slot) : { ...noRound, ...restingTurn(), wheelSpinHold: false, wheelReview: false }),
          ...(receipt ? resultProjection(receipt) : {}),
          sessions, eventGeneration: get().eventGeneration + 1,
          courseExhausted: nextRequiredBoard(sessions, settlement().readLedger().facts) === null,
          ...patch,
        })
      }
      const suspendForOtherMode = () => {
        const sessions = settlement().readSessions().byCourse[ACTIVE.code]
        if (sessions) settlement().saveSessions(ACTIVE.code, { ...sessions, activeSlot: null })
      }
      return ({
      attemptId: null,
      attemptOrigin: null,
      activeSlot: null,
      tutorialResumeSlot: null,
      sessions: null,
      completionReceipt: null,
      settlementBusy: false,
      settlementFailure: null,
      eventGeneration: 0,
      courseExhausted: false,
      lastDealRefusal: null,
      eventOwner: () => ({ attemptId: get().attemptId, slot: get().activeSlot, generation: get().eventGeneration }),
      ownsEvent: (owner) => sameEventOwner(get().eventOwner(), owner),
      dailyOutcome: (key) => readDailyOutcome(runtimeStorage(), key),
      migrationNotice: false,
      dismissMigrationNotice: () => {
        assertSettlementIdle(runtimeStorage())
        const raw = runtimeStorage().getItem(SAVE_MIGRATION_KEY)
        if (raw) {
          const next = JSON.stringify({ ...readSaveMigration(runtimeStorage()), noticeDismissed: true })
          runtimeStorage().setItem(SAVE_MIGRATION_KEY, next)
          if (runtimeStorage().getItem(SAVE_MIGRATION_KEY) !== next) return
        }
        rawSet({ migrationNotice: false })
      },
      pauseGame: () => {
        // Navigation/background is a pause; persist has already saved every event.
        set({ ...restingTurn(), wheelSpinHold: false, wheelReview: false, eventGeneration: get().eventGeneration + 1 })
      },
      resumePrimary: () => {
        if (get().settlementBusy) return
        const sessions = loadSessions()
        if (sessions.primary) showSessions({ ...sessions, activeSlot: 'primary' })
        else get().newGame()
      },
      resumeReplay: () => {
        if (get().settlementBusy) return
        const sessions = loadSessions()
        if (sessions.replay) showSessions({ ...sessions, activeSlot: 'replay' })
      },
      restoreTutorialSuspension: () => {
        if (get().settlementBusy || get().mode !== 'tutorial') return false
        try {
          const sessions = loadSessions()
          // The in-memory pointer gives an active replay its exact identity.
          // If a remount has discarded that transient cache, a single retained
          // valid slot is still unambiguous; two parked slots without a pointer
          // fail closed rather than guessing which one the player suspended.
          const slotName = get().tutorialResumeSlot ?? sessions.activeSlot ??
            (sessions.primary && !sessions.replay ? 'primary' : sessions.replay && !sessions.primary ? 'replay' : null)
          if (!slotName) return false
          if (!sessions[slotName]) return false
          // This is a projection of the already-persisted slot. It never
          // calls finishRound or writes ledger facts, rewards, or a new deal.
          showSessions({ ...sessions, activeSlot: slotName }, { tutorialResumeSlot: null })
          return true
        } catch {
          return false
        }
      },
      resumeResult: (slotName) => {
        if (get().settlementBusy) return false
        try {
          const sessions = loadSessions()
          const saved = settlement().readSessions().results
          const receipt = retainedResultReceipt(slotName, sessions, saved, settlement().readLedger().settlements)
          const slot = sessions[slotName]
          if (!slot || !receipt) return false
          const projected = { ...projectSlot(slot), ...resultProjection(receipt), sessions }
          const reviewGame = JSON.parse(JSON.stringify(receipt.evidence.game)) as GameState
          const review = completedReview({ ...get(), ...projected } as GameStore, reviewGame)
          // Do not call showSessions: changing a result reader must not
          // advance, settle, acknowledge, or even rewrite its durable queue.
          suppressGameCachePersistence = true
          try { rawSet({ ...projected, sentenceReview: review, eventGeneration: get().eventGeneration + 1 }) }
          finally { suppressGameCachePersistence = false }
          return true
        } catch {
          return false
        }
      },
      dismissResult: () => {
        if (get().settlementBusy) return false
        const state = get()
        if (!state.activeSlot || !state.attemptId || !state.completionReceipt ||
          state.game?.phase !== 'finished' || !state.roundRecorded) return false
        try {
          const sessions = settlement().readSessions().byCourse[ACTIVE.code]
          if (!settlement().dismissResult(ACTIVE.code, state.activeSlot, state.attemptId)) return false
          const nextSessions = settlement().readSessions().byCourse[ACTIVE.code] ?? sessions ?? null
          rawSet({ ...noRound, ...restingTurn(), sessions: nextSessions,
            courseExhausted: nextSessions ? nextRequiredBoard(nextSessions, settlement().readLedger().facts) === null : false,
            eventGeneration: state.eventGeneration + 1 })
          return true
        } catch {
          return false
        }
      },
      startReplay: (id, developerContinue = false) => {
        if (get().lastDealRefusal !== null) rawSet({ lastDealRefusal: null })
        if (get().settlementBusy) return false
        const sessions = loadSessions()
        const board = requiredSetForCourse(ACTIVE.code).boards.find((item) => item.authoredBoardId === id)
        const facts = settlement().readLedger().facts
        // G1 A1 losses retain a replayable completed-loss fact without an
        // earned board tier; legacy C1-PC-1 wins continue to use boards.
        if (!board || (!facts.boards[boardKey(board)] && !facts.completedLosses[boardKey(board)])) return false
        if (sessions.replay) {
          if (boardKey(sessions.replay.board) !== boardKey(board)) return false
          showSessions({ ...sessions, activeSlot: 'replay' })
          return true
        }
        if (get().game?.phase === 'finished' && !get().roundRecorded) return false
        if (!(developerContinue && canDeveloperContinue()) && !canStartDailyGame()) {
          rawSet({ lastDealRefusal: 'dailyLimit' })
          useUi.getState().openDailyLimit(() => get().startReplay(id, true))
          return false
        }
        const { game } = dealCity1AuthoredBoard(CITY1_BOARD_CYCLE.findIndex((item) => item.id === id))
        const state = { ...get(), ...freshRound(), game, attemptOrigin: 'replay' as const, activeSlot: 'replay' as const,
          mode: 'normal' as const, dailyKey: null, boardCityIndex: 0, authoredBoardId: id,
          boardCertification: 'authored-cycle' as const, roundGuidance: newRoundGuidance(game) }
        const replay = runtimeSlot(state, board, 'replay')
        showSessions({ ...sessions, replay, activeSlot: 'replay' })
        return true
      },
      recoverSession: () => {
        if (recovering) return recovering
        if (finishing) return finishing
        rawSet({ settlementBusy: true, ...restingTurn(), wheelSpinHold: false, wheelReview: false, eventGeneration: get().eventGeneration + 1 })
        recovering = (async () => {
          const adapter = settlement()
          try {
            recoverSaveTransfer(runtimeStorage())
            retireUnstampedSessions(runtimeStorage(), Date.now())
            // A queue on a superseded City 1 set moves to the current one here,
            // or, if a settlement is still pending, right after recovery below.
            const rebased = rebaseSavedQueues(runtimeStorage(), Date.now())
            if (typeof localStorage !== 'undefined') {
              migrateLegacyProfile(runtimeStorage(), get() as unknown as Record<string, unknown>, ACTIVE.code, Date.now(),
                slot => runtimeSlot({ ...get(), ...projectSlot(slot) }, slot.board, 'primary'))
              if (get().legacySave) rawSet({ ...noRound, ...restingTurn(), legacySave: null })
              if (publishedTransferRevision !== saveTransferRevision) {
                const [{ useCurriculum }, { useSurvival }, { useStreak }, { useAssociations }] = await Promise.all([
                  import('./curriculumStore'), import('./survivalStore'), import('../streak/streak'), import('./associationStore'),
                ])
                for (const store of [useSrs, useJourney, useCurriculum, useSurvival, useStreak, useAssociations]) await store.persist.rehydrate()
                publishedTransferRevision = saveTransferRevision
              }
              const migration = readSaveMigration(runtimeStorage())
              rawSet({ migrationNotice: migration.retired === true && migration.noticeDismissed !== true })
            }
            await adapter.recover()
            if (!rebased && !rebaseSavedQueues(runtimeStorage(), Date.now())) throw new Error('Queue rebase blocked by a pending settlement')
            if (!rebased && typeof localStorage !== 'undefined') {
              const migration = readSaveMigration(runtimeStorage())
              rawSet({ migrationNotice: migration.retired === true && migration.noticeDismissed !== true })
            }
            // A crash can land after the terminal slot but before its receipt.
            // Settle that accepted verdict before any course-switch retirement.
            for (const sessions of Object.values(adapter.readSessions().byCourse)) {
              for (const slot of [sessions.primary, sessions.replay]) {
                if (!slot || slot.game.phase !== 'finished' || adapter.readLedger().settlements[receiptKey(slot.attemptId)]) continue
                if (slot.board.courseId !== 'da' && slot.board.courseId !== 'de') throw new Error('Missing course settlement manifest')
                const acceptedAt = Date.now()
                const date = new Date(acceptedAt)
                const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
                await adapter.finish({ attempt: { attemptId: slot.attemptId, origin: slot.origin, board: slot.board, game: slot.game },
                  required: requiredSetForCourse(slot.board.courseId), authoredContent: requiredContent(slot.board), lookedUp: slot.lookedUp, acceptedAt, localDate })
              }
            }
            // Non-slot terminal evidence lives in the game cache. A learner-
            // course switch must settle it before retiring that foreign cache,
            // just as the loop above does for terminal primary/replay slots.
            const cached = get()
            if (cached.gameLanguage !== ACTIVE.code && !cached.activeSlot && cached.attemptId &&
              cached.game?.phase === 'finished' && !cached.roundRecorded &&
              ['daily', 'developer', 'tutorial', 'optional'].includes(cached.attemptOrigin ?? '')) {
              await get().finishRound()
              if (!get().roundRecorded) throw new Error(get().settlementFailure ?? 'Foreign terminal settlement incomplete')
            }
            // A learner-course switch keeps each queue, settles accepted work,
            // then retires its unfinished slots. UI language is intentionally ignored.
            for (const [course, sessions] of Object.entries(adapter.readSessions().byCourse)) {
              if (course !== ACTIVE.code) adapter.saveSessions(course, { ...sessions, primary: null, replay: null, activeSlot: null })
            }
            if (get().gameLanguage !== ACTIVE.code) rawSet({ ...noRound, ...restingTurn(), gameLanguage: ACTIVE.code, gameUiLanguage: UI_LANGUAGE })
            const sessions = adapter.readSessions().byCourse[ACTIVE.code]
            if (sessions) {
              validateCourseSessions(sessions, adapter.readLedger().facts)
              // The session effect may have cleared a finished replay before its
              // terminal state reached the display cache (an ambiguous write).
              // Its receipt owns the terminal projection as well as the result;
              // do not select primary until an explicit Next/resume action.
              const receipt = get().attemptId && adapter.readLedger().settlements[receiptKey(get().attemptId!)]?.receipt
              if (receipt) rawSet({ game: JSON.parse(JSON.stringify(receipt.evidence.game)) as GameState, ...resultProjection(receipt), sessions })
              // A daily/developer/practice attempt deliberately suspends both
              // city slots. Its cache is its own evidence, not an empty city
              // projection. Keep it through recovery so unfinished play resumes
              // and accepted terminal evidence reaches finishRound below.
              else if (!sessions.activeSlot && !get().activeSlot && get().attemptId && get().game &&
                ['daily', 'developer', 'tutorial', 'optional'].includes(get().attemptOrigin ?? '')) rawSet({ sessions })
              else showSessions(sessions)
            } else if (get().attemptId) {
              const receipt = adapter.readLedger().settlements[receiptKey(get().attemptId!)]?.receipt
              if (receipt) rawSet({ game: JSON.parse(JSON.stringify(receipt.evidence.game)) as GameState, ...resultProjection(receipt) })
            }
            const restored = get()
            const completed = restored.attemptId && adapter.readLedger().settlements[receiptKey(restored.attemptId)]?.receipt
            if (completed && restored.game?.phase === 'finished') rawSet({ ...resultProjection(completed), sentenceReview: completedReview(restored, restored.game) })
            sessionRecoveryRequired = false
            rawSet({ settlementBusy: false })
            // Accepted terminal evidence saved before the receipt is recoverable too.
            if (get().attemptId && get().game?.phase === 'finished' && !get().roundRecorded) await get().finishRound()
            // Preserve the old tutorial lifecycle: an unfinished practice cache
            // cannot reopen outside onboarding. Accepted learning settles first.
            if (get().mode === 'tutorial' && !useUi.getState().onboarding &&
              (get().game?.phase !== 'finished' || get().roundRecorded)) rawSet({ ...noRound, ...restingTurn() })
          } catch (error) {
            rawSet({ settlementBusy: sessionRecoveryRequired, error: UI.game.settlementFailed, settlementFailure: String(error) })
            throw error
          }
        })().finally(() => { recovering = null })
        return recovering
      },
      reviewRoundId: null,
      legacySave: null,
      sentenceReview: null,
      roundGuidance: null,
      activeRoundGuidance: null,
      game: null,
      gameLanguage: ACTIVE.code,
      gameUiLanguage: UI_LANGUAGE,
      boardCityIndex: useJourney.getState().cityIndex,
      lookedUp: [],
      recentBoards: [],
      city1BoardCursor: 0,
      authoredBoardId: null,
      boardCertification: 'not-applicable',
      roundRecorded: false,
      dailyKey: null,
      mode: 'normal',
      packed: [],
      packingTranslated: [],
      packingMissed: [],
      packingDone: true,
      wrappable: undefined,
      newlyLearned: [],
      newlyDiscovered: [],
      earnedPostcard: false,
      earnedPerfectRound: false,
      parked: null,
      aiBusy: false,
      aiGuessQueue: [],
      planForClueIndex: null,
      aiGuessPlanMode: null,
      aiGuessRequestId: null,
      aiClueRequestId: null,
      pendingClueArm: null,
      lastAiGuess: null,
      error: null,
      errorNoInternet: false,
      offlineRoundFor: null,
      stayOfflineFor: null,
      selectedWordId: null,
      wheelSpinHold: false,
      wheelReview: false,

      announceRoundGuidance: () => {
        const { game, mode, packingDone, roundGuidance, activeRoundGuidance } = get()
        if (!game || mode === 'tutorial' || !roundGuidance || activeRoundGuidance) return
        // The packing phase owns the screen while it lasts, and it is the one
        // moment of a wrap-up a player meets with no idea what is being asked
        // of them: every card is English side up and the round has not begun.
        // So it is announced here and nothing else is — the phases the other
        // panels watch for are all on the far side of packing anyway, and this
        // states the rule rather than relying on that.
        if (mode === 'wrapup' && !packingDone) {
          if ((roundGuidance.packing ?? 'dismissed') === 'pending') {
            set({ activeRoundGuidance: 'packing', roundGuidance: { ...roundGuidance, packing: 'announced' } })
          }
          return
        }
        // The player's "Don't remind me again" silences this panel the way it
        // does the Your turn one; the Translation time card still plays at the
        // bottom (TurnTakeover), as Your turn's does.
        if ((game.phase === 'translateChallenge' || game.phase === 'translateWheel') &&
          (roundGuidance.translation ?? 'pending') === 'pending' &&
          !useSettings.getState().hideTranslationReminder) {
          set({ activeRoundGuidance: 'translation', roundGuidance: { ...roundGuidance, translation: 'announced' } })
          return
        }
        // The last chance is announced in every round that can reach it — a
        // wrap-up runs out of clues the same way — and once: the phase is the
        // trigger, and the record survives a reload the way the opening does.
        // Two arrivals share the one record and its `pending` flag, whichever
        // comes first (owner, 2026-09-17): the WHEEL challenge's opening, when
        // the clues run out into `translateChallenge`, and the retained
        // sudden-death fallback that a spent wheel (or a board with no
        // suitcases to pack at all) still falls through to. Each panel fires
        // once; the first arrival wins, and the other keeps its quiet.
        if (
          game.phase === 'suddenDeath' &&
          (roundGuidance.lastChance ?? 'pending') === 'pending'
        ) {
          set({ activeRoundGuidance: 'last-chance', roundGuidance: { ...roundGuidance, lastChance: 'announced' } })
          return
        }
        // The two opening lessons are normal play's: the wrap-up teaches its
        // own first turns in the docks.
        if (mode !== 'normal') return
        if (
          roundGuidance.opening === 'pending' && game.phase === 'playerGuessing' &&
          game.clueHistory.length === 1 && game.clueHistory[0]?.by === 'ai'
        ) {
          set({ activeRoundGuidance: 'casey', roundGuidance: { ...roundGuidance, opening: 'announced' } })
        } else if (
          game.phase === 'playerClueInput' && roundGuidance.playerClueTurn === null &&
          !useSettings.getState().hidePlayerClueReminder
        ) {
          set({ activeRoundGuidance: 'player', roundGuidance: { ...roundGuidance, playerClueTurn: game.clueHistory.length } })
        }
      },

      dismissRoundGuidance: (hideReminder = false) => {
        const { activeRoundGuidance, roundGuidance } = get()
        if (activeRoundGuidance === 'player' && hideReminder) {
          useSettings.getState().set({ hidePlayerClueReminder: true })
        }
        if (activeRoundGuidance === 'translation' && hideReminder) {
          useSettings.getState().set({ hideTranslationReminder: true })
        }
        set({
          activeRoundGuidance: null,
          ...(activeRoundGuidance === 'casey' && roundGuidance
            ? { roundGuidance: { ...roundGuidance, opening: 'dismissed' } as RoundGuidance }
            : activeRoundGuidance === 'translation' && roundGuidance
              ? { roundGuidance: { ...roundGuidance, translation: 'dismissed' } as RoundGuidance }
            : activeRoundGuidance === 'last-chance' && roundGuidance
              ? { roundGuidance: { ...roundGuidance, lastChance: 'dismissed' } as RoundGuidance }
              : activeRoundGuidance === 'packing' && roundGuidance
                ? { roundGuidance: { ...roundGuidance, packing: 'dismissed' } as RoundGuidance }
                : {}),
        })
      },

      retireTranslationGuidance: () => {
        const { activeRoundGuidance, roundGuidance } = get()
        if (!roundGuidance || (roundGuidance.translation ?? 'pending') === 'dismissed') return
        set({
          roundGuidance: { ...roundGuidance, translation: 'dismissed' },
          ...(activeRoundGuidance === 'translation' ? { activeRoundGuidance: null } : {}),
        })
      },

      newGame: (opts) => {
        if (get().lastDealRefusal !== null) rawSet({ lastDealRefusal: null })
        if (get().settlementBusy) return false
        assertSettlementIdle(runtimeStorage())
        const mayContinueAsDeveloper = opts?.developerContinue === true && canDeveloperContinue()
        // A terminal verdict is accepted, even while its animation is visible.
        if (get().game?.phase === 'finished' && !get().roundRecorded && get().attemptId) {
          void get().finishRound()
          return false
        }
        const requested = opts?.cityIndex ?? get().boardCityIndex
        if (requested === 0 && !opts?.dailyKey && opts?.seed === undefined) {
          const sessions = loadSessions()
          if (sessions.primary?.game.phase === 'finished' && !settlement().readLedger().settlements[receiptKey(sessions.primary.attemptId)]) {
            showSessions({ ...sessions, activeSlot: 'primary' })
            void get().finishRound()
            return false
          }
          if (sessions.primary && sessions.primary.game.phase !== 'finished') {
            showSessions({ ...sessions, activeSlot: 'primary' })
            return true
          }
          const facts = settlement().readLedger().facts
          const board = nextRequiredBoard(sessions, facts)
          if (!board) {
            showSessions({ ...sessions, primary: null, activeSlot: null }, { courseExhausted: true })
            return false
          }
          // Café world (CW-04): each required board is a café, and its puzzle
          // cannot start before a Sightseeing walk has found it (a played
          // board, or the head of an anchored queue, counts as found). The one
          // place a new required board is dealt, so no screen can get round
          // it. A round already on the table (above) resumes as before. Only
          // while CAFE_GATE_ENABLED (journey/cafeAccess.ts).
          if (cafeLaunchRefused(board, facts, sessions.continuation)) {
            rawSet({ lastDealRefusal: 'cafeNotFound' })
            return false
          }
          if (!mayContinueAsDeveloper && !canStartDailyGame()) {
            rawSet({ lastDealRefusal: 'dailyLimit' })
            useUi.getState().openDailyLimit(() => get().newGame({ ...(opts ?? {}), developerContinue: true }))
            return false
          }
          // Imported completions can remove proven boards, never unproven ones.
          const remaining = sessions.continuation.remainingBoardKeys
          const continuation = { ...sessions.continuation, remainingBoardKeys: remaining.slice(remaining.indexOf(boardKey(board))) }
          const { game, wordIds } = dealCity1AuthoredBoard(CITY1_BOARD_CYCLE.findIndex((entry) => entry.id === board.authoredBoardId), opts?.firstGiver ?? useUi.getState().pendingFirstGiver ?? undefined)
          const state = { ...get(), ...freshRound(), game, attemptOrigin: 'primary' as const, activeSlot: 'primary' as const,
            dailyKey: null, boardCityIndex: 0, authoredBoardId: board.authoredBoardId,
            boardCertification: 'authored-cycle' as const, roundGuidance: newRoundGuidance(game) }
          const primary = runtimeSlot(state, board, 'primary')
          showSessions({ ...sessions, continuation, primary, activeSlot: 'primary' }, { recentBoards: [wordIds, ...get().recentBoards].slice(0, 4) })
          track({ name: 'round_start', mode: 'normal', city: 0 })
          return true
        }
        if (get().game && get().game!.phase !== 'finished' && get().dailyKey && get().dailyKey === opts?.dailyKey) return true
        if (!mayContinueAsDeveloper && !canStartDailyGame()) {
          rawSet({ lastDealRefusal: 'dailyLimit' })
          useUi.getState().openDailyLimit(() => get().newGame({ ...(opts ?? {}), developerContinue: true }))
          return false
        }
        suspendForOtherMode()
        const actualSeed = opts?.seed ?? (Date.now() % 0xffffffff)
        const dailyKey = opts?.dailyKey ?? null
        // Home explicitly passes the current city. Summary deliberately does
        // not, which is how Play again remains in a revisited city after a
        // reload. Clamp the public option so a stray dev call cannot make the
        // sampler deal an empty pool and leave a white game screen behind.
        const requestedCity = opts?.cityIndex ?? get().boardCityIndex
        const boardCityIndex = Math.min(
          Math.max(0, requestedCity),
          Math.max(0, ACTIVE.route.cities.length - 1),
        )
        const prior = get().recentBoards
        const pendingFirstGiver = useUi.getState().pendingFirstGiver
        // The finite required course returned above. Daily, explicit fixtures
        // and optional other-city rounds keep their deterministic deal paths.
        const mayUseCertification =
          !dailyKey &&
          opts?.seed === undefined &&
          pendingFirstGiver !== 'ai' &&
          canCertifyCity(boardCityIndex)
        const certified = mayUseCertification ? takeCertifiedBoard(boardCityIndex, prior) : null
        const dealt = certified
          ? {
              game: createGame({
                config: shippedBoardConfig(certified.gameSeed),
                words: certified.entries.map((w) => ({
                  wordId: w.id,
                  da: w.da,
                  en: w.en,
                  pos: w.pos,
                  article: w.article,
                  gender: w.gender,
                  countable: w.countable,
                })),
                seed: certified.gameSeed,
                bias: { need: certified.need },
              }),
              wordIds: certified.entries.map((word) => word.id),
            }
          : dealBoard(shippedBoardConfig(actualSeed), actualSeed, dailyKey, prior, boardCityIndex)
        const { game, wordIds } = dealt
        // A wrap-up put down mid-packing is parked, not lost: Play on Home
        // deals the ordinary round beside it. An ordinary round in progress
        // is never here — Home shows Continue game instead of Play — and a
        // finished one is not worth keeping. (If a wrap-up is on the table
        // AND an older ordinary round is parked, the older one goes: Home
        // offers no Play in that state, so only a dev switch can reach it.)
        const table = roundOf(get())
        const parked = table?.mode === 'wrapup' ? table : get().parked
        set({
          game,
          parked,
          // Remembered for the NEXT deal. The sampler uses the newest two;
          // certification's semantic-pair memory uses all four.
          recentBoards: [wordIds, ...prior].slice(0, 4),
          boardCertification: certified
              ? 'hard-certified'
              : mayUseCertification
                ? 'local-fallback'
                : 'not-applicable',
          dailyKey,
          boardCityIndex,
          ...freshRound(),
          attemptOrigin: dailyKey ? 'daily' : opts?.seed !== undefined ? 'developer' : 'optional',
          eventGeneration: get().eventGeneration + 1,
          roundGuidance: newRoundGuidance(game),
          authoredBoardId: null,
        })
        track({ name: 'round_start', mode: dailyKey ? 'daily' : 'normal', city: boardCityIndex })
        return true
      },

      // C1-PC-1: no new retired wrap-up attempt can consume a slot or credit.
      newWrapUpGame: () => false,

      newTutorialGame: () => {
        if (get().settlementBusy) return
        if (get().game?.phase === 'finished' && !get().roundRecorded && get().attemptId) {
          void get().finishRound()
          return
        }
        if (get().mode === 'tutorial' && get().game && get().game!.phase !== 'finished') return
        assertSettlementIdle(runtimeStorage())
        // The rendered course projection is the player-visible authority at
        // this hand-off. Recovery may still be normalising its durable mirror
        // as Settings opens, so prefer the valid active projection and only
        // then fall back to the freshly validated session envelope.
        const sessionBeforeTutorial = loadSessions()
        const tutorialResumeSlot = get().activeSlot ?? sessionBeforeTutorial.activeSlot ??
          (sessionBeforeTutorial.primary && !sessionBeforeTutorial.replay ? 'primary' :
            sessionBeforeTutorial.replay && !sessionBeforeTutorial.primary ? 'replay' : null)
        suspendForOtherMode()
        // Each supported course has its own nine compatible words and authored
        // clue script; the fixed seed pins the role layout in tutorial.test.ts.
        const entries = TUTORIAL_WORD_IDS.map((id) => wordById(id)!)
        const game = createGame({
          config: TUTORIAL_CONFIG,
          words: entries.map((w) => ({
            wordId: w.id,
            da: w.da,
            en: w.en,
            pos: w.pos,
            article: w.article,
            gender: w.gender,
            countable: w.countable,
          })),
          seed: TUTORIAL_SEED,
          firstGiver: 'ai',
        })
        const prior = get().recentBoards
        set({
          game,
          // Unlike a wrap-up, this board ENTERS the carry-over window: its
          // words are real first meetings, and the first real round carrying
          // three of them forward is the same continuity any round gets. A
          // transient Settings replay is different: it must restore the
          // paused course byte-for-byte, so its practice cards never enter
          // that course's future-deal history.
          recentBoards: tutorialResumeSlot ? prior : [entries.map((w) => w.id), ...prior].slice(0, 4),
          dailyKey: null,
          boardCertification: 'not-applicable',
          ...freshRound(),
          tutorialResumeSlot,
          attemptOrigin: 'tutorial',
          eventGeneration: get().eventGeneration + 1,
          mode: 'tutorial',
          boardCityIndex: 0,
        })
        track({ name: 'round_start', mode: 'tutorial', city: 0 })
      },

      // Compatibility entry points for surfaces retired by C1-15. Legacy saves
      // remain readable for C1-06, but cannot create new spending or wrapping.
      submitPacking: () => false,
      usePostcard: () => false,
      startRoundEarly: () => {},

      rerollBoard: () => {
        const { game, dailyKey, mode, activeSlot, settlementBusy } = get()
        if (!game || activeSlot || settlementBusy || mode === 'wrapup' || !rerollOpen(game, { dailyKey, mode })) return
        const prior = get().recentBoards.slice(1)
        const { game: next, wordIds } = dealBoard(shippedBoardConfig(nextSeed(game.seed)), nextSeed(game.seed), null, prior,
          get().boardCityIndex, new Set(game.words.map((word) => word.wordId)))
        set({ ...freshRound(), game: next, attemptOrigin: 'developer', eventGeneration: get().eventGeneration + 1,
          recentBoards: [wordIds, ...prior].slice(0, 4), boardCertification: 'local-fallback', roundGuidance: newRoundGuidance(next) })
      },

      abandonGame: (opts) => {
        if (recoverBeforeEvent()) return
        if (get().settlementBusy) return
        // GameScreen's existing onboarding Skip owns this call. A transient
        // intro must give the suspended course back, not silently discard its
        // active primary/replay before Home can render it.
        if (get().mode === 'tutorial' && get().restoreTutorialSuspension()) return
        if (get().game?.phase === 'finished' && !get().roundRecorded && get().attemptId) {
          // Animation dismissal cannot cancel the verdict. Recover it first.
          void get().finishRound()
          return
        }
        assertSettlementIdle(runtimeStorage())
        const sessions = settlement().readSessions().byCourse[ACTIVE.code]
        if (sessions) {
          const active = get().activeSlot
          const next = { ...sessions,
            ...(active ? { [active]: null } : {}),
            ...(opts?.parked ? { primary: null, replay: null } : {}),
          }
          next.activeSlot = active === 'replay' && next.primary ? 'primary' : null
          showSessions(next, { tutorialResumeSlot: null })
          return
        }
        set({
          game: null,
          dailyKey: null,
          boardCertification: 'not-applicable',
          ...freshRound(),
          attemptId: null,
          eventGeneration: get().eventGeneration + 1,
          ...(opts?.parked ? { parked: null } : {}),
        })
      },

      resumeParked: () => {
        const s = get()
        if (s.sessions) {
          if (s.activeSlot === 'replay') s.resumePrimary()
          else s.resumeReplay()
          return
        }
        if (!s.parked) return
        set({
          ...s.parked,
          reviewRoundId: s.parked.reviewRoundId ?? null,
          sentenceReview: null,
          roundGuidance: s.parked.roundGuidance ?? null,
          // Whatever unfinished round was on the table takes the slot the
          // resumed one leaves; a finished or absent one frees it.
          parked: roundOf(s),
          ...restingTurn(),
        })
      },

      submitPlayerClue: (text, number) => {
        const { game, mode } = get()
        if (!game || game.phase !== 'playerClueInput') return
        const tutorialRemaining = mode === 'tutorial' ? targetableGreenIds(game, 'player').length : 0
        const tutorialNumbers: readonly number[] =
          tutorialRemaining === 1 ? [1] : TUTORIAL_CLUE_NUMBERS
        if (mode === 'tutorial' && !tutorialNumbers.includes(number)) {
          set({
            error: tutorialRemaining === 1
              ? UI.game.practiceClueFinal
              : UI.game.practiceClueMany,
          })
          return
        }
        const next = applyEvent(game, { type: 'SUBMIT_CLUE', by: 'player', text, number })
        // Casey's Home line about a favourite clue (src/stores/clueTally.ts):
        // counted once the engine has taken the clue, best-effort, and never
        // for the scripted practice round.
        if (mode !== 'tutorial' && (next.clueHistory?.length ?? 0) > (game.clueHistory?.length ?? 0)) {
          recordPlayerClue(ACTIVE.code, text)
        }
        set({
          game: next,
          // A new clue is an explicit retry after any visible provider error.
          error: null,
        })
      },

      selectWord: (wordId) => set({ selectedWordId: wordId }),

      playerGuess: (wordId) => {
        const { game } = get()
        if (!game || (game.phase !== 'playerGuessing' && game.phase !== 'suddenDeath')) return
        const next = applyEvent(game, { type: 'GUESS', wordId })
        // Sudden death records nothing on a clue — there is no clue — so the
        // buzz comes from what the card turned out to be. Reading it off the
        // clue here threw on every sudden-death guess, because the last clue in
        // the history is whichever one ran the tokens out and it may have no
        // guesses at all.
        if (game.phase === 'suddenDeath') {
          guessResultHaptic(next.reveals[wordId]!.kind === 'green' ? 'green' : 'bystander')
          if (next.reveals[wordId]!.kind !== 'green') guessErrorBlip()
        } else {
          const clue = currentClue(next)
          const result = clue!.guesses[clue!.guesses.length - 1]!.result
          guessResultHaptic(result)
          // The ✕ mark is gone (owner, build 87): the miss says itself in
          // sound instead — the player's own bystander AND Casey's wrong
          // guess both take the quiet descending blip.
          if (result !== 'green') guessErrorBlip()
          if (completedClue(next)) rewardHaptic()
        }
        const closed = closeClueLedger(game, next, get().pendingClueArm)
        set({ game: next, selectedWordId: null, ...(closed ? { pendingClueArm: null } : {}) })
        if (next.phase === 'finished') void get().finishRound()
      },

      playerStop: () => {
        const { game } = get()
        if (!game || (game.phase !== 'playerGuessing' && game.phase !== 'suddenDeath')) return
        const next = applyEvent(game, { type: 'STOP_GUESSING' })
        const closed = closeClueLedger(game, next, get().pendingClueArm)
        set({ game: next, selectedWordId: null, ...(closed ? { pendingClueArm: null } : {}) })
        if (next.phase === 'finished') void get().finishRound()
      },

      submitWheelTranslation: (answer) => {
        if (recoverBeforeEvent()) return false
        const { game } = get()
        if (!game || game.phase !== 'translateChallenge') return false
        const wheel = game.wheel
        if (!wheel) return false
        // FREE-TYPE GRADING (owner, 2026-09-17): no tap-to-select. The typed
        // answer is graded against EVERY untranslated wheel word with the
        // engine's own grader — the same matchesAnswer packing uses, never a
        // fork. The grader is deterministic and already ships in the client
        // for packing, so the answer resolves to a wordId here and the
        // existing SUBMIT_TRANSLATION event carries it; the engine stays the
        // single source of truth for what counts as a match.
        // Only what was FOUND can be translated: a key word the round missed
        // holds a grey slice and shows its Danish on the board, but typing it
        // is a miss like any other (owner, 2026-09-27).
        const untranslated = wheelFoundIds(game).filter((id) => !wheel.translated.includes(id))
        const matches = untranslated.filter((id) => {
          const w = game.words.find((x) => x.wordId === id)
          return !!w && matchesAnswer(answer, w.da, ACTIVE, isHeadword)
        })
        if (matches.length === 0) return false
        // AMBIGUITY RULE: more than one match is not guessed through. The
        // tiebreak, in order: (1) a translated match with exactly one
        // untranslated co-match packs THAT word — the word that still needs
        // packing is the untranslated one, so the already-answered reading
        // yields to it; (2) otherwise (two or more genuinely untranslated
        // matches) refuse to guess and treat the submit as a miss. Measured
        // against the shipped corpus (src/engine/lane-f-ambig.test.ts): no
        // answer matches two of the 900 Danish words under the real grader,
        // so this branch is unreachable today; it exists so the widening of
        // the vocabulary cannot silently invent a guesser.
        let wordId: string | null = null
        if (matches.length === 1) {
          wordId = matches[0]!
        } else {
          const untranslatedMatches = matches.filter((id) => untranslated.includes(id))
          if (untranslatedMatches.length === 1) wordId = untranslatedMatches[0]!
        }
        if (!wordId) return false
        const before = wheel.translated.length
        const next = applyEvent(game, { type: 'SUBMIT_TRANSLATION', wordId, answer })
        const hit = (next.wheel?.translated.length ?? 0) > before
        set({ game: next })
        if (hit) {
          // A packed word says itself; the haptic is its only other response
          // (owner, 2026-09-26: the suitcase clack is gone, the buzz is enough).
          guessResultHaptic('green')
          void playWord(wordId)
        } else {
          // A miss is free — the buzz says "no", the input keeps its text,
          // nothing else. The blip (owner, build 87) is the miss's voice since
          // the ✕ mark left the cards.
          guessResultHaptic('bystander')
          guessErrorBlip()
        }
        return hit
      },

      spinWheel: () => {
        const { game } = get()
        if (!game || (game.phase !== 'translateChallenge' && game.phase !== 'translateWheel')) return
        const owner = get().eventOwner()
        const next = applyEvent(game, { type: 'SPIN_WHEEL' })
        // The engine's verdict is already a fact; the presentation belongs to
        // the renderer. The hold keeps the wheel mounted for its ~3s spin —
        // without it GameScreen swaps to the finish screen the commit the
        // result lands, and the player never sees the disc turn at all
        // (owner, build 88: "it's just an instant result that is not
        // satisfying to watch"). Since the ending change the hold now gates
        // the FINISH screen on both verdicts (owner, 2026-09-18), and it is
        // also cleared HERE by an attempt-owned fallback. GameScreen keeps
        // the same spinner mounted through this hold; its own timer may clear
        // it first. Neither an unmount nor an obsolete callback can leave a
        // hidden finish screen. SPIN_MS agrees with WheelSpinner's CSS ease-out.
        set({ game: next, ...(next.wheel?.result ? { wheelSpinHold: true, wheelReview: true } : {}) })
        if (next.wheel?.result) {
          setTimeout(() => {
            get().clearWheelSpinHold(owner)
          }, SPIN_MS + SPIN_FALLBACK_GRACE_MS)
        }
        if (next.phase === 'finished') void get().finishRound()
      },

      clearWheelSpinHold: (owner) => {
        if (owner && !get().ownsEvent(owner)) return
        if (!get().wheelSpinHold) return
        // Both the renderer timer and fallback converge here. The hold is
        // transient: a reload cannot replay the cue, and the first current
        // owner to end a winning spin is the only one that sounds it.
        if (get().game?.wheel?.result === 'win') wheelWinFanfare()
        set({ wheelSpinHold: false })
      },

      closeWheelReview: () => {
        // Never while the disc still turns: the button only appears once it
        // rests, and a stray call must not skip the landing.
        if (get().wheelSpinHold || !get().wheelReview) return
        set({ wheelReview: false })
      },

      recordLookup: (wordId) => {
        const { game, lookedUp, mode, packingDone } = get()
        if (!game) return
        // The packing phase IS "type the Danish with no dictionary" — an open
        // dictionary during it would be the answer key. The wheel challenge is
        // the same phase in kind, and ⓘ is locked there with the rest.
        if (mode === 'wrapup' && !packingDone) return
        if (game.phase === 'translateChallenge' || game.phase === 'translateWheel') return
        if (!lookedUp.includes(wordId)) set({ lookedUp: [...lookedUp, wordId] })
      },

      noteLookup: (term) => {
        const { game, mode, packingDone } = get()
        if (!game) return
        if (mode === 'wrapup' && !packingDone) return
        const hit = boardWordFor(term, game.words.map((w) => w.wordId))
        if (hit) get().recordLookup(hit)
      },

      translate: async (term) => {
        const { game, mode, packingDone } = get()
        const owner = get().eventOwner()
        // The packing phase IS "type the Danish with no dictionary". A
        // translate field open during it would not be a feature, it would be
        // the answer key. (The redemption challenge was the same bargain in the
        // other direction and shut this too; it no longer exists.)
        if (game && mode === 'wrapup' && !packingDone) {
          throw new AiError('invalid-response', UI.game.dictionaryClosed)
        }
        // The wheel challenge is the same bargain from the other side: the
        // dock is asking for exactly these words, so an open dictionary is
        // the answer key with a search box on it.
        if (game && (game.phase === 'translateChallenge' || game.phase === 'translateWheel')) {
          throw new AiError('invalid-response', UI.game.dictionaryClosed)
        }
        const result = await dictionaryCompanion(mode).translate(term)
        // Looking a board word up here costs exactly what tapping ⓘ costs.
        // Otherwise this field is a way to read the board for free.
        if (game && get().ownsEvent(owner)) {
          const ids = game.words.map((w) => w.wordId)
          const hit = boardWordFor(term, ids) ?? boardWordFor(result.da, ids)
          if (hit) get().recordLookup(hit)
        }
        return result
      },

      judgeTargetWord: async (term) => {
        const owner = get().eventOwner()
        try {
          const asked = await dictionaryCompanion(get().mode).translate(term)
          if (!get().ownsEvent(owner)) return false
          const norm = (x: string) => x.trim().toLowerCase()
          return norm(asked.da) === norm(term)
        } catch (error) {
          // ClueInput may submit on a current offline error. A stale rejection
          // must not invoke that fallback against a different attempt or slot.
          if (!get().ownsEvent(owner)) return false
          throw error
        }
      },

      runAiGuesses: async () => {
        const { game, aiBusy, mode } = get()
        if (!game || game.phase !== 'aiGuessing' || aiBusy) return
        const requestId = ++nextAiGuessRequestId
        const owner = get().eventOwner()
        const ownsRequest = () => {
          const current = get()
          return current.ownsEvent(owner) && current.game === game && current.aiGuessRequestId === requestId
        }
        set({ aiBusy: true, error: null, errorNoInternet: false, aiGuessRequestId: requestId })
        try {
          // Flags the player raised in past reviews travel with the request:
          // this is the only channel where "that was a bad call" reaches Casey.
          const view = buildAiGuessView(
            game,
            flagsFor(useFeedback.getState().flags, ACTIVE.code),
            // Which authored board this is, so a clue the board was made for
            // is answered with certainty on the server. Null elsewhere.
            { boardId: get().authoredBoardId },
          )
          // The authored tutorial controls Casey's clues only. Its player
          // turn deliberately uses the same real companion as a normal turn:
          // no chip inserts an answer or quietly impersonates Casey.
          const who = mode === 'tutorial' ? liveCompanion() : companion(mode)
          const assisted = caseyTopTwoAssistanceEnabled()
          const res = await who.getGuesses(
            view,
            assisted ? { candidateMode: 'top-two' } : undefined,
          )
          // Object identity catches ordinary immutable events; the request id
          // also catches park/resume, which restores that same object. A stale
          // response is dropped without touching newer state.
          if (!ownsRequest()) return
          // Authored answers are real Worker replies: keep their network time,
          // but publish the finite plan immediately when the current reply lands.
          // The visible per-guess think/reveal beats remain in AiTurnPanel.
          const authored = isAuthoredResponse(who.lastCall)
          // Assisted responses describe alternatives for ONE actual guess,
          // not a multi-guess turn plan. Resolve the row now so THINK previews
          // the exact same reasoning/confidence that GUESS later records.
          // Authored answers are already a finite guaranteed-green turn plan.
          // Preserve that legacy plan and its original clue cap: top-two is
          // assistance for uncertain model/index choices, not for this oracle.
          const assistedChoice = assisted && !authored ? chooseCaseyGuess(game, res.guesses, true) : null
          const plan = authored
            ? planGuessExecution(res.guesses, currentClue(game)?.number ?? 1)
            : assisted
            ? assistedChoice ? [{
                ...assistedChoice.choice,
                ...(assistedChoice.secondChoiceWordId
                  ? { secondChoiceWordId: assistedChoice.secondChoiceWordId }
                  : {}),
              }] : []
            : planGuessExecution(res.guesses, currentClue(game)?.number ?? 1)
          if (!ownsRequest()) return
          // Casey answered: ordinary play is proof the credentials work, so
          // Home stops asking the player to check them.
          useSettings.getState().markClueyVerified(Date.now())
          set({
            aiBusy: false,
            aiGuessRequestId: null,
            aiGuessQueue: plan,
            planForClueIndex: game.clueHistory.length,
            aiGuessPlanMode: assisted && !authored ? 'assisted' : 'legacy',
          })
        } catch (e) {
          if (!ownsRequest()) return
          track({ name: 'casey_error', kind: e instanceof AiError ? e.kind : 'unknown', mode: 'guess' })
          set({ aiBusy: false, aiGuessRequestId: null, error: aiMessage(e), errorNoInternet: noInternet(e) })
        }
      },

      stepAiGuess: (owner) => {
        if (owner && !get().ownsEvent(owner)) return
        const { game, aiGuessQueue, planForClueIndex, aiGuessPlanMode } = get()
        if (!game) return
        if (game.phase !== 'aiGuessing') {
          if (aiGuessQueue.length > 0) set({ aiGuessQueue: [], aiGuessPlanMode: null })
          return
        }
        if (planForClueIndex !== game.clueHistory.length) return // plan is stale or missing
        const [next, ...rest] = aiGuessQueue
        if (!next) {
          const clue = currentClue(game)
          if (!clue || clue.guesses.length === 0) {
            // The plan produced no executable guess (e.g. every id was stale):
            // stopping now would be an illegal event — request a fresh plan.
            set({ planForClueIndex: null, aiGuessPlanMode: null, lastAiGuess: null })
            return
          }
          try {
            const after = applyEvent(game, { type: 'STOP_GUESSING' })
            set({ game: after, aiGuessPlanMode: null, lastAiGuess: null })
          } catch {
            set({ planForClueIndex: null, aiGuessPlanMode: null, lastAiGuess: null })
          }
          return
        }
        try {
          // Casey's own account of the guess travels with it into the history,
          // so the round's turn log can say why he named that word rather than
          // another. It is the whole reason that log is worth expanding.
          const after = applyEvent(game, {
            type: 'GUESS',
            wordId: next.wordId,
            reasoning: next.reasoning,
            confidence: next.confidence,
          })
          const clue = currentClue(after)
          const result = clue!.guesses[clue!.guesses.length - 1]!.result
          guessResultHaptic(result)
          // Casey's wrong guess takes the same blip the player's does — the
          // ✕ mark that used to say it is gone (owner, build 87).
          if (result !== 'green') guessErrorBlip()
          if (completedClue(after)) rewardHaptic()
          const turnEnded = after.phase !== 'aiGuessing'
          const needsNextAssistedDecision = !turnEnded && aiGuessPlanMode === 'assisted'
          set({
            game: after,
            aiGuessQueue: needsNextAssistedDecision || turnEnded ? [] : rest,
            planForClueIndex: needsNextAssistedDecision ? null : planForClueIndex,
            aiGuessPlanMode: turnEnded || needsNextAssistedDecision ? null : aiGuessPlanMode,
            lastAiGuess: next,
          })
          if (after.phase === 'finished') void get().finishRound()
        } catch {
          // Word became unguessable (shouldn't happen) — drop it and move on.
          set({
            aiGuessQueue: rest,
            ...(aiGuessPlanMode === 'assisted'
              ? { planForClueIndex: null, aiGuessPlanMode: null }
              : {}),
          })
        }
      },

      runAiClue: async () => {
        const { game, aiBusy } = get()
        if (!game || game.phase !== 'aiClueInput' || aiBusy) return
        const requestId = ++nextAiClueRequestId
        const owner = get().eventOwner()
        set({ aiBusy: true, aiClueRequestId: requestId, error: null, errorNoInternet: false, lastAiGuess: null })
        // ---- the baked OPENING (owner decision 2026-09-18) -------------------
        // The round's FIRST clue is IN the app: on an authored board with no
        // clue history yet it is applied HERE, in the same tick, with no view
        // built and no network. Casey's model work — every later clue and
        // guess — stays server-side. The triple comes from the baked table,
        // which the pinning test holds equal to the real `authoredFirstClue`,
        // so the fallback below (the Worker serving the same opening) is
        // invisible and only ever slower. A missing entry or an illegal clue
        // falls through to that existing path unchanged.
        if (get().authoredBoardId && game.clueHistory.length === 0) {
          const entry = bakedOpening.get(get().authoredBoardId!)
          if (entry) {
            try {
              const rationale = firstClueRationale(entry.clue, entry.targetWordIds, game.words)
              const after = applyEvent(game, {
                type: 'SUBMIT_CLUE',
                by: 'ai',
                text: entry.clue,
                number: entry.targetWordIds.length,
                targets: entry.targetWordIds,
                rationale,
              })
              // The same-tick guards the network path applies after its await.
              // Here nothing can have interleaved — the apply is synchronous in
              // this tick — so the only reads that matter are that the request
              // is still the current one and the table still holds the same
              // game object. The phase check is the one that must NOT be
              // copied: `after` has already moved the round to playerGuessing,
              // so testing the pre-apply game's phase would discard a landing
              // that did happen and strand the round in aiClueInput.
              const current = get().game
              if (!get().ownsEvent(owner) || get().aiClueRequestId !== requestId || current !== game) return
              // The ledger keeps crediting the opening to `authored` and never
              // to a model, exactly as the network path reports. NO
              // markClueyVerified here: that proves credentials, and the baked
              // opening no longer proves anything — verification is left to
              // the first real network call (a later clue or a guess).
              set({
                aiBusy: false,
                aiClueRequestId: null,
                game: after,
                pendingClueArm: { arm: 'authored', refused: false },
              })
              return
            } catch {
              // Legality (or any other) rejection: the Worker serves the same
              // clue through the normal path below. The busy state stays as
              // the network path set it.
            }
          }
        }
        try {
          const view = buildAiClueView(
            game,
            flagsFor(useFeedback.getState().flags, ACTIVE.code),
            // Which authored board this is, so the Worker can hand Casey the
            // bank's clue groups for his key. Null on every other deal.
            { boardId: get().authoredBoardId },
          )
          // Held rather than called inline: the ledger reads `lastCall` off
          // this exact instance the moment the await returns.
          const who = companion(get().mode)
          const res = await who.getClue(view)
          // The reference protects new deals; request ownership also protects
          // parking and resuming the SAME game object before a reply arrives.
          const current = get().game
          if (!get().ownsEvent(owner) || get().aiClueRequestId !== requestId || current !== game || current.phase !== 'aiClueInput') return
          const after = applyEvent(current, {
            type: 'SUBMIT_CLUE',
            by: 'ai',
            text: res.clue,
            number: res.number,
            targets: res.targetWordIds,
            rationale: res.rationale,
          })
          useSettings.getState().markClueyVerified(Date.now())
          set({ aiBusy: false, aiClueRequestId: null, game: after, pendingClueArm: who.lastCall ?? null })
        } catch (e) {
          if (!get().ownsEvent(owner) || get().aiClueRequestId !== requestId || get().game !== game) return
          track({ name: 'casey_error', kind: e instanceof AiError ? e.kind : 'unknown', mode: 'clue' })
          set({ aiBusy: false, aiClueRequestId: null, error: aiMessage(e), errorNoInternet: noInternet(e) })
        }
      },

      nextReviewSentence: () => {
        const state = get().sentenceReview
        if (state) set({ sentenceReview: nextSentence(state) })
      },
      dismissSentenceReview: () => {
        const state = get().sentenceReview
        if (state && !state.dismissed) set({ sentenceReview: { ...state, dismissed: true } })
      },
      finishRound: () => {
        try {
        if (sessionRecoveryRequired) return get().recoverSession().catch(() => undefined)
        if (finishing) return finishing
        const state = get()
        const { game, attemptId, attemptOrigin, lookedUp } = state
        // Legacy terminal snapshots have no trustworthy per-effect evidence.
        // C1-06 reconciles them; never replay the old non-atomic reward path.
        if (!game || game.phase !== 'finished' || state.roundRecorded || !attemptId || !attemptOrigin || state.mode === 'wrapup' || attemptOrigin === 'retired-wrapup') return Promise.resolve()
        const owner = state.eventOwner()
        const adapter = settlement()
        const existing = adapter.readLedger().settlements[receiptKey(attemptId)]
        try {
          if (!existing) assertSettlementIdle(runtimeStorage())
          if (!existing && state.activeSlot) {
            const sessions = adapter.readSessions().byCourse[ACTIVE.code]
            const slot = sessions?.[state.activeSlot]
            if (!slot || slot.attemptId !== attemptId) throw new Error('Missing terminal attempt slot')
            adapter.saveSessions(ACTIVE.code, { ...sessions, [state.activeSlot]: runtimeSlot(state, slot.board, state.activeSlot) })
          }
        } catch (error) {
          rawSet({ error: UI.game.settlementFailed, settlementFailure: String(error) })
          return Promise.resolve()
        }
        const slot = state.activeSlot ? adapter.readSessions().byCourse[ACTIVE.code]?.[state.activeSlot] : null
        const acceptedAt = Date.now()
        const date = new Date(acceptedAt)
        const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
        rawSet({ settlementBusy: true })
        finishing = (async () => {
          try {
            const receipt = await adapter.finish({
              attempt: existing ? JSON.parse(JSON.stringify(existing.receipt.evidence)) : {
                attemptId, origin: attemptOrigin, board: slot?.board ?? null,
                game: slot?.game ?? JSON.parse(JSON.stringify(game)) as GameState },
              required: slot ? requiredSetForCourse(slot.board.courseId) : null,
              authoredContent: slot ? requiredContent(slot.board) : null,
              lookedUp, acceptedAt, localDate,
              ...(state.dailyKey ? { dailyKey: state.dailyKey } : {}),
              ...(attemptOrigin === 'tutorial' ? {
                tutorialAward: tutorialAwardIdentity(profileKey(runtimeStorage()), { courseId: ACTIVE.code, cityId: ACTIVE.route.cities[0]!.id }, 'A1'),
              } : {}),
            })
            if (!get().ownsEvent(owner)) return
            const sentenceReview = completedReview(state, game)
            rawSet({ ...resultProjection(receipt), sentenceReview,
              sessions: adapter.readSessions().byCourse[ACTIVE.code] ?? null, settlementBusy: false })
            // Persist review position on primary as well. Replay result evidence
            // stays in its receipt and display cache; the suspended primary is untouched.
            if (state.activeSlot === 'primary') set({ sentenceReview })
            if (!existing && state.mode !== 'tutorial') {
              void refreshDailyReminder()
              track({ name: 'round_end', mode: state.dailyKey ? 'daily' : 'normal', city: state.boardCityIndex,
                outcome: game.outcome!.result, kind: game.outcome!.reason, n: game.clueHistory.length })
              const settings = useSettings.getState()
              if (settings.caseyMode === 'worker') void shareCompletedRound(settings.dataSharing, settings.baseUrl, {
                eventId: attemptId, at: receipt.acceptedAt, language: state.gameLanguage, cityIndex: state.boardCityIndex,
                mode: 'normal', result: game.outcome!.result, reason: game.outcome!.reason, boardSize: game.words.length,
                lookedUpCount: lookedUp.length, packedCount: 0, wrappedCount: 0,
                newlyLearnedCount: receipt.learning.newlyCollected.length, newlyDiscoveredCount: receipt.learning.newlyDiscovered.length,
                clues: game.clueHistory.map((clue) => ({ by: clue.by, text: clue.text, number: clue.number,
                  guesses: clue.guesses.map((guess) => ({ wordId: guess.wordId, result: guess.result })) })),
              })
            }
          } catch (error) {
            // Retain terminal evidence and receipts. A retry/reload recovers;
            // a failed write is never marked recorded or silently abandoned.
            if (get().ownsEvent(owner)) rawSet({ error: UI.game.settlementFailed, settlementBusy: false, settlementFailure: String(error) })
          } finally {
            if (get().ownsEvent(owner)) rawSet({ settlementBusy: false })
          }
        })().finally(() => { finishing = null })
        return finishing
        } catch (error) {
          rawSet({ error: UI.game.settlementFailed, settlementBusy: false, settlementFailure: String(error) })
          return Promise.resolve()
        }
      },

      clearError: () => set({ error: null, errorNoInternet: false }),
      playRoundOffline: () =>
        set((s) => ({ offlineRoundFor: s.attemptId, error: null, errorNoInternet: false })),
      playRoundOnline: () => set({ offlineRoundFor: null, stayOfflineFor: null }),
      keepRoundOffline: () => set((s) => ({ stayOfflineFor: s.attemptId })),

    })},
    {
      name: 'cluecab-game-v1',
      storage: createJSONStorage(() => gameCacheStorage()),
      version: 17,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameStore>
        const state = { ...current, ...saved }
        // This is the sole durable identity of a transient tutorial's parked
        // course slot. Older caches did not carry it; malformed values must
        // not make a two-slot restore guess which course to reopen.
        state.tutorialResumeSlot = saved.tutorialResumeSlot === 'primary' || saved.tutorialResumeSlot === 'replay'
          ? saved.tutorialResumeSlot : null
        state.reviewRoundId = typeof saved.reviewRoundId === 'string' && saved.reviewRoundId.length > 0 ? saved.reviewRoundId : null
        state.sentenceReview = state.reviewRoundId && state.game?.phase === 'finished' &&
          state.boardCityIndex === 0 && state.gameLanguage === ACTIVE.code && state.mode !== 'tutorial'
          ? restoreQueue(saved.sentenceReview, state.reviewRoundId, CITY1_CATALOG.review, state.game.clueHistory) : null
        return state
      },
      migrate: migrateGame,
      // The language may have changed since this round was put down; the picker
      // reloads, so ACTIVE is already the new one by the time this runs.
      onRehydrateStorage: () => (state) => {
        if (state && typeof localStorage !== 'undefined') {
          queueMicrotask(() => { void useGame.getState().recoverSession().catch(() => { /* recovery retains the journal */ }) })
          return
        }
        if (state && (state.attemptId || Object.keys(settlement().readSessions().byCourse).length > 0)) {
          queueMicrotask(() => { void useGame.getState().recoverSession().catch(() => { /* error is projected; durable bytes stay intact */ }) })
          return
        }
        // Same drop for a UI-language change (§9.3 step 6): the cards' glosses
        // read differently after a switch. An absent stamp is an old save
        // written before the field existed and is treated as a mismatch —
        // a new optional field needs no migration.
        if (state && (state.gameLanguage !== ACTIVE.code || (!state.attemptId && state.gameUiLanguage !== UI_LANGUAGE))) {
          useGame.setState(dropForeignGame(state, ACTIVE.code))
          return
        }
        // A tutorial round only makes sense inside the intro. One can outlive
        // it — a transient replay closed mid-round, or a skip that raced the
        // persist — and resuming it from Home would put the scripted dock on a
        // screen with no script. Dropped like a foreign-language round; the
        // SRS keeps whatever the finished part already recorded. uiStore is
        // initialised before this store (this module imports it), so the
        // intro decision is already made when rehydration runs.
        if (state && state.mode === 'tutorial' && !useUi.getState().onboarding) {
          useGame.setState({ ...state, ...noRound })
        }
      },
      partialize: (s) => ({
        legacySave: s.legacySave,
        attemptId: s.attemptId,
        attemptOrigin: s.attemptOrigin,
        activeSlot: s.activeSlot,
        tutorialResumeSlot: s.tutorialResumeSlot,
        reviewRoundId: s.reviewRoundId,
        sentenceReview: s.sentenceReview,
        roundGuidance: s.roundGuidance,
        game: s.game,
        gameLanguage: s.gameLanguage,
        gameUiLanguage: s.gameUiLanguage,
        boardCityIndex: s.boardCityIndex,
        lookedUp: s.lookedUp,
        recentBoards: s.recentBoards,
        city1BoardCursor: s.city1BoardCursor,
        authoredBoardId: s.authoredBoardId,
        boardCertification: s.boardCertification,
        roundRecorded: s.roundRecorded,
        dailyKey: s.dailyKey,
        mode: s.mode,
        packed: s.packed,
        packingTranslated: s.packingTranslated,
        packingMissed: s.packingMissed,
        packingDone: s.packingDone,
        wrappable: s.wrappable,
        newlyLearned: s.newlyLearned,
        newlyDiscovered: s.newlyDiscovered,
        earnedPostcard: s.earnedPostcard,
        earnedPerfectRound: s.earnedPerfectRound,
        parked: s.parked,
      }),
    },
  ),
)

// Restore/reset seams invalidate every outstanding request and scheduled event.
// The migration/backup card will call recoverSession around its coordinated writes.
const externalGameSet = useGame.setState
useGame.setState = ((partial: Parameters<typeof externalGameSet>[0], replace?: false) => {
  assertSettlementIdle(runtimeStorage())
  const before = useGame.getState()
  const patch = typeof partial === 'function' ? partial(before) : partial
  externalGameSet({ ...patch, eventGeneration: before.eventGeneration + 1 }, replace)
}) as typeof useGame.setState

useUi.subscribe((next, before) => {
  // GameScreen retires a directly injected old wrap-up by navigating Home.
  // It is neither a current round nor a pause, so do not let that one-way
  // safety redirect rewrite its cache on the way out.
  if (before.screen === 'game' && next.screen !== 'game' && !useGame.getState().settlementBusy && useGame.getState().mode !== 'wrapup') useGame.getState().pauseGame()
})
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !useGame.getState().settlementBusy) useGame.getState().pauseGame()
  })
}
