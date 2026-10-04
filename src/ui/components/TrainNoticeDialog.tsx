import { useCallback } from 'react'
import { useDialog } from '../useDialog'
import { Tag } from './Tag'

interface Props {
  title: string
  body: string
  /** The one action: dismiss, or — once the line is open — board. */
  action: string
  onAction: () => void
  onClose: () => void
}

/**
 * The notice a player meets at the platform: the line is closed for
 * maintenance, or it has just reopened. One card, one button, over whatever
 * screen offered the train — it borrows the leave-game dialog's shell so it
 * costs the layout nothing (Home may not grow a row; layout-drive measures).
 */
export function TrainNoticeDialog({ title, body, action, onAction, onClose }: Props) {
  const close = useCallback(() => onClose(), [onClose])
  const ref = useDialog(true, close)
  return (
    <div className="leave-game-scrim" onClick={close}>
      <section
        ref={ref}
        tabIndex={-1}
        className="leave-game-dialog train-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="train-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="train-notice-title">{title}</h2>
        <p>{body}</p>
        <div className="leave-game-actions">
          <Tag size="wide" tone="primary" label={action} onClick={onAction} />
        </div>
      </section>
    </div>
  )
}
