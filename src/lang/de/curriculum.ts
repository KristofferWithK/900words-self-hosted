import type {
  CurriculumCity,
  CurriculumManifest,
  SupportItem,
} from '../curriculum'
import { GERMAN_GRAMMAR_REWRITE_BRIEF } from './curriculum-grammar-brief'
import { GERMAN_ROUTE_CITIES } from './route-cities'

/**
 * German's curriculum map — the route contract, not the German lessons.
 *
 * It is deliberately thin where German is thin. The nine chapters are real and
 * come from the authored brief, so the manifest cannot drift from the course.
 * `postWrapQueue` is EMPTY and each `exit` carries no evidence requirement,
 * because German has no capsules, no situations and no exit tasks authored:
 * Danish's 81 queue slots are the product of the T6 content pass, and writing
 * placeholder ids here would make `validate:curriculum` report a course that
 * does not exist.
 *
 * `scripts/validate-curriculum.mjs` runs on Danish unless it is asked for
 * another pack, so nothing here is claimed to have passed a coverage gate.
 */

const support = (
  id: string,
  label: string,
  level: 'a1' | 'a2',
  role: SupportItem['role'],
  firstCity: number,
  functionIds: readonly string[],
  ledgerTerms: readonly string[],
): SupportItem => ({ id, label, level, role, firstCity, functionIds, ledgerTerms })

/**
 * The support language the authored chapters actually lean on, staged by the
 * city that first teaches it. There is no German function-word ledger to
 * classify yet — Danish's 252 forms came from `function-words.da.json` — so
 * `ledgerTerms` here names the forms the lessons use rather than pointing into
 * an inventory that does not exist.
 */
const SUPPORT: readonly SupportItem[] = [
  support('a1-greeting-repair', 'Greeting, leave-taking and repair', 'a1', 'productive', 0,
    ['greet', 'acknowledge', 'take-leave', 'apologise', 'repair', 'clarify'],
    ['hallo', 'guten Tag', 'auf Wiedersehen', 'danke', 'bitte', 'entschuldigung', 'ja', 'nein',
      'noch einmal', 'langsamer', 'wie bitte']),
  support('a1-address-form', 'Choosing du or Sie', 'a1', 'productive', 0,
    ['greet', 'ask-personal-information', 'request'],
    ['du', 'Sie', 'Ihnen', 'Ihr', 'dir', 'dich']),
  support('a1-noun-phrases', 'Noun groups and their articles', 'a1', 'productive', 0,
    ['identify', 'locate'], ['der', 'die', 'das', 'ein', 'eine', 'kein', 'keine']),
  support('a1-existence-location', 'Existence, availability and location', 'a1', 'controlled', 0,
    ['identify', 'locate', 'ask-availability'], ['es gibt', 'gibt es', 'hier', 'da', 'wo']),
  support('a1-immediate-help', 'Immediate help', 'a1', 'productive', 0,
    ['ask-help', 'seek-immediate-help'], ['Hilfe', 'können Sie mir helfen', 'Notruf 112']),
  support('a1-personal-information', 'Name, home, work and contact details', 'a1', 'productive', 1,
    ['introduce', 'ask-personal-information', 'state-possession'],
    ['ich', 'du', 'er', 'sie', 'wir', 'heißen', 'wohnen', 'arbeiten', 'sein', 'haben',
      'mein', 'dein', 'sein', 'ihr', 'buchstabieren']),
  support('a1-quantity-and-price', 'Numbers, quantity and price', 'a1', 'productive', 2,
    ['request', 'order', 'ask-price', 'pay'],
    ['null', 'eins', 'zwei', 'drei', 'zehn', 'zwanzig', 'hundert', 'tausend',
      'wie viel', 'wie viele', 'Euro', 'kosten']),
  support('a1-negation', 'Saying no to a noun and to everything else', 'a1', 'productive', 2,
    ['refuse', 'correct', 'state-absence'], ['nicht', 'kein', 'keine', 'keinen']),
  support('a1-time-and-routine', 'Clock, weekdays, dates and routine', 'a1', 'productive', 3,
    ['tell-time', 'describe-routine', 'arrange'],
    ['um', 'am', 'im', 'Uhr', 'Montag', 'Januar', 'heute', 'morgen', 'gestern', 'wann']),
  support('a1-separable-verbs', 'Verbs that split in two', 'a1', 'controlled', 3,
    ['describe-routine', 'use-transport'], ['aufstehen', 'ankommen', 'einkaufen', 'anrufen', 'aussteigen']),
  support('a1-questions', 'Question words and yes/no questions', 'a1', 'productive', 4,
    ['ask', 'clarify'], ['wo', 'wohin', 'wann', 'wie', 'was', 'wer', 'welcher']),
  support('a1-directions', 'Finding the way and using transport', 'a1', 'productive', 4,
    ['ask-directions', 'give-directions', 'use-transport'],
    ['zum', 'zur', 'links', 'rechts', 'geradeaus', 'an der Ecke', 'die U-Bahn', 'das Gleis']),
  support('a1-describing', 'Describing and comparing', 'a1', 'productive', 5,
    ['describe', 'express-preference', 'give-simple-reason'],
    ['groß', 'klein', 'warm', 'kalt', 'schön', 'als', 'besser', 'und', 'aber', 'oder', 'weil']),
  support('a2-past-events', 'Talking about what happened', 'a2', 'productive', 6,
    ['report-event', 'ask-what-happened', 'describe-problem'],
    ['haben', 'sein', 'gemacht', 'gekauft', 'verloren', 'passiert', 'war', 'hatte', 'es gab']),
  support('a2-dative-objects', 'Helping, giving and telling someone', 'a2', 'productive', 6,
    ['ask-help', 'offer-help', 'report-event'], ['mir', 'dir', 'Ihnen', 'ihm', 'helfen', 'geben', 'sagen']),
  support('a2-plans-and-stance', 'Ability, obligation, permission and plans', 'a2', 'productive', 7,
    ['invite', 'accept', 'decline', 'arrange'],
    ['können', 'wollen', 'möchten', 'müssen', 'dürfen', 'sollen', 'Lust haben', 'passen']),
  support('a2-linking', 'Reasons, conditions and reported ideas', 'a2', 'productive', 8,
    ['give-reason', 'state-condition', 'request-next-step'], ['weil', 'dass', 'wenn', 'ob', 'deshalb']),
  support('a2-service-register', 'Offices, landlords and appointments', 'a2', 'productive', 8,
    ['describe-problem', 'change-appointment', 'request-next-step'],
    ['der Termin', 'ändern', 'absagen', 'das Büro', 'die Wohnung']),
]

