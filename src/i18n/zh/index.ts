import type { Catalogue } from '../en'
import { casey } from './casey'
import { game } from './game'
import { guide } from './guide'
import { home } from './home'
import { onboarding } from './onboarding'
import { settings } from './settings'
import { system } from './system'

/** 简体中文。用「你」，不用「您」；Casey 是「她」（UL12，§6.4）。*/
export const zh: Catalogue = { settings, system, home, onboarding, game, casey, guide }
