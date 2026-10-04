import type { Catalogue } from '../en'
import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { sightseeing } from './sightseeing'
import { system } from './system'

/**
 * Norsk bokmål. Du; Casey er «hun». Moderat bokmål — «fram», «nå», «hva»,
 * «etter», «mye» — og aldri en dansk form der en norsk finnes. De danske
 * ordene står i «» og forblir danske.
 */
export const nb: Catalogue = { settings, system, home, onboarding, game, casey, guide, sightseeing }
