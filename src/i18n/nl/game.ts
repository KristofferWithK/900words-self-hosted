import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u. Casey is ‘zij’. Een hint is wat je geeft, een
 * gok is één poging, raden is de bezigheid; ‘tip’ is alleen Casey’s tip op het
 * beginscherm. Een beurt is een beurt — het Nederlands heeft geen ‘Zug’-val,
 * dus de trein blijft de trein zonder omweg.
 *
 * Kort houden: het bord, het hintvak en het eindscherm moeten op 360x640
 * passen zonder scrollen, en Nederlandse samenstellingen lopen snel uit.
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "Je voortgang is bewaard",
  legacyRetiredBody: "Een oudere ronde kon na deze update niet doorgaan. Je opgeslagen leerresultaten en ansichtkaarten blijven behouden. Ga verder met het volgende onvoltooide bord.",
  // ── het fase-opschrift, bovenaan het bord ─────────────────────────────────
  phaseGiveClue: 'Geef Casey een hint',
  phaseCaseyGuessing: 'Casey raadt',
  phaseCaseyClue: 'Casey zoekt een hint',
  phaseYourGuess: 'Jij mag raden',
  phaseLastChance: 'Laatste kans: geen hints meer',
  phaseRoundOver: 'Ronde voorbij',
  phasePackTheBoard: 'Inpakken',

  // ── wat de live-regio zegt terwijl Casey speelt ───────────────────────────
  announceCaseyGuess: (word, result) => `Casey raadde ${word}: ${result}.`,
  resultCorrect: 'goed',
  resultNeutral: 'neutraal',
  announceCaseyThinking: 'Casey denkt na.',

  // ── de spelkop ────────────────────────────────────────────────────────────
  skip: 'Overslaan',
  homeAria: 'Beginscherm',
  dealNewWordsAria: 'Nieuwe woorden uitdelen',
  hideTranslationsAria: 'Vertalingen verbergen',
  showTranslationsAria: 'Alle vertalingen tonen. Telt als opzoeken voor elk onopgelost woord',

  // ── Casey was niet bereikbaar ─────────────────────────────────────────────
  errorRetry: 'Opnieuw proberen',
  errorCaseySettings: 'Casey-instellingen',
  practiceNote: 'Experimenteel agentloos prototype. Dit is niet Casey en geen normaal spel.',

  // ── de studiefase ─────────────────────────────────────────────────────────
  studyTitle: 'Bestudeer het bord',
  studyHint:
    'Elke vertaling is te zien. Ze verdwijnen zodra je start, en met een tik zoek je er een op.',
  studyStart: 'Ronde starten',

  // ── de toegankelijke naam van een kaart, uit deze stukken in deze volgorde ─
  cardYourTarget: ', jouw doel',
  cardFound: ', gevonden',
  cardNeutralBoth: ', neutraal voor beide kanten',
  cardNeutralPlayer: ', neutraal onder jouw hints',
  cardNeutralCasey: ', neutraal onder Casey’s hints',
  cardUnpacked: ', niet ingepakt',
  cardTranslationRevealed: ', vertaling getoond',
  cardNotYetPacked: (language) => `, nog niet ingepakt. Tik om het ${language} te typen`,
  cardNotYoursToWrap: ', nog niet van jou om te verpakken',
  cardTapToHear: '. Tik om te luisteren',
  lookUpAria: (word) => `${word} opzoeken`,

  // ── het hintvak ───────────────────────────────────────────────────────────
  cluePlaceholder: 'Jouw hint',
  clueFieldAria: (language) => `Jouw hint van één woord, in het ${language}`,
  fewerWordsAria: 'minder woorden',
  moreWordsAria: 'meer woorden',
  wordCountAria: (n) => (n === 1 ? '1 woord' : `${n} woorden`),
  giveClue: 'Hint geven',
  giveItAnyway: 'Toch geven',
  askingCasey: 'Casey vragen…',
  firstClueHint: (language) =>
    `Eén woord in het ${language}. Kom je er niet uit? Het woordenboek ernaast vertaalt.`,
  tutorialClueHint:
    'Ik lees hints als Deens. Twijfel je? Probeer het. Het woordenboek kan helpen.',
  wrapPlayerKeyHint:
    'Je groene rand is terug. Het is jouw geheime sleutel. Casey kan hem niet zien.',
  looksEnglishFull: (word, language) =>
    `«${word}» lijkt Engels. Tik erop voor het ${language}, of geef het toch en Casey controleert het.`,
  looksEnglishShort: 'lijkt op de betekenis van een kaartwoord. Tik erop, of geef het toch',

  // ── de gokbalk ────────────────────────────────────────────────────────────
  caseysClueLabel: 'Casey’s hint',
  lookUpInDictionaryAria: (word) => `«${word}» opzoeken in het woordenboek`,
  guessesLeft: (n) => (n === 1 ? 'nog 1 poging' : `nog ${n} pogingen`),
  guessWord: (word) => `«${word}» raden`,
  cancel: 'Annuleren',
  stopKeepWhatWeHave: 'Stoppen en houden wat we hebben',
  guessPrompt: 'Tik op een woord dat Casey volgens jou bedoelt.',
  firstGuessHint: 'Nu telt Casey’s sleutel. Tik op een woord waar haar hint naar wijst.',
  wrapCaseyKeyHint:
    'Casey’s sleutel is geheim. Raad waar haar hint naar wijst. Haar groene kaarten tellen nu.',
  tutorialLookupHint: 'Tik op de ⓘ naast een woord om de vertaling op te zoeken.',

  // ── de laatste kans ───────────────────────────────────────────────────────
  suddenDeathRule: 'Noem groene kaarten om te winnen. Alles anders maakt er een eind aan.',
  nameWord: (word) => `«${word}» noemen`,
  giveUpRound: 'Ronde opgeven',

  // ── het vertaalwiel (de laatste kans, nieuw 2026-09-16) ───────────────────
  wheelLede: (language) => `Het wiel beslist de ronde. Typ de woorden terug in het ${language} om het te vullen, en draai dan. Groen wint.`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `Typ in het ${language}`,
  wheelAnswerAria: (language, glosses) =>
    `Typ de vertaling in het ${language} voor een van deze woorden: ${glosses.join(', ')}`,
  wheelCardStatus: (translated) =>
    translated ? ', vertaling ingevuld' : ', vertaling nodig',
  wheelRetryLine: 'Niet juist. Probeer het opnieuw. Je verliest niets.',
  wheelSubmit: 'Inpakken',
  wheelSpinAria: 'Draai het wiel',
  wheelSpinning: 'Draait …',
  wheelWonLine: 'Groen! De ronde is gewonnen.',
  wheelMissLine: 'Het wiel landde op een niet-ingepakte koffer.',
  phaseTranslateChallenge: 'Tijd om te vertalen',
  settlementFailed: 'Je resultaat kon nog niet worden opgeslagen. Bewaar deze ronde en probeer het opnieuw.',
  settlementSaving: 'Je resultaat wordt opgeslagen…',
  guidanceTranslationBody: (language) => `De koffers tonen nu de betekenis van de woorden die je vond. Typ elk woord terug in het ${language} om het wiel te vullen en draai het daarna. Eindigt het op groen, dan win je de ronde.`,
  guidanceStartTranslation: 'Begin met vertalen',
  phaseTranslateWheel: 'Het wiel: de draai beslist de ronde',

  // ── het aankomstpaneel van de laatste kans ────────────────────────────────
  /** De zin van de pop-up als de hints op zijn en de wieluitdaging begint (eigenaar, 2026-09-17) — in de toon van wheelLede. */
  guidanceLastChanceWheel:
    'Je hints zijn op, dus dit is het einde. Vertaal de verzamelde woorden om het wiel te vullen, en draai dan. Groen wint de ronde.',

  // ── Casey’s eigen beurt ───────────────────────────────────────────────────
  caseyIsThinking: 'Casey denkt na…',
  offlineCaseyIsThinking: 'Offline Casey denkt na. Dit duurt langer.',
  offlineRoundPrompt: 'Geen internet. De rest van deze ronde spelen met offline Casey? Ze is trager.',
  playOfflineButton: 'Offline spelen',
  hurryCaseyTitle: 'Tik zodat Casey opschiet',
  hurryCaseyHint: 'Tik hier zodat Casey opschiet.',
  caseyGuessedWord: (word) => `Casey raadde «${word}».`,
  caseyChoosingWord: 'Casey kiest een woord…',
  caseyChoosingWhether: 'Casey bedenkt of ze gaat raden…',
  guessGotOne: '. Raak!',
  guessNeutral: '. Neutraal.',

  // ── de gedeelde hintvoorraad ──────────────────────────────────────────────
  turnTokensAria: (given, total, left) =>
    `${given} van ${total} hints gegeven, ${left} over.`,
  cluesGivenCount: (given, total) => `${given}/${total} hints gegeven`,

  // ── een onafgemaakte ronde verlaten ───────────────────────────────────────
  leaveTitle: 'Deze ronde verlaten?',
  leaveBody:
    'Pauzeren laat dit bord precies zo staan. Annuleren gooit het weg, zodat Spelen een nieuwe ronde begint.',
  leaveKeepPlaying: 'Doorspelen',
  leavePause: 'Spel pauzeren',
  leaveCancelRound: 'Ronde annuleren',

  // ── het venster dat een ronde opent ───────────────────────────────────────
  guidanceCaseyTitle: 'Casey’s eerste hint',
  guidancePlayerTitle: 'Jij bent aan de beurt!',
  guidanceWordCount: (n) => (n === 1 ? '1 woord' : `${n} woorden`),
  guidanceCaseyBody: 'Vind de woorden die bij Casey’s hint passen.',
  guidancePlayerBody:
    'Schrijf één Deens woord dat 1–4 van je groene woorden met elkaar verbindt. Gebruik het woordenboek als je het woord niet in het Deens kent.',
  guidanceHideReminder: 'Niet meer tonen',
  guidanceStartGuessing: 'Beginnen met raden',
  guidanceWriteClue: 'Hint schrijven',
  guidanceLastChanceTitle: 'Laatste kans',
  guidanceLastChanceBody:
    'Je hints zijn op. Maar je kunt nog winnen. Blijf raden op basis van de eerdere hints. Maar één verkeerde gok en je verliest.',
  guidanceKeepNaming: 'Blijven noemen',
  guidancePackingTitle: 'Eerst het bord inpakken',
  guidancePackingBody:
    'Vertaal het bord van het Engels naar het Deens, kaart voor kaart. Zijn ze allemaal vertaald, of kom je niet verder, start dan de ronde.',
  guidanceStartPacking: 'Begin met inpakken',

  // ── het woordenboek: het veld, zijn ene antwoord en het blad erachter ─────
  dictionaryPlaceholder: 'Woordenboek',
  dictionaryFieldAria: (language) => `Woord om te vertalen, ${language} of Engels`,
  dictHitAria: (entry) => `${entry}: woordenboek openen`,
  approximateFrom: (term) => ` (van ${term})`,
  onTheBoardNote: ' (op het bord)',
  translateFailed: 'Dat kon niet worden vertaald.',
  lookupsUsed: 'Geen opzoekingen meer over.',
  dictionaryPracticeOnly: 'Oefenen: alleen de 900 woorden.',
  sayAgainAria: (word) => `${word} nog eens zeggen`,
  saySlowlyAria: (word) => `${word} langzaam zeggen`,
  sayExampleAria: 'De voorbeeldzin nog eens zeggen',
  sayExampleSlowlyAria: 'De voorbeeldzin langzaam zeggen',
  recordingsUnavailableNote: ' · normale en langzame opname niet beschikbaar',
  recordingFailedNote: ' · opname niet geladen',
  close: 'Sluiten',

  // ── Casey’s beslissingen: het beurtenlogboek en zijn vlaggen ─────────────
  caseysCalls: 'Casey’s beslissingen',
  turnCount: (n) => (n === 1 ? '1 beurt' : `${n} beurten`),
  logHint: 'Tik op ⚑ bij alles van Casey wat een misser was. Wat je markeert, krijgt zij te zien.',
  logYou: 'Jij',
  logFor: 'voor',
  flagClueLabel: (clue) => `Casey’s hint «${clue}»`,
  flagGuessLabel: (word) => `Casey’s gok «${word}»`,
  flagOnAria: (label) => `${label}, gemarkeerd als misser. Tik om ongedaan te maken`,
  flagOffAria: (label) => `${label} als misser markeren`,
  guessCorrectSr: ', goed',
  guessNeutralSr: ', neutraal',
  confidenceSure: (percent) => `${percent}% zeker`,
  noGuessMade: 'niet geraden',

  // ── het hintlogboek: een saaie diagnose, geen score ───────────────────────
  ledgerEmpty:
    'Nog niets. Voor elke hint van Casey verschijnt hier een regel zodra je eronder klaar bent met raden.',
  ledgerArmHeading: 'bron',
  ledgerCluesHeading: 'hints',
  ledgerFoundHeading: 'gevonden',
  ledgerRefusedHeading: 'afgewezen',
  ledgerHitsTitle: (hits, asked) => `${hits} van ${asked} gevraagde woorden`,
  ledgerRefusedTitle:
    'Hoe vaak het eerste antwoord van deze bron is weggegooid en opnieuw gevraagd',
  ledgerExplainer:
    '‘gevonden’ is het deel van de woorden waar een hint om vroeg dat je ook echt hebt omgedraaid. ‘afgewezen’ is hoe vaak het eerste antwoord van het model is weggegooid en opnieuw gevraagd. De offline bronnen kunnen niet worden afgewezen.',
  ledgerClear: 'Logboek wissen',

  // ── hoe de ronde eindigde ─────────────────────────────────────────────────
  // Kort: de kop is op 360px gedekt op 6,8vw en mag niet afbreken.
  outcomeWonTitle: 'Gefeliciteerd!',
  outcomeWonSub: 'Je hebt een ansichtkaart gewonnen!',
  outcomeLostTitle: 'Volgende keer',
  outcomeGivenUpSub: 'Ronde opgegeven. Het verband was er.',
  outcomeWheelMissSub: 'Het wiel landde op een koffer die je nooit inpakte.',
  /** De winnende wiel-einde (eigenaar, 18-09-2026): het wiel landde op groen. */
  outcomeWheelWinSub: 'Het wiel landde op groen. De ronde is van jou.',
  outcomeWheelSpentSub: 'De fiche was ingezet, en de aanwijzingen raakten toch op.',

  resultLesson: 'Een nieuwe optionele Guide-les staat klaar.', resultOpenGrammar: 'Open grammatica in de Guide', resultOpenSurvival: 'Open overleven in de Guide', resultBackToResult: 'Terug naar resultaat',

  // ── wat de ronde opleverde, als één regel onder de kop ────────────────────
  roundStatsAria: 'Wat deze ronde opleverde',
  newWordsLabel: (n) => (n === 1 ? 'nieuw woord' : 'nieuwe woorden'),
  collectedForCasey: 'verzameld voor Casey',
  wrapStatsAria: 'Wat deze inpakronde heeft ingepakt',
  wrappedForGood: (named) => (named ? 'voorgoed verpakt:' : 'voorgoed verpakt'),
  stayedLabel: 'gebleven',

  // ── waar de ronde de reis bracht: het leesgebied van de inpakronde ────────
  // Het getal staat ervoor in zijn eigen span: ‘13 verpakt in Ribe · 87 te
  // gaan tot de trein naar Kolding’.
  wrapJourneyHeading: 'De reis',
  wrapJourneyAria: 'De reis na deze inpakronde',
  wrappedInCity: (_n, city) => `verpakt in ${city}`,
  wrapJourneyTrainReady: (city) => `de trein naar ${city} staat klaar`,
  wrapJourneyOver: 'de reis is voorbij',
  wrapJourneyToGo: (_n, city) => `te gaan tot de trein${city ? ` naar ${city}` : ''}`,

  // ── de inpakronde-economie, gezegd op weg uit een gewonnen ronde ──────────
  wrapUpUnlocked:
    'Inpakronde vrijgespeeld. Die pakt verzamelde woorden voorgoed in de koffer. Open de koffer om hem te gebruiken.',
  wrapUpEarned: (banked) =>
    `Inpakronde verdiend. ${banked} gespaard. Gebruik er een in de koffer.`,
  postcardEarned: (banked) => `+1 vertaalpostkaart · ${banked} klaar`,
  wrapUpBankFull: (cap) =>
    `De spaarpot is vol. Meer dan ${cap} inpakrondes past niet in de koffer. Gebruik er een, dan tellen overwinningen weer.`,
  winsToWrapUp: (n) =>
    n === 1 ? 'nog 1 keer winnen voor een inpakronde' : `nog ${n} keer winnen voor een inpakronde`,
  wrapResultFirst:
    'Ingepakte groene kaarten zijn voorgoed verpakt, of je deze ronde nu wint of verliest.',
  wrapResultNothing:
    'Niets verpakt. Een woord wordt verpakt als het vertaald is EN groen gevonden, gewonnen of verloren.',
  wrapResultLost:
    'Verliezen kost je hier niets. Een inpakronde houdt wat je hebt ingepakt en groen gevonden, gewonnen of verloren.',

  // ── de weg uit een ronde ──────────────────────────────────────────────────
  playAgain: 'Nog eens spelen',
  playNextGame: 'Volgend spel',
  home: 'Beginscherm',
  postWrapChoicesAria: 'Keuzes na de inpakronde',
  postWrapHeading: 'Wat nu?',
  postWrapGrammar: 'Grammatica',
  postWrapSurvival: 'Overleven',
  postWrapBoth: 'Allebei',
  postWrapBothNote: 'Eerst grammatica, dan meteen door naar de dialoog.',
  grammarNote: (city, topic, lessons) =>
    `Grammatica van ${city}${topic ? `: ${topic}` : ''}${lessons > 1 ? `, ${lessons} lessen.` : '.'}`,
  // ‘Dialoog’ is het glossariumwoord voor één Overleven-onderdeel; het
  // gesprek erin heet daarom anders, anders staat het woord twee keer in
  // één regel.
  survivalNextNote: (number, total, title) =>
    `Dialoog ${number} van ${total}: ${title}. Eerst de zinnen, dan het gesprek.`,
  survivalAllReadTitle: 'Alle vier de dialogen zijn al gelezen.',
  survivalLockedTitle: 'Rond een inpakronde af om de volgende dialoog vrij te spelen.',
  survivalLockedNote: 'De volgende dialoog komt vrij zodra een inpakronde is afgerond.',

  // ── de zinnenband onder de uitkomst ───────────────────────────────────────
  sentenceReviewAria: 'Terugblik op de zinnen',
  hearItInDanish: 'Luister in het Deens',
  legendGreenLabel: 'Groen',
  legendGreenMeaning: ': het woord dat je hebt gevonden.',
  legendUnderlinedLabel: 'Onderstreept',
  legendUnderlinedMeaning: (city) => `: de kleine woorden van ${city}.`,
  legendTapToHear: 'Tik om te luisteren.',

  // ── de lezer van Stad 1 die het eindscherm vervangt ───────────────────────
  reviewTitle: 'Terugblik op het bord',
  reviewProgress: (current, total) => `${current} van ${total}`,
  reviewOptional: 'Optioneel · één zin per hint',
  reviewListen: 'Luisteren',
  reviewListenSlowlyAria: 'Langzaam luisteren',
  reviewNoRecordings: 'Normale en langzame opname niet beschikbaar.',
  reviewRecordingUnavailable: 'Opname niet beschikbaar.',
  reviewSoundOff: 'Het geluid staat uit of het afspelen is gestopt.',
  reviewShowTranslation: 'Vertaling tonen',
  reviewHideTranslation: 'Vertaling verbergen',
  reviewAboutWord: 'Over dit woord',
  reviewHighFrequencyWord: 'Veelgebruikt woord:',
  reviewNoNotes: 'Geen notities bij dit woord.',
  reviewNextSentence: 'Volgende zin',
  reviewNothingThisRound:
    'Deze ronde is er niets om op terug te blikken. Er is een zin voor elke hint van jou die Casey goed raadde.',
  sentenceBandNoGreens: 'Geen groene woorden voor een zin deze ronde.',

  // ── waarom een hint is afgewezen ─────────────────────────────────────────
  clueNotSingleWord: 'een hint moet één woord zijn',
  clueOnBoard: (clue) => `‘${clue}’ staat op het bord`,
  clueTypoOf: (clue, word) => `‘${clue}’ is misschien een typefout van ‘${word}’`,
  clueGlossOnBoard: (clue, word) =>
    `‘${clue}’ is de Engelse vertaling van ‘${word}’ op het bord`,
  clueCompoundOfWord: (clue, word) => `‘${clue}’ is een samenstelling met ‘${word}’`,
  clueCompoundOfGloss: (clue, gloss, word) =>
    `‘${clue}’ is een samenstelling met ‘${gloss}’, de vertaling van ‘${word}’`,
  clueFormOfWord: (clue, word) => `‘${clue}’ is een vorm van ‘${word}’`,
  clueFormOfGloss: (clue, gloss, word) =>
    `‘${clue}’ is een vorm van ‘${gloss}’, de vertaling van ‘${word}’`,

  // ── de duwtjes van de oefenronde en het gesloten woordenboek (gameStore) ──
  practiceClueFinal: 'Verbind voor deze laatste oefenhint het ene groene woord dat nog over is.',
  practiceClueMany: 'Verbind voor deze oefenhint 2 of 3 groene woorden.',
  dictionaryClosed: 'Het woordenboek blijft dicht tot dit klaar is.',
}
