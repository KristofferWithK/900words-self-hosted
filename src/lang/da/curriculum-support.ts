import type {
  CurriculumCoverageFloor,
  CurriculumUse,
  CurriculumUseStage,
  LedgerFormProfile,
  SupplementalSupport,
  SupportTarget,
} from '../curriculum-content'

type LedgerSeed = Omit<LedgerFormProfile, 'stages' | 'coverageFloor'>

const profiles = (
  target: SupportTarget,
  firstCity: number,
  functionIds: readonly string[],
  terms: readonly string[],
): readonly LedgerSeed[] => terms.map((term) => ({ term, target, firstCity, functionIds }))

const floorFor = (use: CurriculumUse): CurriculumCoverageFloor => {
  if (use === 'productive-target') {
    return { meaningfulInputs: 6, lexicalFamilies: 0, distinctTemplates: 3, promptedRetrievals: 3, scenarioUses: 2, comprehensionSamples: 1 }
  }
  if (use === 'controlled-target') {
    return { meaningfulInputs: 4, lexicalFamilies: 0, distinctTemplates: 2, promptedRetrievals: 2, scenarioUses: 1, comprehensionSamples: 1 }
  }
  if (use === 'preview-as-chunk') {
    return { meaningfulInputs: 3, lexicalFamilies: 0, distinctTemplates: 2, promptedRetrievals: 0, scenarioUses: 1, comprehensionSamples: 1 }
  }
  return { meaningfulInputs: 4, lexicalFamilies: 0, distinctTemplates: 2, promptedRetrievals: 0, scenarioUses: 0, comprehensionSamples: 1 }
}

const NO_FLOOR: CurriculumCoverageFloor = {
  meaningfulInputs: 0,
  lexicalFamilies: 0,
  distinctTemplates: 0,
  promptedRetrievals: 0,
  scenarioUses: 0,
  comprehensionSamples: 0,
}

const defaultUse = (target: SupportTarget): CurriculumUse => {
  if (target.endsWith('-productive')) return 'productive-target'
  return 'receptive-ambient'
}

/**
 * Review-ready classification of every unique form in function-words.da.json.
 *
 * This is a teaching priority, not a grammatical taxonomy. A term may belong
 * to more than one ledger category (`en`, `om`, `mens`), but receives one
 * curriculum profile. Required forms are staged by the first city where the
 * course deliberately teaches them. Ambient forms may occur naturally without
 * a milestone floor. The Danish L2 reviewer owns the final calls.
 */
