import type { Catalogue } from '../en'

/**
 * Casey är ”hon” (UL12). Du. Korta meningar — de står i en pratbubbla på en
 * telefon som är 360 pixlar bred.
 *
 * ”Tips” betyder här bara en sak: hennes råd på Hem. Det man trycker på när
 * man gissar är en gissning — annars hette ledtråd, råd, tryck och gissning
 * alla samma sak.
 *
 * Några värden bär avsiktligt ett blanksteg först eller sist: de är halvorna
 * av en mening som omsluter ett <strong> eller ett <code>.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'När du gissar är det Caseys gröna som räknas. Hennes nyckel, inte din.',
  tipCollectBothWays:
    'Samla ett ord genom att ge en ledtråd till det OCH gissa det: grönt en gång i varje riktning.',
  tipWrapToKeep: 'Samlade ord kan fortfarande gå sönder på vägen. Slå in dem för att behålla dem.',
  tipEarnWrapUp:
    'Tre vunna rundor ger en packrunda. Spara upp till tre, och använd en när du har många samlade. Den packar upp till femton.',

  tipTapCaseyForCase: 'Tryck på Casey för att öppna väskan. Varje ord du samlar reser med här inne.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `I en packrunda börjar korten på sitt kortface. Skriv ordet på ${language} för att packa dem.`,
  tipWrapUpSkipAllowed:
    'Du får hoppa över ett kort i en packrunda, men då kan det inte slås in den rundan.',
  tipLastChance: 'Slut på ledtrådar är inte slut på spelet: sista chansen låter dig fortsätta nämna ord.',
  tipLookUpMidRound: (language) =>
    `Slå upp ett ord mitt i rundan från ledtrådsrutan. Ditt språk in, ${language} ut.`,
  tipWrapCityOpensRoad: 'Slå in alla hundra ord i en stad så öppnas vägen vidare.',

  wordOfTheDay: (word, meaning) => `Dagens ord: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Ett ord att hålla koll på: ${word} (${meaning}). Det har lurat dig ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `Det här kan du: ${word} (${meaning}). Grönt ${greens}× redan.`,
  personalCluedTogether: (a, b, times) =>
    `Du och jag är på samma våglängd med ${a} och ${b}. Dina ledtrådar hittade dem ihop ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `Din favoritledtråd är «${clue}». Du har gett den ${times}×.`,
  personalGames: (played, won) =>
    `Våra spel tillsammans: ${played}. Våra vinster: ${won}.`,

  notAnsweredBubble: 'Jag har inte svarat än. Tryck här för att testa anslutningen →',
  notAnsweredAria: 'Casey har inte svarat än. Öppna Inställningar och testa anslutningen',
  bubbleAria: (line) => `Casey säger: ${line} Tryck för ett nytt tips.`,
  suitcaseAria: 'Öppna resväskan: din samling',

  lookingAgain: 'Låt mig titta på spelplanen igen.',
  asFarAsIDare: 'Längre än så vågar jag inte.',
  withSecondChoice: (reasoning, word) => `${reasoning} Mitt andra val hade varit ${word}.`,




  // ”Vanliga Casey är redo från start. …” — namnet är fetstilt, så meningen
  // delas runt det; `normalCaseyLede` bär sitt eget inledande blanksteg.



  // ”Tryck på Testa anslutningen nedan så svarar Casey genom hela den vägen. …”




  // ”För en privat utvecklingskopia använder du adressen till dess Casey-tjänst
  // plus /v1 i Bas-URL …” — ”Bas-URL” är fältets namn i Inställningar och
  // skrivs som där.


}
