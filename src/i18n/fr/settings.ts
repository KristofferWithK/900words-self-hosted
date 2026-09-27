import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous ; Casey est « elle ». Les Réglages expliquent, ils
 * ne jouent pas - Casey elle-même ne parle qu’à la question du rappel et dans
 * les notifications, tout en bas.
 *
 * Glossaire : un indice, une proposition (un essai de Casey ou du joueur), une
 * manche (un plateau), une partie (une des trois du jour), récolter (un mot),
 * emballé (un mot à l’abri pour de bon), une sauvegarde, la progression.
 */
export const settings: Catalogue['settings'] = {
  // ── l’écran ──────────────────────────────────────────────────────────────
  title: 'Réglages',
  backAria: 'Retour',

  // ── la langue de l’appli ─────────────────────────────────────────────────
  uiLanguageLabel: 'Ta langue',
  uiLanguageHelp:
    'La langue dans laquelle l’appli te parle. Changer recharge l’appli ; ta collection et ton voyage sont conservés.',

  // ── la langue apprise ────────────────────────────────────────────────────
  learnerLanguageLabel: 'Langue apprise',
  learnerLanguageHelp:
    'Chaque langue a son propre voyage. Reviens-y pour reprendre là où tu t’étais arrêté.',

  // ── le cerveau de Casey ──────────────────────────────────────────────────
  caseyBrainHeading: 'Le cerveau de Casey',
  caseyServerNote:
    'Casey joue depuis le serveur de 900words. Rien à configurer ; le bouton ci-dessous vérifie qu’elle répond.',
  normalOllamaCaseyLabel: 'Casey Ollama normale',
  normalOllamaCaseyDetail: 'gpt-oss 120B · indices et propositions',
  normalOllamaCaseyAria: 'Utiliser Casey Ollama normale',
  normalCaseyOn: 'Casey normale activée',
  normalCaseyOff: 'Casey normale désactivée',
  prototypeOn: 'Prototype sans agent activé',
  customCaseyOn: 'Service Casey personnalisé activé',
  normalCaseyDetail: 'Ollama joue et traduit. Gemma est désactivée.',
  gemmaModeDetail:
    'Gemma 4 E4B s’occupe des indices et des propositions. Les mots absents du dictionnaire passent toujours par Ollama.',
  prototypeDetail: 'Ce mode de test local n’est ni Casey, ni Ollama, ni Gemma.',
  customCaseyDetail:
    'Un Worker Casey personnalisé est sélectionné. Les mots absents du dictionnaire passent en ligne par ce service.',


  baseUrlLabel: 'URL de base',
  // Le chemin /v1 s’affiche en <code> entre les deux moitiés, sans espace
  // ajoutée - elles portent donc leurs espaces elles-mêmes.
  baseUrlHelpBefore:
    'Réglée par le bouton ci-dessus, ou saisis l’adresse de ton propre Worker Casey suivie de ',
  baseUrlHelpAfter:
    '. Elle doit commencer par https://, pour que rien de ta partie ne circule en clair.',
  baseUrlUnusable: 'Cette URL de base ne peut pas être utilisée.',

  // ── le modèle sur l’appareil ─────────────────────────────────────────────
  gemmaUnavailableNote: 'Le mode hors ligne fonctionne dans l’app iPhone de 900words.',
  gemmaReady: (size) => `Casey hors ligne est prête (${size} sur cet iPhone).`,
  gemmaRemoveConfirm: 'Supprimer Casey hors ligne de cet iPhone ? Tu pourras la retélécharger plus tard.',
  gemmaRemoveButton: 'Supprimer Casey hors ligne',
  gemmaProgressAria: 'Progression du téléchargement de Casey hors ligne',
  gemmaDownloading: (percent) => `${percent} % - laisse 900words ouvert en Wi-Fi.`,
  gemmaCancelDownloadButton: 'Annuler le téléchargement',
  gemmaDownloadNote: (size) =>
    `Casey hors ligne est un téléchargement de ${size}. Utilise le Wi-Fi et garde 900words ouverte jusqu’à la fin.`,
  gemmaDownloadButton: 'Télécharger Casey hors ligne',
  gemmaDownloadFailed: 'Échec du téléchargement.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Mode hors ligne',
  offlineModeExperimentalTag: 'Expérimental',
  offlineModeLabel: 'Jouer sans internet',
  offlineModeHelp:
    'Casey normale joue depuis le serveur de 900words. Avec le mode hors ligne, tu peux finir une manche avec Casey hors ligne sur cet iPhone quand internet n’est plus là. Elle est plus lente.',
  offlineModeAria: 'Mode hors ligne',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Le mode hors ligne est expérimental et encore en cours d’amélioration.\n\nLe mode hors ligne télécharge Casey hors ligne (${size}) sur cet iPhone. Utilise le Wi-Fi et garde 900words ouverte jusqu’à la fin du téléchargement.\n\nCasey hors ligne joue plus lentement que Casey normale.\n\nElle a besoin d’un iPhone plus récent : ${iphones}.${lowMemory ? '\n\nCet iPhone a moins de mémoire que ces modèles. Elle risque de ne pas y fonctionner.' : ''}\n\nTélécharger maintenant ?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'L’IA de Casey',
  ossCaseyHelp: 'Ce 900words, tu l’as compilé toi-même. Casey a besoin d’une IA pour jouer : ta propre clé d’IA, ou Gemma sur cet iPhone.',
  ownKeyOption: 'Ta propre clé d’IA',
  ownKeyHelp: 'N’importe quel service compatible OpenAI. Ta clé est stockée uniquement sur cet appareil et envoyée uniquement à l’adresse ci-dessous.',
  ownKeyAddressLabel: 'Adresse du service',
  ownKeyModelLabel: 'Modèle',
  ownKeyKeyLabel: 'Clé d’API',
  ownKeyAnswered: 'Ton service d’IA a répondu.',
  gemmaOption: 'Gemma sur cet iPhone',
  gemmaOptionHelp: 'Casey joue sur cet iPhone, sans internet et sans clé. Elle est plus lente.',
  serverOption: 'Ton propre serveur Casey',
  serverOptionHelp: 'Un Worker Casey que tu as déployé toi-même (voir le README).',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Ce 900words joue avec Casey sur ton iPhone : sans compte et sans clé. Elle se télécharge une seule fois (${size}). Utilise le Wi-Fi et garde 900words ouverte jusqu’à la fin.\n\nElle a besoin d’un iPhone plus récent : ${iphones}.${lowMemory ? '\n\nCet iPhone a moins de mémoire que ces modèles. Elle risque de ne pas y fonctionner.' : ''}\n\nTu peux aussi ajouter ta propre clé d’IA dans les Réglages.\n\nTélécharger Casey maintenant ?`,

  // ── le test de connexion ─────────────────────────────────────────────────
  testRunning: 'Test en cours…',
  testGemmaButton: 'Tester Casey sur l’appareil',
  testConnectionButton: 'Tester la connexion',
  connectionFailed: 'Échec de la connexion.',
  gemmaAnswered: 'Gemma a répondu sur cet iPhone.',
  normalCaseyAnswered: 'Casey Ollama normale a répondu.',
  customCaseyAnswered: 'Le service Casey personnalisé a répondu.',


  // ── le jeu ───────────────────────────────────────────────────────────────
  gameHeading: 'Jeu',
  soundLabel: 'Lire les mots à voix haute quand tu les touches',
  soundHelp:
    'Rien ne joue tout seul - chaque son suit un toucher, propositions de Casey comprises.',
  lookupExampleLabel: 'Lire la phrase d’exemple lors de la recherche d’une traduction',
  lookupExampleHelp: 'Sinon, la recherche utilise le réglage audio des mots.',
  replayIntroButton: 'Revoir l’intro',
  replayIntroHelp: 'La présentation de Casey, une fois de plus. Rien ne change dans ta progression.',

  // ── les outils de voyage du test de jeu ──────────────────────────────────
  playtestHeading: 'Test de jeu TestFlight',
  playtestTravelLabel: 'Me laisser sauter des villes et prendre n’importe quel train',




  // ── l’interrupteur du rappel quotidien ───────────────────────────────────
  reminderHeading: 'Rappel quotidien',
  reminderWebNote:
    'Les rappels quotidiens existent dans l’appli 900words pour iPhone. Ce navigateur ne demande jamais l’autorisation d’envoyer des notifications.',
  reminderDeniedNote:
    'Les notifications iPhone sont désactivées pour 900words. Active-les dans les Réglages de l’iPhone, puis reviens ici programmer le rappel quotidien de Casey.',
  reminderOpenSettingsButton: 'Ouvrir les réglages de notifications',
  // `time` arrive déjà formatée (« 15:00 ») : voir REMINDER_HOUR.
  reminderOnNote: (time) => `Casey passera te voir à ${time} sur cet iPhone.`,
  reminderTurningOff: 'Désactivation…',
  reminderTurnOffButton: 'Désactiver le rappel quotidien',
  reminderOffNote: (time) =>
    `Casey peut t’envoyer un rappel local à ${time}. Le message est composé sur cet iPhone à partir de ton nombre de jours accomplis ; aucun jeton d’appareil ni historique d’apprentissage n’en sort.`,
  reminderAsking: 'Demande à l’iPhone…',
  reminderTurnOnButton: 'Activer le rappel quotidien',

  // ── ta collection : la sauvegarde ────────────────────────────────────────
  collectionHeading: 'Sauvegarde',
  backupIntro:
    'Ta collection ne vit que sur ce téléphone. Une sauvegarde est un petit fichier - garde-en une en lieu sûr avant de changer de téléphone ou d’effacer les données de ton navigateur. Ta clé API n’y figure jamais.',
  backupSaveButton: 'Enregistrer une sauvegarde',
  backupRestoreButton: 'Restaurer depuis un fichier',
  backupShared: 'Sauvegarde transmise à ton téléphone.',
  backupDownloaded: 'Sauvegarde téléchargée.',
  backupHideText: 'Masquer la sauvegarde texte',
  backupShowText: 'Pas de sélecteur de fichier ? Passe par le texte',
  backupCopyButton: 'Copier ma collection',
  backupCopied: 'Sauvegarde copiée dans le presse-papiers.',
  backupPasteLabel: 'Colle une sauvegarde ici',
  backupReadButton: 'Lire',
  backupHoldsHeading: 'Cette sauvegarde contient',
  backupCollectedAfter: (met) => `mots récoltés, ${met} rencontrés en tout`,
  backupWrappedAfter: (city) => `emballés · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games > 1 ? 'manches jouées' : 'manche jouée'} · enregistrée le ${savedOn}`,
  backupMergeButton: 'Fusionner avec cet appareil',
  backupReplaceButton: 'Tout remplacer',
  backupCancelButton: 'Annuler',
  backupChoiceNote:
    'Fusionner garde le meilleur des deux historiques pour chaque mot : ça ne peut jamais te coûter un vert. Remplacer jette la progression de cet appareil.',
  backupReplaceConfirm:
    'Remplacer tout ce qui est sur cet appareil par la sauvegarde ? Tout ce que tu as appris depuis sa création sera perdu.',
  backupMerged: (collected) =>
    `Fusion faite. Rien de ce que tu avais n’est perdu - ${collected} mots récoltés ajoutés.`,
  backupRestored: (collected, wrapped) =>
    `${collected} mots récoltés et ${wrapped} mots emballés restaurés.`,

  // ── le registre des indices, pour le propriétaire ────────────────────────
  clueLedgerHeading: 'Les indices de Casey',

  // ── données ──────────────────────────────────────────────────────────────
  dataHeading: 'Données',
  usageStatsLabel: 'Statistiques d’usage anonymes',
  usageStatsHelp:
    'Des comptes seulement - manches jouées, où les joueurs s’arrêtent, si Casey ou un enregistrement a échoué. Ni mots, ni indices, ni identifiant d’aucune sorte.',
  usageStatsAria: 'Partager des statistiques d’usage anonymes',
  dataSharingPrivateTitle: 'Jeu privé',
  dataSharingPrivateDetail: 'Aucune donnée de jeu facultative ne quitte ce téléphone.',
  dataSharingDiagnosticsTitle: 'Diagnostics anonymes',
  dataSharingDiagnosticsDetail:
    'Partage le nombre de manches et leurs résultats, jamais tes mots ni tes indices.',
  dataSharingLearningTitle: 'Diagnostics + exemples pour entraîner Casey',
  dataSharingLearningDetail:
    'Partage aussi les indices, les propositions et les résultats pour que Casey s’améliore.',
  dataSharingAria: 'Partage des données',
  dataSharingCloseAria: 'Fermer sans choisir',
  dataSharingPromptTitle: 'Comment 900words peut-il utiliser tes parties ?',
  dataSharingPromptNote:
    'Rien n’est présélectionné. Chaque choix laisse tout le jeu ouvert, et tu peux le changer dans les Réglages.',
  dataSharingSettingsNote:
    'Sans choix, c’est le Jeu privé qui s’applique. Ceci ne concerne que les événements facultatifs ; Casey et la vérification passagère du plateau suivant traitent toujours le minimum de données nécessaire pour jouer.',
  dataSharingDeleting: 'Suppression des données partagées…',
  dataSharingDeleteButton: 'Supprimer les données partagées',
  resetConfirm: (language) =>
    `Remettre à zéro toute ta progression, ton voyage en ${language} et la partie en cours ?`,
  resetButton: 'Remettre à zéro',

  // ── le pied de page avec la version ──────────────────────────────────────
  buildStamp: (stamp) => `Version ${stamp}`,
  testFlightBuild: (build) => `Build TestFlight ${build} · `,
  keyboardReadoutNote: 'Affichage clavier activé. Touche la version cinq fois pour le masquer.',
  stateOn: 'activé',
  stateOff: 'désactivé',
  composerRideWaiting: 'désactivé (attend le document)',
  composerRideButton: (state) => `Saisie qui suit le clavier : ${state}`,
  trainStoryButton: (state) => `Récit du train : ${state}`,


  updateChecking: 'Vérification…',
  checkUpdatesButton: 'Rechercher des mises à jour',
  updateCurrent: 'À jour.',
  updateFound:
    'Une version plus récente se télécharge - ferme et rouvre l’appli pour l’adopter.',
  updateCheckFailed: 'Vérification impossible. Ferme et rouvre l’appli à la place.',

  // ── la seule question de Casey, sur le rappel quotidien ──────────────────
  reminderPromptCloseAria: 'Pas maintenant',
  reminderPromptTitle: 'Trois parties dans la valise !',
  reminderPromptBody: (time) =>
    `Ça fait ta journée. Je te rappelle demain, vers ${time} ? Un petit coup de coude dans l’après-midi, et tu peux le désactiver dans les Réglages quand tu veux.`,
  reminderPromptAccept: 'Oui, rappelle-moi',
  reminderPromptAsking: 'Demande à ton iPhone…',
  reminderPromptDecline: 'Non merci',

  // ── le rappel quotidien lui-même, écrit sur le téléphone ─────────────────
  reminderDoneTitle: 'Casey a bouclé sa valise pour aujourd’hui',
  reminderDoneBody: 'Trois parties sont bien à l’abri dans la valise. On continue demain.',
  reminderOneLeftTitle: 'Une petite partie avec Casey ?',
  reminderStreakBody: (days) =>
    `Encore une partie aujourd’hui, et ta série de ${days} jour${days > 1 ? 's' : ''} continue.`,
  reminderOneLeftBody: 'Encore une partie, et les trois d’aujourd’hui sont dans la valise.',
  reminderSeatTitle: 'Casey t’a gardé une place',
  reminderSeatBody: (games) =>
    `${games} ${games > 1 ? 'petites parties' : 'petite partie'} aujourd’hui ${games > 1 ? 'suffisent' : 'suffit'} pour lancer une série.`,

  // ── la puce du fournisseur ───────────────────────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "aperçu",
  learnerLanguagePreviewHelp: "L’allemand est un aperçu : la carte et le Guide de voyage sont là, mais pas le jeu de mots. Les leçons n’ont pas encore été vérifiées par une personne de langue maternelle allemande.",
  playtestTravelHelp: "Pour avancer, ouvre la carte, choisis une ville plus loin et touche Voyager plus loin. Aucun mot n’est emballé et aucune progression n’est ajoutée. Désactive cette option pour tester à nouveau les conditions normales du voyage.",
}
