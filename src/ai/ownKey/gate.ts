import { AiError, type DecisionFn } from '../client'
import { UI } from '../../i18n'

/**
 * Build-time gate: only the open-source build lets a player bring their own
 * AI key. Every other bundle folds this constant to false and drops the
 * dynamic chunk, so the transport never ships in a store or web build.
 */
export const ownKeyAvailable = __BUILD_AUDIENCE__ === 'open-source'

export const requestOwnKeyDecision: DecisionFn = async (settings, request) => {
  if (__BUILD_AUDIENCE__ !== 'open-source') throw new AiError('server', UI.system.caseyServerError)
  const local = await import('./decision')
  return local.requestOwnKeyDecision(settings, request)
}

export async function testOwnKeyConnection(): Promise<void> {
  if (__BUILD_AUDIENCE__ !== 'open-source') throw new AiError('server', UI.system.caseyServerError)
  const local = await import('./decision')
  return local.testOwnKeyConnection()
}
