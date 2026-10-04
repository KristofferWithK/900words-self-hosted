import { UI_LANGUAGE } from './active'
import type { UiLanguage } from './types'
import type { Tier } from '../progression/types'

type ReceiptCopy = {
  title: string; solved: string; tier: string; personalBest: string
  bestChange: (before: string, after: string) => string; firstBest: (tier: string) => string
  rewards: string; eligible: (items: string) => string; alreadyEarned: (items: string) => string
  newPostcards: (count: number) => string; none: string
  spinWin: string; solvedReward: string; solvedAndTranslated: string
  bronze: string; silver: string; gold: string; platinum: string
  learning: string; learningNone: string; learningNew: string
  learningState: (box: number, seen: number, correct: number, misses: number, lookups: number, clues: number, guesses: number) => string
  learningChange: (word: string, before: string, after: string) => string
}

type FinishHeaderCopy = {
  goodGame: string; greatGame: string; perfectGame: string; participationTrophy: string
  rewardSpin: string; rewardSolved: string; rewardTranslated: string
  noRewards: string; alreadyEarnedLabel: string; participationOnly: string
  /** The finish header's small line: which board, and what the screen is. */
  boardLabel: (n: string) => string; resultLabel: string
}

const finishHeaderCopies: Record<UiLanguage, FinishHeaderCopy> = {
  en: { goodGame: 'Good game!', greatGame: 'Great game!', perfectGame: 'Perfect game!', participationTrophy: 'Participation trophy', rewardSpin: 'spin and win', rewardSolved: 'found every word', rewardTranslated: 'found and translated every word', noRewards: 'No postcard rewards', alreadyEarnedLabel: 'Already earned', participationOnly: 'participation only', boardLabel: n => `Board ${n}`, resultLabel: 'Result' },
  de: { goodGame: 'Gut gespielt!', greatGame: 'Stark gespielt!', perfectGame: 'Perfekt gespielt!', participationTrophy: 'Teilnahme-Trophäe', rewardSpin: 'Dreh gewonnen', rewardSolved: 'alle Wörter gefunden', rewardTranslated: 'alle Wörter gefunden und übersetzt', noRewards: 'Keine Postkartenbelohnungen', alreadyEarnedLabel: 'Bereits verdient', participationOnly: 'nur zur Teilnahme', boardLabel: n => `Brett ${n}`, resultLabel: 'Ergebnis' },
  es: { goodGame: '¡Buen juego!', greatGame: '¡Gran partida!', perfectGame: '¡Partida perfecta!', participationTrophy: 'Trofeo de participación', rewardSpin: 'ruleta ganada', rewardSolved: 'encontrar todas las palabras', rewardTranslated: 'encontrar y traducir todas las palabras', noRewards: 'Sin recompensas de postales', alreadyEarnedLabel: 'Ya conseguido', participationOnly: 'solo por participar', boardLabel: n => `Tablero ${n}`, resultLabel: 'Resultado' },
  fr: { goodGame: 'Belle partie !', greatGame: 'Super partie !', perfectGame: 'Partie parfaite !', participationTrophy: 'Trophée de participation', rewardSpin: 'roue gagnée', rewardSolved: 'tous les mots trouvés', rewardTranslated: 'tous les mots trouvés et traduits', noRewards: 'Aucune récompense de carte postale', alreadyEarnedLabel: 'Déjà obtenu', participationOnly: 'participation uniquement', boardLabel: n => `Grille ${n}`, resultLabel: 'Résultat' },
  hu: { goodGame: 'Szép játék!', greatGame: 'Nagyszerű játék!', perfectGame: 'Tökéletes játék!', participationTrophy: 'Részvételi trófea', rewardSpin: 'nyerés a szerencsekeréken', rewardSolved: 'minden szó megtalálása', rewardTranslated: 'minden szó megtalálása és lefordítása', noRewards: 'Nincs képeslapjutalom', alreadyEarnedLabel: 'Már megszerzett', participationOnly: 'csak részvétel', boardLabel: n => `Tábla ${n}`, resultLabel: 'Eredmény' },
  nb: { goodGame: 'Bra spilt!', greatGame: 'Flott spilt!', perfectGame: 'Perfekt spilt!', participationTrophy: 'Deltakertrofé', rewardSpin: 'vunnet på lykkehjulet', rewardSolved: 'funnet alle ordene', rewardTranslated: 'funnet og oversatt alle ordene', noRewards: 'Ingen postkortbelønninger', alreadyEarnedLabel: 'Allerede opptjent', participationOnly: 'kun deltakelse', boardLabel: n => `Brett ${n}`, resultLabel: 'Resultat' },
  nl: { goodGame: 'Goed gespeeld!', greatGame: 'Geweldig gespeeld!', perfectGame: 'Perfect gespeeld!', participationTrophy: 'Deelnametrofee', rewardSpin: 'draai gewonnen', rewardSolved: 'alle woorden gevonden', rewardTranslated: 'alle woorden gevonden en vertaald', noRewards: 'Geen ansichtkaartbeloningen', alreadyEarnedLabel: 'Al verdiend', participationOnly: 'alleen voor deelname', boardLabel: n => `Bord ${n}`, resultLabel: 'Resultaat' },
  pl: { goodGame: 'Dobra gra!', greatGame: 'Świetna gra!', perfectGame: 'Perfekcyjna gra!', participationTrophy: 'Trofeum za udział', rewardSpin: 'wygrana na kole', rewardSolved: 'znalezienie wszystkich słów', rewardTranslated: 'znalezienie i przetłumaczenie wszystkich słów', noRewards: 'Brak nagród pocztówkowych', alreadyEarnedLabel: 'Już zdobyte', participationOnly: 'tylko za udział', boardLabel: n => `Plansza ${n}`, resultLabel: 'Wynik' },
  pt: { goodGame: 'Bom jogo!', greatGame: 'Grande jogo!', perfectGame: 'Jogo perfeito!', participationTrophy: 'Troféu de participação', rewardSpin: 'vitória na roleta', rewardSolved: 'encontrar todas as palavras', rewardTranslated: 'encontrar e traduzir todas as palavras', noRewards: 'Sem recompensas de postais', alreadyEarnedLabel: 'Já obtido', participationOnly: 'apenas participação', boardLabel: n => `Tabuleiro ${n}`, resultLabel: 'Resultado' },
  sv: { goodGame: 'Bra spelat!', greatGame: 'Riktigt bra spelat!', perfectGame: 'Perfekt spelat!', participationTrophy: 'Deltagarpokal', rewardSpin: 'vinst på hjulet', rewardSolved: 'hittat alla ord', rewardTranslated: 'hittat och översatt alla ord', noRewards: 'Inga vykortsbelöningar', alreadyEarnedLabel: 'Redan intjänat', participationOnly: 'endast deltagande', boardLabel: n => `Bräde ${n}`, resultLabel: 'Resultat' },
  zh: { goodGame: '玩得好！', greatGame: '精彩表现！', perfectGame: '完美一局！', participationTrophy: '参与奖杯', rewardSpin: '转盘获胜', rewardSolved: '找到所有单词', rewardTranslated: '找到并翻译所有单词', noRewards: '没有明信片奖励', alreadyEarnedLabel: '已获得', participationOnly: '仅表示参与', boardLabel: n => `棋盘 ${n}`, resultLabel: '结果' },
}

