import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous. Ranger et emballer sont deux choses, comme en
 * anglais : on RANGE une carte dans la manche d’emballage ; un mot qui y a
 * survécu est EMBALLÉ et repose dans le fond de la valise — c’est ce nombre-là
 * qui compte sur l’accueil et sur la carte. Les villes sont des étapes ; la
 * halte linguistique est facultative et s’appelle ainsi partout.
 */
export const home: Catalogue['home'] = {
  brandName: '900words',
  // ── Accueil ─────────────────────────────────────────────────────────────
  settingsAria: 'Réglages',
  openMapAria: 'Ouvrir la carte',
  homeMapAria: (stop, stops, city) => `Étape ${stop} sur ${stops} : ${city}`,
  needsPass: 'Le prochain train demande un abonnement',
  wrappedWord: 'emballés',
  collectedCount: (collected) => `${collected} récoltés`,
  journeyDone: (city) => `Tu as bouclé la dernière valise à ${city}.`,
  momentumLine: 'Joue 3 plateaux par jour et tu peux réunir tous les mots en 90 jours.',
  dailyPlayedAria: (outcome) => `Défi du jour : joué aujourd’hui (${outcome})`,
  dailyAria: 'Défi du jour : un même plateau pour tous, chaque jour',
  play: 'Jouer',
  continueGame: 'Reprendre la partie',
  continueWrapUp: 'Reprendre l’emballage',
  continueReview: 'Reprendre la révision',
  continuePrimary: 'Reprendre la grille', continueReplay: 'Reprendre la reprise', returnToPrimary: 'Revenir à ta grille',
  viewResult: 'Voir le résultat', improveBoards: 'Améliorer tes grilles', postcardsEarned: 'cartes postales gagnées',
  postcardsRemaining: (remaining) => `${remaining} carte${remaining === 1 ? '' : 's'} postale${remaining === 1 ? '' : 's'} avant le voyage`, postcardReadiness: (earned, remaining) => `${earned} cartes postales gagnées ; ${remaining} avant le voyage.`,
  readyToTravel: 'Prêt à voyager', nextStopNotReleased: (city) => `Prêt à voyager. ${city} n’est pas encore disponible.`, cityMedalInProgress: 'pas encore gagnée', cityMedal: (tier) => `Médaille de la ville : ${tier}`,
  backToCity: (city) => `Retour à ${city}`,

  // ── La carte ────────────────────────────────────────────────────────────
  back: 'Retour',
  journeyTitle: 'Le voyage',
  mapAria: (country, stop, stops, city) =>
    `Carte : ${country}. Étape ${stop} sur ${stops} : ${city}.`,
  stopAria: (city, stop, status) => `${city}, étape ${stop}, ${status}`,
  statusVisited: 'visitée',
  statusHere: 'tu es ici',
  statusNotReached: 'pas encore atteinte',
  statusAhead: 'plus loin',
  stopOf: (stop, stops) => `Étape ${stop} sur ${stops}`,
  // « arrivée » est ici le nom (l’arrivée), donc sans accord à faire.
  arrivedOn: (date) => `arrivée le ${date}`,
  previousStopAria: 'Étape précédente',
  nextStopAria: 'Étape suivante',
  wordsWaiting: (words, city) => `${words} mots t’attendent. Atteins ${city} pour les débloquer.`,
  lookAhead: 'Voir plus loin',
  travelAhead: 'Aller plus loin',
  enableTravelAhead: 'Activer « Aller plus loin »',
  mapCounts: (goal, collected, discovered) =>
    `/ ${goal} emballés · ${collected} récoltés · ${discovered} découverts`,
  suitcasePacked: 'valise bouclée',
  lineClosedNote: 'Ligne fermée pour travaux. Touche le train pour lire l’avis.',
  travelBackTo: (city) => `Revenir → ${city}`,
  travelOnTo: (city) => `Poursuivre → ${city}`,
  trainToClosed: (city) => `Train pour ${city} : ligne fermée`,
  getPassFor: (city) => `Obtenir un abonnement pour ${city}`,
  mapCredit: 'Kort · données cartographiques : Geodatastyrelsen / DAGI (FOT), 1:500 000',
  backToTheMap: 'Retour à la carte',

  // ── Le train, sur les deux écrans ───────────────────────────────────────
  trainJourneyOver: 'La valise est bouclée. Le voyage est terminé.',
  trainReady: (city) => `La valise est bouclée. Le train pour ${city} est prêt.`,
  wordsToFinish: (words) =>
    `Il te manque encore ${words} ${words > 1 ? 'mots emballés' : 'mot emballé'} pour finir le voyage.`,
  wordsToTrain: (words, city) =>
    `Il te manque encore ${words} ${words > 1 ? 'mots emballés' : 'mot emballé'} avant de prendre le train pour ${city}.`,
  boardTrain: (city) => `Monter dans le train pour ${city}`,

  // ── Arriver ─────────────────────────────────────────────────────────────
  arrivalAgain: (words) =>
    `Te revoilà ! Tes ${words} mots d’ici sont toujours dans la valise. Rejoue-les, ou poursuis le voyage quand tu veux.`,
  arrivalNew: (words) => `${words} nouveaux mots à découvrir. Casey est ouverte et les attend.`,
  getStarted: 'C’est parti',
  seeTheMap: 'Voir la carte',

  // ── La valise ───────────────────────────────────────────────────────────
  suitcaseTitle: 'La valise',
  filterAria: 'Filtrer la valise par ville',
  filterAll: 'Toutes',
  pagerPreviousAria: (band) => `${band}, page précédente`,
  pagerNextAria: (band) => `${band}, page suivante`,
  looseLabel: (words) => `Encore dehors : ${words}`,
  looseEmpty: 'Rien ne traîne. Chaque mot d’ici est dans la valise.',
  lidLabel: (words) => `Récoltés : ${words}`,
  lidEmpty:
    'Donne un indice sur un mot et devine-le, un vert dans chaque sens, pour le récolter dans le couvercle.',
  trayLabel: (words, goal) => `Emballés : ${words} sur ${goal}`,
  trayEmpty:
    'Rien dans le fond pour l’instant. Les manches d’emballage y rangent les mots pour de bon.',
  undiscoveredAria: 'Mot non découvert',
  wordAria: {
    undiscovered: (word) => `${word}, non découvert`,
    discovered: (word) => `${word}, découvert`,
    collected: (word) => `${word}, récolté`,
    wrapped: (word) => `${word}, emballé`,
  },
  wrapUpWords: 'Emballer des mots',
  wrapUpBankedAria: (banked) => `Emballer des mots : ${banked} en réserve`,
  postcardBalance: (banked) => `Cartes postales · ${banked}`,
  postcardHelp: 'Besoin de la réponse ? Utilise une carte postale.',
  packingAnswerShown: 'Réponse affichée. Appuie sur Emballer.',
  packingNoPostcards: 'Gagne une manche normale pour obtenir une carte postale.',
  packingFirstPostcardHint: (language) => `Tape le mot en ${language} pour emballer. Une carte postale le révèle.`,
  packingPostcardTitle: (state, language) => state === 'shown' ? 'Afficher encore cette réponse gratuitement.' : state === 'select' ? 'Choisis d’abord une carte non emballée.' : state === 'empty' ? 'Gagne une manche normale pour obtenir une carte postale de traduction.' : `Dépense une carte postale pour révéler la réponse en ${language} de cette carte.`,
  packingPostcardAria: (shown, banked) => shown ? 'Afficher encore la traduction gratuitement' : `Utiliser une carte postale de traduction : ${banked} disponibles`,
  packingPostcardShowAnswer: 'Afficher la réponse',
  usePostcard: 'Utiliser une carte postale',
  wrapUpContinueAria: 'Reprendre la manche d’emballage en cours',
  hintWrapUpWaiting:
    'Une manche d’emballage est déjà en cours. Reprends-la où tu l’as laissée.',
  hintCollectFirst: (city) =>
    `Récolte d’abord un mot à ${city}, un vert dans chaque sens, et une manche d’emballage aura quelque chose à ranger.`,
  hintFirstWrapUp: (wins) =>
    `Gagne ${wins} ${wins > 1 ? 'manches' : 'manche'} pour obtenir ta première manche d’emballage.`,
  hintMoreWins: (wins) =>
    `Encore ${wins} ${wins > 1 ? 'victoires' : 'victoire'} pour obtenir une manche d’emballage.`,
  hintPacksRange: (collected, city) =>
    `${collected} récoltés à ${city}. Une manche d’emballage en range 13 à 15, selon sa clé.`,
  hintPacksUpTo: (collected, city, cap) =>
    `${collected} récoltés à ${city}. La prochaine manche d’emballage peut en ranger jusqu’à ${cap}, selon sa clé.`,

  // ── Le poste de rangement, en haut d’une manche d’emballage ─────────────
  packWord: (word) => `Ranger «${word}»`,
  // Court exprès : ce titre partage sa ligne avec le compte et ne passe pas
  // à la ligne. « Ranger le plateau » plus « — 3 sur 12 » déborde à 360 px.
  packTheBoard: 'Rangement',
  packCount: (packed, packable) => `(${packed} sur ${packable})`,
  startEarlyWarning: (remaining) =>
    `Lancer avec ${remaining} ${remaining > 1 ? 'cartes non rangées' : 'carte non rangée'}. Elles restent en anglais et ne seront pas emballées cette manche`,
  startEarly: (remaining) => `Lancer avec ${remaining}`,
  tapEnglishCard: 'Touche une carte anglaise',
  theWordFor: (language, word) => `${word} en ${language}`,
  tapEnglishCardFirst: 'Touche d’abord une carte anglaise',
  pack: 'Ranger',
  packMiss: 'Raté. Cette erreur est notée. Continue d’essayer.',
  packFirstTime:
    'Écris le danois pour ranger. Lancer plus tôt laisse les cartes en anglais, sans emballage.',
  packRecall: 'Le dictionnaire est fermé. C’est à ta mémoire de jouer.',
  packTapAndType: (language) => `Touche une carte anglaise et écris le mot en ${language}.`,

  // ── L’abonnement ────────────────────────────────────────────────────────
  passBackAria: 'Retour à la carte',
  passTitle: 'Prochains trains',
  passKicker: 'Tes deux premières villes sont gratuites.',
  passHeading: 'Un abonnement pour le reste du Danemark',
  passIntro:
    'Malheureusement, les transports en commun ne sont pas gratuits au Danemark. Pour monter dans les prochains trains, il te faut un abonnement.',
  passOptionsAria: 'Formules d’abonnement',
  passMonthly: 'Abonnement mensuel',
  passMonthlyHelp: 'Continue à voyager tant que ton abonnement est actif.',
  passLifetime: 'Abonnement à vie',
  passLifetimeHelp: 'Un seul abonnement pour tous les voyages que nous publierons.',
  passPriceMonthly: '1,99 / mois',
  passPriceLifetime: '19,99 en une fois',
  passReady: 'Ton abonnement est prêt. Le prochain train est ouvert.',
  passRestore: 'Restaurer les achats',
  passRedeem: 'Utiliser un code App Store',
  passKindness: 'Apprendre ne devrait pas dépendre de l’argent.',
  // « … envoie-la à ⟨adresse⟩ pour recevoir … » : l’adresse est entourée
  // d’espaces par le balisage, d’où l’absence de ponctuation aux bords.
  passReviewBefore: 'Écris un avis sur l’App Store, prends-le en photo et envoie-la à',
  passReviewAfter:
    'pour recevoir un code d’abonnement de 6 mois. Ton avis peut être bon ou mauvais, selon ce que tu penses de l’appli.',

  // ── Offre après la limite quotidienne ────────────────────────────────────
  dailyLimitKicker: 'Tes deux parties gratuites du jour sont terminées.',
  dailyLimitHeading: 'Continue à jouer avec Casey',
  dailyLimitBody: 'Reviens demain pour deux nouvelles parties gratuites, ou débloque les parties illimitées.',
  dailyLimitOptionsAria: 'Options pour jouer sans limite',
  dailyLimitMonthly: 'Mensuel',
  dailyLimitMonthlyHelp: 'Renouvellement mensuel automatique jusqu’à résiliation.',
  dailyLimitLifetime: 'Paiement unique',
  dailyLimitLifetimeHelp: 'Parties illimitées, sans abonnement.',
  dailyLimitUnavailable: 'Indisponible',
  dailyLimitCloseAria: 'Fermer la fenêtre de l’offre',
  dailyLimitRestore: 'Restaurer les achats',
  dailyLimitDismiss: 'Peut-être demain',
  dailyLimitDisclosure: 'Apple fournit les prix et confirme les achats. Gère ou résilie ton abonnement dans ton compte Apple.',
  passThanksHeading: 'Merci de soutenir le développement de 900words',
  passThanksBody: 'Le jeu illimité est débloqué.',
  passThanksContinue: 'Continuer à jouer',

  // ── La halte linguistique facultative ───────────────────────────────────
  stopKicker: 'Halte linguistique facultative',
  stopKindGrammar: 'Exercice de grammaire',
  stopKindSituation: 'Petite mise en situation',
  stopKindExit: 'Bilan d’étape facultatif',
  stopKindReview: 'Révision à faire',
  stopFocus: 'Ton prochain point de langue',
  stopNote:
    'Cette halte est enregistrée à part de ta valise. Elle ne change jamais les mots que tu peux ranger, ni le départ du train.',
  stopAuthoring:
    'Les consignes en danois et leur notation sont en cours d’écriture avec le contenu du cours. Garde cette halte pour plus tard, ou laisse-la dans ton guide ; aucun essai sur un contenu provisoire n’est enregistré comme preuve d’apprentissage.',
  stopContinue: 'Continuer',
  stopLater: 'Plus tard',
  stopSkip: 'Passer cette halte',
  stopStart: 'Commencer',
  stopOpen: 'Halte linguistique',

  // ── la ligne fermée ──────────────────────────────────────────────────────
  trainClosedLabel: (city) =>
    `Le train pour ${city} ne circule pas encore. La ligne est fermée pour travaux`,
  trainClosedTitle: 'La ligne est fermée pour travaux',
  trainClosedBody: (city, here) =>
    `Le train pour ${city} ne circule pas encore. Il y a des travaux sur la ligne. ` +
    `Il repartira bientôt, et on te le dira ici dès que ce sera le cas. ` +
    `D’ici là, ${here} est à toi : chaque plateau, chaque manche d’emballage et ta série.`,
  trainReopenedTitle: (city) => `Le train pour ${city} circule de nouveau`,
  trainReopenedBody:
    'La ligne est ouverte. Ta valise est bouclée et Casey est sur le quai. Monte quand tu veux.',

  // Current Settings and German-preview integration.
  previewHeading: "Pas encore de jeu de mots",
  previewNote: "La carte et le Guide de voyage sont là. Les plateaux, les indices et les enregistrements ne sont pas encore prêts.",
  previewGuideCta: "Ouvrir le Guide de voyage",
}
