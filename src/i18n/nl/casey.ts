import type { Catalogue } from '../en'

/**
 * Casey is ‘zij’ (UL12). Je/jij, nooit u. Korte zinnen — ze staan in een
 * tekstwolkje op een telefoon van 360 pixels breed.
 *
 * ‘Tip’ betekent hier maar één ding: haar raad op het beginscherm. Wat je in
 * het spel geeft is een hint, wat je doet is raden, en één poging is een gok.
 *
 * Een paar waarden dragen met opzet een spatie aan het begin of het einde: het
 * zijn de helften van een zin die om een <strong> of een <code> heen staat.
 */
export const casey: Catalogue['casey'] = {
  // ── Beginscherm: de roulerende tips (cluey-tips.ts) ──────────────────────
  tipCaseyKeyCounts: 'Als jij raadt, tellen Casey’s groene kaarten. Haar sleutel, niet de jouwe.',
  tipCollectBothWays:
    'Verzamel een woord door er een hint voor te geven EN het te raden: één keer groen in beide richtingen.',
  tipWrapToKeep: 'Verzamelde woorden kunnen onderweg nog breken. Verpak ze om ze te houden.',
  tipEarnWrapUp:
    'Drie gewonnen rondes leveren een inpakronde op. Spaar er tot drie, en gebruik er een als je veel verzameld hebt. Hij pakt er tot vijftien in.',

  tipTapCaseyForCase:
    'Tik op Casey om de koffer te openen. Elk woord dat je verzamelt reist hierin mee.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `In een inpakronde beginnen de kaarten in het Engels. Typ het ${language} om ze in te pakken.`,
  tipWrapUpSkipAllowed:
    'Een kaart overslaan in een inpakronde mag, maar die ronde wordt hij dan niet verpakt.',
  tipLastChance:
    'Geen hints meer is nog geen einde: in de laatste kans blijf je gewoon woorden noemen.',
  tipLookUpMidRound: (language) =>
    `Zoek midden in een ronde een woord op vanuit het hintvak. Engels erin, ${language} eruit.`,
  tipWrapCityOpensRoad: 'Verpak alle honderd woorden van een stad en de weg verder gaat open.',

  wordOfTheDay: (word, meaning) => `Woord van de dag: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Een woord om op te letten: ${word} (${meaning}). Het zat je al ${misses}× dwars.`,
  personalBestWord: (word, meaning, greens) =>
    `Deze ken je echt: ${word} (${meaning}). Al ${greens}× groen.`,
  personalCluedTogether: (a, b, times) =>
    `Jij en ik klikken bij ${a} en ${b}. Jouw hints vonden ze ${times}× samen.`,
  personalFavouriteClue: (clue, times) =>
    `Je favoriete hint is «${clue}». Al ${times}× gegeven.`,
  personalGames: (played, won) =>
    `Onze spelletjes samen: ${played}. Onze overwinningen: ${won}.`,

  // ── Casey op het beginscherm (components/Cluey.tsx) ──────────────────────
  notAnsweredBubble: 'Ik heb nog niet geantwoord. Tik hier om de verbinding te testen →',
  notAnsweredAria: 'Casey heeft nog niet geantwoord. Open Instellingen en test de verbinding',
  bubbleAria: (line) => `Casey zegt: ${line} Tik voor nog een tip.`,
  suitcaseAria: 'De koffer openen: je verzameling',

  // ── Hoe ze een beslissing uitlegt (caseyJustification.ts) ────────────────
  lookingAgain: 'Laat me nog eens naar het bord kijken.',
  asFarAsIDare: 'Verder durf ik niet te gaan.',
  withSecondChoice: (reasoning, word) => `${reasoning} Mijn tweede keus zou ${word} zijn geweest.`,

  // ── De verbindingshulp in Instellingen (components/ConnectCluey.tsx) ─────



  // ‘Normale Casey staat standaard klaar. …’



  // ‘Tik hieronder op Verbinding testen om Casey via precies die weg te laten
  // antwoorden. …’




  // ‘Voor een eigen ontwikkelkopie gebruik je het adres van haar Casey-dienst
  // plus /v1 als Basis-URL …’ — ‘Basis-URL’ is de naam van het veld in
  // Instellingen en wordt geschreven zoals daar.


}
