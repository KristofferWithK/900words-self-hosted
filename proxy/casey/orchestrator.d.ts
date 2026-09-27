/**
 * Types for the Worker's Casey orchestrator, so `src/` can run it on the
 * phone.
 *
 * The module itself is plain JavaScript and lives with the Worker, which
 * remains the production copy. The native app's on-device Casey
 * (`src/ai/gemma/decision.ts`) imports the SAME module and hands it a model
 * of its own, so a clue or guess made on the phone passes exactly the
 * parsing, validation, authored-bank, index and fallback rules a Worker
 * decision does. Only the signatures that caller needs are named.
 */

export declare const CASEY_PROTOCOL: 1

export declare class CaseyServiceError extends Error {
  constructor(code: string, message: string, status?: number)
  readonly code: string
  readonly status: number
}

export interface CaseyChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** What the orchestrator asks of one model call; the transport chooses how. */
export interface CaseyModelOptions {
  readonly temperature: number
  /** True on a corrective attempt: the Worker may route it to a stronger alias. */
  readonly escalate?: boolean
  readonly maxTokens?: number
  readonly reasoningEffort?: string
  readonly disableSearch?: boolean
  readonly retryOn5xx?: boolean
}

/**
 * One model call: the reply's text content. Throw a CaseyServiceError with
 * code `upstream_unavailable` (or `upstream_error`, `upstream_rate_limit`,
 * `invalid_model_reply`) when there is no usable answer, and the orchestrator
 * plays its own authored/index fallback instead, exactly as on the Worker.
 */
export type CaseyAskModel = (
  messages: readonly CaseyChatMessage[],
  options: CaseyModelOptions,
) => Promise<string>

/** The validated request `decide` accepts; opaque to callers. */
export type ParsedCaseyRequest = { readonly operation: 'clue' | 'guess' | 'translate' | 'ping' } & Record<string, unknown>

export interface CaseyDecisionResult {
  readonly protocol: 1
  readonly decision: unknown
  readonly report: { readonly arm: string; readonly refused: boolean }
}

/** Throws CaseyServiceError('invalid_request', …) for anything the Worker would refuse. */
export declare function parseDecisionRequest(value: unknown): ParsedCaseyRequest

export declare function decide(
  request: ParsedCaseyRequest,
  askModel: CaseyAskModel,
  arm?: string,
): Promise<CaseyDecisionResult>
