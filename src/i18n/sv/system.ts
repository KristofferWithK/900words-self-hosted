import type { Catalogue } from '../en'

/**
 * Svenska. Du; Casey är ”hon”. Lugnt och sakligt — och varje störning säger
 * vad spelaren har kvar: ”Din runda är kvar.”
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "Ändringen av sparningen kunde inte slutföras. Försök igen innan du fortsätter spela.",
  // ── Caseys anslutning ────────────────────────────────────────────────────
  caseyRefused:
    'Caseys server avvisade förfrågan. Din runda är kvar. Försök igen om en stund, eller kontrollera Caseys anslutning i Inställningar.',
  caseyDailyCap:
    'Casey har tänkt färdigt för i dag. Den här telefonens dagsgräns på hennes server är förbrukad, och den återställs vid midnatt UTC. Din runda är kvar; Casey kan fortsätta efter återställningen.',
  baseUrlNotAbsolute:
    'Bas-URL:en måste vara en fullständig adress som börjar med https://. Kontrollera den i Inställningar.',
  baseUrlNotHttps:
    'Bas-URL:en måste använda https:// (http:// tillåts bara för en lokal Casey-server). Kontrollera den i Inställningar.',
  baseUrlHasExtras:
    'Bas-URL:en får bara innehålla Casey-serverns adress och sökväg, utan inloggningsuppgifter, frågesträng eller fragment. Kontrollera den i Inställningar.',
  selfHostedCaseyRequired: 'Ställ in Casey i Inställningar: lägg till din egen AI-nyckel eller ladda ner Gemma.',
  ownKeyRefused: 'Din AI-tjänst avvisade nyckeln. Kontrollera den i Inställningar.',
  ownKeyBadRequest: 'Din AI-tjänst avvisade förfrågan. Kontrollera modellnamnet i Inställningar.',
  ownKeyUnreachable: 'Det gick inte att nå din AI-tjänst.',
  caseyNoEndpoint:
    'Den här Casey-servern har inte beslutsändpunkten än. Uppdatera eller driftsätt servern på nytt och försök sedan igen.',
  caseyBusy: 'Caseys modell är upptagen. Vänta en stund och försök igen.',
  caseyRefusedView: 'Caseys server avvisade spelvyn.',
  caseyServerError: 'Caseys server kunde inte slutföra förfrågan.',
  offline: 'Du verkar vara offline.',
  caseyTimeout: (seconds) =>
    `Casey tog längre än ${seconds} sekunder och förfrågan avbröts. Din runda är kvar; försök igen när anslutningen är stabilare.`,
  caseyUnreachable:
    'Kunde inte nå Casey. Anslutningen bröts, eller servern avvisade webbläsarens förfrågan (CORS). Försök igen; händer det upprepade gånger, kontrollera bas-URL:en i Inställningar.',
  caseyNonJson: 'Caseys server returnerade ett svar som inte är JSON.',
  caseyBadShape: 'Caseys server returnerade ett svar i okänt format.',
  caseyPingFailed: 'Casey svarade inte på anslutningstestet.',

  // ── en nyare version väntar ──────────────────────────────────────────────
  updateReady: 'En ny version av 900words är redo.',
  updateReload: 'Ladda om',
  updateLater: 'Senare',
  offlineReady: 'Redo att spela offline.',

  // ── en inspelning som inte kom fram ──────────────────────────────────────
  audioFailed: (what) => `${what} kunde inte laddas.`,
  audioWord: 'Ordets inspelning',
  audioExample: 'Meningens inspelning',
  audioChapter: 'Lektionens inspelning',
  audioTask: 'Inspelningen',
  audioSurvival: 'Inspelningen',

  // ── framsteg hittade under en äldre nyckel ───────────────────────────────
  rescuedProgress: (city, packed) =>
    `Hittade framsteg från en äldre version: ${city}, ${packed} ${packed === 1 ? 'inslaget ord' : 'inslagna ord'}. Återställt.`,
  rescuedAck: 'Bra',

  // ── vad Apple svarade om ett resekort ────────────────────────────────────
  passPending:
    'Apple bekräftar fortfarande det här resekortet. Håll appen öppen och prova sedan ”Återställ köp”.',
  passCancelled: 'Inget köp gjordes.',
  passUnavailable: 'Resekort finns i iOS-appen.',
  passError: 'Apple kunde inte kontrollera det här resekortet. Försök igen.',
  passNotEntitled: 'Inget resekort hittades för det här Apple-kontot.',
  passRestoreUnavailable: '”Återställ köp” finns i iOS-appen.',
  passRestoreError: 'Apple kunde inte återställa köpen. Försök igen.',
  passRedeemOpened: 'Apple öppnade sitt fönster för att lösa in koder.',
  passRedeemUnavailable: 'Koder kan bara lösas in i iOS-appen.',

  // ── lagringen gjorde inte som den blev tillsagd ──────────────────────────
  backupFileUnreadable: 'Filen kunde inte läsas.',
  backupWriteFailed: 'Säkerhetskopian kunde inte skrivas.',
  clipboardBlocked: 'Urklipp blockerat. Markera texten nedan och kopiera den själv.',

  // ── en säkerhetskopia vi inte kan använda ────────────────────────────────
  backupNotJson: 'Filen är inte JSON. Välj filen du exporterade härifrån.',
  backupTooNew: 'Säkerhetskopian skrevs av en nyare version av 900words. Uppdatera appen först.',
  backupNotOurs: 'Filen är inte en säkerhetskopia från 900words.',
  backupMaybeOtherApp: ' Den kan komma från en annan app.',
  companionFailed: 'Något gick fel i kontakten med AI-partnern.',
}
