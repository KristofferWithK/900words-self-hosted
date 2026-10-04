import { UI } from '../../i18n'
import { Tag } from './Tag'

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
          <Tag size="wide" className="leave-keep-playing" label={UI.game.leaveKeepPlaying} onClick={onKeepPlaying} />
          <Tag size="wide" tone="primary" className="leave-pause" label={UI.game.leavePause} onClick={onPause} />
          <Tag size="wide" className="tag-danger leave-cancel-round" label={UI.game.leaveCancelRound} onClick={onCancelRound} />
        </div>
      </section>
    </div>
  )
}
