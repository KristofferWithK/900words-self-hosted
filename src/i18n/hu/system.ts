import type { Catalogue } from '../en'

/**
 * Magyar. Tegezés. Nyugodt és tárgyilagos — és minden hiba megmondja, mi
 * marad a játékosnak: „A köröd biztonságban van.”
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "A mentés módosítása nem fejeződött be. Próbáld újra, mielőtt folytatod a játékot.",
  // ── Casey kapcsolata ─────────────────────────────────────────────────────
  caseyRefused:
    'Casey szervere elutasította a kérést. A köröd biztonságban van. Próbáld újra kicsit később, vagy ellenőrizd Casey kapcsolatát a Beállításokban.',
  caseyDailyCap:
    'Casey mára kigondolkodta magát. Ennek a telefonnak a napi kerete elfogyott a szerverén, és éjfélkor (UTC) nullázódik. A köröd biztonságban van; Casey a nullázás után folytathatja.',
  baseUrlNotAbsolute:
    'Az alap-URL-nek teljes, https://-vel kezdődő címnek kell lennie. Ellenőrizd a Beállításokban.',
  baseUrlNotHttps:
    'Az alap-URL-nek https://-t kell használnia (http:// csak helyi Casey-szerverhez engedélyezett). Ellenőrizd a Beállításokban.',
  baseUrlHasExtras:
    'Az alap-URL csak a Casey-szerver címét és útvonalát tartalmazhatja, hitelesítő adatot, lekérdezést vagy töredéket nem. Ellenőrizd a Beállításokban.',
  selfHostedCaseyRequired: 'Állítsd be Casey-t a Beállításokban: add meg a saját MI-kulcsodat, vagy töltsd le a Gemmát.',
  ownKeyRefused: 'Az MI-szolgáltatásod elutasította a kulcsot. Ellenőrizd a Beállításokban.',
  ownKeyBadRequest: 'Az MI-szolgáltatásod elutasította a kérést. Ellenőrizd a modell nevét a Beállításokban.',
  ownKeyUnreachable: 'Az MI-szolgáltatásod nem érhető el.',
  caseyNoEndpoint:
    'Ezen a Casey-szerveren még nincs döntési végpont. Frissítsd vagy telepítsd újra a szervert, majd próbáld újra.',
  caseyBusy: 'Casey modellje foglalt. Várj egy pillanatot, és próbáld újra.',
  caseyRefusedView: 'Casey szervere elutasította a játéknézetet.',
  caseyServerError: 'Casey szervere nem tudta teljesíteni a kérést.',
  offline: 'Úgy tűnik, nincs internetkapcsolatod.',
  caseyTimeout: (seconds) =>
    `Casey ${seconds} másodpercnél tovább gondolkodott, ezért a kérést eldobtuk. A köröd biztonságban van; próbáld újra, amikor stabilabb a kapcsolat.`,
  caseyUnreachable:
    'Casey nem érhető el. Megszakadt a kapcsolat, vagy a szerver elutasította a böngésző kérését (CORS). Próbáld újra; ha így marad, ellenőrizd az alap-URL-t a Beállításokban.',
  caseyNonJson: 'Casey szervere nem JSON-választ küldött.',
  caseyBadShape: 'Casey szervere ismeretlen alakú választ küldött.',
  caseyPingFailed: 'Casey nem válaszolt a kapcsolattesztre.',

  // ── újabb verzió vár ─────────────────────────────────────────────────────
  updateReady: 'A 900words új verziója kész.',
  updateReload: 'Újratöltés',
  updateLater: 'Később',
  offlineReady: 'Offline is játszható.',

  // ── egy felvétel, amely nem érkezett meg ─────────────────────────────────
  audioFailed: (what) => `${what} nem töltődött be.`,
  audioWord: 'A szó felvétele',
  audioExample: 'A mondat felvétele',
  audioChapter: 'A lecke felvétele',
  audioTask: 'A felvétel',
  audioSurvival: 'A felvétel',

  // ── régebbi kulcs alatt talált haladás ───────────────────────────────────
  rescuedProgress: (city, packed) =>
    `Régebbi verzióból származó haladást találtunk: ${city}, ${packed} becsomagolt szó. Visszatettük.`,
  rescuedAck: 'Rendben',

  // ── amit az Apple a bérletről mondott ────────────────────────────────────
  passPending:
    'Az Apple még visszaigazolja ezt a bérletet. Hagyd nyitva az appot, majd próbáld a Vásárlások visszaállítását.',
  passCancelled: 'Nem történt vásárlás.',
  passUnavailable: 'A bérletek az iOS-appban érhetők el.',
  passError: 'Az Apple nem tudta ellenőrizni ezt a bérletet. Kérlek, próbáld újra.',
  passNotEntitled: 'Ehhez az Apple-fiókhoz nem találtunk bérletet.',
  passRestoreUnavailable: 'A Vásárlások visszaállítása az iOS-appban érhető el.',
  passRestoreError: 'Az Apple nem tudta visszaállítani a vásárlásokat. Kérlek, próbáld újra.',
  passRedeemOpened: 'Az Apple megnyitotta a kódbeváltó lapját.',
  passRedeemUnavailable: 'A kódbeváltás az iOS-appban érhető el.',
  passPendingPlay: 'A Google Play még visszaigazolja ezt a vásárlást. Hagyd nyitva az appot, majd próbáld a Vásárlások visszaállítását.',
  passErrorPlay: 'A Google Play nem tudta ellenőrizni ezt a vásárlást. Kérlek, próbáld újra.',
  passNotEntitledPlay: 'Ehhez a Google-fiókhoz nem találtunk korlátlan játékra szóló vásárlást.',
  passRestoreErrorPlay: 'A Google Play nem tudta visszaállítani a vásárlásokat. Kérlek, próbáld újra.',

  // ── a tároló nem tette, amit kértünk ─────────────────────────────────────
  backupFileUnreadable: 'Ezt a fájlt nem sikerült beolvasni.',
  backupWriteFailed: 'A mentésfájlt nem sikerült kiírni.',
  clipboardBlocked: 'A vágólap le van tiltva. Jelöld ki a lenti szöveget, és másold ki magad.',

  // ── egy mentés, amit nem tudunk használni ────────────────────────────────
  backupNotJson: 'Ez a fájl nem JSON. Válaszd az innen exportált fájlt.',
  backupTooNew: 'Ezt a mentést a 900words újabb verziója írta. Először frissítsd az appot.',
  backupNotOurs: 'Ez a fájl nem 900words-mentés.',
  backupMaybeOtherApp: ' Lehet, hogy egy másik appból származik.',
  companionFailed: 'Valami hiba történt az MI-társsal való beszélgetésben.',
}
