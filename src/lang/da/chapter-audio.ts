import { chapterAudioFromCourse, grammarLessonAudioFromCourse } from '../chapter-audio'
import { danishGrammarCourse } from './curriculum-grammar'

/** The accepted Danish source for S3's continuous chapter performances. */
export const danishChapterAudio = chapterAudioFromCourse(danishGrammarCourse)

/** Every fixed train lesson's canonical Danish example lines. */
export const danishGrammarLessonAudio = grammarLessonAudioFromCourse(danishGrammarCourse)
