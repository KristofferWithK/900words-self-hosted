import { grammarLessonAudioFromCourse } from '../chapter-audio'
import { germanGrammarCourse } from './curriculum-grammar'

/** Every fixed train lesson's German example lines, the source of the Leda chapter bake. */
export const germanGrammarLessonAudio = grammarLessonAudioFromCourse(germanGrammarCourse())
