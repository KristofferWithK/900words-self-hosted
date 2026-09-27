import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous. Calme et factuel — et chaque panne dit ce qui
 * reste au joueur : « Ta manche est en sécurité. »
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "La modification de la sauvegarde n’a pas pu se terminer. Réessaie avant de continuer à jouer.",
  // ── la connexion de Casey ────────────────────────────────────────────────
  caseyRefused:
    'Le serveur de Casey a refusé la demande. Ta manche est en sécurité. Réessaie dans un instant, ou vérifie la connexion de Casey dans les Réglages.',
  caseyDailyCap:
    'Casey a assez réfléchi pour aujourd’hui. La limite quotidienne de ce téléphone sur son serveur est atteinte ; elle se remet à zéro à minuit UTC. Ta manche est en sécurité ; Casey pourra continuer après.',
  baseUrlNotAbsolute:
    'L’URL de base doit être une adresse complète commençant par https://. Vérifie-la dans les Réglages.',
  baseUrlNotHttps:
    'L’URL de base doit utiliser https:// (http:// n’est permis que pour un serveur Casey local). Vérifie-la dans les Réglages.',
  baseUrlHasExtras:
    'L’URL de base ne peut contenir que l’adresse et le chemin du serveur Casey, sans identifiants, paramètres ni fragment. Vérifie-la dans les Réglages.',
  selfHostedCaseyRequired: 'Configure Casey dans les Réglages : ajoute ta propre clé d’IA ou télécharge Gemma.',
  ownKeyRefused: 'Ton service d’IA a refusé la clé. Vérifie-la dans les Réglages.',
  ownKeyBadRequest: 'Ton service d’IA a refusé la requête. Vérifie le nom du modèle dans les Réglages.',
  ownKeyUnreachable: 'Impossible de joindre ton service d’IA.',
  caseyNoEndpoint:
    'Ce serveur Casey n’a pas encore le point d’accès de décision. Mets à jour ou redéploie le serveur, puis réessaie.',
  caseyBusy: 'Le modèle de Casey est occupé. Attends un instant et réessaie.',
  caseyRefusedView: 'Le serveur de Casey a refusé la vue du jeu.',
  caseyServerError: 'Le serveur de Casey n’a pas pu traiter la demande.',
  offline: 'Tu sembles hors ligne.',
  caseyTimeout: (seconds) =>
    `Casey a mis plus de ${seconds} secondes et la demande a été abandonnée. Ta manche est en sécurité ; réessaie quand la connexion sera plus stable.`,
  caseyUnreachable:
    'Impossible de joindre Casey. La connexion a été coupée, ou le serveur a refusé la demande du navigateur (CORS). Réessaie ; si ça continue, vérifie l’URL de base dans les Réglages.',
  caseyNonJson: 'Le serveur de Casey a renvoyé une réponse qui n’est pas du JSON.',
  caseyBadShape: 'Le serveur de Casey a renvoyé une réponse de forme inconnue.',
  caseyPingFailed: 'Casey n’a pas répondu au test de connexion.',

  // ── une version plus récente attend ──────────────────────────────────────
  updateReady: 'Une nouvelle version de 900words est prête.',
  updateReload: 'Recharger',
  updateLater: 'Plus tard',
  offlineReady: 'Prêt à jouer hors ligne.',

  // ── un enregistrement qui n’est pas arrivé ───────────────────────────────
  // Les cinq noms ci-dessous sont masculins, d’où « chargé ».
  audioFailed: (what) => `${what} n’a pas pu être chargé.`,
  audioWord: 'L’enregistrement du mot',
  audioExample: 'L’enregistrement de la phrase',
  audioChapter: 'L’enregistrement de la leçon',
  audioTask: 'L’enregistrement',
  audioSurvival: 'L’enregistrement',

  // ── une progression retrouvée sous une ancienne clé ──────────────────────
  rescuedProgress: (city, packed) =>
    `Progression retrouvée d’une ancienne version : ${city}, ${packed} ${packed > 1 ? 'mots emballés' : 'mot emballé'}. Remise en place.`,
  rescuedAck: 'D’accord',

  // ── ce qu’Apple a répondu au sujet d’un abonnement ───────────────────────
  passPending:
    'Apple confirme encore cet abonnement. Laisse l’appli ouverte, puis essaie « Restaurer les achats ».',
  passCancelled: 'Aucun achat effectué.',
  passUnavailable: 'Les abonnements sont disponibles dans l’appli iOS.',
  passError: 'Apple n’a pas pu vérifier cet abonnement. Réessaie.',
  passNotEntitled: 'Aucun abonnement trouvé pour ce compte Apple.',
  passRestoreUnavailable: '« Restaurer les achats » est disponible dans l’appli iOS.',
  passRestoreError: 'Apple n’a pas pu restaurer les achats. Réessaie.',
  passRedeemOpened: 'Apple a ouvert sa fenêtre d’utilisation de code.',
  passRedeemUnavailable: 'L’utilisation d’un code est disponible dans l’appli iOS.',

  // ── le stockage n’a pas voulu ────────────────────────────────────────────
  backupFileUnreadable: 'Ce fichier n’a pas pu être lu.',
  backupWriteFailed: 'Impossible d’écrire le fichier de sauvegarde.',
  clipboardBlocked:
    'Presse-papiers bloqué. Sélectionne le texte ci-dessous et copie-le toi-même.',

  // ── une sauvegarde que nous ne pouvons pas lire ──────────────────────────
  backupNotJson: 'Ce fichier n’est pas du JSON. Choisis le fichier exporté depuis ici.',
  backupTooNew:
    'Cette sauvegarde vient d’une version plus récente de 900words. Mets d’abord l’appli à jour.',
  backupNotOurs: 'Ce fichier n’est pas une sauvegarde 900words.',
  backupMaybeOtherApp: ' Il vient peut-être d’une autre appli.',
  companionFailed: 'Quelque chose a mal tourné en parlant à la partenaire IA.',
}
