import { AiError, decisionBody, type AiSettings, type CaseyEnvelope, type CaseyRequest } from './client'
import { UI } from '../i18n'
import {
  CaseyServiceError,
  decide,
  parseDecisionRequest,
  type CaseyAskModel,
} from '../../proxy/casey/orchestrator.js'

/**
 * Casey's own logic, run in the app with a model of the caller's choosing:
 * on-device Gemma (src/ai/gemma/), or a player's own AI key in the
 * open-source build (src/ai/ownKey/).
 *
 * It is the Worker's module, `proxy/casey/orchestrator.js`: the request
 * parser, the authored City 1 opening, the bank's clue groups, the LCSI
 * strengths and the evaluator's margin check, the certain answer to a clue a
 * board was made for, the correction loop, and the authored/index fallback
 * when a model gives nothing usable. So a decision made in the app passes the
 * same rules as one made on the Worker, and a change to them reaches both.
 *
 * Only reachable through a dynamic import behind a build-time gate, so the
 * orchestrator and City 1's shards stay out of every bundle that plays with
 * the Worker alone (scripts/validate-client-boundary.mjs).
 */
export async function decideInApp(
  settings: AiSettings,
  request: CaseyRequest,
  askModel: CaseyAskModel,
  arm: string,
): Promise<CaseyEnvelope> {
  try {
    // Through JSON, as the Worker receives it: the orchestrator's strict
    // parser then refuses in the app exactly what it refuses there.
    const parsed = parseDecisionRequest(JSON.parse(JSON.stringify(decisionBody(settings, request))))
    const result = await decide(parsed, askModel, arm)
    return JSON.parse(JSON.stringify(result)) as CaseyEnvelope
  } catch (error) {
    throw playerError(error)
  }
}

/**
 * The same verdicts `responseError` in client.ts gives a Worker's answers. An
 * AiError a model transport threw on purpose (no internet, a refused key)
 * passes through unchanged.
 */
export function playerError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof CaseyServiceError) {
    if (error.code === 'invalid_model_reply' && error.message) {
      // Authored by the orchestrator's operation-specific fallback, never
      // copied from the model or its validator.
      return new AiError('invalid-response', error.message)
    }
    if (error.status >= 400 && error.status < 500) {
      return new AiError('invalid-response', error.message || UI.system.caseyRefusedView)
    }
  }
  return new AiError('server', UI.system.caseyServerError)
}
