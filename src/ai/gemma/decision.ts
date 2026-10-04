import { AiError, requestDecision, type CaseyEnvelope, type CaseyRequest, type DecisionFn } from '../client'
import { UI } from '../../i18n'
import { CaseyServiceError, type CaseyAskModel, type CaseyChatMessage } from '../../../proxy/casey/orchestrator.js'
import { decideInApp } from '../inAppCasey'
import { cancelGemmaGeneration, gemmaStatus, generateWithGemma, unloadGemma, wasPutAway } from './native'
import { offlineCaseyWanted } from './residency'

/**
 * On-device Casey: the Worker's own orchestrator, running in the native app
 * with Gemma 4 E4B as its model.
 *
 * Everything that makes Casey play well is the orchestrator's, not the
 * model's: the request parser, the authored City 1 opening, the bank's clue
 * groups, the LCSI strengths and the evaluator's margin check on clues, the
 * certain answer to a clue a board was made for, the correction loop, and —
 * when the model gives nothing usable — the authored/index fallback that
 * keeps Casey playing. Importing the SAME module the Worker runs means a
 * phone decision passes every one of those rules, and a change to them
 * reaches both at once. This file only supplies the model and turns the
 * orchestrator's errors into the ones the game already shows for the Worker.
 *
 * The trial before this (2026-08-26) sent Gemma the bare prompt, with none
 * of the above; docs/mobile-hybrid-casey-research.md measured that as the
 * weaker player the orchestrator exists to support.
 */

const ARM = 'gemma4-e4b-mobile'
const METRICS_KEY = 'cluecab-gemma-device-gate-v1'

/**
 * Gemma's whole context on the phone, prompt AND reply: `maxNumTokens` in
 * GemmaPlugin.swift and CONTEXT_TOKENS in the Android plugin's GemmaModel.kt
 * (decision.test.ts pins all three together). Casey's clue
 * prompt measured 13,199 characters on a City 1 board and a guess prompt
 * 8,840 (2026-09-27), so the old 4,096 could not hold a clue at all, and the
 * native engine was left to overflow with no one waiting to stop it.
 */
export const CONTEXT_TOKENS = 8_192
/** Deliberately pessimistic, so a prompt that "fits" always does. */
const CHARS_PER_TOKEN = 3

/**
 * The Worker leaves clue and guess replies uncapped; on a phone every token
 * is wall time and context, so each gets what its JSON needs with room to
 * spare: a clue with its rationale, or a few guesses with their reasoning. A
 * cap the orchestrator asks for itself (the dictionary's 160) wins.
 */
const OUTPUT_TOKENS: Record<CaseyRequest['operation'], number> = {
  clue: 400,
  guess: 480,
  translate: 192,
  ping: 32,
}

/**
 * The longest one generation may take, and one Casey turn in all (it may
 * include corrections). Past either, Gemma is stopped and the orchestrator
 * plays its own move, as it does when the Worker's model does not answer;
 * the turn total matches the Worker transport's 90 s.
 */
const GENERATION_TIMEOUT_MS = 60_000
const TURN_BUDGET_MS = 90_000

/**
 * Leaving the app puts Gemma away (GemmaPlugin.swift and GemmaPlugin.kt: her
 * memory is freed, iOS runs no GPU work in the background, and Android kills
 * a background app holding gigabytes first), so a turn she was thinking
 * about fails with PUT_AWAY. It is asked again once the player is back, with
 * a fresh turn budget, rather than handed to the orchestrator's fallback: the
 * time away was the player's, not Gemma's. The waits grow, because JavaScript
 * may still run for a few seconds after the app leaves the screen, and every
 * ask in that window is refused at once; timers do not run while iOS has the
 * app suspended, so the next wait ends after the player is back.
 */
const PUT_AWAY_WAITS_MS = [1_000, 2_000, 4_000, 8_000, 16_000]

/**
 * How many times the page has been hidden. A generation timeout that fires
 * after the player left measured their absence, not Gemma, and on resume it
 * can race the plugin's own PUT_AWAY rejection.
 */
let departures = 0
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') departures++
  })
}

/** Waits `ms`, and then for as long as the app is off screen. */
async function untilBack(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
  while (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

/** Whether a prompt and its longest reply fit Gemma's context. */
export function fitsContext(system: string, prompt: string, maxOutputTokens: number): boolean {
  return Math.ceil((system.length + prompt.length) / CHARS_PER_TOKEN) + maxOutputTokens <= CONTEXT_TOKENS
}

/**
 * The generation, or a rejection once `ms` has passed — and then the native
 * generation is cancelled, because the plugin runs one at a time and a stuck
 * one would block every Casey turn after it.
 */
async function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  // A cancelled generation still settles, after this caller has moved on.
  work.catch(() => {})
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void cancelGemmaGeneration().catch(() => {})
      reject(new Error('timed out'))
    }, ms)
  })
  try {
    return await Promise.race([work, late])
  } finally {
    clearTimeout(timer)
  }
}

type Metric =
  | {
      kind: 'generation'
      operation: CaseyRequest['operation']
      attempt: number
      loadMs: number
      firstTokenMs: number
      generationMs: number
      /** Android only: whether the GPU or the CPU answered. */
      backend?: string
    }
  | { kind: 'decision'; operation: CaseyRequest['operation']; arm: string; refused: boolean; ms: number }
  | { kind: 'skipped'; operation: CaseyRequest['operation']; attempt: number; reason: 'context' | 'turn-budget' | 'timeout' | 'error' | 'put-away' }

