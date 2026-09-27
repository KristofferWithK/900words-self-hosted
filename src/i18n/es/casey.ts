import type { Catalogue } from '../en'

/**
 * Casey es «ella» (UL12). Tú, nunca usted. Frases cortas: viven en un bocadillo
 * sobre un teléfono de 360 píxeles de ancho.
 *
 * Algunos valores llevan un espacio al principio o al final a propósito: son
 * las dos mitades de una frase que envuelve un <strong> o un <code>.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'Cuando adivinas, cuentan las verdes de Casey: su clave, no la tuya.',
  tipCollectBothWays:
    'Consigues una palabra al darle pista Y adivinarla: una verde en cada sentido.',
  tipWrapToKeep:
    'Las palabras conseguidas aún pueden romperse por el camino. Envuélvelas para quedártelas.',
  tipEarnWrapUp:
    'Tres rondas ganadas dan una ronda de equipaje. Guarda hasta tres y gasta una cuando tengas muchas palabras conseguidas: mete en la maleta hasta quince.',

  tipTapCaseyForCase:
    'Toca a Casey para abrir la maleta. Cada palabra que consigues viaja aquí dentro.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `En una ronda de equipaje las cartas empiezan en inglés. Escríbelas en ${language} para meterlas en la maleta.`,
  tipWrapUpSkipAllowed:
    'Puedes saltarte una carta en una ronda de equipaje, pero esa ronda ya no se envuelve.',
  tipLastChance:
    'Quedarte sin pistas no es quedarte fuera: en la última oportunidad puedes seguir nombrando palabras.',
  tipLookUpMidRound: (language) =>
    `Busca una palabra a mitad de ronda desde la casilla de la pista: escribes en inglés y sale en ${language}.`,
  tipWrapCityOpensRoad: 'Envuelve las cien palabras de una ciudad y se abre el camino.',

  wordOfTheDay: (word, meaning) => `Palabra del día: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Una palabra a vigilar: ${word} (${meaning}). Ya te ha pillado ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `Esta la dominas: ${word} (${meaning}). Ya ${greens}× en verde.`,
  personalCluedTogether: (a, b, times) =>
    `Tú y yo conectamos con ${a} y ${b}: tus pistas las encontraron juntas ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `Tu pista favorita es «${clue}»: la has dado ${times}×.`,
  personalGames: (played, won) =>
    `Nuestras partidas juntas: ${played}. Nuestras victorias: ${won}.`,

  notAnsweredBubble: 'Todavía no he respondido. Toca aquí para probar la conexión →',
  notAnsweredAria: 'Casey todavía no ha respondido. Abre Ajustes y prueba la conexión',
  bubbleAria: (line) => `Casey dice: ${line} Toca para ver otro consejo.`,
  suitcaseAria: 'Abrir la maleta: tu colección',

  lookingAgain: 'Déjame mirar el tablero otra vez.',
  asFarAsIDare: 'No me atrevo a más.',
  withSecondChoice: (reasoning, word) => `${reasoning} Mi segunda opción habría sido ${word}.`,
}
