import type { Catalogue } from '../en'

/**
 * A Casey é «ela» (UL12). Tu, nunca você. Frases curtas — ficam num balão de
 * fala num telemóvel com 360 píxeis de largura.
 *
 * Uma «dica» é só isto: o conselho dela no Início. O que se toca ao adivinhar
 * é uma «tentativa» — senão pista, dica e tentativa confundiam-se.
 *
 * Alguns valores trazem de propósito um espaço no início ou no fim: são as
 * metades de uma frase que envolve um <strong> ou um <code>.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'Enquanto adivinhas, são os verdes da Casey que contam. A chave dela, não a tua.',
  tipCollectBothWays:
    'Recolhes uma palavra ao dar-lhe uma pista E ao adivinhá-la: um verde em cada sentido.',
  tipWrapToKeep:
    'As palavras recolhidas ainda se partem pelo caminho. Embrulha-as para as guardar.',
  tipEarnWrapUp:
    'Três rondas ganhas dão uma ronda de arrumação. Guarda até três e gasta uma quando tiveres muitas recolhidas. Arruma até quinze.',

  tipTapCaseyForCase: 'Toca na Casey para abrir a mala. Cada palavra que recolhes viaja aqui dentro.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `Numa ronda de arrumação, as cartas começam pela sua face. Escreve em ${language} para as arrumar.`,
  tipWrapUpSkipAllowed:
    'Podes saltar uma carta numa ronda de arrumação, mas nessa ronda não fica embrulhada.',
  tipLastChance:
    'Ficar sem pistas não é ficar sem jogo: na última hipótese continuas a nomear palavras.',
  tipLookUpMidRound: (language) =>
    `Consulta uma palavra a meio da ronda na caixa da pista. Entra a tua língua, sai ${language}.`,
  tipWrapCityOpensRoad: 'Embrulha as cem palavras de uma cidade e o caminho em frente abre-se.',

  wordOfTheDay: (word, meaning) => `Palavra do dia: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Uma palavra a vigiar: ${word} (${meaning}). Já te apanhou ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `Esta sabes mesmo: ${word} (${meaning}). Já ${greens}× a verde.`,
  personalCluedTogether: (a, b, times) =>
    `Tu e eu entendemo-nos com ${a} e ${b}. As tuas pistas encontraram-nas juntas ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `A tua pista preferida é «${clue}». Já a deste ${times}×.`,
  personalGames: (played, won) =>
    `Os nossos jogos juntos: ${played}. As nossas vitórias: ${won}.`,

  notAnsweredBubble: 'Ainda não respondi. Toca aqui para testar a ligação →',
  notAnsweredAria: 'A Casey ainda não respondeu. Abre as Definições e testa a ligação',
  bubbleAria: (line) => `A Casey diz: ${line} Toca para outra dica.`,
  suitcaseAria: 'Abrir a mala: a tua coleção',

  lookingAgain: 'Deixa-me olhar outra vez para o tabuleiro.',
  asFarAsIDare: 'Mais do que isto não me atrevo.',
  withSecondChoice: (reasoning, word) => `${reasoning} A minha segunda escolha teria sido ${word}.`,




  // «Casey normal está pronta por predefinição. …» — o nome vem a negrito antes.



  // «Toca em Testar ligação abaixo para a Casey responder por esse caminho
  // completo. …»




  // «Para uma cópia privada de desenvolvimento, usa o endereço do seu serviço
  // da Casey mais /v1 em URL base …» — «URL base» é o nome do campo nas
  // Definições e escreve-se como lá.


}
