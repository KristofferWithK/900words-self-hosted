import type { GrammarRewriteBrief } from '../curriculum-content'
import { GERMAN_BEGINNER_GRAMMAR_LESSONS } from './beginner-grammar-lessons'

/**
 * The German course: nine destination-owned chapters and the twenty Travel
 * Guide lessons they carry.
 *
 * ── STATUS: review-ready, and that is load-bearing ─────────────────────────
 *
 * `status` is `'review-ready'`, so `grammarCourseFromBrief` refuses to build a
 * course from it and nothing here can reach a learner yet. That is the gate,
 * not an oversight: DECISIONS.md holds shipping German behind the owner as the
 * named native verifier, because unverified German in a language-learning app
 * is the one quality risk the project decided not to take. Accepting this
 * content is a one-word change here, after that review.
 *
 * ── WHAT DECIDED THIS ORDER ────────────────────────────────────────────────
 *
 * The city loop, the nine-unit route, the optional-everything contract and the
 * A1/A2 checkpoints are the shared architecture (`docs/curriculum-architecture.md`
 * §11). The sequence below is German's own, and the places it refuses to copy
 * Danish are written into `doNotClaimEn` rather than left to be noticed:
 *
 *  - Danish's suffixed definiteness has no German counterpart; the article is
 *    a separate word that will later change with the case, which is why the
 *    case question cannot be deferred as long as Danish deferred it.
 *  - Danish teaches one present-tense form for every person. German conjugates.
 *  - Danish spends four cities on a bounded-event versus relevant-now contrast
 *    between preterite and perfect. German has no such contrast — its split is
 *    register and region — so Nürnberg teaches the perfect as the ordinary
 *    spoken past and that budget goes to the sentence bracket in Bremen.
 *  - Danish makes attributive adjective agreement a productive city-six
 *    target. German's is a 48-cell system and stays receptive past the A2 gate.
 *  - Danish uses du productively and De receptively. German inverts that: Sie
 *    is the working register of the transaction, direction, help and service
 *    scenes, so the choice is taught in chapter one.
 *
 * Bremen teaches the separable-verb bracket before the fronted-time inversion
 * on purpose. The German processability evidence puts the particle before the
 * inversion and the verb-final clause last; that literature describes the
 * emergence of spontaneous production, which this app never samples, so it is
 * used here as a reason not to invert the order rather than as a syllabus.
 *
 * `titleDa` holds the German title — see the note in `beginner-grammar-lessons.ts`.
 */
