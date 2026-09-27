import type { Catalogue } from '../en'

export const system: Catalogue['system'] = {
  saveChangeFailed: "No se pudo completar el cambio de la partida guardada. Inténtalo de nuevo antes de seguir jugando.",
  // ── la conexión de Casey ─────────────────────────────────────────────────
  caseyRefused:
    'El servidor de Casey ha rechazado la petición. Tu ronda está a salvo: vuelve a intentarlo en un momento o comprueba la conexión de Casey en Ajustes.',
  caseyDailyCap:
    'Casey ya ha pensado todo lo que le tocaba por hoy: el límite diario de este teléfono en su servidor está agotado y se restablece a medianoche UTC. Tu ronda está a salvo; Casey podrá seguir entonces.',
  baseUrlNotAbsolute:
    'La URL base debe ser una dirección completa que empiece por https://. Compruébala en Ajustes.',
  baseUrlNotHttps:
    'La URL base debe usar https:// (http:// solo se permite para un servidor de Casey local). Compruébala en Ajustes.',
  baseUrlHasExtras:
    'La URL base solo puede contener la dirección y la ruta del servidor de Casey: sin credenciales, parámetros ni fragmento. Compruébala en Ajustes.',
  selfHostedCaseyRequired: 'Configura Casey en Ajustes: añade tu propia clave de IA o descarga Gemma.',
  ownKeyRefused: 'Tu servicio de IA ha rechazado la clave. Revísala en Ajustes.',
  ownKeyBadRequest: 'Tu servicio de IA ha rechazado la petición. Revisa el nombre del modelo en Ajustes.',
  ownKeyUnreachable: 'No se ha podido conectar con tu servicio de IA.',
  caseyNoEndpoint:
    'Este servidor de Casey todavía no tiene el endpoint de decisión. Actualiza o vuelve a desplegar el servidor y prueba otra vez.',
  caseyBusy: 'El modelo de Casey está ocupado. Espera un momento y vuelve a intentarlo.',
  caseyRefusedView: 'El servidor de Casey ha rechazado la vista de la partida.',
  caseyServerError: 'El servidor de Casey no ha podido completar la petición.',
  offline: 'Parece que no tienes conexión.',
  caseyTimeout: (seconds) =>
    `Casey ha tardado más de ${seconds} segundos y la petición se ha descartado. Tu ronda está a salvo; vuelve a intentarlo cuando la conexión sea más estable.`,
  caseyUnreachable:
    'No se ha podido contactar con Casey: la conexión se ha cortado o el servidor ha rechazado la petición del navegador (CORS). Vuelve a intentarlo; si sigue pasando, comprueba la URL base en Ajustes.',
  caseyNonJson: 'El servidor de Casey ha devuelto una respuesta que no es JSON.',
  caseyBadShape: 'El servidor de Casey ha devuelto una respuesta con un formato desconocido.',
  caseyPingFailed: 'Casey no ha respondido a la comprobación de conexión.',

  // ── hay una versión más nueva esperando ──────────────────────────────────
  updateReady: 'Hay una versión nueva de 900words lista.',
  updateReload: 'Recargar',
  updateLater: 'Más tarde',
  offlineReady: 'Ya puedes jugar sin conexión.',

  // ── una grabación que no llegó ───────────────────────────────────────────
  audioFailed: (what) => `No se ha podido cargar ${what}.`,
  audioWord: 'la grabación de la palabra',
  audioExample: 'la grabación de la frase',
  audioChapter: 'la grabación de la lección',
  audioTask: 'la grabación',
  audioSurvival: 'la grabación',

  // ── progreso encontrado bajo una clave antigua ───────────────────────────
  rescuedProgress: (city, packed) =>
    `Se ha encontrado progreso de una versión anterior: ${city}, ${packed} ${packed === 1 ? 'palabra envuelta' : 'palabras envueltas'}. Recuperado.`,
  rescuedAck: 'Bien',

  // ── lo que Apple ha dicho del abono de viaje ─────────────────────────────
  passPending:
    'Apple todavía está confirmando este abono de viaje. Deja la app abierta y luego prueba Restaurar compras.',
  passCancelled: 'No se ha realizado ninguna compra.',
  passUnavailable: 'Los abonos de viaje están disponibles en la app de iOS.',
  passError: 'Apple no ha podido comprobar este abono de viaje. Inténtalo de nuevo.',
  passNotEntitled: 'No se ha encontrado ningún abono de viaje para esta cuenta de Apple.',
  passRestoreUnavailable: 'Restaurar compras está disponible en la app de iOS.',
  passRestoreError: 'Apple no ha podido restaurar las compras. Inténtalo de nuevo.',
  passRedeemOpened: 'Apple ha abierto su panel para canjear códigos.',
  passRedeemUnavailable: 'Los códigos se canjean en la app de iOS.',

  // ── el almacenamiento no ha obedecido ────────────────────────────────────
  backupFileUnreadable: 'No se ha podido leer ese archivo.',
  backupWriteFailed: 'No se ha podido escribir el archivo de copia de seguridad.',
  clipboardBlocked: 'Portapapeles bloqueado: selecciona el texto de abajo y cópialo a mano.',

  // ── una copia de seguridad que no podemos usar ───────────────────────────
  backupNotJson: 'Ese archivo no es JSON. Elige el archivo que exportaste desde aquí.',
  backupTooNew:
    'Esa copia se escribió con una versión más nueva de 900words. Actualiza la app primero.',
  backupNotOurs: 'Ese archivo no es una copia de seguridad de 900words.',
  backupMaybeOtherApp: ' Puede que sea de otra app.',
  companionFailed: 'Algo ha salido mal al hablar con la compañera de IA.',
}
