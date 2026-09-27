import { useEffect, useRef, useState } from 'react'
import type { Side } from '../../engine/types'
import { UI } from '../../i18n'
import { turnHaptic } from '../feedback'

/**
 * The turn-takeover card, standing in the dock's rectangle while a turn
 * changes hands.
 *
 * Fired by GameScreen ONLY when the round's clue-giver flips (the `turn` prop
 * is a fresh identity per giver change — see the key on it there), because the
 * phase machine turns over twice per turn (clue → guessing) and only one of
 * those is "now it's you" or "now it's Casey". Same-giver micro-transitions —
 * a clue of one, sudden death opening — fire nothing: `giverOf` never moves,
 * so no new key is minted.
 *
 * ~1.8s total (owner, build 87: the card "is over way too fast" — the hold
 * roughly doubled), INSIDE the dock's reserved height (--dock-h): the card is
 * `position: absolute` over the screen's own dock slot, so the board cannot
 * move under it — the takeover borrows the rectangle the dock already owns.
 * The real dock mounts beneath it on the same commit; the card clears out
 * before the composer could want the keyboard (its input has no autofocus; a
 * keyboard rides a focus event, which the card's unmount does not fire).
 *
 * The handoff keeps its light haptic and makes no sound of its own. The
 * practice round shows the same cards as every round.
 */
export function TurnTakeover({ turn, side, onGone }: { turn: number; side: Side | 'translation'; onGone?: () => void }) {
  const [stage, setStage] = useState<'in' | 'out' | 'gone'>('in')
  const onGoneRef = useRef(onGone)
  onGoneRef.current = onGone

  useEffect(() => {
    setStage('in')
    if (side === 'player') turnHaptic()
    const hold = window.setTimeout(() => setStage('out'), 1400)
    const done = window.setTimeout(() => {
      setStage('gone')
      onGoneRef.current?.()
    }, 1800)
    return () => {
      window.clearTimeout(hold)
      window.clearTimeout(done)
    }
  }, [turn, side])

  if (stage === 'gone') return null

  const line =
    side === 'translation' ? UI.game.phaseTranslateChallenge : side === 'player'
      ? // The player's two sides of a turn: cluing Casey, or guessing under hers.
        UI.game.phaseGiveClue
      : // Casey's side of either phase. `phaseGiveClue` reads as an instruction
        // to the player, so her card takes the caption the header already
        // uses for her turns.
        UI.game.phaseCaseyClue

  return (
    <div className={`turn-takeover ${stage === 'out' ? 'turn-takeover-out' : ''}`} aria-hidden="true">
      <p className="turn-takeover-line">{line}</p>
    </div>
  )
}
