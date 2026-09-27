import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você; a Casey é «ela». As Definições explicam,
 * não representam - a Casey só fala na pergunta do lembrete e nas notificações
 * do fim do ficheiro.
 *
 * Vocabulário de Portugal: «Definições» (não «Configurações»), «ficheiro»,
 * «telemóvel», «descarregar», «ligação», «partilhar», «eliminar», «repor».
 */
export const settings: Catalogue['settings'] = {
  // ── o ecrã ───────────────────────────────────────────────────────────────
  title: 'Definições',
  backAria: 'Voltar',

  // ── a língua em que a app fala ───────────────────────────────────────────
  uiLanguageLabel: 'A tua língua',
  uiLanguageHelp:
    'A língua em que a app fala contigo. Mudar recarrega a app; a tua coleção e a tua viagem mantêm-se.',

  // ── a língua que estás a aprender ────────────────────────────────────────
  learnerLanguageLabel: 'Língua a aprender',
  learnerLanguageHelp:
    'Cada língua tem a sua própria viagem. Volta para continuar de onde paraste.',

  // ── o cérebro da Casey ───────────────────────────────────────────────────
  caseyBrainHeading: 'Cérebro da Casey',
  caseyServerNote:
    'A Casey joga a partir do servidor do próprio 900words. Não há nada a configurar; o botão abaixo verifica se ela responde.',
  normalOllamaCaseyLabel: 'Casey Ollama normal',
  normalOllamaCaseyDetail: 'gpt-oss 120B · pistas e tentativas',
  normalOllamaCaseyAria: 'Usar a Casey Ollama normal',
  normalCaseyOn: 'A Casey normal está ligada',
  normalCaseyOff: 'A Casey normal está desligada',
  prototypeOn: 'O protótipo sem agente está ligado',
  customCaseyOn: 'O serviço da Casey personalizado está ligado',
  normalCaseyDetail: 'O Ollama joga e traduz. A Gemma está desligada.',
  gemmaModeDetail:
    'A Gemma 4 E4B trata das pistas e das tentativas. As falhas do dicionário continuam a usar o Ollama.',
  prototypeDetail: 'Este modo de teste local não é a Casey, o Ollama nem a Gemma.',
  customCaseyDetail:
    'Está selecionado um Worker da Casey personalizado. As falhas do dicionário online usam esse serviço.',


  baseUrlLabel: 'URL base',
  // O caminho /v1 fica num <code> entre as duas metades, sem espaço próprio -
  // por isso as metades trazem o espaço com elas.
  baseUrlHelpBefore:
    'Definido pelo botão acima, ou escreve o endereço do teu próprio Worker da Casey mais ',
  baseUrlHelpAfter:
    '. Tem de começar por https://, para que nada do teu jogo viaje em claro.',
  baseUrlUnusable: 'Esse URL base não pode ser usado.',

  // ── o modelo no dispositivo ──────────────────────────────────────────────
  gemmaUnavailableNote: 'O modo sem ligação funciona na app do 900words para iPhone.',
  gemmaReady: (size) => `A Casey sem ligação está pronta (${size} neste iPhone).`,
  gemmaRemoveConfirm: 'Remover a Casey sem ligação deste iPhone? Podes voltar a descarregá-la mais tarde.',
  gemmaRemoveButton: 'Remover a Casey sem ligação',
  gemmaProgressAria: 'Progresso da transferência da Casey sem ligação',
  gemmaDownloading: (percent) => `${percent}% - mantém o 900words aberto e em Wi-Fi.`,
  gemmaCancelDownloadButton: 'Cancelar descarga',
  gemmaDownloadNote: (size) =>
    `A Casey sem ligação é uma transferência de ${size}. Usa Wi-Fi e mantém o 900words aberto até terminar.`,
  gemmaDownloadButton: 'Descarregar a Casey sem ligação',
  gemmaDownloadFailed: 'A descarga falhou.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Modo sem ligação',
  offlineModeExperimentalTag: 'Experimental',
  offlineModeLabel: 'Jogar sem internet',
  offlineModeHelp:
    'A Casey normal joga a partir do servidor do 900words. Com o modo sem ligação, podes acabar uma ronda com a Casey sem ligação neste iPhone quando não há internet. Ela é mais lenta.',
  offlineModeAria: 'Modo sem ligação',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `O modo sem ligação é experimental e ainda está a ser melhorado.\n\nO modo sem ligação descarrega a Casey sem ligação (${size}) para este iPhone. Usa Wi-Fi e mantém o 900words aberto até a transferência terminar.\n\nA Casey sem ligação joga mais devagar do que a Casey normal.\n\nPrecisa de um iPhone mais recente: ${iphones}.${lowMemory ? '\n\nEste iPhone tem menos memória do que esses modelos. Pode não funcionar nele.' : ''}\n\nDescarregar agora?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'A IA da Casey',
  ossCaseyHelp: 'Este 900words foi compilado por ti. A Casey precisa de uma IA para jogar: a tua própria chave de IA ou o Gemma neste iPhone.',
  ownKeyOption: 'A tua própria chave de IA',
  ownKeyHelp: 'Qualquer serviço compatível com OpenAI. A tua chave fica guardada só neste dispositivo e só é enviada para o endereço abaixo.',
  ownKeyAddressLabel: 'Endereço do serviço',
  ownKeyModelLabel: 'Modelo',
  ownKeyKeyLabel: 'Chave de API',
  ownKeyAnswered: 'O teu serviço de IA respondeu.',
  gemmaOption: 'Gemma neste iPhone',
  gemmaOptionHelp: 'A Casey joga neste iPhone, sem internet e sem chave. É mais lenta.',
  serverOption: 'O teu próprio servidor da Casey',
  serverOptionHelp: 'Um Worker da Casey que tu próprio implementaste (vê o README).',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Este 900words joga com a Casey no teu iPhone: sem conta e sem chave. É uma transferência única (${size}). Usa Wi-Fi e mantém o 900words aberto até terminar.\n\nPrecisa de um iPhone mais recente: ${iphones}.${lowMemory ? '\n\nEste iPhone tem menos memória do que esses modelos. Pode não funcionar nele.' : ''}\n\nTambém podes adicionar a tua própria chave de IA nas Definições.\n\nDescarregar a Casey agora?`,

  // ── o teste de ligação ───────────────────────────────────────────────────
  testRunning: 'A testar…',
  testGemmaButton: 'Testar Casey local',
  testConnectionButton: 'Testar ligação',
  connectionFailed: 'A ligação falhou.',
  gemmaAnswered: 'A Gemma respondeu neste iPhone.',
  normalCaseyAnswered: 'A Casey Ollama normal respondeu.',
  customCaseyAnswered: 'O serviço da Casey personalizado respondeu.',


  // ── o jogo ───────────────────────────────────────────────────────────────
  gameHeading: 'Jogo',
  soundLabel: 'Dizer as palavras em voz alta quando tocas nelas',
  soundHelp:
    'Nada toca sozinho - cada som segue um toque, incluindo as tentativas da Casey.',
  lookupExampleLabel: 'Reproduzir a frase de exemplo ao consultar uma tradução',
  lookupExampleHelp: 'Desativado, a consulta usa a definição de áudio das palavras.',
  replayIntroButton: 'Rever a introdução',
  replayIntroHelp: 'A apresentação da Casey, mais uma vez. Nada muda no teu progresso.',

  // ── as ferramentas de viagem do teste ────────────────────────────────────
  playtestHeading: 'Teste TestFlight',
  playtestTravelLabel: 'Deixa-me saltar cidades e apanhar qualquer comboio',




  // ── o interruptor do lembrete diário ─────────────────────────────────────
  reminderHeading: 'Lembrete diário',
  reminderWebNote:
    'Os lembretes diários estão disponíveis na app 900words para iPhone. Este navegador nunca pede permissão para notificações.',
  reminderDeniedNote:
    'As notificações do iPhone estão desligadas para o 900words. Liga-as nas Definições do iPhone e volta aqui para agendar o lembrete diário da Casey.',
  reminderOpenSettingsButton: 'Abrir notificações do iPhone',
  reminderOnNote: (time) => `A Casey aparece às ${time} neste iPhone.`,
  reminderTurningOff: 'A desligar…',
  reminderTurnOffButton: 'Desligar lembrete diário',
  reminderOffNote: (time) =>
    `A Casey pode enviar um lembrete local às ${time}. A mensagem é feita neste iPhone a partir da contagem de dias completos; nenhum token do dispositivo nem histórico de aprendizagem sai daqui.`,
  reminderAsking: 'A perguntar ao iPhone…',
  reminderTurnOnButton: 'Ligar lembrete diário',

  // ── a tua coleção: a cópia de segurança ──────────────────────────────────
  collectionHeading: 'Cópia de segurança',
  backupIntro:
    'A tua coleção vive só neste telemóvel. Uma cópia de segurança é um ficheiro pequeno - guarda uma num lugar seguro antes de mudares de telemóvel ou limpares os dados do navegador. A tua chave de API nunca vai lá dentro.',
  backupSaveButton: 'Guardar cópia',
  backupRestoreButton: 'Restaurar de ficheiro',
  backupShared: 'Cópia entregue ao teu telemóvel.',
  backupDownloaded: 'Cópia descarregada.',
  backupHideText: 'Ocultar texto',
  backupShowText: 'Sem seletor de ficheiros? Usa texto',
  backupCopyButton: 'Copiar a coleção',
  backupCopied: 'Cópia copiada para a área de transferência.',
  backupPasteLabel: 'Cola aqui uma cópia',
  backupReadButton: 'Ler',
  backupHoldsHeading: 'Esta cópia contém',
  backupCollectedAfter: (met) => `palavras recolhidas, ${met} conhecidas no total`,
  backupWrappedAfter: (city) => `embrulhadas · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'ronda jogada' : 'rondas jogadas'} · guardada a ${savedOn}`,
  backupMergeButton: 'Juntar',
  backupReplaceButton: 'Substituir tudo',
  backupCancelButton: 'Cancelar',
  backupChoiceNote:
    'Juntar guarda o melhor dos dois registos para cada palavra, por isso nunca te custa um verde. Substituir deita fora o progresso deste dispositivo.',
  backupReplaceConfirm:
    'Substituir tudo neste dispositivo pela cópia? Perdes o que aprendeste desde que ela foi feita.',
  backupMerged: (collected) =>
    `Tudo junto. Não perdeste nada - entraram ${collected} palavras recolhidas.`,
  backupRestored: (collected, wrapped) =>
    `Restauradas ${collected} palavras recolhidas e ${wrapped} embrulhadas.`,

  // ── o registo de pistas do dono ──────────────────────────────────────────
  clueLedgerHeading: 'Pistas da Casey',

  // ── dados ────────────────────────────────────────────────────────────────
  dataHeading: 'Dados',
  usageStatsLabel: 'Estatísticas de uso anónimas',
  usageStatsHelp:
    'Só contagens - rondas jogadas, onde os jogadores param, se a Casey ou uma gravação falhou. Sem palavras, sem pistas, sem qualquer identificador.',
  usageStatsAria: 'Partilhar estatísticas de uso anónimas',
  dataSharingPrivateTitle: 'Jogo privado',
  dataSharingPrivateDetail: 'Nenhum dado opcional do jogo sai deste telemóvel.',
  dataSharingDiagnosticsTitle: 'Diagnóstico anónimo',
  dataSharingDiagnosticsDetail:
    'Partilha contagens e resultados das rondas, nunca as tuas palavras ou pistas.',
  dataSharingLearningTitle: 'Diagnóstico + exemplos para a Casey aprender',
  dataSharingLearningDetail:
    'Partilha também pistas, tentativas e resultados para a Casey melhorar.',
  dataSharingAria: 'Partilha de dados',
  dataSharingCloseAria: 'Fechar sem escolher',
  dataSharingPromptTitle: 'Como deve o 900words usar o teu jogo?',
  dataSharingPromptNote:
    'Nada está pré-selecionado. Qualquer escolha mantém o jogo todo aberto, e podes mudá-la nas Definições.',
  dataSharingSettingsNote:
    'Sem escolha, vale «Jogo privado». Isto controla apenas eventos opcionais; a Casey e a verificação passageira do tabuleiro seguinte continuam a processar o mínimo de dados necessário para jogar.',
  dataSharingDeleting: 'A eliminar dados partilhados…',
  dataSharingDeleteButton: 'Eliminar dados partilhados',
  resetConfirm: (language) =>
    `Repor todo o progresso de aprendizagem, a tua viagem de ${language} e o jogo atual?`,
  resetButton: 'Repor progresso',

  // ── o rodapé com a versão ────────────────────────────────────────────────
  buildStamp: (stamp) => `Versão ${stamp}`,
  testFlightBuild: (build) => `Versão TestFlight ${build} · `,
  keyboardReadoutNote: 'Leitura do teclado ligada. Toca cinco vezes na versão para a esconder.',
  stateOn: 'ligado',
  stateOff: 'desligado',
  composerRideWaiting: 'desligado (à espera do documento)',
  composerRideButton: (state) => `Caixa da pista acompanha: ${state}`,
  trainStoryButton: (state) => `História do comboio: ${state}`,


  updateChecking: 'A verificar…',
  checkUpdatesButton: 'Ver atualizações',
  updateCurrent: 'Está atualizado.',
  updateFound:
    'Uma versão mais recente está a ser descarregada - fecha e volta a abrir a app para a usar.',
  updateCheckFailed: 'Não foi possível verificar. Fecha e volta a abrir a app.',

  // ── a única pergunta da Casey sobre o lembrete diário ────────────────────
  reminderPromptCloseAria: 'Agora não',
  reminderPromptTitle: 'Três jogos na mala!',
  reminderPromptBody: (time) =>
    `Isso é um dia completo. Queres que te lembre amanhã, por volta das ${time}? Só um toquezinho à tarde, e podes desligá-lo nas Definições quando quiseres.`,
  reminderPromptAccept: 'Sim, lembra-me',
  reminderPromptAsking: 'A perguntar ao teu iPhone…',
  // Sem «obrigado/obrigada»: não assumimos o género de quem joga.
  reminderPromptDecline: 'Não, deixa estar',

  // ── o lembrete diário em si, escrito no telemóvel ────────────────────────
  reminderDoneTitle: 'A Casey já fez a mala por hoje',
  reminderDoneBody: 'Três jogos bem guardados na mala. Continuamos amanhã.',
  reminderOneLeftTitle: 'Um joguinho com a Casey?',
  reminderStreakBody: (days) =>
    `Mantém a tua sequência de ${days} ${days === 1 ? 'dia' : 'dias'} com mais um jogo hoje.`,
  reminderOneLeftBody: 'Mais um jogo e os três de hoje ficam na mala.',
  reminderSeatTitle: 'A Casey guardou-te lugar',
  reminderSeatBody: (games) =>
    `${games} ${games === 1 ? 'joguinho hoje chega' : 'joguinhos hoje chegam'} para começar uma sequência.`,

  // ── o chip do fornecedor ─────────────────────────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "prévia",
  learnerLanguagePreviewHelp: "O alemão é uma prévia: o mapa e o Guia de viagem já estão disponíveis, mas o jogo de palavras ainda não. As lições ainda não foram revistas por uma pessoa de língua materna alemã.",
  playtestTravelHelp: "Para avançar, abre o mapa, escolhe uma paragem mais à frente e toca em Viajar mais à frente. Nenhuma palavra é embrulhada e não ganhas progresso de aprendizagem. Desativa esta opção para voltares a testar as condições normais da viagem.",
}
