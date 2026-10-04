import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você. O comboio anda mesmo, por isso é sempre
 * «comboio» (nunca «trem») e uma paragem é uma «paragem». Uma carta ARRUMA-SE
 * na ronda de arrumação; uma palavra que a sobreviveu e ficou no fundo da mala
 * está EMBRULHADA — é essa a contagem que vale no Início e no mapa.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Início ──────────────────────────────────────────────────────────────
  settingsAria: 'Definições',
  openMapAria: 'Abrir o mapa',
  homeMapAria: (stop, stops, city) => `Paragem ${stop} de ${stops}: ${city}`,
  needsPass: 'O próximo comboio precisa de passe de viagem',
  wrappedWord: 'embrulhadas',
  collectedCount: (collected) => `${collected} recolhidas`,
  journeyDone: (city) => `Arrumaste a última mala em ${city}.`,
  momentumLine: 'Joga 3 tabuleiros por dia e podes reunir todas as palavras em 90 dias.',
  dailyPlayedAria: (outcome) => `Desafio diário: jogado hoje (${outcome})`,
  dailyAria: 'Desafio diário: um tabuleiro partilhado por dia',
  play: 'Jogar',
  continueGame: 'Continuar o jogo',
  continueWrapUp: 'Continuar arrumação',
  continueReview: 'Continuar revisão',
  continuePrimary: 'Continuar tabuleiro', continueReplay: 'Continuar repetição', returnToPrimary: 'Voltar ao teu tabuleiro',
  viewResult: 'Ver resultado', improveBoards: 'Melhorar os teus tabuleiros', postcardsEarned: 'postais ganhos',
  postcardsRemaining: (remaining) => `${remaining} postal${remaining === 1 ? '' : 'es'} para viajar`, postcardReadiness: (earned, remaining) => `${earned} postais ganhos; ${remaining} para viajar.`,
  readyToTravel: 'Pronto para viajar', nextStopNotReleased: (city) => `Pronto para viajar. ${city} ainda não está disponível.`, cityMedalInProgress: 'ainda não ganho', cityMedal: (tier) => `Medalha da cidade: ${tier}`,
  backToCity: (city) => `Voltar a ${city}`,

  // ── O mapa ──────────────────────────────────────────────────────────────
  back: 'Voltar',
  journeyTitle: 'A viagem',
  mapAria: (country, stop, stops, city) =>
    `Mapa de ${country}. Paragem ${stop} de ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, paragem ${stop}, ${status}`,
  statusVisited: 'visitada',
  statusHere: 'estás aqui',
  statusNotReached: 'ainda não alcançada',
  statusAhead: 'mais à frente',
  stopOf: (stop, stops) => `Paragem ${stop} de ${stops}`,
  arrivedOn: (date) => `chegada a ${date}`,
  previousStopAria: 'Paragem anterior',
  nextStopAria: 'Paragem seguinte',
  wordsWaiting: (words, city) =>
    `${words} ${words === 1 ? 'palavra à espera' : 'palavras à espera'}. Chega a ${city} para ${words === 1 ? 'a' : 'as'} desbloquear.`,
  lookAhead: 'Espreitar',
  travelAhead: 'Viajar adiante',
  enableTravelAhead: 'Ativar Viajar adiante',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} embrulhadas · ${collected} recolhidas · ${discovered} descobertas`,
  suitcasePacked: 'mala arrumada',
  lineClosedNote: 'Linha fechada para obras. Toca no comboio para ver o aviso.',
  travelBackTo: (city) => `Voltar → ${city}`,
  travelOnTo: (city) => `Seguir viagem → ${city}`,
  trainToClosed: (city) => `Comboio para ${city}: linha fechada`,
  getPassFor: (city) => `Obter passe de viagem para ${city}`,
  mapCredit: 'Kort · dados do mapa: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Voltar ao mapa',

  // ── O comboio, nos dois ecrãs ───────────────────────────────────────────
  trainJourneyOver: 'A mala está arrumada. A viagem chegou ao fim.',
  trainReady: (city) => `A mala está arrumada. O comboio para ${city} está pronto.`,
  wordsToFinish: (words) =>
    `${words === 1 ? 'Falta-te' : 'Faltam-te'} ${words} ${words === 1 ? 'palavra embrulhada' : 'palavras embrulhadas'} para acabar a viagem.`,
  wordsToTrain: (words, city) =>
    `${words === 1 ? 'Falta-te' : 'Faltam-te'} ${words} ${words === 1 ? 'palavra embrulhada' : 'palavras embrulhadas'} para apanhar o comboio para ${city}.`,
  boardTrain: (city) => `Apanhar o comboio para ${city}`,

  // ── Chegar ──────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `De volta. As tuas ${words} palavras daqui continuam na mala. Joga-as outra vez, ou segue viagem quando quiseres.`,
  arrivalNew: (words) =>
    `${words} ${words === 1 ? 'palavra nova' : 'palavras novas'} para descobrir. A Casey está aberta, à espera.`,
  getStarted: 'Começar',
  seeTheMap: 'Ver o mapa',

  // ── A mala ──────────────────────────────────────────────────────────────
  suitcaseTitle: 'A mala',
  filterAria: 'Filtrar a mala por cidade',
  filterAll: 'Todas',
  pagerPreviousAria: (band) => `${band}, página anterior`,
  pagerNextAria: (band) => `${band}, página seguinte`,
  looseLabel: (words) => `Ainda por aí: ${words}`,
  looseEmpty: 'Nada solto. Todas as palavras daqui estão na mala.',
  lidEmpty: 'Três marcas recolhem uma palavra: uma foto, uma tentativa e uma pista.',
  trayLabel: (words, goal) => `Embrulhadas: ${words} de ${goal}`,
  trayEmpty: 'Ainda nada no fundo. As rondas de arrumação guardam aqui as palavras de vez.',
  undiscoveredAria: 'Palavra por descobrir',
  wrapUpWords: 'Embrulhar palavras',
  wrapUpBankedAria: (banked) => `Embrulhar palavras: ${banked} em reserva`,
  postcardBalance: (banked) => `Postais · ${banked}`,
  postcardHelp: 'Precisas da resposta? Usa um postal.',
  packingAnswerShown: 'Resposta mostrada. Carrega em Arrumar.',
  packingNoPostcards: 'Ganha uma ronda normal para receberes um postal.',
  packingFirstPostcardHint: (language) => `Escreve a palavra em ${language} para arrumar. Um postal revela-a.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Mostra esta resposta outra vez de graça.' : state === 'select' ? 'Primeiro escolhe uma carta por arrumar.' : state === 'empty' ? 'Ganha uma ronda normal para receberes um postal de tradução.' : `Gasta um postal para revelar a resposta em ${language} desta carta.`,
  packingPostcardAria: (shown, banked) => shown ? 'Mostrar a tradução outra vez de graça' : `Usar postal de tradução: ${banked} disponíveis`,
  packingPostcardShowAnswer: 'Mostrar resposta',
  usePostcard: 'Usar postal',
  wrapUpContinueAria: 'Continuar a ronda de arrumação em curso',
  hintWrapUpWaiting: 'Já há uma ronda de arrumação em curso. Retoma-a onde a deixaste.',
  hintCollectFirst: (city) =>
    `Recolhe primeiro uma palavra em ${city}, um verde em cada sentido, e a ronda de arrumação terá algo para arrumar.`,
  hintFirstWrapUp: (wins) =>
    `Ganha ${wins} ${wins === 1 ? 'ronda' : 'rondas'} para teres a tua primeira ronda de arrumação.`,
  hintMoreWins: (wins) =>
    `${wins === 1 ? 'Falta 1 vitória' : `Faltam ${wins} vitórias`} para uma ronda de arrumação.`,
  hintPacksRange: (collected, city) =>
    `${collected} recolhidas em ${city}. Uma ronda de arrumação arruma de 13 a 15, conforme a chave.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} recolhidas em ${city}. A próxima ronda de arrumação arruma até ${cap}, conforme a chave.`,

  // ── O balcão de arrumação, no topo de uma ronda de arrumação ────────────
  packWord: (word) => `Arrumar «${word}»`,
  // Título do balcão, com a contagem ao lado: «Arrumar a mala — 3 de 12».
  // Cabe em ~206px a 360 de largura; tem o mesmo comprimento que o inglês.
  packTheBoard: 'Arrumar a mala',
  packCount: (packed, packable) => `(${packed} de ${packable})`,
  startEarlyWarning: (remaining) =>
    `Começar com ${remaining} por arrumar. Ficam em inglês e não podem ser embrulhadas nesta ronda`,
  startEarly: (remaining) => `Começar com ${remaining}`,
  tapEnglishCard: 'Toca numa carta em inglês',
  theWordFor: (language, word) => `${word} em ${language}`,
  tapEnglishCardFirst: 'Toca primeiro numa carta em inglês',
  pack: 'Arrumar',
  packMiss: 'Não é essa. A falha fica registada. Continua a tentar.',
  packFirstTime:
    'Escreve em dinamarquês para arrumar. Começar cedo deixa cartas em inglês e por embrulhar.',
  packRecall: 'O dicionário está fechado. Agora é de memória.',
  packTapAndType: (language) => `Toca numa carta em inglês e escreve-a em ${language}.`,

  // ── O passe de viagem ───────────────────────────────────────────────────
  passBackAria: 'Voltar ao mapa',
  passTitle: 'Próximos comboios',
  passKicker: 'As tuas duas primeiras cidades são grátis.',
  passHeading: 'Um passe de viagem para o resto da Dinamarca',
  passIntro:
    'Infelizmente, os transportes públicos na Dinamarca não são grátis. Se quiseres apanhar os próximos comboios, precisas de um passe de viagem.',
  passOptionsAria: 'Opções de passe de viagem',
  passMonthly: 'Passe de viagem mensal',
  passMonthlyHelp: 'Continua a viajar enquanto o teu passe de viagem estiver ativo.',
  passLifetime: 'Passe de viagem vitalício',
  passLifetimeHelp: 'Um só passe de viagem para todas as viagens que lançarmos.',
  passReady: 'O teu passe de viagem está pronto. O próximo comboio está aberto.',
  passRestore: 'Restaurar compras',
  passRedeem: 'Resgatar código da App Store',
  passKindness: 'Aprender não devia depender do dinheiro.',
  // «… envia-a para ⟨endereço⟩ para receberes …»: o endereço fica com espaços
  // entre as duas metades, por isso nenhuma delas começa com pontuação.
  passReviewBefore: 'Escreve uma avaliação na App Store, tira-lhe uma fotografia e envia-a para',
  passReviewAfter:
    'para receberes um código de passe de viagem de 6 meses. A avaliação pode ser boa ou má, conforme gostes da app.',

  // ── Oferta após o limite diário ──────────────────────────────────────────
  dailyLimitKicker: 'Grátis tens dois passeios e dois enigmas do café por dia.',
  dailyLimitRunsKicker: 'Hoje já deste dois passeios.',
  dailyLimitPuzzlesKicker: 'Hoje já jogaste dois enigmas do café.',
  dailyLimitBothKicker: 'Hoje já deste dois passeios e jogaste dois enigmas do café.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Ainda podes jogar 1 enigma do café hoje.' : `Ainda podes jogar ${n} enigmas do café hoje.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Ainda podes dar 1 passeio hoje.' : `Ainda podes dar ${n} passeios hoje.`),
  dailyLimitHeading: 'Continua a jogar com a Casey',
  dailyLimitBody: 'Volta amanhã ou desbloqueia passeios e enigmas do café ilimitados.',
  dailyLimitOptionsAria: 'Opções para jogar sem limite',
  dailyLimitMonthly: 'Mensal',
  dailyLimitMonthlyHelp: 'Renova automaticamente todos os meses até cancelares.',
  dailyLimitLifetime: 'Pagamento único',
  dailyLimitLifetimeHelp: 'Jogos ilimitados, sem subscrição.',
  dailyLimitUnavailable: 'Indisponível',
  dailyLimitCloseAria: 'Fechar a janela da oferta',
  dailyLimitRestore: 'Restaurar compras',
  dailyLimitDismiss: 'Talvez amanhã',
  dailyLimitDisclosure: 'A Apple fornece os preços e confirma as compras. Gere ou cancela a subscrição na tua Conta Apple.',
  dailyLimitDisclosurePlay: 'O Google Play fornece os preços e confirma as compras. Gere ou cancela a subscrição na app Play Store.',
  purchaseTerms: 'Termos de Utilização',
  purchasePrivacy: 'Política de Privacidade',
  passThanksHeading: 'Obrigado por apoiares o desenvolvimento do 900words',
  passThanksBody: 'O jogo ilimitado está desbloqueado.',
  passThanksContinue: 'Continuar a jogar',

  // ── A paragem de língua opcional ────────────────────────────────────────
  stopKicker: 'Paragem de língua opcional',
  stopKindGrammar: 'Exercício de gramática',
  stopKindSituation: 'Uma pequena situação',
  stopKindExit: 'Prova de preparação opcional',
  stopKindReview: 'Revisão pendente',
  stopFocus: 'O teu próximo tema de língua',
  stopNote:
    'Esta paragem é guardada à parte da tua mala. Nunca muda que palavras podes arrumar nem se o comboio pode partir.',
  stopAuthoring:
    'As perguntas em dinamarquês e a pontuação estão a ser escritas com o conteúdo do curso. Deixa-a para mais tarde, ou fica no teu guia; nenhuma tentativa provisória é registada como prova de aprendizagem.',
  stopContinue: 'Continuar',
  stopLater: 'Mais tarde',
  stopSkip: 'Saltar esta paragem',
  stopStart: 'Começar',
  stopOpen: 'Paragem de língua',

  // ── a linha fechada (src/journey/trainService.ts) ────────────────────────
  trainClosedLabel: (city) =>
    `O comboio para ${city} ainda não circula. A linha está fechada para obras`,
  trainClosedTitle: 'A linha está fechada para obras',
  trainClosedBody: (city, here) =>
    `O comboio para ${city} ainda não circula. Há obras na linha. ` +
    `Volta a circular em breve, e avisamos-te aqui assim que isso acontecer. ` +
    `Até lá, ${here} é toda tua: cada tabuleiro, cada ronda de arrumação e a tua sequência.`,
  trainReopenedTitle: (city) => `O comboio para ${city} voltou a circular`,
  trainReopenedBody:
    'A linha está aberta. A tua mala está arrumada e a Casey está na plataforma. Entra quando quiseres.',

  // Current Settings and German-preview integration.
  previewHeading: "Ainda não há jogo de palavras",
  previewNote: "O mapa e o Guia de viagem já estão disponíveis. Os tabuleiros, as pistas e as gravações ainda não estão prontos.",
  previewGuideCta: "Abrir o Guia de viagem",
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Enigma do café',
  sightseeingNote: 'encontra novos cafés',
  sightseeingAsk: 'Em que queres reparar?',
  wordsWalkNote: 'O que significa? Fotografa a palavra certa e encontra novos cafés.',
  articlesWalkNote: (ask, lanes) =>
    lanes === 2 ? `${ask} Segue pelo caminho da esquerda ou da direita.` : `${ask} Cada artigo tem a sua faixa.`,
  trainSheetTitle: (city) => `O comboio para ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} palavras (${board} nos tabuleiros, ${connecting} de ligação)` : `${city}: ${total} palavras`,
  trainSheetCollected: (collected, total) => `Recolhidas: ${collected} de ${total}`,
  trainSheetRule: 'A corrida é a única forma de apanhar o comboio.',
  cityStampAria: (city, percent) => `${city}: ${percent} dos selos dos cafés.`,
  cafeNotFoundNote: 'encontra primeiro um café',
  cafeNotFoundLine: 'Encontra primeiro um café no passeio pela cidade.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'Um terço por uma foto, uma tentativa e uma pista',
  markPhoto: 'foto',
  markGuess: 'tentativa',
  markClue: 'pista',
  markPhotoDays: (days) => (days === 1 ? 'uma foto em 1 dia' : `fotos em ${days} dias`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} de ${total}: ${marks}` : `${word}, ${earned} de ${total}`,
  connectingWord: 'Palavra de ligação',
  connectingWordRule: 'Não tem cartão. Fotos em três dias diferentes recolhem-na.',
  stampCardTitle: (city) => `Cartão de selos de ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} de ${cafes} cafés`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} a partir de ${percent}`,
  stampFound: 'Encontrado',
  stampNotFound: 'Por encontrar',
  stampCafeNumber: (place) => `Café ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: encontrado, ainda por jogar`,
  stampCellNotFound: (place) => `Café ${place}: ainda por encontrar`,
  stampNextCafe: (cafe) => `Próximo café: ${cafe}`,
  stampNextCafeUnfound: 'Encontra o próximo café no passeio pela cidade.',
  stampAllPlayed: 'Já jogaste todos os cafés. Toca num para o jogar outra vez.',
}
