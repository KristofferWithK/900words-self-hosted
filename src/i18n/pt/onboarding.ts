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
      welcome: 'Sabias que 900 palavras podem cobrir mais de 80% da fala do dia a dia na maioria das línguas?',
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
  ticketComingSoon: 'Em breve',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Os cartões de vocabulário são aborrecidos, por isso jogamos dois jogos: um passeio pela cidade para juntar palavras, e um enigma de palavras num café.',
  introExplore: (city) => `Vamos explorar ${city} e ver se encontramos um café.`,
  introGo: 'Vamos lá',
  walkEndFound: 'Anda outra vez, ou volta ao Início e joga o café que encontrámos.',
  walkEndNotFound: 'Anda outra vez para procurar um café, ou volta ao Início.',

  // ── As dicas guiadas, nos ecrãs a sério ─────────────────────────────────
  tourNext: 'Seguinte',
  tourDone: 'Vamos lá',
  tourLoose: 'As palavras que conhecemos esperam aqui em cima. Cada anel enche um terço por cada marca: uma foto num passeio, uma tentativa com a minha pista e uma pista tua.',
  tourLid: 'Com três marcas, a palavra fica guardada. As palavras guardadas vão para a mala, e esta linha conta-as.',
  tourTray: 'Este é o cartão de selos da cidade. Cada café que jogas recebe aqui o seu selo. Um círculo tracejado é um café encontrado mas ainda por jogar, e ? é um café ainda por encontrar.',
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
  resultTourRewardNew: (rewards: string) => `Novo desta vez: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Já ganho antes, por isso não conta outra vez: ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Este enigma valeu ${tier}. O melhor selo do café até agora é ${best}.`,
  resultTourLossTier: (best: string) =>
    `Este enigma foi perdido. Um enigma perdido também dá um selo de bronze. Um enigma ganho dá prata, ouro ou platina. O melhor deste café até agora é ${best}.`,
  resultTourCityPercent: (city) =>
    `Cada selo de café conta para a medalha de ${city}: bronze a partir de 25%, prata de 50%, ouro de 75% e platina aos 100%.`,
  resultTourNoBestYet: 'ainda por definir',
  resultTourSentence:
    'Esta é uma revisão opcional. Mostra uma palavra deste tabuleiro numa frase. Não é outro teste.',
  resultTourNoReview:
    'Desta vez não há nenhuma frase para rever. Não faz mal. Rever é sempre opcional.',
  homeTourSightseeing: 'O passeio pela cidade é a volta que acabámos de dar. Cada passeio junta palavras, e quanto mais andas, mais cafés encontras.',
  homeTourCafe: (name) =>
    name ? `O nosso primeiro café é o ${name}. Toca em Enigma do café para te sentares e jogares.` : 'O nosso primeiro café está à espera. Toca em Enigma do café para te sentares e jogares.',
  homeTourStamp: 'Cada café que jogas recebe um selo. Juntos formam a medalha desta cidade, e aqui vês até onde chegaste.',
  homeTourCollection: 'Toca em mim para abrir a mala. Mostro-te as palavras que juntámos e o selo do café.',

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
    `Bem-vindo ao café! Esta primeira mesa é um treino curto. Que palavras deste tabuleiro consegues ligar a «${clue}»? Toca no ⓘ de uma palavra para ver a tradução, depois toca numa palavra e confirma.`,
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
  practiceWon: 'Todas as verdes encontradas. Ganhámos! Os enigmas do café não vão ser tão fáceis, mas cada palavra que encontramos conta.',
  practiceLost: 'Esta ronda escapou-nos, mas todas as palavras que conhecemos contam na mesma.',
  findingAClue: 'É a minha vez. Estou à procura de uma pista.',
  practiceTranslation:
    'Tabuleiro resolvido! Agora é hora de traduzir: cada resposta em dinamarquês enche um segmento da roda. Podes rodar já, mas uma roda cheia garante verde. Um tabuleiro resolvido ainda pode chegar aqui a Platina.',
  practiceWheelReady:
    'A roda está cheia. Roda para cair no verde. Nos tabuleiros normais, é assim que o teu resultado pode chegar a Platina.',
  practiceFinish:
    'Treino concluído. Esta mesa não dá selo. Num enigma do café, resolver, traduzir e girar a roda dão ao café o seu selo. Podes voltar a jogar um café para melhorar o selo.',
  demoEndTitle: "Esse foi o teu primeiro tabuleiro completo.",
  demoEndLine: "Na app continuo a jogar contigo, tabuleiro após tabuleiro, e guardo cada palavra que recolhes.",
  demoAppStore: "Descarrega o 900words na App Store",
  demoAppStoreSoon: "O 900words chega em breve à App Store.",
  demoPlayAgain: "Jogar outra vez",
  demoRestingTitle: "A Casey está a descansar",
  demoRestingBody: "Hoje muita gente jogou comigo, por isso preciso de descansar. Volta amanhã ou joga comigo na app.",
  demoCheckFailed: "Não conseguimos confirmar que és uma pessoa. Recarrega a página e tenta outra vez.",
  playFullRound: 'Jogar o enigma do café',
}