export const GERMAN_GRAMMAR_REWRITE_BRIEF: GrammarRewriteBrief = {
  status: 'review-ready',
  chapterSemanticsEn: 'Each chapter belongs to the destination city it prepares. Flensburg is available before the first ordinary board; chapters two through nine belong on the rides into Lübeck through Berlin. There is no chapter after Berlin.',
  exampleSentenceRulesEn: [
    'Keep all card ids, curriculum ranks and city membership unchanged; rewrite only examples and their support metadata.',
    'A city example may use sentence-only support language that has been introduced by that city, even when the support expression is not a card.',
    'Tag the structure and communicative function actually instantiated; do not infer a target from an English gloss or a keyword alone.',
    'Every exchange declares whether it is in the du or the Sie register, and the setting must make that choice plausible.',
    'Prefer short everyday standard German. Mark regional or colloquial forms as listening input, not as the only written model.',
    'Keep English as visible support and translation only. German is the sole audio language for curriculum prompts and exchanges.',
    'Do not turn a productive target into a pronunciation or spontaneous-speaking claim; the app collects listening, reading, controlled interaction, supported interaction, writing and grammar-in-use evidence.',
  ],
  chapters: [
    {
      cityId: 'flensburg',
      titleDa: 'Ein Tisch, eine Tür, ein Haus',
      titleEn: 'A table, a door, a house',
      formalFocusEn: 'Three noun groups, nominative articles, capitalised nouns, the du/Sie choice and first repair chunks.',
      rewriteEn: [
        'Present der, die and das with a small set of known nouns and pair every noun with its article from the first encounter.',
        'Name the ending families that are dependable (-ung, -heit, -keit and -schaft as die; -chen and -lein as das) and say plainly that most ordinary nouns carry no such signal.',
        'Show that der and das words share ein while die words take eine, so the indefinite article hides a distinction the definite article shows.',
        'Build es gibt / gibt es, immediate-help and repair chunks into the chapter so an unfamiliar place or message never has to be guessed.',
        'Make the du/Sie choice explicit from the first exchange: Sie with adult strangers and at counters, du where it has been offered.',
      ],
      doNotClaimEn: [
        'Do not claim that noun gender can be predicted from meaning; the dependable signals are word endings, not kinds of thing.',
        'Do not present those ending families as covering the bulk of everyday vocabulary.',
        'Do not describe German definiteness as something the noun itself carries; the article is a separate word that will later change with the case.',
        'Do not teach du as the neutral default or Sie as old-fashioned; both are current and the situation chooses.',
        'Do not assess productive plural formation here.',
      ],
      modelExamplesDa: ['Das ist ein Tisch.', 'Wo ist die Tür?', 'Das Haus ist klein.', 'Entschuldigung, können Sie mir helfen?'],
      descriptorIds: ['cefr-a1-repair-with-help', 'cefr-a1-basic-information-exchange', 'profile-deutsch-a1-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.flensburg[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.flensburg.slice(1),
    },
    {
      cityId: 'luebeck',
      titleDa: 'Ich wohne, du wohnst',
      titleEn: 'I live, you live',
      formalFocusEn: 'Subject pronouns, the present-tense paradigm, sein and haben, and possessives anchored to personal information.',
      rewriteEn: [
        'Teach the present tense as a paradigm whose ending follows the person, and make the ich and du forms the pair a first conversation rests on.',
        'Teach sein and haben as whole forms rather than as members of that paradigm.',
        'State the added -e for stems ending in -t or -d, and treat vowel-changing verbs such as du sprichst and er fährt as lexical.',
        'Show mein and dein agreeing with what is possessed, and Ihr as the capitalised polite form beside sein and ihr.',
        'Add spelling, phone-number and email exchanges so personal-information evidence includes usable contact details.',
      ],
      doNotClaimEn: [
        'Do not present a single present-tense form as sufficient; German marks the person and a learner who drops the ending is not simply informal.',
        'Do not say possessives agree with the possessor.',
        'Do not present the vowel change in du sprichst as derivable from the infinitive.',
        'Do not require unsupported occupational or nationality vocabulary as cards; supply it at sentence level.',
      ],
      modelExamplesDa: ['Ich heiße Lea und wohne in Lübeck.', 'Wo wohnst du?', 'Das ist mein Koffer.', 'Ist das Ihre Tasche?'],
      descriptorIds: ['cefr-a1-basic-information-exchange', 'rahmen-beginner-personal-and-daily-life', 'profile-deutsch-a1-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.luebeck[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.luebeck.slice(1),
    },
    {
      cityId: 'hamburg',
      titleDa: 'Ich möchte einen Kaffee',
      titleEn: 'I would like a coffee',
      formalFocusEn: 'Plural patterns, numbers and prices, the accusative as far as a transaction forces it, and the nicht/kein split.',
      rewriteEn: [
        'Teach the plural of each high-value item with the noun. Present -e, -er, -(e)n, -s and zero as common patterns and show the vowel change where it occurs.',
        'Show that the plural article is die for every group; it is the one dependable simplification available in this chapter.',
        'Introduce the accusative only as far as the scene forces it: der becomes den and ein becomes einen, while die and das words are unchanged.',
        'Teach kein where ein or no article would stand, and nicht everywhere else, including in front of der, die, das and mein.',
        'Teach Ich möchte … and Kann ich … haben? as neutral contemporary request frames in the Sie register.',
      ],
      doNotClaimEn: [
        'Do not claim any plural ending is a safe guess for a noun the learner has not met.',
        'Do not present the full four-case table; this chapter teaches one visible change in one group.',
        'Do not describe kein as negating the verb or nicht as negating the noun.',
        'Do not treat a number plus a noun as sufficient evidence of a successful transaction.',
        'Do not declare an unmitigated request rude; relationship, setting and intonation affect register.',
      ],
      modelExamplesDa: ['Ich möchte einen Kaffee, bitte.', 'Zwei Tickets, bitte.', 'Wir haben keinen Tee.', 'Wie viel kostet das?'],
      descriptorIds: ['cefr-a1-transactions-and-directions', 'rahmen-beginner-transaction-and-transport', 'profile-deutsch-a1-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.hamburg[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.hamburg.slice(1),
    },
    {
      cityId: 'bremen',
      titleDa: 'Um acht stehe ich auf',
      titleEn: 'At eight I get up',
      formalFocusEn: 'The sentence bracket with separable verbs, time expressions, and finite-verb-second order after a fronted time element.',
      rewriteEn: [
        'Teach the separable verb first: the verb keeps its ordinary place and its first piece travels to the end of the sentence.',
        'Then contrast a subject-first main clause with the same clause after one fronted time element: Ich arbeite um acht → Um acht arbeite ich.',
        'Describe verb-second as the finite verb occupying the second constituent, not the second written word.',
        'Say that a fronted element is ordinary German and signals neither a question nor emphasis.',
        'Keep weekdays, month names, ordinal dates and 24-hour clock input tied to planning a real day rather than to a syntax inventory.',
        'Keep this order between the two sheets. A learner who cannot yet place a separable particle is not ready to move the subject behind the verb.',
      ],
      doNotClaimEn: [
        'Do not say the verb is always the second word.',
        'Do not extend main-clause verb-second unchanged to subordinate clauses.',
        'Do not derive a separable verb’s meaning from its base verb.',
        'Do not label every time-first sentence a question or an emphatic form.',
      ],
      modelExamplesDa: ['Ich stehe um sieben auf.', 'Um acht arbeite ich.', 'Der Zug kommt um acht an.', 'Am Montag nehme ich den Zug.'],
      descriptorIds: ['rahmen-beginner-personal-and-daily-life', 'coe-action-oriented-success', 'profile-deutsch-a1-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.bremen[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.bremen.slice(1),
    },
    {
      cityId: 'koeln',
      titleDa: 'Wie komme ich zum Bahnhof?',
      titleEn: 'How do I get to the station?',
      formalFocusEn: 'Information questions, the Sie-imperative, and place and direction chunks.',
      rewriteEn: [
        'Build questions from a real information gap: wo for location, wohin for direction, wann for time, wie for route and welcher with a supplied noun.',
        'Contrast wo and wohin explicitly, because English uses where for both.',
        'Show that a yes/no question simply puts the verb first and needs no helper word of any kind.',
        'Teach the Sie-imperative as the polite instruction, built from the Sie form with Sie kept in the sentence.',
        'Teach zum, zur and an der as whole chunks, and keep the two-way preposition contrast receptive.',
      ],
      doNotClaimEn: [
        'Do not make the dative and accusative contrast after two-way prepositions a productive A1 target.',
        'Do not claim one German preposition maps to one English preposition in all contexts.',
        'Do not teach the du-imperative as the form to use with a stranger.',
      ],
      modelExamplesDa: ['Entschuldigung, wo ist Gleis drei?', 'Wie komme ich zum Dom?', 'Gehen Sie geradeaus und dann links.', 'Steigen Sie am Bahnhof aus.'],
      descriptorIds: ['cefr-a1-transactions-and-directions', 'cefr-a1-repair-with-help', 'profile-deutsch-a1-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.koeln[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.koeln.slice(1),
    },
    {
      cityId: 'frankfurt',
      titleDa: 'Kalt, aber schön',
      titleEn: 'Cold, but beautiful',
      formalFocusEn: 'Predicative adjectives, comparison, coordination, a first receptive weil, and A1 consolidation.',
      rewriteEn: [
        'Teach the predicative adjective as the invariable form that covers all three groups and the plural.',
        'Present attributive endings as something to recognise, and give the learner the move of restating the phrase after ist when they need certainty.',
        'Add comparison with -er … als, including the frequent irregulars gut/besser and gern/lieber.',
        'Use und, aber and oder without word-order consequences, then introduce weil receptively with the verb at the end.',
        'Recycle practical A1 functions across listening, reading, supported interaction and short writing rather than adding a dense new rule set.',
      ],
      doNotClaimEn: [
        'Do not make attributive adjective endings a productive A1 target or an A1 readiness requirement.',
        'Do not imply that recognising weil’s word order is the same as producing it.',
        'Do not call the Frankfurt profile an A1 certificate or assess speaking and pronunciation.',
      ],
      modelExamplesDa: ['Es ist kalt, aber die Sonne scheint.', 'Das Haus ist groß.', 'Der Zug ist schneller als der Bus.', 'Ich nehme die Suppe, weil sie warm ist.'],
      descriptorIds: ['cefr-a1-basic-information-exchange', 'cefr-a1-simple-writing', 'coe-action-oriented-success'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.frankfurt[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.frankfurt.slice(1),
    },
    {
      cityId: 'nuernberg',
      titleDa: 'Was ist passiert?',
      titleEn: 'What happened?',
      formalFocusEn: 'The spoken perfect, participle formation, haben and sein selection, the short Präteritum set, and dative objects for help and disruption.',
      rewriteEn: [
        'Teach haben or sein plus the past participle as the normal way to talk about the past in speech, with the participle at the end of the sentence.',
        'Build the participle by family: ge- … -t for regular verbs, ge- … -en with a vowel change learned lexically, no ge- after be-, ver- and er- or on verbs in -ieren, and ge- in the middle of a separable verb.',
        'Present sein with verbs of motion and change of state as a strong tendency taught with each verb, not as a derivable rule.',
        'Restrict the Präteritum here to war, hatte, es gab and the modals, and say that this is what German speakers actually do.',
        'Introduce mir, dir and Ihnen with helfen, geben and passieren inside the help scene.',
      ],
      doNotClaimEn: [
        'Do not present the German perfect as the English present perfect; it carries no requirement of present relevance.',
        'Do not present a perfect/Präteritum choice as a difference in meaning; in speech the perfect is ordinary and the Präteritum is written or regional.',
        'Do not claim every motion or change verb takes sein.',
        'Do not turn a help exchange into medical diagnosis or advice.',
      ],
      modelExamplesDa: ['Ich habe den Bus verpasst.', 'Ich habe meine Tasche verloren.', 'Der Zug hatte Verspätung.', 'Können Sie mir helfen?'],
      descriptorIds: ['cefr-a2-listening-routine-messages', 'cefr-a2-connected-writing', 'rahmen-beginner-services-and-institutions', 'profile-deutsch-a2-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.nuernberg[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.nuernberg.slice(1),
    },
    {
      cityId: 'dresden',
      titleDa: 'Sollen wir uns treffen?',
      titleEn: 'Shall we meet?',
      formalFocusEn: 'Modal verbs inside the sentence bracket, present-for-future, invitations, refusals and alternatives.',
      rewriteEn: [
        'Teach können, wollen, möchten, müssen, dürfen and sollen in complete planning moves, with the second verb at the end in its basic form.',
        'State that these verbs take no ending in the ich and the er form, so the two look alike by rule rather than by accident.',
        'Contrast ability and possibility, wish and intention, obligation and permission through changed scenario details rather than one-word glosses.',
        'Build future reference with the present tense plus an explicit time phrase, and present werden as a form to recognise.',
        'Require an invitation, a response and a practical alternative so the modal choice serves a social goal.',
      ],
      doNotClaimEn: [
        'Do not say one modal has one fixed English translation.',
        'Do not insert zu between a modal and its infinitive.',
        'Do not treat nicht müssen as the equivalent of nicht dürfen; one removes an obligation and the other refuses permission.',
        'Do not present werden as the normal way to arrange something with another person.',
        'Do not treat a modal sentence on its own as evidence of negotiating a plan.',
      ],
      modelExamplesDa: ['Ich kann am Freitag nicht kommen.', 'Sollen wir uns am Samstag treffen?', 'Hast du Lust, ins Konzert zu gehen?', 'Sonntag um elf passt mir besser.'],
      descriptorIds: ['cefr-a2-routine-service-interaction', 'rahmen-beginner-personal-and-daily-life', 'coe-action-oriented-success'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.dresden[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.dresden.slice(1),
    },
    {
      cityId: 'berlin',
      titleDa: 'Ich schreibe, weil der Termin nicht passt',
      titleEn: 'I am writing because the appointment does not work',
      formalFocusEn: 'Subordinate clauses with the verb at the end, reasons and conditions, receptive attributive endings, service register and A2 consolidation.',
      rewriteEn: [
        'Use weil, dass, wenn and ob only in meanings and time relations the scenario makes clear.',
        'Contrast main-clause order with the verb-final subordinate clause, and show that a helper verb is the element that lands last.',
        'Build short service messages that state the problem, connect a reason or a condition and request or confirm a next step.',
        'Keep Sie as the productive register for offices, landlords and employers, and use du only where the relationship licenses it.',
        'Present attributive adjective endings as reading support for notices and messages, with the after-ist restatement as the escape hatch.',
      ],
      doNotClaimEn: [
        'Do not present subordinate word order as exception-free across every spoken variety; weil with main-clause order is widely heard.',
        'Do not imply that using one linker proves connected A2 writing or interaction.',
        'Do not make productive attributive adjective endings part of the A2 gate.',
        'Do not call the Berlin profile an A2 certificate or assess unaided conversation, speaking or pronunciation.',
      ],
      modelExamplesDa: ['Ich schreibe Ihnen, weil der Termin nicht passt.', 'Ich rufe an, weil ich den Termin ändern muss.', 'Wenn es nicht passt, können wir den Termin ändern.', 'Wissen Sie, ob das Büro heute offen ist?'],
      descriptorIds: ['cefr-a2-linking-and-control', 'cefr-a2-routine-service-interaction', 'rahmen-beginner-services-and-institutions', 'profile-deutsch-a2-forms'],
      lesson: GERMAN_BEGINNER_GRAMMAR_LESSONS.berlin[0],
      additionalLessons: GERMAN_BEGINNER_GRAMMAR_LESSONS.berlin.slice(1),
    },
  ],
}
