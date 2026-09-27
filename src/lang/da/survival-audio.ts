import survivalAudioSource from '../../data/survival-audio.da.json'
import germanSurvivalAudioSource from '../../data/survival-audio.de.json'

export function survivalAudioLineId(activityId: string, lineIndex: number): string {
  return `${activityId}-line-${lineIndex + 1}`
}

/**
 * The frozen source rows per language: Danish's 144 Aoede turns, and German
 * City 1's 16 Leda turns (owner, 2026-09-26). A language with no row for an
 * id has no recording of it, and the reader greys that Listen out.
 */
const SOURCES: Record<string, typeof survivalAudioSource> = {
  da: survivalAudioSource,
  de: germanSurvivalAudioSource,
}

/** The frozen source row used both for cache versioning and the bake. */
export function survivalAudioSourceFor(id: string, language = 'da') {
  return SOURCES[language]?.entries.find((entry) => entry.id === id)
}

export { survivalAudioSource }