const BASE_DANISH_LEDGER_FORMS: readonly LedgerSeed[] = [
  ...profiles('a1-productive', 0, ['greet', 'repair', 'clarify'], [
    'hej', 'goddag', 'godmorgen', 'godnat', 'hallo', 'velkommen', 'farvel',
    'tak', 'undskyld', 'okay', 'ja', 'nej', 'igen', 'lidt',
  ]),
  ...profiles('a1-productive', 0, ['identify', 'locate'], [
    'en', 'et', 'den', 'det', 'her', 'der', 'hvor', 'hvad', 'hvem',
  ]),
  ...profiles('a1-productive', 1, ['introduce', 'ask-personal-information', 'state-possession'], [
    'jeg', 'du', 'han', 'hun', 'vi', 'de', 'mig', 'dig', 'ham', 'hende',
    'os', 'jer', 'dem', 'min', 'mit', 'mine', 'din', 'dit', 'dine', 'hans',
    'hendes', 'vores', 'jeres', 'deres', 'er', 'har', 'have', 'være',
  ]),
  ...profiles('a1-productive', 1, ['describe-routine', 'ask'], [
    'gør', 'gøre', 'kan', 'vil', 'ikke', 'og', 'men', 'også', 'kun', 'bare',
  ]),
  // The lower-cased ledger collapses pronoun “I” and preposition “i”. Keep one
  // profile with both functions so coverage does not pretend they are one use.
  ...profiles('a1-productive', 0, ['introduce', 'locate'], ['i']),
  ...profiles('a1-productive', 2, ['request', 'order', 'ask-price', 'pay'], [
    'nul', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti',
    'tyve', 'tredive', 'fyrre', 'halvtreds', 'hundrede', 'tusind', 'cirka',
    'meget', 'mange', 'nogen', 'noget', 'nogle', 'ingen', 'intet', 'eller',
    'gerne', 'må', 'for', 'med', 'af',
  ]),
  ...profiles('a1-productive', 3, ['tell-time', 'describe-routine', 'arrange'], [
    'hvornår', 'først', 'første', 'anden', 'andet', 'andre', 'tredje', 'før',
    'efter', 'nu', 'så', 'altid', 'aldrig', 'ofte', 'sidst', 'snart', 'allerede',
  ]),
  ...profiles('a1-productive', 3, ['ask', 'clarify'], [
    'hvordan', 'hvorfor', 'hvilken', 'hvilket', 'hvilke',
  ]),
  ...profiles('a1-productive', 4, ['ask-directions', 'give-directions', 'use-transport'], [
    'til', 'fra', 'på', 'ved', 'over', 'under', 'bag', 'foran', 'mellem',
    'langs', 'omkring', 'gennem', 'lige', 'frem', 'tilbage', 'videre', 'op',
    'ud', 'ind', 'ned', 'oppe', 'ude', 'inde', 'nede', 'væk', 'hjemme', 'hos',
    'mod', 'uden',
  ]),
  ...profiles('a1-productive', 5, ['describe', 'express-preference', 'give-simple-reason'], [
    'fordi', 'helt', 'sammen', 'samme', 'alle', 'alt', 'begge', 'hver', 'hvert',
    'selvfølgelig',
  ]),

  ...profiles('a1-receptive', 0, ['listen', 'repair', 'identify'], [
    'skål', 'at', 'om', 'hen',
  ]),
  ...profiles('a1-receptive', 1, ['ask-personal-information', 'state-possession'], [
    'man',
  ]),
  ...profiles('a1-receptive', 2, ['request', 'ask-price'], [
    'al', 'flere', 'fleste', 'færre', 'megen',
  ]),
  ...profiles('a1-receptive', 3, ['tell-time', 'describe-routine'], [
    'endnu', 'stadig', 'længe', 'tit', 'næsten',
  ]),
  ...profiles('a1-receptive', 4, ['ask-directions', 'give-directions'], [
    'hvorhen', 'imod',
  ]),
  ...profiles('a1-receptive', 5, ['describe', 'express-preference'], [
    'ret', 'virkelig', 'ganske', 'temmelig',
  ]),

  ...profiles('a2-productive', 6, ['report-event', 'ask-what-happened', 'describe-problem'], [
    'var', 'havde', 'blev', 'blive', 'bliver', 'været', 'haft', 'blevet',
    'gjorde', 'pludselig', 'straks', 'siden', 'da',
  ]),
  ...profiles('a2-productive', 7, ['invite', 'accept', 'refuse', 'plan'], [
    'skal', 'kunne', 'skulle', 'ville', 'måtte', 'bør', 'både', 'enten',
    'hverken', 'ellers', 'heller', 'hellere', 'måske', 'passer',
  ].filter((term) => term !== 'passer')),
  ...profiles('a2-productive', 7, ['compare', 'recommend', 'give-reason'], [
    'mere', 'mest', 'mindre', 'mindst', 'faktisk', 'især', 'sådan',
  ]),
  ...profiles('a2-productive', 8, ['explain', 'give-reason', 'make-condition', 'repair'], [
    'hvis', 'når', 'mens', 'selvom', 'som', 'derfor', 'dog', 'alligevel',
    'altså', 'nemlig',
  ]),
  ...profiles('a2-productive', 8, ['write-message', 'solve-service-problem', 'make-choice'], [
    'denne', 'dette', 'disse', 'indtil', 'jo',
  ]),

  ...profiles('a2-receptive', 6, ['report-event', 'follow-next-step'], [
    'endelig', 'engang', 'netop',
  ]),
  ...profiles('a2-receptive', 7, ['plan', 'compare', 'recommend'], [
    'burde', 'vel', 'vist', 'egentlig', 'omtrent', 'nok', 'desuden',
  ]),
  ...profiles('a2-receptive', 7, ['state-possession', 'refer'], [
    'sig', 'sin', 'sit', 'sine', 'selv', 'hinanden', 'dens', 'dets',
  ]),
  ...profiles('a2-receptive', 8, ['explain', 'make-condition', 'read-message'], [
    'samt', 'trods', 'blandt', 'når',
  ].filter((term) => term !== 'når')),
  ...profiles('a2-receptive', 8, ['describe', 'qualify'], [
    'sjældent', 'ellers', 'endnu',
  ].filter((term) => !['ellers', 'endnu'].includes(term))),

  ...profiles('ambient', 8, ['recognise-deferred-language'], [
    'ad', 'eftersom', 'enhver', 'ifølge', 'medmindre', 'per', 'skønt',
    'således', 'desuden', 'omtrent', 'samt', 'trods', 'blandt', 'ganske',
    'temmelig', 'netop', 'endelig', 'engang', 'især', 'hellere', 'vel',
    'vist', 'egentlig', 'hen', 'hvorhen', 'imod', 'megen', 'færre', 'fleste',
  ].filter((term) => ![
    'desuden', 'omtrent', 'samt', 'trods', 'blandt', 'ganske', 'temmelig',
    'netop', 'endelig', 'engang', 'især', 'hellere', 'vel', 'vist', 'egentlig',
    'hen', 'hvorhen', 'imod', 'megen', 'færre', 'fleste',
  ].includes(term))),
]

