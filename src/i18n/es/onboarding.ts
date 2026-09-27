import type { Catalogue } from '../en'

export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'alemán' : 'danés',
      countryName: german ? 'Alemania' : 'Dinamarca',
      welcome: '¿Sabías que 900 palabras pueden cubrir más del 80 % del habla cotidiana en la mayoría de los idiomas? (Toca para continuar.)',
      map: (destination) => german
        ? `Este es nuestro mapa. Recorreremos Alemania y reuniremos cien palabras en cada ciudad. ${destination} es nuestro destino final.`
        : `Este es nuestro mapa. Recorreremos Dinamarca y reuniremos cien palabras en cada ciudad. ${destination} es nuestro destino final.`,
      guide: german
        ? 'Si quieres consultar gramática o consejos prácticos para aprender alemán, abre la Guía de viaje. Puedes leer lo que viene cuando quieras.'
        : 'Si quieres consultar gramática o consejos prácticos para aprender danés, abre la Guía de viaje. Puedes leer lo que viene cuando quieras.',
      clueField: german
        ? 'Cuando te toque, escribe aquí una palabra en alemán que conecte dos o tres palabras verdes tuyas.'
        : 'Cuando te toque, escribe aquí una palabra en danés que conecte dos o tres palabras verdes tuyas.',
      dictionary: german
        ? 'Si necesitas una palabra en alemán, búscala aquí. El Diccionario se cierra cuando envías la pista.'
        : 'Si necesitas una palabra en danés, búscala aquí. El Diccionario se cierra cuando envías la pista.',
      tutorialHint: 'Usa el Diccionario para traducir tu idea.',
      practiceIntro: (clue, number) =>
        `Mi pista es «${clue}» para ${number}. ¿Qué palabras de este tablero relacionas con ella? Toca ⓘ cuando necesites una traducción.`,
      practiceRationaleTime: 'Un reloj marca la hora. Un mes y una semana son unidades de tiempo.',
      practiceRationaleTimeRecovery: 'Esta pista vuelve a conectar el tiempo con las palabras de tiempo que queden.',
      lastGreen: german
        ? 'Aún queda una de tus verdes. No puedo verla, así que dame una pista en alemán para esa última tarjeta.'
        : 'Aún queda una de tus verdes. No puedo verla, así que dame una pista en danés para esa última tarjeta.',
      yourTurn: german
        ? 'Mi turno ha terminado. Ahora te toca a ti. Dame una pista en alemán que conecte 2 o 3 tarjetas verdes de tu lado. No puedo verlas, igual que tú no puedes ver mi clave.'
        : 'Mi turno ha terminado. Ahora te toca a ti. Dame una pista en danés que conecte 2 o 3 tarjetas verdes de tu lado. No puedo verlas, igual que tú no puedes ver mi clave.',
    }
  },
  languageEyebrow: 'Te damos la bienvenida',
  languageHeading: '¿Qué idioma hablas?',
  languageHint: 'Toca tu idioma.',
  languageAria: (endonym) => `Usar 900words en ${endonym}`,

  // ── El billete: qué idioma quieres APRENDER ─────────────────────────────
  skip: 'Omitir',
  ticketEyebrow: 'Elige tu viaje',
  ticketHeading: '¿Qué idioma quieres aprender?',
  ticketAria: (country, language) => `Viaja por ${country}, aprende ${language}`,
  ticketLearnIn: 'Aprende en',
  ticketMeta: (words, cities) => `${words} palabras · ${cities} ciudades`,
  ticketHintMany: 'Toca un billete para elegir.',
  ticketHintOne: 'Toca tu billete y nos vamos.',

  // ── La presentación de Casey en Inicio, paso a paso ─────────────────────
  introWelcome:
    '¿Sabías que 900 palabras pueden cubrir más del 80 % del habla cotidiana en la mayoría de los idiomas? (Toca para continuar.)',
  introMap:
    'Este es nuestro mapa. Viajaremos por Dinamarca y conseguiremos cien palabras en cada ciudad. Copenhague es nuestro destino final.',
  introGuide:
    'Si alguna vez quieres gramática o danés práctico, abre la Guía de viaje. También puedes leer por adelantado siempre que quieras.',
  introPlay:
    'Eso es todo lo que necesitas por ahora. Toca Jugar y vamos a conseguir nuestras primeras palabras.',
  introBubbleAria: (line) => `${line} Continuar.`,
  introCaseyOpen: 'Abrir a Casey y ver las palabras que hemos conseguido',
  introCaseyContinue: 'Continuar con Casey',
  introPlayFirst: 'Juega tu primera partida',
  introTapCasey: 'Toca a Casey',

  // ── Los avisos sobre las pantallas reales ───────────────────────────────
  tourNext: 'Siguiente',
  tourDone: 'En marcha',
  tourLoose:
    'Aquí está tu colección de palabras. Toca una palabra cuando quieras verla u oírla otra vez.',
  tourLid:
    'Esta es la colección de tableros de Casey. El número y el nivel escrito muestran el mejor intento de cada tablero.',
  tourTray:
    'Abre cualquier tablero terminado para repetirlo. Repetirlo puede mejorar su mejor nivel sin reiniciar tu siguiente tablero obligatorio.',
  tourWrapUp:
    'Aquí está tu siguiente tablero obligatorio. Termina tableros para ganar niveles. Las traducciones y la rueda pueden subir un tablero resuelto hasta Platino.',
  mapTourHere: (city, words) =>
    `Esta es ${city}, donde estamos. Cada ciudad tiene ${words} palabras para llevarte a casa.`,
  mapTourNext: (next, _words, city) =>
    `${next} está más adelante en la ruta. Sigue mejorando los tableros de ${city}. La próxima parada está cerrada por ahora.`,
  homeTourArrival: (city, words) =>
    `Hemos llegado a ${city} para conseguir tus primeras ${words} palabras.`,
  homeTourMap:
    'Este es nuestro mapa. Muestra dónde estamos ahora y las ciudades que esperan más adelante en la ruta.',
  homeTourSuitcase:
    'Tócame cuando quieras abrir la maleta. Muestra qué palabras has visto, cuáles has conseguido y cuáles ya están envueltas para siempre.',
  homeTourGuide:
    'La Guía de viaje reúne la gramática, el danés práctico y la práctica de las ciudades anteriores. Puedes leer por adelantado sin mover el tren.',
  // ── La visita guiada del juego de práctica (2026-09-18) ──────────────────
  introGameTourKey:
    'Los marcos verdes son tus palabras secretas. Yo nunca los veo, igual que tú nunca ves los míos. Cada intento se juzga con la clave de quien dio la pista.',
  introGameTourClueField:
    'Cuando te toque, escribe aquí una palabra en danés que conecte dos o tres de tus palabras verdes.',
  introGameTourDictionary:
    'Si necesitas una palabra en danés que no tengas, búscala aquí mismo. El diccionario se cierra cuando envías tu pista.',
  introGameTourStepper:
    'Este número dice a cuántas palabras nombra tu pista. Súbelo cuando una conexión de verdad cubra más de tus verdes.',
  translationTourBoard:
    'Las tapas de estas maletas muestran el significado de las palabras que hemos encontrado. Elige una mentalmente. No hace falta tocar ninguna maleta antes.',
  translationTourInput: (language: string) =>
    `Escribe aquí la palabra en ${language} y pulsa el ✓. Una respuesta equivocada no cuesta nada, así que inténtalo otra vez.`,
  translationTourWheel:
    'Cada respuesta correcta añade un segmento verde. Puedes girar cuando quieras, pero si cae en un segmento vacío, pierdes la ronda. Con la rueda llena, cualquier giro gana.',
  wheelReadyTour:
    'La rueda ya está toda verde, así que este giro gana. Toca la rueda para girarla.',
  resultTourPostcards: (amount: string) =>
    `Este tablero ha sumado ${amount} a tu ciudad. Cada resultado muestra aquí mismo lo que ha ganado.`,
  resultTourRewardNew: (rewards: string) => `Nuevo esta vez: ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Ya conseguido antes, así que no cuenta otra vez: ${rewards}.`,
  resultTourNoRewards: 'Esta vez este tablero no ha ganado postales. Puede pasar, y no pierdes nada.',
  resultTourWinTier: (tier: string, best: string) =>
    `Este resultado es ${tier}. La mejor marca de este tablero, por ahora: ${best}.`,
  resultTourLossTier: (best: string) =>
    `Esta ronda se ha perdido. Aquí el Bronce solo indica que has jugado y no es una mejor marca. La mejor marca de este tablero, por ahora: ${best}.`,
  resultTourNoBestYet: 'aún sin fijar',
  resultTourSentence:
    'Este es un repaso opcional. Muestra una palabra de este tablero en una frase. No es otra prueba.',
  resultTourNoReview:
    'Esta vez no hay ninguna frase para repasar. No pasa nada. Repasar siempre es opcional.',
  homeTourPostcards:
    'Este es tu total de postales en esta ciudad. Cada postal que gana un tablero se suma aquí.',
  homeTourCollection:
    'Tócame para abrir la maleta. Te enseñaré las palabras que hemos reunido y tus tableros.',

  // ── La ronda de práctica: las razones escritas de Casey ─────────────────
  practiceRationaleDrink: 'El agua, el café y la leche son cosas que se beben.',
  practiceRationaleHome: 'Una casa es un hogar.',
  practiceRationaleRecovery:
    'Vuelvo a la conexión de las bebidas para las cartas de bebida que quedan.',

  // ── La ronda de práctica: el comentario en directo de Casey ─────────────
  practiceIntro:
    'Mi pista es «drikke» para 3. ¿Qué palabras de este tablero conectan con ella? Toca ⓘ cuando quieras ver una traducción.',
  guessGreenMore: (word) =>
    `«${word}» es verde en mi clave. Puedes seguir adivinando o parar ahora que vamos ganando.`,
  guessGreenEnd: (word) => `«${word}» es verde en mi clave. Con eso acaba mi pista.`,
  guessGreenEndMine: (word) =>
    `«${word}» es verde en mi clave. Con eso acaba mi pista. Tus verdes aparecerán cuando sea tu turno. Esta pista usaba mi clave.`,
  guessYoursNotMine: (word) =>
    `«${word}» es una de tus verdes, pero no es verde en mi clave. Esta pista usa mi clave, así que la carta sigue ahí para la tuya.`,
  guessMiss: (word) => `«${word}» no es verde en mi clave, así que ahí acaba mi pista.`,
  guessMissMine: (word) =>
    `«${word}» no es verde en mi clave, así que ahí acaba mi pista. Tus verdes aparecerán cuando sea tu turno. Esta pista usaba mi clave.`,
  firstClue: (clue) =>
    `Oye, ¿qué palabras de este tablero conectas con «${clue}»? Puedes tocar la ⓘ de una palabra para ver su traducción. Cuando quieras, toca una palabra y confírmala.`,
  clueFor: (clue, number) =>
    `Mi pista es «${clue}» para ${number}. Toca cualquier palabra que te haga pensar en ella.`,
  lastGreenLeft:
    'Aún queda una de tus verdes. Yo no la veo, así que dame una pista en danés para esa última carta.',
  yourTurn:
    'Aquí acaba mi turno. Ahora te toca a ti. Dame una pista en danés que conecte 2 o 3 cartas verdes de tu lado. Yo no las veo, igual que tú no ves mi clave.',
  yourFirstClue: (clue, number, tokens) =>
    `Tu pista es «${clue}» para ${number}. Los ${tokens} puntos de arriba son nuestras fichas de pista compartidas. Cada pista, tuya o mía, gasta una. Voy pensando en voz alta aquí abajo.`,
  yourClue: (clue, number) =>
    `Tu pista es «${clue}» para ${number}. Ahora mis intentos usan tu clave. Voy pensando en voz alta aquí abajo.`,
  practiceWon: 'Todas las verdes encontradas. ¡Hemos ganado! Los tableros completos no serán tan fáciles, pero cada palabra que veamos sigue contando.',
  practiceLost: 'Esa ronda se nos ha escapado, pero cada palabra que hemos visto cuenta.',
  findingAClue: 'Me toca. Estoy buscando una pista.',
  practiceTranslation:
    '¡Tablero resuelto! Ahora toca traducir: cada respuesta en danés llena un segmento de la rueda. Puedes girar ya, pero una rueda llena garantiza verde. Un tablero resuelto aún puede llegar a Platino aquí.',
  practiceWheelReady:
    'La rueda está llena. Gírala para caer en verde. En los tableros normales, así es como tu resultado puede llegar a Platino.',
  practiceFinish:
    'Práctica terminada. Esta ronda no da postales ni nivel de ciudad. En los tableros normales, resolver, traducir y girar da un nivel. Repite un tablero terminado para mejorar su mejor marca.',
  demoEndTitle: "Ese fue tu primer tablero completo.",
  demoEndLine: "En la app sigo jugando contigo, tablero tras tablero, y guardo cada palabra que reúnes.",
  demoAppStore: "Descarga 900words en el App Store",
  demoAppStoreSoon: "900words llegará pronto al App Store.",
  demoPlayAgain: "Jugar otra vez",
  demoRestingTitle: "Casey está descansando",
  demoRestingBody: "Hoy jugó mucha gente conmigo, así que necesito descansar. Vuelve mañana o juega conmigo en la app.",
  demoCheckFailed: "No pudimos comprobar que eres una persona. Vuelve a cargar la página e inténtalo de nuevo.",
  playFullRound: 'Juega tu primer tablero completo',
  returnToParkedGame: 'Vuelve a tu partida',
}
