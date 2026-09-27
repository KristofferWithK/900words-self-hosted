import type {
  CurriculumCity,
  CurriculumExit,
  CurriculumManifest,
  EvidenceMode,
  EvidenceRequirement,
  PostWrapItem,
  ProductiveRole,
  SupportItem,
} from '../curriculum'

/**
 * Danish's curriculum map, not the Danish lessons themselves.
 *
 * Labels here are planning handles that T5/T6/T7 can share. They deliberately
 * do not contain final Danish prompts, answers, explanations or rubrics: those
 * need T6's dedicated Sol review gate. `ledgerTerms` ties each support need
 * to the existing closed-class inventory so that it stops being accidental
 * scenery while leaving T6 free to choose natural utterances and variants.
 */
const support = (
  id: string,
  label: string,
  level: 'a1' | 'a2',
  role: ProductiveRole,
  firstCity: number,
  functionIds: readonly string[],
  ledgerTerms: readonly string[],
): SupportItem => ({ id, label, level, role, firstCity, functionIds, ledgerTerms })

const SUPPORT: readonly SupportItem[] = [
  support('a1-greeting-repair', 'Greeting, leave-taking and repair', 'a1', 'productive', 0,
    ['greet', 'acknowledge', 'take-leave', 'apologise', 'repair', 'clarify'],
    ['hej', 'goddag', 'godmorgen', 'godnat', 'hallo', 'velkommen', 'farvel', 'tak', 'undskyld', 'okay', 'ja', 'nej', 'igen', 'lidt', 'hvad']),
  support('a1-identify-place', 'Identify a person, object or place', 'a1', 'controlled', 0,
    ['identify', 'locate'], ['jeg', 'du', 'er', 'her', 'hvor']),
  support('a1-existence-location', 'Existence, availability and location', 'a1', 'controlled', 0,
    ['identify', 'locate', 'ask-availability'], ['der', 'er', 'her', 'hvor', 'nogen', 'noget', 'ingen']),
  support('a1-immediate-help', 'Immediate help and emergency response', 'a1', 'productive', 0,
    ['ask-help', 'seek-immediate-help', 'follow-immediate-instruction'], ['kan', 'du', 'mig', 'hvad', 'nu']),
  support('a1-noun-phrases', 'Indefinite and definite noun phrases', 'a1', 'controlled', 0,
    ['identify'], ['en', 'et']),
  support('a1-personal-information', 'Personal information and possession', 'a1', 'productive', 1,
    ['introduce', 'ask-personal-information', 'state-possession'], ['hvem', 'hvor', 'jeg', 'du', 'min', 'mit', 'mine', 'din', 'dit', 'dine']),
  support('a1-contact-spelling', 'Spelling and contact details', 'a1', 'productive', 1,
    ['ask-spelling', 'spell-name', 'give-contact-details'], ['hvad', 'hvordan', 'mit', 'min', 'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni']),
  support('a1-present-clauses', 'Simple present clauses', 'a1', 'productive', 1,
    ['describe-routine', 'ask-personal-information'], ['er', 'har', 'kan', 'vil', 'ikke']),
  support('a1-quantity-transaction', 'Quantity, price and transaction', 'a1', 'productive', 2,
    ['request', 'order', 'pay', 'ask-price'], ['kan', 'vil', 'hvad', 'hvor', 'ikke', 'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'tyve', 'tredive', 'fyrre', 'halvtreds', 'hundrede', 'tusind']),
  support('a1-time-routine', 'Time, routine and availability', 'a1', 'productive', 3,
    ['tell-time', 'state-date', 'state-day', 'describe-routine', 'arrange'], ['hvornår', 'først', 'første', 'anden', 'andet', 'tredje', 'så', 'efter', 'før', 'ikke', 'nu']),
  support('a1-recent-past', 'Supported recent-past report', 'a1', 'productive', 3,
    ['report-recent-event'], ['har', 'i', 'så']),
  support('a1-question-order', 'Questions, negation and order', 'a1', 'controlled', 3,
    ['ask', 'clarify'], ['hvad', 'hvem', 'hvor', 'hvordan', 'ikke']),
  support('a1-directions', 'Directions, route and transport', 'a1', 'productive', 4,
    ['ask-directions', 'give-directions', 'use-transport'], ['hvordan', 'hvor', 'til', 'fra', 'på', 'ved', 'lige', 'ud', 'ind']),
  support('a1-description-coordination', 'Description, preference and coordination', 'a1', 'productive', 5,
    ['describe', 'express-preference', 'give-simple-reason'], ['og', 'men', 'fordi', 'også', 'meget']),
  support('a1-listening-repair', 'Reduced Danish listening and repair', 'a1', 'receptive', 0,
    ['listen', 'repair', 'clarify'], ['igen', 'lidt', 'ikke', 'hvad']),
  support('a2-past-events', 'Past events and a simple sequence', 'a2', 'productive', 6,
    ['report-event', 'ask-what-happened'], ['har', 'havde', 'var', 'blev', 'fordi', 'så']),
  support('a2-help-and-health', 'Help, loss and simple health needs', 'a2', 'productive', 6,
    ['ask-help', 'describe-problem', 'follow-next-step'], ['jeg', 'har', 'kan', 'ikke', 'hvad']),
  support('a2-plans-and-invitations', 'Plans, obligations and invitations', 'a2', 'productive', 7,
    ['invite', 'accept', 'refuse', 'plan'], ['kan', 'vil', 'skal', 'må', 'ikke', 'eller']),
  support('a2-comparison-opinion', 'Comparison, preference and opinion', 'a2', 'productive', 7,
    ['compare', 'recommend', 'give-reason'], ['mere', 'mest', 'mindre', 'mindst', 'fordi', 'men']),
  support('a2-linked-explanation', 'Linked explanation and conditions', 'a2', 'productive', 8,
    ['explain', 'give-reason', 'make-condition', 'repair'], ['fordi', 'hvis', 'at', 'når', 'selvom', 'mens']),
  support('a2-message-and-service', 'Message, service and practical choice', 'a2', 'productive', 8,
    ['write-message', 'solve-service-problem', 'make-choice'], ['skal', 'kunne', 'ville', 'eller', 'derfor']),
]

const queue = (cityId: string, supportItemIds: readonly string[]): readonly PostWrapItem[] => [
  { id: `${cityId}-notice`, kind: 'grammar', supportItemIds },
  { id: `${cityId}-discriminate`, kind: 'grammar', supportItemIds },
  { id: `${cityId}-manipulate`, kind: 'grammar', supportItemIds },
  { id: `${cityId}-listen`, kind: 'grammar', supportItemIds },
  { id: `${cityId}-transfer`, kind: 'grammar', supportItemIds },
  { id: `${cityId}-situation-1`, kind: 'situation', supportItemIds },
  { id: `${cityId}-situation-2`, kind: 'situation', supportItemIds },
  { id: `${cityId}-situation-3`, kind: 'situation', supportItemIds },
  { id: `${cityId}-situation-4`, kind: 'situation', supportItemIds },
]

const evidence = (
  cityId: string,
  specs: readonly [EvidenceMode, ProductiveRole, readonly string[]][],
): readonly EvidenceRequirement[] => specs.map(([mode, role, supportItemIds], index) => ({
  id: `${cityId}-evidence-${index + 1}`,
  mode,
  role,
  supportItemIds,
}))

const exit = (
  id: string,
  level: 'a1' | 'a2',
  specs: readonly [EvidenceMode, ProductiveRole, readonly string[]][],
  kind: CurriculumExit['kind'] = 'city-exit',
): CurriculumExit => ({ id, kind, level, evidence: evidence(id, specs) })

const city = (
  cityId: string,
  cityIndex: number,
  level: 'a1' | 'a2',
  formalFocus: string,
  sceneTitle: string,
  functionIds: readonly string[],
  supportItemIds: readonly string[],
  exitSpecs: readonly [EvidenceMode, ProductiveRole, readonly string[]][],
  exitKind: CurriculumExit['kind'] = 'city-exit',
): CurriculumCity => ({
  cityId,
  cityIndex,
  chapter: {
    id: `${cityId}-arrival-chapter`,
    level,
    title: `${cityId} arrival chapter`,
    formalFocus,
    firstCity: cityIndex,
  },
  scene: { id: `${cityId}-scene`, title: sceneTitle, functionIds, supportItemIds },
  postWrapQueue: queue(cityId, supportItemIds),
  exit: exit(`${cityId}-exit`, level, exitSpecs, exitKind),
})

const CITIES: readonly CurriculumCity[] = [
  city('sonderborg', 0, 'a1', 'Noun phrases and listening repair', 'Arrive, meet Casey and repair a conversation',
    ['greet', 'introduce', 'identify', 'repair', 'locate'],
    ['a1-greeting-repair', 'a1-identify-place', 'a1-existence-location', 'a1-immediate-help', 'a1-noun-phrases', 'a1-listening-repair'],
    [['listening', 'receptive', ['a1-listening-repair']], ['supported-interaction', 'productive', ['a1-greeting-repair', 'a1-identify-place']], ['grammar-in-use', 'controlled', ['a1-noun-phrases']]]),
  city('ribe', 1, 'a1', 'Present clauses, pronouns and possession', 'Meet a host or colleague',
    ['introduce', 'ask-personal-information', 'state-possession'],
    ['a1-personal-information', 'a1-contact-spelling', 'a1-present-clauses'],
    [['reading', 'receptive', ['a1-personal-information']], ['supported-interaction', 'productive', ['a1-personal-information', 'a1-present-clauses']], ['writing', 'controlled', ['a1-present-clauses']]]),
  city('kolding', 2, 'a1', 'Quantity, plural patterns and simple negation', 'Order food or make a small purchase',
    ['request', 'order', 'ask-price', 'pay'],
    ['a1-quantity-transaction'],
    [['listening', 'receptive', ['a1-quantity-transaction']], ['supported-interaction', 'productive', ['a1-quantity-transaction']], ['grammar-in-use', 'controlled', ['a1-quantity-transaction']]]),
  city('aarhus', 3, 'a1', 'Time-first clauses, V2 and supported recent-past chunks', 'Plan a work or study day',
    ['tell-time', 'describe-routine', 'report-recent-event', 'arrange', 'ask'],
    ['a1-time-routine', 'a1-recent-past', 'a1-question-order'],
    [['reading', 'receptive', ['a1-time-routine']], ['writing', 'productive', ['a1-time-routine', 'a1-recent-past']], ['supported-interaction', 'productive', ['a1-time-routine', 'a1-recent-past']]]),
  city('aalborg', 4, 'a1', 'Questions, imperatives and location', 'Find a platform, stop or entrance',
    ['ask-directions', 'give-directions', 'use-transport', 'clarify', 'report-recent-event'],
    ['a1-directions', 'a1-question-order', 'a1-existence-location', 'a1-immediate-help', 'a1-recent-past'],
    [['listening', 'receptive', ['a1-directions']], ['controlled-interaction', 'productive', ['a1-directions']], ['grammar-in-use', 'controlled', ['a1-question-order']]]),
  city('skagen', 5, 'a1', 'Adjective agreement and A1 consolidation', 'Carry out a simple day trip',
    ['describe', 'express-preference', 'give-simple-reason', 'report-recent-event', 'repair'],
    ['a1-description-coordination', 'a1-directions', 'a1-listening-repair', 'a1-recent-past'],
    [['listening', 'receptive', ['a1-listening-repair', 'a1-directions']], ['reading', 'receptive', ['a1-time-routine']], ['supported-interaction', 'productive', ['a1-description-coordination', 'a1-directions']], ['writing', 'productive', ['a1-recent-past']]],
    'readiness-check'),
  city('odense', 6, 'a2', 'Past events and present perfect', 'Explain a disruption or ask for help',
    ['report-event', 'ask-what-happened', 'ask-help', 'describe-problem'],
    ['a2-past-events', 'a2-help-and-health'],
    [['listening', 'receptive', ['a2-past-events']], ['supported-interaction', 'productive', ['a2-help-and-health', 'a2-past-events']], ['writing', 'productive', ['a2-past-events']]]),
  city('roskilde', 7, 'a2', 'Plans, modals and stance', 'Arrange a visit or shared activity',
    ['invite', 'accept', 'refuse', 'plan', 'compare', 'recommend'],
    ['a2-plans-and-invitations', 'a2-comparison-opinion'],
    [['reading', 'receptive', ['a2-plans-and-invitations']], ['supported-interaction', 'productive', ['a2-plans-and-invitations']], ['grammar-in-use', 'controlled', ['a2-comparison-opinion']]]),
  city('kobenhavn', 8, 'a2', 'Linked clauses, explanation and consolidation', 'Navigate a service problem and make a choice',
    ['explain', 'give-reason', 'make-condition', 'write-message', 'solve-service-problem'],
    ['a2-linked-explanation', 'a2-message-and-service', 'a2-comparison-opinion'],
    [['listening', 'receptive', ['a2-linked-explanation']], ['reading', 'receptive', ['a2-message-and-service']], ['supported-interaction', 'productive', ['a2-linked-explanation', 'a2-message-and-service']], ['writing', 'productive', ['a2-message-and-service']]],
    'readiness-check'),
]

export const danishCurriculum: CurriculumManifest = {
  cities: CITIES,
  supportItems: SUPPORT,
}
