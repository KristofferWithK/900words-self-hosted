import { UI_LANGUAGE } from '../active'
import { guideCopy, guideCopyFor } from '../guide'

/**
 * The compiled runtime overlay for the Guide's teaching copy.
 *
 * The `…En` fields inside the Danish pack are the English source; the sidecars
 * under `src/i18n/guide/` hold the translations keyed `<id>.<field>`. This
 * layer is the seam the session path reads: every consumer asks it for a field
 * and passes the pack's own English value, so a language with no entry falls
 * back to that English — never a partial row.
 *
 * All-or-nothing arity: a language resolves a field only when its sidecar has a
 * non-empty entry for that exact key; anything else returns the English
 * source unchanged. (docs/ui-language-plan.md §8.2)
 */

export type LearningField =
  | 'titleEn'
  | 'travelGuideContextEn'
  | 'promptEn'
  | 'visualSupportEn'
  | 'observationEn'
  | 'feedbackEn'
  | 'successCriterionEn'
  | 'novelDetailEn'
  | 'examplesTitleEn'
  | 'themeEn'

/** The player's language: the overlay compiles against the sidecar it selects. */
export const LEARNING_LANGUAGE = UI_LANGUAGE

/**
 * One field of one guide entry, in the language the app is speaking. The
 * English source is passed by the caller (the pack owns it), so there is no
 * silent lookup that could hide a missing translation behind an empty string.
 */
export function learningCopy(id: string, field: LearningField, source: string): string {
  const value = guideCopy(id, field, source)
  // All-or-nothing: an empty or whitespace sidecar entry is a missing entry.
  return value.trim() === '' ? source : value
}

/**
 * The same resolution for an explicit launch language — the per-language
 * coverage path. A language that has any missing entry resolves that string
 * to the English source (never a partial row); the coverage test asserts no
 * launch language actually needs to.
 */
export function learningCopyFor(lang: string, id: string, field: LearningField, source: string): string {
  const value = guideCopyFor(lang, id, field, source)
  return value.trim() === '' ? source : value
}