import type { Catalogue } from '../en'
import { az } from './toldalek'

/**
 * Casey „ő” (UL12) — a magyarnak nincs nyelvtani neme, a melegség a
 * mondatokban van. Tegezés. Rövid mondatok — egy 360 pixel széles telefon
 * szóbuborékjában állnak.
 *
 * Amit a Főoldalon ad, az tanács, nem tipp: a tipp ebben a játékban az, amit
 * a nyomra mondasz. A koppintás koppintás.
 *
 * Néhány érték szándékosan szóközzel kezdődik vagy végződik: egy <strong>-ot
 * vagy <code>-ot körülölelő mondat felei.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: 'Amíg tippelsz, Casey zöldjei számítanak. Az ő kulcsa, nem a tiéd.',
  tipCollectBothWays:
    'Egy szót úgy gyűjtesz be, hogy nyomot adsz rá ÉS meg is tippeled: oda-vissza egy-egy zöld.',
  tipWrapToKeep: 'A begyűjtött szavak útközben még eltörhetnek. Csomagold be, hogy megtartsd őket.',
  tipEarnWrapUp:
    'Három megnyert kör egy csomagolókört ér. Legfeljebb hármat tehetsz tartalékba; használj fel egyet, ha sok a begyűjtött szavad. Legfeljebb tizenötöt pakol be.',

  tipTapCaseyForCase: 'Koppints Casey-re a bőrönd kinyitásához. Minden begyűjtött szavad itt utazik.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `Csomagolókörben a kártyák angolul indulnak. Írd be ${az(language)} ${language} megfelelőt a bepakoláshoz.`,
  tipWrapUpSkipAllowed:
    'Csomagolókörben kihagyhatsz egy kártyát, de abban a körben nem csomagolható be.',
  tipLastChance:
    'Ha elfogytak a nyomok, a játék még nem: az utolsó esélyben tovább nevezhetsz meg szavakat.',
  tipLookUpMidRound: (language) =>
    `Kör közben is kikereshetsz egy szót a nyommezőből. Angol be, ${language} ki.`,
  tipWrapCityOpensRoad: 'Csomagold be egy város mind a száz szavát, és megnyílik az út tovább.',

  wordOfTheDay: (word, meaning) => `A nap szava: ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Erre a szóra figyelj: ${word} (${meaning}). Már ${misses}× kifogott rajtad.`,
  personalBestWord: (word, meaning, greens) =>
    `Ezt nagyon tudod: ${word} (${meaning}). Már ${greens}× zöld.`,
  personalCluedTogether: (a, b, times) =>
    `Mi ketten ráhangolódunk erre: ${a} és ${b}. A jeleid ${times}× találták meg őket együtt.`,
  personalFavouriteClue: (clue, times) =>
    `A kedvenc jeled: «${clue}». Már ${times}× adtad meg.`,
  personalGames: (played, won) =>
    `Közös játékaink: ${played}. Győzelmeink: ${won}.`,

  notAnsweredBubble: 'Még nem válaszoltam. Koppints ide a kapcsolat teszteléséhez →',
  notAnsweredAria: 'Casey még nem válaszolt. Nyisd meg a Beállításokat, és teszteld a kapcsolatot',
  bubbleAria: (line) => `Casey mondja: ${line} Koppints a következő tanácsért.`,
  suitcaseAria: 'A bőrönd megnyitása: a gyűjteményed',

  lookingAgain: 'Hadd nézzem meg újra a táblát.',
  asFarAsIDare: 'Ennél tovább nem merészkedek.',
  withSecondChoice: (reasoning, word) => `${reasoning} A második választásom ${word} lett volna.`,




  // „Normál Casey alapból készen áll. …”



  // „Koppints lent a Kapcsolatteszt gombra, és Casey ezen a teljes úton
  // válaszol. …”




  // „Saját fejlesztői példányhoz add meg annak Casey-szolgáltatáscímét, utána a
  // /v1 útvonalat az Alap-URL mezőben …” — az „Alap-URL” a Beállítások mezőjének
  // neve, és úgy írjuk, ahogy ott áll.


}
