/**
 * Settings and the panels that live on it: backup, data sharing, reminders,
 * the build footer, Casey's one question about the daily reminder, and the
 * words the daily reminder itself is made of.
 *
 * Register: plain. Settings explains, it does not perform. Casey's own warmth
 * belongs to the reminder prompt and the notification copy at the end of this
 * file, which are the only places on this screen she speaks.
 */
export const settings = {
  // ── the screen ───────────────────────────────────────────────────────────
  title: 'Settings',
  backAria: 'Back',

  // ── the language the app speaks (Phase 1a) ───────────────────────────────
  uiLanguageLabel: 'Your language',
  uiLanguageHelp: 'Changes the language 900words speaks.',

  // ── the language being learned ───────────────────────────────────────────
  learnerLanguageLabel: 'Language to learn',
  learnerLanguageHelp: 'Each language has its own journey. Switch back to continue where you left off.',
  /** Appended to a language that ships its Guide but has no boards yet. */
  learnerLanguagePreviewTag: 'preview',
  learnerLanguagePreviewHelp:
    'German is a preview: the map and the Travel Guide are here, the word game is not. Its lessons have not been checked by a native speaker yet.',

  // ── Casey's brain ────────────────────────────────────────────────────────
  caseyBrainHeading: 'Casey’s brain',
  caseyServerNote:
    'Casey plays from 900words’ own server. There is nothing to set up; the button below checks that she answers.',
  normalOllamaCaseyLabel: 'Normal Ollama Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · clues and guesses',
  normalOllamaCaseyAria: 'Use normal Ollama Casey',
  normalCaseyOn: 'Normal Casey is on',
  normalCaseyOff: 'Normal Casey is off',
  prototypeOn: 'Agentless prototype is on',
  customCaseyOn: 'Custom Casey service is on',
  normalCaseyDetail: 'Ollama is playing and translating. Gemma is off.',
  gemmaModeDetail: 'Gemma 4 E4B handles clues and guesses. Dictionary misses still use Ollama.',
  prototypeDetail: 'This local test mode is not Casey, Ollama or Gemma.',
  customCaseyDetail:
    'A custom Casey Worker is selected. Online dictionary misses use that service.',
  baseUrlLabel: 'Base URL',
  /**
   * The whole sentence, with the path fragment in its own <code>:
   * "Set by the switch above, or type your own Casey Worker address plus /v1.
   * It must start with https://, so nothing about your game travels in the
   * clear." The fragment may move to the start or the end of the sentence.
   */
  baseUrlHelpBefore: 'Set by the switch above, or type your own Casey Worker address plus ',
  baseUrlHelpAfter:
    '. It must start with https://, so nothing about your game travels in the clear.',
  baseUrlUnusable: 'That Base URL cannot be used.',

  // ── the on-device model ──────────────────────────────────────────────────
  gemmaUnavailableNote: 'Offline mode works in the 900words iPhone app.',
  gemmaReady: (size: string) => `Offline Casey is ready (${size} on this iPhone).`,
  gemmaRemoveConfirm: 'Remove offline Casey from this iPhone? You can download her again later.',
  gemmaRemoveButton: 'Remove offline Casey',
  gemmaProgressAria: 'Offline Casey download progress',
  gemmaDownloading: (percent: number) => `${percent}%. Keep 900words open on Wi-Fi.`,
  gemmaCancelDownloadButton: 'Cancel download',
  gemmaDownloadNote: (size: string) =>
    `Offline Casey is a ${size} download. Use Wi-Fi and keep 900words open until it finishes.`,
  gemmaDownloadButton: 'Download offline Casey',
  gemmaDownloadFailed: 'Download failed.',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: 'Offline mode',
  offlineModeExperimentalTag: 'Experimental',
  offlineModeLabel: 'Play without internet',
  offlineModeHelp:
    'Normal Casey plays from 900words’ server. With offline mode on, you can finish a round with offline Casey on this iPhone when the internet is gone. She is slower.',
  offlineModeAria: 'Offline mode',
  offlineModeExplain: (size: string, iphones: string, lowMemory: boolean) =>
    `Offline mode is experimental and still being improved.\n\nOffline mode downloads offline Casey (${size}) to this iPhone. Use Wi-Fi and keep 900words open until the download finishes.\n\nOffline Casey plays more slowly than normal Casey.\n\nShe needs a newer iPhone: ${iphones}.${lowMemory ? '\n\nThis iPhone has less memory than those models, so she may not run on it.' : ''}\n\nDownload now?`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Casey’s AI',
  ossCaseyHelp: 'This is a self-built 900words. Casey needs an AI to play with: your own AI key, or Gemma on this iPhone.',
  ownKeyOption: 'Your own AI key',
  ownKeyHelp: 'Any OpenAI-compatible service. Your key is stored only on this device and sent only to the address below.',
  ownKeyAddressLabel: 'Service address',
  ownKeyModelLabel: 'Model',
  ownKeyKeyLabel: 'API key',
  ownKeyAnswered: 'Your AI service answered.',
  gemmaOption: 'Gemma on this iPhone',
  gemmaOptionHelp: 'Casey plays on this iPhone, without internet and without a key. She is slower.',
  serverOption: 'Your own Casey server',
  serverOptionHelp: 'A Casey Worker you deployed yourself (see the README).',
  ossGemmaFirstRun: (size: string, iphones: string, lowMemory: boolean) =>
    `This 900words plays with Casey on your iPhone: no account and no key needed. She is a one-time download (${size}). Use Wi-Fi and keep 900words open until it finishes.\n\nShe needs a newer iPhone: ${iphones}.${lowMemory ? '\n\nThis iPhone has less memory than those models, so she may not run on it.' : ''}\n\nYou can also add your own AI key in Settings.\n\nDownload Casey now?`,

  // ── the connection check ─────────────────────────────────────────────────
  testRunning: 'Testing…',
  testGemmaButton: 'Test on-device Casey',
  testConnectionButton: 'Test connection',
  connectionFailed: 'Connection failed.',
  gemmaAnswered: 'Gemma answered on this iPhone.',
  normalCaseyAnswered: 'Normal Ollama Casey answered.',
  customCaseyAnswered: 'The custom Casey service answered.',

  // ── the game ─────────────────────────────────────────────────────────────
  gameHeading: 'Game',
  soundLabel: 'Say words out loud when you tap them',
  soundHelp: 'When off, words and lookup audio stay quiet.',
  lookupExampleLabel: 'Play the example sentence when you look up a translation',
  lookupExampleHelp: 'When off, a lookup uses the word-audio setting.',
  replayIntroButton: 'Replay the intro',
  replayIntroHelp: 'Casey’s introduction. Your progress does not change.',

  // ── the playtest travel switch ───────────────────────────────────────────
  playtestHeading: 'TestFlight playtest',
  playtestTravelLabel: 'Let me jump cities and take any train',
  playtestTravelHelp:
    'The jump itself is on the map: pick a stop ahead and Travel ahead. Nothing is packed and no learning progress is added; turn it off to test the normal journey gate again.',

  // ── the daily reminder switch ────────────────────────────────────────────
  reminderHeading: 'Daily reminder',
  reminderWebNote:
    'Available in the 900words iPhone app.',
  reminderDeniedNote:
    'Turn on 900words notifications in iPhone Settings.',
  reminderOpenSettingsButton: 'Open iPhone notification settings',
  /** The hour is passed in, never written here: see REMINDER_HOUR. */
  reminderOnNote: (time: string) => `Daily reminder at ${time}.`,
  reminderTurningOff: 'Turning off…',
  reminderTurnOffButton: 'Turn off daily reminder',
  reminderOffNote: (time: string) => `One local reminder at ${time}.`,
  reminderAsking: 'Asking iPhone…',
  reminderTurnOnButton: 'Turn on daily reminder',

  // ── your collection: the backup panel ────────────────────────────────────
  collectionHeading: 'Backup',
  backupIntro:
    'Your progress is stored on this device. Save a backup before changing phone or clearing browser data.',
  backupSaveButton: 'Save a backup',
  backupRestoreButton: 'Restore from a file',
  backupShared: 'Backup handed to your phone.',
  backupDownloaded: 'Backup downloaded.',
  backupHideText: 'Hide text backup',
  backupShowText: 'No file picker? Use text instead',
  backupCopyButton: 'Copy my collection',
  backupCopied: 'Backup copied to the clipboard.',
  backupPasteLabel: 'Paste a backup here',
  backupReadButton: 'Read it',
  backupHoldsHeading: 'This backup holds',
  /** The whole line, the count in its own <strong>: "34 collected words, 120 met in all". */
  backupCollectedAfter: (met: number) => `collected words, ${met} met in all`,
  /** The whole line, the count in its own <strong>: "12 wrapped · Sønderborg". */
  backupWrappedAfter: (city: string) => `wrapped · ${city}`,
  backupGamesLine: (games: number, savedOn: string) =>
    `${games} ${games === 1 ? 'round' : 'rounds'} played · saved ${savedOn}`,
  backupMergeButton: 'Merge into this device',
  backupReplaceButton: 'Replace everything',
  backupCancelButton: 'Cancel',
  backupChoiceNote:
    "Merging keeps the better of the two records for every word, so it can never cost you a green. Replacing throws this device's progress away.",
  backupReplaceConfirm:
    'Replace everything on this device with the backup? Anything you have learned since it was made will be lost.',
  backupMerged: (collected: number) =>
    `Merged. Nothing you had was lost; ${collected} collected words folded in.`,
  backupRestored: (collected: number, wrapped: number) =>
    `Restored ${collected} collected and ${wrapped} wrapped words.`,

  // ── the owner's clue ledger ──────────────────────────────────────────────
  clueLedgerHeading: 'Casey’s clues',

  // ── data ─────────────────────────────────────────────────────────────────
  dataHeading: 'Data',
  usageStatsLabel: 'Anonymous usage statistics',
  usageStatsHelp: 'Rounds and errors only. No words, clues, or identifier.',
  usageStatsAria: 'Share anonymous usage statistics',
  dataSharingPrivateTitle: 'Private play',
  dataSharingPrivateDetail: 'No optional game data leaves this phone.',
  dataSharingDiagnosticsTitle: 'Anonymous diagnostics',
  dataSharingDiagnosticsDetail: 'Share round counts and outcomes, never your words or clues.',
  dataSharingLearningTitle: 'Diagnostics + Casey-learning examples',
  dataSharingLearningDetail: 'Also share clues, guesses and outcomes so Casey can improve.',
  dataSharingAria: 'Data sharing',
  dataSharingCloseAria: 'Close without choosing',
  dataSharingPromptTitle: 'How should 900words use your play?',
  dataSharingPromptNote:
    'Nothing is preselected. Every choice keeps the whole game open, and you can change it in Settings.',
  dataSharingSettingsNote:
    'An unmade choice behaves as Private play. This controls optional events only; Casey and the transient next-board check still process the minimum data needed to play.',
  dataSharingDeleting: 'Deleting shared data…',
  dataSharingDeleteButton: 'Delete shared data',
  resetConfirm: (language: string) =>
    `Reset all learning progress, your ${language} journey, and the current game?`,
  resetButton: 'Reset progress',

  // ── the build footer ─────────────────────────────────────────────────────
  buildStamp: (stamp: string) => `Build ${stamp}`,
  testFlightBuild: (build: string) => `TestFlight build ${build} · `,
  keyboardReadoutNote: 'Keyboard readout on. Tap the build five times to hide it.',
  stateOn: 'on',
  stateOff: 'off',
  composerRideWaiting: 'off (waits for the document)',
  composerRideButton: (state: string) => `Composer ride: ${state}`,
  trainStoryButton: (state: string) => `Train story: ${state}`,
  updateChecking: 'Checking…',
  checkUpdatesButton: 'Check for updates',
  updateCurrent: 'Up to date.',
  updateFound: 'A newer build is downloading. Close and reopen the app to take it.',
  updateCheckFailed: 'Could not check. Close and reopen the app instead.',

  // ── Casey's one question about the daily reminder ────────────────────────
  reminderPromptCloseAria: 'Not now',
  reminderPromptTitle: 'Three games in the case!',
  reminderPromptBody: (time: string) =>
    `That’s a day’s worth. Shall I remind you tomorrow, around ${time}? One small nudge in the afternoon, and you can switch it off in Settings whenever you like.`,
  reminderPromptAccept: 'Yes, remind me',
  reminderPromptAsking: 'Asking your iPhone…',
  reminderPromptDecline: 'No thanks',

  // ── the daily reminder itself, written on the phone ──────────────────────
  reminderDoneTitle: 'Casey is packed for today',
  reminderDoneBody: 'Three games are safely in the case. We can continue tomorrow.',
  reminderOneLeftTitle: 'One small game with Casey?',
  reminderStreakBody: (days: number) =>
    `Keep your ${days}-day streak rolling with one more game today.`,
  reminderOneLeftBody: 'One more game tucks today’s three into the case.',
  reminderSeatTitle: 'Casey saved you a seat',
  reminderSeatBody: (games: number) =>
    `${games} small game${games === 1 ? '' : 's'} today ${games === 1 ? 'is' : 'are'} enough to begin a streak.`,
}
