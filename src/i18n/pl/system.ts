import type { Catalogue } from '../en'
import { plural } from './plural'

/**
 * Polski. Ty, nigdy Pan/Pani. Spokojnie i rzeczowo — a każda awaria mówi, co
 * graczowi zostaje: „Twoja runda jest bezpieczna”.
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "Nie udało się zakończyć zmiany zapisu. Spróbuj ponownie, zanim wrócisz do gry.",
  // ── połączenie Casey ─────────────────────────────────────────────────────
  caseyRefused:
    'Serwer Casey odrzucił żądanie. Twoja runda jest bezpieczna. Spróbuj za chwilę albo sprawdź połączenie Casey w Ustawieniach.',
  caseyDailyCap:
    'Casey wymyśliła już wszystko na dziś. Dzienny limit tego telefonu na jej serwerze się wyczerpał i odnawia się o północy UTC. Twoja runda jest bezpieczna; po odnowieniu Casey gra dalej.',
  baseUrlNotAbsolute:
    'Adres bazowy musi być pełnym adresem zaczynającym się od https://. Sprawdź go w Ustawieniach.',
  baseUrlNotHttps:
    'Adres bazowy musi używać https:// (http:// jest dozwolone tylko dla lokalnego serwera Casey). Sprawdź go w Ustawieniach.',
  baseUrlHasExtras:
    'Adres bazowy może zawierać tylko adres i ścieżkę serwera Casey, bez danych logowania, zapytania ani fragmentu. Sprawdź go w Ustawieniach.',
  selfHostedCaseyRequired: 'Skonfiguruj Casey w Ustawieniach: dodaj własny klucz SI albo pobierz Gemmę.',
  ownKeyRefused: 'Twoja usługa SI odrzuciła klucz. Sprawdź go w Ustawieniach.',
  ownKeyBadRequest: 'Twoja usługa SI odrzuciła żądanie. Sprawdź nazwę modelu w Ustawieniach.',
  ownKeyUnreachable: 'Nie można połączyć się z twoją usługą SI.',
  caseyNoEndpoint:
    'Ten serwer Casey nie ma jeszcze punktu końcowego decyzji. Zaktualizuj albo wdróż serwer ponownie i spróbuj jeszcze raz.',
  caseyBusy: 'Model Casey jest zajęty. Odczekaj chwilę i spróbuj ponownie.',
  caseyRefusedView: 'Serwer Casey odrzucił widok gry.',
  caseyServerError: 'Serwer Casey nie mógł dokończyć żądania.',
  offline: 'Wygląda na to, że jesteś offline.',
  caseyTimeout: (seconds) =>
    `Casey myślała dłużej niż ${seconds} ${plural(seconds, 'sekundę', 'sekundy', 'sekund')} i żądanie przepadło. Twoja runda jest bezpieczna; spróbuj ponownie, gdy połączenie będzie stabilniejsze.`,
  caseyUnreachable:
    'Nie udało się połączyć z Casey. Połączenie zostało przerwane albo serwer odrzucił żądanie przeglądarki (CORS). Spróbuj ponownie; jeśli to się powtarza, sprawdź adres bazowy w Ustawieniach.',
  caseyNonJson: 'Serwer Casey zwrócił odpowiedź, która nie jest JSON-em.',
  caseyBadShape: 'Serwer Casey zwrócił odpowiedź o nieznanym kształcie.',
  caseyPingFailed: 'Casey nie odpowiedziała na sprawdzenie połączenia.',

  // ── czeka nowsza wersja ──────────────────────────────────────────────────
  updateReady: 'Nowa wersja 900words jest gotowa.',
  updateReload: 'Wczytaj ponownie',
  updateLater: 'Później',
  offlineReady: 'Gotowe do gry offline.',

  // ── nagranie, które nie dotarło ──────────────────────────────────────────
  // Każdy z pięciu rzeczowników to „nagranie” (nijakie), stąd „się nie wczytało”.
  audioFailed: (what) => `${what} się nie wczytało.`,
  audioWord: 'Nagranie słowa',
  audioExample: 'Nagranie zdania',
  audioChapter: 'Nagranie lekcji',
  audioTask: 'Nagranie',
  audioSurvival: 'Nagranie',

  // ── postępy znalezione pod starszym kluczem ──────────────────────────────
  rescuedProgress: (city, packed) =>
    `Znaleziono postępy ze starszej wersji: ${city}, ${packed} ${plural(packed, 'zapakowane słowo', 'zapakowane słowa', 'zapakowanych słów')}. Przywrócono.`,
  rescuedAck: 'Dobrze',

  // ── co Apple odpowiedziało o karcie podróżnej ────────────────────────────
  passPending:
    'Apple wciąż potwierdza tę kartę podróżną. Zostaw aplikację otwartą, potem spróbuj „Przywróć zakupy”.',
  passCancelled: 'Nie dokonano zakupu.',
  passUnavailable: 'Karty podróżne są dostępne w aplikacji na iOS.',
  passError: 'Apple nie mogło sprawdzić tej karty podróżnej. Spróbuj ponownie.',
  passNotEntitled: 'Nie znaleziono karty podróżnej dla tego konta Apple.',
  passRestoreUnavailable: '„Przywróć zakupy” jest dostępne w aplikacji na iOS.',
  passRestoreError: 'Apple nie mogło przywrócić zakupów. Spróbuj ponownie.',
  passRedeemOpened: 'Apple otworzyło okno wykorzystania kodu.',
  passRedeemUnavailable: 'Wykorzystanie kodu jest dostępne w aplikacji na iOS.',
  passPendingPlay: 'Google Play wciąż potwierdza ten zakup. Zostaw aplikację otwartą, potem spróbuj „Przywróć zakupy”.',
  passErrorPlay: 'Google Play nie mogło sprawdzić tego zakupu. Spróbuj ponownie.',
  passNotEntitledPlay: 'Nie znaleziono zakupu nielimitowanej gry dla tego konta Google.',
  passRestoreErrorPlay: 'Google Play nie mogło przywrócić zakupów. Spróbuj ponownie.',

  // ── pamięć nie zrobiła, o co ją proszono ─────────────────────────────────
  backupFileUnreadable: 'Nie udało się odczytać tego pliku.',
  backupWriteFailed: 'Nie udało się zapisać pliku kopii zapasowej.',
  clipboardBlocked: 'Schowek zablokowany. Zaznacz tekst poniżej i skopiuj go samodzielnie.',

  // ── kopia zapasowa, której nie umiemy użyć ───────────────────────────────
  backupNotJson: 'Ten plik to nie JSON. Wybierz plik wyeksportowany stąd.',
  backupTooNew: 'Tę kopię zapisała nowsza wersja 900words. Najpierw zaktualizuj aplikację.',
  backupNotOurs: 'Ten plik to nie kopia zapasowa 900words.',
  backupMaybeOtherApp: ' Może pochodzić z innej aplikacji.',
  companionFailed: 'Coś poszło nie tak w rozmowie z partnerką AI.',
}
