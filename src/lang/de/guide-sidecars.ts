import type { UiLanguage } from '../../i18n/types'
import type { GrammarBook, GrammarBookBlock } from '../grammar-books'
import type { CitySurvivalGuide, SurvivalExchange } from '../survival'
import { GERMAN_BEGINNER_GRAMMAR_LESSONS } from './beginner-grammar-lessons'
import { germanSurvivalGuide } from './survival'

/**
 * UI-language copy for the two Flensburg Grammar lessons and four Flensburg
 * Survival exchanges. Keys are the German pack's stable ids; values are keyed
 * by the exact existing English support line so completeness can be checked
 * against the source without changing it.
 */
export const GERMAN_FLENSBURG_LESSON_IDS = [
  'flensburg-articles',
  'flensburg-du-sie',
] as const

export const GERMAN_GUIDE_EXAMPLES_INTRO_SOURCE = 'Read these as whole, useful sentences. English is here for support.'

export const GERMAN_FLENSBURG_EXCHANGE_IDS = [
  'flensburg-situation-1',
  'flensburg-situation-2',
  'flensburg-situation-3',
  'flensburg-situation-4',
] as const

export type GermanFlensburgLessonId = typeof GERMAN_FLENSBURG_LESSON_IDS[number]
export type GermanFlensburgExchangeId = typeof GERMAN_FLENSBURG_EXCHANGE_IDS[number]

export interface GermanFlensburgGuideSidecar {
  readonly grammar: Record<GermanFlensburgLessonId, Readonly<Record<string, string>>>
  readonly survival: Record<GermanFlensburgExchangeId, Readonly<Record<string, string>>>
}

const sourceLessons = Object.fromEntries(
  GERMAN_BEGINNER_GRAMMAR_LESSONS.flensburg.map((lesson) => [lesson.id, lesson]),
) as Record<GermanFlensburgLessonId, typeof GERMAN_BEGINNER_GRAMMAR_LESSONS.flensburg[number]>

const sourceExchanges = Object.fromEntries(
  germanSurvivalGuide.cities[0]!.exchanges.map((exchange) => [exchange.targetActivityId, exchange]),
) as Record<GermanFlensburgExchangeId, typeof germanSurvivalGuide.cities[0]['exchanges'][number]>

function blockLines(block: (typeof sourceLessons)[GermanFlensburgLessonId]['rules'][number]): string[] {
  if (block.kind === 'paragraph' || block.kind === 'heading' || block.kind === 'quote') return [block.text]
  return [...block.headers, ...block.rows.flat()]
}

function grammarSourceLines(lesson: (typeof sourceLessons)[GermanFlensburgLessonId]): string[] {
  return [
    lesson.titleEn,
    lesson.rulesContext,
    ...lesson.rules.flatMap(blockLines),
    lesson.examplesTitleEn,
    ...lesson.examples.flatMap(([german, support]) => [german, support]),
  ]
}

function survivalSourceLines(exchange: (typeof sourceExchanges)[GermanFlensburgExchangeId]): string[] {
  return [
    germanSurvivalGuide.cities[0]!.themeEn,
    exchange.titleEn,
    ...exchange.phrases.flatMap(({ da, en }) => [da, en]),
    ...exchange.dialogue.flatMap(({ da, en }) => [da, en]),
  ]
}

const identityLines = (lines: readonly string[]): Readonly<Record<string, string>> =>
  Object.fromEntries([...new Set(lines)].map((line) => [line, line]))

const GERMAN_GRAMMAR_LINES_TO_PRESERVE: Record<GermanFlensburgLessonId, readonly string[]> = {
  'flensburg-articles': [
    ...sourceLessons['flensburg-articles'].examples.map(([german]) => german),
    'ein Tisch', 'eine Tür', 'ein Haus',
  ],
  'flensburg-du-sie': [
    ...sourceLessons['flensburg-du-sie'].examples.map(([german]) => german),
    'Sie', 'du', 'Wie heißt du?', 'Wie heißen Sie?', 'du hast', 'Sie haben',
  ],
}

function grammarLines(
  id: GermanFlensburgLessonId,
  translated: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return { ...Object.fromEntries(GERMAN_GRAMMAR_LINES_TO_PRESERVE[id].map((line) => [line, line])), ...translated }
}

function survivalLines(
  id: GermanFlensburgExchangeId,
  translated: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const exchange = sourceExchanges[id]
  const preservedGerman = [
    ...exchange.phrases.map(({ da }) => da),
    ...exchange.dialogue.map(({ da }) => da),
  ]
  return { ...Object.fromEntries(preservedGerman.map((line) => [line, line])), ...translated }
}

const identitySidecar = (): GermanFlensburgGuideSidecar => ({
  grammar: {
    'flensburg-articles': identityLines(grammarSourceLines(sourceLessons['flensburg-articles'])),
    'flensburg-du-sie': identityLines(grammarSourceLines(sourceLessons['flensburg-du-sie'])),
  },
  survival: {
    'flensburg-situation-1': identityLines(survivalSourceLines(sourceExchanges['flensburg-situation-1'])),
    'flensburg-situation-2': identityLines(survivalSourceLines(sourceExchanges['flensburg-situation-2'])),
    'flensburg-situation-3': identityLines(survivalSourceLines(sourceExchanges['flensburg-situation-3'])),
    'flensburg-situation-4': identityLines(survivalSourceLines(sourceExchanges['flensburg-situation-4'])),
  },
})

const themeEn = germanSurvivalGuide.cities[0]!.themeEn