const LEVEL_FOR_CITY = (cityIndex: number): 'a1' | 'a2' => (cityIndex <= 5 ? 'a1' : 'a2')

/**
 * Nine cities, each carrying the chapter its authored brief owns. The A1
 * checkpoint sits at Frankfurt (city six) and the A2 readiness check at Berlin
 * (city nine), the same positions Danish uses — those come from the shared
 * architecture, not from Denmark.
 */
const CITIES: readonly CurriculumCity[] = GERMAN_ROUTE_CITIES.map((city, cityIndex): CurriculumCity => {
  const chapter = GERMAN_GRAMMAR_REWRITE_BRIEF.chapters[cityIndex]!
  const level = LEVEL_FOR_CITY(cityIndex)
  const supportIds = SUPPORT.filter((item) => item.firstCity <= cityIndex).map((item) => item.id)
  return {
    cityId: city.id,
    cityIndex,
    chapter: {
      id: `${city.id}-chapter`,
      level,
      title: chapter.titleEn,
      formalFocus: chapter.formalFocusEn,
      firstCity: cityIndex,
    },
    scene: {
      id: `${city.id}-scene`,
      title: chapter.titleEn,
      functionIds: SUPPORT.filter((item) => item.firstCity === cityIndex).flatMap((item) => item.functionIds),
      supportItemIds: supportIds,
    },
    // Empty until German has authored capsules and situations. Danish's five
    // grammar plus four situation slots per city are T6 content, not a shape
    // this file may assert on German's behalf.
    postWrapQueue: [],
    exit: {
      id: cityIndex === 5 ? 'frankfurt-a1-readiness' : cityIndex === 8 ? 'berlin-a2-readiness' : `${city.id}-exit`,
      kind: cityIndex === 5 || cityIndex === 8 ? 'readiness-check' : 'city-exit',
      level,
      evidence: [],
    },
  }
})

export const germanCurriculum: CurriculumManifest = {
  cities: CITIES,
  supportItems: SUPPORT,
}
