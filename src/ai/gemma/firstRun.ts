import { UI } from '../../i18n'
import { useSettings } from '../../stores/settingsStore'
import {
  belowOfflineCaseyMemory,
  gemmaStatus,
  gigabytes,
  OFFLINE_CASEY_IPHONES,
  startGemmaDownload,
  type GemmaStatus,
} from './native'

/** Set once the offer has been made, answered either way. */
export const OSS_GEMMA_OFFERED_KEY = 'cluecab-oss-gemma-offered-v1'

/**
 * A self-built iPhone 900words works out of the box with Gemma (owner,
 * 2026-09-27): Casey's source defaults to her there (settingsStore), and on
 * the first launch this offers her one-time download with the explanation
 * the player needs: size, Wi-Fi, the iPhones she runs on, and that an AI key
 * is the alternative. Asked once; Settings → Casey's AI has the rest.
 *
 * Only the open-source native build imports this (App.tsx, behind the build
 * literals), so a store build never carries it.
 */
export async function offerGemmaOnFirstRun(
  status: () => Promise<GemmaStatus> = gemmaStatus,
  confirm: (text: string) => boolean = (text) => window.confirm(text),
  download: () => Promise<void> = startGemmaDownload,
): Promise<'offered' | 'skipped'> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(OSS_GEMMA_OFFERED_KEY)) return 'skipped'
  if (useSettings.getState().caseyMode !== 'gemma4-e4b') return 'skipped'
  const current = await status()
  if (!current.supported || current.installed || current.downloading) return 'skipped'
  localStorage.setItem(OSS_GEMMA_OFFERED_KEY, String(Date.now()))
  const explained = UI.settings.ossGemmaFirstRun(
    gigabytes(current.expectedBytes),
    OFFLINE_CASEY_IPHONES.join(', '),
    belowOfflineCaseyMemory(current),
  )
  if (confirm(explained)) await download().catch(() => undefined)
  return 'offered'
}