export const GERMAN_FLENSBURG_GUIDE_SIDECARS: Record<UiLanguage, GermanFlensburgGuideSidecar> = {
  en: identitySidecar(),
  de: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das und ein, eine',
        'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das und ein, eine',
        'German has three noun groups': 'Im Deutschen gibt es drei Wortgruppen für Nomen',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Das sind grammatische Kategorien: „der Tisch“ bedeutet nicht, dass ein Tisch männlich ist.',
        the: 'bestimmter Artikel', a: 'unbestimmter Artikel',
        'der Tisch · the table': 'der Tisch', 'die Tür · the door': 'die Tür', 'das Haus · the house': 'das Haus',
        'Two groups share one word for “a”': 'Zwei Gruppen haben dieselbe Form für „ein“',
        'der and das words both take ein. Only die words take eine.': 'Nomen mit der und das bekommen ein. Nur Nomen mit die bekommen eine.',
        'Helpful habit': 'Ein hilfreicher Tipp',
        'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Lerne immer Artikel und Nomen zusammen. Nomen schreibt man groß.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Bei den meisten Nomen hilft die Endung nicht',
        'Examples in context': 'Beispiele im Zusammenhang',
        'That is a table.': 'Das ist ein Tisch.', 'The table is here.': 'Der Tisch ist hier.',
        'That is a door.': 'Das ist eine Tür.', 'Where is the door?': 'Wo ist die Tür?',
        'That is a house.': 'Das ist ein Haus.', 'The house is small.': 'Das Haus ist klein.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du oder Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du oder Sie?',
        'German has two words for “you”': 'Im Deutschen gibt es zwei Anredeformen',
        'an adult you do not know': 'eine erwachsene Person, die du nicht kennst',
        'a friend, a child': 'eine befreundete Person, ein Kind',
        'a shop, an office, a counter': 'ein Geschäft, ein Büro, ein Schalter',
        'anyone who offered it': 'wer dir das Du angeboten hat',
        'Sie is the safe start': 'Mit Sie bist du auf der sicheren Seite',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Niemand nimmt es übel, wenn du Sie sagst. Die andere Person bietet das Du an. Dann kannst du es annehmen.',
        'The verb changes with the choice': 'Auch das Verb ändert sich',
        'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Das höfliche Sie wird immer großgeschrieben. Im Alltag hängt die Anrede auch von Region, Arbeitsplatz und Alter ab.',
        'Examples in context': 'Beispiele im Zusammenhang',
        'Hello! What is your name?': 'Guten Tag! Wie heißen Sie?', 'My name is Mia. And you?': 'Ich heiße Mia. Und Sie?',
        'Hi! What is your name?': 'Hallo! Wie heißt du?', 'Excuse me, can you help me?': 'Entschuldigung, können Sie mir helfen?',
        'I come from Canada.': 'Ich komme aus Kanada.', 'Goodbye!': 'Auf Wiedersehen!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Ankommen, grüßen und ein Gespräch retten', 'Say your name': 'Sich vorstellen',
        'Hello.': 'Guten Tag.', 'My name is Mia.': 'Ich heiße Mia.',
        'Hello! Welcome to Flensburg.': 'Guten Tag! Willkommen in Flensburg.',
        'Hello! My name is Mia.': 'Guten Tag! Ich heiße Mia.', 'Pleased to meet you, Ms Berg.': 'Freut mich, Frau Berg.', 'You too.': 'Mich auch.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Ankommen, grüßen und ein Gespräch retten', 'Say where you are from and say goodbye': 'Herkunft nennen und sich verabschieden',
        'I come from Canada.': 'Ich komme aus Kanada.', 'Goodbye!': 'Auf Wiedersehen!',
        'Do you come from Canada?': 'Kommen Sie aus Kanada?', 'Yes, I come from Canada.': 'Ja, ich komme aus Kanada.',
        'Nice. I have to get on now.': 'Schön. Ich muss jetzt weiter.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Ankommen, grüßen und ein Gespräch retten', 'Ask for repetition': 'Um Wiederholung bitten',
        'Can you repeat that, please?': 'Können Sie das bitte wiederholen?', 'More slowly, please.': 'Langsamer, bitte.',
        'The bus leaves from bay three in five minutes.': 'Der Bus fährt in fünf Minuten von Steig drei.',
        'Yes. Bay three, in five minutes.': 'Ja. Steig drei, in fünf Minuten.', 'Thank you.': 'Danke.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Ankommen, grüßen und ein Gespräch retten', 'Ask for immediate help': 'Sofort um Hilfe bitten',
        'Excuse me, can you help me?': 'Entschuldigung, können Sie mir helfen?', 'Where is the toilet?': 'Wo ist die Toilette?',
        'Yes, of course.': 'Ja, natürlich.', 'Just over there.': 'Gleich da drüben.',
      }),
    },
  },
  es: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das y ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das y ein, eine',
        'German has three noun groups': 'El alemán tiene tres grupos de sustantivos',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Son etiquetas gramaticales: der Tisch no significa que una mesa sea masculina.',
        the: 'artículo definido', a: 'artículo indefinido',
        'der Tisch · the table': 'der Tisch · la mesa', 'die Tür · the door': 'die Tür · la puerta', 'das Haus · the house': 'das Haus · la casa',
        'Two groups share one word for “a”': 'Dos grupos comparten una misma forma para «un»',
        'der and das words both take ein. Only die words take eine.': 'Los sustantivos con der y das usan ein. Solo los sustantivos con die usan eine.',
        'Helpful habit': 'Un hábito útil', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Aprende siempre el artículo junto con el sustantivo. Los sustantivos se escriben con mayúscula.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. La mayoría de los sustantivos no da pistas así',
        'Examples in context': 'Ejemplos en contexto', 'That is a table.': 'Eso es una mesa.', 'The table is here.': 'La mesa está aquí.',
        'That is a door.': 'Eso es una puerta.', 'Where is the door?': '¿Dónde está la puerta?', 'That is a house.': 'Eso es una casa.', 'The house is small.': 'La casa es pequeña.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': '¿Du o Sie?', 'Flensburg · Du or Sie?': 'Flensburg · ¿Du o Sie?',
        'German has two words for “you”': 'En alemán hay dos formas de dirigirse a alguien',
        'an adult you do not know': 'una persona adulta que no conoces', 'a friend, a child': 'una amistad o un niño',
        'a shop, an office, a counter': 'una tienda, una oficina o un mostrador', 'anyone who offered it': 'quien te haya propuesto tutearos',
        'Sie is the safe start': 'Sie es la opción segura para empezar',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'A nadie le molesta que te dirijas a esa persona de Sie. La otra persona propone pasar a du; entonces puedes aceptar.',
        'The verb changes with the choice': 'El verbo cambia según la forma elegida',
        'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'El Sie de cortesía siempre lleva mayúscula. El uso real varía según la región, el trabajo y la edad.',
        'Examples in context': 'Ejemplos en contexto', 'Hello! What is your name?': '¡Buenos días! ¿Cómo se llama?', 'My name is Mia. And you?': 'Me llamo Mia. ¿Y usted?',
        'Hi! What is your name?': '¡Hola! ¿Cómo te llamas?', 'Excuse me, can you help me?': 'Disculpe, ¿puede ayudarme?',
        'I come from Canada.': 'Vengo de Canadá.', 'Goodbye!': '¡Adiós!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Llegar, saludar y retomar una conversación', 'Say your name': 'Decir tu nombre', 'Hello.': 'Buenos días.', 'My name is Mia.': 'Me llamo Mia.',
        'Hello! Welcome to Flensburg.': '¡Buenos días! Bienvenida a Flensburg.', 'Hello! My name is Mia.': '¡Buenos días! Me llamo Mia.',
        'Pleased to meet you, Ms Berg.': 'Encantado, señora Berg.', 'You too.': 'Igualmente.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Llegar, saludar y retomar una conversación', 'Say where you are from and say goodbye': 'Decir de dónde eres y despedirte',
        'I come from Canada.': 'Vengo de Canadá.', 'Goodbye!': '¡Adiós!', 'Do you come from Canada?': '¿Viene de Canadá?',
        'Yes, I come from Canada.': 'Sí, vengo de Canadá.', 'Nice. I have to get on now.': 'Muy bien. Ahora tengo que irme.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Llegar, saludar y retomar una conversación', 'Ask for repetition': 'Pedir que repitan algo',
        'Can you repeat that, please?': '¿Puede repetirlo, por favor?', 'More slowly, please.': 'Más despacio, por favor.',
        'The bus leaves from bay three in five minutes.': 'El autobús sale del andén tres dentro de cinco minutos.',
        'Yes. Bay three, in five minutes.': 'Sí. Andén tres, dentro de cinco minutos.', 'Thank you.': 'Gracias.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Llegar, saludar y retomar una conversación', 'Ask for immediate help': 'Pedir ayuda enseguida',
        'Excuse me, can you help me?': 'Disculpe, ¿puede ayudarme?', 'Where is the toilet?': '¿Dónde está el baño?',
        'Yes, of course.': 'Sí, claro.', 'Just over there.': 'Justo allí.',
      }),
    },
  },
  zh: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der、die、das 和 ein、eine', 'Flensburg · Der, die, das, and “a”': '弗伦斯堡 · Der、die、das 和 ein、eine',
        'German has three noun groups': '德语名词分为三类',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': '这些是语法类别：「der Tisch」并不表示桌子是男性。',
        the: '定冠词', a: '不定冠词',
        'der Tisch · the table': 'der Tisch · 桌子', 'die Tür · the door': 'die Tür · 门', 'das Haus · the house': 'das Haus · 房子',
        'Two groups share one word for “a”': '两类名词共用一种不定冠词', 'der and das words both take ein. Only die words take eine.': 'der 和 das 类名词都用 ein。只有 die 类名词用 eine。',
        'Helpful habit': '一个好习惯', 'Learn the pair, never the bare noun. Nouns are always capitalised.': '把冠词和名词一起记，不要只记名词。德语名词首字母总是大写。',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung、-heit、-keit、-schaft → die · -chen、-lein → das。大多数名词没有这样的词尾线索',
        'Examples in context': '例句', 'That is a table.': '那是一张桌子。', 'The table is here.': '桌子在这里。',
        'That is a door.': '那是一扇门。', 'Where is the door?': '门在哪里？', 'That is a house.': '那是一栋房子。', 'The house is small.': '房子很小。',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du 还是 Sie？', 'Flensburg · Du or Sie?': '弗伦斯堡 · Du 还是 Sie？',
        'German has two words for “you”': '德语有两种称呼“你”的方式', 'an adult you do not know': '不认识的成年人', 'a friend, a child': '朋友或孩子',
        'a shop, an office, a counter': '商店、办公室或柜台', 'anyone who offered it': '主动提出改用 du 的人',
        'Sie is the safe start': '先用 Sie 更稳妥', 'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': '用 Sie 称呼别人不会冒犯对方。通常由对方提出改用 du，然后你再接受。',
        'The verb changes with the choice': '动词也会随称呼方式变化', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': '表示礼貌称呼的 Sie 始终大写。实际用法会因地区、工作场合和年龄而异。',
        'Examples in context': '例句', 'Hello! What is your name?': '您好！您叫什么名字？', 'My name is Mia. And you?': '我叫米娅。您呢？',
        'Hi! What is your name?': '你好！你叫什么名字？', 'Excuse me, can you help me?': '不好意思，您能帮我吗？', 'I come from Canada.': '我来自加拿大。', 'Goodbye!': '再见！',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: '到达、问候并继续交谈', 'Say your name': '介绍自己的名字', 'Hello.': '您好。', 'My name is Mia.': '我叫米娅。',
        'Hello! Welcome to Flensburg.': '您好！欢迎来到弗伦斯堡。', 'Hello! My name is Mia.': '您好！我叫米娅。', 'Pleased to meet you, Ms Berg.': '很高兴认识您，贝格女士。', 'You too.': '我也很高兴。',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: '到达、问候并继续交谈', 'Say where you are from and say goodbye': '说说你来自哪里并道别', 'I come from Canada.': '我来自加拿大。', 'Goodbye!': '再见！',
        'Do you come from Canada?': '您来自加拿大吗？', 'Yes, I come from Canada.': '是的，我来自加拿大。', 'Nice. I have to get on now.': '很好。我现在得继续赶路了。',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: '到达、问候并继续交谈', 'Ask for repetition': '请对方重复一遍', 'Can you repeat that, please?': '请您再说一遍，好吗？', 'More slowly, please.': '请说慢一点。',
        'The bus leaves from bay three in five minutes.': '公交车五分钟后从三号站台出发。', 'Yes. Bay three, in five minutes.': '好，三号站台，五分钟后。', 'Thank you.': '谢谢。',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: '到达、问候并继续交谈', 'Ask for immediate help': '马上寻求帮助', 'Excuse me, can you help me?': '不好意思，您能帮我吗？', 'Where is the toilet?': '洗手间在哪里？',
        'Yes, of course.': '当然可以。', 'Just over there.': '就在那边。',
      }),
    },
  },
  fr: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das et ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das et ein, eine',
        'German has three noun groups': 'L’allemand a trois groupes de noms',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Ce sont des catégories grammaticales : « der Tisch » ne signifie pas qu’une table est masculine.',
        the: 'article défini', a: 'article indéfini',
        'der Tisch · the table': 'der Tisch · la table', 'die Tür · the door': 'die Tür · la porte', 'das Haus · the house': 'das Haus · la maison',
        'Two groups share one word for “a”': 'Deux groupes partagent la même forme pour « un »', 'der and das words both take ein. Only die words take eine.': 'Les noms avec der et das prennent ein. Seuls les noms avec die prennent eine.',
        'Helpful habit': 'Un bon réflexe', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Apprends toujours le nom avec son article. Les noms prennent toujours une majuscule.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. La plupart des noms ne donnent pas cet indice',
        'Examples in context': 'Exemples en contexte', 'That is a table.': 'C’est une table.', 'The table is here.': 'La table est ici.',
        'That is a door.': 'C’est une porte.', 'Where is the door?': 'Où est la porte ?', 'That is a house.': 'C’est une maison.', 'The house is small.': 'La maison est petite.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du ou Sie ?', 'Flensburg · Du or Sie?': 'Flensburg · Du ou Sie ?',
        'German has two words for “you”': 'L’allemand a deux façons de dire « tu/vous »', 'an adult you do not know': 'un adulte que tu ne connais pas', 'a friend, a child': 'un ami ou un enfant',
        'a shop, an office, a counter': 'un magasin, un bureau ou un guichet', 'anyone who offered it': 'une personne qui t’a proposé le tutoiement',
        'Sie is the safe start': 'Sie est le choix prudent pour commencer',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Personne ne sera vexé si tu utilises Sie. C’est l’autre personne qui propose de passer à du ; tu peux alors accepter.',
        'The verb changes with the choice': 'Le verbe change aussi selon le choix', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Le Sie de politesse garde toujours sa majuscule. Dans la pratique, l’usage varie selon la région, le travail et l’âge.',
        'Examples in context': 'Exemples en contexte', 'Hello! What is your name?': 'Bonjour ! Comment vous appelez-vous ?', 'My name is Mia. And you?': 'Je m’appelle Mia. Et vous ?',
        'Hi! What is your name?': 'Salut ! Comment tu t’appelles ?', 'Excuse me, can you help me?': 'Excusez-moi, pouvez-vous m’aider ?', 'I come from Canada.': 'Je viens du Canada.', 'Goodbye!': 'Au revoir !',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Arriver, saluer et relancer la conversation', 'Say your name': 'Dire son nom', 'Hello.': 'Bonjour.', 'My name is Mia.': 'Je m’appelle Mia.',
        'Hello! Welcome to Flensburg.': 'Bonjour ! Bienvenue à Flensburg.', 'Hello! My name is Mia.': 'Bonjour ! Je m’appelle Mia.', 'Pleased to meet you, Ms Berg.': 'Ravi de vous rencontrer, madame Berg.', 'You too.': 'Moi aussi.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Arriver, saluer et relancer la conversation', 'Say where you are from and say goodbye': 'Dire d’où l’on vient et prendre congé', 'I come from Canada.': 'Je viens du Canada.', 'Goodbye!': 'Au revoir !',
        'Do you come from Canada?': 'Vous venez du Canada ?', 'Yes, I come from Canada.': 'Oui, je viens du Canada.', 'Nice. I have to get on now.': 'Très bien. Je dois continuer ma route.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Arriver, saluer et relancer la conversation', 'Ask for repetition': 'Demander de répéter', 'Can you repeat that, please?': 'Pouvez-vous répéter, s’il vous plaît ?', 'More slowly, please.': 'Plus lentement, s’il vous plaît.',
        'The bus leaves from bay three in five minutes.': 'Le bus part du quai trois dans cinq minutes.', 'Yes. Bay three, in five minutes.': 'Oui. Quai trois, dans cinq minutes.', 'Thank you.': 'Merci.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Arriver, saluer et relancer la conversation', 'Ask for immediate help': 'Demander de l’aide tout de suite', 'Excuse me, can you help me?': 'Excusez-moi, pouvez-vous m’aider ?', 'Where is the toilet?': 'Où sont les toilettes ?',
        'Yes, of course.': 'Oui, bien sûr.', 'Just over there.': 'Juste là-bas.',
      }),
    },
  },
  pt: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das e ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das e ein, eine',
        'German has three noun groups': 'O alemão tem três grupos de nomes',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'São categorias gramaticais: «der Tisch» não significa que uma mesa seja masculina.',
        the: 'artigo definido', a: 'artigo indefinido',
        'der Tisch · the table': 'der Tisch · a mesa', 'die Tür · the door': 'die Tür · a porta', 'das Haus · the house': 'das Haus · a casa',
        'Two groups share one word for “a”': 'Dois grupos usam a mesma forma para «um»', 'der and das words both take ein. Only die words take eine.': 'Os nomes com der e das usam ein. Só os nomes com die usam eine.',
        'Helpful habit': 'Um hábito útil', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Aprende sempre o artigo com o nome. Os nomes escrevem-se sempre com maiúscula.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. A maioria dos nomes não dá estas pistas',
        'Examples in context': 'Exemplos em contexto', 'That is a table.': 'Isto é uma mesa.', 'The table is here.': 'A mesa está aqui.',
        'That is a door.': 'Isto é uma porta.', 'Where is the door?': 'Onde está a porta?', 'That is a house.': 'Isto é uma casa.', 'The house is small.': 'A casa é pequena.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du ou Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du ou Sie?',
        'German has two words for “you”': 'O alemão tem duas formas de tratar alguém', 'an adult you do not know': 'um adulto que não conheces', 'a friend, a child': 'um amigo ou uma criança',
        'a shop, an office, a counter': 'uma loja, um escritório ou um balcão', 'anyone who offered it': 'quem te propôs tratar por du',
        'Sie is the safe start': 'Sie é a forma mais segura para começar',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Ninguém se incomoda por ser tratado por Sie. A outra pessoa é que propõe passar para du; nessa altura, podes aceitar.',
        'The verb changes with the choice': 'O verbo também muda com a forma escolhida', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'O Sie de cortesia escreve-se sempre com maiúscula. O uso real varia consoante a região, o local de trabalho e a idade.',
        'Examples in context': 'Exemplos em contexto', 'Hello! What is your name?': 'Bom dia! Como se chama?', 'My name is Mia. And you?': 'Chamo-me Mia. E o senhor?',
        'Hi! What is your name?': 'Olá! Como te chamas?', 'Excuse me, can you help me?': 'Desculpe, pode ajudar-me?', 'I come from Canada.': 'Venho do Canadá.', 'Goodbye!': 'Adeus!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Chegar, cumprimentar e retomar uma conversa', 'Say your name': 'Dizer o teu nome', 'Hello.': 'Bom dia.', 'My name is Mia.': 'Chamo-me Mia.',
        'Hello! Welcome to Flensburg.': 'Bom dia! Bem-vinda a Flensburg.', 'Hello! My name is Mia.': 'Bom dia! Chamo-me Mia.', 'Pleased to meet you, Ms Berg.': 'Muito prazer, senhora Berg.', 'You too.': 'Igualmente.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Chegar, cumprimentar e retomar uma conversa', 'Say where you are from and say goodbye': 'Dizer de onde vens e despedir-te', 'I come from Canada.': 'Venho do Canadá.', 'Goodbye!': 'Adeus!',
        'Do you come from Canada?': 'Vem do Canadá?', 'Yes, I come from Canada.': 'Sim, venho do Canadá.', 'Nice. I have to get on now.': 'Muito bem. Agora tenho de continuar.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Chegar, cumprimentar e retomar uma conversa', 'Ask for repetition': 'Pedir para repetirem', 'Can you repeat that, please?': 'Pode repetir, por favor?', 'More slowly, please.': 'Mais devagar, por favor.',
        'The bus leaves from bay three in five minutes.': 'O autocarro parte da plataforma três daqui a cinco minutos.', 'Yes. Bay three, in five minutes.': 'Sim. Plataforma três, daqui a cinco minutos.', 'Thank you.': 'Obrigado.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Chegar, cumprimentar e retomar uma conversa', 'Ask for immediate help': 'Pedir ajuda imediata', 'Excuse me, can you help me?': 'Desculpe, pode ajudar-me?', 'Where is the toilet?': 'Onde fica a casa de banho?',
        'Yes, of course.': 'Sim, claro.', 'Just over there.': 'É mesmo ali.',
      }),
    },
  },
  nl: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das en ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das en ein, eine',
        'German has three noun groups': 'Het Duits heeft drie woordgroepen',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Dit zijn grammaticale aanduidingen: der Tisch betekent niet dat een tafel mannelijk is.',
        the: 'bepaald lidwoord', a: 'onbepaald lidwoord',
        'der Tisch · the table': 'der Tisch · de tafel', 'die Tür · the door': 'die Tür · de deur', 'das Haus · the house': 'das Haus · het huis',
        'Two groups share one word for “a”': 'Twee groepen delen één vorm voor «een»', 'der and das words both take ein. Only die words take eine.': 'Woorden met der en das krijgen ein. Alleen woorden met die krijgen eine.',
        'Helpful habit': 'Een handige gewoonte', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Leer het lidwoord altijd samen met het zelfstandig naamwoord. Zelfstandige naamwoorden krijgen altijd een hoofdletter.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Bij de meeste zelfstandige naamwoorden helpt de uitgang niet',
        'Examples in context': 'Voorbeelden in context', 'That is a table.': 'Dat is een tafel.', 'The table is here.': 'De tafel is hier.',
        'That is a door.': 'Dat is een deur.', 'Where is the door?': 'Waar is de deur?', 'That is a house.': 'Dat is een huis.', 'The house is small.': 'Het huis is klein.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du of Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du of Sie?', 'German has two words for “you”': 'Het Duits heeft twee aanspreekvormen',
        'an adult you do not know': 'een volwassene die je niet kent', 'a friend, a child': 'een vriend of een kind', 'a shop, an office, a counter': 'een winkel, kantoor of balie',
        'anyone who offered it': 'iemand die zelf du heeft voorgesteld', 'Sie is the safe start': 'Sie is de veilige keuze om mee te beginnen',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Niemand vindt het erg als je Sie gebruikt. De ander stelt voor om du te zeggen; daarna kun je dat aannemen.',
        'The verb changes with the choice': 'Het werkwoord verandert mee', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Het beleefde Sie krijgt altijd een hoofdletter. In de praktijk verschilt het gebruik per regio, werkplek en leeftijd.',
        'Examples in context': 'Voorbeelden in context', 'Hello! What is your name?': 'Goedendag! Hoe heet u?', 'My name is Mia. And you?': 'Ik heet Mia. En u?',
        'Hi! What is your name?': 'Hoi! Hoe heet je?', 'Excuse me, can you help me?': 'Pardon, kunt u me helpen?', 'I come from Canada.': 'Ik kom uit Canada.', 'Goodbye!': 'Tot ziens!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Aankomen, groeten en een gesprek weer oppakken', 'Say your name': 'Je naam zeggen', 'Hello.': 'Goedendag.', 'My name is Mia.': 'Ik heet Mia.',
        'Hello! Welcome to Flensburg.': 'Goedendag! Welkom in Flensburg.', 'Hello! My name is Mia.': 'Goedendag! Ik heet Mia.', 'Pleased to meet you, Ms Berg.': 'Aangenaam, mevrouw Berg.', 'You too.': 'Insgelijks.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Aankomen, groeten en een gesprek weer oppakken', 'Say where you are from and say goodbye': 'Vertellen waar je vandaan komt en afscheid nemen',
        'I come from Canada.': 'Ik kom uit Canada.', 'Goodbye!': 'Tot ziens!', 'Do you come from Canada?': 'Komt u uit Canada?', 'Yes, I come from Canada.': 'Ja, ik kom uit Canada.',
        'Nice. I have to get on now.': 'Fijn. Ik moet nu weer verder.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Aankomen, groeten en een gesprek weer oppakken', 'Ask for repetition': 'Vragen of iemand iets wil herhalen', 'Can you repeat that, please?': 'Kunt u dat alstublieft herhalen?', 'More slowly, please.': 'Langzamer, alstublieft.',
        'The bus leaves from bay three in five minutes.': 'De bus vertrekt over vijf minuten vanaf halte drie.', 'Yes. Bay three, in five minutes.': 'Ja. Halte drie, over vijf minuten.', 'Thank you.': 'Dank u.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Aankomen, groeten en een gesprek weer oppakken', 'Ask for immediate help': 'Meteen om hulp vragen', 'Excuse me, can you help me?': 'Pardon, kunt u me helpen?', 'Where is the toilet?': 'Waar is het toilet?',
        'Yes, of course.': 'Ja, natuurlijk.', 'Just over there.': 'Daar verderop.',
      }),
    },
  },
  pl: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das oraz ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das oraz ein, eine',
        'German has three noun groups': 'W niemieckim są trzy rodzaje rzeczowników',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'To oznaczenia gramatyczne: der Tisch nie oznacza, że stół jest płci męskiej.',
        the: 'rodzajnik określony', a: 'rodzajnik nieokreślony',
        'der Tisch · the table': 'der Tisch · stół', 'die Tür · the door': 'die Tür · drzwi', 'das Haus · the house': 'das Haus · dom',
        'Two groups share one word for “a”': 'Dwie grupy mają tę samą formę rodzajnika nieokreślonego', 'der and das words both take ein. Only die words take eine.': 'Przy rzeczownikach z der i das używa się ein. Tylko przy rzeczownikach z die używa się eine.',
        'Helpful habit': 'Przydatny nawyk', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Ucz się rzeczownika razem z rodzajnikiem. Rzeczowniki zawsze zapisujemy wielką literą.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Większość rzeczowników nie ma takiej wskazówki',
        'Examples in context': 'Przykłady w kontekście', 'That is a table.': 'To jest stół.', 'The table is here.': 'Stół jest tutaj.',
        'That is a door.': 'To są drzwi.', 'Where is the door?': 'Gdzie są drzwi?', 'That is a house.': 'To jest dom.', 'The house is small.': 'Dom jest mały.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du czy Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du czy Sie?', 'German has two words for “you”': 'W niemieckim są dwie formy zwracania się do rozmówcy',
        'an adult you do not know': 'dorosła osoba, której nie znasz', 'a friend, a child': 'znajomy lub dziecko', 'a shop, an office, a counter': 'sklep, biuro lub okienko',
        'anyone who offered it': 'osoba, która zaproponowała przejście na du', 'Sie is the safe start': 'Sie to bezpieczny wybór na początek',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Nikt nie ma za złe, że zwracasz się do niego przez Sie. To druga osoba proponuje przejście na du; wtedy możesz się zgodzić.',
        'The verb changes with the choice': 'Forma czasownika zależy od wyboru', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Grzecznościowe Sie zawsze zapisuje się wielką literą. W praktyce użycie zależy od regionu, miejsca pracy i wieku.',
        'Examples in context': 'Przykłady w kontekście', 'Hello! What is your name?': 'Dzień dobry! Jak się pani nazywa?', 'My name is Mia. And you?': 'Nazywam się Mia. A pani?',
        'Hi! What is your name?': 'Cześć! Jak masz na imię?', 'Excuse me, can you help me?': 'Przepraszam, czy może mi pani pomóc?', 'I come from Canada.': 'Pochodzę z Kanady.', 'Goodbye!': 'Do widzenia!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Przyjazd, powitanie i podtrzymanie rozmowy', 'Say your name': 'Przedstaw się', 'Hello.': 'Dzień dobry.', 'My name is Mia.': 'Nazywam się Mia.',
        'Hello! Welcome to Flensburg.': 'Dzień dobry! Witam we Flensburgu.', 'Hello! My name is Mia.': 'Dzień dobry! Nazywam się Mia.', 'Pleased to meet you, Ms Berg.': 'Miło mi panią poznać, pani Berg.', 'You too.': 'Mnie również.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Przyjazd, powitanie i podtrzymanie rozmowy', 'Say where you are from and say goodbye': 'Powiedz, skąd jesteś, i pożegnaj się', 'I come from Canada.': 'Pochodzę z Kanady.', 'Goodbye!': 'Do widzenia!',
        'Do you come from Canada?': 'Czy pochodzi pani z Kanady?', 'Yes, I come from Canada.': 'Tak, pochodzę z Kanady.', 'Nice. I have to get on now.': 'Dobrze. Muszę już iść dalej.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Przyjazd, powitanie i podtrzymanie rozmowy', 'Ask for repetition': 'Poproś o powtórzenie', 'Can you repeat that, please?': 'Czy może pani powtórzyć?', 'More slowly, please.': 'Proszę wolniej.',
        'The bus leaves from bay three in five minutes.': 'Autobus odjeżdża z peronu trzeciego za pięć minut.', 'Yes. Bay three, in five minutes.': 'Tak. Peron trzeci, za pięć minut.', 'Thank you.': 'Dziękuję.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Przyjazd, powitanie i podtrzymanie rozmowy', 'Ask for immediate help': 'Poproś od razu o pomoc', 'Excuse me, can you help me?': 'Przepraszam, czy może mi pani pomóc?', 'Where is the toilet?': 'Gdzie jest toaleta?',
        'Yes, of course.': 'Tak, oczywiście.', 'Just over there.': 'Tam, kawałek dalej.',
      }),
    },
  },
  sv: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das och ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das och ein, eine',
        'German has three noun groups': 'Tyskan har tre substantivgrupper',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Det är grammatiska kategorier: der Tisch betyder inte att ett bord är av manligt kön.',
        the: 'bestämd artikel', a: 'obestämd artikel',
        'der Tisch · the table': 'der Tisch · bordet', 'die Tür · the door': 'die Tür · dörren', 'das Haus · the house': 'das Haus · huset',
        'Two groups share one word for “a”': 'Två grupper har samma form för obestämd artikel', 'der and das words both take ein. Only die words take eine.': 'Substantiv med der och das får ein. Bara substantiv med die får eine.',
        'Helpful habit': 'Ett bra knep', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Lär dig alltid artikeln tillsammans med substantivet. Substantiv skrivs alltid med stor bokstav.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. De flesta substantiv ger ingen sådan ledtråd',
        'Examples in context': 'Exempel i sammanhang', 'That is a table.': 'Det är ett bord.', 'The table is here.': 'Bordet är här.',
        'That is a door.': 'Det är en dörr.', 'Where is the door?': 'Var är dörren?', 'That is a house.': 'Det är ett hus.', 'The house is small.': 'Huset är litet.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du eller Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du eller Sie?', 'German has two words for “you”': 'Tyska har två sätt att tilltala någon',
        'an adult you do not know': 'en vuxen du inte känner', 'a friend, a child': 'en vän eller ett barn', 'a shop, an office, a counter': 'en butik, ett kontor eller en disk',
        'anyone who offered it': 'någon som själv föreslog du', 'Sie is the safe start': 'Sie är det säkra valet i början',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Ingen tar illa upp om du använder Sie. Den andra personen föreslår att ni säger du, och då kan du tacka ja.',
        'The verb changes with the choice': 'Verbet ändras efter tilltalet', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Hövligt Sie skrivs alltid med stor bokstav. I praktiken varierar bruket mellan regioner, arbetsplatser och åldrar.',
        'Examples in context': 'Exempel i sammanhang', 'Hello! What is your name?': 'God dag! Vad heter ni?', 'My name is Mia. And you?': 'Jag heter Mia. Och ni?',
        'Hi! What is your name?': 'Hej! Vad heter du?', 'Excuse me, can you help me?': 'Ursäkta, kan ni hjälpa mig?', 'I come from Canada.': 'Jag kommer från Kanada.', 'Goodbye!': 'Hej då!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Anlända, hälsa och få igång samtalet igen', 'Say your name': 'Säga vad du heter', 'Hello.': 'God dag.', 'My name is Mia.': 'Jag heter Mia.',
        'Hello! Welcome to Flensburg.': 'God dag! Välkommen till Flensburg.', 'Hello! My name is Mia.': 'God dag! Jag heter Mia.', 'Pleased to meet you, Ms Berg.': 'Trevligt att träffas, fru Berg.', 'You too.': 'Detsamma.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Anlända, hälsa och få igång samtalet igen', 'Say where you are from and say goodbye': 'Berätta var du kommer ifrån och säga hej då',
        'I come from Canada.': 'Jag kommer från Kanada.', 'Goodbye!': 'Hej då!', 'Do you come from Canada?': 'Kommer ni från Kanada?', 'Yes, I come from Canada.': 'Ja, jag kommer från Kanada.',
        'Nice. I have to get on now.': 'Vad bra. Nu måste jag gå vidare.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Anlända, hälsa och få igång samtalet igen', 'Ask for repetition': 'Be någon upprepa', 'Can you repeat that, please?': 'Kan ni upprepa det, tack?', 'More slowly, please.': 'Långsammare, tack.',
        'The bus leaves from bay three in five minutes.': 'Bussen går från hållplats tre om fem minuter.', 'Yes. Bay three, in five minutes.': 'Ja. Hållplats tre, om fem minuter.', 'Thank you.': 'Tack.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Anlända, hälsa och få igång samtalet igen', 'Ask for immediate help': 'Be om hjälp direkt', 'Excuse me, can you help me?': 'Ursäkta, kan ni hjälpa mig?', 'Where is the toilet?': 'Var är toaletten?',
        'Yes, of course.': 'Ja, självklart.', 'Just over there.': 'Där borta.',
      }),
    },
  },
  nb: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das og ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das og ein, eine',
        'German has three noun groups': 'Tysk har tre substantivgrupper',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Dette er grammatiske kategorier: der Tisch betyr ikke at et bord er hankjønn.',
        the: 'bestemt artikkel', a: 'ubestemt artikkel',
        'der Tisch · the table': 'der Tisch · bordet', 'die Tür · the door': 'die Tür · døren', 'das Haus · the house': 'das Haus · huset',
        'Two groups share one word for “a”': 'To grupper bruker samme form av ubestemt artikkel', 'der and das words both take ein. Only die words take eine.': 'Substantiv med der og das får ein. Bare substantiv med die får eine.',
        'Helpful habit': 'Et nyttig råd', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'Lær artikkelen sammen med substantivet. Substantiv skrives alltid med stor forbokstav.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. For de fleste substantiv gir endelsen ingen slik pekepinn',
        'Examples in context': 'Eksempler i sammenheng', 'That is a table.': 'Det er et bord.', 'The table is here.': 'Bordet er her.',
        'That is a door.': 'Det er en dør.', 'Where is the door?': 'Hvor er døren?', 'That is a house.': 'Det er et hus.', 'The house is small.': 'Huset er lite.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du eller Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du eller Sie?', 'German has two words for “you”': 'Tysk har to måter å tiltale noen på',
        'an adult you do not know': 'en voksen du ikke kjenner', 'a friend, a child': 'en venn eller et barn', 'a shop, an office, a counter': 'en butikk, et kontor eller en skranke',
        'anyone who offered it': 'noen som selv foreslo du', 'Sie is the safe start': 'Sie er det trygge valget i starten',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Ingen tar det ille opp om du bruker Sie. Den andre personen foreslår å gå over til du, og da kan du takke ja.',
        'The verb changes with the choice': 'Verbet endrer seg med tiltaleformen', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Det høflige Sie skrives alltid med stor bokstav. I praksis varierer bruken etter region, arbeidsplass og alder.',
        'Examples in context': 'Eksempler i sammenheng', 'Hello! What is your name?': 'God dag! Hva heter De?', 'My name is Mia. And you?': 'Jeg heter Mia. Og De?',
        'Hi! What is your name?': 'Hei! Hva heter du?', 'Excuse me, can you help me?': 'Unnskyld, kan De hjelpe meg?', 'I come from Canada.': 'Jeg kommer fra Canada.', 'Goodbye!': 'Ha det!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Ankomme, hilse og få samtalen i gang igjen', 'Say your name': 'Si hva du heter', 'Hello.': 'God dag.', 'My name is Mia.': 'Jeg heter Mia.',
        'Hello! Welcome to Flensburg.': 'God dag! Velkommen til Flensburg.', 'Hello! My name is Mia.': 'God dag! Jeg heter Mia.', 'Pleased to meet you, Ms Berg.': 'Hyggelig å møte Dem, fru Berg.', 'You too.': 'I like måte.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Ankomme, hilse og få samtalen i gang igjen', 'Say where you are from and say goodbye': 'Si hvor du kommer fra og ta farvel',
        'I come from Canada.': 'Jeg kommer fra Canada.', 'Goodbye!': 'Ha det!', 'Do you come from Canada?': 'Kommer De fra Canada?', 'Yes, I come from Canada.': 'Ja, jeg kommer fra Canada.',
        'Nice. I have to get on now.': 'Så bra. Nå må jeg videre.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Ankomme, hilse og få samtalen i gang igjen', 'Ask for repetition': 'Be noen gjenta', 'Can you repeat that, please?': 'Kan De gjenta det, er De snill?', 'More slowly, please.': 'Saktere, er De snill.',
        'The bus leaves from bay three in five minutes.': 'Bussen går fra holdeplass tre om fem minutter.', 'Yes. Bay three, in five minutes.': 'Ja. Holdeplass tre, om fem minutter.', 'Thank you.': 'Takk.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Ankomme, hilse og få samtalen i gang igjen', 'Ask for immediate help': 'Be om hjelp med en gang', 'Excuse me, can you help me?': 'Unnskyld, kan De hjelpe meg?', 'Where is the toilet?': 'Hvor er toalettet?',
        'Yes, of course.': 'Ja, selvfølgelig.', 'Just over there.': 'Rett der borte.',
      }),
    },
  },
  hu: {
    grammar: {
      'flensburg-articles': grammarLines('flensburg-articles', {
        'Der, die, das, and “a”': 'Der, die, das és ein, eine', 'Flensburg · Der, die, das, and “a”': 'Flensburg · Der, die, das és ein, eine',
        'German has three noun groups': 'A németben három főnévi csoport van',
        'Every noun is a der, a die or a das word. These are grammar labels: der Tisch does not mean a table is male.': 'Ezek nyelvtani címkék: a der Tisch nem azt jelenti, hogy az asztal hímnemű.',
        the: 'határozott névelő', a: 'határozatlan névelő',
        'der Tisch · the table': 'der Tisch · az asztal', 'die Tür · the door': 'die Tür · az ajtó', 'das Haus · the house': 'das Haus · a ház',
        'Two groups share one word for “a”': 'Két csoport ugyanazt a névelőt használja', 'der and das words both take ein. Only die words take eine.': 'A der és das csoport főnevei előtt ein áll. Az eine csak a die csoporté.',
        'Helpful habit': 'Hasznos szokás', 'Learn the pair, never the bare noun. Nouns are always capitalised.': 'A főnevet mindig a névelőjével együtt tanuld meg. A német főnevek mindig nagybetűvel kezdődnek.',
        '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. Most nouns give no such clue': '-ung, -heit, -keit, -schaft → die · -chen, -lein → das. A legtöbb főnév nem ad ilyen támpontot',
        'Examples in context': 'Példák szövegkörnyezetben', 'That is a table.': 'Ez egy asztal.', 'The table is here.': 'Az asztal itt van.',
        'That is a door.': 'Ez egy ajtó.', 'Where is the door?': 'Hol van az ajtó?', 'That is a house.': 'Ez egy ház.', 'The house is small.': 'A ház kicsi.',
      }),
      'flensburg-du-sie': grammarLines('flensburg-du-sie', {
        'Du or Sie?': 'Du vagy Sie?', 'Flensburg · Du or Sie?': 'Flensburg · Du vagy Sie?', 'German has two words for “you”': 'A németben kétféleképpen szólíthatunk meg valakit',
        'an adult you do not know': 'egy felnőtt, akit nem ismersz', 'a friend, a child': 'egy barát vagy egy gyerek', 'a shop, an office, a counter': 'egy üzlet, egy iroda vagy egy pult',
        'anyone who offered it': 'aki felajánlotta a du használatát', 'Sie is the safe start': 'Kezdésnek a Sie a biztos választás',
        'Nobody minds being addressed with Sie. The move to du is offered by the other person, and then you take it.': 'Senkit sem zavar, ha Sie formában szólítod meg. A másik fél ajánlja fel a du formát, te pedig elfogadhatod.',
        'The verb changes with the choice': 'Az ige is a megszólításhoz igazodik', 'Polite Sie keeps its capital S everywhere. Real usage varies by region, workplace and age.': 'Az udvarias Sie mindig nagybetűs. A tényleges használat régiónként, munkahelyenként és életkor szerint változik.',
        'Examples in context': 'Példák szövegkörnyezetben', 'Hello! What is your name?': 'Jó napot! Hogy hívják?', 'My name is Mia. And you?': 'Mia vagyok. És önt?',
        'Hi! What is your name?': 'Szia! Hogy hívnak?', 'Excuse me, can you help me?': 'Elnézést, tudna segíteni?', 'I come from Canada.': 'Kanadából jövök.', 'Goodbye!': 'Viszontlátásra!',
      }),
    },
    survival: {
      'flensburg-situation-1': survivalLines('flensburg-situation-1', {
        [themeEn]: 'Megérkezés, köszönés és a beszélgetés folytatása', 'Say your name': 'Mondd meg a neved', 'Hello.': 'Jó napot.', 'My name is Mia.': 'Mia vagyok.',
        'Hello! Welcome to Flensburg.': 'Jó napot! Üdvözlöm Flensburgban.', 'Hello! My name is Mia.': 'Jó napot! Mia vagyok.', 'Pleased to meet you, Ms Berg.': 'Örülök, hogy megismerhetem, Berg asszony.', 'You too.': 'Én is.',
      }),
      'flensburg-situation-2': survivalLines('flensburg-situation-2', {
        [themeEn]: 'Megérkezés, köszönés és a beszélgetés folytatása', 'Say where you are from and say goodbye': 'Mondd el, honnan jöttél, majd búcsúzz el',
        'I come from Canada.': 'Kanadából jövök.', 'Goodbye!': 'Viszontlátásra!', 'Do you come from Canada?': 'Kanadából jött?', 'Yes, I come from Canada.': 'Igen, Kanadából jövök.',
        'Nice. I have to get on now.': 'Rendben. Most tovább kell mennem.',
      }),
      'flensburg-situation-3': survivalLines('flensburg-situation-3', {
        [themeEn]: 'Megérkezés, köszönés és a beszélgetés folytatása', 'Ask for repetition': 'Kérd meg, hogy ismételjék meg', 'Can you repeat that, please?': 'Meg tudná ismételni, kérem?', 'More slowly, please.': 'Lassabban, kérem.',
        'The bus leaves from bay three in five minutes.': 'A busz öt perc múlva indul a hármas kocsiállásról.', 'Yes. Bay three, in five minutes.': 'Igen. Hármas kocsiállás, öt perc múlva.', 'Thank you.': 'Köszönöm.',
      }),
      'flensburg-situation-4': survivalLines('flensburg-situation-4', {
        [themeEn]: 'Megérkezés, köszönés és a beszélgetés folytatása', 'Ask for immediate help': 'Kérj azonnal segítséget', 'Excuse me, can you help me?': 'Elnézést, tudna segíteni?', 'Where is the toilet?': 'Merre van a mosdó?',
        'Yes, of course.': 'Igen, természetesen.', 'Just over there.': 'Mindjárt ott, arrafelé.',
      }),
    },
  },
}

