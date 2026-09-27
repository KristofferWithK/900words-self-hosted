import {
  AiError,
  CASEY_PROTOCOL,
  requestDecision,
  type AiSettings,
  type DecisionFn,
} from './client'
import { aiGuessableIds, aiTargetableIds, type AiClueView, type AiGuessView } from './projections'
import {
  ClueResponseSchema,
  GuessResponseSchema,
  TranslationResponseSchema,
  type ClueResponse,
  type GuessResponse,
  type TranslationResponse,
} from './schemas'

/** What the server reports about the model-backed call that produced a clue. */
export interface CallReport {
  /** Server-owned model alias, or `mock` for the explicit local test seam. */
  arm: string
  /** Whether the server rejected at least one model answer before this one. */
  refused: boolean
}
export interface Companion {
  readonly lastCall?: CallReport | null
  getClue(view: AiClueView): Promise<ClueResponse>
  getGuesses(view: AiGuessView, options?: GuessRequestOptions): Promise<GuessResponse>
  /** One word, either direction. Takes no view: it must not see the board. */
  translate(term: string): Promise<TranslationResponse>
}

export interface GuessRequestOptions {
  candidateMode?: 'top-two'
}

/**
 * Guess execution remains a deterministic game rule in the app. Casey ranks;
 * the game caps at the clue number and stops after the first low-confidence
 * continuation, while always taking the top-ranked guess.
 */
export function planGuessExecution(
  guesses: GuessResponse['guesses'],
  clueNumber: number,
): GuessResponse['guesses'] {
  const ordered = [...guesses].sort((a, b) => b.confidence - a.confidence)
  const plan: GuessResponse['guesses'] = []
  for (const guess of ordered) {
    if (plan.length >= clueNumber) break
    if (plan.length >= 1 && guess.confidence < 0.35) break
    plan.push(guess)
  }
  if (plan.length === 0 && ordered.length > 0) plan.push(ordered[0]!)
  return plan
}

/** The server arm that returns a guess from the authored board's own key. */
export const AUTHORED_ARM = 'authored'

/** Whether the report marks this response as an authored answer. */
export const isAuthoredResponse = (report: CallReport | null | undefined): boolean =>
  report?.arm === AUTHORED_ARM

const invalidDecision = (what: string) =>
  new AiError('invalid-response', `Casey’s server returned an invalid ${what}.`)

/**
 * Thin client for the server-owned Casey brain. The browser sends a projection
 * and receives a finished decision; prompts, retries, legality, evaluator data,
 * model aliases, and credentials all stay beyond the Worker boundary.
 */
export class OllamaCompanion implements Companion {
  lastCall: CallReport | null = null

  constructor(
    private settings: AiSettings,
    private decide: DecisionFn = requestDecision,
  ) {}

  async getClue(view: AiClueView): Promise<ClueResponse> {
    const targetable = new Set(aiTargetableIds(view))
    if (targetable.size === 0) {
      throw new AiError('invalid-response', 'Casey has no words left to clue this round.')
    }
    const response = await this.decide(this.settings, {
      protocol: CASEY_PROTOCOL,
      operation: 'clue',
      view,
    })
    const parsed = ClueResponseSchema.safeParse(response.decision)
    if (!parsed.success) throw invalidDecision('clue')
    const targets = [...new Set(parsed.data.targetWordIds)]
    if (
      targets.length === 0 ||
      targets.length > 4 ||
      (targets.length === 1 && targetable.size !== 1) ||
      targets.some((wordId) => !targetable.has(wordId)) ||
      parsed.data.number !== targets.length
    ) {
      throw invalidDecision('clue')
    }
    this.lastCall = response.report
    return { ...parsed.data, targetWordIds: targets }
  }

  async getGuesses(view: AiGuessView, options: GuessRequestOptions = {}): Promise<GuessResponse> {
    const guessable = new Set(aiGuessableIds(view))
    const response = await this.decide(this.settings, {
      protocol: CASEY_PROTOCOL,
      operation: 'guess',
      view,
      ...(options.candidateMode ? { candidateMode: options.candidateMode } : {}),
    })
    const parsed = GuessResponseSchema.safeParse(response.decision)
    if (!parsed.success || parsed.data.guesses.every((guess) => !guessable.has(guess.wordId))) {
      throw invalidDecision('guess list')
    }
    // Recorded for the guess side too: the store reads the arm off it to know
    // whether this answer came from the board's own key (`isAuthoredResponse`).
    // Only the clue ledger reads it after a clue, and every turn constructs a
    // fresh companion, so the two never see each other's report.
    this.lastCall = response.report
    // An authored response is a complete, finite guaranteed-green turn plan.
    // Preserve it even though the ordinary request asked for alternatives for
    // one guess; the store uses the report to keep legacy plan semantics.
    if (options.candidateMode === 'top-two' && !isAuthoredResponse(response.report)) {
      const seen = new Set<string>()
      const guesses = parsed.data.guesses.filter((guess) => {
        if (!guessable.has(guess.wordId) || seen.has(guess.wordId)) return false
        seen.add(guess.wordId)
        return true
      }).slice(0, 2)
      return { guesses }
    }
    return { guesses: parsed.data.guesses.filter((guess) => guessable.has(guess.wordId)) }
  }

  async translate(term: string): Promise<TranslationResponse> {
    const response = await this.decide(this.settings, {
      protocol: CASEY_PROTOCOL,
      operation: 'translate',
      term,
    })
    const parsed = TranslationResponseSchema.safeParse(response.decision)
    if (!parsed.success) throw invalidDecision('translation')
    return parsed.data
  }
}
