import type { Catalogue } from '../en'

/**
 * Casey ist „sie“ (UL12). Du, nie Sie. Kurze Sätze — sie stehen in einer
 * Sprechblase auf einem 360 Pixel breiten Telefon.
 *
 * „Tipp“ heißt hier nur eins: ihr Rat auf Home. Was jemand beim Raten
 * antippt, ist ein Rateversuch — sonst hieße Hinweis, Rat, Antippen und
 * Raten alles gleich.
 *
 * Einige Werte tragen absichtlich ein Leerzeichen am Anfang oder am Ende: sie
 * sind die Hälften eines Satzes, der ein <strong> oder ein <code> umschließt.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'Beim Raten zählen Caseys grüne Karten. Ihr Schlüssel, nicht deiner.',
  tipCollectBothWays:
    'Ein Wort sammelst du, wenn du dafür einen Hinweis gibst UND es rätst: einmal in jede Richtung grün.',
  tipWrapToKeep:
    'Gesammelte Wörter können unterwegs noch verloren gehen. Wickle sie ein, dann behältst du sie.',
  tipEarnWrapUp:
    'Drei gewonnene Runden bringen eine Packrunde. Bis zu drei kannst du aufsparen; löse eine ein, wenn du viel gesammelt hast. Sie packt bis zu fünfzehn Wörter ein.',

  tipTapCaseyForCase:
    'Tippe auf Casey, um den Koffer zu öffnen. Jedes gesammelte Wort reist hier mit.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `In einer Packrunde zeigen die Karten erst ihre Kartenseite. Gib sie auf ${language} ein, um sie einzupacken.`,
  tipWrapUpSkipAllowed:
    'In der Packrunde darfst du eine Karte überspringen, eingewickelt wird sie in dieser Runde dann aber nicht.',
  tipLastChance:
    'Ohne Hinweise ist noch nicht Schluss: In der letzten Chance nennst du einfach weiter Wörter.',
  tipLookUpMidRound: (language) =>
    `Schlag ein Wort mitten in der Runde im Hinweisfeld nach. Deine Sprache rein, ${language} raus.`,
  tipWrapCityOpensRoad:
    'Wickle alle hundert Wörter einer Stadt ein, dann steht dir die Weiterfahrt offen.',

  wordOfTheDay: (word, meaning) => `Wort des Tages: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Ein Wort zum Aufpassen: ${word} (${meaning}). Es hat dich schon ${misses}× erwischt.`,
  personalBestWord: (word, meaning, greens) =>
    `Das kannst du richtig: ${word} (${meaning}). Schon ${greens}× grün.`,
  personalCluedTogether: (a, b, times) =>
    `Wir zwei verstehen uns bei ${a} und ${b}. Deine Hinweise haben sie ${times}× zusammen gefunden.`,
  personalFavouriteClue: (clue, times) =>
    `Dein Lieblingshinweis ist „${clue}“. Schon ${times}× gegeben.`,
  personalGames: (played, won) =>
    `Unsere Spiele zusammen: ${played}. Unsere Siege: ${won}.`,

  notAnsweredBubble: 'Ich habe noch nicht geantwortet. Tippe hier und teste die Verbindung →',
  notAnsweredAria:
    'Casey hat noch nicht geantwortet. Öffne die Einstellungen und teste die Verbindung',
  bubbleAria: (line) => `Casey sagt: ${line} Antippen für den nächsten Tipp.`,
  suitcaseAria: 'Den Koffer öffnen: deine Sammlung',

  lookingAgain: 'Lass mich noch mal aufs Spielfeld schauen.',
  asFarAsIDare: 'Weiter traue ich mich nicht.',
  withSecondChoice: (reasoning, word) => `${reasoning} Meine zweite Wahl wäre ${word} gewesen.`,
}