export function germanGuideLineForUiLanguage(
  language: UiLanguage,
  kind: 'grammar' | 'survival',
  id: GermanFlensburgLessonId | GermanFlensburgExchangeId,
  sourceLine: string,
): string {
  const lines = kind === 'grammar'
    ? GERMAN_FLENSBURG_GUIDE_SIDECARS[language].grammar[id as GermanFlensburgLessonId]
    : GERMAN_FLENSBURG_GUIDE_SIDECARS[language].survival[id as GermanFlensburgExchangeId]
  return lines?.[sourceLine] ?? sourceLine
}

export function germanGuideLessonIdForPage(pageId: string): GermanFlensburgLessonId | undefined {
  return GERMAN_FLENSBURG_LESSON_IDS.find((id) => pageId.startsWith(`${id}-`))
}

export function localizeGermanFlensburgGrammarBook(book: GrammarBook, language: UiLanguage): GrammarBook {
  const pages = book.pages.map((page) => {
    const id = germanGuideLessonIdForPage(page.id)
    if (!id) return page
    const translate = (line: string) => germanGuideLineForUiLanguage(language, 'grammar', id, line)
    const blocks: readonly GrammarBookBlock[] = page.blocks.map((block) => {
      if (block.kind === 'paragraph' || block.kind === 'heading' || block.kind === 'quote') {
        return { ...block, text: translate(block.text) }
      }
      if (block.kind === 'list') return { ...block, items: block.items.map(translate) }
      return {
        ...block,
        headers: block.headers.map(translate),
        rows: block.rows.map((row) => row.map(translate)),
      }
    })
    return {
      ...page,
      title: translate(page.title),
      context: translate(page.context),
      blocks,
    }
  })
  return { ...book, pages }
}

