import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você. A Casey é «ela». Uma jogada é uma jogada
 * e a vez é a vez — o comboio é que anda. «Ronda», nunca «rodada».
 *
 * O verbo do palpite: «adivinhar» é a atividade e a fase, mas em português
 * (como em espanhol) tende a implicar acerto, por isso quando o resultado vem
 * logo a seguir — «— neutra» — a Casey «tentou» a palavra. O nome do glossário
 * é sempre «tentativa».
 *
 * Curto: o tabuleiro, a caixa da pista e o ecrã final têm de caber a 360x640
 * sem rolar.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "O teu progresso está seguro",
  legacyRetiredBody: "Uma ronda antiga não pôde continuar após esta atualização. A aprendizagem e os postais guardados foram preservados. Continua com o próximo tabuleiro por concluir.",
  // ── a legenda da fase, no topo do tabuleiro ──────────────────────────────
  phaseGiveClue: 'Dá uma pista à Casey',
  phaseCaseyGuessing: 'A Casey está a adivinhar',
  phaseCaseyClue: 'A Casey prepara uma pista',
  phaseYourGuess: 'É a tua vez de adivinhar',
  phaseLastChance: 'Última hipótese: sem pistas',
  phaseRoundOver: 'Ronda terminada',
  phasePackTheBoard: 'Arrumar a mala',

  // ── o que a região viva diz enquanto a Casey joga ────────────────────────
  announceCaseyGuess: (word, result) => `A Casey tentou ${word}: ${result}.`,
  resultCorrect: 'certo',
  resultNeutral: 'neutra',
  announceCaseyThinking: 'A Casey está a pensar.',

  // ── o cabeçalho do jogo ──────────────────────────────────────────────────
  skip: 'Saltar',
  homeAria: 'Início',
  dealNewWordsAria: 'Distribuir palavras novas',
  hideTranslationsAria: 'Ocultar traduções',
  showTranslationsAria:
    'Mostrar todas as traduções. Conta como consultar cada palavra por resolver',

  // ── não foi possível chegar à Casey ──────────────────────────────────────
  errorRetry: 'Tentar de novo',
  errorCaseySettings: 'Definições da Casey',
  practiceNote: 'Protótipo experimental sem agente. Isto não é a Casey nem o jogo normal.',

  // ── a fase de estudo ─────────────────────────────────────────────────────
  studyTitle: 'Estudar o tabuleiro',
  studyHint: 'Todas as traduções estão visíveis. Escondem-se quando começas, e um toque consulta uma.',
  studyStart: 'Começar a ronda',

  // ── o nome acessível de uma carta, montado por esta ordem ────────────────
  cardYourTarget: ', o teu alvo',
  cardFound: ', encontrada',
  cardNeutralBoth: ', neutra para os dois lados',
  cardNeutralPlayer: ', neutra com as tuas pistas',
  cardNeutralCasey: ', neutra com as pistas da Casey',
  cardUnpacked: ', por arrumar',
  cardTranslationRevealed: ', tradução revelada',
  cardNotYetPacked: (language) => `, ainda por arrumar. Toca para escrever em ${language}`,
  cardNotYoursToWrap: ', ainda não é tua para embrulhar',
  cardTapToHear: '. Toca para ouvir',
  lookUpAria: (word) => `Consultar ${word}`,

  // ── a caixa da pista ─────────────────────────────────────────────────────
  cluePlaceholder: 'A tua pista',
  clueFieldAria: (language) => `A tua pista de uma palavra, em ${language}`,
  fewerWordsAria: 'menos palavras',
  moreWordsAria: 'mais palavras',
  wordCountAria: (n) => (n === 1 ? '1 palavra' : `${n} palavras`),
  giveClue: 'Dar pista',
  giveItAnyway: 'Dar na mesma',
  askingCasey: 'A enviar à Casey…',
  firstClueHint: (language) =>
    `Uma palavra em ${language}. Sem ideias? O dicionário ao lado traduz.`,
  tutorialClueHint: 'Interpreto as pistas em dinamarquês. Na dúvida, tenta. O dicionário pode ajudar.',
  wrapPlayerKeyHint: 'O teu contorno verde voltou. É a tua chave privada. A Casey não a vê.',
  looksEnglishFull: (word, language) =>
    `«${word}» parece o significado de uma palavra da carta. Toca para ver em ${language}, ou dá na mesma e a Casey verifica.`,
  looksEnglishShort: 'parece o significado de uma palavra da carta. Toca, ou dá na mesma',

  // ── a barra de tentativas ────────────────────────────────────────────────
  caseysClueLabel: 'Pista da Casey',
  lookUpInDictionaryAria: (word) => `Consultar «${word}» no dicionário`,
  guessesLeft: (n) => (n === 1 ? 'Falta 1 tentativa' : `Faltam ${n} tentativas`),
  guessWord: (word) => `Tentar «${word}»`,
  cancel: 'Cancelar',
  stopKeepWhatWeHave: 'Parar e ficar com o que temos',
  guessPrompt: 'Toca numa palavra que aches que a Casey quer dizer.',
  firstGuessHint: 'Agora conta a chave da Casey. Toca numa palavra para onde a pista dela aponta.',
  wrapCaseyKeyHint:
    'A chave da Casey é secreta. Adivinha para onde a pista dela aponta. Agora contam os verdes dela.',
  tutorialLookupHint: 'Toca no ⓘ ao lado de uma palavra para consultar a tradução.',

  // ── a última hipótese ────────────────────────────────────────────────────
  suddenDeathRule: 'Nomeia verdes para ganhar. Qualquer outra coisa acaba a ronda.',
  nameWord: (word) => `Nomear «${word}»`,
  giveUpRound: 'Desistir da ronda',

  // ── a roda de tradução (a última chance, nova 2026-09-16) ─────────────────
  wheelLede: (language) => `A roda decide a ronda. Escreve as palavras outra vez em ${language} para a encher, e depois gira. O verde ganha.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Escreve em ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Escreve em ${language} a tradução de qualquer destas palavras: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', tradução dada' : ', tradução por dar',
  wheelRetryLine: 'Não é isso. Tenta outra vez. Não perdes nada.',
  wheelSubmit: 'Arrumar',
  wheelSpinAria: 'Girar a roda',
  wheelSpinning: 'A girar …',
  wheelWonLine: 'Verde! A ronda está ganha.',
  wheelMissLine: 'A roda parou numa mala por arrumar.',
  phaseTranslateChallenge: 'Hora de traduzir',
  settlementFailed: 'Ainda não foi possível guardar o resultado. Mantém esta ronda e tenta novamente.',
  settlementSaving: 'A guardar o resultado…',
  guidanceTranslationBody: (language) => `As malas mostram agora o que as palavras significam. Escreve cada uma outra vez em ${language} para encher a roda e depois gira. O verde ganha.`,
  guidanceStartTranslation: 'Começar a traduzir',
  phaseTranslateWheel: 'A roda: o giro decide a ronda',

  // ── o painel de chegada da última chance ──────────────────────────────────
  /** A frase da janela quando as pistas acabam e o desafio da roda começa (dono, 2026-09-17) — na mesma voz de wheelLede. */
  guidanceLastChanceWheel:
    'Ficaste sem pistas, por isso este é o final. Traduz as palavras apanhadas para encher a roda, e depois gira. O verde ganha a ronda.',

  // ── a jogada da Casey ────────────────────────────────────────────────────
  caseyIsThinking: 'A Casey está a pensar…',
  offlineCaseyIsThinking: 'A Casey sem ligação está a pensar. Demora mais.',
  offlineRoundPrompt: 'Sem internet. Jogar o resto desta ronda com a Casey sem ligação? Ela é mais lenta.',
  playOfflineButton: 'Jogar sem ligação',
  hurryCaseyTitle: 'Toca para apressar a Casey',
  hurryCaseyHint: 'Toca aqui para apressar a Casey.',
  caseyGuessedWord: (word) => `A Casey tentou «${word}».`,
  caseyChoosingWord: 'A Casey está a escolher uma palavra…',
  caseyChoosingWhether: 'A Casey está a decidir se tenta…',
  guessGotOne: '. Acertou!',
  guessNeutral: '. Neutra.',

  // ── as fichas partilhadas ────────────────────────────────────────────────
  turnTokensAria: (given, total, left) =>
    `${given} de ${total} pistas dadas, ${left === 1 ? 'falta' : 'faltam'} ${left}.`,
  cluesGivenCount: (given, total) => `${given}/${total} pistas dadas`,

  // ── sair de uma ronda a meio ─────────────────────────────────────────────
  leaveTitle: 'Sair desta ronda?',
  leaveBody:
    'Pausar deixa o tabuleiro exatamente como está. Cancelar descarta-o, e Jogar começa uma ronda nova.',
  leaveKeepPlaying: 'Continuar a jogar',
  leavePause: 'Pausar o jogo',
  leaveCancelRound: 'Cancelar a ronda',

  // ── a janela que abre uma ronda ──────────────────────────────────────────
  guidanceCaseyTitle: 'Primeira pista da Casey',
  guidancePlayerTitle: 'É a tua vez!',
  guidanceWordCount: (n) => (n === 1 ? '1 palavra' : `${n} palavras`),
  guidanceCaseyBody: 'Encontra as palavras que se ligam à pista da Casey.',
  guidancePlayerBody:
    'Escreve uma palavra em dinamarquês que ligue 1–4 das tuas palavras verdes. Usa o dicionário se não souberes a palavra em dinamarquês.',
  guidanceHideReminder: 'Não voltar a lembrar',
  guidanceStartGuessing: 'Começar a adivinhar',
  guidanceWriteClue: 'Escrever pista',
  // O português não usa maiúsculas de título; a frase é a mesma da legenda.
  guidanceLastChanceTitle: 'Última hipótese',
  guidanceLastChanceBody:
    'Ficaste sem pistas. Mas ainda podes ganhar. Continua a adivinhar com base nas pistas anteriores. Mas uma tentativa errada e perdes.',
  guidanceKeepNaming: 'Continuar a nomear',
  guidancePackingTitle: 'Arruma a mala primeiro',
  guidancePackingBody:
    'Escreve em dinamarquês para cada carta, uma de cada vez. Quando estiverem todas escritas, ou não conseguires ir mais longe, começa a ronda.',
  guidanceStartPacking: 'Começar a arrumar',

  // ── o dicionário: o campo, a resposta e a folha por trás ─────────────────
  dictionaryPlaceholder: 'Dicionário',
  dictionaryFieldAria: (language) => `Palavra a traduzir, em ${language} ou na tua língua`,
  dictHitAria: (entry) => `${entry}: abrir o dicionário`,
  approximateFrom: (term) => ` (de ${term})`,
  onTheBoardNote: ' (no tabuleiro)',
  translateFailed: 'Não foi possível traduzir isso.',
  lookupsUsed: 'Já não tens pesquisas.',
  dictionaryPracticeOnly: 'No treino, só as 900 palavras.',
  sayAgainAria: (word) => `Dizer ${word} outra vez`,
  saySlowlyAria: (word) => `Dizer ${word} devagar`,
  sayExampleAria: 'Dizer a frase de exemplo outra vez',
  sayExampleSlowlyAria: 'Dizer a frase de exemplo devagar',
  recordingsUnavailableNote: ' · gravações normal e lenta indisponíveis',
  recordingFailedNote: ' · a gravação não carregou',
  close: 'Fechar',

  // ── as decisões da Casey: o registo da ronda e as bandeiras ──────────────
  caseysCalls: 'Decisões da Casey',
  turnCount: (n) => (n === 1 ? '1 jogada' : `${n} jogadas`),
  logHint:
    'Toca em ⚑ em qualquer coisa da Casey que tenha sido uma má decisão. Ela vê as que assinalas.',
  logYou: 'Tu',
  logFor: 'para',
  flagClueLabel: (clue) => `Pista da Casey «${clue}»`,
  flagGuessLabel: (word) => `Tentativa da Casey «${word}»`,
  flagOnAria: (label) => `${label}, assinalada como má decisão. Toca para anular`,
  flagOffAria: (label) => `Assinalar ${label} como má decisão`,
  guessCorrectSr: ', certo',
  guessNeutralSr: ', neutra',
  confidenceSure: (percent) => `${percent}% de certeza`,
  noGuessMade: 'sem tentativa',

  // ── o registo de pistas: um diagnóstico seco, não uma pontuação ──────────
  ledgerEmpty:
    'Ainda nada. Aparece aqui uma linha por cada pista da Casey assim que acabares de adivinhar com ela.',
  ledgerArmHeading: 'fonte',
  ledgerCluesHeading: 'pistas',
  ledgerFoundHeading: 'encontradas',
  ledgerRefusedHeading: 'recusadas',
  ledgerHitsTitle: (hits, asked) => `${hits} de ${asked} palavras pedidas`,
  ledgerRefusedTitle: 'Quantas vezes a primeira resposta desta fonte foi deitada fora e pedida de novo',
  ledgerExplainer:
    '«encontradas» é a parte das palavras pedidas por uma pista que realmente viraste. «recusadas» é quantas vezes a primeira resposta do modelo foi deitada fora e pedida de novo. As fontes offline não podem ser recusadas.',
  ledgerClear: 'Limpar o registo',

  // ── como a ronda acabou ──────────────────────────────────────────────────
  outcomeWonTitle: 'Parabéns!',
  outcomeWonSub: 'Ganhaste um postal!',
  outcomeLostTitle: 'Para a próxima',
  outcomeGivenUpSub: 'Ronda abandonada. A ligação estava lá.',
  outcomeWheelMissSub: 'A roda parou numa mala que nunca arrumaste.',
  /** O final vencedor da roda (proprietário, 18-09-2026): parou no verde. */
  outcomeWheelWinSub: 'A roda parou no verde. A ronda é tua.',
  outcomeWheelSpentSub: 'A ficha foi gasta, e as pistas ainda assim se esgotaram.',

  resultLesson: 'Há uma nova lição opcional pronta no Guia.', resultOpenGrammar: 'Abrir Gramática no Guia', resultOpenSurvival: 'Abrir Sobrevivência no Guia', resultBackToResult: 'Voltar ao resultado',

  // ── o que a ronda deu, numa linha por baixo do título ────────────────────
  roundStatsAria: 'O que esta ronda deu',
  newWordsLabel: (n) => (n === 1 ? 'palavra nova' : 'palavras novas'),
  collectedForCasey: 'recolhidas para a Casey',
  wrapStatsAria: 'O que esta ronda de arrumação arrumou',
  wrappedForGood: (named) => (named ? 'embrulhadas de vez:' : 'embrulhadas de vez'),
  stayedLabel: 'por embrulhar',

  // ── onde a ronda deixou a viagem: a zona de leitura da ronda de arrumação ─
  // O número fica num span próprio à frente: «13 embrulhadas em Ribe · 87
  // faltam até ao comboio para Kolding».
  wrapJourneyHeading: 'A viagem',
  wrapJourneyAria: 'A viagem depois desta ronda de arrumação',
  wrappedInCity: (n, city) => `${n === 1 ? 'embrulhada' : 'embrulhadas'} em ${city}`,
  wrapJourneyTrainReady: (city) => `o comboio para ${city} está pronto`,
  wrapJourneyOver: 'a viagem chegou ao fim',
  wrapJourneyToGo: (n, city) =>
    `${n === 1 ? 'falta' : 'faltam'} até ao comboio${city ? ` para ${city}` : ''}`,

  // ── a economia da arrumação, dita à saída de uma ronda ganha ─────────────
  wrapUpUnlocked:
    'Ronda de arrumação desbloqueada. Arruma as palavras recolhidas na mala de vez. Abre a mala para a gastar.',
  wrapUpEarned: (banked) => `Ronda de arrumação ganha. ${banked} em reserva. Gasta uma na mala.`,
  postcardEarned: (banked) => `+1 postal de tradução · ${banked} disponível`,
  wrapUpBankFull: (cap) =>
    `A reserva está cheia. A mala só guarda ${cap} rondas de arrumação. Gasta uma e as vitórias voltam a contar.`,
  winsToWrapUp: (n) =>
    n === 1
      ? 'Falta 1 vitória para uma ronda de arrumação'
      : `Faltam ${n} vitórias para uma ronda de arrumação`,
  wrapResultFirst:
    'As cartas verdes arrumadas ficam embrulhadas de vez, quer esta ronda seja ganha ou perdida.',
  wrapResultNothing:
    'Nada embrulhado. Uma palavra fica embrulhada quando foi traduzida E encontrada verde, ganhes ou percas.',
  wrapResultLost:
    'Perder não te custou nada aqui. Uma ronda de arrumação guarda o que arrumaste e encontraste verde, ganhes ou percas.',

  // ── a saída de uma ronda ─────────────────────────────────────────────────
  playAgain: 'Jogar outra vez',
  playNextGame: 'Próximo jogo',
  home: 'Início',
  postWrapChoicesAria: 'Opções depois da ronda de arrumação',
  postWrapHeading: 'E agora?',
  postWrapGrammar: 'Gramática',
  postWrapSurvival: 'Sobrevivência',
  // Gramática e Sobrevivência: ambas.
  postWrapBoth: 'Ambas',
  postWrapBothNote: 'Primeiro a gramática, depois direto para o diálogo.',
  grammarNote: (city, topic, lessons) =>
    `Gramática de ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lições.` : '.'}`,
  // «Diálogo» é o diálogo do glossário; a conversa lá dentro chama-se «conversa».
  survivalNextNote: (number, total, title) =>
    `Diálogo ${number} de ${total}: ${title}. Primeiro as frases, depois a conversa.`,
  survivalAllReadTitle: 'Os quatro diálogos já estão lidos.',
  survivalLockedTitle: 'Completa uma ronda de arrumação para desbloquear o próximo diálogo.',
  survivalLockedNote: 'O próximo diálogo desbloqueia-se quando uma ronda de arrumação termina.',

  // ── a faixa de frases por baixo do resultado ─────────────────────────────
  sentenceReviewAria: 'Revisão de frases',
  hearItInDanish: 'Ouvir em dinamarquês',
  legendGreenLabel: 'Verde',
  legendGreenMeaning: ': a palavra que encontraste.',
  legendUnderlinedLabel: 'Sublinhado',
  legendUnderlinedMeaning: (city) => `: as palavras pequenas de ${city}.`,
  legendTapToHear: 'Toca para ouvir.',

  // ── o leitor da Cidade 1 que substitui o ecrã final ──────────────────────
  reviewTitle: 'Revisão do tabuleiro',
  reviewProgress: (current, total) => `${current} de ${total}`,
  reviewOptional: 'Opcional · uma frase por pista',
  reviewListen: 'Ouvir',
  reviewListenSlowlyAria: 'Ouvir devagar',
  reviewNoRecordings: 'Gravações normal e lenta indisponíveis.',
  reviewRecordingUnavailable: 'Gravação indisponível.',
  reviewSoundOff: 'O som está desligado ou a reprodução foi parada.',
  reviewShowTranslation: 'Mostrar tradução',
  reviewHideTranslation: 'Ocultar tradução',
  reviewAboutWord: 'Sobre esta palavra',
  reviewHighFrequencyWord: 'Palavra frequente:',
  reviewNoNotes: 'Sem notas para esta palavra.',
  reviewNextSentence: 'Frase seguinte',
  // «acertou» aqui é mesmo acerto: a frase só existe quando a Casey acertou.
  reviewNothingThisRound:
    'Nada para rever nesta ronda. Há uma frase por cada pista tua que a Casey acertou.',
  sentenceBandNoGreens: 'Nesta ronda não há palavras verdes para pôr numa frase.',

  // ── porque é que uma pista foi recusada ──────────────────────────────────
  clueNotSingleWord: 'a pista tem de ser uma só palavra',
  clueOnBoard: (clue) => `«${clue}» é uma palavra do tabuleiro`,
  clueTypoOf: (clue, word) => `«${clue}» pode ser um erro de digitação de «${word}»`,
  clueGlossOnBoard: (clue, word) =>
    `«${clue}» é a tradução de «${word}», que está no tabuleiro`,
  clueCompoundOfWord: (clue, word) => `«${clue}» é um composto de «${word}»`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `«${clue}» é um composto de «${gloss}», a tradução de «${word}»`,
  clueFormOfWord: (clue, word) => `«${clue}» é uma forma de «${word}»`,
  clueFormOfGloss: (clue, gloss, word) =>
    `«${clue}» é uma forma de «${gloss}», a tradução de «${word}»`,

  // ── os toques da ronda de treino e o dicionário fechado ──────────────────
  practiceClueFinal: 'Para esta última pista de treino, liga a única palavra verde que resta.',
  practiceClueMany: 'Para esta pista de treino, liga 2 ou 3 palavras verdes.',
  dictionaryClosed: 'O dicionário está fechado até isto acabar.',
}
