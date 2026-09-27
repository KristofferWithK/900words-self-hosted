import { DANISH_LANGUAGE, checkClueLegality } from './language.js'
import { GERMAN_LANGUAGE } from './language.de.js'

const DANISH = { ...DANISH_LANGUAGE, checkClueLegality }
export const languageFor = (code = 'da') => code === 'de' ? GERMAN_LANGUAGE : code === 'da' ? DANISH : null
export const languageForView = (view) => languageFor(view.words.every(word => word.id.startsWith('de:')) ? 'de' : 'da')