/** The device gate's ring of the last hundred measurements, read off the phone. */
function recordMetric(metric: Metric): void {
  if (typeof localStorage === 'undefined') return
  try {
    const previous = JSON.parse(localStorage.getItem(METRICS_KEY) ?? '[]') as unknown
    const entries = Array.isArray(previous) ? previous.slice(-99) : []
    entries.push({ at: Date.now(), ...metric })
    localStorage.setItem(METRICS_KEY, JSON.stringify(entries))
  } catch {
    // Measurement must never cost the player a Casey turn.
  }
}

/**
 * The plugin takes one system text and one prompt; the orchestrator speaks
 * in chat turns. A correction arrives as later turns — Casey's rejected
 * reply, then what was wrong with it — so they stay in order, and the
 * rejected reply is labelled as hers rather than run into the request.
 */
function promptParts(messages: readonly CaseyChatMessage[]): { system: string; prompt: string } {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const prompt = messages
    .filter((message) => message.role !== 'system')
    .map((message) =>
      message.role === 'assistant' ? `Your previous reply was:\n${message.content}` : message.content,
    )
    .join('\n\n')
  return { system, prompt }
}

function gemmaModel(operation: CaseyRequest['operation']): CaseyAskModel {
  let attempt = 0
  let deadline = Date.now() + TURN_BUDGET_MS
  // No answer is a model failure, not a refusal: the orchestrator plays its
  // own authored/index move instead, exactly as it does when the Worker's
  // upstream is down. The device-gate ring says which it was.
  const noAnswer = (reason: 'context' | 'turn-budget' | 'timeout' | 'error' | 'put-away') => {
    recordMetric({ kind: 'skipped', operation, attempt: attempt++, reason })
    return new CaseyServiceError('upstream_unavailable', 'Casey’s on-device model did not answer.', 502)
  }
  return async (messages, options) => {
    const { system, prompt } = promptParts(messages)
    const maxOutputTokens = options.maxTokens ?? OUTPUT_TOKENS[operation]
    // A prompt that cannot fit is never sent: the native engine is not
    // trusted to fail cleanly past its context.
    if (!fitsContext(system, prompt, maxOutputTokens)) throw noAnswer('context')
    let result
    for (let putAways = 0; ; putAways++) {
      const left = deadline - Date.now()
      if (left <= 0) throw noAnswer('turn-budget')
      const departed = departures
      try {
        result = await withinTime(
          generateWithGemma({ system, prompt, temperature: options.temperature, maxOutputTokens }),
          Math.min(GENERATION_TIMEOUT_MS, left),
        )
        break
      } catch (error) {
        const putAway = wasPutAway(error) || departures !== departed
        const wait = PUT_AWAY_WAITS_MS[putAways]
        if (putAway && wait !== undefined) {
          await untilBack(wait)
          // Asked again only for a round still open with her: one the player
          // left, or took back online, must not load her again.
          if (offlineCaseyWanted()) {
            recordMetric({ kind: 'skipped', operation, attempt: attempt++, reason: 'put-away' })
            deadline = Date.now() + TURN_BUDGET_MS
            continue
          }
        }
        throw noAnswer(putAway ? 'put-away' : error instanceof Error && error.message === 'timed out' ? 'timeout' : 'error')
      }
    }
    recordMetric({
      kind: 'generation',
      operation,
      attempt: attempt++,
      loadMs: result.loadMs,
      firstTokenMs: result.firstTokenMs,
      generationMs: result.generationMs,
      ...(result.backend ? { backend: result.backend } : {}),
    })
    return result.text
  }
}

/** Whether the model file is on this phone; a status call that fails says no. */
async function modelInstalled(): Promise<boolean> {
  try {
    return (await gemmaStatus()).installed
  } catch {
    return false
  }
}

/**
 * Choosing Gemma is not having her. Until the model is downloaded, the
 * Worker plays: otherwise every call would fail and the orchestrator's
 * fallback would play the whole round with no model at all, which is not
 * Casey (owner, 2026-08-22) and would read as Gemma to whoever is testing her.
 */
export const requestGemmaDecision: DecisionFn = async (settings, request) => {
  if (await modelInstalled()) return decideOnDevice(settings, request)
  const started = Date.now()
  const envelope = await requestDecision(settings, request)
  recordMetric({
    kind: 'decision',
    operation: request.operation,
    arm: `worker:${envelope.report.arm}`,
    refused: envelope.report.refused,
    ms: Date.now() - started,
  })
  return envelope
}

const decideOnDevice: DecisionFn = async (settings, request): Promise<CaseyEnvelope> => {
  const started = Date.now()
  try {
    const envelope = await decideInApp(settings, request, gemmaModel(request.operation), ARM)
    recordMetric({
      kind: 'decision',
      operation: request.operation,
      arm: envelope.report.arm,
      refused: envelope.report.refused,
      ms: Date.now() - started,
    })
    return envelope
  } finally {
    // A move nobody is waiting for any more (the round was left while she
    // thought), or one asked from outside a round (the Settings test): she
    // goes away with it rather than staying in memory.
    if (!offlineCaseyWanted()) void unloadGemma().catch(() => {})
  }
}

export async function testGemmaConnection(): Promise<void> {
  // Gemma herself, installed or not: a Worker answer must never pass this check.
  const response = await decideOnDevice({ baseUrl: '' }, { protocol: 1, operation: 'ping' })
  if ((response.decision as { ok?: boolean }).ok !== true) {
    throw new AiError('invalid-response', UI.system.caseyPingFailed)
  }
}