const STAGE_OVERRIDES: Readonly<Record<string, {
  readonly target?: SupportTarget
  readonly stages: readonly CurriculumUseStage[]
}>> = {
  // Useful A1 request chunks do not make the modal system an A1 productive target.
  kan: { target: 'a2-productive', stages: [
    { city: 0, use: 'preview-as-chunk', functionIds: ['ask', 'request'] },
    { city: 7, use: 'productive-target', functionIds: ['plan', 'express-ability'] },
  ] },
  vil: { target: 'a2-productive', stages: [
    { city: 2, use: 'preview-as-chunk', functionIds: ['request'] },
    { city: 7, use: 'productive-target', functionIds: ['plan', 'express-intention'] },
  ] },
  må: { target: 'a2-productive', stages: [
    { city: 7, use: 'productive-target', functionIds: ['plan', 'express-permission'] },
  ] },
  // A1 learns one reason frame; flexible subordinate-clause control waits.
  fordi: { target: 'a2-productive', stages: [
    { city: 5, use: 'controlled-target', functionIds: ['give-simple-reason'] },
    { city: 8, use: 'productive-target', functionIds: ['give-reason', 'explain'] },
  ] },
  at: { target: 'a2-productive', stages: [
    { city: 8, use: 'productive-target', functionIds: ['link-content-clause'] },
  ] },
  når: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-time-relation'] }] },
  mens: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-time-relation'] }] },
  selvom: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-contrast'] }] },
  som: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-reference'] }] },
  derfor: { target: 'a2-receptive', stages: [{ city: 8, use: 'controlled-target', functionIds: ['understand-consequence'] }] },
  dog: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-contrast'] }] },
  alligevel: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-contrast'] }] },
  altså: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-discourse'] }] },
  nemlig: { target: 'a2-receptive', stages: [{ city: 8, use: 'receptive-ambient', functionIds: ['understand-explanation'] }] },
}

export const DANISH_LEDGER_FORMS: readonly LedgerFormProfile[] = BASE_DANISH_LEDGER_FORMS.map((seed) => {
  const override = STAGE_OVERRIDES[seed.term]
  const target = override?.target ?? seed.target
  const stages = override?.stages ?? [{ city: seed.firstCity, use: defaultUse(target), functionIds: seed.functionIds }]
  const finalUse = stages.at(-1)!.use
  return {
    ...seed,
    firstCity: stages[0]!.city,
    target,
    stages,
    coverageFloor: target === 'ambient' ? NO_FLOOR : floorFor(finalUse),
  }
})

const supplemental = (
  id: string,
  kind: SupplementalSupport['kind'],
  forms: readonly string[],
  target: SupplementalSupport['target'],
  firstCity: number,
  functionIds: readonly string[],
  glossEn: string,
  coverageFloor?: CurriculumCoverageFloor,
): SupplementalSupport => {
  const use = defaultUse(target)
  return {
    id, kind, forms, target, firstCity, functionIds, glossEn,
    stages: [{ city: firstCity, use, functionIds }],
    coverageFloor: coverageFloor ?? floorFor(use),
  }
}

const stagedSupplemental = (
  id: string,
  kind: SupplementalSupport['kind'],
  forms: readonly string[],
  target: SupplementalSupport['target'],
  stages: readonly CurriculumUseStage[],
  functionIds: readonly string[],
  glossEn: string,
  coverageFloor: CurriculumCoverageFloor,
): SupplementalSupport => ({
  id, kind, forms, target,
  firstCity: stages[0]!.city,
  functionIds,
  glossEn,
  stages,
  coverageFloor,
})

