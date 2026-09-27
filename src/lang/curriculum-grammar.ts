import type { GrammarLessonRuleBlock, GrammarRewriteBrief } from './curriculum-content'

/**
 * The large, optional train lesson a language owns for each destination city.
 *
 * This deliberately sits beside the wider curriculum manifest. The manifest
 * supplies the route contract; the accepted content brief supplies the learner
 * wording and boundaries that T2 can render without teaching shared journey
 * code anything Danish-specific.
 */
export interface GrammarChapter {
  readonly cityId: string
  readonly cityIndex: number
  readonly titleDa: string
  readonly titleEn: string
  /**
   * The Danish-only chapter performance. These are the accepted model lines,
   * in the order one natural reading says them; English remains visual support
   * in the lesson rather than an extra narrator in the train.
   */
  readonly performanceDa: readonly string[]
  /** Markdown supported by GrammarLesson's intentionally small renderer. */
  readonly body: string
}

export interface GrammarCourse {
  /** One audio-bearing primary chapter per route city; ids remain chapter-01…09. */
  readonly chapters: readonly GrammarChapter[]
  /** Fixed reader lessons. A city may own more than one without changing route order. */
  readonly lessons: readonly GrammarLesson[]
}

export interface GrammarLesson {
  readonly id: string
  readonly cityId: string
  readonly cityIndex: number
  readonly titleDa: string
  readonly titleEn: string
  readonly rulesContext: string
  readonly rules: readonly GrammarLessonRuleBlock[]
  readonly examplesTitleEn: string
  readonly examples: readonly (readonly [danish: string, english: string])[]
}

/** Turn the accepted T6 brief into the compact, optional train reading. */
export function grammarCourseFromBrief(brief: GrammarRewriteBrief): GrammarCourse {
  if (brief.status !== 'accepted') {
    throw new Error('A train grammar course requires accepted curriculum content')
  }
  return project(brief)
}

/**
 * The same projection, for a brief that is still REVIEW-READY.
 *
 * This exists so an unfinished language can be read in the app by the person
 * reviewing it, which is the only way a native verifier can judge the Travel
 * Guide as a learner meets it rather than as TypeScript. It is a real
 * weakening of the gate `grammarCourseFromBrief` holds, so it is narrowed
 * twice: only a pack whose `readiness` is `'preview'` may call it, and such a
 * pack cannot be played — `LanguagePack.readiness` turns the boards off and
 * the UI says the language is unverified. Content still reaches a LEARNER only
 * through `grammarCourseFromBrief`, and only once the brief is accepted.
 */
export function previewGrammarCourseFromBrief(brief: GrammarRewriteBrief): GrammarCourse {
  return project(brief)
}

function project(brief: GrammarRewriteBrief): GrammarCourse {
  const chapters = brief.chapters.map((chapter, cityIndex) => ({
      cityId: chapter.cityId,
      cityIndex,
      titleDa: chapter.titleDa,
      titleEn: chapter.titleEn,
      performanceDa: chapter.modelExamplesDa,
      body: [
        `**Focus.** ${chapter.formalFocusEn}`,
        '**What to notice.**',
        ...chapter.rewriteEn.map((line) => `- ${line}`),
        '**Examples.**',
        ...chapter.modelExamplesDa.map((line) => `- \`${line}\``),
        '**Keep in mind.**',
        ...chapter.doNotClaimEn.map((line) => `- ${line}`),
      ].join('\n\n'),
    }))
  const lessons = brief.chapters.flatMap((chapter, cityIndex) =>
    [chapter.lesson, ...(chapter.additionalLessons ?? [])].map((lesson): GrammarLesson => ({
      ...lesson,
      cityId: chapter.cityId,
      cityIndex,
    })),
  )
  return { chapters, lessons }
}
