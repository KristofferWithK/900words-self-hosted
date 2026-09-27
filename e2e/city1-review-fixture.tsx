import { WORDS } from '../src/data/words'
import { DictionarySheet, useOpenDictionary } from '../src/ui/components/DictionarySheet'
// TEST ONLY: local browser harness. Never imported by the application entry.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CITY1_CATALOG } from '../src/review/city1'
import { testRow, testAbout } from '../src/review/city1.fixtures'
import { useGame } from '../src/stores/gameStore'
import { useUi } from '../src/stores/uiStore'
import { useSettings } from '../src/stores/settingsStore'
import { RoundSummary } from '../src/ui/components/RoundSummary'
import { useSrs } from '../src/stores/srsStore'
import '../src/index.css'
const params = new URLSearchParams(location.search)
document.getElementById('outside-focus')!.focus()
// Explicit identity tie-break keeps the Node drives and browser fixture deterministic.
const byWordId = (a: { wordId: string }, b: { wordId: string }) => a.wordId < b.wordId ? -1 : a.wordId > b.wordId ? 1 : 0
const longestSentence = [...CITY1_CATALOG.review].sort((a, b) => b.text.da.length - a.text.da.length || byWordId(a, b))[0]!
const noteLength = (id: string) => {
  const note = CITY1_CATALOG.about.find(a => a.targetId === id)!
  return (note.meaningEn + note.usageEn + note.example.da + note.example.en).length
}
const longestAbout = [...CITY1_CATALOG.review].sort((a, b) => noteLength(b.targetId) - noteLength(a.targetId) || byWordId(a, b))[0]!
if (params.has('audio')) {
  CITY1_CATALOG.review = [testRow(), testRow('da:kat')]
  CITY1_CATALOG.about = [testAbout]
  CITY1_CATALOG.recordings = CITY1_CATALOG.review.map(row => ({ audioId: row.audioId,
    sentenceId: row.sentenceId, textDa: row.text.da, version: row.version,
    url: `/audio/da/city1/TEST-delay-${row.wordId.slice(3)}.mp3`, variant: 'normal' as const, bakeRate: 1, playbackRate: 1 }))
}
// Revalidate saved pins after installing the TEST-only catalog. Never redeal on reload.
await useGame.persist.rehydrate()
useUi.setState({ pendingFirstGiver: 'player', onboarding: null, screen: 'game' })
useSettings.setState({ sound: true, studyPhase: 'never', usageStats: false, dataSharing: 'private' })
if (params.has('fresh')) {
  useGame.getState().newGame({ cityIndex: 0 })
  const game = useGame.getState().game!
  // ?won drives the ordinary City 1 WIN branch — the one the finish/inspect
  // design is specified against. The default stays a lost round, which is
  // what the retained assertions were written for.
  useGame.setState({ game: { ...game, phase: 'finished',
    outcome: params.has('won') ? { result: 'won', reason: 'all-greens' } : { result: 'lost', reason: 'timeout' },
    clueHistory: [0, 1].map(i => ({ by: 'player', text: 'Animals', number: 2,
      guesses: [{ wordId: params.has('audio') ? (i === 1 ? 'da:kat' : 'da:hund') : (i === 0 ? longestSentence.wordId : longestAbout.wordId), result: 'green' }] })) } })
  useGame.getState().finishRound()
}
if (params.has('fresh') && params.has('wrap')) {
  // A directly injected historical mode is retained only to prove the result
  // reader exposes no old post-wrap offer. It cannot unlock reader content.
  useGame.setState({ mode: 'wrapup' })
}
// Setup is one-shot: even a manual Reload of this page must retain the save.
if (params.has('fresh')) {
  const retained = new URL(location.href)
  retained.searchParams.delete('fresh')
  history.replaceState(null, '', retained)
}
function DictionaryHarness() {
  const openBoard = useOpenDictionary({ kind: 'board', cityIndex: 0 })
  const id = params.get('dictionary')!
  const word = WORDS.find(w => w.id === id)!
  return <><output id="global-pair">{JSON.stringify([word.exampleDa, word.exampleEn])}</output>
    <button onClick={() => openBoard(id)}>Board dictionary</button>
    <button onClick={() => useUi.getState().openSheet(id, { kind: 'instructional' })}>Instructional dictionary</button>
    <button onClick={() => useUi.getState().openSheet(id, { kind: 'board', cityIndex: 4 })}>Later board dictionary</button>
    <DictionarySheet /></>
}
function Harness() {
  const game = useGame(s => s.game)!
  const screen = useUi(s => s.screen)
  const guideEntry = useUi(s => s.guideEntry)
  return <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}><output id="guide-entry">{JSON.stringify(guideEntry)}</output><output id="result" style={{ position: 'fixed', bottom: 0, fontSize: 10 }}>{screen}:{game?.phase}:{useSrs.getState().games.played}</output>
    {game?.phase === 'finished' && screen === 'game' && <RoundSummary game={game}
      hideReplay={params.has('onboarding')} onHome={params.has('onboarding') ? () => { document.querySelector('#result')!.textContent = 'ONBOARDING HOME' } : undefined} />}</div>
}
createRoot(document.getElementById('root')!).render(params.has('dictionary') ? <DictionaryHarness /> : <Harness />)
