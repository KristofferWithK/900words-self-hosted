import type { Catalogue } from '../en'

/**
 * Español neutro. Tú, nunca usted. Casey es "ella". Signos de apertura ¿ y ¡.
 *
 * Nada aquí supone el género de quien juega: se prefiere una construcción que
 * no necesite concordancia antes que una que la necesite.
 *
 * Un matiz del verbo: en español «adivinar» suele implicar acertar, así que
 * cuando el resultado se dice justo después («— carta neutral») Casey «dice»
 * o «elige» una palabra en vez de «adivinarla». El sustantivo del glosario es
 * siempre «intento».
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Tu progreso está a salvo",
  legacyRetiredBody: "Una ronda anterior no pudo continuar después de esta actualización. Conservas lo aprendido y las postales guardadas. Continúa con el siguiente tablero pendiente.",
  phaseGiveClue: 'Dale una pista a Casey',
  phaseCaseyGuessing: 'Casey está adivinando',
  phaseCaseyClue: 'Casey prepara una pista',
  phaseYourGuess: 'Te toca adivinar',
  phaseLastChance: 'Última oportunidad: no quedan pistas',
  phaseRoundOver: 'Ronda terminada',
  phasePackTheBoard: 'A la maleta',

  announceCaseyGuess: (word, result) => `Casey ha dicho ${word}: ${result}.`,
  resultCorrect: 'correcto',
  resultNeutral: 'carta neutral',
  announceCaseyThinking: 'Casey está pensando.',

  skip: 'Omitir',
  homeAria: 'Inicio',
  dealNewWordsAria: 'Repartir palabras nuevas',
  hideTranslationsAria: 'Ocultar traducciones',
  showTranslationsAria:
    'Mostrar todas las traducciones: cuenta como buscar cada palabra sin resolver',

  errorRetry: 'Reintentar',
  errorCaseySettings: 'Ajustes de Casey',
  practiceNote: 'Prototipo experimental sin agente. Esto no es Casey ni el juego normal.',

  studyTitle: 'Estudia el tablero',
  studyHint:
    'Ahora ves todas las traducciones. Al empezar se ocultan, y cada toque busca una palabra.',
  studyStart: 'Empezar la ronda',

  cardYourTarget: ', tu objetivo',
  cardFound: ', encontrada',
  cardNeutralBoth: ', neutral para los dos lados',
  cardNeutralPlayer: ', neutral con tus pistas',
  cardNeutralCasey: ', neutral con las pistas de Casey',
  cardUnpacked: ', sin meter en la maleta',
  cardTranslationRevealed: ', traducción mostrada',
  cardNotYetPacked: (language) =>
    `, todavía sin meter en la maleta. Toca para escribirla en ${language}`,
  cardNotYoursToWrap: ', todavía no puedes envolverla',
  cardTapToHear: '. Toca para escuchar',
  lookUpAria: (word) => `Buscar ${word}`,

  cluePlaceholder: 'Tu pista',
  clueFieldAria: (language) => `Tu pista de una palabra, en ${language}`,
  fewerWordsAria: 'menos palabras',
  moreWordsAria: 'más palabras',
  wordCountAria: (n) => `${n} palabras`,
  giveClue: 'Dar pista',
  giveItAnyway: 'Darla igual',
  askingCasey: 'Preguntando a Casey…',
  firstClueHint: (language) =>
    `Una palabra en ${language}. ¿No se te ocurre nada? El diccionario de al lado traduce.`,
  tutorialClueHint:
    'Interpreto las pistas en danés. ¿Dudas? Pruébala. El diccionario puede ayudarte.',
  wrapPlayerKeyHint:
    'Tu borde verde ha vuelto. Es tu clave secreta. Casey no la ve.',
  looksEnglishFull: (word, language) =>
    `«${word}» parece inglés. Tócala para verla en ${language}, o dala igual y Casey la comprobará.`,
  looksEnglishShort: 'parece el significado de una carta. Tócala, o dala igual',

  caseysClueLabel: 'La pista de Casey',
  lookUpInDictionaryAria: (word) => `Buscar «${word}» en el diccionario`,
  guessesLeft: (n) => (n === 1 ? 'queda 1 intento' : `quedan ${n} intentos`),
  guessWord: (word) => `Adivinar «${word}»`,
  cancel: 'Cancelar',
  stopKeepWhatWeHave: 'Parar y quedarnos con lo que hay',
  guessPrompt: 'Toca una palabra que creas que Casey quiere decir.',
  firstGuessHint: 'Ahora cuenta la clave de Casey. Toca una palabra a la que apunte su pista.',
  wrapCaseyKeyHint:
    'La clave de Casey es secreta. Adivina a qué apunta su pista. Ahora cuentan sus verdes.',
  tutorialLookupHint: 'Toca la ⓘ junto a una palabra para ver su traducción.',

  suddenDeathRule: 'Nombra cartas verdes para ganar. Cualquier otra cosa acaba la ronda.',
  nameWord: (word) => `Nombrar «${word}»`,
  giveUpRound: 'Abandonar la ronda',

  // ── la rueda de traducción (la última oportunidad, nueva 2026-09-16) ──────
  wheelLede: (language) => `La rueda decide la ronda. Escribe las palabras de nuevo en ${language} para llenarla y luego gírala. El verde gana.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Escribe en ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Escribe en ${language} la traducción de cualquiera de estas palabras: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', traducción escrita' : ', traducción pendiente',
  wheelRetryLine: 'No es esa. Inténtalo de nuevo. No pierdes nada.',
  wheelSubmit: 'Preparar',
  wheelSpinAria: 'Girar la rueda',
  wheelSpinning: 'Girando…',
  wheelWonLine: '¡Verde! La ronda está ganada.',
  wheelMissLine: 'La rueda paró en una maleta sin preparar.',
  phaseTranslateChallenge: 'Hora de traducir',
  settlementFailed: 'Todavía no se ha podido guardar tu resultado. Conserva esta ronda e inténtalo de nuevo.',
  settlementSaving: 'Guardando tu resultado…',
  guidanceTranslationBody: (language) => `Las maletas muestran ahora qué significan tus palabras. Escribe cada una de nuevo en ${language} para llenar la rueda y gírala. Si cae en verde, ganas.`,
  guidanceStartTranslation: 'Empezar a traducir',
  phaseTranslateWheel: 'La rueda: el giro decide la ronda',

  // ── el panel de llegada de la última oportunidad ──────────────────────────
  /** La frase de la ventana emergente cuando se acaban las pistas y empieza el reto de la rueda (propietario, 17-09-2026) — con la misma voz que wheelLede. */
  guidanceLastChanceWheel:
    'Te has quedado sin pistas, así que este es el final. Traduce las palabras recogidas para llenar la rueda y luego gírala. El verde gana la ronda.',

  caseyIsThinking: 'Casey está pensando…',
  offlineCaseyIsThinking: 'Casey sin conexión está pensando. Tarda más.',
  offlineRoundPrompt: 'No hay internet. ¿Jugar el resto de esta ronda con Casey sin conexión? Es más lenta.',
  playOfflineButton: 'Jugar sin conexión',
  hurryCaseyTitle: 'Toca para que Casey se dé prisa',
  hurryCaseyHint: 'Toca aquí para que Casey se dé prisa.',
  caseyGuessedWord: (word) => `Casey ha dicho «${word}».`,
  caseyChoosingWord: 'Casey está eligiendo una palabra…',
  caseyChoosingWhether: 'Casey está decidiendo si sigue…',
  guessGotOne: '. ¡Acierto!',
  guessNeutral: '. Carta neutral.',

  turnTokensAria: (given, total, left) =>
    `${given} de ${total} pistas dadas, quedan ${left}.`,
  cluesGivenCount: (given, total) => `${given}/${total} pistas dadas`,

  leaveTitle: '¿Salir de esta ronda?',
  leaveBody:
    'Pausar deja el tablero tal como está. Cancelar lo descarta, y Jugar empezará una ronda nueva.',
  leaveKeepPlaying: 'Seguir jugando',
  leavePause: 'Pausar la partida',
  leaveCancelRound: 'Cancelar la ronda',

  guidanceCaseyTitle: 'La primera pista de Casey',
  guidancePlayerTitle: '¡Te toca!',
  guidanceWordCount: (n) => (n === 1 ? '1 palabra' : `${n} palabras`),
  guidanceCaseyBody: 'Encuentra las palabras que conectan con la pista de Casey.',
  guidancePlayerBody:
    'Escribe una palabra en danés que conecte 1–4 de tus palabras verdes. Usa el diccionario si no sabes la palabra en danés.',
  guidanceHideReminder: 'No volver a recordármelo',
  guidanceStartGuessing: 'Empezar a adivinar',
  guidanceWriteClue: 'Escribir una pista',
  guidanceLastChanceTitle: 'Última oportunidad',
  guidanceLastChanceBody:
    'Se te han acabado las pistas. Pero todavía puedes ganar. Sigue adivinando con las pistas anteriores. Pero un solo fallo y pierdes.',
  guidanceKeepNaming: 'Seguir nombrando',
  guidancePackingTitle: 'Primero, el tablero a la maleta',
  guidancePackingBody:
    'Traduce el tablero del inglés al danés, carta por carta. Cuando estén todas traducidas, o no puedas seguir, empieza la ronda.',
  guidanceStartPacking: 'Empezar a hacer la maleta',

  dictionaryPlaceholder: 'Diccionario',
  dictionaryFieldAria: (language) => `Palabra para traducir, en ${language} o en inglés`,
  dictHitAria: (entry) => `${entry}: abrir el diccionario`,
  approximateFrom: (term) => ` (de ${term})`,
  onTheBoardNote: ' (en el tablero)',
  translateFailed: 'No se ha podido traducir.',
  lookupsUsed: 'No te quedan búsquedas.',
  dictionaryPracticeOnly: 'Práctica: solo las 900 palabras.',
  sayAgainAria: (word) => `Escuchar ${word} otra vez`,
  saySlowlyAria: (word) => `Escuchar ${word} despacio`,
  sayExampleAria: 'Escuchar la frase de ejemplo otra vez',
  sayExampleSlowlyAria: 'Escuchar la frase de ejemplo despacio',
  recordingsUnavailableNote: ' · sin grabación normal ni lenta',
  recordingFailedNote: ' · la grabación no se ha cargado',
  close: 'Cerrar',

  caseysCalls: 'Las decisiones de Casey',
  turnCount: (n) => (n === 1 ? '1 turno' : `${n} turnos`),
  logHint:
    'Toca la ⚑ en cualquier jugada de Casey que fuera una mala decisión. Ella ve las que marcas.',
  logYou: 'Tú',
  logFor: 'para',
  flagClueLabel: (clue) => `La pista de Casey «${clue}»`,
  flagGuessLabel: (word) => `El intento de Casey «${word}»`,
  flagOnAria: (label) => `${label}: lleva la marca de mala decisión. Toca para quitarla`,
  flagOffAria: (label) => `Marcar ${label} como mala decisión`,
  guessCorrectSr: ', correcto',
  guessNeutralSr: ', carta neutral',
  confidenceSure: (percent) => `${percent} % de seguridad`,
  noGuessMade: 'sin intento',

  ledgerEmpty:
    'Nada todavía. Aquí aparece una línea por cada pista de Casey en cuanto terminas de adivinar con ella.',
  ledgerArmHeading: 'fuente',
  ledgerCluesHeading: 'pistas',
  ledgerFoundHeading: 'encontradas',
  ledgerRefusedHeading: 'rechazadas',
  ledgerHitsTitle: (hits, asked) => `${hits} de ${asked} palabras pedidas`,
  ledgerRefusedTitle: 'Cuántas veces se descartó la primera respuesta de esta fuente y se volvió a preguntar',
  ledgerExplainer:
    '“encontradas” es la parte de las palabras que pedía una pista que realmente destapaste. “rechazadas” es cuántas veces se descartó la primera respuesta del modelo y se volvió a preguntar; las fuentes sin conexión no se pueden rechazar.',
  ledgerClear: 'Vaciar el registro',

  outcomeWonTitle: '¡Enhorabuena!',
  outcomeWonSub: '¡Has ganado una postal!',
  outcomeLostTitle: 'La próxima vez',
  outcomeGivenUpSub: 'Ronda abandonada. La conexión estaba ahí.',
  outcomeWheelMissSub: 'La rueda paró en una maleta que nunca preparaste.',
  /** El final ganador de la rueda (propietario, 18-09-2026): paró en verde. */
  outcomeWheelWinSub: 'La rueda paró en verde. La ronda es tuya.',
  outcomeWheelSpentSub: 'La ficha se usó, y las pistas aun así se agotaron.',

  resultLesson: 'Hay una nueva lección opcional lista en la Guía.', resultOpenGrammar: 'Abrir Gramática en la Guía', resultOpenSurvival: 'Abrir Supervivencia en la Guía', resultBackToResult: 'Volver al resultado',

  roundStatsAria: 'Lo que ha dado esta ronda',
  newWordsLabel: (n) => (n === 1 ? 'palabra nueva' : 'palabras nuevas'),
  collectedForCasey: 'conseguidas para Casey',
  wrapStatsAria: 'Lo que ha metido en la maleta esta ronda de equipaje',
  wrappedForGood: (named) => (named ? 'envueltas para siempre:' : 'envueltas para siempre'),
  stayedLabel: 'sin envolver',

  // ── adónde ha llevado la ronda el viaje: el lector de la ronda de equipaje ─
  // La cifra va en su propio span delante: «13 envueltas en Ribe · 87 faltan
  // para el tren a Kolding».
  wrapJourneyHeading: 'El viaje',
  wrapJourneyAria: 'El viaje tras esta ronda de equipaje',
  wrappedInCity: (n, city) => `${n === 1 ? 'envuelta' : 'envueltas'} en ${city}`,
  wrapJourneyTrainReady: (city) => `el tren a ${city} está listo`,
  wrapJourneyOver: 'el viaje ha terminado',
  wrapJourneyToGo: (n, city) => `${n === 1 ? 'falta' : 'faltan'} para el tren${city ? ` a ${city}` : ''}`,

  wrapUpUnlocked:
    'Ronda de equipaje desbloqueada: la ronda que mete las palabras conseguidas en la maleta para siempre. Abre la maleta para gastarla.',
  wrapUpEarned: (banked) =>
    `Ronda de equipaje ganada: ${banked} en reserva. Gasta una en la maleta.`,
  postcardEarned: (banked) => `+1 postal de traducción · ${banked} disponible`,
  wrapUpBankFull: (cap) =>
    `La reserva está llena: la maleta solo guarda ${cap} rondas de equipaje. Gasta una y las victorias volverán a contar.`,
  winsToWrapUp: (n) =>
    n === 1
      ? '1 victoria más para una ronda de equipaje'
      : `${n} victorias más para una ronda de equipaje`,
  wrapResultFirst:
    'Las cartas verdes que metas en la maleta quedan envueltas para siempre, ganes o pierdas la ronda.',
  wrapResultNothing:
    'Nada envuelto: una palabra se envuelve cuando la has traducido Y ha salido verde, ganes o pierdas.',
  wrapResultLost:
    'Perder no te ha costado nada: se envuelve lo que has metido en la maleta y ha salido verde, ganes o pierdas.',

  playAgain: 'Jugar otra vez',
  playNextGame: 'Siguiente partida',
  home: 'Inicio',
  postWrapChoicesAria: 'Opciones tras la ronda de equipaje',
  postWrapHeading: '¿Y ahora qué?',
  postWrapGrammar: 'Gramática',
  postWrapSurvival: 'Supervivencia',
  // Gramática y Supervivencia: las dos.
  postWrapBoth: 'Las dos',
  postWrapBothNote: 'Primero la gramática y, de ahí, directo al diálogo.',
  grammarNote: (city, topic, lessons) =>
    `Gramática de ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lecciones.` : '.'}`,
  survivalNextNote: (number, total, title) =>
    `Diálogo ${number} de ${total}: ${title}. Primero las frases, luego la conversación.`,
  survivalAllReadTitle: 'Ya has leído los cuatro diálogos.',
  survivalLockedTitle: 'Completa una ronda de equipaje para desbloquear el siguiente diálogo.',
  survivalLockedNote: 'El siguiente diálogo se desbloquea al terminar una ronda de equipaje.',

  sentenceReviewAria: 'Repaso de frases',
  hearItInDanish: 'Escuchar en danés',
  legendGreenLabel: 'Verde',
  legendGreenMeaning: ': la palabra que has encontrado.',
  legendUnderlinedLabel: 'Subrayado',
  legendUnderlinedMeaning: (city) => `: las palabras pequeñas de ${city}.`,
  legendTapToHear: 'Toca para escuchar.',

  reviewTitle: 'Repaso del tablero',
  reviewProgress: (current, total) => `${current} de ${total}`,
  reviewOptional: 'Opcional · una frase por pista',
  reviewListen: 'Escuchar',
  reviewListenSlowlyAria: 'Escuchar despacio',
  reviewNoRecordings: 'No hay grabación normal ni lenta.',
  reviewRecordingUnavailable: 'Grabación no disponible.',
  reviewSoundOff: 'El sonido está apagado o se ha parado la reproducción.',
  reviewShowTranslation: 'Mostrar traducción',
  reviewHideTranslation: 'Ocultar traducción',
  reviewAboutWord: 'Sobre esta palabra',
  reviewHighFrequencyWord: 'Palabra frecuente:',
  reviewNoNotes: 'No hay notas para esta palabra.',
  reviewNextSentence: 'Siguiente frase',
  // «adivinó» aquí sí es telico: la frase se ofrece solo cuando Casey acertó.
  reviewNothingThisRound:
    'Nada que repasar en esta ronda. Hay una frase por cada pista tuya que Casey adivinó.',
  sentenceBandNoGreens: 'Esta ronda no hay palabras verdes para poner en una frase.',

  // ── por qué se ha rechazado una pista ────────────────────────────────────
  clueNotSingleWord: 'La pista tiene que ser una sola palabra',
  clueOnBoard: (clue) => `«${clue}» está en el tablero`,
  clueTypoOf: (clue, word) => `«${clue}» podría ser una errata de «${word}»`,
  clueGlossOnBoard: (clue, word) =>
    `«${clue}» es la traducción al inglés de «${word}», que está en el tablero`,
  clueCompoundOfWord: (clue, word) => `«${clue}» es un compuesto de «${word}»`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `«${clue}» es un compuesto de «${gloss}», la traducción de «${word}»`,
  clueFormOfWord: (clue, word) => `«${clue}» es una forma de «${word}»`,
  clueFormOfGloss: (clue, gloss, word) =>
    `«${clue}» es una forma de «${gloss}», la traducción de «${word}»`,

  // ── los avisos de la ronda de práctica y el diccionario cerrado ───────────
  practiceClueFinal: 'Con esta última pista de práctica, conecta la única carta verde que queda.',
  practiceClueMany: 'Con esta pista de práctica, conecta 2 o 3 cartas verdes.',
  dictionaryClosed: 'El diccionario está cerrado hasta que acabes.',
}
