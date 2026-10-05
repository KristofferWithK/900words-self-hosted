import type { Catalogue } from '../en'

/**
 * Français. Tu, jamais vous. Casey est « elle » et parle ici pour la première
 * fois — court, chaleureux, direct. Glossaire : une manche est un plateau, un
 * tour est un tour de jeu, on range dans la manche d’emballage, un mot qui y a
 * survécu est emballé. Les mots entre «» sont danois et le restent.
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? 'allemand' : 'danois',
      countryName: german ? 'Allemagne' : 'Danemark',
      welcome: 'Tu savais que 900 mots peuvent couvrir plus de 80 % de ce qu’on dit au quotidien, dans la plupart des langues ?',
      clueField: german
        ? 'Quand c’est à toi, écris ici un mot en allemand qui relie deux ou trois de tes mots verts.'
        : 'Quand c’est à toi, écris ici un mot en danois qui relie deux ou trois de tes mots verts.',
      dictionary: german
        ? 'Si tu cherches un mot en allemand, trouve-le ici. Le dictionnaire se ferme dès que tu envoies ton indice.'
        : 'Si tu cherches un mot en danois, trouve-le ici. Le dictionnaire se ferme dès que tu envoies ton indice.',
      tutorialHint: 'Utilise le dictionnaire pour traduire ton idée.',
      practiceIntro: (clue, number) =>
        `Mon indice est « ${clue} » pour ${number}. Quels mots de ce plateau associes-tu à cet indice ? Touche ⓘ si tu as besoin d’une traduction.`,
      practiceRationaleTime: 'Une horloge indique l’heure. Un mois et une semaine sont des unités de temps.',
      practiceRationaleTimeRecovery: 'Cette piste reprend le lien avec le temps pour les mots de temps qui restent.',
      lastGreen: german
        ? 'Il reste un de tes mots verts. Je ne peux pas le voir, alors donne-moi un indice en allemand pour cette dernière carte.'
        : 'Il reste un de tes mots verts. Je ne peux pas le voir, alors donne-moi un indice en danois pour cette dernière carte.',
      yourTurn: german
        ? 'Mon tour est fini. À toi maintenant. Donne-moi un indice en allemand qui relie 2 ou 3 de tes cartes vertes. Je ne peux pas les voir, comme tu ne peux pas voir ma clé.'
        : 'Mon tour est fini. À toi maintenant. Donne-moi un indice en danois qui relie 2 ou 3 de tes cartes vertes. Je ne peux pas les voir, comme tu ne peux pas voir ma clé.',
    }
  },
  languageEyebrow: 'Bienvenue à bord',
  languageHeading: 'Quelle langue parles-tu ?',
  languageHint: 'Touche ta langue.',
  languageAria: (endonym) => `Utiliser 900words en ${endonym}`,

  // ── Le billet : quelle langue veux-tu APPRENDRE ─────────────────────────
  skip: 'Passer',
  ticketEyebrow: 'Choisis ton voyage',
  ticketHeading: 'Quelle langue veux-tu apprendre ?',
  // « Direction Danemark » se lit comme un panneau : aucun article à accorder.
  ticketAria: (country, language) => `Direction ${country}, apprendre le ${language}`,
  // Au-dessus du nom du pays sur le billet ; « Apprendre au/en » exigerait la
  // préposition du pays, que le paquet ne fournit pas.
  ticketLearnIn: 'Destination',
  ticketMeta: (words, cities) => `${words} mots · ${cities} villes`,
  ticketHintMany: 'Touche un billet pour choisir.',
  ticketHintOne: 'Touche ton billet et c’est parti.',
  ticketComingSoon: 'Bientôt',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: 'Les fiches de vocabulaire, c’est ennuyeux, alors on joue à deux jeux : une balade en ville pour récolter des mots, et une énigme de mots au café.',
  introExplore: (city) => `Explorons ${city} et voyons si on trouve un café.`,
  introGo: 'C’est parti',
  walkEndFound: 'Refais une balade, ou rentre à l’accueil pour jouer au café qu’on a trouvé.',
  walkEndNotFound: 'Refais une balade pour chercher un café, ou rentre à l’accueil.',

  // ── Les bulles d’aide sur les vrais écrans ──────────────────────────────
  tourNext: 'Suivant',
  tourDone: 'On y va',
  tourLoose: 'Les mots qu’on a croisés attendent ici. Chaque anneau se remplit d’un tiers par marque : une photo en balade, une proposition sur mon indice, et un indice à toi.',
  tourLid: 'Avec trois marques, un mot est récolté. Les mots récoltés vont dans la valise, et cette ligne les compte.',
  tourTray: 'Voici la carte de tampons de la ville. Chaque café où tu joues reçoit ici son tampon. Un cercle en pointillés est un café trouvé mais pas encore joué, et ? un café encore à trouver.',
  mapTourHere: (city, words) =>
    `Voici ${city}, où nous sommes. Chaque ville offre ${words} mots à rapporter.`,
  mapTourNext: (next, _words, city) =>
    `${next} est plus loin sur la ligne. Continue d’améliorer les plateaux de ${city}. Le prochain arrêt est fermé pour l’instant.`,
  homeTourArrival: (city, words) =>
    `Nous voici à ${city} pour récolter tes ${words} premiers mots.`,
  homeTourMap:
    'Voici notre carte. Elle montre où nous sommes et les villes qui attendent plus loin sur la ligne.',
  homeTourSuitcase:
    'Touche-moi quand tu veux ouvrir la valise. Elle montre les mots que tu as rencontrés, récoltés et rangés pour de bon.',
  homeTourGuide:
    'Le Guide de voyage réunit grammaire, danois pratique et exercices des villes précédentes. Tu peux lire en avance sans faire avancer le train.',
  // ── La visite guidée du jeu d'entraînement (2026-09-18) ──────────────────
  introGameTourKey:
    'Les cadres verts sont tes mots secrets. Je ne les vois jamais, tout comme tu ne vois jamais les miens. Chaque proposition se juge sur la clé de qui a donné l’indice.',
  introGameTourClueField:
    'Quand c’est ton tour, tape ici un mot danois qui relie deux ou trois de tes mots verts.',
  introGameTourDictionary:
    'S’il te faut un mot danois que tu n’as pas, cherche-le juste ici. Le dictionnaire se ferme dès que ton indice est envoyé.',
  introGameTourStepper:
    'Ce nombre dit combien de mots ton indice nomme. Monte-le quand un lien couvre vraiment plus de tes verts.',
  translationTourBoard:
    'Ces couvercles de valise montrent le sens des mots que nous avons trouvés. Choisis-en un dans ta tête. Pas besoin de toucher une valise avant.',
  translationTourInput: (language: string) =>
    `Écris ici le mot en ${language}, puis touche la coche. Une mauvaise réponse ne coûte rien, alors réessaie simplement.`,
  translationTourWheel:
    'Chaque bonne réponse ajoute un segment vert. Tu peux faire tourner la roue à tout moment, mais si elle s’arrête sur un segment vide, tu perds la manche. Roue pleine, chaque tour de roue gagne.',
  wheelReadyTour:
    'La roue est toute verte maintenant, donc ce tour de roue gagne. Touche la roue pour la faire tourner.',
  resultTourRewardNew: (rewards: string) => `Nouveau cette fois : ${rewards}.`,
  resultTourRewardHeld: (rewards: string) =>
    `Déjà gagné avant, donc pas compté une deuxième fois : ${rewards}.`,
  resultTourWinTier: (tier: string, best: string) =>
    `Cette énigme a obtenu ${tier}. Le meilleur tampon du café jusqu’ici : ${best}.`,
  resultTourLossTier: (best: string) =>
    `Cette énigme est perdue. Une énigme perdue donne quand même un tampon bronze. Une énigme gagnée donne argent, or ou platine. Le meilleur de ce café jusqu’ici : ${best}.`,
  resultTourCityPercent: (city) =>
    `Chaque tampon de café compte pour la médaille de ${city} : bronze à 25 %, argent à 50 %, or à 75 % et platine à 100 %.`,
  resultTourNoBestYet: 'encore à venir',
  resultTourSentence:
    'Voici une révision facultative. Elle montre un mot de ce plateau dans une phrase. Ce n’est pas un autre test.',
  resultTourNoReview:
    'Il n’y a pas de phrase à revoir cette fois. Ce n’est pas grave. La révision est toujours facultative.',
  homeTourSightseeing: 'La visite de la ville, c’est la balade qu’on vient de faire. Chaque balade récolte des mots, et plus tu marches, plus tu trouves de cafés.',
  homeTourCafe: (name) =>
    name ? `Notre premier café, c’est ${name}. Touche Énigme au café pour t’installer et y jouer.` : 'Notre premier café t’attend. Touche Énigme au café pour t’installer et y jouer.',
  homeTourStamp: 'Chaque café où tu joues reçoit un tampon. Ensemble, ils font la médaille de cette ville, et ceci montre où tu en es.',
  homeTourCollection: 'Touche-moi pour ouvrir la valise. Je te montrerai les mots qu’on a récoltés et le tampon du café.',

  // ── La manche d’entraînement : les raisons écrites de Casey ─────────────
  practiceRationaleDrink: 'L’eau, le café et le lait, ça se boit.',
  practiceRationaleHome: 'Une maison, c’est un chez-soi.',
  practiceRationaleRecovery:
    'Ça reprend le lien concret avec la boisson pour les cartes de boissons qui restent.',

  // ── La manche d’entraînement : le commentaire de Casey en direct ────────
  practiceIntro:
    'Mon indice est «drikke» pour 3. Quels mots de ce plateau vont avec ? Touche ⓘ dès qu’une traduction t’aiderait.',
  guessGreenMore: (word) =>
    `«${word}» est vert sur ma clé. Continue à deviner, ou arrête-toi tant qu’on a l’avantage.`,
  guessGreenEnd: (word) => `«${word}» est vert sur ma clé. Ça clôt mon indice.`,
  guessGreenEndMine: (word) =>
    `«${word}» est vert sur ma clé. Ça clôt mon indice. Tes verts apparaîtront à ton tour. Cet indice utilisait ma clé.`,
  guessYoursNotMine: (word) =>
    `«${word}» est l’un de tes verts, mais il n’est pas vert sur ma clé. Cet indice utilise ma clé, donc la carte reste en jeu pour la tienne.`,
  guessMiss: (word) => `«${word}» n’est pas vert sur ma clé, donc ça clôt mon indice.`,
  guessMissMine: (word) =>
    `«${word}» n’est pas vert sur ma clé, donc ça clôt mon indice. Tes verts apparaîtront à ton tour. Cet indice utilisait ma clé.`,
  firstClue: (clue) =>
    `Bienvenue au café ! Cette première table est un petit entraînement. Quels mots de ce plateau peux-tu relier à «${clue}» ? Touche le ⓘ d’un mot pour voir sa traduction, puis touche un mot et confirme-le.`,
  clueFor: (clue, number) =>
    `Mon indice est «${clue}» pour ${number}. Touche un mot auquel il te fait penser.`,
  lastGreenLeft:
    'Il te reste un vert. Je ne le vois pas, alors donne-moi un indice en danois pour cette dernière carte.',
  yourTurn:
    'Mon tour est fini. À toi, maintenant. Donne-moi un indice en danois qui relie 2 ou 3 cartes vertes de ton côté. Je ne les vois pas, comme tu ne vois pas ma clé.',
  yourFirstClue: (clue, number, tokens) =>
    `Ton indice est «${clue}» pour ${number}. Les ${tokens} points en haut sont nos jetons communs pour la manche. Chaque indice, le tien ou le mien, en utilise un. Je réfléchis à voix haute ci-dessous.`,
  yourClue: (clue, number) =>
    `Ton indice est «${clue}» pour ${number}. Mes propositions se jugent maintenant sur ta clé. Je réfléchis à voix haute ci-dessous.`,
  practiceWon: 'Toutes les vertes trouvées. On a gagné ! Les énigmes au café ne seront pas si faciles, mais chaque mot croisé compte.',
  practiceLost: 'Cette manche nous a échappé, mais chaque mot rencontré compte quand même.',
  findingAClue: 'À moi. Je cherche un indice.',
  practiceTranslation:
    'Plateau résolu ! C’est le temps des traductions : chaque réponse danoise remplit un segment de la roue. Tu peux tourner maintenant, mais une roue pleine garantit le vert. Un plateau résolu peut encore atteindre Platine ici.',
  practiceWheelReady:
    'La roue est pleine. Fais-la tourner pour tomber sur le vert. Sur les plateaux normaux, c’est ainsi que ton résultat peut atteindre Platine.',
  practiceFinish:
    'Entraînement terminé. Cette table ne donne pas de tampon. Dans une énigme au café, résoudre, traduire et faire tourner la roue donnent son tampon au café. Tu peux rejouer un café pour améliorer son tampon.',
  demoEndTitle: "C’était ta première grille complète.",
  demoEndLine: "Dans l’app, je continue à jouer avec toi, grille après grille, et je garde chaque mot que tu collectes.",
  demoAppStore: "Télécharger 900words sur l’App Store",
  demoAppStoreSoon: "900words arrive bientôt sur l’App Store.",
  demoPlayAgain: "Rejouer",
  demoRestingTitle: "Casey se repose",
  demoRestingBody: "Beaucoup de monde a joué avec moi aujourd’hui, alors j’ai besoin de repos. Reviens demain, ou joue avec moi dans l’app.",
  demoCheckFailed: "Nous n’avons pas pu vérifier que tu es une personne. Recharge la page et réessaie.",
  playFullRound: 'Jouer l’énigme au café',
}
