import type { Catalogue } from '../en'

/**
 * Deutsch. Du, nie Sie. Ruhig und sachlich — und jede Störung sagt, was dem
 * Spieler bleibt: „Deine Runde ist sicher.“
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "Die Änderung des Spielstands konnte nicht abgeschlossen werden. Bitte versuche es erneut, bevor du weiterspielst.",
  // ── Caseys Verbindung ────────────────────────────────────────────────────
  caseyRefused:
    'Caseys Server hat die Anfrage abgelehnt. Deine Runde ist sicher. Versuch es gleich noch einmal oder prüfe Caseys Verbindung in den Einstellungen.',
  caseyDailyCap:
    'Casey hat für heute genug nachgedacht. Das Tageslimit dieses Telefons auf ihrem Server ist aufgebraucht; um Mitternacht UTC wird es zurückgesetzt. Deine Runde ist sicher, danach kann Casey weitermachen.',
  baseUrlNotAbsolute:
    'Die Basis-URL muss eine vollständige Adresse sein, die mit https:// beginnt. Prüfe sie in den Einstellungen.',
  baseUrlNotHttps:
    'Die Basis-URL muss https:// verwenden (http:// ist nur für einen lokalen Casey-Server erlaubt). Prüfe sie in den Einstellungen.',
  baseUrlHasExtras:
    'Die Basis-URL darf nur die Adresse und den Pfad des Casey-Servers enthalten, ohne Zugangsdaten, Query-String oder Fragment. Prüfe sie in den Einstellungen.',
  selfHostedCaseyRequired: 'Richte Casey in den Einstellungen ein: Füge deinen eigenen KI-Schlüssel hinzu oder lade Gemma herunter.',
  ownKeyRefused: 'Dein KI-Dienst hat den Schlüssel abgelehnt. Prüfe ihn in den Einstellungen.',
  ownKeyBadRequest: 'Dein KI-Dienst hat die Anfrage abgelehnt. Prüfe den Modellnamen in den Einstellungen.',
  ownKeyUnreachable: 'Dein KI-Dienst ist nicht erreichbar.',
  caseyNoEndpoint:
    'Dieser Casey-Server hat den Entscheidungs-Endpunkt noch nicht. Aktualisiere den Server oder deploye ihn neu, dann versuch es noch einmal.',
  caseyBusy: 'Caseys Modell ist beschäftigt. Warte einen Moment und versuch es noch einmal.',
  caseyRefusedView: 'Caseys Server hat die Spielansicht abgelehnt.',
  caseyServerError: 'Caseys Server konnte die Anfrage nicht abschließen.',
  offline: 'Du bist anscheinend offline.',
  caseyTimeout: (seconds) =>
    `Casey hat länger als ${seconds} Sekunden gebraucht, und die Anfrage wurde verworfen. Deine Runde ist sicher; versuch es noch einmal, wenn die Verbindung stabiler ist.`,
  caseyUnreachable:
    'Casey war nicht erreichbar. Die Verbindung ist abgebrochen, oder der Server hat die Browser-Anfrage abgelehnt (CORS). Versuch es noch einmal; wenn es so bleibt, prüfe die Basis-URL in den Einstellungen.',
  caseyNonJson: 'Caseys Server hat kein JSON zurückgegeben.',
  caseyBadShape: 'Caseys Server hat eine Antwort in unbekannter Form zurückgegeben.',
  caseyPingFailed: 'Casey hat auf die Verbindungsprüfung nicht geantwortet.',

  // ── eine neuere Version wartet ───────────────────────────────────────────
  updateReady: 'Eine neue Version von 900words ist bereit.',
  updateReload: 'Neu laden',
  updateLater: 'Später',
  offlineReady: 'Bereit zum Spielen ohne Netz.',

  // ── eine Aufnahme, die nicht ankam ───────────────────────────────────────
  audioFailed: (what) => `${what} konnte nicht geladen werden.`,
  audioWord: 'Die Aufnahme des Wortes',
  audioExample: 'Die Satzaufnahme',
  audioChapter: 'Die Aufnahme der Lektion',
  audioTask: 'Die Aufnahme',
  audioSurvival: 'Die Aufnahme',

  // ── Fortschritt unter einem älteren Schlüssel gefunden ───────────────────
  rescuedProgress: (city, packed) =>
    `Fortschritt aus einer älteren Version gefunden: ${city}, ${packed} ${packed === 1 ? 'eingewickeltes Wort' : 'eingewickelte Wörter'}. Wiederhergestellt.`,
  rescuedAck: 'Alles klar',

  // ── was Apple zum Reiseticket gesagt hat ─────────────────────────────────
  passPending:
    'Apple bestätigt dieses Reiseticket noch. Lass die App offen und tippe dann auf „Käufe wiederherstellen“.',
  passCancelled: 'Es wurde nichts gekauft.',
  passUnavailable: 'Reisetickets gibt es in der iOS-App.',
  passError: 'Apple konnte dieses Reiseticket nicht prüfen. Bitte versuch es noch einmal.',
  passNotEntitled: 'Für diesen Apple Account wurde kein Reiseticket gefunden.',
  passRestoreUnavailable: '„Käufe wiederherstellen“ gibt es in der iOS-App.',
  passRestoreError: 'Apple konnte die Käufe nicht wiederherstellen. Bitte versuch es noch einmal.',
  passRedeemOpened: 'Apple hat das Fenster zum Einlösen von Codes geöffnet.',
  passRedeemUnavailable: 'Codes einlösen geht nur in der iOS-App.',
  passPendingPlay: 'Google Play bestätigt diesen Kauf noch. Lass die App offen und tippe dann auf „Käufe wiederherstellen“.',
  passErrorPlay: 'Google Play konnte diesen Kauf nicht prüfen. Bitte versuch es noch einmal.',
  passNotEntitledPlay: 'Für dieses Google-Konto wurde kein Kauf von unbegrenztem Spielen gefunden.',
  passRestoreErrorPlay: 'Google Play konnte die Käufe nicht wiederherstellen. Bitte versuch es noch einmal.',

  // ── der Speicher wollte nicht ────────────────────────────────────────────
  backupFileUnreadable: 'Diese Datei konnte nicht gelesen werden.',
  backupWriteFailed: 'Die Sicherungsdatei konnte nicht geschrieben werden.',
  clipboardBlocked:
    'Zwischenablage blockiert. Markiere den Text unten und kopiere ihn selbst.',

  // ── eine Sicherung, die wir nicht lesen können ───────────────────────────
  backupNotJson: 'Diese Datei ist kein JSON. Wähl die Datei, die du hier exportiert hast.',
  backupTooNew:
    'Diese Sicherung stammt aus einer neueren Version von 900words. Aktualisiere zuerst die App.',
  backupNotOurs: 'Diese Datei ist keine 900words-Sicherung.',
  backupMaybeOtherApp: ' Vielleicht gehört sie zu einer anderen App.',
  companionFailed: 'Beim Gespräch mit der KI-Partnerin ist etwas schiefgegangen.',
}
