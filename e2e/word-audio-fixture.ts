// TEST ONLY: source harness for e2e/word-audio-drive.mjs. Never imported by
// the application entry. It hands the drive the app's REAL word player —
// speak.ts's playWord, its seek table, its request scopes — in a real
// Chromium, so a word is fetched, readied, articled and started exactly the
// way a board tap starts it.
import { articlePhraseAudioUrl, clipStartAt, createWordAudioScope, playWord, preloadWordAudio, spokenArticleOf, stopWordAudio, wordAudioUrl } from '../src/ui/speak'
import { useSettings } from '../src/stores/settingsStore'

declare global {
  interface Window {
    __player: Record<string, unknown>
  }
}

window.__player = {
  articlePhraseAudioUrl,
  clipStartAt,
  createWordAudioScope,
  playWord,
  preloadWordAudio,
  spokenArticleOf,
  stopWordAudio,
  wordAudioUrl,
  setSound: (sound: boolean) => useSettings.setState({ sound }),
}
document.getElementById('ready')!.textContent = 'ready'
