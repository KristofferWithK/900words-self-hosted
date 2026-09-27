import type { Catalogue } from '../en'
import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { system } from './system'

/** Nederlands. Je/jij, nooit u; Casey is ‘zij’. */
export const nl: Catalogue = { settings, system, home, onboarding, game, casey, guide }