function isGermanFlensburgExchangeId(id: string): id is GermanFlensburgExchangeId {
  return (GERMAN_FLENSBURG_EXCHANGE_IDS as readonly string[]).includes(id)
}

export function localizeGermanFlensburgExchange(
  exchange: SurvivalExchange,
  language: UiLanguage,
): SurvivalExchange {
  if (!isGermanFlensburgExchangeId(exchange.targetActivityId)) return exchange
  const id = exchange.targetActivityId
  const translate = (line: string) => germanGuideLineForUiLanguage(language, 'survival', id, line)
  return {
    ...exchange,
    titleEn: translate(exchange.titleEn),
    phrases: exchange.phrases.map((phrase) => ({ ...phrase, en: translate(phrase.en) })),
    dialogue: exchange.dialogue.map((line) => ({ ...line, en: translate(line.en) })) as unknown as SurvivalExchange['dialogue'],
  }
}

export function localizeGermanFlensburgSurvivalCity(
  city: CitySurvivalGuide,
  language: UiLanguage,
): CitySurvivalGuide {
  if (city.cityId !== 'flensburg') return city
  const firstExchange = city.exchanges[0]
  if (!firstExchange || !isGermanFlensburgExchangeId(firstExchange.targetActivityId)) return city
  return {
    ...city,
    themeEn: germanGuideLineForUiLanguage(language, 'survival', firstExchange.targetActivityId, city.themeEn),
    exchanges: city.exchanges.map((exchange) => localizeGermanFlensburgExchange(exchange, language)) as unknown as CitySurvivalGuide['exchanges'],
  }
}

