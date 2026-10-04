/**
 * What the app says when something is wrong, or is happening to it: Casey's
 * connection errors, the update banner, the audio notice, the rescue of an
 * older version's progress, Apple's answers about a travel pass, and the two
 * storage failures the backup panel can hit.
 *
 * Register: calm and factual, and it always says what the player still has.
 * A failure that does not say "your round is safe" reads as lost work.
 */
export const system = {
  saveChangeFailed: "The save change could not finish. Please try again before continuing to play.",
  // ── Casey's connection (src/ai/client.ts) ────────────────────────────────
  caseyRefused:
    'Casey’s server refused the request. Your round is safe. Try again in a moment, or check Casey’s connection in Settings.',
  caseyDailyCap:
    'Casey has done all her thinking for today. This phone’s daily limit on her server is used up, and it resets at midnight UTC. Your round is safe; Casey can continue after the reset.',
  baseUrlNotAbsolute:
    'The Base URL must be a full address starting with https://. Check it in Settings.',
  baseUrlNotHttps:
    'The Base URL must use https:// (http:// is allowed only for a local Casey server). Check it in Settings.',
  baseUrlHasExtras:
    'The Base URL may contain only the Casey server address and path, with no credentials, query or fragment. Check it in Settings.',
  selfHostedCaseyRequired: 'Set up Casey in Settings: add your own AI key, or download Gemma.',
  ownKeyRefused: 'Your AI service refused the key. Check it in Settings.',
  ownKeyBadRequest: 'Your AI service refused the request. Check the model name in Settings.',
  ownKeyUnreachable: 'Your AI service could not be reached.',
  caseyNoEndpoint:
    'This Casey server does not have the decision endpoint yet. Update or redeploy the server, then try again.',
  caseyBusy: 'Casey’s model is busy. Wait a moment and retry.',
  caseyRefusedView: 'Casey’s server refused the game view.',
  caseyServerError: 'Casey’s server could not complete the request.',
  offline: 'You appear to be offline.',
  caseyTimeout: (seconds: number) =>
    `Casey took longer than ${seconds} seconds and the request was dropped. Your round is safe; retry when the connection is steadier.`,
  caseyUnreachable:
    'Could not reach Casey. The connection dropped, or the server refused the browser request (CORS). Retry; if it keeps happening, check the Base URL in Settings.',
  caseyNonJson: 'Casey’s server returned a non-JSON response.',
  caseyBadShape: 'Casey’s server returned an unknown response shape.',
  caseyPingFailed: 'Casey did not answer the connection check.',

  // ── a newer build is waiting ─────────────────────────────────────────────
  updateReady: 'A new version of 900words is ready.',
  updateReload: 'Reload',
  updateLater: 'Later',
  offlineReady: 'Ready to play offline.',

  // ── a recording that did not arrive ──────────────────────────────────────
  /** The noun is one of the five below, so each language picks its own case. */
  audioFailed: (what: string) => `${what} did not load.`,
  audioWord: 'The word’s recording',
  audioExample: 'The sentence recording',
  audioChapter: 'The lesson recording',
  audioTask: 'The recording',
  audioSurvival: 'The recording',

  // ── progress found under an older key ────────────────────────────────────
  rescuedProgress: (city: string, packed: number) =>
    `Found progress from an older version: ${city}, ${packed} wrapped ${packed === 1 ? 'word' : 'words'}. Put back.`,
  rescuedAck: 'Good',

  // ── what Apple answered about a travel pass ──────────────────────────────
  passPending:
    'Apple is still confirming this travel pass. Keep the app open, then try Restore purchases.',
  passCancelled: 'No purchase was made.',
  passUnavailable: 'Travel passes are available in the iOS app.',
  passError: 'Apple could not check this travel pass. Please try again.',
  passNotEntitled: 'No travel pass was found for this Apple Account.',
  passRestoreUnavailable: 'Restore purchases is available in the iOS app.',
  passRestoreError: 'Apple could not restore purchases. Please try again.',
  passRedeemOpened: 'Apple opened its code redemption sheet.',
  passRedeemUnavailable: 'Code redemption is available in the iOS app.',
  passPendingPlay: 'Google Play is still confirming this purchase. Keep the app open, then try Restore purchases.',
  passErrorPlay: 'Google Play could not check this purchase. Please try again.',
  passNotEntitledPlay: 'No purchase of unlimited play was found for this Google account.',
  passRestoreErrorPlay: 'Google Play could not restore purchases. Please try again.',

  // ── storage would not do as it was asked ─────────────────────────────────
  backupFileUnreadable: 'That file could not be read.',
  backupWriteFailed: 'Could not write the backup file.',
  clipboardBlocked: 'Clipboard blocked. Select the text below and copy it yourself.',

  // ── a backup file we cannot use (src/backup/backup.ts) ───────────────────
  backupNotJson: 'That file is not JSON. Pick the file you exported from here.',
  backupTooNew: 'That backup was written by a newer version of 900words. Update the app first.',
  backupNotOurs: 'That file is not a 900words backup.',
  backupMaybeOtherApp: ' It may be from another app.',
  /** When Casey fails in a way that is not one of her own errors. */
  companionFailed: 'Something went wrong talking to the AI companion.',
}
