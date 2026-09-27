import { grammarCourseFromBrief } from '../curriculum-grammar'
import { DANISH_GRAMMAR_REWRITE_BRIEF } from './curriculum-grammar-brief'

/**
 * The accepted destination-owned Danish train course. It is intentionally
 * derived from the T6-reviewed brief, never from the archived departure-owned
 * grammar draft.
 */
export const danishGrammarCourse = grammarCourseFromBrief(DANISH_GRAMMAR_REWRITE_BRIEF)
