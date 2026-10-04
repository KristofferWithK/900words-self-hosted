import type { Catalogue } from '../en'

export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Inicio ──────────────────────────────────────────────────────────────
  settingsAria: 'Ajustes',
  openMapAria: 'Abrir el mapa',
  homeMapAria: (stop, stops, city) => `Parada ${stop} de ${stops}: ${city}`,
  needsPass: 'Para el próximo tren necesitas un abono de viaje',
  wrappedWord: 'envueltas',
  collectedCount: (collected) => `${collected} conseguidas`,
  journeyDone: (city) => `Has hecho la última maleta en ${city}.`,
  momentumLine: 'Juega 3 tableros al día y podrás reunir todas las palabras en 90 días.',
  dailyPlayedAria: (outcome) => `Reto diario: jugado hoy (${outcome})`,
  dailyAria: 'Reto diario: un tablero compartido por día',
  play: 'Jugar',
  previewHeading: 'Todavía sin juego de palabras',
  previewNote:
    'El mapa y la guía de viaje ya están. Los tableros, las pistas y el audio aún no existen.',
  previewGuideCta: 'Abrir la guía de viaje',
  continueGame: 'Seguir la partida',
  continueWrapUp: 'Seguir la ronda de equipaje',
  continueReview: 'Seguir el repaso',
  continuePrimary: 'Continuar tablero', continueReplay: 'Continuar repetición', returnToPrimary: 'Volver a tu tablero',
  viewResult: 'Ver resultado', improveBoards: 'Mejorar tus tableros', postcardsEarned: 'postales ganadas',
  postcardsRemaining: (remaining) => `${remaining} postal${remaining === 1 ? '' : 'es'} para viajar`, postcardReadiness: (earned, remaining) => `${earned} postales ganadas; ${remaining} para viajar.`,
  readyToTravel: 'Listo para viajar', nextStopNotReleased: (city) => `Listo para viajar. ${city} aún no está disponible.`, cityMedalInProgress: 'aún no conseguida', cityMedal: (tier) => `Medalla de la ciudad: ${tier}`,
  backToCity: (city) => `Volver a ${city}`,

  // ── El mapa ─────────────────────────────────────────────────────────────
  back: 'Atrás',
  journeyTitle: 'El viaje',
  mapAria: (country, stop, stops, city) =>
    `Mapa de ${country}. Parada ${stop} de ${stops}: ${city}.`,
  stopAria: (city, stop, status) => `${city}, parada ${stop}, ${status}`,
  statusVisited: 'visitada',
  statusHere: 'estás aquí',
  statusNotReached: 'aún por llegar',
  statusAhead: 'más adelante',
  stopOf: (stop, stops) => `Parada ${stop} de ${stops}`,
  arrivedOn: (date) => `llegada el ${date}`,
  previousStopAria: 'Parada anterior',
  nextStopAria: 'Parada siguiente',
  wordsWaiting: (words, city) =>
    `${words} palabras te esperan. Llega a ${city} para desbloquearlas.`,
  lookAhead: 'Mirar adelante',
  travelAhead: 'Viajar adelante',
  enableTravelAhead: 'Activar Viajar adelante',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} envueltas · ${collected} conseguidas · ${discovered} descubiertas`,
  suitcasePacked: 'maleta hecha',
  lineClosedNote: 'Línea cerrada por obras. Toca el tren para ver el aviso.',
  travelBackTo: (city) => `Volver → ${city}`,
  travelOnTo: (city) => `Seguir viaje → ${city}`,
  trainToClosed: (city) => `Tren a ${city}: línea cerrada`,
  getPassFor: (city) => `Obtener un abono de viaje para ${city}`,
  mapCredit: 'Kort · datos del mapa: Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Volver al mapa',

  // ── El tren, en las dos pantallas ───────────────────────────────────────
  trainJourneyOver: 'La maleta está hecha. El viaje ha terminado.',
  trainReady: (city) => `La maleta está hecha. El tren a ${city} está listo.`,
  wordsToFinish: (words) =>
    `Te ${words === 1 ? 'falta' : 'faltan'} ${words} ${words === 1 ? 'palabra envuelta' : 'palabras envueltas'} para terminar el viaje.`,
  wordsToTrain: (words, city) =>
    `Te ${words === 1 ? 'falta' : 'faltan'} ${words} ${words === 1 ? 'palabra envuelta' : 'palabras envueltas'} para tomar el tren a ${city}.`,
  boardTrain: (city) => `Subir al tren a ${city}`,

  // ── Llegar ──────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Otra vez aquí. Tus ${words} palabras de esta ciudad siguen en la maleta. Vuelve a jugarlas o sigue viaje cuando quieras.`,
  arrivalNew: (words) =>
    `${words} palabras nuevas por descubrir. Casey está abierta, esperándolas.`,
  getStarted: 'Empezar',
  seeTheMap: 'Ver el mapa',

  // ── La maleta ───────────────────────────────────────────────────────────
  suitcaseTitle: 'La maleta',
  filterAria: 'Filtrar la maleta por ciudad',
  filterAll: 'Todas',
  pagerPreviousAria: (band) => `${band}, página anterior`,
  pagerNextAria: (band) => `${band}, página siguiente`,
  looseLabel: (words) => `Aún por ahí: ${words}`,
  looseEmpty: 'Nada suelto. Todas las palabras de aquí están en la maleta.',
  lidEmpty: 'Tres marcas completan una palabra: una foto, un intento y una pista.',
  trayLabel: (words, goal) => `Envueltas: ${words} de ${goal}`,
  trayEmpty:
    'Nada en la bandeja todavía. Las rondas de equipaje guardan aquí las palabras para siempre.',
  undiscoveredAria: 'Palabra sin descubrir',
  wrapUpWords: 'Envolver palabras',
  wrapUpBankedAria: (banked) => `Envolver palabras: ${banked} en reserva`,
  postcardBalance: (banked) => `Postales · ${banked}`,
  postcardHelp: '¿Necesitas la respuesta? Usa una postal.',
  packingAnswerShown: 'Respuesta mostrada; pulsa Meter en la maleta.',
  packingNoPostcards: 'Gana una ronda normal para conseguir una postal.',
  packingFirstPostcardHint: (language) => `Escribe la palabra en ${language} para guardarla. Una postal la revela.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Muestra esta respuesta otra vez gratis.' : state === 'select' ? 'Elige primero una carta sin guardar.' : state === 'empty' ? 'Gana una ronda normal para conseguir una postal de traducción.' : `Gasta una postal para revelar la respuesta en ${language} de esta carta.`,
  packingPostcardAria: (shown, banked) => shown ? 'Mostrar traducción gratis otra vez' : `Usar postal de traducción: ${banked} disponibles`,
  packingPostcardShowAnswer: 'Mostrar respuesta',
  usePostcard: 'Usar postal',
  wrapUpContinueAria: 'Seguir la ronda de equipaje en curso',
  hintWrapUpWaiting: 'Ya hay una ronda de equipaje en curso. Retómala donde la dejaste.',
  hintCollectFirst: (city) =>
    `Consigue primero una palabra en ${city}, una verde en cada sentido, y la ronda de equipaje tendrá algo que meter en la maleta.`,
  hintFirstWrapUp: (wins) => `Gana ${wins} rondas y tendrás tu primera ronda de equipaje.`,
  hintMoreWins: (wins) =>
    `${wins} ${wins === 1 ? 'victoria más' : 'victorias más'} para una ronda de equipaje.`,
  hintPacksRange: (collected, city) =>
    `${collected} conseguidas en ${city}. Una ronda de equipaje mete en la maleta de 13 a 15, según su clave.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} conseguidas en ${city}. La próxima ronda de equipaje puede meter en la maleta hasta ${cap}, según su clave.`,

  // ── El mostrador de equipaje, al empezar una ronda de equipaje ──────────
  packWord: (word) => `Mete «${word}» en la maleta`,
  packTheBoard: 'A la maleta',
  packCount: (packed, packable) => `(${packed} de ${packable})`,
  startEarlyWarning: (remaining) =>
    `Empezar con ${remaining} sin meter. Se quedan en inglés y no se pueden envolver esta ronda`,
  startEarly: (remaining) => `Empezar con ${remaining}`,
  tapEnglishCard: 'Toca una carta en inglés',
  theWordFor: (language, word) => `${word} en ${language}`,
  tapEnglishCardFirst: 'Toca primero una carta en inglés',
  pack: 'A la maleta',
  packMiss: 'No es esa: el fallo queda anotado. Sigue probando.',
  packFirstTime:
    'Escribe en danés para meterla en la maleta. Si empiezas antes, las cartas se quedan en inglés y sin envolver.',
  packRecall: 'El diccionario está cerrado. Esto va de memoria.',
  packTapAndType: (language) => `Toca una carta en inglés y escríbela en ${language}.`,

  // ── El abono de viaje ───────────────────────────────────────────────────
  passBackAria: 'Volver al mapa',
  passTitle: 'Próximos trenes',
  passKicker: 'Tus dos primeras ciudades son gratis.',
  passHeading: 'Un abono de viaje para el resto de Dinamarca',
  passIntro:
    'Por desgracia, el transporte público en Dinamarca no es gratis. Si quieres subir a los próximos trenes, necesitas un abono de viaje.',
  passOptionsAria: 'Opciones de abono de viaje',
  passMonthly: 'Abono de viaje mensual',
  passMonthlyHelp: 'Sigue viajando mientras tu abono de viaje esté activo.',
  passLifetime: 'Abono de viaje de por vida',
  passLifetimeHelp: 'Un solo abono de viaje para todos los viajes que publiquemos.',
  passReady: 'Tu abono de viaje está listo: ya puedes subir al próximo tren.',
  passRestore: 'Restaurar compras',
  passRedeem: 'Canjear un código de la App Store',
  passKindness: 'Aprender no debería depender del dinero.',
  passReviewBefore: 'Escribe una reseña en la App Store, haz una captura y envíala a',
  passReviewAfter:
    'para recibir un código de abono de viaje de 6 meses. Tu reseña puede ser buena o mala, según lo que te parezca la app.',

  // ── Mejora por límite diario ─────────────────────────────────────────────
  dailyLimitKicker: 'Gratis tienes dos paseos y dos puzles del café al día.',
  dailyLimitRunsKicker: 'Hoy ya has salido a caminar dos veces.',
  dailyLimitPuzzlesKicker: 'Hoy ya has jugado dos puzles del café.',
  dailyLimitBothKicker: 'Hoy ya has salido a caminar dos veces y has jugado dos puzles del café.',
  dailyLimitPuzzlesLeft: (n: number) => (n === 1 ? 'Hoy aún puedes jugar 1 puzle del café.' : `Hoy aún puedes jugar ${n} puzles del café.`),
  dailyLimitRunsLeft: (n: number) => (n === 1 ? 'Hoy aún puedes salir a caminar 1 vez.' : `Hoy aún puedes salir a caminar ${n} veces.`),
  dailyLimitHeading: 'Sigue jugando con Casey',
  dailyLimitBody: 'Vuelve mañana o desbloquea paseos y puzles del café ilimitados.',
  dailyLimitOptionsAria: 'Opciones para jugar sin límite',
  dailyLimitMonthly: 'Mensual',
  dailyLimitMonthlyHelp: 'Se renueva cada mes hasta que canceles la suscripción.',
  dailyLimitLifetime: 'Un solo pago',
  dailyLimitLifetimeHelp: 'Partidas ilimitadas, sin suscripción.',
  dailyLimitUnavailable: 'No disponible',
  dailyLimitCloseAria: 'Cerrar el diálogo de mejora',
  dailyLimitRestore: 'Restaurar compras',
  dailyLimitDismiss: 'Quizá mañana',
  dailyLimitDisclosure: 'Apple proporciona los precios y confirma las compras. Gestiona o cancela la suscripción en tu cuenta de Apple.',
  dailyLimitDisclosurePlay: 'Google Play proporciona los precios y confirma las compras. Gestiona o cancela la suscripción en la app Play Store.',
  purchaseTerms: 'Términos de uso',
  purchasePrivacy: 'Política de privacidad',
  passThanksHeading: 'Gracias por apoyar el desarrollo de 900words',
  passThanksBody: 'Ya tienes juego ilimitado.',
  passThanksContinue: 'Seguir jugando',

  // ── La parada de idioma opcional ────────────────────────────────────────
  stopKicker: 'Parada de idioma opcional',
  stopKindGrammar: 'Práctica de gramática',
  stopKindSituation: 'Una situación breve',
  stopKindExit: 'Prueba de preparación opcional',
  stopKindReview: 'Repaso pendiente',
  stopFocus: 'Tu próximo tema de idioma',
  stopNote:
    'Esta parada se guarda aparte de tu maleta. Nunca cambia qué palabras puedes meter en la maleta ni si el tren puede salir.',
  stopAuthoring:
    'Las preguntas en danés y su puntuación aún se están escribiendo con el contenido del curso. Déjala para más tarde o guárdala en tu guía; ningún intento provisional cuenta como prueba de aprendizaje.',
  stopContinue: 'Continuar',
  stopLater: 'Más tarde',
  stopSkip: 'Omitir esta parada',
  stopStart: 'Empezar',
  stopOpen: 'Parada de idioma',

  // ── la línea cerrada ─────────────────────────────────────────────────────
  trainClosedLabel: (city) => `El tren a ${city} todavía no circula. La línea está en obras`,
  trainClosedTitle: 'La línea está en obras',
  trainClosedBody: (city, here) =>
    `El tren a ${city} todavía no circula. Hay obras en la línea. ` +
    `Volverá a circular pronto, y te lo diremos aquí en cuanto pase. ` +
    `Hasta entonces tienes ${here} para ti: cada tablero, cada ronda de equipaje y tu racha.`,
  trainReopenedTitle: (city) => `El tren a ${city} vuelve a circular`,
  trainReopenedBody:
    'La línea está abierta. Tu maleta está hecha y Casey está en el andén: sube cuando quieras.',
  // ── café world Home (CW-10) ──────────────────────────────────────────────
  cafePuzzle: 'Puzle del café',
  sightseeingNote: 'encuentra cafés nuevos',
  sightseeingAsk: '¿En qué quieres fijarte?',
  wordsWalkNote: '¿Qué significa? Fotografía la palabra correcta y encuentra cafés nuevos.',
  articlesWalkNote: (ask, lanes) =>
    lanes === 2 ? `${ask} Toma el camino de la izquierda o el de la derecha.` : `${ask} Cada artículo tiene su propio carril.`,
  trainSheetTitle: (city) => `El tren a ${city}`,
  trainSheetWords: (city, total, board, connecting) =>
    connecting > 0 ? `${city}: ${total} palabras (${board} en los tableros, ${connecting} de enlace)` : `${city}: ${total} palabras`,
  trainSheetCollected: (collected, total) => `Coleccionadas: ${collected} de ${total}`,
  trainSheetRule: 'La carrera es la única forma de subir al tren.',
  cityStampAria: (city, percent) => `${city}: ${percent} de los sellos de los cafés.`,
  cafeNotFoundNote: 'encuentra antes un café',
  cafeNotFoundLine: 'Primero encuentra un café en Turismo.',
  // ── café world suitcase (CW-11): marks, the lid and the stamp card ───────
  lidLegend: 'Un tercio por una foto, un intento y una pista',
  markPhoto: 'foto',
  markGuess: 'intento',
  markClue: 'pista',
  markPhotoDays: (days) => (days === 1 ? 'una foto en 1 día' : `fotos en ${days} días`),
  markAria: (word, earned, total, marks) =>
    marks ? `${word}, ${earned} de ${total}: ${marks}` : `${word}, ${earned} de ${total}`,
  connectingWord: 'Palabra de enlace',
  connectingWordRule: 'No tiene tarjeta. La consigues con fotos en tres días distintos.',
  stampCardTitle: (city) => `Tarjeta de sellos de ${city}`,
  stampCardLine: (percent, goal, stamped, cafes) =>
    [percent, goal, `${stamped} de ${cafes} cafés`].filter(Boolean).join(' · '),
  stampCardGoal: (tier, percent) => `${tier} desde ${percent}`,
  stampFound: 'Encontrado',
  stampNotFound: 'Sin encontrar',
  stampCafeNumber: (place) => `Café ${place}`,
  stampCellStamped: (cafe, stamp) => `${cafe}: ${stamp}`,
  stampCellFound: (cafe) => `${cafe}: encontrado, aún sin jugar`,
  stampCellNotFound: (place) => `Café ${place}: aún sin encontrar`,
  stampNextCafe: (cafe) => `Siguiente café: ${cafe}`,
  stampNextCafeUnfound: 'Encuentra el siguiente café en Turismo.',
  stampAllPlayed: 'Has jugado todos los cafés. Toca uno para volver a jugarlo.',
}