export function germanGuideHasSidecar(id: string): boolean {
  return germanGuideLessonIdForPage(id) !== undefined || isGermanFlensburgExchangeId(id)
}

export function germanGuideEnglishOnlyForCity(cityIndex: number, language: UiLanguage): boolean {
  return cityIndex > 0 && language !== 'en'
}

export function germanGuideGrammarTitle(language: UiLanguage, id: GermanFlensburgLessonId): string {
  return germanGuideLineForUiLanguage(language, 'grammar', id, sourceLessons[id].titleEn)
}

export function germanGuideSurvivalTheme(language: UiLanguage, id: GermanFlensburgExchangeId): string {
  return germanGuideLineForUiLanguage(language, 'survival', id, themeEn)
}

export function germanGuideSourceLines(): {
  readonly grammar: Record<GermanFlensburgLessonId, readonly string[]>
  readonly survival: Record<GermanFlensburgExchangeId, readonly string[]>
} {
  return {
    grammar: {
      'flensburg-articles': grammarSourceLines(sourceLessons['flensburg-articles']),
      'flensburg-du-sie': grammarSourceLines(sourceLessons['flensburg-du-sie']),
    },
    survival: {
      'flensburg-situation-1': survivalSourceLines(sourceExchanges['flensburg-situation-1']),
      'flensburg-situation-2': survivalSourceLines(sourceExchanges['flensburg-situation-2']),
      'flensburg-situation-3': survivalSourceLines(sourceExchanges['flensburg-situation-3']),
      'flensburg-situation-4': survivalSourceLines(sourceExchanges['flensburg-situation-4']),
    },
  }
}