/**
 * The café world's stamp line (docs/roadmap/cafe-world.md section 6): the
 * stamp a café got, the card it is on, and the city's share beside it. A
 * café without a name yet (`cafeNameForBoard` returns null) is spoken of
 * without one. Say "stamp" and "café"; never postcards.
 */
type StampCopy = {
  /** The reward line's title, e.g. "Platinum stamp". */
  stamp: (tier: Tier) => string
  /** The tier word printed inside the drawn stamp. */
  stampRing: Record<Tier, string>
  /** Under a new stamp, e.g. "on your Café Solen card". */
  stampOnCard: (cafe: string | null) => string
  /** A round that did not raise the stamp, e.g. "Your Café Solen card keeps its Gold stamp". */
  stampKept: (cafe: string | null, tier: Tier) => string
  /** Over a stamp the round did not raise, and over a round that is not a café's. */
  noNewStamp: string
  /** The screen-reader name of the ticked result lines. */
  roundTicks: string
  /** The city percentage, already a whole number. */
  cityPercent: (percent: number) => string
  /** Under the percentage, e.g. "of Sønderborg". */
  ofCity: (city: string) => string
}

const tierWords = (bronze: string, silver: string, gold: string, platinum: string): Record<Tier, string> => ({ bronze, silver, gold, platinum })

