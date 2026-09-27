import type { Catalogue } from '../en'
import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { system } from './system'

/** Español. Tú, nunca usted; Casey es «ella» (UL12, §6.3). */
export const es: Catalogue = { settings, system, home, onboarding, game, casey, guide }
