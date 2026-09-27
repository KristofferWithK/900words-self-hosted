import type { Catalogue } from '../en'

/**
 * Norsk bokmål. Du; Casey er «hun». Rolig og saklig — og hver feilmelding sier
 * hva spilleren fortsatt har: «Runden din er trygg.»
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "Endringen av lagringen kunne ikke fullføres. Prøv igjen før du fortsetter å spille.",
  // ── Caseys tilkobling (src/ai/client.ts) ─────────────────────────────────
  caseyRefused:
    'Caseys server avviste forespørselen. Runden din er trygg. Prøv igjen om et øyeblikk, eller sjekk Caseys tilkobling i Innstillinger.',
  caseyDailyCap:
    'Casey har tenkt ferdig for i dag. Dagsgrensen for denne telefonen på serveren hennes er brukt opp, og den nullstilles ved midnatt UTC. Runden din er trygg; Casey kan fortsette etter nullstillingen.',
  baseUrlNotAbsolute:
    'Basis-URL må være en fullstendig adresse som begynner med https://. Sjekk den i Innstillinger.',
  baseUrlNotHttps:
    'Basis-URL må bruke https:// (http:// er bare tillatt for en lokal Casey-server). Sjekk den i Innstillinger.',
  baseUrlHasExtras:
    'Basis-URL kan bare inneholde adressen og stien til Casey-serveren, uten påloggingsopplysninger, spørrestreng eller fragment. Sjekk den i Innstillinger.',
  selfHostedCaseyRequired: 'Sett opp Casey i Innstillinger: Legg til din egen KI-nøkkel eller last ned Gemma.',
  ownKeyRefused: 'KI-tjenesten din avviste nøkkelen. Sjekk den i Innstillinger.',
  ownKeyBadRequest: 'KI-tjenesten din avviste forespørselen. Sjekk modellnavnet i Innstillinger.',
  ownKeyUnreachable: 'Fikk ikke kontakt med KI-tjenesten din.',
  caseyNoEndpoint:
    'Denne Casey-serveren har ikke avgjørelsesendepunktet ennå. Oppdater serveren eller rull den ut på nytt, og prøv så igjen.',
  caseyBusy: 'Caseys modell er opptatt. Vent et øyeblikk og prøv igjen.',
  caseyRefusedView: 'Caseys server avviste spillvisningen.',
  caseyServerError: 'Caseys server kunne ikke fullføre forespørselen.',
  offline: 'Du ser ut til å være frakoblet.',
  caseyTimeout: (seconds) =>
    `Casey brukte mer enn ${seconds} sekunder, og forespørselen ble avbrutt. Runden din er trygg; prøv igjen når tilkoblingen er mer stabil.`,
  caseyUnreachable:
    'Fikk ikke kontakt med Casey. Tilkoblingen ble brutt, eller serveren avviste forespørselen fra nettleseren (CORS). Prøv igjen; fortsetter det, sjekk Basis-URL i Innstillinger.',
  caseyNonJson: 'Caseys server svarte med noe som ikke er JSON.',
  caseyBadShape: 'Caseys server svarte i en ukjent form.',
  caseyPingFailed: 'Casey svarte ikke på tilkoblingstesten.',

  // ── en nyere versjon venter ──────────────────────────────────────────────
  updateReady: 'En ny versjon av 900words er klar.',
  updateReload: 'Oppdater',
  updateLater: 'Senere',
  offlineReady: 'Klar til å spille uten nett.',

  // ── et opptak som ikke kom fram ──────────────────────────────────────────
  audioFailed: (what) => `${what} ble ikke lastet inn.`,
  audioWord: 'Opptaket av ordet',
  audioExample: 'Opptaket av setningen',
  audioChapter: 'Opptaket av leksjonen',
  audioTask: 'Opptaket',
  audioSurvival: 'Opptaket',

  // ── framgang funnet under en eldre lagringsnøkkel ────────────────────────
  rescuedProgress: (city, packed) =>
    `Fant framgang fra en eldre versjon: ${city}, ${packed} ${packed === 1 ? 'innpakket ord' : 'innpakkede ord'}. Lagt tilbake.`,
  rescuedAck: 'Greit',

  // ── hva Apple svarte om reisekortet ──────────────────────────────────────
  passPending:
    'Apple bekrefter fortsatt dette reisekortet. Hold appen åpen, og prøv så Gjenopprett kjøp.',
  passCancelled: 'Ingen kjøp ble gjort.',
  passUnavailable: 'Reisekort er tilgjengelig i iOS-appen.',
  passError: 'Apple kunne ikke sjekke dette reisekortet. Prøv igjen.',
  passNotEntitled: 'Fant ikke noe reisekort for denne Apple-kontoen.',
  passRestoreUnavailable: 'Gjenopprett kjøp er tilgjengelig i iOS-appen.',
  passRestoreError: 'Apple kunne ikke gjenopprette kjøpene. Prøv igjen.',
  passRedeemOpened: 'Apple åpnet vinduet for å løse inn koder.',
  passRedeemUnavailable: 'Koder kan løses inn i iOS-appen.',

  // ── lagringen ville ikke ─────────────────────────────────────────────────
  backupFileUnreadable: 'Den filen kunne ikke leses.',
  backupWriteFailed: 'Kunne ikke skrive sikkerhetskopien.',
  clipboardBlocked: 'Utklippstavlen er blokkert. Merk teksten under og kopier den selv.',

  // ── en sikkerhetskopi vi ikke kan bruke (src/backup/backup.ts) ───────────
  backupNotJson: 'Den filen er ikke JSON. Velg filen du eksporterte herfra.',
  backupTooNew:
    'Den sikkerhetskopien ble laget av en nyere versjon av 900words. Oppdater appen først.',
  backupNotOurs: 'Den filen er ikke en 900words-sikkerhetskopi.',
  backupMaybeOtherApp: ' Den kan være fra en annen app.',
  /** Når Casey svikter på en måte som ikke er en av hennes egne feil. */
  companionFailed: 'Noe gikk galt i samtalen med KI-partneren.',
}
