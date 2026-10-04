import type { Catalogue } from '../en'
import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { sightseeing } from './sightseeing'
import { system } from './system'

/** Svenska. Du; Casey är ”hon”. */
export const sv: Catalogue = { settings, system, home, onboarding, game, casey, guide, sightseeing }
