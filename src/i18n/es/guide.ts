import type { Catalogue } from '../en'

export const guide: Catalogue['guide'] = {
  // ── the guide as an object: covers, names, ways out ──────────────────────
  title: 'Guía de viaje',
  openGuideAria: 'Abrir la Guía de viaje',
  coverAria: 'La Guía de viaje de Casey',
  bookCoverAria: 'Portada de la Guía de viaje',
  backFromGuideAria: 'Salir de la Guía de viaje',
  backToGuideAria: 'Volver a la Guía de viaje',
  backToHomeAria: 'Volver al inicio',
  backToCoverAria: 'Volver a la portada de la Guía de viaje',
  caseyFieldNotes: 'Apuntes de Casey',
  coverTitle: { da: 'Tu viaje al danés, anotado a lápiz.', de: 'Tu viaje al alemán, anotado a lápiz.' },
  pocketGuideEyebrow: 'La guía de bolsillo de Casey',
  pocketGuideTitle: { da: 'Danés para el camino.', de: 'Alemán para el camino.' },
  pocketGuideBlurb:
    'Notas breves sobre las palabras, los patrones y las conversaciones que te encontrarás por el camino.',
  openGrammarContentsAria: 'Abrir el índice de Gramática',

  // ── the two sections and their thumb indexes ─────────────────────────────
  sectionGrammar: 'Gramática',
  sectionSurvival: 'Supervivencia',
  thumbIndexesAria: 'Pestañas de la Guía de viaje',
  grammarThumbBlurb: { da: 'Cómo funciona el danés', de: 'Cómo funciona el alemán' },
  survivalThumbBlurb: 'Qué decir ahí fuera',
  backToGrammarIndexAria: 'Volver al índice de Gramática',
  backToSurvivalIndexAria: 'Volver al índice de Supervivencia',

  // ── a section's city index ───────────────────────────────────────────────
  cityIndexAria: (section) => `Índice de ciudades: ${section}`,
  cityIndexHeading: 'Nueve capítulos, uno por ciudad',
  cityIndexLede: 'Elige cualquier ciudad. Su nombre indica el nivel recomendado.',
  sectionEmpty: 'Estas páginas todavía no están escritas para este idioma.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', ciudad actual' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 lección' : `${n} lecciones`),
  exchangeCount: (n) => (n === 1 ? '1 diálogo' : `${n} diálogos`),
  grammarBookTitle: (city) => `Gramática de ${city}`,
  grammarBookDescription: (n) => `${n} lecciones breves reunidas en la guía de viaje.`,
  grammarLessonBookDescription: 'Una página de reglas y después ejemplos en contexto.',
  grammarExamplesContext: 'Ejemplos en contexto',
  grammarExamplesIntro: 'Lee cada frase como una oración completa y útil.',
  englishOnlyNotice: 'Solo en inglés · traducción pendiente',
  nextSurvivalLabel: 'Siguiente: Supervivencia →',

  // ── one Survival exchange ────────────────────────────────────────────────
  exchangeAria: (title) => `Diálogo: ${title}`,
  recommendedCity: (city) => `Ciudad recomendada: ${city}`,
  speakerYou: 'Tú',
  speakerLocal: 'Del lugar',
  listen: 'Escuchar',
  listenToAria: (line) => `Escuchar: ${line}`,
  translationToggle: 'Español',
  recordingDidNotLoad: 'La grabación no se ha cargado',
  listenNotRecordedYet: 'Aún sin grabar',
  addressFormAria: (form: string) => `Tratamiento: ${form}`,
  exchangeNavAria: 'Navegación por los diálogos',

  // ── turning the pages of a book ──────────────────────────────────────────
  bookNavAria: 'Navegación por las páginas',
  previous: 'Anterior',
  next: 'Siguiente',
  previousLabel: '← Anterior',
  nextLabel: 'Siguiente →',
  openBook: 'Abrir el libro',
  backFromAria: (book) => `Salir de ${book}`,
  backToCoverOfAria: (book) => `Volver a la portada de ${book}`,
  pageOf: (page, total) => `Página ${page} de ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, página ${page} de ${total}`,

  // ── the train ride: its bar, its recording, its way out ──────────────────
  skipLessonAria: 'Omitir la lección',
  skipShort: 'Omitir',
  continueLabel: 'Continuar',
  toSurvivalLabel: 'Supervivencia →',
  recordingSectionAria: 'Grabación de la lección en danés',
  hearTheLesson: 'Escuchar la lección',
  hearTheLessonHelp: 'Una grabación en danés natural. Toca una línea para repasarla.',
  stop: 'Parar',
  recordingLoading: 'Cargando la grabación…',
  recordingFailed: 'La grabación no se ha cargado. Inténtalo otra vez.',
  recordingMissing: 'Esta lección todavía no tiene grabación.',
  grammarChapterAria: (chapter) => `Capítulo ${chapter} de Gramática`,

  // ── the Travel Guide index screen: tabs, chapters, activities ────────────
  tabChapters: 'Capítulos',
  tabPractice: 'Práctica',
  tabSituations: 'Situaciones',
  tabsAria: 'Secciones de la Guía de viaje',
  chapterKicker: (chapter, city) => `Capítulo ${chapter} de 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Capítulo ${chapter} · ${city}`,
  chapterReached: 'Alcanzado',
  lookAhead: 'Mirar adelante',
  lookAheadNote:
    'Mirar adelante es solo leer. No desbloquea esta ciudad ni cuenta como completada.',
  activityNew: 'Nueva',
  activityLater: 'Más tarde',
  activityDone: 'Hecha',
  activityLocked: 'Bloqueada',
  activityListIntro:
    'Nueva, Más tarde y Hecha se quedan aquí aunque bajes del tren. Una actividad bloqueada espera su invitación en la parada de idioma.',
  noActivitiesYet: 'Cuando llegues a una ciudad, su práctica aparecerá aquí.',
  kindPractice: 'Práctica',
  kindReadinessTask: 'Tarea de preparación',
  kindSituation: 'Situación',
  readerNote:
    'Esta página se puede releer cuantas veces quieras. Un primer intento solo se registra en la actividad puntuada, nunca al abrir esta página.',
}
