import type { CurriculumDescriptor } from '../curriculum-content'

const CEFR = 'https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4'
const ACTION = 'https://www.coe.int/en/web/common-european-framework-reference-languages/action-orientation-in-the-classroom'
const RAHMEN = 'https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Integrationskurse/Kurstraeger/KonzepteLeitfaeden/rahmencurriculum-integrationskurs.pdf'
const PROFILE = 'https://www.goethe.de/z/50/commeuro/303.htm'

/**
 * The traceability anchors for the German course.
 *
 * Two of the three source families differ from Danish, and the difference is
 * the point. The CEFR entries are language-neutral and keep their Danish ids,
 * because `cefr-a1-repair-with-help` means the same thing in any language.
 * Denmark's BEK is replaced by the BAMF Rahmencurriculum — the same role, the
 * public national curriculum for teaching the language to adult newcomers —
 * and German additionally has what Danish never had: Profile deutsch, the
 * Council of Europe Reference Level Description that maps descriptors to
 * actual German forms. `curriculum-architecture.md` §6.2 asks for exactly that
 * and had to approximate it with reviewer judgement for Danish.
 *
 * These are project paraphrases, not quotations, and none of them is evidence
 * that this app's tasks have been linked formally to the CEFR.
 */
export const GERMAN_CURRICULUM_DESCRIPTORS: readonly CurriculumDescriptor[] = [
  {
    id: 'cefr-a1-listening-familiar-details', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['listening'],
    canDoEn: 'Can pick out familiar words, numbers, times and simple directions in short, clear messages with appropriate repetition.',
    boundaryEn: 'Does not establish unaided comprehension of ordinary-speed conversation.',
  },
  {
    id: 'cefr-a1-reading-practical-details', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['reading'],
    canDoEn: 'Can find predictable information in short notices, menus, tickets, timetables and simple messages.',
    boundaryEn: 'Uses short, highly contextualised texts rather than extended reading.',
  },
  {
    id: 'cefr-a1-basic-information-exchange', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['controlled-interaction', 'supported-interaction'],
    canDoEn: 'Can ask and answer simple questions about personal details and immediate concrete needs when the partner helps.',
    boundaryEn: 'The app samples supported simulated interaction, not spontaneous speech.',
  },
  {
    id: 'cefr-a1-transactions-and-directions', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction'],
    canDoEn: 'Can handle very simple purchases, prices, tickets, locations and short directions with familiar language.',
    boundaryEn: 'Tasks keep choices and route details short and concrete.',
  },
  {
    id: 'cefr-a1-simple-writing', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['writing'],
    canDoEn: 'Can enter personal details and write a very short message about a familiar purpose.',
    boundaryEn: 'Constrained writing is sampled; no claim is made about extended composition.',
  },
  {
    id: 'cefr-a1-repair-with-help', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a1', modes: ['listening', 'controlled-interaction', 'supported-interaction'],
    canDoEn: 'Can signal non-understanding and ask for repetition or slower delivery in a basic exchange.',
    boundaryEn: 'Successful selection or typed repair does not assess pronunciation.',
  },
  {
    id: 'cefr-a2-listening-routine-messages', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a2', modes: ['listening'],
    canDoEn: 'Can understand the main point and key practical details in short routine announcements and messages.',
    boundaryEn: 'Audio remains short and context-supported, with listening reported separately.',
  },
  {
    id: 'cefr-a2-reading-practical-texts', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a2', modes: ['reading'],
    canDoEn: 'Can locate and combine information from short practical texts, notices and routine correspondence.',
    boundaryEn: 'Does not sample extended or specialised reading.',
  },
  {
    id: 'cefr-a2-routine-service-interaction', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a2', modes: ['controlled-interaction', 'supported-interaction'],
    canDoEn: 'Can complete routine service exchanges, explain a simple problem, ask what happens next and negotiate a familiar plan.',
    boundaryEn: 'The interaction is simulated and supported; spontaneous spoken fluency is not assessed.',
  },
  {
    id: 'cefr-a2-connected-writing', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a2', modes: ['writing'],
    canDoEn: 'Can write short connected messages about events, plans, reasons and immediate practical needs.',
    boundaryEn: 'The rubric covers brief functional writing only.',
  },
  {
    id: 'cefr-a2-linking-and-control', source: 'cefr-companion-2020', sourceUrl: CEFR,
    level: 'a2', modes: ['grammar-in-use'],
    canDoEn: 'Can connect familiar ideas with simple linkers and use rehearsed forms to describe past events, plans, reasons and conditions.',
    boundaryEn: 'Controlled form use supports a readiness profile; it is not a stand-alone CEFR grammar test.',
  },
  {
    id: 'coe-action-oriented-success', source: 'coe-action-oriented', sourceUrl: ACTION,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Uses language to achieve a concrete scenario goal, with enabling form work serving that action.',
    boundaryEn: 'Successful action is evidence in one task context, not a general level award.',
  },
  {
    id: 'rahmen-beginner-personal-and-daily-life', source: 'bamf-rahmencurriculum', sourceUrl: RAHMEN,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Builds beginner activity around introductions, family, work, training, daily routines and free time.',
    boundaryEn: 'The national curriculum informs content coverage; it does not validate this app assessment or imply a DTZ result.',
  },
  {
    id: 'rahmen-beginner-transaction-and-transport', source: 'bamf-rahmencurriculum', sourceUrl: RAHMEN,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Builds beginner activity around shopping, meals, prices, numbers, local travel and routine practical needs.',
    boundaryEn: 'The route scenarios are this project’s implementation, not prescribed test items.',
  },
  {
    id: 'rahmen-beginner-services-and-institutions', source: 'bamf-rahmencurriculum', sourceUrl: RAHMEN,
    level: 'a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Extends beginner work to housing, health, appointments and routine contact with offices, landlords and employers.',
    boundaryEn: 'The source defines a relevant domain, not equivalence to an official German examination.',
  },
  {
    id: 'profile-deutsch-a1-forms', source: 'profile-deutsch', sourceUrl: PROFILE,
    level: 'a1', modes: ['grammar-in-use'],
    canDoEn: 'Maps A1 functions to the German forms that realise them: nominative noun phrases, present tense, the sentence bracket and basic negation.',
    boundaryEn: 'An RLD lists what belongs at a level; it does not prescribe the teaching order used here.',
  },
  {
    id: 'profile-deutsch-a2-forms', source: 'profile-deutsch', sourceUrl: PROFILE,
    level: 'a2', modes: ['grammar-in-use'],
    canDoEn: 'Maps A2 functions to the German forms that realise them: the spoken perfect, modal verbs, dative objects and subordinate clauses.',
    boundaryEn: 'An RLD lists what belongs at a level; it does not prescribe the teaching order used here.',
  },
]

export const GERMAN_DESCRIPTOR_IDS: ReadonlySet<string> = new Set(
  GERMAN_CURRICULUM_DESCRIPTORS.map((descriptor) => descriptor.id),
)
