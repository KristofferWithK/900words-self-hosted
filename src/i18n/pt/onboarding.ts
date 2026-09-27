import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você. A Casey é «ela» e fala aqui pela primeira
 * vez — curta, calorosa, direta. Glossário: uma ronda é uma ronda, uma jogada é
 * uma jogada (o comboio é que anda), arruma-se na ronda de arrumação, e uma
 * palavra que a sobreviveu ESTÁ embrulhada. As palavras entre «» são
 * dinamarquesas e assim ficam.
 *
 * Nada aqui assume o género de quem joga: «Todos a bordo» em vez de
 * «Bem-vindo», «Bom trabalho!» em vez de «Muito bem, pronto/a».
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'alemão' : 'dinamarquês',
      countryName: german ? 'Alemanha' : 'Dinamarca',
      welcome: 'Sabias que 900 palavras podem cobrir mais de 80% da fala do dia a dia na maioria das línguas? (Toca para continuar.)',
      map: (destination) => german
        ? `Este é o nosso mapa. Vamos percorrer a Alemanha e recolher cem palavras em cada cidade. ${destination} é o destino final.`
        : `Este é o nosso mapa. Vamos percorrer a Dinamarca e recolher cem palavras em cada cidade. ${destination} é o destino final.`,
      guide: german
        ? 'Para consultar gramática ou dicas práticas de alemão, abre o Guia de viagem. Podes ler adiante quando quiseres.'
        : 'Para consultar gramática ou dicas práticas de dinamarquês, abre o Guia de viagem. Podes ler adiante quando quiseres.',
      clueField: german
        ? 'Quando for a tua vez, escreve aqui uma palavra em alemão que ligue duas ou três palavras verdes tuas.'
        : 'Quando for a tua vez, escreve aqui uma palavra em dinamarquês que ligue duas ou três palavras verdes tuas.',
      dictionary: german
        ? 'Se precisares de uma palavra em alemão, procura-a aqui. O Dicionário fecha quando enviares a pista.'
        : 'Se precisares de uma palavra em dinamarquês, procura-a aqui. O Dicionário fecha quando enviares a pista.',
      tutorialHint: 'Usa o Dicionário para traduzir a tua ideia.',
      practiceIntro: (clue, number) =>
        `A minha pista é «${clue}» para ${number}. Que palavras deste tabuleiro associas a ela? Toca em ⓘ sempre que precisares de uma tradução.`,
      practiceRationaleTime: 'Um relógio indica as horas. Um mês e uma semana são unidades de tempo.',
      practiceRationaleTimeRecovery: 'Esta pista repete a ligação ao tempo para as palavras de tempo que ainda restam.',
      lastGreen: german
        ? 'Ainda falta uma das tuas verdes. Não a consigo ver, por isso dá-me uma pista em alemão para essa última carta.'
        : 'Ainda falta uma das tuas verdes. Não a consigo ver, por isso dá-me uma pista em dinamarquês para essa última carta.',
      yourTurn: german
        ? 'A minha vez terminou. Agora é a tua vez. Dá-me uma pista em alemão que ligue 2 ou 3 cartas verdes do teu lado. Não as consigo ver, tal como tu não consegues ver a minha chave.'
        : 'A minha vez terminou. Agora é a tua vez. Dá-me uma pista em dinamarquês que ligue 2 ou 3 cartas verdes do teu lado. Não as consigo ver, tal como tu não consegues ver a minha chave.',
    }
  },
  languageEyebrow: 'Todos a bordo',
  languageHeading: 'Que língua falas?',
  languageHint: 'Toca na tua língua.',
  languageAria: (endonym) => `Usar o 900words em ${endonym}`,

  // ── O bilhete: que língua queres APRENDER ───────────────────────────────
  skip: 'Saltar',
  ticketEyebrow: 'Escolhe a tua viagem',
  ticketHeading: 'Que língua queres aprender?',
  ticketAria: (country, language) => `Bilhete: ${country}, aprender ${language}`,
  // Por cima do nome do país no bilhete. «Aprender em» pediria o artigo do
  // país («na Dinamarca»), que o bilhete não tem; um bilhete diz «Destino».
  ticketLearnIn: 'Destino',
  ticketMeta: (words, cities) => `${words} palavras · ${cities} cidades`,
  ticketHintMany: 'Toca num bilhete para escolher.',
  ticketHintOne: 'Toca no teu bilhete e partimos.',

  // ── A apresentação da Casey no Início, passo a passo ────────────────────
  introWelcome:
    'Sabias que 900 palavras podem cobrir mais de 80% da fala do dia a dia na maioria das línguas? (Toca para continuar.)',
  introMap:
    'Este é o nosso mapa. Vamos atravessar a Dinamarca de comboio, a recolher cem palavras em cada cidade. Copenhaga é o destino final.',
  introGuide:
    'Se quiseres gramática ou dinamarquês prático, abre o Guia de Viagem. Também podes ler mais à frente sempre que quiseres.',
  introPlay: 'Por agora é tudo o que precisas. Toca em Jogar e vamos recolher as primeiras palavras.',
  introBubbleAria: (line) => `${line} Continuar.`,
  introCaseyOpen: 'Abrir a Casey e ver as palavras que recolhemos',
  introCaseyContinue: 'Continuar com a Casey',
  introPlayFirst: 'Joga o teu primeiro jogo',
  introTapCasey: 'Toca na Casey',

  // ── As dicas guiadas, nos ecrãs a sério ─────────────────────────────────
  tourNext: 'Seguinte',
  tourDone: 'Vamos lá',
  tourLoose:
    'A tua coleção de palavras fica aqui. Toca numa palavra quando quiseres vê-la ou ouvi-la outra vez.',
  tourLid:
    'Esta é a coleção de tabuleiros da Casey. Um número e o nível escrito mostram a melhor tentativa do tabuleiro.',
  tourTray:
    'Abre um tabuleiro concluído para o jogar de novo. Uma repetição pode melhorar o seu melhor nível sem repor o próximo tabuleiro obrigatório.',
  tourWrapUp:
    'Aqui está o teu próximo tabuleiro obrigatório. Conclui tabuleiros para ganhar níveis. As traduções e a roda podem levar um tabuleiro resolvido até Platina.',
  mapTourHere: (city, words) =>
    `Isto é ${city}, onde estamos. Cada cidade dá ${words} palavras para levar para casa.`,
  mapTourNext: (next, _words, city) =>
    `${next} fica mais adiante na linha. Continua a melhorar os tabuleiros de ${city}. A próxima paragem está fechada por agora.`,
  homeTourArrival: (city, words) =>
    `Chegámos a ${city} para recolher as tuas primeiras ${words} palavras.`,
  homeTourMap:
    'Este é o nosso mapa. Mostra onde estamos agora e as cidades que esperam mais à frente na linha.',
  homeTourSuitcase:
    'Toca em mim sempre que quiseres abrir a mala. Mostra que palavras já conheceste, recolheste e arrumaste de vez.',
  homeTourGuide:
    'O Guia de Viagem junta gramática, dinamarquês prático e os exercícios das cidades anteriores. Podes ler mais à frente sem mover o comboio.',
  // ── A visita guiada ao jogo de treino (2026-09-18) ───────────────────────
  introGameTourKey:
    'As molduras verdes são as tuas palavras secretas. Eu nunca as vejo, tal como tu nunca vês as minhas. Cada tentativa é medida pela chave de quem deu a pista.',
  introGameTourClueField:
    'Quando for a tua vez, escreve aqui uma palavra em dinamarquês que ligue duas ou três das tuas palavras verdes.',
  introGameTourDictionary:
    'Se precisares de uma palavra em dinamarquês que não tenhas, procura-a aqui mesmo. O dicionário fecha assim que a tua pista for enviada.',
  introGameTourStepper:
    'Este número diz quantas palavras a tua pista nomeia. Sobe-o quando uma ligação realmente cobrir mais das tuas verdes.',
  translationTourBoard:
    'As tampas destas malas mostram o significado das palavras que encontrámos. Escolhe uma delas mentalmente. Não precisas de tocar numa mala primeiro.',
  translationTourInput: (language: string) =>
    `Escreve aqui a palavra em ${language} e toca no visto. Uma resposta errada não custa nada, por isso tenta outra vez.`,
  translationTourWheel:
    'Cada resposta certa acrescenta um segmento verde. Podes rodar quando quiseres, mas se parar num segmento vazio, perdes a ronda. Com a roda cheia, qualquer giro ganha.',
  wheelReadyTour:
    'A roda está toda verde, por isso este giro ganha. Toca na roda para rodar.',
  resultTourPostcards: (amount: string) =>
    `Este tabuleiro acrescentou ${amount} à tua cidade. Cada resultado mostra aqui mesmo o que ganhou.`,
  resultTourRewardNew: (rewards: string) => `Novo desta vez: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Já ganho antes, por isso não conta outra vez: ${rewards}.`,
  resultTourNoRewards: 'Desta vez este tabuleiro não deu postais. Pode acontecer, e não perdes nada.',
  resultTourWinTier: (tier: string, best: string) =>
    `Este resultado é ${tier}. O melhor deste tabuleiro até agora: ${best}.`,
  resultTourLossTier: (best: string) =>
    `Esta ronda foi perdida. Aqui, o Bronze só indica que jogaste e não conta como melhor resultado. O melhor deste tabuleiro até agora: ${best}.`,
  resultTourNoBestYet: 'ainda por definir',
  resultTourSentence:
    'Esta é uma revisão opcional. Mostra uma palavra deste tabuleiro numa frase. Não é outro teste.',
  resultTourNoReview:
    'Desta vez não há nenhuma frase para rever. Não faz mal. Rever é sempre opcional.',
  homeTourPostcards:
    'Este é o teu total de postais nesta cidade. Cada postal que um tabuleiro ganha é somado aqui.',
  homeTourCollection:
    'Toca em mim para abrir a mala. Mostro-te as palavras que recolhemos e os teus tabuleiros.',

  // ── A ronda de treino: as justificações escritas da Casey ───────────────
  practiceRationaleDrink: 'Água, café e leite são coisas que se bebem.',
  practiceRationaleHome: 'Uma casa é um lar.',
  practiceRationaleRecovery:
    'Isto repete a ligação concreta com beber, para as cartas de bebidas que ainda restam.',

  // ── A ronda de treino: os comentários da Casey em jogo ──────────────────
  practiceIntro:
    'A minha pista é «drikke» para 3. Que palavras deste tabuleiro se ligam a ela? Toca em ⓘ sempre que uma tradução ajudar.',
  guessGreenMore: (word) =>
    `«${word}» é verde na minha chave. Continua a adivinhar, ou para enquanto estamos a ganhar.`,
  guessGreenEnd: (word) => `«${word}» é verde na minha chave. Isso encerra a minha pista.`,
  guessGreenEndMine: (word) =>
    `«${word}» é verde na minha chave. Isso encerra a minha pista. Os teus verdes aparecem quando for a tua vez. Esta pista usou a minha chave.`,
  guessYoursNotMine: (word) =>
    `«${word}» é um dos teus verdes, mas não é verde na minha chave. Esta pista usa a minha chave, por isso a carta continua em jogo para a tua.`,
  guessMiss: (word) => `«${word}» não é verde na minha chave, por isso a minha pista acaba aqui.`,
  guessMissMine: (word) =>
    `«${word}» não é verde na minha chave, por isso a minha pista acaba aqui. Os teus verdes aparecem quando for a tua vez. Esta pista usou a minha chave.`,
  firstClue: (clue) =>
    `Olá! Que palavras deste tabuleiro consegues ligar a «${clue}»? Podes tocar no ⓘ das palavras para ver a tradução. Quando quiseres, toca numa palavra e confirma.`,
  clueFor: (clue, number) =>
    `A minha pista é «${clue}» para ${number}. Toca em qualquer palavra que te faça lembrar dela.`,
  lastGreenLeft:
    'Ainda falta um dos teus verdes. Eu não o vejo, por isso dá-me uma pista em dinamarquês para essa última carta.',
  yourTurn:
    'A minha jogada acabou. Agora é a tua vez. Dá-me uma pista em dinamarquês que ligue 2 ou 3 cartas verdes do teu lado. Eu não as vejo, tal como tu não vês a minha chave.',
  yourFirstClue: (clue, number, tokens) =>
    `A tua pista é «${clue}» para ${number}. Os ${tokens} pontos lá em cima são as fichas da ronda, partilhadas por nós. Cada pista, tua ou minha, gasta uma. Vou pensar alto aqui em baixo.`,
  yourClue: (clue, number) =>
    `A tua pista é «${clue}» para ${number}. As minhas tentativas usam agora a tua chave. Vou pensar alto aqui em baixo.`,
  practiceWon: 'Todos os verdes encontrados. Ganhámos! Os tabuleiros completos não serão tão fáceis, mas todas as palavras que conhecemos contam.',
  practiceLost: 'Esta ronda escapou-nos, mas todas as palavras que conhecemos contam na mesma.',
  findingAClue: 'É a minha vez. Estou à procura de uma pista.',
  practiceTranslation:
    'Tabuleiro resolvido! Agora é hora de traduzir: cada resposta em dinamarquês enche um segmento da roda. Podes rodar já, mas uma roda cheia garante verde. Um tabuleiro resolvido ainda pode chegar aqui a Platina.',
  practiceWheelReady:
    'A roda está cheia. Roda para cair no verde. Nos tabuleiros normais, é assim que o teu resultado pode chegar a Platina.',
  practiceFinish:
    'Treino concluído. Esta ronda não dá postais nem nível da cidade. Nos tabuleiros normais, resolver, traduzir e rodar dá um nível. Repete um tabuleiro concluído para melhorar o melhor resultado.',
  demoEndTitle: "Esse foi o teu primeiro tabuleiro completo.",
  demoEndLine: "Na app continuo a jogar contigo, tabuleiro após tabuleiro, e guardo cada palavra que recolhes.",
  demoAppStore: "Descarrega o 900words na App Store",
  demoAppStoreSoon: "O 900words chega em breve à App Store.",
  demoPlayAgain: "Jogar outra vez",
  demoRestingTitle: "A Casey está a descansar",
  demoRestingBody: "Hoje muita gente jogou comigo, por isso preciso de descansar. Volta amanhã ou joga comigo na app.",
  demoCheckFailed: "Não conseguimos confirmar que és uma pessoa. Recarrega a página e tenta outra vez.",
  playFullRound: 'Joga o teu primeiro tabuleiro completo',
  returnToParkedGame: 'Volta à tua partida',
}
