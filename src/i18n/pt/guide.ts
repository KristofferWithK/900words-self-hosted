import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você. O Guia de Viagem fala com calma e
 * precisão. Glossário: «Sobrevivência» é a secção, um diálogo lá dentro é um
 * «diálogo», a conversa dentro dele é uma «conversa»; a paragem de língua
 * chama-se assim em todo o lado. «Apontamentos» (não «anotações») é a palavra
 * de Portugal para as notas de campo.
 */
export const guide: Catalogue['guide'] = {
  // ── o guia como objeto: capas, nomes, saídas ─────────────────────────────
  title: 'Guia de Viagem',
  openGuideAria: 'Abrir o Guia de Viagem',
  coverAria: 'Guia de viagem da Casey',
  bookCoverAria: 'Capa do Guia de Viagem',
  backFromGuideAria: 'Sair do Guia de Viagem',
  backToGuideAria: 'Voltar ao Guia de Viagem',
  backToHomeAria: 'Voltar ao início',
  backToCoverAria: 'Voltar à capa do Guia de Viagem',
  caseyFieldNotes: 'Apontamentos da Casey',
  coverTitle: { da: 'A tua viagem pelo dinamarquês, a lápis.', de: "A tua viagem pelo alemão, desenhada a lápis." },
  pocketGuideEyebrow: 'Guia de bolso da Casey',
  pocketGuideTitle: { da: 'Dinamarquês para levar.', de: "Alemão para a viagem." },
  pocketGuideBlurb:
    'Notas rápidas sobre as palavras, os padrões e as conversas que encontras pelo caminho.',
  openGrammarContentsAria: 'Abrir o índice de Gramática',

  // ── as duas secções e os seus separadores ────────────────────────────────
  sectionGrammar: 'Gramática',
  sectionSurvival: 'Sobrevivência',
  thumbIndexesAria: 'Separadores do Guia de Viagem',
  grammarThumbBlurb: { da: 'As regras do dinamarquês', de: "Como funciona o alemão" },
  survivalThumbBlurb: 'O que dizer lá fora',
  backToGrammarIndexAria: 'Voltar ao índice de Gramática',
  backToSurvivalIndexAria: 'Voltar ao índice de Sobrevivência',

  // ── o índice de cidades de uma secção ────────────────────────────────────
  cityIndexAria: (section) => `Índice de cidades: ${section}`,
  cityIndexHeading: 'Nove capítulos, nove cidades',
  cityIndexLede: 'Escolhe uma cidade qualquer. O nome indica o nível de aprendizagem recomendado.',
  cityRowAria: (city, topic, current) =>
    `${city}: ${topic}${current ? ', cidade atual' : ''}`,
  lessonCount: (n) => (n === 1 ? '1 lição' : `${n} lições`),
  exchangeCount: (n) => (n === 1 ? '1 diálogo' : `${n} diálogos`),
  grammarBookTitle: (city) => `Gramática de ${city}`,
  grammarBookDescription: (n) => `${n} lições breves reunidas no Guia de Viagem.`,
  grammarLessonBookDescription: 'Uma página de regras, seguida de exemplos em contexto.',
  grammarExamplesContext: 'Exemplos em contexto',
  grammarExamplesIntro: 'Lê cada frase como uma frase completa e útil.',
  englishOnlyNotice: 'Só em inglês · tradução pendente',
  nextSurvivalLabel: 'Seguinte: Sobrevivência →',

  // ── um diálogo de Sobrevivência ──────────────────────────────────────────
  exchangeAria: (title) => `Diálogo: ${title}`,
  recommendedCity: (city) => `Recomendado: ${city}`,
  speakerYou: 'Tu',
  // Quem te responde no diálogo. «Local» em português é um sítio, e
  // «habitante» não tem género — serve para quem quer que esteja do outro lado.
  speakerLocal: 'Habitante',
  listen: 'Ouvir',
  listenToAria: (line) => `Ouvir: ${line}`,
  translationToggle: 'Português',
  recordingDidNotLoad: 'A gravação não carregou',
  exchangeNavAria: 'Navegação dos diálogos de Sobrevivência',

  // ── virar as páginas de um livro ─────────────────────────────────────────
  bookNavAria: 'Navegação das páginas do livro',
  previous: 'Anterior',
  next: 'Seguinte',
  previousLabel: '← Anterior',
  nextLabel: 'Seguinte →',
  openBook: 'Abrir o livro',
  backFromAria: (book) => `Sair de ${book}`,
  backToCoverOfAria: (book) => `Voltar à capa de ${book}`,
  pageOf: (page, total) => `Página ${page} de ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, página ${page} de ${total}`,

  // ── a viagem de comboio: a barra, a gravação, a saída ────────────────────
  skipLessonAria: 'Saltar a lição',
  skipShort: 'Saltar',
  continueLabel: 'Continuar',
  toSurvivalLabel: 'Sobrevivência →',
  recordingSectionAria: 'Gravação da lição de dinamarquês',
  hearTheLesson: 'Ouvir a lição',
  hearTheLessonHelp: 'Uma gravação em dinamarquês natural. Toca numa linha para a trabalhar.',
  stop: 'Parar',
  recordingLoading: 'A carregar a gravação da lição…',
  recordingFailed: 'A gravação da lição não carregou. Tenta outra vez.',
  recordingMissing: 'Esta lição ainda não tem gravação.',
  grammarChapterAria: (chapter) => `Capítulo de gramática ${chapter}`,

  // ── o índice do Guia de Viagem: separadores, capítulos, atividades ───────
  tabChapters: 'Capítulos',
  tabPractice: 'Exercícios',
  // Curto de propósito: três separadores em 360 píxeis.
  tabSituations: 'Situações',
  tabsAria: 'Secções do Guia de Viagem',
  chapterKicker: (chapter, city) => `Capítulo ${chapter} de 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Capítulo ${chapter} · ${city}`,
  chapterReached: 'Alcançado',
  lookAhead: 'Espreitar',
  lookAheadNote: 'Espreitar é só ler. Não desbloqueia esta cidade nem conta como conclusão.',
  activityNew: 'Novo',
  activityLater: 'Mais tarde',
  activityDone: 'Concluído',
  activityLocked: 'Bloqueado',
  activityListIntro:
    '«Novo», «Mais tarde» e «Concluído» ficam aqui mesmo quando sais do comboio. Um exercício bloqueado espera pelo convite da sua paragem de língua.',
  noActivitiesYet: 'Chega a uma cidade para juntar aqui os seus exercícios.',
  kindPractice: 'Exercício',
  kindReadinessTask: 'Tarefa de preparação',
  kindSituation: 'Situação',
  readerNote:
    'Este é um leitor do guia que podes repetir. Um registo de primeira tentativa só é criado pelo fluxo de atividade pontuada, nunca ao abrir esta página.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Estas páginas ainda não foram escritas para esta língua.",
  listenNotRecordedYet: "Ainda sem gravação",
  addressFormAria: (form) => "Forma de tratamento: " + form,
}