const EN_TIER = tierWords('Bronze', 'Silver', 'Gold', 'Platinum')
const DE_TIER = tierWords('Bronze', 'Silber', 'Gold', 'Platin')
const ES_TIER = tierWords('bronce', 'plata', 'oro', 'platino')
const FR_TIER = tierWords('bronze', 'argent', 'or', 'platine')
const HU_TIER = tierWords('Bronz', 'Ezüst', 'Arany', 'Platina')
const HU_THE = tierWords('a bronz', 'az ezüst', 'az arany', 'a platina')
const NB_TIER = tierWords('bronse', 'sølv', 'gull', 'platina')
const NB_TITLE = tierWords('Bronsestempel', 'Sølvstempel', 'Gullstempel', 'Platinastempel')
const NL_TIER = tierWords('bronzen', 'zilveren', 'gouden', 'platina')
const NL_TITLE = tierWords('Bronzen stempel', 'Zilveren stempel', 'Gouden stempel', 'Platina stempel')
const PL_TITLE = tierWords('Brązowa pieczątka', 'Srebrna pieczątka', 'Złota pieczątka', 'Platynowa pieczątka')
const PL_TIER_ACC = tierWords('brązową', 'srebrną', 'złotą', 'platynową')
const PT_TIER = tierWords('bronze', 'prata', 'ouro', 'platina')
const SV_TIER = tierWords('brons', 'silver', 'guld', 'platina')
const SV_TITLE = tierWords('Bronsstämpel', 'Silverstämpel', 'Guldstämpel', 'Platinastämpel')
const ZH_TIER = tierWords('铜', '银', '金', '白金')
/** Keeps a number and its percent sign on one line where a space goes between them. */
const NBSP = ' '

