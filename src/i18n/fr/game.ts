import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous. Casey est « elle ». Glossaire : une manche est un
 * plateau joué, un tour est un tour de jeu, un indice, une proposition (le mot
 * qu’on avance) et des essais (le compteur). « Deviner » est l’activité ;
 * quand le résultat suit dans la même phrase, Casey a « proposé » un mot, car
 * « deviné » sous-entendrait qu’elle a trouvé.
 *
 * Court : le plateau, le poste d’indice et l’écran de fin doivent tenir sans
 * défiler à 360×640.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Ta progression est préservée",
  legacyRetiredBody: "Une ancienne manche ne peut pas reprendre après cette mise à jour. Tes acquis et tes cartes postales enregistrés sont conservés. Continue avec la prochaine grille inachevée.",
  phaseGiveClue: 'Donne un indice à Casey',
  phaseCaseyGuessing: 'Casey devine',
  phaseCaseyClue: 'Casey prépare un indice',
  phaseYourGuess: 'À toi de deviner',
  phaseLastChance: 'Dernière chance: plus d’indices',
  phaseRoundOver: 'Manche terminée',
  phasePackTheBoard: 'Ranger le plateau',

  announceCaseyGuess: (word, result) => `Casey a proposé ${word}: ${result}.`,
  // « correct » s’écrirait pareil qu’en anglais, ce que la porte 3 refuse ;
  // « juste » est le mot français du jeu de toute façon.
  resultCorrect: 'juste',
  resultNeutral: 'carte neutre',
  announceCaseyThinking: 'Casey réfléchit.',

  skip: 'Passer',
  homeAria: 'Accueil',
  dealNewWordsAria: 'Distribuer de nouveaux mots',
  hideTranslationsAria: 'Masquer les traductions',
  showTranslationsAria:
    'Afficher toutes les traductions. Compte comme une recherche pour chaque mot non résolu',

  errorRetry: 'Réessayer',
  errorCaseySettings: 'Réglages de Casey',
  practiceNote: 'Prototype expérimental sans agent. Ce n’est ni Casey, ni le jeu normal.',

  studyTitle: 'Étudier le plateau',
  studyHint:
    'Toutes les traductions sont affichées. Elles se cachent quand tu commences, et un toucher en cherche une.',
  studyStart: 'Lancer la manche',

  cardYourTarget: ', ta cible',
  cardFound: ', trouvée',
  cardMissedKey: ', un des mots de Casey, non trouvé',
  cardNeutralBoth: ', neutre pour les deux camps',
  cardNeutralPlayer: ', neutre sous tes indices',
  cardNeutralCasey: ', neutre sous les indices de Casey',
  cardUnpacked: ', non rangée',
  cardTranslationRevealed: ', traduction affichée',
  cardNotYetPacked: (language) => `, pas encore rangée. Touche pour écrire le mot en ${language}`,
  cardNotYoursToWrap: ', pas encore à toi pour l’emballage',
  cardTapToHear: '. Toucher pour écouter',
  lookUpAria: (word) => `Chercher ${word}`,

  cluePlaceholder: 'Ton indice',
  clueFieldAria: (language) => `Ton indice d’un mot, en ${language}`,
  fewerWordsAria: 'moins de mots',
  moreWordsAria: 'plus de mots',
  wordCountAria: (n) => `${n} ${n > 1 ? 'mots' : 'mot'}`,
  giveClue: 'Donner l’indice',
  giveItAnyway: 'Le donner quand même',
  askingCasey: 'On demande à Casey…',
  firstClueHint: (language) => `Un mot en ${language}. Pas d’idée ? Le dictionnaire à côté traduit.`,
  tutorialClueHint:
    'Je lis les indices en danois. Un doute ? Essaie. Le dictionnaire peut t’aider.',
  wrapPlayerKeyHint: 'Ton cadre vert est de retour. C’est ta clé privée. Casey ne la voit pas.',
  looksEnglishFull: (word, language) =>
    `«${word}» ressemble au sens d’un mot de carte. Touche-le pour le mot en ${language}, ou donne-le quand même et Casey vérifiera.`,
  looksEnglishShort: 'ressemble au sens d’un mot de carte. Touche-le, ou donne-le quand même',

  caseysClueLabel: 'Indice de Casey',
  lookUpInDictionaryAria: (word) => `Chercher «${word}» dans le dictionnaire`,
  guessesLeft: (n) => `encore ${n} ${n > 1 ? 'essais' : 'essai'}`,
  guessWord: (word) => `Proposer «${word}»`,
  cancel: 'Annuler',
  stopKeepWhatWeHave: 'Arrêter et garder ce qu’on a',
  guessPrompt: 'Touche un mot auquel Casey pense, selon toi.',
  firstGuessHint:
    'La clé de Casey compte maintenant. Touche un mot que son indice désigne.',
  wrapCaseyKeyHint:
    'La clé de Casey est secrète. Devine ce que son indice désigne. Ses verts comptent maintenant.',
  tutorialLookupHint: 'Touche ⓘ à côté d’un mot pour chercher sa traduction en un geste.',

  suddenDeathRule: 'Nomme des verts pour gagner. Tout autre choix met fin à la manche.',
  nameWord: (word) => `Nommer «${word}»`,
  giveUpRound: 'Abandonner la manche',

  // ── la roue de traduction (la dernière chance, refonte 2026-09-16) ───────
  wheelLede: (language) => `La roue décide de la manche. Réécris les mots en ${language} pour la remplir, puis fais-la tourner. Le vert gagne.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Écris en ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Écris en ${language} la traduction de l’un de ces mots : ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', traduction donnée' : ', traduction attendue',
  wheelRetryLine: 'Ce n’est pas ça. Réessaie. Tu ne perds rien.',
  wheelSubmit: 'Ranger',
  wheelSpinAria: 'Faire tourner la roue',
  wheelSpinning: 'Elle tourne…',
  wheelWonLine: 'Vert ! La manche est gagnée.',
  wheelMissLine: 'Pas de vert. La manche est perdue.',
  wheelLedeMissed: (found, total, language) =>
    `Tu en as trouvé ${found} sur ${total}. Pour les mots restés sur le plateau, la roue reste grise. Écris le reste en ${language}, puis fais-la tourner.`,
  wheelAnswersLine: 'Les mots en gris sont les réponses que tu n’as pas écrites.',
  wheelSeeResults: 'Voir les résultats',
  phaseTranslateChallenge: 'Place à la traduction',
  settlementFailed: 'Ton résultat n’a pas encore pu être enregistré. Garde cette manche et réessaie.',
  settlementSaving: 'Enregistrement de ton résultat…',
  guidanceTranslationBody: (language) => `Les valises montrent le sens des mots trouvés. Réécris chacun en ${language} pour remplir la roue, puis fais-la tourner. Le vert gagne la manche.`,
  guidanceStartTranslation: 'Commencer à traduire',
  phaseTranslateWheel: 'La roue: le tournoiement décide de la manche',

  // ── le panneau d’arrivée de la dernière chance ────────────────────────────
  /** La phrase de la fenêtre quand les indices s’épuisent et que l’épreuve de la roue commence (propriétaire, 17-09-2026) — dans la voix de wheelLede. */
  guidanceLastChanceWheel:
    'Tu n’as plus d’indices, donc voici la fin. Traduis les mots ramassés pour remplir la roue, puis fais-la tourner. Le vert gagne la manche.',

  caseyIsThinking: 'Casey réfléchit…',
  offlineCaseyIsThinking: 'Casey hors ligne réfléchit. C’est plus long.',
  offlineRoundPrompt: 'Pas d’internet. Jouer la fin de cette manche avec Casey hors ligne ? Elle est plus lente.',
  playOfflineButton: 'Jouer hors ligne',
  onlineAgainTitle: 'Internet est revenu',
  onlineAgainBody:
    'Jouer la fin de cette manche avec Casey normale ? Elle est plus rapide et joue mieux. Si ta connexion coupe souvent, rester hors ligne peut être plus stable.',
  playOnlineButton: 'Jouer en ligne',
  stayOfflineButton: 'Rester hors ligne',
  hurryCaseyTitle: 'Toucher pour presser Casey',
  hurryCaseyHint: 'Touche ici pour presser Casey.',
  caseyGuessedWord: (word) => `Casey a proposé «${word}».`,
  caseyChoosingWord: 'Casey choisit un mot…',
  caseyChoosingWhether: 'Casey hésite à deviner…',
  guessGotOne: '. Trouvé !',
  guessNeutral: '. Carte neutre.',

  turnTokensAria: (given, total, left) =>
    `${given} indices donnés sur ${total}, ${left} ${left > 1 ? 'restants' : 'restant'}.`,
  cluesGivenCount: (given, total) => `${given}/${total} indices donnés`,

  leaveTitle: 'Quitter cette manche ?',
  leaveBody:
    'Mettre en pause garde ce plateau exactement en l’état. Annuler le jette, et Jouer lance alors une nouvelle manche.',
  leaveKeepPlaying: 'Continuer à jouer',
  leavePause: 'Mettre en pause',
  leaveCancelRound: 'Annuler la manche',

  guidanceCaseyTitle: 'Le premier indice de Casey',
  guidancePlayerTitle: 'À toi !',
  guidanceWordCount: (n) => `${n} ${n > 1 ? 'mots' : 'mot'}`,
  guidanceCaseyBody: 'Trouve les mots qui vont avec l’indice de Casey.',
  guidancePlayerBody:
    'Écris un mot danois qui relie 1 à 4 de tes mots verts. Utilise le dictionnaire si tu ne connais pas le mot en danois.',
  guidanceHideReminder: 'Ne plus me le rappeler',
  guidanceStartGuessing: 'Commencer à deviner',
  guidanceWriteClue: 'Écrire un indice',
  guidanceLastChanceTitle: 'Dernière chance',
  guidanceLastChanceBody:
    'Tu n’as plus d’indices. Mais tu peux encore gagner. Continue à deviner d’après les indices précédents. Mais une seule erreur, et tu perds.',
  guidanceKeepNaming: 'Continuer à nommer',
  guidancePackingTitle: 'Range d’abord le plateau',
  guidancePackingBody:
    'Tape le mot danois de chaque carte, l’une après l’autre. Quand elles sont toutes tapées, ou que tu ne peux pas aller plus loin, lance la manche.',
  guidanceStartPacking: 'Commencer à ranger',

  dictionaryPlaceholder: 'Dictionnaire',
  dictionaryFieldAria: (language) => `Mot à traduire, ${language} ou ta langue`,
  dictHitAria: (entry) => `${entry} : ouvrir le dictionnaire`,
  approximateFrom: (term) => ` (d’après ${term})`,
  onTheBoardNote: ' (sur le plateau)',
  translateFailed: 'Impossible de traduire ça.',
  lookupsUsed: 'Plus de recherches possibles.',
  dictionaryPracticeOnly: 'Ici, seulement les 900 mots.',
  sayAgainAria: (word) => `Redire ${word}`,
  saySlowlyAria: (word) => `Dire ${word} lentement`,
  sayExampleAria: 'Redire la phrase d’exemple',
  sayExampleSlowlyAria: 'Dire la phrase d’exemple lentement',
  recordingsUnavailableNote: ' · enregistrements normal et lent indisponibles',
  recordingFailedNote: ' · enregistrement non chargé',
  close: 'Fermer',

  caseysCalls: 'Décisions de Casey',
  turnCount: (n) => `${n} ${n > 1 ? 'tours' : 'tour'}`,
  logHint: 'Touche ⚑ sur tout ce que Casey a mal décidé. Elle voit ce que tu signales.',
  logYou: 'Toi',
  logFor: 'pour',
  flagClueLabel: (clue) => `Indice de Casey «${clue}»`,
  flagGuessLabel: (word) => `Proposition de Casey «${word}»`,
  flagOnAria: (label) => `${label}, signalé comme mauvaise décision. Toucher pour annuler`,
  flagOffAria: (label) => `Signaler ${label} comme mauvaise décision`,
  guessCorrectSr: ', juste',
  guessNeutralSr: ', carte neutre',
  // Espace insécable avant le signe %, comme le veut la typographie française.
  confidenceSure: (percent) => `${percent} % sûre`,
  noGuessMade: 'aucune proposition',

  ledgerEmpty:
    'Rien pour l’instant. Une ligne apparaît ici pour chaque indice de Casey une fois que tu as fini de deviner dessous.',
  ledgerArmHeading: 'source',
  ledgerCluesHeading: 'indices',
  ledgerFoundHeading: 'trouvés',
  ledgerRefusedHeading: 'refus',
  ledgerHitsTitle: (hits, asked) => `${hits} sur ${asked} mots visés`,
  ledgerRefusedTitle:
    'Combien de fois la première réponse de cette source a été rejetée et redemandée',
  ledgerExplainer:
    '« trouvés » est la part des mots visés par un indice que tu as vraiment retournés. « refus » est le nombre de fois où la première réponse du modèle a été rejetée et redemandée. Les sources hors ligne ne peuvent pas être refusées.',
  ledgerClear: 'Vider le registre',

  // Court exprès : à 360 px le titre est plafonné à 6,8vw, et
  // « Félicitations ! » n’y tient pas sur une ligne.
  outcomeWonTitle: 'Bravo !',
  outcomeWonSub: 'Tu as gagné une carte postale !',
  outcomeLostTitle: 'La prochaine fois',
  outcomeGivenUpSub: 'Manche abandonnée. Le lien était là.',
  outcomeWheelMissSub: 'La roue s’est arrêtée sur une valise que tu n’as jamais rangée.',
  /** La fin gagnante de la roue (propriétaire, 18-09-2026) : elle s'est arrêtée sur du vert. */
  outcomeWheelWinSub: 'La roue s’est arrêtée sur du vert. La manche est à toi.',
  outcomeWheelSpentSub: 'Le jeton a servi, et les indices se sont quand même épuisés.',

  resultLesson: 'Une nouvelle leçon facultative est prête dans le Guide.', resultOpenGrammar: 'Ouvrir la grammaire dans le Guide', resultOpenSurvival: 'Ouvrir la survie dans le Guide', resultBackToResult: 'Retour au résultat',

  roundStatsAria: 'Ce que cette manche a donné',
  newWordsLabel: (n) => (n > 1 ? 'nouveaux mots' : 'nouveau mot'),
  collectedForCasey: 'récoltés pour Casey ',
  wrapStatsAria: 'Ce que cette manche d’emballage a rangé',
  wrappedForGood: (named) => (named ? 'emballés pour de bon :' : 'emballés pour de bon'),
  stayedLabel: 'restés',

  // ── où la manche a laissé le voyage : la zone de lecture de l’emballage ──
  // Le chiffre est dessiné avant, dans sa propre balise : « 13 emballés à
  // Ribe · 87 à emballer avant le train pour Kolding ».
  wrapJourneyHeading: 'Le voyage',
  wrapJourneyAria: 'Le voyage après cet emballage',
  wrappedInCity: (_n, city) => `emballés à ${city}`,
  wrapJourneyTrainReady: (city) => `le train pour ${city} est prêt`,
  wrapJourneyOver: 'le voyage est terminé',
  wrapJourneyToGo: (_n, city) => `à emballer avant le train${city ? ` pour ${city}` : ''}`,

  wrapUpUnlocked:
    'Manche d’emballage débloquée. Elle range les mots récoltés dans la valise pour de bon. Ouvre la valise pour la dépenser.',
  wrapUpEarned: (banked) =>
    `Manche d’emballage gagnée. ${banked} en réserve. Dépense-en une dans la valise.`,
  postcardEarned: (banked) =>
    `+1 carte postale de traduction · ${banked} disponible${banked === 1 ? '' : 's'}`,
  wrapUpBankFull: (cap) =>
    `La réserve est pleine. La valise ne tient pas plus de ${cap} manches d’emballage. Dépense-en une et les victoires compteront de nouveau.`,
  winsToWrapUp: (n) =>
    `encore ${n} ${n > 1 ? 'victoires' : 'victoire'} pour une manche d’emballage`,
  wrapResultFirst:
    'Les cartes vertes rangées sont emballées pour de bon, que cette manche soit gagnée ou perdue.',
  wrapResultNothing:
    'Rien d’emballé. Un mot n’est emballé que s’il a été rangé ET trouvé vert, victoire ou défaite.',
  wrapResultLost:
    'Perdre ne t’a rien coûté ici. Une manche d’emballage garde ce que tu as rangé et trouvé vert, victoire ou défaite.',

  playAgain: 'Rejouer',
  playNextGame: 'Partie suivante',
  home: 'Accueil',
  postWrapChoicesAria: 'Choix après l’emballage',
  postWrapHeading: 'Et maintenant ?',
  postWrapGrammar: 'Grammaire',
  postWrapSurvival: 'Survie',
  postWrapBoth: 'Les deux',
  postWrapBothNote: 'La grammaire d’abord, puis directement l’échange.',
  grammarNote: (city, topic, lessons) =>
    `Grammaire de ${city}${topic ? ` : ${topic}` : ''}${lessons > 1 ? `, ${lessons} leçons.` : '.'}`,
  // « échange » est le mot du glossaire ; la conversation qu’il contient est
  // donc « le dialogue », et la ligne ne dit pas deux fois le même mot.
  survivalNextNote: (number, total, title) =>
    `Échange ${number} sur ${total} : ${title}. Les phrases, puis le dialogue.`,
  survivalAllReadTitle: 'Les quatre échanges sont déjà lus.',
  survivalLockedTitle: 'Termine une manche d’emballage pour débloquer l’échange suivant.',
  survivalLockedNote: 'L’échange suivant se débloque à la fin d’une manche d’emballage.',

  sentenceReviewAria: 'Révision des phrases',
  hearItInDanish: 'Écouter en danois',
  legendGreenLabel: 'Vert',
  // Colle au <mark> sans espace de balisage : l’insécable avant « : » est ici.
  legendGreenMeaning: ' : le mot que tu as trouvé.',
  legendUnderlinedLabel: 'Souligné',
  legendUnderlinedMeaning: (city) => ` : les petits mots de ${city}.`,
  legendTapToHear: 'Touche pour écouter.',

  reviewTitle: 'Révision du plateau',
  reviewProgress: (current, total) => `${current} sur ${total}`,
  reviewOptional: 'Facultatif · une phrase par indice',
  reviewListen: 'Écouter',
  reviewListenSlowlyAria: 'Écouter lentement',
  reviewNoRecordings: 'Enregistrements normal et lent indisponibles.',
  reviewRecordingUnavailable: 'Enregistrement indisponible.',
  reviewSoundOff: 'Le son est coupé ou la lecture a été arrêtée.',
  reviewShowTranslation: 'Voir la traduction',
  reviewHideTranslation: 'Masquer la traduction',
  reviewAboutWord: 'À propos de ce mot',
  reviewNoNotes: 'Pas de notes pour ce mot.',
  reviewNextSentence: 'Phrase suivante',
  reviewNothingThisRound:
    'Rien à revoir cette manche. Une phrase est proposée pour chacun de tes indices que Casey a bien deviné.',
  sentenceBandNoGreens: 'Aucun mot vert à mettre en phrase cette manche.',

  // ── pourquoi un indice a été refusé ──────────────────────────────────────
  clueNotSingleWord: 'l’indice doit être un seul mot',
  clueOnBoard: (clue) => `« ${clue} » est un mot du plateau`,
  clueTypoOf: (clue, word) => `« ${clue} » pourrait être une faute de frappe pour « ${word} »`,
  clueGlossOnBoard: (clue, word) =>
    `« ${clue} » est la traduction de « ${word} » sur le plateau`,
  clueCompoundOfWord: (clue, word) => `« ${clue} » est un mot composé à partir de « ${word} »`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `« ${clue} » est un mot composé à partir de « ${gloss} », la traduction de « ${word} »`,
  clueFormOfWord: (clue, word) => `« ${clue} » est une forme de « ${word} »`,
  clueFormOfGloss: (clue, gloss, word) =>
    `« ${clue} » est une forme de « ${gloss} », la traduction de « ${word} »`,

  // ── les coups de pouce de la manche d’entraînement et le dictionnaire fermé ─
  practiceClueFinal: 'Pour ce dernier indice d’entraînement, relie le seul mot vert qui reste.',
  practiceClueMany: 'Pour cet indice d’entraînement, relie 2 ou 3 mots verts.',
  dictionaryClosed: 'Le dictionnaire reste fermé tant que ce n’est pas fini.',
}
