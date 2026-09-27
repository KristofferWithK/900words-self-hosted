import historicalWords from '../../../prototypes/finish-review/implementation/historical-words.json'
import type { WordEntry } from '../../data/types'
import type {
  CurriculumContentPack,
  CurriculumUse,
  CurriculumUseStage,
  LedgerFormProfile,
  ScoredCurriculumActivity,
  SupplementalSupport,
} from '../curriculum-content'
import type { CurriculumLevel, ProductiveRole } from '../curriculum'
import type {
  DanishExampleStructure,
  ExampleCoverageCount,
  ExampleCurriculumIndex,
  ExampleCurriculumRow,
  ExampleCurriculumValidationReport,
  ExampleEvidenceKind,
  ExampleFunctionCoverage,
  ExampleTermEvidence,
  ExampleUse,
} from '../example-curriculum'
import { danishStem } from './morphology'

const EXAMPLE_EVIDENCE_KINDS = [
  'meaningful-input',
  'prompted-retrieval-candidate',
  'scenario-use-candidate',
  'comprehension-sample-candidate',
] as const

export const EXAMPLE_TEMPLATE_FAMILIES = [
  'direct-address',
  'wh-question',
  'yes-no-question',
  'imperative',
  'time-fronted-v2',
  'place-fronted-v2',
  'subordinate-fronted-v2',
  'embedded-question',
  'existential',
  'linked-clause',
  'coordinated-clause',
  'modal-clause',
  'pronoun-led-clause',
  'noun-led-clause',
  'impersonal-clause',
] as const

export type ExampleTemplateFamily = typeof EXAMPLE_TEMPLATE_FAMILIES[number]

const normalize = (value: string): readonly string[] =>
  value.normalize('NFC').toLocaleLowerCase('da-DK').match(/[\p{L}\p{N}]+/gu) ?? []

const tokenPositions = (surface: string, token: string): readonly number[] => {
  const terms = normalize(surface)
  const wanted = token.toLocaleLowerCase('da-DK')
  return terms.flatMap((term, index) => term === wanted ? [index] : [])
}

const hasToken = (surface: string, token: string): boolean => tokenPositions(surface, token).length > 0

const hasTokenSequence = (surface: string, phrase: string): boolean => {
  const haystack = normalize(surface)
  const pieces = phrase
    .replace(/[.!?]/g, '')
    .split('…')
    .map((part) => normalize(part))
    .filter((part) => part.length > 0)
  if (pieces.length === 0) return false
  let cursor = 0
  for (const piece of pieces) {
    let found = -1
    for (let start = cursor; start <= haystack.length - piece.length; start++) {
      if (piece.every((token, offset) => haystack[start + offset] === token)) {
        found = start + piece.length
        break
      }
    }
    if (found === -1) return false
    cursor = found
  }
  return true
}

/**
 * A token is not always evidence for the function T6 assigns it. These are the
 * high-risk Danish homographs/polyfunctions; every other ledger form is a
 * closed-class lexical target whose exact token is sufficient evidence after
 * the Sol sentence review.
 */
