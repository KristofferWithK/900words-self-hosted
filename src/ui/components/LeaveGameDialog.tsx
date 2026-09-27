import { UI } from '../../i18n'

interface Props {
  onKeepPlaying: () => void
  onPause: () => void
  onCancelRound: () => void
}

/** The one exit decision for every unfinished ordinary/daily/wrap-up round. */
export function LeaveGameDialog({ onKeepPlaying, onPause, onCancelRound }: Props) {
  return (
    <div className="leave-game-scrim" onClick={onKeepPlaying}>
      <section
        className="leave-game-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-game-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="leave-game-title">{UI.game.leaveTitle}</h2>
        <p>{UI.game.leaveBody}</p>
        <div className="leave-game-actions">
          <button className="btn btn-ghost" type="button" onClick={onKeepPlaying}>
            {UI.game.leaveKeepPlaying}
          </button>
          <button className="btn btn-primary" type="button" onClick={onPause}>
            {UI.game.leavePause}
          </button>
          <button className="btn btn-danger" type="button" onClick={onCancelRound}>
            {UI.game.leaveCancelRound}
          </button>
        </div>
      </section>
    </div>
  )
}
