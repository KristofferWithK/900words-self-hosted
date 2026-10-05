import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GameState } from '../../engine/types'
import { useGame } from '../../stores/gameStore'
import { UI } from '../../i18n'
import { beatPlan, REVEAL_MS, type AiBeat } from '../aiBeats'
import { playWord } from '../speak'
import { ClueyFace, type ClueyMood } from './Cluey'
import { caseyBubble, landedCaseyGuess, type LandedCaseyGuess as Landed } from '../caseyJustification'

/**
 * Shows the AI side of a turn and paces its guesses one by one.
 *
 * Two regions, one height (K2): Casey's face beside a bubble clamped to FOUR
 * lines, then one line for how the guess landed. Nothing here may add a third
 * region — the dock is --dock-h like every other one, and the board's size in
 * every phase of the round is that number.
 *
 * ---- the two beats (U3) ---------------------------------------------------
 *
 * The store keeps the queue; the PACING lives here, and it is two beats per
 * planned guess rather than one interval (`aiBeats.ts` holds the clock and its
 * test):
 *
 *   think    the bubble carries `aiGuessQueue[0].reasoning` — Casey's own
 *            sentence for the guess she is about to name — and her face is
 *            thinking. ~2s.
 *   reveal   `stepAiGuess()`: the card flips, the S1 effect below speaks the
 *            word, the face goes happy or oops, and the line says how it went.
 *            ~1.1s, then the next guess's think beat.
 *
 * A tap anywhere on the panel skips to the next beat, so a three-guess turn is
 * nine seconds only if the player lets it be. It is a plain `onClick` on the
 * dock rather than a button, deliberately: the beats advance on their own, so
 * the tap makes nothing reachable that was not already coming — it only
 * hurries it — and a `role="button"` wrapping the whole panel would replace
 * the two things a screen reader is here to read with one label.
 *
 * The reveal is HELD for its own beat even after the turn has ended, which is
 * the `held` latch below. Without it the last guess of every turn — and the
 * only guess of a clue of one — flips its card while the panel has already
 * jumped back to "Casey is thinking…", so her face never answers the guess she
 * just made. The store's `lastAiGuess` cannot carry that across on its own:
 * `runAiClue` nulls it the moment the phase turns over.
 *
 * The short reasoning explains the selected word's connection to the clue.
 * A genuine alternative travels with that row and is named only after a miss.
 * No new request is made for the reveal.
 *
 * NOTHING IS LEAKED BY SHOWING IT. This panel only paces guesses under the
 * PLAYER'S clue, and a guess is judged against the clue-giver's key — so the
 * key those sentences are read against is the player's own, which they are
 * looking at. Casey may name any word on the board here.
 *
 * The confidence phrases that used to open the line ("I'm quite sure about…")
 * are gone with this: the reasoning says the same thing better, and says it
 * before the guess instead of after it.
 */
/**
 * `offlineCasey`: offline Casey is playing this round (GameScreen decides).
 * Her thinking says so, because she is slower.
 *
 * `cafe`: inside a café puzzle (CW-08), Casey is drawn large while she
 * thinks, as the owner's concept shows. The café's table lies behind the
 * whole screen (GameScreen's CafeTable) and is not this panel's to show or
 * hide. Every other state is unchanged.
 */