/** Essential sentence-only language. None of these creates or moves a card. */
export const DANISH_SUPPLEMENTAL_SUPPORT: readonly SupplementalSupport[] = [
  supplemental('da-chunk-name', 'chunk', ['Jeg hedder …'], 'a1-productive', 0, ['introduce'], 'My name is …'),
  supplemental('da-chunk-origin', 'chunk', ['Jeg kommer fra …'], 'a1-productive', 0, ['introduce'], 'I come from …'),
  supplemental('da-chunk-dont-understand', 'chunk', ['Jeg forstår ikke.'], 'a1-productive', 0, ['repair'], 'I do not understand.'),
  supplemental('da-chunk-repeat', 'chunk', ['Kan du sige det igen?'], 'a1-productive', 0, ['repair'], 'Can you say that again?'),
  supplemental('da-chunk-slower', 'chunk', ['Lidt langsommere, tak.'], 'a1-productive', 0, ['repair'], 'A little more slowly, please.'),
  supplemental('da-chunk-meaning', 'chunk', ['Hvad betyder …?'], 'a1-productive', 0, ['clarify'], 'What does … mean?'),
  supplemental('da-chunk-where', 'chunk', ['Hvor er …?'], 'a1-productive', 0, ['locate'], 'Where is …?'),
  supplemental('da-chunk-existence', 'chunk', ['Der er …', 'Er der …?'], 'a1-productive', 0, ['identify', 'locate', 'ask-availability'], 'There is … / Is there …?'),
  supplemental('da-chunk-immediate-help', 'chunk', ['Hjælp!', 'Kan du hjælpe mig?', 'Ring 112.'], 'a1-productive', 0, ['ask-help', 'seek-immediate-help'], 'Help! / Can you help me? / Call 112.'),
  supplemental('da-chunk-live', 'chunk', ['Jeg bor i …'], 'a1-productive', 1, ['ask-personal-information'], 'I live in …'),
  supplemental('da-chunk-work', 'chunk', ['Jeg arbejder som …', 'Jeg studerer …'], 'a1-productive', 1, ['ask-personal-information'], 'I work as … / I study …'),
  supplemental('da-chunk-spell-name', 'chunk', ['Kan du stave dit navn?', 'Mit navn staves …'], 'a1-productive', 1, ['ask-spelling', 'spell-name'], 'Can you spell your name? / My name is spelled …'),
  supplemental('da-chunk-contact', 'chunk', ['Mit telefonnummer er …', 'Min e-mail er …'], 'a1-productive', 1, ['give-contact-details'], 'My phone number is … / My email is …'),
  supplemental('da-chunk-would-like', 'chunk', ['Jeg vil gerne have …'], 'a1-productive', 2, ['request', 'order'], 'I would like …'),
  supplemental('da-chunk-can-get', 'chunk', ['Kan jeg få …?'], 'a1-productive', 2, ['request', 'order'], 'Can I have …?'),
  supplemental('da-chunk-price', 'chunk', ['Hvor meget koster …?'], 'a1-productive', 2, ['ask-price'], 'How much does … cost?'),
  supplemental('da-chunk-bill', 'chunk', ['Regningen, tak.'], 'a1-productive', 2, ['pay'], 'The bill, please.'),
  supplemental('da-chunk-when', 'chunk', ['Hvornår begynder …?', 'Hvornår slutter …?'], 'a1-productive', 3, ['tell-time', 'arrange'], 'When does … begin/end?'),
  supplemental('da-words-weekdays', 'word', ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'], 'a1-productive', 3, ['state-day', 'arrange'], 'Monday through Sunday'),
  supplemental('da-words-months', 'word', ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'], 'a1-receptive', 3, ['understand-date'], 'January through December'),
  supplemental('da-chunk-date-clock', 'chunk', ['den tredje maj', 'klokken seksten', 'Hvilken dato er det?'], 'a1-productive', 3, ['state-date', 'tell-time'], 'the third of May / 16:00 / What is the date?'),
  supplemental(
    'da-chunk-a1-recent-past',
    'chunk',
    [
      'I går arbejdede jeg …', 'I dag har jeg arbejdet …',
      'I går lavede jeg …', 'I dag har jeg lavet …',
      'I går købte jeg …', 'I dag har jeg købt …',
      'I går læste jeg …', 'I dag har jeg læst …',
    ],
    'a1-productive',
    3,
    ['report-recent-event'],
    'Yesterday I worked/made/bought/read … / Today I have worked/made/bought/read …',
    { meaningfulInputs: 8, lexicalFamilies: 4, distinctTemplates: 4, promptedRetrievals: 4, scenarioUses: 2, comprehensionSamples: 2 },
  ),
  supplemental('da-word-right-left', 'word', ['højre', 'venstre'], 'a1-productive', 4, ['give-directions'], 'right / left'),
  supplemental('da-chunk-get-there', 'chunk', ['Hvordan kommer jeg til …?'], 'a1-productive', 4, ['ask-directions'], 'How do I get to …?'),
  supplemental('da-chunk-straight', 'chunk', ['Gå ligeud.'], 'a1-productive', 4, ['give-directions'], 'Go straight ahead.'),
  supplemental('da-chunk-turn', 'chunk', ['Drej til højre.', 'Drej til venstre.'], 'a1-productive', 4, ['give-directions'], 'Turn right / left.'),
  supplemental('da-chunk-get-off', 'chunk', ['Stå af ved …'], 'a1-productive', 4, ['use-transport'], 'Get off at …'),
  supplemental('da-chunk-ticket', 'chunk', ['En billet til …, tak.'], 'a1-productive', 4, ['use-transport'], 'A ticket to …, please.'),
  supplemental('da-chunk-lost', 'chunk', ['Jeg har mistet …'], 'a2-productive', 6, ['describe-problem'], 'I have lost …'),
  supplemental('da-chunk-pain', 'chunk', ['Jeg har ondt i …'], 'a2-productive', 6, ['describe-problem'], 'My … hurts.'),
  supplemental('da-chunk-happened', 'chunk', ['Hvad skete der?'], 'a2-productive', 6, ['ask-what-happened'], 'What happened?'),
  supplemental('da-chunk-next-step', 'chunk', ['Hvad skal jeg gøre?'], 'a2-productive', 6, ['follow-next-step'], 'What should I do?'),
  supplemental('da-chunk-invite', 'chunk', ['Har du lyst til …?', 'Skal vi …?'], 'a2-productive', 7, ['invite'], 'Would you like to …? / Shall we …?'),
  supplemental('da-chunk-decline', 'chunk', ['Det kan jeg desværre ikke.'], 'a2-productive', 7, ['refuse'], 'Unfortunately, I cannot.'),
  supplemental('da-chunk-fit', 'chunk', ['Passer …?'], 'a2-productive', 7, ['plan'], 'Does … work?'),
  supplemental('da-chunk-change-appointment', 'chunk', ['Jeg vil gerne ændre min aftale.'], 'a2-productive', 8, ['solve-service-problem'], 'I would like to change my appointment.'),
  supplemental('da-chunk-reason', 'chunk', ['… fordi …'], 'a2-productive', 8, ['give-reason'], '… because …'),
  supplemental('da-chunk-condition', 'chunk', ['Hvis det ikke passer, …'], 'a2-productive', 8, ['make-condition'], 'If that does not work, …'),

  // Spoken-coverage additions are sentence support, never playable cards or
  // members of the frozen 252-form function-word ledger.
  supplemental('da-word-uh', 'word', ['øh'], 'a1-receptive', 0, ['listen'], 'um'),
  supplemental('da-word-jamen', 'word', ['jamen'], 'a1-receptive', 2, ['ask'], 'well then'),
  supplemental('da-word-ej', 'word', ['ej'], 'a2-receptive', 6, ['describe-problem'], 'oh no / oh'),
  stagedSupplemental(
    'da-word-ligesom', 'word', ['ligesom'], 'a2-receptive',
    [
      { city: 5, use: 'preview-as-chunk', functionIds: ['compare'] },
      { city: 6, use: 'receptive-ambient', functionIds: ['compare'] },
    ],
    ['compare'],
    'just like / like',
    { meaningfulInputs: 4, lexicalFamilies: 0, distinctTemplates: 2, promptedRetrievals: 0, scenarioUses: 0, comprehensionSamples: 1 },
  ),
  supplemental('da-word-thing', 'word', ['ting', 'tingen'], 'a1-productive', 0, ['identify', 'state-possession'], 'thing / things'),
  stagedSupplemental(
    'da-chunk-i-hvert-fald', 'chunk', ['i hvert fald'], 'a2-productive',
    [
      { city: 3, use: 'preview-as-chunk', functionIds: ['arrange'] },
      { city: 7, use: 'controlled-target', functionIds: ['plan'] },
    ],
    ['plan'],
    'at least / at any rate',
    { meaningfulInputs: 4, lexicalFamilies: 0, distinctTemplates: 2, promptedRetrievals: 2, scenarioUses: 1, comprehensionSamples: 1 },
  ),
]
