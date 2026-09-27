import { UI_LANGUAGE } from '../active'
import { guide as deGuide } from './de'
import { guide as svGuide } from './sv'
import { guide as plGuide } from './pl'
import { guide as ptGuide } from './pt'
import { guide as frGuide } from './fr'
import { guide as zhGuide } from './zh'

const SIDECARS: Partial<Record<string, Record<string, string>>> = {
  de: deGuide,
  sv: svGuide,
  pl: plGuide,
  pt: ptGuide,
  fr: frGuide,
  zh: zhGuide,
}

export const COMPLETE: Record<string, boolean> = {
  en: true,
  de: false,
  sv: false,
  pl: false,
  pt: false,
  fr: false,
  zh: false,
}

/**
 * The same resolution for an explicit language rather than the active one —
 * the overlay under `src/i18n/learning/` resolves each launch language
 * through this, so per-language coverage can be tested without a page
 * reload. A language with no sidecar resolves to the English source.
 */
export function guideCopyFor(lang: string, id: string, field: string, source: string): string {
  const value = SIDECARS[lang]?.[`${id}.${field}`]
  return value ?? source
}

export function guideCopy(id: string, field: string, source: string): string {
  if (UI_LANGUAGE === 'en') return source
  return guideCopyFor(UI_LANGUAGE, id, field, source)
}
