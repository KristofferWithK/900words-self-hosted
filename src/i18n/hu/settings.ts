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
  gemmaUnavailableNote: 'Az offline mód a 900words iPhone- és Android-appjában működik.',
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
  ossCaseyHelpAndroid: 'Ez egy saját magad által épített 900words. Casey-nek MI kell a játékhoz: a saját MI-kulcsod vagy Gemma ezen az Android-telefonon.',
  gemmaOptionAndroid: 'Gemma ezen az Android-telefonon',
  gemmaOptionHelpAndroid: 'Casey ezen az Android-telefonon játszik, internet és kulcs nélkül. Lassabb.',
  ossGemmaFirstRunAndroid: (size, phones, lowMemory) =>
    `Ez a saját magad által épített 900words Caseyt futtatja ezen az Android-telefonon: nincs szükség fiókra vagy kulcsra. A Gemmát csak egyszer kell letölteni (${size}). Használj Wi-Fi-t, és hagyd nyitva a 900words alkalmazást, amíg a letöltés be nem fejeződik.\n\nLegalább 12 GB memóriájú, újabb Android-telefonon működik a legjobban, például: ${phones}.${lowMemory ? '\n\nEzen a telefonon kevesebb memória van, mint az ajánlott modelleken, ezért lehet, hogy nem működik jól.' : ''}\n\nA Beállításokban saját MI-kulcsot is megadhatsz.\n\nLetöltöd most Caseyt?`,
  serverOption: 'Saját Casey-szerver',
  serverOptionHelp: 'Egy Casey Worker, amelyet te telepítettél (lásd a README-t).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'Ez egy saját magad által épített 900words. Casey-nek MI kell a játékhoz: a saját MI-kulcsod vagy a Gemma ezen a számítógépen.',
  pcGemmaOption: 'Gemma ezen a számítógépen',
  pcGemmaOptionHelp: 'Casey ezen a számítógépen játszik, internet és kulcs nélkül. Lassabb.',
  pcGemmaNeeds: 'A Gemmához Chrome vagy Edge kell WebGPU-val, videokártyás számítógépen.',
  pcGemmaExplain: (size) =>
    `Casey a Gemmával ezen a számítógépen is játszhat: internet és kulcs nélkül. A Gemma egyszeri letöltés (${size}), ebben a böngészőben marad, és a videokártyádon fut Chrome-ban vagy Edge-ben. Lassabb, mint egy MI-szolgáltatás, és még kísérleti.\n\nHagyd nyitva ezt a lapot, amíg a letöltés be nem fejeződik.\n\nLetöltöd most a Gemmát?`,
  pcGemmaReady: (size) =>
    `A Gemma kész (${size} ebben a böngészőben).`,
  pcGemmaRemoveConfirm: 'Eltávolítod a Gemmát ebből a böngészőből? Később újra letöltheted.',
  pcGemmaDownloading: (percent) =>
    `${percent}% - hagyd nyitva ezt a lapot.`,
  pcGemmaDownloadNote: (size) =>
    `A Gemma ${size} méretű letöltés. Hagyd nyitva ezt a lapot, amíg be nem fejeződik.`,
  pcGemmaAnswered: 'A Gemma válaszolt ezen a számítógépen.',
  ossOfflineLabel: 'Offline játék, ha nincs internet',
  ossOfflineHelp: 'Casey ilyenkor felajánlja, hogy a kört a Gemmával fejezzétek be. Először ehhez le is töltődik.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Ez a 900words Casey-vel játszik az iPhone-odon: fiók és kulcs nélkül. Casey-t egyszer kell letölteni (${size}). Használj wifit, és ne zárd be az appot, amíg a letöltés be nem fejeződik.\n\nÚjabb iPhone kell hozzá: ${iphones}.${lowMemory ? '\n\nEnnek az iPhone-nak kevesebb memóriája van, mint ezeknek a modelleknek. Lehet, hogy nem fut rajta.' : ''}\n\nA Beállításokban a saját MI-kulcsodat is megadhatod.\n\nLetöltöd most Casey-t?`,
  // ── offline Casey Androidon ──────────────────────────────────────────────
  gemmaUnsupportedAndroidNote:
    'Az offline Casey-hez újabb androidos telefon kell: Android 12 vagy újabb, és legalább 8 GB memória. Ez a telefon nem ilyen.',
  gemmaReadyAndroid: (size) => `Az offline Casey kész (${size} ezen a telefonon).`,
  gemmaRemoveConfirmAndroid:
    'Eltávolítod az offline Casey-t erről a telefonról? Később újra letöltheted.',
  offlineModeHelpAndroid:
    'Normál Casey a 900words szerveréről játszik. Offline móddal internet nélkül is befejezhetsz egy kört az offline Casey-vel ezen a telefonon. Ő lassabb.',
  offlineModeExplainAndroid: (size, phones, lowMemory) =>
    `Az offline mód kísérleti, és még fejlesztjük.\n\nAz offline mód letölti az offline Casey-t (${size}) erre a telefonra. Használj wifit, és ne zárd be az appot, amíg a letöltés be nem fejeződik.\n\nAz offline Casey lassabban játszik, mint Normál Casey.\n\nÚjabb androidos telefon kell hozzá, legalább 12 GB memóriával, például ${phones}.${lowMemory ? '\n\nEnnek a telefonnak kevesebb memóriája van ennél. Lehet, hogy nem fut rajta.' : ''}\n\nLetöltöd most?`,
  gemmaAnsweredAndroid: 'A Gemma válaszolt ezen a telefonon.',

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

  // ── Google Play review access (Android store build only) ───────────────
  reviewAccessHeading: 'Hozzáférés a Google Play-ellenőrzéshez',
  reviewAccessHelp: 'Csak a Google Play alkalmazás-ellenőrzéséhez. Add meg az utasításokban kapott ellenőrző kódot, hogy ezen az eszközön korlátlanul játszhass.',
  reviewAccessLabel: 'Ellenőrző kód',
  reviewAccessUnlock: 'Feloldás',
  reviewAccessChecking: 'Ellenőrzés…',
  reviewAccessOn: (date: string) =>
    `Az ellenőrzési hozzáférés aktív. A korlátlan játék ezen az eszközön eddig van feloldva: ${date}.`,
  reviewAccessInvalid: 'Ezt az ellenőrző kódot nem fogadtuk el.',
  reviewAccessRateLimited: 'Túl sok próbálkozás. Kérlek, próbáld újra holnap.',
  reviewAccessError: 'A kódot nem sikerült ellenőrizni. Ellenőrizd az internetkapcsolatot, és próbáld újra.',

  // ── A csomagod (csak az áruházi buildekben). iOS-en Apple, Androidon Google Play.
  planHeading: 'A csomagod',
  planFreeShort: 'Ingyenes',
  planUnlimitedShort: 'Korlátlan',
  planChipAria: (plan: string) => `A csomagod: ${plan}`,
  planChecking: 'A csomagod ellenőrzése az Apple-nél.',
  planCheckingPlay: 'A csomagod ellenőrzése a Google Playnél.',
  planFree: 'Ingyenes csomag. Napi két séta és két kávézós rejtvény.',
  planMonthly: 'Korlátlan játék. Havi előfizetés. Havonta megújul, amíg le nem mondod.',
  planLifetime: 'Korlátlan játék. Egyszeri vásárlás. Semmi sem újul meg.',
  planBoth: 'Megvan az egyszeri vásárlásod. A havi előfizetésed még aktív, és már nincs rá szükséged. Mondd le, hogy ne terheljenek meg újra.',
  planError: 'Az Apple most nem tudta ellenőrizni a csomagodat. Próbáld újra később.',
  planErrorPlay: 'A Google Play most nem tudta ellenőrizni a csomagodat. Próbáld újra később.',
  planGetUnlimited: 'Korlátlan játék',
  planManage: 'Előfizetés kezelése vagy lemondása',
  planSwitch: 'Váltás egyszeri vásárlásra',
  planSwitchNote: 'Az egyszeri vásárlással örökre korlátlanul játszhatsz. A havi előfizetésedet ez nem szünteti meg. A vásárlás után mondd le a havi előfizetést az Apple-fiókodban, különben mindkettőért fizetsz.',
  planSwitchNotePlay: 'Az egyszeri vásárlással örökre korlátlanul játszhatsz. A havi előfizetésedet ez nem szünteti meg. A vásárlás után mondd le a havi előfizetést a Google Playben, különben mindkettőért fizetsz.',
  planBuyFor: (price: string) => `Megveszem: ${price}`,
  planNotNow: 'Most nem',
}
