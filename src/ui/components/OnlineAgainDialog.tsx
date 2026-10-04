import { UI } from '../../i18n'
import { Tag } from './Tag'

interface Props {
  onPlayOnline: () => void
  onStayOffline: () => void
}

/**
 * The internet is back during an offline round: offer normal Casey for the
 * rest of it (owner, 2026-09-27). She is faster and plays better, but on a
 * connection that keeps dropping, offline Casey can be the steadier choice,
 * so the dialog says that too and lets the player decide. The dark field does
 * not choose for them: neither answer is a safe default to land on by accident.
 */
export function OnlineAgainDialog({ onPlayOnline, onStayOffline }: Props) {
  return (
    <div className="online-again-scrim">
      <section
        className="online-again-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-again-title"
      >
        <h2 id="online-again-title">{UI.game.onlineAgainTitle}</h2>
        <p>{UI.game.onlineAgainBody}</p>
        <div className="online-again-actions">
          <Tag size="wide" tone="primary" data-action="play-online" label={UI.game.playOnlineButton} onClick={onPlayOnline} />
          <Tag size="wide" data-action="stay-offline" label={UI.game.stayOfflineButton} onClick={onStayOffline} />
        </div>
      </section>
    </div>
  )
}