const stampCopies: Record<UiLanguage, StampCopy> = {
  en: {
    stamp: t => `${EN_TIER[t]} stamp`, stampRing: EN_TIER,
    stampOnCard: c => c ? `on your ${c} card` : 'on your stamp card',
    stampKept: (c, t) => c ? `Your ${c} card keeps its ${EN_TIER[t]} stamp` : `This café keeps its ${EN_TIER[t]} stamp`,
    noNewStamp: 'No new stamp',
    roundTicks: 'This round',
    cityPercent: n => `${n}%`, ofCity: city => `of ${city}`,
  },
  de: {
    stamp: t => `${DE_TIER[t]}-Stempel`, stampRing: DE_TIER,
    stampOnCard: c => c ? `auf deiner Karte für ${c}` : 'auf deiner Stempelkarte',
    stampKept: (c, t) => c ? `Deine Karte für ${c} behält ihren ${DE_TIER[t]}-Stempel` : `Dieses Café behält seinen ${DE_TIER[t]}-Stempel`,
    noNewStamp: 'Kein neuer Stempel',
    roundTicks: 'Diese Runde',
    cityPercent: n => `${n}${NBSP}%`, ofCity: city => `von ${city}`,
  },
  es: {
    stamp: t => `Sello de ${ES_TIER[t]}`, stampRing: tierWords('Bronce', 'Plata', 'Oro', 'Platino'),
    stampOnCard: c => c ? `en tu tarjeta de ${c}` : 'en tu tarjeta de sellos',
    stampKept: (c, t) => c ? `Tu tarjeta de ${c} conserva su sello de ${ES_TIER[t]}` : `Este café conserva su sello de ${ES_TIER[t]}`,
    noNewStamp: 'Ningún sello nuevo',
    roundTicks: 'Esta ronda',
    cityPercent: n => `${n}${NBSP}%`, ofCity: city => `de ${city}`,
  },
  fr: {
    stamp: t => `Tampon ${FR_TIER[t]}`, stampRing: tierWords('Bronze', 'Argent', 'Or', 'Platine'),
    stampOnCard: c => c ? `sur ta carte de ${c}` : 'sur ta carte de tampons',
    stampKept: (c, t) => c ? `Ta carte de ${c} garde son tampon ${FR_TIER[t]}` : `Ce café garde son tampon ${FR_TIER[t]}`,
    noNewStamp: 'Pas de nouveau tampon',
    roundTicks: 'Cette partie',
    cityPercent: n => `${n}${NBSP}%`, ofCity: city => `de ${city}`,
  },
  hu: {
    stamp: t => `${HU_TIER[t]} pecsét`, stampRing: HU_TIER,
    stampOnCard: c => c ? `a kártyádon: ${c}` : 'a pecsétkártyádon',
    stampKept: (c, t) => c ? `${c}: megmarad ${HU_THE[t]} pecsét` : `Ennél a kávézónál megmarad ${HU_THE[t]} pecsét`,
    noNewStamp: 'Nincs új pecsét',
    roundTicks: 'Ez a kör',
    cityPercent: n => `${n}%`, ofCity: city => `${city} pecsétjeiből`,
  },
  nb: {
    stamp: t => NB_TITLE[t], stampRing: tierWords('Bronse', 'Sølv', 'Gull', 'Platina'),
    stampOnCard: c => c ? `på kortet ditt for ${c}` : 'på stempelkortet ditt',
    stampKept: (c, t) => c ? `Kortet ditt for ${c} beholder ${NB_TIER[t]}stempelet` : `Denne kafeen beholder ${NB_TIER[t]}stempelet`,
    noNewStamp: 'Ikke noe nytt stempel',
    roundTicks: 'Denne runden',
    cityPercent: n => `${n}${NBSP}%`, ofCity: city => `av ${city}`,
  },
  nl: {
    stamp: t => NL_TITLE[t], stampRing: tierWords('Brons', 'Zilver', 'Goud', 'Platina'),
    stampOnCard: c => c ? `op je kaart van ${c}` : 'op je stempelkaart',
    stampKept: (c, t) => c ? `Je kaart van ${c} houdt de ${NL_TIER[t]} stempel` : `Dit café houdt de ${NL_TIER[t]} stempel`,
    noNewStamp: 'Geen nieuwe stempel',
    roundTicks: 'Deze ronde',
    cityPercent: n => `${n}%`, ofCity: city => `van ${city}`,
  },
  pl: {
    stamp: t => PL_TITLE[t], stampRing: tierWords('Brąz', 'Srebro', 'Złoto', 'Platyna'),
    stampOnCard: c => c ? `na twojej karcie ${c}` : 'na twojej karcie pieczątek',
    stampKept: (c, t) => c ? `Twoja karta ${c} zachowuje ${PL_TIER_ACC[t]} pieczątkę` : `Ta kawiarnia zachowuje ${PL_TIER_ACC[t]} pieczątkę`,
    noNewStamp: 'Brak nowej pieczątki',
    roundTicks: 'Ta runda',
    cityPercent: n => `${n}%`, ofCity: city => `miasta ${city}`,
  },
  pt: {
    stamp: t => `Selo de ${PT_TIER[t]}`, stampRing: tierWords('Bronze', 'Prata', 'Ouro', 'Platina'),
    stampOnCard: c => c ? `no teu cartão de ${c}` : 'no teu cartão de selos',
    stampKept: (c, t) => c ? `O teu cartão de ${c} mantém o selo de ${PT_TIER[t]}` : `Este café mantém o selo de ${PT_TIER[t]}`,
    noNewStamp: 'Nenhum selo novo',
    roundTicks: 'Esta partida',
    cityPercent: n => `${n}%`, ofCity: city => `de ${city}`,
  },
  sv: {
    stamp: t => SV_TITLE[t], stampRing: tierWords('Brons', 'Silver', 'Guld', 'Platina'),
    stampOnCard: c => c ? `på ditt kort för ${c}` : 'på ditt stämpelkort',
    stampKept: (c, t) => c ? `Ditt kort för ${c} behåller ${SV_TIER[t]}stämpeln` : `Det här kaféet behåller ${SV_TIER[t]}stämpeln`,
    noNewStamp: 'Ingen ny stämpel',
    roundTicks: 'Den här rundan',
    cityPercent: n => `${n}${NBSP}%`, ofCity: city => `av ${city}`,
  },
  zh: {
    stamp: t => `${ZH_TIER[t]}印章`, stampRing: ZH_TIER,
    stampOnCard: c => c ? `盖在你的${c}卡上` : '盖在你的印章卡上',
    stampKept: (c, t) => c ? `你的${c}卡保留${ZH_TIER[t]}印章` : `这家咖啡馆保留${ZH_TIER[t]}印章`,
    noNewStamp: '没有新印章',
    roundTicks: '本局',
    cityPercent: n => `${n}%`, ofCity: city => `${city}完成度`,
  },
}

