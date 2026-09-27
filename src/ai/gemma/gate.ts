import { AiError, type DecisionFn } from '../client'
import type { CaseyMode } from '../../stores/settingsStore'

/**
 * Build-time gate around on-device Casey. Only the developer and normal
 * native builds (vite.config.ts, `__ON_DEVICE_CASEY__`) carry her: every other
 * bundle folds the constant to false and drops the dynamic chunk, so neither
 * Casey's prompts nor City 1's shards ride into a feedback, open-source or web
 * build.
 */
export const onDeviceCaseyAvailable = __ON_DEVICE_CASEY__

/**
 * Whether a round is played by on-device Casey. A saved `gemma4-e4b` choice
 * counts only where she exists: a build without her, installed over one that
 * had her, keeps its settings and must still play with the Worker.
 */
export const playsOnDevice = (mode: CaseyMode): boolean => mode === 'gemma4-e4b' && onDeviceCaseyAvailable

export const requestGemmaDecision: DecisionFn = async (settings, request) => {
  if (!__ON_DEVICE_CASEY__) {
    throw new AiError('server', 'On-device Gemma is available only in the 900words iPhone app.')
  }
  const local = await import('./decision')
  return local.requestGemmaDecision(settings, request)
}

export async function testGemmaConnection(): Promise<void> {
  if (!__ON_DEVICE_CASEY__) {
    throw new AiError('server', 'On-device Gemma is available only in the 900words iPhone app.')
  }
  const local = await import('./decision')
  return local.testGemmaConnection()
}
