import type { CurriculumDescriptor, CurriculumRubric } from '../curriculum-content'
import type { CurriculumLevel, EvidenceMode } from '../curriculum'

const CEFR = 'https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4'
const ACTION = 'https://www.coe.int/en/web/common-european-framework-reference-languages/action-orientation-in-the-classroom'
const BEK = 'https://www.retsinformation.dk/eli/lta/2025/1686/pdf'

/**
 * Project paraphrases of the sources accepted in curriculum-architecture.md.
 * They are traceability anchors, not quotations and not evidence that these
 * unpublished tasks have been linked formally to the CEFR.
 */
export const DANISH_CURRICULUM_DESCRIPTORS: readonly CurriculumDescriptor[] = [
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
    id: 'bek-beginner-personal-and-daily-life', source: 'bek-1686-2025', sourceUrl: BEK,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Builds beginner activity around presentation, family, work, education, daily routines and leisure.',
    boundaryEn: 'The statutory curriculum informs content coverage; it does not validate this app assessment.',
  },
  {
    id: 'bek-beginner-transaction-and-transport', source: 'bek-1686-2025', sourceUrl: BEK,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Builds beginner activity around transport, meals, shopping, prices, numbers and routine practical needs.',
    boundaryEn: 'The route scenarios are this project’s implementation, not prescribed test items.',
  },
  {
    id: 'coe-action-oriented-success', source: 'coe-action-oriented', sourceUrl: ACTION,
    level: 'a1-a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Uses language to achieve a concrete scenario goal, with enabling form work serving that action.',
    boundaryEn: 'Successful action is evidence in one task context, not a general level award.',
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
    id: 'bek-beginner-services-and-institutions', source: 'bek-1686-2025', sourceUrl: BEK,
    level: 'a2', modes: ['listening', 'reading', 'controlled-interaction', 'supported-interaction', 'writing', 'grammar-in-use'],
    canDoEn: 'Extends beginner work to housing, health, employment and routine contact with local institutions and services.',
    boundaryEn: 'The source defines a relevant domain, not equivalence to an official Danish examination.',
  },
]

const rubric = (
  id: string,
  level: CurriculumLevel,
  mode: EvidenceMode,
  criteria: readonly [string, string, string][],
): CurriculumRubric => ({
  id,
  level,
  mode,
  criteria: criteria.map(([criterionId, labelEn, descriptionEn]) => ({
    id: criterionId, labelEn, descriptionEn, max: 1,
  })),
  bands: [
    { min: 0, labelEn: 'not-yet', interpretationEn: 'The task goal was not reached; offer feedback and a different optional variant.' },
    { min: 1, labelEn: 'with-support', interpretationEn: 'Some key information or language was used with the supplied support.' },
    { min: criteria.length, labelEn: 'ready-in-this-mode', interpretationEn: 'The task goal and the authored form criterion were met in this assessed mode.' },
  ],
})

export const DANISH_CURRICULUM_RUBRICS: readonly CurriculumRubric[] = [
  rubric('a1-listening', 'a1', 'listening', [
    ['key-detail', 'Key detail', 'Identifies the requested person, item, number, time, place or next step.'],
    ['complete-detail', 'Complete detail', 'Selects every detail requested by the item; replay is optional and never required for full credit.'],
  ]),
  rubric('a1-reading', 'a1', 'reading', [
    ['locate', 'Locate', 'Finds the requested practical detail in a short text.'],
    ['complete-detail', 'Complete detail', 'Selects the whole requested detail, such as both a weekday and date, rather than a partial match.'],
  ]),
  rubric('a1-controlled-interaction', 'a1', 'controlled-interaction', [
    ['goal', 'Goal', 'Chooses a response that advances the concrete exchange.'],
    ['form', 'Target language', 'Uses the prompted chunk or form accurately enough to be understood.'],
  ]),
  rubric('a1-supported-interaction', 'a1', 'supported-interaction', [
    ['goal', 'Goal', 'Completes the short exchange with the supplied visual support.'],
    ['repair', 'Repair', 'Uses clarification or repair when information changes or is withheld.'],
    ['form', 'Target language', 'Uses the relevant A1 pattern in the response.'],
  ]),
  rubric('a1-writing', 'a1', 'writing', [
    ['purpose', 'Purpose', 'Includes the requested personal or practical information.'],
    ['clarity', 'Clarity', 'Produces a short comprehensible message using the supplied frame.'],
  ]),
  rubric('a1-recent-past-writing', 'a1', 'writing', [
    ['events', 'Events', 'Includes all three supplied familiar activities.'],
    ['time-perspective', 'Time perspective', 'Uses the supplied lexical family to present the yesterday event as bounded and the today activity as connected to the current day.'],
    ['clarity', 'Clarity', 'Produces two or three short comprehensible supported sentences.'],
  ]),
  rubric('a1-grammar-in-use', 'a1', 'grammar-in-use', [
    ['meaning', 'Meaning', 'Chooses or builds the form that fits the intended meaning.'],
    ['form', 'Form', 'Uses the city target in the controlled sentence.'],
  ]),
  rubric('a2-listening', 'a2', 'listening', [
    ['main-point', 'Main point', 'Identifies what happened or what the message requires.'],
    ['details', 'Practical details', 'Retrieves the relevant time, condition, location or next step.'],
    ['action', 'Action', 'Chooses an appropriate response to the message.'],
  ]),
  rubric('a2-reading', 'a2', 'reading', [
    ['locate', 'Locate', 'Finds the relevant information in each short text.'],
    ['combine', 'Combine', 'Uses two details together to make the practical choice.'],
    ['action', 'Action', 'Selects or writes the resulting next step.'],
  ]),
  rubric('a2-controlled-interaction', 'a2', 'controlled-interaction', [
    ['goal', 'Goal', 'Resolves the familiar interaction problem.'],
    ['connection', 'Connection', 'Connects a reason, condition, event or alternative.'],
    ['repair', 'Repair', 'Responds appropriately when one detail changes.'],
  ]),
  rubric('a2-supported-interaction', 'a2', 'supported-interaction', [
    ['goal', 'Goal', 'Completes the service, help or planning exchange.'],
    ['detail', 'Detail', 'Provides the relevant event, reason, condition or alternative.'],
    ['repair', 'Repair', 'Handles one unplanned follow-up using available support.'],
  ]),
  rubric('a2-writing', 'a2', 'writing', [
    ['purpose', 'Purpose', 'Makes the event, request or plan clear.'],
    ['connection', 'Connection', 'Links details with simple time, reason or condition language.'],
    ['next-step', 'Next step', 'Includes the requested action or confirmation.'],
  ]),
  rubric('a2-grammar-in-use', 'a2', 'grammar-in-use', [
    ['meaning', 'Meaning', 'Selects a form that expresses the intended time, stance or relation.'],
    ['order', 'Clause form', 'Uses the controlled Danish order or inflection targeted by the item.'],
    ['transfer', 'Transfer', 'Applies the pattern to changed details.'],
  ]),
]