export function AiTurnPanel({ game, offlineCasey = false, cafe = false }: {
  game: GameState
  offlineCasey?: boolean
  cafe?: boolean
}) {
  const { aiBusy, aiGuessQueue, planForClueIndex, lastAiGuess, authoredBoardId, attemptId, activeSlot, eventGeneration } = useGame(
    useShallow((s) => ({
      aiBusy: s.aiBusy,
      aiGuessQueue: s.aiGuessQueue,
      planForClueIndex: s.planForClueIndex,
      lastAiGuess: s.lastAiGuess,
      authoredBoardId: s.authoredBoardId,
      attemptId: s.attemptId,
      activeSlot: s.activeSlot,
      eventGeneration: s.eventGeneration,
    })),
  )
  const planReady = planForClueIndex === game.clueHistory.length
  const guessing = game.phase === 'aiGuessing' && planReady
  const next = aiGuessQueue[0]

  const [beat, setBeat] = useState<AiBeat>('think')
  const [held, setHeld] = useState<Landed | null>(null)
  const pacing = guessing && !held

  // Every turn opens on the think beat. The plan arriving is what starts the
  // clock, so the reset hangs off `guessing` rather than off the phase: while
  // Casey is still working out what to guess this panel is in its waiting
  // state below, and there is nothing to pace yet.
  useEffect(() => {
    if (!guessing) setBeat('think')
  }, [guessing])

  const advance = useCallback(() => {
    if (!pacing) return
    const owner = { attemptId, slot: activeSlot, generation: eventGeneration }
    if (!useGame.getState().ownsEvent(owner)) return
    const plan = beatPlan(beat, aiGuessQueue.length > 0)
    if (plan.step) useGame.getState().stepAiGuess(owner)
    setBeat(plan.next)
  }, [pacing, beat, aiGuessQueue.length, attemptId, activeSlot, eventGeneration])

  // One timeout per beat rather than one interval per turn — the two beats are
  // different lengths, and a tap that hurries one has to restart the clock
  // rather than land mid-interval. `beat` changing is what re-runs this, so
  // the tap needs nothing of its own.
  useEffect(() => {
    if (!pacing) return
    const { delayMs } = beatPlan(beat, aiGuessQueue.length > 0)
    const t = setTimeout(advance, delayMs)
    return () => clearTimeout(t)
  }, [pacing, beat, aiGuessQueue.length, advance])

  // How the guess she just made landed. Read out of THIS clue's guesses, so a
  // `lastAiGuess` left over from another turn resolves to nothing rather than
  // to a stale result.
  const revealed = landedCaseyGuess(game, lastAiGuess)
  // One id per landed guess, so the latch below fires once for it however many
  // times this panel re-renders while it is up.
  const revealedId = revealed && lastAiGuess ? `${lastAiGuess.wordId}:${revealed.result}` : null

  // Deliberately NOT cleared when the effect's dependency changes, which is
  // the whole point of the ref: the turn ending nulls `lastAiGuess` and would
  // take an ordinary effect's cleanup — and the reveal beat with it — half a
  // frame after the beat began. Only unmounting stops it.
  const holdTimer = useRef<number | undefined>(undefined)
  const roundKey = `${attemptId}:${activeSlot}:${eventGeneration}`
  // GameScreen can keep this component mounted while swapping an unfinished
  // round. A reveal belongs only to the board that produced it.
  useLayoutEffect(() => {
    window.clearTimeout(holdTimer.current)
    setHeld(null)
    setBeat('think')
  }, [roundKey])
  // Layout, not effect: this runs in the same commit that flipped the card, so
  // there is no painted frame between the guess landing and the panel saying
  // so.
  useLayoutEffect(() => {
    if (!revealedId || !revealed) return
    setHeld(revealed)
    window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => {
      setHeld(null)
      // Legacy plans may already have their next row queued. Start that row's
      // full THINK beat only after this reveal has completed.
      setBeat('think')
    }, REVEAL_MS)
    // Keyed on the guess's ID ALONE, and `revealed` is deliberately not in the
    // list: it is a fresh object every render, so depending on it would
    // re-latch and re-time the hold on every one of them and the reveal would
    // never end. There is no eslint in this repo to argue with about that.
  }, [revealedId])
  useEffect(() => () => window.clearTimeout(holdTimer.current), [])

  // A deliberate tap can still hurry a reveal, as before. When a fresh plan
  // is already waiting this advances only to its THINK beat; it never commits
  // that next guess in the reveal's beat.
  const hurry = useCallback(() => {
    if (held) {
      window.clearTimeout(holdTimer.current)
      setHeld(null)
      setBeat('think')
      return
    }
    advance()
  }, [held, advance])

  // Casey's guesses are spoken (S1) — the sound setting already gates
  // `playWord` at the source, so there is nothing to check here. This is the
  // one sound in the app that does not follow directly from a tap: it follows
  // FROM one, several beats later, off the timer above — which is why the
  // composer primes the audio element on the Give-clue tap rather than relying
  // on this call to do it (see `primeWordAudio` in speak.ts). It hangs off
  // `lastAiGuess`, which changes exactly once per `stepAiGuess`, so the reveal
  // beat speaks the word once however many times this panel re-renders.
  useEffect(() => {
    if (!lastAiGuess) return
    const word = game.words.find((w) => w.wordId === lastAiGuess.wordId)
    if (word) void playWord(word.wordId)
  }, [lastAiGuess, game.words])

  // While the turn is being paced, the reveal belongs to the reveal beat — a
  // tap that hurries past it must take it off screen with the rest of the
  // beat. Once the turn is over there is no beat left to belong to, and what
  // is left of the hold is the reveal itself.
  // A fresh assisted plan may arrive while this reveal is held. It can be
  // prepared in the store, but its THINK must wait until the reveal completes.
  const landed = held

  // The AUTHORED OPENING never shows the thinking bubble (owner decision
  // 2026-09-18: the first clue is in the app and lands in the same tick —
  // gameStore's baked OPENING). The guard is the safety net for the network
  // fallback: a quiet dock beats a deliberation the round does not have.
  // Model-backed openings (daily, seeded, wrap-up, other cities) and every
  // later clue turn still show the thinking state, because those really are
  // waiting on Casey.
  const authoredOpening =
    game.phase === 'aiClueInput' && game.clueHistory.length === 0 && !!authoredBoardId

  if (authoredOpening) {
    // Quiet shell, same height: the two-region layout holds, the deliberation
    // does not paint, and the clue replaces it within the tick (or, on the
    // network fallback, as soon as the Worker answers).
    return (
      <div className="dock ai-panel">
        <p className="ai-line-blank" aria-hidden="true" />
      </div>
    )
  }

  if ((game.phase === 'aiClueInput' || aiBusy) && !landed) {
    return (
      <div className={`dock ai-panel${cafe ? ' ai-panel-cafe' : ''}`}>
        <div className="ai-say">
          <ClueyFace mood="thinking" className={`cluey-mini${cafe ? ' cluey-thinking-large' : ''}`} />
          <p className={`ai-bubble thinking${offlineCasey ? ' offline' : ''}`}>
            <span className="dots" /> {offlineCasey ? UI.game.offlineCaseyIsThinking : UI.game.caseyIsThinking}
          </p>
        </div>
        {/* The line's ROOM, rendered empty rather than omitted: the same two
            regions in every state is what keeps the face and the bubble at the
            same height while Casey thinks. A different class on purpose —
            ai-drive, live-drive and proxy-drive all treat `.ai-guess-line`
            as "a guess has been reported", and an empty one wearing that name
            would answer them with nothing. */}
        <p className="ai-line-blank" aria-hidden="true" />
      </div>
    )
  }

  if (game.phase !== 'aiGuessing' && !landed) return null

  // Which guess this pair of beats is ABOUT: the one she is choosing while she
  // thinks, the one she just named while it lands. Preserve that primary
  // sentence; only a landed miss may append its genuine second choice.
  const bubble = caseyBubble(landed, next)

  const mood: ClueyMood = !landed ? 'thinking' : landed.result === 'green' ? 'happy' : 'oops'

  return (
    <div
      className="dock ai-panel"
      // What is on SCREEN rather than what the clock thinks, because the
      // rectangle layout-drive compares per beat is a fact about the former —
      // and a reveal held past the end of the turn is still a reveal beat.
      data-beat={landed ? 'reveal' : 'think'}
      // Only while there is a turn left to hurry. A held reveal with another
      // guess waiting can be skipped into THINK; a terminal hold offers no
      // pointer control because there is no next beat.
      {...(guessing ? { 'data-hurry': '1', title: UI.game.hurryCaseyTitle } : {})}
      onClick={guessing ? hurry : undefined}
    >
      <div className="ai-say">
        <ClueyFace mood={mood} className="cluey-mini" />
        {/* The short sentence wraps within the existing dock; the title
            also retains any longer reply beyond its four-line limit. */}
        <p className="ai-bubble" title={bubble}>
          {bubble}
        </p>
      </div>
      {landed ? (
        <p className={`ai-guess-line result-${landed.result}`}>
          «<strong>{landed.da}</strong>»{landed.result === 'green' && UI.game.guessGotOne}
          {landed.result === 'bystander' && UI.game.guessNeutral}
        </p>
      ) : (
        <p className="ai-guess-line">
          {next ? UI.game.caseyChoosingWord : UI.game.caseyChoosingWhether}
        </p>
      )}
    </div>
  )
}
