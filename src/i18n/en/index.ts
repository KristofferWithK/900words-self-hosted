import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { system } from './system'

/**
 * THE SOURCE OF TRUTH (UL4).
 *
 * English is written first and every other language is DECLARED WITH THIS
 * TYPE, so `tsc -b` is the gate: a key added here without its three
 * translations does not compile, and a key added to German that English does
 * not have does not compile either. There is no runtime lookup, no key string,
 * and no interpolation syntax to get wrong — a string with a value in it is a
 * function, and each language writes its own word order and its own plural
 * rule in ordinary TypeScript.
 *
 * Deliberately no `as const`: every string property types as `string` so the
 * translations are not each forced to repeat the English literal as a type.
 */
export const en = { settings, system, home, onboarding, game, casey, guide }

export type Catalogue = typeof en
