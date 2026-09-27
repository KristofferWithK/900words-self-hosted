import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous. Le Guide de voyage parle calmement et avec
 * précision. Glossaire : « Survie » est la section, un « échange » un
 * dialogue qu’elle contient ; une « mise en situation » est l’activité que
 * l’anglais appelle « situation », mot qui s’écrirait pareil dans les deux
 * langues ; la halte linguistique s’appelle ainsi partout.
 */
export const guide: Catalogue['guide'] = {
  // ── le guide comme objet : couvertures, noms, sorties ────────────────────
  title: 'Guide de voyage',
  openGuideAria: 'Ouvrir le Guide de voyage',
  coverAria: 'Le guide de voyage de Casey',
  bookCoverAria: 'Couverture du Guide de voyage',
  backFromGuideAria: 'Quitter le Guide de voyage',
  backToGuideAria: 'Retour au Guide de voyage',
  backToHomeAria: 'Retour à l’accueil',
  backToCoverAria: 'Retour à la couverture du Guide de voyage',
  caseyFieldNotes: 'Le carnet de route de Casey',
  coverTitle: { da: 'Ton voyage en danois, esquissé au crayon.', de: "Ton voyage en allemand, esquissé au crayon." },
  pocketGuideEyebrow: 'Le guide de poche de Casey',
  pocketGuideTitle: { da: 'Le danois pour la route.', de: "L’allemand pour la route." },
  pocketGuideBlurb:
    'Des notes rapides sur les mots, les tournures et les conversations que tu croises en chemin.',
  openGrammarContentsAria: 'Ouvrir le sommaire de la grammaire',

  // ── les deux sections et leurs onglets ───────────────────────────────────
  sectionGrammar: 'Grammaire',
  sectionSurvival: 'Survie',
  thumbIndexesAria: 'Onglets du Guide de voyage',
  grammarThumbBlurb: { da: 'Comment marche le danois', de: "Comment marche l’allemand" },
  survivalThumbBlurb: 'Quoi dire sur place',
  backToGrammarIndexAria: 'Retour à l’index Grammaire',
  backToSurvivalIndexAria: 'Retour à l’index Survie',

  // ── l’index des villes d’une section ─────────────────────────────────────
  cityIndexAria: (section) => `Index des villes : ${section}`,
  cityIndexHeading: 'Neuf chapitres, neuf villes',
  cityIndexLede: 'Choisis une ville. Son nom indique le niveau recommandé.',
  cityRowAria: (city, topic, current) => `${city} : ${topic}${current ? ', ville actuelle' : ''}`,
  lessonCount: (n) => `${n} ${n > 1 ? 'leçons' : 'leçon'}`,
  exchangeCount: (n) => `${n} ${n > 1 ? 'échanges' : 'échange'}`,
  grammarBookTitle: (city) => `Grammaire · ${city}`,
  grammarBookDescription: (n) => `${n} courtes leçons réunies dans le Guide de voyage.`,
  grammarLessonBookDescription: 'Une page de règles, puis des exemples en contexte.',
  grammarExamplesContext: 'Exemples en contexte',
  grammarExamplesIntro: 'Lis chaque phrase comme une phrase complète et utile.',
  englishOnlyNotice: 'En anglais uniquement · traduction à venir',
  nextSurvivalLabel: 'Suivant : Survie →',

  // ── un échange de Survie ─────────────────────────────────────────────────
  exchangeAria: (title) => `Échange : ${title}`,
  recommendedCity: (city) => `Recommandé : ${city}`,
  speakerYou: 'Toi',
  // La personne qui te répond dans le dialogue — sans genre ni nationalité.
  speakerLocal: 'Interlocuteur',
  listen: 'Écouter',
  listenToAria: (line) => `Écouter : ${line}`,
  translationToggle: 'Français',
  recordingDidNotLoad: 'Enregistrement non chargé',
  exchangeNavAria: 'Navigation entre les échanges de Survie',

  // ── tourner les pages d’un livre ─────────────────────────────────────────
  bookNavAria: 'Navigation dans les pages du livre',
  previous: 'Précédent',
  next: 'Suivant',
  previousLabel: '← Précédent',
  nextLabel: 'Suivant →',
  openBook: 'Ouvrir le livre',
  backFromAria: (book) => `Quitter ${book}`,
  backToCoverOfAria: (book) => `Retour à la couverture de ${book}`,
  pageOf: (page, total) => `Page ${page} sur ${total}`,
  pageAnnouncement: (title, page, total) => `${title}, page ${page} sur ${total}`,

  // ── le trajet en train : sa barre, son enregistrement, sa sortie ─────────
  skipLessonAria: 'Passer la leçon',
  skipShort: 'Passer',
  continueLabel: 'Continuer',
  toSurvivalLabel: 'Survie →',
  recordingSectionAria: 'Enregistrement de la leçon en danois',
  hearTheLesson: 'Écouter la leçon',
  hearTheLessonHelp: 'Un enregistrement en danois naturel. Touche une ligne pour la travailler.',
  stop: 'Arrêter',
  recordingLoading: 'Chargement de l’enregistrement…',
  recordingFailed: 'L’enregistrement de la leçon n’a pas chargé. Réessaie.',
  recordingMissing: 'Cette leçon n’a pas encore d’enregistrement.',
  grammarChapterAria: (chapter) => `Chapitre de grammaire ${chapter}`,

  // ── l’écran d’index du Guide de voyage : onglets, chapitres, activités ───
  tabChapters: 'Chapitres',
  tabPractice: 'Exercices',
  // Court exprès : trois onglets sur 360 pixels. La fiche en dessous dit
  // « Mise en situation », comme le glossaire.
  tabSituations: 'En situation',
  tabsAria: 'Sections du Guide de voyage',
  chapterKicker: (chapter, city) => `Chapitre ${chapter} sur 9 · ${city}`,
  chapterRowTitle: (chapter, city) => `Chapitre ${chapter} · ${city}`,
  chapterReached: 'Atteint',
  lookAhead: 'Voir plus loin',
  lookAheadNote:
    'Voir plus loin, c’est seulement lire. Ça ne débloque pas cette ville et ne compte pas comme terminé.',
  activityNew: 'Nouveau',
  activityLater: 'Plus tard',
  activityDone: 'Terminé',
  activityLocked: 'Verrouillé',
  activityListIntro:
    '« Nouveau », « Plus tard » et « Terminé » restent ici même quand tu quittes le train. Une activité verrouillée attend son invitation à la halte linguistique.',
  noActivitiesYet: 'Atteins une ville pour ajouter ses exercices ici.',
  kindPractice: 'Exercice',
  kindReadinessTask: 'Bilan d’étape',
  kindSituation: 'Mise en situation',
  readerNote:
    'Ceci est le mode lecture du guide, rejouable à volonté. Un premier essai n’est enregistré que par le parcours noté, jamais en ouvrant cette page.',

  // Current Settings and German-preview integration.
  sectionEmpty: "Ces pages n’ont pas encore été écrites pour cette langue.",
  listenNotRecordedYet: "Pas encore enregistré",
  addressFormAria: (form) => "Forme d’adresse : " + form,
}
