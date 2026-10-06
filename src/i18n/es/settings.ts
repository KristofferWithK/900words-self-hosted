import type { Catalogue } from '../en'

export const settings: Catalogue['settings'] = {
  // ── la pantalla ──────────────────────────────────────────────────────────
  title: 'Ajustes',
  backAria: 'Atrás',

  // ── el idioma en el que habla la app ─────────────────────────────────────
  uiLanguageLabel: 'Tu idioma',
  uiLanguageHelp:
    'El idioma en el que la app te habla. Al cambiarlo, la app se recarga; tu colección y tu viaje se conservan.',

  // ── el idioma que estás aprendiendo ──────────────────────────────────────
  learnerLanguageLabel: 'Idioma',
  learnerLanguageHelp:
    'Cada idioma tiene su propio viaje. Vuelve a un idioma para continuar donde lo dejaste.',
  learnerLanguagePreviewTag: 'vista previa',
  learnerLanguagePreviewHelp:
    'El alemán es una vista previa: el mapa y la guía de viaje ya están, el juego de palabras no. Sus lecciones todavía no las ha revisado una persona nativa.',

  // ── el cerebro de Casey ──────────────────────────────────────────────────
  caseyBrainHeading: 'El cerebro de Casey',
  caseyServerNote:
    'Casey juega desde el servidor propio de 900words. No hay nada que configurar; el botón de abajo comprueba que responde.',
  normalOllamaCaseyLabel: 'Casey normal con Ollama',
  normalOllamaCaseyDetail: 'gpt-oss 120B · pistas e intentos',
  normalOllamaCaseyAria: 'Usar Casey normal con Ollama',
  normalCaseyOn: 'Casey normal está activada',
  normalCaseyOff: 'Casey normal está desactivada',
  prototypeOn: 'El prototipo sin agente está activado',
  customCaseyOn: 'El servicio de Casey personalizado está activado',
  normalCaseyDetail: 'Ollama juega y traduce. Gemma está desactivada.',
  gemmaModeDetail:
    'Gemma 4 E4B se encarga de las pistas y los intentos. Las palabras que el diccionario no tiene siguen pasando por Ollama.',
  prototypeDetail: 'Este modo de prueba local no es Casey, ni Ollama, ni Gemma.',
  customCaseyDetail:
    'Hay un Worker de Casey personalizado seleccionado. Las palabras que el diccionario no tiene van a ese servicio.',
  baseUrlLabel: 'URL base',
  baseUrlHelpBefore:
    'La fija el interruptor de arriba, o escribe la dirección de tu propio Worker de Casey más ',
  baseUrlHelpAfter: '. Debe empezar por https://, para que nada de tu partida viaje sin cifrar.',
  baseUrlUnusable: 'Esa URL base no se puede usar.',

  // ── el modelo en el dispositivo ──────────────────────────────────────────
  gemmaUnavailableNote: 'El modo sin conexión funciona en las apps de 900words para iPhone y Android.',
  gemmaReady: (size) => `Casey sin conexión está lista (${size} en este iPhone).`,
  gemmaRemoveConfirm: '¿Quitar Casey sin conexión de este iPhone? Puedes volver a descargarla más tarde.',
  gemmaRemoveButton: 'Quitar Casey sin conexión',
  gemmaProgressAria: 'Progreso de la descarga de Casey sin conexión',
  gemmaDownloading: (percent) => `${percent} % - mantén 900words abierta y con Wi-Fi.`,
  gemmaCancelDownloadButton: 'Cancelar la descarga',
  gemmaDownloadNote: (size) =>
    `Casey sin conexión es una descarga de ${size}. Usa wifi y deja 900words abierta hasta que termine.`,
  gemmaDownloadButton: 'Descargar Casey sin conexión',
  gemmaDownloadFailed: 'La descarga ha fallado.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Modo sin conexión',
  offlineModeExperimentalTag: 'Experimental',
  offlineModeLabel: 'Jugar sin internet',
  offlineModeHelp:
    'Casey normal juega desde el servidor de 900words. Con el modo sin conexión puedes terminar una ronda con Casey sin conexión en este iPhone cuando no hay internet. Es más lenta.',
  offlineModeAria: 'Modo sin conexión',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `El modo sin conexión es experimental y todavía se está mejorando.\n\nEl modo sin conexión descarga Casey sin conexión (${size}) en este iPhone. Usa wifi y deja 900words abierta hasta que termine la descarga.\n\nCasey sin conexión juega más despacio que Casey normal.\n\nNecesita un iPhone más reciente: ${iphones}.${lowMemory ? '\n\nEste iPhone tiene menos memoria que esos modelos. Puede que no funcione en él.' : ''}\n\n¿Descargar ahora?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'La IA de Casey',
  ossCaseyHelp: 'Este 900words lo has compilado tú. Casey necesita una IA para jugar: tu propia clave de IA o Gemma en este iPhone.',
  ownKeyOption: 'Tu propia clave de IA',
  ownKeyHelp: 'Cualquier servicio compatible con OpenAI. Tu clave se guarda solo en este dispositivo y solo se envía a la dirección de abajo.',
  ownKeyAddressLabel: 'Dirección del servicio',
  ownKeyModelLabel: 'Modelo',
  ownKeyKeyLabel: 'Clave de API',
  ownKeyAnswered: 'Tu servicio de IA ha respondido.',
  gemmaOption: 'Gemma en este iPhone',
  gemmaOptionHelp: 'Casey juega en este iPhone, sin internet y sin clave. Es más lenta.',
  ossCaseyHelpAndroid: 'Este 900words lo has compilado tú. Casey necesita una IA para jugar: tu propia clave de IA o Gemma en este móvil Android.',
  gemmaOptionAndroid: 'Gemma en este móvil Android',
  gemmaOptionHelpAndroid: 'Casey juega en este móvil Android, sin internet y sin clave. Es más lenta.',
  ossGemmaFirstRunAndroid: (size, phones, lowMemory) =>
    `Este 900words que has compilado juega con Casey en este móvil Android: sin cuenta ni clave. Gemma se descarga una sola vez (${size}). Usa wifi y deja 900words abierto hasta que termine.\n\nFunciona mejor en un móvil Android reciente con 12 GB de memoria o más, por ejemplo ${phones}.${lowMemory ? '\n\nEste móvil tiene menos memoria que los modelos recomendados; puede que no funcione bien.' : ''}\n\nTambién puedes añadir tu propia clave de IA en Ajustes.\n\n¿Descargar Casey ahora?`,
  serverOption: 'Tu propio servidor de Casey',
  serverOptionHelp: 'Un Worker de Casey que has desplegado tú (consulta el README).',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: 'Este 900words lo has compilado tú. Casey necesita una IA para jugar: tu propia clave de IA o Gemma en este ordenador.',
  pcGemmaOption: 'Gemma en este ordenador',
  pcGemmaOptionHelp: 'Casey juega en este ordenador, sin internet y sin clave. Es más lenta.',
  pcGemmaNeeds: 'Gemma necesita Chrome o Edge con WebGPU, en un ordenador con tarjeta gráfica.',
  pcGemmaExplain: (size) =>
    `Casey puede jugar con Gemma en este ordenador: sin internet y sin clave. Gemma es una descarga única (${size}), se guarda en este navegador y funciona con tu tarjeta gráfica en Chrome o Edge. Es más lenta que un servicio de IA y aún es experimental.\n\nMantén esta pestaña abierta hasta que termine la descarga.\n\n¿Descargar Gemma ahora?`,
  pcGemmaReady: (size) =>
    `Gemma está lista (${size} en este navegador).`,
  pcGemmaRemoveConfirm: '¿Quitar Gemma de este navegador? Puedes volver a descargarla más tarde.',
  pcGemmaDownloading: (percent) =>
    `${percent} % - mantén esta pestaña abierta.`,
  pcGemmaDownloadNote: (size) =>
    `Gemma es una descarga de ${size}. Mantén esta pestaña abierta hasta que termine.`,
  pcGemmaAnswered: 'Gemma ha respondido en este ordenador.',
  ossOfflineLabel: 'Jugar sin conexión cuando no haya internet',
  ossOfflineHelp: 'Casey te ofrecerá terminar la ronda con Gemma. La primera vez, esto la descarga.',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `Este 900words juega con Casey en tu iPhone: sin cuenta y sin clave. Es una descarga única (${size}). Usa wifi y deja 900words abierta hasta que termine.\n\nNecesita un iPhone más reciente: ${iphones}.${lowMemory ? '\n\nEste iPhone tiene menos memoria que esos modelos. Puede que no funcione en él.' : ''}\n\nTambién puedes añadir tu propia clave de IA en Ajustes.\n\n¿Descargar a Casey ahora?`,
  // ── Casey sin conexión en Android ────────────────────────────────────────
  gemmaUnsupportedAndroidNote:
    'Casey sin conexión necesita un móvil Android más reciente: Android 12 o posterior y al menos 8 GB de memoria. Este móvil no los tiene.',
  gemmaReadyAndroid: (size) => `Casey sin conexión está lista (${size} en este móvil).`,
  gemmaRemoveConfirmAndroid:
    '¿Quitar Casey sin conexión de este móvil? Puedes volver a descargarla más tarde.',
  offlineModeHelpAndroid:
    'Casey normal juega desde el servidor de 900words. Con el modo sin conexión puedes terminar una ronda con Casey sin conexión en este móvil cuando no hay internet. Es más lenta.',
  offlineModeExplainAndroid: (size, phones, lowMemory) =>
    `El modo sin conexión es experimental y todavía se está mejorando.\n\nEl modo sin conexión descarga Casey sin conexión (${size}) en este móvil. Usa wifi y deja 900words abierta hasta que termine la descarga.\n\nCasey sin conexión juega más despacio que Casey normal.\n\nNecesita un móvil Android más reciente con 12 GB de memoria o más, por ejemplo ${phones}.${lowMemory ? '\n\nEste móvil tiene menos memoria. Puede que no funcione en él.' : ''}\n\n¿Descargar ahora?`,
  gemmaAnsweredAndroid: 'Gemma ha respondido en este móvil.',

  // ── la comprobación de la conexión ───────────────────────────────────────
  testRunning: 'Probando…',
  testGemmaButton: 'Probar Casey en el dispositivo',
  testConnectionButton: 'Probar la conexión',
  connectionFailed: 'La conexión ha fallado.',
  gemmaAnswered: 'Gemma ha respondido en este iPhone.',
  normalCaseyAnswered: 'Casey normal con Ollama ha respondido.',
  customCaseyAnswered: 'El servicio de Casey personalizado ha respondido.',

  // ── el juego ─────────────────────────────────────────────────────────────
  gameHeading: 'Juego',
  soundLabel: 'Decir las palabras en voz alta al tocarlas',
  soundHelp:
    'Nada suena solo: cada sonido responde a un toque, también los intentos de Casey.',
  lookupExampleLabel: 'Reproduce la frase de ejemplo al consultar una traducción',
  lookupExampleHelp: 'Al desactivarlo, la consulta usa el ajuste de audio de palabras.',
  replayIntroButton: 'Repetir la introducción',
  replayIntroHelp: 'La presentación de Casey, otra vez. Tu progreso no cambia.',

  // ── el interruptor de viaje para las pruebas ─────────────────────────────
  playtestHeading: 'Pruebas de TestFlight',
  playtestTravelLabel: 'Saltar entre ciudades y tomar cualquier tren',
  playtestTravelHelp:
    'El salto en sí se hace en el mapa: elige una parada por delante y Viajar adelante. Esto no mete palabras en la maleta ni añade progreso de aprendizaje; desactívalo para volver a probar el avance normal del viaje.',

  // ── el interruptor del recordatorio diario ───────────────────────────────
  reminderHeading: 'Recordatorio diario',
  reminderWebNote:
    'Los recordatorios diarios están disponibles en la app de 900words para iPhone. Este navegador nunca pide permiso para enviar notificaciones.',
  reminderDeniedNote:
    'Las notificaciones del iPhone están desactivadas para 900words. Actívalas en los Ajustes del iPhone y vuelve aquí para programar el recordatorio diario de Casey.',
  reminderOpenSettingsButton: 'Abrir los ajustes de notificaciones del iPhone',
  reminderOnNote: (time) => `Casey te avisará a las ${time} en este iPhone.`,
  reminderTurningOff: 'Desactivando…',
  reminderTurnOffButton: 'Desactivar el recordatorio diario',
  reminderOffNote: (time) =>
    `Casey puede enviar un recordatorio local a las ${time}. El mensaje se crea en este iPhone a partir del recuento de tus días completados; ningún identificador del dispositivo ni tu historial de aprendizaje salen de él.`,
  reminderAsking: 'Preguntando al iPhone…',
  reminderTurnOnButton: 'Activar el recordatorio diario',

  // ── tu colección: la copia de seguridad ──────────────────────────────────
  collectionHeading: 'Copia de seguridad',
  backupIntro:
    'Tu colección vive solo en este teléfono. Una copia de seguridad es un archivo pequeño: guarda una en un sitio seguro antes de cambiar de teléfono o borrar los datos del navegador.',
  backupSaveButton: 'Guardar una copia',
  backupRestoreButton: 'Restaurar desde un archivo',
  backupShared: 'Copia de seguridad enviada a tu teléfono.',
  backupDownloaded: 'Copia de seguridad descargada.',
  backupHideText: 'Ocultar la copia en texto',
  backupShowText: '¿No puedes elegir un archivo? Usa texto',
  backupCopyButton: 'Copiar mi colección',
  backupCopied: 'Copia de seguridad copiada al portapapeles.',
  backupPasteLabel: 'Pega aquí una copia',
  backupReadButton: 'Leerla',
  backupHoldsHeading: 'Esta copia contiene',
  backupCollectedAfter: (met) => `palabras conseguidas, ${met} vistas en total`,
  backupWrappedAfter: (city) => `envueltas · ${city}`,
  backupGamesLine: (games, savedOn) =>
    `${games} ${games === 1 ? 'ronda jugada' : 'rondas jugadas'} · guardada el ${savedOn}`,
  backupMergeButton: 'Fusionar aquí',
  backupReplaceButton: 'Reemplazar todo',
  backupCancelButton: 'Cancelar',
  backupChoiceNote:
    'Al fusionar se conserva el mejor de los dos registros de cada palabra, así que nunca puede costarte una carta verde. Al reemplazar se descarta el progreso de este dispositivo.',
  backupReplaceConfirm:
    '¿Reemplazar todo lo de este dispositivo con la copia de seguridad? Se perderá todo lo que hayas aprendido desde que se hizo.',
  backupMerged: (collected) =>
    `Fusionado. No has perdido nada: se han añadido ${collected} palabras conseguidas.`,
  backupRestored: (collected, wrapped) =>
    `Restauradas ${collected} palabras conseguidas y ${wrapped} envueltas.`,

  // ── el registro de pistas del dueño ──────────────────────────────────────
  clueLedgerHeading: 'Las pistas de Casey',

  // ── datos ────────────────────────────────────────────────────────────────
  dataHeading: 'Datos',
  usageStatsLabel: 'Estadísticas de uso anónimas',
  usageStatsHelp:
    'Solo recuentos: rondas jugadas, dónde se deja de jugar, si Casey o una grabación han fallado. Ni palabras, ni pistas, ni identificador de ningún tipo.',
  usageStatsAria: 'Compartir estadísticas de uso anónimas',
  dataSharingPrivateTitle: 'Juego privado',
  dataSharingPrivateDetail: 'Ningún dato opcional de la partida sale de este teléfono.',
  dataSharingDiagnosticsTitle: 'Diagnóstico anónimo',
  dataSharingDiagnosticsDetail:
    'Comparte el número de rondas y los resultados, nunca tus palabras ni tus pistas.',
  dataSharingLearningTitle: 'Diagnóstico + ejemplos de aprendizaje para Casey',
  dataSharingLearningDetail:
    'Comparte también pistas, intentos y resultados para que Casey mejore.',
  dataSharingAria: 'Compartir datos',
  dataSharingCloseAria: 'Cerrar sin elegir',
  dataSharingPromptTitle: '¿Cómo puede 900words usar tus partidas?',
  dataSharingPromptNote:
    'No hay nada preseleccionado. Cualquier opción te deja el juego entero abierto, y puedes cambiarla en Ajustes.',
  dataSharingSettingsNote:
    'Si no eliges nada, se comporta como Juego privado. Esto controla solo los eventos opcionales; Casey y la comprobación temporal del siguiente tablero siguen procesando los datos mínimos necesarios para jugar.',
  dataSharingDeleting: 'Borrando los datos compartidos…',
  dataSharingDeleteButton: 'Borrar los datos compartidos',
  resetConfirm: (language) =>
    `¿Restablecer todo el progreso de aprendizaje, tu viaje de ${language} y la partida actual?`,
  resetButton: 'Restablecer el progreso',

  // ── el pie de página con la versión ──────────────────────────────────────
  buildStamp: (stamp) => `Versión ${stamp}`,
  testFlightBuild: (build) => `Versión de TestFlight ${build} · `,
  keyboardReadoutNote: 'Lectura del teclado activada. Toca la versión cinco veces para ocultarla.',
  stateOn: 'activado',
  stateOff: 'desactivado',
  composerRideWaiting: 'desactivado (espera al documento)',
  composerRideButton: (state) => `El campo sigue al teclado: ${state}`,
  trainStoryButton: (state) => `Historia del tren: ${state}`,
  updateChecking: 'Comprobando…',
  checkUpdatesButton: 'Buscar actualizaciones',
  updateCurrent: 'Todo actualizado.',
  updateFound:
    'Se está descargando una versión más nueva: cierra y vuelve a abrir la app para aplicarla.',
  updateCheckFailed: 'No se ha podido comprobar. Prueba a cerrar y volver a abrir la app.',

  // ── la única pregunta de Casey sobre el recordatorio diario ──────────────
  reminderPromptCloseAria: 'Ahora no',
  reminderPromptTitle: '¡Tres partidas en la maleta!',
  reminderPromptBody: (time) =>
    `Con eso ya tienes el día. ¿Te aviso mañana sobre las ${time}? Solo un aviso por la tarde; puedes desactivarlo en Ajustes cuando quieras.`,
  reminderPromptAccept: 'Sí, avísame',
  reminderPromptAsking: 'Preguntando a tu iPhone…',
  reminderPromptDecline: 'No, gracias',

  // ── el recordatorio diario en sí, escrito en el teléfono ─────────────────
  reminderDoneTitle: 'Casey ya ha hecho la maleta por hoy',
  reminderDoneBody: 'Tres partidas están a salvo en la maleta. Mañana seguimos.',
  reminderOneLeftTitle: '¿Una partidita con Casey?',
  reminderStreakBody: (days) =>
    `Mantén viva tu racha de ${days} días con una partida más hoy.`,
  reminderOneLeftBody: 'Una partida más y las tres de hoy quedan en la maleta.',
  reminderSeatTitle: 'Casey te ha guardado un asiento',
  reminderSeatBody: (games) =>
    `Con ${games} ${games === 1 ? 'partidita' : 'partiditas'} hoy ya empiezas una racha.`,

  // ── Google Play review access (Android store build only) ───────────────
  reviewAccessHeading: 'Acceso para la revisión de Google Play',
  reviewAccessHelp: 'Solo para la revisión de la app en Google Play. Introduce el código de revisión de las instrucciones para desbloquear el juego ilimitado en este dispositivo.',
  reviewAccessLabel: 'Código de revisión',
  reviewAccessUnlock: 'Desbloquear',
  reviewAccessChecking: 'Comprobando…',
  reviewAccessOn: (date: string) =>
    `El acceso de revisión está activo. El juego ilimitado está desbloqueado en este dispositivo hasta el ${date}.`,
  reviewAccessInvalid: 'Ese código de revisión no se ha aceptado.',
  reviewAccessRateLimited: 'Demasiados intentos. Inténtalo de nuevo mañana.',
  reviewAccessError: 'No se ha podido comprobar el código. Revisa la conexión a internet e inténtalo de nuevo.',

  // ── Tu plan (solo en las versiones de tienda). Apple en iOS, Google Play en Android.
  planHeading: 'Tu plan',
  planFreeShort: 'Gratis',
  planUnlimitedShort: 'Ilimitado',
  planChipAria: (plan: string) => `Tu plan: ${plan}`,
  planChecking: 'Comprobando tu plan con Apple.',
  planCheckingPlay: 'Comprobando tu plan con Google Play.',
  planFree: 'Plan gratuito. Dos sesiones de Sightseeing y dos puzles del café al día.',
  planMonthly: 'Partidas ilimitadas. Suscripción mensual. Se renueva cada mes hasta que la canceles.',
  planLifetime: 'Partidas ilimitadas. Pago único. No se renueva nada.',
  planBoth: 'Ya tienes el pago único. Tu suscripción mensual sigue activa y ya no la necesitas. Cancélala para que no te vuelvan a cobrar.',
  planError: 'Apple no ha podido comprobar tu plan ahora mismo. Inténtalo de nuevo más tarde.',
  planErrorPlay: 'Google Play no ha podido comprobar tu plan ahora mismo. Inténtalo de nuevo más tarde.',
  planGetUnlimited: 'Jugar sin límite',
  planManage: 'Gestionar o cancelar la suscripción',
  planSwitch: 'Cambiar al pago único',
  planSwitchNote: 'Con el pago único juegas sin límite para siempre. No cancela tu suscripción mensual. Después de comprarlo, cancela la suscripción mensual en tu cuenta de Apple o seguirás pagando las dos.',
  planSwitchNotePlay: 'Con el pago único juegas sin límite para siempre. No cancela tu suscripción mensual. Después de comprarlo, cancela la suscripción mensual en Google Play o seguirás pagando las dos.',
  planBuyFor: (price: string) => `Comprar por ${price}`,
  planNotNow: 'Ahora no',
}
