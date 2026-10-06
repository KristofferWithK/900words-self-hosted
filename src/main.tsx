// FIRST: the website demo swaps localStorage/sessionStorage for memory before
// any store module below is evaluated. A no-op for every other build.
import './webdemo/installMemoryStorage'
// The hidden performance log, before React loads (so it can count commits). Off: one flag read.
import './ui/diagnostics/boot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { UI_LANGUAGE, UI_LANGUAGE_INFO } from './i18n'
import { bootstrapWebDemo } from './webdemo/bootstrap'
import './index.css'
import { installSfxUnlock } from './ui/sfx'
import { installRunResultsSink } from './run/sinkSetup'

// The document declares the language it is written in, so a screen reader
// pronounces the chrome correctly and the browser hyphenates it correctly.
// index.html ships `lang="en"`; this is the same statement once the player's
// choice is known. Danish inside the page keeps its own `lang` on the span.
document.documentElement.lang = UI_LANGUAGE_INFO[UI_LANGUAGE].tag

// The sound effects re-arm on the first tap after a launch, a return from the
// background, or a refused play (sfx.ts).
installSfxUnlock()
bootstrapWebDemo()
// A run's photos, café finds and daily count reach the player's progress (café world, CW-04).
installRunResultsSink()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)