export function sentenceInstantiatesLedgerTarget(term: string, sentence: string): boolean {
  if (!hasToken(sentence, term)) return false
  const lower = sentence.toLocaleLowerCase('da-DK')
  const tokens = normalize(sentence)
  if (term === 'at') {
    const finiteClauseSubjects = new Set(['jeg', 'du', 'han', 'hun', 'vi', 'i', 'de', 'den', 'det', 'der', 'man'])
    return tokenPositions(sentence, 'at').some((index) => finiteClauseSubjects.has(tokens[index + 1] ?? ''))
  }
  if (term === 'for') {
    return /\b(?:koster?|pris(?:en)?|betaler?|regning(?:en)?|kroner?)\b[^.!?]*\bfor\b|\bfor\s+\d+/iu.test(lower)
  }
  if (term === 'der') {
    return /\b(?:der\s+(?:er|var|står|ligger|kommer|mangler|opstod)|er\s+der)\b/iu.test(lower)
  }
  if (term === 'som') {
    // T6 teaches relative som, not profession-as, comparisons or the fixed
    // adverbial som regel. The reviewed corpus marks every relative with the
    // optional Danish comma, which gives us a deterministic semantic seam.
    if (/\b(?:arbejder?|ansat|bruger?)\s+som\b|\bsom\s+(?:regel|aftalt|sidst)\b/iu.test(lower)) return false
    return /,\s*som\s+/iu.test(lower)
  }
  if (term === 'når') {
    // Exclude the finite verb nå: "vi når den sidste del" is not the temporal
    // conjunction taught in Copenhagen. The conjunction opens a clause.
    return /(?:^|[,;:]\s+|[“"«])når\s+/iu.test(lower)
  }
  if (term === 'da') {
    return /(?:^|[,;:]\s+)da\s+[\p{L}]+/iu.test(lower)
  }
  return true
}

export function sentenceInstantiatesSupplementalTarget(
  item: Pick<SupplementalSupport, 'forms'>,
  sentence: string,
): boolean {
  return item.forms.some((form) => hasTokenSequence(sentence, form))
}

const TIME_FRONT = /^(?:i\s+(?:dag|går|morgen|aften|nat)|om\s+(?:morgenen|aftenen|mandagen|tirsdagen|onsdagen|torsdagen|fredagen|lørdagen|søndagen)|klokken|først|bagefter|senere|nu|snart|allerede|pludselig|straks)\b/iu
const PLACE_FRONT = /^(?:i|på|ved|under|over|bag|foran|mellem|langs|omkring|gennem|hos|hjemme|ude|inde|nede|oppe)\s+/iu
const SUBORDINATOR_FRONT = /^(?:hvis|når|mens|selvom|fordi|da)\b/iu
const IMPERATIVE_FRONT = /^(?:gå|drej|tag|stå|kom|ring|vent|se|hør|pas|luk|åbn|sæt|skriv|læs|vælg|sig|spørg|vis|giv|betal|bestil|hent|rør|smid|bland|ryst|tryk|hold|læg|fyld|tænd|sluk|skynd)\b/iu
const MODALS = new Set(['kan', 'vil', 'skal', 'må', 'kunne', 'ville', 'skulle', 'måtte', 'bør', 'burde'])
const PRONOUNS = new Set(['jeg', 'du', 'han', 'hun', 'vi', 'i', 'de', 'man'])

/** Multiple real patterns may coexist; the sidecar chooses one per target. */
export function sentenceTemplateFamilies(sentence: string): readonly ExampleTemplateFamily[] {
  const trimmed = sentence.trim()
  const lower = trimmed.toLocaleLowerCase('da-DK')
  const tokens = normalize(trimmed)
  const families = new Set<ExampleTemplateFamily>()
  if (/^[“"«]|^(?:hej|goddag|godmorgen|godnat|hallo|velkommen|farvel|tak|undskyld|okay|ja|nej|skål)\b|\b(?:siger|spørger|svarer)\b/iu.test(trimmed)) {
    families.add('direct-address')
  }
  if (/\?$/.test(trimmed)) {
    if (/^(?:hvem|hvad|hvor|hvornår|hvordan|hvorfor|hvilken|hvilket|hvilke)\b/iu.test(lower)) families.add('wh-question')
    else families.add('yes-no-question')
  }
  if (IMPERATIVE_FRONT.test(lower)) families.add('imperative')
  if (TIME_FRONT.test(lower)) families.add('time-fronted-v2')
  if (PLACE_FRONT.test(lower)) families.add('place-fronted-v2')
  if (SUBORDINATOR_FRONT.test(lower)) families.add('subordinate-fronted-v2')
  if (/\b(?:ved|siger|spørger|forstår|husker|gætter)\b[^.!?]*\b(?:hvad|hvor|hvornår|hvordan|hvorfor|hvem)\b/iu.test(lower)) {
    families.add('embedded-question')
  }
  if (/\b(?:der\s+(?:er|var|står|ligger|kommer|mangler|opstod)|er\s+der)\b/iu.test(lower)) families.add('existential')
  if (/\b(?:fordi|hvis|når|mens|selvom|som|da|at)\b/iu.test(lower)) families.add('linked-clause')
  if (/\b(?:og|men|eller|så)\b/iu.test(lower)) families.add('coordinated-clause')
  if (tokens.some((token) => MODALS.has(token))) families.add('modal-clause')
  if (PRONOUNS.has(tokens[0] ?? '')) families.add('pronoun-led-clause')
  if (/^(?:det|der)\b/iu.test(lower)) families.add('impersonal-clause')
  if (families.size === 0 || (!PRONOUNS.has(tokens[0] ?? '') && !/^(?:det|der)\b/iu.test(lower))) {
    families.add('noun-led-clause')
  }
  return [...families]
}

export function stageForCity(stages: readonly CurriculumUseStage[], city: number): CurriculumUseStage | undefined {
  return stages.filter((stage) => stage.city <= city).at(-1)
}

export function finalStage(stages: readonly CurriculumUseStage[]): CurriculumUseStage {
  const stage = stages.at(-1)
  if (!stage) throw new Error('curriculum target has no use stage')
  return stage
}

export function exampleSourceHash(word: Pick<WordEntry, 'id' | 'exampleDa' | 'exampleEn'>): string {
  const source = `${word.id}\u241f${word.exampleDa.normalize('NFC')}\u241f${word.exampleEn.normalize('NFC')}`
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < source.length; index++) {
    hash ^= BigInt(source.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

const IRREGULAR_FORMS: Readonly<Record<string, readonly string[]>> = {
  gammel: ['gamle', 'gammelt'],
  himmel: ['himlen', 'himle', 'himlene'],
  gaffel: ['gaflen', 'gafler', 'gaflerne'],
  barn: ['børn', 'barnet', 'børnene'],
  øje: ['øjne', 'øjet', 'øjnene'],
  hånd: ['hænder', 'hånden', 'hænderne'],
  tand: ['tænder', 'tanden', 'tænderne'],
  nat: ['nætter', 'natten', 'nætterne'],
  bog: ['bøger', 'bogen', 'bøgerne'],
  fod: ['fødder', 'foden', 'fødderne'],
  mand: ['mænd', 'manden', 'mændene'],
  datter: ['døtre', 'datteren', 'døtrene'],
  søster: ['søstre', 'søsteren', 'søstrene'],
  ko: ['køer', 'koen', 'køerne'],
  and: ['ænder', 'anden', 'ænderne'],
  synge: ['synger', 'sang', 'sunget'],
  planlægge: ['planlægger', 'planlagde', 'planlagt'],
  lyve: ['lyver', 'løj', 'løjet'],
  gide: ['gider', 'gad', 'gidet'],
  oversætte: ['oversætter', 'oversatte', 'oversat'],
  vide: ['ved', 'vidste', 'vidst'],
  turde: ['tør', 'turde'],
  fortryde: ['fortrød', 'fortrudt'],
  stjæle: ['stjal', 'stjålet'],
  forsvinde: ['forsvandt', 'forsvundet'],
}

/**
 * Is this one lowercase token a form of the headword? The strict reading:
 * the citation form, a listed irregular form, the same conservative stem, or
 * a regular verb inflection. `exampleUsesHeadword` adds a looser substring
 * pass on top; the round summary, which has to pick WHICH token to mark,
 * takes the strict reading first and falls back to the loose one only when
 * nothing matched strictly — under the loose rule alone «mor» is inside
 * «godmorgen», and the sentence would be marked in the wrong place.
 */
export function tokenIsHeadwordForm(word: Pick<WordEntry, 'da' | 'pos'>, token: string): boolean {
  const lemma = word.da.toLocaleLowerCase('da-DK')
  if (token === lemma) return true
  if ((IRREGULAR_FORMS[lemma] ?? []).includes(token)) return true
  if (danishStem(token) === danishStem(lemma)) return true
  if (word.pos === 'verb' && lemma.endsWith('e')) {
    const base = lemma.slice(0, -1)
    return [`${lemma}r`, `${base}ede`, `${base}te`, `${base}et`].includes(token)
  }
  return false
}

/** The loose reading: the board validator's citation-form stem as a substring. */
export function tokenContainsHeadwordStem(word: Pick<WordEntry, 'da'>, token: string): boolean {
  const lemma = word.da.toLocaleLowerCase('da-DK')
  // The board's validator deliberately uses this conservative citation-form
  // stem for review warnings. It reaches consonant doubling (kat/katten),
  // adjective agreement (stor/stort/store) and productive derivation without
  // pretending to be a full Danish analyser.
  const reviewStem = lemma.slice(0, Math.max(3, lemma.length - 2))
  return token.includes(reviewStem)
}

export function exampleUsesHeadword(word: Pick<WordEntry, 'da' | 'pos'>, sentence: string): boolean {
  const tokens = normalize(sentence)
  return tokens.some((token) => tokenIsHeadwordForm(word, token) || tokenContainsHeadwordStem(word, token))
}

export function grammarStructures(word: WordEntry): readonly DanishExampleStructure[] {
  const sentence = word.exampleDa
  const lower = sentence.toLocaleLowerCase('da-DK')
  const tokens = normalize(sentence)
  const tags = new Set<DanishExampleStructure>(['main-clause'])
  if (word.pos === 'noun' && word.article && new RegExp(`\\b${word.article}\\s+`, 'iu').test(lower)) tags.add('indefinite-noun-phrase')
  if (word.pos === 'noun' && exampleUsesHeadword(word, sentence) && tokens.some((token) => /(?:en|et|ene|erne)$/u.test(token))) tags.add('definite-noun-phrase')
  if (/\b(?:der\s+(?:er|var|står|ligger|kommer|mangler|opstod)|er\s+der)\b/iu.test(lower)) tags.add('existential-clause')
  if (/\b(?:jeg forstår ikke|kan du (?:sige|gentage) det igen|lidt (?:mere )?langsommere|hvad betyder|undskyld|hjælp)\b/iu.test(lower)) tags.add('repair-utterance')
  if (PRONOUNS.has(tokens[0] ?? '')) tags.add('personal-pronoun')
  if (tokens.some((token) => ['min', 'mit', 'mine', 'din', 'dit', 'dine', 'hans', 'hendes', 'vores', 'jeres', 'deres'].includes(token))) tags.add('possessive')
  if (/\b(?:er|har|kan|vil|skal|må|bliver|gør)\b/iu.test(lower) || tokens.some((token) => /r$/u.test(token))) tags.add('present-clause')
  if (tokens.some((token) => /^(?:nul|en|et|to|tre|fire|fem|seks|syv|otte|ni|ti|tyve|tredive|fyrre|halvtreds|hundrede|tusind|mange|nogle|ingen)$/u.test(token))) tags.add('quantity-expression')
  if (word.pos === 'noun' && exampleUsesHeadword(word, sentence) && tokens.some((token) => {
    const stem = danishStem(word.da.toLocaleLowerCase('da-DK'))
    return danishStem(token) === stem && /(?:e|r|er|ne|ene|erne)$/u.test(token)
  })) tags.add('plural-noun')
  if (tokens.includes('ikke')) tags.add('negation')
  if (/\b(?:jeg vil gerne have|kan jeg få|hvor meget koster|regningen,? tak)\b/iu.test(lower)) tags.add('transaction')
  if (TIME_FRONT.test(lower)) tags.add('fronted-v2')
  if (/^(?:i går|i dag)\s+(?:arbejdede|lavede|købte|læste)\s+jeg\b/iu.test(lower)) tags.add('recent-past-preterite')
  if (/^i dag\s+har\s+jeg\s+(?:arbejdet|lavet|købt|læst)\b/iu.test(lower)) tags.add('recent-past-perfect')
  if (/\?$/.test(sentence.trim())) tags.add('question')
  if (/^(?:hvem|hvad|hvor|hvornår|hvordan|hvorfor|hvilken|hvilket|hvilke)\b/iu.test(lower) && /\?$/.test(sentence.trim())) tags.add('wh-question')
  if (/^[“"«]|\b(?:siger|spørger|svarer)\b/iu.test(sentence)) tags.add('direct-speech')
  if (IMPERATIVE_FRONT.test(lower)) tags.add('imperative')
  if (tokens.some((token) => ['i', 'på', 'ved', 'over', 'under', 'bag', 'foran', 'mellem', 'langs', 'omkring', 'gennem', 'hos'].includes(token))) tags.add('direction-location')
  if (word.pos === 'adjective') tags.add('adjective-agreement')
  if (tokens.some((token) => ['og', 'men'].includes(token))) tags.add('coordination')
  if (sentenceInstantiatesLedgerTarget('fordi', sentence)) {
    tags.add('simple-reason')
    tags.add('reason-clause')
  }
  const hasEventDa = sentenceInstantiatesLedgerTarget('da', sentence)
  if (tokens.some((token) => ['var', 'havde', 'blev', 'gjorde', 'pludselig', 'straks'].includes(token)) || hasEventDa) tags.add('past-event')
  if (tokens.some((token) => ['pludselig', 'straks'].includes(token)) || hasEventDa) tags.add('event-sequence')
  const participles = new Set([
    'arbejdet', 'lavet', 'købt', 'læst', 'fået', 'set', 'ventet', 'været', 'haft',
    'blevet', 'gået', 'kommet', 'mistet', 'glemt', 'skåret', 'slået', 'stået',
    'taget', 'fundet', 'skrevet', 'sagt', 'gjort', 'sendt', 'åbnet', 'lukket',
    'betalt', 'bestilt', 'solgt', 'spist', 'drukket', 'sovet', 'kørt', 'rejst',
    'brækket', 'fanget', 'vundet', 'tabt', 'pakket', 'ændret', 'aflyst',
  ])
  const vaerePerfect = new Set(['gået', 'kommet', 'blevet', 'rejst', 'ankommet', 'flyttet', 'forsvundet'])
  if (tokens.some((token, index) =>
    participles.has(token) &&
    (tokens[index - 1] === 'har' || (tokens[index - 1] === 'er' && vaerePerfect.has(token))),
  )) tags.add('present-perfect')
  if (/\b(?:hjælp|hjælpe mig|ondt i|mistet|skete der|skal jeg gøre|problem|syg|ulykke)\b/iu.test(lower)) tags.add('problem-help')
  if (tokens.some((token) => MODALS.has(token))) tags.add('modal-clause')
  if (/\b(?:har du lyst til|skal vi|vil du med|vil du gerne|må jeg invitere)\b/iu.test(lower)) tags.add('invitation')
  if (tokens.some((token) => ['mere', 'mest', 'mindre', 'mindst'].includes(token))) tags.add('comparison')
  if (tokens.some((token) => ['sin', 'sit', 'sine'].includes(token))) tags.add('reflexive-possessive')
  if (sentenceInstantiatesLedgerTarget('at', sentence)) tags.add('content-clause')
  if (sentenceInstantiatesLedgerTarget('hvis', sentence)) tags.add('condition-clause')
  if (tokens.some((token) => ['når', 'mens', 'selvom', 'som'].includes(token))) tags.add('receptive-clause-link')
  if (/\b(?:aftale|aflyst|ændre|billet|bestilling|besked|forsinket|lukket|meddelelse|reservation|service|spor|tid)\b/iu.test(lower)) tags.add('service-message')
  if (/\b(?:fordi|hvis|når|mens|selvom|som|at)\b[^,.!?]*\bikke\b/iu.test(lower)) tags.add('subordinate-negation')
  return [...tags]
}

const ROLE_ORDER: Readonly<Record<ProductiveRole, number>> = {
  receptive: 0,
  controlled: 1,
  productive: 2,
}

const roleForUse = (use: ExampleUse): ProductiveRole => {
  if (use === 'productive-target') return 'productive'
  if (use === 'controlled-target') return 'controlled'
  return 'receptive'
}

const levelForTarget = (target: LedgerFormProfile['target']): CurriculumLevel =>
  target.startsWith('a2-') ? 'a2' : 'a1'

const checkpointCityForTarget = (target: LedgerFormProfile['target']): number =>
  target.startsWith('a1-') ? 5 : 8

const templateForTarget = (targetId: string, sentence: string): ExampleTemplateFamily => {
  const families = sentenceTemplateFamilies(sentence)
  const term = targetId.replace(/^(?:ledger|supplemental):/, '')
  const shapeOrder: ExampleTemplateFamily[] = [
    'direct-address', 'wh-question', 'yes-no-question', 'imperative',
    'time-fronted-v2', 'place-fronted-v2', 'subordinate-fronted-v2',
    'embedded-question', 'existential', 'linked-clause', 'coordinated-clause',
    'modal-clause', 'pronoun-led-clause', 'noun-led-clause', 'impersonal-clause',
  ]
  const relation = /^(?:hej|goddag|godmorgen|godnat|hallo|velkommen|farvel|tak|undskyld|okay|ja|nej|skål)$/u.test(term) && families.includes('direct-address')
    ? 'direct-address'
    : /^(?:at|fordi|hvis|når|mens|selvom|som|da|indtil)$/u.test(term)
    ? 'linked-clause'
    : /^(?:og|men|eller|både|enten|hverken|så)$/u.test(term)
      ? 'coordinated-clause'
      : term === 'der'
        ? 'existential'
        : undefined
  const host = shapeOrder.find((family) => family !== relation && families.includes(family))
    ?? shapeOrder.find((family) => families.includes(family))
    ?? 'noun-led-clause'
  return (relation ? `${relation}:${host}` : host) as ExampleTemplateFamily
}

const recentPastFamily = (sentence: string): string | undefined => {
  const form = normalize(sentence).find((token) =>
    /^(?:arbejdede|arbejdet|lavede|lavet|købte|købt|læste|læst)$/u.test(token),
  )
  if (!form) return undefined
  if (form.startsWith('arbejd')) return 'arbejde'
  if (form.startsWith('lav')) return 'lave'
  if (form.startsWith('køb')) return 'købe'
  return 'læse'
}

interface MutableEvidence extends Omit<ExampleTermEvidence, 'evidence'> {
  evidence: ExampleEvidenceKind[]
}

interface MutableRow extends Omit<ExampleCurriculumRow, 'ledger' | 'supplemental'> {
  ledger: MutableEvidence[]
  supplemental: MutableEvidence[]
}

interface CurriculumEvidenceUnit {
  readonly id: string
  readonly activityId: string
  readonly city: number
  readonly source: 'grammar-model' | 'scored-activity'
  readonly surface: string
  readonly evidence: readonly ExampleEvidenceKind[]
}

const curriculumEvidenceUnits = (content: CurriculumContentPack): readonly CurriculumEvidenceUnit[] => {
  const units: CurriculumEvidenceUnit[] = []
  for (const [city, chapter] of content.grammarRewriteBrief.chapters.entries()) {
    for (const [index, surface] of chapter.modelExamplesDa.entries()) {
      units.push({
        id: `grammar:${chapter.cityId}:${index + 1}`,
        activityId: `grammar:${chapter.cityId}:${index + 1}`,
        city,
        source: 'grammar-model',
        surface,
        evidence: ['meaningful-input'],
      })
    }
  }

  const addActivity = (
    activity: ScoredCurriculumActivity,
    city: number,
    scenario: boolean,
  ) => {
    const answerEvidence: ExampleEvidenceKind[] = ['meaningful-input']
    if (activity.role !== 'receptive') answerEvidence.push('prompted-retrieval-candidate')
    if (scenario && activity.role !== 'receptive') answerEvidence.push('scenario-use-candidate')
    if (activity.mode === 'listening' || activity.mode === 'reading') {
      answerEvidence.push('comprehension-sample-candidate')
    }
    for (const [index, line] of activity.audio.entries()) {
      units.push({
        id: `activity:${activity.id}:audio:${index + 1}`,
        activityId: activity.id,
        city,
        source: 'scored-activity',
        surface: line.textDa,
        evidence: activity.mode === 'listening'
          ? ['meaningful-input', 'comprehension-sample-candidate']
          : ['meaningful-input'],
      })
    }
    if (activity.visualDa) {
      units.push({
        id: `activity:${activity.id}:visual`,
        activityId: activity.id,
        city,
        source: 'scored-activity',
        surface: activity.visualDa,
        evidence: activity.mode === 'reading'
          ? ['meaningful-input', 'comprehension-sample-candidate']
          : ['meaningful-input'],
      })
    }
    units.push({
      id: `activity:${activity.id}:answer`,
      activityId: activity.id,
      city,
      source: 'scored-activity',
      surface: activity.answer.modelDa,
      evidence: answerEvidence,
    })
  }

  for (const [city, cityContent] of content.cities.entries()) {
    for (const activity of cityContent.capsules) addActivity(activity, city, false)
    for (const activity of cityContent.exchanges) addActivity(activity, city, true)
    addActivity(cityContent.dueReview, city, false)
    for (const activity of cityContent.exitTask.steps) addActivity(activity, city, true)
  }
  for (const readiness of content.readinessForms) {
    const city = readiness.level === 'a1' ? 5 : 8
    for (const task of readiness.tasks) {
      for (const variant of task.variants) addActivity(variant, city, true)
    }
  }
  return units
}

const evidenceFor = (
  id: string,
  stages: readonly CurriculumUseStage[],
  fallbackFunctions: readonly string[],
  sentence: string,
  city: number,
  lexicalFamily?: string,
): MutableEvidence[] => {
  const stage = stageForCity(stages, city)
  const use: ExampleUse = stage?.use ?? 'pre-target-exposure'
  const functionIds = stage?.functionIds ?? fallbackFunctions
  return functionIds.map((functionId) => ({
    id,
    use,
    role: roleForUse(use),
    functionId,
    templateId: templateForTarget(id, sentence),
    evidence: ['meaningful-input'],
    ...(lexicalFamily ? { lexicalFamily } : {}),
  }))
}

const markCandidates = (
  rows: MutableRow[],
  field: 'ledger' | 'supplemental',
  id: string,
  kind: Exclude<ExampleEvidenceKind, 'meaningful-input'>,
  count: number,
  targetCity: number,
  checkpointCity: number,
  targetUse: CurriculumUse,
) => {
  if (count === 0) return
  const occurrences = rows
    .map((row) => ({
      row,
      items: row[field].filter((item) =>
        item.id === id && item.use === targetUse && row.city >= targetCity && row.city <= checkpointCity,
      ),
    }))
    .filter((entry) => entry.items.length > 0)
  const byTemplate = new Map<string, typeof occurrences[number]>()
  for (const occurrence of occurrences) {
    const template = occurrence.items[0]!.templateId
    if (!byTemplate.has(template)) byTemplate.set(template, occurrence)
  }
  const chosen: typeof occurrences = [...byTemplate.values()]
  for (const occurrence of occurrences) if (!chosen.includes(occurrence)) chosen.push(occurrence)
  chosen.sort((left, right) => left.row.curriculumRank - right.row.curriculumRank)
  for (const occurrence of chosen.slice(0, count)) {
    for (const item of occurrence.items) {
      if (!item.evidence.includes(kind)) item.evidence.push(kind)
      item.evidence.sort((left, right) => EXAMPLE_EVIDENCE_KINDS.indexOf(left) - EXAMPLE_EVIDENCE_KINDS.indexOf(right))
    }
  }
}

export const T3_REVIEW_GATE = {
  id: 'sol-example-review',
  status: 'complete',
  reviewer: 'Sol',
  l2EducatorPass: 'complete',
  nativeEditorPass: 'complete',
  reviewedRows: 900,
  blockingFindings: 0,
  artifact: 'docs/curriculum/t3-sol-review.md',
} as const

export const T3_CITY_TARGETS: readonly {
  readonly label: string
  readonly floor: number
  readonly tags: readonly DanishExampleStructure[]
}[] = [
  { label: 'noun phrases, existence and repair', floor: 30, tags: ['indefinite-noun-phrase', 'definite-noun-phrase', 'existential-clause', 'repair-utterance'] },
  { label: 'pronouns, possession and present clauses', floor: 32, tags: ['personal-pronoun', 'possessive', 'present-clause'] },
  { label: 'quantity, plural and negation', floor: 22, tags: ['quantity-expression', 'plural-noun', 'negation', 'transaction'] },
  { label: 'time-first V2 and the narrow recent past', floor: 18, tags: ['fronted-v2', 'recent-past-preterite', 'recent-past-perfect'] },
  { label: 'questions, imperatives and directions', floor: 30, tags: ['question', 'imperative', 'direction-location'] },
  { label: 'adjective agreement, coordination and simple reasons', floor: 28, tags: ['adjective-agreement', 'coordination', 'simple-reason'] },
  { label: 'past events, perfect and practical problems', floor: 28, tags: ['past-event', 'present-perfect', 'event-sequence', 'problem-help'] },
  { label: 'modals, comparison and invitations', floor: 24, tags: ['modal-clause', 'comparison', 'invitation', 'reflexive-possessive'] },
  { label: 'linked clauses and service messages', floor: 42, tags: ['content-clause', 'reason-clause', 'condition-clause', 'subordinate-negation', 'receptive-clause-link', 'service-message'] },
]

export function buildDanishExampleIndex(
  words: readonly WordEntry[],
  content: CurriculumContentPack,
): ExampleCurriculumIndex {
  const rows: MutableRow[] = words
    .slice()
    .sort((left, right) => (left.curriculumRank ?? left.freqRank) - (right.curriculumRank ?? right.freqRank))
    .map((word) => {
      const curriculumRank = word.curriculumRank ?? word.freqRank
      const city = Math.floor((curriculumRank - 1) / 100)
      const ledger = content.ledgerForms.flatMap((profile) => {
        if (!sentenceInstantiatesLedgerTarget(profile.term, word.exampleDa)) return []
        return evidenceFor(
          profile.term,
          profile.stages,
          profile.functionIds,
          word.exampleDa,
          city,
        )
      })
      const supplemental = content.supplementalSupport.flatMap((support) => {
        if (!sentenceInstantiatesSupplementalTarget(support, word.exampleDa)) return []
        return evidenceFor(
          support.id,
          support.stages,
          support.functionIds,
          word.exampleDa,
          city,
          support.id === 'da-chunk-a1-recent-past' ? recentPastFamily(word.exampleDa) : undefined,
        )
      })
      const functionIds = [...new Set([...ledger, ...supplemental].map((item) => item.functionId))].sort()
      const roles = new Set([...ledger, ...supplemental].map((item) => item.role))
      return {
        wordId: word.id,
        curriculumRank,
        city,
        level: city <= 5 ? 'a1' : 'a2',
        sourceFingerprint: exampleSourceHash(word),
        structures: grammarStructures(word),
        ledger,
        supplemental,
        functionIds,
        roles: (['receptive', 'controlled', 'productive'] as const).filter((role) => roles.has(role)),
      }
    })

  for (const profile of content.ledgerForms) {
    if (profile.target === 'ambient') continue
    const targetStage = finalStage(profile.stages)
    const checkpointCity = checkpointCityForTarget(profile.target)
    markCandidates(rows, 'ledger', profile.term, 'prompted-retrieval-candidate', profile.coverageFloor.promptedRetrievals, targetStage.city, checkpointCity, targetStage.use)
    markCandidates(rows, 'ledger', profile.term, 'scenario-use-candidate', profile.coverageFloor.scenarioUses, targetStage.city, checkpointCity, targetStage.use)
    markCandidates(rows, 'ledger', profile.term, 'comprehension-sample-candidate', profile.coverageFloor.comprehensionSamples, targetStage.city, checkpointCity, targetStage.use)
  }
  for (const support of content.supplementalSupport) {
    const targetStage = finalStage(support.stages)
    const checkpointCity = checkpointCityForTarget(support.target)
    markCandidates(rows, 'supplemental', support.id, 'prompted-retrieval-candidate', support.coverageFloor.promptedRetrievals, targetStage.city, checkpointCity, targetStage.use)
    markCandidates(rows, 'supplemental', support.id, 'scenario-use-candidate', support.coverageFloor.scenarioUses, targetStage.city, checkpointCity, targetStage.use)
    markCandidates(rows, 'supplemental', support.id, 'comprehension-sample-candidate', support.coverageFloor.comprehensionSamples, targetStage.city, checkpointCity, targetStage.use)
  }

  // Exact ordered JSON object/array identity: all fields, values and strings.
  // Whitespace outside values is irrelevant; no NFC or partial-pair matching.
  const historical = JSON.stringify(words) === JSON.stringify(historicalWords)
  return { version: 1, language: 'da', reviewGate: historical ? T3_REVIEW_GATE
    : { id: 'unreviewed', status: 'unreviewed', reviewedRows: 0 }, examples: rows }
}

const coverageFor = (
  id: string,
  target: string,
  firstCity: number,
  floor: LedgerFormProfile['coverageFloor'],
  rows: readonly ExampleCurriculumRow[],
  field: 'ledger' | 'supplemental',
  targetCity: number,
  checkpointCity: number,
  targetUse: CurriculumUse,
  curriculumUnits: readonly CurriculumEvidenceUnit[],
  instantiates: (surface: string) => boolean,
): ExampleCoverageCount => {
  const occurrences = rows.flatMap((row) => {
    const items = row[field].filter((item) => item.id === id && item.use === targetUse)
    if (row.city < targetCity || row.city > checkpointCity || items.length === 0) return []
    return [{ row, items }]
  })
  const curriculumOccurrences = [...new Map(
    curriculumUnits
      .filter((unit) => unit.city >= targetCity && unit.city <= checkpointCity && instantiates(unit.surface))
      .map((unit) => [`${unit.source}:${unit.activityId}:${unit.surface.normalize('NFC')}`, unit]),
  ).values()]
  const carries = (kind: ExampleEvidenceKind) => {
    const exampleIds = occurrences
      .filter(({ items }) => items.some((item) => item.evidence.includes(kind)))
      .map(({ row }) => `example:${row.wordId}`)
    const activityIds = curriculumOccurrences
      .filter((unit) => unit.evidence.includes(kind))
      .map((unit) => `${unit.source}:${unit.activityId}`)
    return new Set([...exampleIds, ...activityIds]).size
  }
  const templateIds = [
    ...occurrences.map(({ items }) => items[0]!.templateId),
    ...curriculumOccurrences.map((unit) => templateForTarget(id, unit.surface)),
  ]
  const lexicalFamilies = [
    ...occurrences.flatMap(({ items }) => items.flatMap((item) => item.lexicalFamily ? [item.lexicalFamily] : [])),
    ...curriculumOccurrences.flatMap((unit) => recentPastFamily(unit.surface) ?? []),
  ]
  return {
    id,
    target,
    firstCity,
    meaningfulInputs: occurrences.length + curriculumOccurrences.length,
    meaningfulInputFloor: floor.meaningfulInputs,
    distinctTemplates: new Set(templateIds).size,
    distinctTemplateFloor: floor.distinctTemplates,
    lexicalFamilies: new Set(lexicalFamilies).size,
    lexicalFamilyFloor: floor.lexicalFamilies,
    promptedRetrievals: carries('prompted-retrieval-candidate'),
    promptedRetrievalFloor: floor.promptedRetrievals,
    scenarioUses: carries('scenario-use-candidate'),
    scenarioUseFloor: floor.scenarioUses,
    comprehensionSamples: carries('comprehension-sample-candidate'),
    comprehensionSampleFloor: floor.comprehensionSamples,
    sources: {
      examples: occurrences.length,
      grammarModels: curriculumOccurrences.filter((unit) => unit.source === 'grammar-model').length,
      scoredActivities: curriculumOccurrences.filter((unit) => unit.source === 'scored-activity').length,
    },
  }
}

const functionCoverage = (
  rows: readonly ExampleCurriculumRow[],
  content: CurriculumContentPack,
): readonly ExampleFunctionCoverage[] => {
  const requirements = new Map<string, {
    level: CurriculumLevel
    role: ProductiveRole
    meaningful: number
    retrieval: number
    scenario: number
    sources: { readonly city: number; readonly use: CurriculumUse }[]
  }>()
  const add = (
    functionIds: readonly string[],
    target: LedgerFormProfile['target'],
    city: number,
    use: CurriculumUse,
    floor: LedgerFormProfile['coverageFloor'],
  ) => {
    if (target === 'ambient') return
    for (const id of functionIds) {
      const next = {
        level: levelForTarget(target),
        role: roleForUse(use),
        meaningful: floor.meaningfulInputs,
        retrieval: floor.promptedRetrievals,
        scenario: floor.scenarioUses,
        sources: [{ city, use }],
      }
      const current = requirements.get(id)
      if (!current) requirements.set(id, next)
      else requirements.set(id, {
        level: current.level === 'a1' ? 'a1' : next.level,
        role: ROLE_ORDER[next.role] > ROLE_ORDER[current.role] ? next.role : current.role,
        meaningful: Math.max(current.meaningful, next.meaningful),
        retrieval: Math.max(current.retrieval, next.retrieval),
        scenario: Math.max(current.scenario, next.scenario),
        sources: [...current.sources, ...next.sources],
      })
    }
  }
  for (const profile of content.ledgerForms) {
    const targetStage = finalStage(profile.stages)
    add(targetStage.functionIds, profile.target, targetStage.city, targetStage.use, profile.coverageFloor)
  }
  for (const support of content.supplementalSupport) {
    const targetStage = finalStage(support.stages)
    add(targetStage.functionIds, support.target, targetStage.city, targetStage.use, support.coverageFloor)
  }

  return [...requirements.entries()].map(([id, requirement]) => {
    const eligible = (row: ExampleCurriculumRow, item: ExampleTermEvidence) =>
      item.functionId === id &&
      item.role === requirement.role &&
      row.city <= (requirement.level === 'a1' ? 5 : 8) &&
      requirement.sources.some((source) => source.use === item.use && row.city >= source.city)
    const matching = rows.filter((row) => [...row.ledger, ...row.supplemental].some((item) => eligible(row, item)))
    const carries = (kind: ExampleEvidenceKind) => matching.filter((row) =>
      [...row.ledger, ...row.supplemental].some((item) => eligible(row, item) && item.evidence.includes(kind)),
    ).length
    return {
      id,
      level: requirement.level,
      role: requirement.role,
      meaningfulInputs: matching.length,
      meaningfulInputFloor: requirement.meaningful,
      promptedRetrievals: carries('prompted-retrieval-candidate'),
      promptedRetrievalFloor: requirement.retrieval,
      scenarioUses: carries('scenario-use-candidate'),
      scenarioUseFloor: requirement.scenario,
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
}

const coveragePasses = (row: ExampleCoverageCount): boolean =>
  row.meaningfulInputs >= row.meaningfulInputFloor &&
  row.distinctTemplates >= row.distinctTemplateFloor &&
  row.lexicalFamilies >= row.lexicalFamilyFloor &&
  row.promptedRetrievals >= row.promptedRetrievalFloor &&
  row.scenarioUses >= row.scenarioUseFloor &&
  row.comprehensionSamples >= row.comprehensionSampleFloor

export function validateDanishExampleIndex(
  index: ExampleCurriculumIndex,
  words: readonly WordEntry[],
  content: CurriculumContentPack,
): ExampleCurriculumValidationReport {
  const errors: string[] = []
  const expected = buildDanishExampleIndex(words, content)
  const expectedById = new Map(expected.examples.map((row) => [row.wordId, row]))
  const actualById = new Map(index.examples.map((row) => [row.wordId, row]))

  if (words.length !== 900) errors.push(`word dataset has ${words.length} examples, expected 900`)
  if (index.version !== 1 || index.language !== 'da') errors.push('example index has the wrong version or language')
  if (index.examples.length !== 900) errors.push(`example index has ${index.examples.length} rows, expected 900`)
  if (actualById.size !== index.examples.length) errors.push('example index has duplicate word ids')
  if (expected.reviewGate.id !== 'sol-example-review') errors.push('Instructional corpus provenance is unreviewed: differs from exact frozen historical corpus')
  if (JSON.stringify(index.reviewGate) !== JSON.stringify(expected.reviewGate)) errors.push('Example review gate differs from exact corpus provenance')

  const wordsById = new Map(words.map((word) => [word.id, word]))
  for (const word of words) {
    if (!exampleUsesHeadword(word, word.exampleDa)) errors.push(`${word.id} example does not use its headword or an accepted inflection`)
  }
  for (const row of index.examples) {
    const wanted = expectedById.get(row.wordId)
    if (!wanted) {
      errors.push(`example index contains unknown word "${row.wordId}"`)
      continue
    }
    if (row.sourceFingerprint !== wanted.sourceFingerprint) errors.push(`${row.wordId} review fingerprint does not match its final Danish/English pair`)
    if (JSON.stringify(row) !== JSON.stringify(wanted)) errors.push(`${row.wordId} sidecar tags differ from the target-specific detectors`)
    if (!wordsById.has(row.wordId)) errors.push(`${row.wordId} has no dataset row`)
  }
  for (const row of expected.examples) if (!actualById.has(row.wordId)) errors.push(`example index omits word "${row.wordId}"`)

  const curriculumUnits = curriculumEvidenceUnits(content)
  const ledger = content.ledgerForms.map((profile) => {
    const targetStage = finalStage(profile.stages)
    return coverageFor(
      profile.term, profile.target, profile.firstCity, profile.coverageFloor,
      index.examples, 'ledger', targetStage.city, checkpointCityForTarget(profile.target), targetStage.use,
      curriculumUnits, (surface) => sentenceInstantiatesLedgerTarget(profile.term, surface),
    )
  })
  const supplemental = content.supplementalSupport.map((support) => {
    const targetStage = finalStage(support.stages)
    return coverageFor(
      support.id, support.target, support.firstCity, support.coverageFloor,
      index.examples, 'supplemental', targetStage.city, checkpointCityForTarget(support.target), targetStage.use,
      curriculumUnits, (surface) => sentenceInstantiatesSupplementalTarget(support, surface),
    )
  })
  for (const row of [...ledger, ...supplemental]) {
    if (row.target === 'ambient' || coveragePasses(row)) continue
    errors.push(
      `${row.id} misses its example floor: input ${row.meaningfulInputs}/${row.meaningfulInputFloor}, ` +
      `templates ${row.distinctTemplates}/${row.distinctTemplateFloor}, families ${row.lexicalFamilies}/${row.lexicalFamilyFloor}, ` +
      `retrieval candidates ${row.promptedRetrievals}/${row.promptedRetrievalFloor}, ` +
      `scenario candidates ${row.scenarioUses}/${row.scenarioUseFloor}, comprehension ${row.comprehensionSamples}/${row.comprehensionSampleFloor}`,
    )
  }

  const functions = functionCoverage(index.examples, content)
  for (const row of functions) {
    if (row.meaningfulInputs < row.meaningfulInputFloor || row.promptedRetrievals < row.promptedRetrievalFloor || row.scenarioUses < row.scenarioUseFloor) {
      errors.push(
        `function "${row.id}" misses its floor: input ${row.meaningfulInputs}/${row.meaningfulInputFloor}, ` +
        `retrieval candidates ${row.promptedRetrievals}/${row.promptedRetrievalFloor}, scenarios ${row.scenarioUses}/${row.scenarioUseFloor}`,
      )
    }
  }

  const cities: ExampleCurriculumValidationReport['cities'] = T3_CITY_TARGETS.map((target, city) => {
    const rows = index.examples.filter((row) => row.city === city)
    const cityTargetHits = rows.filter((row) => target.tags.some((tag) => row.structures.includes(tag))).length
    if (rows.length !== 100) errors.push(`city ${city + 1} has ${rows.length} examples, expected 100`)
    if (cityTargetHits < target.floor) errors.push(`city ${city + 1} ${target.label} coverage is ${cityTargetHits}/100, below ${target.floor}`)
    return {
      city,
      level: city <= 5 ? 'a1' : 'a2',
      examples: rows.length,
      cityTargetHits,
      cityTargetFloor: target.floor,
      receptive: rows.filter((row) => row.roles.includes('receptive')).length,
      controlled: rows.filter((row) => row.roles.includes('controlled')).length,
      productive: rows.filter((row) => row.roles.includes('productive')).length,
    }
  })

  return {
    errors,
    examples: index.examples.length,
    ledger,
    supplemental,
    functions,
    cities,
    byLevel: {
      a1: index.examples.filter((row) => row.level === 'a1').length,
      a2: index.examples.filter((row) => row.level === 'a2').length,
    },
    byRole: {
      receptive: index.examples.filter((row) => row.roles.includes('receptive')).length,
      controlled: index.examples.filter((row) => row.roles.includes('controlled')).length,
      productive: index.examples.filter((row) => row.roles.includes('productive')).length,
    },
    ambientObserved: ledger.filter((row) => row.target === 'ambient').map((row) => ({ id: row.id, occurrences: row.meaningfulInputs })),
  }
}
