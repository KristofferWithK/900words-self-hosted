import type { Catalogue } from '../en'

/**
 * Casey er «hun». Du. Korte setninger — de står i en snakkeboble på en
 * telefon som er 360 piksler bred.
 *
 * «Tips» betyr bare én ting her: rådet hennes på Hjem. Et hint er det du gir
 * i spillet, og en gjetning er det du svarer med — ellers ville råd, hint og
 * gjetting hett det samme.
 *
 * Noen verdier har med hensikt et mellomrom først eller sist: de er halvdelene
 * av en setning som omslutter en <strong> eller en <code>.
 */
export const casey: Catalogue['casey'] = {
  // ── Hjem: tipsene som roterer (cluey-tips.ts) ────────────────────────────
  tipCaseyKeyCounts:
    'Når du gjetter, er det Caseys grønne kort som teller. Nøkkelen hennes, ikke din.',
  tipCollectBothWays:
    'Du samler et ord ved å gi hint om det OG gjette det: grønt én gang i hver retning.',
  tipWrapToKeep:
    'Samlede ord kan fortsatt gå i stykker på veien. Pakk dem inn for å beholde dem.',
  tipEarnWrapUp:
    'Tre vunne runder gir en pakkerunde. Spar opptil tre, og bruk én når du har samlet mye. Den pakker opptil femten.',

  tipTapCaseyForCase: 'Trykk på Casey for å åpne kofferten. Hvert ord du samler, reiser med her.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `I en pakkerunde starter kortene på engelsk. Skriv ordet på ${language} for å pakke dem.`,
  tipWrapUpSkipAllowed:
    'Du kan hoppe over et kort i en pakkerunde, men da blir det ikke pakket inn den runden.',
  tipLastChance:
    'Tomt for hint er ikke slutt på spillet: i siste sjanse kan du fortsette å peke ut ord.',
  tipLookUpMidRound: (language) =>
    `Slå opp et ord midt i runden fra hintfeltet. Engelsk inn, ${language} ut.`,
  tipWrapCityOpensRoad: 'Pakk inn alle hundre ordene i en by, så åpner veien videre seg.',

  wordOfTheDay: (word, meaning) => `Dagens ord: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Et ord å passe på: ${word} (${meaning}). Det har lurt deg ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `Dette kan du: ${word} (${meaning}). Grønn ${greens}× allerede.`,
  personalCluedTogether: (a, b, times) =>
    `Du og jeg er på bølgelengde med ${a} og ${b}. Hintene dine fant dem sammen ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `Favoritthintet ditt er «${clue}». Du har gitt det ${times}×.`,
  personalGames: (played, won) =>
    `Spillene våre sammen: ${played}. Seirene våre: ${won}.`,

  // ── Casey på Hjem (components/Cluey.tsx) ─────────────────────────────────
  notAnsweredBubble: 'Jeg har ikke svart ennå. Trykk her for å teste tilkoblingen →',
  notAnsweredAria: 'Casey har ikke svart ennå. Åpne Innstillinger og test tilkoblingen',
  bubbleAria: (line) => `Casey sier: ${line} Trykk for et nytt tips.`,
  suitcaseAria: 'Åpne kofferten: samlingen din',

  // ── Slik forklarer hun en vurdering (caseyJustification.ts) ──────────────
  lookingAgain: 'La meg se på brettet en gang til.',
  asFarAsIDare: 'Lenger tør jeg ikke gå.',
  withSecondChoice: (reasoning, word) => `${reasoning} Andrevalget mitt ville vært ${word}.`,

  // ── Tilkoblingshjelpen i Innstillinger (components/ConnectCluey.tsx) ─────



  // «Vanlig Casey er klar fra start. …» — navnet står i fet skrift, så
  // setningen er delt rundt det.



  // «Trykk på Test tilkoblingen nedenfor, så svarer Casey gjennom hele denne
  // veien. …»




  // «For en privat utviklingskopi bruker du adressen til kopiens Casey-tjeneste
  // pluss /v1 i Basis-URL …» — «Basis-URL» er navnet på feltet i Innstillinger
  // og skrives slik det står der.


}
