import type { Catalogue } from '../en'

/**
 * Casey est « elle » (UL12). Tu, jamais vous. Phrases courtes — elles tiennent
 * dans une bulle sur un téléphone de 360 pixels de large.
 *
 * Un « conseil » est ce qu’elle dit sur l’accueil ; ce qu’on avance en
 * devinant est une proposition — sinon indice, conseil et proposition se
 * confondraient.
 *
 * Quelques valeurs portent exprès une espace au début ou à la fin : ce sont
 * les moitiés d’une phrase qui entoure un <strong> ou un <code>.
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts:
    'Quand tu devines, ce sont les verts de Casey qui comptent. Sa clé, pas la tienne.',
  tipCollectBothWays:
    'Récolte un mot en donnant un indice dessus ET en le devinant : un vert dans chaque sens.',
  tipWrapToKeep: 'Les mots récoltés se cassent encore en route. Emballe-les pour les garder.',
  tipEarnWrapUp:
    'Trois manches gagnées donnent une manche d’emballage. Garde-en jusqu’à trois, et dépense-en une quand tu as beaucoup récolté. Elle range jusqu’à quinze mots.',

  tipTapCaseyForCase:
    'Touche Casey pour ouvrir la valise. Chaque mot que tu récoltes voyage ici.',
  tipWrapUpCardsStartInEnglish: (language) =>
    `Dans une manche d’emballage, les cartes commencent sur leur face. Écris le mot en ${language} pour les ranger.`,
  tipWrapUpSkipAllowed:
    'Passer une carte dans une manche d’emballage est permis, mais elle ne sera pas emballée cette manche-là.',
  tipLastChance:
    'Plus d’indices, ce n’est pas la fin du jeu : la dernière chance te laisse continuer à nommer des mots.',
  tipLookUpMidRound: (language) =>
    `Cherche un mot en pleine manche depuis la case d’indice. Ta langue entre, le ${language} sort.`,
  tipWrapCityOpensRoad: 'Emballe les cent mots d’une ville et la route s’ouvre.',

  wordOfTheDay: (word, meaning) => `Mot du jour : ${word} (${meaning}).`,

  personalTrickyWord: (word, meaning, misses) =>
    `Un mot à surveiller : ${word} (${meaning}). Il t’a déjà piégé ${misses}×.`,
  personalBestWord: (word, meaning, greens) =>
    `Celui-là, tu le connais : ${word} (${meaning}). Déjà ${greens}× en vert.`,
  personalCluedTogether: (a, b, times) =>
    `Toi et moi, on se comprend sur ${a} et ${b} : tes indices les ont trouvés ensemble ${times}×.`,
  personalFavouriteClue: (clue, times) =>
    `Ton indice préféré, c’est «${clue}» : déjà donné ${times}×.`,
  personalGames: (played, won) =>
    `Nos parties ensemble : ${played}. Nos victoires : ${won}.`,

  notAnsweredBubble: 'Je n’ai pas encore répondu. Touche ici pour tester la connexion →',
  notAnsweredAria: 'Casey n’a pas encore répondu. Ouvre les Réglages et teste la connexion',
  bubbleAria: (line) => `Casey dit : ${line} Touche pour un autre conseil.`,
  suitcaseAria: 'Ouvrir la valise : ta collection',

  lookingAgain: 'Laisse-moi regarder le plateau encore une fois.',
  asFarAsIDare: 'Je n’ose pas aller plus loin.',
  withSecondChoice: (reasoning, word) => `${reasoning} Mon second choix aurait été ${word}.`,




  // « Casey normale est prête par défaut. … »



  // « Touche Tester la connexion ci-dessous pour que Casey réponde par ce
  // chemin complet. … »




  // « Pour une copie de développement privée, utilise l’adresse de son service
  // Casey suivie de /v1 dans URL de base … » — « URL de base » est le nom du
  // champ des Réglages et s’écrit comme là-bas.


}
