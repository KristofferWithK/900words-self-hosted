import type { Catalogue } from '../en'

/**
 * Casey jest „ona” (UL12) — walizka, więc: odpowiedziałam, odważę się,
 * spakowana. Ty, nigdy Pan/Pani. Krótkie zdania — stoją w dymku na telefonie
 * o szerokości 360 pikseli.
 *
 * „Porada” to tylko jedno: jej rada na ekranie startowym. „Wskazówka” to
 * hasło w grze, „próba” to jeden strzał w zgadywaniu, „dotknij” to gest —
 * żadne z tych słów nie zastępuje innego.
 *
 * Kilka wartości celowo niesie spację na początku albo na końcu: to połówki
 * zdania, które obejmuje <strong> albo <code>.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'Kiedy zgadujesz, liczą się zielone Casey. Jej klucz, nie twój.',
  tipCollectBothWays:
    'Słowo zbierasz, dając do niego wskazówkę I zgadując je: zielone w obie strony.',
  tipWrapToKeep: 'Zebrane słowa wciąż mogą się potłuc w drodze. Zawiń je, żeby zostały.',
  tipEarnWrapUp:
    'Trzy wygrane rundy dają rundę pakowania. Odłóż do trzech i wydaj jedną, gdy masz dużo zebranych. Pakuje do piętnastu.',

  tipTapCaseyForCase: 'Dotknij Casey, żeby otworzyć walizkę. Każde zebrane słowo jedzie tutaj.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `W rundzie pakowania karty zaczynają od swojej strony karty. Zapakujesz je, wpisując tłumaczenie (${language}).`,
  tipWrapUpSkipAllowed:
    'W rundzie pakowania możesz pominąć kartę, ale w tej rundzie nie da się jej zawinąć.',
  tipLastChance:
    'Brak wskazówek to nie koniec gry: ostatnia szansa pozwala dalej wskazywać słowa.',
  tipLookUpMidRound: (language) =>
    `Słowo sprawdzisz w trakcie rundy w polu wskazówki. Twój język wchodzi, ${language} wychodzi.`,
  tipWrapCityOpensRoad: 'Zawiń wszystkie sto słów miasta i droga dalej się otworzy.',

  wordOfTheDay: (word, meaning) => `Słowo dnia: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Słowo do pilnowania: ${word} (${meaning}). Zmyliło cię już ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `To znasz naprawdę dobrze: ${word} (${meaning}). Już ${greens}× na zielono.`,
  personalCluedTogether: (a, b, times) =>
    `Ty i ja nadajemy na tych samych falach przy ${a} i ${b}. Twoje podpowiedzi znalazły je razem ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `Twoja ulubiona podpowiedź to «${clue}». Użyta już ${times}×.`,
  personalGames: (played, won) =>
    `Nasze wspólne gry: ${played}. Nasze wygrane: ${won}.`,

  notAnsweredBubble: 'Jeszcze nie odpowiedziałam. Dotknij tutaj i sprawdź połączenie →',
  notAnsweredAria: 'Casey jeszcze nie odpowiedziała. Otwórz Ustawienia i sprawdź połączenie',
  bubbleAria: (line) => `Casey mówi: ${line} Dotknij, by usłyszeć kolejną poradę.`,
  suitcaseAria: 'Otwórz walizkę: twoja kolekcja',

  lookingAgain: 'Niech jeszcze raz spojrzę na planszę.',
  asFarAsIDare: 'Dalej się nie odważę.',
  withSecondChoice: (reasoning, word) => `${reasoning} Moim drugim wyborem byłoby ${word}.`,




  // „Zwykła Casey jest gotowa od razu. …”



  // „Dotknij poniżej Sprawdź połączenie, a Casey odpowie całą tą drogą. …”




  // „Dla prywatnej kopii deweloperskiej wpisz adres jej usługi Casey z końcówką
  // /v1 w polu Adres bazowy …” — „Adres bazowy” to nazwa pola w Ustawieniach,
  // pisana tak jak tam.


}
