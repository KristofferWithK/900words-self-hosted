import { curriculumTaskAudio } from '../curriculum-audio'
import { danishCurriculumContent } from './curriculum-content'

/** The accepted Danish S4 inventory; its serialised build source is validator-pinned. */
export const danishCurriculumTaskAudio = curriculumTaskAudio(danishCurriculumContent)