const copies: Record<string, ReceiptCopy> = {
  en: { title: 'This attempt', solved: 'Solved the board', tier: 'Attempt tier', personalBest: 'Personal best', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `First result: ${tier}`, rewards: 'Postcard rewards', eligible: items => `This attempt qualifies for: ${items}`, alreadyEarned: items => `Already earned: ${items}`, newPostcards: count => count === 1 ? '+1 new postcard' : `+${count} new postcards`, none: 'none', spinWin: 'wheel win', solvedReward: 'solved board', solvedAndTranslated: 'solved and translated', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', learning: 'Word learning', learningNone: 'No word-learning records changed in this attempt.', learningNew: 'new record', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `box ${box}; seen ${seen}; correct ${correct}; misses ${misses}; lookups ${lookups}; clue greens ${clues}; guess greens ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  de: { title: 'Dieser Versuch', solved: 'Das Brett gelöst', tier: 'Versuchsstufe', personalBest: 'Persönliche Bestleistung', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Erstes Ergebnis: ${tier}`, rewards: 'Postkarten-Belohnungen', eligible: items => `Dieser Versuch berechtigt zu: ${items}`, alreadyEarned: items => `Schon verdient: ${items}`, newPostcards: count => count === 1 ? '+1 neue Postkarte' : `+${count} neue Postkarten`, none: 'keine', spinWin: 'Glücksrad gewonnen', solvedReward: 'Brett gelöst', solvedAndTranslated: 'gelöst und übersetzt', bronze: 'Bronze-Stufe', silver: 'Silber-Stufe', gold: 'Gold-Stufe', platinum: 'Platin-Stufe', learning: 'Wortlernen', learningNone: 'In diesem Versuch wurden keine Wortlernwerte geändert.', learningNew: 'neuer Eintrag', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `Fach ${box}; gesehen ${seen}; richtig ${correct}; Fehler ${misses}; Nachschlagen ${lookups}; Hinweis-Grün ${clues}; Rate-Grün ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  es: { title: 'Este intento', solved: 'Tablero resuelto', tier: 'Nivel del intento', personalBest: 'Mejor marca personal', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Primer resultado: ${tier}`, rewards: 'Recompensas de postales', eligible: items => `Este intento cumple para: ${items}`, alreadyEarned: items => `Ya conseguido: ${items}`, newPostcards: count => count === 1 ? '+1 postal nueva' : `+${count} postales nuevas`, none: 'ninguna', spinWin: 'ruleta ganada', solvedReward: 'tablero resuelto', solvedAndTranslated: 'resuelto y traducido', bronze: 'nivel bronce', silver: 'nivel plata', gold: 'nivel oro', platinum: 'nivel platino', learning: 'Aprendizaje de palabras', learningNone: 'No cambió ningún registro de aprendizaje de palabras en este intento.', learningNew: 'registro nuevo', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `caja ${box}; vistas ${seen}; aciertos ${correct}; fallos ${misses}; consultas ${lookups}; verdes por pista ${clues}; verdes por respuesta ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  fr: { title: 'Cette tentative', solved: 'Grille résolue', tier: 'Niveau de la tentative', personalBest: 'Meilleur résultat personnel', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Premier résultat : ${tier}`, rewards: 'Récompenses de cartes postales', eligible: items => `Cette tentative donne droit à : ${items}`, alreadyEarned: items => `Déjà obtenu : ${items}`, newPostcards: count => count === 1 ? '+1 nouvelle carte postale' : `+${count} nouvelles cartes postales`, none: 'aucune', spinWin: 'roue gagnée', solvedReward: 'grille résolue', solvedAndTranslated: 'résolue et traduite', bronze: 'niveau bronze', silver: 'niveau argent', gold: 'niveau or', platinum: 'niveau platine', learning: 'Apprentissage des mots', learningNone: 'Aucun relevé d’apprentissage des mots n’a changé dans cette tentative.', learningNew: 'nouveau relevé', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `boîte ${box} ; vues ${seen} ; correctes ${correct} ; erreurs ${misses} ; recherches ${lookups} ; verts par indice ${clues} ; verts par réponse ${guesses}`, learningChange: (word, before, after) => `${word} : ${before} → ${after}` },
  hu: { title: 'Ez a próbálkozás', solved: 'A tábla megoldva', tier: 'Próbálkozási szint', personalBest: 'Személyes legjobb', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Első eredmény: ${tier}`, rewards: 'Képeslapjutalmak', eligible: items => `Ez a próbálkozás jogosít: ${items}`, alreadyEarned: items => `Már megszerzett: ${items}`, newPostcards: count => count === 1 ? '+1 új képeslap' : `+${count} új képeslap`, none: 'nincs', spinWin: 'kerékgyőzelem', solvedReward: 'megoldott tábla', solvedAndTranslated: 'megoldott és lefordított', bronze: 'bronz szint', silver: 'ezüst szint', gold: 'arany szint', platinum: 'platina szint', learning: 'Szótanulás', learningNone: 'Ebben a próbálkozásban nem változott szótanulási adat.', learningNew: 'új bejegyzés', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `doboz ${box}; látva ${seen}; helyes ${correct}; hibák ${misses}; keresések ${lookups}; zöld nyomból ${clues}; zöld tippből ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  nb: { title: 'Dette forsøket', solved: 'Brettet er løst', tier: 'Forsøksnivå', personalBest: 'Personlig rekord', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Første resultat: ${tier}`, rewards: 'Postkortbelønninger', eligible: items => `Dette forsøket kvalifiserer for: ${items}`, alreadyEarned: items => `Allerede opptjent: ${items}`, newPostcards: count => count === 1 ? '+1 nytt postkort' : `+${count} nye postkort`, none: 'ingen', spinWin: 'hjulseier', solvedReward: 'løst brett', solvedAndTranslated: 'løst og oversatt', bronze: 'bronsenivå', silver: 'sølvnivå', gold: 'gullnivå', platinum: 'platina-nivå', learning: 'Ordlæring', learningNone: 'Ingen ordlæringsposter ble endret i dette forsøket.', learningNew: 'ny post', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `boks ${box}; sett ${seen}; riktig ${correct}; feil ${misses}; oppslag ${lookups}; grønne via ledetråd ${clues}; grønne via gjetning ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  nl: { title: 'Deze poging', solved: 'Bord opgelost', tier: 'Pogingniveau', personalBest: 'Persoonlijk beste', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Eerste resultaat: ${tier}`, rewards: 'Ansichtkaartbeloningen', eligible: items => `Deze poging komt in aanmerking voor: ${items}`, alreadyEarned: items => `Al verdiend: ${items}`, newPostcards: count => count === 1 ? '+1 nieuwe ansichtkaart' : `+${count} nieuwe ansichtkaarten`, none: 'geen', spinWin: 'wiel gewonnen', solvedReward: 'bord opgelost', solvedAndTranslated: 'opgelost en vertaald', bronze: 'bronsniveau', silver: 'zilverniveau', gold: 'goudniveau', platinum: 'platinaniveau', learning: 'Woordleren', learningNone: 'Er veranderde geen woordleerrecord in deze poging.', learningNew: 'nieuw record', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `vak ${box}; gezien ${seen}; goed ${correct}; missers ${misses}; opgezocht ${lookups}; groen via hint ${clues}; groen via gok ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  pl: { title: 'Ta próba', solved: 'Plansza rozwiązana', tier: 'Poziom próby', personalBest: 'Najlepszy wynik', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Pierwszy wynik: ${tier}`, rewards: 'Nagrody pocztówkowe', eligible: items => `Ta próba kwalifikuje do: ${items}`, alreadyEarned: items => `Już zdobyte: ${items}`, newPostcards: count => count === 1 ? '+1 nowa pocztówka' : `+${count} nowych pocztówek`, none: 'brak', spinWin: 'wygrana ruleta', solvedReward: 'rozwiązana plansza', solvedAndTranslated: 'rozwiązana i przetłumaczona', bronze: 'poziom brązowy', silver: 'poziom srebrny', gold: 'poziom złoty', platinum: 'poziom platynowy', learning: 'Nauka słów', learningNone: 'W tej próbie nie zmienił się żaden zapis nauki słów.', learningNew: 'nowy zapis', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `pudełko ${box}; widziane ${seen}; poprawne ${correct}; błędy ${misses}; sprawdzenia ${lookups}; zielone po wskazówce ${clues}; zielone po zgadnięciu ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  pt: { title: 'Esta tentativa', solved: 'Tabuleiro resolvido', tier: 'Nível da tentativa', personalBest: 'Melhor resultado pessoal', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Primeiro resultado: ${tier}`, rewards: 'Recompensas de postais', eligible: items => `Esta tentativa qualifica para: ${items}`, alreadyEarned: items => `Já obtido: ${items}`, newPostcards: count => count === 1 ? '+1 postal novo' : `+${count} postais novos`, none: 'nenhuma', spinWin: 'roda ganha', solvedReward: 'tabuleiro resolvido', solvedAndTranslated: 'resolvido e traduzido', bronze: 'nível bronze', silver: 'nível prata', gold: 'nível ouro', platinum: 'nível platina', learning: 'Aprendizagem de palavras', learningNone: 'Nenhum registo de aprendizagem de palavras mudou nesta tentativa.', learningNew: 'novo registo', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `caixa ${box}; vistas ${seen}; certas ${correct}; falhas ${misses}; consultas ${lookups}; verdes por pista ${clues}; verdes por palpite ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  sv: { title: 'Det här försöket', solved: 'Brädet är löst', tier: 'Försöksnivå', personalBest: 'Personbästa', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `Första resultatet: ${tier}`, rewards: 'Vykortsbelöningar', eligible: items => `Det här försöket ger: ${items}`, alreadyEarned: items => `Redan intjänat: ${items}`, newPostcards: count => count === 1 ? '+1 nytt vykort' : `+${count} nya vykort`, none: 'inga', spinWin: 'hjulvinst', solvedReward: 'löst bräde', solvedAndTranslated: 'löst och översatt', bronze: 'bronsnivå', silver: 'silvernivå', gold: 'guldnivå', platinum: 'platinanivå', learning: 'Ordinlärning', learningNone: 'Inga ordinlärningsposter ändrades i det här försöket.', learningNew: 'ny post', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `ruta ${box}; sedd ${seen}; rätt ${correct}; fel ${misses}; uppslag ${lookups}; gröna via ledtråd ${clues}; gröna via gissning ${guesses}`, learningChange: (word, before, after) => `${word}: ${before} → ${after}` },
  zh: { title: '本次尝试', solved: '已解开棋盘', tier: '本次等级', personalBest: '个人最佳', bestChange: (before, after) => `${before} → ${after}`, firstBest: tier => `首次结果：${tier}`, rewards: '明信片奖励', eligible: items => `本次可获得：${items}`, alreadyEarned: items => `已经获得：${items}`, newPostcards: count => `+${count} 张新明信片`, none: '无', spinWin: '转盘获胜', solvedReward: '解开棋盘', solvedAndTranslated: '解开并翻译', bronze: '铜牌等级', silver: '银牌等级', gold: '金牌等级', platinum: '白金等级', learning: '单词学习', learningNone: '本次尝试没有改变单词学习记录。', learningNew: '新记录', learningState: (box, seen, correct, misses, lookups, clues, guesses) => `盒 ${box}；见过 ${seen}；正确 ${correct}；错误 ${misses}；查阅 ${lookups}；线索绿色 ${clues}；猜测绿色 ${guesses}`, learningChange: (word, before, after) => `${word}：${before} → ${after}` },
}

/** C1-11's deferred result catalogue; all 11 interface languages live here so
 * the ordinary offline shell does not carry a result screen until it is used. */
export const RECEIPT_UI = {
  ...(copies[UI_LANGUAGE] ?? copies.en),
  ...(finishHeaderCopies[UI_LANGUAGE] ?? finishHeaderCopies.en),
  ...(stampCopies[UI_LANGUAGE] ?? stampCopies.en),
}
