import type { Catalogue } from '../en'

/**
 * Nederlands. Je/jij, nooit u. Rustig en zakelijk — en elke storing zegt wat
 * de speler overhoudt: ‘Je ronde is veilig.’
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "De wijziging van de opgeslagen gegevens kon niet worden voltooid. Probeer het opnieuw voordat je verder speelt.",
  // ── Casey’s verbinding (src/ai/client.ts) ────────────────────────────────
  caseyRefused:
    'Casey’s server heeft het verzoek geweigerd. Je ronde is veilig. Probeer het zo nog eens, of controleer Casey’s verbinding in Instellingen.',
  caseyDailyCap:
    'Casey heeft voor vandaag genoeg nagedacht. De daglimiet van deze telefoon op haar server is op en wordt om middernacht UTC gereset. Je ronde is veilig; na de reset kan Casey verder.',
  baseUrlNotAbsolute:
    'De basis-URL moet een volledig adres zijn dat met https:// begint. Controleer hem in Instellingen.',
  baseUrlNotHttps:
    'De basis-URL moet https:// gebruiken (http:// mag alleen voor een lokale Casey-server). Controleer hem in Instellingen.',
  baseUrlHasExtras:
    'De basis-URL mag alleen het adres en het pad van de Casey-server bevatten, zonder inloggegevens, query of fragment. Controleer hem in Instellingen.',
  selfHostedCaseyRequired: 'Stel Casey in bij Instellingen: voeg je eigen AI-sleutel toe of download Gemma.',
  ownKeyRefused: 'Je AI-dienst heeft de sleutel geweigerd. Controleer hem bij Instellingen.',
  ownKeyBadRequest: 'Je AI-dienst heeft het verzoek geweigerd. Controleer de modelnaam bij Instellingen.',
  ownKeyUnreachable: 'Je AI-dienst is niet bereikbaar.',
  caseyNoEndpoint:
    'Deze Casey-server heeft het beslissings-endpoint nog niet. Werk de server bij of deploy hem opnieuw, en probeer het dan nog eens.',
  caseyBusy: 'Casey’s model heeft het druk. Wacht even en probeer het opnieuw.',
  caseyRefusedView: 'Casey’s server heeft de spelweergave geweigerd.',
  caseyServerError: 'Casey’s server kon het verzoek niet afronden.',
  offline: 'Je lijkt offline te zijn.',
  caseyTimeout: (seconds) =>
    `Casey deed er langer dan ${seconds} seconden over en het verzoek is afgebroken. Je ronde is veilig; probeer het opnieuw als de verbinding stabieler is.`,
  caseyUnreachable:
    'Casey was niet bereikbaar. De verbinding viel weg, of de server weigerde het browserverzoek (CORS). Probeer het opnieuw; blijft het gebeuren, controleer dan de basis-URL in Instellingen.',
  caseyNonJson: 'Casey’s server gaf geen JSON terug.',
  caseyBadShape: 'Casey’s server gaf een antwoord in een onbekende vorm terug.',
  caseyPingFailed: 'Casey heeft niet geantwoord op de verbindingstest.',

  // ── er staat een nieuwere versie klaar ───────────────────────────────────
  updateReady: 'Er staat een nieuwe versie van 900words klaar.',
  updateReload: 'Herladen',
  // ‘Later’ is ook het Nederlandse woord, maar poort 3 weigert het; ‘Straks’
  // is wat een update-melding hier natuurlijk zegt.
  updateLater: 'Later',
  offlineReady: 'Klaar om offline te spelen.',

  // ── een opname die niet aankwam ──────────────────────────────────────────
  audioFailed: (what) => `${what} is niet geladen.`,
  audioWord: 'De opname van het woord',
  audioExample: 'De opname van de zin',
  audioChapter: 'De opname van de les',
  audioTask: 'De opname',
  audioSurvival: 'De opname',

  // ── voortgang gevonden onder een oudere sleutel ──────────────────────────
  rescuedProgress: (city, packed) =>
    `Voortgang uit een oudere versie gevonden: ${city}, ${packed} ${packed === 1 ? 'verpakt woord' : 'verpakte woorden'}. Teruggezet.`,
  rescuedAck: 'Mooi',

  // ── wat Apple over een reispas antwoordde ────────────────────────────────
  passPending:
    'Apple bevestigt deze reispas nog. Houd de app open en probeer dan Aankopen herstellen.',
  passCancelled: 'Er is niets gekocht.',
  passUnavailable: 'Reispassen zijn er in de iOS-app.',
  passError: 'Apple kon deze reispas niet controleren. Probeer het nog eens.',
  passNotEntitled: 'Er is geen reispas gevonden voor dit Apple Account.',
  passRestoreUnavailable: 'Aankopen herstellen kan in de iOS-app.',
  passRestoreError: 'Apple kon de aankopen niet herstellen. Probeer het nog eens.',
  passRedeemOpened: 'Apple heeft het venster voor het inwisselen van codes geopend.',
  passRedeemUnavailable: 'Codes inwisselen kan in de iOS-app.',
  passPendingPlay: 'Google Play bevestigt deze aankoop nog. Houd de app open en probeer dan Aankopen herstellen.',
  passErrorPlay: 'Google Play kon deze aankoop niet controleren. Probeer het nog eens.',
  passNotEntitledPlay: 'Er is geen aankoop van onbeperkt spelen gevonden voor dit Google-account.',
  passRestoreErrorPlay: 'Google Play kon de aankopen niet herstellen. Probeer het nog eens.',

  // ── de opslag wilde niet ─────────────────────────────────────────────────
  backupFileUnreadable: 'Dat bestand kon niet worden gelezen.',
  backupWriteFailed: 'Het back-upbestand kon niet worden geschreven.',
  clipboardBlocked:
    'Klembord geblokkeerd. Selecteer de tekst hieronder en kopieer hem zelf.',

  // ── een back-up die we niet kunnen gebruiken (src/backup/backup.ts) ──────
  backupNotJson: 'Dat bestand is geen JSON. Kies het bestand dat je hier hebt geëxporteerd.',
  backupTooNew:
    'Die back-up is gemaakt door een nieuwere versie van 900words. Werk eerst de app bij.',
  backupNotOurs: 'Dat bestand is geen back-up van 900words.',
  backupMaybeOtherApp: ' Misschien komt het uit een andere app.',
  companionFailed: 'Er ging iets mis in het gesprek met je AI-metgezel.',
}
