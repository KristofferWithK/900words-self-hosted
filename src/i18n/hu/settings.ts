import type { Catalogue } from '../en'
import { az } from './toldalek'

/**
 * Magyar. Tegezés, soha nem magázás. A Beállítások elmagyaráz, nem játszik -
 * Casey maga csak az emlékeztető-kérdésben és a nap végi értesítésekben szól.
 *
 * Szótár: a nyom az, amit adsz; a tipp az, amit mondasz rá. „Tipp” itt sehol
 * nem jelent koppintást és nem jelent Casey-tanácsot.
 */
export const settings: Catalogue['settings'] = {
  // ── a képernyő ───────────────────────────────────────────────────────────
  title: 'Beállítások',
  backAria: 'Vissza',

  // ── az app nyelve ────────────────────────────────────────────────────────
  uiLanguageLabel: 'A nyelved',
  uiLanguageHelp:
    'Ezen a nyelven szól hozzád az app. Váltáskor az app újratöltődik; a gyűjteményed és az utazásod megmarad.',

  // ── a tanult nyelv ───────────────────────────────────────────────────────
  learnerLanguageLabel: 'Tanult nyelv',
  learnerLanguageHelp:
    'Minden nyelvnek saját útja van. Válts vissza, hogy ott folytasd, ahol abbahagytad.',

  // ── Casey agya ───────────────────────────────────────────────────────────
  caseyBrainHeading: 'Casey agya',
  caseyServerNote:
    'Casey a 900words saját szerveréről játszik. Nincs mit beállítani; a lenti gomb ellenőrzi, hogy válaszol-e.',
  normalOllamaCaseyLabel: 'Normál Ollama Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · nyomok és tippek',
  normalOllamaCaseyAria: 'Normál Ollama Casey használata',
  normalCaseyOn: 'Normál Casey bekapcsolva',
  normalCaseyOff: 'Normál Casey kikapcsolva',
  prototypeOn: 'Ügynök nélküli prototípus bekapcsolva',
  customCaseyOn: 'Egyéni Casey-szolgáltatás bekapcsolva',
  normalCaseyDetail: 'Az Ollama játszik és fordít. A Gemma ki van kapcsolva.',
  gemmaModeDetail:
    'A nyomokat és tippeket a Gemma 4 E4B adja. Ha egy szó hiányzik a szótárból, az app továbbra is az Ollamát kérdezi.',
  prototypeDetail: 'Ez a helyi tesztmód nem Casey, nem Ollama és nem Gemma.',
  customCaseyDetail:
    'Egyéni Casey-Worker van kiválasztva. Ha egy szó hiányzik a szótárból, az app online ezt a szolgáltatást kérdezi.',


  baseUrlLabel: 'Alap-URL',
  // A /v1 útvonal <code>-ban áll a két fél között, saját térköz nélkül -
  // ezért a felek hordozzák a szóközöket.
  baseUrlHelpBefore:
    'A fenti gomb állítja be - vagy add meg a saját Casey-Workered címét, utána a ',
  baseUrlHelpAfter:
    ' útvonalat. https://-vel kell kezdődnie, hogy a játékodból semmi ne utazzon titkosítatlanul.',
  baseUrlUnusable: 'Ez az alap-URL nem használható.',

  // ── az eszközön futó modell ──────────────────────────────────────────────
  gemmaUnavailableNote: 'Az offline mód a 900words iPhone-appjában működik.',
  gemmaReady: (size) => `Az offline Casey kész (${size} ezen az iPhone-on).`,
  gemmaRemoveConfirm: 'Eltávolítod az offline Casey-t erről az iPhone-ról? Később újra letöltheted.',
  gemmaRemoveButton: 'Offline Casey eltávolítása',
  gemmaProgressAria: 'Az offline Casey letöltésének állapota',
  gemmaDownloading: (percent) => `${percent}% - hagyd nyitva a 900words appot, wifin.`,
  gemmaCancelDownloadButton: 'Letöltés megszakítása',
  gemmaDownloadNote: (size) =>
    `Az offline Casey letöltése ${size}. Használj wifit, és ne zárd be az appot, amíg be nem fejeződik.`,
  gemmaDownloadButton: 'Offline Casey letöltése',
  gemmaDownloadFailed: 'A letöltés nem sikerült.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Offline mód',
  offlineModeExperimentalTag: 'Kísérleti',
  offlineModeLabel: 'Játék internet nélkül',
  offlineModeHelp:
    'Normál Casey a 900words szerveréről játszik. Offline móddal internet nélkül is befejezhetsz egy kört az offline Casey-vel ezen az iPhone-on. Ő lassabb.',
  offlineModeAria: 'Offline mód',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `Az offline mód kísérleti, és még fejlesztjük.\n\nAz offline mód letölti az offline Casey-t (${size}) erre az iPhone-ra. Használj wifit, és ne zárd be az appot, amíg a letöltés be nem fejeződik.\n\nAz offline Casey lassabban játszik, mint Normál Casey.\n\nÚjabb iPhone kell hozzá: ${iphones}.${lowMemory ? '\n\nEnnek az iPhone-nak kevesebb memóriája van, mint ezeknek a modelleknek. Lehet, hogy nem fut rajta.' : ''}\n\nLetöltöd most?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Casey MI-je',
  ossCaseyHelp: 'Ez egy saját magad által épített 900words. Casey-nek MI kell a játékhoz: a saját MI-kulcsod vagy a Gemma ezen az iPhone-on.',
  ownKeyOption: 'Saját MI-kulcs',
  ownKeyHelp: 'Bármilyen OpenAI-kompatibilis szolgáltatás. A kulcsod csak ezen az eszközön tárolódik, és csak az alábbi címre küldjük.',
  ownKeyAddressLabel: 'A szolgáltatás címe',
  ownKeyModelLabel: 'Modell',
  ownKeyKeyLabel: 'API-kulcs',
  ownKeyAnswered: 'Az MI-szolgáltatásod válaszolt.',
  gemmaOption: 'Gemma ezen az iPhone-on',
  gemmaOptionHelp: 'Casey ezen az iPhone-on játszik, internet és kulcs nélkül. Lassabb.',
  serverOption: 'Saját Casey-szerver',
  serverOptionHelp: 'Egy Casey Worker, amelyet te telepítettél (lásd a README-t).',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Ez a 900words Casey-vel játszik az iPhone-odon: fiók és kulcs nélkül. Casey-t egyszer kell letölteni (${size}). Használj wifit, és ne zárd be az appot, amíg a letöltés be nem fejeződik.\n\nÚjabb iPhone kell hozzá: ${iphones}.${lowMemory ? '\n\nEnnek az iPhone-nak kevesebb memóriája van, mint ezeknek a modelleknek. Lehet, hogy nem fut rajta.' : ''}\n\nA Beállításokban a saját MI-kulcsodat is megadhatod.\n\nLetöltöd most Casey-t?`,

  // ── a kapcsolat ellenőrzése ──────────────────────────────────────────────
  testRunning: 'Tesztelés…',
  testGemmaButton: 'Eszközön futó Casey tesztje',
  testConnectionButton: 'Kapcsolatteszt',
  connectionFailed: 'Nem sikerült kapcsolódni.',
  gemmaAnswered: 'A Gemma válaszolt ezen az iPhone-on.',
  normalCaseyAnswered: 'A Normál Ollama Casey válaszolt.',
  customCaseyAnswered: 'Az egyéni Casey-szolgáltatás válaszolt.',


  // ── a játék ──────────────────────────────────────────────────────────────
  gameHeading: 'Játék',
  soundLabel: 'Szavak kimondása koppintásra',
  soundHelp:
    'Semmi nem szólal meg magától - minden hang egy koppintást követ, Casey tippjei is.',
  lookupExampleLabel: 'Játssza le a példamondatot fordítás keresésekor',
  lookupExampleHelp: 'Kikapcsolva a keresés a szóhang beállítását használja.',
  replayIntroButton: 'Bevezető újra',
  replayIntroHelp: 'Casey bemutatkozása még egyszer. A haladásod nem változik.',

  // ── a játékteszt utazóeszközei ───────────────────────────────────────────
  playtestHeading: 'TestFlight-játékteszt',
  playtestTravelLabel: 'Városugrás és bármelyik vonat',




  // ── a napi emlékeztető kapcsolója ────────────────────────────────────────
  reminderHeading: 'Napi emlékeztető',
  reminderWebNote:
    'A napi emlékeztető a 900words iPhone-appban érhető el. Ez a böngésző soha nem kér értesítési engedélyt.',
  reminderDeniedNote:
    'A 900words iPhone-értesítései ki vannak kapcsolva. Kapcsold be őket az iPhone Beállításokban, majd térj vissza ide Casey napi emlékeztetőjének beállításához.',
  reminderOpenSettingsButton: 'Értesítési beállítások megnyitása',
  // `time` így érkezik: „15:00” - a -kor ezért itt áll, kötőjellel.
  reminderOnNote: (time) => `Casey ${time}-kor jelentkezik ezen az iPhone-on.`,
  reminderTurningOff: 'Kikapcsolás…',
  reminderTurnOffButton: 'Napi emlékeztető kikapcsolása',
  reminderOffNote: (time) =>
    `Casey küldhet egy helyi emlékeztetőt ${time}-kor. Az üzenet ezen az iPhone-on készül a teljesített napjaid számából; eszközazonosító és tanulási előzmény nem hagyja el a készüléket.`,
  reminderAsking: 'iPhone megkérdezése…',
  reminderTurnOnButton: 'Napi emlékeztető bekapcsolása',

  // ── a gyűjteményed: a mentés ─────────────────────────────────────────────
  collectionHeading: 'Biztonsági mentés',
  backupIntro:
    'A gyűjteményed csak ezen a telefonon él. A biztonsági mentés egy kis fájl - tarts egyet biztos helyen, mielőtt telefont váltasz vagy törlöd a böngésződ adatait. Az API-kulcsod sosincs benne.',
  backupSaveButton: 'Biztonsági mentés',
  backupRestoreButton: 'Visszaállítás fájlból',
  backupShared: 'A mentést átadtuk a telefonodnak.',
  backupDownloaded: 'A mentés letöltve.',
  backupHideText: 'Szöveges mentés elrejtése',
  backupShowText: 'Nincs fájlválasztó? Használj szöveget',
  backupCopyButton: 'Gyűjtemény másolása',
  backupCopied: 'A mentés a vágólapra másolva.',
  backupPasteLabel: 'Illessz be ide egy mentést',
  backupReadButton: 'Beolvasás',
  backupHoldsHeading: 'A mentés tartalma',
  backupCollectedAfter: (met) => `begyűjtött szó, összesen ${met} megismert`,
  backupWrappedAfter: (city) => `becsomagolva · ${city}`,
  backupGamesLine: (games, savedOn) => `${games} kör lejátszva · mentve: ${savedOn}`,
  backupMergeButton: 'Összefésülés',
  backupReplaceButton: 'Minden lecserélése',
  backupCancelButton: 'Mégse',
  backupChoiceNote:
    'Az összefésülés minden szónál a két bejegyzés jobbikát tartja meg, így soha nem kerülhet egy zöldbe. A lecserélés eldobja ennek az eszköznek a haladását.',
  backupReplaceConfirm:
    'Mindent lecserélsz ezen az eszközön a mentésre? Ami a mentés óta tanultál, elveszik.',
  backupMerged: (collected) =>
    `Összefésülve. Semmi nem veszett el - ${collected} begyűjtött szó került bele.`,
  backupRestored: (collected, wrapped) =>
    `Visszaállítva: ${collected} begyűjtött és ${wrapped} becsomagolt szó.`,

  // ── a fejlesztő nyomnaplója ──────────────────────────────────────────────
  clueLedgerHeading: 'Casey nyomai',

  // ── adatok ───────────────────────────────────────────────────────────────
  dataHeading: 'Adatok',
  usageStatsLabel: 'Névtelen használati statisztika',
  usageStatsHelp:
    'Csak számok - lejátszott körök, hol hagyják abba a játékosok, elakadt-e Casey vagy egy felvétel. Se szavak, se nyomok, se semmilyen azonosító.',
  usageStatsAria: 'Névtelen használati statisztika megosztása',
  dataSharingPrivateTitle: 'Privát játék',
  dataSharingPrivateDetail: 'Semmilyen opcionális játékadat nem hagyja el ezt a telefont.',
  dataSharingDiagnosticsTitle: 'Névtelen diagnosztika',
  dataSharingDiagnosticsDetail: 'Körszámok és eredmények megosztása, a szavaid és nyomaid soha.',
  dataSharingLearningTitle: 'Diagnosztika + tanulópéldák Casey-nek',
  dataSharingLearningDetail:
    'Nyomok, tippek és eredmények megosztása is, hogy Casey fejlődhessen.',
  dataSharingAria: 'Adatmegosztás',
  dataSharingCloseAria: 'Bezárás választás nélkül',
  dataSharingPromptTitle: 'Mire használhatja a 900words a játékodat?',
  dataSharingPromptNote:
    'Semmi nincs előre kijelölve. Bármelyiket választod, a teljes játék nyitva marad, és a Beállításokban bármikor módosíthatod.',
  dataSharingSettingsNote:
    'Ha nem választasz, az Privát játéknak számít. Ez csak az opcionális eseményeket szabályozza; Casey és a következő tábla átmeneti ellenőrzése továbbra is feldolgozza a játékhoz szükséges minimális adatot.',
  dataSharingDeleting: 'Megosztott adatok törlése…',
  dataSharingDeleteButton: 'Megosztott adatok törlése',
  resetConfirm: (language) =>
    `Visszaállítod az összes tanulási haladást, ${az(language)} ${language} utazásodat és a jelenlegi játékot?`,
  resetButton: 'Haladás törlése',

  // ── a verziós lábléc ─────────────────────────────────────────────────────
  buildStamp: (stamp) => `Verzió: ${stamp}`,
  testFlightBuild: (build) => `TestFlight-build ${build} · `,
  keyboardReadoutNote: 'Billentyűzet-kijelzés bekapcsolva. Koppints ötször a verzióra az elrejtéséhez.',
  // Kapcsolóállás, ahogy a magyar felületek írják: „be” / „ki”.
  stateOn: 'be',
  stateOff: 'ki',
  composerRideWaiting: 'ki (a dokumentumra vár)',
  composerRideButton: (state) => `Szerkesztő együtt mozog: ${state}`,
  trainStoryButton: (state) => `Vonattörténet: ${state}`,


  updateChecking: 'Ellenőrzés…',
  checkUpdatesButton: 'Frissítések keresése',
  updateCurrent: 'Naprakész.',
  updateFound: 'Újabb verzió töltődik - zárd be, majd nyisd meg újra az appot, hogy átvegye.',
  updateCheckFailed: 'Nem sikerült ellenőrizni. Zárd be, majd nyisd meg újra az appot.',

  // ── Casey egyetlen kérdése a napi emlékeztetőről ─────────────────────────
  reminderPromptCloseAria: 'Most nem',
  reminderPromptTitle: 'Három játék a bőröndben!',
  reminderPromptBody: (time) =>
    `Ezzel megvan a napi adag. Emlékeztesselek holnap, ${time} körül? Csak egy kis noszogatás délután - a Beállításokban bármikor kikapcsolhatod.`,
  reminderPromptAccept: 'Igen, emlékeztess',
  reminderPromptAsking: 'Az iPhone-od megkérdezése…',
  reminderPromptDecline: 'Köszönöm, nem',

  // ── maga a napi emlékeztető, a telefonon írva ────────────────────────────
  reminderDoneTitle: 'Casey mára bepakolt',
  reminderDoneBody: 'Három játék biztonságban a bőröndben. Holnap folytathatjuk.',
  reminderOneLeftTitle: 'Egy kis játék Casey-vel?',
  reminderStreakBody: (days) =>
    `Már ${days} napos a sorozatod - még egy mai játék, és megy tovább.`,
  reminderOneLeftBody: 'Még egy játék, és a mai három a bőröndben van.',
  reminderSeatTitle: 'Casey fenntartott neked egy helyet',
  reminderSeatBody: (games) => `Ma ${games} kis játék is elég egy sorozat kezdetéhez.`,

  // ── a szolgáltató-címke ──────────────────────────────────────────────────



  // Current Settings and German-preview integration.
  learnerLanguagePreviewTag: "előzetes",
  learnerLanguagePreviewHelp: "A német egyelőre előzetes: a térkép és az Útikalauz már elérhető, a szójáték még nem. A leckéket még nem ellenőrizte német anyanyelvű ember.",
  playtestTravelHelp: "A térképen ugorhatsz előre: válassz egy későbbi megállót, és utazz tovább. Ez nem csomagol be szavakat, és nem növeli a tanulási haladásodat. Kapcsold ki, ha újra a szokásos utazási feltételeket szeretnéd tesztelni.",
}
